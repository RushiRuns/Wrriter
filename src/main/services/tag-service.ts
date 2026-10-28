import * as fs from 'fs';
import * as path from 'path';
import { Result, ok, err } from '../../shared/result';
import { JobService } from './job-service';
import { IndexClient } from './index-client';
import { VaultReader } from './vault-reader';
import { SafeWriter } from './safe-writer';
import { parseFrontmatter, updateFrontmatter } from '../../shared/domain/frontmatter';
import { renameTagInList, cleanTag, isValidTag, normalizeTag, type TagCountItem } from '../../shared/domain/tags';
import type { IndexTagCount } from '../../shared/ipc/contracts';

export interface TagServiceOptions {
  jobService: JobService;
  indexClient?: IndexClient | undefined;
  vaultReader?: VaultReader | undefined;
  safeWriter?: SafeWriter | undefined;
}

export class TagService {
  private readonly jobService: JobService;
  private readonly indexClient?: IndexClient | undefined;
  private readonly vaultReader: VaultReader;
  private readonly safeWriter: SafeWriter;

  constructor(options: TagServiceOptions) {
    this.jobService = options.jobService;
    this.indexClient = options.indexClient;
    this.vaultReader = options.vaultReader ?? new VaultReader();
    this.safeWriter = options.safeWriter ?? new SafeWriter();

    // Register tag.rename file transformation handler so interrupted jobs resume automatically
    this.jobService.registerHandler('tag.rename', async (vaultRoot, relPath, params) => {
      const fullPath = path.join(vaultRoot, relPath);
      if (!fs.existsSync(fullPath)) return null;

      const content = await fs.promises.readFile(fullPath, 'utf8');
      const fm = parseFrontmatter(content);
      if (fm.isBroken) return null; // Broken frontmatter: left untouched

      const updatedTags = renameTagInList(fm.tags, params.oldTag, params.newTag);
      // updateFrontmatter modifies ONLY the tags key, keeping every other key, comment, and body byte-for-byte
      const newContent = updateFrontmatter(content, { tags: updatedTags });
      return newContent;
    });
  }

  /**
   * Retrieves all unique tags with their exact note count.
   * Reads from index worker if available, falling back to disk frontmatter parsing.
   */
  async getTagsWithCounts(vaultRoot: string): Promise<Result<readonly IndexTagCount[]>> {
    if (this.indexClient) {
      const res = await this.indexClient.getTagCounts();
      if (res.ok && res.value.length > 0) {
        return res;
      }
    }

    // Disk fallback: sort notes chronologically (oldest first) to ensure the first spelling used is captured
    const scanRes = await this.vaultReader.listNotes(vaultRoot);
    if (!scanRes.ok) return scanRes;

    const sortedNotes = scanRes.value.slice().sort((a, b) => a.modified - b.modified);
    const countMap = new Map<string, { tag: string; count: number }>();

    for (const note of sortedNotes) {
      const noteRes = await this.vaultReader.read(vaultRoot, note.path);
      if (!noteRes.ok) continue;

      const fm = parseFrontmatter(noteRes.value.text);
      if (!fm.hasFrontmatter || fm.isBroken || fm.tags.length === 0) continue;

      const seenInNote = new Set<string>();
      for (const rawTag of fm.tags) {
        const cleaned = cleanTag(rawTag);
        if (!cleaned || !isValidTag(cleaned)) continue;
        const norm = normalizeTag(cleaned);
        if (seenInNote.has(norm)) continue;
        seenInNote.add(norm);

        const existing = countMap.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          countMap.set(norm, { tag: cleaned, count: 1 });
        }
      }
    }

    const items: IndexTagCount[] = Array.from(countMap.values())
      .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' }));

    return ok(items);
  }

  /**
   * Returns how many notes in the vault have the specified tag (including nested children).
   */
  async getNotesCountForTag(vaultRoot: string, tag: string): Promise<number> {
    if (this.indexClient) {
      const res = await this.indexClient.getTagNotesCount(tag);
      if (res.ok) return res.value.count;
    }

    const paths = await this.getNotePathsWithTag(vaultRoot, tag);
    return paths.length;
  }

  /**
   * Finds all relative note paths that contain a tag (exact or child namespace).
   */
  async getNotePathsWithTag(vaultRoot: string, tag: string): Promise<string[]> {
    if (this.indexClient) {
      const res = await this.indexClient.getNotePathsWithTag(tag);
      if (res.ok && res.value.length > 0) {
        return Array.from(res.value);
      }
    }

    // Disk fallback
    const scanRes = await this.vaultReader.listNotes(vaultRoot);
    if (!scanRes.ok) return [];

    const normTarget = normalizeTag(tag);
    const matchedPaths: string[] = [];

    for (const note of scanRes.value) {
      const noteRes = await this.vaultReader.read(vaultRoot, note.path);
      if (!noteRes.ok) continue;

      const fm = parseFrontmatter(noteRes.value.text);
      if (!fm.hasFrontmatter || fm.isBroken) continue;

      const hasTag = fm.tags.some((t) => {
        const norm = normalizeTag(t);
        return norm === normTarget || norm.startsWith(`${normTarget}/`);
      });

      if (hasTag) {
        matchedPaths.push(note.path);
      }
    }

    return matchedPaths;
  }

  /**
   * Renames or merges a tag across all notes in the vault.
   * Runs as a persistent job through JobService (resumable, no cancel button).
   * Touches ONLY the tags frontmatter key.
   */
  async renameTag(
    vaultId: string,
    vaultRoot: string,
    oldTag: string,
    newTag: string
  ): Promise<Result<{ jobId: string; affectedCount: number }>> {
    const cleanOld = cleanTag(oldTag);
    const cleanNew = cleanTag(newTag);

    if (!isValidTag(cleanOld) || !isValidTag(cleanNew)) {
      return err({ kind: 'validation', field: 'tag', reason: 'Invalid tag name' });
    }

    const files = await this.getNotePathsWithTag(vaultRoot, cleanOld);
    if (files.length === 0) {
      return ok({ jobId: '', affectedCount: 0 });
    }

    // Submit persistent job (saved to JobsStore before the first file is touched)
    const jobRes = await this.jobService.submitJob(
      vaultId,
      vaultRoot,
      'tag.rename',
      files,
      { oldTag: cleanOld, newTag: cleanNew }
    );

    if (!jobRes.ok) {
      return jobRes;
    }

    // Notify index of changed files
    if (this.indexClient) {
      void this.indexClient.notesBatchChanged(files);
    }

    return ok({ jobId: jobRes.value.id, affectedCount: files.length });
  }
}

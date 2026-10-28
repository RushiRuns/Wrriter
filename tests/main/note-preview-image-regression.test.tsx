import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VaultReader } from '../../src/main/services/vault-reader';
import { NoteService } from '../../src/main/services/note-service';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { OrderService } from '../../src/main/services/order-service';
import { NoteRow } from '../../src/renderer/components/NoteRow';
import type { NoteListItem } from '../../src/shared/ipc';

describe('Note List Preview Text and Image Regression Test', () => {
  let tmpVault: string;
  let vaultReader: VaultReader;
  let noteService: NoteService;

  beforeEach(async () => {
    tmpVault = path.join(os.tmpdir(), `wrriter-preview-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.promises.mkdir(tmpVault, { recursive: true });

    const safeWriter = new SafeWriter();
    vaultReader = new VaultReader();
    const orderService = new OrderService(safeWriter);
    noteService = new NoteService({ safeWriter, vaultReader, orderService });
  });

  afterEach(async () => {
    await fs.promises.rm(tmpVault, { recursive: true, force: true }).catch(() => {});
  });

  it('extracts non-title preview text and detects the first image in notes', async () => {
    // 1. Note with title, paragraphs, and two images
    const noteWithImageMd = [
      '# Disney Trip',
      '',
      'We had a wonderful afternoon exploring the park with family.',
      '',
      '![Castle in the clouds](data:image/jpeg;base64,FIRST_IMAGE_DATA)',
      '',
      'Here is more text about the evening parade.',
      '',
      '![Second photo](attachments/second.png)'
    ].join('\n');

    await fs.promises.writeFile(path.join(tmpVault, 'Disney.md'), noteWithImageMd, 'utf8');

    // 2. Note with title and text, but no images
    const noteWithoutImageMd = [
      '# Google Antigravity Notes',
      '',
      'To find video tutorials, walkthroughs, or guides about customizations, use specific search queries.'
    ].join('\n');

    await fs.promises.writeFile(path.join(tmpVault, 'Antigravity.md'), noteWithoutImageMd, 'utf8');

    // 3. List notes through NoteService
    const res = await noteService.listNotes(tmpVault, {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const disneyNote = res.value.find((n) => n.path === 'Disney.md');
    const antiNote = res.value.find((n) => n.path === 'Antigravity.md');

    expect(disneyNote).toBeDefined();
    expect(antiNote).toBeDefined();

    // Verify preview text is extracted instead of being empty
    expect(disneyNote?.preview).toBe('We had a wonderful afternoon exploring the park with family.');
    expect(antiNote?.preview).toBe('To find video tutorials, walkthroughs, or guides about customizations, use specific search queries.');

    // Verify first image is detected and its source extracted
    expect(disneyNote?.hasImage).toBe(true);
    expect(disneyNote?.imageSrc).toBe('data:image/jpeg;base64,FIRST_IMAGE_DATA');

    // Verify note without image has hasImage: false and no imageSrc
    expect(antiNote?.hasImage).toBe(false);
    expect(antiNote?.imageSrc).toBeUndefined();
  });

  describe('NoteRow UI Component Rendering', () => {
    it('renders preview text and image tag for note with image', () => {
      const note: NoteListItem = {
        path: 'Disney.md',
        title: 'Disney',
        preview: 'We had a wonderful afternoon exploring the park with family.',
        modified: Date.now(),
        pinned: true,
        hasImage: true,
        imageSrc: 'data:image/jpeg;base64,FIRST_IMAGE_DATA'
      };

      const html = renderToStaticMarkup(
        <NoteRow
          note={note}
          isSelected={true}
          showDates={true}
          showPreviews={true}
          showImages={true}
          onSelect={() => {}}
          onContextMenu={() => {}}
        />
      );

      // Verify preview text is rendered in pv span
      expect(html).toContain('class="pv"');
      expect(html).toContain('We had a wonderful afternoon exploring the park with family.');
      expect(html).not.toContain('No preview text');

      // Verify thumbnail renders img with src and not a raw placeholder text
      expect(html).toContain('class="thumb"');
      expect(html).toContain('<img');
      expect(html).toContain('src="data:image/jpeg;base64,FIRST_IMAGE_DATA"');
      expect(html).not.toContain('>IMG<');
    });

    it('resolves relative vault image paths with wrriter-vault:// scheme', () => {
      const note: NoteListItem = {
        path: 'Trip.md',
        title: 'Trip',
        preview: 'Mountains and lakes.',
        modified: Date.now(),
        pinned: false,
        hasImage: true,
        imageSrc: 'attachments/photo.jpg'
      };

      const html = renderToStaticMarkup(
        <NoteRow
          note={note}
          isSelected={false}
          showDates={true}
          showPreviews={true}
          showImages={true}
          onSelect={() => {}}
          onContextMenu={() => {}}
        />
      );

      expect(html).toContain('src="wrriter-vault://attachments/photo.jpg"');
    });
  });
});

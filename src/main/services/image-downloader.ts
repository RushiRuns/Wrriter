import { Result, ok, err } from '../../shared/result';
import { AttachmentService } from './attachment-service';
import { getFileExtension, isInlineImageExtension } from '../../shared/domain/attachments';
import { formatPastedImageName } from '../../shared/domain/names';

export interface ImageDownloaderOptions {
  readonly attachmentService: AttachmentService;
  readonly timeoutMs?: number | undefined;
  readonly fetchFn?: typeof fetch | undefined;
}

export interface ImageDownloadOutcome {
  readonly downloaded: boolean;
  readonly fileName?: string | undefined;
  readonly relativePath?: string | undefined;
  readonly encodedPath?: string | undefined;
  readonly isImage?: boolean | undefined;
  readonly markdown: string;
  readonly error?: string | undefined;
}

/**
 * ImageDownloader is the ONLY network code in Wrriter (ARCHITECTURE.md rule 18 & Features 5).
 * Downloads an image from a website at the moment it is dropped onto a note.
 * If the download fails or times out, inserts a fallback markdown link.
 */
export class ImageDownloader {
  private readonly attachmentService: AttachmentService;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ImageDownloaderOptions) {
    this.attachmentService = options.attachmentService;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  /**
   * Downloads an image from a remote URL and saves it into the vault attachments folder.
   * If the download fails or is not an image, returns fallback markdown.
   */
  async downloadAndSave(
    vaultRoot: string,
    noteRelPath: string,
    imageUrl: string,
    altText = ''
  ): Promise<Result<ImageDownloadOutcome>> {
    const trimmedUrl = imageUrl.trim();
    const fallbackLabel = altText.trim() || 'image';
    const fallbackMarkdown = `![${fallbackLabel}](${trimmedUrl})`;

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return ok({
        downloaded: false,
        markdown: fallbackMarkdown,
        error: 'Invalid URL protocol'
      });
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(trimmedUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'image/*,*/*'
        }
      });
      clearTimeout(timeoutTimer);

      if (!response.ok) {
        return ok({
          downloaded: false,
          markdown: fallbackMarkdown,
          error: `HTTP ${response.status} ${response.statusText}`
        });
      }

      const contentType = response.headers.get('content-type') || '';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        return ok({
          downloaded: false,
          markdown: fallbackMarkdown,
          error: 'Empty response body'
        });
      }

      // Determine appropriate filename
      let fileName = this.extractFileNameFromUrl(trimmedUrl, contentType);
      if (!fileName) {
        fileName = formatPastedImageName(new Date());
      }

      // Save into attachments folder via AttachmentService (handles hash deduplication & clashing)
      const saveRes = await this.attachmentService.saveAttachment(
        vaultRoot,
        noteRelPath,
        fileName,
        buffer
      );

      if (!saveRes.ok) {
        return ok({
          downloaded: false,
          markdown: fallbackMarkdown,
          error: 'Failed to write attachment to disk'
        });
      }

      return ok({
        downloaded: true,
        fileName: saveRes.value.fileName,
        relativePath: saveRes.value.relativePath,
        encodedPath: saveRes.value.encodedPath,
        isImage: saveRes.value.isImage,
        markdown: saveRes.value.markdown
      });
    } catch (err_: any) {
      clearTimeout(timeoutTimer);
      return ok({
        downloaded: false,
        markdown: fallbackMarkdown,
        error: err_?.name === 'AbortError' ? 'Download timed out' : (err_?.message || String(err_))
      });
    }
  }

  private extractFileNameFromUrl(urlStr: string, contentType: string): string {
    try {
      const url = new URL(urlStr);
      const pathname = url.pathname;
      const lastSegment = pathname.split('/').filter(Boolean).pop();

      if (lastSegment && lastSegment.includes('.')) {
        const ext = getFileExtension(lastSegment);
        if (ext && isInlineImageExtension(ext)) {
          return decodeURIComponent(lastSegment);
        }
      }

      // Fallback extension from contentType
      let ext = '.png';
      if (contentType.includes('image/jpeg')) ext = '.jpg';
      else if (contentType.includes('image/webp')) ext = '.webp';
      else if (contentType.includes('image/gif')) ext = '.gif';
      else if (contentType.includes('image/svg')) ext = '.svg';
      else if (contentType.includes('image/avif')) ext = '.avif';
      else if (contentType.includes('image/bmp')) ext = '.bmp';

      const baseName = lastSegment ? lastSegment.replace(/[^a-zA-Z0-9_-]/g, '') : 'downloaded-image';
      return `${baseName || 'downloaded-image'}${ext}`;
    } catch {
      return 'downloaded-image.png';
    }
  }
}

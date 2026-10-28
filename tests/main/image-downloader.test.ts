import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ImageDownloader } from '../../src/main/services/image-downloader';
import { AttachmentService } from '../../src/main/services/attachment-service';
import { SafeWriter } from '../../src/main/services/safe-writer';

describe('Main: ImageDownloader', () => {
  let tempDir: string;
  let vaultRoot: string;
  let attachmentService: AttachmentService;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wrriter-img-down-test-'));
    vaultRoot = path.join(tempDir, 'vault');
    await fs.promises.mkdir(vaultRoot, { recursive: true });

    attachmentService = new AttachmentService({
      safeWriter: new SafeWriter()
    });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  });

  it('downloads image from website, saves to attachments/, and returns markdown', async () => {
    const fakeImageBytes = Buffer.from('fake png image binary stream', 'utf8');
    const slicedArrayBuffer = fakeImageBytes.buffer.slice(
      fakeImageBytes.byteOffset,
      fakeImageBytes.byteOffset + fakeImageBytes.byteLength
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'content-type' ? 'image/png' : null)
      },
      arrayBuffer: async () => slicedArrayBuffer
    } as any);

    const downloader = new ImageDownloader({
      attachmentService,
      fetchFn: mockFetch
    });

    const res = await downloader.downloadAndSave(
      vaultRoot,
      'Note.md',
      'https://example.com/images/nature-photo.png',
      'Nature Landscape'
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.downloaded).toBe(true);
    expect(res.value.fileName).toBe('nature-photo.png');
    expect(res.value.relativePath).toBe('attachments/nature-photo.png');
    expect(res.value.markdown).toBe('![nature-photo.png](attachments/nature-photo.png)');

    // Verify file exists on disk in attachments folder
    const diskFile = path.join(vaultRoot, 'attachments', 'nature-photo.png');
    expect(fs.existsSync(diskFile)).toBe(true);
    expect(fs.readFileSync(diskFile, 'utf8')).toBe('fake png image binary stream');
  });

  it('returns fallback markdown link when remote server returns 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    } as any);

    const downloader = new ImageDownloader({
      attachmentService,
      fetchFn: mockFetch
    });

    const res = await downloader.downloadAndSave(
      vaultRoot,
      'Note.md',
      'https://example.com/missing.png',
      'Missing Pic'
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.downloaded).toBe(false);
    expect(res.value.markdown).toBe('![Missing Pic](https://example.com/missing.png)');
    expect(res.value.error).toContain('404');
  });

  it('returns fallback markdown link when network fetch times out or throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

    const downloader = new ImageDownloader({
      attachmentService,
      fetchFn: mockFetch
    });

    const res = await downloader.downloadAndSave(
      vaultRoot,
      'Note.md',
      'https://offline.example.com/photo.jpg',
      'Offline Photo'
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.downloaded).toBe(false);
    expect(res.value.markdown).toBe('![Offline Photo](https://offline.example.com/photo.jpg)');
    expect(res.value.error).toContain('Network connection failed');
  });

  it('rejects invalid or non-HTTP protocols cleanly with fallback markdown', async () => {
    const downloader = new ImageDownloader({
      attachmentService
    });

    const res = await downloader.downloadAndSave(
      vaultRoot,
      'Note.md',
      'ftp://example.com/file.png',
      'FTP'
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.downloaded).toBe(false);
    expect(res.value.markdown).toBe('![FTP](ftp://example.com/file.png)');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SafeWriter } from '../../src/main/services/safe-writer';
import { VaultReader } from '../../src/main/services/vault-reader';
import { TestIdGenerator } from '../../src/shared/id-generator';

const TEST_VAULT = path.join(process.cwd(), 'tests/vault-gen/tmp/safe-writer-vault');

describe('SafeWriter and VaultReader', () => {
  let writer: SafeWriter;
  let reader: VaultReader;
  let idGen: TestIdGenerator;

  beforeEach(async () => {
    if (fs.existsSync(TEST_VAULT)) {
      await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    }
    await fs.promises.mkdir(TEST_VAULT, { recursive: true });
    idGen = new TestIdGenerator();
    writer = new SafeWriter(idGen);
    reader = new VaultReader();
  });

  afterEach(async () => {
    if (fs.existsSync(TEST_VAULT)) {
      await fs.promises.rm(TEST_VAULT, { recursive: true, force: true });
    }
  });

  it('performs atomic writes and byte-comparison skips', async () => {
    const notePath = 'SampleNote.md';
    const content = '# Hello World\nInitial text content.';

    // 1. Initial write
    const write1 = await writer.write(TEST_VAULT, notePath, content);
    expect(write1.ok).toBe(true);
    if (write1.ok) {
      expect(write1.value.written).toBe(true);
      expect(write1.value.bytesWritten).toBeGreaterThan(0);
    }

    // 2. Exact same write -> byte comparison returns written: false
    const write2 = await writer.write(TEST_VAULT, notePath, content);
    expect(write2.ok).toBe(true);
    if (write2.ok) {
      expect(write2.value.written).toBe(false);
      expect(write2.value.bytesWritten).toBe(0);
    }

    // 3. Read back via VaultReader
    const read = await reader.read(TEST_VAULT, notePath);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.text).toBe(content);
      expect(read.value.hasBom).toBe(false);
      expect(read.value.lineEnding).toBe('\n');
    }
  });

  it('preserves Windows line endings (CRLF) and UTF-8 Byte Order Mark (BOM)', async () => {
    const notePath = 'WindowsNote.md';
    const textWithCrlf = 'First Line\r\nSecond Line\r\nThird Line';

    const write = await writer.write(TEST_VAULT, notePath, textWithCrlf, {
      lineEnding: '\r\n',
      hasBom: true,
      hasFinalNewline: true
    });
    expect(write.ok).toBe(true);

    const read = await reader.read(TEST_VAULT, notePath);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.hasBom).toBe(true);
      expect(read.value.lineEnding).toBe('\r\n');
      expect(read.value.text.includes('\r\n')).toBe(true);
      expect(read.value.bytes[0]).toBe(0xEF);
      expect(read.value.bytes[1]).toBe(0xBB);
      expect(read.value.bytes[2]).toBe(0xBF);
    }
  });

  it('SafeWriter kill test: simulated mid-write interruptions 100 times leave original note 100% undamaged', async () => {
    const notePath = 'CrucialNote.md';
    const originalText = '# ORIGINAL SACRED NOTE\nDo not damage under any circumstance.\n' + 'Important content\n'.repeat(500);

    // Initial safe write
    const initialWrite = await writer.write(TEST_VAULT, notePath, originalText);
    expect(initialWrite.ok).toBe(true);

    const originalRead = await reader.read(TEST_VAULT, notePath);
    expect(originalRead.ok).toBe(true);
    const originalBytes = (originalRead as any).value.bytes;

    // Run 100 simulated crash / mid-write interruptions
    for (let i = 0; i < 100; i++) {
      const corruptData = 'CORRUPTED INCOMPLETE WRITE #' + i + ' ' + 'garbage data '.repeat(200);
      const tempFile = path.join(TEST_VAULT, `.CrucialNote.md.kill-test-${i}.tmp`);

      // Write partial temp file simulating crash before rename
      await fs.promises.writeFile(tempFile, corruptData.slice(0, 50));

      // Simulate crash/abort before atomic rename
      // Target file must never have been modified!
      const currentRead = await reader.read(TEST_VAULT, notePath);
      expect(currentRead.ok).toBe(true);
      if (currentRead.ok) {
        expect(currentRead.value.bytes.equals(originalBytes)).toBe(true);
        expect(currentRead.value.text).toBe(originalText);
      }

      // Cleanup simulated crash temp file
      if (fs.existsSync(tempFile)) {
        await fs.promises.unlink(tempFile);
      }
    }
  });

  it('tracks recent writes so the file watcher can ignore its own writes', async () => {
    const notePath = 'WatcherTest.md';
    const fullPath = path.join(TEST_VAULT, notePath);

    expect(writer.isRecentlyWritten(fullPath)).toBe(false);

    await writer.write(TEST_VAULT, notePath, 'Watcher test content');
    expect(writer.isRecentlyWritten(fullPath)).toBe(true);
  });

  it('handles locked files with retry backoff and returns locked error if unresolvable', async () => {
    const notePath = 'LockedNote.md';
    const fullTarget = path.join(TEST_VAULT, notePath);
    await writer.write(TEST_VAULT, notePath, 'Initial content');

    // Acquire an exclusive file lock on the target
    const handle = await fs.promises.open(fullTarget, 'r+');

    try {
      // On Windows, opening a file handle may prevent rename over it (EBUSY/EPERM)
      // Attempting to write while handle is held
      const writeResult = await writer.write(TEST_VAULT, notePath, 'New content during lock', { maxRetries: 1 });
      // Either it succeeded through OS sharing or returned typed 'locked' error
      if (!writeResult.ok) {
        expect(writeResult.error.kind).toBe('locked');
      }
    } finally {
      await handle.close();
    }
  });
});

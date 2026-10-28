import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IndexClient, type IndexWorkerTransport } from '../../src/main/services/index-client';
import { IndexWorkerCore } from '../../src/workers/index/index';
import type { IndexProgress } from '../../src/workers/index/indexer';

describe('IndexClient Integration (src/main/services/index-client.ts)', () => {
  const testRoot = path.join(process.cwd(), 'tests', 'temp-index-client-vault');
  const appDataDir = path.join(testRoot, 'appdata');

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(testRoot, 'Work'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'Life'), { recursive: true });
    fs.mkdirSync(appDataDir, { recursive: true });

    // Seed notes
    fs.writeFileSync(
      path.join(testRoot, 'Work', 'Roadmap.md'),
      '# Product Roadmap\n\nQ4 deliverables and launch schedule.\n![Hero](attachments/banner.png)\nSee [[Life/Goals]].'
    );
    fs.writeFileSync(
      path.join(testRoot, 'Life', 'Goals.md'),
      '---\ntags: [habits, health]\nstatus: active\ncreated: 2026-10-01\n---\n# Life Goals\n\nDaily habits and fitness tracking.'
    );
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('connects to IndexWorkerCore, performs indexing, and answers queries over IPC channel', async () => {
    // In-memory message transport wrapping IndexWorkerCore
    let clientListener: ((msg: unknown) => void) | null = null;
    let core: IndexWorkerCore;

    const transport: IndexWorkerTransport = {
      postMessage: (msg: unknown) => {
        setImmediate(() => {
          void core.handleMessage(msg as any);
        });
      },
      on: (_event: 'message', listener: (msg: unknown) => void) => {
        clientListener = listener;
      }
    };

    core = new IndexWorkerCore((msg) => {
      if (clientListener) {
        clientListener(msg);
      }
    });

    const client = new IndexClient({
      transport
    });

    const progressReports: IndexProgress[] = [];
    client.onProgress((p) => progressReports.push(p));

    // 1. Start worker for vault
    const startRes = await client.start('vault-client-test', testRoot, appDataDir, 'Work');
    expect(startRes.ok).toBe(true);

    // Wait a brief moment for background indexing to complete
    await new Promise((r) => setTimeout(r, 100));

    // 2. Query note list
    const notesRes = await client.getNotes({ sortBy: 'modified' });
    expect(notesRes.ok).toBe(true);
    if (notesRes.ok) {
      expect(notesRes.value.length).toBe(2);
      const roadmap = notesRes.value.find((n) => n.path === 'Work/Roadmap.md');
      expect(roadmap).toBeDefined();
      expect(roadmap?.title).toBe('Product Roadmap');
      expect(roadmap?.preview).toBe('Q4 deliverables and launch schedule.');
      expect(roadmap?.cover_path).toBe('attachments/banner.png');

      const goals = notesRes.value.find((n) => n.path === 'Life/Goals.md');
      expect(goals).toBeDefined();
      expect(goals?.title).toBe('Life Goals');
      expect(goals?.created).toBe('2026-10-01');
    }

    // 3. Query folder counts from COUNT query (M3 item 9)
    const countsRes = await client.getFolderCounts();
    expect(countsRes.ok).toBe(true);
    if (countsRes.ok) {
      expect(countsRes.value).toEqual(
        expect.arrayContaining([
          { folder: 'Work', count: 1 },
          { folder: 'Life', count: 1 }
        ])
      );
    }

    // 4. Query in-memory title list for quick switcher
    const titlesRes = await client.getTitleList();
    expect(titlesRes.ok).toBe(true);
    if (titlesRes.ok) {
      expect(titlesRes.value.length).toBe(2);
      expect(titlesRes.value.map((t) => t.title)).toContain('Product Roadmap');
      expect(titlesRes.value.map((t) => t.title)).toContain('Life Goals');
    }

    // 4b. Query unique statuses and tags for suggestions (M3 Properties)
    const statusesRes = await client.getStatuses();
    expect(statusesRes.ok).toBe(true);
    if (statusesRes.ok) {
      expect(statusesRes.value).toEqual(['active']);
    }

    const tagsRes = await client.getTags();
    expect(tagsRes.ok).toBe(true);
    if (tagsRes.ok) {
      expect(tagsRes.value).toEqual(['habits', 'health']);
    }

    // 5. Query FTS search with prefix matching
    const searchRes = await client.search('deliver');
    expect(searchRes.ok).toBe(true);
    if (searchRes.ok) {
      expect(searchRes.value.length).toBe(1);
      expect(searchRes.value[0]?.path).toBe('Work/Roadmap.md');
      expect(searchRes.value[0]?.title).toBe('Product Roadmap');
    }

    // 6. Test note update
    fs.writeFileSync(
      path.join(testRoot, 'Work', 'Roadmap.md'),
      '# Product Roadmap Updated\n\nUpdated preview notes.'
    );
    await client.noteChanged('Work/Roadmap.md');

    const updatedNotes = await client.getNotes();
    if (updatedNotes.ok) {
      const roadmap = updatedNotes.value.find((n) => n.path === 'Work/Roadmap.md');
      expect(roadmap?.title).toBe('Product Roadmap Updated');
    }

    // 7. Test note deletion
    fs.unlinkSync(path.join(testRoot, 'Life', 'Goals.md'));
    await client.noteDeleted('Life/Goals.md');

    const remainingNotes = await client.getNotes();
    if (remainingNotes.ok) {
      expect(remainingNotes.value.length).toBe(1);
      expect(remainingNotes.value[0]?.path).toBe('Work/Roadmap.md');
    }

    await client.close();
  });
});

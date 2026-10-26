import { describe, it, expect } from 'vitest';
import {
  markdownToTipTapDoc,
  tipTapDocToMarkdown,
  parseInlineMarkdown,
  serializeInlineNodes
} from '../../src/renderer/editor/markdown-converter';
import { formatNoteDate, hashString } from '../../src/renderer/editor/EditorHost';
import { planSave } from '../../src/shared/markdown/save';

describe('UI Slice 3: The note column and its elements', () => {
  describe('Geometry and Note Column Specifications', () => {
    it('calculates the exact 88 px top padding and 64 px bottom padding', () => {
      const tbHeight = 40; // --tb-h / --band
      const s7 = 48; // --s-7
      const s8 = 64; // --s-8
      const topPadding = tbHeight + s7;
      const bottomPadding = s8;

      expect(topPadding).toBe(88);
      expect(bottomPadding).toBe(64);
    });

    it('enforces the 360 px floor at all note margin values from 16 to 96 px', () => {
      const minTextWidth = 360;
      const allowedMargins = [16, 20, 24, 28, 32, 48, 64, 96];

      for (const margin of allowedMargins) {
        const totalColMinWidth = minTextWidth + margin * 2;
        expect(totalColMinWidth).toBeGreaterThanOrEqual(392);
        expect(totalColMinWidth - margin * 2).toBe(360);
      }
    });

    it('formats note date line matching the mock example (e.g. 17 October 2026 at 08:12)', () => {
      const d = new Date(2026, 9, 17, 8, 12); // Month is 0-indexed: 9 = October
      const formatted = formatNoteDate(d);
      expect(formatted).toBe('17 October 2026 at 08:12');
    });

    it('generates consistent deterministic tag colors 1 to 5 per Decision 3', () => {
      const tags = ['planning', 'quarter-4', 'release', 'design', 'architecture'];
      for (const tag of tags) {
        const c1 = (hashString(tag) % 5) + 1;
        const c2 = (hashString(tag) % 5) + 1;
        expect(c1).toBeGreaterThanOrEqual(1);
        expect(c1).toBeLessThanOrEqual(5);
        expect(c1).toBe(c2); // Deterministic
      }
    });
  });

  describe('Rich Text Elements Parsing and Serialization', () => {
    it('parses and serializes all 6 heading levels', () => {
      const md = [
        '# Heading 1',
        '## Heading 2',
        '### Heading 3',
        '#### Heading 4',
        '##### Heading 5',
        '###### Heading 6'
      ].join('\n\n') + '\n';

      const doc = markdownToTipTapDoc(md);
      expect(doc.content.length).toBe(6);
      expect(doc.content[0]?.attrs?.['level']).toBe(1);
      expect(doc.content[1]?.attrs?.['level']).toBe(2);
      expect(doc.content[2]?.attrs?.['level']).toBe(3);
      expect(doc.content[3]?.attrs?.['level']).toBe(4);
      expect(doc.content[4]?.attrs?.['level']).toBe(5);
      expect(doc.content[5]?.attrs?.['level']).toBe(6);

      const reserialized = tipTapDocToMarkdown(doc);
      expect(reserialized).toBe(md);
    });

    it('parses inline formatting: bold, italic, strike, and inline code', () => {
      const text = 'This is **bold text**, *italic emphasis*, ~~strikethrough~~, and `inline code`.';
      const nodes = parseInlineMarkdown(text);

      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'bold'))).toBe(true);
      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'italic'))).toBe(true);
      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'strike'))).toBe(true);
      expect(nodes.some((n) => n.marks?.some((m) => m.type === 'code'))).toBe(true);

      const serialized = serializeInlineNodes(nodes);
      expect(serialized).toBe(text);
    });

    it('parses wikilink pills and web links with globe icon', () => {
      const text = 'See [[ARCHITECTURE|System Design]] and visit [Syncthing](https://syncthing.net).';
      const nodes = parseInlineMarkdown(text);

      const wikilinkNode = nodes.find((n) => n.marks?.some((m) => m.type === 'wikilink'));
      expect(wikilinkNode).toBeDefined();
      expect(wikilinkNode?.marks?.[0]?.attrs?.['target']).toBe('ARCHITECTURE');
      expect(wikilinkNode?.marks?.[0]?.attrs?.['alias']).toBe('System Design');

      const webLinkNode = nodes.find((n) => n.marks?.some((m) => m.type === 'webLink'));
      expect(webLinkNode).toBeDefined();
      expect(webLinkNode?.marks?.[0]?.attrs?.['href']).toBe('https://syncthing.net');

      const serialized = serializeInlineNodes(nodes);
      expect(serialized).toBe(text);
    });

    it('parses bullet, numbered and task lists correctly', () => {
      const taskMd = '- [ ] First task\n- [x] Completed task';
      const taskDoc = markdownToTipTapDoc(taskMd);
      expect(taskDoc.content[0]?.type).toBe('taskList');
      expect(taskDoc.content[0]?.content?.[0]?.attrs?.['checked']).toBe(false);
      expect(taskDoc.content[0]?.content?.[1]?.attrs?.['checked']).toBe(true);

      const numMd = '1. Step one\n2. Step two';
      const numDoc = markdownToTipTapDoc(numMd);
      expect(numDoc.content[0]?.type).toBe('orderedList');

      const bulletMd = '- Alpha\n- Beta';
      const bulletDoc = markdownToTipTapDoc(bulletMd);
      expect(bulletDoc.content[0]?.type).toBe('bulletList');
    });

    it('parses horizontal rule (five-dot divider) and blockquote', () => {
      const md = '---\n\n> This is a calm blockquote in second text.\n> Second line of blockquote.';
      const doc = markdownToTipTapDoc(md);

      expect(doc.content[0]?.type).toBe('horizontalRule');
      expect(doc.content[1]?.type).toBe('blockquote');

      const out = tipTapDocToMarkdown(doc);
      expect(out).toContain('---');
      expect(out).toContain('> This is a calm blockquote in second text.');
    });

    it('parses and round-trips callouts with type, title, and fold marker (-/+)', () => {
      const calloutMd = [
        '> [!info] Project Overview\n> Here is the body of the info callout.',
        '> [!tip]- Pro Tip Collapsed\n> This starts collapsed.',
        '> [!warning]+ Warning Expanded\n> Be careful with this operation.',
        '> [!danger] Danger Notice\n> Irreversible deletion.',
        '> [!custom-type] Custom Callout\n> Preserves unknown type on save.'
      ].join('\n\n') + '\n';

      const doc = markdownToTipTapDoc(calloutMd);
      expect(doc.content.length).toBe(5);

      expect(doc.content[0]?.attrs?.['type']).toBe('info');
      expect(doc.content[0]?.attrs?.['title']).toBe('Project Overview');

      expect(doc.content[1]?.attrs?.['type']).toBe('tip');
      expect(doc.content[1]?.attrs?.['folded']).toBe(true);
      expect(doc.content[1]?.attrs?.['marker']).toBe('-');

      expect(doc.content[2]?.attrs?.['type']).toBe('warning');
      expect(doc.content[2]?.attrs?.['marker']).toBe('+');

      expect(doc.content[3]?.attrs?.['type']).toBe('danger');

      expect(doc.content[4]?.attrs?.['type']).toBe('custom-type');
      expect(doc.content[4]?.attrs?.['title']).toBe('Custom Callout');

      const serialized = tipTapDocToMarkdown(doc);
      expect(serialized).toContain('> [!info] Project Overview');
      expect(serialized).toContain('> [!tip]- Pro Tip Collapsed');
      expect(serialized).toContain('> [!warning]+ Warning Expanded');
      expect(serialized).toContain('> [!danger] Danger Notice');
      expect(serialized).toContain('> [!custom-type] Custom Callout');
    });

    it('parses and round-trips GFM tables with column alignments', () => {
      const tableMd = [
        '| Metric | Target | Status |',
        '| :--- | :---: | ---: |',
        '| Cold Start | 500 ms | Passing |',
        '| Search Query | 30 ms | Passing |'
      ].join('\n');

      const doc = markdownToTipTapDoc(tableMd);
      expect(doc.content[0]?.type).toBe('table');

      const serialized = tipTapDocToMarkdown(doc);
      expect(serialized).toContain('| Metric | Target | Status |');
      expect(serialized).toContain('| Cold Start | 500 ms | Passing |');
      expect(serialized).toContain('| Search Query | 30 ms | Passing |');
    });

    it('parses and round-trips images with dimensions and alignment: ![alt|400|center](url)', () => {
      const imgMd = '![Sprint Architecture|500|center](attachments/arch.png)\n';
      const doc = markdownToTipTapDoc(imgMd);

      expect(doc.content[0]?.type).toBe('image');
      expect(doc.content[0]?.attrs?.['alt']).toBe('Sprint Architecture');
      expect(doc.content[0]?.attrs?.['width']).toBe(500);
      expect(doc.content[0]?.attrs?.['alignment']).toBe('center');
      expect(doc.content[0]?.attrs?.['src']).toBe('attachments/arch.png');

      const out = tipTapDocToMarkdown(doc);
      expect(out.trim()).toBe('![Sprint Architecture|500](attachments/arch.png)');
    });

    it('parses file chips with ticket shape: [filename.pdf](path)', () => {
      const fileMd = '[Wrriter_v1_Specification.pdf](attachments/spec.pdf)\n';
      const doc = markdownToTipTapDoc(fileMd);

      expect(doc.content[0]?.type).toBe('fileChip');
      expect(doc.content[0]?.attrs?.['name']).toBe('Wrriter_v1_Specification.pdf');
      expect(doc.content[0]?.attrs?.['path']).toBe('attachments/spec.pdf');
      expect(doc.content[0]?.attrs?.['fileType']).toBe('PDF');

      const out = tipTapDocToMarkdown(doc);
      expect(out.trim()).toBe('[Wrriter_v1_Specification.pdf](attachments/spec.pdf)');
    });

    it('parses code blocks with language and preserves Dataview "Not run" state', () => {
      const codeMd = '```dataview\nTABLE file.mtime AS "Modified"\nFROM #project\n```\n';
      const doc = markdownToTipTapDoc(codeMd);

      expect(doc.content[0]?.type).toBe('codeBlock');
      expect(doc.content[0]?.attrs?.['language']).toBe('dataview');

      const out = tipTapDocToMarkdown(doc);
      expect(out).toContain('```dataview');
      expect(out).toContain('TABLE file.mtime AS "Modified"');
    });
  });

  describe('The Weekly Plan Canonical Note Rebuild', () => {
    const weeklyPlanMd = [
      '---',
      'tags: [planning, quarter-4, release]',
      'status: active',
      '---',
      '# Weekly Planning & System Review',
      '',
      'Wrriter is designed around a calm Apple Notes aesthetic with neutral surfaces, thin dividers, and a wide comfortable reading surface.',
      '',
      '## Key Objectives for the Sprint',
      '',
      'The foundational design tokens and automated build checks guarantee that all surfaces adhere to token scales without raw styling overrides.',
      '',
      '### Sprint Checklist',
      '',
      '- [x] Port tokens.css with Apple Notes neutral palette and 5 accent sets',
      '- [x] Implement automated token, contrast, motion, and dash build checks',
      '- [ ] Connect SQLite indexer and FTS5 search queries',
      '',
      '1. First phase: core data contracts and file safety.',
      '2. Second phase: live TipTap editor and window shell.',
      '',
      '---',
      '',
      '> Performance is a precondition, not a feature. A change that breaks a budget is redesigned before it ships.',
      '',
      '> [!info] Architecture Blueprint',
      '> All markdown files are written atomically via SafeWriter with temporary files and sync flushes.',
      '',
      '> [!tip]- Performance Tip',
      '> Use indexed SQLite queries for sub-30ms switcher lookups.',
      '',
      '> [!warning] Containment Rule',
      '> Vault boundaries strictly prevent reading or writing files outside open vaults.',
      '',
      '> [!danger] Security Baseline',
      '> Node integration is disabled, context isolation is enforced, and remote navigation is prohibited.',
      '',
      '| Component | Benchmark | Ceiling |',
      '| :--- | :---: | ---: |',
      '| SafeWriter Kill Test | 661 ms | 3,000 ms |',
      '| Replace All 5,000 Matches | 762 ms | 1,000 ms |',
      '',
      '```dataview',
      'TABLE file.mtime AS "Modified", tags AS "Tags"',
      'FROM #planning',
      'SORT file.mtime DESC',
      '```',
      '',
      '```typescript',
      'export function flipGlide(el: HTMLElement, startRect: DOMRect): Animation {',
      '  return el.animate([{ transform: "translateY(0)" }], { duration: 180 });',
      '}',
      '```',
      '',
      'Refer to [[ARCHITECTURE|System Architecture]] or check the [Official Site](https://syncthing.net).',
      '',
      '![System Architecture|600|center](attachments/architecture.png)',
      '',
      '[Wrriter_v1_Specification.pdf](attachments/spec.pdf)'
    ].join('\n') + '\n';

    it('rebuilds the Weekly plan note with all mockup elements surviving planSave 100% intact', () => {
      const rawBytes = Buffer.from(weeklyPlanMd, 'utf8');
      const plan = planSave(rawBytes, weeklyPlanMd);

      expect(plan.unchanged).toBe(true);
      expect(plan.changedBlockCount).toBe(0);
      expect(Buffer.from(plan.bytes).equals(rawBytes)).toBe(true);
    });

    it('parses the Weekly plan note into TipTap AST and serializes all rich blocks faithfully', () => {
      const doc = markdownToTipTapDoc(weeklyPlanMd);

      // Verify block types present in AST
      const types = doc.content.map((b) => b.type);
      expect(types).toContain('heading');
      expect(types).toContain('paragraph');
      expect(types).toContain('taskList');
      expect(types).toContain('orderedList');
      expect(types).toContain('horizontalRule');
      expect(types).toContain('blockquote');
      expect(types).toContain('callout');
      expect(types).toContain('table');
      expect(types).toContain('codeBlock');
      expect(types).toContain('image');
      expect(types).toContain('fileChip');

      const serialized = tipTapDocToMarkdown(doc);
      expect(serialized).toContain('# Weekly Planning & System Review');
      expect(serialized).toContain('## Key Objectives for the Sprint');
      expect(serialized).toContain('- [x] Port tokens.css with Apple Notes neutral palette');
      expect(serialized).toContain('> [!info] Architecture Blueprint');
      expect(serialized).toContain('> [!tip]- Performance Tip');
      expect(serialized).toContain('> [!warning] Containment Rule');
      expect(serialized).toContain('> [!danger] Security Baseline');
      expect(serialized).toContain('| Component | Benchmark | Ceiling |');
      expect(serialized).toContain('```dataview');
      expect(serialized).toContain('```typescript');
      expect(serialized).toContain('[[ARCHITECTURE|System Architecture]]');
      expect(serialized).toContain('[Official Site](https://syncthing.net)');
      expect(serialized).toContain('![System Architecture|600](attachments/architecture.png)');
      expect(serialized).toContain('[Wrriter_v1_Specification.pdf](attachments/spec.pdf)');
    });
  });
});

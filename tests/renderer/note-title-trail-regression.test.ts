import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { shouldAnimateReorder } from '../../src/renderer/components/VirtualList';

describe('Note Title Synchronous Update & Latency Regression (Bug 5)', () => {
  it('verifies EditorHost uses flushSync for live title updates to eliminate rendering lag', () => {
    const editorHostPath = join(__dirname, '../../src/renderer/editor/EditorHost.tsx');
    const content = readFileSync(editorHostPath, 'utf8');

    // Must import flushSync from react-dom
    expect(content).toMatch(/import\s*\{[^}]*flushSync[^}]*\}\s*from\s*['"]react-dom['"]/);

    // Live title update in onUpdate must use flushSync to flush title and tab changes synchronously
    expect(content).toContain('flushSync(() => {');
  });

  it('verifies live title updates do not trigger redundant setOpenTabs IPC calls on every keystroke', () => {
    const editorHostPath = join(__dirname, '../../src/renderer/editor/EditorHost.tsx');
    const content = readFileSync(editorHostPath, 'utf8');

    // Locate the onUpdate block and the live title update inside it
    const onUpdateMatch = content.match(/onUpdate\(\{[\s\S]*?live word and character count/i);
    expect(onUpdateMatch).not.toBeNull();
    const onUpdateSnippet = onUpdateMatch![0];

    // onUpdate live title update should NOT invoke notifyTabs() (which fires IPC setOpenTabs on every keystroke)
    expect(onUpdateSnippet).not.toContain('notifyTabs();');
  });

  it('verifies VirtualList avoids getBoundingClientRect layout reflows when item order is unchanged', () => {
    const virtualListPath = join(__dirname, '../../src/renderer/components/VirtualList.tsx');
    const content = readFileSync(virtualListPath, 'utf8');

    // The FLIP effect should guard getBoundingClientRect behind orderChanged or initial render
    // to prevent synchronous layout thrashing on every keystroke during typing
    expect(content).toMatch(/if\s*\(\s*orderChanged\s*\|\|\s*prevRects\.size\s*===\s*0\s*\)/);
  });

  it('verifies shouldAnimateReorder returns false for in-place title updates', () => {
    const prevKeys = ['note-1', 'note-2', 'note-3'];
    const currentKeys = ['note-1', 'note-2', 'note-3'];

    // Title update keeps same paths/keys in same order
    expect(shouldAnimateReorder(prevKeys, currentKeys)).toBe(false);
  });
});

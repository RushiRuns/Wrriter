import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorMenu } from '../../src/renderer/components/menu/EditorMenu';
import { resolveLink, resolveMarkdownLink } from '../../src/shared/domain/links';

describe('EditorMenu and Duplicate Note UI', () => {
  it('renders EditorMenu with enabled Duplicate item', () => {
    const html = renderToStaticMarkup(
      <EditorMenu
        isOpen={true}
        onClose={() => {}}
        isPinned={false}
        onTogglePin={() => {}}
        onFindInNote={() => {}}
        onShowInExplorer={() => {}}
        onDeleteNote={() => {}}
        onDuplicateNote={() => {}}
      />
    );

    // Duplicate should NOT be disabled
    expect(html).toContain('Duplicate');
    expect(html).not.toContain('Duplicate</span><span style="margin-left:auto;font-size:var(--fs-small);color:var(--tx3)">M3</span>');
    expect(html).toContain('<span class="vn">Duplicate</span>');
  });

  it('resolves links to deleted note as unresolved with isMissing: true', () => {
    const available = [{ path: 'Active.md', title: 'Active Note', modified: 2000 }];

    // Wikilink to deleted note
    const wl = resolveLink('DeletedNote', 'Active.md', available);
    expect(wl.resolved).toBe(false);
    expect(wl.isMissing).toBe(true);

    // Markdown link to deleted note
    const md = resolveMarkdownLink('DeletedNote.md', 'Active.md', available);
    expect(md?.resolved).toBe(false);
    expect(md?.isMissing).toBe(true);
  });
});

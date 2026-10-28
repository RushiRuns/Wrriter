import { describe, it, expect } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindowShell } from '../../src/renderer/components/WindowShell';

describe('Pane Spacing Contract (M1/M2)', () => {
  it('ensures WindowShell main container handles toolbar height clearance', () => {
    const html = renderToStaticMarkup(
      <WindowShell
        sidebarOpen={true}
        onToggleSidebar={() => {}}
        noteName="Weekly plan"
      >
        <aside className="side">
          <div className="sin" />
        </aside>
        <section className="list" />
      </WindowShell>
    );

    // Verify main container handles toolbar height clearance
    expect(html).toContain('margin-top:var(--tb-h)');
    expect(html).toContain('class="main"');
  });

  it('ensures .sin and .list in components.css do not introduce duplicate padding-top: var(--band)', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );

    // Extract .sin block
    const sinMatch = cssContent.match(/\.sin\s*\{([^}]+)\}/);
    expect(sinMatch).toBeTruthy();
    expect(sinMatch![1]).not.toContain('padding-top: var(--band)');

    // Extract .list block
    const listMatch = cssContent.match(/\.list\s*\{([^}]+)\}/);
    expect(listMatch).toBeTruthy();
    expect(listMatch![1]).not.toContain('padding-top: var(--band)');

    // Extract .col block
    const colMatch = cssContent.match(/\.col\s*\{([^}]+)\}/);
    expect(colMatch).toBeTruthy();
    expect(colMatch![1]).not.toContain('var(--band)');
    expect(colMatch![1]).toContain('var(--s-7)');
  });

  it('ensures the sidebar bottom vault trigger (.vtrig) has no profile circle (.vc)', () => {
    const mainWindowSource = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );

    // Find the vtrig button block
    const vtrigMatch = mainWindowSource.match(/className="vtrig"[\s\S]*?<\/button>/);
    expect(vtrigMatch).toBeTruthy();
    // Must NOT contain the .vc avatar circle
    expect(vtrigMatch![0]).not.toContain('className="vc');
    // Must contain ChevronUpDownIcon and the vault name
    expect(vtrigMatch![0]).toContain('<ChevronUpDownIcon');
    expect(vtrigMatch![0]).toContain('className="vn"');
  });

  it('ensures VaultMenu has no fixed pixel width override and stays contained within sidebar boundaries', () => {
    const vaultMenuSource = readFileSync(
      join(__dirname, '../../src/renderer/components/VaultMenu.tsx'),
      'utf-8'
    );

    // Verify fixed pixel width overrides (width: 260, minWidth: 240) are absent
    expect(vaultMenuSource).not.toContain('width: 260');
    expect(vaultMenuSource).not.toContain('minWidth: 240');
  });

  it('ensures vmenu has overflow-x hidden to prevent horizontal scrollbars', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const vmenuMatch = cssContent.match(/\.vmenu\s*\{([^}]+)\}/);
    expect(vmenuMatch).toBeTruthy();
    expect(vmenuMatch![1]).toContain('overflow-x: hidden');
  });

  it('ensures vtrig icon has explicit flexShrink isolation to prevent overlapping the vault name', () => {
    const mainWindowSource = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );
    const vtrigMatch = mainWindowSource.match(/className="vtrig"[\s\S]*?<\/button>/);
    expect(vtrigMatch).toBeTruthy();
    expect(vtrigMatch![0]).toContain('flexShrink: 0');
  });

  it('ensures base .lmenu has background var(--pop) and elevation shadow to prevent transparent flyouts', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const lmenuMatch = cssContent.match(/\.lmenu\s*\{([^}]+)\}/);
    expect(lmenuMatch).toBeTruthy();
    expect(lmenuMatch![1]).toContain('background: var(--pop)');
    expect(lmenuMatch![1]).toContain('box-shadow: 0 0 0 1px var(--line), var(--shadow)');
  });

  it('ensures .sin has width: 100% and box-sizing: border-box without hardcoded 247px width', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const sinMatch = cssContent.match(/\.sin\s*\{([^}]+)\}/);
    expect(sinMatch).toBeTruthy();
    expect(sinMatch![1]).not.toContain('width: 247px');
    expect(sinMatch![1]).toContain('width: 100%');
    expect(sinMatch![1]).toContain('box-sizing: border-box');
  });

  it('ensures editor 3-dot container .nmore is pinned to top-right with 20px margin and z-index', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const nmoreMatch = cssContent.match(/\.nmore\s*\{([^}]+)\}/);
    expect(nmoreMatch, '.nmore must be declared in components.css').toBeTruthy();
    expect(nmoreMatch![1]).toContain('position: absolute');
    expect(nmoreMatch![1]).toContain('top: 10px');
    expect(nmoreMatch![1]).toContain('right: 20px');
    expect(nmoreMatch![1]).toContain('z-index: 10');
  });

  it('ensures .lmenu.ed anchors directly under .nmore with top: calc(100% + 4px) and right: 0', () => {
    const cssContent = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );
    const lmenuEdMatch = cssContent.match(/\.lmenu\.ed\s*\{([^}]+)\}/);
    expect(lmenuEdMatch, '.lmenu.ed must be declared in components.css').toBeTruthy();
    expect(lmenuEdMatch![1]).toContain('position: absolute');
    expect(lmenuEdMatch![1]).toContain('top: calc(100% + 4px)');
    expect(lmenuEdMatch![1]).toContain('right: 0');
    expect(lmenuEdMatch![1]).not.toContain('var(--band)');
  });

  it('ensures MainWindow hides editor 3-dot menu container when no note is open', () => {
    const mainWindowSource = readFileSync(
      join(__dirname, '../../src/renderer/windows/main/MainWindow.tsx'),
      'utf-8'
    );
    expect(mainWindowSource).toContain('if (!selectedNotePath) return null;');
    expect(mainWindowSource).toContain('if (!selectedNote) return null;');
  });

  it('ensures EditorHost stabilizes prop callback refs and prevents redundant switchNote resets on the active note (Regression)', () => {
    const editorHostSource = readFileSync(
      join(__dirname, '../../src/renderer/editor/EditorHost.tsx'),
      'utf-8'
    );
    expect(editorHostSource).toContain('onTitleChangeRef = useRef');
    expect(editorHostSource).toContain('onNoticeRef = useRef');
    expect(editorHostSource).toContain('onTabsUpdateRef = useRef');
    expect(editorHostSource).toContain('if (prevPath === activeNotePath && tabsRef.current.has(activeNotePath))');
  });
});

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
});

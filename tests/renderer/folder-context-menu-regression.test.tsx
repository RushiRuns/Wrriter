import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Folder Context Menu Close-All Collision Regression', () => {
  it('ensures FolderTree passes menuId="folder-context-menu" to ContextMenu to prevent self-closing', () => {
    const folderTreeSource = readFileSync(
      join(__dirname, '../../src/renderer/components/FolderTree.tsx'),
      'utf-8'
    );

    // ContextMenu invocation must explicitly pass menuId="folder-context-menu"
    const contextMenuCallMatch = folderTreeSource.match(/<ContextMenu[\s\S]*?menuId="folder-context-menu"[\s\S]*?\/>/);
    expect(contextMenuCallMatch).toBeTruthy();
  });

  it('ensures handleCloseAll in FolderTree tolerates both folder-context-menu and default context-menu', () => {
    const folderTreeSource = readFileSync(
      join(__dirname, '../../src/renderer/components/FolderTree.tsx'),
      'utf-8'
    );

    // handleCloseAll listener must exempt folder-context-menu
    expect(folderTreeSource).toContain("customEvent.detail?.except !== 'folder-context-menu'");
    expect(folderTreeSource).toContain("customEvent.detail?.except !== 'context-menu'");
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Folder Icon Disappearance on Subfolder Deletion Regression', () => {
  it('ensures FolderTree only marks a folder row as "open" if it actually has children or is currently creating a child', () => {
    const folderTreeSource = readFileSync(
      join(__dirname, '../../src/renderer/components/FolderTree.tsx'),
      'utf-8'
    );

    // Invariant: An empty leaf folder with 0 children must NEVER be marked as "open"
    // because CSS rule .fr.open .fslot .fshut hides the only rendered icon (fshut).
    expect(folderTreeSource).toMatch(/isExpanded\s*=\s*\(hasChildren\s*\|\|\s*isCreatingHere\)\s*&&\s*expandedPaths\.has/);
  });

  it('ensures handleDeleteFolderSubmit removes the deleted folder path from expandedPaths', () => {
    const folderTreeSource = readFileSync(
      join(__dirname, '../../src/renderer/components/FolderTree.tsx'),
      'utf-8'
    );

    // Invariant: Deleting a folder must prune it from expandedPaths
    expect(folderTreeSource).toMatch(/next\.delete\(folder\.relPath\)/);
  });

  it('proves that a leaf folder without children having .open class causes .fshut to have opacity 0 in CSS', () => {
    const componentsCss = readFileSync(
      join(__dirname, '../../src/renderer/styles/components.css'),
      'utf-8'
    );

    // Verifies the CSS rule that caused the invisible icon collision when .open was present on a leaf folder
    expect(componentsCss).toContain('.fr.open .fslot .fshut');
    expect(componentsCss).toMatch(/\.fr\.open\s+\.fslot\s+\.fshut\s*\{[\s\S]*?opacity:\s*0/);
  });
});

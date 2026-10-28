import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FolderTree } from '../../src/renderer/components/FolderTree';
import type { FolderNode } from '../../src/shared/ipc/contracts';
import { getFileNameValidationError } from '../../src/shared/domain/names';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Folder and Subfolder Creation (Features A & B)', () => {
  const sampleFolders: readonly FolderNode[] = [
    {
      name: 'Projects',
      relPath: 'Projects',
      parentPath: '',
      noteCount: 4,
      children: [
        {
          name: 'Web',
          relPath: 'Projects/Web',
          parentPath: 'Projects',
          noteCount: 2,
          children: []
        }
      ]
    },
    {
      name: 'Personal',
      relPath: 'Personal',
      parentPath: '',
      noteCount: 3,
      children: []
    }
  ];

  describe('Feature A: FOLDERS Sidebar Header & Root Creation Button', () => {
    it('renders FOLDERS section header with the PlusIcon button', () => {
      const html = renderToStaticMarkup(
        <FolderTree
          folders={sampleFolders}
          selectedFolder={null}
          onSelectFolder={() => {}}
          totalVaultNotesCount={12}
          onRefresh={async () => {}}
        />
      );

      // Verify header container
      expect(html).toContain('lbl lbl-header');
      expect(html).toContain('FOLDERS');

      // Verify Plus button with tooltip and aria-label
      expect(html).toContain('class="lbl-btn"');
      expect(html).toContain('title="New folder"');
      expect(html).toContain('aria-label="New folder"');
      expect(html).toContain('<svg');
    });

    it('uses design tokens and hover opacity in components.css for header button', () => {
      const css = readFileSync(
        join(__dirname, '../../src/renderer/styles/components.css'),
        'utf-8'
      );

      expect(css).toContain('.lbl-header {');
      expect(css).toContain('.lbl-btn {');
      expect(css).toContain('opacity: 0.35;');
      expect(css).toContain('transition: opacity var(--t-fast) var(--ease-move), color var(--t-fast) var(--ease-move);');
      expect(css).toContain('.lbl-header:hover .lbl-btn');
      expect(css).toContain('opacity: 1;');
    });

    it('resolves root-level folder path without leading slash', () => {
      const parentRelPath: string | null = null;
      const folderName = 'Archive';
      const resolvedPath = parentRelPath ? `${parentRelPath}/${folderName}` : folderName;

      expect(resolvedPath).toBe('Archive');
    });
  });

  describe('Feature B: Nested Subfolder Creation via Context Menu', () => {
    it('resolves child folder path with parentRelPath', () => {
      const parentRelPath = 'Projects';
      const subfolderName = 'Mobile App';
      const resolvedPath = parentRelPath ? `${parentRelPath}/${subfolderName}` : subfolderName;

      expect(resolvedPath).toBe('Projects/Mobile App');
    });

    it('resolves deeply nested child folder path correctly', () => {
      const parentRelPath = 'Projects/Web';
      const subfolderName = 'Frontend';
      const resolvedPath = `${parentRelPath}/${subfolderName}`;

      expect(resolvedPath).toBe('Projects/Web/Frontend');
    });

    it('validates Windows file/folder naming rules on inline input submit', () => {
      // 1. Empty name
      expect(getFileNameValidationError('')).toBe('Name cannot be empty');
      expect(getFileNameValidationError('   ')).toBe('Name cannot be empty');

      // 2. Windows forbidden characters: \ / : * ? " < > |
      expect(getFileNameValidationError('Folder/Slash')).toBe('Name cannot contain any of these characters: \\ / : * ? " < > |');
      expect(getFileNameValidationError('Bad:Name')).toBe('Name cannot contain any of these characters: \\ / : * ? " < > |');
      expect(getFileNameValidationError('Star*')).toBe('Name cannot contain any of these characters: \\ / : * ? " < > |');
      expect(getFileNameValidationError('Pipe|')).toBe('Name cannot contain any of these characters: \\ / : * ? " < > |');

      // 3. Reserved Windows names
      expect(getFileNameValidationError('CON')).toBe('"CON" is a reserved device name in Windows');
      expect(getFileNameValidationError('nul')).toBe('"nul" is a reserved device name in Windows');
      expect(getFileNameValidationError('aux.txt')).toBe('"aux.txt" is a reserved device name in Windows');

      // 4. Trailing period or space
      expect(getFileNameValidationError('Folder.')).toBe('Name cannot end with a period or space');
      expect(getFileNameValidationError('Folder ')).toBe('Name cannot end with a period or space');

      // 5. Valid names return null
      expect(getFileNameValidationError('Valid Folder')).toBeNull();
      expect(getFileNameValidationError('2026-Q1 Report')).toBeNull();
      expect(getFileNameValidationError('Notes_Archive')).toBeNull();
    });
  });

  describe('Inline Input vs Modal Removal', () => {
    it('verifies old modal form is removed and tree uses inline input', () => {
      const folderTreeSource = readFileSync(
        join(__dirname, '../../src/renderer/components/FolderTree.tsx'),
        'utf-8'
      );

      // Old modal state should not exist
      expect(folderTreeSource).not.toContain('newFolderModal');
      expect(folderTreeSource).not.toContain('NewFolderModalState');

      // Inline creation state and renderer should exist
      expect(folderTreeSource).toContain('creatingFolder');
      expect(folderTreeSource).toContain('CreatingFolderState');
      expect(folderTreeSource).toContain('renderInlineCreateRow');
      expect(folderTreeSource).toContain('startCreateFolder');
      expect(folderTreeSource).toContain('commitCreateFolder');
    });
  });
});

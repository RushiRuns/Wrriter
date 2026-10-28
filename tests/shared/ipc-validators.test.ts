import { describe, expect, it } from 'vitest';
import { IPC_VALIDATORS } from '../../src/shared/ipc/contracts';
import {
  validateBoolean,
  validateEmptyArgs,
  validateNonEmptyString,
  validateString
} from '../../src/shared/ipc/validators';

describe('IPC Validators and Request Contracts', () => {
  it('validates strings and rejects invalid inputs', () => {
    expect(validateString('title', 'Wrriter').ok).toBe(true);
    const errRes = validateString('title', 123);
    expect(errRes.ok).toBe(false);
    if (!errRes.ok) {
      expect(errRes.error.kind).toBe('validation');
    }
  });

  it('validates non-empty strings and rejects empty whitespace', () => {
    expect(validateNonEmptyString('name', 'Main Vault').ok).toBe(true);
    expect(validateNonEmptyString('name', '   ').ok).toBe(false);
  });

  it('validates booleans', () => {
    expect(validateBoolean('pinned', true).ok).toBe(true);
    expect(validateBoolean('pinned', false).ok).toBe(true);
    expect(validateBoolean('pinned', 'true').ok).toBe(false);
  });

  it('validates empty arguments', () => {
    expect(validateEmptyArgs(undefined).ok).toBe(true);
    expect(validateEmptyArgs({}).ok).toBe(true);
    expect(validateEmptyArgs('not an object').ok).toBe(false);
  });

  it('validates note.save arguments', () => {
    const valid = IPC_VALIDATORS['note.save']({ path: 'folder/note.md', text: '# Hello' });
    expect(valid.ok).toBe(true);

    const missingText = IPC_VALIDATORS['note.save']({ path: 'folder/note.md' });
    expect(missingText.ok).toBe(false);

    const emptyPath = IPC_VALIDATORS['note.save']({ path: '', text: 'Content' });
    expect(emptyPath.ok).toBe(false);
  });

  it('validates app.setTheme arguments', () => {
    expect(IPC_VALIDATORS['app.setTheme']({ theme: 'dark' }).ok).toBe(true);
    expect(IPC_VALIDATORS['app.setTheme']({ theme: 'neon' }).ok).toBe(false);
  });

  it('validates app.setAccent arguments', () => {
    expect(IPC_VALIDATORS['app.setAccent']({ accent: 'yellow' }).ok).toBe(true);
    expect(IPC_VALIDATORS['app.setAccent']({ accent: 'pink' }).ok).toBe(false);
  });

  it('validates index query arguments', () => {
    expect(IPC_VALIDATORS['index.getNotes']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getNotes']({ folder: 'Work', sortBy: 'modified', limit: 20 }).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getFolderCounts']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getTitleList']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.search']({ query: 'launch' }).ok).toBe(true);
    expect(IPC_VALIDATORS['index.search']({ query: 123 }).ok).toBe(false);
    expect(IPC_VALIDATORS['index.getStatus']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getStatuses']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getTags']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['index.getTagCounts']({}).ok).toBe(true);
    expect(IPC_VALIDATORS['tag.rename']({ oldTag: 'work', newTag: 'office' }).ok).toBe(true);
    expect(IPC_VALIDATORS['tag.rename']({ oldTag: '', newTag: 'office' }).ok).toBe(false);
    expect(IPC_VALIDATORS['note.list']({ tag: 'work', sortBy: 'created' }).ok).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { DropHandlerExtension } from '../../src/renderer/editor/extensions/drop-handler';
import { ok } from '../../src/shared/result';

describe('Editor Drop Handler Extension', () => {
  let noticeMessage = '';
  let largeFileConfirmationRequested = false;

  const testSchema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      heading: {
        group: 'block',
        content: 'inline*',
        attrs: { level: { default: 1 } }
      },
      image: {
        group: 'block',
        attrs: {
          src: { default: '' },
          alt: { default: '' },
          alignment: { default: 'center' }
        }
      },
      fileChip: {
        group: 'block',
        attrs: {
          name: { default: '' },
          path: { default: '' },
          size: { default: 0 },
          missing: { default: false }
        }
      },
      text: { group: 'inline' }
    },
    marks: {
      link: {
        attrs: { href: { default: '' } }
      },
      wikilink: {
        attrs: { target: { default: '' }, alias: { default: '' } }
      },
      bold: {}
    }
  });

  beforeEach(() => {
    noticeMessage = '';
    largeFileConfirmationRequested = false;
    (globalThis as any).window = {
      wrriter: {
        getPathForFile: (f: any) => f.path || '',
        attachment: {
          inspectPath: vi.fn().mockResolvedValue(
            ok({ isDirectory: false, size: 1000, name: 'sample.txt' })
          ),
          saveDroppedFile: vi.fn().mockResolvedValue(
            ok({
              fileName: 'sample.txt',
              relativePath: 'attachments/sample.txt',
              encodedPath: 'attachments/sample.txt',
              size: 1000,
              isImage: false,
              markdown: '[sample.txt](attachments/sample.txt)'
            })
          ),
          downloadImage: vi.fn().mockResolvedValue(
            ok({
              downloaded: true,
              fileName: 'downloaded.png',
              relativePath: 'attachments/downloaded.png',
              encodedPath: 'attachments/downloaded.png',
              isImage: true,
              markdown: '![downloaded.png](attachments/downloaded.png)'
            })
          )
        }
      }
    };
  });

  const setupPluginAndState = () => {
    const extension = DropHandlerExtension.configure({
      getActiveNotePath: () => 'MyNote.md',
      onNotice: (msg) => {
        noticeMessage = msg;
      },
      onRequestLargeFileConfirm: (_name, _size, onConfirm) => {
        largeFileConfirmationRequested = true;
        onConfirm();
      }
    });

    const plugins = extension.config.addProseMirrorPlugins?.call(extension as any) ?? [];
    const dropPlugin = plugins[0]!;

    const p = testSchema.node('paragraph', null, [testSchema.text('Initial content.')]);
    const doc = testSchema.node('doc', null, [p]);
    let state = EditorState.create({ doc, schema: testSchema });

    const mockView = {
      get state() {
        return state;
      },
      dispatch(tr: Transaction) {
        state = state.apply(tr);
      },
      focus: vi.fn(),
      posAtCoords: () => ({ pos: 1, inside: 0 }),
      coordsAtPos: () => ({ top: 10, bottom: 30, left: 0, right: 100 }),
      dom: {
        parentElement: null,
        appendChild: vi.fn(),
        querySelector: vi.fn()
      }
    };

    return { dropPlugin, mockView, getState: () => state };
  };

  it('inserts wikilink when an internal note is dropped', () => {
    const { dropPlugin, mockView, getState } = setupPluginAndState();
    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['application/x-wrriter-note'],
        files: [],
        getData: (type: string) => {
          if (type === 'application/x-wrriter-note') {
            return JSON.stringify({ path: 'Research/Project Plan.md', title: 'Project Plan' });
          }
          return '';
        }
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();

    const text = getState().doc.textBetween(0, getState().doc.content.size, ' ');
    expect(text).toContain('Project Plan');
  });

  it('shows short notice when a folder is dropped on a note without inserting it', () => {
    const { dropPlugin, mockView } = setupPluginAndState();
    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['application/x-wrriter-folder'],
        files: [],
        getData: (type: string) => {
          if (type === 'application/x-wrriter-folder') {
            return 'Work/Projects';
          }
          return '';
        }
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(noticeMessage).toContain('Folders cannot be added to a note');
  });

  it('triggers confirmation when a file over 500 MB is dropped', async () => {
    const { dropPlugin, mockView } = setupPluginAndState();
    const largeFile = {
      name: 'archive.zip',
      size: 600 * 1024 * 1024,
      path: 'C:/Users/Downloads/archive.zip'
    };

    (globalThis as any).window.wrriter.attachment.inspectPath = vi.fn().mockResolvedValue(
      ok({ isDirectory: false, size: 600 * 1024 * 1024, name: 'archive.zip' })
    );

    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['Files'],
        files: [largeFile],
        getData: () => ''
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(largeFileConfirmationRequested).toBe(true);
  });

  it('inserts markdown link when a link from a browser is dropped', () => {
    const { dropPlugin, mockView, getState } = setupPluginAndState();
    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['text/html', 'text/plain'],
        files: [],
        getData: (type: string) => {
          if (type === 'text/html') {
            return '<a href="https://example.com/guide">User Guide</a>';
          }
          if (type === 'text/plain') {
            return 'https://example.com/guide';
          }
          return '';
        }
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);

    const text = getState().doc.textBetween(0, getState().doc.content.size, ' ');
    expect(text).toContain('User Guide');
  });

  it('downloads remote web image and inserts image node on web image drop', async () => {
    const { dropPlugin, mockView, getState } = setupPluginAndState();
    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['text/html'],
        files: [],
        getData: (type: string) => {
          if (type === 'text/html') {
            return '<img src="https://images.example.com/diagram.png" alt="Architecture Diagram">';
          }
          return '';
        }
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((globalThis as any).window.wrriter.attachment.downloadImage).toHaveBeenCalledWith({
      notePath: 'MyNote.md',
      url: 'https://images.example.com/diagram.png',
      altText: 'Architecture Diagram'
    });

    const childTypes: string[] = [];
    getState().doc.forEach((child) => childTypes.push(child.type.name));
    expect(childTypes).toContain('image');
  });

  it('converts browser formatted text to clean markdown at drop point', () => {
    const { dropPlugin, mockView, getState } = setupPluginAndState();
    const event = {
      preventDefault: vi.fn(),
      clientX: 50,
      clientY: 50,
      dataTransfer: {
        types: ['text/html', 'text/plain'],
        files: [],
        getData: (type: string) => {
          if (type === 'text/html') {
            return '<h2>Section Heading</h2><p>Here is <strong>bold text</strong>.</p>';
          }
          if (type === 'text/plain') {
            return 'Section Heading\nHere is bold text.';
          }
          return '';
        }
      }
    } as any;

    const handled = dropPlugin.props.handleDrop?.(mockView as any, event as any, null as any, false);
    expect(handled).toBe(true);

    const text = getState().doc.textBetween(0, getState().doc.content.size, ' ');
    expect(text).toContain('Section Heading');
    expect(text).toContain('Here is bold text.');
  });
});

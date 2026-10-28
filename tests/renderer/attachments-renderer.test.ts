import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { markdownToTipTapDoc, tipTapDocToMarkdown } from '../../src/renderer/editor/markdown-converter';
import { FileChipNode } from '../../src/renderer/editor/extensions/file-chip';
import { ImageNode } from '../../src/renderer/editor/extensions/image';
import { PasteHandlerExtension } from '../../src/renderer/editor/extensions/paste-handler';
import { ok } from '../../src/shared/result';

describe('Renderer: Attachments, FileChips and Paste Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Markdown Converter Roundtrips', () => {
    it('parses inline images to image nodes and serializes back identically', () => {
      const md = '![photo.png](attachments/photo.png)';
      const doc = markdownToTipTapDoc(md);

      expect(doc.content.length).toBe(1);
      expect(doc.content[0].type).toBe('image');
      expect(doc.content[0].attrs?.['src']).toBe('attachments/photo.png');
      expect(doc.content[0].attrs?.['alt']).toBe('photo.png');

      const serialized = tipTapDocToMarkdown(doc);
      expect(serialized.trim()).toBe(md);
    });

    it('parses non-inline files (PDF, XLSX, HEIC) to fileChip nodes', () => {
      const pdfMd = '[report.pdf](attachments/report%202.pdf)';
      const pdfDoc = markdownToTipTapDoc(pdfMd);

      expect(pdfDoc.content.length).toBe(1);
      expect(pdfDoc.content[0].type).toBe('fileChip');
      expect(pdfDoc.content[0].attrs?.['name']).toBe('report.pdf');
      expect(pdfDoc.content[0].attrs?.['path']).toBe('attachments/report%202.pdf');
      expect(pdfDoc.content[0].attrs?.['fileType']).toBe('PDF');

      const serialized = tipTapDocToMarkdown(pdfDoc);
      expect(serialized.trim()).toBe(pdfMd);
    });

    it('converts HEIC written as image syntax to a file chip node', () => {
      // In Wrriter, HEIC is always displayed as a file chip
      const heicMd = '![vacation.heic](attachments/vacation.heic)';
      const doc = markdownToTipTapDoc(heicMd);

      expect(doc.content.length).toBe(1);
      expect(doc.content[0].type).toBe('fileChip');
      expect(doc.content[0].attrs?.['fileType']).toBe('HEIC');
      expect(doc.content[0].attrs?.['name']).toBe('vacation.heic');
    });

    it('preserves note markdown unchanged when a file is missing', () => {
      const md = '[missing_doc.pdf](attachments/missing_doc.pdf)';
      const doc = markdownToTipTapDoc(md);

      // Simulate editor marking the file missing
      doc.content[0].attrs!['missing'] = true;
      doc.content[0].attrs!['size'] = '';

      // Serializing back must NOT change the link markdown
      const serialized = tipTapDocToMarkdown(doc);
      expect(serialized.trim()).toBe(md);
    });
  });

  describe('DOM Rendering', () => {
    it('renders normal FileChip with type badge, name, and size', () => {
      const htmlOutput = FileChipNode.config.renderHTML?.({
        node: {
          attrs: {
            name: 'quarterly_report.pdf',
            path: 'attachments/quarterly_report.pdf',
            fileType: 'PDF',
            size: '1.4 MB',
            missing: false
          }
        } as any,
        HTMLAttributes: {}
      });

      expect(htmlOutput).toBeDefined();
      const [tag, attrs, typeEl, metaEl] = htmlOutput as any[];
      expect(tag).toBe('div');
      expect(attrs.class).toBe('fchip');
      expect(attrs['data-path']).toBe('attachments/quarterly_report.pdf');
      expect(typeEl[0]).toBe('div');
      expect(typeEl[1].class).toBe('ftype');
      expect(typeEl[2]).toBe('PDF');
      expect(metaEl[0]).toBe('div');
      expect(metaEl[1].class).toBe('fmeta');
    });

    it('renders missing FileChip with "File not found: name"', () => {
      const htmlOutput = FileChipNode.config.renderHTML?.({
        node: {
          attrs: {
            name: 'contract.pdf',
            path: 'attachments/contract.pdf',
            fileType: 'PDF',
            size: '',
            missing: true
          }
        } as any,
        HTMLAttributes: {}
      });

      expect(htmlOutput).toBeDefined();
      const [tag, attrs, labelEl] = htmlOutput as any[];
      expect(tag).toBe('div');
      expect(attrs.class).toBe('fchip miss');
      expect(labelEl[0]).toBe('span');
      expect(labelEl[1].class).toBe('fname');
      expect(labelEl[2]).toBe('File not found: contract.pdf');
    });

    it('resolves relative image paths to wrriter-vault protocol for DOM display', () => {
      const htmlOutput = ImageNode.config.renderHTML?.({
        node: {
          attrs: {
            src: '../attachments/photo.png',
            alt: 'photo.png',
            width: 400,
            alignment: 'center'
          }
        } as any,
        HTMLAttributes: {}
      });

      expect(htmlOutput).toBeDefined();
      const [, , phEl] = htmlOutput as any[];
      const imgEl = phEl[2];
      expect(imgEl[0]).toBe('img');
      expect(imgEl[1].src).toBe('wrriter-vault:///attachments/photo.png');
      expect(imgEl[1].alt).toBe('photo.png');
    });
  });

  describe('Paste Handler: Pasted Images & Screenshots', () => {
    const pasteSchema = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: { group: 'block', content: 'inline*' },
        image: {
          group: 'block',
          attrs: {
            src: { default: '' },
            alt: { default: '' },
            alignment: { default: 'center' }
          }
        },
        text: { group: 'inline' }
      }
    });

    it('detects image in clipboard, saves via IPC, and inserts image node', async () => {
      const mockSavePastedImage = vi.fn().mockResolvedValue(
        ok({
          fileName: 'Pasted image 20261028-213000.png',
          relativePath: 'attachments/Pasted image 20261028-213000.png',
          encodedPath: 'attachments/Pasted%20image%2020261028-213000.png',
          isImage: true,
          size: 1024,
          markdown: '![Pasted image 20261028-213000.png](attachments/Pasted%20image%2020261028-213000.png)'
        })
      );

      (globalThis as any).window = {
        wrriter: {
          attachment: {
            savePastedImage: mockSavePastedImage
          }
        }
      };

      const extension = PasteHandlerExtension.configure({
        getActiveNotePath: () => 'Inbox/Note.md'
      });

      const plugins = extension.config.addProseMirrorPlugins?.call(extension as any) ?? [];
      const pastePlugin = plugins[0];

      const p = pasteSchema.node('paragraph', null, [pasteSchema.text('Initial text')]);
      const doc = pasteSchema.node('doc', null, [p]);
      let state = EditorState.create({ doc, schema: pasteSchema });

      const mockView = {
        get state() {
          return state;
        },
        dispatch(tr: Transaction) {
          state = state.apply(tr);
        }
      };

      const fakeImageBytes = new Uint8Array([137, 80, 78, 71]);
      const mockFile = {
        arrayBuffer: async () => fakeImageBytes.buffer
      };

      const mockEvent = {
        preventDefault: vi.fn(),
        clipboardData: {
          getData: () => '',
          items: [
            {
              type: 'image/png',
              getAsFile: () => mockFile
            }
          ]
        }
      };

      const handled = pastePlugin.props.handlePaste?.(mockView as any, mockEvent as any);
      expect(handled).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Await async arrayBuffer & save resolution
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSavePastedImage).toHaveBeenCalledWith({
        notePath: 'Inbox/Note.md',
        bytes: fakeImageBytes
      });

      // Verify image node was inserted
      const children: string[] = [];
      mockView.state.doc.forEach((child) => children.push(child.type.name));
      expect(children).toContain('image');
    });
  });
});

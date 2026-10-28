import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { markdownToTipTapDoc } from '../markdown-converter';
import { htmlToCleanMarkdown } from './paste-handler';
import { parseBrowserImageDrop, parseBrowserLinkDrop } from '../../../shared/domain/drag-drop';
import { isInlineImageExtension } from '../../../shared/domain/attachments';
import { insertWikilink } from './wikilink-suggest';

export interface DropHandlerOptions {
  getActiveNotePath?: (() => string | null) | undefined;
  onNotice?: ((message: string) => void) | undefined;
  onRequestLargeFileConfirm?: ((
    fileName: string,
    sizeMb: number,
    onConfirm: () => void,
    onCancel: () => void
  ) => void) | undefined;
  onProgressChange?: ((
    progress: { fileName: string; percent: number; onCancel: () => void } | null
  ) => void) | undefined;
}

export const dropHandlerPluginKey = new PluginKey('dropHandler');

export const DropHandlerExtension = Extension.create<DropHandlerOptions>({
  name: 'dropHandler',

  addOptions() {
    return {
      getActiveNotePath: () => null,
      onNotice: undefined,
      onRequestLargeFileConfirm: undefined,
      onProgressChange: undefined
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    let dropIndicatorEl: HTMLElement | null = null;

    const removeDropIndicator = () => {
      if (dropIndicatorEl) {
        dropIndicatorEl.remove();
        dropIndicatorEl = null;
      }
    };

    const updateDropIndicator = (view: EditorView, clientX: number, clientY: number) => {
      const editorDom = view.dom as HTMLElement;
      const coords = view.posAtCoords({ left: clientX, top: clientY });
      if (!coords) {
        removeDropIndicator();
        return;
      }

      if (!dropIndicatorEl) {
        dropIndicatorEl = document.createElement('div');
        dropIndicatorEl.className = 'wr-drop-indicator';
        editorDom.parentElement?.appendChild(dropIndicatorEl) ?? editorDom.appendChild(dropIndicatorEl);
      }

      try {
        const domCoords = view.coordsAtPos(coords.pos);
        const containerRect = (editorDom.parentElement ?? editorDom).getBoundingClientRect();
        const top = domCoords.bottom - containerRect.top;
        dropIndicatorEl.style.top = `${Math.max(0, top)}px`;
        dropIndicatorEl.style.display = 'block';
      } catch {
        removeDropIndicator();
      }
    };

    return [
      new Plugin({
        key: dropHandlerPluginKey,

        props: {
          handleDOMEvents: {
            dragover(view, event) {
              // Show drop line indicator during dragover
              updateDropIndicator(view, event.clientX, event.clientY);
              return false;
            },
            dragleave(_view, event) {
              const related = event.relatedTarget as HTMLElement | null;
              if (!related || !related.closest('.wrriter-prosemirror')) {
                removeDropIndicator();
              }
              return false;
            },
            dragend() {
              removeDropIndicator();
              return false;
            }
          },

          handleDrop(view, event, _slice, moved) {
            removeDropIndicator();

            if (moved) {
              // Internal ProseMirror selection move
              return false;
            }

            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) return false;

            const notePath = options.getActiveNotePath?.() || '';

            // 1. Folders dropped from folder tree onto note
            if (dataTransfer.types.includes('application/x-wrriter-folder')) {
              event.preventDefault();
              options.onNotice?.('Folders cannot be added to a note. Drop onto the folder tree or note list to import it.');
              return true;
            }

            // 2. Note dropped from note list onto note -> insert wikilink [[Note]]
            const noteDataStr = dataTransfer.getData('application/x-wrriter-note');
            if (noteDataStr) {
              event.preventDefault();
              let title = '';
              try {
                const parsed = JSON.parse(noteDataStr);
                title = parsed.title || parsed.path || '';
              } catch {
                title = noteDataStr;
              }

              if (title) {
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                const dropPos = coords ? coords.pos : view.state.selection.from;
                insertWikilink(view, dropPos, dropPos, title);
              }
              return true;
            }

            // 3. Files dropped from File Explorer
            const files = Array.from(dataTransfer.files || []);
            if (files.length > 0) {
              event.preventDefault();

              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const dropPos = coords ? coords.pos : view.state.selection.from;

              void (async () => {
                const validFileItems: { file: File; sourcePath: string; isDir: boolean; size: number; name: string }[] = [];

                for (const file of files) {
                  const sourcePath = (window as any).wrriter?.getPathForFile
                    ? (window as any).wrriter.getPathForFile(file)
                    : (file as any).path || '';

                  if (sourcePath && (window as any).wrriter?.attachment?.inspectPath) {
                    const infoRes = await (window as any).wrriter.attachment.inspectPath({ path: sourcePath });
                    if (infoRes.ok) {
                      validFileItems.push({
                        file,
                        sourcePath,
                        isDir: infoRes.value.isDirectory,
                        size: infoRes.value.size,
                        name: infoRes.value.name
                      });
                    }
                  } else {
                    validFileItems.push({
                      file,
                      sourcePath,
                      isDir: false,
                      size: file.size,
                      name: file.name
                    });
                  }
                }

                // Check for folder dropped on note
                const hasDir = validFileItems.some((item) => item.isDir);
                if (hasDir) {
                  options.onNotice?.('Folders cannot be added to a note. Drop onto the folder tree or note list to import it.');
                }

                const nonDirItems = validFileItems.filter((item) => !item.isDir);
                if (nonDirItems.length === 0) return;

                // Check for file over 500 MB (confirmation dialog)
                const FIVE_HUNDRED_MB = 500 * 1024 * 1024;
                const largeItem = nonDirItems.find((item) => item.size > FIVE_HUNDRED_MB);

                const processFiles = async (itemsToSave: typeof nonDirItems) => {
                  const nodesToInsert: any[] = [];
                  let isAborted = false;

                  const cancelProgress = () => {
                    isAborted = true;
                    options.onProgressChange?.(null);
                  };

                  for (let i = 0; i < itemsToSave.length; i++) {
                    if (isAborted) break;
                    const item = itemsToSave[i]!;

                    // Show progress for large files (> 20 MB)
                    if (item.size > 20 * 1024 * 1024) {
                      options.onProgressChange?.({
                        fileName: item.name,
                        percent: Math.round(((i + 1) / itemsToSave.length) * 100),
                        onCancel: cancelProgress
                      });
                    }

                    try {
                      let saved: any = null;
                      if (item.sourcePath && (window as any).wrriter?.attachment?.saveDroppedFile) {
                        const saveRes = await (window as any).wrriter.attachment.saveDroppedFile({
                          notePath,
                          sourcePath: item.sourcePath
                        });
                        if (saveRes.ok) {
                          saved = saveRes.value;
                        }
                      } else {
                        const buf = await item.file.arrayBuffer();
                        const bytes = new Uint8Array(buf);
                        const saveRes = await (window as any).wrriter?.attachment?.save?.({
                          notePath,
                          fileName: item.name,
                          bytes
                        });
                        if (saveRes?.ok) {
                          saved = saveRes.value;
                        }
                      }

                      if (saved) {
                        const isImage = isInlineImageExtension(saved.fileName);
                        if (isImage) {
                          const imageType = view.state.schema.nodes['image'];
                          if (imageType) {
                            nodesToInsert.push(
                              imageType.create({
                                src: saved.relativePath,
                                alt: saved.fileName,
                                alignment: 'center'
                              })
                            );
                          }
                        } else {
                          const fchipType = view.state.schema.nodes['fileChip'];
                          if (fchipType) {
                            nodesToInsert.push(
                              fchipType.create({
                                name: saved.fileName,
                                path: saved.relativePath,
                                size: saved.size,
                                missing: false
                              })
                            );
                          }
                        }
                      }
                    } catch {
                      // Skip failed item
                    }
                  }

                  options.onProgressChange?.(null);

                  if (nodesToInsert.length > 0 && !isAborted) {
                    // Single history transaction: Ctrl+Z removes inserted nodes and keeps file in attachments/
                    let tr = view.state.tr;
                    let currentPos = dropPos;

                    for (const node of nodesToInsert) {
                      tr = tr.insert(currentPos, node);
                      currentPos += node.nodeSize;
                    }

                    tr = tr.scrollIntoView();
                    view.dispatch(tr);
                  }
                };

                if (largeItem && options.onRequestLargeFileConfirm) {
                  const sizeMb = Math.round(largeItem.size / (1024 * 1024));
                  options.onRequestLargeFileConfirm(
                    largeItem.name,
                    sizeMb,
                    () => {
                      void processFiles(nonDirItems);
                    },
                    () => {
                      // Filter out the large item or cancel
                      const remaining = nonDirItems.filter((i) => i !== largeItem);
                      if (remaining.length > 0) {
                        void processFiles(remaining);
                      }
                    }
                  );
                } else {
                  void processFiles(nonDirItems);
                }
              })();

              return true;
            }

            const html = dataTransfer.getData('text/html');
            const plain = dataTransfer.getData('text/plain');

            // 4. Remote image dropped from browser
            const browserImg = parseBrowserImageDrop(html, plain);
            if (browserImg && browserImg.imageUrl) {
              event.preventDefault();
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const dropPos = coords ? coords.pos : view.state.selection.from;

              void (async () => {
                const dlRes = await (window as any).wrriter?.attachment?.downloadImage?.({
                  notePath,
                  url: browserImg.imageUrl,
                  altText: browserImg.altText
                });

                if (dlRes?.ok && dlRes.value.downloaded) {
                  const imageType = view.state.schema.nodes['image'];
                  if (imageType) {
                    const imgNode = imageType.create({
                      src: dlRes.value.relativePath,
                      alt: dlRes.value.fileName || browserImg.altText || 'image',
                      alignment: 'center'
                    });
                    view.dispatch(view.state.tr.insert(dropPos, imgNode).scrollIntoView());
                    return;
                  }
                }

                // Fallback link if download fails or times out
                const fallbackLabel = browserImg.altText || 'image';
                const fallbackMd = `![${fallbackLabel}](${browserImg.imageUrl})`;
                const fallbackDoc = markdownToTipTapDoc(fallbackMd);
                if (fallbackDoc?.content) {
                  const nodes = fallbackDoc.content.map((n) => view.state.schema.nodeFromJSON(n));
                  view.dispatch(view.state.tr.replaceWith(dropPos, dropPos, nodes).scrollIntoView());
                } else {
                  view.dispatch(view.state.tr.insertText(fallbackMd, dropPos).scrollIntoView());
                }
              })();

              return true;
            }

            // 5. Link dropped from browser
            const mozUrl = dataTransfer.getData('text/x-moz-url');
            const uriList = dataTransfer.getData('text/uri-list');
            const browserLink = parseBrowserLinkDrop(html, plain, uriList, mozUrl);
            if (browserLink && browserLink.url) {
              event.preventDefault();
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const dropPos = coords ? coords.pos : view.state.selection.from;

              const title = browserLink.title || browserLink.url;
              const linkMarkType = view.state.schema.marks['link'];
              if (linkMarkType) {
                const linkMark = linkMarkType.create({ href: browserLink.url });
                const textNode = view.state.schema.text(title, [linkMark]);
                view.dispatch(view.state.tr.insert(dropPos, textNode).scrollIntoView());
              } else {
                view.dispatch(view.state.tr.insertText(`[${title}](${browserLink.url})`, dropPos).scrollIntoView());
              }
              return true;
            }

            // 6. Selected text from a browser or another app -> markdown at drop point
            if (html || plain) {
              event.preventDefault();
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
              const dropPos = coords ? coords.pos : view.state.selection.from;

              let markdown = '';
              if (html) {
                markdown = htmlToCleanMarkdown(html);
              }
              if (!markdown.trim() && plain) {
                markdown = plain;
              }

              if (markdown.trim()) {
                const docJson = markdownToTipTapDoc(markdown);
                if (docJson && docJson.content && docJson.content.length > 0) {
                  const nodes = docJson.content.map((n) => view.state.schema.nodeFromJSON(n));
                  view.dispatch(view.state.tr.replaceWith(dropPos, dropPos, nodes).scrollIntoView());
                  return true;
                }
              }

              if (plain) {
                view.dispatch(view.state.tr.insertText(plain, dropPos).scrollIntoView());
                return true;
              }
            }

            return false;
          }
        }
      })
    ];
  }
});

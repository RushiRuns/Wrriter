import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { markdownToTipTapDoc } from '../markdown-converter';

/**
 * Converts basic HTML elements into clean Markdown syntax without raw HTML injection.
 */
export function htmlToCleanMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, '').trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove scripts, styles, iframes, objects
  const dangerous = doc.querySelectorAll('script, style, iframe, object, embed');
  dangerous.forEach((el) => el.remove());

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const childrenText = Array.from(el.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1':
        return `\n# ${childrenText.trim()}\n\n`;
      case 'h2':
        return `\n## ${childrenText.trim()}\n\n`;
      case 'h3':
        return `\n### ${childrenText.trim()}\n\n`;
      case 'h4':
        return `\n#### ${childrenText.trim()}\n\n`;
      case 'h5':
        return `\n##### ${childrenText.trim()}\n\n`;
      case 'h6':
        return `\n###### ${childrenText.trim()}\n\n`;
      case 'p':
        return `\n${childrenText.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${childrenText}**`;
      case 'em':
      case 'i':
        return `*${childrenText}*`;
      case 's':
      case 'del':
        return `~~${childrenText}~~`;
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return childrenText;
        }
        return `\`${childrenText}\``;
      case 'pre': {
        const lang = el.querySelector('code')?.className.match(/language-(\w+)/)?.[1] ?? '';
        return `\n\`\`\`${lang}\n${childrenText.trim()}\n\`\`\`\n\n`;
      }
      case 'blockquote':
        return `\n> ${childrenText.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'li': {
        const parentTag = el.parentElement?.tagName.toLowerCase();
        if (parentTag === 'ol') {
          const index = Array.from(el.parentElement?.children ?? []).indexOf(el) + 1;
          return `${index}. ${childrenText.trim()}\n`;
        }
        return `- ${childrenText.trim()}\n`;
      }
      case 'ul':
      case 'ol':
        return `\n${childrenText}\n`;
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        return href ? `[${childrenText}](${href})` : childrenText;
      }
      case 'img': {
        const src = el.getAttribute('src') ?? '';
        const alt = el.getAttribute('alt') ?? '';
        return src ? `![${alt}](${src})` : '';
      }
      case 'br':
        return '\n';
      default:
        return childrenText;
    }
  }

  const rawMd = Array.from(doc.body.childNodes).map(processNode).join('');
  return rawMd.replace(/\n{3,}/g, '\n\n').trim();
}

export const PasteHandlerExtension = Extension.create({
  name: 'pasteHandler',

  addProseMirrorPlugins() {
    let shiftHeld = false;

    return [
      new Plugin({
        key: new PluginKey('pasteHandler'),
        props: {
          handleKeyDown(_view, event) {
            shiftHeld = event.shiftKey;
            return false;
          },
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            const isShift = shiftHeld;
            shiftHeld = false;

            const plainText = clipboardData.getData('text/plain');
            const htmlText = clipboardData.getData('text/html');

            // 1. Shift+Ctrl+V: Paste as unformatted plain text
            if (isShift) {
              if (plainText) {
                view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(plainText)));
                return true;
              }
              return false;
            }

            // 2. Code block: preserve literal code text without parsing markdown
            const { $from } = view.state.selection;
            if ($from.parent.type.name === 'codeBlock') {
              const codeText = plainText || (htmlText ? htmlToCleanMarkdown(htmlText) : '');
              if (codeText) {
                view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(codeText)));
                return true;
              }
              return false;
            }

            // 3. Determine markdown content to parse
            let markdown = '';
            if (htmlText) {
              markdown = htmlToCleanMarkdown(htmlText);
            }
            if (!markdown.trim() && plainText) {
              markdown = plainText;
            }

            if (!markdown.trim()) {
              if (plainText) {
                view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(plainText)));
                return true;
              }
              return false;
            }

            // 4. Parse markdown to TipTap document structure and insert formatted nodes
            try {
              const docJson = markdownToTipTapDoc(markdown);
              if (docJson && docJson.content && docJson.content.length > 0) {
                const BLOCK_START_REGEX = /^[ ]{0,3}(?:#{1,6}\s|[-*+][ \t]|\d+[.)][ \t]|>[ \t]?|`{3,}|~{3,}|\||---|\*\*\*|___|!\[.*\]\(.*\)|<img)/;
                const isMultiBlock =
                  markdown.includes('\n') ||
                  BLOCK_START_REGEX.test(markdown) ||
                  docJson.content.length > 1;

                if (!isMultiBlock && docJson.content.length === 1 && docJson.content[0]?.type === 'paragraph') {
                  const inlineJson = docJson.content[0]?.content ?? [];
                  if (inlineJson.length > 0) {
                    const inlineNodes = inlineJson.map((n) => view.state.schema.nodeFromJSON(n));
                    const { from, to } = view.state.selection;
                    const tr = view.state.tr.replaceWith(from, to, inlineNodes);
                    tr.scrollIntoView();
                    view.dispatch(tr);
                    return true;
                  }
                } else {
                  const blockNodes = docJson.content.map((n) => view.state.schema.nodeFromJSON(n));
                  let { from, to } = view.state.selection;
                  const tr = view.state.tr;
                  const res = tr.doc.resolve(from);
                  if (
                    from === to &&
                    res.parent.isTextblock &&
                    !res.parent.type.spec.code &&
                    res.parent.content.size === 0
                  ) {
                    from = res.before();
                    to = res.after();
                  }
                  tr.replaceWith(from, to, blockNodes);
                  tr.scrollIntoView();
                  view.dispatch(tr);
                  return true;
                }
              }
            } catch {
              // Fallback to literal text if parsing fails
            }

            view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(plainText || markdown)));
            return true;
          }
        }
      })
    ];
  }
});

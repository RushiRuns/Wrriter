import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Converts basic HTML elements into clean Markdown syntax without raw HTML injection.
 */
function htmlToCleanMarkdown(html: string): string {
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
      case 'li':
        return `- ${childrenText.trim()}\n`;
      case 'ul':
      case 'ol':
        return `\n${childrenText}\n`;
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        return href ? `[${childrenText}](${href})` : childrenText;
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

            // 1. Plain text shortcut (Ctrl+Shift+V or text/plain preferred)
            const plainText = clipboardData.getData('text/plain');
            const htmlText = clipboardData.getData('text/html');

            if (!htmlText || isShift) {
              if (plainText) {
                view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(plainText)));
                return true;
              }
              return false;
            }

            // 2. Web HTML content -> clean Markdown
            const cleanMarkdown = htmlToCleanMarkdown(htmlText);
            if (cleanMarkdown) {
              view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.text(cleanMarkdown)));
              return true;
            }

            return false;
          }
        }
      })
    ];
  }
});

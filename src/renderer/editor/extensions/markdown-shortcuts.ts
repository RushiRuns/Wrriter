import { Extension, textblockTypeInputRule, wrappingInputRule, InputRule } from '@tiptap/core';

export const MarkdownShortcutsExtension = Extension.create({
  name: 'markdownShortcuts',

  addInputRules() {
    return [
      // 1. Heading shortcut: 1 to 6 '#' followed by a space
      textblockTypeInputRule({
        find: /^(#{1,6})\s$/,
        type: this.editor.schema.nodes['heading']!,
        getAttributes: (match) => ({
          level: match[1]?.length ?? 1
        })
      }),

      // 2. Bullet list shortcut: '-' or '*' or '+' followed by a space
      wrappingInputRule({
        find: /^\s*([-*+])\s$/,
        type: this.editor.schema.nodes['bulletList']!
      }),

      // 3. Ordered list shortcut: '1.' followed by a space
      wrappingInputRule({
        find: /^(\d+)\.\s$/,
        type: this.editor.schema.nodes['orderedList']!,
        getAttributes: (match) => ({
          start: parseInt(match[1] || '1', 10)
        })
      }),

      // 4. Task list shortcut: '[ ] ' or '[] ' or '[x] '
      wrappingInputRule({
        find: /^\s*\[([ xX/])?\]\s$/,
        type: this.editor.schema.nodes['taskList']!,
        getAttributes: (match) => ({
          checked: match[1] === 'x' || match[1] === 'X'
        })
      }),

      // 5. Code block shortcut: three backticks '```' followed by optional language and a space
      textblockTypeInputRule({
        find: /^```([a-z0-9_\-]*)\s$/,
        type: this.editor.schema.nodes['codeBlock']!,
        getAttributes: (match) => ({
          language: match[1] || null
        })
      }),

      // 6. Blockquote shortcut: '>' followed by a space
      wrappingInputRule({
        find: /^\s*>\s$/,
        type: this.editor.schema.nodes['blockquote']!
      }),

      // 7. Divider shortcut: '---' followed by a space or enter
      new InputRule({
        find: /^(?:---|___\s|\*\*\*\s)$/,
        handler: ({ state, range }) => {
          const { tr } = state;
          const hr = this.editor.schema.nodes['horizontalRule'];
          if (hr) {
            tr.replaceWith(range.from, range.to, hr.create());
          }
        }
      })
    ];
  }
});

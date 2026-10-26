import { Extension, textblockTypeInputRule, wrappingInputRule } from '@tiptap/core';

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

      // 3. Task list shortcut: '[ ] ' or '[] ' or '[x] '
      wrappingInputRule({
        find: /^\s*\[([ xX/])?\]\s$/,
        type: this.editor.schema.nodes['taskList']!,
        getAttributes: (match) => ({
          checked: match[1] === 'x' || match[1] === 'X'
        })
      }),

      // 4. Code block shortcut: three backticks '```' followed by optional language and a space
      textblockTypeInputRule({
        find: /^```([a-z0-9_\-]*)\s$/,
        type: this.editor.schema.nodes['codeBlock']!,
        getAttributes: (match) => ({
          language: match[1] || null
        })
      }),

      // 5. Blockquote shortcut: '>' followed by a space
      wrappingInputRule({
        find: /^\s*>\s$/,
        type: this.editor.schema.nodes['blockquote']!
      })
    ];
  }
});

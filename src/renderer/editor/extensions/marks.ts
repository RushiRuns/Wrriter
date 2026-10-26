import { Mark, mergeAttributes } from '@tiptap/core';

export const BoldMark = Mark.create({
  name: 'bold',
  parseHTML() {
    return [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['strong', mergeAttributes(HTMLAttributes), 0];
  }
});

export const ItalicMark = Mark.create({
  name: 'italic',
  parseHTML() {
    return [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['em', mergeAttributes(HTMLAttributes), 0];
  }
});

export const StrikeMark = Mark.create({
  name: 'strike',
  parseHTML() {
    return [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['s', mergeAttributes(HTMLAttributes), 0];
  }
});

export const CodeMark = Mark.create({
  name: 'code',
  excludes: '_',
  parseHTML() {
    return [{ tag: 'code' }, { tag: 'span.ic2' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['code', mergeAttributes(HTMLAttributes, { class: 'ic2 mono inline-code' }), 0];
  }
});

import { Mark, mergeAttributes } from '@tiptap/core';

export const BoldMark = Mark.create({
  name: 'bold',
  parseHTML() {
    return [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=bold' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['strong', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands(): any {
    return {
      setBold:
        () =>
        ({ commands }: any) => {
          return commands.setMark(this.name);
        },
      toggleBold:
        () =>
        ({ commands }: any) => {
          return commands.toggleMark(this.name);
        },
      unsetBold:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        }
    };
  }
});

export const ItalicMark = Mark.create({
  name: 'italic',
  parseHTML() {
    return [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['em', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands(): any {
    return {
      setItalic:
        () =>
        ({ commands }: any) => {
          return commands.setMark(this.name);
        },
      toggleItalic:
        () =>
        ({ commands }: any) => {
          return commands.toggleMark(this.name);
        },
      unsetItalic:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        }
    };
  }
});

export const StrikeMark = Mark.create({
  name: 'strike',
  parseHTML() {
    return [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['s', mergeAttributes(HTMLAttributes), 0];
  },
  addCommands(): any {
    return {
      setStrike:
        () =>
        ({ commands }: any) => {
          return commands.setMark(this.name);
        },
      toggleStrike:
        () =>
        ({ commands }: any) => {
          return commands.toggleMark(this.name);
        },
      unsetStrike:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        }
    };
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
  },
  addCommands(): any {
    return {
      setCode:
        () =>
        ({ commands }: any) => {
          return commands.setMark(this.name);
        },
      toggleCode:
        () =>
        ({ commands }: any) => {
          return commands.toggleMark(this.name);
        },
      unsetCode:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        }
    };
  }
});

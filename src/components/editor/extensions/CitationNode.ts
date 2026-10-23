import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/react';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    citation: {
      /**
       * Inserts an inline citation marker at current selection.
       */
      insertCitation: (sourceId: string) => ReturnType;
    };
  }
}

export const CitationNode = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      sourceId: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-citation') ||
          element.getAttribute('data-source-id') ||
          '',
        renderHTML: (attributes) => {
          if (!attributes.sourceId) {
            return {};
          }
          return {
            'data-citation': attributes.sourceId,
            'class': 'inline-citation-marker'
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-citation]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            sourceId: element.getAttribute('data-citation') || ''
          };
        }
      },
      {
        tag: 'span.inline-citation-marker',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          const attr = element.getAttribute('data-citation');
          if (attr) return { sourceId: attr };
          const txt = element.textContent || '';
          const match = txt.match(/\[@cite:([a-zA-Z0-9_\-\.:]+)\]/);
          return {
            sourceId: match ? match[1] : ''
          };
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const id = node.attrs.sourceId || '';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-citation': id,
        'class':
          'inline-citation-marker font-mono text-[11px] text-[#2A548E] bg-[#EEF5FF] border border-[#99BFF9]/40 rounded px-1.5 py-0.2 mx-0.5 font-semibold align-super select-none cursor-pointer hover:bg-[#2A548E] hover:text-white transition-colors',
        'contenteditable': 'false',
        'title': `Citation: [[@cite:${id}]]`
      }),
      `[@cite:${id}]`
    ];
  },

  addCommands() {
    return {
      insertCitation:
        (sourceId: string) =>
        ({ commands, state, chain }) => {
          const { selection } = state;
          // If text is highlighted, place citation directly after selection without deleting text
          if (!selection.empty) {
            return chain()
              .focus()
              .setTextSelection(selection.to)
              .insertContent({
                type: this.name,
                attrs: { sourceId }
              })
              .run();
          }

          return commands.insertContent({
            type: this.name,
            attrs: { sourceId }
          });
        }
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[@cite:([a-zA-Z0-9_\-\.:]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({
          sourceId: match[1]
        })
      })
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\[\[@cite:([a-zA-Z0-9_\-\.:]+)\]\]/g,
        type: this.type,
        getAttributes: (match) => ({
          sourceId: match[1]
        })
      })
    ];
  }
});

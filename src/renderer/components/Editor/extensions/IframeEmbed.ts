import { Node, mergeAttributes, createAtomBlockMarkdownSpec } from '@tiptap/core';

export interface IframeEmbedOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iframeEmbed: {
      setIframeEmbed: (options: { src: string; title?: string }) => ReturnType;
    };
  }
}

export const IframeEmbed = Node.create<IframeEmbedOptions>({
  name: 'iframeEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
      width: { default: '100%' },
      height: { default: '400' },
      frameborder: { default: '0' },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'iframe-embed-wrapper', 'data-type': 'iframe-embed' },
      [
        'iframe',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          allowfullscreen: this.options.allowFullscreen,
          sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms',
          loading: 'lazy',
        }),
      ],
    ];
  },

  addCommands() {
    return {
      setIframeEmbed:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  ...createAtomBlockMarkdownSpec({
    nodeName: 'iframeEmbed',
    allowedAttributes: ['src', 'title', 'width', 'height'],
  }),
});

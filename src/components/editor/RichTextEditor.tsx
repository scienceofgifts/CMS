import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TipTapImage from '@tiptap/extension-image';
import TurndownService from 'turndown';
import { marked } from 'marked';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Unlink,
  Undo2,
  Redo2,
  Check,
  X,
  Clock,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { AssetPickerModal } from '../assets/AssetPickerModal';
import { AssetPickerResult } from '../../types/assets';

// Custom TipTap Link extension supporting standard HTML title attribute
const CustomLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) => {
          if (!attributes.title) {
            return {};
          }
          return {
            title: attributes.title
          };
        }
      }
    };
  }
});

interface RichTextEditorProps {
  initialMarkdown?: string;
  initialHtml?: string;
  onChange?: (markdown: string, html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialMarkdown = '',
  initialHtml = '',
  onChange,
  placeholder = 'Begin writing your essay or guide narrative here...',
  minHeight = '320px',
  className = ''
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // Turndown service to serialize HTML to clean human-readable Markdown
  const turndown = useMemo(() => {
    const td = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      br: '  '
    });

    // Custom Turndown rule for markdown images with optional captions
    td.addRule('image', {
      filter: 'img',
      replacement: (_content, node) => {
        const el = node as HTMLImageElement;
        const alt = el.getAttribute('alt') || '';
        const src = el.getAttribute('src') || '';
        const title = el.getAttribute('title') || '';
        const titlePart = title ? ` "${title}"` : '';
        return src ? `\n\n![${alt}](${src}${titlePart})\n\n` : '';
      }
    });

    // Custom Turndown rule for paragraph spacing
    td.addRule('paragraph', {
      filter: 'p',
      replacement: (content) => {
        const trimmed = content.trim();
        if (!trimmed) return '\n\n';
        return '\n\n' + content + '\n\n';
      }
    });

    return td;
  }, []);

  // Compute initial content HTML using GFM and breaks
  const computedInitialHtml = useMemo(() => {
    if (initialHtml) return initialHtml;
    if (initialMarkdown) {
      try {
        return marked.parse(initialMarkdown, { gfm: true, breaks: true }) as string;
      } catch {
        return `<p>${initialMarkdown}</p>`;
      }
    }
    return '';
  }, [initialHtml, initialMarkdown]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      CustomLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#2A548E] underline hover:text-[#1E232B] transition-colors',
          rel: 'noopener noreferrer'
        }
      }),
      TipTapImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'my-6 rounded-xs border border-[#99BFF9]/30 shadow-xs max-w-full h-auto mx-auto block'
        }
      })
    ],
    content: computedInitialHtml,
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: `prose max-w-none focus:outline-none text-[#1E232B] font-serif text-base sm:text-lg leading-relaxed min-h-[${minHeight}] p-6 bg-white selection:bg-[#EEF5FF] selection:text-[#2A548E]`
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = turndown.turndown(html);
      if (onChange) {
        onChange(markdown, html);
      }
    }
  });

  // Sync external initialMarkdown changes if loaded asynchronously
  useEffect(() => {
    if (editor && initialMarkdown) {
      const currentMarkdown = turndown.turndown(editor.getHTML());
      if (currentMarkdown.trim() !== initialMarkdown.trim()) {
        try {
          const parsed = marked.parse(initialMarkdown, { gfm: true, breaks: true }) as string;
          editor.commands.setContent(parsed, { emitUpdate: false });
        } catch {
          editor.commands.setContent(`<p>${initialMarkdown}</p>`, { emitUpdate: false });
        }
      }
    }
  }, [initialMarkdown, editor, turndown]);

  const handleAssetSelected = (result: AssetPickerResult) => {
    if (!editor) return;
    const attrs: any = {
      src: result.publicUrl,
      alt: result.altText || result.nameWithoutExt
    };
    if (result.caption) {
      attrs.title = result.caption;
    }
    editor.chain().focus().setImage(attrs).run();
  };

  // Calculate live statistics
  const textContent = editor?.getText() || '';
  const wordCount = useMemo(() => {
    const trimmed = textContent.trim();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  }, [textContent]);
  const charCount = textContent.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const handleApplyLink = () => {
    if (!editor) return;
    if (linkUrl.trim()) {
      let finalUrl = linkUrl.trim();
      if (!/^https?:\/\//i.test(finalUrl) && !finalUrl.startsWith('/') && !finalUrl.startsWith('#')) {
        finalUrl = `https://${finalUrl}`;
      }
      const linkAttributes: { href: string; title?: string } = {
        href: finalUrl
      };
      if (linkTitle.trim()) {
        linkAttributes.title = linkTitle.trim();
      }
      editor.chain().focus().extendMarkRange('link').setLink(linkAttributes).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkModal(false);
    setLinkUrl('');
    setLinkTitle('');
  };

  const handleOpenLinkModal = () => {
    if (!editor) return;
    const attrs = editor.getAttributes('link');
    const previousUrl = attrs.href || '';
    const previousTitle = attrs.title || '';
    setLinkUrl(previousUrl);
    setLinkTitle(previousTitle);
    setShowLinkModal(true);
  };

  if (!editor) {
    return (
      <div className="border border-[#99BFF9]/30 p-8 text-center text-xs text-[#5A6270] bg-white animate-pulse">
        Initializing editorial writing surface...
      </div>
    );
  }

  return (
    <div className={`border border-[#99BFF9]/35 bg-white shadow-2xs ${className}`}>
      {/* WordPress-inspired Calm Sticky Editorial Toolbar */}
      <div className="sticky top-20 sm:top-[136px] z-20 bg-[#FAF9F6] border-b border-[#99BFF9]/25 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {/* Format: Headings */}
            <div className="flex items-center border-r border-[#99BFF9]/20 pr-1.5 mr-1.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  editor.isActive('paragraph') && !editor.isActive('heading')
                    ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Paragraph (Normal Text)"
              >
                Paragraph
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Heading 2 (H2)"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Heading 3 (H3)"
              >
                <Heading3 className="w-4 h-4" />
              </button>
            </div>

            {/* Inline: Bold / Italic */}
            <div className="flex items-center border-r border-[#99BFF9]/20 pr-1.5 mr-1.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('bold')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('italic')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>
            </div>

            {/* Link */}
            <div className="flex items-center border-r border-[#99BFF9]/20 pr-1.5 mr-1.5">
              <button
                type="button"
                onClick={handleOpenLinkModal}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('link')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Insert Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
              {editor.isActive('link') && (
                <button
                  type="button"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                  className="p-1.5 rounded text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remove Link"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Image Insertion */}
            <div className="flex items-center border-r border-[#99BFF9]/20 pr-1.5 mr-1.5">
              <button
                type="button"
                onClick={() => setShowAssetPicker(true)}
                className="p-1.5 rounded transition-colors cursor-pointer text-[#5A6270] hover:text-[#2A548E] hover:bg-stone-100"
                title="Insert Image from Media Library"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Lists & Blockquote */}
            <div className="flex items-center border-r border-[#99BFF9]/20 pr-1.5 mr-1.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('bulletList')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Bulleted List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('orderedList')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  editor.isActive('blockquote')
                    ? 'bg-[#EEF5FF] text-[#2A548E]'
                    : 'text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100'
                }`}
                title="Editorial Blockquote"
              >
                <Quote className="w-4 h-4" />
              </button>
            </div>

            {/* History */}
            <div className="flex items-center">
              <button
                type="button"
                disabled={!editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}
                className="p-1.5 rounded text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}
                className="p-1.5 rounded text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Writing Statistics Pill */}
          <div className="flex items-center gap-3 text-[11px] text-[#5A6270] font-mono-code">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#2A548E]" />
              <span>{wordCount} words</span>
            </span>
            <span className="hidden sm:inline text-stone-300">|</span>
            <span className="hidden sm:flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#226E56]" />
              <span>~{readTimeMin} min read</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider font-sans font-semibold text-[#226E56] bg-[#E8F8F1] px-1.5 py-0.5 rounded">
              Spellcheck On
            </span>
          </div>
        </div>

        {/* Inline Link Modal Popover */}
        {showLinkModal && (
          <div className="p-3 bg-[#EEF5FF] border-t border-[#99BFF9]/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <LinkIcon className="w-4 h-4 text-[#2A548E] shrink-0" />
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyLink();
                  if (e.key === 'Escape') setShowLinkModal(false);
                }}
                placeholder="Enter web link (e.g. https://... or /gift-guides/...)"
                autoFocus
                className="flex-1 px-3 py-1.5 bg-white border border-[#99BFF9]/40 text-xs text-[#1E232B] focus:outline-none focus:border-[#2A548E]"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[11px] font-semibold text-[#5A6270] whitespace-nowrap">Title:</span>
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyLink();
                  if (e.key === 'Escape') setShowLinkModal(false);
                }}
                placeholder="Text shown when someone hovers over the link"
                className="flex-1 px-3 py-1.5 bg-white border border-[#99BFF9]/40 text-xs text-[#1E232B] focus:outline-none focus:border-[#2A548E]"
              />
            </div>
            <div className="flex items-center gap-1.5 justify-end shrink-0">
              <button
                type="button"
                onClick={handleApplyLink}
                className="px-3 py-1.5 bg-[#2A548E] text-white text-xs font-medium hover:bg-[#1E3E6B] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl('');
                  setLinkTitle('');
                }}
                className="px-2 py-1.5 text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Editable Surface with Browser Spellchecking */}
      <div className="min-h-[300px] cursor-text">
        <EditorContent editor={editor} />
      </div>

      {/* Footer Helper Note */}
      <div className="border-t border-[#99BFF9]/20 px-4 py-2 bg-[#FAF9F6] text-[11px] text-[#5A6270] flex items-center justify-between">
        <span>Rich-text writing engine automatically converts to Jekyll Markdown on save.</span>
        <span>{charCount} characters</span>
      </div>

      {/* Reusable Asset Picker Modal for RichTextEditor */}
      <AssetPickerModal
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        title="Insert Image into Content"
        showCaptionInput={true}
        onSelect={handleAssetSelected}
      />
    </div>
  );
};

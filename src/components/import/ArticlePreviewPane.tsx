import React, { useState } from 'react';
import { marked } from 'marked';
import {
  Monitor,
  Smartphone,
  ExternalLink,
  BookOpen,
  User,
  Calendar,
  Tag,
  Clock,
  Sparkles,
  Link2,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ImportDraft, ImportAnalysisResult, StructuredArticleLink, DetectedProductCandidate } from '../../types/import';

interface ArticlePreviewPaneProps {
  draft: ImportDraft;
  analysis?: ImportAnalysisResult | null;
  structuredLinks?: StructuredArticleLink[];
  productCandidates?: DetectedProductCandidate[];
  onSelectLinkTab?: () => void;
  onSelectProductTab?: () => void;
}

export const ArticlePreviewPane: React.FC<ArticlePreviewPaneProps> = ({
  draft,
  analysis,
  structuredLinks = [],
  productCandidates = [],
  onSelectLinkTab,
  onSelectProductTab
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [highlightLinks, setHighlightLinks] = useState<boolean>(true);

  // Convert markdown body to HTML cleanly with marked
  const renderFormattedBodyHtml = () => {
    try {
      const rawHtml = marked.parse(draft.body || '', { gfm: true, breaks: true }) as string;
      
      if (!highlightLinks) {
        return rawHtml;
      }

      // Add custom styling class to <a> tags in rendered HTML for visual clarity
      return rawHtml.replace(
        /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["']([^>]*)>(.*?)<\/a>/gi,
        (match, href, rest, text) => {
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[#2A548E] font-medium underline decoration-[#99BFF9] hover:decoration-[#2A548E] bg-[#EEF5FF]/60 px-1 py-0.5 rounded transition-colors inline-flex items-center gap-0.5" title="Rendered Link: ${href}">${text}</a>`;
        }
      );
    } catch (err) {
      console.error('Error rendering markdown to HTML:', err);
      return `<p class="text-red-600">Error parsing body markdown: ${String(err)}</p>`;
    }
  };

  const bodyHtml = renderFormattedBodyHtml();
  const validLinksCount = structuredLinks.filter(l => !l.isRemoved).length;
  const productLinksCount = structuredLinks.filter(l => l.classification === 'product' && !l.isRemoved).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Control & Summary Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#99BFF9]/30 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#EEF5FF] text-[#2A548E] rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif-display text-base font-semibold text-[#1E232B]">
              Rendered Article Preview
            </h3>
            <p className="text-xs text-[#5A6270]">
              Rendered Jekyll layout preview with converted HTML links and metadata.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Link / Product Indicators */}
          <button
            type="button"
            onClick={onSelectLinkTab}
            className="px-2.5 py-1.5 bg-[#EEF5FF] hover:bg-[#99BFF9]/30 text-[#2A548E] rounded-lg text-xs font-medium flex items-center gap-1.5 border border-[#99BFF9]/40 cursor-pointer transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{validLinksCount} Parsed Links</span>
            {productLinksCount > 0 && (
              <span className="bg-[#2A548E] text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                {productLinksCount} Product
              </span>
            )}
          </button>

          {productCandidates.length > 0 && (
            <button
              type="button"
              onClick={onSelectProductTab}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-amber-200 cursor-pointer transition-colors"
            >
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>{productCandidates.length} Product Candidates</span>
            </button>
          )}

          {/* Toggle Link Highlighting */}
          <label className="flex items-center gap-1.5 text-xs text-[#5A6270] cursor-pointer bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
            <input
              type="checkbox"
              checked={highlightLinks}
              onChange={(e) => setHighlightLinks(e.target.checked)}
              className="rounded text-[#2A548E] focus:ring-[#2A548E]"
            />
            <span>Highlight Links</span>
          </label>

          {/* Viewport Switcher */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                viewport === 'desktop'
                  ? 'bg-white text-[#1E232B] shadow-2xs font-semibold'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                viewport === 'mobile'
                  ? 'bg-white text-[#1E232B] shadow-2xs font-semibold'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Container */}
      <div className={`mx-auto transition-all duration-300 ${
        viewport === 'mobile' ? 'max-w-md bg-stone-800 p-3 rounded-3xl shadow-xl' : 'w-full'
      }`}>
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
          {/* Simulated Browser Bar */}
          <div className="bg-stone-100 border-b border-stone-200 px-4 py-2 flex items-center justify-between text-xs text-[#5A6270]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="bg-white border border-stone-200 rounded px-3 py-0.5 font-mono text-[11px] text-stone-600 truncate max-w-md">
              https://scienceofgifts.com/{draft.targetType === 'guide' ? 'guides' : 'articles'}/{draft.slug || 'preview-article'}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">
              {draft.targetType === 'guide' ? 'Gift Guide' : 'Article'}
            </span>
          </div>

          {/* Article Header */}
          <div className="p-6 md:p-8 bg-[#FAF9F6] border-b border-stone-200">
            {/* Category / Taxonomy */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 bg-[#EEF5FF] text-[#2A548E] text-xs font-bold uppercase tracking-wider rounded">
                {draft.category || 'General Editorial'}
              </span>
              {draft.readTime && (
                <span className="text-xs text-[#5A6270] flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {draft.readTime}
                </span>
              )}
            </div>

            {/* Reader H1 Title */}
            <h1 className="font-serif-display text-2xl md:text-3xl font-bold text-[#1E232B] leading-tight mb-3">
              {draft.title || 'Untitled Migration Article'}
            </h1>

            {/* Deck / Summary */}
            {draft.deck && (
              <p className="text-sm md:text-base text-[#5A6270] leading-relaxed mb-4 font-serif italic">
                {draft.deck}
              </p>
            )}

            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-stone-200 text-xs text-[#5A6270]">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#2A548E]" />
                <span className="font-semibold text-[#1E232B]">{draft.authorName || 'Editorial Staff'}</span>
                {draft.authorRole && <span className="text-stone-400">({draft.authorRole})</span>}
              </div>

              {draft.publishedDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>Published: {draft.publishedDate}</span>
                </div>
              )}

              {draft.searchTitle && draft.searchTitle !== draft.title && (
                <div className="text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  <strong>SERP Title:</strong> {draft.searchTitle}
                </div>
              )}
            </div>
          </div>

          {/* Hero Image if present */}
          {draft.heroImageType && (
            <div className="p-6 bg-stone-50 border-b border-stone-200 text-center">
              <div className="max-w-xl mx-auto rounded-lg overflow-hidden border border-stone-200 bg-white p-2 shadow-2xs">
                {draft.heroImageType.startsWith('http') ? (
                  <img
                    src={draft.heroImageType}
                    alt={draft.heroImageAlt || draft.title}
                    className="w-full h-auto object-cover rounded max-h-80"
                  />
                ) : (
                  <div className="py-12 bg-stone-100 rounded text-center text-stone-500 text-xs">
                    <p className="font-semibold">Hero Artwork Asset Key:</p>
                    <code className="text-[#2A548E] font-mono text-sm">{draft.heroImageType}</code>
                  </div>
                )}
                {draft.heroImageCaption && (
                  <p className="text-xs text-[#5A6270] italic mt-2">
                    {draft.heroImageCaption}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Intro Callout Quote if present */}
          {draft.introQuote && (
            <div className="mx-6 md:mx-8 my-6 p-4 bg-[#EEF5FF] border-l-4 border-[#2A548E] rounded-r-lg text-sm text-[#1E232B] italic">
              "{draft.introQuote}"
            </div>
          )}

          {/* Article Body Content (Rendered HTML) */}
          <div className="p-6 md:p-8">
            <div
              className="prose prose-stone max-w-none prose-headings:font-serif-display prose-headings:text-[#1E232B] prose-p:text-[#1E232B] prose-p:leading-relaxed prose-a:text-[#2A548E] prose-blockquote:border-l-4 prose-blockquote:border-[#99BFF9] prose-blockquote:bg-stone-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>

          {/* Article Footer Summary */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 text-xs text-[#5A6270] flex items-center justify-between">
            <span>Science of Gifts Migration Preview</span>
            <span>{validLinksCount} inline links verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

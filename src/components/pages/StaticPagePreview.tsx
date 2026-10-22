import React, { useMemo } from 'react';
import { ChevronRight, Home, Sparkles, LayoutGrid, Search } from 'lucide-react';
import { marked } from 'marked';
import { StaticPageData } from '../../types/pages';

interface StaticPagePreviewProps {
  page: StaticPageData;
}

export function StaticPagePreview({ page }: StaticPagePreviewProps) {
  // Render Markdown content to HTML for live preview on standard pages
  const renderedBodyHtml = useMemo(() => {
    if (page.slug === '404' || page.slug === 'sitemap') return '';
    try {
      return marked.parse(page.content || '');
    } catch {
      return '<p>Error rendering preview content.</p>';
    }
  }, [page.content, page.slug]);

  // PREVIEW FOR 404 SPECIAL SYSTEM PAGE
  if (page.slug === '404') {
    return (
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs p-6 sm:p-10 text-center space-y-8">
        <div className="w-16 h-16 rounded-full bg-[#EEF5FF] text-[#2A548E] mx-auto flex items-center justify-center border border-[#99BFF9]/30 relative">
          <svg className="w-8 h-8 text-[#2A548E] animate-pulse" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C3F3DF] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#226E56]"></span>
          </span>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-[#226E56] font-semibold font-mono-code">
            Error Code: 404
          </span>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal leading-tight">
            {page.headline || page.title || 'A Cartographic Deviation'}
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6270] leading-relaxed max-w-lg mx-auto font-serif italic">
            {page.lead || page.description || 'The coordinates you pursued do not exist in our library index.'}
          </p>
        </div>

        {/* Compass Graphic Box */}
        <div className="max-w-xs mx-auto p-4 bg-white border border-[#99BFF9]/25 shadow-xs space-y-3">
          <div className="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/25 aspect-[16/9] rounded-sm flex items-center justify-center">
            <svg className="w-full h-full opacity-80" viewBox="0 0 800 450" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="800" height="450" fill="#FAF9F6"></rect>
              <ellipse cx="400" cy="225" rx="160" ry="160" fill="none" stroke="#99BFF9" strokeOpacity="0.3" strokeWidth="1"></ellipse>
              <ellipse cx="400" cy="225" rx="120" ry="120" fill="none" stroke="#2A548E" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 4"></ellipse>
              <ellipse cx="400" cy="225" rx="80" ry="80" fill="none" stroke="#C5A059" strokeOpacity="0.5" strokeWidth="1"></ellipse>
              <line x1="400" y1="0" x2="400" y2="450" stroke="#99BFF9" strokeOpacity="0.2" strokeWidth="1"></line>
              <line x1="0" y1="225" x2="800" y2="225" stroke="#99BFF9" strokeOpacity="0.2" strokeWidth="1"></line>
              <circle cx="400" cy="225" r="4" fill="#1B365D"></circle>
              <polygon points="400,165 408,225 400,217" fill="#1B365D"></polygon>
              <polygon points="400,285 408,225 400,217" fill="#C5A059"></polygon>
              <polygon points="400,165 392,225 400,217" fill="#2A548E"></polygon>
              <polygon points="400,285 392,225 400,217" fill="#8E6B2A"></polygon>
              <text x="400" y="145" textAnchor="middle" fill="#2D3748" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1">TERRA INCOGNITA</text>
            </svg>
          </div>
          <div className="text-[10px] text-[#5A6270] italic font-serif">
            {page.quote || '"Not all who wander are lost, but some are definitely off-route."'}
          </div>
        </div>

        {/* Buttons Mock */}
        <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-2 text-[11px]">
          <span className="px-4 py-2 bg-[#2A548E] text-white font-semibold uppercase tracking-wider rounded shadow-2xs">
            {page.btnHome || 'Return to Home'}
          </span>
          <span className="px-4 py-2 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/40 font-semibold uppercase tracking-wider rounded">
            {page.btnFinder || 'Launch Gift Finder'}
          </span>
          <span className="px-4 py-2 bg-white text-[#1E232B] border border-stone-200 font-semibold uppercase tracking-wider rounded">
            {page.btnGuides || 'Browse Gift Guides'}
          </span>
        </div>
      </div>
    );
  }

  // PREVIEW FOR SITEMAP STRUCTURED PAGE
  if (page.slug === 'sitemap') {
    return (
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs">
        <div className="pb-12 space-y-8">
          {/* Breadcrumb strip */}
          <div className="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#5A6270]">
              <nav className="flex items-center space-x-2">
                <span className="hover:text-[#2A548E] cursor-default">Home</span>
                <ChevronRight className="w-3 h-3 text-[#5A6270]/40" />
                <span className="text-[#2A548E] font-medium">{page.title || 'Sitemap'}</span>
              </nav>
            </div>
          </div>

          {/* Page Header */}
          <header className="pt-4 pb-6 border-b border-[#99BFF9]/25">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 text-center sm:text-left">
              <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">
                {page.badge || 'Directory & Navigation'}
              </div>
              <h1 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal leading-[1.18]">
                {page.title || 'Site Directory & Human Sitemap'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5A6270] leading-relaxed">
                {page.lead || page.description || 'A comprehensive, human-readable directory indexing all internal sections...'}
              </p>
            </div>
          </header>

          {/* Cards Directory */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-xs text-[#1E232B] leading-relaxed">
            {page.cardsHtml ? (
              <div
                className="space-y-6"
                dangerouslySetInnerHTML={{ __html: page.cardsHtml }}
              />
            ) : (
              <div className="p-8 bg-white border border-[#99BFF9]/30 rounded text-center text-[#5A6270]">
                Sitemap Directory Cards Section (Main Sections, Gift Guides, Research Essays, Subject Areas, Institutional Pages)
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PREVIEW FOR STANDARD EDITORIAL / LEGAL PAGES (about, affiliate-disclosure, contact, privacy, terms)
  return (
    <div className="bg-[#FAF9F6] border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs">
      <article className="pb-16 space-y-12">
        {/* Breadcrumb strip */}
        <div className="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#5A6270]">
            <nav className="flex items-center space-x-2">
              <span className="hover:text-[#2A548E] transition-colors cursor-default">Home</span>
              <ChevronRight className="w-3 h-3 text-[#5A6270]/40" />
              <span className="text-[#2A548E] font-medium">{page.title || 'Page Title'}</span>
            </nav>
          </div>
        </div>

        {/* Page Header */}
        <header className="pt-8 pb-8 border-b border-[#99BFF9]/25">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center sm:text-left">
            <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">
              {page.badge || 'Editorial Standards'}
            </div>
            <h1 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-[#1E232B] font-normal leading-[1.18] text-balance">
              {page.title || 'Untitled Static Page'}
            </h1>
            <p className="text-base sm:text-lg text-[#5A6270] leading-relaxed">
              {page.lead || page.description || 'Page lead subtitle narrative...'}
            </p>
          </div>
        </header>

        {/* Editorial Body Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-base text-[#1E232B] leading-relaxed">
          <div
            className="markdown-body space-y-6 prose max-w-none text-[#1E232B]"
            dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
          />
        </div>
      </article>
    </div>
  );
}

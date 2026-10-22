import React from 'react';
import {
  Clock,
  Calendar,
  Share2,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Quote
} from 'lucide-react';
import { ArticleFrontMatter } from '../../types/articles';
import { formatIsoToHuman } from '../../utils/date';

interface ArticlePreviewProps {
  frontMatter: ArticleFrontMatter;
  bodyHtml: string;
}

export const ArticlePreview: React.FC<ArticlePreviewProps> = ({ frontMatter, bodyHtml }) => {
  const category = frontMatter.category || 'Gift Psychology';
  const readTime = frontMatter.readTime || '5 min read';
  const lastModFormatted = formatIsoToHuman(frontMatter.lastModifiedDate || frontMatter.updatedDate);
  const pubDateFormatted = formatIsoToHuman(frontMatter.publishedDate);
  const dateDisplay = lastModFormatted ? `Updated ${lastModFormatted}` : pubDateFormatted ? `Published ${pubDateFormatted}` : '';

  const heroImageSrc = (() => {
    const raw = frontMatter.heroImageType || frontMatter.image || frontMatter.slug;
    if (!raw) return '/assets/images/home-hero.jpg';
    if (raw.startsWith('/') || raw.startsWith('http') || raw.startsWith('assets/')) {
      return raw.startsWith('http') ? raw : `/${raw.replace(/^\/+/, '')}`;
    }
    return `/assets/images/${raw}.jpg`;
  })();

  const authorInitials = frontMatter.author?.name
    ? frontMatter.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : 'SG';

  return (
    <div className="bg-[#FAF9F6] text-[#1E232B] rounded-sm border border-[#99BFF9]/30 shadow-sm overflow-hidden font-sans">
      {/* 1. Breadcrumb Bar */}
      <div className="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3 px-6 flex items-center justify-between text-xs text-[#5A6270]">
        <div className="flex items-center space-x-2">
          <span>Home</span>
          <span className="text-[#5A6270]/40">/</span>
          <span>Articles</span>
          <span className="text-[#5A6270]/40">/</span>
          <span className="text-[#2A548E] font-medium">{category}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#5A6270]">
          <Share2 className="w-3.5 h-3.5" />
          <span>Share Essay</span>
        </div>
      </div>

      {/* 2. Article Header */}
      <header className="pt-10 pb-8 px-6 sm:px-12 border-b border-[#99BFF9]/25 bg-white">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A6270]">
            <span className="text-[#154D3B] font-semibold uppercase tracking-wider">{category}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#2A548E]" />
              {readTime}
            </span>
            {dateDisplay && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#2A548E]" />
                  {dateDisplay}
                </span>
              </>
            )}
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-[1.18] text-balance">
            {frontMatter.title || 'Untitled Article'}
          </h1>

          {frontMatter.deck && (
            <p className="text-base sm:text-lg text-[#5A6270] leading-relaxed font-serif italic">
              "{frontMatter.deck}"
            </p>
          )}

          {frontMatter.author && (
            <div className="pt-4 flex items-center gap-3 text-xs text-[#5A6270] border-t border-[#99BFF9]/20">
              <div className="w-9 h-9 rounded-full bg-[#154D3B] text-white flex items-center justify-center font-serif text-sm font-semibold shrink-0">
                {authorInitials}
              </div>
              <div>
                <div className="font-semibold text-[#1E232B]">{frontMatter.author.name}</div>
                <div className="text-[11px] text-[#5A6270]">{frontMatter.author.role}</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 3. Hero Visual */}
      <div className="max-w-4xl mx-auto px-6 sm:px-12 my-8">
        <div className="relative overflow-hidden bg-stone-100 border border-[#99BFF9]/30 rounded-xs aspect-[16/9] shadow-xs">
          <img
            src={heroImageSrc}
            alt={frontMatter.heroImageAlt || frontMatter.title || 'Hero preview'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
            }}
          />
        </div>
        {frontMatter.heroImageCaption && (
          <p className="mt-2.5 text-xs text-[#5A6270] italic text-center font-serif">
            {frontMatter.heroImageCaption}
          </p>
        )}
      </div>

      {/* 4. Article Reading Column */}
      <div className="max-w-3xl mx-auto px-6 sm:px-12 pb-12">
        <div className="space-y-6 text-base sm:text-[17px] text-[#1E232B] leading-[1.8]">
          {/* Intro Quote Callout */}
          {frontMatter.introQuote?.quote && (
            <div className="bg-[#EEF5FF] border-l-4 border-[#2A548E] p-6 my-6 rounded-r-xs">
              <blockquote className="font-serif-display text-lg sm:text-xl text-[#1B365D] italic leading-relaxed">
                "{frontMatter.introQuote.quote}"
              </blockquote>
              <div className="text-xs text-[#2A548E] font-semibold text-right mt-3">
                — {frontMatter.introQuote.author}
                {frontMatter.introQuote.source ? `, ${frontMatter.introQuote.source}` : ''}
              </div>
            </div>
          )}

          {/* Rendered Body HTML */}
          <div
            className="prose prose-stone max-w-none prose-headings:font-serif-display prose-headings:font-normal prose-h2:text-2xl prose-h2:text-[#1E232B] prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-[#2A548E] prose-p:text-[#1E232B] prose-p:leading-relaxed prose-a:text-[#2A548E] prose-a:underline prose-blockquote:border-l-2 prose-blockquote:border-[#2A548E] prose-blockquote:pl-4 prose-blockquote:italic prose-img:rounded-xs prose-img:shadow-xs"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="text-stone-400 italic">No content written yet...</p>' }}
          />
        </div>

        {/* 5. Primary Research & Scholarly Citations */}
        {Array.isArray(frontMatter.sources) && frontMatter.sources.length > 0 && (
          <section className="mt-12 pt-8 border-t border-[#99BFF9]/30 space-y-4">
            <div className="text-xs uppercase tracking-widest text-[#2A548E] font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Primary Research &amp; Scholarly Citations</span>
            </div>
            <div className="space-y-3">
              {frontMatter.sources.map((src, idx) => (
                <div key={idx} className="p-4 bg-white border border-[#99BFF9]/25 rounded-xs space-y-1.5 text-xs shadow-2xs">
                  <div className="font-serif text-sm font-medium text-[#1E232B]">
                    {src.url ? (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#2A548E] hover:underline flex items-center gap-1">
                        {src.title}
                        <ExternalLink className="w-3 h-3 inline text-[#5A6270]" />
                      </a>
                    ) : (
                      src.title
                    )}
                  </div>
                  <div className="text-[#5A6270]">
                    {src.author}
                    {src.publication && <em className="ml-1.5">{src.publication}</em>}
                    {src.year && <span className="ml-1">({src.year})</span>}
                  </div>
                  {src.annotation && (
                    <p className="text-[#5A6270] italic pt-1 border-t border-stone-100 mt-1">
                      {src.annotation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Companion Gift Guide Callout */}
        {frontMatter.relatedGuideSlug && (
          <div className="mt-10 p-6 bg-[#E8F8F1] border border-[#226E56]/30 rounded-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-[#226E56] font-semibold">
                Companion Gift Guide
              </span>
              <h4 className="font-serif-display text-lg text-[#154D3B]">
                Ready to put theory into practice? Explore tested recommendations.
              </h4>
            </div>
            <div className="px-5 py-2.5 bg-[#226E56] text-white text-xs font-semibold uppercase tracking-wider rounded-xs shrink-0 flex items-center gap-1.5 shadow-2xs">
              Explore {category} Gifts
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

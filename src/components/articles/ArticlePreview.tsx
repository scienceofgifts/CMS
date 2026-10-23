import React, { useMemo } from 'react';
import {
  Clock,
  Calendar,
  Share2,
  BookOpen,
  ArrowRight,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { ArticleFrontMatter } from '../../types/articles';
import { formatIsoToHuman } from '../../utils/date';
import { processCitationsForPreview } from '../../utils/citations';

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

  // Process citations for preview
  const { processedHtml, citedNotes, uncitedSources, brokenCitations } = useMemo(() => {
    return processCitationsForPreview(bodyHtml || '', frontMatter.sources || []);
  }, [bodyHtml, frontMatter.sources]);

  // Smooth jump to anchor and highlight target
  const handleJumpToAnchor = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-amber-100', 'ring-2', 'ring-amber-300', 'transition-all', 'duration-500');
      setTimeout(() => {
        el.classList.remove('bg-amber-100', 'ring-2', 'ring-amber-300');
      }, 2000);
    }
  };

  // Delegated click handler on the body for inline citation links
  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[data-cite-target]') as HTMLAnchorElement | null;
    if (link) {
      const targetId = link.getAttribute('data-cite-target');
      if (targetId) {
        e.preventDefault();
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('bg-amber-100', 'ring-2', 'ring-amber-300', 'transition-all', 'duration-500');
          setTimeout(() => {
            el.classList.remove('bg-amber-100', 'ring-2', 'ring-amber-300');
          }, 2000);
        }
      }
    }
  };

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

          {/* Rendered Body HTML with Delegated Citation Click Handling */}
          <div
            onClick={handleBodyClick}
            className="prose prose-stone max-w-none prose-headings:font-serif-display prose-headings:font-normal prose-h2:text-2xl prose-h2:text-[#1E232B] prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:text-[#2A548E] prose-p:text-[#1E232B] prose-p:leading-relaxed prose-a:text-[#2A548E] prose-a:underline prose-blockquote:border-l-2 prose-blockquote:border-[#2A548E] prose-blockquote:pl-4 prose-blockquote:italic prose-img:rounded-xs prose-img:shadow-xs"
            dangerouslySetInnerHTML={{ __html: processedHtml || '<p class="text-stone-400 italic">No content written yet...</p>' }}
          />
        </div>

        {/* 5. Primary Research & Scholarly Citations Section */}
        {((Array.isArray(frontMatter.sources) && frontMatter.sources.length > 0) || brokenCitations.length > 0) && (
          <section className="mt-12 pt-8 border-t border-[#99BFF9]/30 space-y-4">
            <div className="text-xs uppercase tracking-widest text-[#2A548E] font-semibold flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Primary Research &amp; Scholarly Citations</span>
              </div>
              {citedNotes.length > 0 && (
                <span className="text-[11px] font-mono text-[#5A6270] lowercase">
                  {citedNotes.length} cited in essay
                </span>
              )}
            </div>

            {/* Broken Citations Warning Banner */}
            {brokenCitations.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xs text-xs text-rose-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-semibold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Unresolved Inline Citations</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  The article text cites source keys that are not defined in the article's bibliography:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {brokenCitations.map(key => (
                    <span key={key} className="px-2 py-0.5 bg-white border border-rose-300 rounded font-mono text-[11px] text-rose-800 font-semibold">
                      [[@cite:{key}]]
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-rose-600 italic">
                  Switch to the Citations tab to add these sources or fix the citation keys.
                </p>
              </div>
            )}

            {/* Numbered References (when citations are cited inline) */}
            {citedNotes.length > 0 ? (
              <div className="space-y-3">
                {citedNotes.map((note) => (
                  <div
                    key={note.noteNumber}
                    id={`cite-note-${note.noteNumber}`}
                    className="p-4 bg-white border border-[#99BFF9]/25 rounded-xs text-xs shadow-2xs scroll-mt-24 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-serif text-sm font-medium text-[#1E232B] break-words">
                          {note.source.url ? (
                            <a
                              href={note.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#2A548E] hover:underline inline-flex items-center gap-1 break-words"
                            >
                              <span>{note.source.title || 'Untitled Source'}</span>
                              <ExternalLink className="w-3 h-3 inline text-[#5A6270] shrink-0" />
                            </a>
                          ) : (
                            note.source.title || 'Untitled Source'
                          )}
                        </div>
                        <div className="text-[#5A6270]">
                          {note.source.author}
                          {note.source.publication && <em className="ml-1.5">{note.source.publication}</em>}
                          {note.source.year && <span className="ml-1">({note.source.year})</span>}
                        </div>
                        {note.source.annotation && (
                          <p className="text-[#5A6270] italic pt-1 border-t border-stone-100 mt-1">
                            {note.source.annotation}
                          </p>
                        )}
                        <div className="text-[10px] font-mono text-[#5A6270]/70 pt-0.5">
                          Key: <code className="bg-stone-100 px-1 py-0.2 rounded text-[#2A548E]">[[@cite:{note.sourceId}]]</code>
                        </div>
                      </div>

                      {/* Backlinks */}
                      <div className="shrink-0 flex items-center gap-1 text-[#2A548E] select-none text-xs">
                        <span className="text-[11px] text-[#5A6270] mr-0.5 hidden sm:inline">Jump:</span>
                        {note.occurrences.length === 1 ? (
                          <a
                            href={`#${note.occurrences[0]}`}
                            onClick={(e) => handleJumpToAnchor(e, note.occurrences[0])}
                            className="px-1.5 py-0.5 bg-[#EEF5FF] hover:bg-[#2A548E] hover:text-white rounded text-xs transition-colors cursor-pointer font-bold"
                            title="Jump back to citation in essay text"
                            aria-label="Backlink to citation"
                          >
                            ↩
                          </a>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-[#5A6270]">↩</span>
                            {note.occurrences.map((anchorId, occIdx) => (
                              <a
                                key={anchorId}
                                href={`#${anchorId}`}
                                onClick={(e) => handleJumpToAnchor(e, anchorId)}
                                className="px-1.5 py-0.5 bg-[#EEF5FF] hover:bg-[#2A548E] hover:text-white rounded text-[11px] font-mono font-medium transition-colors cursor-pointer"
                                title={`Jump back to citation ${occIdx + 1} in essay text`}
                                aria-label={`Backlink to citation occurrence ${occIdx + 1}`}
                              >
                                {occIdx + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Additional uncited sources in bibliography */}
                {uncitedSources.length > 0 && (
                  <div className="pt-4 border-t border-[#99BFF9]/20 space-y-2">
                    <div className="text-[11px] uppercase tracking-wider text-[#5A6270] font-semibold">
                      Additional Bibliography (Not Cited Inline)
                    </div>
                    {uncitedSources.map(({ source, id }) => (
                      <div key={id} className="p-3 bg-white/70 border border-[#99BFF9]/20 rounded-xs space-y-1 text-xs">
                        <div className="font-serif text-sm text-[#1E232B]">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#2A548E] hover:underline inline-flex items-center gap-1"
                            >
                              <span>{source.title || 'Untitled Source'}</span>
                              <ExternalLink className="w-3 h-3 inline text-[#5A6270]" />
                            </a>
                          ) : (
                            source.title || 'Untitled Source'
                          )}
                        </div>
                        <div className="text-[#5A6270] text-[11px]">
                          {source.author}
                          {source.publication && <em className="ml-1.5">{source.publication}</em>}
                          {source.year && <span className="ml-1">({source.year})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Unnumbered legacy bibliography (when no inline citations are used) */
              <div className="space-y-3">
                {frontMatter.sources?.map((src, idx) => (
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
            )}
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

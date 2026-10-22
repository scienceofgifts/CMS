import React from 'react';
import { GiftGuideFrontMatter } from '../../types/guide';
import { formatIsoToHuman } from '../../utils/date';
import {
  ExternalLink,
  Sparkles,
  Bookmark,
  Calendar,
  Clock,
  Share2,
  ChevronRight,
  Package,
  AlertTriangle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

interface GuidePreviewProps {
  frontMatter: GiftGuideFrontMatter;
  bodyHtml: string;
}

export const GuidePreview: React.FC<GuidePreviewProps> = ({ frontMatter, bodyHtml }) => {
  const fm = frontMatter;
  const authorInitial = (fm.author?.name || 'S').charAt(0);
  const displayDate = formatIsoToHuman(fm.lastModifiedDate || fm.updatedDate || fm.publishedDate, 'Recently Updated');

  return (
    <div className="bg-white min-h-screen text-[#1E232B] font-sans antialiased border border-[#99BFF9]/30">
      {/* 1. BREADCRUMB CONTEXT */}
      <div className="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-2.5 px-4 sm:px-8 text-xs text-[#5A6270] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span>Home</span>
          <ChevronRight className="w-3 h-3 text-[#5A6270]/40" />
          <span>Gift Guides</span>
          <ChevronRight className="w-3 h-3 text-[#5A6270]/40" />
          <span className="text-[#2A548E] font-medium">{fm.category || 'Curated'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#5A6270]">
          <Share2 className="w-3.5 h-3.5" />
          <span>Share Guide</span>
        </div>
      </div>

      {/* 2. HEADER & TITLE DECK */}
      <header className="pt-10 pb-8 border-b border-[#99BFF9]/25 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A6270]">
            <span className="text-[#226E56] font-semibold uppercase tracking-wider">
              {fm.category || 'Curated'} Guide
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fm.readTime || '8 min read'}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Updated {displayDate}
            </span>
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-[#1E232B] font-normal leading-[1.18] text-balance">
            {fm.title || 'Untitled Gift Guide'}
          </h1>

          <p className="text-base sm:text-lg text-[#5A6270] leading-relaxed max-w-3xl">
            {fm.deck || 'Editorial guide summary and introduction.'}
          </p>

          <div className="pt-4 flex items-center gap-3 text-xs text-[#5A6270] border-t border-[#99BFF9]/20">
            <div className="w-8 h-8 rounded-full bg-[#2A548E] text-white flex items-center justify-center font-serif text-sm font-semibold shrink-0">
              {authorInitial}
            </div>
            <div>
              <div className="font-semibold text-[#1E232B]">{fm.author?.name || 'Science of Gifts Staff'}</div>
              <div className="text-[11px] text-[#5A6270]">{fm.author?.role || 'Contributing Editor'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. HERO VISUAL & CAPTION */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 my-8 sm:my-10 space-y-3">
        <div className="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs aspect-[16/9] flex items-center justify-center shadow-xs">
          <div className="text-center space-y-2 p-6">
            <div className="w-12 h-12 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div className="font-serif text-base text-[#1E232B]">
              Hero Image: <code className="font-mono-code text-xs text-[#2A548E]">{fm.heroImageType || fm.image || fm.slug}</code>
            </div>
            <div className="text-xs text-[#5A6270] max-w-md">{fm.heroImageAlt || 'Hero visual representation'}</div>
          </div>
        </div>
        {fm.heroImageCaption && (
          <p className="text-xs text-[#5A6270] italic text-center font-serif">{fm.heroImageCaption}</p>
        )}
      </div>

      {/* 4. MAIN CONTENT & SECTIONS */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 space-y-14 pb-16">
        {/* Intro Quote */}
        {fm.introQuote && fm.introQuote.quote && (
          <div className="bg-[#E8F8F1] border-l-4 border-[#226E56] p-6 space-y-2">
            <blockquote className="font-serif-display text-lg text-[#154D3B] italic leading-relaxed">
              "{fm.introQuote.quote}"
            </blockquote>
            <div className="text-xs text-[#226E56] font-medium text-right">
              {fm.introQuote.author}
              {fm.introQuote.source && (
                <span className="font-normal text-[#154D3B]/80">, {fm.introQuote.source}</span>
              )}
            </div>
          </div>
        )}

        {/* Narrative Essay Body */}
        <section className="space-y-4">
          <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal border-b border-[#99BFF9]/25 pb-2">
            The Anatomy of a Great {fm.category || 'Curated'} Gift
          </h2>
          <div
            className="prose prose-stone max-w-none text-[#1E232B] font-serif text-base sm:text-lg leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: bodyHtml || '<p class="italic text-[#5A6270]">No narrative introduction written yet.</p>' }}
          />
        </section>

        {/* Editor's Pick Box */}
        {fm.editorsPick && (
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#99BFF9]/30 pb-2">
              <div>
                <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">The Standout Choice</span>
                <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">Editor's Pick 2026</h2>
              </div>
              <span className="font-mono-code text-xl font-bold text-[#154D3B]">{fm.editorsPick.price}</span>
            </div>

            <div className="bg-white border-2 border-[#C3F3DF] p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs aspect-[4/3] flex items-center justify-center p-4">
                  <div className="text-center space-y-1 text-[#2A548E]">
                    <Package className="w-8 h-8 mx-auto opacity-70" />
                    <div className="text-[11px] font-mono-code">{fm.editorsPick.id}</div>
                  </div>
                </div>

                <div className="md:col-span-7 space-y-2">
                  <div className="text-xs font-semibold text-[#226E56] uppercase tracking-wider">
                    {fm.editorsPick.badgeLabel || 'Editor s Pick 2026'}
                  </div>
                  <h3 className="font-serif-display text-2xl text-[#1E232B] font-normal leading-snug">
                    {fm.editorsPick.title}
                  </h3>
                  {fm.editorsPick.tagline && (
                    <p className="text-xs sm:text-sm text-[#5A6270] italic">{fm.editorsPick.tagline}</p>
                  )}
                  <div className="pt-2 text-xs text-[#5A6270]">
                    Vendor: <strong className="text-[#1E232B]">{fm.editorsPick.vendor}</strong>
                  </div>
                </div>
              </div>

              {fm.editorsPick.editorialReview && (
                <div className="pt-4 border-t border-stone-100 text-sm text-[#1E232B] leading-relaxed">
                  <p>{fm.editorsPick.editorialReview}</p>
                </div>
              )}

              {fm.editorsPick.whyItMakesAGreatGift && (
                <div className="p-4 bg-[#E8F8F1]/80 border-l-4 border-[#226E56] space-y-1">
                  <strong className="text-xs uppercase tracking-wider text-[#154D3B] block">Why it makes a singular gift:</strong>
                  <p className="text-xs text-[#226E56]">{fm.editorsPick.whyItMakesAGreatGift}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Quick Recommendations Grid */}
        {fm.quickPicks && fm.quickPicks.length > 0 && (
          <section className="space-y-6">
            <div className="border-b border-[#99BFF9]/30 pb-2">
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">Immediate Solutions</span>
              <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">Quick Recommendations</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {fm.quickPicks.map((qp: any, i: number) => (
                <div key={qp.id || i} className="bg-white border border-[#99BFF9]/30 p-4 flex flex-col justify-between space-y-4 shadow-2xs">
                  <div className="space-y-3">
                    <div className="bg-[#FAF9F6] border border-[#99BFF9]/20 aspect-[16/9] flex items-center justify-center text-[#2A548E]">
                      <Package className="w-6 h-6 opacity-70" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-code font-bold text-[#154D3B]">{qp.price}</span>
                        <span className="text-[#5A6270] truncate max-w-[120px]">{qp.vendor}</span>
                      </div>
                      <h4 className="font-serif-display text-base text-[#1E232B] font-medium leading-snug">{qp.title}</h4>
                      {qp.tagline && <p className="text-xs text-[#5A6270] line-clamp-2">{qp.tagline}</p>}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#99BFF9]/20 flex items-center justify-between text-xs font-semibold text-[#2A548E]">
                    <span>View on {qp.vendor || 'Merchant'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Budget / Thematic Sections */}
        {fm.budgetSections && fm.budgetSections.length > 0 && (
          <div className="space-y-12">
            {fm.budgetSections.map((sec: any, sIdx: number) => (
              <section key={sec.id || sIdx} className="space-y-6">
                <div className="border-b border-[#99BFF9]/30 pb-2">
                  <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">{sec.title}</h2>
                  {sec.description && <p className="text-xs sm:text-sm text-[#5A6270] mt-1">{sec.description}</p>}
                </div>

                <div className="space-y-6">
                  {(sec.products || []).map((prod: any, pIdx: number) => (
                    <div key={prod.id || pIdx} className="bg-[#FAF9F6] border border-[#99BFF9]/30 p-6 space-y-4">
                      <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code font-bold text-base text-[#154D3B]">{prod.price}</span>
                          <span className="text-xs uppercase tracking-wider text-[#5A6270]">· {prod.vendor}</span>
                        </div>
                        {prod.badgeLabel && (
                          <span className="text-xs font-semibold text-[#226E56] uppercase tracking-wider bg-[#E8F8F1] px-2.5 py-0.5 rounded-full">
                            {prod.badgeLabel}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        <div className="md:col-span-4 bg-white border border-[#99BFF9]/20 aspect-[4/3] flex items-center justify-center p-3 text-[#2A548E]">
                          <Package className="w-7 h-7 opacity-70" />
                        </div>
                        <div className="md:col-span-8 space-y-2">
                          <h3 className="font-serif-display text-xl text-[#1E232B] font-normal leading-snug">{prod.title}</h3>
                          {prod.tagline && <p className="text-xs text-[#5A6270] italic">{prod.tagline}</p>}
                          {prod.editorialReview && <p className="text-xs sm:text-sm text-[#1E232B] leading-relaxed pt-1">{prod.editorialReview}</p>}
                        </div>
                      </div>

                      {prod.whyItMakesAGreatGift && (
                        <div className="p-3 bg-[#E8F8F1]/80 border-l-4 border-[#226E56] text-xs space-y-0.5">
                          <strong className="text-[11px] uppercase tracking-wider text-[#154D3B] block">Why it makes a singular gift:</strong>
                          <p className="text-[#226E56]">{prod.whyItMakesAGreatGift}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* How to Pick Rulebook */}
        {fm.howToPick && (
          <section className="space-y-4">
            <div className="border-b border-[#99BFF9]/30 pb-2">
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">Curatorial Principles</span>
              <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">
                {fm.howToPick.title || 'How to Pick'}
              </h2>
            </div>
            {fm.howToPick.content && (
              <p className="text-sm text-[#1E232B] leading-relaxed">{fm.howToPick.content}</p>
            )}
            {fm.howToPick.rules && fm.howToPick.rules.length > 0 && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                {fm.howToPick.rules.map((r, i) => (
                  <div key={i} className="p-4 bg-white border border-[#99BFF9]/25 space-y-1">
                    <h4 className="font-serif-display text-sm font-semibold text-[#1E232B]">{r.title}</h4>
                    <p className="text-xs text-[#5A6270] leading-relaxed">{r.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* What to Avoid */}
        {fm.whatToAvoid && (
          <section className="space-y-4">
            <div className="border-b border-[#99BFF9]/30 pb-2">
              <span className="text-xs uppercase tracking-widest text-rose-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>The Pitfalls</span>
              </span>
              <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">
                {fm.whatToAvoid.title || 'What to Avoid'}
              </h2>
            </div>
            {(fm.whatToAvoid.content || fm.whatToAvoid.summary) && (
              <p className="text-sm text-[#1E232B] leading-relaxed">
                {fm.whatToAvoid.content || fm.whatToAvoid.summary}
              </p>
            )}
            {fm.whatToAvoid.items && fm.whatToAvoid.items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fm.whatToAvoid.items.map((itm, i) => (
                  <div key={i} className="p-4 bg-white border border-rose-200 space-y-1">
                    <div className="text-xs font-semibold text-rose-800">
                      ✗ {itm.mistake || itm.title}
                    </div>
                    <p className="text-xs text-[#5A6270] leading-relaxed">{itm.explanation || itm.description}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Related Guides */}
        {fm.relatedGuideSlugs && fm.relatedGuideSlugs.length > 0 && (
          <section className="pt-6 border-t border-[#99BFF9]/30 space-y-4">
            <div className="border-b border-[#99BFF9]/25 pb-2">
              <span className="text-xs uppercase tracking-widest text-[#2A548E] font-semibold">Continue Discovery</span>
              <h2 className="font-serif-display text-2xl text-[#1E232B] font-normal">Related Gift Guides</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fm.relatedGuideSlugs.map((slug) => (
                <div key={slug} className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 space-y-2">
                  <span className="text-[10px] uppercase font-semibold text-[#226E56]">Guide Reference</span>
                  <div className="font-serif text-sm font-medium text-[#1E232B]">{slug}</div>
                  <div className="text-xs text-[#2A548E] flex items-center gap-1 font-medium">
                    <span>Explore guide</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

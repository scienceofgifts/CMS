import React from 'react';
import {
  ArrowRight,
  ShoppingBag,
  ExternalLink,
  Mail,
  Sparkles
} from 'lucide-react';
import { HomepageFrontMatter } from '../../types/homepage';

interface HomepagePreviewProps {
  frontMatter: HomepageFrontMatter;
  featuredGuide?: { title?: string; category?: string; deck?: string; url?: string } | null;
  featuredArticle?: { title?: string; category?: string; deck?: string; url?: string } | null;
}

export const HomepagePreview: React.FC<HomepagePreviewProps> = ({
  frontMatter,
  featuredGuide,
  featuredArticle
}) => {
  const editionBadge = frontMatter.edition_badge || 'The Independent Gift Publication • Autumn 2026 Edition';
  const heroTitle = frontMatter.hero_title || 'Thoughtful gifts, chosen with a little more thought.';
  const heroLead = frontMatter.hero_lead || 'Science of Gifts helps you find singular, enduring objects for specific people, obsessions, milestones, and personalities.';
  const heroImage = frontMatter.hero_image || 'home-hero';
  const heroImageAlt = frontMatter.hero_image_alt || 'Curated still life of archival gifts';
  const heroImageCaption = frontMatter.hero_image_caption || 'Still Life No. 14: Objects of enduring provenance. Photographed in studio.';

  const shopTitle = frontMatter.shop_banner?.title || 'Shop Science of Gifts';
  const shopDeck = frontMatter.shop_banner?.deck || 'History, mythology, and culture-inspired gifts designed for people who genuinely love the subject.';
  const shopUrl = frontMatter.shop_banner?.url || 'https://shop.scienceofgifts.com/';

  const quote = frontMatter.quote || 'A great gift is not an assertion of the giver\'s wealth or cleverness. It is an act of attentive listening translated into physical form.';
  const quoteAuthor = frontMatter.quote_author || 'The Science of Gifts Editorial Charter';

  const newsletterTitle = frontMatter.newsletter?.title || 'One thoughtfully selected object. Every Sunday morning.';
  const newsletterDeck = frontMatter.newsletter?.deck || 'We send a single curated gift recommendation, the short history behind its craft, and practical advice on gift psychology.';
  const newsletterSubscribers = frontMatter.newsletter?.subscribers_count || 'Over 42,000 discerning readers. Free forever. Unsubscribe in one click.';

  return (
    <div className="bg-[#FAF9F6] text-[#1E232B] font-sans rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-[#99BFF9]/30 text-left">
      {/* 1. Hero Section */}
      <section className="p-6 sm:p-8 bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-[11px] uppercase tracking-widest text-[#226E56] font-semibold flex items-center gap-1.5">
              <span>{editionBadge}</span>
            </div>
            <h1 className="font-serif-display text-2xl sm:text-3xl lg:text-4xl text-[#1E232B] font-normal leading-tight">
              {heroTitle}
            </h1>
            <p className="text-sm text-[#5A6270] leading-relaxed">
              {heroLead}
            </p>
            <div className="pt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <span className="px-4 py-2 bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] text-[#1E232B] rounded flex items-center gap-1.5">
                Featured Guide: {featuredGuide?.category || 'History'} Gifts
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              <span className="px-4 py-2 bg-[#FAF9F6] text-[#2A548E] border border-[#99BFF9]/60 rounded">
                Read Essay: Gift Psychology
              </span>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/30 rounded aspect-[4/3] flex items-center justify-center p-4">
              <img
                src={`/assets/images/${heroImage}.webp`}
                alt={heroImageAlt}
                className="w-full h-full object-cover rounded"
                onError={(e: any) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="text-center p-3 bg-slate-100 rounded text-xs text-slate-500 font-mono-code">
                Hero Image Key: [{heroImage}]
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[#5A6270] italic text-right font-serif">
              {heroImageCaption}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Featured Curation Card */}
      <section className="p-6 sm:p-8 bg-[#FAF9F6]">
        <div className="mb-4 pb-2 border-b border-[#99BFF9]/30 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">Curated Recommendations</span>
          <span className="text-xs font-semibold text-[#2A548E] uppercase tracking-wider">Featured Guide</span>
        </div>
        <div className="bg-white border border-[#99BFF9]/30 p-5 rounded space-y-3">
          <div className="text-xs text-[#226E56] font-semibold uppercase tracking-wider">
            {featuredGuide?.category || 'Curated Guide'}
          </div>
          <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
            {featuredGuide?.title || `Guide: ${frontMatter.featured_guide_slug || 'history-gifts'}`}
          </h3>
          <p className="text-xs text-[#5A6270] leading-relaxed line-clamp-2">
            {featuredGuide?.deck || 'Rigorously researched recommendations for thoughtful gift givers.'}
          </p>
        </div>
      </section>

      {/* 3. Official Store Banner */}
      <section className="p-6 sm:p-8 bg-[#132644] text-[#EEF5FF]">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#C3F3DF]/15 text-[#C3F3DF] text-[10px] font-semibold uppercase tracking-widest rounded">
            <ShoppingBag className="w-3 h-3" />
            <span>Official Store</span>
          </div>
          <h2 className="font-serif-display text-2xl text-white font-normal">
            {shopTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#EEF5FF]/90 font-serif leading-relaxed">
            {shopDeck}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 px-5 py-2 bg-[#C3F3DF] text-[#154D3B] text-xs font-bold uppercase tracking-wider rounded">
              <span>Visit Shop</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </section>

      {/* 4. Featured Article */}
      <section className="p-6 sm:p-8 bg-white">
        <div className="mb-4 pb-2 border-b border-[#99BFF9]/30 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-[#154D3B] font-semibold">Long-Form Essay</span>
          <span className="text-xs font-semibold text-[#2A548E] uppercase tracking-wider">Gift Psychology</span>
        </div>
        <div className="bg-[#FAF9F6] border border-[#99BFF9]/30 p-5 rounded space-y-3">
          <div className="text-xs text-[#226E56] font-semibold uppercase tracking-wider">
            {featuredArticle?.category || 'Gift Psychology'}
          </div>
          <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
            {featuredArticle?.title || `Essay: ${frontMatter.featured_article_slug || 'avoid-overthinking-gift-decisions'}`}
          </h3>
          <p className="text-xs text-[#5A6270] leading-relaxed line-clamp-2">
            {featuredArticle?.deck || 'Exploring the intersection of behavioral psychology and material culture.'}
          </p>
        </div>
      </section>

      {/* 5. Editorial Quote Banner */}
      <section className="p-6 sm:p-8 bg-slate-50 text-center space-y-3">
        <blockquote className="font-serif-display text-base sm:text-lg text-[#1E232B] italic leading-relaxed max-w-xl mx-auto">
          &quot;{quote}&quot;
        </blockquote>
        <p className="text-[10px] uppercase tracking-widest text-[#5A6270] font-semibold">
          {quoteAuthor}
        </p>
      </section>

      {/* 6. Sunday Curation Newsletter */}
      <section className="p-6 sm:p-8 bg-[#FAF9F6]">
        <div className="max-w-xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#226E56]">
            <Mail className="w-3.5 h-3.5" />
            <span>The Sunday Curation</span>
          </div>
          <h2 className="font-serif-display text-xl text-[#1E232B] font-normal">
            {newsletterTitle}
          </h2>
          <p className="text-xs text-[#5A6270] leading-relaxed">
            {newsletterDeck}
          </p>
          <div className="text-[10px] text-[#5A6270] font-mono-code pt-1">
            {newsletterSubscribers}
          </div>
        </div>
      </section>
    </div>
  );
};

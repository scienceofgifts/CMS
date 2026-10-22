import React, { useState, useEffect } from 'react';
import { Mail, ExternalLink, Bookmark, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { GlobalComponentKey } from '../../types/globalComponents';

interface GlobalComponentPreviewProps {
  componentKey: GlobalComponentKey;
  data: any;
}

export function GlobalComponentPreview({ componentKey, data }: GlobalComponentPreviewProps) {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (componentKey === 'editors-pick') {
      fetch('/api/products')
        .then(r => r.json())
        .then(d => {
          if (d.success && d.products) setProducts(d.products);
        })
        .catch(() => {});
    }
  }, [componentKey]);

  // NEWSLETTER PREVIEW
  if (componentKey === 'newsletter') {
    return (
      <div className="bg-white border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs">
        <section className="bg-[#FAF9F6] border-y border-[#99BFF9]/30 py-12 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#226E56]">
              <Mail className="w-3.5 h-3.5 text-[#226E56]" />
              <span>{data.badge || 'The Sunday Curation'}</span>
            </div>
            <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal leading-tight">
              {data.headline || 'One thoughtfully selected object. Every Sunday morning.'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6270] leading-relaxed max-w-lg mx-auto">
              {data.descriptionText || data.description || 'We send a single curated gift recommendation, the short history behind its craft, and practical advice on gift psychology.'}
            </p>

            {submitted ? (
              <div className="w-full py-2.5 px-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-semibold rounded text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#226E56]" />
                <span>{data.submitMessage || 'Thank you for subscribing to The Sunday Curation.'}</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
                className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto"
              >
                <input
                  type="email"
                  placeholder={data.emailPlaceholder || 'Your email address'}
                  required
                  className="flex-1 px-3.5 py-2 text-xs bg-white border border-[#99BFF9]/40 outline-none rounded"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] text-[#1E232B] text-xs font-bold uppercase tracking-wider rounded cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {data.buttonText || 'Subscribe'}
                </button>
              </form>
            )}

            <div className="text-[11px] text-[#5A6270]">
              {data.socialProof || 'Over 42,000 discerning readers. Free forever. Unsubscribe in one click.'}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // FOOTER PREVIEW
  if (componentKey === 'footer') {
    return (
      <div className="bg-[#132644] text-[#EEF5FF] border border-[#99BFF9]/20 rounded-xl overflow-hidden shadow-xs p-6 sm:p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#99BFF9]/20">
          {/* Col 1 */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2 text-white font-serif-display text-xl font-bold">
              <img
                src="/assets/logo-white.webp"
                alt="Science of Gifts"
                className="h-8 w-auto object-contain"
                onError={(e: any) => { e.target.style.display = 'none'; }}
              />
              <span>Science of Gifts</span>
            </div>
            <p className="text-xs text-[#EEF5FF]/80 leading-relaxed max-w-xs">
              {data.publicationDescription || 'An independent editorial publication dedicated to the art, psychology, and material culture of thoughtful gift giving.'}
            </p>
            <div className="text-[11px] text-[#99BFF9] font-mono-code">
              {data.publishingLocations || 'Published quarterly   London & New York'}
            </div>
          </div>

          {/* Col 2 */}
          <div className="md:col-span-3 space-y-2.5 text-xs">
            <h3 className="text-[11px] uppercase tracking-widest text-[#C3F3DF] font-semibold">
              {data.guidesColumnTitle || 'Essential Guides'}
            </h3>
            <ul className="space-y-1.5 text-[#EEF5FF]/80">
              {(data.guidesLinks || []).map((l: any, idx: number) => (
                <li key={idx}>
                  <span className="hover:text-[#C3F3DF] cursor-default">{l.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 */}
          <div className="md:col-span-4 space-y-2.5 text-xs">
            <h3 className="text-[11px] uppercase tracking-widest text-[#C3F3DF] font-semibold">
              {data.essaysColumnTitle || 'Editorial Essays'}
            </h3>
            <ul className="space-y-1.5 text-[#EEF5FF]/80">
              {(data.essaysLinks || []).map((l: any, idx: number) => (
                <li key={idx}>
                  <span className="hover:text-[#C3F3DF] cursor-default">{l.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Utility Links Strip */}
        <div className="pt-4 pb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#EEF5FF]/70 border-b border-[#99BFF9]/20">
          {(data.utilityLinks || []).map((l: any, idx: number) => (
            <span
              key={idx}
              className={`flex items-center gap-1 cursor-default ${
                l.isExternal || l.url.startsWith('http')
                  ? 'text-[#99BFF9] font-medium'
                  : l.url === '/gift-finder/' || l.url === '/gift-guides/'
                  ? 'text-[#C3F3DF] font-medium'
                  : ''
              }`}
            >
              <span>{l.label}</span>
              {(l.isExternal || l.url.startsWith('http')) && (
                <ExternalLink className="w-3 h-3 opacity-75" />
              )}
            </span>
          ))}
        </div>

        {/* Footnote & Copyright */}
        <div className="pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[11px] text-[#EEF5FF]/60">
          <p className="max-w-xl leading-relaxed">
            <strong className="text-[#EEF5FF]/90 font-medium">Editorial Integrity:</strong>{' '}
            {data.integrityStatement || 'When you purchase through links on our site, we may earn an affiliate commission...'}
          </p>
          <div className="shrink-0 font-mono-code text-[10px]">
            {data.copyrightText || '2026 Science of Gifts. All rights reserved.'}
          </div>
        </div>
      </div>
    );
  }

  // EDITOR'S PICK PREVIEW
  if (componentKey === 'editors-pick') {
    // Find featured product or fallback
    const featProd = products.find(p => p.id === data.featuredProductId) || products[0] || {
      id: 'cast-iron-book-weight',
      title: 'Monolithic Cast-Iron Book Weight',
      price: '$48.00',
      vendor: 'Archival Press',
      badgeLabel: 'Editor s Pick 2026',
      tagline: 'Precision-molded 1.2kg solid iron page anchor for heavy volumes.',
      editorialReview: 'Tested across 100+ reading sessions. The substantial weight holds oversized art monographs and antique leather volumes wide open without crimping paper fibers.',
      whyItMakesAGreatGift: 'Combines brutalist functional sculpture with immediate daily utility for any serious reader.',
      idealFor: 'Historians, scholars, collectors, and bibliophiles.',
      whatMakesItStandOut: 'Felt-lined base prevents scratch damage to delicate vellum or polished mahogany desks.'
    };

    return (
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs p-6 space-y-6">
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#99BFF9]/30 pb-2">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">
                {data.subBadge || 'The Standout Choice'}
              </span>
              <h2 className="font-serif-display text-2xl text-[#1E232B] font-normal">
                {data.title || 'Editor s Pick 2026'}
              </h2>
            </div>
            <span className="font-mono-code text-lg font-bold text-[#154D3B]">
              {featProd.price || '$48.00'}
            </span>
          </div>

          <div className="bg-white border-2 border-[#C3F3DF] p-6 space-y-5 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5">
                <div className="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/30 rounded aspect-[4/3] flex items-center justify-center text-[#2A548E]">
                  {featProd.imageUrl ? (
                    <img src={featProd.imageUrl} alt={featProd.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="p-4 text-center text-xs font-serif italic text-[#5A6270]">
                      [Product Specimen Image]
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-7 space-y-2">
                <div className="text-[11px] font-semibold text-[#226E56] uppercase tracking-wider">
                  {featProd.badgeLabel || data.badgeLabelDefault || 'Editor s Pick 2026'}
                </div>
                <h3 className="font-serif-display text-xl text-[#1E232B] font-medium leading-snug">
                  {featProd.title}
                </h3>
                {featProd.tagline && (
                  <p className="text-xs text-[#5A6270] italic">{featProd.tagline}</p>
                )}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="px-4 py-2 bg-white text-black border border-black text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1">
                    <span>View on {featProd.vendor || 'Merchant'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                  <span className="px-3 py-2 border border-[#99BFF9]/40 text-[#5A6270] text-xs font-medium inline-flex items-center gap-1 rounded">
                    <Bookmark className="w-3 h-3" />
                    <span>Save</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 text-xs text-[#1E232B] leading-relaxed">
              <p>{featProd.editorialReview || featProd.description}</p>
            </div>

            {featProd.whyItMakesAGreatGift && (
              <div className="p-3.5 bg-[#E8F8F1]/80 border-l-4 border-[#226E56] space-y-0.5 text-xs">
                <strong className="text-[11px] uppercase tracking-wider text-[#154D3B] block">
                  {data.whyGiftHeader || 'Why it makes a singular gift:'}
                </strong>
                <p className="text-[#226E56]">{featProd.whyItMakesAGreatGift}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {featProd.idealFor && (
                <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20">
                  <strong className="text-[#2A548E] block uppercase tracking-wider text-[10px] mb-0.5">
                    {data.idealForHeader || 'Ideal For:'}
                  </strong>
                  <p className="text-[#5A6270]">{featProd.idealFor}</p>
                </div>
              )}
              {featProd.whatMakesItStandOut && (
                <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20">
                  <strong className="text-[#226E56] block uppercase tracking-wider text-[10px] mb-0.5">
                    {data.standoutHeader || 'What Makes It Stand Out:'}
                  </strong>
                  <p className="text-[#5A6270]">{featProd.whatMakesItStandOut}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return null;
}

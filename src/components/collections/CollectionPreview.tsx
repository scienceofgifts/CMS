import React from 'react';
import { CollectionItem } from '../../types/collections';
import { Filter, Users, Tag, Package, Sparkles } from 'lucide-react';

interface CollectionPreviewProps {
  collection: CollectionItem;
  matchingProducts: any[];
}

export const CollectionPreview: React.FC<CollectionPreviewProps> = ({
  collection,
  matchingProducts
}) => {
  const sectionTitle =
    collection.section === 'men'
      ? 'Gifts for Men'
      : collection.section === 'women'
      ? 'Gifts for Women'
      : collection.section === 'gift_guides'
      ? 'Gift Guides Category'
      : collection.section === 'articles'
      ? 'Articles Category'
      : 'Curated Collection';

  return (
    <div className="bg-[#FAF9F6] text-[#1E232B] rounded-sm border border-[#99BFF9]/30 shadow-sm overflow-hidden font-sans">
      {/* Header Banner */}
      <header className="pt-10 pb-8 px-6 sm:px-10 border-b border-[#99BFF9]/25 bg-white">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#226E56] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
            <span>Product Curation • {sectionTitle}</span>
          </div>

          <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-tight">
            {collection.title || 'Untitled Collection'}
          </h1>

          <p className="text-sm sm:text-base text-[#5A6270] max-w-2xl leading-relaxed">
            {collection.description ||
              `Independently field-tested objects and archival instruments curated specifically for ${collection.title}.`}
          </p>

          {/* Recipient tags pill bar */}
          {Array.isArray(collection.recipients) && collection.recipients.length > 0 && (
            <div className="pt-2 flex items-center gap-2 flex-wrap text-xs text-[#5A6270]">
              <span className="font-semibold text-[#154D3B] flex items-center gap-1 uppercase tracking-wider text-[10px]">
                <Users className="w-3 h-3 text-[#226E56]" />
                Target Recipients:
              </span>
              {collection.recipients.map(r => (
                <span key={r} className="px-2.5 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-mono-code border border-[#99BFF9]/30 rounded-xs text-[11px]">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Matching Products Catalog Bar */}
      <div className="p-6 sm:p-10 space-y-6">
        <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2A548E]">
            <Package className="w-4 h-4" />
            <span>Curated Product Catalog ({matchingProducts.length} items)</span>
          </div>
          <span className="text-xs text-[#5A6270] font-mono-code">
            Section: {collection.section}
          </span>
        </div>

        {matchingProducts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#5A6270] bg-white border border-[#99BFF9]/20 rounded-xs space-y-2">
            <Package className="w-8 h-8 text-stone-300 mx-auto" />
            <p>No products currently match recipient rule <code className="font-mono-code text-[#2A548E]">[{collection.recipients?.join(', ') || collection.slug}]</code> in <code className="font-mono-code">products.yml</code>.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchingProducts.slice(0, 12).map((product, idx) => {
              const imageSrc = product.image
                ? product.image.startsWith('/') || product.image.startsWith('http')
                  ? product.image
                  : `/assets/images/${product.image}.jpg`
                : '/assets/images/home-hero.jpg';

              return (
                <div key={product.id || idx} className="bg-white border border-[#99BFF9]/30 rounded-xs p-3 space-y-2 shadow-2xs">
                  <div className="aspect-[4/3] bg-stone-100 rounded-xs overflow-hidden border border-stone-200">
                    <img
                      src={imageSrc}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
                      <span className="text-[#154D3B] uppercase font-semibold text-[10px]">{product.category || 'General'}</span>
                      <span className="font-mono-code font-bold text-[#1E232B]">{product.formattedPrice || `$${product.price}`}</span>
                    </div>
                    <h4 className="font-serif text-sm font-medium text-[#1E232B] line-clamp-1">{product.title}</h4>
                    {product.tagline && (
                      <p className="text-[11px] text-[#5A6270] line-clamp-2 italic font-serif">{product.tagline}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Product } from '../../types/product';
import { ExternalLink, Sparkles, Check, AlertCircle, Bookmark, Compass } from 'lucide-react';
import { getProductImageUrl } from '../../utils/image';

interface ProductCardPreviewProps {
  product: Product;
  viewMode?: 'full' | 'grid';
}

export const ProductCardPreview: React.FC<ProductCardPreviewProps> = ({ product, viewMode = 'full' }) => {
  const isGrid = viewMode === 'grid';

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'editors-pick':
        return 'bg-[#E8F8F1] text-[#154D3B] border-[#226E56]/30';
      case 'quick-pick':
        return 'bg-[#EEF5FF] text-[#2A548E] border-[#99BFF9]/40';
      case 'heirloom':
        return 'bg-[#FFF9EB] text-[#8C6D1F] border-[#E5C158]/40';
      case 'under-30':
      case 'under-50':
      case 'under-100':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      default:
        return 'bg-[#FAF9F6] text-[#5A6270] border-stone-300';
    }
  };

  if (isGrid) {
    return (
      <div className="bg-white border border-[#99BFF9]/30 rounded-none overflow-hidden shadow-xs hover:border-[#2A548E]/40 transition-all flex flex-col justify-between">
        <div className="p-4 space-y-3">
          {/* Top metadata strip */}
          <div className="flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-xs ${categoryColor(product.category)}`}>
              {product.category || 'Curated'}
            </span>
            <span className="font-mono-code font-bold text-sm text-[#1E232B]">
              {product.price || `$${product.priceNumber || 0}`}
            </span>
          </div>

          {/* Visual anchor / thumbnail */}
          <div className="aspect-[4/3] bg-stone-100 border border-[#99BFF9]/20 relative overflow-hidden group">
            <img
              src={getProductImageUrl(product)}
              alt={product.title || product.id}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
              }}
            />
            {product.badgeLabel && (
              <span className="absolute top-2 left-2 bg-[#132644] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shadow-xs z-10">
                {product.badgeLabel}
              </span>
            )}
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-stone-900/70 text-white text-[9px] font-mono-code rounded-2xs z-10 opacity-80">
              {product.imageType || product.image || product.id}
            </span>
          </div>

          {/* Product Title */}
          <div>
            <span className="text-[10px] text-[#5A6270] uppercase tracking-wider block font-medium">
              {product.vendor || 'Independent Maker'}
            </span>
            <h4 className="font-serif-display text-base font-normal text-[#1E232B] line-clamp-2 leading-snug mt-0.5">
              {product.title || 'Untitled Product'}
            </h4>
          </div>

          {/* Editorial Hook */}
          {product.editorialReview && (
            <p className="text-xs text-[#5A6270] line-clamp-2 leading-relaxed">
              {product.editorialReview}
            </p>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-[#99BFF9]/20 flex items-center justify-between text-[11px] text-[#5A6270]">
          <span className="font-mono-code text-[10px] text-[#2A548E]">
            {product.id}
          </span>
          {product.specs && product.specs.length > 0 && (
            <span className="text-[10px] font-medium text-[#226E56]">
              {product.specs.length} specs
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full Editorial Guide Card Preview (Matches _includes/product-card.html exactly)
  return (
    <div className="bg-white border border-[#99BFF9]/40 p-6 sm:p-8 space-y-6 shadow-xs font-sans text-[#1E232B]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#99BFF9]/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border ${categoryColor(product.category)}`}>
              {product.category || 'Curated Recommendation'}
            </span>
            {product.badgeLabel && (
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#132644] text-white">
                {product.badgeLabel}
              </span>
            )}
            <span className="text-xs font-mono-code text-[#5A6270]">
              ID: {product.id}
            </span>
          </div>
          <h3 className="font-serif-display text-2xl sm:text-3xl font-normal text-[#1E232B] leading-tight pt-1">
            {product.title || 'Untitled Recommendation'}
          </h3>
        </div>

        <div className="sm:text-right shrink-0">
          <div className="font-serif-display text-2xl font-bold text-[#154D3B]">
            {product.price || `$${product.priceNumber || 0}`}
          </div>
          <div className="text-xs text-[#5A6270]">
            Tier: {product.priceRange || 'Standard'}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Image + Copy */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Asset Preview */}
        <div className="md:col-span-5 space-y-2">
          <div className="aspect-[4/3] bg-stone-100 border border-[#99BFF9]/30 relative overflow-hidden rounded-xs">
            <img
              src={getProductImageUrl(product)}
              alt={product.title || product.id}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
              }}
            />
            {product.badgeLabel && (
              <span className="absolute top-2 left-2 bg-[#132644] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shadow-xs z-10">
                {product.badgeLabel}
              </span>
            )}
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-stone-900/70 text-white text-[9px] font-mono-code rounded-2xs z-10 opacity-80">
              {product.imageType || product.image || product.id}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5A6270] px-1">
            <span>Vendor: <strong>{product.vendor || 'Independent'}</strong></span>
            {product.vendorUrl && (
              <a
                href={product.vendorUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#2A548E] hover:underline inline-flex items-center gap-1"
              >
                <span>Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Right Column: Editorial Analysis */}
        <div className="md:col-span-7 space-y-4">
          {product.editorialReview && (
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#5A6270] font-semibold block mb-1">
                Editorial Review
              </span>
              <p className="text-sm leading-relaxed text-[#1E232B]">
                {product.editorialReview}
              </p>
            </div>
          )}

          {product.whyItMakesAGreatGift && (
            <div className="p-4 bg-[#FAF9F6] border-l-2 border-[#226E56] text-xs space-y-1">
              <span className="font-semibold uppercase tracking-wider text-[#154D3B] text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#226E56]" />
                Why It Makes a Great Gift
              </span>
              <p className="italic text-[#1E232B] leading-relaxed">
                "{product.whyItMakesAGreatGift}"
              </p>
            </div>
          )}

          {/* Highlights Checklist */}
          <div className="space-y-1.5 text-xs text-[#5A6270] pt-1">
            {product.idealFor && (
              <div>
                <strong className="text-[#1E232B]">Ideal For:</strong> {product.idealFor}
              </div>
            )}
            {product.whatMakesItStandOut && (
              <div>
                <strong className="text-[#1E232B]">Standout Quality:</strong> {product.whatMakesItStandOut}
              </div>
            )}
            {product.thingsToConsider && (
              <div>
                <strong className="text-[#1E232B]">Considerations:</strong> {product.thingsToConsider}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Specifications Table (if any) */}
      {product.specs && product.specs.length > 0 && (
        <div className="pt-4 border-t border-[#99BFF9]/20 space-y-2">
          <span className="text-xs uppercase tracking-widest text-[#5A6270] font-semibold block">
            Archival Specifications
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {product.specs.map((s, idx) => (
              <div key={idx} className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 text-xs">
                <span className="text-[10px] uppercase text-[#5A6270] font-medium block">
                  {s.label}
                </span>
                <span className="font-medium text-[#1E232B] block truncate mt-0.5">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Taxonomy Tags Strip */}
      <div className="pt-3 border-t border-[#99BFF9]/15 flex flex-wrap items-center gap-1.5 text-[11px] text-[#5A6270]">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[#5A6270] mr-1">
          Taxonomies:
        </span>
        {product.interests?.slice(0, 4).map(i => (
          <span key={i} className="px-2 py-0.5 bg-[#FAF9F6] border border-stone-200 text-stone-700">
            #{i}
          </span>
        ))}
        {product.recipients?.slice(0, 3).map(r => (
          <span key={r} className="px-2 py-0.5 bg-[#FAF9F6] border border-stone-200 text-stone-700">
            @{r}
          </span>
        ))}
        {product.tags && product.tags.length > 0 && (
          <span className="text-[10px] text-[#5A6270] italic ml-1">
            +{product.tags.length} tags
          </span>
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Edit3,
  Copy,
  Trash2,
  Tag,
  History,
  CheckCircle2,
  Compass,
  X
} from 'lucide-react';
import { Product, TaxonomyOptions } from '../../types/product';
import { getProductImageUrl } from '../../utils/image';

interface ProductListProps {
  products: Product[];
  taxonomies: TaxonomyOptions;
  onSelectProduct: (product: Product) => void;
  onCreateNew: () => void;
  onDuplicate: (id: string) => void;
  onDeleteRequest: (product: Product) => void;
  onOpenBackups: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  taxonomies,
  onSelectProduct,
  onCreateNew,
  onDuplicate,
  onDeleteRequest,
  onOpenBackups,
  onRefresh,
  isLoading,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedRecipient, setSelectedRecipient] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Check if any filter is applied
  const isFiltered = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      selectedCategory !== 'all' ||
      selectedPriceRange !== 'all' ||
      selectedRecipient !== 'all' ||
      selectedSort !== 'default'
    );
  }, [searchQuery, selectedCategory, selectedPriceRange, selectedRecipient, selectedSort]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedPriceRange('all');
    setSelectedRecipient('all');
    setSelectedSort('default');
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // 1. Text Search across Title, ID, Vendor, Category, Tags, Editorial
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (p.title || '').toLowerCase().includes(q);
          const matchId = (p.id || '').toLowerCase().includes(q);
          const matchVendor = (p.vendor || '').toLowerCase().includes(q);
          const matchCategory = (p.category || '').toLowerCase().includes(q);
          const matchTags = (p.tags || []).some(t => t.toLowerCase().includes(q));
          const matchEditorial = (p.editorialReview || '').toLowerCase().includes(q);
          const matchWhy = (p.whyItMakesAGreatGift || '').toLowerCase().includes(q);

          if (!matchTitle && !matchId && !matchVendor && !matchCategory && !matchTags && !matchEditorial && !matchWhy) {
            return false;
          }
        }

        // 2. Category Filter
        if (selectedCategory !== 'all' && p.category !== selectedCategory) {
          return false;
        }

        // 3. Price Range Filter
        if (selectedPriceRange !== 'all' && p.priceRange !== selectedPriceRange) {
          return false;
        }

        // 4. Recipient Filter
        if (selectedRecipient !== 'all' && !(p.recipients || []).includes(selectedRecipient)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (selectedSort === 'title-asc') {
          return a.title.localeCompare(b.title);
        }
        if (selectedSort === 'title-desc') {
          return b.title.localeCompare(a.title);
        }
        if (selectedSort === 'price-asc') {
          return (a.priceNumber || 0) - (b.priceNumber || 0);
        }
        if (selectedSort === 'price-desc') {
          return (b.priceNumber || 0) - (a.priceNumber || 0);
        }
        if (selectedSort === 'vendor-asc') {
          return (a.vendor || '').localeCompare(b.vendor || '');
        }
        return 0; // default order in products.yml
      });
  }, [products, searchQuery, selectedCategory, selectedPriceRange, selectedRecipient, selectedSort]);

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

  return (
    <div className="space-y-6">
      {/* 1. CATALOG HEADER BAR */}
      <div className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#99BFF9]/20 pb-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
              <span>Phase 2 Master Catalog</span>
            </div>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-tight">
              Products Database
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6270] mt-1">
              Directly editing <code className="font-mono bg-[#EEF5FF] px-1.5 py-0.5 text-[#2A548E]">_data/products.yml</code>.
              All modifications are strictly serialized and protected with snapshot backups.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenBackups}
              className="px-3.5 py-2.5 bg-white border border-[#99BFF9]/40 hover:bg-[#EEF5FF] text-[#2A548E] text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="View catalog snapshot backups"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Backups</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2.5 border border-[#99BFF9]/40 text-[#5A6270] hover:text-[#1E232B] hover:bg-[#EEF5FF] rounded transition-colors cursor-pointer shadow-2xs"
              title="Refresh from products.yml"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onCreateNew}
              className="px-5 py-2.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Product</span>
            </button>
          </div>
        </div>

        {/* Catalog Statistics Strip */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[#5A6270] gap-3 pt-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#1E232B] text-sm font-mono-code">{products.length}</span>
              <span>Total in File</span>
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#2A548E] text-sm font-mono-code">{filteredProducts.length}</span>
              <span>Matching Filter</span>
            </div>
            <span>·</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="font-bold text-[#226E56] text-sm font-mono-code">{taxonomies.categories.length}</span>
              <span>Categories</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5A6270]">View:</span>
            <div className="flex items-center bg-[#FAF9F6] border border-stone-200 p-0.5 rounded">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white shadow-2xs text-[#2A548E]' : 'text-stone-400 hover:text-stone-700'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-white shadow-2xs text-[#2A548E]' : 'text-stone-400 hover:text-stone-700'
                }`}
                title="Table Rows View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white border border-[#99BFF9]/30 p-4 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-[#5A6270] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, ID, vendor, tags..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
            >
              <option value="all">All Categories ({products.length})</option>
              {taxonomies.categories.map((c) => {
                const count = products.filter(p => p.category === c).length;
                return (
                  <option key={c} value={c}>
                    {c} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Price Range Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedPriceRange}
              onChange={(e) => setSelectedPriceRange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
            >
              <option value="all">All Prices</option>
              <option value="under-25">Under $25</option>
              <option value="25-50">$25 to $50</option>
              <option value="50-100">$50 to $100</option>
              <option value="100-plus">$100+</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="sm:col-span-3 flex items-center gap-2">
            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
            >
              <option value="default">Sort: File Order</option>
              <option value="title-asc">Title: A to Z</option>
              <option value="title-desc">Title: Z to A</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="vendor-asc">Vendor: A to Z</option>
            </select>

            {isFiltered && (
              <button
                onClick={resetFilters}
                className="px-2.5 py-2 text-xs text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 border border-stone-200 rounded whitespace-nowrap cursor-pointer"
                title="Reset all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. PRODUCT LISTING: EMPTY OR ITEMS */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-[#99BFF9]/35 p-16 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#EEF5FF] text-[#2A548E] mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-serif-display text-2xl text-[#1E232B] font-medium">
            No products match your criteria
          </h3>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            Try adjusting your search keywords, clear category filters, or add a new product to the catalog.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {isFiltered && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-xs font-semibold text-[#1E232B] rounded transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={onCreateNew}
              className="px-5 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Product</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#99BFF9]/30 hover:border-[#2A548E] transition-all shadow-xs flex flex-col justify-between group"
            >
              <div className="p-5 space-y-3">
                {/* Card Top Strip */}
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-xs ${categoryColor(p.category)}`}>
                    {p.category}
                  </span>
                  <span className="font-mono-code font-bold text-sm text-[#154D3B]">
                    {p.price || `$${p.priceNumber || 0}`}
                  </span>
                </div>

                {/* Thumbnail Preview Anchor */}
                <div
                  onClick={() => onSelectProduct(p)}
                  className="aspect-[16/9] bg-stone-100 border border-[#99BFF9]/20 relative cursor-pointer overflow-hidden group"
                >
                  <img
                    src={getProductImageUrl(p)}
                    alt={p.title || p.id}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
                    }}
                  />
                  {p.badgeLabel && (
                    <span className="absolute top-2 left-2 bg-[#132644] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 shadow-2xs z-10">
                      {p.badgeLabel}
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-stone-900/70 text-white text-[9px] font-mono-code rounded-2xs z-10 opacity-80 group-hover:opacity-100 transition-opacity">
                    {p.imageType || p.image || p.id}
                  </span>
                </div>

                {/* Product Title & Vendor */}
                <div>
                  <span className="text-[11px] text-[#5A6270] uppercase tracking-wider block font-medium truncate">
                    {p.vendor || 'Independent Maker'}
                  </span>
                  <h3
                    onClick={() => onSelectProduct(p)}
                    className="font-serif-display text-lg font-medium text-[#1E232B] line-clamp-2 leading-snug cursor-pointer group-hover:text-[#2A548E] transition-colors mt-0.5"
                  >
                    {p.title}
                  </h3>
                </div>

                {/* ID & Specs indicator */}
                <div className="flex items-center justify-between text-[11px] text-[#5A6270] font-mono-code">
                  <span className="truncate max-w-[180px] bg-stone-50 px-1.5 py-0.5 border border-stone-200">
                    {p.id}
                  </span>
                  {p.specs && p.specs.length > 0 && (
                    <span className="text-[#226E56] font-sans font-medium text-[10px]">
                      {p.specs.length} specs
                    </span>
                  )}
                </div>

                {/* Editorial quote snippet */}
                {p.editorialReview && (
                  <p className="text-xs text-[#5A6270] line-clamp-2 leading-relaxed italic border-t border-stone-100 pt-2">
                    "{p.editorialReview}"
                  </p>
                )}
              </div>

              {/* Action Buttons Strip */}
              <div className="px-4 py-3 bg-[#FAF9F6] border-t border-[#99BFF9]/20 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => onSelectProduct(p)}
                  className="font-semibold text-[#2A548E] hover:text-[#1B365D] flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Product</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDuplicate(p.id)}
                    title="Clone / Duplicate this product"
                    className="p-1.5 text-[#5A6270] hover:text-[#2A548E] hover:bg-white rounded transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRequest(p)}
                    title="Delete product"
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-white rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-[#99BFF9]/30 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] border-b border-[#99BFF9]/20 text-[#5A6270] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product / Title</th>
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Specs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-[#EEF5FF]/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getProductImageUrl(p)}
                          alt={p.title || p.id}
                          className="w-10 h-10 object-cover border border-[#99BFF9]/30 rounded-2xs bg-stone-100 shrink-0 cursor-pointer"
                          onClick={() => onSelectProduct(p)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
                          }}
                        />
                        <div>
                          <div className="font-serif-display text-sm font-medium text-[#1E232B] group-hover:text-[#2A548E] cursor-pointer"
                               onClick={() => onSelectProduct(p)}>
                            {p.title}
                          </div>
                          {p.badgeLabel && (
                            <span className="inline-block mt-0.5 text-[9px] bg-[#132644] text-white px-1.5 py-0.2 uppercase font-bold tracking-wider">
                              {p.badgeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono-code text-[11px] text-[#2A548E]">
                      {p.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded-xs ${categoryColor(p.category)}`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-code font-bold text-[#154D3B]">
                      {p.price || `$${p.priceNumber}`}
                    </td>
                    <td className="py-3 px-4 text-[#5A6270] truncate max-w-[140px]">
                      {p.vendor}
                    </td>
                    <td className="py-3 px-4 text-[#5A6270]">
                      {p.specs?.length ? (
                        <span className="text-[#226E56] font-medium">{p.specs.length}</span>
                      ) : (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectProduct(p)}
                          className="p-1.5 text-[#2A548E] hover:bg-[#EEF5FF] rounded transition-colors cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicate(p.id)}
                          className="p-1.5 text-[#5A6270] hover:text-[#2A548E] hover:bg-stone-100 rounded transition-colors cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRequest(p)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

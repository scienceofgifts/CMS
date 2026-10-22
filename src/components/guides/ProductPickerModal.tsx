import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Package, Check, Sparkles, Filter } from 'lucide-react';
import { Product } from '../../types/product';
import { useModalEscape } from '../../hooks/useModalEscape';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  selectedProductId?: string;
  title?: string;
  description?: string;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  selectedProductId,
  title = 'Select Product from Catalog',
  description = 'Choose a product from _data/products.yml to reference in this guide section.'
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        } else {
          setError(data.error || 'Failed to load products');
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching products');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [isOpen]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.badgeLabel && p.badgeLabel.toLowerCase().includes(q));

      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [products, search, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E232B]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-[#99BFF9]/40 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#99BFF9]/25 flex items-start justify-between bg-[#FAF9F6] shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2A548E] uppercase tracking-wider">
              <Package className="w-4 h-4" />
              <span>Catalog Integration</span>
            </div>
            <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">{title}</h3>
            <p className="text-xs text-[#5A6270]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search & Category filter */}
        <div className="p-4 border-b border-[#99BFF9]/20 bg-white flex flex-wrap items-center gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, vendor, or product ID..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 text-[#1E232B] focus:outline-none focus:border-[#2A548E]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#5A6270]" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs py-2 px-3 bg-[#FAF9F6] border border-[#99BFF9]/30 text-[#1E232B] focus:outline-none focus:border-[#2A548E] cursor-pointer"
            >
              <option value="all">All Categories ({products.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAF9F6]">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#5A6270] space-y-2">
              <div className="animate-spin w-6 h-6 border-2 border-[#2A548E] border-t-transparent rounded-full mx-auto" />
              <p>Loading catalog from _data/products.yml...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-rose-700 bg-rose-50 border border-rose-200">
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#5A6270] bg-white border border-[#99BFF9]/20 space-y-2">
              <Package className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-medium text-[#1E232B]">No matching products found</p>
              <p>Try searching for a different keyword or resetting the category filter.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isSelected = p.id === selectedProductId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className={`p-3.5 bg-white border transition-all cursor-pointer flex items-center justify-between gap-4 group hover:border-[#2A548E] hover:shadow-xs ${
                    isSelected ? 'border-[#2A548E] bg-[#EEF5FF]/40 ring-1 ring-[#2A548E]' : 'border-[#99BFF9]/25'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Thumbnail placeholder */}
                    <div className="w-14 h-14 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs flex items-center justify-center shrink-0 text-[#2A548E]">
                      <Package className="w-6 h-6 opacity-70" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code font-bold text-xs text-[#154D3B]">{p.price}</span>
                        <span className="text-[11px] text-[#5A6270]">· {p.vendor}</span>
                        {p.badgeLabel && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#226E56] bg-[#E8F8F1] px-1.5 py-0.2 rounded">
                            {p.badgeLabel}
                          </span>
                        )}
                      </div>
                      <h4 className="font-serif text-sm font-semibold text-[#1E232B] truncate group-hover:text-[#2A548E] transition-colors">
                        {p.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#5A6270] font-mono-code">
                        <span>ID: {p.id}</span>
                        <span>· Category: {p.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <span className="px-3 py-1.5 bg-[#226E56] text-white text-xs font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Selected
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 bg-[#FAF9F6] text-[#2A548E] border border-[#99BFF9]/40 text-xs font-medium group-hover:bg-[#2A548E] group-hover:text-white transition-colors">
                        Choose Product
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#99BFF9]/20 bg-[#FAF9F6] flex items-center justify-between text-xs text-[#5A6270] shrink-0">
          <span>{filteredProducts.length} products available</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-stone-200 text-[#5A6270] hover:text-[#1E232B] transition-colors cursor-pointer text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

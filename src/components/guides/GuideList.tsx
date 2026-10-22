import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Compass,
  FileText,
  Clock,
  Calendar,
  Package,
  History,
  Trash2,
  Edit3,
  ExternalLink,
  Filter,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { GuideSummary } from '../../types/guide';
import { formatIsoToHuman } from '../../utils/date';

interface GuideListProps {
  guides: GuideSummary[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectGuide: (slug: string) => void;
  onCreateGuide: () => void;
  onDeleteGuide: (guide: GuideSummary) => void;
  onOpenBackups: () => void;
}

export const GuideList: React.FC<GuideListProps> = ({
  guides,
  loading,
  error,
  onRetry,
  onSelectGuide,
  onCreateGuide,
  onDeleteGuide,
  onOpenBackups
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    guides.forEach(g => {
      if (g.category) set.add(g.category);
    });
    return Array.from(set).sort();
  }, [guides]);

  const filteredGuides = useMemo(() => {
    return guides.filter(g => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        g.deck.toLowerCase().includes(q) ||
        g.authorName.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'all' || g.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [guides, search, selectedCategory]);

  const totalCuratedProducts = useMemo(() => {
    return guides.reduce((acc, g) => acc + g.productCount, 0);
  }, [guides]);

  const totalWords = useMemo(() => {
    return guides.reduce((acc, g) => acc + g.wordCount, 0);
  }, [guides]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#99BFF9]/30">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">
              Gift Guides
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono-code bg-[#EEF5FF] text-[#2A548E] font-medium border border-[#99BFF9]/30">
              {guides.length} Published
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5A6270] mt-1">
            Curatorial essays, product roundups, and curatorial rulebooks in <code className="font-mono text-[11px] bg-stone-100 px-1">_guides/</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBackups}
            className="px-3.5 py-2 text-xs font-medium text-[#5A6270] hover:text-[#1E232B] hover:bg-white bg-[#FAF9F6] border border-[#99BFF9]/30 transition-colors cursor-pointer flex items-center gap-1.5"
            title="View snapshot backups in editor-backups/guides/"
          >
            <History className="w-3.5 h-3.5 text-[#2A548E]" />
            <span>Snapshots</span>
          </button>

          <button
            type="button"
            onClick={onCreateGuide}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#2A548E] hover:bg-[#1E3E6B] text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Gift Guide</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-2xs space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5A6270]">Total Guides</div>
          <div className="font-serif text-2xl text-[#1E232B] font-normal">{guides.length}</div>
          <div className="text-[11px] text-[#5A6270]">Active in static build</div>
        </div>

        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-2xs space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5A6270]">Curated Product References</div>
          <div className="font-serif text-2xl text-[#154D3B] font-normal">{totalCuratedProducts}</div>
          <div className="text-[11px] text-[#5A6270]">Linked across sections</div>
        </div>

        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-2xs space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#5A6270]">Total Written Prose</div>
          <div className="font-serif text-2xl text-[#2A548E] font-normal">{totalWords}</div>
          <div className="text-[11px] text-[#5A6270]">Words of editorial content</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white border border-[#99BFF9]/25 p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guides by title, category, author, or slug..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 text-[#1E232B] focus:outline-none focus:border-[#2A548E]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[#5A6270] mr-1">Category:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 text-xs transition-colors cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-[#2A548E] text-white border-[#2A548E] font-medium'
                : 'bg-[#FAF9F6] text-[#5A6270] border-[#99BFF9]/30 hover:border-[#2A548E]'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              className={`px-2.5 py-1 text-xs transition-colors cursor-pointer border ${
                selectedCategory === c
                  ? 'bg-[#2A548E] text-white border-[#2A548E] font-medium'
                  : 'bg-[#FAF9F6] text-[#5A6270] border-[#99BFF9]/30 hover:border-[#2A548E]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Guide Cards Grid */}
      {loading ? (
        <div className="p-16 text-center space-y-3 bg-white border border-[#99BFF9]/30">
          <div className="animate-spin w-8 h-8 border-3 border-[#2A548E] border-t-transparent rounded-full mx-auto" />
          <p className="font-serif text-base text-[#1E232B]">Reading Gift Guides...</p>
        </div>
      ) : error ? (
        <div className="p-16 text-center bg-white border border-rose-200 space-y-3 shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="font-serif-display text-xl text-[#1E232B]">Failed to Load Gift Guides</h3>
          <p className="text-xs text-rose-600 max-w-sm mx-auto">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 text-xs font-semibold bg-[#2A548E] text-white hover:bg-[#1E3E6B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : filteredGuides.length === 0 ? (
        <div className="p-16 text-center bg-white border border-[#99BFF9]/30 space-y-3">
          <Compass className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif-display text-xl text-[#1E232B]">No Gift Guides Found</h3>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            {search ? 'Try clearing your search terms.' : 'Create your first Gift Guide using the structured editorial editor.'}
          </p>
          <button
            type="button"
            onClick={onCreateGuide}
            className="px-4 py-2 text-xs font-semibold bg-[#2A548E] text-white hover:bg-[#1E3E6B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Gift Guide</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredGuides.map((guide) => (
            <div
              key={guide.slug}
              className="bg-white border border-[#99BFF9]/30 hover:border-[#2A548E] transition-all flex flex-col justify-between p-6 shadow-2xs group"
            >
              <div className="space-y-4">
                {/* Meta Badge Bar */}
                <div className="flex items-center justify-between text-xs text-[#5A6270]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#226E56] font-semibold uppercase tracking-wider text-[11px]">
                      {guide.category} Guide
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {guide.readTime}
                    </span>
                  </div>
                  <span className="font-mono-code text-[11px] text-[#2A548E] bg-[#EEF5FF] px-2 py-0.5 rounded">
                    {guide.slug}
                  </span>
                </div>

                {/* Title & Deck */}
                <div className="space-y-2">
                  <h3
                    onClick={() => onSelectGuide(guide.slug)}
                    className="font-serif-display text-2xl text-[#1E232B] font-normal leading-snug hover:text-[#2A548E] transition-colors cursor-pointer"
                  >
                    {guide.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5A6270] leading-relaxed line-clamp-3">
                    {guide.deck}
                  </p>
                </div>

                {/* Author & Metrics */}
                <div className="pt-3 border-t border-[#99BFF9]/20 flex flex-wrap items-center justify-between gap-3 text-xs text-[#5A6270]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#2A548E] text-white flex items-center justify-center font-serif text-xs font-semibold">
                      {guide.authorName.charAt(0)}
                    </div>
                    <span className="font-medium text-[#1E232B]">{guide.authorName}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono-code text-[11px]">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-[#226E56]" />
                      <span>{guide.productCount} items</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#2A548E]" />
                      <span>{guide.wordCount} words</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-[#99BFF9]/20 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#5A6270] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatIsoToHuman(guide.lastModifiedDate || guide.publishedDate, 'Updated')}</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteGuide(guide)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Guide with snapshot backup"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectGuide(guide.slug)}
                    className="px-4 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white transition-all text-xs font-semibold cursor-pointer flex items-center gap-1.5 border border-[#99BFF9]/30"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Open in Editor</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  Users,
  Package,
  Sparkles,
  Layers
} from 'lucide-react';
import { CollectionCalculatedItem } from '../../types/collections';
import { CollectionEditor } from './CollectionEditor';
import { useModalEscape } from '../../hooks/useModalEscape';

export const CollectionManager: React.FC = () => {
  const [flatItems, setFlatItems] = useState<CollectionCalculatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Controls
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [sort, setSort] = useState<'title_asc' | 'title_desc' | 'count_desc' | 'section'>('section');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Active Editor state
  const [activeItem, setActiveItem] = useState<{ section: string; slug: string } | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState<CollectionCalculatedItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useModalEscape(deleteTarget !== null, () => setDeleteTarget(null));

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      if (data.success) {
        setFlatItems(data.flatItems || []);
      } else {
        setError(data.error || 'Failed to load collections.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to collections API.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/collections/${deleteTarget.section}/${deleteTarget.slug}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeleteSuccess(`Collection "${deleteTarget.title}" removed. Snapshot backup created in editor-backups/collections/.`);
        setDeleteTarget(null);
        loadCollections();
        setTimeout(() => setDeleteSuccess(null), 3500);
      } else {
        setError(data.error || 'Delete failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during collection deletion.');
    } finally {
      setDeleting(false);
    }
  };

  // Section badge format
  const formatSectionLabel = (sec: string) => {
    if (sec === 'men') return 'Gifts for Men';
    if (sec === 'women') return 'Gifts for Women';
    if (sec === 'gift_guides') return 'Gift Guides';
    if (sec === 'articles') return 'Articles';
    return sec;
  };

  // Filter Logic
  let filtered = flatItems.filter(item => {
    const matchesSection = selectedSection === 'all' || item.section === selectedSection;
    const s = search.toLowerCase().trim();
    if (!s) return matchesSection;

    const matchesSearch =
      item.title.toLowerCase().includes(s) ||
      item.slug.toLowerCase().includes(s) ||
      item.section.toLowerCase().includes(s) ||
      (item.description && item.description.toLowerCase().includes(s)) ||
      (Array.isArray(item.recipients) && item.recipients.some(r => r.toLowerCase().includes(s)));

    return matchesSection && matchesSearch;
  });

  // Sort Logic
  filtered.sort((a, b) => {
    if (sort === 'title_asc') {
      return a.title.localeCompare(b.title);
    } else if (sort === 'title_desc') {
      return b.title.localeCompare(a.title);
    } else if (sort === 'count_desc') {
      return b.matchingProductCount - a.matchingProductCount;
    }
    // Default section then title
    if (a.section !== b.section) {
      return a.section.localeCompare(b.section);
    }
    return a.title.localeCompare(b.title);
  });

  // Editor View Mode
  if (activeItem !== null || isCreating) {
    return (
      <CollectionEditor
        initialSection={activeItem ? activeItem.section : 'men'}
        initialSlug={activeItem ? activeItem.slug : null}
        onBack={() => {
          setActiveItem(null);
          setIsCreating(false);
          loadCollections();
        }}
        onSavedSuccess={(sec, slg) => {
          setActiveItem({ section: sec, slug: slg });
          setIsCreating(false);
          loadCollections();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border border-[#99BFF9]/35 rounded-xs shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-[#154D3B] font-semibold font-mono-code">
              Phase 5 Module
            </span>
            <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 text-[10px] font-semibold rounded-xs">
              Source of Truth: _data/collections.yml
            </span>
          </div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal mt-1">
            Collections &amp; Taxonomy Manager
          </h1>
          <p className="text-xs text-[#5A6270] max-w-xl mt-1 leading-relaxed">
            Manage recipient categories, gift guide topics, and taxonomy filters. Edits write directly to <code className="font-mono-code text-[#2A548E]">_data/collections.yml</code> with 14-step atomic writes and snapshot backups.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadCollections}
            className="p-2 text-[#5A6270] hover:text-[#2A548E] hover:bg-[#EEF5FF] border border-[#99BFF9]/30 rounded-xs transition-colors cursor-pointer"
            title="Refresh Collections List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setActiveItem(null);
              setIsCreating(true);
            }}
            className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Collection</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK NOTIFICATIONS */}
      {deleteSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccess}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION TABS & CONTROLS TOOLBAR */}
      <div className="p-4 bg-white border border-[#99BFF9]/35 rounded-xs space-y-4 shadow-xs">
        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#99BFF9]/20 text-xs font-semibold">
          <button
            onClick={() => setSelectedSection('all')}
            className={`px-3.5 py-1.5 rounded-xs transition-colors cursor-pointer ${
              selectedSection === 'all'
                ? 'bg-[#2A548E] text-white'
                : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
            }`}
          >
            All Collections ({flatItems.length})
          </button>
          <button
            onClick={() => setSelectedSection('men')}
            className={`px-3.5 py-1.5 rounded-xs transition-colors cursor-pointer ${
              selectedSection === 'men'
                ? 'bg-[#2A548E] text-white'
                : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
            }`}
          >
            Gifts for Men ({flatItems.filter(i => i.section === 'men').length})
          </button>
          <button
            onClick={() => setSelectedSection('women')}
            className={`px-3.5 py-1.5 rounded-xs transition-colors cursor-pointer ${
              selectedSection === 'women'
                ? 'bg-[#2A548E] text-white'
                : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
            }`}
          >
            Gifts for Women ({flatItems.filter(i => i.section === 'women').length})
          </button>
          <button
            onClick={() => setSelectedSection('gift_guides')}
            className={`px-3.5 py-1.5 rounded-xs transition-colors cursor-pointer ${
              selectedSection === 'gift_guides'
                ? 'bg-[#2A548E] text-white'
                : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
            }`}
          >
            Gift Guides ({flatItems.filter(i => i.section === 'gift_guides').length})
          </button>
          <button
            onClick={() => setSelectedSection('articles')}
            className={`px-3.5 py-1.5 rounded-xs transition-colors cursor-pointer ${
              selectedSection === 'articles'
                ? 'bg-[#2A548E] text-white'
                : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
            }`}
          >
            Articles ({flatItems.filter(i => i.section === 'articles').length})
          </button>
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5A6270] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections by title, slug, recipient tags, or description..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E] rounded-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#99BFF9]/35 px-2.5 py-1.5 rounded-xs text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#2A548E]" />
              <select
                value={sort}
                onChange={(e: any) => setSort(e.target.value)}
                className="bg-transparent text-[#1E232B] font-medium focus:outline-none cursor-pointer"
              >
                <option value="section">Group by Section</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
                <option value="count_desc">Most Matching Products</option>
              </select>
            </div>

            <div className="flex items-center border border-[#99BFF9]/35 rounded-xs p-0.5 bg-[#FAF9F6]">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
                title="Grid Cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-xs transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN COLLECTIONS GRID / LIST */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#2A548E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#5A6270]">Loading collections from collections.yml...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#99BFF9]/35 rounded-xs space-y-3">
          <FolderTree className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif-display text-lg text-[#1E232B]">No Collections Found</h3>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            {search ? 'No collection entries matched your search query.' : 'There are currently no collections defined in this section.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={`${item.section}:${item.slug}`}
              onClick={() => setActiveItem({ section: item.section, slug: item.slug })}
              className="bg-white border border-[#99BFF9]/35 hover:border-[#2A548E] rounded-xs p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 cursor-pointer group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 text-[10px] uppercase font-semibold tracking-wider rounded-xs">
                    {formatSectionLabel(item.section)}
                  </span>
                  <span className="font-mono-code text-[11px] text-[#154D3B] font-semibold bg-[#E8F8F1] px-2 py-0.5 rounded-xs">
                    {item.matchingProductCount} products
                  </span>
                </div>

                <h3 className="font-serif-display text-xl text-[#1E232B] font-normal group-hover:text-[#2A548E] transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs text-[#5A6270] leading-relaxed line-clamp-2">
                  {item.description || `Curated ${item.title} collection.`}
                </p>

                {/* Recipient tags */}
                {Array.isArray(item.recipients) && item.recipients.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    {item.recipients.map(r => (
                      <span key={r} className="px-2 py-0.5 bg-stone-100 text-[#5A6270] text-[10px] font-mono-code rounded-xs">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-[#99BFF9]/20 flex items-center justify-between gap-2 text-xs">
                <span className="font-mono-code text-[10px] text-stone-400">
                  slug: {item.slug}
                </span>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setActiveItem({ section: item.section, slug: item.slug })}
                    className="px-2.5 py-1 bg-[#2A548E] text-white hover:bg-[#1B365D] rounded-xs text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className="p-1 hover:bg-rose-50 text-rose-600 rounded-xs transition-colors cursor-pointer"
                    title="Delete Collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border border-[#99BFF9]/35 rounded-xs overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E232B]">
              <thead className="bg-[#FAF9F6] border-b border-[#99BFF9]/30 text-[#2A548E] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Collection Title</th>
                  <th className="p-3">Section</th>
                  <th className="p-3">Recipient Tags</th>
                  <th className="p-3">Matching Products</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#99BFF9]/20">
                {filtered.map((item) => (
                  <tr
                    key={`${item.section}:${item.slug}`}
                    onClick={() => setActiveItem({ section: item.section, slug: item.slug })}
                    className="hover:bg-[#EEF5FF]/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium">
                      <div className="font-serif text-sm text-[#1E232B]">{item.title}</div>
                      <div className="font-mono-code text-[11px] text-[#2A548E]">slug: {item.slug}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-semibold text-[10px] uppercase rounded-xs">
                        {formatSectionLabel(item.section)}
                      </span>
                    </td>
                    <td className="p-3">
                      {Array.isArray(item.recipients) && item.recipients.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.recipients.map(r => (
                            <span key={r} className="px-1.5 py-0.5 bg-stone-100 text-[#5A6270] font-mono-code text-[10px] rounded-xs">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">None</span>
                      )}
                    </td>
                    <td className="p-3 font-mono-code font-bold text-[#154D3B]">
                      {item.matchingProductCount} items
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveItem({ section: item.section, slug: item.slug })}
                          className="px-2.5 py-1 bg-[#2A548E] text-white hover:bg-[#1B365D] rounded-xs text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-xs transition-colors cursor-pointer"
                          title="Delete Collection"
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

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 w-full max-w-md rounded-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2 bg-rose-100 rounded-full">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif-display text-lg text-[#1E232B] font-normal">
                Delete Collection Entry
              </h3>
            </div>

            <p className="text-xs text-[#5A6270] leading-relaxed">
              Are you sure you want to delete <strong className="text-[#1E232B] font-serif">"{deleteTarget.title}"</strong> (<code className="font-mono-code text-rose-700">{deleteTarget.section}:{deleteTarget.slug}</code>) from <code className="font-mono-code">_data/collections.yml</code>?
            </p>

            <div className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 text-[11px] text-[#5A6270] space-y-1">
              <strong>Snapshot Safety Guaranteed:</strong> A timestamped copy of <code className="font-mono-code">collections.yml</code> will automatically be saved to <code className="font-mono-code text-[#2A548E]">editor-backups/collections/</code>.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

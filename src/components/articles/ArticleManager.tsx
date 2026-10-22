import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  BookOpen,
  Trash2,
  Edit3,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { ArticleListItem } from '../../types/articles';
import { ArticleEditor } from './ArticleEditor';
import { useModalEscape } from '../../hooks/useModalEscape';

export const ArticleManager: React.FC = () => {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Controls
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'words_desc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Active Editor state
  const [activeSlug, setActiveSlug] = useState<string | null>(null); // string for edit, 'new' for new, null for list view
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState<ArticleListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useModalEscape(deleteTarget !== null, () => setDeleteTarget(null));

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/articles');
      const data = await res.json();
      if (data.success) {
        setArticles(data.articles || []);
      } else {
        setError(data.error || 'Failed to load articles.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to articles API.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/articles/${deleteTarget.slug}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeleteSuccess(`Article "${deleteTarget.title}" deleted. Snapshot backup created.`);
        setDeleteTarget(null);
        loadArticles();
        setTimeout(() => setDeleteSuccess(null), 3500);
      } else {
        setError(data.error || 'Delete failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during article deletion.');
    } finally {
      setDeleting(false);
    }
  };

  // Extract unique categories
  const categories = Array.from(new Set(articles.map(a => a.category).filter(Boolean)));

  // Filter & Search Logic
  let filtered = articles.filter(a => {
    const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
    const s = search.toLowerCase().trim();
    if (!s) return matchesCategory;

    const matchesSearch =
      a.title.toLowerCase().includes(s) ||
      a.slug.toLowerCase().includes(s) ||
      a.deck.toLowerCase().includes(s) ||
      a.category.toLowerCase().includes(s) ||
      a.authorName.toLowerCase().includes(s) ||
      a.authorRole.toLowerCase().includes(s) ||
      (a.relatedGuideSlug && a.relatedGuideSlug.toLowerCase().includes(s));

    return matchesCategory && matchesSearch;
  });

  // Sort Logic
  filtered.sort((a, b) => {
    if (sort === 'oldest') {
      return new Date(a.fileMtime).getTime() - new Date(b.fileMtime).getTime();
    } else if (sort === 'title_asc') {
      return a.title.localeCompare(b.title);
    } else if (sort === 'title_desc') {
      return b.title.localeCompare(a.title);
    } else if (sort === 'words_desc') {
      return b.wordCount - a.wordCount;
    }
    // Default newest first
    return new Date(b.fileMtime).getTime() - new Date(a.fileMtime).getTime();
  });

  // If in editor mode
  if (activeSlug !== null || isCreating) {
    return (
      <ArticleEditor
        initialSlug={isCreating ? null : activeSlug}
        onBack={() => {
          setActiveSlug(null);
          setIsCreating(false);
          loadArticles();
        }}
        onSavedSuccess={(newSlug) => {
          setActiveSlug(newSlug);
          setIsCreating(false);
          loadArticles();
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
              Phase 4 Module
            </span>
            <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 text-[10px] font-semibold rounded-xs">
              Source of Truth: _articles/*.md
            </span>
          </div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal mt-1">
            Editorial Essays &amp; Articles Manager
          </h1>
          <p className="text-xs text-[#5A6270] max-w-xl mt-1 leading-relaxed">
            Manage long-form research, gift psychology essays, and material culture analyses. Edits are saved directly to <code className="font-mono-code text-[#2A548E]">_articles/&lt;slug&gt;.md</code> with atomic writes and version backups.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadArticles}
            className="p-2 text-[#5A6270] hover:text-[#2A548E] hover:bg-[#EEF5FF] border border-[#99BFF9]/30 rounded-xs transition-colors cursor-pointer"
            title="Refresh Articles List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setActiveSlug(null);
              setIsCreating(true);
            }}
            className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Article</span>
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

      {/* SEARCH, FILTER & CONTROLS TOOLBAR */}
      <div className="p-4 bg-white border border-[#99BFF9]/35 rounded-xs space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5A6270] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, deck, author, category, citations, or guide slug..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E] rounded-xs"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#99BFF9]/35 px-2.5 py-1.5 rounded-xs text-xs">
              <Filter className="w-3.5 h-3.5 text-[#2A548E]" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-[#1E232B] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories ({articles.length})</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#FAF9F6] border border-[#99BFF9]/35 px-2.5 py-1.5 rounded-xs text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#2A548E]" />
              <select
                value={sort}
                onChange={(e: any) => setSort(e.target.value)}
                className="bg-transparent text-[#1E232B] font-medium focus:outline-none cursor-pointer"
              >
                <option value="newest">Recently Modified</option>
                <option value="oldest">Oldest Modified</option>
                <option value="title_asc">Title A-Z</option>
                <option value="title_desc">Title Z-A</option>
                <option value="words_desc">Longest Word Count</option>
              </select>
            </div>

            {/* View Mode Toggle */}
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

        <div className="flex items-center justify-between text-xs text-[#5A6270] pt-1">
          <span>Showing <strong>{filtered.length}</strong> of {articles.length} articles</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[#2A548E] hover:underline cursor-pointer"
            >
              Clear search filter
            </button>
          )}
        </div>
      </div>

      {/* MAIN ARTICLES GRID / LIST */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#2A548E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#5A6270]">Loading article library...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#99BFF9]/35 rounded-xs space-y-3">
          <FileText className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif-display text-lg text-[#1E232B]">No Articles Found</h3>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            {search ? 'No existing articles matched your search query.' : 'There are currently no articles in the _articles/ directory.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-3 py-1.5 bg-[#EEF5FF] text-[#2A548E] text-xs font-semibold rounded-xs transition-colors cursor-pointer"
            >
              Reset Search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((article) => {
            const heroSrc = (() => {
              if (!article.heroImage) return '/assets/images/home-hero.jpg';
              if (article.heroImage.startsWith('/') || article.heroImage.startsWith('assets/')) {
                return `/${article.heroImage.replace(/^\/+/, '')}`;
              }
              return `/assets/images/${article.heroImage}.jpg`;
            })();

            return (
              <div
                key={article.slug}
                onClick={() => setActiveSlug(article.slug)}
                className="bg-white border border-[#99BFF9]/35 hover:border-[#2A548E] rounded-xs overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col cursor-pointer group"
              >
                {/* Hero Thumbnail */}
                <div className="relative aspect-[16/9] bg-stone-100 overflow-hidden border-b border-[#99BFF9]/20">
                  <img
                    src={heroSrc}
                    alt={article.heroImageAlt || article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
                    }}
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#154D3B] text-white text-[10px] uppercase tracking-wider font-semibold rounded-xs shadow-xs">
                    {article.category}
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="font-serif-display text-lg text-[#1E232B] font-normal leading-snug group-hover:text-[#2A548E] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-[#5A6270] leading-relaxed line-clamp-3">
                      {article.deck || 'No summary description provided.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#99BFF9]/20 space-y-2 text-xs text-[#5A6270]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1E232B] truncate max-w-[150px]">
                        {article.authorName}
                      </span>
                      <span className="flex items-center gap-1 font-mono-code text-[11px] text-[#2A548E]">
                        <Clock className="w-3 h-3" />
                        {article.readTime}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-[#2A548E]" />
                        {article.sourcesCount} {article.sourcesCount === 1 ? 'citation' : 'citations'}
                      </span>
                      <span className="text-stone-400 font-mono-code">
                        {article.wordCount} words
                      </span>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
                      <span className="font-mono-code text-[10px] text-stone-400 truncate">
                        _articles/{article.slug}.md
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSlug(article.slug);
                          }}
                          className="px-2.5 py-1 bg-[#EEF5FF] text-[#2A548E] hover:bg-[#2A548E] hover:text-white rounded-xs text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(article);
                          }}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-xs transition-colors cursor-pointer"
                          title="Delete Article"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border border-[#99BFF9]/35 rounded-xs overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E232B]">
              <thead className="bg-[#FAF9F6] border-b border-[#99BFF9]/30 text-[#2A548E] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Article Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Author</th>
                  <th className="p-3">Read Time</th>
                  <th className="p-3">Citations</th>
                  <th className="p-3">Word Count</th>
                  <th className="p-3">Modified</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#99BFF9]/20">
                {filtered.map((art) => (
                  <tr
                    key={art.slug}
                    onClick={() => setActiveSlug(art.slug)}
                    className="hover:bg-[#EEF5FF]/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-medium text-[#1E232B]">
                      <div className="font-serif text-sm">{art.title}</div>
                      <div className="font-mono-code text-[11px] text-[#2A548E] truncate max-w-xs">
                        _articles/{art.slug}.md
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#154D3B]/10 text-[#154D3B] font-semibold text-[10px] uppercase rounded-xs">
                        {art.category}
                      </span>
                    </td>
                    <td className="p-3 text-[#5A6270]">{art.authorName}</td>
                    <td className="p-3 font-mono-code text-[#2A548E]">{art.readTime}</td>
                    <td className="p-3">{art.sourcesCount} citations</td>
                    <td className="p-3 font-mono-code">{art.wordCount}</td>
                    <td className="p-3 text-[#5A6270]">
                      {new Date(art.fileMtime).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setActiveSlug(art.slug)}
                          className="px-2.5 py-1 bg-[#2A548E] text-white hover:bg-[#1B365D] rounded-xs text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(art)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-xs transition-colors cursor-pointer"
                          title="Delete Article"
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
                Delete Article Document
              </h3>
            </div>

            <p className="text-xs text-[#5A6270] leading-relaxed">
              Are you sure you want to delete <strong className="text-[#1E232B] font-serif">"{deleteTarget.title}"</strong> (<code className="font-mono-code text-rose-700">_articles/{deleteTarget.slug}.md</code>)?
            </p>

            <div className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 text-[11px] text-[#5A6270] space-y-1">
              <strong>Snapshot Safety Guaranteed:</strong> A timestamped backup copy will automatically be preserved in <code className="font-mono-code text-[#2A548E]">editor-backups/articles/</code> before removal.
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

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  History,
  Eye,
  Columns,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Type,
  FileText,
  Sparkles,
  Compass,
  Map,
  Shield,
  HelpCircle,
  Info,
  Globe
} from 'lucide-react';
import { StaticPageData } from '../../types/pages';
import { RichTextEditor } from '../editor/RichTextEditor';
import { StaticPagePreview } from './StaticPagePreview';
import { StaticPageBackupsModal } from './StaticPageBackupsModal';

interface StaticPageEditorProps {
  slug: string;
  onBack: () => void;
}

export function StaticPageEditor({ slug, onBack }: StaticPageEditorProps) {
  const [page, setPage] = useState<StaticPageData | null>(null);
  const [initialPageJson, setInitialPageJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split'>('split');
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState<boolean>(false);

  const isDirty = page ? JSON.stringify(page) !== initialPageJson : false;

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${slug}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setPage(json.page);
        setInitialPageJson(JSON.stringify(json.page));
      } else {
        setError(json.error || `Failed to load page "/${slug}/".`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading page data.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Prevent accidental navigation when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    (window as any).cmsIsDirty = isDirty;
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      (window as any).cmsIsDirty = false;
    };
  }, [isDirty]);

  const handleBackClick = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to exit?')) {
        return;
      }
    }
    onBack();
  };

  const handleSave = async () => {
    if (!page) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setPage(json.page);
        setInitialPageJson(JSON.stringify(json.page));
        setSaveSuccess(`Page "${slug === '404' ? '/404.html' : `/${slug}/`}" updated successfully! (Backup: ${json.backupFile})`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setError(json.error || 'Failed to save page changes.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving page.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
        <span>Reading {slug === '404' ? '/404.html' : `/${slug}/index.html`} from local filesystem...</span>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-xl space-y-4 text-rose-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-serif-display text-lg font-medium">Failed to Load Page Editor</h3>
        </div>
        <p className="text-xs leading-relaxed">{error || 'Page content is unavailable.'}</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={fetchPage}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-stone-300 hover:bg-white text-stone-700 text-xs font-medium rounded cursor-pointer transition-colors"
          >
            Back to Static Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action & View Bar */}
      <div className="bg-white border border-[#99BFF9]/35 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackClick}
            className="p-2 border border-stone-200 hover:bg-[#EEF5FF] text-[#5A6270] hover:text-[#2A548E] rounded-lg transition-colors cursor-pointer"
            title="Return to Static Pages List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Editing Page: <span className="font-serif italic text-[#2A548E]">{slug === '404' ? '/404.html' : `/${slug}/`}</span>
              </h2>
              {isDirty && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded font-mono-code">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6270]">
              Source File: <code className="font-mono-code font-bold">{slug === '404' ? '/404.html' : `/${slug}/index.html`}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* View Toggle */}
          <div className="flex items-center bg-[#FAF9F6] border border-stone-200 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'editor'
                  ? 'bg-white text-[#2A548E] shadow-xs'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'split'
                  ? 'bg-white text-[#2A548E] shadow-xs'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-[#2A548E] shadow-xs'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <button
            onClick={() => setIsBackupsModalOpen(true)}
            className="p-2 border border-stone-200 hover:bg-[#EEF5FF] text-[#5A6270] hover:text-[#2A548E] rounded-lg transition-colors cursor-pointer"
            title="Revision History & Backups"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              isDirty
                ? 'bg-[#2A548E] hover:bg-[#1B365D] text-white'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className={`grid gap-8 ${
        activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      }`}>
        {/* LEFT COLUMN: EDITORIAL FORM / PAGE FORM */}
        {(activeTab === 'editor' || activeTab === 'split') && (
          <div className="space-y-6">
            {/* SPECIAL FORM FOR 404 SYSTEM PAGE */}
            {slug === '404' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#EEF5FF] border border-[#99BFF9]/40 rounded-xl flex items-start gap-3 text-xs text-[#2A548E]">
                  <Compass className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">404 System Page Protection</strong>
                    <p className="leading-relaxed">
                      The 404 page contains technical compass SVG graphics, layout grids, and navigation action buttons.
                      This editor protects those structural assets while allowing full customization of the error copy.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4 text-xs">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#2A548E]" />
                    <span>404 Metadata &amp; Headlines</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Page Title Tag (<code className="font-mono-code">&lt;title&gt;</code>)
                      </label>
                      <input
                        type="text"
                        value={page.title}
                        onChange={(e) => setPage({ ...page, title: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Main Display Headline (H1)
                      </label>
                      <input
                        type="text"
                        value={page.headline || page.title}
                        onChange={(e) => setPage({ ...page, headline: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-lg text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Error Narrative Message
                      </label>
                      <textarea
                        rows={3}
                        value={page.lead}
                        onChange={(e) => setPage({ ...page, lead: e.target.value, description: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Compass Illustration Quote Caption
                      </label>
                      <input
                        type="text"
                        value={page.quote || ''}
                        onChange={(e) => setPage({ ...page, quote: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif italic text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4 text-xs">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#226E56]" />
                    <span>404 Action Button Labels</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">Primary Button</label>
                      <input
                        type="text"
                        value={page.btnHome || 'Return to Home'}
                        onChange={(e) => setPage({ ...page, btnHome: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">Secondary Button</label>
                      <input
                        type="text"
                        value={page.btnFinder || 'Launch Gift Finder'}
                        onChange={(e) => setPage({ ...page, btnFinder: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">Tertiary Button</label>
                      <input
                        type="text"
                        value={page.btnGuides || 'Browse Gift Guides'}
                        onChange={(e) => setPage({ ...page, btnGuides: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SPECIAL FORM FOR SITEMAP STRUCTURED PAGE */}
            {slug === 'sitemap' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#EEF5FF] border border-[#99BFF9]/40 rounded-xl flex items-start gap-3 text-xs text-[#2A548E]">
                  <Map className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">Sitemap Structure Protection</strong>
                    <p className="leading-relaxed">
                      The Human Sitemap indexes all curated gift guides, research essays, categories, and main portals in a multi-column grid.
                      This editor protects the directory card grids while allowing editorial customization of the page title, sub-badge, and introduction.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4 text-xs">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#2A548E]" />
                    <span>Sitemap Header Metadata</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Page Title (H1 &amp; Title Tag)
                      </label>
                      <input
                        type="text"
                        value={page.title}
                        onChange={(e) => setPage({ ...page, title: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Header Sub-badge Label
                      </label>
                      <input
                        type="text"
                        value={page.badge || 'Directory & Navigation'}
                        onChange={(e) => setPage({ ...page, badge: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Directory Introduction Narrative
                      </label>
                      <textarea
                        rows={3}
                        value={page.lead}
                        onChange={(e) => setPage({ ...page, lead: e.target.value, description: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* FORM FOR STANDARD RICH-TEXT PAGES (about, affiliate-disclosure, contact, privacy, terms) */}
            {slug !== '404' && slug !== 'sitemap' && (
              <div className="space-y-6">
                {/* Header Metadata Section */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#2A548E]" />
                    <span>Page Header Metadata</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Page Title (H1 &amp; Title Tag)
                      </label>
                      <input
                        type="text"
                        value={page.title}
                        onChange={(e) => setPage({ ...page, title: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        placeholder="Page Title"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Header Sub-badge Label
                      </label>
                      <input
                        type="text"
                        value={page.badge || ''}
                        onChange={(e) => setPage({ ...page, badge: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        placeholder="Editorial Mission & Standards"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Header Lead Subtitle
                      </label>
                      <textarea
                        rows={2}
                        value={page.lead || ''}
                        onChange={(e) => setPage({ ...page, lead: e.target.value, description: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                        placeholder="Lead paragraph subtitle..."
                      />
                    </div>
                  </div>
                </div>

                {/* SEO & Search Indexing Controls */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-rose-600" />
                    <span>SEO &amp; Search Indexing Controls</span>
                  </h3>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[#5A6270] font-semibold mb-1">
                        Search / SEO Title
                      </label>
                      <input
                        type="text"
                        value={page['search-title'] || page.searchTitle || ''}
                        onChange={(e) => setPage({ ...page, 'search-title': e.target.value, searchTitle: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        placeholder="Optional. Page title for search engines and browser tab"
                      />
                      <p className="text-[11px] text-[#5A6270] mt-1">
                        Optional. Used for the browser title and search engines. If empty, the page title is used.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-semibold mb-1">
                        SEO Description
                      </label>
                      <textarea
                        rows={2}
                        value={page['seo-description'] || page.seoDescription || ''}
                        onChange={(e) => setPage({ ...page, 'seo-description': e.target.value, seoDescription: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                        placeholder="Optional meta description for Google search snippets and social metadata"
                      />
                      <p className="text-[11px] text-[#5A6270] mt-1">
                        Optional. Used for the search-engine meta description and social metadata. If empty, the page description/deck is used.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-[#5A6270] font-semibold mb-1">
                          Search Engine Visibility
                        </label>
                      <select
                        value={
                          page.robots && typeof page.robots === 'object' && page.robots.index === false
                            ? 'noindex'
                            : 'index'
                        }
                        onChange={(e) => {
                          const indexVal = e.target.value === 'index';
                          const currentFollow = page.robots && typeof page.robots === 'object' ? page.robots.follow !== false : true;
                          setPage({
                            ...page,
                            robots: { index: indexVal, follow: currentFollow }
                          });
                        }}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      >
                        <option value="index">INDEX (Allow search engines to show this page - default)</option>
                        <option value="noindex">NOINDEX (Instruct search engines to hide this page)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-semibold mb-1">
                        Link Crawling Directives
                      </label>
                      <select
                        value={
                          page.robots && typeof page.robots === 'object' && page.robots.follow === false
                            ? 'nofollow'
                            : 'follow'
                        }
                        onChange={(e) => {
                          const followVal = e.target.value === 'follow';
                          const currentIndex = page.robots && typeof page.robots === 'object' ? page.robots.index !== false : true;
                          setPage({
                            ...page,
                            robots: { index: currentIndex, follow: followVal }
                          });
                        }}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      >
                        <option value="follow">FOLLOW (Allow spiders to follow links on this page - default)</option>
                        <option value="nofollow">NOFOLLOW (Tell spiders not to follow links on this page)</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    These parameters control search crawler behavior and are outputted as meta tags in the page header. <strong>Noindex</strong> hides the page, and <strong>Nofollow</strong> restricts crawler pagerank distribution.
                  </div>
                </div>
              </div>

                {/* WYSIWYG Prose Editor */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-2">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2A548E]" />
                      <span>Main Editorial Body</span>
                    </h3>
                    <span className="text-xs text-[#226E56] font-semibold font-mono-code">
                      RichText / Markdown
                    </span>
                  </div>

                  <RichTextEditor
                    initialMarkdown={page.content || ''}
                    onChange={(md) => setPage(prev => prev ? { ...prev, content: md } : null)}
                    placeholder="Write page content here..."
                    minHeight="360px"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIGHT COLUMN: LIVE PREVIEW */}
        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#5A6270] px-1 font-mono-code">
              <span className="flex items-center gap-1.5 font-bold text-[#2A548E]">
                <Eye className="w-4 h-4" /> Live Page Preview
              </span>
              <span>Reflects publication styling</span>
            </div>

            <div className="sticky top-28">
              <StaticPagePreview page={page} />
            </div>
          </div>
        )}
      </div>

      {/* Backups Modal */}
      <StaticPageBackupsModal
        isOpen={isBackupsModalOpen}
        slug={slug}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestoreComplete={fetchPage}
      />
    </div>
  );
}

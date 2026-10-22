import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Eye,
  Columns,
  Edit3,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  BookOpen,
  FileText,
  ShoppingBag,
  Quote,
  Mail,
  RefreshCw
} from 'lucide-react';
import { HomepageFrontMatter, HomepageDocument } from '../../types/homepage';
import { HomepagePreview } from './HomepagePreview';
import { HomepageBackupsModal } from './HomepageBackupsModal';
import { AssetPickerModal } from '../assets/AssetPickerModal';

export const HomepageEditor: React.FC = () => {
  const [doc, setDoc] = useState<HomepageDocument | null>(null);
  const [frontMatter, setFrontMatter] = useState<HomepageFrontMatter>({});
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    (window as any).cmsIsDirty = hasUnsavedChanges;
    return () => {
      (window as any).cmsIsDirty = false;
    };
  }, [hasUnsavedChanges]);
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available Guides and Articles for Dropdowns
  const [guides, setGuides] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loadingSelects, setLoadingSelects] = useState(false);

  const fetchHomepage = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/homepage');
      const data = await res.json();
      if (data.success) {
        setDoc(data);
        setFrontMatter(data.frontMatter || {});
        setBody(data.body || '');
        setHasUnsavedChanges(false);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to load index.md.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error connecting to server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSelectData = useCallback(async () => {
    setLoadingSelects(true);
    try {
      const [guidesRes, articlesRes] = await Promise.all([
        fetch('/api/guides'),
        fetch('/api/articles')
      ]);
      const guidesData = await guidesRes.json();
      const articlesData = await articlesRes.json();

      if (guidesData.success) {
        setGuides(guidesData.guides || []);
      }
      if (articlesData.success) {
        setArticles(articlesData.articles || []);
      }
    } catch (err) {
      console.warn('Failed to fetch select data:', err);
    } finally {
      setLoadingSelects(false);
    }
  }, []);

  useEffect(() => {
    fetchHomepage();
    fetchSelectData();
  }, [fetchHomepage, fetchSelectData]);

  // Unsaved changes prompt before tab unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateFrontMatterField = (key: string, value: any) => {
    setFrontMatter(prev => {
      const updated = { ...prev, [key]: value };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const updateNestedField = (parentKey: 'shop_banner' | 'newsletter', subKey: string, value: any) => {
    setFrontMatter(prev => {
      const parentObj = (prev[parentKey] as any) || {};
      const updated = {
        ...prev,
        [parentKey]: {
          ...parentObj,
          [subKey]: value
        }
      };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontMatter,
          body
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: `Homepage updated successfully. Backup saved as ${data.backupFile}.` });
        setHasUnsavedChanges(false);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save homepage.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error saving homepage.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreFromBackup = async (filename: string) => {
    const res = await fetch('/api/homepage-backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupFilename: filename })
    });
    const data = await res.json();
    if (data.success) {
      setFrontMatter(data.frontMatter || {});
      setBody(data.body || '');
      setHasUnsavedChanges(false);
      setStatusMsg({ type: 'success', text: `Restored homepage from "${filename}".` });
    } else {
      throw new Error(data.error || 'Failed to restore backup.');
    }
  };

  const handleSelectAsset = (asset: any) => {
    // Strip extension for hero_image key convention (e.g. "home-hero")
    const baseName = asset.filename ? asset.filename.replace(/\.[^/.]+$/, '') : asset.filename;
    updateFrontMatterField('hero_image', baseName);
    if (asset.alt) {
      updateFrontMatterField('hero_image_alt', asset.alt);
    }
    setIsAssetPickerOpen(false);
  };

  const selectedGuide = guides.find(g => g.slug === frontMatter.featured_guide_slug);
  const selectedArticle = articles.find(a => a.slug === frontMatter.featured_article_slug);

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="text-sm font-medium">Loading index.md homepage configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header / Actions Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl font-bold text-slate-900">
                Homepage Editor
              </h2>
              <span className="font-mono-code text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                /index.md
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage hero messaging, featured recommendations, store banner, quote, and newsletter configuration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'editor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* History / Backups Button */}
          <button
            onClick={() => setIsBackupsModalOpen(true)}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Backups</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Workspace Grid */}
      <div
        className={`grid gap-6 ${
          viewMode === 'split'
            ? 'grid-cols-1 lg:grid-cols-12'
            : 'grid-cols-1'
        }`}
      >
        {/* Editor Form Column */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div
            className={`space-y-6 ${
              viewMode === 'split' ? 'lg:col-span-7' : 'w-full'
            }`}
          >
            {/* Section 1: Hero Header Customization */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h3 className="font-serif-display text-base font-bold text-slate-900">
                  1. Hero Header Customization
                </h3>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Edition Badge
                  </label>
                  <input
                    type="text"
                    value={frontMatter.edition_badge || ''}
                    onChange={(e) => updateFrontMatterField('edition_badge', e.target.value)}
                    placeholder="e.g. The Independent Gift Publication • Autumn 2026 Edition"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Main Headline
                  </label>
                  <input
                    type="text"
                    value={frontMatter.hero_title || ''}
                    onChange={(e) => updateFrontMatterField('hero_title', e.target.value)}
                    placeholder="e.g. Thoughtful gifts, chosen with a little more thought."
                    className="w-full px-3 py-2 text-sm font-serif border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Lead Subtitle
                  </label>
                  <textarea
                    rows={3}
                    value={frontMatter.hero_lead || ''}
                    onChange={(e) => updateFrontMatterField('hero_lead', e.target.value)}
                    placeholder="Main intro lead paragraph on homepage..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hero Image Key / Slug
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={frontMatter.hero_image || ''}
                        onChange={(e) => updateFrontMatterField('hero_image', e.target.value)}
                        placeholder="e.g. home-hero"
                        className="flex-1 px-3 py-2 text-xs font-mono-code border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => setIsAssetPickerOpen(true)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 shrink-0"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                        <span>Pick</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hero Image Alt Text
                    </label>
                    <input
                      type="text"
                      value={frontMatter.hero_image_alt || ''}
                      onChange={(e) => updateFrontMatterField('hero_image_alt', e.target.value)}
                      placeholder="Alt text describing still life artwork..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Image Caption
                  </label>
                  <input
                    type="text"
                    value={frontMatter.hero_image_caption || ''}
                    onChange={(e) => updateFrontMatterField('hero_image_caption', e.target.value)}
                    placeholder="e.g. Still Life No. 14: Objects of enduring provenance. Photographed in studio."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Featured Content Selection */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <h3 className="font-serif-display text-base font-bold text-slate-900">
                  2. Featured Content & Curation Selection
                </h3>
              </div>

              <div className="space-y-4 text-left">
                {/* Searchable Featured Guide Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Featured Gift Guide
                  </label>
                  <select
                    value={frontMatter.featured_guide_slug || ''}
                    onChange={(e) => updateFrontMatterField('featured_guide_slug', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select a guide...</option>
                    {guides.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.title} ({g.slug})
                      </option>
                    ))}
                  </select>
                  {selectedGuide && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{selectedGuide.title}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded">
                        {selectedGuide.category || 'Guide'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Searchable Featured Article Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Featured Essay / Article
                  </label>
                  <select
                    value={frontMatter.featured_article_slug || ''}
                    onChange={(e) => updateFrontMatterField('featured_article_slug', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">Select an article...</option>
                    {articles.map((a) => (
                      <option key={a.slug} value={a.slug}>
                        {a.title} ({a.slug})
                      </option>
                    ))}
                  </select>
                  {selectedArticle && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{selectedArticle.title}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                        {selectedArticle.category || 'Article'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Secondary Guides Display Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={frontMatter.secondary_guides_limit || 3}
                      onChange={(e) => updateFrontMatterField('secondary_guides_limit', parseInt(e.target.value, 10) || 3)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Secondary Articles Display Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={frontMatter.secondary_articles_limit || 2}
                      onChange={(e) => updateFrontMatterField('secondary_articles_limit', parseInt(e.target.value, 10) || 2)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Official Store Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <ShoppingBag className="w-4 h-4 text-teal-600" />
                <h3 className="font-serif-display text-base font-bold text-slate-900">
                  3. Official Store Banner Block
                </h3>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Banner Title
                  </label>
                  <input
                    type="text"
                    value={frontMatter.shop_banner?.title || ''}
                    onChange={(e) => updateNestedField('shop_banner', 'title', e.target.value)}
                    placeholder="e.g. Shop Science of Gifts"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Banner Deck / Summary
                  </label>
                  <textarea
                    rows={2}
                    value={frontMatter.shop_banner?.deck || ''}
                    onChange={(e) => updateNestedField('shop_banner', 'deck', e.target.value)}
                    placeholder="History, mythology, and culture-inspired gifts..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Target URL
                  </label>
                  <input
                    type="url"
                    value={frontMatter.shop_banner?.url || ''}
                    onChange={(e) => updateNestedField('shop_banner', 'url', e.target.value)}
                    placeholder="https://shop.scienceofgifts.com/"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Editorial Charter Quote */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Quote className="w-4 h-4 text-teal-600" />
                <h3 className="font-serif-display text-base font-bold text-slate-900">
                  4. Editorial Charter Quote
                </h3>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Charter Quote Text
                  </label>
                  <textarea
                    rows={2}
                    value={frontMatter.quote || ''}
                    onChange={(e) => updateFrontMatterField('quote', e.target.value)}
                    placeholder="Quote text..."
                    className="w-full px-3 py-2 text-xs italic font-serif border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quote Attribution / Author
                  </label>
                  <input
                    type="text"
                    value={frontMatter.quote_author || ''}
                    onChange={(e) => updateFrontMatterField('quote_author', e.target.value)}
                    placeholder="e.g. The Science of Gifts Editorial Charter"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Sunday Curation Newsletter Block */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Mail className="w-4 h-4 text-teal-600" />
                <h3 className="font-serif-display text-base font-bold text-slate-900">
                  5. Sunday Curation Newsletter Box
                </h3>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Newsletter Title
                  </label>
                  <input
                    type="text"
                    value={frontMatter.newsletter?.title || ''}
                    onChange={(e) => updateNestedField('newsletter', 'title', e.target.value)}
                    placeholder="e.g. One thoughtfully selected object. Every Sunday morning."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Newsletter Deck / Description
                  </label>
                  <textarea
                    rows={2}
                    value={frontMatter.newsletter?.deck || ''}
                    onChange={(e) => updateNestedField('newsletter', 'deck', e.target.value)}
                    placeholder="Short description of newsletter..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subscriber Counter / Trust Label
                  </label>
                  <input
                    type="text"
                    value={frontMatter.newsletter?.subscribers_count || ''}
                    onChange={(e) => updateNestedField('newsletter', 'subscribers_count', e.target.value)}
                    placeholder="e.g. Over 42,000 discerning readers. Free forever."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Preview Column */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={`space-y-4 ${
              viewMode === 'split' ? 'lg:col-span-5' : 'w-full'
            }`}
          >
            <div className="sticky top-24">
              <div className="flex items-center justify-between pb-2 mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-teal-600" />
                  Live Homepage Layout Preview
                </span>
                <span className="text-[10px] text-slate-400 font-mono-code">
                  _layouts/home.html
                </span>
              </div>

              <HomepagePreview
                frontMatter={frontMatter}
                featuredGuide={selectedGuide}
                featuredArticle={selectedArticle}
              />
            </div>
          </div>
        )}
      </div>

      {/* Backups Modal */}
      <HomepageBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestore={handleRestoreFromBackup}
      />

      {/* Asset Picker Modal for Hero Image */}
      <AssetPickerModal
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        onSelect={(res) => {
          const baseName = res.filename ? res.filename.replace(/\.[^/.]+$/, '') : res.filename;
          updateFrontMatterField('hero_image', baseName);
          if (res.altText) {
            updateFrontMatterField('hero_image_alt', res.altText);
          }
          if (res.caption) {
            updateFrontMatterField('hero_image_caption', res.caption);
          }
          setIsAssetPickerOpen(false);
        }}
        title="Select Homepage Hero Image"
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Save,
  Eye,
  Columns,
  Edit3,
  History,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Users,
  Image as ImageIcon,
  Plus,
  Trash2,
  Sparkles,
  Package,
  AlertTriangle,
  Tag
} from 'lucide-react';
import { CollectionItem } from '../../types/collections';
import { AssetPickerModal } from '../assets/AssetPickerModal';
import { CollectionPreview } from './CollectionPreview';
import { CollectionBackupsModal } from './CollectionBackupsModal';

interface CollectionEditorProps {
  initialSection: string;
  initialSlug: string | null; // null if creating a new collection
  onBack: () => void;
  onSavedSuccess: (section: string, slug: string) => void;
}

export const CollectionEditor: React.FC<CollectionEditorProps> = ({
  initialSection,
  initialSlug,
  onBack,
  onSavedSuccess
}) => {
  const [loading, setLoading] = useState<boolean>(!!initialSlug);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    (window as any).cmsIsDirty = isDirty;
    return () => {
      (window as any).cmsIsDirty = false;
    };
  }, [isDirty]);

  // View modes
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('split');

  // Modals
  const [showAssetPicker, setShowAssetPicker] = useState<boolean>(false);
  const [showBackupsModal, setShowBackupsModal] = useState<boolean>(false);

  // Taxonomies & Matching Products
  const [matchingProducts, setMatchingProducts] = useState<any[]>([]);
  const [derivedRecipients, setDerivedRecipients] = useState<Array<{ tag: string; count: number }>>([]);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Form State
  const [section, setSection] = useState<string>(initialSection || 'men');
  const [item, setItem] = useState<CollectionItem>({
    title: '',
    slug: '',
    section: initialSection || 'men',
    description: '',
    recipients: []
  });

  useEffect(() => {
    loadTaxonomies();
    if (initialSlug) {
      loadCollection(initialSection, initialSlug);
    } else {
      setLoading(false);
    }
  }, [initialSection, initialSlug]);

  const loadTaxonomies = async () => {
    try {
      const res = await fetch('/api/taxonomies');
      const data = await res.json();
      if (data.success) {
        setDerivedRecipients(data.recipients || []);
      }
    } catch {}
  };

  const loadCollection = async (sec: string, slg: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/${sec}/${slg}`);
      const data = await res.json();
      if (data.success && data.item) {
        setItem(data.item);
        setMatchingProducts(data.matchingProducts || []);
        setIsDirty(false);
      } else {
        setError(data.error || 'Failed to load collection.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching collection details.');
    } finally {
      setLoading(false);
    }
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (newTitle: string) => {
    setIsDirty(true);
    setItem(prev => {
      const updated = { ...prev, title: newTitle };
      if (!initialSlug && (!prev.slug || prev.slug === slugify(prev.title))) {
        updated.slug = slugify(newTitle);
      }
      return updated;
    });
  };

  const handleToggleRecipient = (tag: string) => {
    setIsDirty(true);
    setItem(prev => {
      const current = prev.recipients || [];
      const lower = tag.toLowerCase();
      const updated = current.includes(lower)
        ? current.filter(r => r !== lower)
        : [...current, lower];
      return { ...prev, recipients: updated };
    });
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.toLowerCase().trim();
    if (!trimmed) return;
    setIsDirty(true);
    setItem(prev => {
      const current = prev.recipients || [];
      if (current.includes(trimmed)) return prev;
      return { ...prev, recipients: [...current, trimmed] };
    });
    setCustomTagInput('');
  };

  const handleSave = async () => {
    if (!item.title.trim()) {
      setError('Collection title is required.');
      return;
    }
    if (!item.slug.trim()) {
      setError('Collection slug is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const isUpdate = !!initialSlug;
    const url = isUpdate ? `/api/collections/${initialSection}/${initialSlug}` : '/api/collections';
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          item
        })
      });
      const data = await res.json();

      if (data.success) {
        setIsDirty(false);
        setSuccessMessage(`Collection "${item.title}" saved successfully into _data/collections.yml!`);
        setTimeout(() => setSuccessMessage(null), 3500);

        onSavedSuccess(data.section, data.slug);
      } else {
        setError(data.error || 'Failed to save collection.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while saving collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackClick = () => {
    if (isDirty) {
      const choice = window.confirm('You have unsaved changes in this collection. Discard changes?');
      if (!choice) return;
    }
    onBack();
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#2A548E] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#5A6270]">Loading collection data...</p>
      </div>
    );
  }

  // Navigation impact warning if slug changed
  const isSlugChanged = initialSlug && item.slug !== initialSlug;

  return (
    <div className="space-y-6">
      {/* TOP WORKSPACE NAVIGATION & TOOLBAR */}
      <div className="sticky top-0 z-30 bg-[#FAF9F6] pt-2 pb-4 border-b border-[#99BFF9]/30 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="p-1.5 hover:bg-stone-200/60 rounded-xs text-[#5A6270] hover:text-[#1E232B] transition-colors cursor-pointer"
              title="Return to Collections List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest font-semibold font-mono-code text-[#154D3B]">
                  {initialSlug ? `Editing Collection (${section})` : 'New Collection Entry'}
                </span>
                {isDirty ? (
                  <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-semibold rounded-xs">
                    Unsaved Changes
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-semibold rounded-xs flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Saved
                  </span>
                )}
              </div>
              <h2 className="font-serif-display text-xl text-[#1E232B] font-normal truncate max-w-md">
                {item.title || 'Untitled Collection'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-[#99BFF9]/35 rounded-xs p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'editor' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
                title="Editor Only"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'split' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
                title="Split Editor & Preview"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'preview' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
                title="Preview Only"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Preview</span>
              </button>
            </div>

            {/* Version History Button */}
            <button
              type="button"
              onClick={() => setShowBackupsModal(true)}
              className="px-3 py-1.5 bg-white border border-[#99BFF9]/35 hover:border-[#2A548E] text-[#5A6270] hover:text-[#2A548E] text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="View Backups & Version Snapshots"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">History</span>
            </button>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Collection'}</span>
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* MAIN WORKSPACE split / full layout */}
      <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* LEFT PANEL: EDITING CONTROLS */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className="space-y-6 bg-white p-5 border border-[#99BFF9]/30 rounded-xs shadow-xs">
            {/* Section & Category Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4 border-b border-[#99BFF9]/20">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                  Collection Section Group *
                </label>
                <select
                  value={section}
                  onChange={(e) => {
                    setIsDirty(true);
                    setSection(e.target.value);
                  }}
                  className="w-full p-2 text-xs font-semibold bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                >
                  <option value="men">Gifts for Men (men:)</option>
                  <option value="women">Gifts for Women (women:)</option>
                  <option value="gift_guides">Gift Guide Categories (gift_guides:)</option>
                  <option value="articles">Article Categories (articles:)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                  Collection Title *
                </label>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. For Dad, History, Science..."
                  className="w-full p-2 text-xs font-serif font-medium bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                />
              </div>
            </div>

            {/* Slug & Navigation Impact Warning */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                Collection Slug *
              </label>
              <input
                type="text"
                value={item.slug}
                onChange={(e) => {
                  setIsDirty(true);
                  setItem(p => ({ ...p, slug: slugify(e.target.value) }));
                }}
                placeholder="dad, history, husband..."
                className="w-full p-2 text-xs font-mono-code bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
              />
              {isSlugChanged && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Navigation Warning:</strong> Changing slug from <code className="font-mono-code">{initialSlug}</code> to <code className="font-mono-code">{item.slug}</code> may affect URLs referenced in templates or <code className="font-mono-code">navigation.yml</code>.
                  </span>
                </div>
              )}
            </div>

            {/* Description / Curation Deck */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                Curation Description
              </label>
              <textarea
                value={item.description || ''}
                onChange={(e) => {
                  setIsDirty(true);
                  setItem(p => ({ ...p, description: e.target.value }));
                }}
                rows={3}
                placeholder="Describe the editorial curation scope or theme..."
                className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
              />
            </div>

            {/* Recipient Filter Tags (for Men / Women collections) */}
            {(section === 'men' || section === 'women') && (
              <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Target Recipient Tags (<code className="font-mono-code">recipients:</code>)
                  </label>
                  <span className="text-[11px] text-[#5A6270]">
                    Products with matching recipient tags automatically belong to this collection.
                  </span>
                </div>

                {/* Selected pills */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-2 bg-white border border-[#99BFF9]/30 rounded-xs">
                  {(!item.recipients || item.recipients.length === 0) ? (
                    <span className="text-xs text-stone-400 italic">No recipient tags assigned (matches all products if slug is 'all').</span>
                  ) : (
                    item.recipients.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/35 rounded-xs text-xs font-mono-code flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleToggleRecipient(tag)}
                          className="hover:text-rose-600 font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add custom tag input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    placeholder="Type recipient tag (e.g. dad, father, coworker) and press Enter..."
                    className="flex-1 p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="px-3 py-2 bg-[#2A548E] text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer shrink-0"
                  >
                    Add Tag
                  </button>
                </div>

                {/* Derived Recipient Presets from products.yml */}
                {derivedRecipients.length > 0 && (
                  <div className="pt-2 border-t border-[#99BFF9]/20 space-y-1.5">
                    <span className="text-[11px] text-[#5A6270] font-medium block">
                      Common recipient tags found in products.yml:
                    </span>
                    <div className="flex flex-wrap items-center gap-1 max-h-24 overflow-y-auto">
                      {derivedRecipients.map(({ tag, count }) => {
                        const isSelected = (item.recipients || []).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleRecipient(tag)}
                            className={`px-2 py-0.5 text-[11px] rounded-xs font-mono-code transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#2A548E] text-white'
                                : 'bg-white text-[#5A6270] border border-[#99BFF9]/30 hover:border-[#2A548E]'
                            }`}
                          >
                            {tag} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Collection Hero Image Selector */}
            <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Collection Hero Image
                </label>
                <button
                  type="button"
                  onClick={() => setShowAssetPicker(true)}
                  className="px-2.5 py-1 bg-white hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/30 text-[11px] font-semibold rounded-xs transition-colors cursor-pointer"
                >
                  Browse Asset Library
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#5A6270] mb-0.5">Image Path / Identifier</label>
                  <input
                    type="text"
                    value={item.image || ''}
                    onChange={(e) => {
                      setIsDirty(true);
                      setItem(p => ({ ...p, image: e.target.value }));
                    }}
                    placeholder="assets/images/home-hero.jpg"
                    className="w-full p-2 text-xs font-mono-code bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#5A6270] mb-0.5">Image Alt Text</label>
                  <input
                    type="text"
                    value={item.imageAlt || ''}
                    onChange={(e) => {
                      setIsDirty(true);
                      setItem(p => ({ ...p, imageAlt: e.target.value }));
                    }}
                    placeholder="Descriptive alt text for image..."
                    className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                  />
                </div>
              </div>
            </div>

            {/* Matching Products Preview List */}
            <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Matching Products from products.yml ({matchingProducts.length})
                </label>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {matchingProducts.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No products match current collection rule.</p>
                ) : (
                  matchingProducts.map((p, idx) => (
                    <div key={p.id || idx} className="p-2 bg-[#FAF9F6] border border-stone-200 rounded-xs flex items-center justify-between text-xs">
                      <div className="font-serif font-medium text-[#1E232B] truncate">{p.title}</div>
                      <span className="font-mono-code text-[11px] text-[#2A548E] shrink-0">{p.formattedPrice || `$${p.price}`}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT / FULL PANEL: LIVE PREVIEW */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`overflow-y-auto ${viewMode === 'preview' ? 'max-w-4xl mx-auto w-full' : ''}`}>
            <div className="mb-2 flex items-center justify-between text-xs text-[#5A6270]">
              <span className="uppercase tracking-wider font-semibold font-mono-code text-[#2A548E]">
                Live Collection Preview
              </span>
              <span className="text-[11px] italic">Reflects for-men / for-women layouts</span>
            </div>
            <CollectionPreview
              collection={item}
              matchingProducts={matchingProducts}
            />
          </div>
        )}
      </div>

      {/* Asset Picker Modal */}
      <AssetPickerModal
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        initialAltText={item.imageAlt || ''}
        showCaptionInput={false}
        onSelect={(selected) => {
          setIsDirty(true);
          setItem(p => ({
            ...p,
            image: selected.path,
            imageAlt: selected.altText || p.imageAlt
          }));
        }}
      />

      {/* Version History Modal */}
      <CollectionBackupsModal
        isOpen={showBackupsModal}
        onClose={() => setShowBackupsModal(false)}
        onRestoreSuccess={() => {
          setShowBackupsModal(false);
          if (initialSlug) loadCollection(initialSection, initialSlug);
        }}
      />
    </div>
  );
};

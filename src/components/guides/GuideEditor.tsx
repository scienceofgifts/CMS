import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Trash2,
  Eye,
  Edit3,
  Columns2,
  Package,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  Compass,
  BookOpen,
  Calendar,
  Clock,
  User,
  Image as ImageIcon,
  Globe
} from 'lucide-react';
import { GiftGuideFrontMatter, GiftGuide } from '../../types/guide';
import { Product } from '../../types/product';
import { RichTextEditor } from '../editor/RichTextEditor';
import { ProductPickerModal } from './ProductPickerModal';
import { GuidePreview } from './GuidePreview';
import { GuideBackupsModal } from './GuideBackupsModal';
import { GuideAiModal } from './GuideAiModal';
import { AssetPickerModal } from '../assets/AssetPickerModal';
import { AssetPickerResult } from '../../types/assets';
import { useModalEscape } from '../../hooks/useModalEscape';
import { getTodayIsoDate, normalizeToIsoDate } from '../../utils/date';
import { marked } from 'marked';

interface GuideEditorProps {
  guideSlug?: string; // If empty or 'new', create mode
  onBack: () => void;
  onSaved?: (newSlug: string) => void;
}

export const GuideEditor: React.FC<GuideEditorProps> = ({
  guideSlug,
  onBack,
  onSaved
}) => {
  useModalEscape(true, onBack);

  const isNew = !guideSlug || guideSlug === 'new';

  // Track whether user explicitly edited the lastModifiedDate in this session
  const [userModifiedDateEdited, setUserModifiedDateEdited] = useState<boolean>(false);

  // Core Guide State
  const [frontMatter, setFrontMatter] = useState<GiftGuideFrontMatter>(() => {
    const today = getTodayIsoDate();
    return {
      title: '',
      slug: '',
      deck: '',
      category: 'Books',
      readTime: '8 min read',
      publishedDate: today,
      lastModifiedDate: today,
      author: {
        name: 'Clara Vance',
        role: 'Editor-in-Chief & Lead Researcher',
        bio: 'Former architectural historian and material culture researcher.'
      },
      heroImageType: '',
      image: '',
      heroImageAlt: '',
      heroImageCaption: '',
      introQuote: {
        quote: '',
        author: '',
        source: ''
      },
      editorsPick: null,
      quickPicks: [],
      budgetSections: [],
      howToPick: {
        title: 'Curatorial Principles',
        content: '',
        rules: []
      },
      whatToAvoid: {
        title: 'What to Avoid',
        summary: '',
        items: []
      },
      relatedGuideSlugs: []
    };
  });

  const [bodyMarkdown, setBodyMarkdown] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');

  // Author Presets from _data/authors.yml
  const [authorPresets, setAuthorPresets] = useState<Record<string, any>>({});
  const [allExistingGuides, setAllExistingGuides] = useState<string[]>([]);

  // Editor View & Navigation State
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'split'>('editor');
  const [activeTab, setActiveTab] = useState<'narrative' | 'settings' | 'sections' | 'rules'>('narrative');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    (window as any).cmsIsDirty = isDirty;
    return () => {
      (window as any).cmsIsDirty = false;
    };
  }, [isDirty]);

  // Modals
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    type: 'editorsPick' | 'quickPick' | 'budgetProduct';
    sectionIndex?: number;
  } | null>(null);

  // Load existing authors & guide metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [authRes, guidesRes] = await Promise.all([
          fetch('/api/authors'),
          fetch('/api/guides')
        ]);
        const authData = await authRes.json();
        const guidesData = await guidesRes.json();
        if (authData.success && authData.authors) {
          setAuthorPresets(authData.authors);
        }
        if (guidesData.success && Array.isArray(guidesData.guides)) {
          setAllExistingGuides(guidesData.guides.map((g: any) => g.slug));
        }
      } catch (err) {
        console.warn('Failed to load author or guide list metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Load Guide Data if Editing
  useEffect(() => {
    if (isNew) return;
    const fetchGuide = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guides/${guideSlug}`);
        const data = await res.json();
        if (data.success && data.guide) {
          const fm = data.guide.frontMatter || {};
          const normalizedPublished = normalizeToIsoDate(fm.publishedDate);
          const normalizedLastMod = normalizeToIsoDate(fm.lastModifiedDate || fm.updatedDate);
          setFrontMatter({
            ...fm,
            publishedDate: normalizedPublished,
            lastModifiedDate: normalizedLastMod
          });
          setUserModifiedDateEdited(false);
          setBodyMarkdown(data.guide.body || '');
          setBodyHtml(data.guide.html || '');
          setIsDirty(false);
        } else {
          setToast({ text: data.error || 'Failed to load guide', error: true });
        }
      } catch (err: any) {
        setToast({ text: err.message || 'Error loading guide', error: true });
      } finally {
        setLoading(false);
      }
    };
    fetchGuide();
  }, [guideSlug, isNew]);

  // Handle Title Change & Slug Auto-suggestion for new guides
  const handleTitleChange = (val: string) => {
    setIsDirty(true);
    setFrontMatter(prev => {
      const next = { ...prev, title: val };
      if (isNew && (!prev.slug || prev.slug === prev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))) {
        next.slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
      return next;
    });
  };

  // Handle Author Preset Selection
  const handleAuthorPresetSelect = (key: string) => {
    setIsDirty(true);
    const preset = authorPresets[key];
    if (preset) {
      setFrontMatter(prev => ({
        ...prev,
        author: {
          name: preset.name || '',
          role: preset.role || '',
          bio: preset.bio || ''
        }
      }));
    }
  };

  // Product Selection Handler from Catalog Picker
  const handleProductSelect = (product: Product) => {
    setIsDirty(true);
    if (!pickerTarget) return;

    // Convert product into guide product format
    const guideProd = {
      id: product.id,
      title: product.title,
      tagline: product.whatMakesItStandOut || product.idealFor || '',
      price: product.price,
      priceNumber: product.priceNumber,
      priceRange: product.priceRange,
      vendor: product.vendor,
      vendorUrl: product.vendorUrl || '',
      category: product.category,
      badgeLabel: product.badgeLabel || null,
      imageType: product.imageType || product.image || product.id,
      recipient: product.recipients || [],
      ageRanges: product.ageRanges || [],
      interests: product.interests || [],
      occasions: product.occasions || [],
      personalityStyles: product.personalityStyles || [],
      editorialReview: product.editorialReview || '',
      whyItMakesAGreatGift: product.whyItMakesAGreatGift || '',
      idealFor: product.idealFor || '',
      whatMakesItStandOut: product.whatMakesItStandOut || '',
      thingsToConsider: product.thingsToConsider || '',
      specs: product.specs || []
    };

    if (pickerTarget.type === 'editorsPick') {
      setFrontMatter(prev => ({ ...prev, editorsPick: guideProd }));
    } else if (pickerTarget.type === 'quickPick') {
      setFrontMatter(prev => ({
        ...prev,
        quickPicks: [...(prev.quickPicks || []), guideProd]
      }));
    } else if (pickerTarget.type === 'budgetProduct' && pickerTarget.sectionIndex !== undefined) {
      setFrontMatter(prev => {
        const sections = [...(prev.budgetSections || [])];
        const targetSec = { ...sections[pickerTarget.sectionIndex!] };
        targetSec.products = [...(targetSec.products || []), guideProd];
        sections[pickerTarget.sectionIndex!] = targetSec;
        return { ...prev, budgetSections: sections };
      });
    }

    setPickerTarget(null);
  };

  // Save Guide to Disk
  const handleSave = async () => {
    if (!frontMatter.title.trim()) {
      setToast({ text: 'Please enter a guide title before saving.', error: true });
      return;
    }
    if (!frontMatter.slug.trim()) {
      setToast({ text: 'Please enter a valid guide slug before saving.', error: true });
      return;
    }

    setIsSaving(true);
    setToast(null);

    const today = getTodayIsoDate();
    let finalLastModified = frontMatter.lastModifiedDate || '';

    if (isNew) {
      if (!finalLastModified) {
        finalLastModified = frontMatter.publishedDate || today;
      }
    } else {
      if (isDirty && !userModifiedDateEdited) {
        finalLastModified = today;
      } else if (!finalLastModified) {
        finalLastModified = today;
      }
    }

    const frontMatterToSave: any = {
      ...frontMatter,
      lastModifiedDate: finalLastModified
    };
    delete frontMatterToSave.updatedDate;

    if (finalLastModified !== frontMatter.lastModifiedDate) {
      setFrontMatter(p => ({ ...p, lastModifiedDate: finalLastModified }));
    }

    try {
      const endpoint = isNew ? '/api/guides' : `/api/guides/${guideSlug}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontMatter: frontMatterToSave,
          body: bodyMarkdown
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsDirty(false);
        setUserModifiedDateEdited(false);
        setToast({ text: data.message || 'Guide saved successfully!' });
        if (onSaved) {
          onSaved(data.slug);
        }
      } else {
        setToast({ text: data.error || 'Failed to save guide', error: true });
      }
    } catch (err: any) {
      setToast({ text: err.message || 'Network error while saving guide', error: true });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-3 bg-white border border-[#99BFF9]/30 my-8 max-w-4xl mx-auto">
        <div className="animate-spin w-8 h-8 border-3 border-[#2A548E] border-t-transparent rounded-full mx-auto" />
        <p className="font-serif text-base text-[#1E232B]">Opening Gift Guide...</p>
        <p className="text-xs text-[#5A6270]">Parsing front matter and Markdown body from disk</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. TOP STICKY COMMAND BAR */}
      <div className="sticky top-20 z-30 bg-[#FAF9F6]/95 backdrop-blur-xs border-b border-[#99BFF9]/30 py-3 px-4 sm:px-6 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-white border border-transparent hover:border-[#99BFF9]/30 transition-all cursor-pointer flex items-center gap-1 text-xs"
              title="Return to Guide Catalog"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Guides</span>
            </button>
            <div className="h-4 w-px bg-stone-300 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-semibold text-[#1E232B] truncate max-w-xs sm:max-w-md">
                  {frontMatter.title || 'New Gift Guide'}
                </span>
                {isDirty && (
                  <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono font-semibold bg-amber-100 text-amber-800 rounded">
                    Unsaved
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono-code text-[#5A6270]">
                _guides/{frontMatter.slug || '...'}.md
              </span>
            </div>
          </div>

          {/* Center Mode Switcher */}
          <div className="flex items-center border border-[#99BFF9]/35 bg-white p-0.5 rounded-none text-xs">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'editor' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-3 py-1.5 font-medium transition-colors cursor-pointer items-center gap-1.5 ${
                viewMode === 'split' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'preview' ? 'bg-[#2A548E] text-white' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* AI Assistant Button */}
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open Gift Guide AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>

            {!isNew && (
              <button
                type="button"
                onClick={() => setShowBackupsModal(true)}
                className="px-3 py-2 text-xs text-[#5A6270] hover:text-[#1E232B] hover:bg-white border border-[#99BFF9]/30 transition-colors cursor-pointer flex items-center gap-1.5"
                title="View Guide Backups & Snapshots"
              >
                <History className="w-3.5 h-3.5 text-[#2A548E]" />
                <span className="hidden sm:inline">Backups</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-[#2A548E] hover:bg-[#1E3E6B] text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Writing File...' : 'Save Guide'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOAST MESSAGE */}
      {toast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className={`p-3.5 text-xs flex items-center justify-between border ${
              toast.error
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-[#E8F8F1] border-[#226E56]/30 text-[#154D3B]'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{toast.text}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. WORKSPACE CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className={`grid gap-8 items-start ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* LEFT: EDITORIAL WRITING & STRUCTURE PANELS */}
          {viewMode !== 'preview' && (
            <div className="space-y-6">
              {/* Internal Tab Navigator */}
              <div className="flex border-b border-[#99BFF9]/30 text-xs bg-white">
                <button
                  type="button"
                  onClick={() => setActiveTab('narrative')}
                  className={`px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'narrative'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/50 font-semibold'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Narrative & Essay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'settings'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/50 font-semibold'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Metadata & Author</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sections')}
                  className={`px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'sections'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/50 font-semibold'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Curated Products & Sections</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('rules')}
                  className={`px-4 py-2.5 font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'rules'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/50 font-semibold'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Principles & Pitfalls</span>
                </button>
              </div>

              {/* TAB 1: NARRATIVE & ESSAY (WORDPRESS-LIKE WRITING CANVAS) */}
              {activeTab === 'narrative' && (
                <div className="space-y-6">
                  {/* Title & Deck Quick Edit */}
                  <div className="bg-white border border-[#99BFF9]/30 p-6 space-y-4 shadow-2xs">
                    <div className="space-y-1">
                      <label className="text-[11px] uppercase tracking-wider font-semibold text-[#5A6270]">
                        Guide Headline
                      </label>
                      <input
                        type="text"
                        value={frontMatter.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="e.g., Gifts for Book Lovers (That Aren't Just More Books)"
                        className="w-full font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-medium border-b border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none pb-1 bg-transparent"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] uppercase tracking-wider font-semibold text-[#5A6270]">
                        Editorial Deck / Subtitle
                      </label>
                      <textarea
                        value={frontMatter.deck}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, deck: e.target.value }));
                        }}
                        rows={2}
                        placeholder="Concise curatorial summary of this guide..."
                        className="w-full text-sm text-[#5A6270] leading-relaxed border border-[#99BFF9]/30 p-3 focus:border-[#2A548E] focus:outline-none bg-[#FAF9F6]"
                      />
                    </div>
                  </div>

                  {/* Intro Quote */}
                  <div className="bg-[#E8F8F1]/60 border border-[#226E56]/30 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#226E56] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Opening Editorial Quote</span>
                    </div>
                    <textarea
                      value={frontMatter.introQuote?.quote || ''}
                      onChange={(e) => {
                        setIsDirty(true);
                        setFrontMatter(p => ({
                          ...p,
                          introQuote: { ...(p.introQuote || { author: '', source: '' }), quote: e.target.value }
                        }));
                      }}
                      rows={2}
                      placeholder="e.g., Buying a book for an obsessive reader is dangerous because they have likely already read it..."
                      className="w-full font-serif italic text-sm text-[#154D3B] p-2.5 bg-white border border-[#226E56]/30 focus:outline-none focus:border-[#226E56]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-[#226E56] uppercase font-medium">Quote Author</label>
                        <input
                          type="text"
                          value={frontMatter.introQuote?.author || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              introQuote: { ...(p.introQuote || { quote: '', source: '' }), author: e.target.value }
                            }));
                          }}
                          placeholder="Clara Vance"
                          className="w-full p-2 bg-white border border-[#226E56]/30 text-xs text-[#1E232B] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#226E56] uppercase font-medium">Quote Source / Title</label>
                        <input
                          type="text"
                          value={frontMatter.introQuote?.source || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              introQuote: { ...(p.introQuote || { quote: '', author: '' }), source: e.target.value }
                            }));
                          }}
                          placeholder="Science of Gifts Editor-in-Chief"
                          className="w-full p-2 bg-white border border-[#226E56]/30 text-xs text-[#1E232B] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reusable Rich-Text Writing Engine for Introduction Essay */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                        Introductory Essay (Markdown Body)
                      </label>
                      <span className="text-[11px] text-[#5A6270]">
                        Visual formatting · Native spellcheck enabled
                      </span>
                    </div>

                    <RichTextEditor
                      initialMarkdown={bodyMarkdown}
                      onChange={(newMarkdown, newHtml) => {
                        setIsDirty(true);
                        setBodyMarkdown(newMarkdown);
                        setBodyHtml(newHtml);
                      }}
                      placeholder="Write your introductory essay exploring the philosophy and curatorial criteria for this category..."
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: SETTINGS & METADATA */}
              {activeTab === 'settings' && (
                <div className="bg-white border border-[#99BFF9]/30 p-6 space-y-6 shadow-2xs">
                  {/* SEO / Search Engine Metadata Overrides */}
                  <div className="p-4 bg-[#EEF5FF]/60 border border-[#99BFF9]/30 rounded-xs space-y-4">
                    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                      <Globe className="w-4 h-4 text-[#2A548E]" />
                      <span>Search Engine &amp; Browser Metadata</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#1E232B] mb-0.5">
                          Search / SEO Title
                        </label>
                        <input
                          type="text"
                          value={frontMatter['search-title'] || frontMatter.searchTitle || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, 'search-title': e.target.value, searchTitle: e.target.value }));
                          }}
                          placeholder="Optional. e.g. Gifts for History Lovers That Get Used"
                          className="w-full p-2.5 text-xs bg-white border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                        />
                        <p className="text-[11px] text-[#5A6270] mt-1">
                          Optional. Used for the browser title and search engines. If empty, the page title is used.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#1E232B] mb-0.5">
                          SEO Description
                        </label>
                        <textarea
                          value={frontMatter['seo-description'] || frontMatter.seoDescription || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, 'seo-description': e.target.value, seoDescription: e.target.value }));
                          }}
                          rows={2}
                          placeholder="Optional meta description for Google search snippets and social cards..."
                          className="w-full p-2.5 text-xs bg-white border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                        />
                        <p className="text-[11px] text-[#5A6270] mt-1">
                          Optional. Used for the search-engine meta description and social metadata. If empty, the page description/deck is used.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1E232B]">Category</label>
                      <input
                        type="text"
                        value={frontMatter.category}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, category: e.target.value }));
                        }}
                        placeholder="e.g. Books, History, Curation"
                        className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1E232B]">File Slug (filename)</label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-2 text-xs bg-stone-100 border border-r-0 border-[#99BFF9]/30 text-stone-500 font-mono">
                          _guides/
                        </span>
                        <input
                          type="text"
                          value={frontMatter.slug}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') }));
                          }}
                          placeholder="guide-slug"
                          className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 font-mono focus:border-[#2A548E] focus:outline-none"
                        />
                        <span className="px-2.5 py-2 text-xs bg-stone-100 border border-l-0 border-[#99BFF9]/30 text-stone-500 font-mono">
                          .md
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1E232B]">Estimated Read Time</label>
                      <input
                        type="text"
                        value={frontMatter.readTime}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, readTime: e.target.value }));
                        }}
                        placeholder="e.g., 9 min read"
                        className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1E232B]">Published Date</label>
                      <input
                        type="date"
                        value={frontMatter.publishedDate || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, publishedDate: e.target.value }));
                        }}
                        className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                      />
                      <span className="block text-[10px] text-[#5A6270]/70">Format: YYYY-MM-DD</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[#1E232B]">Last Modified Date</label>
                      <input
                        type="date"
                        value={frontMatter.lastModifiedDate || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setUserModifiedDateEdited(true);
                          setFrontMatter(p => {
                            const updated: any = { ...p, lastModifiedDate: e.target.value };
                            delete updated.updatedDate;
                            return updated;
                          });
                        }}
                        className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:border-[#2A548E] focus:outline-none"
                      />
                      <span className="block text-[10px] text-[#5A6270]/70">Updates to today on edit if unedited</span>
                    </div>
                  </div>

                  {/* Author Selector & Details */}
                  <div className="pt-4 border-t border-[#99BFF9]/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                        Author Information
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#5A6270]">Load preset:</span>
                        {Object.keys(authorPresets).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleAuthorPresetSelect(key)}
                            className="px-2 py-0.5 text-[11px] bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 hover:bg-[#2A548E] hover:text-white transition-colors cursor-pointer"
                          >
                            {authorPresets[key].name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-[#5A6270]">Author Name</label>
                        <input
                          type="text"
                          value={frontMatter.author?.name || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              author: { ...(p.author || { role: '', bio: '' }), name: e.target.value }
                            }));
                          }}
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#5A6270]">Author Role</label>
                        <input
                          type="text"
                          value={frontMatter.author?.role || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              author: { ...(p.author || { name: '', bio: '' }), role: e.target.value }
                            }));
                          }}
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-[#5A6270]">Author Biography</label>
                        <textarea
                          value={frontMatter.author?.bio || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              author: { ...(p.author || { name: '', role: '' }), bio: e.target.value }
                            }));
                          }}
                          rows={2}
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hero Visual Details */}
                  <div className="pt-4 border-t border-[#99BFF9]/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Hero Image Settings
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAssetPicker(true)}
                        className="px-2.5 py-1 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/30 rounded-xs text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Select Image from Library
                      </button>
                    </div>

                    {/* Preview of currently selected hero image */}
                    {(frontMatter.heroImageType || frontMatter.image) && (
                      <div className="p-3 bg-white border border-[#99BFF9]/30 rounded-xs flex items-center gap-3">
                        <div className="w-20 h-14 bg-stone-100 rounded-xs overflow-hidden shrink-0 border border-stone-200 flex items-center justify-center">
                          <img
                            src={
                              (frontMatter.heroImageType || frontMatter.image || '').startsWith('/') ||
                              (frontMatter.heroImageType || frontMatter.image || '').startsWith('assets/')
                                ? `/${(frontMatter.heroImageType || frontMatter.image || '').replace(/^\/+/, '')}`
                                : `/assets/${frontMatter.heroImageType || frontMatter.image}.jpg`
                            }
                            alt={frontMatter.heroImageAlt || 'Hero preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `/assets/images/${frontMatter.heroImageType || frontMatter.image}.jpg`;
                            }}
                          />
                        </div>
                        <div className="truncate flex-1 space-y-0.5">
                          <div className="font-mono-code text-xs text-[#2A548E] truncate">
                            {frontMatter.heroImageType || frontMatter.image}
                          </div>
                          <div className="text-[11px] text-[#5A6270] truncate">
                            Alt: {frontMatter.heroImageAlt || <span className="italic text-amber-600">Missing alt text</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAssetPicker(true)}
                          className="text-xs text-[#2A548E] hover:underline font-semibold cursor-pointer shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-[#5A6270]">Image Reference / Type</label>
                        <input
                          type="text"
                          value={frontMatter.heroImageType || frontMatter.image || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              heroImageType: e.target.value,
                              image: e.target.value
                            }));
                          }}
                          placeholder="e.g. assets/images/book-lovers-gifts.jpg"
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#5A6270]">Alt Text</label>
                        <input
                          type="text"
                          value={frontMatter.heroImageAlt || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, heroImageAlt: e.target.value }));
                          }}
                          placeholder="Descriptive visual alt text"
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[11px] text-[#5A6270]">Curatorial Caption</label>
                        <input
                          type="text"
                          value={frontMatter.heroImageCaption || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, heroImageCaption: e.target.value }));
                          }}
                          placeholder="Caption rendered beneath the hero photo in italics"
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SEO & Search Indexing Controls */}
                  <div className="pt-4 border-t border-[#99BFF9]/20 space-y-4">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-rose-600" />
                      SEO &amp; Search Indexing Controls
                    </label>
                    <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/25 rounded space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] text-[#5A6270] font-semibold mb-1">
                            Search Engine Visibility
                          </label>
                          <select
                            value={
                              frontMatter.robots && typeof frontMatter.robots === 'object' && frontMatter.robots.index === false
                                ? 'noindex'
                                : 'index'
                            }
                            onChange={(e) => {
                              setIsDirty(true);
                              const indexVal = e.target.value === 'index';
                              const currentFollow = frontMatter.robots && typeof frontMatter.robots === 'object' ? frontMatter.robots.follow !== false : true;
                              setFrontMatter(p => ({
                                ...p,
                                robots: { index: indexVal, follow: currentFollow }
                              }));
                            }}
                            className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                          >
                            <option value="index">INDEX (Allow search engines to show this page - default)</option>
                            <option value="noindex">NOINDEX (Instruct search engines to hide this page)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#5A6270] font-semibold mb-1">
                            Link Crawling Directives
                          </label>
                          <select
                            value={
                              frontMatter.robots && typeof frontMatter.robots === 'object' && frontMatter.robots.follow === false
                                ? 'nofollow'
                                : 'follow'
                            }
                            onChange={(e) => {
                              setIsDirty(true);
                              const followVal = e.target.value === 'follow';
                              const currentIndex = frontMatter.robots && typeof frontMatter.robots === 'object' ? frontMatter.robots.index !== false : true;
                              setFrontMatter(p => ({
                                ...p,
                                robots: { index: currentIndex, follow: followVal }
                              }));
                            }}
                            className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
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

                </div>
              )}

              {/* TAB 3: CURATED PRODUCTS & STRUCTURED SECTIONS */}
              {activeTab === 'sections' && (
                <div className="space-y-8">
                  {/* A. Editor's Pick */}
                  <div className="bg-white border-2 border-[#C3F3DF] p-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#226E56]">The Centerpiece Object</span>
                        <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">Editor's Pick</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerTarget({ type: 'editorsPick' })}
                        className="px-3 py-1.5 bg-[#EEF5FF] text-[#2A548E] hover:bg-[#2A548E] hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border border-[#99BFF9]/30"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>{frontMatter.editorsPick ? 'Change Product' : 'Select from Catalog'}</span>
                      </button>
                    </div>

                    {frontMatter.editorsPick ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 flex items-center justify-between text-xs">
                          <div>
                            <strong className="text-[#1E232B] text-sm">{frontMatter.editorsPick.title}</strong>
                            <div className="text-[11px] text-[#5A6270]">
                              ID: {frontMatter.editorsPick.id} · Price: {frontMatter.editorsPick.price} · Vendor: {frontMatter.editorsPick.vendor}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDirty(true);
                              setFrontMatter(p => ({ ...p, editorsPick: null }));
                            }}
                            className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="Remove Editor's Pick"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-[#5A6270]">Badge Label</label>
                            <input
                              type="text"
                              value={frontMatter.editorsPick.badgeLabel || ''}
                              onChange={(e) => {
                                setIsDirty(true);
                                setFrontMatter(p => ({
                                  ...p,
                                  editorsPick: { ...p.editorsPick, badgeLabel: e.target.value }
                                }));
                              }}
                              placeholder="e.g. Reader's Essential"
                              className="w-full p-2 bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-[#5A6270]">Curatorial Tagline</label>
                            <input
                              type="text"
                              value={frontMatter.editorsPick.tagline || ''}
                              onChange={(e) => {
                                setIsDirty(true);
                                setFrontMatter(p => ({
                                  ...p,
                                  editorsPick: { ...p.editorsPick, tagline: e.target.value }
                                }));
                              }}
                              placeholder="Concise one-sentence hook"
                              className="w-full p-2 bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] uppercase tracking-wider text-[#5A6270]">Why It Makes a Singular Gift</label>
                            <input
                              type="text"
                              value={frontMatter.editorsPick.whyItMakesAGreatGift || ''}
                              onChange={(e) => {
                                setIsDirty(true);
                                setFrontMatter(p => ({
                                  ...p,
                                  editorsPick: { ...p.editorsPick, whyItMakesAGreatGift: e.target.value }
                                }));
                              }}
                              className="w-full p-2 bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-[#FAF9F6] border border-dashed border-[#99BFF9]/40 text-xs text-[#5A6270] space-y-2">
                        <Package className="w-6 h-6 mx-auto opacity-50" />
                        <p>No product designated as the Editor's Pick yet.</p>
                      </div>
                    )}
                  </div>

                  {/* B. Quick Picks List */}
                  <div className="bg-white border border-[#99BFF9]/30 p-6 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#226E56]">Immediate Solutions</span>
                        <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">
                          Quick Recommendations ({frontMatter.quickPicks?.length || 0})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerTarget({ type: 'quickPick' })}
                        className="px-3 py-1.5 bg-[#EEF5FF] text-[#2A548E] hover:bg-[#2A548E] hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border border-[#99BFF9]/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Quick Pick</span>
                      </button>
                    </div>

                    {frontMatter.quickPicks && frontMatter.quickPicks.length > 0 ? (
                      <div className="space-y-3">
                        {frontMatter.quickPicks.map((qp: any, idx: number) => (
                          <div
                            key={qp.id || idx}
                            className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#154D3B]">{qp.price}</span>
                                <span className="font-semibold text-[#1E232B]">{qp.title}</span>
                              </div>
                              <input
                                type="text"
                                value={qp.tagline || ''}
                                onChange={(e) => {
                                  setIsDirty(true);
                                  const updated = [...(frontMatter.quickPicks || [])];
                                  updated[idx] = { ...updated[idx], tagline: e.target.value };
                                  setFrontMatter(p => ({ ...p, quickPicks: updated }));
                                }}
                                placeholder="Custom guide tagline..."
                                className="w-full text-xs p-1 bg-white border border-[#99BFF9]/30 focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  setIsDirty(true);
                                  const updated = [...(frontMatter.quickPicks || [])];
                                  const [moved] = updated.splice(idx, 1);
                                  updated.splice(idx - 1, 0, moved);
                                  setFrontMatter(p => ({ ...p, quickPicks: updated }));
                                }}
                                className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 cursor-pointer"
                                title="Move Up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === (frontMatter.quickPicks?.length || 1) - 1}
                                onClick={() => {
                                  setIsDirty(true);
                                  const updated = [...(frontMatter.quickPicks || [])];
                                  const [moved] = updated.splice(idx, 1);
                                  updated.splice(idx + 1, 0, moved);
                                  setFrontMatter(p => ({ ...p, quickPicks: updated }));
                                }}
                                className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-30 cursor-pointer"
                                title="Move Down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsDirty(true);
                                  const updated = (frontMatter.quickPicks || []).filter((_, i) => i !== idx);
                                  setFrontMatter(p => ({ ...p, quickPicks: updated }));
                                }}
                                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No Quick Picks added yet.</p>
                    )}
                  </div>

                  {/* C. Budget & Thematic Sections */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#2A548E]">Catalog Organization</span>
                        <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">Budget & Curated Sections</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDirty(true);
                          const newSec = {
                            id: `section-${Date.now().toString().slice(-4)}`,
                            title: 'New Section',
                            description: 'Section subtitle and framing notes.',
                            products: []
                          };
                          setFrontMatter(p => ({
                            ...p,
                            budgetSections: [...(p.budgetSections || []), newSec]
                          }));
                        }}
                        className="px-3 py-1.5 bg-[#2A548E] text-white hover:bg-[#1E3E6B] transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Section</span>
                      </button>
                    </div>

                    {(frontMatter.budgetSections || []).map((sec: any, secIdx: number) => (
                      <div key={sec.id || secIdx} className="bg-white border border-[#99BFF9]/30 p-5 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                          <div className="flex-1 mr-4 space-y-2">
                            <input
                              type="text"
                              value={sec.title}
                              onChange={(e) => {
                                setIsDirty(true);
                                const updated = [...(frontMatter.budgetSections || [])];
                                updated[secIdx] = { ...updated[secIdx], title: e.target.value };
                                setFrontMatter(p => ({ ...p, budgetSections: updated }));
                              }}
                              placeholder="Section Title (e.g., Under $50 — Archival Tools)"
                              className="w-full font-serif text-base font-semibold text-[#1E232B] border-b border-transparent focus:border-[#2A548E] focus:outline-none bg-transparent"
                            />
                            <input
                              type="text"
                              value={sec.description || ''}
                              onChange={(e) => {
                                setIsDirty(true);
                                const updated = [...(frontMatter.budgetSections || [])];
                                updated[secIdx] = { ...updated[secIdx], description: e.target.value };
                                setFrontMatter(p => ({ ...p, budgetSections: updated }));
                              }}
                              placeholder="Brief section explanation..."
                              className="w-full text-xs text-[#5A6270] border-b border-transparent focus:border-[#2A548E] focus:outline-none bg-transparent"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPickerTarget({ type: 'budgetProduct', sectionIndex: secIdx })}
                              className="px-2.5 py-1 bg-[#EEF5FF] text-[#2A548E] hover:bg-[#2A548E] hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Product</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsDirty(true);
                                const updated = (frontMatter.budgetSections || []).filter((_, i) => i !== secIdx);
                                setFrontMatter(p => ({ ...p, budgetSections: updated }));
                              }}
                              className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer ml-1"
                              title="Delete Section"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Products inside section */}
                        <div className="space-y-2">
                          {(sec.products || []).map((prod: any, prodIdx: number) => (
                            <div
                              key={prod.id || prodIdx}
                              className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#154D3B] mr-2">{prod.price}</span>
                                <strong className="text-[#1E232B]">{prod.title}</strong>
                                <span className="text-[#5A6270] ml-2">({prod.vendor})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsDirty(true);
                                    const updatedSecs = [...(frontMatter.budgetSections || [])];
                                    const prods = (updatedSecs[secIdx].products || []).filter((_: any, i: number) => i !== prodIdx);
                                    updatedSecs[secIdx] = { ...updatedSecs[secIdx], products: prods };
                                    setFrontMatter(p => ({ ...p, budgetSections: updatedSecs }));
                                  }}
                                  className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Remove product from section"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* D. Related Guides */}
                  <div className="bg-white border border-[#99BFF9]/30 p-5 space-y-3 shadow-2xs">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] block">
                      Related Gift Guides
                    </label>
                    <p className="text-xs text-[#5A6270]">Select existing guides to link at the bottom of this article:</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {allExistingGuides.filter(s => s !== frontMatter.slug).map((gSlug) => {
                        const isSelected = (frontMatter.relatedGuideSlugs || []).includes(gSlug);
                        return (
                          <button
                            key={gSlug}
                            type="button"
                            onClick={() => {
                              setIsDirty(true);
                              setFrontMatter(prev => {
                                const current = prev.relatedGuideSlugs || [];
                                const updated = isSelected
                                  ? current.filter(s => s !== gSlug)
                                  : [...current, gSlug];
                                return { ...prev, relatedGuideSlugs: updated };
                              });
                            }}
                            className={`px-3 py-1 text-xs transition-colors cursor-pointer border ${
                              isSelected
                                ? 'bg-[#2A548E] text-white border-[#2A548E]'
                                : 'bg-[#FAF9F6] text-[#5A6270] border-[#99BFF9]/30 hover:border-[#2A548E]'
                            }`}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {gSlug}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CURATORIAL PRINCIPLES & PITFALLS */}
              {activeTab === 'rules' && (
                <div className="space-y-8">
                  {/* How To Pick Rules */}
                  <div className="bg-white border border-[#99BFF9]/30 p-6 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#226E56]">Curatorial Principles</span>
                        <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">How to Pick Rules</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDirty(true);
                          const newRule = { title: `Rule ${(frontMatter.howToPick?.rules?.length || 0) + 1}: `, explanation: '' };
                          setFrontMatter(p => ({
                            ...p,
                            howToPick: {
                              ...(p.howToPick || { title: 'How to Pick', content: '', rules: [] }),
                              rules: [...(p.howToPick?.rules || []), newRule]
                            }
                          }));
                        }}
                        className="px-3 py-1.5 bg-[#EEF5FF] text-[#2A548E] hover:bg-[#2A548E] hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Principle</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] text-[#5A6270]">Section Title</label>
                        <input
                          type="text"
                          value={frontMatter.howToPick?.title || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              howToPick: { ...(p.howToPick || { rules: [] }), title: e.target.value }
                            }));
                          }}
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none"
                        />
                      </div>

                      {(frontMatter.howToPick?.rules || []).map((rule, idx) => (
                        <div key={idx} className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={rule.title}
                              onChange={(e) => {
                                setIsDirty(true);
                                const rules = [...(frontMatter.howToPick?.rules || [])];
                                rules[idx] = { ...rules[idx], title: e.target.value };
                                setFrontMatter(p => ({
                                  ...p,
                                  howToPick: { ...(p.howToPick || { title: '' }), rules }
                                }));
                              }}
                              placeholder="e.g., Rule 1: Demand material authenticity"
                              className="font-semibold text-[#1E232B] w-full mr-2 p-1 bg-white border border-[#99BFF9]/30 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsDirty(true);
                                const rules = (frontMatter.howToPick?.rules || []).filter((_, i) => i !== idx);
                                setFrontMatter(p => ({
                                  ...p,
                                  howToPick: { ...(p.howToPick || { title: '' }), rules }
                                }));
                              }}
                              className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <textarea
                            value={rule.explanation}
                            onChange={(e) => {
                              setIsDirty(true);
                              const rules = [...(frontMatter.howToPick?.rules || [])];
                              rules[idx] = { ...rules[idx], explanation: e.target.value };
                              setFrontMatter(p => ({
                                ...p,
                                howToPick: { ...(p.howToPick || { title: '' }), rules }
                              }));
                            }}
                            rows={2}
                            placeholder="Detailed explanation of this curatorial guideline..."
                            className="w-full p-2 bg-white border border-[#99BFF9]/30 text-xs text-[#5A6270] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* What to Avoid Pitfalls */}
                  <div className="bg-white border border-rose-200 p-6 space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700">The Pitfalls</span>
                        <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">What to Avoid</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDirty(true);
                          const newItem = { mistake: 'Generic Novelty', explanation: '' };
                          setFrontMatter(p => ({
                            ...p,
                            whatToAvoid: {
                              ...(p.whatToAvoid || { title: 'What to Avoid', items: [] }),
                              items: [...(p.whatToAvoid?.items || []), newItem]
                            }
                          }));
                        }}
                        className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border border-rose-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Pitfall</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(frontMatter.whatToAvoid?.items || []).map((itm, idx) => (
                        <div key={idx} className="p-3 bg-rose-50/40 border border-rose-200 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={itm.mistake || itm.title || ''}
                              onChange={(e) => {
                                setIsDirty(true);
                                const items = [...(frontMatter.whatToAvoid?.items || [])];
                                items[idx] = { ...items[idx], mistake: e.target.value, title: e.target.value };
                                setFrontMatter(p => ({
                                  ...p,
                                  whatToAvoid: { ...(p.whatToAvoid || { title: '' }), items }
                                }));
                              }}
                              placeholder="Mistake / Pitfall headline"
                              className="font-semibold text-rose-900 w-full mr-2 p-1 bg-white border border-rose-200 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsDirty(true);
                                const items = (frontMatter.whatToAvoid?.items || []).filter((_, i) => i !== idx);
                                setFrontMatter(p => ({
                                  ...p,
                                  whatToAvoid: { ...(p.whatToAvoid || { title: '' }), items }
                                }));
                              }}
                              className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <textarea
                            value={itm.explanation || itm.description || ''}
                            onChange={(e) => {
                              setIsDirty(true);
                              const items = [...(frontMatter.whatToAvoid?.items || [])];
                              items[idx] = { ...items[idx], explanation: e.target.value, description: e.target.value };
                              setFrontMatter(p => ({
                                ...p,
                                whatToAvoid: { ...(p.whatToAvoid || { title: '' }), items }
                              }));
                            }}
                            rows={2}
                            placeholder="Why this item or idea fails as a thoughtful gift..."
                            className="w-full p-2 bg-white border border-rose-200 text-xs text-[#5A6270] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RIGHT / FULL: LIVE PREVIEW */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`overflow-y-auto ${viewMode === 'preview' ? 'max-w-4xl mx-auto w-full' : ''}`}>
              <GuidePreview
                frontMatter={frontMatter}
                bodyHtml={bodyHtml}
              />
            </div>
          )}
        </div>
      </div>

      {/* Catalog Product Picker Modal */}
      <ProductPickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelectProduct={handleProductSelect}
      />

      {/* Backups & Snapshot History Modal */}
      <GuideBackupsModal
        isOpen={showBackupsModal}
        onClose={() => setShowBackupsModal(false)}
        activeSlug={frontMatter.slug}
        onRestoreSuccess={(restoredSlug) => {
          setShowBackupsModal(false);
          window.location.reload();
        }}
      />

      {/* Reusable Asset Picker Modal */}
      <AssetPickerModal
        isOpen={showAssetPicker}
        onClose={() => setShowAssetPicker(false)}
        initialAltText={frontMatter.heroImageAlt || ''}
        initialCaption={frontMatter.heroImageCaption || ''}
        showCaptionInput={true}
        onSelect={(selected) => {
          setIsDirty(true);
          setFrontMatter(p => ({
            ...p,
            heroImageType: selected.path,
            image: selected.path,
            heroImageAlt: selected.altText || p.heroImageAlt,
            heroImageCaption: selected.caption || p.heroImageCaption
          }));
        }}
      />

      {/* Gift Guide AI Assistant Modal */}
      <GuideAiModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        guide={{
          frontMatter,
          body: bodyMarkdown
        }}
        onApplyTitle={(newTitle) => {
          setIsDirty(true);
          setFrontMatter(p => ({ ...p, title: newTitle }));
        }}
        onApplyDeck={(newDeck) => {
          setIsDirty(true);
          setFrontMatter(p => ({ ...p, deck: newDeck }));
        }}
        onApplyIntro={(newIntro) => {
          setIsDirty(true);
          setBodyMarkdown(prev => {
            const trimmed = (prev || '').trim();
            if (!trimmed) return newIntro;
            return `${newIntro}\n\n${trimmed}`;
          });
        }}
        onAppendToBody={(appendedText) => {
          setIsDirty(true);
          setBodyMarkdown(prev => `${(prev || '').trim()}\n\n${appendedText.trim()}\n`);
        }}
      />
    </div>
  );
};

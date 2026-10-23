import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Save,
  Eye,
  Columns,
  Edit3,
  History,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  BookOpen,
  Quote,
  Sparkles,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
  Copy,
  Check
} from 'lucide-react';
import { ArticleFrontMatter, ArticleSource } from '../../types/articles';
import { RichTextEditor } from '../editor/RichTextEditor';
import { AssetPickerModal } from '../assets/AssetPickerModal';
import { ArticlePreview } from './ArticlePreview';
import { ArticleBackupsModal } from './ArticleBackupsModal';
import { ArticleAiModal } from './ArticleAiModal';
import { useModalEscape } from '../../hooks/useModalEscape';
import { getTodayIsoDate, normalizeToIsoDate } from '../../utils/date';
import {
  getSourceId,
  normalizeCitationId,
  countCitationsBySource,
  replaceCitationIdInMarkdown
} from '../../utils/citations';
import { marked } from 'marked';

interface ArticleEditorProps {
  initialSlug: string | null; // null if creating a new article
  onBack: () => void;
  onSavedSuccess?: (slug: string) => void;
}

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  initialSlug,
  onBack,
  onSavedSuccess
}) => {
  useModalEscape(true, onBack);

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
  const [activeTab, setActiveTab] = useState<'frontmatter' | 'sources' | 'content'>('content');

  // Modals
  const [showAssetPicker, setShowAssetPicker] = useState<boolean>(false);
  const [showBackupsModal, setShowBackupsModal] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  // Citations State
  const [pendingDeleteSource, setPendingDeleteSource] = useState<{
    index: number;
    id: string;
    title: string;
    count: number;
  } | null>(null);
  const [copiedCitationKey, setCopiedCitationKey] = useState<string | null>(null);

  // Data lists
  const [availableAuthors, setAvailableAuthors] = useState<Record<string, any>>({});
  const [availableGuides, setAvailableGuides] = useState<Array<{ slug: string; title: string }>>([]);
  const [availableArticles, setAvailableArticles] = useState<Array<{ slug: string; title: string }>>([]);

  // Track whether the user explicitly edited the lastModifiedDate in this session
  const [userModifiedDateEdited, setUserModifiedDateEdited] = useState<boolean>(false);

  // Form State
  const [frontMatter, setFrontMatter] = useState<ArticleFrontMatter>(() => {
    const today = getTodayIsoDate();
    return {
      title: '',
      slug: '',
      deck: '',
      category: 'Gift Psychology',
      readTime: '5 min read',
      publishedDate: today,
      lastModifiedDate: today,
      author: {
        name: 'Clara Vance',
        role: 'Contributing Psychology Editor',
        bio: 'Clara Vance writes on behavioral economics, decision fatigue, and the anthropology of material culture.'
      },
      heroImageType: '',
      image: '',
      heroImageAlt: '',
      heroImageCaption: '',
      introQuote: { quote: '', author: '', source: '' },
      relatedGuideSlug: '',
      relatedArticleSlugs: [],
      sources: []
    };
  });

  const [bodyMarkdown, setBodyMarkdown] = useState<string>('');
  const [bodyHtml, setBodyHtml] = useState<string>('');

  // Expandable sections state
  const [showSourcesSection, setShowSourcesSection] = useState<boolean>(true);
  const [showIntroQuoteSection, setShowIntroQuoteSection] = useState<boolean>(false);

  useEffect(() => {
    loadAuxiliaryData();
    if (initialSlug) {
      loadArticle(initialSlug);
    } else {
      setLoading(false);
    }
  }, [initialSlug]);

  const loadAuxiliaryData = async () => {
    try {
      const [authRes, guideRes, artRes] = await Promise.all([
        fetch('/api/authors').then(r => r.json()).catch(() => ({})),
        fetch('/api/guides').then(r => r.json()).catch(() => ({})),
        fetch('/api/articles').then(r => r.json()).catch(() => ({}))
      ]);

      if (authRes.success) setAvailableAuthors(authRes.authors || {});
      if (guideRes.success) {
        setAvailableGuides((guideRes.guides || []).map((g: any) => ({ slug: g.slug, title: g.title })));
      }
      if (artRes.success) {
        setAvailableArticles(
          (artRes.articles || [])
            .filter((a: any) => a.slug !== initialSlug)
            .map((a: any) => ({ slug: a.slug, title: a.title }))
        );
      }
    } catch (err) {
      console.warn('Auxiliary data loading warning:', err);
    }
  };

  const loadArticle = async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${slug}`);
      const data = await res.json();
      if (data.success && data.article) {
        const fm = data.article.frontMatter || {};
        const normalizedPublished = normalizeToIsoDate(fm.publishedDate);
        const normalizedLastMod = normalizeToIsoDate(fm.lastModifiedDate || fm.updatedDate);
        setFrontMatter({
          ...fm,
          title: fm.title || '',
          slug: fm.slug || slug,
          deck: fm.deck || '',
          category: fm.category || 'Gift Psychology',
          readTime: fm.readTime || '',
          publishedDate: normalizedPublished,
          lastModifiedDate: normalizedLastMod,
          author: fm.author || { name: 'Science of Gifts Editorial', role: 'Editor' },
          heroImageType: fm.heroImageType || fm.image || '',
          image: fm.image || fm.heroImageType || '',
          heroImageAlt: fm.heroImageAlt || '',
          heroImageCaption: fm.heroImageCaption || '',
          introQuote: fm.introQuote || { quote: '', author: '', source: '' },
          relatedGuideSlug: fm.relatedGuideSlug || '',
          relatedArticleSlugs: Array.isArray(fm.relatedArticleSlugs) ? fm.relatedArticleSlugs : [],
          sources: Array.isArray(fm.sources) ? fm.sources : []
        });
        setUserModifiedDateEdited(false);

        const body = data.article.body || '';
        setBodyMarkdown(body);
        try {
          setBodyHtml(marked.parse(body) as string);
        } catch {
          setBodyHtml(body);
        }
        if (fm.introQuote?.quote) setShowIntroQuoteSection(true);
        if (Array.isArray(fm.sources) && fm.sources.length > 0) setShowSourcesSection(true);
        setIsDirty(false);
      } else {
        setError(data.error || 'Failed to load article.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching article details.');
    } finally {
      setLoading(false);
    }
  };

  // Body content change handler
  const handleBodyChange = useCallback((newMarkdown: string, newHtml?: string) => {
    setBodyMarkdown(newMarkdown);
    setIsDirty(true);
    if (newHtml) {
      setBodyHtml(newHtml);
    } else {
      try {
        setBodyHtml(marked.parse(newMarkdown, { gfm: true, breaks: true }) as string);
      } catch {
        setBodyHtml(newMarkdown);
      }
    }
  }, []);

  // Title / Slug auto-generator for new articles
  const handleTitleChange = (newTitle: string) => {
    setIsDirty(true);
    setFrontMatter(prev => {
      const updated = { ...prev, title: newTitle };
      if (!initialSlug && (!prev.slug || prev.slug === slugify(prev.title))) {
        updated.slug = slugify(newTitle);
      }
      return updated;
    });
  };

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Author selection handler
  const handleAuthorKeyChange = (authorKey: string) => {
    setIsDirty(true);
    if (availableAuthors[authorKey]) {
      const selected = availableAuthors[authorKey];
      setFrontMatter(prev => ({
        ...prev,
        author: {
          name: selected.name,
          role: selected.role,
          bio: selected.bio
        }
      }));
    }
  };

  // Sources & Citation counts
  const citationCounts = useMemo(() => {
    return countCitationsBySource(bodyMarkdown, frontMatter.sources || []);
  }, [bodyMarkdown, frontMatter.sources]);

  // Sources manipulation
  const handleAddSource = () => {
    setIsDirty(true);
    setFrontMatter(prev => ({
      ...prev,
      sources: [
        ...(prev.sources || []),
        { id: '', title: '', author: '', publication: '', year: '', url: '', annotation: '' }
      ]
    }));
  };

  const handleUpdateSource = (index: number, field: keyof ArticleSource, value: string) => {
    setIsDirty(true);
    setFrontMatter(prev => {
      const updatedSources = [...(prev.sources || [])];
      updatedSources[index] = { ...updatedSources[index], [field]: value };
      return { ...prev, sources: updatedSources };
    });
  };

  const handleUpdateSourceId = (index: number, rawNewId: string) => {
    setIsDirty(true);
    const currentSource = frontMatter.sources?.[index];
    const oldId = currentSource ? getSourceId(currentSource, index) : '';
    const newId = normalizeCitationId(rawNewId);

    setFrontMatter(prev => {
      const updatedSources = [...(prev.sources || [])];
      updatedSources[index] = { ...updatedSources[index], id: rawNewId };
      return { ...prev, sources: updatedSources };
    });

    // If the citation was cited in bodyMarkdown and changed, update inline citations
    if (oldId && newId && oldId !== newId) {
      const occurrenceCount = (bodyMarkdown.match(new RegExp(`\\[\\[@cite:${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'g')) || []).length;
      if (occurrenceCount > 0) {
        const updatedMarkdown = replaceCitationIdInMarkdown(bodyMarkdown, oldId, newId);
        handleBodyChange(updatedMarkdown);
        setSuccessMessage(`Updated ${occurrenceCount} inline citation(s) from "${oldId}" to "${newId}".`);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    }
  };

  const handleRequestRemoveSource = (index: number) => {
    const source = frontMatter.sources?.[index];
    if (!source) return;
    const id = getSourceId(source, index);
    const count = citationCounts[id] || 0;
    if (count > 0) {
      setPendingDeleteSource({
        index,
        id,
        title: source.title || 'Untitled Source',
        count
      });
    } else {
      handleConfirmRemoveSource(index);
    }
  };

  const handleConfirmRemoveSource = (index: number) => {
    setIsDirty(true);
    setFrontMatter(prev => ({
      ...prev,
      sources: (prev.sources || []).filter((_, i) => i !== index)
    }));
    setPendingDeleteSource(null);
  };

  const handleCopyCitationKey = (key: string) => {
    const code = `[[@cite:${key}]]`;
    navigator.clipboard?.writeText(code);
    setCopiedCitationKey(key);
    setTimeout(() => setCopiedCitationKey(null), 2000);
  };

  // Related articles toggle
  const handleToggleRelatedArticle = (slug: string) => {
    setIsDirty(true);
    setFrontMatter(prev => {
      const current = prev.relatedArticleSlugs || [];
      const updated = current.includes(slug)
        ? current.filter(s => s !== slug)
        : [...current, slug];
      return { ...prev, relatedArticleSlugs: updated };
    });
  };

  // Word & Read Time calculation
  const wordCount = bodyMarkdown ? bodyMarkdown.trim().split(/\s+/).filter(Boolean).length : 0;
  const computedReadTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

  // Save handler
  const handleSave = async () => {
    if (!frontMatter.title.trim()) {
      setError('Article title is required.');
      return;
    }
    if (!frontMatter.slug.trim()) {
      setError('Article slug is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const today = getTodayIsoDate();
    let finalLastModified = frontMatter.lastModifiedDate || '';

    if (!initialSlug) {
      // New article: default lastModifiedDate to publishedDate or today
      if (!finalLastModified) {
        finalLastModified = frontMatter.publishedDate || today;
      }
    } else {
      // Existing article: if actual content was edited and user did not manually pick a lastModifiedDate, update to today
      if (isDirty && !userModifiedDateEdited) {
        finalLastModified = today;
      } else if (!finalLastModified) {
        finalLastModified = today;
      }
    }

    // Clean payload without deprecated updatedDate
    const frontMatterToSave: any = {
      ...frontMatter,
      lastModifiedDate: finalLastModified,
      readTime: frontMatter.readTime || computedReadTime
    };
    delete frontMatterToSave.updatedDate;

    if (finalLastModified !== frontMatter.lastModifiedDate) {
      setFrontMatter(p => ({ ...p, lastModifiedDate: finalLastModified }));
    }

    const payload = {
      frontMatter: frontMatterToSave,
      body: bodyMarkdown
    };

    const isUpdate = !!initialSlug;
    const url = isUpdate ? `/api/articles/${initialSlug}` : '/api/articles';
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setIsDirty(false);
        setUserModifiedDateEdited(false);
        setSuccessMessage(`Article "${frontMatter.title}" saved successfully to _articles/${data.slug}.md!`);
        setTimeout(() => setSuccessMessage(null), 3500);

        if (onSavedSuccess) {
          onSavedSuccess(data.slug);
        }
      } else {
        setError(data.error || 'Failed to save article.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while saving article.');
    } finally {
      setSaving(false);
    }
  };

  // Navigation guard
  const handleBackClick = () => {
    if (isDirty) {
      const choice = window.confirm('You have unsaved changes in this article. Are you sure you want to discard them?');
      if (!choice) return;
    }
    onBack();
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#2A548E] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#5A6270]">Loading article document...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOP WORKSPACE NAVIGATION & TOOLBAR */}
      <div className="sticky top-20 z-30 bg-[#FAF9F6] pt-2 pb-4 border-b border-[#99BFF9]/30 backdrop-blur-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackClick}
              className="p-1.5 hover:bg-stone-200/60 rounded-xs text-[#5A6270] hover:text-[#1E232B] transition-colors cursor-pointer"
              title="Return to Articles List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest font-semibold font-mono-code text-[#154D3B]">
                  {initialSlug ? 'Editing Article' : 'New Editorial Essay'}
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
                {frontMatter.title || 'Untitled Article'}
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
                <span className="hidden md:inline">Write</span>
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

            {/* AI Assistant Button */}
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open Article Editorial AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>

            {/* Version History Button */}
            {initialSlug && (
              <button
                type="button"
                onClick={() => setShowBackupsModal(true)}
                className="px-3 py-1.5 bg-white border border-[#99BFF9]/35 hover:border-[#2A548E] text-[#5A6270] hover:text-[#2A548E] text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="View Backups & Version Snapshots"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">History</span>
              </button>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Article'}</span>
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
        {/* LEFT PANEL: EDITING CONTROLS & CONTENT */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className="space-y-6">
            {/* Editor Sub-Tabs */}
            <div className="flex border-b border-[#99BFF9]/30 bg-white p-1 rounded-t-xs">
              <button
                type="button"
                onClick={() => setActiveTab('content')}
                className={`px-4 py-2 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'content' ? 'bg-[#EEF5FF] text-[#2A548E] border-b-2 border-[#2A548E]' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Essay Body Content</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('frontmatter')}
                className={`px-4 py-2 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'frontmatter' ? 'bg-[#EEF5FF] text-[#2A548E] border-b-2 border-[#2A548E]' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Front Matter &amp; Metadata</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sources')}
                className={`px-4 py-2 text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'sources' ? 'bg-[#EEF5FF] text-[#2A548E] border-b-2 border-[#2A548E]' : 'text-[#5A6270] hover:text-[#1E232B]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Citations ({frontMatter.sources?.length || 0})</span>
              </button>
            </div>

            {/* TAB 1: ESSAY BODY CONTENT */}
            {activeTab === 'content' && (
              <div className="space-y-4 bg-white p-5 border border-[#99BFF9]/30 rounded-b-xs shadow-xs">
                {/* Title & Slug Header Inputs */}
                <div className="space-y-3 pb-4 border-b border-[#99BFF9]/20">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                      Article Title *
                    </label>
                    <input
                      type="text"
                      value={frontMatter.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g., Why We Overthink Giving Gifts"
                      className="w-full p-2.5 text-base font-serif bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#5A6270] mb-1">
                        URL Slug *
                      </label>
                      <div className="flex items-center">
                        <span className="text-xs text-stone-400 bg-stone-100 p-2 border border-r-0 border-[#99BFF9]/35 select-none font-mono-code">
                          _articles/
                        </span>
                        <input
                          type="text"
                          value={frontMatter.slug}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({ ...p, slug: slugify(e.target.value) }));
                          }}
                          placeholder="avoid-overthinking-gift-decisions"
                          className="w-full p-2 text-xs font-mono-code bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#5A6270] mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={frontMatter.category}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, category: e.target.value }));
                        }}
                        placeholder="e.g. Gift Psychology, Material Culture"
                        className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>
                  </div>
                </div>

                {/* Hero Image Selector Bar */}
                <div className="p-3 bg-[#EEF5FF]/50 border border-[#99BFF9]/30 rounded-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#2A548E]" />
                    <span className="text-xs font-semibold text-[#1E232B]">
                      Hero Image: <code className="font-mono-code text-[#2A548E]">{frontMatter.heroImageType || frontMatter.image || 'None selected'}</code>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAssetPicker(true)}
                    className="px-2.5 py-1 bg-white hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/35 rounded-xs text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Select Image
                  </button>
                </div>

                {/* Main Reusable Rich Text Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Essay Body (Markdown &amp; Rich Text)
                    </label>
                    <span className="text-[11px] text-[#5A6270] font-mono-code">
                      {wordCount} words • {computedReadTime}
                    </span>
                  </div>

                  <RichTextEditor
                    initialMarkdown={bodyMarkdown}
                    onChange={(markdown, html) => handleBodyChange(markdown, html)}
                    placeholder="Write your article essay here. Use formatting, headings, links, blockquotes, and images..."
                    sources={frontMatter.sources || []}
                    onNavigateToSources={() => setActiveTab('sources')}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: FRONT MATTER & METADATA */}
            {activeTab === 'frontmatter' && (
              <div className="space-y-6 bg-white p-5 border border-[#99BFF9]/30 rounded-b-xs shadow-xs">
                {/* SEO & Search Engine Overrides */}
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
                        placeholder="Optional. e.g. Why We Overthink Gift Giving: Decision Science"
                        className="w-full p-2 text-xs bg-white border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
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
                        className="w-full p-2 text-xs bg-white border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                      />
                      <p className="text-[11px] text-[#5A6270] mt-1">
                        Optional. Used for the search-engine meta description and social metadata. If empty, the page description/deck is used.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Essay Subtitle / Deck */}
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-[#2A548E] mb-1">
                    Essay Deck / Subtitle Description
                  </label>
                  <textarea
                    value={frontMatter.deck || ''}
                    onChange={(e) => {
                      setIsDirty(true);
                      setFrontMatter(p => ({ ...p, deck: e.target.value }));
                    }}
                    rows={3}
                    placeholder="Brief summary or introductory premise of the article..."
                    className="w-full p-2.5 text-xs bg-[#FAF9F6] border border-[#99BFF9]/35 focus:outline-none focus:border-[#2A548E]"
                  />
                </div>

                {/* Author Selection */}
                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                      Author Profile
                    </label>
                    {Object.keys(availableAuthors).length > 0 && (
                      <select
                        onChange={(e) => handleAuthorKeyChange(e.target.value)}
                        className="text-xs bg-white border border-[#99BFF9]/30 px-2 py-1 rounded-xs focus:outline-none focus:border-[#2A548E]"
                      >
                        <option value="">Load Preset Author from _data/authors.yml...</option>
                        {Object.entries(availableAuthors).map(([key, val]: any) => (
                          <option key={key} value={key}>{val.name} ({val.role})</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-0.5">Author Name</label>
                      <input
                        type="text"
                        value={frontMatter.author?.name || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({
                            ...p,
                            author: { ...(p.author || { name: '', role: '' }), name: e.target.value }
                          }));
                        }}
                        className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-0.5">Author Role</label>
                      <input
                        type="text"
                        value={frontMatter.author?.role || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({
                            ...p,
                            author: { ...(p.author || { name: '', role: '' }), role: e.target.value }
                          }));
                        }}
                        className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-0.5">Author Bio</label>
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
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    />
                  </div>
                </div>

                {/* Hero Image Settings */}
                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Hero Image Settings
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAssetPicker(true)}
                      className="px-2.5 py-1 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/30 rounded-xs text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Browse Asset Library
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-0.5">Image Identifier / Path</label>
                      <input
                        type="text"
                        value={frontMatter.heroImageType || frontMatter.image || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, heroImageType: e.target.value, image: e.target.value }));
                        }}
                        placeholder="avoid-overthinking-gift-decisions"
                        className="w-full p-2 text-xs font-mono-code bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-0.5">Hero Image Alt Text</label>
                      <input
                        type="text"
                        value={frontMatter.heroImageAlt || ''}
                        onChange={(e) => {
                          setIsDirty(true);
                          setFrontMatter(p => ({ ...p, heroImageAlt: e.target.value }));
                        }}
                        placeholder="Descriptive alt text for accessibility..."
                        className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-0.5">Hero Image Caption</label>
                    <input
                      type="text"
                      value={frontMatter.heroImageCaption || ''}
                      onChange={(e) => {
                        setIsDirty(true);
                        setFrontMatter(p => ({ ...p, heroImageCaption: e.target.value }));
                      }}
                      placeholder="e.g. Photographed in our London workshop..."
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    />
                  </div>
                </div>

                {/* Dates & Reading Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs">
                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-0.5">Published Date</label>
                    <input
                      type="date"
                      value={frontMatter.publishedDate || ''}
                      onChange={(e) => {
                        setIsDirty(true);
                        setFrontMatter(p => ({ ...p, publishedDate: e.target.value }));
                      }}
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    />
                    <span className="block text-[10px] text-[#5A6270]/70 mt-1">Format: YYYY-MM-DD</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-0.5">Last Modified Date</label>
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
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    />
                    <span className="block text-[10px] text-[#5A6270]/70 mt-1">Updates to today on edit if unedited</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-0.5">Read Time</label>
                    <input
                      type="text"
                      value={frontMatter.readTime || computedReadTime}
                      onChange={(e) => {
                        setIsDirty(true);
                        setFrontMatter(p => ({ ...p, readTime: e.target.value }));
                      }}
                      placeholder="e.g., 7 min read"
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    />
                  </div>
                </div>

                {/* SEO & Search Indexing Controls */}
                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-rose-600" />
                    SEO &amp; Search Indexing Controls
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-1">
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
                      <label className="block text-[11px] text-[#5A6270] mb-1">
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

                {/* Optional Intro Quote Box */}
                <div className="border border-[#99BFF9]/30 rounded-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowIntroQuoteSection(!showIntroQuoteSection)}
                    className="w-full p-3 bg-[#FAF9F6] hover:bg-[#EEF5FF]/50 text-left text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5" />
                      Introductory Quote Callout Box
                    </span>
                    {showIntroQuoteSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showIntroQuoteSection && (
                    <div className="p-4 bg-white border-t border-[#99BFF9]/20 space-y-3">
                      <div>
                        <label className="block text-[11px] text-[#5A6270] mb-0.5">Quote Text</label>
                        <textarea
                          value={frontMatter.introQuote?.quote || ''}
                          onChange={(e) => {
                            setIsDirty(true);
                            setFrontMatter(p => ({
                              ...p,
                              introQuote: { ...(p.introQuote || { quote: '', author: '' }), quote: e.target.value }
                            }));
                          }}
                          rows={2}
                          placeholder="e.g., Givers want to elicit a gasp of surprise..."
                          className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-[#5A6270] mb-0.5">Quote Author</label>
                          <input
                            type="text"
                            value={frontMatter.introQuote?.author || ''}
                            onChange={(e) => {
                              setIsDirty(true);
                              setFrontMatter(p => ({
                                ...p,
                                introQuote: { ...(p.introQuote || { quote: '', author: '' }), author: e.target.value }
                              }));
                            }}
                            placeholder="e.g., Dr. Jeff Galak"
                            className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#5A6270] mb-0.5">Author Source / Institution</label>
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
                            placeholder="e.g., Carnegie Mellon University"
                            className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Related Links & Companion Guides */}
                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-4">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Companion Guides &amp; Related Essays
                  </label>

                  <div>
                    <label className="block text-[11px] text-[#5A6270] mb-1">
                      Companion Gift Guide (<code className="font-mono-code text-[#226E56]">relatedGuideSlug</code>)
                    </label>
                    <select
                      value={frontMatter.relatedGuideSlug || ''}
                      onChange={(e) => {
                        setIsDirty(true);
                        setFrontMatter(p => ({ ...p, relatedGuideSlug: e.target.value }));
                      }}
                      className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                    >
                      <option value="">None selected</option>
                      {availableGuides.map(g => (
                        <option key={g.slug} value={g.slug}>{g.title} ({g.slug})</option>
                      ))}
                    </select>
                  </div>

                  {availableArticles.length > 0 && (
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-1.5">
                        Related Articles (<code className="font-mono-code text-[#2A548E]">relatedArticleSlugs</code>)
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-white border border-[#99BFF9]/30 rounded-xs">
                        {availableArticles.map(art => {
                          const isSelected = (frontMatter.relatedArticleSlugs || []).includes(art.slug);
                          return (
                            <label key={art.slug} className="flex items-center gap-2 text-xs text-[#1E232B] hover:bg-[#EEF5FF] p-1 rounded-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleRelatedArticle(art.slug)}
                                className="accent-[#2A548E]"
                              />
                              <span className="truncate">{art.title}</span>
                              <span className="text-[10px] text-stone-400 font-mono-code">({art.slug})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SOURCES & CITATIONS */}
            {activeTab === 'sources' && (
              <div className="space-y-4 bg-white p-5 border border-[#99BFF9]/30 rounded-b-xs shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#99BFF9]/20">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Primary Research &amp; Scholarly Citations
                    </h3>
                    <p className="text-[11px] text-[#5A6270]">
                      Structured references displayed under the article essay matching <code className="font-mono-code text-[#2A548E]">sources:</code> in front matter.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSource}
                    className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/30 text-xs font-semibold rounded-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Citation</span>
                  </button>
                </div>

                {(!frontMatter.sources || frontMatter.sources.length === 0) ? (
                  <div className="py-10 text-center text-xs text-[#5A6270] space-y-2">
                    <BookOpen className="w-8 h-8 text-stone-300 mx-auto" />
                    <p>No primary research citations added yet.</p>
                    <button
                      type="button"
                      onClick={handleAddSource}
                      className="px-3 py-1.5 bg-[#2A548E] text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
                    >
                      Add First Research Citation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {frontMatter.sources.map((source, idx) => {
                      const currentId = getSourceId(source, idx);
                      const autoDerivedId = !source.id ? currentId : '';
                      const citedCount = citationCounts[currentId] || 0;
                      const isCopied = copiedCitationKey === currentId;

                      return (
                        <div key={idx} className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs space-y-3 relative group">
                          <div className="flex flex-wrap items-center justify-between border-b border-[#99BFF9]/20 pb-2 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#2A548E] font-serif">
                                Citation #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCitationKey(currentId)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-[#99BFF9]/40 hover:border-[#2A548E] text-[10px] font-mono font-semibold text-[#2A548E] rounded transition-colors cursor-pointer"
                                title="Copy citation syntax to clipboard"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-[#5A6270]" />
                                    <span>[[@cite:{currentId}]]</span>
                                  </>
                                )}
                              </button>
                              {citedCount > 0 ? (
                                <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] text-[10px] font-semibold rounded border border-[#99BFF9]/30">
                                  Cited {citedCount}× in essay
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-stone-100 text-[#5A6270] text-[10px] rounded">
                                  Not cited inline
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRequestRemoveSource(idx)}
                              className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-[#5A6270] mb-0.5 flex items-center justify-between">
                                <span className="font-semibold text-[#2A548E]">Citation Key / Identifier (`id`)</span>
                                <span className="text-[10px] text-stone-400 font-mono">Syntax: [[@cite:{currentId}]]</span>
                              </label>
                              <input
                                type="text"
                                value={source.id || ''}
                                onChange={(e) => handleUpdateSourceId(idx, e.target.value)}
                                placeholder={autoDerivedId || 'e.g. galak-2016'}
                                className="w-full p-2 text-xs font-mono bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                              {!source.id && (
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  Auto-derived fallback: <code className="font-mono text-[#2A548E]">{autoDerivedId}</code>. Enter a custom key above to override.
                                </p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">Paper / Book Title *</label>
                              <input
                                type="text"
                                value={source.title || ''}
                                onChange={(e) => handleUpdateSource(idx, 'title', e.target.value)}
                                placeholder="e.g. The Giver-Recipient Asymmetry..."
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">Author(s)</label>
                              <input
                                type="text"
                                value={source.author || ''}
                                onChange={(e) => handleUpdateSource(idx, 'author', e.target.value)}
                                placeholder="e.g. Jeff Galak, Julian Givi, and Elanor F. Williams"
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">Journal / Publication</label>
                              <input
                                type="text"
                                value={source.publication || ''}
                                onChange={(e) => handleUpdateSource(idx, 'publication', e.target.value)}
                                placeholder="e.g. Current Directions in Psychological Science"
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">Year</label>
                              <input
                                type="text"
                                value={source.year || ''}
                                onChange={(e) => handleUpdateSource(idx, 'year', e.target.value)}
                                placeholder="e.g. 2016"
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">DOI / URL</label>
                              <input
                                type="text"
                                value={source.url || ''}
                                onChange={(e) => handleUpdateSource(idx, 'url', e.target.value)}
                                placeholder="https://journals.sagepub.com/doi/..."
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] text-[#5A6270] mb-0.5">Annotation Note</label>
                              <input
                                type="text"
                                value={source.annotation || ''}
                                onChange={(e) => handleUpdateSource(idx, 'annotation', e.target.value)}
                                placeholder="Foundational paper establishing the temporal disconnect..."
                                className="w-full p-2 text-xs bg-white border border-[#99BFF9]/30 focus:outline-none focus:border-[#2A548E]"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RIGHT / FULL PANEL: LIVE ARTICLE PREVIEW */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`overflow-y-auto ${viewMode === 'preview' ? 'max-w-4xl mx-auto w-full' : ''}`}>
            <div className="mb-2 flex items-center justify-between text-xs text-[#5A6270]">
              <span className="uppercase tracking-wider font-semibold font-mono-code text-[#2A548E]">
                Live Editorial Preview
              </span>
              <span className="text-[11px] italic">Reflects _layouts/article.html</span>
            </div>
            <ArticlePreview
              frontMatter={frontMatter}
              bodyHtml={bodyHtml}
            />
          </div>
        )}
      </div>

      {/* Asset Picker Modal */}
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

      {/* Version History Modal */}
      {initialSlug && (
        <ArticleBackupsModal
          isOpen={showBackupsModal}
          onClose={() => setShowBackupsModal(false)}
          activeSlug={initialSlug}
          onRestoreSuccess={() => {
            setShowBackupsModal(false);
            loadArticle(initialSlug);
          }}
        />
      )}

      {/* Article AI Assistant Modal */}
      <ArticleAiModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        article={{
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

      {/* Delete Cited Source Confirmation Modal */}
      {pendingDeleteSource && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xs border border-rose-300 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-full shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-[#1E232B]">
                  Delete Cited Scholarly Source?
                </h4>
                <p className="text-xs text-[#5A6270] leading-relaxed">
                  The source <strong>"{pendingDeleteSource.title}"</strong> (citation key: <code className="font-mono text-rose-700 bg-rose-50 px-1 py-0.5 rounded text-[11px]">[[@cite:{pendingDeleteSource.id}]]</code>) is currently cited <strong>{pendingDeleteSource.count} time(s)</strong> in your article essay.
                </p>
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 leading-normal">
                  ⚠️ Deleting this source will cause its inline citations in the article to become unresolved (<code className="font-mono font-bold text-rose-900">[?]</code>).
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setPendingDeleteSource(null)}
                className="px-3 py-1.5 text-xs text-[#5A6270] hover:text-[#1E232B] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmRemoveSource(pendingDeleteSource.index)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Source Anyway</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

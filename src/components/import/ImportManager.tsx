import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Search,
  Eye,
  Layers,
  ArrowRight,
  HelpCircle,
  Filter,
  Code,
  FileCode,
  Globe,
  Tag,
  Clock,
  User,
  Info,
  Check,
  Package,
  BookOpen,
  Save,
  RotateCcw,
  CheckSquare,
  Zap,
  SplitSquareVertical,
  Link as LinkIcon
} from 'lucide-react';
import {
  ImportFileItem,
  ImportDraft,
  ImportTargetType,
  ImportItemStatus,
  ImportIssue,
  ImportSampleItem,
  FieldMappingItem
} from '../../types/import';
import { ImportPasteModal } from './ImportPasteModal';
import { DraftMetadataEditor } from './DraftMetadataEditor';
import { FieldMappingTable } from './FieldMappingTable';
import { BodyEditorPane } from './BodyEditorPane';
import { ActionableIssuesList } from './ActionableIssuesList';
import { ReconciliationPane } from './ReconciliationPane';
import { LivePagePreviewPane } from './LivePagePreviewPane';
import { ArticlePreviewPane } from './ArticlePreviewPane';
import { LinkReviewPane } from './LinkReviewPane';
import { ProductCandidatesPane } from './ProductCandidatesPane';
import { MigrationOverviewPane } from './MigrationOverviewPane';
import { SourceInformationPane } from './SourceInformationPane';
import { StructuredArticleLink, DetectedProductCandidate, ProductDraftItem } from '../../types/import';

interface ImportManagerProps {
  onNavigateToCmsProduct?: (productId: string) => void;
}

export function ImportManager({ onNavigateToCmsProduct }: ImportManagerProps = {}) {
  const [items, setItems] = useState<ImportFileItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [samples, setSamples] = useState<ImportSampleItem[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'needs_review' | 'ready' | 'guide' | 'article' | 'approved' | 'urls'>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'editor' | 'preview' | 'links' | 'products' | 'metadata' | 'mapping' | 'reconcile' | 'source' | 'issues' | 'yaml'>('overview');
  const [approvalNote, setApprovalNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Phase 3: URL Input State
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null);
  const [attachUrlInput, setAttachUrlInput] = useState('');
  const [isAttachingUrl, setIsAttachingUrl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSessionItems();
    fetchSamples();
  }, []);

  const fetchSessionItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/import/items');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        if (data.items.length > 0 && !selectedItemId) {
          setSelectedItemId(data.items[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching import items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSamples = async () => {
    try {
      const res = await fetch('/api/import/samples');
      const data = await res.json();
      if (data.success && Array.isArray(data.samples)) {
        setSamples(data.samples);
      }
    } catch (err) {
      console.error('Error fetching sample files:', err);
    }
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  // Synchronize active tab when switching items
  useEffect(() => {
    if (selectedItem?.reconciliationReport && detailTab === 'metadata') {
      // Keep metadata as default, but ensure tab is available
    }
  }, [selectedItemId]);

  // File Upload Handlers (Supports optional URL pairing)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const payloadFiles: Array<{ filename: string; content: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type.includes('markdown') || file.type.includes('text')) {
        const text = await file.text();
        payloadFiles.push({
          filename: file.name,
          content: text
        });
      }
    }

    if (payloadFiles.length > 0) {
      await uploadPayload(payloadFiles, urlInput.trim() || undefined);
      if (urlInput.trim()) {
        setUrlInput('');
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const payloadFiles: Array<{ filename: string; content: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
        const text = await file.text();
        payloadFiles.push({
          filename: file.name,
          content: text
        });
      }
    }

    if (payloadFiles.length > 0) {
      await uploadPayload(payloadFiles, urlInput.trim() || undefined);
      if (urlInput.trim()) {
        setUrlInput('');
      }
    }
  };

  const uploadPayload = async (
    payloadFiles: Array<{ filename: string; content: string; targetType?: ImportTargetType }>,
    liveUrlToPair?: string
  ) => {
    try {
      setLoading(true);
      const res = await fetch('/api/import/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: payloadFiles,
          liveUrl: liveUrlToPair
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(prev => [...prev, ...data.items]);
        if (data.items.length > 0) {
          const firstNew = data.items[0];
          setSelectedItemId(firstNew.id);
          if (firstNew.reconciliationReport) {
            setDetailTab('reconcile');
          }
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async (sample: ImportSampleItem) => {
    try {
      setLoading(true);
      const res = await fetch('/api/import/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sample.sampleContent,
          filename: sample.filename,
          targetType: sample.type,
          liveUrl: sample.sampleLiveUrl
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        setItems(prev => [...prev, ...data.items]);
        const added = data.items[0];
        setSelectedItemId(added.id);
        if (added.reconciliationReport) {
          setDetailTab('reconcile');
        }
      }
    } catch (err) {
      console.error('Error loading sample:', err);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Live URL Handlers (Phase 3)
  // -------------------------------------------------------------

  // Standalone URL Fetch or Pair with pending files
  const handleFetchUrlStandalone = async () => {
    if (!urlInput.trim()) return;
    try {
      setIsFetchingUrl(true);
      setUrlFetchError(null);
      const res = await fetch('/api/import/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => [...prev, data.item]);
        setSelectedItemId(data.item.id);
        setUrlInput('');
        setDetailTab('metadata');
        setSaveSuccessMsg('Live article URL fetched and converted into import draft.');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      } else {
        setUrlFetchError(data.error || 'Could not fetch live page');
      }
    } catch (err: any) {
      console.error('Fetch URL failed:', err);
      setUrlFetchError(`Connection error: ${err.message}`);
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Attach live URL to an existing selected item
  const handleAttachUrlToItem = async (targetUrl?: string) => {
    const urlToUse = targetUrl || attachUrlInput.trim();
    if (!selectedItemId || !urlToUse) return;

    try {
      setIsAttachingUrl(true);
      const res = await fetch('/api/import/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlToUse,
          attachToItemId: selectedItemId
        })
      });
      const data = await res.json();
      if (data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
        setAttachUrlInput('');
        if (data.success) {
          setDetailTab('reconcile');
          setSaveSuccessMsg('Live URL reconciled with Markdown! Check the Reconciliation tab.');
          setTimeout(() => setSaveSuccessMsg(null), 3500);
        }
      }
    } catch (err: any) {
      console.error('Attach URL failed:', err);
    } finally {
      setIsAttachingUrl(false);
    }
  };

  // 1-Click Adopt Field from Diff
  const handleAdoptDiffField = async (field: string, value: any, source: 'live' | 'markdown') => {
    if (!selectedItemId) return;
    try {
      const res = await fetch(`/api/import/adopt-diff/${selectedItemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, source })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
        setSaveSuccessMsg(`Applied ${source} value for ${field}.`);
        setTimeout(() => setSaveSuccessMsg(null), 2500);
      }
    } catch (err) {
      console.error('Adopt diff failed:', err);
    }
  };

  // -------------------------------------------------------------
  // Editable Draft Handlers (PRE-WRITE: Zero Jekyll site writes)
  // -------------------------------------------------------------

  const handleUpdateDraft = (updatedFields: Partial<ImportDraft>) => {
    if (!selectedItemId) return;

    setItems(prev => prev.map(item => {
      if (item.id !== selectedItemId) return item;
      if (!item.draft) return item;

      const updatedDraft: ImportDraft = {
        ...item.draft,
        ...updatedFields,
        lastSavedAt: item.draft.lastSavedAt
      };

      return {
        ...item,
        targetType: updatedDraft.targetType,
        status: updatedDraft.status,
        draft: updatedDraft
      };
    }));
  };

  // Product Draft & Link Handlers
  const handleUpdateLinks = (newLinks: StructuredArticleLink[]) => {
    handleUpdateDraft({ structuredLinks: newLinks });
  };

  const handleCreateProductFromLink = (link: StructuredArticleLink) => {
    if (!selectedItem?.draft) return;
    const currentDrafts = selectedItem.draft.productDrafts || [];
    const newDraft: ProductDraftItem = {
      id: `prod-draft-${Date.now().toString(36)}`,
      title: link.anchorText || 'Discovered Product Candidate',
      vendorUrl: link.url,
      vendor: link.url.includes('fourthwall.com') ? 'Fourthwall Store' : 'Merchant',
      price: '',
      priceRange: '50-100',
      category: 'editors-pick',
      description: link.contextSnippet || '',
      state: 'draft_created',
      source: link.source,
      createdAt: new Date().toISOString()
    };

    handleUpdateDraft({
      productDrafts: [...currentDrafts, newDraft]
    });
    setDetailTab('products');
  };

  const handleCreateProductFromCandidate = (candidate: DetectedProductCandidate) => {
    if (!selectedItem?.draft) return;
    const currentDrafts = selectedItem.draft.productDrafts || [];
    if (currentDrafts.some(d => d.candidateId === candidate.id || d.vendorUrl === candidate.url)) return;

    const newDraft: ProductDraftItem = {
      id: `prod-draft-${Date.now().toString(36)}`,
      title: candidate.name,
      vendorUrl: candidate.url,
      vendor: candidate.vendor || 'Merchant Vendor',
      price: candidate.price || '',
      priceNumber: candidate.priceNumber,
      priceRange: candidate.priceNumber && candidate.priceNumber < 50 ? '25-50' : '50-100',
      category: candidate.category || 'editors-pick',
      image: candidate.image || '',
      imageAlt: candidate.imageAlt || `${candidate.name} photography`,
      description: candidate.description || candidate.contextSnippet || '',
      state: 'draft_created',
      source: candidate.source,
      candidateId: candidate.id,
      contextSnippet: candidate.contextSnippet,
      matchedExistingProductId: candidate.existingCmsProduct?.id,
      isDuplicate: !!candidate.existingCmsProduct,
      createdAt: new Date().toISOString()
    };

    handleUpdateDraft({
      productDrafts: [...currentDrafts, newDraft]
    });
    setDetailTab('products');
  };

  const handleUpdateProductDraft = (draftId: string, updates: Partial<ProductDraftItem>) => {
    if (!selectedItem?.draft) return;
    const updated = (selectedItem.draft.productDrafts || []).map(d =>
      d.id === draftId ? { ...d, ...updates } : d
    );
    handleUpdateDraft({ productDrafts: updated });
  };

  const handleDeleteProductDraft = (draftId: string) => {
    if (!selectedItem?.draft) return;
    const updated = (selectedItem.draft.productDrafts || []).filter(d => d.id !== draftId);
    handleUpdateDraft({ productDrafts: updated });
  };

  const handleApproveProductDraft = (draftId: string) => {
    handleUpdateProductDraft(draftId, { state: 'approved' });
  };

  const handleExportProducts = async (linkIds: string[]) => {
    if (!selectedItemId) return null;
    try {
      const res = await fetch(`/api/import/export-products/${selectedItemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkIds })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
        setSaveSuccessMsg(`Product export complete: ${data.created} created, ${data.alreadyExisted} existed.`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
      return data;
    } catch (err) {
      console.error('Export products failed:', err);
      return null;
    }
  };

  const handleCreatePost = async () => {
    if (!selectedItemId) return null;
    try {
      const res = await fetch(`/api/import/create-post/${selectedItemId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
        setSaveSuccessMsg(`Draft post created at ${data.createdPost.postPath}.`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
      return data;
    } catch (err) {
      console.error('Create post failed:', err);
      return null;
    }
  };

  const handleSaveDraft = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !item.draft) return;

    try {
      setIsSavingDraft(true);
      const res = await fetch(`/api/import/draft/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.draft)
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
        setSaveSuccessMsg('Import draft saved in session (Zero Jekyll files modified).');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('Save draft failed:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRevertDraft = async (itemId: string) => {
    if (!window.confirm('Revert all manual draft edits back to original parser & AI analysis?')) {
      return;
    }
    try {
      const res = await fetch(`/api/import/draft/${itemId}/revert`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
        setSaveSuccessMsg('Reverted draft back to original analysis.');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Revert draft failed:', err);
    }
  };

  const handleUpdateDraftStatus = async (itemId: string, newStatus: ImportItemStatus) => {
    try {
      const res = await fetch(`/api/import/draft/${itemId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
      }
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  const handleToggleResolveIssue = async (issueId: string, resolved: boolean) => {
    if (!selectedItemId) return;
    try {
      const res = await fetch(`/api/import/draft/${selectedItemId}/resolve-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, resolved })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
      }
    } catch (err) {
      console.error('Resolve issue failed:', err);
    }
  };

  const handleRemapField = async (oldKey: string, newKey: string, customValue?: any) => {
    if (!selectedItemId) return;
    try {
      const res = await fetch(`/api/import/draft/${selectedItemId}/remap-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldKey, newKey, customValue })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === selectedItemId ? data.item : it));
      }
    } catch (err) {
      console.error('Remap field failed:', err);
    }
  };

  const handleIgnoreField = async (oldKey: string) => {
    await handleRemapField(oldKey, '(ignore)');
  };

  const handleEditFieldValue = async (oldKey: string, newValue: any) => {
    if (!selectedItemId || !selectedItem?.draft) return;
    const existingEntry = selectedItem.draft.fieldMappings.find(m => m.oldKey === oldKey);
    const destKey = existingEntry ? existingEntry.newKey : oldKey;
    await handleRemapField(oldKey, destKey, newValue);
  };

  // Re-Analyze or AI-Enhance
  const handleReanalyze = async (itemId: string, useAi: boolean = false, targetTypeOverride?: ImportTargetType) => {
    try {
      setAnalyzingId(itemId);
      const res = await fetch(`/api/import/analyze/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useAi,
          targetType: targetTypeOverride
        })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Approval Handlers (Stage 1 Safety Contract: ZERO JEKYLL WRITES)
  const handleApprove = async (itemId: string) => {
    try {
      setIsApproving(true);
      const res = await fetch(`/api/import/approve/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNote })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
        setApprovalNote('');
      }
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleUnapprove = async (itemId: string) => {
    try {
      const res = await fetch(`/api/import/unapprove/${itemId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.item) {
        setItems(prev => prev.map(it => it.id === itemId ? data.item : it));
      }
    } catch (err) {
      console.error('Unapprove failed:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/import/items/${itemId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(it => it.id !== itemId));
      if (selectedItemId === itemId) {
        const remaining = items.filter(it => it.id !== itemId);
        setSelectedItemId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Clear all uploaded files from the import queue?')) {
      try {
        await fetch('/api/import/items', { method: 'DELETE' });
        setItems([]);
        setSelectedItemId(null);
      } catch (err) {
        console.error('Clear failed:', err);
      }
    }
  };

  // Filtering
  const filteredItems = items.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'needs_review') return item.status === 'needs_review';
    if (filterType === 'ready') return item.status === 'ready';
    if (filterType === 'guide') return item.targetType === 'guide';
    if (filterType === 'article') return item.targetType === 'article';
    if (filterType === 'approved') return item.status === 'approved';
    if (filterType === 'urls') return item.sourceType === 'url' || item.sourceType === 'both';
    return true;
  });

  const counts = {
    total: items.length,
    needsReview: items.filter(i => i.status === 'needs_review').length,
    ready: items.filter(i => i.status === 'ready').length,
    approved: items.filter(i => i.status === 'approved').length,
    guides: items.filter(i => i.targetType === 'guide').length,
    articles: items.filter(i => i.targetType === 'article').length,
    reconciled: items.filter(i => i.sourceType === 'both').length,
    urls: items.filter(i => i.sourceType === 'url' || i.sourceType === 'both').length
  };

  // Compute dynamic front matter representation for Target Front Matter tab
  const computeTargetFrontMatter = (draft: ImportDraft) => {
    const fm: Record<string, any> = {
      title: draft.title,
      'search-title': draft.searchTitle,
      deck: draft.deck,
      'seo-description': draft.seoDescription,
      slug: draft.slug,
      category: draft.category,
      author: {
        name: draft.authorName,
        role: draft.authorRole
      },
      publishedDate: draft.publishedDate,
      lastModifiedDate: draft.lastModifiedDate,
      readTime: draft.readTime
    };

    if (draft.heroImageType) fm.heroImageType = draft.heroImageType;
    if (draft.heroImageAlt) fm.heroImageAlt = draft.heroImageAlt;
    if (draft.heroImageCaption) fm.heroImageCaption = draft.heroImageCaption;
    if (draft.introQuote) fm.introQuote = draft.introQuote;
    if (draft.liveUrl) fm.importedFromUrl = draft.liveUrl;

    // Add custom properties
    draft.fieldMappings.forEach(m => {
      if (m.status === 'custom' && m.oldKey !== '(missing)') {
        fm[m.oldKey] = m.currentValue;
      }
    });

    return fm;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Dual-Source Inputs Banner */}
      <div className="bg-white border border-[#99BFF9]/35 rounded-xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#99BFF9]/20">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest text-[#226E56] font-semibold font-mono-code bg-[#E8F8F1] px-2.5 py-0.5 rounded border border-[#226E56]/20">
                Phase 3 Multi-Source Importer
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#2A548E] font-medium bg-[#EEF5FF] px-2 py-0.5 rounded border border-[#99BFF9]/30">
                <ShieldCheck className="w-3 h-3 text-[#2A548E]" />
                Markdown &amp; Live URL Reconciliation Layer
              </span>
            </div>
            <h1 className="font-serif-display text-2xl sm:text-3xl font-medium text-[#1E232B]">
              Content Migration &amp; Reconciliation Engine
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6270] max-w-3xl leading-relaxed">
              Import from legacy Markdown, live article URLs, or both combined. Reconcile differences,
              enrich missing SEO tags, edit drafts, and resolve issues before approving.
              <span className="font-medium text-[#1E232B]"> Zero Jekyll site writes during review.</span>
            </p>
          </div>

          {/* Quick Actions (Samples & Clear) */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {/* Sample Selector Dropdown */}
            <div className="relative group">
              <button
                className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#99BFF9]/20 text-[#2A548E] border border-[#99BFF9]/40 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2A548E]" />
                <span>Load Sample Articles</span>
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-84 bg-white border border-stone-200 shadow-xl rounded-xl p-2 z-50 hidden group-hover:block animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Try 1-Click Samples (With Live URL)
                </div>
                {samples.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => loadSample(sample)}
                    className="w-full text-left p-2 rounded-lg hover:bg-stone-50 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                  >
                    <div className="font-medium text-[#1E232B] flex items-center justify-between">
                      <span className="truncate max-w-[200px]">{sample.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#EEF5FF] text-[#2A548E] rounded uppercase font-mono">
                        {sample.sampleLiveUrl ? 'Both' : sample.type}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#5A6270] line-clamp-1">{sample.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="Clear all import items"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dual Input Area: Upload Markdown OR Live URL */}
        <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Source 1: Markdown File Upload */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-[#FAF9F6] border border-[#99BFF9]/25 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E232B] mb-1">
                <FileText className="w-4 h-4 text-[#2A548E]" />
                <span>Source 1: Legacy Markdown Files (.md, .markdown)</span>
              </div>
              <p className="text-[11px] text-[#5A6270] mb-3">
                Provides source YAML front matter, original structure, and author notes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                accept=".md,.markdown,text/markdown,text/plain"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-3.5 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-2 bg-white hover:bg-stone-50 border border-[#99BFF9]/40 text-[#2A548E] text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-[#2A548E]" />
                <span>Paste Text</span>
              </button>
            </div>
          </div>

          {/* Source 2: Live Article URL */}
          <div className="lg:col-span-7 p-4 rounded-xl bg-[#FAF9F6] border border-[#99BFF9]/25 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E232B]">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span>Source 2: Live Article URL (Optional or Standalone)</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                  SSRF Protected
                </span>
              </div>
              <p className="text-[11px] text-[#5A6270] mb-3">
                Fetches rendered webpage to extract meta tags, social cards, images, and live revisions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  placeholder="https://example.com/gifts/best-astrophotography-guide"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (urlFetchError) setUrlFetchError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFetchUrlStandalone();
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#99BFF9]/50 rounded-lg text-xs text-[#1E232B] placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2A548E]"
                />
                <Globe className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                type="button"
                onClick={handleFetchUrlStandalone}
                disabled={isFetchingUrl || !urlInput.trim()}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Zap className={`w-3.5 h-3.5 ${isFetchingUrl ? 'animate-spin' : ''}`} />
                <span>{isFetchingUrl ? 'Fetching...' : 'Fetch & Analyze'}</span>
              </button>
            </div>

            {urlFetchError && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>{urlFetchError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 mt-5 pt-4 border-t border-[#99BFF9]/20 text-xs">
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Queue</span>
            <span className="font-mono-code font-bold text-base text-[#1E232B]">{counts.total} items</span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Reconciled</span>
            <span className="font-mono-code font-bold text-base text-purple-700">{counts.reconciled}</span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Needs Review</span>
            <span className={`font-mono-code font-bold text-base ${counts.needsReview > 0 ? 'text-amber-600' : 'text-[#226E56]'}`}>
              {counts.needsReview}
            </span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Ready</span>
            <span className="font-mono-code font-bold text-base text-[#226E56]">{counts.ready}</span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Guides</span>
            <span className="font-mono-code font-bold text-base text-[#2A548E]">{counts.guides}</span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Articles</span>
            <span className="font-mono-code font-bold text-base text-[#2A548E]">{counts.articles}</span>
          </div>
          <div className="p-2.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-medium">Approved</span>
            <span className="font-mono-code font-bold text-base text-[#226E56]">{counts.approved}</span>
          </div>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-[#E8F8F1] border border-[#226E56]/30 rounded-xl text-xs text-[#154D3B] flex items-center justify-between shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#226E56]" />
            <span className="font-medium">{saveSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* 2. Main Work Area: Left Master List + Right Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Uploaded Files Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-[#99BFF9]/30 rounded-xl p-4 shadow-xs flex flex-col h-[780px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#99BFF9]/20">
              <div className="flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-[#2A548E]" />
                <h3 className="font-serif-display text-sm font-medium text-[#1E232B]">
                  Import Queue ({filteredItems.length})
                </h3>
              </div>
              <button
                onClick={fetchSessionItems}
                disabled={loading}
                className="p-1 text-[#5A6270] hover:text-[#2A548E] rounded transition-colors cursor-pointer"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 py-2.5 overflow-x-auto text-[11px] border-b border-stone-100">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterType === 'all' ? 'bg-[#2A548E] text-white font-medium' : 'text-[#5A6270] hover:bg-stone-100'}`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setFilterType('urls')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterType === 'urls' ? 'bg-emerald-700 text-white font-medium' : 'text-[#5A6270] hover:bg-stone-100'}`}
              >
                Live ({counts.urls})
              </button>
              <button
                onClick={() => setFilterType('needs_review')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterType === 'needs_review' ? 'bg-amber-600 text-white font-medium' : 'text-[#5A6270] hover:bg-stone-100'}`}
              >
                Review ({counts.needsReview})
              </button>
              <button
                onClick={() => setFilterType('ready')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterType === 'ready' ? 'bg-[#226E56] text-white font-medium' : 'text-[#5A6270] hover:bg-stone-100'}`}
              >
                Ready ({counts.ready})
              </button>
              <button
                onClick={() => setFilterType('approved')}
                className={`px-2 py-0.5 rounded cursor-pointer ${filterType === 'approved' ? 'bg-[#226E56] text-white font-medium' : 'text-[#5A6270] hover:bg-stone-100'}`}
              >
                Approved
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2 pr-1">
              {filteredItems.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[#99BFF9]/40 rounded-xl bg-[#FAF9F6]/50"
                >
                  <Upload className="w-8 h-8 text-[#99BFF9] mb-2" />
                  <p className="text-xs font-medium text-[#1E232B]">No documents in queue</p>
                  <p className="text-[11px] text-[#5A6270] mt-1 max-w-[200px]">
                    Upload Markdown, paste a Live URL above, or try a 1-click sample.
                  </p>
                </div>
              ) : (
                filteredItems.map(item => {
                  const isSelected = item.id === selectedItemId;
                  const isApproved = item.status === 'approved';
                  const isReady = item.status === 'ready';
                  const isNeedsReview = item.status === 'needs_review';
                  const isBoth = item.sourceType === 'both';
                  const isUrlOnly = item.sourceType === 'url';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all relative ${
                        isSelected
                          ? 'bg-[#EEF5FF] border-[#2A548E] shadow-xs'
                          : 'bg-[#FAF9F6] border-stone-200/80 hover:border-[#99BFF9] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Source Badges */}
                          {isBoth ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono-code px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              <SplitSquareVertical className="w-3 h-3" /> Reconciled
                            </span>
                          ) : isUrlOnly ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono-code px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Globe className="w-3 h-3" /> Live URL
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono-code px-1.5 py-0.5 rounded font-bold bg-stone-100 text-stone-700 border border-stone-300">
                              <FileText className="w-3 h-3" /> Markdown
                            </span>
                          )}

                          <span className="font-mono-code text-xs font-bold text-[#1E232B] truncate max-w-[130px]" title={item.filename}>
                            {item.filename}
                          </span>
                        </div>

                        {/* Status Chip */}
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#154D3B] bg-[#E8F8F1] px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-[#226E56]" /> Approved
                          </span>
                        ) : isReady ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready
                          </span>
                        ) : isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Review
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-500 font-mono-code">Analyzed</span>
                        )}
                      </div>

                      <div className="mt-1.5 text-xs text-[#1E232B] font-medium line-clamp-1">
                        {item.draft?.title || item.analysis?.mappedFrontMatter?.title || item.filename}
                      </div>

                      <div className="mt-2 pt-2 border-t border-stone-200/50 flex items-center justify-between text-[11px] text-[#5A6270]">
                        <span>{(item.fileSize / 1024).toFixed(1)} KB</span>
                        {item.analysis?.bodyStats && (
                          <span>{item.analysis.bodyStats.wordCount} words</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          className="text-stone-400 hover:text-rose-600 p-0.5 transition-colors cursor-pointer"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Detailed Inspection & Review Pane (8 cols) */}
        <div className="lg:col-span-8">
          {!selectedItem ? (
            <div className="bg-white border border-[#99BFF9]/30 rounded-xl p-12 text-center h-[780px] flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center">
                <FileCode className="w-8 h-8" />
              </div>
              <h3 className="font-serif-display text-xl font-medium text-[#1E232B]">
                Select a Document to Review
              </h3>
              <p className="text-xs text-[#5A6270] max-w-md leading-relaxed">
                Choose an imported document from the queue to edit metadata, remap front matter fields,
                reconcile against live webpages, edit body copy, and save your import draft.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl flex flex-col h-[780px] shadow-xs overflow-hidden">
              {/* Document Header Bar */}
              <div className="p-4 sm:p-5 border-b border-[#99BFF9]/25 bg-[#FAF9F6]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-code font-bold text-sm text-[#1E232B]">
                        {selectedItem.filename}
                      </span>
                      <span className="text-stone-300">·</span>

                      {/* Content Type Selector */}
                      <select
                        value={selectedItem.draft?.targetType || selectedItem.targetType}
                        onChange={(e) => handleUpdateDraft({ targetType: e.target.value as any })}
                        className="bg-white border border-[#99BFF9]/50 rounded px-2 py-0.5 text-xs text-[#2A548E] font-semibold focus:outline-none cursor-pointer"
                      >
                        <option value="guide">Gift Guide (_guides/)</option>
                        <option value="article">Editorial Article (_articles/)</option>
                        <option value="page">Static Page</option>
                        <option value="unknown">Unknown / Needs Review</option>
                      </select>

                      {/* Source Indicator Badge */}
                      <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded ${
                        selectedItem.sourceType === 'both'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : selectedItem.sourceType === 'url'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}>
                        Source: {selectedItem.sourceType === 'both' ? 'Reconciled (MD + Live)' : selectedItem.sourceType === 'url' ? 'Live URL' : 'Markdown'}
                      </span>
                    </div>

                    {/* Live URL Subtitle / Attachment Status */}
                    {selectedItem.liveUrl ? (
                      <div className="flex items-center gap-2 text-xs text-[#5A6270] mt-1.5">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" />
                          Live URL:
                        </span>
                        <a
                          href={selectedItem.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2A548E] hover:underline flex items-center gap-1 truncate max-w-xs font-mono text-[11px]"
                        >
                          {selectedItem.liveUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {selectedItem.urlFetchStatus === 'failed' && (
                          <span className="text-amber-700 font-semibold text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Fetch Failed
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-[#5A6270] mt-1.5">
                        <span>Source Confidence: {((selectedItem.analysis?.confidence || 0.8) * 100).toFixed(0)}%</span>
                        <span>·</span>
                        <span className="italic">{selectedItem.analysis?.classificationReason}</span>
                      </div>
                    )}
                  </div>

                  {/* Document Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Toggle: Ready vs Needs Review */}
                    {selectedItem.status === 'ready' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateDraftStatus(selectedItem.id, 'needs_review')}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors"
                        title="Move draft back to Needs Review"
                      >
                        <span>Move to Review</span>
                      </button>
                    ) : selectedItem.status !== 'approved' ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateDraftStatus(selectedItem.id, 'ready')}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Mark draft as Ready for approval"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Mark as Ready</span>
                      </button>
                    ) : null}

                    {/* Save Draft Button (CRITICAL PRE-WRITE ACTION) */}
                    <button
                      type="button"
                      onClick={() => handleSaveDraft(selectedItem.id)}
                      disabled={isSavingDraft}
                      className="px-3 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="Save edits to import session (does NOT touch Jekyll site)"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingDraft ? 'Saving...' : 'Save Import Draft'}</span>
                    </button>

                    {/* Revert Button */}
                    <button
                      type="button"
                      onClick={() => handleRevertDraft(selectedItem.id)}
                      className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 rounded cursor-pointer transition-colors"
                      title="Revert draft back to original analysis"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {/* AI Enhance Button */}
                    <button
                      onClick={() => handleReanalyze(selectedItem.id, true)}
                      disabled={analyzingId === selectedItem.id}
                      className="px-2.5 py-1.5 bg-[#EEF5FF] hover:bg-[#99BFF9]/30 text-[#2A548E] text-xs font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer border border-[#99BFF9]/40"
                      title="Use Gemini to optimize SEO fields"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${analyzingId === selectedItem.id ? 'animate-spin' : ''}`} />
                      <span>{analyzingId === selectedItem.id ? 'Analyzing...' : 'AI SEO'}</span>
                    </button>

                    {/* Phase 1 Approval Button */}
                    {selectedItem.status === 'approved' ? (
                      <button
                        onClick={() => handleUnapprove(selectedItem.id)}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Revoke Approval</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(selectedItem.id)}
                        disabled={isApproving}
                        className="px-3.5 py-1.5 bg-[#226E56] hover:bg-[#154D3B] text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Analysis</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline URL Attachment Bar if Markdown item has no URL yet */}
                {!selectedItem.liveUrl && (
                  <div className="mt-3 pt-3 border-t border-[#99BFF9]/20 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[11px] text-[#5A6270] flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 text-[#2A548E]" />
                      Pair with Live Article URL to compare and reconcile:
                    </span>
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <input
                        type="url"
                        placeholder="https://example.com/gifts/astrophotography-guide"
                        value={attachUrlInput}
                        onChange={(e) => setAttachUrlInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-[#99BFF9]/40 rounded focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAttachUrlToItem()}
                        disabled={isAttachingUrl || !attachUrlInput.trim()}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded transition cursor-pointer"
                      >
                        {isAttachingUrl ? 'Fetching...' : 'Reconcile'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Warning Banner if URL fetch failed */}
                {selectedItem.urlFetchStatus === 'failed' && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Could not fetch live page:</strong> {selectedItem.urlFetchError || 'Unknown error'}.
                        Your Markdown import draft remains available.
                      </span>
                    </div>
                    {selectedItem.liveUrl && (
                      <button
                        type="button"
                        onClick={() => handleAttachUrlToItem(selectedItem.liveUrl)}
                        className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-semibold text-[11px] transition cursor-pointer shrink-0"
                      >
                        Retry Fetch
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Workspace Tabs */}
              <div className="flex border-b border-[#99BFF9]/20 px-4 bg-white text-xs font-medium overflow-x-auto">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'overview'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/40'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2A548E]" />
                  <span>Overview</span>
                </button>

                <button
                  onClick={() => setDetailTab('preview')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'preview'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/40'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-[#2A548E]" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => setDetailTab('editor')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'editor'
                      ? 'border-[#2A548E] text-[#2A548E]'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>

                <button
                  onClick={() => setDetailTab('links')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'links'
                      ? 'border-[#2A548E] text-[#2A548E] bg-[#EEF5FF]/40'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5 text-[#2A548E]" />
                  <span>Links</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full font-bold bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/40">
                    {(selectedItem.draft?.structuredLinks || selectedItem.analysis?.structuredLinks || []).filter(l => !l.isRemoved).length}
                  </span>
                </button>

                <button
                  onClick={() => setDetailTab('products')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'products'
                      ? 'border-purple-600 text-purple-800 bg-purple-50/40'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-purple-600" />
                  <span>Products</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full font-bold bg-purple-100 text-purple-800">
                    {(selectedItem.draft?.productDrafts || []).length > 0
                      ? (selectedItem.draft?.productDrafts || []).length
                      : (selectedItem.draft?.productCandidates || selectedItem.analysis?.productCandidates || []).length}
                  </span>
                </button>

                <button
                  onClick={() => setDetailTab('source')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'source'
                      ? 'border-[#2A548E] text-[#2A548E]'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Source</span>
                </button>

                <button
                  onClick={() => setDetailTab('mapping')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'mapping'
                      ? 'border-[#2A548E] text-[#2A548E]'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Field Mapping ({selectedItem.draft?.fieldMappings?.length || 0})</span>
                  {selectedItem.draft?.fieldMappings?.some(m => m.status === 'needs_review') && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>

                {/* Reconciliation Tab */}
                {selectedItem.reconciliationReport && (
                  <button
                    onClick={() => setDetailTab('reconcile')}
                    className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                      detailTab === 'reconcile'
                        ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                        : 'border-transparent text-[#5A6270] hover:text-purple-700'
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5 text-purple-600" />
                    <span>Reconciliation</span>
                  </button>
                )}

                <button
                  onClick={() => setDetailTab('issues')}
                  className={`py-3 px-3 border-b-2 font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 ${
                    detailTab === 'issues'
                      ? 'border-[#2A548E] text-[#2A548E]'
                      : 'border-transparent text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Warnings</span>
                  {selectedItem.analysis?.issues && selectedItem.analysis.issues.length > 0 && (
                    <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                      selectedItem.analysis.issues.some(iss => !selectedItem.draft?.resolvedIssueIds.includes(iss.id))
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedItem.analysis.issues.filter(iss => !selectedItem.draft?.resolvedIssueIds.includes(iss.id)).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-5 bg-[#FAF9F6]">
                {/* 1. OVERVIEW TAB */}
                {detailTab === 'overview' && selectedItem.draft && (
                  <MigrationOverviewPane
                    item={selectedItem}
                    draft={selectedItem.draft}
                    onCreatePost={handleCreatePost}
                    onSwitchTab={(t) => setDetailTab(t as any)}
                  />
                )}

                {/* 2. RENDERED ARTICLE PREVIEW TAB */}
                {detailTab === 'preview' && selectedItem.draft && (
                  <ArticlePreviewPane
                    draft={selectedItem.draft}
                    analysis={selectedItem.analysis}
                    structuredLinks={selectedItem.draft.structuredLinks || selectedItem.analysis?.structuredLinks || []}
                    productCandidates={selectedItem.draft.productCandidates || selectedItem.analysis?.productCandidates || []}
                    onSelectLinkTab={() => setDetailTab('links')}
                    onSelectProductTab={() => setDetailTab('products')}
                  />
                )}

                {/* 3. EDITOR TAB (Metadata & Body) */}
                {detailTab === 'editor' && selectedItem.draft && (
                  <div className="space-y-6">
                    <DraftMetadataEditor
                      draft={selectedItem.draft}
                      analysis={selectedItem.analysis}
                      onChange={handleUpdateDraft}
                      onAiEnhance={() => handleReanalyze(selectedItem.id, true)}
                      isAiEnhancing={analyzingId === selectedItem.id}
                    />

                    <BodyEditorPane
                      originalBody={selectedItem.analysis?.originalBody || selectedItem.rawContent}
                      draftBody={selectedItem.draft.body}
                      onChange={(newBody) => handleUpdateDraft({ body: newBody })}
                      onRevertToOriginal={() => handleUpdateDraft({ body: selectedItem.analysis?.originalBody || selectedItem.rawContent })}
                    />
                  </div>
                )}

                {/* 4. LINK RECOGNITION & REVIEW TAB */}
                {detailTab === 'links' && (
                  <LinkReviewPane
                    links={selectedItem.draft?.structuredLinks || selectedItem.analysis?.structuredLinks || []}
                    onUpdateLinks={handleUpdateLinks}
                    onExportProducts={handleExportProducts}
                    onNavigateToProductsTab={(productId?: string) => {
                      if (productId && onNavigateToCmsProduct) {
                        onNavigateToCmsProduct(productId);
                      } else {
                        setDetailTab('products');
                      }
                    }}
                  />
                )}

                {/* 5. PRODUCT CANDIDATES & DRAFTS TAB */}
                {detailTab === 'products' && (
                  <ProductCandidatesPane
                    candidates={selectedItem.draft?.productCandidates || selectedItem.analysis?.productCandidates || []}
                    productDrafts={selectedItem.draft?.productDrafts || []}
                    onCreateDraftFromCandidate={handleCreateProductFromCandidate}
                    onUpdateProductDraft={handleUpdateProductDraft}
                    onDeleteProductDraft={handleDeleteProductDraft}
                    onApproveProductDraft={handleApproveProductDraft}
                    onRejectCandidate={() => {}}
                    onOpenCmsProduct={onNavigateToCmsProduct}
                  />
                )}

                {/* 6. SOURCE TAB */}
                {detailTab === 'source' && (
                  <SourceInformationPane item={selectedItem} />
                )}

                {/* 7. FIELD MAPPING TAB */}
                {detailTab === 'mapping' && selectedItem.draft && (
                  <FieldMappingTable
                    mappings={selectedItem.draft.fieldMappings}
                    onRemap={handleRemapField}
                    onIgnore={handleIgnoreField}
                    onEditValue={handleEditFieldValue}
                  />
                )}

                {/* 8. RECONCILIATION TAB */}
                {detailTab === 'reconcile' && selectedItem.draft && (
                  <ReconciliationPane
                    item={selectedItem}
                    draft={selectedItem.draft}
                    onUpdateDraft={handleUpdateDraft}
                    onAdoptDiffField={handleAdoptDiffField}
                    onRefetchUrl={() => selectedItem.liveUrl && handleAttachUrlToItem(selectedItem.liveUrl)}
                    isRefetching={isAttachingUrl}
                  />
                )}

                {/* 9. WARNINGS & ISSUES TAB */}
                {detailTab === 'issues' && selectedItem.draft && (
                  <ActionableIssuesList
                    issues={selectedItem.analysis?.issues || []}
                    draft={selectedItem.draft}
                    onToggleResolve={handleToggleResolveIssue}
                    onActionRemap={handleRemapField}
                    onActionSetType={(type) => handleUpdateDraft({ targetType: type })}
                    onActionDemoteH1={() => {
                      if (selectedItem.draft) {
                        const fixed = selectedItem.draft.body.replace(/^#\s+(.+)$/gm, '## $1');
                        handleUpdateDraft({ body: fixed });
                      }
                    }}
                    onActionCopyTitleToSearchTitle={() => {
                      if (selectedItem.draft) {
                        handleUpdateDraft({ searchTitle: selectedItem.draft.title });
                      }
                    }}
                    onActionCopyDeckToSeoDesc={() => {
                      if (selectedItem.draft) {
                        handleUpdateDraft({ seoDescription: selectedItem.draft.deck.slice(0, 160) });
                      }
                    }}
                    onActionAppendSlug={() => {
                      if (selectedItem.draft) {
                        handleUpdateDraft({ slug: `${selectedItem.draft.slug}-imported` });
                      }
                    }}
                    onSwitchTab={(tab) => setDetailTab(tab as any)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Paste Modal */}
      <ImportPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onSubmit={(filename, content, targetType) => {
          uploadPayload([{ filename, content, targetType }]);
        }}
      />
    </div>
  );
}

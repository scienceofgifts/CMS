import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Trash2,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  FileCode,
  Tag,
  Layers,
  FileText,
  Sliders,
  Check,
  RotateCcw,
  Wand2,
  Image as ImageIcon,
  ImageDown,
  Loader2
} from 'lucide-react';
import { Product, ProductSpec, TaxonomyOptions, ProductAiOperation } from '../../types/product';
import { ProductCardPreview } from './ProductCardPreview';
import { AssetPickerModal } from '../assets/AssetPickerModal';
import { ProductAiModal } from './ProductAiModal';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { useModalEscape } from '../../hooks/useModalEscape';
import * as yamlModule from 'js-yaml';
const yaml: any = (yamlModule as any).default || yamlModule;

interface ProductFormProps {
  product: Product | null;
  taxonomies: TaxonomyOptions;
  existingProducts: Product[];
  onSave: (product: Product) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  product,
  taxonomies,
  existingProducts,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
}) => {
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);

  const handleRequestNavigation = (navAction: () => void) => {
    if (isDirty) {
      setPendingNavAction(() => navAction);
      setShowUnsavedModal(true);
    } else {
      navAction();
    }
  };

  useModalEscape(!showUnsavedModal, () => {
    if (showUnsavedModal) {
      setShowUnsavedModal(false);
    } else {
      handleRequestNavigation(onCancel);
    }
  });

  const isNew = !product;

  // Form State
  const [formData, setFormData] = useState<Product>(() => {
    if (product) {
      return JSON.parse(JSON.stringify(product));
    }
    return {
      id: '',
      title: '',
      image: '',
      imageType: '',
      price: '$50',
      priceNumber: 50,
      priceRange: '25-50',
      vendor: '',
      vendorUrl: '',
      affiliate: {
        sponsored: true,
        rel: 'noopener noreferrer sponsored',
      },
      category: 'editors-pick',
      badgeLabel: null,
      recipients: ['friend', 'partner'],
      interests: ['books'],
      occasions: ['birthday', 'holidays'],
      ageRanges: ['25-34'],
      personalityStyles: ['thoughtful', 'practical'],
      tags: ['books', 'friend', 'partner', 'birthday', 'holidays', 'thoughtful', 'practical'],
      editorialReview: '',
      whyItMakesAGreatGift: '',
      idealFor: '',
      whatMakesItStandOut: '',
      thingsToConsider: '',
      specs: [],
    };
  });

  const [activeTab, setActiveTab] = useState<'basic' | 'taxonomy' | 'editorial' | 'specs' | 'preview'>('basic');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [customRecipientInput, setCustomRecipientInput] = useState<string>('');
  const [customInterestInput, setCustomInterestInput] = useState<string>('');
  const [customOccasionInput, setCustomOccasionInput] = useState<string>('');
  const [customStyleInput, setCustomStyleInput] = useState<string>('');
  const [previewSubMode, setPreviewSubMode] = useState<'card' | 'grid' | 'yaml'>('card');
  const [showAssetPicker, setShowAssetPicker] = useState<boolean>(false);
  const [isFetchingImage, setIsFetchingImage] = useState<boolean>(false);
  const [imageFetchMessage, setImageFetchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Assistant Modal State
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiInitialOp, setAiInitialOp] = useState<ProductAiOperation>('analyze_product');
  const [researchContext, setResearchContext] = useState<any>(null);
  const [researchStatus, setResearchStatus] = useState<'not_run' | 'researching' | 'complete' | 'outdated'>('not_run');

  useEffect(() => {
    if (researchContext && researchStatus === 'complete') {
      const urlChanged = (formData.vendorUrl || '').trim() !== (researchContext.productUrlAtResearch || '').trim();
      const imageChanged = (formData.image || '').trim() !== (researchContext.productImageAtResearch || '').trim();
      if (urlChanged || imageChanged) {
        setResearchStatus('outdated');
      }
    }
  }, [formData.vendorUrl, formData.image, researchContext, researchStatus]);

  const openAiAssistant = (op: ProductAiOperation = 'analyze_product') => {
    setAiInitialOp(op);
    setAiModalOpen(true);
  };

  const handleFetchProductImage = async () => {
    const rawUrl = (formData.vendorUrl || '').trim();
    if (!rawUrl) {
      setImageFetchMessage({ type: 'error', text: 'Please enter a Direct Product URL first.' });
      return;
    }

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setImageFetchMessage({ type: 'error', text: 'URL must start with http:// or https://' });
        return;
      }
    } catch {
      setImageFetchMessage({ type: 'error', text: 'Please enter a valid HTTP or HTTPS product URL.' });
      return;
    }

    setIsFetchingImage(true);
    setImageFetchMessage(null);

    try {
      const response = await fetch('/api/products/fetch-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: rawUrl,
          productId: formData.id || '',
          title: formData.title || ''
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract product image from URL.');
      }

      setIsDirty(true);
      // Update the product image identifier/path
      updateField('image', data.relativePath);
      if (!formData.imageType || formData.imageType === formData.id) {
        updateField('imageType', data.nameWithoutExt || formData.id);
      }

      setImageFetchMessage({
        type: 'success',
        text: `Image "${data.filename}" imported and selected.`
      });
    } catch (err: any) {
      setImageFetchMessage({
        type: 'error',
        text: err.message || 'Failed to fetch product image.'
      });
    } finally {
      setIsFetchingImage(false);
    }
  };

  const handleApplyAiTitle = (newTitle: string) => {
    updateField('title', newTitle);
    if (!formData.id) {
      const slug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 45);
      updateField('id', slug);
      if (!formData.image) updateField('image', slug);
      if (!formData.imageType) updateField('imageType', slug);
    }
  };

  const handleApplyAiText = (field: keyof Product, val: string) => {
    updateField(field, val);
  };

  const handleApplyAiTaxonomy = (selected: {
    recipients?: string[];
    interests?: string[];
    occasions?: string[];
    ageRanges?: string[];
    personalityStyles?: string[];
  }) => {
    setFormData(prev => {
      const mergeUnique = (existing: string[] = [], additions: string[] = []) => {
        const set = new Set([...existing, ...additions]);
        return Array.from(set);
      };

      const newRecipients = mergeUnique(prev.recipients, selected.recipients);
      const newInterests = mergeUnique(prev.interests, selected.interests);
      const newOccasions = mergeUnique(prev.occasions, selected.occasions);
      const newAgeRanges = mergeUnique(prev.ageRanges, selected.ageRanges);
      const newStyles = mergeUnique(prev.personalityStyles, selected.personalityStyles);

      // Auto-sync tags
      const tagSet = new Set(prev.tags || []);
      newRecipients.forEach(r => tagSet.add(r));
      newInterests.forEach(i => tagSet.add(i));
      newOccasions.forEach(o => tagSet.add(o));
      newStyles.forEach(s => tagSet.add(s));

      return {
        ...prev,
        recipients: newRecipients,
        interests: newInterests,
        occasions: newOccasions,
        ageRanges: newAgeRanges,
        personalityStyles: newStyles,
        tags: Array.from(tagSet)
      };
    });
  };

  // Track saved snapshot for dirty state
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(formData));

  useEffect(() => {
    if (product) {
      const snap = JSON.stringify(product);
      setFormData(JSON.parse(snap));
      setSavedSnapshot(snap);
    }
  }, [product]);

  useEffect(() => {
    const currentSnapshot = JSON.stringify(formData);
    const dirty = currentSnapshot !== savedSnapshot;
    setIsDirty(dirty);
    (window as any).cmsIsDirty = dirty;
    return () => {
      (window as any).cmsIsDirty = false;
    };
  }, [formData, savedSnapshot]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleConfirmDiscard = () => {
    setFormData(JSON.parse(savedSnapshot));
    setIsDirty(false);
    (window as any).cmsIsDirty = false;
    setShowUnsavedModal(false);
    if (pendingNavAction) {
      const nav = pendingNavAction;
      setPendingNavAction(null);
      nav();
    }
  };

  const handleConfirmSave = async () => {
    const errs: string[] = [];

    if (!formData.id.trim()) errs.push('Product ID is required.');
    else if (!idStatus.valid) errs.push(idStatus.message);

    if (!formData.title.trim()) errs.push('Product Title is required.');
    if (!formData.vendor.trim()) errs.push('Vendor Name is required.');
    if (!formData.priceNumber || formData.priceNumber <= 0) errs.push('Valid price number is required.');
    if (!formData.category.trim()) errs.push('Category is required.');

    if (errs.length > 0) {
      setErrors(errs);
      setShowUnsavedModal(false);
      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      const ok = await onSave(formData);
      if (ok) {
        setSavedSnapshot(JSON.stringify(formData));
        setIsDirty(false);
        (window as any).cmsIsDirty = false;
        setShowUnsavedModal(false);
        if (pendingNavAction) {
          const nav = pendingNavAction;
          setPendingNavAction(null);
          nav();
        }
      } else {
        setShowUnsavedModal(false);
      }
    } catch {
      setShowUnsavedModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  // ID Uniqueness & validity check
  const idStatus = useMemo(() => {
    const slug = formData.id.trim();
    if (!slug) return { valid: false, message: 'ID is required' };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { valid: false, message: 'Use lowercase letters, numbers, and hyphens only' };
    }
    const exists = existingProducts.some(p => p.id === slug && (isNew ? true : p.id !== product?.id));
    if (exists) {
      return { valid: false, message: 'ID already exists in catalog' };
    }
    return { valid: true, message: 'ID is unique & valid' };
  }, [formData.id, existingProducts, isNew, product?.id]);

  const updateField = (field: keyof Product, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Slug generator from title
  const generateSlugFromTitle = () => {
    if (!formData.title) return;
    const slug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 45);
    updateField('id', slug);
    if (!formData.image) updateField('image', slug);
    if (!formData.imageType) updateField('imageType', slug);
  };

  // Price & PriceNumber auto-sync
  const handlePriceNumberChange = (num: number) => {
    const validNum = isNaN(num) ? 0 : Math.max(0, num);
    updateField('priceNumber', validNum);
    updateField('price', `$${validNum}`);

    // Auto suggest priceRange if current is default
    if (validNum < 25) updateField('priceRange', 'under-25');
    else if (validNum <= 50) updateField('priceRange', '25-50');
    else if (validNum <= 100) updateField('priceRange', '50-100');
    else updateField('priceRange', '100-plus');
  };

  // Array item togglers
  const toggleArrayItem = (field: 'recipients' | 'interests' | 'occasions' | 'ageRanges' | 'personalityStyles', item: string) => {
    const current = (formData[field] || []) as string[];
    const exists = current.includes(item);
    const updated = exists ? current.filter(i => i !== item) : [...current, item];
    updateField(field, updated);
  };

  const addCustomArrayItem = (field: 'recipients' | 'interests' | 'occasions' | 'personalityStyles', value: string, clearFn: () => void) => {
    const clean = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!clean) return;
    const current = (formData[field] || []) as string[];
    if (!current.includes(clean)) {
      updateField(field, [...current, clean]);
    }
    clearFn();
  };

  // Tags management
  const addTag = () => {
    const clean = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!clean) return;
    const current = formData.tags || [];
    if (!current.includes(clean)) {
      updateField('tags', [...current, clean]);
    }
    setNewTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    const current = formData.tags || [];
    updateField('tags', current.filter(t => t !== tagToRemove));
  };

  const autoSyncTagsFromAudience = () => {
    const tagSet = new Set<string>(formData.tags || []);
    (formData.interests || []).forEach(i => tagSet.add(i));
    (formData.recipients || []).forEach(r => tagSet.add(r));
    (formData.occasions || []).forEach(o => tagSet.add(o));
    (formData.personalityStyles || []).forEach(s => tagSet.add(s));
    if (formData.category) tagSet.add(formData.category);
    updateField('tags', Array.from(tagSet));
  };

  // Specs management
  const addSpec = (label = '', value = '') => {
    const current = formData.specs || [];
    updateField('specs', [...current, { label, value }]);
  };

  const updateSpec = (index: number, key: 'label' | 'value', val: string) => {
    const current = [...(formData.specs || [])];
    current[index] = { ...current[index], [key]: val };
    updateField('specs', current);
  };

  const removeSpec = (index: number) => {
    const current = [...(formData.specs || [])];
    current.splice(index, 1);
    updateField('specs', current);
  };

  const moveSpec = (index: number, direction: 'up' | 'down') => {
    const current = [...(formData.specs || [])];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[index];
    current[index] = current[targetIdx];
    current[targetIdx] = temp;
    updateField('specs', current);
  };

  // Validate and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];

    if (!formData.id.trim()) errs.push('Product ID is required.');
    else if (!idStatus.valid) errs.push(idStatus.message);

    if (!formData.title.trim()) errs.push('Product Title is required.');
    if (!formData.vendor.trim()) errs.push('Vendor Name is required.');
    if (!formData.priceNumber || formData.priceNumber <= 0) errs.push('Valid price number is required.');
    if (!formData.category.trim()) errs.push('Category is required.');

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      const ok = await onSave(formData);
      if (ok) {
        setSavedSnapshot(JSON.stringify(formData));
        setIsDirty(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Serialized YAML preview text
  const currentYaml = useMemo(() => {
    try {
      return yaml.dump([formData], { indent: 2, lineWidth: -1, noRefs: true });
    } catch {
      return 'Error generating YAML preview';
    }
  }, [formData]);

  return (
    <div className="space-y-6">
      {/* 1. TOP STICKY BAR: Actions, Breadcrumb & Unsaved Indicator */}
      <div className="bg-white border border-[#99BFF9]/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 sticky top-20 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleRequestNavigation(onCancel)}
            className="p-2 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded transition-colors cursor-pointer"
            title="Return to Product Catalog"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#226E56] font-semibold">
                {isNew ? 'New Product' : 'Product Editor'}
              </span>
              {isDirty && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                  Unsaved Changes
                </span>
              )}
            </div>
            <h2 className="font-serif-display text-xl sm:text-2xl text-[#1E232B] font-medium leading-tight truncate max-w-md">
              {formData.title || (isNew ? 'Untitled New Product' : formData.id)}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAiAssistant('analyze_product')}
            className="px-3.5 py-2 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/50 text-xs font-semibold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Analyze product, generate editorial reviews, titles, and taxonomy suggestions"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Assistant</span>
          </button>

          {!isNew && onDuplicate && (
            <button
              type="button"
              onClick={() => onDuplicate(product!.id)}
              disabled={isSaving}
              className="px-3 py-2 bg-white border border-[#99BFF9]/40 hover:bg-[#EEF5FF] text-[#2A548E] text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
          )}

          {!isNew && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(product!.id)}
              disabled={isSaving}
              className="px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !idStatus.valid}
            className="px-6 py-2 bg-[#2A548E] hover:bg-[#1B365D] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save to products.yml'}</span>
          </button>
        </div>
      </div>

      {/* Errors Banner */}
      {errors.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Please resolve the following before saving:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {errors.map((e, idx) => (
              <li key={idx}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. TABBED FORM NAVIGATION */}
      <div className="bg-white border-b border-[#99BFF9]/30 flex flex-wrap gap-1 px-4 sm:px-6 pt-3 text-xs font-medium text-[#5A6270]">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'basic'
              ? 'border-[#2A548E] text-[#2A548E] font-semibold'
              : 'border-transparent hover:text-[#1E232B]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Basic Information</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('taxonomy')}
          className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'taxonomy'
              ? 'border-[#2A548E] text-[#2A548E] font-semibold'
              : 'border-transparent hover:text-[#1E232B]'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Taxonomy &amp; Audience</span>
          {((formData.recipients?.length || 0) + (formData.interests?.length || 0)) > 0 && (
            <span className="px-1.5 py-0.2 bg-[#FAF9F6] border text-[10px] text-[#5A6270]">
              {(formData.recipients?.length || 0) + (formData.interests?.length || 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('editorial')}
          className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'editorial'
              ? 'border-[#2A548E] text-[#2A548E] font-semibold'
              : 'border-transparent hover:text-[#1E232B]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Editorial Copy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('specs')}
          className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'specs'
              ? 'border-[#2A548E] text-[#2A548E] font-semibold'
              : 'border-transparent hover:text-[#1E232B]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Specifications ({formData.specs?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ml-auto ${
            activeTab === 'preview'
              ? 'border-[#226E56] text-[#226E56] font-semibold'
              : 'border-transparent text-[#226E56]/80 hover:text-[#226E56]'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Preview &amp; YAML</span>
        </button>
      </div>

      {/* 3. TAB PANELS */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PANEL 1: BASIC INFORMATION */}
        {activeTab === 'basic' && (
          <div className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-[#99BFF9]/20 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
                  Core Product Attributes
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Essential identity, pricing, vendor and image references.
                </p>
              </div>
              <span className="text-[11px] font-mono-code text-[#226E56]">Section 1/4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Product ID (Slug) */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                  <span>Product ID (Slug) <span className="text-rose-600">*</span></span>
                  {formData.title && (
                    <button
                      type="button"
                      onClick={generateSlugFromTitle}
                      className="text-[11px] text-[#2A548E] hover:underline flex items-center gap-1 lowercase font-normal cursor-pointer"
                    >
                      <Wand2 className="w-3 h-3" /> auto-slug from title
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => updateField('id', e.target.value)}
                    placeholder="brass-book-weight"
                    className={`w-full px-3 py-2 text-xs font-mono-code bg-[#FAF9F6] border rounded focus:outline-none focus:border-[#2A548E] ${
                      !idStatus.valid ? 'border-rose-400' : 'border-stone-300'
                    }`}
                  />
                  <div className="absolute right-2.5 top-2.5">
                    {idStatus.valid ? (
                      <Check className="w-4 h-4 text-[#226E56]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                </div>
                <div className={`text-[11px] ${idStatus.valid ? 'text-[#226E56]' : 'text-rose-600'}`}>
                  {idStatus.message}
                </div>
              </div>

              {/* Title */}
              <div className="md:col-span-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Product Title <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('suggest_title')}
                    className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2A548E]" />
                    <span>AI Titles</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Craighill Cast Solid Brass Desk Page Anchor"
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Price & Price Number */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Price Number (USD) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-[#5A6270]">$</span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formData.priceNumber}
                    onChange={(e) => handlePriceNumberChange(parseFloat(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 text-xs font-mono-code bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                  />
                </div>
              </div>

              {/* Price Display String */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Display Price Format
                </label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  placeholder="$55"
                  className="w-full px-3 py-2 text-xs font-mono-code bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Price Range */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Price Tier
                </label>
                <select
                  value={formData.priceRange}
                  onChange={(e) => updateField('priceRange', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                >
                  <option value="under-25">under-25 (&lt; $25)</option>
                  <option value="25-50">25-50 ($25 to $50)</option>
                  <option value="50-100">50-100 ($50 to $100)</option>
                  <option value="100-plus">100-plus (&gt; $100)</option>
                </select>
              </div>

              {/* Category */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Editorial Category <span className="text-rose-600">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                >
                  <option value="editors-pick">editors-pick (Lead Recommendation)</option>
                  <option value="quick-pick">quick-pick (Fast/Accessible Pick)</option>
                  <option value="under-50">under-50 (Sub-$50 Curated)</option>
                  <option value="under-30">under-30 (Sub-$30 Gift)</option>
                  <option value="under-100">under-100 (Mid-tier Heirloom)</option>
                  <option value="heirloom">heirloom (Generational Object)</option>
                </select>
              </div>

              {/* Badge Label */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Badge Label <span className="text-[#5A6270] font-normal lowercase">(optional headline banner)</span>
                </label>
                <input
                  type="text"
                  value={formData.badgeLabel || ''}
                  onChange={(e) => updateField('badgeLabel', e.target.value ? e.target.value : null)}
                  placeholder="e.g., Reader's Essential, Rare Find, Curator Choice"
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Vendor & Vendor URL */}
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Vendor / Atelier / Maker <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => updateField('vendor', e.target.value)}
                  placeholder="Craighill Studio"
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Direct Product URL
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFetchProductImage}
                      disabled={isFetchingImage || !formData.vendorUrl?.trim()}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer border ${
                        isFetchingImage
                          ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-wait'
                          : !formData.vendorUrl?.trim()
                          ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                          : 'bg-[#2A548E]/10 hover:bg-[#2A548E]/20 text-[#2A548E] border-[#2A548E]/30 active:scale-95'
                      }`}
                      title="Fetch product page and automatically extract, download, and select image"
                    >
                      {isFetchingImage ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>FETCHING IMAGE...</span>
                        </>
                      ) : (
                        <>
                          <ImageDown className="w-3 h-3" />
                          <span>FETCH PRODUCT IMAGE</span>
                        </>
                      )}
                    </button>
                    {formData.vendorUrl && (
                      <a
                        href={formData.vendorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#2A548E] hover:underline flex items-center gap-1 font-normal normal-case"
                      >
                        <span>test link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  value={formData.vendorUrl}
                  onChange={(e) => {
                    updateField('vendorUrl', e.target.value);
                    if (imageFetchMessage) setImageFetchMessage(null);
                  }}
                  placeholder="https://example.com/item"
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
                {imageFetchMessage && (
                  <div
                    className={`text-[11px] px-2.5 py-1.5 rounded flex items-center justify-between gap-2 transition-all ${
                      imageFetchMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {imageFetchMessage.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span className="truncate">{imageFetchMessage.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImageFetchMessage(null)}
                      className="text-stone-400 hover:text-stone-700 cursor-pointer font-bold shrink-0 ml-1"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Image & ImageType */}
              <div className="md:col-span-12 space-y-3 p-4 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#2A548E]" />
                    Product Image &amp; Library Selector
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAssetPicker(true)}
                    className="px-3 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Choose from Library</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-4">
                    <div className="aspect-[4/3] bg-white border border-stone-300 rounded overflow-hidden flex items-center justify-center relative group">
                      {formData.image ? (
                        <img
                          src={formData.image.startsWith('/') || formData.image.startsWith('http') ? formData.image : formData.image.startsWith('assets/') ? `/${formData.image}` : `/assets/images/${formData.image}.jpg`}
                          alt={formData.title || 'Product preview'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/assets/images/home-hero.jpg';
                          }}
                        />
                      ) : (
                        <div className="text-center p-3">
                          <ImageIcon className="w-8 h-8 text-stone-300 mx-auto mb-1" />
                          <span className="text-[11px] text-stone-400 italic">No image selected</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <label className="block text-[11px] text-[#5A6270] mb-0.5">Image Identifier / Path (Manual)</label>
                      <input
                        type="text"
                        value={formData.image}
                        onChange={(e) => updateField('image', e.target.value)}
                        placeholder="brass-book-weight"
                        className="w-full px-3 py-2 text-xs font-mono-code bg-white border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                      />
                      <span className="text-[11px] text-[#5A6270] mt-0.5 block">
                        Corresponds to asset path or identifier in <code className="font-mono bg-stone-100 px-1">assets/images/</code>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAssetPicker(true)}
                        className="px-3 py-1.5 bg-white hover:bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/50 text-xs font-semibold rounded transition-colors cursor-pointer"
                      >
                        {formData.image ? 'Change Image' : 'Select from Library'}
                      </button>
                      {formData.image && (
                        <button
                          type="button"
                          onClick={() => {
                            updateField('image', '');
                            updateField('imageType', '');
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded transition-colors cursor-pointer"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-12 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Image Type Preset
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.imageType}
                    onChange={(e) => updateField('imageType', e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-mono-code bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                  >
                    <option value={formData.id}>{formData.id || 'Current ID'}</option>
                    {taxonomies.imageTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={formData.imageType}
                    onChange={(e) => updateField('imageType', e.target.value)}
                    placeholder="or custom type"
                    className="w-36 px-2 py-2 text-xs font-mono-code bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                  />
                </div>
              </div>

              {/* Affiliate Details */}
              <div className="md:col-span-12 p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">
                  Affiliate Disclosure &amp; Link Relations
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.affiliate?.sponsored ?? true}
                      onChange={(e) => updateField('affiliate', {
                        ...(formData.affiliate || {}),
                        sponsored: e.target.checked
                      })}
                      className="rounded text-[#2A548E] focus:ring-[#2A548E]"
                    />
                    <span className="text-[#1E232B] font-medium">Affiliate Sponsored Link</span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#5A6270] block">Link Relationship (rel):</label>
                    <input
                      type="text"
                      value={formData.affiliate?.rel || 'noopener noreferrer sponsored'}
                      onChange={(e) => updateField('affiliate', {
                        ...(formData.affiliate || {}),
                        rel: e.target.value
                      })}
                      className="w-full px-2.5 py-1 text-xs font-mono-code bg-white border border-stone-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: TAXONOMY & AUDIENCE */}
        {activeTab === 'taxonomy' && (
          <div className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-[#99BFF9]/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
                  Taxonomies &amp; Audience Targeting
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Powers the Gift Finder algorithm, Guide filtering, and Category indices.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAiAssistant('suggest_taxonomy')}
                  className="px-3 py-1.5 bg-[#EEF5FF] border border-[#99BFF9]/40 text-[#2A548E] hover:bg-[#2A548E] hover:text-white text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Suggest Taxonomy</span>
                </button>
                <button
                  type="button"
                  onClick={autoSyncTagsFromAudience}
                  className="px-3 py-1.5 bg-[#EEF5FF] border border-[#99BFF9]/40 text-[#2A548E] hover:bg-[#99BFF9]/20 text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2A548E]" />
                  <span>Auto-sync Tags</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* Recipients */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                  <span>Target Recipients ({(formData.recipients || []).length} selected)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {taxonomies.recipients.map(r => {
                    const isSelected = (formData.recipients || []).includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleArrayItem('recipients', r)}
                        className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#132644] text-white border-[#132644] font-medium'
                            : 'bg-[#FAF9F6] text-[#5A6270] border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {r}
                      </button>
                    );
                  })}
                </div>
                {/* Custom recipient input */}
                <div className="flex items-center gap-2 pt-1 max-w-sm">
                  <input
                    type="text"
                    value={customRecipientInput}
                    onChange={(e) => setCustomRecipientInput(e.target.value)}
                    placeholder="+ Add custom recipient"
                    className="flex-1 px-2.5 py-1 text-xs bg-[#FAF9F6] border border-stone-300 rounded"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomArrayItem('recipients', customRecipientInput, () => setCustomRecipientInput(''));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustomArrayItem('recipients', customRecipientInput, () => setCustomRecipientInput(''))}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-xs rounded border border-stone-300 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Interests */}
              <div className="space-y-2 pt-4 border-t border-stone-100">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Interests &amp; Topics ({(formData.interests || []).length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {taxonomies.interests.map(i => {
                    const isSelected = (formData.interests || []).includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleArrayItem('interests', i)}
                        className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#2A548E] text-white border-[#2A548E] font-medium'
                            : 'bg-[#FAF9F6] text-[#5A6270] border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {i}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-1 max-w-sm">
                  <input
                    type="text"
                    value={customInterestInput}
                    onChange={(e) => setCustomInterestInput(e.target.value)}
                    placeholder="+ Add custom interest"
                    className="flex-1 px-2.5 py-1 text-xs bg-[#FAF9F6] border border-stone-300 rounded"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomArrayItem('interests', customInterestInput, () => setCustomInterestInput(''));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addCustomArrayItem('interests', customInterestInput, () => setCustomInterestInput(''))}
                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-xs rounded border border-stone-300 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Occasions */}
              <div className="space-y-2 pt-4 border-t border-stone-100">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                  Occasions &amp; Moments ({(formData.occasions || []).length} selected)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {taxonomies.occasions.map(o => {
                    const isSelected = (formData.occasions || []).includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggleArrayItem('occasions', o)}
                        className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#226E56] text-white border-[#226E56] font-medium'
                            : 'bg-[#FAF9F6] text-[#5A6270] border-stone-200 hover:border-stone-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Age Ranges & Personality Styles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Age Demographics
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {taxonomies.ageRanges.map(a => {
                      const isSelected = (formData.ageRanges || []).includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => toggleArrayItem('ageRanges', a)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'bg-[#FAF9F6] text-[#5A6270] border-stone-200'
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Personality Archetypes
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {taxonomies.personalityStyles.map(s => {
                      const isSelected = (formData.personalityStyles || []).includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleArrayItem('personalityStyles', s)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#8C6D1F] text-white border-[#8C6D1F]'
                              : 'bg-[#FAF9F6] text-[#5A6270] border-stone-200'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tags Dynamic List */}
              <div className="space-y-2 pt-4 border-t border-stone-100">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                  <span>Search Tags ({(formData.tags || []).length})</span>
                  <span className="text-[11px] text-[#5A6270] font-normal">
                    Direct keyword matching for search bar
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-[#FAF9F6] border border-stone-200 rounded">
                  {(formData.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-stone-300 text-xs text-[#1E232B] rounded-xs shadow-2xs"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-stone-400 hover:text-rose-600 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {(formData.tags || []).length === 0 && (
                    <span className="text-xs text-stone-400 italic">No tags added yet.</span>
                  )}
                </div>

                <div className="flex gap-2 max-w-sm pt-1">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Add custom tag"
                    className="flex-1 px-3 py-1.5 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-1.5 bg-[#2A548E] text-white text-xs font-medium rounded hover:bg-[#1B365D] cursor-pointer"
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 3: EDITORIAL COPY */}
        {activeTab === 'editorial' && (
          <div className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-[#99BFF9]/20 pb-3">
              <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
                Editorial Review &amp; Narrative Hooks
              </h3>
              <p className="text-xs text-[#5A6270]">
                Craft the descriptive paragraphs and evaluative highlights shown on guide cards.
              </p>
            </div>

            <div className="space-y-6">
              {/* Editorial Review */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold uppercase tracking-wider text-[#1E232B]">
                      Primary Editorial Review
                    </label>
                    <button
                      type="button"
                      onClick={() => openAiAssistant('editorial_review')}
                      className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#2A548E]" />
                      <span>AI Draft</span>
                    </button>
                  </div>
                  <span className="font-mono-code text-[11px] text-[#5A6270]">
                    {(formData.editorialReview || '').split(/\s+/).filter(Boolean).length} words · {(formData.editorialReview || '').length} chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formData.editorialReview}
                  onChange={(e) => updateField('editorialReview', e.target.value)}
                  placeholder="In-depth analysis of the object's design, material balance, tactile heft, and why it surpasses conventional alternatives..."
                  className="w-full px-3 py-2 text-xs leading-relaxed bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Why It Makes A Great Gift */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#154D3B] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
                    <span>Why It Makes a Great Gift (Highlighted Quote Box)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('why_it_makes_a_great_gift')}
                    className="text-[11px] text-[#226E56] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#226E56]" />
                    <span>AI Quote</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formData.whyItMakesAGreatGift}
                  onChange={(e) => updateField('whyItMakesAGreatGift', e.target.value)}
                  placeholder="Solves the frustrating problem of books snapping shut during tea drinking or note taking."
                  className="w-full px-3 py-2 text-xs leading-relaxed bg-[#FAF9F6] border border-[#226E56]/30 rounded focus:outline-none focus:border-[#226E56]"
                />
              </div>

              {/* Ideal For */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Ideal For
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('ideal_for')}
                    className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2A548E]" />
                    <span>AI Ideal For</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.idealFor}
                  onChange={(e) => updateField('idealFor', e.target.value)}
                  placeholder="Anyone who reads while writing, eating, or studying."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* What Makes It Stand Out */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    What Makes It Stand Out
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('what_makes_it_stand_out')}
                    className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2A548E]" />
                    <span>AI Stand Out</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.whatMakesItStandOut}
                  onChange={(e) => updateField('whatMakesItStandOut', e.target.value)}
                  placeholder="Cast from solid yellow brass with a tumbled satin luster."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Things to Consider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Things to Consider (Caveats / Honest Appraisals)
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('things_to_consider')}
                    className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2A548E]" />
                    <span>AI Caveats</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.thingsToConsider}
                  onChange={(e) => updateField('thingsToConsider', e.target.value)}
                  placeholder="Heavier than it looks (420 grams)."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>

              {/* Tagline */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
                    Editorial Tagline
                  </label>
                  <button
                    type="button"
                    onClick={() => openAiAssistant('suggest_tagline')}
                    className="text-[11px] text-[#2A548E] hover:underline font-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2A548E]" />
                    <span>AI Tagline</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  placeholder="e.g. A solid brass page anchor for hands-free reading and desk curation."
                  className="w-full px-3 py-2 text-xs bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                />
              </div>
            </div>
          </div>
        )}

        {/* PANEL 4: SPECIFICATIONS */}
        {activeTab === 'specs' && (
          <div className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-[#99BFF9]/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
                  Technical &amp; Archival Specifications
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Structured label/value attributes (materials, dimensions, provenance, weight, origin).
                </p>
              </div>

              <button
                type="button"
                onClick={() => addSpec()}
                className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Specification</span>
              </button>
            </div>

            {/* Quick Template Presets */}
            <div className="p-3 bg-[#FAF9F6] border border-stone-200 text-xs space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-[#5A6270] font-semibold block">
                Quick Template Fields:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Materials', value: 'Solid Marine Brass & Walnut' },
                  { label: 'Dimensions', value: '18 cm × 14 cm × 11 cm' },
                  { label: 'Weight', value: '420 grams' },
                  { label: 'Origin', value: 'Hand-finished in Athens, Greece' },
                  { label: 'Care', value: 'Wipe with microfiber cloth; avoid acidic polish' },
                  { label: 'Compatibility', value: 'Fits standard 1.2-inch spines' }
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => addSpec(p.label, p.value)}
                    className="px-2.5 py-1 bg-white border border-stone-300 hover:border-[#2A548E] hover:text-[#2A548E] text-[11px] text-[#1E232B] rounded transition-colors cursor-pointer"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specs List */}
            {(!formData.specs || formData.specs.length === 0) ? (
              <div className="py-12 text-center text-xs text-[#5A6270] border border-dashed border-stone-200 rounded p-6">
                No specifications defined for this product yet. Click "+ Add Specification" or select a template above.
              </div>
            ) : (
              <div className="space-y-3">
                {formData.specs.map((spec: ProductSpec, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#FAF9F6] border border-stone-200 rounded flex flex-col sm:flex-row items-center gap-3"
                  >
                    <div className="w-full sm:w-1/3">
                      <label className="text-[10px] uppercase font-semibold text-[#5A6270] block mb-0.5">
                        Label
                      </label>
                      <input
                        type="text"
                        value={spec.label}
                        onChange={(e) => updateSpec(idx, 'label', e.target.value)}
                        placeholder="e.g., Materials"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>

                    <div className="w-full sm:flex-1">
                      <label className="text-[10px] uppercase font-semibold text-[#5A6270] block mb-0.5">
                        Value
                      </label>
                      <input
                        type="text"
                        value={spec.value}
                        onChange={(e) => updateSpec(idx, 'value', e.target.value)}
                        placeholder="e.g., Solid Brass & Oiled Walnut"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                      />
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center pt-2 sm:pt-4">
                      <button
                        type="button"
                        onClick={() => moveSpec(idx, 'up')}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSpec(idx, 'down')}
                        disabled={idx === formData.specs!.length - 1}
                        title="Move Down"
                        className="p-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSpec(idx)}
                        title="Remove"
                        className="p-1.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL 5: LIVE PREVIEW & RAW YAML INSPECTOR */}
        {activeTab === 'preview' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#99BFF9]/30 p-4 sm:p-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-display text-xl text-[#1E232B] font-normal">
                  Live Editorial Output Preview
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Inspect how this item renders in the Science of Gifts aesthetic, or review the exact YAML serialization.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-[#FAF9F6] border border-stone-200 p-1 rounded">
                <button
                  type="button"
                  onClick={() => setPreviewSubMode('card')}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                    previewSubMode === 'card'
                      ? 'bg-white shadow-2xs text-[#2A548E] font-semibold'
                      : 'text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  Guide Card
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSubMode('grid')}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer ${
                    previewSubMode === 'grid'
                      ? 'bg-white shadow-2xs text-[#2A548E] font-semibold'
                      : 'text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  Catalog Card
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSubMode('yaml')}
                  className={`px-3 py-1 text-xs rounded transition-colors cursor-pointer flex items-center gap-1 ${
                    previewSubMode === 'yaml'
                      ? 'bg-white shadow-2xs text-[#2A548E] font-semibold'
                      : 'text-[#5A6270] hover:text-[#1E232B]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>YAML</span>
                </button>
              </div>
            </div>

            {previewSubMode === 'card' && (
              <ProductCardPreview product={formData} viewMode="full" />
            )}

            {previewSubMode === 'grid' && (
              <div className="max-w-sm mx-auto">
                <ProductCardPreview product={formData} viewMode="grid" />
              </div>
            )}

            {previewSubMode === 'yaml' && (
              <div className="bg-[#FAF9F6] border border-[#99BFF9]/30 rounded p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-[#5A6270]">
                  <span className="font-mono-code font-bold">_data/products.yml (Entry Preview)</span>
                  <span>{currentYaml.split('\n').length} lines</span>
                </div>
                <pre className="p-4 bg-white border border-stone-200 text-xs font-mono-code text-[#1E232B] overflow-x-auto max-h-[500px] leading-relaxed whitespace-pre-wrap select-text">
                  {currentYaml}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Asset Picker Modal */}
        <AssetPickerModal
          isOpen={showAssetPicker}
          onClose={() => setShowAssetPicker(false)}
          initialAltText={formData.title || ''}
          showCaptionInput={false}
          onSelect={(selected) => {
            setIsDirty(true);
            updateField('image', selected.path);
            if (!formData.imageType || formData.imageType === formData.id) {
              updateField('imageType', selected.nameWithoutExt);
            }
          }}
        />

        {/* Product AI Assistant Modal */}
        <ProductAiModal
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          initialOperation={aiInitialOp}
          product={formData}
          taxonomies={taxonomies}
          onApplyTitle={handleApplyAiTitle}
          onApplyText={handleApplyAiText}
          onApplyTaxonomy={handleApplyAiTaxonomy}
          researchContext={researchContext}
          setResearchContext={setResearchContext}
          researchStatus={researchStatus}
          setResearchStatus={setResearchStatus}
        />

        {/* Unsaved Changes Warning Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onSave={handleConfirmSave}
          onDiscard={handleConfirmDiscard}
          onCancel={() => setShowUnsavedModal(false)}
        />
      </form>
    </div>
  );
};

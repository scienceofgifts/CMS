import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Globe,
  Loader2,
  ListChecks,
  Tag,
  FileText,
  HelpCircle,
  Search,
  Wand2,
  RefreshCw
} from 'lucide-react';
import {
  Product,
  TaxonomyOptions,
  ProductAiOperation,
  ProductAiResponse,
  ProductAiSuggestions,
  ProductAiSourcesStatus
} from '../../types/product';

interface ProductAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOperation: ProductAiOperation;
  product: Product;
  taxonomies: TaxonomyOptions;
  onApplyTitle: (title: string) => void;
  onApplyText: (field: keyof Product, value: string) => void;
  onApplyTaxonomy: (selected: {
    recipients?: string[];
    interests?: string[];
    occasions?: string[];
    ageRanges?: string[];
    personalityStyles?: string[];
  }) => void;
  researchContext: any;
  setResearchContext: React.Dispatch<React.SetStateAction<any>>;
  researchStatus: 'not_run' | 'researching' | 'complete' | 'outdated';
  setResearchStatus: React.Dispatch<React.SetStateAction<'not_run' | 'researching' | 'complete' | 'outdated'>>;
}

const OPERATION_LABELS: Record<ProductAiOperation, { label: string; icon: any; description: string }> = {
  analyze_product: {
    label: 'Analyze Product & Suite',
    icon: Search,
    description: 'Comprehensive research across image, source URL, facts, and editorial angles.'
  },
  suggest_title: {
    label: 'Suggest Titles',
    icon: Wand2,
    description: 'Generate concise, non-hype product titles for gift guides.'
  },
  editorial_review: {
    label: 'Primary Editorial Review',
    icon: FileText,
    description: 'Draft original, 2-4 sentence human editorial evaluation.'
  },
  why_it_makes_a_great_gift: {
    label: 'Why Great Gift',
    icon: Sparkles,
    description: 'Highlight gift value, usefulness, tactile charm, and craftsmanship.'
  },
  ideal_for: {
    label: 'Ideal For',
    icon: ListChecks,
    description: 'Concise target recipient and situational use case.'
  },
  what_makes_it_stand_out: {
    label: 'What Makes It Stand Out',
    icon: CheckCircle2,
    description: 'Key physical, design, or material differentiating features.'
  },
  things_to_consider: {
    label: 'Things To Consider',
    icon: HelpCircle,
    description: 'Honest physical caveats or considerations supported by facts.'
  },
  suggest_tagline: {
    label: 'Editorial Tagline',
    icon: FileText,
    description: 'Short, evocative headline summary (6-12 words).'
  },
  suggest_taxonomy: {
    label: 'Suggest Taxonomy',
    icon: Tag,
    description: 'Map product to allowed CMS recipients, interests, and occasions.'
  }
};

export const ProductAiModal: React.FC<ProductAiModalProps> = ({
  isOpen,
  onClose,
  initialOperation,
  product,
  taxonomies,
  onApplyTitle,
  onApplyText,
  onApplyTaxonomy,
  researchContext,
  setResearchContext,
  researchStatus,
  setResearchStatus
}) => {
  const [currentOp, setCurrentOperation] = useState<ProductAiOperation>(initialOperation);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Read suggestions and sources from the shared researchContext session state
  const suggestions = researchContext?.suggestions || null;
  const sources = researchContext?.sources || null;

  // Selected taxonomy checkboxes
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedAgeRanges, setSelectedAgeRanges] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Persistent Applied State Tracking
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  // Feedback notifications
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentOperation(initialOperation);
  }, [isOpen, initialOperation]);

  // Pre-select taxonomy suggestions when research context changes
  useEffect(() => {
    if (suggestions?.taxonomy) {
      const tax = suggestions.taxonomy;
      setSelectedRecipients((tax.recipients || []).map((r: any) => r.value));
      setSelectedInterests((tax.interests || []).map((i: any) => i.value));
      setSelectedOccasions((tax.occasions || []).map((o: any) => o.value));
      setSelectedAgeRanges((tax.ageRanges || []).map((a: any) => a.value));
      setSelectedStyles((tax.personalityStyles || []).map((s: any) => s.value));
    }
  }, [suggestions]);

  const triggerResearch = async () => {
    setLoading(true);
    setResearchStatus('researching');
    setError(null);
    setAppliedKeys(new Set());
    try {
      const res = await fetch('/api/ai/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'analyze_product', // Always run full multi-modal analysis to create the complete context
          product,
          taxonomy: taxonomies
        })
      });

      const data: ProductAiResponse = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to complete product research.');
        setResearchStatus('not_run');
      } else {
        setResearchContext({
          suggestions: data.suggestions,
          sources: data.sources,
          productUrlAtResearch: (product.vendorUrl || '').trim(),
          productImageAtResearch: (product.image || '').trim()
        });
        setResearchStatus('complete');
      }
    } catch (err: any) {
      setError(err.message || 'Network error executing Product AI research.');
      setResearchStatus('not_run');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyField = (field: keyof Product, val: string, label: string, keyId?: string) => {
    if (field === 'title') {
      onApplyTitle(val);
    } else {
      onApplyText(field, val);
    }
    const keyToMark = keyId || `field_${field}`;
    setAppliedKeys(prev => new Set(prev).add(keyToMark));
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleApplyTaxonomySubmit = () => {
    onApplyTaxonomy({
      recipients: selectedRecipients,
      interests: selectedInterests,
      occasions: selectedOccasions,
      ageRanges: selectedAgeRanges,
      personalityStyles: selectedStyles
    });
    setAppliedKeys(prev => new Set(prev).add('taxonomy'));
    setCopiedField('Taxonomy Selections');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const toggleTaxonomySelection = (
    category: 'recipients' | 'interests' | 'occasions' | 'ageRanges' | 'personalityStyles',
    val: string
  ) => {
    const setters = {
      recipients: setSelectedRecipients,
      interests: setSelectedInterests,
      occasions: setSelectedOccasions,
      ageRanges: setSelectedAgeRanges,
      personalityStyles: setSelectedStyles
    };
    const getters = {
      recipients: selectedRecipients,
      interests: selectedInterests,
      occasions: selectedOccasions,
      ageRanges: selectedAgeRanges,
      personalityStyles: selectedStyles
    };

    const current = getters[category];
    const setter = setters[category];
    if (current.includes(val)) {
      setter(current.filter(item => item !== val));
    } else {
      setter([...current, val]);
    }
  };

  const OpIcon = OPERATION_LABELS[currentOp]?.icon || Sparkles;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs font-sans">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 w-full max-w-4xl max-h-[90vh] rounded-sm shadow-xl flex flex-col overflow-hidden text-[#1E232B]">
        {/* MODAL HEADER */}
        <div className="bg-white border-b border-[#99BFF9]/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#EEF5FF] border border-[#99BFF9]/40 flex items-center justify-center text-[#2A548E]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-display text-lg text-[#1E232B] font-normal flex items-center gap-2">
                <span>Product AI Assistant</span>
                <span className="text-xs px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-sans font-semibold rounded-xs border border-[#99BFF9]/30 uppercase tracking-wider">
                  Gemini 3.5 Flash-Lite
                </span>
              </h2>
              <p className="text-xs text-[#5A6270]">
                Curatorial research for <span className="font-semibold text-[#1E232B]">{product.title || product.id || 'Untitled Product'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* OPERATION SELECTOR BAR */}
        <div className="bg-[#EEF5FF]/60 border-b border-[#99BFF9]/20 px-6 py-2 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          {(Object.keys(OPERATION_LABELS) as ProductAiOperation[]).map(opKey => {
            const opInfo = OPERATION_LABELS[opKey];
            const isActive = currentOp === opKey;
            const Icon = opInfo.icon;
            return (
              <button
                key={opKey}
                type="button"
                onClick={() => {
                  setCurrentOperation(opKey);
                }}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 font-medium ${
                  isActive
                    ? 'bg-[#2A548E] text-white shadow-2xs font-semibold'
                    : 'bg-white/80 text-[#5A6270] hover:bg-white hover:text-[#1E232B] border border-[#99BFF9]/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opInfo.label}</span>
              </button>
            );
          })}
        </div>

        {/* RESEARCH STATUS & SOURCE TRANSPARENCY BAR */}
        <div className="bg-white border-b border-[#99BFF9]/20 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-[#5A6270] font-semibold uppercase tracking-wider">Research Status:</span>
            
            {/* Status indicator */}
            {researchStatus === 'not_run' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full border border-stone-400 bg-white inline-block"></span>
                <span>Research not run</span>
              </span>
            )}
            {researchStatus === 'researching' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 rounded-xs font-semibold">
                <Loader2 className="w-3 h-3 text-sky-600 animate-spin" />
                <span>Researching...</span>
              </span>
            )}
            {researchStatus === 'complete' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-[#154D3B] border border-emerald-200 rounded-xs font-semibold">
                <Check className="w-3 h-3 text-emerald-600 font-bold" />
                <span>Research complete</span>
              </span>
            )}
            {researchStatus === 'outdated' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xs font-semibold">
                <span className="text-amber-600 font-bold">⚠</span>
                <span>Research outdated</span>
              </span>
            )}

            {/* Separator if research run */}
            {(researchStatus === 'complete' || researchStatus === 'outdated') && (
              <span className="text-stone-300">|</span>
            )}

            {/* Sources indicator */}
            {(researchStatus === 'complete' || researchStatus === 'outdated') && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#5A6270]">Sources successfully used:</span>
                
                {/* Image */}
                {sources?.imageAnalyzed ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-[#154D3B] border border-emerald-100 rounded-xs">
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Product image</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded-xs line-through" title="No image or could not analyze">
                    <span>Product image</span>
                  </span>
                )}

                {/* URL */}
                {sources?.urlFetched ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-[#154D3B] border border-emerald-100 rounded-xs">
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Product URL</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded-xs line-through" title="No URL or fetch failed">
                    <span>Product URL</span>
                  </span>
                )}

                {/* CMS Data */}
                {product ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-[#154D3B] border border-emerald-100 rounded-xs">
                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Existing CMS data</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded-xs line-through">
                    <span>Existing CMS data</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={triggerResearch}
            disabled={loading}
            className="text-[11px] text-[#2A548E] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 font-semibold"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>{researchStatus === 'not_run' ? 'Research Product' : 'Refresh Research'}</span>
          </button>
        </div>

        {/* FEEDBACK TOAST BANNER */}
        {copiedField && (
          <div className="bg-[#226E56] text-white px-6 py-2 text-xs font-semibold flex items-center justify-between transition-all">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Applied "{copiedField}" into Product Form state! (Remember to click "Save Product" to persist)</span>
            </span>
          </div>
        )}

        {/* MODAL MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {researchStatus === 'not_run' && !loading && (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-[#EEF5FF] border border-[#99BFF9]/40 flex items-center justify-center text-[#2A548E] mx-auto shadow-sm">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif-display text-lg text-[#1E232B] font-normal">
                  Research Not Run
                </h3>
                <p className="text-xs text-[#5A6270] leading-relaxed">
                  Before suggestions can be provided, we need to perform initial product research. Gemini will analyze the product image, URL evidence, and CMS metadata to create a unified Research Context.
                </p>
              </div>
              <button
                type="button"
                onClick={triggerResearch}
                className="px-6 py-2.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Research Product</span>
              </button>
            </div>
          )}

          {researchStatus === 'researching' && (
            <div className="py-16 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-serif-display text-lg text-[#1E232B]">
                  Researching Product...
                </p>
                <p className="text-xs text-[#5A6270]">
                  Analyzing visual details, parsing URL page evidence, and checking CMS metadata with Gemini 3.8 Flash
                </p>
              </div>
            </div>
          )}

          {error && researchStatus !== 'researching' && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xs text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-900">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>AI Research Error</span>
              </div>
              <p>{error}</p>
              <button
                type="button"
                onClick={triggerResearch}
                className="px-3 py-1 bg-rose-700 text-white rounded text-xs font-semibold hover:bg-rose-800 cursor-pointer"
              >
                Retry Research
              </button>
            </div>
          )}

          {(researchStatus === 'complete' || researchStatus === 'outdated') && !loading && !error && !suggestions && (
            <div className="py-16 text-center text-xs text-[#5A6270] italic">
              No suggestions in the current research context. Try clicking "Refresh Research" above.
            </div>
          )}

          {(researchStatus === 'complete' || researchStatus === 'outdated') && !loading && !error && suggestions && (
            <div className="space-y-6">
              {/* SUGGEST TITLES OPERATION */}
              {currentOp === 'suggest_title' && suggestions.titles && (
                <div className="space-y-4">
                  <div className="border-b border-[#99BFF9]/20 pb-2 flex items-center justify-between">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-normal">
                      Suggested Product Titles
                    </h3>
                    <span className="text-xs text-[#5A6270]">Non-hype, precise naming options</span>
                  </div>

                  <div className="space-y-3">
                    {suggestions.titles.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-[#2A548E] transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-sm text-[#1E232B] flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#EEF5FF] text-[#2A548E] text-xs flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span>{t.value}</span>
                          </div>
                          <p className="text-xs text-[#5A6270] pl-7">{t.reason}</p>
                        </div>

                        {appliedKeys.has(`title_${t.value}`) ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default shrink-0 flex items-center gap-1.5 opacity-90"
                          >
                            <Check className="w-3.5 h-3.5 text-[#226E56]" />
                            <span>Applied</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyField('title', t.value, `Title (${t.value})`, `title_${t.value}`)}
                            className="px-3 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer shrink-0 flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Use Title</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SINGLE TEXT SUGGESTIONS (Review, Why Great Gift, Ideal For, Stand Out, Things To Consider, Tagline) */}
              {(currentOp === 'editorial_review' ||
                currentOp === 'why_it_makes_a_great_gift' ||
                currentOp === 'ideal_for' ||
                currentOp === 'what_makes_it_stand_out' ||
                currentOp === 'things_to_consider' ||
                currentOp === 'suggest_tagline') && (
                <div className="space-y-4">
                  <div className="border-b border-[#99BFF9]/20 pb-2 flex items-center justify-between">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-normal">
                      {OPERATION_LABELS[currentOp].label} Suggestion
                    </h3>
                    <span className="text-xs text-[#5A6270]">Editorial recommendation</span>
                  </div>

                  {renderSingleTextSuggestionCard(currentOp, suggestions, handleApplyField, appliedKeys)}
                </div>
              )}

              {/* TAXONOMY SUGGESTIONS */}
              {currentOp === 'suggest_taxonomy' && suggestions.taxonomy && (
                <div className="space-y-6">
                  <div className="border-b border-[#99BFF9]/20 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif-display text-base text-[#1E232B] font-normal">
                        Constrained Taxonomy Suggestions
                      </h3>
                      <p className="text-xs text-[#5A6270]">
                        Select or deselect suggested terms. Only values matching the CMS taxonomy are shown.
                      </p>
                    </div>

                    {appliedKeys.has('taxonomy') ? (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1.5 shadow-2xs opacity-90"
                      >
                        <Check className="w-4 h-4 text-[#226E56]" />
                        <span>Applied</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyTaxonomySubmit}
                        className="px-4 py-2 bg-[#226E56] hover:bg-[#185243] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Apply Selected Taxonomy</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recipients */}
                    <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                        <span>Recipients</span>
                        <span className="text-[11px] text-[#5A6270]">
                          {(suggestions.taxonomy.recipients || []).length} suggested
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {(suggestions.taxonomy.recipients || []).length === 0 ? (
                          <span className="text-stone-400 italic">No recipients suggested.</span>
                        ) : (
                          suggestions.taxonomy.recipients.map((item: any) => (
                            <label key={item.value} className="flex items-start gap-2.5 p-1.5 hover:bg-[#FAF9F6] rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRecipients.includes(item.value)}
                                onChange={() => toggleTaxonomySelection('recipients', item.value)}
                                className="mt-0.5 rounded border-stone-300 text-[#2A548E] focus:ring-[#2A548E]"
                              />
                              <div>
                                <div className="font-semibold text-[#1E232B]">{item.value}</div>
                                <div className="text-[11px] text-[#5A6270]">{item.reason}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Interests */}
                    <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                        <span>Interests &amp; Topics</span>
                        <span className="text-[11px] text-[#5A6270]">
                          {(suggestions.taxonomy.interests || []).length} suggested
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {(suggestions.taxonomy.interests || []).length === 0 ? (
                          <span className="text-stone-400 italic">No interests suggested.</span>
                        ) : (
                          suggestions.taxonomy.interests.map((item: any) => (
                            <label key={item.value} className="flex items-start gap-2.5 p-1.5 hover:bg-[#FAF9F6] rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedInterests.includes(item.value)}
                                onChange={() => toggleTaxonomySelection('interests', item.value)}
                                className="mt-0.5 rounded border-stone-300 text-[#2A548E] focus:ring-[#2A548E]"
                              />
                              <div>
                                <div className="font-semibold text-[#1E232B]">{item.value}</div>
                                <div className="text-[11px] text-[#5A6270]">{item.reason}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Occasions */}
                    <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                        <span>Occasions &amp; Moments</span>
                        <span className="text-[11px] text-[#5A6270]">
                          {(suggestions.taxonomy.occasions || []).length} suggested
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {(suggestions.taxonomy.occasions || []).length === 0 ? (
                          <span className="text-stone-400 italic">No occasions suggested.</span>
                        ) : (
                          suggestions.taxonomy.occasions.map((item: any) => (
                            <label key={item.value} className="flex items-start gap-2.5 p-1.5 hover:bg-[#FAF9F6] rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedOccasions.includes(item.value)}
                                onChange={() => toggleTaxonomySelection('occasions', item.value)}
                                className="mt-0.5 rounded border-stone-300 text-[#2A548E] focus:ring-[#2A548E]"
                              />
                              <div>
                                <div className="font-semibold text-[#1E232B]">{item.value}</div>
                                <div className="text-[11px] text-[#5A6270]">{item.reason}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Personality Styles */}
                    <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] flex items-center justify-between">
                        <span>Personality Archetypes</span>
                        <span className="text-[11px] text-[#5A6270]">
                          {(suggestions.taxonomy.personalityStyles || []).length} suggested
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {(suggestions.taxonomy.personalityStyles || []).length === 0 ? (
                          <span className="text-stone-400 italic">No personality archetypes suggested.</span>
                        ) : (
                          suggestions.taxonomy.personalityStyles.map((item: any) => (
                            <label key={item.value} className="flex items-start gap-2.5 p-1.5 hover:bg-[#FAF9F6] rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedStyles.includes(item.value)}
                                onChange={() => toggleTaxonomySelection('personalityStyles', item.value)}
                                className="mt-0.5 rounded border-stone-300 text-[#2A548E] focus:ring-[#2A548E]"
                              />
                              <div>
                                <div className="font-semibold text-[#1E232B]">{item.value}</div>
                                <div className="text-[11px] text-[#5A6270]">{item.reason}</div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FULL PRODUCT ANALYSIS SUITE */}
              {currentOp === 'analyze_product' && (
                <div className="space-y-6">
                  {/* Research Facts & Observations */}
                  {suggestions.analysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Product Identification Card */}
                      {suggestions.analysis.productIdentification && (
                        <div className="col-span-1 md:col-span-2 p-4 bg-[#EEF5FF] border border-[#99BFF9]/30 rounded-xs space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-[#2A548E] flex items-center gap-1.5">
                            <Sparkles className="w-4.5 h-4.5" />
                            <span>Identified Product Reference</span>
                          </div>
                          <p className="text-sm font-semibold text-[#1E232B] bg-white p-3 border border-[#99BFF9]/20 rounded-xs leading-relaxed">
                            {suggestions.analysis.productIdentification}
                          </p>
                        </div>
                      )}

                      {/* Verified Facts */}
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#2A548E] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verified Facts</span>
                        </div>
                        <ul className="text-xs text-[#1E232B] space-y-1 list-disc pl-4 leading-relaxed">
                          {(suggestions.analysis.verifiedFacts || []).map((fact: string, i: number) => (
                            <li key={i}>{fact}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Visual Observations */}
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#226E56] flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4" />
                          <span>Visual Observations</span>
                        </div>
                        <ul className="text-xs text-[#1E232B] space-y-1 list-disc pl-4 leading-relaxed">
                          {(suggestions.analysis.visualObservations || []).map((obs: string, i: number) => (
                            <li key={i}>{obs}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Editorial Opportunities */}
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#8C6D1F] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          <span>Editorial Opportunities</span>
                        </div>
                        <ul className="text-xs text-[#1E232B] space-y-1 list-disc pl-4 leading-relaxed">
                          {(suggestions.analysis.editorialOpportunities || []).map((opp: string, i: number) => (
                            <li key={i}>{opp}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Discrepancies & Uncertainties */}
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4" />
                          <span>Uncertainties / Discrepancies</span>
                        </div>
                        <ul className="text-xs text-[#1E232B] space-y-1 list-disc pl-4 leading-relaxed">
                          {(suggestions.analysis.uncertainties || []).length === 0 ? (
                            <li className="text-stone-400 italic">No discrepancies identified between URL and image sources.</li>
                          ) : (
                            (suggestions.analysis.uncertainties || []).map((unc: string, i: number) => (
                              <li key={i}>{unc}</li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* FIELD PROPOSALS CARDS */}
                  <div className="space-y-4 pt-4 border-t border-[#99BFF9]/20">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-normal">
                      Generated Field Proposals
                    </h3>

                    {/* Editorial Review Proposal */}
                    {suggestions.editorialReview && (
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">Primary Editorial Review</span>
                          {appliedKeys.has('field_editorialReview') ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                            >
                              <Check className="w-3.5 h-3.5 text-[#226E56]" /> Applied
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyField('editorialReview', suggestions.editorialReview!, 'Editorial Review')}
                              className="px-3 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Use Review
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#1E232B] leading-relaxed bg-[#FAF9F6] p-3 border border-[#99BFF9]/20 rounded-xs">
                          {suggestions.editorialReview}
                        </p>
                      </div>
                    )}

                    {/* Why Great Gift Proposal */}
                    {suggestions.whyItMakesAGreatGift && (
                      <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#154D3B]">Why It Makes a Great Gift</span>
                          {appliedKeys.has('field_whyItMakesAGreatGift') ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                            >
                              <Check className="w-3.5 h-3.5 text-[#226E56]" /> Applied
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyField('whyItMakesAGreatGift', suggestions.whyItMakesAGreatGift!, 'Why Great Gift')}
                              className="px-3 py-1 bg-[#226E56] hover:bg-[#185243] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Use This Quote
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#154D3B] leading-relaxed bg-emerald-50/50 p-3 border border-emerald-200/50 rounded-xs italic">
                          "{suggestions.whyItMakesAGreatGift}"
                        </p>
                      </div>
                    )}

                    {/* Ideal For & Stand Out */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suggestions.idealFor && (
                        <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">Ideal For</span>
                            {appliedKeys.has('field_idealFor') ? (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                              >
                                <Check className="w-3 h-3 text-[#226E56]" /> Applied
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyField('idealFor', suggestions.idealFor!, 'Ideal For')}
                                className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Use
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#1E232B] leading-relaxed bg-[#FAF9F6] p-2.5 border border-stone-200 rounded-xs">
                            {suggestions.idealFor}
                          </p>
                        </div>
                      )}

                      {suggestions.whatMakesItStandOut && (
                        <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">What Makes It Stand Out</span>
                            {appliedKeys.has('field_whatMakesItStandOut') ? (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                              >
                                <Check className="w-3 h-3 text-[#226E56]" /> Applied
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyField('whatMakesItStandOut', suggestions.whatMakesItStandOut!, 'What Stand Out')}
                                className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Use
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#1E232B] leading-relaxed bg-[#FAF9F6] p-2.5 border border-stone-200 rounded-xs">
                            {suggestions.whatMakesItStandOut}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Things To Consider & Tagline */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suggestions.thingsToConsider && (
                        <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">Things To Consider</span>
                            {appliedKeys.has('field_thingsToConsider') ? (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                              >
                                <Check className="w-3 h-3 text-[#226E56]" /> Applied
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyField('thingsToConsider', suggestions.thingsToConsider!, 'Things To Consider')}
                                className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Use
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#1E232B] leading-relaxed bg-[#FAF9F6] p-2.5 border border-stone-200 rounded-xs">
                            {suggestions.thingsToConsider}
                          </p>
                        </div>
                      )}

                      {suggestions.tagline && (
                        <div className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#1E232B]">Editorial Tagline</span>
                            {appliedKeys.has('field_tagline') ? (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1 opacity-90"
                              >
                                <Check className="w-3 h-3 text-[#226E56]" /> Applied
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleApplyField('tagline', suggestions.tagline!, 'Tagline')}
                                className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Use
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-[#1E232B] leading-relaxed bg-[#FAF9F6] p-2.5 border border-stone-200 rounded-xs font-medium">
                            {suggestions.tagline}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-[#99BFF9]/30 px-6 py-3 flex items-center justify-between text-xs text-[#5A6270]">
          <span>
            Suggestions require explicit user approval. Click "Use" or "Apply" to copy into editor state.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-[#1E232B] font-semibold rounded transition-colors cursor-pointer"
          >
            Close Assistant
          </button>
        </div>
      </div>
    </div>
  );
};

function renderSingleTextSuggestionCard(
  op: ProductAiOperation,
  suggestions: ProductAiSuggestions,
  onApply: (field: keyof Product, val: string, label: string, keyId?: string) => void,
  appliedKeys: Set<string>
) {
  const map: Record<string, { key: keyof Product; text?: string }> = {
    editorial_review: { key: 'editorialReview', text: suggestions.editorialReview },
    why_it_makes_a_great_gift: { key: 'whyItMakesAGreatGift', text: suggestions.whyItMakesAGreatGift },
    ideal_for: { key: 'idealFor', text: suggestions.idealFor },
    what_makes_it_stand_out: { key: 'whatMakesItStandOut', text: suggestions.whatMakesItStandOut },
    things_to_consider: { key: 'thingsToConsider', text: suggestions.thingsToConsider },
    suggest_tagline: { key: 'tagline', text: suggestions.tagline }
  };

  const item = map[op];
  if (!item || !item.text) {
    return (
      <div className="p-4 bg-stone-100 text-stone-500 text-xs italic">
        No suggestion generated for this operation.
      </div>
    );
  }

  const isApplied = appliedKeys.has(`field_${item.key}`);

  return (
    <div className="p-5 bg-white border border-[#99BFF9]/30 rounded-xs space-y-4 shadow-2xs">
      <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded text-xs text-[#1E232B] leading-relaxed font-normal">
        {item.text}
      </div>

      <div className="flex items-center justify-end gap-2">
        {isApplied ? (
          <button
            type="button"
            disabled
            className="px-4 py-2 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded cursor-default flex items-center gap-1.5 shadow-2xs opacity-90"
          >
            <Check className="w-4 h-4 text-[#226E56]" />
            <span>Applied</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onApply(item.key, item.text!, OPERATION_LABELS[op].label, `field_${item.key}`)}
            className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Use Suggestion in Form</span>
          </button>
        )}
      </div>
    </div>
  );
}

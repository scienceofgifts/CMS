import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Save,
  History,
  Eye,
  Columns,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  HelpCircle,
  Type,
  FileText
} from 'lucide-react';
import { GiftFinderData, GiftFinderStep, GiftFinderOption } from '../../types/giftFinder';
import { GiftFinderBackupsModal } from './GiftFinderBackupsModal';
import { GiftFinderPreview } from './GiftFinderPreview';

export function GiftFinderEditor() {
  const [data, setData] = useState<GiftFinderData | null>(null);
  const [initialDataJson, setInitialDataJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split'>('split');
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState<boolean>(false);

  const isDirty = data ? JSON.stringify(data) !== initialDataJson : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gift-finder');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.giftFinder);
        setInitialDataJson(JSON.stringify(json.giftFinder));
      } else {
        setError(json.error || 'Failed to load Gift Finder data.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading Gift Finder.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Prompt before window reload if dirty
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

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch('/api/gift-finder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.giftFinder);
        setInitialDataJson(JSON.stringify(json.giftFinder));
        setSaveSuccess(`Gift Finder configuration saved successfully! (Backup: ${json.backupFile})`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setError(json.error || 'Failed to save Gift Finder configuration.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStepTitle = (stepIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], title: val };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateStepPrompt = (stepIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], prompt: val };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateStepSubBadge = (stepIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], subBadge: val };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateOptionLabel = (stepIdx: number, optIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    const newOptions = [...newSteps[stepIdx].options];
    newOptions[optIdx] = { ...newOptions[optIdx], label: val };
    newSteps[stepIdx] = { ...newSteps[stepIdx], options: newOptions };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateOptionDesc = (stepIdx: number, optIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    const newOptions = [...newSteps[stepIdx].options];
    newOptions[optIdx] = { ...newOptions[optIdx], description: val };
    newSteps[stepIdx] = { ...newSteps[stepIdx], options: newOptions };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateOptionValue = (stepIdx: number, optIdx: number, val: string) => {
    if (!data) return;
    const newSteps = [...data.steps];
    const newOptions = [...newSteps[stepIdx].options];
    newOptions[optIdx] = { ...newOptions[optIdx], value: val };
    newSteps[stepIdx] = { ...newSteps[stepIdx], options: newOptions };
    setData({ ...data, steps: newSteps });
  };

  const handleAddOption = (stepIdx: number) => {
    if (!data) return;
    const newSteps = [...data.steps];
    const currentOpts = newSteps[stepIdx].options || [];
    const newOptVal = `new-option-${Date.now()}`;
    const newOpt: GiftFinderOption = {
      value: newOptVal,
      label: 'New Option',
      ...(newSteps[stepIdx].field === 'budget' || newSteps[stepIdx].field === 'personalityStyle'
        ? { description: 'Description for option' }
        : {})
    };
    newSteps[stepIdx] = { ...newSteps[stepIdx], options: [...currentOpts, newOpt] };
    setData({ ...data, steps: newSteps });
  };

  const handleRemoveOption = (stepIdx: number, optIdx: number) => {
    if (!data) return;
    const newSteps = [...data.steps];
    const newOpts = newSteps[stepIdx].options.filter((_, idx) => idx !== optIdx);
    newSteps[stepIdx] = { ...newSteps[stepIdx], options: newOpts };
    setData({ ...data, steps: newSteps });
  };

  const handleMoveOption = (stepIdx: number, optIdx: number, direction: 'up' | 'down') => {
    if (!data) return;
    const newSteps = [...data.steps];
    const opts = [...newSteps[stepIdx].options];
    const targetIdx = direction === 'up' ? optIdx - 1 : optIdx + 1;
    if (targetIdx < 0 || targetIdx >= opts.length) return;

    const temp = opts[optIdx];
    opts[optIdx] = opts[targetIdx];
    opts[targetIdx] = temp;

    newSteps[stepIdx] = { ...newSteps[stepIdx], options: opts };
    setData({ ...data, steps: newSteps });
  };

  const handleUpdateBudgetRule = (ruleIdx: number, field: string, val: any) => {
    if (!data) return;
    const rules = [...(data.budgetRules || [])];
    rules[ruleIdx] = {
      ...rules[ruleIdx],
      [field]: val === '' ? null : (field === 'minPrice' || field === 'maxPrice' ? parseFloat(val) : val)
    };
    setData({ ...data, budgetRules: rules });
  };

  const handleUpdateScoring = (field: string, val: string) => {
    if (!data) return;
    const num = parseInt(val, 10) || 0;
    setData({
      ...data,
      scoring: {
        ...data.scoring,
        [field]: num
      }
    });
  };

  const handleUpdateFaq = (faqIdx: number, field: 'question' | 'answer', val: string) => {
    if (!data) return;
    const faqs = [...(data.faqs || [])];
    faqs[faqIdx] = { ...faqs[faqIdx], [field]: val };
    setData({ ...data, faqs });
  };

  const handleAddFaq = () => {
    if (!data) return;
    const faqs = [...(data.faqs || []), { question: 'New FAQ Question', answer: 'New FAQ Answer text.' }];
    setData({ ...data, faqs });
  };

  const handleRemoveFaq = (faqIdx: number) => {
    if (!data) return;
    const faqs = (data.faqs || []).filter((_, idx) => idx !== faqIdx);
    setData({ ...data, faqs });
  };

  const handleMoveFaq = (faqIdx: number, direction: 'up' | 'down') => {
    if (!data) return;
    const faqs = [...(data.faqs || [])];
    const targetIdx = direction === 'up' ? faqIdx - 1 : faqIdx + 1;
    if (targetIdx < 0 || targetIdx >= faqs.length) return;
    const temp = faqs[faqIdx];
    faqs[faqIdx] = faqs[targetIdx];
    faqs[targetIdx] = temp;
    setData({ ...data, faqs });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
        <span>Reading Gift Finder structure from /gift-finder/index.html...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-xl space-y-4 text-rose-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-serif-display text-lg font-medium">Failed to Load Gift Finder Editor</h3>
        </div>
        <p className="text-xs leading-relaxed">{error || 'Data is unavailable.'}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const currentStep = data.steps[activeStepIndex] || data.steps[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action & View Bar */}
      <div className="bg-white border border-[#99BFF9]/35 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#E8F8F1] text-[#226E56]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Gift Finder Questionnaire
              </h2>
              {isDirty && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded font-mono-code">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6270]">
              Manage public questionnaire step titles, prompts, option labels, and button copy
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
        <div className="p-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
            <span>{saveSuccess}</span>
          </div>
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
        {/* LEFT COLUMN: EDITORIAL FORM CONTROLS */}
        {(activeTab === 'editor' || activeTab === 'split') && (
          <div className="space-y-6">
            {/* Section 1: Page Header Meta */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
              <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                <Type className="w-4 h-4 text-[#2A548E]" />
                <span>Page Header &amp; Editorial Badge</span>
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Badge Pill Copy
                  </label>
                  <input
                    type="text"
                    value={data.badge}
                    onChange={(e) => setData({ ...data, badge: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    placeholder="Editorial Gift Matching Engine"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Main Headline
                  </label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => setData({ ...data, title: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none font-serif-display text-base"
                    placeholder="Find the Exact Right Gift"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Header Subtitle / Lead Paragraph
                  </label>
                  <textarea
                    rows={3}
                    value={data.lead}
                    onChange={(e) => setData({ ...data, lead: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                    placeholder="Answer six brief questions about the person you are buying for..."
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Step-by-Step Question Editor */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
                <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2A548E]" />
                  <span>Question Steps ({data.steps.length})</span>
                </h3>
                <span className="text-xs text-[#226E56] font-semibold font-mono-code">
                  Engine Schema Preserved
                </span>
              </div>

              {/* Step Navigation Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2 border-b border-stone-100">
                {data.steps.map((s, idx) => (
                  <button
                    key={s.step}
                    onClick={() => setActiveStepIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                      activeStepIndex === idx
                        ? 'bg-[#2A548E] text-white shadow-xs'
                        : 'bg-[#FAF9F6] text-[#5A6270] hover:text-[#1E232B] border border-stone-200'
                    }`}
                  >
                    Step {s.step}: {s.field}
                  </button>
                ))}
              </div>

              {/* Active Step Form */}
              {currentStep && (
                <div className="space-y-5 bg-[#FAF9F6] p-5 border border-[#99BFF9]/25 rounded-lg">
                  <div className="flex items-center justify-between text-xs border-b border-stone-200 pb-2">
                    <span className="font-mono-code font-bold uppercase text-[#2A548E]">
                      Editing Step {currentStep.step} · Field ID: {currentStep.field}
                    </span>
                    <span className="text-[#5A6270]">
                      {currentStep.options.length} Options
                    </span>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Question Step Title
                      </label>
                      <input
                        type="text"
                        value={currentStep.title}
                        onChange={(e) => handleUpdateStepTitle(activeStepIndex, e.target.value)}
                        className="w-full p-2.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    {currentStep.field === 'interests' && (
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">
                          Sub-badge Copy
                        </label>
                        <input
                          type="text"
                          value={currentStep.subBadge || ''}
                          onChange={(e) => handleUpdateStepSubBadge(activeStepIndex, e.target.value)}
                          className="w-full p-2.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                          placeholder="(Select one or multiple)"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Question Prompt / Subtitle
                      </label>
                      <input
                        type="text"
                        value={currentStep.prompt}
                        onChange={(e) => handleUpdateStepPrompt(activeStepIndex, e.target.value)}
                        className="w-full p-2.5 bg-white border border-stone-200 rounded font-normal text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    {/* Step Options List */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[#1E232B] font-semibold">
                          Step Choice Options ({currentStep.options.length})
                        </label>
                        <button
                          onClick={() => handleAddOption(activeStepIndex)}
                          className="px-2.5 py-1 bg-[#E8F8F1] hover:bg-[#C3F3DF] text-[#154D3B] text-[11px] font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Option</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {currentStep.options.map((opt, optIdx) => (
                          <div
                            key={`${opt.value}-${optIdx}`}
                            className="p-3.5 bg-white border border-stone-200 rounded-lg space-y-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-[#EEF5FF] text-[#2A548E] text-[10px] font-bold flex items-center justify-center font-mono-code shrink-0">
                                  {optIdx + 1}
                                </span>
                                <div className="space-y-0.5 min-w-0">
                                  <span className="text-[10px] font-mono-code text-[#5A6270] block truncate">
                                    Engine ID: <strong className="text-[#2A548E]">{opt.value}</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleMoveOption(activeStepIndex, optIdx, 'up')}
                                  disabled={optIdx === 0}
                                  className="p-1 text-[#5A6270] hover:text-[#1E232B] disabled:opacity-30 cursor-pointer"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveOption(activeStepIndex, optIdx, 'down')}
                                  disabled={optIdx === currentStep.options.length - 1}
                                  className="p-1 text-[#5A6270] hover:text-[#1E232B] disabled:opacity-30 cursor-pointer"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveOption(activeStepIndex, optIdx)}
                                  className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer ml-1"
                                  title="Remove Option"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div>
                                <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">
                                  Option Label
                                </label>
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => handleUpdateOptionLabel(activeStepIndex, optIdx, e.target.value)}
                                  className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-xs font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                                />
                              </div>

                              {(currentStep.field === 'budget' || currentStep.field === 'personalityStyle' || opt.description !== undefined) && (
                                <div>
                                  <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">
                                    Option Description / Subtext
                                  </label>
                                  <input
                                    type="text"
                                    value={opt.description || ''}
                                    onChange={(e) => handleUpdateOptionDesc(activeStepIndex, optIdx, e.target.value)}
                                    className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-xs text-[#5A6270] focus:border-[#2A548E] focus:outline-none"
                                    placeholder="Subtext explanation for option"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Budget Rules Engine Configuration */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
              <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2A548E]" />
                <span>Budget Tiers &amp; Price Rules Configuration</span>
              </h3>
              <p className="text-xs text-[#5A6270]">Configure minimum and maximum price constraints for matching engine budget filtering.</p>

              <div className="space-y-3">
                {(data.budgetRules || []).map((rule, ruleIdx) => (
                  <div key={rule.value} className="p-3.5 bg-[#FAF9F6] border border-stone-200 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-center">
                    <div>
                      <span className="text-[10px] font-mono-code text-[#5A6270] block">Value ID</span>
                      <strong className="text-[#2A548E] font-mono-code">{rule.value}</strong>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">Display Label</label>
                      <input
                        type="text"
                        value={rule.label}
                        onChange={(e) => handleUpdateBudgetRule(ruleIdx, 'label', e.target.value)}
                        className="w-full p-2 bg-white border border-stone-200 rounded text-xs font-medium text-[#1E232B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">Min Price ($)</label>
                      <input
                        type="number"
                        value={rule.minPrice ?? ''}
                        onChange={(e) => handleUpdateBudgetRule(ruleIdx, 'minPrice', e.target.value)}
                        placeholder="No minimum"
                        className="w-full p-2 bg-white border border-stone-200 rounded text-xs font-mono-code text-[#1E232B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">Max Price ($)</label>
                      <input
                        type="number"
                        value={rule.maxPrice ?? ''}
                        onChange={(e) => handleUpdateBudgetRule(ruleIdx, 'maxPrice', e.target.value)}
                        placeholder="No maximum"
                        className="w-full p-2 bg-white border border-stone-200 rounded text-xs font-mono-code text-[#1E232B]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Matching & Scoring Configuration */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
              <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#226E56]" />
                <span>Matching &amp; Scoring Configuration</span>
              </h3>
              <p className="text-xs text-[#5A6270]">Configure weighting points for recommendation ranking algorithm.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Recipient Match Points</label>
                  <input
                    type="number"
                    value={data.scoring?.recipientMatch ?? 15}
                    onChange={(e) => handleUpdateScoring('recipientMatch', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Interest Match Points (per item)</label>
                  <input
                    type="number"
                    value={data.scoring?.interestMatchPerItem ?? 10}
                    onChange={(e) => handleUpdateScoring('interestMatchPerItem', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Personality Style Match Points</label>
                  <input
                    type="number"
                    value={data.scoring?.personalityMatch ?? 8}
                    onChange={(e) => handleUpdateScoring('personalityMatch', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Occasion Match Points</label>
                  <input
                    type="number"
                    value={data.scoring?.occasionMatch ?? 5}
                    onChange={(e) => handleUpdateScoring('occasionMatch', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Age Range Match Points</label>
                  <input
                    type="number"
                    value={data.scoring?.ageMatch ?? 12}
                    onChange={(e) => handleUpdateScoring('ageMatch', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">Editor's Pick Bonus Points</label>
                  <input
                    type="number"
                    value={data.scoring?.editorsPickBonus ?? 10}
                    onChange={(e) => handleUpdateScoring('editorsPickBonus', e.target.value)}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Frequently Asked Questions (FAQ) Editor */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
                <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#2A548E]" />
                  <span>Frequently Asked Questions ({data.faqs?.length || 0})</span>
                </h3>
                <button
                  onClick={handleAddFaq}
                  className="px-3 py-1.5 bg-[#E8F8F1] hover:bg-[#C3F3DF] text-[#154D3B] text-xs font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add FAQ Item</span>
                </button>
              </div>
              <p className="text-xs text-[#5A6270]">Manage accordion questions and answers displayed at the bottom of the Gift Finder page.</p>

              <div className="space-y-4">
                {(data.faqs || []).map((faq, faqIdx) => (
                  <div key={faqIdx} className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#EEF5FF] text-[#2A548E] text-[10px] font-bold flex items-center justify-center font-mono-code shrink-0">
                          {faqIdx + 1}
                        </span>
                        <span className="text-xs font-semibold text-[#1E232B]">FAQ Item #{faqIdx + 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveFaq(faqIdx, 'up')}
                          disabled={faqIdx === 0}
                          className="p-1 text-[#5A6270] hover:text-[#1E232B] disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveFaq(faqIdx, 'down')}
                          disabled={faqIdx === (data.faqs?.length || 0) - 1}
                          className="p-1 text-[#5A6270] hover:text-[#1E232B] disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveFaq(faqIdx)}
                          className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer ml-1"
                          title="Delete FAQ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">Question</label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => handleUpdateFaq(faqIdx, 'question', e.target.value)}
                          className="w-full p-2.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold mb-0.5">Answer</label>
                        <textarea
                          rows={3}
                          value={faq.answer}
                          onChange={(e) => handleUpdateFaq(faqIdx, 'answer', e.target.value)}
                          className="w-full p-2.5 bg-white border border-stone-200 rounded text-xs text-[#5A6270] leading-relaxed focus:border-[#2A548E] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 6: Navigation Button Labels */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
              <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#226E56]" />
                <span>Questionnaire Control Button Labels</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Previous Step Button
                  </label>
                  <input
                    type="text"
                    value={data.prevButtonText}
                    onChange={(e) => setData({ ...data, prevButtonText: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Next Step Button
                  </label>
                  <input
                    type="text"
                    value={data.nextButtonText}
                    onChange={(e) => setData({ ...data, nextButtonText: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    View Recommendations Button
                  </label>
                  <input
                    type="text"
                    value={data.submitButtonText}
                    onChange={(e) => setData({ ...data, submitButtonText: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: LIVE INTERACTIVE PREVIEW */}
        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#5A6270] px-1 font-mono-code">
              <span className="flex items-center gap-1.5 font-bold text-[#2A548E]">
                <Eye className="w-4 h-4" /> Live Interactive Preview
              </span>
              <span>Reflects editorial changes instantly</span>
            </div>

            <div className="sticky top-28">
              <GiftFinderPreview data={data} />
            </div>
          </div>
        )}
      </div>

      {/* Revision History Modal */}
      <GiftFinderBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestoreComplete={fetchData}
      />
    </div>
  );
}

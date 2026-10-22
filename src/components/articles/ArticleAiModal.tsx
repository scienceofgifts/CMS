import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  FileText,
  Search,
  Wand2,
  RefreshCw,
  Link2,
  BookOpen,
  ArrowRight,
  Copy,
  Plus
} from 'lucide-react';
import { ArticleFrontMatter } from '../../types/articles';
import {
  ArticleAiOperation,
  ArticleAiResponse,
  ArticleAiSuggestions,
  ArticleAiSourcesStatus
} from '../../types/articleAi';

interface ArticleAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    frontMatter: ArticleFrontMatter;
    body: string;
  };
  onApplyTitle: (title: string) => void;
  onApplyDeck: (deck: string) => void;
  onApplyIntro: (introText: string) => void;
  onAppendToBody?: (text: string) => void;
}

const OPERATION_LABELS: Record<ArticleAiOperation, { label: string; icon: any; description: string }> = {
  analyze_article: {
    label: 'Analyze Essay',
    icon: Search,
    description: 'Comprehensive editorial review, topic analysis, thesis clarity, and SEO critique.'
  },
  suggest_title: {
    label: 'Suggest Titles',
    icon: Wand2,
    description: 'Generate distinct, compelling editorial titles based on the article content.'
  },
  suggest_deck: {
    label: 'Suggest Decks / Meta',
    icon: FileText,
    description: 'Draft concise subtitle decks and meta descriptions summarizing the core insight.'
  },
  improve_intro: {
    label: 'Improve Introduction',
    icon: Sparkles,
    description: 'Suggest an engaging, thoughtful opening that clearly frames the thesis.'
  },
  improve_article: {
    label: 'Editorial Improvements',
    icon: CheckCircle2,
    description: 'Actionable section-by-section advice on structure, pacing, and argumentation.'
  },
  seo_analysis: {
    label: 'SEO Analysis',
    icon: BookOpen,
    description: 'Critique search intent, heading hierarchy, topical depth, and keyword coverage.'
  },
  internal_linking: {
    label: 'Internal Links',
    icon: Link2,
    description: 'Recommend contextual links to existing articles, gift guides, and products.'
  }
};

export const ArticleAiModal: React.FC<ArticleAiModalProps> = ({
  isOpen,
  onClose,
  article,
  onApplyTitle,
  onApplyDeck,
  onApplyIntro,
  onAppendToBody
}) => {
  const [currentOp, setCurrentOperation] = useState<ArticleAiOperation>('analyze_article');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Cached suggestions session state
  const [analysisContext, setAnalysisContext] = useState<ArticleAiSuggestions | null>(null);
  const [sourcesStatus, setSourcesStatus] = useState<ArticleAiSourcesStatus | null>(null);
  const [status, setStatus] = useState<'not_run' | 'analyzing' | 'complete'>('not_run');

  // Persistent Applied State Tracking
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  // Feedback notifications
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const triggerOperation = async (op: ArticleAiOperation = currentOp, force: boolean = false) => {
    setLoading(true);
    setStatus('analyzing');
    setError(null);
    try {
      const res = await fetch('/api/ai/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: op,
          article
        })
      });

      const data: ArticleAiResponse = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to complete Article AI operation.');
        setStatus(analysisContext ? 'complete' : 'not_run');
      } else {
        setAnalysisContext(prev => ({
          ...(prev || {}),
          ...(data.suggestions || {})
        }));
        if (data.sources) {
          setSourcesStatus(data.sources);
        }
        setStatus('complete');
      }
    } catch (err: any) {
      setError(err.message || 'Network error executing Article AI request.');
      setStatus(analysisContext ? 'complete' : 'not_run');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTitleAction = (val: string) => {
    onApplyTitle(val);
    setAppliedKeys(prev => new Set(prev).add(`title_${val}`));
    setCopiedField('Title');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleApplyDeckAction = (val: string) => {
    onApplyDeck(val);
    setAppliedKeys(prev => new Set(prev).add(`deck_${val}`));
    setCopiedField('Deck');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleApplyIntroAction = (val: string) => {
    onApplyIntro(val);
    setAppliedKeys(prev => new Set(prev).add('intro'));
    setCopiedField('Introduction');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleCopyText = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleAppendText = (val: string, label: string) => {
    if (onAppendToBody) {
      onAppendToBody(`\n\n${val}\n`);
      setCopiedField(`Appended ${label}`);
      setTimeout(() => setCopiedField(null), 2500);
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
                <span>Article Editorial AI Assistant</span>
                <span className="text-xs px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-sans font-semibold rounded-xs border border-[#99BFF9]/30 uppercase tracking-wider">
                  Gemini 3.5 Flash-Lite
                </span>
              </h2>
              <p className="text-xs text-[#5A6270] mt-0.5">
                {article.frontMatter.title ? `Context: "${article.frontMatter.title}"` : 'Context: Active Article Draft'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status !== 'not_run' && (
              <button
                type="button"
                onClick={() => triggerOperation(currentOp, true)}
                disabled={loading}
                className="px-3 py-1.5 bg-white border border-[#99BFF9]/35 hover:border-[#2A548E] text-[#2A548E] text-xs font-semibold rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Run fresh analysis for this article"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Analyzing...' : 'Refresh Analysis'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* OPERATION SELECTOR BAR */}
        <div className="bg-[#EEF5FF]/60 border-b border-[#99BFF9]/20 px-6 py-2 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
          {(Object.keys(OPERATION_LABELS) as ArticleAiOperation[]).map(op => {
            const config = OPERATION_LABELS[op];
            const Icon = config.icon;
            const isActive = currentOp === op;
            return (
              <button
                key={op}
                type="button"
                onClick={() => setCurrentOperation(op)}
                className={`px-3 py-1.5 rounded-xs flex items-center gap-1.5 font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#2A548E] text-white shadow-2xs'
                    : 'bg-white hover:bg-[#EEF5FF] text-[#5A6270] hover:text-[#2A548E] border border-[#99BFF9]/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* STATUS & SOURCES BAR */}
        <div className="bg-white border-b border-[#99BFF9]/20 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono-code text-[11px]">
            {status === 'not_run' && (
              <span className="flex items-center gap-1.5 text-[#5A6270]">
                <span className="w-2 h-2 rounded-full bg-stone-300"></span>
                <span>Analysis not run</span>
              </span>
            )}
            {status === 'analyzing' && (
              <span className="flex items-center gap-1.5 text-[#2A548E] font-medium animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing article content with Gemini 3.5 Flash-Lite...</span>
              </span>
            )}
            {status === 'complete' && (
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Analysis complete</span>
              </span>
            )}
          </div>

          {/* Sources and Context Badges */}
          <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-[#2A548E]" />
              <span>Body ({article.body.length} chars)</span>
            </span>
            {article.frontMatter.sources && article.frontMatter.sources.length > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#2A548E]" />
                <span>{article.frontMatter.sources.length} citations</span>
              </span>
            )}
            {sourcesStatus?.availableCatalogUrlsCount !== undefined && (
              <span className="flex items-center gap-1">
                <Link2 className="w-3 h-3 text-emerald-700" />
                <span>{sourcesStatus.availableCatalogUrlsCount} catalog URLs verified</span>
              </span>
            )}
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {copiedField && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2 text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Applied <strong>{copiedField}</strong> to Article Editor draft (unsaved).</span>
            </span>
            <span className="text-[11px] text-emerald-700">Remember to click "Save Article" when finished.</span>
          </div>
        )}

        {/* ERROR BAR */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* MODAL MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {status === 'not_run' && !loading && (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center mx-auto border border-[#99BFF9]/30">
                <OpIcon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">
                  {OPERATION_LABELS[currentOp]?.label}
                </h3>
                <p className="text-xs text-[#5A6270] leading-relaxed">
                  {OPERATION_LABELS[currentOp]?.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => triggerOperation(currentOp)}
                className="px-6 py-2.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs transition-colors shadow-xs flex items-center gap-2 mx-auto cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Run AI Analysis</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin mx-auto" />
              <p className="text-xs font-mono-code text-[#5A6270]">
                Gemini 3.5 Flash-Lite is analyzing the article...
              </p>
            </div>
          )}

          {status === 'complete' && analysisContext && !loading && (
            <div className="space-y-6">
              {/* OPERATION 1: FULL ESSAY ANALYSIS */}
              {currentOp === 'analyze_article' && (
                <div className="space-y-6">
                  {analysisContext.analysis && (
                    <div className="space-y-4">
                      {/* Topic & Audience Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2A548E] block mb-1">
                            Primary Topic
                          </span>
                          <p className="text-xs font-serif text-[#1E232B] leading-relaxed">
                            {analysisContext.analysis.primaryTopic || 'General Gift Psychology'}
                          </p>
                        </div>
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2A548E] block mb-1">
                            Search Intent
                          </span>
                          <p className="text-xs font-serif text-[#1E232B] leading-relaxed">
                            {analysisContext.analysis.searchIntent || 'Informational / Curatorial'}
                          </p>
                        </div>
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2A548E] block mb-1">
                            Target Audience
                          </span>
                          <p className="text-xs font-serif text-[#1E232B] leading-relaxed">
                            {analysisContext.analysis.targetAudience || 'Thoughtful gift givers & cultural readers'}
                          </p>
                        </div>
                      </div>

                      {/* Content Strengths & Weaknesses */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Content Strengths
                          </h4>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.analysis.contentStrengths || []).map((s: string, i: number) => (
                              <li key={i} className="leading-relaxed">{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-amber-800 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Areas for Editorial Improvement
                          </h4>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.analysis.contentWeaknesses || []).map((w: string, i: number) => (
                              <li key={i} className="leading-relaxed">{w}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Missing Opportunities & SEO Issues */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Missing Opportunities &amp; Angles
                          </h4>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.analysis.missingOpportunities || []).map((o: string, i: number) => (
                              <li key={i} className="leading-relaxed">{o}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <h4 className="text-xs uppercase tracking-wider font-semibold text-[#5A6270] flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" />
                            Readability &amp; Structure Notes
                          </h4>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.analysis.readabilityNotes || []).map((r: string, i: number) => (
                              <li key={i} className="leading-relaxed">{r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPERATION 2: SUGGEST TITLE */}
              {currentOp === 'suggest_title' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                      Editorial Title Candidates
                    </h4>
                    <span className="text-[11px] text-[#5A6270]">Click "Use Title" to apply to draft</span>
                  </div>
                  <div className="space-y-3">
                    {(analysisContext.titles || []).map((t, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs shadow-2xs flex items-start justify-between gap-4 hover:border-[#2A548E]/40 transition-colors"
                      >
                        <div className="space-y-1 flex-1">
                          <h5 className="font-serif text-base text-[#1E232B] font-medium leading-snug">
                            {t.value}
                          </h5>
                          <p className="text-xs text-[#5A6270] leading-relaxed">
                            {t.reason}
                          </p>
                        </div>
                        {appliedKeys.has(`title_${t.value}`) ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded-xs shrink-0 flex items-center gap-1.5 opacity-90"
                          >
                            <Check className="w-3.5 h-3.5 text-[#226E56]" />
                            <span>Applied</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyTitleAction(t.value)}
                            className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 text-xs font-semibold rounded-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
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

              {/* OPERATION 3: SUGGEST DECK / META */}
              {currentOp === 'suggest_deck' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                      Subtitle Deck &amp; Meta Description Options
                    </h4>
                    <span className="text-[11px] text-[#5A6270]">Click "Use Deck" to apply to draft</span>
                  </div>
                  <div className="space-y-3">
                    {(analysisContext.decks || []).map((d, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs shadow-2xs flex items-start justify-between gap-4 hover:border-[#2A548E]/40 transition-colors"
                      >
                        <div className="space-y-1 flex-1">
                          <p className="font-serif text-sm text-[#1E232B] leading-relaxed">
                            "{d.value}"
                          </p>
                          <p className="text-xs text-[#5A6270]">
                            {d.reason}
                          </p>
                        </div>
                        {appliedKeys.has(`deck_${d.value}`) ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded-xs shrink-0 flex items-center gap-1.5 opacity-90"
                          >
                            <Check className="w-3.5 h-3.5 text-[#226E56]" />
                            <span>Applied</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyDeckAction(d.value)}
                            className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 text-xs font-semibold rounded-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Use Deck</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OPERATION 4: IMPROVE INTRO */}
              {currentOp === 'improve_intro' && (
                <div className="space-y-4">
                  {analysisContext.improvedIntro ? (
                    <div className="bg-white p-5 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                          Suggested Essay Introduction
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyText(analysisContext.improvedIntro!.text, 'Introduction')}
                            className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-[#99BFF9]/35 text-[#5A6270] text-xs font-semibold rounded-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                          {appliedKeys.has('intro') ? (
                            <button
                              type="button"
                              disabled
                              className="px-3 py-1.5 bg-emerald-50 text-[#154D3B] border border-[#226E56]/30 text-xs font-semibold rounded-xs flex items-center gap-1.5 opacity-90"
                            >
                              <Check className="w-3.5 h-3.5 text-[#226E56]" />
                              <span>Applied</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApplyIntroAction(analysisContext.improvedIntro!.text)}
                              className="px-3 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Use Introduction</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="bg-[#FAF9F6] p-4 border border-[#99BFF9]/20 rounded-xs font-serif text-sm leading-relaxed text-[#1E232B] whitespace-pre-line">
                        {analysisContext.improvedIntro.text}
                      </div>
                      <p className="text-xs text-[#5A6270] italic">
                        <strong>Editorial Reasoning:</strong> {analysisContext.improvedIntro.explanation}
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#5A6270]">
                      No introduction suggestion generated. Click Refresh to regenerate.
                    </div>
                  )}
                </div>
              )}

              {/* OPERATION 5: EDITORIAL IMPROVEMENTS */}
              {currentOp === 'improve_article' && (
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                    Section-by-Section Editorial Advice
                  </h4>
                  <div className="space-y-3">
                    {(analysisContext.editorialImprovements || []).map((imp, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-2">
                          <h5 className="font-semibold text-xs text-[#2A548E]">
                            Section: {imp.section}
                          </h5>
                          <button
                            type="button"
                            onClick={() => handleAppendText(imp.suggestion, imp.section)}
                            className="text-[11px] text-[#2A548E] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Append to Essay</span>
                          </button>
                        </div>
                        <p className="text-xs text-stone-700">
                          <strong>Critique:</strong> {imp.critique}
                        </p>
                        <div className="bg-[#FAF9F6] p-3 border border-[#99BFF9]/20 rounded-xs text-xs font-serif leading-relaxed text-[#1E232B]">
                          <strong>Suggested revision / addition:</strong> {imp.suggestion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OPERATION 6: SEO ANALYSIS */}
              {currentOp === 'seo_analysis' && (
                <div className="space-y-4">
                  {analysisContext.seoAnalysis ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2A548E] block">
                            Heading Structure &amp; Hierarchy
                          </span>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.seoAnalysis.headingStructureAdvice || []).map((h, i) => (
                              <li key={i} className="leading-relaxed">{h}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-white p-4 border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2">
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#2A548E] block">
                            Keyword &amp; Topical Coverage Advice
                          </span>
                          <ul className="text-xs text-[#1E232B] space-y-1.5 list-disc list-inside">
                            {(analysisContext.seoAnalysis.keywordCoverageAdvice || []).map((k, i) => (
                              <li key={i} className="leading-relaxed">{k}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#5A6270]">
                      No SEO analysis data available.
                    </div>
                  )}
                </div>
              )}

              {/* OPERATION 7: INTERNAL LINKING */}
              {currentOp === 'internal_linking' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                      Verified Internal Link Recommendations
                    </h4>
                    <span className="text-[11px] text-[#5A6270]">Only links from actual site catalog</span>
                  </div>
                  <div className="space-y-3">
                    {(analysisContext.internalLinks || []).map((link, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#99BFF9]/30 rounded-xs shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-[#99BFF9]/20 pb-2">
                          <div>
                            <span className="text-xs font-semibold text-[#2A548E] flex items-center gap-1.5">
                              <Link2 className="w-3.5 h-3.5" />
                              <span>{link.targetTitle}</span>
                            </span>
                            <code className="text-[11px] font-mono-code text-stone-500">{link.targetUrl}</code>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyText(`[${link.suggestedAnchor}](${link.targetUrl})`, 'Markdown Link')}
                            className="px-2.5 py-1 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 text-xs font-semibold rounded-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Markdown</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <strong className="text-[#5A6270] block text-[11px]">Recommended Anchor Text:</strong>
                            <span className="font-medium text-[#1E232B]">"{link.suggestedAnchor}"</span>
                          </div>
                          <div>
                            <strong className="text-[#5A6270] block text-[11px]">Placement Context:</strong>
                            <span className="text-[#1E232B] italic">"{link.placementContext}"</span>
                          </div>
                        </div>
                        <p className="text-xs text-[#5A6270]">
                          <strong>Rationale:</strong> {link.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

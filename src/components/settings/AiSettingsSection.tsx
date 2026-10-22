import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Check, Loader2, AlertCircle, Cpu, FileText, Search, ShieldCheck } from 'lucide-react';
import { AiSettingsData, DEFAULT_AI_SETTINGS } from '../../types/aiSettings';

const AVAILABLE_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Fast, High Quality Default)', tier: 'Standard' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Low Cost, High Efficiency)', tier: 'Lite' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash (Stable Fallback)', tier: 'Standard' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Deep Reasoning & Analysis)', tier: 'Advanced' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (High Speed Lite)', tier: 'Lite' },
  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (Alias)', tier: 'Standard' }
];

export const AiSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<AiSettingsData>(DEFAULT_AI_SETTINGS);
  const [initialJson, setInitialJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isDirty = JSON.stringify(settings) !== initialJson;

  useEffect(() => {
    fetchAiSettings();
  }, []);

  const fetchAiSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-settings');
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        setInitialJson(JSON.stringify(data.settings));
      } else {
        setError(data.error || 'Failed to load AI configuration settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading AI configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSettings(data.settings);
        setInitialJson(JSON.stringify(data.settings));
        setSuccessMsg('AI Settings & Model Configuration saved successfully!');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.error || 'Failed to save AI configuration settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving AI configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSettings({ ...DEFAULT_AI_SETTINGS });
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-3 bg-white border border-[#99BFF9]/30 rounded-xl p-8">
        <Loader2 className="w-6 h-6 text-[#2A548E] animate-spin" />
        <span>Loading persistent CMS AI Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#1E232B] font-sans">
      {/* Header Banner */}
      <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#EEF5FF] text-[#2A548E]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif-display text-lg font-medium text-[#1E232B]">
                CMS Product AI &amp; Model Configuration
              </h3>
              {isDirty && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded font-mono-code">
                  Unsaved Instructions
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6270]">
              Configure global AI prompts, Product AI writing guidelines, and model assignment hierarchy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg cursor-pointer transition-colors"
          >
            Reset Defaults
          </button>
          <button
            type="button"
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
            <span>Save AI Settings</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Model Selection Panel */}
      <div className="bg-white border border-[#99BFF9]/30 rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#99BFF9]/20 pb-3">
          <Cpu className="w-5 h-5 text-[#2A548E]" />
          <div>
            <h4 className="font-serif-display text-base font-normal text-[#1E232B]">
              Gemini Model Routing &amp; Hierarchy
            </h4>
            <p className="text-xs text-[#5A6270]">
              Assign Gemini models to specific CMS task categories. Intelligent fallback handles 429/503 spikes automatically.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Primary Model */}
          <div className="space-y-1.5 p-3.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <label className="font-semibold text-[#1E232B] block flex items-center justify-between">
              <span>Primary Product Model</span>
              <span className="text-[10px] text-[#2A548E] uppercase font-bold">Standard Writing</span>
            </label>
            <p className="text-[11px] text-[#5A6270]">
              Used for titles, editorial reviews, gift reasoning, ideal for, and stand-out features.
            </p>
            <select
              value={settings.primaryModel}
              onChange={e => setSettings(prev => ({ ...prev, primaryModel: e.target.value }))}
              className="w-full p-2 bg-white border border-stone-300 rounded font-mono-code text-xs text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Low Cost Model */}
          <div className="space-y-1.5 p-3.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <label className="font-semibold text-[#1E232B] block flex items-center justify-between">
              <span>Low-Cost Product Model</span>
              <span className="text-[10px] text-emerald-800 uppercase font-bold">High Speed</span>
            </label>
            <p className="text-[11px] text-[#5A6270]">
              Used for high-frequency lightweight tasks such as taxonomy mapping and taglines.
            </p>
            <select
              value={settings.lowCostModel}
              onChange={e => setSettings(prev => ({ ...prev, lowCostModel: e.target.value }))}
              className="w-full p-2 bg-white border border-stone-300 rounded font-mono-code text-xs text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Fallback Model */}
          <div className="space-y-1.5 p-3.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <label className="font-semibold text-[#1E232B] block flex items-center justify-between">
              <span>Fallback Product Model</span>
              <span className="text-[10px] text-amber-800 uppercase font-bold">Resilience</span>
            </label>
            <p className="text-[11px] text-[#5A6270]">
              Invoked seamlessly if the primary model encounters rate limits or transient service spikes.
            </p>
            <select
              value={settings.fallbackModel}
              onChange={e => setSettings(prev => ({ ...prev, fallbackModel: e.target.value }))}
              className="w-full p-2 bg-white border border-stone-300 rounded font-mono-code text-xs text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Deep Analysis Model */}
          <div className="space-y-1.5 p-3.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-lg">
            <label className="font-semibold text-[#1E232B] block flex items-center justify-between">
              <span>Deep Analysis Model</span>
              <span className="text-[10px] text-purple-800 uppercase font-bold">Deep Reasoning</span>
            </label>
            <p className="text-[11px] text-[#5A6270]">
              Used for full suite product &amp; image analysis operations.
            </p>
            <select
              value={settings.deepAnalysisModel}
              onChange={e => setSettings(prev => ({ ...prev, deepAnalysisModel: e.target.value }))}
              className="w-full p-2 bg-white border border-stone-300 rounded font-mono-code text-xs text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Editable Prompt Instructions Panel */}
      <div className="bg-white border border-[#99BFF9]/30 rounded-xl p-6 space-y-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-[#99BFF9]/20 pb-3">
          <FileText className="w-5 h-5 text-[#2A548E]" />
          <div>
            <h4 className="font-serif-display text-base font-normal text-[#1E232B]">
              Editorial &amp; Research Custom Instructions
            </h4>
            <p className="text-xs text-[#5A6270]">
              Shape how AI-generated editorial copy sounds and how research is synthesized.
            </p>
          </div>
        </div>

        {/* Global Instructions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#1E232B] block flex items-center justify-between">
            <span>Global AI Instructions</span>
            <span className="text-[11px] text-[#5A6270] font-normal">Applies to all AI operations</span>
          </label>
          <textarea
            rows={3}
            value={settings.globalInstructions}
            onChange={e => setSettings(prev => ({ ...prev, globalInstructions: e.target.value }))}
            className="w-full p-3 bg-[#FAF9F6] border border-stone-300 rounded-lg text-xs leading-relaxed text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            placeholder="Global assistant instructions..."
          />
        </div>

        {/* Product Writing Instructions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#1E232B] block flex items-center justify-between">
            <span>Product AI Writing Instructions</span>
            <span className="text-[11px] text-[#2A548E] font-semibold">Science of Gifts Style Guide</span>
          </label>
          <p className="text-[11px] text-[#5A6270]">
            Defines the curatorial tone, prohibition of hype adjectives, focus on recipient psychology, and restraint requirements.
          </p>
          <textarea
            rows={6}
            value={settings.productWritingInstructions}
            onChange={e => setSettings(prev => ({ ...prev, productWritingInstructions: e.target.value }))}
            className="w-full p-3 bg-[#FAF9F6] border border-stone-300 rounded-lg text-xs leading-relaxed text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            placeholder="Curatorial writing guidelines..."
          />
        </div>

        {/* Product Research Instructions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#1E232B] block flex items-center justify-between">
            <span>Product AI Research Instructions</span>
            <span className="text-[11px] text-[#5A6270] font-normal">Fact Extraction &amp; Verification</span>
          </label>
          <p className="text-[11px] text-[#5A6270]">
            Influences how vendor URLs and local product images are synthesized into verified facts and visual observations.
          </p>
          <textarea
            rows={3}
            value={settings.productResearchInstructions}
            onChange={e => setSettings(prev => ({ ...prev, productResearchInstructions: e.target.value }))}
            className="w-full p-3 bg-[#FAF9F6] border border-stone-300 rounded-lg text-xs leading-relaxed text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            placeholder="Fact extraction rules..."
          />
        </div>

        {/* Article AI Writing Instructions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#1E232B] block flex items-center justify-between">
            <span>Article &amp; Essay AI Writing Instructions</span>
            <span className="text-[11px] text-[#2A548E] font-semibold">Long-Form Essay Standards</span>
          </label>
          <p className="text-[11px] text-[#5A6270]">
            Governs tone, thesis development, material culture insights, and academic citation standards for long-form essays.
          </p>
          <textarea
            rows={4}
            value={settings.articleWritingInstructions || ''}
            onChange={e => setSettings(prev => ({ ...prev, articleWritingInstructions: e.target.value }))}
            className="w-full p-3 bg-[#FAF9F6] border border-stone-300 rounded-lg text-xs leading-relaxed text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            placeholder="Article essay writing instructions..."
          />
        </div>

        {/* Gift Guide AI Writing Instructions */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#1E232B] block flex items-center justify-between">
            <span>Gift Guide AI Writing Instructions</span>
            <span className="text-[11px] text-[#2A548E] font-semibold">Curatorial Guide Standards</span>
          </label>
          <p className="text-[11px] text-[#5A6270]">
            Guides the curatorial tone, product categorization logic, price tiering, and rules/principles formulation for gift guides.
          </p>
          <textarea
            rows={4}
            value={settings.guideWritingInstructions || ''}
            onChange={e => setSettings(prev => ({ ...prev, guideWritingInstructions: e.target.value }))}
            className="w-full p-3 bg-[#FAF9F6] border border-stone-300 rounded-lg text-xs leading-relaxed text-[#1E232B] focus:ring-1 focus:ring-[#2A548E]"
            placeholder="Gift guide curation instructions..."
          />
        </div>
      </div>
    </div>
  );
};

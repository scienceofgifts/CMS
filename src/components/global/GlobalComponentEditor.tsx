import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  History,
  Eye,
  Columns,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Type,
  Link,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  Package
} from 'lucide-react';
import { GlobalComponentKey } from '../../types/globalComponents';
import { GlobalComponentPreview } from './GlobalComponentPreview';
import { GlobalComponentsBackupsModal } from './GlobalComponentsBackupsModal';
import { ProductPickerModal } from '../guides/ProductPickerModal';

interface GlobalComponentEditorProps {
  componentKey: GlobalComponentKey;
  onBack: () => void;
}

export function GlobalComponentEditor({ componentKey, onBack }: GlobalComponentEditorProps) {
  const [data, setData] = useState<any>(null);
  const [initialJson, setInitialJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split'>('split');
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState<boolean>(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState<boolean>(false);

  const isDirty = data ? JSON.stringify(data) !== initialJson : false;

  const fetchComponent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/global-components/${componentKey}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.component);
        setInitialJson(JSON.stringify(json.component));
      } else {
        setError(json.error || `Failed to load component "${componentKey}".`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading component data.');
    } finally {
      setLoading(false);
    }
  }, [componentKey]);

  useEffect(() => {
    fetchComponent();
  }, [fetchComponent]);

  // Unsaved changes protection
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

  const handleBackClick = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to exit?')) {
        return;
      }
    }
    onBack();
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/global-components/${componentKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.component);
        setInitialJson(JSON.stringify(json.component));
        setSaveSuccess(`Global component "${componentKey}" updated successfully! (Backup: ${json.backupFile})`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setError(json.error || 'Failed to save component changes.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving component.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
        <span>Reading global component file for "{componentKey}"...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-xl space-y-4 text-rose-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-serif-display text-lg font-medium">Failed to Load Component Editor</h3>
        </div>
        <p className="text-xs leading-relaxed">{error || 'Component content is unavailable.'}</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={fetchComponent}
            className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 border border-stone-300 hover:bg-white text-stone-700 text-xs font-medium rounded cursor-pointer transition-colors"
          >
            Back to Global Components
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white border border-[#99BFF9]/35 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackClick}
            className="p-2 border border-stone-200 hover:bg-[#EEF5FF] text-[#5A6270] hover:text-[#2A548E] rounded-lg transition-colors cursor-pointer"
            title="Return to Global Components Manager"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Editing Component: <span className="font-serif italic text-[#2A548E]">{data.name || componentKey}</span>
              </h2>
              {isDirty && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded font-mono-code">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6270]">
              Source File: <code className="font-mono-code font-bold">{data.filename || `_includes/${componentKey}.html`}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-[#FAF9F6] border border-stone-200 p-1 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'editor' ? 'bg-white text-[#2A548E] shadow-xs' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'split' ? 'bg-white text-[#2A548E] shadow-xs' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-white text-[#2A548E] shadow-xs' : 'text-[#5A6270] hover:text-[#1E232B]'
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
        <div className="p-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className={`grid gap-8 ${activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* LEFT COLUMN: EDITORIAL FORM */}
        {(activeTab === 'editor' || activeTab === 'split') && (
          <div className="space-y-6">
            {/* 1. NEWSLETTER EDITOR */}
            {componentKey === 'newsletter' && (
              <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4 text-xs">
                <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                  <Type className="w-4 h-4 text-[#226E56]" />
                  <span>Newsletter Editorial Copy &amp; Form Labels</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">
                      Header Sub-badge Label
                    </label>
                    <input
                      type="text"
                      value={data.badge || ''}
                      onChange={(e) => setData({ ...data, badge: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">
                      Main Banner Headline (H2)
                    </label>
                    <input
                      type="text"
                      value={data.headline || ''}
                      onChange={(e) => setData({ ...data, headline: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">
                      Editorial Value Proposition Subtitle
                    </label>
                    <textarea
                      rows={3}
                      value={data.descriptionText || data.description || ''}
                      onChange={(e) => setData({ ...data, descriptionText: e.target.value, description: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Email Field Placeholder
                      </label>
                      <input
                        type="text"
                        value={data.emailPlaceholder || ''}
                        onChange={(e) => setData({ ...data, emailPlaceholder: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Submit Button Text
                      </label>
                      <input
                        type="text"
                        value={data.buttonText || ''}
                        onChange={(e) => setData({ ...data, buttonText: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-bold uppercase tracking-wider text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">
                      Confirmation Response Message (Post-Submit)
                    </label>
                    <input
                      type="text"
                      value={data.submitMessage || ''}
                      onChange={(e) => setData({ ...data, submitMessage: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">
                      Footnote Social Proof &amp; Unsubscribe Terms
                    </label>
                    <input
                      type="text"
                      value={data.socialProof || ''}
                      onChange={(e) => setData({ ...data, socialProof: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. FOOTER EDITOR */}
            {componentKey === 'footer' && (
              <div className="space-y-6 text-xs">
                {/* Brand & Publication Statement */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#2A548E]" />
                    <span>Footer Publication Narrative &amp; Locations</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Publication Description
                      </label>
                      <textarea
                        rows={2}
                        value={data.publicationDescription || ''}
                        onChange={(e) => setData({ ...data, publicationDescription: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Publishing Cadence &amp; Locations Line
                      </label>
                      <input
                        type="text"
                        value={data.publishingLocations || ''}
                        onChange={(e) => setData({ ...data, publishingLocations: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 1 Links */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-2">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                      <Link className="w-4 h-4 text-[#226E56]" />
                      <span>Footer Navigation — Column 1 (Guides)</span>
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">Column Title</label>
                    <input
                      type="text"
                      value={data.guidesColumnTitle || ''}
                      onChange={(e) => setData({ ...data, guidesColumnTitle: e.target.value })}
                      className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded font-semibold text-[#1E232B]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[#5A6270] font-medium">Links List</label>
                    {(data.guidesLinks || []).map((link: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-[#FAF9F6] border border-stone-200 rounded">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...data.guidesLinks];
                            updated[idx].label = e.target.value;
                            setData({ ...data, guidesLinks: updated });
                          }}
                          className="flex-1 p-1.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B]"
                          placeholder="Link Title"
                        />
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...data.guidesLinks];
                            updated[idx].url = e.target.value;
                            setData({ ...data, guidesLinks: updated });
                          }}
                          className="flex-1 p-1.5 bg-white border border-stone-200 rounded font-mono-code text-[#2A548E]"
                          placeholder="/path/"
                        />
                        <button
                          onClick={() => {
                            const updated = data.guidesLinks.filter((_: any, i: number) => i !== idx);
                            setData({ ...data, guidesLinks: updated });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setData({ ...data, guidesLinks: [...(data.guidesLinks || []), { label: 'New Guide Link', url: '/gift-guides/' }] })}
                      className="px-3 py-1.5 border border-[#99BFF9]/40 text-[#2A548E] font-medium rounded hover:bg-[#EEF5FF] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Guide Link</span>
                    </button>
                  </div>
                </div>

                {/* Column 2 Links */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-2">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                      <Link className="w-4 h-4 text-[#226E56]" />
                      <span>Footer Navigation — Column 2 (Essays)</span>
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1">Column Title</label>
                    <input
                      type="text"
                      value={data.essaysColumnTitle || ''}
                      onChange={(e) => setData({ ...data, essaysColumnTitle: e.target.value })}
                      className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded font-semibold text-[#1E232B]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[#5A6270] font-medium">Links List</label>
                    {(data.essaysLinks || []).map((link: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-[#FAF9F6] border border-stone-200 rounded">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...data.essaysLinks];
                            updated[idx].label = e.target.value;
                            setData({ ...data, essaysLinks: updated });
                          }}
                          className="flex-1 p-1.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B]"
                          placeholder="Essay Title"
                        />
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...data.essaysLinks];
                            updated[idx].url = e.target.value;
                            setData({ ...data, essaysLinks: updated });
                          }}
                          className="flex-1 p-1.5 bg-white border border-stone-200 rounded font-mono-code text-[#2A548E]"
                          placeholder="/essay-slug/"
                        />
                        <button
                          onClick={() => {
                            const updated = data.essaysLinks.filter((_: any, i: number) => i !== idx);
                            setData({ ...data, essaysLinks: updated });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setData({ ...data, essaysLinks: [...(data.essaysLinks || []), { label: 'New Essay Link', url: '/articles/' }] })}
                      className="px-3 py-1.5 border border-[#99BFF9]/40 text-[#2A548E] font-medium rounded hover:bg-[#EEF5FF] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Essay Link</span>
                    </button>
                  </div>
                </div>

                {/* Footer Utility Strip Links */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Link className="w-4 h-4 text-[#2A548E]" />
                    <span>Footer Utility Navigation Bar</span>
                  </h3>

                  <div className="space-y-2">
                    {(data.utilityLinks || []).map((link: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-[#FAF9F6] border border-stone-200 rounded">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => {
                            const updated = [...data.utilityLinks];
                            updated[idx].label = e.target.value;
                            setData({ ...data, utilityLinks: updated });
                          }}
                          className="w-1/3 p-1.5 bg-white border border-stone-200 rounded font-medium text-[#1E232B]"
                          placeholder="Label"
                        />
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...data.utilityLinks];
                            updated[idx].url = e.target.value;
                            setData({ ...data, utilityLinks: updated });
                          }}
                          className="flex-1 p-1.5 bg-white border border-stone-200 rounded font-mono-code text-[#2A548E]"
                          placeholder="/path/ or https://"
                        />
                        <button
                          onClick={() => {
                            const updated = data.utilityLinks.filter((_: any, i: number) => i !== idx);
                            setData({ ...data, utilityLinks: updated });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setData({ ...data, utilityLinks: [...(data.utilityLinks || []), { label: 'New Utility Link', url: '/about/' }] })}
                      className="px-3 py-1.5 border border-[#99BFF9]/40 text-[#2A548E] font-medium rounded hover:bg-[#EEF5FF] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Utility Link</span>
                    </button>
                  </div>
                </div>

                {/* Editorial Integrity & Copyright */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#226E56]" />
                    <span>Editorial Integrity &amp; Copyright Notice</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Editorial Integrity Disclosure Statement
                      </label>
                      <textarea
                        rows={3}
                        value={data.integrityStatement || ''}
                        onChange={(e) => setData({ ...data, integrityStatement: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Copyright Line
                      </label>
                      <input
                        type="text"
                        value={data.copyrightText || ''}
                        onChange={(e) => setData({ ...data, copyrightText: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. EDITOR'S PICK EDITOR */}
            {componentKey === 'editors-pick' && (
              <div className="space-y-6 text-xs">
                {/* Headers & Labels */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <h3 className="font-serif-display text-base text-[#1E232B] font-medium border-b border-[#99BFF9]/20 pb-2 flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#226E56]" />
                    <span>Editor's Pick Section Labels &amp; Headings</span>
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">
                          Eyebrow Sub-badge Text
                        </label>
                        <input
                          type="text"
                          value={data.subBadge || ''}
                          onChange={(e) => setData({ ...data, subBadge: e.target.value })}
                          className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-medium text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">
                          Section Main Title (H2)
                        </label>
                        <input
                          type="text"
                          value={data.title || ''}
                          onChange={(e) => setData({ ...data, title: e.target.value })}
                          className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#5A6270] font-medium mb-1">
                        Default Product Badge Fallback
                      </label>
                      <input
                        type="text"
                        value={data.badgeLabelDefault || ''}
                        onChange={(e) => setData({ ...data, badgeLabelDefault: e.target.value })}
                        className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">"Why It Makes A Singular Gift" Box Header</label>
                        <input
                          type="text"
                          value={data.whyGiftHeader || ''}
                          onChange={(e) => setData({ ...data, whyGiftHeader: e.target.value })}
                          className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">"Ideal For" Box Header</label>
                        <input
                          type="text"
                          value={data.idealForHeader || ''}
                          onChange={(e) => setData({ ...data, idealForHeader: e.target.value })}
                          className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">"What Makes It Stand Out" Box Header</label>
                        <input
                          type="text"
                          value={data.standoutHeader || ''}
                          onChange={(e) => setData({ ...data, standoutHeader: e.target.value })}
                          className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#5A6270] font-medium mb-1">"Things to Consider" Box Header</label>
                        <input
                          type="text"
                          value={data.considerHeader || ''}
                          onChange={(e) => setData({ ...data, considerHeader: e.target.value })}
                          className="w-full p-2 bg-[#FAF9F6] border border-stone-200 rounded text-[#1E232B]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Featured Product Selection */}
                <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-2">
                    <h3 className="font-serif-display text-base text-[#1E232B] font-medium flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#226E56]" />
                      <span>Featured Standout Product Selection</span>
                    </h3>
                    <span className="text-xs font-mono-code text-[#2A548E]">
                      _data/products.yml
                    </span>
                  </div>

                  <p className="text-[#5A6270] leading-relaxed">
                    Select the default product reference specimen from the central catalog to showcase in the Editor's Pick component preview.
                  </p>

                  <div className="p-4 bg-[#FAF9F6] border border-stone-200 rounded-lg flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#226E56]">Selected Product Reference</span>
                      <p className="font-mono-code font-bold text-sm text-[#1E232B]">
                        {data.featuredProductId || 'cast-iron-book-weight'}
                      </p>
                    </div>

                    <button
                      onClick={() => setIsProductPickerOpen(true)}
                      className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Select From Catalog</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIGHT COLUMN: LIVE PREVIEW */}
        {(activeTab === 'preview' || activeTab === 'split') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#5A6270] px-1 font-mono-code">
              <span className="flex items-center gap-1.5 font-bold text-[#2A548E]">
                <Eye className="w-4 h-4" /> Live Component Preview
              </span>
              <span>Reflects site CSS and typography</span>
            </div>

            <div className="sticky top-28">
              <GlobalComponentPreview componentKey={componentKey} data={data} />
            </div>
          </div>
        )}
      </div>

      {/* Backups Modal */}
      <GlobalComponentsBackupsModal
        isOpen={isBackupsModalOpen}
        componentKey={componentKey}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestoreComplete={fetchComponent}
      />

      {/* Product Picker Modal */}
      {isProductPickerOpen && (
        <ProductPickerModal
          isOpen={isProductPickerOpen}
          onClose={() => setIsProductPickerOpen(false)}
          selectedProductId={data.featuredProductId}
          onSelectProduct={(product) => {
            setData({ ...data, featuredProductId: product.id });
            setIsProductPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Save,
  History,
  Eye,
  Columns,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Globe,
  Clock,
  Type,
  FileCode2,
  Layers,
  Sparkles
} from 'lucide-react';
import { SiteSettingsData, ProtectedConfigSummary } from '../../types/siteSettings';
import { SiteSettingsPreview } from './SiteSettingsPreview';
import { SiteSettingsBackupsModal } from './SiteSettingsBackupsModal';
import { AiSettingsSection } from './AiSettingsSection';

const POPULAR_TIMEZONES = [
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'UTC'
];

export function SiteSettingsEditor() {
  const [settings, setSettings] = useState<SiteSettingsData | null>(null);
  const [initialJson, setInitialJson] = useState<string>('');
  const [protectedConfig, setProtectedConfig] = useState<ProtectedConfigSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'split' | 'ai'>('split');
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState<boolean>(false);

  const isDirty = settings ? JSON.stringify(settings) !== initialJson : false;

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/site-settings');
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        setInitialJson(JSON.stringify(data.settings));
        setProtectedConfig(data.protectedConfig);
      } else {
        setError(data.error || 'Failed to load publication settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading site settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Unsaved changes confirmation
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
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    // Client-side URL check
    if (settings.url && !/^https?:\/\//i.test(settings.url)) {
      setError('Publication URL must start with http:// or https://');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSettings(data.settings);
        setInitialJson(JSON.stringify(data.settings));
        setSaveSuccess(`Site settings updated successfully in _config.yml! (Backup: ${data.backupFile})`);
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setError(data.error || 'Failed to save publication settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error saving site settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
        <span>Parsing publication settings from _config.yml...</span>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-rose-50 border border-rose-200 rounded-xl space-y-4 text-rose-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <h3 className="font-serif-display text-lg font-medium">Failed to Load Settings Editor</h3>
        </div>
        <p className="text-xs leading-relaxed">{error || 'Jekyll settings are currently unavailable.'}</p>
        <button
          onClick={fetchSettings}
          className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded cursor-pointer transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white border border-[#99BFF9]/35 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EEF5FF] text-[#2A548E]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Publication Site Settings
              </h2>
              {isDirty && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded font-mono-code">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6270]">
              Source Config File: <code className="font-mono-code font-bold">_config.yml</code>
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
              <span>Fields</span>
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
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ai' ? 'bg-white text-[#2A548E] shadow-xs' : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2A548E]" />
              <span>AI Settings</span>
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
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="p-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'ai' ? (
        <AiSettingsSection />
      ) : (
        /* Editor & Preview Split Grid */
        <div className={`grid gap-8 ${activeTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        
        {/* LEFT COLUMN: FIELDS */}
        {(activeTab === 'editor' || activeTab === 'split') && settings && (
          <div className="space-y-6">
            
            {/* Safe Editorial settings form */}
            <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-5 text-xs">
              <div className="border-b border-stone-100 pb-2">
                <span className="text-[10px] uppercase font-bold text-[#226E56] font-mono-code">
                  Section A
                </span>
                <h3 className="font-serif-display text-lg text-[#1E232B] font-medium mt-0.5">
                  Publication Settings &amp; Metadata
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Site Title
                  </label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif-display text-base text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    placeholder="Publication Name"
                  />
                  <p className="text-[11px] text-[#5A6270] mt-1 italic">
                    The primary public brand name of the publication.
                  </p>
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-serif italic text-sm text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    placeholder="Short subtitle statement..."
                  />
                  <p className="text-[11px] text-[#5A6270] mt-1 italic">
                    The short publication descriptor or editorial vision motto.
                  </p>
                </div>

                <div>
                  <label className="block text-[#5A6270] font-medium mb-1">
                    Default Meta Description
                  </label>
                  <textarea
                    rows={3}
                    value={settings.description}
                    onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded leading-relaxed text-xs text-[#1E232B] focus:border-[#2A548E] focus:outline-none"
                    placeholder="Default descriptive paragraph..."
                  />
                  <p className="text-[11px] text-[#5A6270] mt-1 italic">
                    The site's default description for search engines and social cards metadata.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-[#2A548E]" />
                      <span>Canonical Base URL</span>
                    </label>
                    <input
                      type="text"
                      value={settings.url}
                      onChange={(e) => setSettings({ ...settings, url: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-xs text-[#2A548E] focus:border-[#2A548E] focus:outline-none"
                      placeholder="https://..."
                    />
                    <p className="text-[11px] text-[#5A6270] mt-1 italic">
                      The live publication canonical URL address.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[#5A6270] font-medium mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#226E56]" />
                      <span>Site Timezone</span>
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      className="w-full p-2.5 bg-[#FAF9F6] border border-stone-200 rounded text-xs text-[#1E232B] focus:border-[#2A548E] focus:outline-none font-mono-code"
                    >
                      {POPULAR_TIMEZONES.includes(settings.timezone) ? null : (
                        <option value={settings.timezone}>{settings.timezone} (Configured)</option>
                      )}
                      {POPULAR_TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#5A6270] mt-1 italic">
                      Controls dates representation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Read-only summary of protected configurations */}
            {protectedConfig && (
              <div className="bg-[#FAF9F6] border border-[#99BFF9]/30 p-6 rounded-xl space-y-4 text-xs">
                <div className="border-b border-[#99BFF9]/20 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#226E56]" />
                    <h4 className="font-serif-display text-sm text-[#1E232B] font-medium">
                      Protected Technical Configurations
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 bg-stone-200 text-stone-600 text-[9px] font-bold uppercase rounded font-mono-code">
                    Read-Only
                  </span>
                </div>

                <p className="text-[#5A6270] leading-relaxed">
                  Jekyll collections structure, defaults matching, markdown render engine, SASS, and directory exclusions are locked to prevent publication crashes.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono-code text-[11px]">
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">Baseurl</span>
                    <strong className="text-[#1E232B]">{protectedConfig.baseurl || '""'}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">Permalink Pattern</span>
                    <strong className="text-[#1E232B]">{protectedConfig.permalink}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">MD Engine</span>
                    <strong className="text-[#1E232B]">{protectedConfig.markdownEngine}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">Collections</span>
                    <strong className="text-[#1E232B]">{protectedConfig.collectionsCount} Registered</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">Defaults Layouts</span>
                    <strong className="text-[#1E232B]">{protectedConfig.defaultsCount} Mappings</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-[#99BFF9]/15">
                    <span className="text-[9px] text-[#5A6270] block uppercase">Exclusions</span>
                    <strong className="text-[#1E232B]">{protectedConfig.excludedCount} Rules</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RIGHT COLUMN: PREVIEW */}
        {(activeTab === 'preview' || activeTab === 'split') && settings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#5A6270] px-1 font-mono-code">
              <span className="flex items-center gap-1.5 font-bold text-[#2A548E]">
                <Eye className="w-4 h-4" /> Live Site Settings Preview
              </span>
              <span>Renders metadata output representation</span>
            </div>

            <div className="sticky top-28">
              <SiteSettingsPreview settings={settings} />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Backups Revision Modal */}
      <SiteSettingsBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestoreComplete={fetchSettings}
      />
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Save,
  History,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Award,
  AlertTriangle
} from 'lucide-react';
import { NavigationData, NavigationItem } from '../../types/navigation';
import { NavigationBackupsModal } from './NavigationBackupsModal';

type NavSectionKey = 'header' | 'footer_explore' | 'footer_editorial' | 'footer_legal';

export const NavigationEditor: React.FC = () => {
  const [navData, setNavData] = useState<NavigationData>({
    header: [],
    footer_explore: [],
    footer_editorial: [],
    footer_legal: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    (window as any).cmsIsDirty = hasUnsavedChanges;
    return () => {
      (window as any).cmsIsDirty = false;
    };
  }, [hasUnsavedChanges]);
  const [activeSection, setActiveSection] = useState<NavSectionKey>('header');
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const fetchNavigation = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/navigation');
      const data = await res.json();
      if (data.success) {
        setNavData(data.navigation || { header: [], footer_explore: [], footer_editorial: [], footer_legal: [] });
        setHasUnsavedChanges(false);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to load navigation.yml.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error connecting to server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNavigation();
  }, [fetchNavigation]);

  // Unsaved changes prompt before tab unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const updateSectionItems = (section: NavSectionKey, newItems: NavigationItem[]) => {
    setNavData(prev => ({
      ...prev,
      [section]: newItems
    }));
    setHasUnsavedChanges(true);
  };

  const handleItemChange = (section: NavSectionKey, index: number, field: string, value: any) => {
    const items = [...(navData[section] || [])];
    items[index] = {
      ...items[index],
      [field]: value
    };
    updateSectionItems(section, items);
  };

  const handleMoveUp = (section: NavSectionKey, index: number) => {
    if (index === 0) return;
    const items = [...(navData[section] || [])];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    updateSectionItems(section, items);
  };

  const handleMoveDown = (section: NavSectionKey, index: number) => {
    const items = [...(navData[section] || [])];
    if (index >= items.length - 1) return;
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    updateSectionItems(section, items);
  };

  const handleAddItem = (section: NavSectionKey) => {
    const items = [...(navData[section] || [])];
    items.push({
      title: 'New Navigation Link',
      url: '/new-page/',
      external: false
    });
    updateSectionItems(section, items);
  };

  const handleDeleteItem = (section: NavSectionKey, index: number) => {
    const item = navData[section]?.[index];
    if (item && item.url) {
      const confirmDelete = window.confirm(
        `Are you sure you want to remove navigation item "${item.title}" (${item.url})?\n\nWarning: Ensure no important site sections or external pages depend on this navigation menu link.`
      );
      if (!confirmDelete) return;
    }
    const items = [...(navData[section] || [])];
    items.splice(index, 1);
    updateSectionItems(section, items);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigation: navData })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `navigation.yml updated successfully. Backup saved as ${data.backupFile}.`
        });
        setHasUnsavedChanges(false);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save navigation.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error saving navigation.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreFromBackup = async (filename: string) => {
    const res = await fetch('/api/navigation-backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupFilename: filename })
    });
    const data = await res.json();
    if (data.success) {
      setNavData(data.navigation || { header: [], footer_explore: [], footer_editorial: [], footer_legal: [] });
      setHasUnsavedChanges(false);
      setStatusMsg({ type: 'success', text: `Restored navigation.yml from "${filename}".` });
    } else {
      throw new Error(data.error || 'Failed to restore backup.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium">Loading _data/navigation.yml configuration...</span>
      </div>
    );
  }

  const sectionsInfo: { key: NavSectionKey; label: string; description: string }[] = [
    { key: 'header', label: 'Header Navigation', description: 'Top primary sticky header menu items' },
    { key: 'footer_explore', label: 'Footer Explore', description: 'Primary footer category exploration links' },
    { key: 'footer_editorial', label: 'Footer Editorial', description: 'Editorial desk, philosophy, and about links' },
    { key: 'footer_legal', label: 'Footer Legal & System', description: 'Privacy policy, terms of service, and sitemap links' }
  ];

  const currentItems = navData[activeSection] || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
            <Compass className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl font-bold text-slate-900">
                Navigation Editor
              </h2>
              <span className="font-mono-code text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                _data/navigation.yml
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage header links, footer exploration menus, editorial links, badges, and link orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBackupsModalOpen(true)}
            className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Backups</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : statusMsg.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMsg.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        {sectionsInfo.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeSection === sec.key
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
            }`}
          >
            <span>{sec.label}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono-code">
              {navData[sec.key]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Active Section Description & Add Button */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="text-left">
            <h3 className="font-serif-display text-lg font-bold text-slate-900">
              {sectionsInfo.find(s => s.key === activeSection)?.label}
            </h3>
            <p className="text-xs text-slate-500">
              {sectionsInfo.find(s => s.key === activeSection)?.description}
            </p>
          </div>

          <button
            onClick={() => handleAddItem(activeSection)}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Link Item</span>
          </button>
        </div>

        {/* Item Cards List */}
        {currentItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Compass className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-medium">No links in this navigation section</p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50/60 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center gap-4 text-left"
              >
                {/* Reorder Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMoveUp(activeSection, idx)}
                    disabled={idx === 0}
                    title="Move Up"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(activeSection, idx)}
                    disabled={idx === currentItems.length - 1}
                    title="Move Down"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono-code text-[11px] text-slate-400 px-1 font-bold">
                    #{idx + 1}
                  </span>
                </div>

                {/* Title and URL Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 flex-1">
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Link Title
                    </label>
                    <input
                      type="text"
                      value={item.title || ''}
                      onChange={(e) => handleItemChange(activeSection, idx, 'title', e.target.value)}
                      placeholder="e.g. Gift Guides"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-7">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Target URL
                    </label>
                    <input
                      type="text"
                      value={item.url || ''}
                      onChange={(e) => handleItemChange(activeSection, idx, 'url', e.target.value)}
                      placeholder="e.g. /gift-guides/ or https://..."
                      className="w-full px-3 py-1.5 text-xs font-mono-code bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Flags: External, Badge, Sparkle */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!item.external}
                      onChange={(e) => handleItemChange(activeSection, idx, 'external', e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                    <span>External</span>
                  </label>

                  {activeSection === 'header' && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!item.sparkle}
                          onChange={(e) => handleItemChange(activeSection, idx, 'sparkle', e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Sparkle</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!item.badge}
                          onChange={(e) => handleItemChange(activeSection, idx, 'badge', e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <Award className="w-3 h-3 text-emerald-500" />
                        <span>Badge</span>
                      </label>
                    </>
                  )}

                  {/* Delete Item */}
                  <button
                    onClick={() => handleDeleteItem(activeSection, idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-2 cursor-pointer"
                    title="Remove Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backups Modal */}
      <NavigationBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestore={handleRestoreFromBackup}
      />
    </div>
  );
};

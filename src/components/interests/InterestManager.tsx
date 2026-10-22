import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  History,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  BookOpen,
  ShoppingBag,
  ExternalLink,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { InterestItem, InterestDeleteWarning } from '../../types/interests';
import { InterestEditorModal } from './InterestEditorModal';
import { InterestBackupsModal } from './InterestBackupsModal';

export const InterestManager: React.FC = () => {
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInterest, setEditingInterest] = useState<InterestItem | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);

  const [deleteWarning, setDeleteWarning] = useState<InterestDeleteWarning | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const fetchInterests = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/interests');
      const data = await res.json();
      if (data.success) {
        setInterests(data.interests || []);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to load interests.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error connecting to server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const handleOpenAddModal = () => {
    setEditingInterest(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (interest: InterestItem) => {
    setEditingInterest(interest);
    setIsEditorModalOpen(true);
  };

  const handleSaveInterest = async (interestData: Partial<InterestItem>, originalId?: string) => {
    setStatusMsg(null);
    const isEdit = !!originalId;
    const url = isEdit ? `/api/interests/${originalId}` : '/api/interests';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interestData)
    });
    const data = await res.json();
    if (data.success) {
      setStatusMsg({
        type: 'success',
        text: `Interest "${interestData.name}" saved successfully. Backup created.`
      });
      fetchInterests();
    } else {
      throw new Error(data.error || 'Failed to save interest.');
    }
  };

  const handleDeleteInterest = async (id: string, force = false) => {
    setDeletingId(id);
    setStatusMsg(null);
    try {
      const url = `/api/interests/${id}${force ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (!data.success && data.warning) {
        setDeleteWarning({
          interestId: id,
          interestName: interests.find(i => i.id === id)?.name || id,
          hasReferences: true,
          references: data.references || [],
          count: data.count || 0
        });
      } else if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `Interest deleted successfully. Backup saved as ${data.backupFile}.`
        });
        setDeleteWarning(null);
        fetchInterests();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to delete interest.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error deleting interest.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestoreFromBackup = async (filename: string) => {
    const res = await fetch('/api/interests-backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupFilename: filename })
    });
    const data = await res.json();
    if (data.success) {
      setStatusMsg({ type: 'success', text: `Restored interests.yml from "${filename}".` });
      fetchInterests();
    } else {
      throw new Error(data.error || 'Failed to restore backup.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="text-sm font-medium">Loading _data/interests.yml taxonomy...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header / Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Tag className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl font-bold text-slate-900">
                Interests & Taxonomy Manager
              </h2>
              <span className="font-mono-code text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                _data/interests.yml
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage interest categories, Liquid display counts, category routes, and Gift Finder taxonomy options.
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
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Interest Category</span>
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

      {/* Delete Warning Modal */}
      {deleteWarning && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                Taxonomy Reference Safety Warning: Interest "{deleteWarning.interestName}"
              </h4>
              <p className="text-xs text-amber-800 mt-1">
                Cannot delete category safely because it is currently referenced in {deleteWarning.count} place(s):
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-amber-200/80 max-h-40 overflow-y-auto">
            {deleteWarning.references.map((ref, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-700">
                {ref.type === 'guide' ? (
                  <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                ) : ref.type === 'product' ? (
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : (
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                )}
                <span className="font-medium truncate">{ref.title}</span>
                <span className="text-[10px] text-slate-400 font-mono-code">({ref.idOrSlug})</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteWarning(null)}
              className="px-4 py-2 border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteInterest(deleteWarning.interestId, true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Force Delete Anyway</span>
            </button>
          </div>
        </div>
      )}

      {/* Interest Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {interests.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between space-y-4 text-left"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif-display text-lg font-bold text-slate-900 leading-snug">
                    {item.name}
                  </h3>
                  <div className="font-mono-code text-xs text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                    <span>{item.url}</span>
                  </div>
                </div>

                <span className="font-mono-code text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {item.id}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {item.description || 'No description specified.'}
              </p>
            </div>

            {/* Footer Stats & Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-medium text-[11px]">
                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded font-semibold">
                  {item.count} guides (stored)
                </span>
                {item.calculatedCount !== undefined && item.calculatedCount !== item.count && (
                  <span className="text-[10px] text-slate-400 font-mono-code" title="Calculated from actual guide/product files">
                    (calc: {item.calculatedCount})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEditModal(item)}
                  className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                  title="Edit Interest"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteInterest(item.id)}
                  disabled={deletingId === item.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  title="Delete Interest"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      <InterestEditorModal
        isOpen={isEditorModalOpen}
        interest={editingInterest}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveInterest}
      />

      {/* Backups Modal */}
      <InterestBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestore={handleRestoreFromBackup}
      />
    </div>
  );
};

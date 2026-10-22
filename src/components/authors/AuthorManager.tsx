import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Plus,
  Edit3,
  Trash2,
  History,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  BookOpen,
  FileText
} from 'lucide-react';
import { AuthorItem, AuthorDeleteWarning } from '../../types/authors';
import { AuthorEditorModal } from './AuthorEditorModal';
import { AuthorBackupsModal } from './AuthorBackupsModal';

export const AuthorManager: React.FC = () => {
  const [authors, setAuthors] = useState<AuthorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAuthor, setEditingAuthor] = useState<AuthorItem | null>(null);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);
  
  const [deleteWarning, setDeleteWarning] = useState<AuthorDeleteWarning | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const fetchAuthors = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/authors');
      const data = await res.json();
      if (data.success) {
        setAuthors(data.authors || []);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to load authors.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error connecting to server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthors();
  }, [fetchAuthors]);

  const handleOpenAddModal = () => {
    setEditingAuthor(null);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (author: AuthorItem) => {
    setEditingAuthor(author);
    setIsEditorModalOpen(true);
  };

  const handleSaveAuthor = async (authorData: Partial<AuthorItem>, originalId?: string) => {
    setStatusMsg(null);
    const isEdit = !!originalId;
    const url = isEdit ? `/api/authors/${originalId}` : '/api/authors';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authorData)
    });
    const data = await res.json();
    if (data.success) {
      setStatusMsg({
        type: 'success',
        text: `Author "${authorData.name}" saved successfully. Backup created.`
      });
      fetchAuthors();
    } else {
      throw new Error(data.error || 'Failed to save author.');
    }
  };

  const handleDeleteAuthor = async (id: string, force = false) => {
    setDeletingId(id);
    setStatusMsg(null);
    try {
      const url = `/api/authors/${id}${force ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();

      if (!data.success && data.warning) {
        // Author is referenced!
        setDeleteWarning({
          authorId: id,
          authorName: authors.find(a => a.id === id)?.name || id,
          hasReferences: true,
          guideReferences: data.guideReferences || [],
          articleReferences: data.articleReferences || [],
          count: data.count || 0
        });
      } else if (data.success) {
        setStatusMsg({
          type: 'success',
          text: `Author deleted successfully. Backup saved as ${data.backupFile}.`
        });
        setDeleteWarning(null);
        fetchAuthors();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to delete author.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error deleting author.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestoreFromBackup = async (filename: string) => {
    const res = await fetch('/api/authors-backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupFilename: filename })
    });
    const data = await res.json();
    if (data.success) {
      setStatusMsg({ type: 'success', text: `Restored authors.yml from "${filename}".` });
      fetchAuthors();
    } else {
      throw new Error(data.error || 'Failed to restore backup.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-sm font-medium">Loading _data/authors.yml directory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header / Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="font-serif-display text-xl font-bold text-slate-900">
                Author & Staff Manager
              </h2>
              <span className="font-mono-code text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                _data/authors.yml
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage editorial staff, Lead Researchers, bios, roles, and article/guide attributions.
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
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Author</span>
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

      {/* Delete Reference Warning Modal */}
      {deleteWarning && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                Reference Safety Warning: Author "{deleteWarning.authorName}"
              </h4>
              <p className="text-xs text-amber-800 mt-1">
                Cannot delete author safely because they are currently referenced in {deleteWarning.count} publication item(s):
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-amber-200/80 max-h-40 overflow-y-auto">
            {deleteWarning.guideReferences.map((ref, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-700">
                <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="font-medium truncate">{ref.title}</span>
                <span className="text-[10px] text-slate-400 font-mono-code">({ref.slug})</span>
              </div>
            ))}
            {deleteWarning.articleReferences.map((ref, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-700">
                <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-medium truncate">{ref.title}</span>
                <span className="text-[10px] text-slate-400 font-mono-code">({ref.slug})</span>
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
              onClick={() => handleDeleteAuthor(deleteWarning.authorId, true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Force Delete Anyway</span>
            </button>
          </div>
        </div>
      )}

      {/* Author Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {authors.map((author) => (
          <div
            key={author.id}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4 text-left"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-emerald-100 to-teal-100 text-emerald-800 font-serif font-bold text-lg flex items-center justify-center border border-emerald-200 shrink-0">
                    {author.name ? author.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div>
                    <h3 className="font-serif-display text-base font-bold text-slate-900 leading-snug">
                      {author.name}
                    </h3>
                    <div className="text-xs text-emerald-700 font-medium mt-0.5">
                      {author.role}
                    </div>
                  </div>
                </div>

                <span className="font-mono-code text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {author.id}
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {author.bio || 'No bio specified.'}
              </p>
            </div>

            {/* Footer Stats & Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                <span className="flex items-center gap-1" title="Gift Guides by this author">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                  <span className="font-semibold text-slate-700">{author.guideCount || 0}</span> guides
                </span>
                <span>•</span>
                <span className="flex items-center gap-1" title="Articles by this author">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-semibold text-slate-700">{author.articleCount || 0}</span> articles
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenEditModal(author)}
                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                  title="Edit Author"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteAuthor(author.id)}
                  disabled={deletingId === author.id}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  title="Delete Author"
                >
                  {deletingId === author.id ? (
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
      <AuthorEditorModal
        isOpen={isEditorModalOpen}
        author={editingAuthor}
        onClose={() => setIsEditorModalOpen(false)}
        onSave={handleSaveAuthor}
      />

      {/* Backups Modal */}
      <AuthorBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onRestore={handleRestoreFromBackup}
      />
    </div>
  );
};

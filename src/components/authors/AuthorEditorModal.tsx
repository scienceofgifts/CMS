import React, { useState, useEffect } from 'react';
import { X, UserCheck, Save, Loader2, AlertCircle } from 'lucide-react';
import { AuthorItem } from '../../types/authors';
import { useModalEscape } from '../../hooks/useModalEscape';

interface AuthorEditorModalProps {
  isOpen: boolean;
  author: AuthorItem | null; // null for add mode
  onClose: () => void;
  onSave: (authorData: Partial<AuthorItem>, originalId?: string) => Promise<void>;
}

export const AuthorEditorModal: React.FC<AuthorEditorModalProps> = ({
  isOpen,
  author,
  onClose,
  onSave
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      if (author) {
        setId(author.id || '');
        setName(author.name || '');
        setRole(author.role || '');
        setBio(author.bio || '');
        setAvatarSeed(author.avatarSeed || author.id || '');
      } else {
        setId('');
        setName('');
        setRole('Editor & Researcher');
        setBio('');
        setAvatarSeed('');
      }
      setError(null);
    }
  }, [isOpen, author]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setError('Author ID / Key is required.');
      return;
    }
    if (!name.trim()) {
      setError('Author Name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
          name: name.trim(),
          role: role.trim(),
          bio: bio.trim(),
          avatarSeed: avatarSeed.trim() || id.trim()
        },
        author?.id
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save author.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-semibold text-slate-900">
                {author ? `Edit Author: ${author.name}` : 'Add New Author'}
              </h3>
              <p className="text-xs text-slate-500">
                _data/authors.yml entry fields
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Author ID / Slug Key *
            </label>
            <input
              type="text"
              value={id}
              disabled={!!author} // Don't allow key renaming directly on edit, or handle safely
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. clara, julian, elena"
              className="w-full px-3 py-2 text-xs font-mono-code border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Clara Vance"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Editorial Role / Title
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Editor-in-Chief & Lead Researcher"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Avatar Seed Identifier
            </label>
            <input
              type="text"
              value={avatarSeed}
              onChange={(e) => setAvatarSeed(e.target.value)}
              placeholder="e.g. clara (used for consistent avatar generation)"
              className="w-full px-3 py-2 text-xs font-mono-code border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bio / Author Background Prose
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Detailed editorial background bio..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Author'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

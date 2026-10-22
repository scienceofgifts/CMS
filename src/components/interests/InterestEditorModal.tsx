import React, { useState, useEffect } from 'react';
import { X, Tag, Save, Loader2, AlertCircle } from 'lucide-react';
import { InterestItem } from '../../types/interests';
import { useModalEscape } from '../../hooks/useModalEscape';

interface InterestEditorModalProps {
  isOpen: boolean;
  interest: InterestItem | null; // null for add mode
  onClose: () => void;
  onSave: (interestData: Partial<InterestItem>, originalId?: string) => Promise<void>;
}

export const InterestEditorModal: React.FC<InterestEditorModalProps> = ({
  isOpen,
  interest,
  onClose,
  onSave
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [count, setCount] = useState<number>(0);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      if (interest) {
        setId(interest.id || '');
        setName(interest.name || '');
        setCount(interest.count !== undefined ? interest.count : interest.calculatedCount || 0);
        setUrl(interest.url || '');
        setDescription(interest.description || '');
      } else {
        setId('');
        setName('');
        setCount(0);
        setUrl('');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, interest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setError('Interest ID is required.');
      return;
    }
    if (!name.trim()) {
      setError('Interest Name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      await onSave(
        {
          id: cleanId,
          name: name.trim(),
          count: Number(count) || 0,
          url: url.trim() || `/${cleanId}-gifts/`,
          description: description.trim()
        },
        interest?.id
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save interest.');
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
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-semibold text-slate-900">
                {interest ? `Edit Interest: ${interest.name}` : 'Add New Interest Category'}
              </h3>
              <p className="text-xs text-slate-500">
                _data/interests.yml taxonomy entry
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
              Interest Taxonomy ID *
            </label>
            <input
              type="text"
              value={id}
              disabled={!!interest}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. history, books, science, travel"
              className="w-full px-3 py-2 text-xs font-mono-code border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Books & Literature"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Guide Count (`count`)
              </label>
              <input
                type="number"
                min={0}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Rendered on homepage as &quot;{count} guides&quot;
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category Target URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g. /book-lovers-gifts/"
                className="w-full px-3 py-2 text-xs font-mono-code border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Interest Description / Curation Deck
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Typographic bookends, personal library embossers, reading lamps..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Interest'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

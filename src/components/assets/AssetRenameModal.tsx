import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  BookOpen,
  ShoppingBag,
  Layers,
  ArrowRight,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { AssetItem } from '../../types/assets';
import { useModalEscape } from '../../hooks/useModalEscape';

interface AssetRenameModalProps {
  asset: AssetItem;
  isOpen: boolean;
  onClose: () => void;
  onRenameSuccess: (newFilename: string, message: string) => void;
}

export const AssetRenameModal: React.FC<AssetRenameModalProps> = ({
  asset,
  isOpen,
  onClose,
  onRenameSuccess
}) => {
  const [newBaseName, setNewBaseName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingExists, setIsCheckingExists] = useState(false);
  const [existsWarning, setExistsWarning] = useState(false);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen && asset) {
      setNewBaseName(asset.name);
      setError(null);
      setExistsWarning(false);
    }
  }, [isOpen, asset]);

  // Debounced conflict check when user types
  useEffect(() => {
    if (!newBaseName.trim()) {
      setExistsWarning(false);
      return;
    }

    const clean = newBaseName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    if (clean === asset.name) {
      setExistsWarning(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingExists(true);
      try {
        const candidateFilename = `${clean}${asset.ext}`;
        const res = await fetch('/api/assets/check-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: candidateFilename })
        });
        const data = await res.json();
        if (data.success && data.exists) {
          setExistsWarning(true);
        } else {
          setExistsWarning(false);
        }
      } catch {
        // Ignore check errors
      } finally {
        setIsCheckingExists(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [newBaseName, asset.name, asset.ext]);

  if (!isOpen) return null;

  const sanitizedPreview = newBaseName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-');

  const resultingFilename = sanitizedPreview ? `${sanitizedPreview}${asset.ext}` : '';
  const isSameName = sanitizedPreview === asset.name;
  const isInvalid = !sanitizedPreview || isSameName || existsWarning;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/assets/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldFilename: asset.filename,
          newFilename: sanitizedPreview
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onRenameSuccess(data.newFilename, data.message || `Asset renamed to ${data.newFilename}`);
        onClose();
      } else {
        setError(data.error || 'Failed to rename asset.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error executing rename.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-sm shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-[#99BFF9]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EEF5FF] text-[#2A548E] rounded-xs border border-[#99BFF9]/30">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-display text-lg text-[#1E232B] font-medium leading-tight">
                Rename &amp; Refactor Asset
              </h2>
              <p className="text-[11px] text-[#5A6270]">
                Safe rename with automatic content reference updates and derivative regeneration.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Current Asset Info */}
          <div className="p-3.5 bg-white border border-[#99BFF9]/25 rounded-xs space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#5A6270]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2A548E]">
                Current Asset
              </span>
              <span className="font-mono-code text-[11px] px-1.5 py-0.5 bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/20 rounded-xs">
                {asset.format}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono-code">
              <div>
                <span className="text-[10px] text-[#5A6270] block">Current Filename:</span>
                <span className="font-semibold text-[#1E232B] break-all">{asset.filename}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#5A6270] block">Relative Path:</span>
                <span className="text-[#5A6270] break-all">{asset.relativePath}</span>
              </div>
            </div>
          </div>

          {/* New Filename Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#1E232B] block">
              New Filename <span className="text-rose-600">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="text"
                value={newBaseName}
                onChange={(e) => setNewBaseName(e.target.value)}
                placeholder="e.g. victorian-brass-telescope"
                disabled={isSubmitting}
                className="flex-1 px-3.5 py-2.5 bg-white border border-[#99BFF9]/50 text-xs font-mono-code text-[#1E232B] rounded-l-xs focus:outline-none focus:border-[#2A548E] focus:ring-1 focus:ring-[#2A548E]"
                autoFocus
              />
              <span className="px-3.5 py-2.5 bg-stone-100 border border-l-0 border-[#99BFF9]/50 text-xs font-mono-code text-[#5A6270] rounded-r-xs select-none">
                {asset.ext}
              </span>
            </div>

            {/* Live Result & Warnings */}
            <div className="text-xs space-y-1">
              {sanitizedPreview && (
                <p className="text-[11px] text-[#5A6270] font-mono-code">
                  Resulting file: <strong className="text-[#2A548E]">{resultingFilename}</strong>
                  {isCheckingExists && <span className="ml-2 text-stone-400 animate-pulse">(checking availability...)</span>}
                </p>
              )}

              {isSameName && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Please enter a new name different from the current filename.
                </p>
              )}

              {existsWarning && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] rounded-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    A file named <strong>"{resultingFilename}"</strong> already exists in the asset library. Please choose a unique name.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Referenced Content Section */}
          <div className="bg-white border border-[#99BFF9]/25 p-4 rounded-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#226E56]" />
                Authoritative Content References ({asset.usedBy.length})
              </h3>
              <span className="text-[10px] font-mono-code text-[#226E56] font-semibold bg-[#E8F8F1] px-1.5 py-0.5 rounded-xs border border-[#226E56]/20">
                Auto-updated
              </span>
            </div>

            {asset.usedBy.length === 0 ? (
              <p className="text-xs text-[#5A6270] italic">
                No active references found in Products, Gift Guides, or Articles. Only the asset file and derivatives will be renamed.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {asset.usedBy.map((ref, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {ref.type === 'guide' && <BookOpen className="w-3.5 h-3.5 text-[#2A548E] shrink-0" />}
                      {ref.type === 'article' && <FileText className="w-3.5 h-3.5 text-[#226E56] shrink-0" />}
                      {ref.type === 'product' && <ShoppingBag className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                      {ref.type === 'page' && <Layers className="w-3.5 h-3.5 text-indigo-700 shrink-0" />}
                      <span className="truncate font-medium text-[#1E232B]">{ref.title}</span>
                    </div>
                    <span className="text-[10px] font-mono-code text-[#5A6270] px-1.5 py-0.5 bg-white border border-[#99BFF9]/20 rounded-xs shrink-0">
                      {ref.file}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="p-3 bg-[#EEF5FF]/60 border border-[#99BFF9]/30 rounded-xs text-[11px] text-[#1B365D] space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2A548E]" />
              Safe Refactoring Assurance
            </div>
            <p className="text-[#5A6270] leading-relaxed">
              Pre-mutation backups will be saved to <code className="font-mono-code bg-white px-1 py-0.5 border border-[#99BFF9]/20">editor-backups/</code>. The source image and all WebP derivatives will be renamed, and all {asset.usedBy.length} content references will be updated atomically.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-[#99BFF9]/20 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInvalid || isSubmitting}
              className="px-5 py-2 bg-[#2A548E] hover:bg-[#1B365D] disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Refactoring...</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Rename &amp; Update References</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';
import { AssetItem } from '../../types/assets';
import { useModalEscape } from '../../hooks/useModalEscape';

interface AssetDeleteModalProps {
  asset: AssetItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (asset: AssetItem, cleanupDerivatives: boolean) => Promise<void>;
}

export const AssetDeleteModal: React.FC<AssetDeleteModalProps> = ({
  asset,
  isOpen,
  onClose,
  onConfirmDelete
}) => {
  const [cleanupDerivatives, setCleanupDerivatives] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  if (!isOpen || !asset) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(asset, cleanupDerivatives);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  const hasReferences = asset.usedBy && asset.usedBy.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FAF9F6] border border-red-200 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="font-serif-display text-lg font-semibold text-[#1E232B]">
              Confirm Asset Deletion
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-[#5A6270]">
          {/* Asset Preview Card */}
          <div className="flex items-center gap-4 p-3 bg-white border border-[#99BFF9]/30 rounded-xs">
            <div className="w-16 h-16 bg-stone-100 rounded-xs overflow-hidden border border-stone-200 shrink-0 flex items-center justify-center">
              <img
                src={asset.publicUrl}
                alt={asset.filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (asset.derivatives.thumb?.url) {
                    (e.target as HTMLImageElement).src = asset.derivatives.thumb.url;
                  }
                }}
              />
            </div>
            <div className="truncate space-y-0.5">
              <div className="font-semibold text-[#1E232B] truncate text-sm">
                {asset.filename}
              </div>
              <div className="font-mono-code text-[11px] text-[#2A548E] truncate">
                {asset.relativePath}
              </div>
              <div className="text-[11px] text-[#5A6270]">
                {asset.format} · {asset.formattedSize}
                {asset.dimensions ? ` · ${asset.dimensions.width}×${asset.dimensions.height}px` : ''}
              </div>
            </div>
          </div>

          {/* Usage Warning */}
          {hasReferences ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xs text-red-800 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Warning: Asset is currently referenced by {asset.usedBy.length} items!</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Deleting this file may cause broken images on the following pages:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {asset.usedBy.map((ref, idx) => (
                  <li key={idx}>
                    <strong className="capitalize">{ref.type}:</strong> {ref.title} ({ref.file})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xs text-amber-800 text-[11px] leading-relaxed">
              This asset is not currently referenced in any detected guides, articles, or products.
            </div>
          )}

          {/* Backup Notice */}
          <div className="p-3 bg-[#EBF3ED] border border-[#226E56]/20 rounded-xs text-[#226E56] text-[11px] leading-relaxed">
            <strong>Automatic Safety Backup:</strong> Before deletion, an exact copy of the source asset will be saved to <code className="font-mono-code bg-white px-1">editor-backups/assets/</code> and excluded from public Jekyll builds.
          </div>

          {/* Derivative Cleanup Checkbox */}
          {asset.format !== 'SVG' && (
            <label className="flex items-center gap-2 pt-1 text-xs text-[#1E232B] cursor-pointer">
              <input
                type="checkbox"
                checked={cleanupDerivatives}
                onChange={(e) => setCleanupDerivatives(e.target.checked)}
                className="rounded border-[#99BFF9]/40 text-[#2A548E] focus:ring-[#2A548E]"
              />
              <span>Also delete associated WebP and thumbnail derivatives</span>
            </label>
          )}

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#99BFF9]/20 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-red-700 hover:bg-red-800 text-white rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

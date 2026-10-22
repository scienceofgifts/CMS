import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { GuideSummary } from '../../types/guide';
import { useModalEscape } from '../../hooks/useModalEscape';

interface DeleteGuideModalProps {
  guide: GuideSummary | null;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteGuideModal: React.FC<DeleteGuideModalProps> = ({
  guide,
  isOpen,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  useModalEscape(isOpen, onCancel);

  if (!isOpen || !guide) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E232B]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-[#99BFF9]/40 w-full max-w-md p-6 space-y-5 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
              Delete Gift Guide?
            </h3>
            <p className="text-xs text-[#5A6270] leading-relaxed">
              This will remove this guide file from <code className="font-mono bg-stone-100 px-1">_guides/{guide.slug}.md</code>.
              An automatic snapshot backup will be created in <code className="font-mono bg-stone-100 px-1">editor-backups/guides/</code>.
            </p>
          </div>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
          <div className="font-semibold text-[#1E232B]">{guide.title}</div>
          <div className="font-mono-code text-[11px] text-[#2A548E]">Slug: {guide.slug}</div>
          <div className="text-[11px] text-[#5A6270]">
            Category: {guide.category} · Products: {guide.productCount}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

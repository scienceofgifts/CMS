import React from 'react';
import { AlertCircle, Save, Trash2, ArrowLeft } from 'lucide-react';
import { useModalEscape } from '../../hooks/useModalEscape';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  guideTitle: string;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  guideTitle,
  isSaving,
  onSave,
  onDiscard,
  onCancel
}) => {
  useModalEscape(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E232B]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-[#99BFF9]/40 w-full max-w-md p-6 space-y-5 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
              You Have Unsaved Changes
            </h3>
            <p className="text-xs text-[#5A6270] leading-relaxed">
              You have made modifications to <strong className="text-[#1E232B] font-semibold">{guideTitle || 'this guide'}</strong> that have not been saved to disk yet.
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-500 bg-[#FAF9F6] p-3 border border-[#99BFF9]/20">
          What would you like to do before navigating away?
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Stay on Page
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold bg-[#2A548E] text-white hover:bg-[#1E3E6B] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save & Exit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

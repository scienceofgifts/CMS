import React from 'react';
import { AlertCircle, Save, Trash2, X } from 'lucide-react';
import { useModalEscape } from '../../hooks/useModalEscape';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
}) => {
  useModalEscape(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white border-2 border-[#99BFF9] max-w-md w-full p-6 space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 rounded-sm">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 cursor-pointer p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
              Unsaved Changes Detected
            </h3>
            <p className="text-xs text-[#5A6270] leading-relaxed">
              You have made modifications to this product that have not been saved yet. What would you like to do?
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer text-center"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard Changes</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};

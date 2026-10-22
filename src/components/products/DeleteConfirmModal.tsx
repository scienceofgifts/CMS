import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Product } from '../../types/product';
import { useModalEscape } from '../../hooks/useModalEscape';

interface DeleteConfirmModalProps {
  product: Product | null;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  product,
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  useModalEscape(isOpen, onCancel);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white border-2 border-rose-300 max-w-md w-full p-6 space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 cursor-pointer p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
              Delete Product from Catalog?
            </h3>
            <p className="text-xs text-[#5A6270] leading-relaxed">
              This will remove this product from <code className="font-mono bg-stone-100 px-1">_data/products.yml</code>.
              An automatic snapshot backup will be created in <code className="font-mono bg-stone-100 px-1">editor-backups/products/</code>.
            </p>
          </div>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200 text-xs space-y-1">
          <div className="font-semibold text-[#1E232B]">{product.title}</div>
          <div className="font-mono-code text-[11px] text-[#2A548E]">ID: {product.id}</div>
          <div className="text-[11px] text-[#5A6270]">Vendor: {product.vendor} · Price: {product.price}</div>
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
            className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Product'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

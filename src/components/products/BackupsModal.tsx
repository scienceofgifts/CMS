import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, CheckCircle2, Clock, HardDrive, AlertCircle } from 'lucide-react';
import { ProductBackup } from '../../types/product';
import { useModalEscape } from '../../hooks/useModalEscape';

interface BackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const BackupsModal: React.FC<BackupsModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const [backups, setBackups] = useState<ProductBackup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  const fetchBackups = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/products-backups');
      const data = await res.json();
      if (res.ok && data.success) {
        setBackups(data.backups || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore products.yml from backup "${filename}"?\nA safety backup of your current catalog will be created before restoring.`)) {
      return;
    }

    setRestoringFilename(filename);
    setMessage(null);

    try {
      const res = await fetch('/api/products-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ text: data.message });
        setTimeout(() => {
          onRestoreSuccess();
          onClose();
        }, 1200);
      } else {
        setMessage({ text: data.error || 'Failed to restore snapshot.', error: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error during restore.', error: true });
    } finally {
      setRestoringFilename(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white border border-[#99BFF9]/40 max-w-2xl w-full p-6 space-y-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#99BFF9]/20 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Catalog Snapshot Backups
              </h3>
              <p className="text-xs text-[#5A6270]">
                Every create, edit, and delete action creates an automatic snapshot in <code className="font-mono text-[11px] bg-stone-100 px-1">editor-backups/products/</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-3 text-xs flex items-center gap-2 border ${message.error ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-[#E8F8F1] border-[#226E56]/30 text-[#154D3B]'}`}>
            {message.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#5A6270] font-mono-code">
              Loading backup history...
            </div>
          ) : backups.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#5A6270] space-y-2">
              <HardDrive className="w-8 h-8 text-stone-300 mx-auto" />
              <p>No snapshots found yet.</p>
              <p className="text-[11px] text-stone-400">
                Snapshots are automatically generated as soon as you create, update, or delete products.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {backups.map((b) => (
                <div key={b.filename} className="py-3 px-3 hover:bg-[#FAF9F6] transition-colors flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-mono-code text-[11px] text-[#2A548E] font-medium truncate">
                      {b.filename}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#5A6270]/60" />
                        {new Date(b.timestamp).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span>{b.productCount} products</span>
                      <span>·</span>
                      <span>{(b.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(b.filename)}
                    disabled={restoringFilename !== null}
                    className="px-3 py-1.5 bg-white border border-[#2A548E] text-[#2A548E] hover:bg-[#EEF5FF] text-[11px] font-semibold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                  >
                    <RotateCcw className={`w-3 h-3 ${restoringFilename === b.filename ? 'animate-spin' : ''}`} />
                    <span>{restoringFilename === b.filename ? 'Restoring...' : 'Rollback'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#99BFF9]/20 flex items-center justify-between text-xs text-[#5A6270] shrink-0">
          <span>{backups.length} snapshots recorded</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#1E232B] text-xs font-medium rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

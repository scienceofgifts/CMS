import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  RotateCcw,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { GiftFinderBackupItem } from '../../types/giftFinder';
import { useModalEscape } from '../../hooks/useModalEscape';

interface GiftFinderBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete: () => void;
}

export function GiftFinderBackupsModal({
  isOpen,
  onClose,
  onRestoreComplete
}: GiftFinderBackupsModalProps) {
  const [backups, setBackups] = useState<GiftFinderBackupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  const fetchBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gift-finder-backups');
      const data = await res.json();
      if (res.ok && data.success) {
        setBackups(data.backups || []);
      } else {
        setError(data.error || 'Failed to fetch backups.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching backups.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore Gift Finder configuration from "${filename}"? Current changes will be overwritten.`)) {
      return;
    }

    setRestoringFilename(filename);
    setError(null);
    setRestoreSuccess(null);

    try {
      const res = await fetch('/api/gift-finder-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFilename: filename })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRestoreSuccess(`Restored successfully from ${filename}.`);
        setTimeout(() => {
          onRestoreComplete();
          onClose();
        }, 1200);
      } else {
        setError(data.error || 'Failed to restore backup.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during restore.');
    } finally {
      setRestoringFilename(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#99BFF9]/30 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#E8F8F1] text-[#226E56]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">
                Gift Finder Revision History
              </h3>
              <p className="text-xs text-[#5A6270]">
                Automatic snapshot backups before editorial updates
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-[#EEF5FF] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {restoreSuccess && (
            <div className="p-3 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
              <span>{restoreSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#5A6270] flex flex-col items-center gap-2 font-mono-code">
              <Loader2 className="w-6 h-6 text-[#2A548E] animate-spin" />
              Loading snapshot backups...
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5A6270] space-y-2">
              <Sparkles className="w-8 h-8 text-[#99BFF9] mx-auto" />
              <p className="font-serif-display text-sm text-[#1E232B]">No backups recorded yet</p>
              <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
                Backups are created automatically whenever you save changes to the Gift Finder questionnaire.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map(item => (
                <div
                  key={item.filename}
                  className="p-3.5 bg-white border border-[#99BFF9]/25 hover:border-[#99BFF9] transition-all rounded flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono-code font-semibold text-[#1E232B] truncate">
                        {item.filename}
                      </span>
                      <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-medium text-[10px] rounded uppercase font-mono-code shrink-0">
                        {item.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#2A548E]" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className="font-mono-code">{(item.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(item.filename)}
                    disabled={restoringFilename === item.filename}
                    className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white text-xs font-semibold rounded transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {restoringFilename === item.filename ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF9F6] border-t border-[#99BFF9]/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 hover:bg-white text-xs font-medium text-[#1E232B] rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

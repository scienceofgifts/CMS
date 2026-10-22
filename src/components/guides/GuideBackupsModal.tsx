import React, { useState, useEffect } from 'react';
import { History, RotateCcw, X, CheckCircle2, Clock, HardDrive, AlertCircle } from 'lucide-react';
import { GuideBackup } from '../../types/guide';
import { useModalEscape } from '../../hooks/useModalEscape';

interface GuideBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: (slug: string) => void;
  activeSlug?: string;
}

export const GuideBackupsModal: React.FC<GuideBackupsModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
  activeSlug
}) => {
  const [backups, setBackups] = useState<GuideBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useModalEscape(isOpen, onClose);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guides-backups');
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch guide backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
      setMessage(null);
    }
  }, [isOpen]);

  const handleRestore = async (backup: GuideBackup) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore "${backup.slug}" from snapshot "${backup.filename}"?\n\nA safety backup of the current file will be created before restoring.`
    );
    if (!confirmed) return;

    setRestoring(backup.filename);
    setMessage(null);
    try {
      const res = await fetch('/api/guides-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backup.filename })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: data.message });
        await fetchBackups();
        if (onRestoreSuccess) {
          onRestoreSuccess(backup.slug);
        }
      } else {
        setMessage({ text: data.error || 'Restore failed', error: true });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Network error during restore', error: true });
    } finally {
      setRestoring(null);
    }
  };

  if (!isOpen) return null;

  const displayBackups = activeSlug
    ? backups.filter(b => b.slug === activeSlug)
    : backups;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E232B]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-[#99BFF9]/40 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#99BFF9]/20 p-5 bg-[#FAF9F6] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">
                Gift Guide Snapshot Backups
              </h3>
              <p className="text-xs text-[#5A6270]">
                Every create, edit, and delete action creates an automatic snapshot in <code className="font-mono text-[11px] bg-stone-100 px-1">editor-backups/guides/</code>
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
          <div className={`p-3 text-xs flex items-center gap-2 border mx-4 mt-4 shrink-0 ${message.error ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-[#E8F8F1] border-[#226E56]/30 text-[#154D3B]'}`}>
            {message.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* List of Backups */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#5A6270] space-y-2">
              <div className="animate-spin w-5 h-5 border-2 border-[#2A548E] border-t-transparent rounded-full mx-auto" />
              <p>Scanning editor-backups/guides/...</p>
            </div>
          ) : displayBackups.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#5A6270] bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-2">
              <HardDrive className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-medium text-[#1E232B]">No snapshot backups found</p>
              <p>Snapshots are automatically created whenever guides are saved or deleted.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayBackups.map((b) => (
                <div
                  key={b.filename}
                  className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/25 hover:border-[#2A548E] transition-all flex items-center justify-between gap-3 text-xs group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-code font-semibold text-[#1E232B] truncate max-w-md">
                        {b.filename}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono-code bg-[#EEF5FF] text-[#2A548E] rounded">
                        {b.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(b.timestamp).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span>{Math.round(b.size / 1024)} KB</span>
                      <span>·</span>
                      <span className="font-mono-code text-[#226E56]">Guide: {b.slug}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(b)}
                    disabled={restoring === b.filename}
                    className="shrink-0 px-3 py-1.5 bg-white border border-[#99BFF9]/40 hover:border-[#2A548E] hover:bg-[#EEF5FF] text-[#2A548E] text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{restoring === b.filename ? 'Restoring...' : 'Rollback'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#99BFF9]/20 p-3 bg-[#FAF9F6] flex items-center justify-between text-xs text-[#5A6270] shrink-0">
          <span>{displayBackups.length} snapshots recorded</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-stone-200 text-[#5A6270] hover:text-[#1E232B] transition-colors cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

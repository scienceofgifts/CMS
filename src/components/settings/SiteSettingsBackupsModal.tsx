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
import { SiteSettingsBackupItem } from '../../types/siteSettings';
import { useModalEscape } from '../../hooks/useModalEscape';

interface SiteSettingsBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreComplete: () => void;
}

export function SiteSettingsBackupsModal({
  isOpen,
  onClose,
  onRestoreComplete
}: SiteSettingsBackupsModalProps) {
  const [backups, setBackups] = useState<SiteSettingsBackupItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
      const res = await fetch('/api/site-settings-backups');
      const data = await res.json();
      if (res.ok && data.success) {
        setBackups(data.backups || []);
      } else {
        setError(data.error || 'Failed to fetch revision history.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching backups.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backupFilename: string) => {
    if (!window.confirm(`Are you sure you want to restore _config.yml from "${backupFilename}"? Current un-saved edits will be overwritten.`)) {
      return;
    }

    setRestoring(backupFilename);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/site-settings-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFilename })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(`Restored _config.yml successfully from backup "${backupFilename}".`);
        setTimeout(() => {
          onRestoreComplete();
          onClose();
        }, 1200);
      } else {
        setError(data.error || 'Failed to restore backup snapshot.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during restore.');
    } finally {
      setRestoring(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#99BFF9]/40 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 bg-[#EEF5FF]/80 border-b border-[#99BFF9]/25 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white border border-[#99BFF9]/30 text-[#2A548E]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">
                _config.yml Revision History
              </h3>
              <p className="text-xs text-[#5A6270]">
                Automatic snapshots saved before every configuration update
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {successMsg && (
            <div className="p-3 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-medium rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-[#2A548E] animate-spin" />
              <span>Scanning settings backup directory...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5A6270] border border-dashed border-stone-200 rounded-lg p-6 space-y-2">
              <Sparkles className="w-6 h-6 text-[#99BFF9] mx-auto" />
              <p className="font-medium text-[#1E232B]">No backups recorded yet</p>
              <p>An automatic snapshot of _config.yml will be created every time you save settings changes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((item) => (
                <div
                  key={item.filename}
                  className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono-code font-bold text-[#1E232B]">
                      <span>{item.filename}</span>
                      <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] text-[10px] rounded uppercase font-semibold">
                        {item.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#5A6270] font-mono-code">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#2A548E]" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span>{(item.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(item.filename)}
                    disabled={restoring === item.filename}
                    className="px-3.5 py-2 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white font-semibold text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {restoring === item.filename ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Restore Snapshot</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAF9F6] border-t border-[#99BFF9]/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-xs rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

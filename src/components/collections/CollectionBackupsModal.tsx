import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  RotateCcw,
  Clock,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { CollectionBackupItem } from '../../types/collections';
import { useModalEscape } from '../../hooks/useModalEscape';

interface CollectionBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const CollectionBackupsModal: React.FC<CollectionBackupsModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess
}) => {
  const [backups, setBackups] = useState<CollectionBackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      loadBackups();
    }
  }, [isOpen]);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/collections-backups');
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      } else {
        setError(data.error || 'Failed to load collections backups.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching collections backups.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (backup: CollectionBackupItem) => {
    if (!window.confirm(`Are you sure you want to restore collections.yml from ${new Date(backup.timestamp).toLocaleString()}? Current unsaved changes will be overwritten.`)) {
      return;
    }

    setRestoringFilename(backup.filename);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/collections-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backup.filename })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Successfully restored collections.yml! Reloading workspace...');
        setTimeout(() => {
          onRestoreSuccess();
        }, 1200);
      } else {
        setError(data.error || 'Restore failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during restore.');
    } finally {
      setRestoringFilename(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#99BFF9]/40 w-full max-w-2xl rounded-sm shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-[#EEF5FF] border-b border-[#99BFF9]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#2A548E]" />
            <div>
              <h3 className="font-serif-display text-lg text-[#1E232B] font-normal">
                collections.yml Snapshot History
              </h3>
              <p className="text-xs text-[#5A6270]">
                Automatic timestamped backups stored safely in <code className="font-mono-code text-[#2A548E]">editor-backups/collections/</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#99BFF9]/20 rounded-xs text-[#5A6270] hover:text-[#1E232B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#5A6270] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#2A548E]" />
              <span>Loading snapshot backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5A6270] space-y-2">
              <History className="w-8 h-8 text-stone-300 mx-auto" />
              <p>No historical snapshots found for collections.yml yet.</p>
              <p className="text-[11px] text-stone-400">Backups are created automatically before every save or update.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {backups.map((backup) => (
                <div
                  key={backup.filename}
                  className="p-3.5 bg-[#FAF9F6] border border-[#99BFF9]/25 hover:border-[#2A548E]/40 rounded-xs flex items-center justify-between transition-colors gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-[#2A548E] shrink-0" />
                      <span className="font-mono-code text-xs text-[#1E232B] font-semibold truncate">
                        {backup.filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#2A548E]" />
                        {new Date(backup.timestamp).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span className="uppercase font-semibold text-[#154D3B]">
                        Action: {backup.action}
                      </span>
                      <span>•</span>
                      <span>{(backup.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(backup)}
                    disabled={restoringFilename === backup.filename}
                    className="px-3 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {restoringFilename === backup.filename ? (
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

        {/* Modal Footer */}
        <div className="p-3 bg-[#FAF9F6] border-t border-[#99BFF9]/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

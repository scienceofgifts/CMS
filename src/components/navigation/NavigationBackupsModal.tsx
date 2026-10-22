import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  RotateCcw,
  Clock,
  Compass,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { NavigationBackupItem } from '../../types/navigation';
import { useModalEscape } from '../../hooks/useModalEscape';

interface NavigationBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (filename: string) => Promise<void>;
}

export const NavigationBackupsModal: React.FC<NavigationBackupsModalProps> = ({
  isOpen,
  onClose,
  onRestore
}) => {
  const [backups, setBackups] = useState<NavigationBackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    } else {
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const fetchBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/navigation-backups');
      const data = await res.json();
      if (data.success) {
        setBackups(data.backups || []);
      } else {
        setError(data.error || 'Failed to list navigation backups.');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore navigation.yml from backup "${filename}"? Current unsaved changes will be overwritten.`)) {
      return;
    }
    setRestoringFilename(filename);
    setError(null);
    setSuccessMsg(null);
    try {
      await onRestore(filename);
      setSuccessMsg(`Successfully restored navigation.yml from "${filename}".`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Restore failed.');
    } finally {
      setRestoringFilename(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-semibold text-slate-900">
                Navigation Version History
              </h3>
              <p className="text-xs text-slate-500">
                Safe atomic snapshot backups from editor-backups/navigation/
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Loading navigation backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <History className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No snapshot backups found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Backups are automatically generated in editor-backups/navigation/ every time you save changes to navigation.yml.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
              {backups.map((item) => (
                <div
                  key={item.filename}
                  className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-code text-xs font-semibold text-slate-800 truncate">
                        {item.filename}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider rounded">
                        {item.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{(item.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestoreClick(item.filename)}
                    disabled={restoringFilename === item.filename}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
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
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

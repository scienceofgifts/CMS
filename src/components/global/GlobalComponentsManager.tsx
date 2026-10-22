import React, { useState, useEffect } from 'react';
import {
  Layers,
  Edit3,
  ExternalLink,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  Mail,
  Layout,
  Award,
  ShieldCheck,
  FileCode2
} from 'lucide-react';
import { GlobalComponentInfo, GlobalComponentKey } from '../../types/globalComponents';
import { GlobalComponentEditor } from './GlobalComponentEditor';

export function GlobalComponentsManager() {
  const [components, setComponents] = useState<GlobalComponentInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<GlobalComponentKey | null>(null);

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/global-components');
      const data = await res.json();
      if (res.ok && data.success) {
        setComponents(data.components || []);
      } else {
        setError(data.error || 'Failed to fetch global site components.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching global components.');
    } finally {
      setLoading(false);
    }
  };

  if (editingKey) {
    return (
      <GlobalComponentEditor
        componentKey={editingKey}
        onBack={() => {
          setEditingKey(null);
          fetchComponents();
        }}
      />
    );
  }

  const getComponentIcon = (key: GlobalComponentKey) => {
    if (key === 'newsletter') return <Mail className="w-5 h-5 text-[#226E56]" />;
    if (key === 'footer') return <Layout className="w-5 h-5 text-[#2A548E]" />;
    if (key === 'editors-pick') return <Award className="w-5 h-5 text-[#154D3B]" />;
    return <Layers className="w-5 h-5 text-[#2A548E]" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#226E56] font-mono-code uppercase">
          <Sparkles className="w-4 h-4 text-[#226E56]" />
          <span>Phase 9 Module</span>
        </div>
        <h1 className="font-serif-display text-3xl text-[#1E232B] font-normal">
          Global Site Components Editor
        </h1>
        <p className="text-sm text-[#5A6270] max-w-2xl leading-relaxed">
          Manage shared editorial components used across the entire Science of Gifts publication: Newsletter Banner, Global Footer, and Editor's Pick Highlight Card.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
          <span>Scanning shared _includes HTML templates...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {components.map((c) => (
            <div
              key={c.key}
              className="bg-white border border-[#99BFF9]/35 rounded-xl p-6 flex flex-col justify-between space-y-5 hover:border-[#2A548E] transition-all shadow-xs group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-[#EEF5FF]">
                    {getComponentIcon(c.key)}
                  </div>
                  <span className="px-2.5 py-1 bg-[#FAF9F6] border border-stone-200 text-[#2A548E] font-mono-code text-[11px] font-semibold rounded flex items-center gap-1">
                    <FileCode2 className="w-3 h-3" />
                    <span>{c.filename}</span>
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif-display text-xl text-[#1E232B] group-hover:text-[#2A548E] transition-colors font-medium">
                    {c.name}
                  </h3>
                  <p className="text-xs text-[#5A6270] line-clamp-3 leading-relaxed">
                    {c.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#99BFF9]/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#5A6270] text-[11px] font-mono-code">
                  <Clock className="w-3.5 h-3.5 text-[#2A548E]" />
                  <span>
                    {c.mtime ? new Date(c.mtime).toLocaleDateString() : 'Active'}
                  </span>
                </div>

                <button
                  onClick={() => setEditingKey(c.key)}
                  className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Component</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

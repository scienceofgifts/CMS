import React, { useState } from 'react';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import { ImportTargetType } from '../../types/import';

interface ImportPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filename: string, content: string, targetType?: ImportTargetType) => void;
}

export function ImportPasteModal({ isOpen, onClose, onSubmit }: ImportPasteModalProps) {
  const [filename, setFilename] = useState('legacy-post.md');
  const [targetType, setTargetType] = useState<ImportTargetType | 'auto'>('auto');
  const [content, setContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const finalFilename = filename.trim().endsWith('.md') || filename.trim().endsWith('.markdown')
      ? filename.trim()
      : `${filename.trim()}.md`;
    onSubmit(finalFilename, content, targetType === 'auto' ? undefined : targetType);
    setContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-[#99BFF9]/30 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#EEF5FF] text-[#2A548E] rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-medium text-[#1E232B]">
                Paste Legacy Markdown
              </h3>
              <p className="text-xs text-[#5A6270]">
                Paste raw Markdown with or without YAML front matter for Phase 1 analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A6270] mb-1.5 font-mono-code">
                Simulated Filename
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="historical-curiosities.md"
                required
                className="w-full px-3 py-2 bg-white border border-[#99BFF9]/40 rounded text-xs text-[#1E232B] font-mono-code focus:outline-none focus:border-[#2A548E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A6270] mb-1.5 font-mono-code">
                Target Type Override
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-[#99BFF9]/40 rounded text-xs text-[#1E232B] focus:outline-none focus:border-[#2A548E]"
              >
                <option value="auto">Auto-detect from content</option>
                <option value="guide">Gift Guide (_guides/)</option>
                <option value="article">Editorial Article (_articles/)</option>
                <option value="page">Static Page</option>
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-[260px]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A6270] mb-1.5 font-mono-code">
              Raw Markdown Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`---\ntitle: "The Best Gifts for History Enthusiasts"\nauthor: Julian Mercer\ndate: 2023-11-14\nupdatedDate: 2024-01-05\n---\n\n# The Best Gifts for History Enthusiasts\n\nContent here...`}
              required
              rows={12}
              className="w-full flex-1 p-3 bg-white border border-[#99BFF9]/40 rounded text-xs text-[#1E232B] font-mono-code focus:outline-none focus:border-[#2A548E] resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#99BFF9]/20">
            <span className="text-[11px] text-[#5A6270] italic">
              Phase 1 safety: Parsing occurs in-memory. No files are published or altered.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-100 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-4 py-2 bg-[#2A548E] hover:bg-[#1B365D] disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Parse &amp; Analyze</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Heading,
  List,
  Bold,
  Italic,
  Link,
  Quote,
  Eye,
  Columns,
  Code
} from 'lucide-react';

interface BodyEditorPaneProps {
  originalBody: string;
  draftBody: string;
  onChange: (newBody: string) => void;
  onRevertToOriginal: () => void;
}

export function BodyEditorPane({
  originalBody,
  draftBody,
  onChange,
  onRevertToOriginal
}: BodyEditorPaneProps) {
  const [viewMode, setViewMode] = useState<'editor' | 'source' | 'split'>('editor');

  const isModified = draftBody !== originalBody;

  // Body stats
  const words = draftBody.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const h1Count = (draftBody.match(/^#\s+.+$/gm) || []).length;
  const h2Count = (draftBody.match(/^##\s+.+$/gm) || []).length;
  const h3Count = (draftBody.match(/^###\s+.+$/gm) || []).length;

  const handleDemoteH1 = () => {
    const updated = draftBody.replace(/^#\s+(.+)$/gm, '## $1');
    onChange(updated);
  };

  const handleInsert = (prefix: string, suffix: string = '') => {
    // Inserts markdown syntax
    onChange(draftBody + `\n${prefix}Text${suffix}\n`);
  };

  return (
    <div className="bg-white border border-[#99BFF9]/35 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2A548E]" />
            <h4 className="font-serif-display text-base font-medium text-[#1E232B]">
              Markdown Content Body Editor
            </h4>
            {isModified ? (
              <span className="text-[10px] font-mono-code font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                Modified from Source
              </span>
            ) : (
              <span className="text-[10px] font-mono-code text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                Matches Original
              </span>
            )}
          </div>
          <p className="text-xs text-[#5A6270] mt-0.5">
            Original source content is preserved separately. Edit headings, formatting, links, and HTML before future import.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-[#FAF9F6] border border-stone-200 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
              viewMode === 'editor' ? 'bg-[#2A548E] text-white shadow-2xs' : 'text-[#5A6270] hover:text-[#1E232B]'
            }`}
          >
            Draft Editor
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors flex items-center gap-1 ${
              viewMode === 'split' ? 'bg-[#2A548E] text-white shadow-2xs' : 'text-[#5A6270] hover:text-[#1E232B]'
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('source')}
            className={`px-2.5 py-1 rounded font-medium cursor-pointer transition-colors ${
              viewMode === 'source' ? 'bg-[#2A548E] text-white shadow-2xs' : 'text-[#5A6270] hover:text-[#1E232B]'
            }`}
          >
            Original Source
          </button>
        </div>
      </div>

      {/* Warning banner if H1 headings exist */}
      {h1Count > 0 && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{h1Count} single-hash (# H1) heading{h1Count > 1 ? 's' : ''} detected:</strong> Science of Gifts editorial rules mandate ## H2 for section titles because # H1 is reserved for the page title.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDemoteH1}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-[11px] cursor-pointer transition-colors"
          >
            Demote # H1 to ## H2
          </button>
        </div>
      )}

      {/* Editing Toolbar */}
      {viewMode !== 'source' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleInsert('## ')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 font-semibold cursor-pointer"
              title="Add Section Heading"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => handleInsert('### ')}
              className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 font-semibold cursor-pointer"
              title="Add Subsection Heading"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => handleInsert('**', '**')}
              className="p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 cursor-pointer"
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsert('*', '*')}
              className="p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 cursor-pointer"
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsert('> ')}
              className="p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 cursor-pointer"
              title="Blockquote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsert('- ')}
              className="p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 cursor-pointer"
              title="Unordered List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleInsert('[Link Title](', ')')}
              className="p-1 bg-white hover:bg-stone-100 border border-stone-200 rounded text-stone-700 cursor-pointer"
              title="Markdown Link"
            >
              <Link className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#5A6270]">
            <span>{wordCount} words</span>
            <span>·</span>
            <span>{h2Count} H2s, {h3Count} H3s</span>
            {isModified && (
              <button
                type="button"
                onClick={onRevertToOriginal}
                className="text-stone-500 hover:text-stone-800 flex items-center gap-1 cursor-pointer font-medium ml-2"
                title="Reset edits back to original source file body"
              >
                <RotateCcw className="w-3 h-3" /> Revert to Source
              </button>
            )}
          </div>
        </div>
      )}

      {/* Editor Main Canvas */}
      {viewMode === 'editor' && (
        <textarea
          rows={18}
          value={draftBody}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Markdown article body..."
          className="w-full p-4 bg-white border border-stone-200 rounded-lg font-mono-code text-xs text-[#1E232B] leading-relaxed focus:border-[#2A548E] focus:outline-none select-text"
        />
      )}

      {viewMode === 'source' && (
        <div className="space-y-2">
          <div className="text-[11px] font-mono text-[#5A6270] bg-stone-50 px-3 py-1.5 rounded border border-stone-200 flex items-center justify-between">
            <span>Read-only reference: Untouched original file body from upload</span>
            <span>{originalBody.length} bytes</span>
          </div>
          <pre className="p-4 bg-stone-50 border border-stone-200 rounded-lg font-mono-code text-xs text-stone-800 leading-relaxed overflow-x-auto max-h-[500px] whitespace-pre-wrap select-text">
            {originalBody}
          </pre>
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono font-bold text-[#2A548E] bg-[#EEF5FF] px-2 py-1 rounded border border-[#99BFF9]/30">
              Draft Body (Editable)
            </div>
            <textarea
              rows={18}
              value={draftBody}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-3 bg-white border border-stone-200 rounded-lg font-mono-code text-xs text-[#1E232B] leading-relaxed focus:border-[#2A548E] focus:outline-none select-text"
            />
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-mono font-semibold text-[#5A6270] bg-stone-100 px-2 py-1 rounded border border-stone-200">
              Original Source Body (Read-only Reference)
            </div>
            <pre className="p-3 bg-stone-50 border border-stone-200 rounded-lg font-mono-code text-xs text-stone-700 leading-relaxed overflow-y-auto h-[380px] whitespace-pre-wrap select-text">
              {originalBody}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { FileCode, Globe, Layers, Copy, Check, ExternalLink } from 'lucide-react';
import { ImportFileItem } from '../../types/import';

interface SourceInformationPaneProps {
  item: ImportFileItem;
}

export const SourceInformationPane: React.FC<SourceInformationPaneProps> = ({ item }) => {
  const [copiedRaw, setCopiedRaw] = useState(false);

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(item.rawContent || '');
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-stone-100 text-stone-700 rounded-xl">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[#1E232B]">
              Original Source Information
            </h3>
            <p className="text-xs text-[#5A6270]">
              Pristine uploaded Markdown and Live Page scraped HTML data for reference.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyRaw}
          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
        >
          {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedRaw ? 'Copied Raw Markdown' : 'Copy Original Markdown'}</span>
        </button>
      </div>

      {/* Grid: Markdown & Live Page Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pristine Uploaded Markdown */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="font-bold text-xs text-[#1E232B] flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-[#2A548E]" />
              Pristine Markdown ({item.filename})
            </span>
            <span className="text-[10px] font-mono text-stone-500">
              {(item.fileSize / 1024).toFixed(1)} KB
            </span>
          </div>

          <pre className="p-3 bg-stone-900 text-stone-100 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
            <code>{item.rawContent || 'No raw content available.'}</code>
          </pre>
        </div>

        {/* Live Page Scraped Info if present */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="font-bold text-xs text-[#1E232B] flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              Live URL Data Reference
            </span>
            {item.liveUrl && (
              <a
                href={item.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2A548E] hover:underline font-mono text-[11px] flex items-center gap-1"
              >
                Open Webpage <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {item.livePageData ? (
            <div className="space-y-3 text-xs text-[#5A6270]">
              <div>
                <strong className="text-[#1E232B] block">HTML Title Tag:</strong>
                <span>{item.livePageData.metadata?.title || 'N/A'}</span>
              </div>
              <div>
                <strong className="text-[#1E232B] block">Meta Description:</strong>
                <span>{item.livePageData.metadata?.metaDescription || 'N/A'}</span>
              </div>
              <div>
                <strong className="text-[#1E232B] block">Discovered Headings:</strong>
                <span>{item.livePageData.content?.headings?.length || 0} headings extracted</span>
              </div>
              <div>
                <strong className="text-[#1E232B] block">Discovered Images:</strong>
                <span>{item.livePageData.content?.images?.length || 0} body images extracted</span>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center bg-stone-50 rounded-xl text-xs text-stone-500">
              No live page URL was attached to this import draft.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

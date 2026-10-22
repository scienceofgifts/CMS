import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  FileText,
  BookOpen,
  ShoppingBag,
  Info,
  Maximize2,
  Edit3
} from 'lucide-react';
import { AssetItem } from '../../types/assets';
import { AssetRenameModal } from './AssetRenameModal';
import { useModalEscape } from '../../hooks/useModalEscape';

interface AssetDetailModalProps {
  asset: AssetItem;
  isOpen: boolean;
  onClose: () => void;
  onDeleteRequest: (asset: AssetItem) => void;
  onRefresh: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  isOpen,
  onClose,
  onDeleteRequest,
  onRefresh
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateDerivatives = async () => {
    setGenerating(true);
    setGenerateMsg(null);
    try {
      const res = await fetch('/api/assets/generate-derivatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: asset.filename })
      });
      const data = await res.json();
      if (data.success) {
        setGenerateMsg(data.message || 'Derivatives generated successfully.');
        onRefresh();
      } else {
        setGenerateMsg(data.error || 'Failed to generate derivatives.');
      }
    } catch (err: any) {
      setGenerateMsg(err.message || 'Generation error.');
    } finally {
      setGenerating(false);
    }
  };

  const liquidSnippet = `{% include editorial-image.html type="${asset.name}" alt="${asset.name.replace(/[-_]/g, ' ')}" %}`;
  const markdownSnippet = `![${asset.name.replace(/[-_]/g, ' ')}](${asset.publicUrl})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-sm shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-[#99BFF9]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 text-[10px] font-mono-code uppercase font-semibold bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 rounded-xs">
              {asset.format}
            </span>
            <h2 className="font-serif-display text-xl text-[#1E232B] font-medium truncate max-w-md">
              {asset.filename}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Image Preview */}
          <div className="md:col-span-7 flex flex-col space-y-4">
            <div className="relative bg-stone-100/70 border border-[#99BFF9]/30 rounded-xs overflow-hidden flex items-center justify-center min-h-[300px] max-h-[420px] p-2">
              <img
                src={asset.publicUrl}
                alt={asset.filename}
                className="max-h-[380px] w-auto max-w-full object-contain mx-auto shadow-xs"
                onError={(e) => {
                  // Fallback if full source fails, try thumbnail or placeholder
                  if (asset.derivatives.thumb?.url) {
                    (e.target as HTMLImageElement).src = asset.derivatives.thumb.url;
                  }
                }}
              />
              <a
                href={asset.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3 right-3 p-1.5 bg-white/90 hover:bg-white text-[#2A548E] border border-[#99BFF9]/30 rounded-xs shadow-xs text-xs flex items-center gap-1 transition-colors"
                title="Open full size in new tab"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono-code">Open full</span>
              </a>
            </div>

            {/* Quick Copy Snippets */}
            <div className="bg-white border border-[#99BFF9]/25 p-4 rounded-xs space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                <Copy className="w-3.5 h-3.5" />
                Ready-to-Use Embed Codes
              </h3>

              {/* Public URL */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
                  <span>Public Site URL:</span>
                  <button
                    onClick={() => handleCopy(asset.publicUrl, 'url')}
                    className="text-[#2A548E] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey === 'url' ? <Check className="w-3 h-3 text-[#226E56]" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'url' ? 'Copied' : 'Copy URL'}
                  </button>
                </div>
                <div className="p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 font-mono-code text-xs text-[#1E232B] truncate select-all">
                  {asset.publicUrl}
                </div>
              </div>

              {/* Jekyll Include */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
                  <span>Jekyll Include Snippet:</span>
                  <button
                    onClick={() => handleCopy(liquidSnippet, 'liquid')}
                    className="text-[#2A548E] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey === 'liquid' ? <Check className="w-3 h-3 text-[#226E56]" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'liquid' ? 'Copied' : 'Copy Liquid'}
                  </button>
                </div>
                <div className="p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 font-mono-code text-xs text-[#1E232B] overflow-x-auto whitespace-pre select-all">
                  {liquidSnippet}
                </div>
              </div>

              {/* Markdown Image */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
                  <span>Markdown Syntax:</span>
                  <button
                    onClick={() => handleCopy(markdownSnippet, 'markdown')}
                    className="text-[#2A548E] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedKey === 'markdown' ? <Check className="w-3 h-3 text-[#226E56]" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'markdown' ? 'Copied' : 'Copy Markdown'}
                  </button>
                </div>
                <div className="p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 font-mono-code text-xs text-[#1E232B] overflow-x-auto whitespace-pre select-all">
                  {markdownSnippet}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Metadata & Derivatives */}
          <div className="md:col-span-5 flex flex-col space-y-5">
            {/* File Specifications */}
            <div className="bg-white border border-[#99BFF9]/25 p-4 rounded-xs space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Asset Metadata
              </h3>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-[#5A6270] text-[11px]">Dimensions</dt>
                  <dd className="font-mono-code font-semibold text-[#1E232B]">
                    {asset.dimensions ? `${asset.dimensions.width} × ${asset.dimensions.height} px` : 'Vector / N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#5A6270] text-[11px]">File Size</dt>
                  <dd className="font-mono-code font-semibold text-[#1E232B]">{asset.formattedSize}</dd>
                </div>
                <div>
                  <dt className="text-[#5A6270] text-[11px]">Format</dt>
                  <dd className="font-mono-code text-[#1E232B]">{asset.format} ({asset.ext})</dd>
                </div>
                <div>
                  <dt className="text-[#5A6270] text-[11px]">Directory</dt>
                  <dd className="font-mono-code text-[#1E232B] truncate" title={asset.directory}>
                    {asset.directory}/
                  </dd>
                </div>
                <div className="col-span-2 border-t border-[#99BFF9]/15 pt-2">
                  <dt className="text-[#5A6270] text-[11px]">Relative Path</dt>
                  <dd className="font-mono-code text-xs text-[#2A548E] break-all select-all">
                    {asset.relativePath}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#5A6270] text-[11px]">Last Modified</dt>
                  <dd className="text-xs text-[#5A6270]">
                    {new Date(asset.mtime).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Pipeline & Derivatives Status */}
            <div className="bg-white border border-[#99BFF9]/25 p-4 rounded-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E]">
                  Jekyll Pipeline Derivatives
                </h3>
                {asset.format !== 'SVG' && (
                  <button
                    onClick={handleGenerateDerivatives}
                    disabled={generating}
                    className="text-[11px] text-[#2A548E] hover:text-[#1B365D] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Regenerate WebP & thumbnail using ImageMagick"
                  >
                    <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                    {generating ? 'Processing...' : 'Regenerate'}
                  </button>
                )}
              </div>

              {generateMsg && (
                <div className="p-2 bg-[#EBF3ED] text-[#226E56] text-[11px] rounded-xs border border-[#99BFF9]/30">
                  {generateMsg}
                </div>
              )}

              {asset.format === 'SVG' ? (
                <div className="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 text-xs text-[#5A6270]">
                  Vector graphics (SVG) scale losslessly and do not require raster derivatives.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {/* Source */}
                  <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                    <div>
                      <span className="font-semibold text-[#1E232B]">Source File ({asset.ext})</span>
                      <p className="text-[11px] text-[#5A6270] font-mono-code">{asset.formattedSize}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#EBF3ED] text-[#226E56] rounded-xs border border-[#226E56]/20">
                      Uploaded
                    </span>
                  </div>

                  {/* WebP */}
                  <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                    <div>
                      <span className="font-semibold text-[#1E232B]">Full WebP</span>
                      <p className="text-[11px] text-[#5A6270] font-mono-code">
                        {asset.derivatives.webp?.exists ? `${asset.derivatives.webp.formattedSize} · Q85` : 'Missing'}
                      </p>
                    </div>
                    {asset.derivatives.webp?.exists ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#EBF3ED] text-[#226E56] rounded-xs border border-[#226E56]/20">
                        Generated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-xs border border-amber-200">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="flex items-center justify-between p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                    <div>
                      <span className="font-semibold text-[#1E232B]">Thumbnail WebP</span>
                      <p className="text-[11px] text-[#5A6270] font-mono-code">
                        {asset.derivatives.thumb?.exists ? `${asset.derivatives.thumb.formattedSize} · 800px` : 'Missing'}
                      </p>
                    </div>
                    {asset.derivatives.thumb?.exists ? (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#EBF3ED] text-[#226E56] rounded-xs border border-[#226E56]/20">
                        Generated
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 rounded-xs border border-amber-200">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Used By Information */}
            <div className="bg-white border border-[#99BFF9]/25 p-4 rounded-xs space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] flex items-center justify-between">
                <span>Referenced Content</span>
                <span className="text-[11px] font-mono-code font-normal text-[#5A6270]">
                  {asset.usedBy.length} {asset.usedBy.length === 1 ? 'place' : 'places'}
                </span>
              </h3>

              {asset.usedBy.length === 0 ? (
                <p className="text-xs text-[#5A6270] italic">
                  Not currently referenced in any gift guide, article, or product.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {asset.usedBy.map((ref, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {ref.type === 'guide' && <BookOpen className="w-3.5 h-3.5 text-[#2A548E] shrink-0" />}
                        {ref.type === 'article' && <FileText className="w-3.5 h-3.5 text-[#226E56] shrink-0" />}
                        {ref.type === 'product' && <ShoppingBag className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                        <span className="truncate font-medium text-[#1E232B]">{ref.title}</span>
                      </div>
                      <span className="text-[10px] uppercase font-mono-code text-[#5A6270] shrink-0 px-1.5 py-0.5 bg-white border border-[#99BFF9]/20">
                        {ref.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions: Rename & Delete */}
            <div className="pt-3 border-t border-[#99BFF9]/20 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(true)}
                className="px-3.5 py-1.5 text-xs text-[#2A548E] hover:text-[#1B365D] hover:bg-[#EEF5FF] border border-[#99BFF9]/40 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Rename Asset
              </button>

              <button
                type="button"
                onClick={() => onDeleteRequest(asset)}
                className="px-3.5 py-1.5 text-xs text-red-700 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Asset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Dialog Modal */}
      <AssetRenameModal
        asset={asset}
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onRenameSuccess={() => {
          onRefresh();
          onClose();
        }}
      />
    </div>
  );
};

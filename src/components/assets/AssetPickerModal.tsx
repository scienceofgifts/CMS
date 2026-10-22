import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Upload,
  Check,
  Image as ImageIcon,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { AssetItem, AssetPickerResult } from '../../types/assets';
import { useModalEscape } from '../../hooks/useModalEscape';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: AssetPickerResult) => void;
  title?: string;
  initialAltText?: string;
  initialCaption?: string;
  showCaptionInput?: boolean;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Select Image from Asset Library',
  initialAltText = '',
  initialCaption = '',
  showCaptionInput = false
}) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'source' | 'webp' | 'svg' | 'in_use'>('all');
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);

  // Field overrides
  const [altText, setAltText] = useState(initialAltText);
  const [caption, setCaption] = useState(initialCaption);

  // Inline upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useModalEscape(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
      setSelectedAsset(null);
      setAltText(initialAltText);
      setCaption(initialCaption);
      setUploadError(null);
    }
  }, [isOpen]);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
      } else {
        setError(data.error || 'Failed to load assets');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading assets');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAsset = (asset: AssetItem) => {
    setSelectedAsset(asset);
    if (!altText) {
      // Suggest clean alt text from asset name
      const cleanName = asset.name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      setAltText(cleanName);
    }
  };

  const handleConfirmSelect = () => {
    if (!selectedAsset) return;

    onSelect({
      path: selectedAsset.relativePath,
      publicUrl: selectedAsset.publicUrl,
      filename: selectedAsset.filename,
      nameWithoutExt: selectedAsset.name,
      altText: altText.trim(),
      caption: caption.trim() || undefined,
      dimensions: selectedAsset.dimensions
    });
    onClose();
  };

  const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'keep_both'); // Default to keep_both in picker to avoid overwriting

    try {
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        await loadAssets();
        // Automatically select newly uploaded asset
        if (data.filename) {
          const matching = assets.find(a => a.filename === data.filename);
          if (matching) {
            handleSelectAsset(matching);
          }
        }
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  // Filter & search assets
  const filtered = assets.filter(asset => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        asset.filename.toLowerCase().includes(q) ||
        asset.name.toLowerCase().includes(q) ||
        asset.usedBy.some(u => u.title.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filter === 'source') return asset.format === 'JPG' || asset.format === 'PNG';
    if (filter === 'webp') return asset.format === 'WebP';
    if (filter === 'svg') return asset.format === 'SVG';
    if (filter === 'in_use') return asset.usedBy.length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-sm shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-[#99BFF9]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-display text-lg text-[#1E232B] font-medium">
                {title}
              </h2>
              <p className="text-[11px] text-[#5A6270]">
                Choose an image from <code className="font-mono-code bg-stone-100 px-1">assets/images/</code> or upload a new one
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Filters & Upload Button */}
        <div className="px-6 py-3 bg-[#FAF9F6] border-b border-[#99BFF9]/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5A6270] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search images by name or guide..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#99BFF9]/30 rounded-xs text-xs text-[#1E232B] placeholder:text-[#5A6270]/60 focus:outline-none focus:border-[#2A548E]"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-xs cursor-pointer transition-colors ${
                  filter === 'all'
                    ? 'bg-[#2A548E] text-white font-medium'
                    : 'bg-white text-[#5A6270] border border-[#99BFF9]/25 hover:bg-stone-50'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('source')}
                className={`px-2.5 py-1 rounded-xs cursor-pointer transition-colors ${
                  filter === 'source'
                    ? 'bg-[#2A548E] text-white font-medium'
                    : 'bg-white text-[#5A6270] border border-[#99BFF9]/25 hover:bg-stone-50'
                }`}
              >
                JPG / PNG
              </button>
              <button
                type="button"
                onClick={() => setFilter('webp')}
                className={`px-2.5 py-1 rounded-xs cursor-pointer transition-colors ${
                  filter === 'webp'
                    ? 'bg-[#2A548E] text-white font-medium'
                    : 'bg-white text-[#5A6270] border border-[#99BFF9]/25 hover:bg-stone-50'
                }`}
              >
                WebP
              </button>
              <button
                type="button"
                onClick={() => setFilter('svg')}
                className={`px-2.5 py-1 rounded-xs cursor-pointer transition-colors ${
                  filter === 'svg'
                    ? 'bg-[#2A548E] text-white font-medium'
                    : 'bg-white text-[#5A6270] border border-[#99BFF9]/25 hover:bg-stone-50'
                }`}
              >
                SVG
              </button>
            </div>
          </div>

          {/* Inline Upload Action */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleInlineUpload}
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 bg-white hover:bg-stone-50 text-[#2A548E] border border-[#99BFF9]/30 rounded-xs text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{uploading ? 'Uploading...' : 'Upload New'}</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Modal Body: Assets Grid & Side Panel */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Main Grid View */}
          <div className="md:col-span-8 p-6 overflow-y-auto border-r border-[#99BFF9]/20 bg-[#FAF9F6]">
            {loading ? (
              <div className="py-20 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#2A548E] mx-auto" />
                <p className="text-xs text-[#5A6270]">Scanning asset library...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs">
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <ImageIcon className="w-8 h-8 text-[#5A6270]/40 mx-auto" />
                <p className="text-xs text-[#5A6270]">No matching assets found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filtered.map(asset => {
                  const isSelected = selectedAsset?.id === asset.id;
                  const thumbSrc = asset.derivatives.thumb?.url || asset.publicUrl;

                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleSelectAsset(asset)}
                      className={`group relative bg-white border rounded-xs overflow-hidden cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'border-[#2A548E] ring-2 ring-[#2A548E]/20 shadow-xs'
                          : 'border-[#99BFF9]/25 hover:border-[#2A548E]/40 hover:shadow-xs'
                      }`}
                    >
                      {/* Thumbnail container */}
                      <div className="aspect-[4/3] bg-stone-100 overflow-hidden flex items-center justify-center relative">
                        <img
                          src={thumbSrc}
                          alt={asset.filename}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        />
                        {/* Format badge */}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-mono-code font-bold uppercase bg-stone-900/70 text-white rounded-xs">
                          {asset.format}
                        </span>

                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2A548E] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* File Details */}
                      <div className="p-2 space-y-0.5">
                        <div className="font-semibold text-[11px] text-[#1E232B] truncate" title={asset.filename}>
                          {asset.filename}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#5A6270]">
                          <span>{asset.formattedSize}</span>
                          <span>
                            {asset.dimensions ? `${asset.dimensions.width}×${asset.dimensions.height}` : 'Vector'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Selected Preview & Settings Panel */}
          <div className="md:col-span-4 p-6 bg-white overflow-y-auto space-y-4 flex flex-col justify-between">
            {selectedAsset ? (
              <div className="space-y-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-[#2A548E] border-b border-[#99BFF9]/20 pb-2">
                  Selected Image Details
                </div>

                {/* Preview Thumbnail */}
                <div className="bg-stone-100 border border-[#99BFF9]/30 rounded-xs overflow-hidden aspect-[16/9] flex items-center justify-center">
                  <img
                    src={selectedAsset.publicUrl}
                    alt={selectedAsset.filename}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Metadata */}
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-[#1E232B] break-all">
                    {selectedAsset.filename}
                  </div>
                  <div className="font-mono-code text-[11px] text-[#5A6270]">
                    {selectedAsset.relativePath}
                  </div>
                  <div className="text-[11px] text-[#5A6270]">
                    {selectedAsset.format} · {selectedAsset.formattedSize}
                    {selectedAsset.dimensions ? ` · ${selectedAsset.dimensions.width}×${selectedAsset.dimensions.height}px` : ''}
                  </div>
                </div>

                {/* Editable Alt Text */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#1E232B]">
                    Image Alt Text <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Descriptive text for accessibility & SEO"
                    className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs focus:outline-none focus:border-[#2A548E]"
                  />
                  <p className="text-[10px] text-[#5A6270]">
                    Screen readers and search engines use this to understand the image.
                  </p>
                </div>

                {/* Optional Caption (for rich text insertion) */}
                {showCaptionInput && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-[#1E232B]">
                      Optional Editorial Caption
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="e.g. Archival Carta Marina reproduction"
                      className="w-full p-2 text-xs bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs focus:outline-none focus:border-[#2A548E]"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center space-y-2 my-auto">
                <ImageIcon className="w-8 h-8 text-[#5A6270]/30 mx-auto" />
                <p className="text-xs text-[#5A6270]">Select an image on the left to preview and configure.</p>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-[#99BFF9]/20 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSelect}
                disabled={!selectedAsset}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#2A548E] hover:bg-[#1B365D] text-white rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Use Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

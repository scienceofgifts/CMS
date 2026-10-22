import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Search,
  RefreshCw,
  LayoutGrid,
  List as ListIcon,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Trash2,
  Check,
  AlertCircle,
  Copy,
  Info,
  Sparkles,
  Maximize2,
  FileCheck,
  FolderOpen,
  X
} from 'lucide-react';
import { AssetItem, AssetStats } from '../../types/assets';
import { AssetDetailModal } from './AssetDetailModal';
import { AssetDeleteModal } from './AssetDeleteModal';
import { useModalEscape } from '../../hooks/useModalEscape';

export const AssetManager: React.FC = () => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Controls
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'source' | 'webp' | 'svg' | 'in_use' | 'unused'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal States
  const [detailAsset, setDetailAsset] = useState<AssetItem | null>(null);
  const [deleteAsset, setDeleteAsset] = useState<AssetItem | null>(null);

  // Upload States
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadConflict, setUploadConflict] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag & drop on page
  const [isDragging, setIsDragging] = useState(false);

  // Batch pipeline state
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);

  // Copy notification
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useModalEscape(isUploadOpen, () => setIsUploadOpen(false));

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        setAssets(data.assets || []);
        setStats(data.stats || null);
      } else {
        setError(data.error || 'Failed to fetch assets.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching assets.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (url: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Run ImageMagick pipeline on all missing derivatives
  const handleRunBatchPipeline = async () => {
    setRunningPipeline(true);
    setPipelineMessage(null);
    try {
      const res = await fetch('/api/assets/generate-derivatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setPipelineMessage(data.message);
        await loadAssets();
      } else {
        setPipelineMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setPipelineMessage(`Failed: ${err.message}`);
    } finally {
      setRunningPipeline(false);
    }
  };

  // Upload handling
  const handleSelectUploadFile = (file: File) => {
    setUploadFile(file);
    setUploadConflict(null);
    setUploadError(null);
    setUploadMessage(null);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    setIsUploadOpen(true);
  };

  const handleExecuteUpload = async (action: 'replace' | 'keep_both' | '') => {
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (action) {
      formData.append('action', action);
    }

    try {
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        // Name conflict! Prompt user
        setUploadConflict(data.filename);
        setUploading(false);
        return;
      }

      if (data.success) {
        setUploadMessage(data.message || 'Image uploaded successfully!');
        setUploadFile(null);
        setUploadPreview(null);
        setUploadConflict(null);
        await loadAssets();
        setTimeout(() => {
          setIsUploadOpen(false);
          setUploadMessage(null);
        }, 1500);
      } else {
        setUploadError(data.error || 'Upload failed.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Network error during upload.');
    } finally {
      setUploading(false);
    }
  };

  // Delete handling
  const handleConfirmDelete = async (asset: AssetItem, cleanupDerivatives: boolean) => {
    const res = await fetch(`/api/assets/${encodeURIComponent(asset.filename)}?cleanupDerivatives=${cleanupDerivatives}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete asset');
    }
    if (detailAsset?.id === asset.id) {
      setDetailAsset(null);
    }
    await loadAssets();
  };

  // Drag and drop window listeners
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '')) {
        handleSelectUploadFile(file);
      } else {
        alert('Unsupported file format. Please upload JPG, PNG, WebP, or SVG images.');
      }
    }
  };

  // Filter & sort assets
  const filteredAssets = assets
    .filter(a => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          a.filename.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.relativePath.toLowerCase().includes(q) ||
          a.usedBy.some(u => u.title.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (filter === 'source') return a.format === 'JPG' || a.format === 'PNG';
      if (filter === 'webp') return a.format === 'WebP';
      if (filter === 'svg') return a.format === 'SVG';
      if (filter === 'in_use') return a.usedBy.length > 0;
      if (filter === 'unused') return a.usedBy.length === 0;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
      if (sort === 'name_asc') return a.filename.localeCompare(b.filename);
      if (sort === 'name_desc') return b.filename.localeCompare(a.filename);
      if (sort === 'size_desc') return b.size - a.size;
      if (sort === 'size_asc') return a.size - b.size;
      return new Date(b.mtime).getTime() - new Date(a.mtime).getTime(); // newest
    });

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="space-y-6 relative"
    >
      {/* Global Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#2A548E]/85 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none animate-in fade-in duration-100">
          <Upload className="w-16 h-16 animate-bounce mb-4 text-[#99BFF9]" />
          <h2 className="font-serif-display text-2xl font-medium">Drop image here to upload</h2>
          <p className="text-sm text-stone-200 mt-1">Image will be added to assets/images/</p>
        </div>
      )}

      {/* Editorial Header */}
      <div className="bg-white border border-[#99BFF9]/35 p-6 sm:p-8 rounded-sm shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] uppercase font-mono-code font-bold tracking-widest bg-[#EEF5FF] text-[#2A548E] border border-[#99BFF9]/30 rounded-xs">
              Media &amp; Pipeline
            </span>
            <span className="text-xs text-[#5A6270] font-mono-code">
              assets/images/
            </span>
          </div>
          <h1 className="font-serif-display text-3xl text-[#1E232B] font-medium tracking-tight">
            Asset Library
          </h1>
          <p className="text-xs sm:text-sm text-[#5A6270] max-w-xl leading-relaxed">
            Manage source imagery for gift guides, articles, and products. Connected directly to Jekyll’s WebP and thumbnail conversion pipeline.
          </p>

          {/* Quick Stats Badges */}
          {stats && (
            <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5A6270]">
              <span className="px-2 py-0.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                <strong>{stats.totalAssets}</strong> total assets
              </span>
              <span className="px-2 py-0.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                <strong>{stats.webpCount}</strong> WebP ready
              </span>
              <span className="px-2 py-0.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs">
                <strong>{stats.inUseCount}</strong> in use
              </span>
              <span className="px-2 py-0.5 bg-[#FAF9F6] border border-[#99BFF9]/20 rounded-xs font-mono-code">
                {stats.formattedTotalSize}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-col lg:flex-row items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setUploadFile(null);
              setUploadPreview(null);
              setUploadConflict(null);
              setIsUploadOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </button>

          <button
            onClick={handleRunBatchPipeline}
            disabled={runningPipeline}
            className="w-full sm:w-auto px-3.5 py-2.5 bg-white hover:bg-stone-50 text-[#2A548E] border border-[#99BFF9]/35 text-xs font-semibold rounded-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Scan library and generate missing WebP/thumbnails via ImageMagick"
          >
            <Sparkles className={`w-3.5 h-3.5 ${runningPipeline ? 'animate-spin' : ''}`} />
            <span>{runningPipeline ? 'Optimizing...' : 'Build Derivatives'}</span>
          </button>

          <button
            onClick={loadAssets}
            disabled={loading}
            className="p-2.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer border border-[#99BFF9]/25"
            title="Refresh asset library"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {pipelineMessage && (
        <div className="p-3 bg-[#EBF3ED] border border-[#226E56]/20 text-[#226E56] text-xs rounded-xs flex items-center justify-between">
          <span>{pipelineMessage}</span>
          <button onClick={() => setPipelineMessage(null)} className="text-[#226E56] hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Controls Bar: Search, Filters, View Modes */}
      <div className="bg-white border border-[#99BFF9]/30 p-4 rounded-sm shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#5A6270] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assets by filename, guide, or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-xs text-xs text-[#1E232B] placeholder:text-[#5A6270]/60 focus:outline-none focus:border-[#2A548E]"
            />
          </div>

          {/* Right Controls: Sort & View Toggle */}
          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-[#5A6270]">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="bg-[#FAF9F6] border border-[#99BFF9]/30 py-1.5 px-2 rounded-xs text-xs text-[#1E232B] focus:outline-none focus:border-[#2A548E] cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
                <option value="size_desc">Size (Largest)</option>
                <option value="size_asc">Size (Smallest)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-[#99BFF9]/30 rounded-xs overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 cursor-pointer transition-colors ${
                  viewMode === 'grid' ? 'bg-[#2A548E] text-white' : 'bg-white text-[#5A6270] hover:bg-stone-50'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 cursor-pointer transition-colors ${
                  viewMode === 'list' ? 'bg-[#2A548E] text-white' : 'bg-white text-[#5A6270] hover:bg-stone-50'
                }`}
                title="List view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#99BFF9]/15 text-xs">
          <span className="text-[11px] font-semibold text-[#5A6270] mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All Files' },
            { id: 'source', label: 'Source (JPG/PNG)' },
            { id: 'webp', label: 'WebP' },
            { id: 'svg', label: 'Vector (SVG)' },
            { id: 'in_use', label: 'In Use' },
            { id: 'unused', label: 'Unused' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1 rounded-xs cursor-pointer text-xs transition-colors ${
                filter === tab.id
                  ? 'bg-[#2A548E] text-white font-medium shadow-2xs'
                  : 'bg-[#FAF9F6] text-[#5A6270] hover:bg-stone-100 border border-[#99BFF9]/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-[#5A6270] font-mono-code">
            Showing {filteredAssets.length} of {assets.length} assets
          </span>
        </div>
      </div>

      {/* Asset Display Area */}
      {loading ? (
        <div className="bg-white border border-[#99BFF9]/30 p-16 text-center space-y-3 rounded-sm">
          <RefreshCw className="w-8 h-8 text-[#2A548E] animate-spin mx-auto" />
          <p className="font-serif-display text-lg text-[#1E232B]">Scanning image library...</p>
          <p className="text-xs text-[#5A6270]">Inspecting assets/images/ and Jekyll derivatives</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-sm text-red-800 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>Could not load assets</span>
          </div>
          <p className="text-xs">{error}</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white border border-[#99BFF9]/30 p-16 text-center space-y-3 rounded-sm">
          <ImageIcon className="w-10 h-10 text-[#5A6270]/40 mx-auto" />
          <h3 className="font-serif-display text-xl text-[#1E232B]">No assets match your search</h3>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            Try adjusting your search terms or filter settings, or upload a new image to get started.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map(asset => {
            const thumbSrc = asset.derivatives.thumb?.url || asset.publicUrl;
            const hasWebp = asset.derivatives.webp?.exists;
            const hasThumb = asset.derivatives.thumb?.exists;

            return (
              <div
                key={asset.id}
                onClick={() => setDetailAsset(asset)}
                className="group bg-white border border-[#99BFF9]/25 hover:border-[#2A548E]/40 rounded-sm overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                {/* Image Preview Container */}
                <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden flex items-center justify-center">
                  <img
                    src={thumbSrc}
                    alt={asset.filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = asset.publicUrl;
                    }}
                  />

                  {/* Top Badge Overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 text-[9px] font-mono-code font-bold uppercase bg-stone-900/75 text-white rounded-xs backdrop-blur-2xs">
                      {asset.format}
                    </span>
                    {asset.usedBy.length > 0 ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-[#226E56]/90 text-white rounded-xs backdrop-blur-2xs">
                        In Use ({asset.usedBy.length})
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-stone-700/80 text-stone-200 rounded-xs backdrop-blur-2xs">
                        Unused
                      </span>
                    )}
                  </div>

                  {/* Quick Action Overlay on hover */}
                  <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailAsset(asset);
                      }}
                      className="px-3 py-1.5 bg-white text-[#2A548E] text-xs font-semibold rounded-xs shadow-xs flex items-center gap-1 hover:bg-[#FAF9F6]"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Inspect
                    </button>
                    <button
                      onClick={(e) => handleCopyUrl(asset.publicUrl, asset.id, e)}
                      className="p-1.5 bg-white text-[#2A548E] rounded-xs shadow-xs hover:bg-[#FAF9F6]"
                      title="Copy Public URL"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-4 h-4 text-[#226E56]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata & Derivative Status Footer */}
                <div className="p-3.5 space-y-2 border-t border-[#99BFF9]/15 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div
                      className="font-semibold text-xs text-[#1E232B] truncate group-hover:text-[#2A548E] transition-colors"
                      title={asset.filename}
                    >
                      {asset.filename}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
                      <span>{asset.formattedSize}</span>
                      <span>
                        {asset.dimensions
                          ? `${asset.dimensions.width}×${asset.dimensions.height}`
                          : 'Vector'}
                      </span>
                    </div>
                  </div>

                  {/* Derivative Status Indicators */}
                  {asset.format !== 'SVG' && (
                    <div className="pt-2 border-t border-[#99BFF9]/10 flex items-center justify-between text-[10px] text-[#5A6270]">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasWebp ? 'bg-[#226E56]' : 'bg-amber-500'}`} />
                        <span>WebP {hasWebp ? 'Ready' : 'Pending'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${hasThumb ? 'bg-[#226E56]' : 'bg-amber-500'}`} />
                        <span>Thumb {hasThumb ? 'Ready' : 'Pending'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border border-[#99BFF9]/30 rounded-sm overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F6] border-b border-[#99BFF9]/20 text-[#5A6270] uppercase font-mono-code text-[10px]">
                <tr>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Dimensions</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">WebP</th>
                  <th className="py-3 px-4">Thumb</th>
                  <th className="py-3 px-4">Usage</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#99BFF9]/15">
                {filteredAssets.map(asset => {
                  const thumbSrc = asset.derivatives.thumb?.url || asset.publicUrl;

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setDetailAsset(asset)}
                      className="hover:bg-[#FAF9F6] cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 w-16">
                        <div className="w-10 h-10 bg-stone-100 rounded-xs overflow-hidden border border-stone-200 flex items-center justify-center">
                          <img
                            src={thumbSrc}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = asset.publicUrl;
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#1E232B]">{asset.filename}</div>
                        <div className="font-mono-code text-[11px] text-[#5A6270] truncate max-w-xs">
                          {asset.relativePath}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono-code uppercase font-semibold text-[#2A548E]">
                        {asset.format}
                      </td>
                      <td className="py-2.5 px-4 text-[#5A6270] font-mono-code">
                        {asset.dimensions ? `${asset.dimensions.width}×${asset.dimensions.height}` : 'Vector'}
                      </td>
                      <td className="py-2.5 px-4 text-[#5A6270] font-mono-code">
                        {asset.formattedSize}
                      </td>
                      <td className="py-2.5 px-4">
                        {asset.format === 'SVG' ? (
                          <span className="text-[#5A6270]">—</span>
                        ) : asset.derivatives.webp?.exists ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-[#EBF3ED] text-[#226E56] font-semibold rounded-xs">
                            Ready
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 font-semibold rounded-xs">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {asset.format === 'SVG' ? (
                          <span className="text-[#5A6270]">—</span>
                        ) : asset.derivatives.thumb?.exists ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-[#EBF3ED] text-[#226E56] font-semibold rounded-xs">
                            Ready
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 font-semibold rounded-xs">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {asset.usedBy.length > 0 ? (
                          <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-medium text-[11px] rounded-xs border border-[#99BFF9]/30">
                            {asset.usedBy.length} {asset.usedBy.length === 1 ? 'place' : 'places'}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#5A6270]">Unused</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleCopyUrl(asset.publicUrl, asset.id, e)}
                            className="p-1 text-[#5A6270] hover:text-[#2A548E] hover:bg-stone-100 rounded-xs cursor-pointer"
                            title="Copy URL"
                          >
                            {copiedId === asset.id ? (
                              <Check className="w-3.5 h-3.5 text-[#226E56]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteAsset(asset);
                            }}
                            className="p-1 text-[#5A6270] hover:text-red-700 hover:bg-red-50 rounded-xs cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal with Duplicate Conflict Resolution */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-white border-b border-[#99BFF9]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#2A548E]" />
                <h2 className="font-serif-display text-lg font-medium text-[#1E232B]">
                  Upload Asset to assets/images/
                </h2>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1.5 text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs">
              {!uploadFile ? (
                /* Dropzone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#99BFF9]/40 hover:border-[#2A548E] bg-white p-8 text-center rounded-sm cursor-pointer transition-colors space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleSelectUploadFile(e.target.files[0]);
                    }}
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-[#EEF5FF] text-[#2A548E] flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#2A548E] hover:underline">
                      Click to choose an image
                    </span>{' '}
                    or drag and drop here
                  </div>
                  <p className="text-[11px] text-[#5A6270]">
                    Supported formats: JPG, PNG, WebP, SVG (Maximum 15MB)
                  </p>
                </div>
              ) : (
                /* Selected File Preview & Details */
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-white border border-[#99BFF9]/30 rounded-xs">
                    {uploadPreview && (
                      <div className="w-16 h-16 bg-stone-100 rounded-xs overflow-hidden shrink-0 border border-stone-200">
                        <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="truncate space-y-0.5">
                      <div className="font-semibold text-[#1E232B] truncate">{uploadFile.name}</div>
                      <div className="text-[11px] text-[#5A6270]">
                        {(uploadFile.size / 1024).toFixed(1)} KB · {uploadFile.type || 'image'}
                      </div>
                      <div className="text-[10px] text-[#2A548E] font-mono-code">
                        Target: assets/images/{uploadFile.name.toLowerCase().replace(/\s+/g, '-')}
                      </div>
                    </div>
                  </div>

                  {/* Conflict Notice & Resolution Options */}
                  {uploadConflict && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xs text-amber-900 space-y-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                        <span>Filename Conflict</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        An asset named <code className="font-mono-code font-bold">{uploadConflict}</code> already exists in <code className="font-mono-code">assets/images/</code>. How would you like to handle this?
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleExecuteUpload('replace')}
                          disabled={uploading}
                          className="flex-1 px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xs transition-colors cursor-pointer text-center"
                        >
                          Replace Existing (Auto-Backup)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteUpload('keep_both')}
                          disabled={uploading}
                          className="flex-1 px-3 py-2 bg-white hover:bg-stone-50 border border-amber-300 text-amber-900 font-semibold text-xs rounded-xs transition-colors cursor-pointer text-center"
                        >
                          Keep Both (Save with Suffix)
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadMessage && (
                    <div className="p-3 bg-[#EBF3ED] text-[#226E56] border border-[#226E56]/20 rounded-xs flex items-center gap-2 font-medium">
                      <FileCheck className="w-4 h-4" />
                      <span>{uploadMessage}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xs">
                      {uploadError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white border-t border-[#99BFF9]/20 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadFile(null);
                  setUploadConflict(null);
                }}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 rounded-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {uploadFile && !uploadConflict && (
                <button
                  type="button"
                  onClick={() => handleExecuteUpload('')}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-[#2A548E] hover:bg-[#1B365D] text-white rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : 'Upload Asset'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Asset Detail Modal */}
      {detailAsset && (
        <AssetDetailModal
          asset={detailAsset}
          isOpen={!!detailAsset}
          onClose={() => setDetailAsset(null)}
          onDeleteRequest={(asset) => {
            setDeleteAsset(asset);
          }}
          onRefresh={loadAssets}
        />
      )}

      {/* Safe Delete Modal */}
      {deleteAsset && (
        <AssetDeleteModal
          asset={deleteAsset}
          isOpen={!!deleteAsset}
          onClose={() => setDeleteAsset(null)}
          onConfirmDelete={handleConfirmDelete}
        />
      )}
    </div>
  );
};

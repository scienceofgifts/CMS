import React, { useState } from 'react';
import {
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Search,
  Trash2,
  RotateCcw,
  Plus,
  Check,
  Edit2,
  ArrowRight,
  Layers,
  CheckSquare,
  Square,
  Info,
  Sparkles
} from 'lucide-react';
import {
  StructuredArticleLink,
  ImportLinkClassification,
  ImportLinkSource,
  ImportLinkStatus,
  ProductExportStatus
} from '../../types/import';

interface LinkReviewPaneProps {
  links: StructuredArticleLink[];
  onUpdateLinks: (newLinks: StructuredArticleLink[]) => void;
  onExportProducts: (linkIds: string[]) => Promise<any>;
  onNavigateToProductsTab?: (productId?: string) => void;
}

export const LinkReviewPane: React.FC<LinkReviewPaneProps> = ({
  links,
  onUpdateLinks,
  onExportProducts,
  onNavigateToProductsTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exportStatusFilter, setExportStatusFilter] = useState<string>('all');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [exportPendingIds, setExportPendingIds] = useState<string[]>([]);
  const [exportResultReport, setExportResultReport] = useState<{
    created: number;
    alreadyExisted: number;
    needsReview: number;
    failed: number;
  } | null>(null);

  // Filtered links list
  const filteredLinks = links.filter((link) => {
    if (sourceFilter !== 'all' && link.source !== sourceFilter) return false;
    if (classificationFilter !== 'all' && link.classification !== classificationFilter) return false;
    if (statusFilter !== 'all' && link.status !== statusFilter) return false;
    if (exportStatusFilter !== 'all') {
      const currentExportStatus = link.exportStatus || 'not_exported';
      if (currentExportStatus !== exportStatusFilter) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchAnchor = link.anchorText?.toLowerCase().includes(term);
      const matchUrl = link.url?.toLowerCase().includes(term);
      const matchContext = link.contextSnippet?.toLowerCase().includes(term);
      if (!matchAnchor && !matchUrl && !matchContext) return false;
    }
    return true;
  });

  // Product links subset
  const eligibleProductLinks = links.filter(
    (l) => l.classification === 'product' && !l.isRemoved
  );

  // Summary counts
  const totalCount = links.length;
  const activeCount = links.filter((l) => !l.isRemoved).length;
  const productCount = eligibleProductLinks.length;
  const exportedCount = links.filter((l) => l.exportStatus === 'exported').length;
  const alreadyExistsCount = links.filter((l) => l.exportStatus === 'already_exists').length;
  const internalCount = links.filter((l) => l.classification === 'internal' && !l.isRemoved).length;
  const externalCount = links.filter((l) => l.classification === 'external' && !l.isRemoved).length;

  const handleUpdateLinkItem = (id: string, updates: Partial<StructuredArticleLink>) => {
    const updated = links.map((l) => (l.id === id ? { ...l, ...updates } : l));
    onUpdateLinks(updated);
  };

  const handleToggleRemove = (id: string) => {
    const updated = links.map((l) =>
      l.id === id ? { ...l, isRemoved: !l.isRemoved } : l
    );
    onUpdateLinks(updated);
  };

  const handleChooseSourceUrl = (id: string, newUrl: string, newAnchor?: string) => {
    const updated = links.map((l) => {
      if (l.id === id) {
        return {
          ...l,
          url: newUrl,
          anchorText: newAnchor || l.anchorText
        };
      }
      return l;
    });
    onUpdateLinks(updated);
  };

  const handleSelectToggle = (id: string) => {
    setSelectedLinkIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllProducts = () => {
    const productIds = eligibleProductLinks.map((l) => l.id);
    if (selectedLinkIds.length === productIds.length) {
      setSelectedLinkIds([]);
    } else {
      setSelectedLinkIds(productIds);
    }
  };

  // Trigger export modal confirmation
  const handleInitiateExport = (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    setExportPendingIds(targetIds);
    setShowConfirmationModal(true);
  };

  const handleConfirmExport = async () => {
    try {
      setIsExporting(true);
      setShowConfirmationModal(false);
      const res = await onExportProducts(exportPendingIds);
      if (res) {
        setExportResultReport({
          created: res.created || 0,
          alreadyExisted: res.alreadyExisted || 0,
          needsReview: res.needsReview || 0,
          failed: res.failed || 0
        });
        setSelectedLinkIds([]);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Export Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-[#99BFF9]/30 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#EEF5FF] text-[#2A548E] rounded-xl border border-[#99BFF9]/40">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-bold text-[#1E232B]">
                Link Review &amp; Product Export
              </h3>
              <p className="text-xs text-[#5A6270]">
                Parsed article links. Export product/affiliate links directly into CMS product entries.
              </p>
            </div>
          </div>

          {/* Bulk Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedLinkIds.length > 0 && (
              <button
                type="button"
                onClick={() => handleInitiateExport(selectedLinkIds)}
                disabled={isExporting}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Export Selected ({selectedLinkIds.length})</span>
              </button>
            )}

            {eligibleProductLinks.length > 0 && (
              <button
                type="button"
                onClick={() => handleInitiateExport(eligibleProductLinks.map((l) => l.id))}
                disabled={isExporting}
                className="px-3.5 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Export All Product Links ({eligibleProductLinks.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 border-t border-stone-100 text-xs">
          <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-500">Total Links</span>
            <div className="text-lg font-bold text-[#1E232B] font-mono-code">{totalCount}</div>
          </div>

          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
            <span className="text-[10px] uppercase font-bold text-purple-700">Product Links</span>
            <div className="text-lg font-bold text-purple-900 font-mono-code">{productCount}</div>
          </div>

          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700">Exported</span>
            <div className="text-lg font-bold text-emerald-900 font-mono-code">{exportedCount}</div>
          </div>

          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-700">Already Existed</span>
            <div className="text-lg font-bold text-amber-900 font-mono-code">{alreadyExistsCount}</div>
          </div>

          <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
            <span className="text-[10px] uppercase font-bold text-emerald-800">Internal</span>
            <div className="text-lg font-bold text-emerald-950 font-mono-code">{internalCount}</div>
          </div>

          <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
            <span className="text-[10px] uppercase font-bold text-sky-700">External</span>
            <div className="text-lg font-bold text-sky-900 font-mono-code">{externalCount}</div>
          </div>
        </div>
      </div>

      {/* Export Results Report Notice */}
      {exportResultReport && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-emerald-900 text-sm">Product Export Results</h4>
              <div className="flex flex-wrap items-center gap-3 text-emerald-800 font-medium">
                <span>Created: <strong>{exportResultReport.created}</strong></span>
                <span>·</span>
                <span>Already Existed: <strong>{exportResultReport.alreadyExisted}</strong></span>
                <span>·</span>
                <span>Needs Review: <strong>{exportResultReport.needsReview}</strong></span>
                <span>·</span>
                <span>Failed: <strong>{exportResultReport.failed}</strong></span>
              </div>
            </div>
          </div>
          {onNavigateToProductsTab && (
            <button
              type="button"
              onClick={() => onNavigateToProductsTab()}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition cursor-pointer shrink-0"
            >
              View Products Tab
            </button>
          )}
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search anchor text, URL, or context..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-[#1E232B] focus:outline-none focus:ring-1 focus:ring-[#2A548E]"
          />
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#5A6270] font-semibold text-[11px]">Source:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-xs text-[#1E232B] focus:outline-none cursor-pointer"
          >
            <option value="all">All Sources</option>
            <option value="markdown">Markdown Only</option>
            <option value="live">Live Page Only</option>
            <option value="both">Both (Reconciled)</option>
          </select>
        </div>

        {/* Classification Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#5A6270] font-semibold text-[11px]">Type:</span>
          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-xs text-[#1E232B] focus:outline-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="product">Product / Merchant</option>
            <option value="internal">Internal Site</option>
            <option value="external">External Reference</option>
            <option value="social">Social</option>
            <option value="media">Media Asset</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        {/* Export Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#5A6270] font-semibold text-[11px]">Export Status:</span>
          <select
            value={exportStatusFilter}
            onChange={(e) => setExportStatusFilter(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-xs text-[#1E232B] focus:outline-none cursor-pointer"
          >
            <option value="all">All Export States</option>
            <option value="not_exported">Not Exported</option>
            <option value="exported">Exported</option>
            <option value="already_exists">Already Exists</option>
            <option value="export_failed">Export Failed</option>
          </select>
        </div>

        {/* Checkbox Select All Toggle for Products */}
        {eligibleProductLinks.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAllProducts}
            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded transition cursor-pointer flex items-center gap-1"
          >
            {selectedLinkIds.length === eligibleProductLinks.length ? (
              <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
            ) : (
              <Square className="w-3.5 h-3.5 text-stone-400" />
            )}
            <span>Select All Products</span>
          </button>
        )}
      </div>

      {/* Links List */}
      <div className="space-y-3">
        {filteredLinks.length === 0 ? (
          <div className="p-8 bg-white border border-stone-200 rounded-xl text-center space-y-2">
            <Link2 className="w-8 h-8 text-stone-300 mx-auto" />
            <h4 className="font-serif-display text-base text-[#1E232B]">No Links Match Filter</h4>
            <p className="text-xs text-[#5A6270]">
              Try adjusting search terms or filters to view parsed links.
            </p>
          </div>
        ) : (
          filteredLinks.map((link) => {
            const isEditing = editingLinkId === link.id;
            const isSelected = selectedLinkIds.includes(link.id);
            const exportStatus: ProductExportStatus = link.exportStatus || 'not_exported';

            return (
              <div
                key={link.id}
                className={`p-4 bg-white border rounded-xl shadow-2xs transition-all space-y-3 ${
                  link.isRemoved
                    ? 'opacity-50 border-stone-200 bg-stone-50'
                    : isSelected
                    ? 'border-purple-300 bg-purple-50/30 ring-1 ring-purple-300'
                    : link.classification === 'product'
                    ? 'border-purple-200 bg-purple-50/10 hover:border-purple-300'
                    : 'border-stone-200 hover:border-[#99BFF9]'
                }`}
              >
                {/* Top Row: Checkbox, Badges & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Select Checkbox for Product/Affiliate links */}
                    {link.classification === 'product' && !link.isRemoved && (
                      <button
                        type="button"
                        onClick={() => handleSelectToggle(link.id)}
                        className="p-1 hover:bg-purple-100 rounded text-purple-700 transition cursor-pointer"
                        title="Select for bulk export"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-purple-600" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400" />
                        )}
                      </button>
                    )}

                    {/* Classification Selector */}
                    <select
                      value={link.classification}
                      onChange={(e) =>
                        handleUpdateLinkItem(link.id, {
                          classification: e.target.value as ImportLinkClassification
                        })
                      }
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded cursor-pointer border ${
                        link.classification === 'product'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : link.classification === 'internal'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : link.classification === 'social'
                          ? 'bg-sky-100 text-sky-800 border-sky-200'
                          : link.classification === 'media'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      <option value="product">Product / Affiliate</option>
                      <option value="internal">Internal</option>
                      <option value="external">External Reference</option>
                      <option value="social">Social</option>
                      <option value="media">Media</option>
                      <option value="unknown">Unknown</option>
                    </select>

                    {/* Highly Visible Export Status Badge */}
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                        exportStatus === 'exported'
                          ? 'bg-emerald-600 text-white font-mono'
                          : exportStatus === 'already_exists'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : exportStatus === 'export_failed'
                          ? 'bg-red-100 text-red-900 border border-red-300'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                    >
                      {exportStatus === 'exported' && <CheckCircle2 className="w-3 h-3 text-white" />}
                      {exportStatus === 'already_exists' && <Info className="w-3 h-3 text-amber-700" />}
                      <span>
                        {exportStatus === 'exported'
                          ? 'EXPORTED'
                          : exportStatus === 'already_exists'
                          ? 'ALREADY EXISTS'
                          : exportStatus === 'export_failed'
                          ? 'EXPORT FAILED'
                          : 'NOT EXPORTED'}
                      </span>
                    </span>

                    {/* Legacy Product Group Badge */}
                    {link.legacyItemId && (
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200">
                        Legacy Item: {link.legacyItemId}
                      </span>
                    )}

                    {/* Source Badge */}
                    <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                      Source: {link.source === 'both' ? 'Markdown + Live' : link.source === 'live' ? 'Live Page' : 'Markdown'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Single Export as Product Button */}
                    {link.classification === 'product' && !link.isRemoved && (
                      <button
                        type="button"
                        onClick={() => handleInitiateExport([link.id])}
                        disabled={isExporting}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Export product link directly into CMS catalog entry"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>{exportStatus === 'exported' ? 'Re-Export' : 'Export as Product'}</span>
                      </button>
                    )}

                    {/* View Created Product Button */}
                    {link.exportedProductId && (
                      <button
                        type="button"
                        onClick={() => onNavigateToProductsTab && onNavigateToProductsTab(link.exportedProductId)}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 border border-emerald-300"
                        title="Open product entry in Products tab"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-700" />
                        <span>Open Product ({link.exportedProductId})</span>
                      </button>
                    )}

                    {/* Edit Toggle */}
                    <button
                      type="button"
                      onClick={() => setEditingLinkId(isEditing ? null : link.id)}
                      className="p-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded transition cursor-pointer"
                      title="Edit anchor text or URL"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove / Restore */}
                    <button
                      type="button"
                      onClick={() => handleToggleRemove(link.id)}
                      className={`p-1 rounded transition cursor-pointer ${
                        link.isRemoved
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                          : 'bg-red-50 hover:bg-red-100 text-red-700'
                      }`}
                      title={link.isRemoved ? 'Restore link' : 'Remove link from export'}
                    >
                      {link.isRemoved ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Edit Form OR View Details */}
                {isEditing ? (
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 space-y-2 text-xs">
                    <div>
                      <label className="block font-semibold text-[#1E232B] mb-1">Anchor Text:</label>
                      <input
                        type="text"
                        value={link.anchorText}
                        onChange={(e) => handleUpdateLinkItem(link.id, { anchorText: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-medium text-[#1E232B]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#1E232B] mb-1">URL:</label>
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => handleUpdateLinkItem(link.id, { url: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-mono text-xs text-[#2A548E]"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingLinkId(null)}
                        className="px-3 py-1 bg-[#2A548E] text-white font-semibold rounded hover:bg-[#1B365D]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div>
                      <span className="font-bold text-[#1E232B] text-sm mr-2">
                        {link.anchorText || '<No Anchor Text>'}
                      </span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A548E] hover:underline inline-flex items-center gap-1 font-mono text-xs break-all"
                      >
                        {link.url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    {link.contextSnippet && (
                      <p className="text-xs text-[#5A6270] italic bg-stone-50 p-2 rounded border border-stone-100 font-serif">
                        "...{link.contextSnippet}..."
                      </p>
                    )}

                    {link.duplicateReason && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                        <strong>Duplicate Detection:</strong> {link.duplicateReason}
                      </p>
                    )}

                    {link.liveUrlAlternative && link.liveUrlAlternative !== link.url && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong>Live Page Link Text Differs:</strong> "{link.liveUrlAlternative}"
                        </div>
                        <button
                          type="button"
                          onClick={() => handleChooseSourceUrl(link.id, link.url, link.liveUrlAlternative)}
                          className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Use Live Page Anchor
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal Before Bulk/Single Export */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif-display text-lg font-bold text-[#1E232B]">
                  Confirm Product Export
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Exporting {exportPendingIds.length} selected product links into CMS entries.
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1.5">
              <p>
                <strong>Links to export:</strong> {exportPendingIds.length} items selected.
              </p>
              <p>
                Duplicate protection will scan site/_data/products.yml and existing draft entries before writing.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmExport}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-2xs"
              >
                Confirm Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

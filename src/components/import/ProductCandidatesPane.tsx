import React, { useState } from 'react';
import {
  Package,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Edit2,
  Trash2,
  Check,
  X,
  Plus,
  DollarSign,
  Tag,
  Store,
  Layers,
  Image as ImageIcon,
  Copy,
  Info
} from 'lucide-react';
import {
  DetectedProductCandidate,
  ProductDraftItem,
  ProductDraftState,
  ImportLinkSource
} from '../../types/import';

interface ProductCandidatesPaneProps {
  candidates: DetectedProductCandidate[];
  productDrafts: ProductDraftItem[];
  onCreateDraftFromCandidate: (candidate: DetectedProductCandidate) => void;
  onUpdateProductDraft: (draftId: string, updates: Partial<ProductDraftItem>) => void;
  onDeleteProductDraft: (draftId: string) => void;
  onApproveProductDraft: (draftId: string) => void;
  onRejectCandidate: (candidateId: string) => void;
  onOpenCmsProduct?: (productId: string) => void;
}

export const ProductCandidatesPane: React.FC<ProductCandidatesPaneProps> = ({
  candidates = [],
  productDrafts = [],
  onCreateDraftFromCandidate,
  onUpdateProductDraft,
  onDeleteProductDraft,
  onApproveProductDraft,
  onRejectCandidate,
  onOpenCmsProduct
}) => {
  const [activeTab, setActiveTab] = useState<'candidates' | 'drafts'>('candidates');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Summary counts
  const totalCandidates = candidates.length;
  const draftCreatedCount = productDrafts.length;
  const approvedCount = productDrafts.filter(d => d.state === 'approved').length;
  const duplicateMatchesCount = candidates.filter(c => c.existingCmsProduct).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Stats Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#99BFF9]/30 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 text-purple-800 rounded-xl border border-purple-200">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif-display text-lg font-bold text-[#1E232B]">
                Discovered Products &amp; Drafts
              </h3>
              <p className="text-xs text-[#5A6270]">
                Discovered Fourthwall &amp; merchant products converted into pre-populated CMS drafts.
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('candidates')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'candidates'
                  ? 'bg-white text-[#1E232B] shadow-2xs'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <span>Discovered Candidates ({totalCandidates})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('drafts')}
              className={`px-3 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'drafts'
                  ? 'bg-white text-[#2A548E] shadow-2xs'
                  : 'text-[#5A6270] hover:text-[#1E232B]'
              }`}
            >
              <span>Created Product Drafts ({draftCreatedCount})</span>
              {approvedCount > 0 && (
                <span className="bg-emerald-600 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {approvedCount} Approved
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-stone-100 text-xs">
          <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
            <span className="text-[10px] uppercase font-bold text-purple-800">Candidates Found</span>
            <div className="text-lg font-bold text-purple-950 font-mono-code">{totalCandidates}</div>
          </div>

          <div className="p-2.5 bg-[#EEF5FF] rounded-lg border border-[#99BFF9]/30">
            <span className="text-[10px] uppercase font-bold text-[#2A548E]">Draft Entries</span>
            <div className="text-lg font-bold text-[#2A548E] font-mono-code">{draftCreatedCount}</div>
          </div>

          <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800">Approved</span>
            <div className="text-lg font-bold text-emerald-900 font-mono-code">{approvedCount}</div>
          </div>

          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-800">CMS Catalog Matches</span>
            <div className="text-lg font-bold text-amber-900 font-mono-code">{duplicateMatchesCount}</div>
          </div>
        </div>
      </div>

      {/* SECTION 1: DISCOVERED CANDIDATES */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {candidates.length === 0 ? (
            <div className="p-8 bg-white border border-stone-200 rounded-xl text-center space-y-2">
              <Package className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="font-serif-display text-base text-[#1E232B]">No Product Candidates Detected</h4>
              <p className="text-xs text-[#5A6270]">
                No merchant links or priced list items were automatically flagged in this document.
              </p>
            </div>
          ) : (
            candidates.map((cand) => {
              const hasDraft = productDrafts.some(d => d.candidateId === cand.id || d.vendorUrl === cand.url);

              return (
                <div
                  key={cand.id}
                  className={`p-4 bg-white border rounded-xl shadow-2xs space-y-3 transition-all ${
                    hasDraft
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : cand.existingCmsProduct
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-stone-200 hover:border-[#99BFF9]'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Confidence Badge */}
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        cand.confidence === 'high'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : cand.confidence === 'medium'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}>
                        Confidence: {cand.confidence}
                      </span>

                      {/* Source Badge */}
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Source: {cand.source === 'both' ? 'Markdown + Live Page' : cand.source === 'live' ? 'Live Page' : 'Markdown'}
                      </span>

                      {/* State Badge */}
                      {hasDraft && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Draft Created</span>
                        </span>
                      )}
                    </div>

                    {/* Action Button: Create Product Entry */}
                    {!hasDraft ? (
                      <button
                        type="button"
                        onClick={() => onCreateDraftFromCandidate(cand)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Product Entry</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('drafts')}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#2A548E] text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <span>View Draft Entry</span>
                      </button>
                    )}
                  </div>

                  {/* Main Product Card Content */}
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    {/* Image Thumbnail if available */}
                    {cand.image ? (
                      <img
                        src={cand.image}
                        alt={cand.imageAlt || cand.name}
                        className="w-20 h-20 object-cover rounded-lg border border-stone-200 shrink-0 bg-stone-50"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-stone-100 border border-stone-200 rounded-lg shrink-0 flex flex-col items-center justify-center text-stone-400 text-[10px] text-center p-1">
                        <ImageIcon className="w-5 h-5 mb-1" />
                        <span>No Image</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-[#1E232B] text-sm">
                          {cand.name}
                        </h4>
                        {cand.price && (
                          <span className="font-mono-code font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200 shrink-0">
                            {cand.price}
                          </span>
                        )}
                      </div>

                      <a
                        href={cand.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#2A548E] hover:underline inline-flex items-center gap-1 font-mono text-xs break-all"
                      >
                        {cand.url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>

                      {cand.description && (
                        <p className="text-xs text-[#5A6270] italic line-clamp-2 pt-1 font-serif">
                          "{cand.description}"
                        </p>
                      )}

                      <p className="text-[11px] text-stone-500 pt-1 font-mono">
                        <strong>Reason:</strong> {cand.detectionReason}
                      </p>
                    </div>
                  </div>

                  {/* CMS Catalog Duplicate Alert */}
                  {cand.existingCmsProduct && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Duplicate Detected in CMS Catalog:</strong> "{cand.existingCmsProduct.title}" ({cand.existingCmsProduct.price || 'No price'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onOpenCmsProduct && (
                          <button
                            type="button"
                            onClick={() => onOpenCmsProduct(cand.existingCmsProduct!.id)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold cursor-pointer flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open in Product Editor</span>
                          </button>
                        )}
                        <span className="text-[11px] text-amber-800 italic">
                          Click "Create Product Entry" to overwrite or create variant draft.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 2: CREATED PRODUCT DRAFTS */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          {productDrafts.length === 0 ? (
            <div className="p-8 bg-white border border-stone-200 rounded-xl text-center space-y-2">
              <Package className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="font-serif-display text-base text-[#1E232B]">No Product Drafts Created Yet</h4>
              <p className="text-xs text-[#5A6270]">
                Switch to "Discovered Candidates" tab and click "Create Product Entry" to generate pre-populated drafts.
              </p>
            </div>
          ) : (
            productDrafts.map((draftItem) => {
              const isEditing = editingDraftId === draftItem.id;

              return (
                <div
                  key={draftItem.id}
                  className={`p-5 bg-white border rounded-xl shadow-2xs space-y-4 ${
                    draftItem.state === 'approved'
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : 'border-stone-200'
                  }`}
                >
                  {/* Draft Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        draftItem.state === 'approved'
                          ? 'bg-emerald-600 text-white'
                          : draftItem.state === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}>
                        State: {draftItem.state.replace('_', ' ')}
                      </span>

                      <span className="text-[10px] font-mono uppercase bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                        Vendor: {draftItem.vendor}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {draftItem.state !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => onApproveProductDraft(draftItem.id)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Product Entry</span>
                        </button>
                      ) : (
                        onOpenCmsProduct && (
                          <button
                            type="button"
                            onClick={() => onOpenCmsProduct(draftItem.id)}
                            className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1 border border-emerald-300"
                          >
                            <ExternalLink className="w-3 h-3 text-emerald-700" />
                            <span>Open in Product Editor</span>
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => setEditingDraftId(isEditing ? null : draftItem.id)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEditing ? 'Close Form' : 'Edit Entry'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteProductDraft(draftItem.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition cursor-pointer"
                        title="Delete draft entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Editing Form OR View Details */}
                  {isEditing ? (
                    <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Product Title:</label>
                          <input
                            type="text"
                            value={draftItem.title}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { title: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-bold text-[#1E232B]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Vendor Name:</label>
                          <input
                            type="text"
                            value={draftItem.vendor || ''}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { vendor: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded text-[#1E232B]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Vendor Link URL:</label>
                          <input
                            type="text"
                            value={draftItem.vendorUrl}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { vendorUrl: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-mono text-xs text-[#2A548E]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Display Price ($):</label>
                          <input
                            type="text"
                            value={draftItem.price || ''}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { price: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-semibold text-emerald-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Image Asset/URL:</label>
                          <input
                            type="text"
                            value={draftItem.image || ''}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { image: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-[#1E232B] mb-1">Price Range Tier:</label>
                          <select
                            value={draftItem.priceRange || '50-100'}
                            onChange={(e) => onUpdateProductDraft(draftItem.id, { priceRange: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded text-[#1E232B]"
                          >
                            <option value="under-25">Under $25</option>
                            <option value="25-50">$25 - $50</option>
                            <option value="50-100">$50 - $100</option>
                            <option value="100-250">$100 - $250</option>
                            <option value="splurge">Splurge ($250+)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-[#1E232B] mb-1">Editorial Description / Review:</label>
                        <textarea
                          rows={3}
                          value={draftItem.description || ''}
                          onChange={(e) => onUpdateProductDraft(draftItem.id, { description: e.target.value })}
                          className="w-full p-2.5 bg-white border border-stone-300 rounded text-[#1E232B]"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingDraftId(null)}
                          className="px-4 py-1.5 bg-[#2A548E] text-white font-semibold rounded hover:bg-[#1B365D]"
                        >
                          Save Draft Edits
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-4 items-start text-xs">
                      {draftItem.image ? (
                        <img
                          src={draftItem.image}
                          alt={draftItem.imageAlt || draftItem.title}
                          className="w-24 h-24 object-cover rounded-lg border border-stone-200 shrink-0 bg-stone-50"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-stone-100 border border-stone-200 rounded-lg shrink-0 flex flex-col items-center justify-center text-stone-400 text-[10px]">
                          <ImageIcon className="w-6 h-6 mb-1" />
                          <span>No Image</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-[#1E232B] text-base">
                              {draftItem.title}
                            </h4>
                            <p className="text-stone-500 font-mono text-[11px]">
                              Category: <strong className="text-[#2A548E]">{draftItem.category || 'editors-pick'}</strong>
                            </p>
                          </div>

                          {draftItem.price && (
                            <span className="font-mono-code font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md text-sm border border-emerald-200 shrink-0">
                              {draftItem.price}
                            </span>
                          )}
                        </div>

                        <a
                          href={draftItem.vendorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2A548E] hover:underline inline-flex items-center gap-1 font-mono break-all"
                        >
                          {draftItem.vendorUrl}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>

                        {draftItem.description && (
                          <p className="text-[#5A6270] leading-relaxed font-serif italic bg-stone-50 p-2.5 rounded border border-stone-100">
                            "{draftItem.description}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

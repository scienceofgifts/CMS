import React, { useState } from 'react';
import {
  FileText,
  BookOpen,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Package,
  Eye,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Layers,
  Clock,
  User,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';
import {
  ImportFileItem,
  ImportDraft,
  StructuredArticleLink,
  DetectedProductCandidate,
  ProductDraftItem,
  CreatedPostInfo
} from '../../types/import';

interface MigrationOverviewPaneProps {
  item: ImportFileItem;
  draft: ImportDraft;
  onCreatePost: () => Promise<any>;
  onSwitchTab: (tab: string) => void;
}

export const MigrationOverviewPane: React.FC<MigrationOverviewPaneProps> = ({
  item,
  draft,
  onCreatePost,
  onSwitchTab
}) => {
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [createdPostResult, setCreatedPostResult] = useState<CreatedPostInfo | null>(
    draft.createdPostInfo || item.createdPostInfo || null
  );

  const structuredLinks = draft.structuredLinks || item.analysis?.structuredLinks || [];
  const productCandidates = draft.productCandidates || item.analysis?.productCandidates || [];
  const productDrafts = draft.productDrafts || [];
  const issues = item.analysis?.issues || [];
  const unresolvedIssues = issues.filter(
    (iss) => (iss.severity === 'error' || iss.severity === 'warning') && !draft.resolvedIssueIds.includes(iss.id)
  );

  const exportedProductsCount = structuredLinks.filter((l) => l.exportStatus === 'exported' || l.exportStatus === 'already_exists').length;
  const totalProductLinksCount = structuredLinks.filter((l) => l.classification === 'product').length;

  // Readiness Checklist Evaluation
  const checks = [
    {
      key: 'content',
      label: 'Article Title & Reader Content',
      passed: !!draft.title && draft.title.length > 3 && !!draft.body,
      critical: true,
      note: draft.title ? `Title: "${draft.title}"` : 'Missing reader title'
    },
    {
      key: 'seo',
      label: 'SEO SERP Title & Description',
      passed: !!draft.searchTitle && !!draft.seoDescription,
      critical: false,
      note: draft.searchTitle ? `${draft.searchTitle.length} chars SERP title` : 'Missing search title'
    },
    {
      key: 'links',
      label: 'Article Links Reviewed',
      passed: structuredLinks.length > 0,
      critical: false,
      note: `${structuredLinks.length} links parsed across sources`
    },
    {
      key: 'products',
      label: 'Product/Merchant Links Processed',
      passed: totalProductLinksCount === 0 || exportedProductsCount > 0,
      critical: false,
      note: `${exportedProductsCount} of ${totalProductLinksCount} product links processed`
    },
    {
      key: 'issues',
      label: 'Warnings & Field Mappings',
      passed: unresolvedIssues.length === 0,
      critical: false,
      note: unresolvedIssues.length === 0 ? 'All warnings resolved' : `${unresolvedIssues.length} unresolved warning(s)`
    }
  ];

  const isReadyToCreatePost = checks.every((c) => !c.critical || c.passed);

  const handleApproveAndCreatePost = async () => {
    try {
      setIsCreatingPost(true);
      const res = await onCreatePost();
      if (res && res.createdPost) {
        setCreatedPostResult(res.createdPost);
      }
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setIsCreatingPost(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner: Post Created Notice vs Primary Action */}
      {createdPostResult ? (
        <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-2xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 font-mono">
                  Migration Status: POST CREATED
                </span>
                <h3 className="font-serif-display text-xl font-bold text-emerald-950 mt-1">
                  Draft Post Successfully Created in CMS
                </h3>
                <p className="text-xs text-emerald-800">
                  Created as an unpublished {createdPostResult.postType} draft at{' '}
                  <code className="font-mono text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                    {createdPostResult.postPath}
                  </code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/#/editor?file=${encodeURIComponent(createdPostResult.postPath)}`}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>Open Post Editor</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="text-xs text-emerald-800 bg-emerald-100/60 p-3 rounded-xl border border-emerald-200">
            <strong>Traceability Preserved:</strong> This migration draft remains saved in session. Click "Open Post Editor" to make final editorial tweaks before publishing.
          </div>
        </div>
      ) : (
        <div className="p-6 bg-white border border-[#99BFF9]/40 rounded-2xl shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#EEF5FF] text-[#2A548E] rounded-xl border border-[#99BFF9]/40">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded ${
                  isReadyToCreatePost
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}>
                  Status: {isReadyToCreatePost ? 'Ready to Create Post' : 'Needs Review'}
                </span>
                <h3 className="font-serif-display text-xl font-bold text-[#1E232B] mt-1">
                  Migration Workspace Overview
                </h3>
                <p className="text-xs text-[#5A6270]">
                  Review readiness checklist and convert approved draft into a new Jekyll CMS post.
                </p>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleApproveAndCreatePost}
              disabled={isCreatingPost || !isReadyToCreatePost}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
                isReadyToCreatePost
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-stone-200 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{isCreatingPost ? 'Creating Post...' : 'Approve & Create Post'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid: Details & Readiness Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Readiness Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
            <h4 className="font-serif-display text-base font-bold text-[#1E232B] flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[#2A548E]" />
              <span>Migration Readiness Checklist</span>
            </h4>

            <div className="space-y-2.5 text-xs">
              {checks.map((check) => (
                <div
                  key={check.key}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    check.passed
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                      : check.critical
                      ? 'bg-red-50/50 border-red-200 text-red-950'
                      : 'bg-amber-50/50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {check.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold">{check.label}</span>
                      <span className="text-[11px] block opacity-80">{check.note}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    check.passed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {check.passed ? 'Verified' : 'Needs Review'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Workspace Switchers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onSwitchTab('editor')}
              className="p-3 bg-white hover:bg-[#EEF5FF] text-[#2A548E] border border-stone-200 rounded-xl transition text-center space-y-1 cursor-pointer"
            >
              <FileText className="w-5 h-5 mx-auto text-[#2A548E]" />
              <span>Edit Document</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab('preview')}
              className="p-3 bg-white hover:bg-[#EEF5FF] text-[#2A548E] border border-stone-200 rounded-xl transition text-center space-y-1 cursor-pointer"
            >
              <Eye className="w-5 h-5 mx-auto text-[#2A548E]" />
              <span>Rendered Preview</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab('links')}
              className="p-3 bg-white hover:bg-purple-50 text-purple-800 border border-stone-200 rounded-xl transition text-center space-y-1 cursor-pointer"
            >
              <Package className="w-5 h-5 mx-auto text-purple-600" />
              <span>Links &amp; Export</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchTab('products')}
              className="p-3 bg-white hover:bg-purple-50 text-purple-800 border border-stone-200 rounded-xl transition text-center space-y-1 cursor-pointer"
            >
              <Package className="w-5 h-5 mx-auto text-purple-600" />
              <span>Products ({productDrafts.length})</span>
            </button>
          </div>
        </div>

        {/* Right Column: Source & Draft Metadata Summary */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3 text-xs">
            <h4 className="font-serif-display text-sm font-bold text-[#1E232B] border-b border-stone-100 pb-2">
              Source &amp; Destination Info
            </h4>

            <div className="space-y-2 text-[#5A6270]">
              <div>
                <span className="font-semibold text-[#1E232B] block">Filename:</span>
                <code className="font-mono text-[11px] text-[#2A548E]">{item.filename}</code>
              </div>

              <div>
                <span className="font-semibold text-[#1E232B] block">Destination Content Type:</span>
                <span className="capitalize font-semibold text-[#2A548E]">
                  {draft.targetType === 'guide' ? 'Gift Guide (_guides/)' : 'Editorial Article (_articles/)'}
                </span>
              </div>

              {item.liveUrl && (
                <div>
                  <span className="font-semibold text-[#1E232B] block">Live Page URL:</span>
                  <a
                    href={item.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2A548E] underline truncate block font-mono text-[11px]"
                  >
                    {item.liveUrl}
                  </a>
                </div>
              )}

              <div>
                <span className="font-semibold text-[#1E232B] block">Category Taxonomy:</span>
                <span>{draft.category || 'Gift Psychology'}</span>
              </div>

              <div>
                <span className="font-semibold text-[#1E232B] block">Author Attribution:</span>
                <span>{draft.authorName || 'Editorial Staff'}</span>
              </div>

              <div>
                <span className="font-semibold text-[#1E232B] block">Word Count:</span>
                <span>{item.analysis?.bodyStats?.wordCount || 0} words</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

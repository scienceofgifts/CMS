import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
  Check,
  RotateCcw,
  Layers,
  FileText,
  Globe,
  Tag
} from 'lucide-react';
import {
  ImportIssue,
  ImportDraft
} from '../../types/import';

interface ActionableIssuesListProps {
  issues: ImportIssue[];
  draft: ImportDraft;
  onToggleResolve: (issueId: string, resolved: boolean) => void;
  onActionRemap?: (oldKey: string, newKey: string) => void;
  onActionSetType?: (type: 'guide' | 'article' | 'page') => void;
  onActionDemoteH1?: () => void;
  onActionCopyTitleToSearchTitle?: () => void;
  onActionCopyDeckToSeoDesc?: () => void;
  onActionAppendSlug?: () => void;
  onSwitchTab?: (tab: string) => void;
}

export function ActionableIssuesList({
  issues,
  draft,
  onToggleResolve,
  onActionRemap,
  onActionSetType,
  onActionDemoteH1,
  onActionCopyTitleToSearchTitle,
  onActionCopyDeckToSeoDesc,
  onActionAppendSlug,
  onSwitchTab
}: ActionableIssuesListProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  const resolvedIds = new Set(draft.resolvedIssueIds || []);

  const activeIssues = issues.filter(iss => !resolvedIds.has(iss.id));
  const resolvedIssues = issues.filter(iss => resolvedIds.has(iss.id));

  const filteredIssues = issues.filter(iss => {
    if (filter === 'active') return !resolvedIds.has(iss.id);
    if (filter === 'resolved') return resolvedIds.has(iss.id);
    return true;
  });

  return (
    <div className="bg-white border border-[#99BFF9]/35 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h4 className="font-serif-display text-base font-medium text-[#1E232B] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Actionable Import Warnings &amp; Issues</span>
          </h4>
          <p className="text-xs text-[#5A6270] mt-0.5">
            Resolve issues directly inline or take recommended editorial actions. Resolved issues are recorded in the draft.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
              filter === 'all' ? 'bg-[#2A548E] text-white shadow-2xs' : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
            }`}
          >
            All ({issues.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
              filter === 'active' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
            }`}
          >
            Active ({activeIssues.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('resolved')}
            className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
              filter === 'resolved' ? 'bg-[#226E56] text-white shadow-2xs' : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
            }`}
          >
            Resolved ({resolvedIssues.length})
          </button>
        </div>
      </div>

      {/* List */}
      {filteredIssues.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#226E56] mx-auto" />
          <h5 className="font-serif-display text-sm font-medium text-[#1E232B]">
            {filter === 'active' ? 'All Issues Resolved!' : 'No Issues Found'}
          </h5>
          <p className="text-xs text-[#5A6270] max-w-sm mx-auto">
            {filter === 'active'
              ? 'All warnings and unknown fields have been addressed in this draft.'
              : 'This document adheres cleanly to the Science of Gifts CMS contract.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map(issue => {
            const isResolved = resolvedIds.has(issue.id);

            return (
              <div
                key={issue.id}
                className={`p-4 rounded-xl border transition-all ${
                  isResolved
                    ? 'bg-stone-50/70 border-stone-200/80 opacity-80'
                    : issue.severity === 'error'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : issue.severity === 'warning'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-[#EEF5FF]/70 border-[#99BFF9]/40 text-slate-800'
                }`}
              >
                {/* Title Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5">
                  <div className="flex items-center gap-2">
                    {isResolved ? (
                      <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
                    ) : issue.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-[#2A548E] shrink-0" />
                    )}
                    <span className={`font-bold text-xs ${isResolved ? 'line-through text-stone-600' : ''}`}>
                      {issue.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isResolved ? (
                      <span className="text-[10px] font-mono-code font-bold text-[#154D3B] bg-[#E8F8F1] px-2 py-0.5 rounded border border-[#226E56]/20">
                        Resolved ✓
                      </span>
                    ) : (
                      <span className={`text-[10px] uppercase font-mono-code font-bold px-2 py-0.5 rounded ${
                        issue.severity === 'error'
                          ? 'bg-rose-200 text-rose-800'
                          : issue.severity === 'warning'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-blue-200 text-blue-800'
                      }`}>
                        {issue.severity}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onToggleResolve(issue.id, !isResolved)}
                      className="text-[11px] font-medium text-stone-600 hover:text-stone-900 px-2 py-0.5 bg-white border border-stone-200 rounded cursor-pointer transition-colors shadow-2xs"
                    >
                      {isResolved ? 'Reopen' : 'Mark Resolved'}
                    </button>
                  </div>
                </div>

                {/* Message */}
                <p className={`text-xs leading-relaxed ${isResolved ? 'text-stone-500' : ''}`}>
                  {issue.message}
                </p>

                {/* Remedy & Inline Action Controls */}
                <div className="mt-2.5 pt-2 border-t border-stone-200/50 flex flex-wrap items-center justify-between gap-2">
                  {issue.suggestion && (
                    <div className="text-[11px] text-[#5A6270] flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 text-[#2A548E] shrink-0" />
                      <span>{issue.suggestion}</span>
                    </div>
                  )}

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Unknown Field Actions */}
                    {issue.actionType === 'map_field' && issue.actionPayload?.oldKey && (() => {
                      const oldKey = issue.actionPayload.oldKey;
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (onActionRemap) onActionRemap(oldKey, '(ignore)');
                              onToggleResolve(issue.id, true);
                            }}
                            className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-semibold rounded cursor-pointer transition-colors"
                          >
                            Ignore Field
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (onSwitchTab) onSwitchTab('mapping');
                            }}
                            className="px-2 py-0.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                          >
                            Select Mapping →
                          </button>
                        </>
                      );
                    })()}

                    {/* H1 Demote Action */}
                    {issue.actionType === 'demote_h1' && onActionDemoteH1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionDemoteH1();
                          onToggleResolve(issue.id, true);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                      >
                        Demote H1 to H2 in Body
                      </button>
                    )}

                    {/* Search Title Action */}
                    {issue.actionType === 'set_search_title' && onActionCopyTitleToSearchTitle && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionCopyTitleToSearchTitle();
                          onToggleResolve(issue.id, true);
                        }}
                        className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                      >
                        Copy from Reader Title
                      </button>
                    )}

                    {/* SEO Desc Action */}
                    {issue.actionType === 'set_seo_desc' && onActionCopyDeckToSeoDesc && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionCopyDeckToSeoDesc();
                          onToggleResolve(issue.id, true);
                        }}
                        className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                      >
                        Copy from Reader Deck
                      </button>
                    )}

                    {/* Slug Conflict Action */}
                    {issue.actionType === 'fix_slug' && onActionAppendSlug && (
                      <button
                        type="button"
                        onClick={() => {
                          onActionAppendSlug();
                          onToggleResolve(issue.id, true);
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded cursor-pointer transition-colors"
                      >
                        Append "-imported" to Slug
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

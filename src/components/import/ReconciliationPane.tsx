import React from 'react';
import {
  Globe,
  FileText,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Check,
  Zap,
  Info
} from 'lucide-react';
import {
  ImportFileItem,
  ImportDraft,
  ReconciliationFieldDiff,
  LivePageImage
} from '../../types/import';

interface ReconciliationPaneProps {
  item: ImportFileItem;
  draft: ImportDraft;
  onUpdateDraft: (updated: Partial<ImportDraft>) => void;
  onAdoptDiffField: (field: string, value: any, source: 'live' | 'markdown') => Promise<void>;
  onRefetchUrl?: () => void;
  isRefetching?: boolean;
}

export const ReconciliationPane: React.FC<ReconciliationPaneProps> = ({
  item,
  draft,
  onUpdateDraft,
  onAdoptDiffField,
  onRefetchUrl,
  isRefetching = false
}) => {
  const report = item.reconciliationReport;
  const liveData = item.livePageData;

  if (!liveData && item.urlFetchStatus === 'failed') {
    return (
      <div className="p-8 text-center bg-amber-500/5 rounded-2xl border border-amber-500/20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h3 className="text-lg font-serif font-bold text-stone-100 mb-2">Live Page Could Not Be Reconciled</h3>
        <p className="text-sm text-stone-400 max-w-lg mx-auto mb-6">
          {item.urlFetchError || 'The live page could not be reached. You can continue reviewing and editing the Markdown draft.'}
        </p>
        {onRefetchUrl && (
          <button
            type="button"
            onClick={onRefetchUrl}
            disabled={isRefetching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Retrying Fetch...' : 'Retry URL Fetch'}
          </button>
        )}
      </div>
    );
  }

  if (!report || !liveData) {
    return (
      <div className="p-8 text-center bg-stone-900/40 rounded-2xl border border-stone-800">
        <Globe className="w-12 h-12 text-stone-600 mx-auto mb-4" />
        <h3 className="text-lg font-serif font-bold text-stone-200 mb-2">No Live URL Attached</h3>
        <p className="text-sm text-stone-400 max-w-md mx-auto mb-6">
          Attach a live article URL to compare published content with legacy Markdown source and auto-reconcile differences.
        </p>
      </div>
    );
  }

  // Handle adopting all missing enrichments
  const enrichableDiffs = report.fieldDiffs.filter(
    d => d.status === 'missing_in_markdown' && d.liveUrlValue
  );

  const handleAdoptAllEnrichments = async () => {
    for (const diff of enrichableDiffs) {
      await onAdoptDiffField(diff.field, diff.liveUrlValue, 'live');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Source Status & Stats */}
      <div className="bg-stone-900/80 rounded-2xl p-6 border border-stone-800 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Globe className="w-3.5 h-3.5" />
                Live URL Reconciled
              </span>
              <span className="text-xs text-stone-400 font-mono">
                HTTP {liveData.httpStatus || 200} • Fetched {liveData.fetchedAt ? new Date(liveData.fetchedAt).toLocaleTimeString() : 'Just now'}
              </span>
            </div>
            <a
              href={liveData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1.5 transition break-all"
            >
              {liveData.url}
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {enrichableDiffs.length > 0 && (
              <button
                type="button"
                onClick={handleAdoptAllEnrichments}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                Adopt All Live Enrichments ({enrichableDiffs.length})
              </button>
            )}

            {onRefetchUrl && (
              <button
                type="button"
                onClick={onRefetchUrl}
                disabled={isRefetching}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                {isRefetching ? 'Refreshing...' : 'Re-fetch URL'}
              </button>
            )}
          </div>
        </div>

        {/* Comparison Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800/80">
            <span className="text-xs uppercase tracking-wider text-stone-300 font-semibold block mb-1">Total Fields Compared</span>
            <span className="text-2xl font-serif font-bold text-stone-100">{report.totalCompared}</span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold block mb-1">Identical Values</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-emerald-300">{report.identicalCount}</span>
              <span className="text-xs text-emerald-500">Consistent</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold block mb-1">Discrepancies</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-amber-300">{report.differingCount}</span>
              <span className="text-xs text-amber-500">Require Review</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/15">
            <span className="text-xs uppercase tracking-wider text-sky-400 font-semibold block mb-1">Live Enrichments</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-sky-300">{report.missingInMarkdownCount}</span>
              <span className="text-xs text-sky-500">Found on Live URL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Field Reconciliation Table */}
      <div className="bg-stone-900/80 rounded-2xl border border-stone-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="font-serif font-bold text-stone-100 text-base">Metadata & Editorial Reconciliation</h3>
          </div>
          <span className="text-xs text-stone-400">
            Click &quot;Use Live&quot; or &quot;Keep Markdown&quot; to apply to draft
          </span>
        </div>

        <div className="divide-y divide-stone-800/80">
          {report.fieldDiffs.map((diff) => {
            const isImageField = diff.field === 'heroImageType';
            const isAdoptedLive = diff.adoptedSource === 'live';
            const isAdoptedMd = diff.adoptedSource === 'markdown';

            return (
              <div
                key={diff.field}
                className={`p-5 transition ${
                  diff.status === 'different'
                    ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]'
                    : diff.status === 'missing_in_markdown'
                    ? 'bg-sky-500/[0.03] hover:bg-sky-500/[0.06]'
                    : 'hover:bg-stone-800/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                      {diff.field}
                    </span>
                    <span className="text-sm font-medium text-stone-200">{diff.label}</span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {diff.status === 'identical' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Identical
                      </span>
                    )}
                    {diff.status === 'different' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        Discrepancy
                      </span>
                    )}
                    {diff.status === 'missing_in_markdown' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Sparkles className="w-3 h-3" />
                        Live Enrichment
                      </span>
                    )}
                    {diff.status === 'missing_in_live' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-stone-400">
                        Only in Markdown
                      </span>
                    )}

                    {isAdoptedLive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        Adopted Live Value
                      </span>
                    )}
                  </div>
                </div>

                {/* Values Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Markdown Source Value */}
                  <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80">
                    <div className="flex items-center justify-between text-xs text-stone-300 font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        Markdown Source
                      </span>
                      {diff.markdownValue && (
                        <button
                          type="button"
                          onClick={() => onAdoptDiffField(diff.field, diff.markdownValue, 'markdown')}
                          className="text-[11px] text-stone-400 hover:text-stone-200 transition underline cursor-pointer"
                        >
                          Use Markdown
                        </button>
                      )}
                    </div>
                    {isImageField && diff.markdownValue ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-stone-800 overflow-hidden shrink-0 border border-stone-700 flex items-center justify-center">
                          {String(diff.markdownValue).startsWith('http') ? (
                            <img src={diff.markdownValue} alt="Hero" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-stone-500" />
                          )}
                        </div>
                        <span className="font-mono text-xs text-stone-300 break-all">{diff.markdownValue}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
                        {diff.markdownValue !== undefined && diff.markdownValue !== '' ? (
                          String(diff.markdownValue)
                        ) : (
                          <span className="text-stone-300 italic font-sans font-medium">(Not defined in Markdown)</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Live URL Value */}
                  <div className="p-3.5 rounded-xl bg-stone-950/70 border border-stone-800/80">
                    <div className="flex items-center justify-between text-xs text-stone-300 font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Live Webpage (Rendered)
                      </span>
                      {diff.liveUrlValue && (
                        <button
                          type="button"
                          onClick={() => onAdoptDiffField(diff.field, diff.liveUrlValue, 'live')}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                        >
                          <Zap className="w-3 h-3" />
                          Use Live Value
                        </button>
                      )}
                    </div>
                    {isImageField && diff.liveUrlValue ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded bg-stone-800 overflow-hidden shrink-0 border border-stone-700 flex items-center justify-center">
                          {String(diff.liveUrlValue).startsWith('http') ? (
                            <img src={diff.liveUrlValue} alt="Live Hero" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-stone-500" />
                          )}
                        </div>
                        <span className="font-mono text-xs text-emerald-300 break-all">{diff.liveUrlValue}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
                        {diff.liveUrlValue !== undefined && diff.liveUrlValue !== '' ? (
                          <span className={diff.status !== 'identical' ? 'text-emerald-300' : 'text-stone-300'}>
                            {String(diff.liveUrlValue)}
                          </span>
                        ) : (
                          <span className="text-stone-300 italic font-sans font-medium">(Not found on live page)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Editorial Observation / Note */}
                {diff.editorialNote && (
                  <div className="mt-2 text-[11px] text-stone-400 flex items-center gap-1.5 pl-1">
                    <Info className="w-3 h-3 text-stone-500 shrink-0" />
                    <span>{diff.editorialNote}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Heading Structure Comparison */}
      {report.headingDiffs && (
        <div className="bg-stone-900/80 rounded-2xl border border-stone-800 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold text-stone-100 text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Article Heading Structure Comparison
            </h3>
            <span className="text-xs text-stone-400">
              {report.headingDiffs.common.length} matching sections • {report.headingDiffs.inLiveOnly.length} live additions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block mb-3">
                Markdown Source Headings
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(item.analysis?.cleanedBody || item.rawContent)
                  .split('\n')
                  .filter(l => l.startsWith('#'))
                  .map((h, i) => (
                    <div key={i} className="text-xs font-mono text-stone-300 pl-2 border-l border-amber-500/40 truncate">
                      {h}
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block mb-3">
                Live Webpage Headings (Rendered)
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {liveData.content.headings.map((h, i) => (
                  <div key={i} className="text-xs font-mono text-emerald-300 pl-2 border-l border-emerald-500/40 truncate">
                    {'#'.repeat(h.level)} {h.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Images from Live Page */}
      {liveData.content.images && liveData.content.images.length > 0 && (
        <div className="bg-stone-900/80 rounded-2xl border border-stone-800 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sky-400" />
              <h3 className="font-serif font-bold text-stone-100 text-base">
                Media Assets Discovered on Live Page ({liveData.content.images.length})
              </h3>
            </div>
            <span className="text-xs text-stone-400">
              Click &quot;Set as Hero&quot; to adopt into draft front matter
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveData.content.images.map((img: LivePageImage, idx: number) => {
              const isCurrentHero = draft.heroImageType === img.src;

              return (
                <div
                  key={idx}
                  className={`rounded-xl overflow-hidden border p-3 flex flex-col justify-between transition ${
                    isCurrentHero
                      ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="aspect-video w-full rounded-lg bg-stone-900 overflow-hidden mb-3 border border-stone-800/80 relative">
                    <img
                      src={img.src}
                      alt={img.alt || 'Extracted visual'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    {img.isHeroCandidate && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-950/80 backdrop-blur border border-emerald-500/40 text-[10px] font-semibold text-emerald-300">
                        Lead Visual Candidate
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-3 flex-1">
                    <p className="text-xs text-stone-300 line-clamp-2">
                      {img.alt || img.caption || 'No alt text provided'}
                    </p>
                    <p className="text-[10px] font-mono text-stone-500 truncate" title={img.src}>
                      {img.src}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAdoptDiffField('heroImageType', img.src, 'live')}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isCurrentHero
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                    }`}
                  >
                    {isCurrentHero ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Selected as Hero Artwork
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Set as Draft Hero Artwork
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

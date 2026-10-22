import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Package,
  FileText,
  Compass,
  Layers,
  Settings,
  History,
  Image as ImageIcon,
  ArrowRight,
  Terminal,
  Activity,
  Search,
  Filter
} from 'lucide-react';

interface DiagnosticIssue {
  severity: 'error' | 'warning';
  scope: 'Products' | 'Guides' | 'Articles' | 'Navigation' | 'Taxonomies' | 'Assets' | 'Global Components' | 'Settings' | 'Environment';
  location: string;
  description: string;
  action?: {
    label: string;
    tab: string;
    id?: string;
  };
}

interface DiagnosticsData {
  success: boolean;
  issues: DiagnosticIssue[];
  counts: {
    products: number;
    guides: number;
    articles: number;
    collections: number;
    interests: number;
    backups: number;
  };
  assetsAudit: {
    totalImages: number;
    referencedImages: number;
    orphanedImages: string[];
    missingImages: string[];
  };
  backupsAudit: {
    totalCount: number;
    modules: Record<string, number>;
  };
  jekyllHealth: {
    jekyllDetected: boolean;
    configValid: boolean;
    toolingAvailable: boolean;
    rubyVersion: string;
  };
}

interface DiagnosticsDashboardProps {
  onNavigate: (tab: string, id?: string) => void;
}

export const DiagnosticsDashboard: React.FC<DiagnosticsDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnostics/run');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const json: DiagnosticsData = await res.json();
      if (json.success) {
        setData(json);
        setLastChecked(new Date());
      } else {
        throw new Error('Diagnostics service returned a failure status');
      }
    } catch (err: any) {
      console.error('Diagnostics failed:', err);
      setError(err.message || 'Failed to reach local verification engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const scopes = [
    { value: 'all', label: 'All Scopes' },
    { value: 'Products', label: 'Products' },
    { value: 'Guides', label: 'Gift Guides' },
    { value: 'Articles', label: 'Articles' },
    { value: 'Navigation', label: 'Navigation' },
    { value: 'Taxonomies', label: 'Taxonomies' },
    { value: 'Assets', label: 'Assets' },
    { value: 'Global Components', label: 'Global Components' },
    { value: 'Settings', label: 'Site Settings' },
    { value: 'Environment', label: 'Jekyll Env' }
  ];

  const filteredIssues = data?.issues.filter(issue => {
    const matchesScope = filterScope === 'all' || issue.scope === filterScope;
    const matchesSeverity = filterSeverity === 'all' || issue.severity === filterSeverity;
    const matchesSearch = searchQuery === '' || 
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.scope.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesScope && matchesSeverity && matchesSearch;
  }) || [];

  const errorCount = data?.issues.filter(i => i.severity === 'error').length || 0;
  const warningCount = data?.issues.filter(i => i.severity === 'warning').length || 0;

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'Products': return <Package className="w-4 h-4 text-emerald-600" />;
      case 'Guides': return <FileText className="w-4 h-4 text-blue-600" />;
      case 'Articles': return <FileText className="w-4 h-4 text-purple-600" />;
      case 'Navigation': return <Compass className="w-4 h-4 text-indigo-600" />;
      case 'Taxonomies': return <Layers className="w-4 h-4 text-amber-600" />;
      case 'Assets': return <ImageIcon className="w-4 h-4 text-pink-600" />;
      case 'Global Components': return <Layers className="w-4 h-4 text-orange-600" />;
      case 'Settings': return <Settings className="w-4 h-4 text-slate-600" />;
      default: return <Activity className="w-4 h-4 text-teal-600" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header and Controls */}
      <div className="border-b border-[#99BFF9]/25 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#226E56]" />
            <span>Diagnostics &amp; Verification Engine</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-tight">
            Site Health Inspector
          </h1>
          <p className="text-sm text-[#5A6270] max-w-2xl mt-1 leading-relaxed">
            A comprehensive, read-only audit of your catalog, guides, articles, taxonomies, assets, backups, and Liquid components.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
          {lastChecked && (
            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase tracking-wider text-[#5A6270] block font-semibold">Last Checked</span>
              <span className="text-xs font-mono-code text-[#2A548E]">
                {lastChecked.toLocaleTimeString()}
              </span>
            </div>
          )}
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="px-5 py-3 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-xs rounded disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing Site...' : 'Refresh Health Check'}</span>
          </button>
        </div>
      </div>

      {/* 2. Overview Status Banner */}
      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block font-bold mb-1">Health Run Failed</strong>
            <p className="font-mono-code">{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-5 border-2 rounded-xl flex items-center gap-4 ${
            errorCount > 0 
              ? 'bg-rose-50/50 border-rose-200 text-rose-900' 
              : warningCount > 0 
                ? 'bg-amber-50/40 border-amber-200 text-amber-900' 
                : 'bg-[#E8F8F1]/40 border-[#226E56]/30 text-[#154D3B]'
          } md:col-span-2`}>
            {errorCount > 0 ? (
              <ShieldAlert className="w-10 h-10 text-rose-600 shrink-0 animate-pulse" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-10 h-10 text-amber-500 shrink-0" />
            ) : (
              <ShieldCheck className="w-10 h-10 text-[#226E56] shrink-0" />
            )}
            <div>
              <h3 className="font-serif-display text-lg font-medium">
                {errorCount > 0 
                  ? 'Urgent Issues Detected' 
                  : warningCount > 0 
                    ? 'Review Recommendations' 
                    : 'All Systems Healthy'}
              </h3>
              <p className="text-xs text-[#5A6270] mt-0.5 leading-relaxed">
                {errorCount > 0 
                  ? `${errorCount} critical issues require manual resolution in editors to prevent build failures.`
                  : warningCount > 0 
                    ? `${warningCount} recommendations found for taxonomy, media, and navigation integrity.`
                    : 'No validation warnings or broken references found across the publication files.'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#99BFF9]/35 p-5 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold block">Critical Errors</span>
            <span className={`font-serif-display text-4xl font-normal mt-2 ${errorCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
              {errorCount}
            </span>
            <span className="text-[10px] text-[#5A6270] block mt-1">Requires manual correction</span>
          </div>

          <div className="bg-white border border-[#99BFF9]/35 p-5 rounded-xl flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold block">Warnings</span>
            <span className={`font-serif-display text-4xl font-normal mt-2 ${warningCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {warningCount}
            </span>
            <span className="text-[10px] text-[#5A6270] block mt-1">Recommendations &amp; cleanup</span>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-xs text-[#5A6270] font-mono-code">
          Analyzing local directory structure...
        </div>
      )}

      {/* 3. Main Audit Content */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Issues Registry (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#99BFF9]/25 flex flex-wrap items-center justify-between gap-4 bg-[#EEF5FF]/30">
                <div>
                  <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">Issue Registry</h3>
                  <p className="text-[11px] text-[#5A6270] mt-0.5">Filter and search file parsing details</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-code px-2 py-0.5 bg-[#FAF9F6] border border-stone-200 text-[#5A6270]">
                    Showing {filteredIssues.length} of {data.issues.length}
                  </span>
                </div>
              </div>

              {/* Filtering bar */}
              <div className="p-4 border-b border-stone-100 grid grid-cols-1 sm:grid-cols-12 gap-3 bg-[#FAF9F6]">
                <div className="sm:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by message or path..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={filterScope}
                    onChange={(e) => setFilterScope(e.target.value)}
                    className="w-full p-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none"
                  >
                    {scopes.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="w-full p-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none"
                  >
                    <option value="all">All Severities</option>
                    <option value="error">Errors Only (✕)</option>
                    <option value="warning">Warnings Only (⚠)</option>
                  </select>
                </div>
              </div>

              {/* Registry Rows */}
              <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto">
                {filteredIssues.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#5A6270] font-sans">
                    <CheckCircle2 className="w-8 h-8 text-[#226E56] mx-auto mb-2" />
                    No issues matching filters found.
                  </div>
                ) : (
                  filteredIssues.map((issue, idx) => (
                    <div key={idx} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-bold text-[10px] uppercase rounded font-mono-code ${
                            issue.severity === 'error' 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {issue.severity === 'error' ? 'Error' : 'Warning'}
                          </span>
                          <span className="flex items-center gap-1 bg-[#EEF5FF] text-[#2A548E] px-2 py-0.5 rounded-[4px] font-medium font-mono-code text-[10px]">
                            {getScopeIcon(issue.scope)}
                            <span>{issue.scope}</span>
                          </span>
                          <span className="text-[#5A6270] font-mono-code text-[10px] bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded select-all">
                            {issue.location}
                          </span>
                        </div>
                        <p className="text-[#1E232B] font-sans font-normal leading-relaxed text-slate-800">
                          {issue.description}
                        </p>
                      </div>

                      {issue.action && (
                        <button
                          onClick={() => onNavigate(issue.action!.tab, issue.action!.id)}
                          className="shrink-0 self-start sm:self-center px-3 py-1.5 border border-[#2A548E] text-[#2A548E] hover:bg-[#EEF5FF] rounded transition-all font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap text-[11px]"
                        >
                          <span>{issue.action.label}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Media Asset Diagnostics Section */}
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#99BFF9]/25 flex items-center justify-between bg-purple-50/20">
                <div>
                  <h3 className="font-serif-display text-lg text-[#1E232B] font-medium">Media Asset Audit</h3>
                  <p className="text-[11px] text-[#5A6270] mt-0.5">Detect orphaned and missing image references</p>
                </div>
                <ImageIcon className="w-5 h-5 text-purple-600" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold block">Total Media Files</span>
                  <div className="text-2xl font-serif-display text-slate-800 font-bold">
                    {Math.round(data.assetsAudit.totalImages)}
                  </div>
                  <p className="text-[10px] text-[#5A6270] font-sans">Discovered under assets/ and assets/images/</p>
                </div>

                <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold block">Referenced Media</span>
                  <div className="text-2xl font-serif-display text-slate-800 font-bold">
                    {data.assetsAudit.referencedImages}
                  </div>
                  <p className="text-[10px] text-[#5A6270]">Used in catalog products, essays, and guides</p>
                </div>
              </div>

              {/* Orphaned Images Checklist */}
              {data.assetsAudit.orphanedImages.length > 0 ? (
                <div className="border-t border-stone-100 p-5 space-y-3 bg-[#FAF9F6]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Orphaned Image Files ({data.assetsAudit.orphanedImages.length})</span>
                    </h4>
                    <span className="text-[10px] text-[#5A6270] max-w-xs text-right leading-relaxed block">
                      Files exist in assets/ but are never referenced in metadata. Safely remove if obsolete.
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto border border-stone-200 rounded bg-white text-xs divide-y divide-stone-100 font-mono-code text-[#5A6270]">
                    {data.assetsAudit.orphanedImages.map((path, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-50 gap-2">
                        <span className="truncate">{path}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400">Unused asset</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-stone-100 p-5 text-center text-xs text-[#226E56] font-semibold bg-[#E8F8F1]/30">
                  ✓ 100% Asset Efficiency: All images found on disk are properly referenced on the site!
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Side Stats & Tools (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Jekyll Environment Health */}
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#99BFF9]/20 bg-slate-50 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700 font-mono-code">
                  Jekyll Build Engine
                </h3>
              </div>
              <div className="p-4 space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6270]">Detected config:</span>
                  <span className={`font-mono-code px-2 py-0.5 rounded text-[10px] font-bold ${
                    data.jekyllHealth.jekyllDetected ? 'bg-[#E8F8F1] text-[#226E56]' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {data.jekyllHealth.jekyllDetected ? '✓ Detected' : '✕ Missing'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#5A6270]">_config.yml structure:</span>
                  <span className={`font-mono-code px-2 py-0.5 rounded text-[10px] font-bold ${
                    data.jekyllHealth.configValid ? 'bg-[#E8F8F1] text-[#226E56]' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {data.jekyllHealth.configValid ? '✓ Valid YAML' : '✕ Invalid YAML'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#5A6270]">Ruby Tooling CLI:</span>
                  <span className={`font-mono-code px-2 py-0.5 rounded text-[10px] font-bold ${
                    data.jekyllHealth.toolingAvailable ? 'bg-[#E8F8F1] text-[#226E56]' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {data.jekyllHealth.toolingAvailable ? '✓ Available' : '⚠ Emulated Mode'}
                  </span>
                </div>

                {data.jekyllHealth.rubyVersion && data.jekyllHealth.rubyVersion !== 'unknown' && (
                  <div className="pt-2 border-t border-stone-100 font-mono-code text-[11px] text-[#5A6270]">
                    <span className="font-bold block text-slate-700 mb-0.5">Version Details:</span>
                    <span className="block leading-tight break-all">{data.jekyllHealth.rubyVersion}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Backups Audit breakdown */}
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#99BFF9]/20 bg-slate-50 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700 font-mono-code">
                  Snapshots &amp; Backups
                </h3>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6270]">Total Backups Count:</span>
                  <span className="font-mono-code font-bold text-[#2A548E]">
                    {data.backupsAudit.totalCount} files
                  </span>
                </div>

                {data.backupsAudit.totalCount > 0 && (
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <span className="text-[10px] uppercase tracking-wider text-[#5A6270] font-semibold block">Backups per Module:</span>
                    <div className="space-y-1.5">
                      {Object.entries(data.backupsAudit.modules).map(([mod, count]) => (
                        <div key={mod} className="flex items-center justify-between font-mono-code text-[11px]">
                          <span className="capitalize">{mod.replace('-', ' ')}</span>
                          <span className="font-bold text-slate-700">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content Inventory Counts */}
            <div className="bg-white border border-[#99BFF9]/35 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#99BFF9]/20 bg-slate-50 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-700 font-mono-code">
                  Project Inventory
                </h3>
              </div>
              <div className="p-4 divide-y divide-stone-100 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#5A6270]">Products Catalog</span>
                  <span className="font-mono-code font-bold text-slate-800">{data.counts.products}</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#5A6270]">Gift Guides</span>
                  <span className="font-mono-code font-bold text-slate-800">{data.counts.guides}</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#5A6270]">Essays / Articles</span>
                  <span className="font-mono-code font-bold text-slate-800">{data.counts.articles}</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#5A6270]">Taxonomy Collections</span>
                  <span className="font-mono-code font-bold text-slate-800">{data.counts.collections}</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#5A6270]">Interests Items</span>
                  <span className="font-mono-code font-bold text-slate-800">{data.counts.interests}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

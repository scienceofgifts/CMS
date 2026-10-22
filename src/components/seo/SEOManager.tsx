import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  FileText,
  Compass,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  History,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Filter,
  Sliders,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface RobotsBackup {
  filename: string;
  timestamp: string;
  size: number;
}

interface IndexablePage {
  slug: string;
  title: string;
  type: 'guide' | 'article' | 'page';
  url: string;
  robots: {
    index: boolean;
    follow: boolean;
  };
  originObject: any;
}

interface SEOManagerProps {
  onNavigate: (tab: 'home' | 'products' | 'guides' | 'articles' | 'assets' | 'collections' | 'interests' | 'gift-finder' | 'pages' | 'global-components' | 'homepage' | 'navigation' | 'authors' | 'overview' | 'settings', id?: string) => void;
}

export const SEOManager: React.FC<SEOManagerProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'robots' | 'pages'>('pages');

  // robots.txt states
  const [robotsContent, setRobotsContent] = useState<string>('');
  const [originalRobotsContent, setOriginalRobotsContent] = useState<string>('');
  const [robotsBackups, setRobotsBackups] = useState<RobotsBackup[]>([]);
  const [loadingRobots, setLoadingRobots] = useState<boolean>(false);
  const [savingRobots, setSavingRobots] = useState<boolean>(false);
  const [robotsStatus, setRobotsStatus] = useState<{ success: boolean; message: string; warnings: string[] } | null>(null);

  // page indexing states
  const [pages, setPages] = useState<IndexablePage[]>([]);
  const [loadingPages, setLoadingPages] = useState<boolean>(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [savingPageIndex, setSavingPageIndex] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'guide' | 'article' | 'page'>('all');
  const [indexFilter, setIndexFilter] = useState<'all' | 'index' | 'noindex'>('all');

  // parse robots disallows for conflict checking
  const [disallowedPaths, setDisallowedPaths] = useState<string[]>([]);

  const fetchRobots = async () => {
    setLoadingRobots(true);
    try {
      const res = await fetch('/api/robots-txt');
      const json = await res.json();
      if (json.success) {
        setRobotsContent(json.content);
        setOriginalRobotsContent(json.content);
        parseDisallows(json.content);
      }
    } catch (e) {
      console.error('Failed to fetch robots.txt:', e);
    } finally {
      setLoadingRobots(false);
    }
  };

  const fetchRobotsBackups = async () => {
    try {
      const res = await fetch('/api/robots-backups');
      const json = await res.json();
      if (json.success) {
        setRobotsBackups(json.backups || []);
      }
    } catch (e) {
      console.error('Failed to fetch robots backups:', e);
    }
  };

  const parseDisallows = (content: string) => {
    const paths: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(':');
      if (parts.length >= 2 && parts[0].trim().toLowerCase() === 'disallow') {
        const val = parts.slice(1).join(':').trim();
        if (val) {
          paths.push(val);
        }
      }
    }
    setDisallowedPaths(paths);
  };

  const saveRobots = async () => {
    setSavingRobots(true);
    setRobotsStatus(null);
    try {
      const res = await fetch('/api/robots-txt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: robotsContent })
      });
      const json = await res.json();
      if (json.success) {
        setOriginalRobotsContent(json.content);
        setRobotsStatus({
          success: true,
          message: json.message,
          warnings: json.warnings || []
        });
        parseDisallows(json.content);
        fetchRobotsBackups();
      } else {
        setRobotsStatus({
          success: false,
          message: json.error || 'Failed to save robots.txt rules',
          warnings: []
        });
      }
    } catch (e: any) {
      setRobotsStatus({
        success: false,
        message: e.message || 'Server error occurred while saving robots.txt',
        warnings: []
      });
    } finally {
      setSavingRobots(false);
    }
  };

  const restoreRobotsBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore robots.txt rules from snapshot "${filename}"? Any unsaved edits will be lost.`)) {
      return;
    }
    setSavingRobots(true);
    setRobotsStatus(null);
    try {
      const res = await fetch('/api/robots-backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFilename: filename })
      });
      const json = await res.json();
      if (json.success) {
        setRobotsContent(json.content);
        setOriginalRobotsContent(json.content);
        setRobotsStatus({
          success: true,
          message: json.message,
          warnings: []
        });
        parseDisallows(json.content);
        fetchRobotsBackups();
      } else {
        setRobotsStatus({
          success: false,
          message: json.error || 'Failed to restore snapshot',
          warnings: []
        });
      }
    } catch (e: any) {
      setRobotsStatus({
        success: false,
        message: e.message || 'Server error occurred during snapshot restoration',
        warnings: []
      });
    } finally {
      setSavingRobots(false);
    }
  };

  const fetchPages = async () => {
    setLoadingPages(true);
    setPagesError(null);
    try {
      // 1. Fetch guides
      const guidesRes = await fetch('/api/guides');
      const guidesJson = await guidesRes.json();

      // 2. Fetch articles
      const articlesRes = await fetch('/api/articles');
      const articlesJson = await articlesRes.json();

      // 3. Fetch static pages
      const pagesRes = await fetch('/api/pages');
      const pagesJson = await pagesRes.json();

      const combined: IndexablePage[] = [];

      if (guidesJson.success && guidesJson.guides) {
        guidesJson.guides.forEach((g: any) => {
          // Normalize robots from flat object
          const rawRobots = g.robots;
          let index = true;
          let follow = true;
          if (rawRobots) {
            if (typeof rawRobots === 'object') {
              index = rawRobots.index !== false;
              follow = rawRobots.follow !== false;
            } else if (typeof rawRobots === 'string') {
              index = !rawRobots.includes('noindex');
              follow = !rawRobots.includes('nofollow');
            }
          }
          combined.push({
            slug: g.slug,
            title: g.title || 'Untitled Guide',
            type: 'guide',
            url: `/gift-guides/${g.slug}/`,
            robots: { index, follow },
            originObject: g
          });
        });
      }

      if (articlesJson.success && articlesJson.articles) {
        articlesJson.articles.forEach((a: any) => {
          const rawRobots = a.robots;
          let index = true;
          let follow = true;
          if (rawRobots) {
            if (typeof rawRobots === 'object') {
              index = rawRobots.index !== false;
              follow = rawRobots.follow !== false;
            } else if (typeof rawRobots === 'string') {
              index = !rawRobots.includes('noindex');
              follow = !rawRobots.includes('nofollow');
            }
          }
          combined.push({
            slug: a.slug,
            title: a.title || 'Untitled Article',
            type: 'article',
            url: `/articles/${a.slug}/`,
            robots: { index, follow },
            originObject: a
          });
        });
      }

      if (pagesJson.success && pagesJson.pages) {
        pagesJson.pages.forEach((p: any) => {
          if (p.slug === '404' || p.slug === 'collections') return; // Skip excluded pages
          const rawRobots = p.robots;
          let index = true;
          let follow = true;
          if (rawRobots) {
            if (typeof rawRobots === 'object') {
              index = rawRobots.index !== false;
              follow = rawRobots.follow !== false;
            } else if (typeof rawRobots === 'string') {
              index = !rawRobots.includes('noindex');
              follow = !rawRobots.includes('nofollow');
            }
          }
          combined.push({
            slug: p.slug,
            title: p.title || 'Untitled Static Page',
            type: 'page',
            url: p.slug === 'home' ? '/' : `/${p.slug}/`,
            robots: { index, follow },
            originObject: p
          });
        });
      }

      setPages(combined);
    } catch (e: any) {
      setPagesError(e.message || 'Failed to aggregate indexable pages metadata.');
    } finally {
      setLoadingPages(false);
    }
  };

  const updatePageIndexing = async (page: IndexablePage, newIndex: boolean, newFollow: boolean) => {
    setSavingPageIndex(page.slug + '-' + page.type);
    try {
      let endpoint = '';
      let payload: any = {};

      if (page.type === 'guide') {
        endpoint = `/api/guides/${page.slug}`;
        payload = {
          frontMatter: {
            robots: { index: newIndex, follow: newFollow }
          }
        };
      } else if (page.type === 'article') {
        endpoint = `/api/articles/${page.slug}`;
        payload = {
          frontMatter: {
            robots: { index: newIndex, follow: newFollow }
          }
        };
      } else if (page.type === 'page') {
        endpoint = `/api/pages/${page.slug}`;
        payload = {
          ...page.originObject,
          robots: { index: newIndex, follow: newFollow }
        };
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        // inline update state to prevent full reloading delay
        setPages(prev => prev.map(p => {
          if (p.slug === page.slug && p.type === page.type) {
            return {
              ...p,
              robots: { index: newIndex, follow: newFollow },
              originObject: page.type === 'page' ? json.page : { ...p.originObject, robots: { index: newIndex, follow: newFollow } }
            };
          }
          return p;
        }));
      } else {
        alert(json.error || 'Failed to update index parameters.');
      }
    } catch (e: any) {
      alert(`Error updating indexing values: ${e.message}`);
    } finally {
      setSavingPageIndex(null);
    }
  };

  useEffect(() => {
    fetchRobots();
    fetchRobotsBackups();
    fetchPages();
  }, []);

  const isPathBlockedByRobots = (url: string): boolean => {
    if (disallowedPaths.length === 0) return false;
    
    // Normalize url
    const cleanUrl = url.toLowerCase();

    for (const rule of disallowedPaths) {
      const cleanRule = rule.toLowerCase().trim();
      if (cleanRule === '/') return true; // Block everything
      
      // Check if URL starts with the rule or contains it
      if (cleanUrl.startsWith(cleanRule)) {
        return true;
      }
    }
    return false;
  };

  const filteredPages = pages.filter(p => {
    const matchesSearch = searchQuery === '' ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    
    const matchesIndex = indexFilter === 'all' ||
      (indexFilter === 'index' && p.robots.index) ||
      (indexFilter === 'noindex' && !p.robots.index);

    return matchesSearch && matchesType && matchesIndex;
  });

  const indexStats = {
    total: pages.length,
    indexed: pages.filter(p => p.robots.index).length,
    noindexed: pages.filter(p => !p.robots.index).length,
    nofollowed: pages.filter(p => !p.robots.follow).length,
    conflicts: pages.filter(p => !p.robots.index && isPathBlockedByRobots(p.url)).length
  };

  const isRobotsDirty = robotsContent !== originalRobotsContent;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Editorial Header */}
      <div className="bg-[#132644] text-white p-6 rounded-xl border border-[#99BFF9]/20 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest text-[#C3F3DF] font-semibold flex items-center gap-1.5 font-mono-code">
              <Globe className="w-3.5 h-3.5" /> Site SEO &amp; Crawler Indexing controls
            </div>
            <h1 className="font-serif-display text-2xl sm:text-3xl font-medium text-white leading-tight">
              Search Index &amp; Visibility Control
            </h1>
            <p className="text-xs sm:text-sm text-[#EEF5FF]/80 max-w-2xl leading-relaxed">
              Enforce indexing controls across search engine robots. Maintain robots.txt instructions and fine-tune page-level metadata headers. Track conflicts where crawler restriction rules override noindex directives.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { fetchRobots(); fetchPages(); }}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold flex items-center gap-2 border border-white/10 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Registry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-xs space-y-1 rounded-lg">
          <span className="text-[11px] text-[#5A6270] uppercase font-bold tracking-wider">Indexable Pages</span>
          <div className="text-2xl font-serif-display text-[#1E232B] font-semibold">{indexStats.total}</div>
        </div>
        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-xs space-y-1 rounded-lg">
          <span className="text-[11px] text-[#226E56] uppercase font-bold tracking-wider">Search Indexed</span>
          <div className="text-2xl font-serif-display text-[#226E56] font-semibold">{indexStats.indexed}</div>
        </div>
        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-xs space-y-1 rounded-lg">
          <span className="text-[11px] text-amber-600 uppercase font-bold tracking-wider">Noindexed Pages</span>
          <div className="text-2xl font-serif-display text-amber-600 font-semibold">{indexStats.noindexed}</div>
        </div>
        <div className="p-4 bg-white border border-[#99BFF9]/25 shadow-xs space-y-1 rounded-lg">
          <span className="text-[11px] text-purple-600 uppercase font-bold tracking-wider">Nofollowed Links</span>
          <div className="text-2xl font-serif-display text-purple-600 font-semibold">{indexStats.nofollowed}</div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 shadow-xs space-y-1 rounded-lg col-span-2 md:col-span-1">
          <span className="text-[11px] text-red-700 uppercase font-bold tracking-wider">SEO Conflicts</span>
          <div className="text-2xl font-serif-display text-red-700 font-semibold flex items-center gap-1.5">
            {indexStats.conflicts}
            {indexStats.conflicts > 0 && <AlertTriangle className="w-4 h-4 text-red-600" />}
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex border-b border-[#99BFF9]/20 gap-6 text-xs sm:text-sm font-medium pb-px">
        <button
          onClick={() => setActiveTab('pages')}
          className={`pb-3 px-1 transition-colors relative cursor-pointer font-sans uppercase tracking-wider text-xs font-bold ${
            activeTab === 'pages' ? 'text-[#2A548E]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Page-Level Indexing Controls
          {activeTab === 'pages' && (
            <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-[#2A548E] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('robots')}
          className={`pb-3 px-1 transition-colors relative cursor-pointer font-sans uppercase tracking-wider text-xs font-bold ${
            activeTab === 'robots' ? 'text-[#2A548E]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Robots.txt Rules Editor
          {activeTab === 'robots' && (
            <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-[#2A548E] rounded-t-full" />
          )}
        </button>
      </div>

      {/* TAB A: PAGE INDEXING DASHBOARD */}
      {activeTab === 'pages' && (
        <div className="space-y-4">
          {/* Filters card */}
          <div className="bg-[#FAF9F6] border border-[#99BFF9]/20 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, slug, or relative url path..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-stone-200 rounded-md focus:border-[#2A548E] focus:outline-none"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Filters:</span>
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e: any) => setTypeFilter(e.target.value)}
                className="p-1.5 bg-white border border-stone-200 rounded text-slate-700 focus:outline-none"
              >
                <option value="all">All Content Types</option>
                <option value="guide">Gift Guides</option>
                <option value="article">Articles</option>
                <option value="page">Static Pages</option>
              </select>

              {/* Index Filter */}
              <select
                value={indexFilter}
                onChange={(e: any) => setIndexFilter(e.target.value)}
                className="p-1.5 bg-white border border-stone-200 rounded text-slate-700 focus:outline-none"
              >
                <option value="all">All Visibility States</option>
                <option value="index">Search Allowed (Index)</option>
                <option value="noindex">Hidden from Search (Noindex)</option>
              </select>
            </div>
          </div>

          {/* Table list */}
          {loadingPages ? (
            <div className="bg-white border border-[#99BFF9]/25 p-16 text-center rounded-xl">
              <RefreshCw className="w-8 h-8 text-[#2A548E] animate-spin mx-auto mb-3" />
              <div className="text-xs text-slate-500">Querying and parsing site content directories...</div>
            </div>
          ) : pagesError ? (
            <div className="p-8 bg-red-50 border border-red-200 text-red-800 text-xs text-center rounded-xl space-y-2">
              <XCircle className="w-8 h-8 text-red-600 mx-auto" />
              <p className="font-semibold">{pagesError}</p>
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="bg-white border border-[#99BFF9]/25 p-12 text-center rounded-xl space-y-2 text-slate-500">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-xs">No pages matched the current search filters.</div>
            </div>
          ) : (
            <div className="bg-white border border-[#99BFF9]/25 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#EEF5FF]/50 border-b border-[#99BFF9]/20 text-[#2A548E] font-bold select-none">
                      <th className="p-4">Content Title / URL</th>
                      <th className="p-4 w-28">Type</th>
                      <th className="p-4 w-44">Search Indexing (Meta Robots)</th>
                      <th className="p-4 w-44">Link Following</th>
                      <th className="p-4 w-32">Direct Editor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredPages.map((page) => {
                      const isBlocked = isPathBlockedByRobots(page.url);
                      const hasConflict = !page.robots.index && isBlocked;
                      const isSaving = savingPageIndex === (page.slug + '-' + page.type);

                      return (
                        <tr key={page.slug + '-' + page.type} className="hover:bg-slate-50/55 transition-colors">
                          <td className="p-4 space-y-1 max-w-sm">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {page.title}
                              {hasConflict && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-[10px] text-red-800 font-semibold" title="Indexing conflict: Marked as Noindex but blocked by robots.txt!">
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                  <span>Conflict</span>
                                </span>
                              )}
                              {page.robots.index && isBlocked && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-[10px] text-amber-800 font-semibold" title="Search engine engines are blocked from crawling this page in robots.txt!">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Crawling Blocked</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono-code">
                              <span>{page.url}</span>
                            </div>

                            {/* Warning explanation box if conflict */}
                            {hasConflict && (
                              <div className="mt-1.5 p-2 bg-red-50 border border-red-100 rounded text-[10px] leading-relaxed text-red-700">
                                <strong>Crawling Conflict:</strong> Page is set to <strong>Noindex</strong>, but crawls to it are blocked by rules in robots.txt. Bots can't crawl the page to find your noindex tag, so it may remain in search engines indices! Remove the path from robots.txt to let bots discover the noindex rule.
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded ${
                              page.type === 'guide' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              page.type === 'article' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              page.slug === 'home' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              ['gift-guides', 'articles'].includes(page.slug) ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                              page.slug === 'gift-finder' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                              ['for-men', 'for-women'].includes(page.slug) ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}>
                              {page.type === 'guide' ? 'Gift Guide' :
                               page.type === 'article' ? 'Article' :
                               page.slug === 'home' ? 'Homepage' :
                               page.slug === 'gift-guides' ? 'Index Page' :
                               page.slug === 'articles' ? 'Index Page' :
                               page.slug === 'gift-finder' ? 'Tool' :
                               page.slug === 'for-men' ? 'Category Page' :
                               page.slug === 'for-women' ? 'Category Page' :
                               'Static Page'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isSaving ? (
                                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                              ) : (
                                <button
                                  onClick={() => updatePageIndexing(page, !page.robots.index, page.robots.follow)}
                                  className={`px-3 py-1.5 rounded text-xs font-semibold select-none cursor-pointer transition-all flex items-center gap-1.5 border ${
                                    page.robots.index
                                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  {page.robots.index ? (
                                    <>
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>INDEX (Allow)</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                      <span>NOINDEX (Hide)</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isSaving ? (
                                <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                              ) : (
                                <button
                                  onClick={() => updatePageIndexing(page, page.robots.index, !page.robots.follow)}
                                  className={`px-3 py-1.5 rounded text-xs font-semibold select-none cursor-pointer transition-all flex items-center gap-1.5 border ${
                                    page.robots.follow
                                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                                      : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                                  }`}
                                >
                                  {page.robots.follow ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                      <span>FOLLOW Links</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-purple-600" />
                                      <span>NOFOLLOW Links</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => {
                                const systemLayoutSlugs = ['home', 'gift-guides', 'articles', 'gift-finder', 'for-men', 'for-women'];
                                if (page.type === 'page' && systemLayoutSlugs.includes(page.slug)) {
                                  if (page.slug === 'home') {
                                    onNavigate('homepage');
                                  } else if (page.slug === 'gift-finder') {
                                    onNavigate('gift-finder');
                                  } else {
                                    window.open(page.url, '_blank');
                                  }
                                } else {
                                  const tabMap: Record<string, any> = {
                                    guide: 'guides',
                                    article: 'articles',
                                    page: 'pages'
                                  };
                                  onNavigate(tabMap[page.type]);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-stone-100 hover:bg-[#2A548E] text-slate-700 hover:text-white border border-stone-200 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer font-medium"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB B: ROBOTS.TXT EDITOR */}
      {activeTab === 'robots' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main edit workspace (left / 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#99BFF9]/25 p-6 rounded-xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#99BFF9]/20 pb-3">
                <div>
                  <h3 className="font-serif-display text-base text-[#1E232B] font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#2A548E]" />
                    <span>Robots.txt Crawling Directives</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure crawler pathways and sitemap indexing directives for spiders (Googlebot, Bingbot, Applebot).
                  </p>
                </div>
                {isRobotsDirty && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold font-mono-code">
                    Unsaved Edits
                  </span>
                )}
              </div>

              {/* Status Message */}
              {robotsStatus && (
                <div className={`p-4 rounded border text-xs flex items-start gap-2.5 ${
                  robotsStatus.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {robotsStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{robotsStatus.message}</p>
                    {robotsStatus.warnings && robotsStatus.warnings.length > 0 && (
                      <div className="mt-1 text-[11px] font-sans text-amber-800 space-y-1">
                        <strong className="block text-amber-900 font-bold">Rule Validation Messages:</strong>
                        {robotsStatus.warnings.map((warn, i) => (
                          <div key={i} className="flex items-center gap-1 bg-amber-100/50 p-1.5 rounded border border-amber-200/50">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loadingRobots ? (
                <div className="py-16 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-500">Loading robots.txt...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <textarea
                      value={robotsContent}
                      onChange={(e) => setRobotsContent(e.target.value)}
                      rows={14}
                      className="w-full p-4 bg-stone-900 text-emerald-400 font-mono-code text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#99BFF9] border border-stone-800 rounded-lg select-text"
                      placeholder="# robots.txt rule block"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setRobotsContent(originalRobotsContent)}
                      disabled={!isRobotsDirty || savingRobots}
                      className="px-4 py-2 bg-stone-50 hover:bg-stone-100 text-slate-600 disabled:opacity-50 text-xs font-semibold rounded border border-stone-200 transition-all cursor-pointer"
                    >
                      Revert Changes
                    </button>
                    <button
                      onClick={saveRobots}
                      disabled={savingRobots || !isRobotsDirty}
                      className="px-5 py-2 bg-[#2A548E] hover:bg-[#1B365D] disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {savingRobots ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Rules...</span>
                        </>
                      ) : (
                        <>
                          <span>Apply Rules &amp; Snap Snapshot</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick syntax syntax help info */}
            <div className="p-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-lg text-xs space-y-2">
              <div className="font-semibold flex items-center gap-1">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>Search Engine Directive Reference Manual</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Robots.txt acts as the <strong>gatekeeper</strong>. It instructs automated web robots which parts of the domain can or cannot be crawled. Note that a "Disallow" rule blocks crawling, but <em>does not</em> guarantee a page won't be indexed if external links exist; use meta noindex tags for guaranteed concealment.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono-code text-[10px] text-slate-700 bg-white/75 p-3 rounded border border-blue-200/50">
                <div className="space-y-1">
                  <div className="font-bold text-blue-900 font-sans border-b border-blue-100 pb-1 mb-1">Standard Setup (Allow all)</div>
                  <div>User-agent: *</div>
                  <div>Allow: /</div>
                  <div className="text-slate-400 mt-1"># Allows indexing everything</div>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-blue-900 font-sans border-b border-blue-100 pb-1 mb-1">Restrict Section (Disallow path)</div>
                  <div>User-agent: *</div>
                  <div>Disallow: /editor-backups/</div>
                  <div>Disallow: /contact/</div>
                  <div className="text-slate-400 mt-1"># Blocks robots from crawling paths</div>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshot Backups (right column / 1 col) */}
          <div className="space-y-4">
            <div className="bg-white border border-[#99BFF9]/25 p-5 rounded-xl shadow-xs space-y-4">
              <h3 className="font-serif-display text-xs uppercase tracking-wider font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Robots.txt Snapshots</span>
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                A backup is captured automatically on every save. Up to 10 snapshots are preserved before rotating out.
              </p>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {robotsBackups.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-400 border border-dashed border-stone-200 rounded">
                    No snapshots captured yet.
                  </div>
                ) : (
                  robotsBackups.map((bk) => (
                    <div key={bk.filename} className="p-3 bg-[#FAF9F6] hover:bg-slate-50 border border-stone-200/80 rounded flex flex-col gap-1.5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold font-mono-code text-slate-700 truncate max-w-[150px]" title={bk.filename}>
                          {bk.filename}
                        </span>
                        <span className="text-[9px] text-[#226E56] bg-[#E8F8F1] px-1.5 py-0.5 rounded font-semibold shrink-0">
                          {(bk.size / 1024).toFixed(2)} KB
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(bk.timestamp).toLocaleString()}
                      </div>
                      <div className="pt-1 border-t border-stone-200/50 flex justify-end">
                        <button
                          onClick={() => restoreRobotsBackup(bk.filename)}
                          disabled={savingRobots}
                          className="text-[10px] text-[#2A548E] hover:underline font-semibold cursor-pointer select-none"
                        >
                          Restore Snap
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderTree,
  FileText,
  Database,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Terminal,
  ArrowRight,
  Lock,
  Compass,
  BookOpen,
  Package,
  Settings as SettingsIcon,
  Image as ImageIcon,
  ExternalLink,
  Code2,
  Layers,
  Cpu,
  Clock,
  HardDrive,
  ChevronDown,
  Users,
  Tag,
  Globe,
  Monitor
} from 'lucide-react';
import { ProductManager } from './components/products/ProductManager';
import { GuideManager } from './components/guides/GuideManager';
import { AssetManager } from './components/assets/AssetManager';
import { ArticleManager } from './components/articles/ArticleManager';
import { CollectionManager } from './components/collections/CollectionManager';
import { HomepageEditor } from './components/homepage/HomepageEditor';
import { NavigationEditor } from './components/navigation/NavigationEditor';
import { AuthorManager } from './components/authors/AuthorManager';
import { InterestManager } from './components/interests/InterestManager';
import { GiftFinderEditor } from './components/gift-finder/GiftFinderEditor';
import { HomeDashboard } from './components/home/HomeDashboard';
import { StaticPageManager } from './components/pages/StaticPageManager';
import { GlobalComponentsManager } from './components/global/GlobalComponentsManager';
import { SiteSettingsEditor } from './components/settings/SiteSettingsEditor';
import { DiagnosticsDashboard } from './components/diagnostics/DiagnosticsDashboard';
import { SEOManager } from './components/seo/SEOManager';
import { ImportManager } from './components/import/ImportManager';

interface ProjectStatus {
  success: boolean;
  connected: boolean;
  jekyllDetected: boolean;
  project: {
    name: string;
    tagline: string;
    description: string;
    url: string;
    collections: string[];
    folderName: string;
    rootDisplay: string;
  };
  counts: {
    products: number;
    guides: number;
    articles: number;
    dataFiles: number;
    layouts: number;
    includes: number;
  };
  inventory: {
    guides: string[];
    articles: string[];
    dataFiles: string[];
  };
  environment: {
    nodeVersion: string;
    platform: string;
    serverTime: string;
    port: number;
  };
}

interface TestItem {
  name: string;
  description: string;
  passed: boolean;
  details?: string;
  durationMs?: number;
}

interface TestSuiteResponse {
  success: boolean;
  allPassed: boolean;
  summary: string;
  totalDurationMs: number;
  tests: TestItem[];
}

interface FileDetail {
  success: boolean;
  path: string;
  size: number;
  mtime: string;
  content: string;
  extension: string;
  parsed?: any;
}

interface FilesCategorized {
  data: Array<{ name: string; path: string; size: number; mtime: string; itemCount?: number }>;
  guides: Array<{ name: string; path: string; size: number; mtime: string; title?: string; slug?: string; category?: string }>;
  articles: Array<{ name: string; path: string; size: number; mtime: string; title?: string; slug?: string; category?: string }>;
  config: Array<{ name: string; path: string; size: number; exists: boolean }>;
  layouts: Array<{ name: string; path: string; size: number }>;
  includes: Array<{ name: string; path: string; size: number }>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'products' | 'guides' | 'articles' | 'assets' | 'collections' | 'interests' | 'gift-finder' | 'pages' | 'global-components' | 'homepage' | 'navigation' | 'authors' | 'overview' | 'settings' | 'seo' | 'import'>(() => {
    const saved = sessionStorage.getItem('activeTab');
    return (saved as any) || 'home';
  });

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Files list & Inspection
  const [filesData, setFilesData] = useState<FilesCategorized | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('_config.yml');
  const [fileDetail, setFileDetail] = useState<FileDetail | null>(null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Diagnostic Test Suite
  const [testResults, setTestResults] = useState<TestSuiteResponse | null>(null);
  const [runningTest, setRunningTest] = useState<boolean>(false);

  // Path Traversal Security Interactive Test
  const [traversalTestPath, setTraversalTestPath] = useState<string>('../../etc/passwd');
  const [traversalResult, setTraversalResult] = useState<{ tested: boolean; blocked: boolean; message: string } | null>(null);
  const [runningTraversalTest, setRunningTraversalTest] = useState<boolean>(false);

  // Sub tab for Overview (Status & Verification)
  const [overviewSubTab, setOverviewSubTab] = useState<'diagnostics' | 'security'>('diagnostics');

  // Load project status and file hierarchy on mount
  useEffect(() => {
    fetchStatus();
    fetchFiles();
  }, []);

  // When selected file changes, fetch its content
  useEffect(() => {
    if (selectedFilePath) {
      loadFile(selectedFilePath);
    }
  }, [selectedFilePath]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/project/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: ProjectStatus = await res.json();
      setStatus(data);
    } catch (err: any) {
      console.error('Error fetching project status:', err);
      setStatusError(err.message || 'Failed to reach local server');
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.files) {
          setFilesData(json.files);
        }
      }
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const loadFile = async (relPath: string) => {
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(relPath)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setFileDetail(data);
      } else {
        setFileDetail(null);
      }
    } catch (err) {
      console.error('Error loading file:', err);
      setFileDetail(null);
    } finally {
      setLoadingFile(false);
    }
  };

  const runFullDiagnostics = async () => {
    setRunningTest(true);
    try {
      const res = await fetch('/api/test/operation', { method: 'POST' });
      const data: TestSuiteResponse = await res.json();
      setTestResults(data);
      // Refresh status after test
      fetchStatus();
    } catch (err: any) {
      console.error('Error running diagnostics:', err);
      setTestResults({
        success: false,
        allPassed: false,
        summary: `Diagnostic run failed: ${err.message}`,
        totalDurationMs: 0,
        tests: []
      });
    } finally {
      setRunningTest(false);
    }
  };

  const testSecurityDefense = async (customPath?: string) => {
    const pathToTest = customPath || traversalTestPath;
    setRunningTraversalTest(true);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(pathToTest)}`);
      const data = await res.json();
      if (res.status === 403 || res.status === 400 || !data.success) {
        setTraversalResult({
          tested: true,
          blocked: true,
          message: `Blocked (${res.status} Forbidden): ${data.error || 'Path validation rejected request'}`
        });
      } else {
        setTraversalResult({
          tested: true,
          blocked: false,
          message: 'WARNING: Path was not blocked! Check validation logic.'
        });
      }
    } catch (err: any) {
      setTraversalResult({
        tested: true,
        blocked: true,
        message: `Network/Server rejected request: ${err.message}`
      });
    } finally {
      setRunningTraversalTest(false);
    }
  };

  const handleTabChange = (newTab: typeof activeTab) => {
    if ((window as any).cmsIsDirty) {
      if (window.confirm('You have unsaved changes in the active editor. Are you sure you want to discard them and leave?')) {
        (window as any).cmsIsDirty = false; // reset
        setActiveTab(newTab);
      }
    } else {
      setActiveTab(newTab);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1E232B] flex flex-col font-sans">
      {/* 1. TOP BAR CONTRACT: Brand Zone (1 line) - 4-6 Nav Links - 1-2 Actions */}
      <header className="sticky top-0 z-40 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-[#99BFF9]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Zone 1: Brand wordmark returning to Home Dashboard */}
            <div className="flex items-center gap-3">
              <a
                href="#home"
                onClick={(e) => { e.preventDefault(); handleTabChange('home'); }}
                className="group flex items-center gap-2 focus:outline-none cursor-pointer"
                title="Return to Home Dashboard"
              >
                <div className="font-serif-display text-2xl font-normal tracking-wide text-[#1E232B] group-hover:text-[#2A548E] transition-colors">
                  SCIENCE <span className="text-[#2A548E] font-serif italic">of</span> GIFTS
                </div>
              </a>
              <span className="text-[#5A6270]/40">·</span>
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold font-mono-code">
                Local Editor
              </span>
            </div>

            {/* Zone 2: Primary Navigation Bar (Products, Gift Guides, Articles, Assets, More) */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-xs lg:text-sm font-medium text-[#5A6270]">
              <button
                onClick={() => handleTabChange('products')}
                className={`py-1 cursor-pointer transition-colors relative ${
                  activeTab === 'products'
                    ? 'text-[#2A548E] font-semibold'
                    : 'hover:text-[#1E232B]'
                }`}
              >
                Products
                {activeTab === 'products' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                )}
              </button>

              <button
                onClick={() => handleTabChange('guides')}
                className={`py-1 cursor-pointer transition-colors relative ${
                  activeTab === 'guides'
                    ? 'text-[#2A548E] font-semibold'
                    : 'hover:text-[#1E232B]'
                }`}
              >
                Gift Guides
                {activeTab === 'guides' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                )}
              </button>

              <button
                onClick={() => handleTabChange('articles')}
                className={`py-1 cursor-pointer transition-colors relative ${
                  activeTab === 'articles'
                    ? 'text-[#2A548E] font-semibold'
                    : 'hover:text-[#1E232B]'
                }`}
              >
                Articles
                {activeTab === 'articles' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                )}
              </button>

              <button
                onClick={() => handleTabChange('assets')}
                className={`py-1 cursor-pointer transition-colors relative ${
                  activeTab === 'assets'
                    ? 'text-[#2A548E] font-semibold'
                    : 'hover:text-[#1E232B]'
                }`}
              >
                Assets
                {activeTab === 'assets' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                )}
              </button>

              <button
                onClick={() => handleTabChange('import')}
                className={`py-1 cursor-pointer transition-colors relative ${
                  activeTab === 'import'
                    ? 'text-[#2A548E] font-semibold'
                    : 'hover:text-[#1E232B]'
                }`}
              >
                Import
                {activeTab === 'import' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                )}
              </button>

              {/* Secondary More Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`py-1 px-2 rounded hover:bg-[#EEF5FF] cursor-pointer transition-colors flex items-center gap-1 relative ${
                    ['collections', 'interests', 'gift-finder', 'pages', 'global-components', 'homepage', 'navigation', 'authors', 'overview', 'settings', 'seo', 'import'].includes(activeTab)
                      ? 'text-[#2A548E] font-semibold bg-[#EEF5FF]'
                      : 'hover:text-[#1E232B]'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  {['collections', 'interests', 'gift-finder', 'pages', 'global-components', 'homepage', 'navigation', 'authors', 'overview', 'settings', 'seo', 'import'].includes(activeTab) && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF]" />
                  )}
                </button>

                {isMoreMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 shadow-xl rounded-xl py-3 z-50 animate-in fade-in zoom-in-95 duration-150 text-left space-y-1.5"
                    onMouseLeave={() => setIsMoreMenuOpen(false)}
                  >
                    {/* Category 1: Content & Taxonomy */}
                    <div>
                      <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold select-none">
                        Content &amp; Taxonomy
                      </div>
                      <div className="space-y-0.5 mt-1">
                        <button
                          onClick={() => { handleTabChange('collections'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'collections' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>Collections</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('interests'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'interests' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Interests</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('gift-finder'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'gift-finder' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
                          <span>Gift Finder</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('import'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'import' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Import &amp; Migration</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-1" />

                    {/* Category 2: Site Configuration */}
                    <div>
                      <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold select-none">
                        Site Configuration
                      </div>
                      <div className="space-y-0.5 mt-1">
                        <button
                          onClick={() => { handleTabChange('homepage'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'homepage' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Homepage Editor</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('pages'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'pages' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-[#2A548E]" />
                          <span>Static Pages</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('global-components'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'global-components' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-600" />
                          <span>Global Site Components</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('navigation'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'navigation' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Site Navigation Data</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('settings'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'settings' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>Site Settings</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('seo'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'seo' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5 text-rose-600" />
                          <span>SEO &amp; Indexing</span>
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 my-1" />

                    {/* Category 3: People & Administration */}
                    <div>
                      <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold select-none">
                        People &amp; Administration
                      </div>
                      <div className="space-y-0.5 mt-1">
                        <button
                          onClick={() => { handleTabChange('authors'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'authors' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Authors &amp; Staff</span>
                        </button>

                        <button
                          onClick={() => { handleTabChange('overview'); setIsMoreMenuOpen(false); }}
                          className={`w-full px-4 py-1.5 text-xs text-left flex items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                            activeTab === 'overview' ? 'text-[#2A548E] font-bold bg-[#EEF5FF]/60' : 'text-slate-700'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Status &amp; Verification</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* Zone 3: 1-2 primary status / utility actions */}
            <div className="flex items-center gap-3">
              <a
                href="http://localhost:4000/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#EEF5FF] hover:bg-[#2A548E] text-[#2A548E] hover:text-white border border-[#99BFF9]/40 rounded text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Open Jekyll website preview at http://localhost:4000/ in a new tab"
              >
                <span>Preview Site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E8F8F1] border border-[#226E56]/25 rounded text-xs text-[#154D3B]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C3F3DF] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#226E56]" />
                </span>
                <span className="font-mono-code">127.0.0.1:3000</span>
              </div>

              <button
                onClick={fetchStatus}
                disabled={loadingStatus}
                title="Refresh project connection status"
                className="p-2 border border-[#99BFF9]/40 text-[#5A6270] hover:text-[#1E232B] hover:bg-[#EEF5FF] rounded transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER BREADCRUMB STRIP */}
      <div className="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-2.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between text-xs text-[#5A6270] gap-2">
          <div className="flex items-center gap-2">
            <span>Science of Gifts</span>
            <span aria-hidden="true">·</span>
            <span>Private Local Workspace</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#2A548E] font-medium">
              {activeTab === 'home' && 'Content Management Dashboard'}
              {activeTab === 'overview' && 'Phase 1: Local Architecture Foundation & Status'}
              {activeTab === 'products' && 'Phase 2: Product Editor (_data/products.yml)'}
              {activeTab === 'guides' && 'Phase 3: Gift Guide Editor'}
              {activeTab === 'assets' && 'Phase 3.5: Asset Manager & Image Pipeline'}
              {activeTab === 'articles' && 'Phase 4: Editorial Essay Editor'}
              {activeTab === 'collections' && 'Phase 5: Collections & Taxonomy Editor'}
              {activeTab === 'homepage' && 'Phase 6A: Homepage Editor (/index.md)'}
              {activeTab === 'navigation' && 'Phase 6A: Navigation Editor (_data/navigation.yml)'}
              {activeTab === 'authors' && 'Phase 6A: Authors Manager (_data/authors.yml)'}
              {activeTab === 'interests' && 'Phase 6A: Interests Taxonomy (_data/interests.yml)'}
              {activeTab === 'gift-finder' && 'Phase 6B: Gift Finder Editor (/gift-finder/index.html)'}
              {activeTab === 'pages' && 'Phase 7 & 8: Static Editorial, Legal & System Pages'}
              {activeTab === 'global-components' && 'Phase 9: Global Site Components Editor (_includes/)'}
              {activeTab === 'settings' && 'Phase 10: Site Settings (_config.yml)'}
              {activeTab === 'seo' && 'Phase 13: SEO & Indexing Controls'}
              {activeTab === 'import' && 'Phase 14: AI-Assisted Migration & Markdown Importer (Phase 1: Analysis & Preview)'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono-code text-[11px]">
            <span>Root: {status?.project.rootDisplay || './'}</span>
            <span aria-hidden="true">·</span>
            <span>Jekyll: {status?.jekyllDetected ? 'Detected' : 'Checking...'}</span>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT BODY */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* A0. Root Home Dashboard */}
        {activeTab === 'home' && (
          <HomeDashboard onNavigate={(tab) => handleTabChange(tab)} />
        )}

        {/* A. System Status & Verification */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Sub-tab navigation */}
            <div className="flex border-b border-[#99BFF9]/20 gap-6 text-xs sm:text-sm font-medium pb-px">
              <button
                onClick={() => setOverviewSubTab('diagnostics')}
                className={`pb-3 px-1 transition-colors relative cursor-pointer font-sans uppercase tracking-wider text-xs font-semibold ${
                  overviewSubTab === 'diagnostics' ? 'text-[#2A548E]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Site Diagnostics &amp; Reference Audit
                {overviewSubTab === 'diagnostics' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#2A548E]" />
                )}
              </button>
              <button
                onClick={() => setOverviewSubTab('security')}
                className={`pb-3 px-1 transition-colors relative cursor-pointer font-sans uppercase tracking-wider text-xs font-semibold ${
                  overviewSubTab === 'security' ? 'text-[#2A548E]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Security Containment &amp; File Explorer
                {overviewSubTab === 'security' && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#2A548E]" />
                )}
              </button>
            </div>

            {overviewSubTab === 'diagnostics' ? (
              <DiagnosticsDashboard onNavigate={(tab, id) => {
                setActiveTab(tab as any);
                if (tab === 'products' && id) {
                  setTargetProductId(id);
                }
                setIsMoreMenuOpen(false);
              }} />
            ) : (
              <div className="space-y-10 animate-in fade-in duration-150">
                {/* Editorial Header Block */}
                <div className="border-b border-[#99BFF9]/25 pb-6">
              <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
                <span>Phase 1 Architecture Foundation</span>
              </div>
              <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-tight">
                Local Content Management System
              </h1>
              <p className="text-sm sm:text-base text-[#5A6270] max-w-3xl mt-2 leading-relaxed">
                Direct, local-only communication between your browser and the Science of Gifts Jekyll project files.
                All file reads and writes resolve safely against your local project root with strict path containment.
              </p>
            </div>

            {/* A. Live Status & Health Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Project Connection */}
              <div className="bg-white border border-[#99BFF9]/35 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-[#5A6270] font-semibold">Connection</span>
                  {status?.connected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#226E56] font-semibold bg-[#E8F8F1] px-2.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-700 font-semibold bg-rose-50 px-2.5 py-0.5 rounded">
                      <XCircle className="w-3.5 h-3.5" /> Offline
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">Local Project Root</h3>
                  <div className="mt-1 font-mono-code text-xs text-[#2A548E] bg-[#EEF5FF] p-2 border border-[#99BFF9]/25 rounded break-all">
                    {status?.project.rootDisplay || 'Loading project root...'}
                  </div>
                </div>
                <div className="pt-2 text-xs text-[#5A6270] border-t border-stone-100 flex items-center justify-between">
                  <span>Server Port: {status?.environment.port || 3000}</span>
                  <span>Platform: {status?.environment.platform || 'local'}</span>
                </div>
              </div>

              {/* Card 2: Jekyll Detection */}
              <div className="bg-white border border-[#99BFF9]/35 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-[#5A6270] font-semibold">Engine</span>
                  {status?.jekyllDetected ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#226E56] font-semibold bg-[#E8F8F1] px-2.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Detected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded">
                      <AlertCircle className="w-3.5 h-3.5" /> Missing _config.yml
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">Science of Gifts</h3>
                  <p className="text-xs text-[#5A6270] italic mt-1 line-clamp-2">
                    "{status?.project.tagline || 'Thoughtful gifts, chosen with a little more thought.'}"
                  </p>
                </div>
                <div className="pt-2 text-xs text-[#5A6270] border-t border-stone-100 flex items-center justify-between">
                  <span>Collections: {status?.project.collections?.join(', ') || 'guides, articles'}</span>
                  <span>Config: _config.yml</span>
                </div>
              </div>

              {/* Card 3: Filesystem Containment */}
              <div className="bg-white border border-[#99BFF9]/35 p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-[#5A6270] font-semibold">Filesystem Safety</span>
                  <span className="inline-flex items-center gap-1 text-xs text-[#2A548E] font-semibold bg-[#EEF5FF] px-2.5 py-0.5 rounded">
                    <ShieldCheck className="w-3.5 h-3.5" /> Guardrails Active
                  </span>
                </div>
                <div>
                  <h3 className="font-serif-display text-xl text-[#1E232B] font-medium">Path Validation</h3>
                  <p className="text-xs text-[#5A6270] leading-relaxed mt-1">
                    Traversal attempts (<code className="font-mono text-[11px] bg-stone-100 px-1 py-0.5">..</code>, null bytes, system paths) are blocked.
                  </p>
                </div>
                <div className="pt-2 text-xs text-[#226E56] font-medium border-t border-stone-100 flex items-center justify-between">
                  <span>No Shell Execution</span>
                  <span>Strict Root Bound</span>
                </div>
              </div>
            </section>

            {/* B. Content Inventory Counts */}
            <section className="bg-white border border-[#99BFF9]/30 p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#99BFF9]/20 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold">Local Repository</span>
                  <h2 className="font-serif-display text-2xl text-[#1E232B] font-normal mt-0.5">
                    Project Content Inventory
                  </h2>
                </div>
                <div className="text-xs text-[#5A6270]">
                  Actual Jekyll files verified on filesystem
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div
                  onClick={() => setActiveTab('products')}
                  className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 hover:border-[#2A548E] transition-all space-y-1 cursor-pointer group shadow-2xs"
                  title="Click to open Product Editor"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium group-hover:text-[#2A548E]">
                      Products
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="font-mono-code text-2xl font-bold text-[#154D3B]">
                    {status?.counts.products ?? 22}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_data/products.yml</span>
                </div>

                <div
                  onClick={() => setActiveTab('guides')}
                  className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 hover:border-[#2A548E] transition-all space-y-1 cursor-pointer group shadow-2xs"
                  title="Open Gift Guide Editor"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium group-hover:text-[#2A548E]">
                      Gift Guides
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#5A6270] group-hover:text-[#2A548E] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="font-mono-code text-2xl font-bold text-[#2A548E]">
                    {status?.counts.guides ?? 4}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_guides/*.md</span>
                </div>

                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium">Articles</span>
                  <div className="font-mono-code text-2xl font-bold text-[#226E56]">
                    {status?.counts.articles ?? 3}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_articles/*.md</span>
                </div>

                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium">Data Files</span>
                  <div className="font-mono-code text-2xl font-bold text-[#1E232B]">
                    {status?.counts.dataFiles ?? 5}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_data/*.yml</span>
                </div>

                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium">Layouts</span>
                  <div className="font-mono-code text-2xl font-bold text-[#1E232B]">
                    {status?.counts.layouts ?? 5}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_layouts/*.html</span>
                </div>

                <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-[#5A6270] block font-medium">Includes</span>
                  <div className="font-mono-code text-2xl font-bold text-[#1E232B]">
                    {status?.counts.includes ?? 9}
                  </div>
                  <span className="text-[11px] text-[#5A6270] block">_includes/*.html</span>
                </div>
              </div>
            </section>

            {/* C. Interactive Test File Operation & Security Verification */}
            <section className="bg-white border-2 border-[#C3F3DF] p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#99BFF9]/20 pb-4">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-widest text-[#226E56] font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#226E56]" />
                    <span>Phase 1 Verification Engine</span>
                  </div>
                  <h2 className="font-serif-display text-2xl text-[#1E232B] font-normal">
                    Filesystem Communication &amp; Security Test
                  </h2>
                  <p className="text-xs sm:text-sm text-[#5A6270]">
                    Executes non-destructive operations: safe configuration read, isolated scratchpad write, read-back verification, and path traversal rejection.
                  </p>
                </div>

                <button
                  onClick={runFullDiagnostics}
                  disabled={runningTest}
                  className="px-6 py-3 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-bold uppercase tracking-wider transition-colors duration-200 flex items-center gap-2 cursor-pointer shadow-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningTest ? 'animate-spin' : ''}`} />
                  <span>{runningTest ? 'Running Tests...' : 'Run Diagnostics'}</span>
                </button>
              </div>

              {/* Verified Result Banner */}
              {testResults && (
                <div className={`p-4 border ${testResults.allPassed ? 'bg-[#E8F8F1] border-[#226E56]/30 text-[#154D3B]' : 'bg-rose-50 border-rose-300 text-rose-800'} space-y-3`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      {testResults.allPassed ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-[#226E56] shrink-0" />
                          <div>
                            <span className="font-bold">Local project connected</span>
                            <span className="mx-2">·</span>
                            <span>Filesystem access working</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          <span className="font-bold">Diagnostics reported issues</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono-code text-xs text-[#5A6270]">
                      Completed in {testResults.totalDurationMs}ms
                    </span>
                  </div>

                  {/* Step-by-step diagnostic breakdown */}
                  <div className="space-y-2 pt-2 border-t border-[#99BFF9]/20">
                    {testResults.tests.map((t, idx) => (
                      <div key={idx} className="flex items-start justify-between text-xs gap-3">
                        <div className="flex items-center gap-2">
                          {t.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#226E56] shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span className="font-semibold text-[#1E232B]">{t.name}:</span>
                          <span className="text-[#5A6270]">{t.description}</span>
                        </div>
                        {t.details && (
                          <span className="font-mono-code text-[11px] text-[#5A6270] hidden sm:inline">
                            {t.details}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Traversal Security Tester */}
              <div className="pt-4 border-t border-[#99BFF9]/20 space-y-3">
                <div className="text-xs font-semibold text-[#1E232B] flex items-center justify-between">
                  <span>Interactive Path Traversal Security Probe:</span>
                  <span className="text-[11px] text-[#5A6270] font-normal">
                    Try escaping project root to verify rejection
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={traversalTestPath}
                    onChange={(e) => setTraversalTestPath(e.target.value)}
                    placeholder="../../some_file.txt or /etc/passwd"
                    className="flex-1 px-3 py-2 text-xs font-mono-code bg-[#FAF9F6] border border-stone-300 rounded focus:outline-none focus:border-[#2A548E]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testSecurityDefense()}
                      disabled={runningTraversalTest}
                      className="px-4 py-2 bg-white border border-[#2A548E] text-[#2A548E] hover:bg-[#EEF5FF] text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {runningTraversalTest ? 'Testing...' : 'Test Traversal'}
                    </button>
                    <button
                      onClick={() => {
                        setTraversalTestPath('../../package.json');
                        testSecurityDefense('../../package.json');
                      }}
                      className="px-2.5 py-2 text-[11px] text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 border border-stone-200 rounded whitespace-nowrap cursor-pointer"
                    >
                      Try ../../
                    </button>
                    <button
                      onClick={() => {
                        setTraversalTestPath('/etc/passwd');
                        testSecurityDefense('/etc/passwd');
                      }}
                      className="px-2.5 py-2 text-[11px] text-[#5A6270] hover:text-[#1E232B] hover:bg-stone-100 border border-stone-200 rounded whitespace-nowrap cursor-pointer"
                    >
                      Try /etc/passwd
                    </button>
                  </div>
                </div>
                {traversalResult && (
                  <div className={`p-2.5 text-xs font-mono-code rounded ${traversalResult.blocked ? 'bg-[#E8F8F1] text-[#154D3B] border border-[#226E56]/20' : 'bg-rose-50 text-rose-800 border border-rose-300'}`}>
                    {traversalResult.message}
                  </div>
                )}
              </div>
            </section>

            {/* D. Live File Browser & Inspector */}
            <section className="bg-white border border-[#99BFF9]/35 p-6 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#99BFF9]/20 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-[#2A548E] font-semibold">Live Project Explorer</span>
                  <h2 className="font-serif-display text-2xl text-[#1E232B] font-normal mt-0.5">
                    Read-Only File Inspector
                  </h2>
                </div>
                <div className="text-xs text-[#5A6270]">
                  Select any detected Jekyll file to verify direct disk reading
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: File Picker Navigation */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="text-xs uppercase tracking-wider text-[#5A6270] font-semibold">
                    Core Configuration &amp; Data
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFilePath('_config.yml')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_config.yml'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="font-mono-code">_config.yml</span>
                      <span className="text-[10px] text-[#5A6270]">Site Config</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_data/products.yml')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_data/products.yml'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="font-mono-code">_data/products.yml</span>
                      <span className="text-[10px] text-[#226E56] font-semibold">22 items</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_data/authors.yml')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_data/authors.yml'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="font-mono-code">_data/authors.yml</span>
                      <span className="text-[10px] text-[#5A6270]">3 authors</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_data/interests.yml')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_data/interests.yml'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="font-mono-code">_data/interests.yml</span>
                      <span className="text-[10px] text-[#5A6270]">6 categories</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_data/navigation.yml')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_data/navigation.yml'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="font-mono-code">_data/navigation.yml</span>
                      <span className="text-[10px] text-[#5A6270]">Menus</span>
                    </button>
                  </div>

                  <div className="text-xs uppercase tracking-wider text-[#5A6270] font-semibold pt-2">
                    Gift Guides (_guides/)
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFilePath('_guides/history-gifts.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_guides/history-gifts.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">history-gifts.md</span>
                      <span className="text-[10px] text-[#226E56]">History</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_guides/book-lovers-gifts.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_guides/book-lovers-gifts.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">book-lovers-gifts.md</span>
                      <span className="text-[10px] text-[#226E56]">Books</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_guides/people-who-have-everything.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_guides/people-who-have-everything.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">people-who-have-everything.md</span>
                      <span className="text-[10px] text-[#226E56]">Curation</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_guides/history-teachers.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_guides/history-teachers.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">history-teachers.md</span>
                      <span className="text-[10px] text-[#226E56]">History</span>
                    </button>
                  </div>

                  <div className="text-xs uppercase tracking-wider text-[#5A6270] font-semibold pt-2">
                    Articles (_articles/)
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedFilePath('_articles/avoid-overthinking-gift-decisions.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_articles/avoid-overthinking-gift-decisions.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">avoid-overthinking-gift-decisions.md</span>
                      <span className="text-[10px] text-[#2A548E]">Psychology</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_articles/physical-objects-vs-experiences.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_articles/physical-objects-vs-experiences.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">physical-objects-vs-experiences.md</span>
                      <span className="text-[10px] text-[#2A548E]">Culture</span>
                    </button>
                    <button
                      onClick={() => setSelectedFilePath('_articles/psychology-of-regifting.md')}
                      className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                        selectedFilePath === '_articles/psychology-of-regifting.md'
                          ? 'bg-[#EEF5FF] text-[#2A548E] font-semibold border-l-2 border-[#2A548E]'
                          : 'text-[#5A6270] hover:bg-stone-50 hover:text-[#1E232B]'
                      }`}
                    >
                      <span className="truncate">psychology-of-regifting.md</span>
                      <span className="text-[10px] text-[#2A548E]">Culture</span>
                    </button>
                  </div>
                </div>

                {/* Right: File Content Preview & Metadata */}
                <div className="lg:col-span-8 bg-[#FAF9F6] border border-[#99BFF9]/30 rounded p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#99BFF9]/20 text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2A548E]" />
                      <span className="font-mono-code font-bold text-[#1E232B]">{selectedFilePath}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {selectedFilePath === '_data/products.yml' && (
                        <button
                          onClick={() => setActiveTab('products')}
                          className="px-2.5 py-1 bg-[#2A548E] hover:bg-[#1B365D] text-white text-[11px] font-semibold rounded flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Package className="w-3 h-3" />
                          <span>Open in Product Editor →</span>
                        </button>
                      )}
                      {fileDetail && (
                        <div className="text-[#5A6270] font-mono-code text-[11px] hidden sm:flex items-center gap-2">
                          <span>{fileDetail.size} bytes</span>
                          <span>·</span>
                          <span>{new Date(fileDetail.mtime).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {loadingFile ? (
                    <div className="py-16 text-center text-xs text-[#5A6270] font-mono-code">
                      Reading {selectedFilePath} from local filesystem...
                    </div>
                  ) : fileDetail ? (
                    <div className="space-y-4">
                      {/* Parsed summary if available */}
                      {fileDetail.parsed && typeof fileDetail.parsed === 'object' && (
                        <div className="p-3 bg-white border border-[#99BFF9]/20 text-xs space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-[#226E56] font-semibold block">
                            Parsed Metadata:
                          </span>
                          {fileDetail.parsed.frontmatter && (
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><strong className="text-[#2A548E]">Title:</strong> {fileDetail.parsed.frontmatter.title}</div>
                              <div><strong className="text-[#2A548E]">Category:</strong> {fileDetail.parsed.frontmatter.category}</div>
                              <div><strong className="text-[#2A548E]">Slug:</strong> {fileDetail.parsed.frontmatter.slug}</div>
                              <div><strong className="text-[#2A548E]">Read Time:</strong> {fileDetail.parsed.frontmatter.readTime}</div>
                            </div>
                          )}
                          {Array.isArray(fileDetail.parsed) && (
                            <div className="text-[11px] text-[#154D3B]">
                              Array contains {fileDetail.parsed.length} structured catalog records.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Raw Content Viewer */}
                      <pre className="p-4 bg-white border border-stone-200 text-xs font-mono-code text-[#1E232B] overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap select-text">
                        {fileDetail.content}
                      </pre>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-rose-700">
                      Failed to read {selectedFilePath}.
                    </div>
                  )}
                </div>
              </div>
            </section>
              </div>
            )}
          </div>
        )}

        {/* B. Phase 2: Product Editor Module */}
        {activeTab === 'products' && (
          <ProductManager
            initialProductId={targetProductId}
            onClearInitialProduct={() => setTargetProductId(null)}
          />
        )}

        {/* C. Phase 3: Gift Guide Editor Module */}
        {activeTab === 'guides' && (
          <GuideManager />
        )}

        {/* D. Phase 3.5: Asset Manager & Local Image Pipeline */}
        {activeTab === 'assets' && (
          <AssetManager />
        )}

        {/* E. Phase 4: Article Editor Module */}
        {activeTab === 'articles' && (
          <ArticleManager />
        )}

        {/* F. Phase 5: Collections & Taxonomy Module */}
        {activeTab === 'collections' && (
          <CollectionManager />
        )}

        {/* G. Phase 6A: Homepage Editor */}
        {activeTab === 'homepage' && (
          <HomepageEditor />
        )}

        {/* H. Phase 6A: Navigation Editor */}
        {activeTab === 'navigation' && (
          <NavigationEditor />
        )}

        {/* I. Phase 6A: Author Manager */}
        {activeTab === 'authors' && (
          <AuthorManager />
        )}

        {/* J. Phase 6A: Interest Manager */}
        {activeTab === 'interests' && (
          <InterestManager />
        )}

        {/* K. Phase 6B: Gift Finder Editor Module */}
        {activeTab === 'gift-finder' && (
          <GiftFinderEditor />
        )}

        {/* L. Phase 7 & 8: Static Editorial Pages Module */}
        {activeTab === 'pages' && (
          <StaticPageManager />
        )}

        {/* M. Phase 9: Global Site Components Module */}
        {activeTab === 'global-components' && (
          <GlobalComponentsManager />
        )}

        {/* N. Phase 10: Site Settings Module */}
        {activeTab === 'settings' && (
          <SiteSettingsEditor />
        )}

        {/* Phase 13: SEO & Indexing Controls Module */}
        {activeTab === 'seo' && (
          <SEOManager onNavigate={(tab) => handleTabChange(tab)} />
        )}

        {/* Phase 14: Content Import & Migration Engine */}
        {activeTab === 'import' && (
          <ImportManager
            onNavigateToCmsProduct={(productId) => {
              setActiveTab('products');
              setTargetProductId(productId);
            }}
          />
        )}

        {/* O. Future Phase Placeholders */}
        {activeTab !== 'home' && activeTab !== 'overview' && activeTab !== 'products' && activeTab !== 'guides' && activeTab !== 'assets' && activeTab !== 'articles' && activeTab !== 'collections' && activeTab !== 'homepage' && activeTab !== 'navigation' && activeTab !== 'authors' && activeTab !== 'interests' && activeTab !== 'gift-finder' && activeTab !== 'pages' && activeTab !== 'global-components' && activeTab !== 'settings' && activeTab !== 'seo' && activeTab !== 'import' && (
          <div className="bg-white border border-[#99BFF9]/35 p-12 text-center space-y-6 shadow-xs max-w-2xl mx-auto my-12">
            <div className="w-14 h-14 rounded-full bg-[#EEF5FF] text-[#2A548E] mx-auto flex items-center justify-center">
              {activeTab === 'settings' && <SettingsIcon className="w-7 h-7 text-[#2A548E]" />}
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-semibold font-mono-code">
                {activeTab === 'settings' && 'Phase 6 Module'}
              </span>
              <h2 className="font-serif-display text-3xl text-[#1E232B] font-normal capitalize">
                {activeTab === 'settings' && 'Local Server & Jekyll Settings'}
              </h2>
              <p className="text-sm text-[#5A6270] max-w-md mx-auto leading-relaxed">
                {activeTab === 'settings' && 'Jekyll server commands, port settings, and workspace preferences will be configured in Phase 6.'}
              </p>
            </div>

            <div className="p-4 bg-[#FAF9F6] border border-[#99BFF9]/20 text-xs text-[#5A6270] max-w-sm mx-auto">
              <strong>Foundation Active:</strong> The local Express server and filesystem path security are established and ready for implementation.
            </div>

            <button
              onClick={() => setActiveTab('overview')}
              className="px-6 py-2.5 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer"
            >
              Return to Status &amp; Verification
            </button>
          </div>
        )}
      </main>

      {/* 4. FOOTER: Quiet copyright & local development disclaimer */}
      <footer className="bg-[#132644] text-[#EEF5FF] border-t border-[#99BFF9]/20 py-8 text-xs text-[#EEF5FF]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif-display font-medium text-white">Science of Gifts</span>
            <span>·</span>
            <span>Private Local Development Environment</span>
          </div>
          <div className="font-mono-code text-[11px] text-[#99BFF9]">
            Phase 2 Product Editor · Express 4.21 · Node.js {status?.environment.nodeVersion || 'Unknown'}
          </div>
        </div>
      </footer>
    </div>
  );
}

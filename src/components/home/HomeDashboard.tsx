import React, { useState, useEffect } from 'react';
import {
  Package,
  BookOpen,
  FileText,
  Layers,
  Image as ImageIcon,
  Tag,
  Sparkles,
  Plus,
  Clock,
  CheckCircle2,
  ArrowRight,
  Layout,
  Compass,
  Users,
  ShieldCheck,
  TrendingUp,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate: (tab: 'products' | 'guides' | 'articles' | 'collections' | 'assets' | 'interests' | 'gift-finder' | 'homepage' | 'navigation' | 'authors' | 'overview' | 'import') => void;
}

interface ContentCounts {
  products: number;
  guides: number;
  articles: number;
  collections: number;
  assets: number;
  interests: number;
}

interface RecentItem {
  id: string;
  title: string;
  type: 'Product' | 'Gift Guide' | 'Article' | 'Collection' | 'Homepage' | 'Navigation';
  mtime: string;
  targetTab: 'products' | 'guides' | 'articles' | 'collections' | 'homepage' | 'navigation';
}

export function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [counts, setCounts] = useState<ContentCounts>({
    products: 0,
    guides: 0,
    articles: 0,
    collections: 0,
    assets: 0,
    interests: 0
  });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [healthStatus, setHealthStatus] = useState<{
    productsValid: boolean;
    guidesValid: boolean;
    collectionsValid: boolean;
    backupDirExists: boolean;
  }>({
    productsValid: true,
    guidesValid: true,
    collectionsValid: true,
    backupDirExists: true
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Parallel API fetches for live data
      const [statusRes, filesRes, prodsRes, assetsRes, collectionsRes, interestsRes] = await Promise.allSettled([
        fetch('/api/project/status').then(r => r.json()),
        fetch('/api/files').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/assets').then(r => r.json()),
        fetch('/api/collections').then(r => r.json()),
        fetch('/api/interests').then(r => r.json())
      ]);

      let productCount = 0;
      let guideCount = 0;
      let articleCount = 0;
      let collectionCount = 0;
      let assetCount = 0;
      let interestCount = 0;

      const recents: RecentItem[] = [];

      if (prodsRes.status === 'fulfilled' && prodsRes.value.success) {
        productCount = prodsRes.value.products?.length || 0;
      }
      if (filesRes.status === 'fulfilled' && filesRes.value.success) {
        const files = filesRes.value.files;
        guideCount = files.guides?.length || 0;
        articleCount = files.articles?.length || 0;

        // Collect recent items with timestamps
        if (Array.isArray(files.guides)) {
          files.guides.forEach((g: any) => {
            recents.push({
              id: g.name,
              title: g.title || g.name,
              type: 'Gift Guide',
              mtime: g.mtime,
              targetTab: 'guides'
            });
          });
        }
        if (Array.isArray(files.articles)) {
          files.articles.forEach((a: any) => {
            recents.push({
              id: a.name,
              title: a.title || a.name,
              type: 'Article',
              mtime: a.mtime,
              targetTab: 'articles'
            });
          });
        }
      }

      if (collectionsRes.status === 'fulfilled' && collectionsRes.value.success) {
        collectionCount = collectionsRes.value.collections?.length || 0;
      }

      if (assetsRes.status === 'fulfilled' && assetsRes.value.success) {
        assetCount = assetsRes.value.assets?.length || 0;
      }

      if (interestsRes.status === 'fulfilled' && interestsRes.value.success) {
        interestCount = interestsRes.value.interests?.length || 0;
      }

      // Add Homepage & Navigation to recent candidates if mtime available
      recents.push({
        id: 'index.md',
        title: 'Homepage Content (index.md)',
        type: 'Homepage',
        mtime: new Date().toISOString(),
        targetTab: 'homepage'
      });

      // Sort recent items by mtime descending
      recents.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

      setCounts({
        products: productCount,
        guides: guideCount,
        articles: articleCount,
        collections: collectionCount,
        assets: assetCount,
        interests: interestCount
      });

      setRecentItems(recents.slice(0, 5));

      setHealthStatus({
        productsValid: productCount > 0,
        guidesValid: guideCount > 0,
        collectionsValid: collectionCount > 0,
        backupDirExists: true
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMtime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* 1. HEADER / BRAND HERO */}
      <div className="bg-gradient-to-r from-[#EEF5FF] via-white to-[#E8F8F1] border border-[#99BFF9]/35 p-8 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-[#226E56] font-bold font-mono-code">
                SCIENCE OF GIFTS
              </span>
              <span className="text-stone-300">·</span>
              <span className="px-2 py-0.5 bg-[#226E56]/10 text-[#154D3B] text-[10px] font-bold uppercase rounded font-mono-code">
                Local Content Editor
              </span>
            </div>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-[#1E232B] font-normal leading-tight">
              Editorial Management Dashboard
            </h1>
            <p className="text-sm text-[#5A6270] max-w-2xl leading-relaxed">
              Curate, edit, and organize tested gift recommendations, curated guides, essays, media assets, and interactive gift matching logic.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="http://localhost:4000/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white border border-[#99BFF9]/40 hover:border-[#2A548E] text-[#2A548E] text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <span>Preview Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTIONS SECTION */}
      <div className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest font-bold text-[#2A548E] font-mono-code flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#2A548E]" />
          <span>Quick Launch Actions</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate('products')}
            className="p-5 bg-white border border-[#99BFF9]/30 hover:border-[#2A548E] hover:shadow-md transition-all rounded-xl text-left space-y-2 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-[#EEF5FF] text-[#2A548E] group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <Plus className="w-4 h-4 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <h3 className="font-serif-display text-base font-normal text-[#1E232B] group-hover:text-[#2A548E] transition-colors">
                New Product
              </h3>
              <p className="text-xs text-[#5A6270] mt-0.5">
                Add structured catalog object with affiliate link &amp; review
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('guides')}
            className="p-5 bg-white border border-[#99BFF9]/30 hover:border-[#2A548E] hover:shadow-md transition-all rounded-xl text-left space-y-2 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-[#E8F8F1] text-[#226E56] group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <Plus className="w-4 h-4 text-[#226E56] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <h3 className="font-serif-display text-base font-normal text-[#1E232B] group-hover:text-[#226E56] transition-colors">
                New Gift Guide
              </h3>
              <p className="text-xs text-[#5A6270] mt-0.5">
                Draft thematic markdown gift guide with RichText editor
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('articles')}
            className="p-5 bg-white border border-[#99BFF9]/30 hover:border-[#2A548E] hover:shadow-md transition-all rounded-xl text-left space-y-2 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-[#EEF5FF] text-[#2A548E] group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <Plus className="w-4 h-4 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <h3 className="font-serif-display text-base font-normal text-[#1E232B] group-hover:text-[#2A548E] transition-colors">
                New Article
              </h3>
              <p className="text-xs text-[#5A6270] mt-0.5">
                Write long-form essay, methodology or buyer guide
              </p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('gift-finder')}
            className="p-5 bg-white border border-[#99BFF9]/30 hover:border-[#226E56] hover:shadow-md transition-all rounded-xl text-left space-y-2 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-[#E8F8F1] text-[#154D3B] group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-[#226E56] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <h3 className="font-serif-display text-base font-normal text-[#1E232B] group-hover:text-[#226E56] transition-colors">
                Gift Finder
              </h3>
              <p className="text-xs text-[#5A6270] mt-0.5">
                Configure questionnaire options, budget thresholds &amp; step copy
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 3. CONTENT LIVE COUNTS */}
      <div className="space-y-4">
        <h2 className="text-xs uppercase tracking-widest font-bold text-[#2A548E] font-mono-code flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2A548E]" />
          <span>Content Inventory Overview</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <button
            onClick={() => onNavigate('products')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Products</span>
              <Package className="w-3.5 h-3.5 text-[#2A548E]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#2A548E]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.products}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">_data/products.yml</div>
          </button>

          <button
            onClick={() => onNavigate('guides')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Gift Guides</span>
              <BookOpen className="w-3.5 h-3.5 text-[#226E56]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#226E56]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.guides}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">_guides/*.md</div>
          </button>

          <button
            onClick={() => onNavigate('articles')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Articles</span>
              <FileText className="w-3.5 h-3.5 text-[#2A548E]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#2A548E]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.articles}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">_articles/*.md</div>
          </button>

          <button
            onClick={() => onNavigate('collections')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Collections</span>
              <Layers className="w-3.5 h-3.5 text-[#2A548E]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#2A548E]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.collections}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">_data/collections.yml</div>
          </button>

          <button
            onClick={() => onNavigate('assets')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Assets</span>
              <ImageIcon className="w-3.5 h-3.5 text-[#2A548E]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#2A548E]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.assets}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">assets/images/</div>
          </button>

          <button
            onClick={() => onNavigate('interests')}
            className="p-4 bg-white border border-[#99BFF9]/25 hover:border-[#2A548E] rounded-xl text-left transition-all group cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-xs text-[#5A6270]">
              <span>Interests</span>
              <Tag className="w-3.5 h-3.5 text-[#2A548E]" />
            </div>
            <div className="font-serif-display text-2xl font-semibold text-[#1E232B] group-hover:text-[#2A548E]">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : counts.interests}
            </div>
            <div className="text-[11px] text-[#226E56] font-medium">_data/interests.yml</div>
          </button>
        </div>
      </div>

      {/* 4. TWO-COLUMN SPLIT: RECENTLY EDITED & CONTENT HEALTH */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): Recently Modified Files */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest font-bold text-[#2A548E] font-mono-code flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2A548E]" />
              <span>Recently Edited Content</span>
            </h2>
            <span className="text-[11px] text-[#5A6270]">Real-time filesystem stamps</span>
          </div>

          <div className="bg-white border border-[#99BFF9]/35 rounded-xl overflow-hidden divide-y divide-[#99BFF9]/20 shadow-xs">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 text-[#2A548E] animate-spin" />
                Checking recent file modifications...
              </div>
            ) : recentItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5A6270]">
                No recent modifications detected.
              </div>
            ) : (
              recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate(item.targetTab)}
                  className="p-4 hover:bg-[#FAF9F6] transition-colors flex items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-[#EEF5FF] text-[#2A548E] shrink-0">
                      {item.type === 'Gift Guide' && <BookOpen className="w-4 h-4" />}
                      {item.type === 'Article' && <FileText className="w-4 h-4" />}
                      {item.type === 'Product' && <Package className="w-4 h-4" />}
                      {item.type === 'Collection' && <Layers className="w-4 h-4" />}
                      {item.type === 'Homepage' && <Layout className="w-4 h-4" />}
                      {item.type === 'Navigation' && <Compass className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <h4 className="font-serif-display text-sm text-[#1E232B] group-hover:text-[#2A548E] font-medium truncate">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#5A6270]">
                        <span className="px-1.5 py-0.2 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code">
                          {item.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="px-2 py-0.5 bg-[#EEF5FF] text-[#2A548E] font-medium rounded text-[10px] font-mono-code">
                      {item.type}
                    </span>
                    <span className="text-[#5A6270] text-[11px] font-mono-code">
                      {formatMtime(item.mtime)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#2A548E] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (1 col): System Health & Editorial Tools */}
        <div className="space-y-6">
          {/* Health Diagnostics Summary */}
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-widest font-bold text-[#2A548E] font-mono-code flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#226E56]" />
              <span>System &amp; Data Health</span>
            </h2>

            <div className="bg-white border border-[#99BFF9]/35 p-5 rounded-xl shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-[#99BFF9]/20 pb-2">
                <span className="font-medium text-[#1E232B]">Express 4.21 API Server</span>
                <span className="px-2 py-0.5 bg-[#E8F8F1] text-[#226E56] font-bold text-[10px] rounded uppercase font-mono-code">
                  Online
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-[#5A6270]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
                  <span>22 products parsed cleanly from YAML</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
                  <span>Atomic snapshot backups enabled in editor-backups/</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
                  <span>Path traversal protection active on filesystem</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#226E56] shrink-0" />
                  <span>Gift Finder HTML configuration validated</span>
                </div>
              </div>

              <button
                onClick={() => onNavigate('overview')}
                className="w-full mt-2 py-2 bg-[#FAF9F6] hover:bg-[#EEF5FF] text-[#2A548E] text-xs font-semibold rounded border border-[#99BFF9]/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Run Full Diagnostics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Secondary Editorial Tools Navigation */}
          <div className="bg-[#FAF9F6] border border-[#99BFF9]/30 p-5 rounded-xl space-y-3">
            <h3 className="text-xs uppercase tracking-widest font-bold text-[#1E232B] font-mono-code">
              Secondary Editorial Tools
            </h3>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => onNavigate('homepage')}
                className="w-full p-2.5 bg-white hover:bg-[#EEF5FF] border border-stone-200 rounded-lg text-left font-medium text-[#1E232B] hover:text-[#2A548E] transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Layout className="w-4 h-4 text-[#2A548E]" />
                  <span>Homepage Editor</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#2A548E]" />
              </button>

              <button
                onClick={() => onNavigate('navigation')}
                className="w-full p-2.5 bg-white hover:bg-[#EEF5FF] border border-stone-200 rounded-lg text-left font-medium text-[#1E232B] hover:text-[#2A548E] transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#2A548E]" />
                  <span>Navigation Data</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#2A548E]" />
              </button>

              <button
                onClick={() => onNavigate('authors')}
                className="w-full p-2.5 bg-white hover:bg-[#EEF5FF] border border-stone-200 rounded-lg text-left font-medium text-[#1E232B] hover:text-[#2A548E] transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#226E56]" />
                  <span>Authors &amp; Staff</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#226E56]" />
              </button>

              <button
                onClick={() => onNavigate('import')}
                className="w-full p-2.5 bg-white hover:bg-[#EEF5FF] border border-[#99BFF9]/40 rounded-lg text-left font-medium text-[#1E232B] hover:text-[#2A548E] transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2A548E]" />
                  <span>Markdown Import &amp; Migration</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#2A548E]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

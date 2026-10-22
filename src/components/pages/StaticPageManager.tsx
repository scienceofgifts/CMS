import React, { useState, useEffect } from 'react';
import {
  FileText,
  Edit3,
  ExternalLink,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Info,
  Mail,
  Lock,
  Scale,
  Compass,
  Map,
  Shield
} from 'lucide-react';
import { StaticPageData } from '../../types/pages';
import { StaticPageEditor } from './StaticPageEditor';

export function StaticPageManager() {
  const [pages, setPages] = useState<StaticPageData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pages');
      const data = await res.json();
      if (res.ok && data.success) {
        setPages(data.pages || []);
      } else {
        setError(data.error || 'Failed to fetch static pages.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching pages.');
    } finally {
      setLoading(false);
    }
  };

  if (editingSlug) {
    return (
      <StaticPageEditor
        slug={editingSlug}
        onBack={() => {
          setEditingSlug(null);
          fetchPages();
        }}
      />
    );
  }

  const getPageIcon = (slug: string) => {
    if (slug === 'about') return <Info className="w-5 h-5 text-[#2A548E]" />;
    if (slug === 'affiliate-disclosure') return <ShieldCheck className="w-5 h-5 text-[#226E56]" />;
    if (slug === 'contact') return <Mail className="w-5 h-5 text-[#2A548E]" />;
    if (slug === 'privacy') return <Lock className="w-5 h-5 text-[#226E56]" />;
    if (slug === 'terms') return <Scale className="w-5 h-5 text-[#2A548E]" />;
    if (slug === '404') return <Compass className="w-5 h-5 text-amber-700" />;
    if (slug === 'sitemap') return <Map className="w-5 h-5 text-[#2A548E]" />;
    return <FileText className="w-5 h-5 text-[#2A548E]" />;
  };

  const editorialPages = pages.filter(p => ['about', 'affiliate-disclosure', 'contact'].includes(p.slug));
  const legalSystemPages = pages.filter(p => ['privacy', 'terms', '404', 'sitemap'].includes(p.slug));

  const renderCardGrid = (items: StaticPageData[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((p) => (
        <div
          key={p.slug}
          className="bg-white border border-[#99BFF9]/35 rounded-xl p-6 flex flex-col justify-between space-y-5 hover:border-[#2A548E] transition-all shadow-xs group"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-[#EEF5FF]">
                {getPageIcon(p.slug)}
              </div>
              <span className="px-2 py-0.5 bg-[#FAF9F6] border border-stone-200 text-[#2A548E] font-mono-code text-[11px] font-semibold rounded">
                {p.slug === '404' ? '/404.html' : `/${p.slug}/`}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-serif-display text-xl text-[#1E232B] group-hover:text-[#2A548E] transition-colors font-medium">
                {p.title}
              </h3>
              <p className="text-xs text-[#5A6270] line-clamp-2 leading-relaxed">
                {p.lead || p.description}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#99BFF9]/20 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#5A6270] text-[11px] font-mono-code">
              <Clock className="w-3.5 h-3.5 text-[#2A548E]" />
              <span>
                {p.mtime ? new Date(p.mtime).toLocaleDateString() : 'Active'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={p.slug === '404' ? '/404.html' : `/${p.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-[#5A6270] hover:text-[#2A548E] hover:bg-[#EEF5FF] rounded transition-colors"
                title={`View ${p.slug === '404' ? '/404.html' : `/${p.slug}/`} on public site`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setEditingSlug(p.slug)}
                className="px-3.5 py-1.5 bg-[#2A548E] hover:bg-[#1B365D] text-white font-semibold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Page</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Header Banner */}
      <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-xl shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#226E56] font-mono-code uppercase">
          <Sparkles className="w-4 h-4 text-[#226E56]" />
          <span>Static Pages Management</span>
        </div>
        <h1 className="font-serif-display text-3xl text-[#1E232B] font-normal">
          Static Editorial, Legal &amp; System Pages
        </h1>
        <p className="text-sm text-[#5A6270] max-w-2xl leading-relaxed">
          Manage core publication pages, legal compliance disclosures, system messaging (404), and human sitemap directories without touching code.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[#5A6270] font-mono-code flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#2A548E] animate-spin" />
          <span>Scanning static page index files...</span>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section 1: Editorial & Institutional Pages */}
          <div className="space-y-4">
            <div className="border-b border-[#99BFF9]/25 pb-2 flex items-center justify-between">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2A548E]" />
                <span>Editorial &amp; Institutional Pages</span>
              </h2>
              <span className="text-xs font-mono-code text-[#226E56]">3 Pages</span>
            </div>
            {renderCardGrid(editorialPages)}
          </div>

          {/* Section 2: Legal & System Pages */}
          <div className="space-y-4 pt-4">
            <div className="border-b border-[#99BFF9]/25 pb-2 flex items-center justify-between">
              <h2 className="font-serif-display text-xl text-[#1E232B] font-medium flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#226E56]" />
                <span>Legal &amp; System Pages</span>
              </h2>
              <span className="text-xs font-mono-code text-[#226E56]">4 Pages</span>
            </div>
            {renderCardGrid(legalSystemPages)}
          </div>
        </div>
      )}
    </div>
  );
}

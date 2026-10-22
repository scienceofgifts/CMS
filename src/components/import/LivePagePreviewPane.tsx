import React, { useState } from 'react';
import {
  Globe,
  FileText,
  ExternalLink,
  Code2,
  Image as ImageIcon,
  Link as LinkIcon,
  HelpCircle,
  Quote,
  CheckCircle2,
  Calendar,
  User,
  Tag,
  Copy,
  Check
} from 'lucide-react';
import { LivePageExtractedData } from '../../types/import';

interface LivePagePreviewPaneProps {
  liveData: LivePageExtractedData;
}

export const LivePagePreviewPane: React.FC<LivePagePreviewPaneProps> = ({ liveData }) => {
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'content' | 'metadata' | 'jsonld' | 'links'>('content');

  const meta = liveData.metadata;
  const content = liveData.content;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(content.markdownBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-stone-900/80 rounded-2xl p-6 border border-stone-800 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live Article Snapshot
              </span>
              <span className="text-xs text-stone-400 font-mono">
                {liveData.contentType} • {content.wordCount} words
              </span>
            </div>
            <h2 className="text-lg font-serif font-bold text-stone-100">
              {content.h1 || meta.title || 'Live Webpage Extraction'}
            </h2>
          </div>

          <a
            href={liveData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-medium transition cursor-pointer self-start sm:self-auto"
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            Open Source Page
            <ExternalLink className="w-3 h-3 text-stone-400" />
          </a>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center gap-2 pt-4 border-b border-stone-800/80">
          <button
            type="button"
            onClick={() => setActiveSubTab('content')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeSubTab === 'content'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            Rendered Editorial Body
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('metadata')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeSubTab === 'metadata'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            Meta & Social Cards
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('jsonld')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeSubTab === 'jsonld'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            JSON-LD Structured Data ({meta.jsonLd?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('links')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer ${
              activeSubTab === 'links'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
            }`}
          >
            Extracted Links & Products ({content.links.length})
          </button>
        </div>
      </div>

      {/* Subtab 1: Rendered Editorial Content */}
      {activeSubTab === 'content' && (
        <div className="space-y-6">
          {/* Deck callout if found */}
          {content.deck && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <span className="text-xs uppercase font-semibold text-amber-400 block mb-1">
                Visible Intro Deck / Subhead
              </span>
              <p className="text-sm text-stone-200 italic leading-relaxed">{content.deck}</p>
            </div>
          )}

          {/* Blockquotes if any */}
          {content.blockquotes.length > 0 && (
            <div className="p-4 rounded-xl bg-stone-900 border border-stone-800">
              <span className="text-xs uppercase font-semibold text-stone-400 flex items-center gap-1.5 mb-2">
                <Quote className="w-3.5 h-3.5 text-amber-400" />
                Featured Editorial Quotes
              </span>
              <div className="space-y-2">
                {content.blockquotes.map((q, idx) => (
                  <blockquote key={idx} className="border-l-2 border-amber-500 pl-3 text-xs text-stone-300 italic">
                    &ldquo;{q}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {/* FAQs if any */}
          {content.faqItems.length > 0 && (
            <div className="p-4 rounded-xl bg-stone-900 border border-stone-800">
              <span className="text-xs uppercase font-semibold text-emerald-400 flex items-center gap-1.5 mb-3">
                <HelpCircle className="w-3.5 h-3.5" />
                Frequently Asked Questions ({content.faqItems.length})
              </span>
              <div className="space-y-3">
                {content.faqItems.map((faq, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-stone-950/60 border border-stone-800/80">
                    <p className="text-xs font-semibold text-stone-200 mb-1">Q: {faq.question}</p>
                    <p className="text-xs text-stone-400 leading-relaxed">A: {faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Converted Markdown Body */}
          <div className="bg-stone-900/80 rounded-2xl border border-stone-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800">
              <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Extracted Markdown Body (Turndown Converted)
              </span>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-medium transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Cleaned Markdown'}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-stone-950 font-mono text-xs text-stone-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed border border-stone-800/60">
              {content.markdownBody}
            </pre>
          </div>
        </div>
      )}

      {/* Subtab 2: Meta & Social Cards */}
      {activeSubTab === 'metadata' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* HTML Standard Meta */}
            <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800 space-y-4">
              <h3 className="font-serif font-bold text-stone-200 text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                HTML Document & Search Metadata
              </h3>

              <div className="space-y-3">
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">HTML &lt;title&gt;</span>
                  <p className="text-xs text-stone-200 font-medium">{meta.title || '(none)'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">meta name=&quot;description&quot;</span>
                  <p className="text-xs text-stone-200">{meta.metaDescription || '(none)'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">link rel=&quot;canonical&quot;</span>
                  <p className="text-xs text-stone-400 font-mono break-all">{meta.canonicalUrl || '(none)'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">Author Attribution</span>
                  <p className="text-xs text-stone-200">{meta.author || '(none)'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-stone-400 block font-mono">Published</span>
                    <p className="text-xs text-stone-200">{meta.publishedDate || '(none)'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 block font-mono">Last Modified</span>
                    <p className="text-xs text-stone-200">{meta.modifiedDate || '(none)'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* OpenGraph & Twitter Cards */}
            <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800 space-y-4">
              <h3 className="font-serif font-bold text-stone-200 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-sky-400" />
                OpenGraph & Twitter Card Tags
              </h3>

              <div className="space-y-3">
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">og:title</span>
                  <p className="text-xs text-stone-200 font-medium">{meta.ogTitle || '(none)'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">og:description</span>
                  <p className="text-xs text-stone-200">{meta.ogDescription || '(none)'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 block font-mono">og:image</span>
                  {meta.ogImage ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-10 h-10 rounded bg-stone-800 overflow-hidden shrink-0 border border-stone-700">
                        <img src={meta.ogImage} alt="OG" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-stone-400 font-mono truncate">{meta.ogImage}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-300 italic font-medium">(none)</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-stone-400 block font-mono">og:site_name</span>
                    <p className="text-xs text-stone-200">{meta.ogSiteName || '(none)'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 block font-mono">og:type</span>
                    <p className="text-xs text-stone-200">{meta.ogType || '(none)'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 3: JSON-LD Structured Data */}
      {activeSubTab === 'jsonld' && (
        <div className="bg-stone-900/80 rounded-2xl border border-stone-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-400" />
              JSON-LD Structured Data Schema Blocks
            </span>
            <span className="text-xs text-stone-400 font-mono">
              {meta.jsonLd?.length || 0} blocks parsed
            </span>
          </div>

          {meta.jsonLd && meta.jsonLd.length > 0 ? (
            <div className="space-y-4">
              {meta.jsonLd.map((block: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-stone-950 border border-stone-800/80">
                  <span className="text-xs font-mono text-emerald-400 block mb-2 font-semibold">
                    Schema Type: {block['@type'] || 'Object'}
                  </span>
                  <pre className="text-[11px] font-mono text-stone-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                    {JSON.stringify(block, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-300 italic py-4 font-medium">No JSON-LD structured data blocks found in HTML head.</p>
          )}
        </div>
      )}

      {/* Subtab 4: Links & Outbound Products */}
      {activeSubTab === 'links' && (
        <div className="bg-stone-900/80 rounded-2xl border border-stone-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-sky-400" />
              Discovered Links & Product Candidates
            </span>
            <span className="text-xs text-stone-400">
              {content.links.filter(l => l.isAffiliateCandidate).length} affiliate/merchant links
            </span>
          </div>

          <div className="divide-y divide-stone-800/60 max-h-96 overflow-y-auto pr-1">
            {content.links.map((link, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-stone-200 block truncate">{link.text}</span>
                  <span className="text-[11px] font-mono text-stone-300 truncate block">{link.href}</span>
                </div>
                {link.isAffiliateCandidate ? (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Product/Affiliate
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-stone-300 font-medium">
                    {link.isExternal ? 'External' : 'Internal'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

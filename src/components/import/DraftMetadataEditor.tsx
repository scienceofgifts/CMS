import React from 'react';
import {
  FileText,
  Search,
  Globe,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Tag,
  User,
  Calendar,
  Image as ImageIcon,
  BookOpen,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ImportDraft,
  ImportAnalysisResult,
  ImportTargetType
} from '../../types/import';

interface DraftMetadataEditorProps {
  draft: ImportDraft;
  analysis: ImportAnalysisResult | null;
  onChange: (updated: Partial<ImportDraft>) => void;
  onAiEnhance?: () => void;
  isAiEnhancing?: boolean;
}

export function DraftMetadataEditor({
  draft,
  analysis,
  onChange,
  onAiEnhance,
  isAiEnhancing
}: DraftMetadataEditorProps) {
  // Check whether a field has been modified compared to the original analysis
  const origMapped = analysis?.mappedFrontMatter || {};
  const origSeo = analysis?.seo;

  const isTitleModified = draft.title !== (origMapped.title || '');
  const isSearchTitleModified = draft.searchTitle !== (origMapped['search-title'] || origSeo?.searchTitle || '');
  const isDeckModified = draft.deck !== (origMapped.deck || '');
  const isSeoDescModified = draft.seoDescription !== (origMapped['seo-description'] || origSeo?.seoDescription || '');
  const isSlugModified = draft.slug !== (origMapped.slug || '');
  const isCategoryModified = draft.category !== (origMapped.category || '');
  const isTypeModified = analysis && draft.targetType !== analysis.detectedType;

  // Known categories
  const guideCategories = ['History', 'Books', 'Curation', 'Science', 'Food & Craft', 'Travel'];
  const articleCategories = ['Gift Psychology', 'Etiquette', 'Research', 'Relationships', 'Culture'];
  const categoryOptions = draft.targetType === 'guide' ? guideCategories : articleCategories;

  // Known authors
  const knownAuthors = [
    { name: 'Clara Vance', role: 'Editor-in-Chief & Lead Researcher' },
    { name: 'Julian Mercer', role: 'Senior Editor, History & Literature' },
    { name: 'Elena Rostova', role: 'Contributing Editor, Science & Craft' }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Content Type Switcher */}
      <div className="p-4 bg-white border border-[#99BFF9]/35 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2A548E]" />
            <h4 className="font-serif-display text-sm font-medium text-[#1E232B]">
              Content Target Type
            </h4>
            {isTypeModified && (
              <span className="text-[10px] font-mono-code font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                Manually Changed (Source: {analysis?.detectedType})
              </span>
            )}
          </div>
          <div className="text-xs text-[#5A6270]">
            Determines Jekyll directory placement (<code className="font-mono text-[11px] text-[#2A548E]">_guides/</code> vs <code className="font-mono text-[11px] text-[#2A548E]">_articles/</code>)
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { type: 'guide' as ImportTargetType, label: 'Gift Guide', desc: 'Curated recommendations & price blocks' },
            { type: 'article' as ImportTargetType, label: 'Editorial Article', desc: 'Essays, research & psychology' },
            { type: 'page' as ImportTargetType, label: 'Static Page', desc: 'About, contact, policies' },
            { type: 'unknown' as ImportTargetType, label: 'Unknown / Other', desc: 'Requires further review' }
          ].map(opt => {
            const isSelected = draft.targetType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => onChange({ targetType: opt.type })}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#EEF5FF] border-[#2A548E] ring-1 ring-[#2A548E] shadow-2xs'
                    : 'bg-[#FAF9F6] border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="font-bold text-xs text-[#1E232B] flex items-center justify-between">
                  <span>{opt.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#2A548E]" />}
                </div>
                <div className="text-[11px] text-[#5A6270] mt-1 leading-snug">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Reader-Facing vs Search-Facing Titles */}
      <div className="p-5 bg-white border border-[#99BFF9]/35 rounded-xl shadow-2xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h4 className="font-serif-display text-base font-medium text-[#1E232B] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2A548E]" />
              <span>Titles: Reader-Facing vs. Search Engine (SEO)</span>
            </h4>
            <p className="text-xs text-[#5A6270] mt-0.5">
              Science of Gifts separates on-page reader titles from SERP search titles.
            </p>
          </div>
          {onAiEnhance && (
            <button
              type="button"
              onClick={onAiEnhance}
              disabled={isAiEnhancing}
              className="px-3 py-1.5 bg-[#EEF5FF] hover:bg-[#99BFF9]/25 text-[#2A548E] border border-[#99BFF9]/40 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiEnhancing ? 'animate-spin' : ''}`} />
              <span>{isAiEnhancing ? 'Generating...' : 'AI Suggest SEO'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Reader H1 Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#1E232B] flex items-center gap-1.5">
                <span>Reader-Facing Title (<code className="font-mono text-[#2A548E]">title</code>)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {isTitleModified && (
                  <>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                      Edited
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ title: origMapped.title || '' })}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                      title="Revert to source analysis"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Revert
                    </button>
                  </>
                )}
                <span className="text-[11px] font-mono text-[#5A6270]">
                  {draft.title.length} chars
                </span>
              </div>
            </div>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Primary editorial H1 headline..."
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs font-medium text-[#1E232B] focus:bg-white focus:border-[#2A548E] focus:outline-none"
            />
            <p className="text-[11px] text-[#5A6270]">
              Displayed as the main page H1 heading for human readers on the website.
            </p>
            {origMapped.title && isTitleModified && (
              <div className="text-[10px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-200/50">
                <span className="font-semibold">Source value:</span> {origMapped.title}
              </div>
            )}
          </div>

          {/* Search Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#1E232B] flex items-center gap-1.5">
                <span>Search / SERP Title (<code className="font-mono text-[#2A548E]">search-title</code>)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {isSearchTitleModified && (
                  <>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                      Edited
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ searchTitle: origMapped['search-title'] || origSeo?.searchTitle || draft.title })}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                      title="Revert to source analysis"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Revert
                    </button>
                  </>
                )}
                <span className={`text-[11px] font-mono font-bold ${
                  draft.searchTitle.length <= 60 ? 'text-[#226E56]' : 'text-amber-600'
                }`}>
                  {draft.searchTitle.length} / 60 chars
                </span>
              </div>
            </div>
            <input
              type="text"
              value={draft.searchTitle}
              onChange={(e) => onChange({ searchTitle: e.target.value })}
              placeholder="Search engine optimized title..."
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs font-medium text-[#1E232B] focus:bg-white focus:border-[#2A548E] focus:outline-none"
            />
            <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
              <span>Used in HTML <code className="font-mono text-[10px]">&lt;title&gt;</code> &amp; Google results.</span>
              <button
                type="button"
                onClick={() => onChange({ searchTitle: draft.title })}
                className="text-[11px] text-[#2A548E] hover:underline cursor-pointer"
              >
                Copy from Reader Title
              </button>
            </div>
            {origMapped['search-title'] && isSearchTitleModified && (
              <div className="text-[10px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-200/50">
                <span className="font-semibold">Source value:</span> {origMapped['search-title']}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Reader-Facing Deck vs SEO Meta Description */}
      <div className="p-5 bg-white border border-[#99BFF9]/35 rounded-xl shadow-2xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h4 className="font-serif-display text-base font-medium text-[#1E232B] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#2A548E]" />
              <span>Descriptions: Reader Deck vs. Google Meta Description</span>
            </h4>
            <p className="text-xs text-[#5A6270] mt-0.5">
              The reader deck is editorial context; the SEO description is a concise snippet for search algorithms.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Reader Deck */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#1E232B] flex items-center gap-1.5">
                <span>Visible Reader Deck / Summary (<code className="font-mono text-[#2A548E]">deck</code>)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {isDeckModified && (
                  <>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                      Edited
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ deck: origMapped.deck || '' })}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Revert
                    </button>
                  </>
                )}
                <span className="text-[11px] font-mono text-[#5A6270]">
                  {draft.deck.length} chars
                </span>
              </div>
            </div>
            <textarea
              rows={3}
              value={draft.deck}
              onChange={(e) => onChange({ deck: e.target.value })}
              placeholder="1-2 sentences of visible editorial overview for the reader..."
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs font-medium text-[#1E232B] focus:bg-white focus:border-[#2A548E] focus:outline-none"
            />
            <p className="text-[11px] text-[#5A6270]">
              Visible on page directly below title. (Transformed from legacy <code className="font-mono text-[10px]">display-excerpt</code> or subtitle).
            </p>
            {origMapped.deck && isDeckModified && (
              <div className="text-[10px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-200/50">
                <span className="font-semibold">Source value:</span> {origMapped.deck}
              </div>
            )}
          </div>

          {/* SEO Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[#1E232B] flex items-center gap-1.5">
                <span>SEO Meta Description (<code className="font-mono text-[#2A548E]">seo-description</code>)</span>
              </label>
              <div className="flex items-center gap-1.5">
                {isSeoDescModified && (
                  <>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                      Edited
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ seoDescription: origMapped['seo-description'] || origSeo?.seoDescription || draft.deck })}
                      className="text-[10px] text-stone-500 hover:text-stone-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Revert
                    </button>
                  </>
                )}
                <span className={`text-[11px] font-mono font-bold ${
                  draft.seoDescription.length <= 160 ? 'text-[#226E56]' : 'text-amber-600'
                }`}>
                  {draft.seoDescription.length} / 160 chars
                </span>
              </div>
            </div>
            <textarea
              rows={3}
              value={draft.seoDescription}
              onChange={(e) => onChange({ seoDescription: e.target.value })}
              placeholder="120-160 character snippet for Google search engine results..."
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs font-medium text-[#1E232B] focus:bg-white focus:border-[#2A548E] focus:outline-none"
            />
            <div className="flex items-center justify-between text-[11px] text-[#5A6270]">
              <span>Used in <code className="font-mono text-[10px]">&lt;meta name="description"&gt;</code> tag.</span>
              <button
                type="button"
                onClick={() => onChange({ seoDescription: draft.deck.slice(0, 160) })}
                className="text-[11px] text-[#2A548E] hover:underline cursor-pointer"
              >
                Copy from Reader Deck
              </button>
            </div>
            {origMapped['seo-description'] && isSeoDescModified && (
              <div className="text-[10px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-200/50">
                <span className="font-semibold">Source value:</span> {origMapped['seo-description']}
              </div>
            )}
          </div>
        </div>

        {/* Live SERP Snippet Preview */}
        <div className="p-4 bg-stone-50 border border-stone-200/90 rounded-lg space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
              Live Google SERP Preview
            </span>
            <span>https://scienceofgifts.com › {draft.targetType === 'guide' ? 'guides' : 'articles'} › {draft.slug || 'slug'}</span>
          </div>
          <div className="text-[#1a0dab] text-base font-medium leading-snug line-clamp-1 hover:underline cursor-pointer">
            {(draft.searchTitle || draft.title || 'Untitled Document')} — Science of Gifts
          </div>
          <div className="text-[#4d5156] text-xs leading-relaxed line-clamp-2">
            {draft.seoDescription || draft.deck || 'No description provided. Search engines will default to site-level summary.'}
          </div>
        </div>
      </div>

      {/* 4. Core Metadata: Slug, Category, Author, Dates */}
      <div className="p-5 bg-white border border-[#99BFF9]/35 rounded-xl shadow-2xs space-y-4">
        <h4 className="font-serif-display text-sm font-medium text-[#1E232B] flex items-center gap-2">
          <Tag className="w-4 h-4 text-[#2A548E]" />
          <span>Core Metadata &amp; Taxonomy</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Slug */}
          <div className="space-y-1">
            <label className="font-semibold text-[#1E232B] flex items-center justify-between">
              <span>Slug / Permalink</span>
              {isSlugModified && <span className="text-[10px] text-amber-700 font-bold">Edited</span>}
            </label>
            <input
              type="text"
              value={draft.slug}
              onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/[^\w-]/g, '') })}
              placeholder="kebab-case-slug"
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-xs text-[#2A548E] font-bold focus:bg-white focus:outline-none"
            />
            <span className="text-[10px] text-stone-400 block truncate">
              /{draft.targetType === 'guide' ? 'guides' : 'articles'}/{draft.slug}/
            </span>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className="font-semibold text-[#1E232B] flex items-center justify-between">
              <span>Taxonomy Category</span>
              {isCategoryModified && <span className="text-[10px] text-amber-700 font-bold">Edited</span>}
            </label>
            <select
              value={draft.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded text-xs text-[#1E232B] font-medium focus:bg-white focus:outline-none cursor-pointer"
            >
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              {!categoryOptions.includes(draft.category) && draft.category && (
                <option value={draft.category}>{draft.category} (Custom)</option>
              )}
            </select>
            <span className="text-[10px] text-stone-400 block">Verified CMS collection</span>
          </div>

          {/* Author */}
          <div className="space-y-1">
            <label className="font-semibold text-[#1E232B] flex items-center justify-between">
              <span>Author Attribution</span>
            </label>
            <select
              value={draft.authorName}
              onChange={(e) => {
                const found = knownAuthors.find(a => a.name === e.target.value);
                onChange({
                  authorName: e.target.value,
                  authorRole: found?.role || draft.authorRole
                });
              }}
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded text-xs text-[#1E232B] font-medium focus:bg-white focus:outline-none cursor-pointer"
            >
              {knownAuthors.map(a => (
                <option key={a.name} value={a.name}>{a.name} ({a.role.split('&')[0]})</option>
              ))}
              {!knownAuthors.some(a => a.name === draft.authorName) && draft.authorName && (
                <option value={draft.authorName}>{draft.authorName} (Custom)</option>
              )}
            </select>
            <span className="text-[10px] text-stone-400 block truncate">{draft.authorRole}</span>
          </div>

          {/* Dates */}
          <div className="space-y-1">
            <label className="font-semibold text-[#1E232B]">
              <span>Last Modified Date</span>
            </label>
            <input
              type="date"
              value={draft.lastModifiedDate ? draft.lastModifiedDate.slice(0, 10) : ''}
              onChange={(e) => onChange({ lastModifiedDate: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded font-mono-code text-xs text-[#1E232B] focus:bg-white focus:outline-none"
            />
            <span className="text-[10px] text-stone-400 block">Replaces legacy updatedDate</span>
          </div>
        </div>

        {/* Hero Visual Media */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-stone-100 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-[#1E232B]">
              <span>Hero Image Key (<code className="font-mono text-[#2A548E]">heroImageType</code>)</span>
            </label>
            <input
              type="text"
              value={draft.heroImageType || ''}
              onChange={(e) => onChange({ heroImageType: e.target.value })}
              placeholder="e.g. vintage-chronograph-hero"
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded text-xs font-mono text-[#1E232B] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="font-semibold text-[#1E232B]">
              <span>Hero Image Alt Text (<code className="font-mono text-[#2A548E]">heroImageAlt</code>)</span>
            </label>
            <input
              type="text"
              value={draft.heroImageAlt || ''}
              onChange={(e) => onChange({ heroImageAlt: e.target.value })}
              placeholder="Descriptive alt text for screen readers & SEO..."
              className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded text-xs text-[#1E232B] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

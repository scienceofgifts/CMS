import React from 'react';
import { Globe, Globe2, Clock, Sparkles } from 'lucide-react';
import { SiteSettingsData } from '../../types/siteSettings';

interface SiteSettingsPreviewProps {
  settings: SiteSettingsData;
}

export function SiteSettingsPreview({ settings }: SiteSettingsPreviewProps) {
  return (
    <div className="bg-[#FAF9F6] border border-[#99BFF9]/35 rounded-xl overflow-hidden shadow-xs p-6 space-y-6">
      {/* 1. Browser Tab & Title Bar Preview */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider font-mono-code font-bold text-[#2A548E]">
          1. Browser Window &amp; Tab Preview
        </span>
        <div className="bg-stone-800 text-stone-200 rounded-lg overflow-hidden shadow-sm text-xs font-mono-code">
          <div className="bg-stone-900 px-3 py-2 flex items-center gap-2 border-b border-stone-800">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            </div>
            <div className="ml-2 bg-stone-800 text-stone-300 px-3 py-1 rounded-t text-[11px] font-sans truncate max-w-xs flex items-center gap-1.5 border-t border-x border-stone-700">
              <Globe className="w-3 h-3 text-emerald-400" />
              <span className="truncate">{settings.title || 'Science of Gifts'} — {settings.tagline || 'Tagline'}</span>
            </div>
          </div>
          <div className="p-3 bg-stone-900/60 text-stone-400 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 truncate">{settings.url || 'https://scienceofgifts.com'}</span>
            <span className="text-stone-500 shrink-0">{settings.timezone || 'Europe/London'}</span>
          </div>
        </div>
      </div>

      {/* 2. Search Engine Snippet Preview (SERP) */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider font-mono-code font-bold text-[#226E56]">
          2. Search Engine Result Snippet (SEO)
        </span>
        <div className="bg-white border border-[#99BFF9]/30 p-4 rounded-lg shadow-2xs space-y-1 text-xs">
          <div className="flex items-center gap-2 text-[11px] text-[#202124]">
            <span className="w-4 h-4 rounded-full bg-[#2A548E] text-white flex items-center justify-center text-[9px] font-bold">S</span>
            <span className="text-stone-700 font-sans">{settings.title || 'Science of Gifts'}</span>
            <span className="text-stone-400 font-mono-code text-[10px] truncate">{settings.url || 'https://scienceofgifts.com'}</span>
          </div>
          <h3 className="text-base text-[#1a0dab] font-sans hover:underline cursor-pointer font-medium leading-snug">
            {settings.title || 'Science of Gifts'}: {settings.tagline || 'Thoughtful gifts, chosen with a little more thought.'}
          </h3>
          <p className="text-[#4d5156] font-sans text-xs leading-relaxed line-clamp-2">
            {settings.description || 'An independent editorial gift publication featuring rigorously researched gift guides, thoughtful essays, and curated recommendations.'}
          </p>
        </div>
      </div>

      {/* 3. Publication Masthead Deck */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider font-mono-code font-bold text-[#2A548E]">
          3. Publication Header &amp; Masthead
        </span>
        <div className="bg-white border border-[#99BFF9]/35 p-6 rounded-lg shadow-2xs text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#226E56] font-semibold font-mono-code">
            <Sparkles className="w-3 h-3 text-[#226E56]" />
            <span>Independent Editorial Journal</span>
          </div>
          <h1 className="font-serif-display text-2xl text-[#1E232B] font-normal">
            {settings.title || 'Science of Gifts'}
          </h1>
          <p className="text-xs font-serif italic text-[#5A6270]">
            "{settings.tagline || 'Thoughtful gifts, chosen with a little more thought.'}"
          </p>
          <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-4 text-[11px] text-[#5A6270] font-mono-code">
            <span className="flex items-center gap-1">
              <Globe2 className="w-3 h-3 text-[#2A548E]" />
              {settings.url || 'https://scienceofgifts.com'}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#226E56]" />
              {settings.timezone || 'Europe/London'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

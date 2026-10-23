import { ArticleSource } from '../types/articles';

/**
 * Normalizes a user-provided citation ID or candidate string to a safe,
 * URL-friendly, lowercase identifier (alphanumeric, hyphens, underscores).
 */
export function normalizeCitationId(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns the stable ID for a source.
 * If the source has an explicit `id`, it is returned (normalized).
 * Otherwise, generates a stable fallback ID matching Jekyll conventions:
 * 1. Primary author's surname + publication year (e.g., "galak-2016")
 * 2. Primary author's surname + short title slug (e.g., "galak-giver-recipient")
 * 3. Title slug up to 30 characters
 * 4. Generic "source-{index+1}"
 */
export function getSourceId(source: Partial<ArticleSource>, index: number = 0): string {
  if (source.id && source.id.trim()) {
    const normalized = normalizeCitationId(source.id);
    if (normalized) return normalized;
  }

  // Extract primary author's surname
  let authorSurname = '';
  if (source.author && source.author.trim()) {
    // Take first author if separated by comma, 'and', '&'
    const firstAuthor = source.author.split(/,|&|\band\b/i)[0].trim();
    // Surname is typically the last whitespace-delimited word
    const words = firstAuthor.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const candidate = words[words.length - 1].replace(/[^\w]/g, '').toLowerCase();
      // Avoid titles like Jr, III, PhD
      if (!['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'dr'].includes(candidate) && candidate.length > 1) {
        authorSurname = candidate;
      } else if (words.length > 1) {
        authorSurname = words[words.length - 2].replace(/[^\w]/g, '').toLowerCase();
      }
    }
  }

  // Extract year
  const yearStr = source.year ? String(source.year).replace(/[^\d]/g, '') : '';

  if (authorSurname && yearStr) {
    return `${authorSurname}-${yearStr}`;
  }

  // If author surname exists without year, combine with short title
  if (authorSurname && source.title) {
    const titleSnippet = normalizeCitationId(source.title).slice(0, 20).replace(/-+$/, '');
    if (titleSnippet) {
      return `${authorSurname}-${titleSnippet}`;
    }
    return authorSurname;
  }

  // Fallback to title slug
  if (source.title) {
    const titleSlug = normalizeCitationId(source.title).slice(0, 32).replace(/-+$/, '');
    if (titleSlug) return titleSlug;
  }

  return `source-${index + 1}`;
}

/**
 * Extracts all citation keys from text or HTML in order of appearance.
 * Recognizes both markdown `[[@cite:id]]` and HTML `<span data-citation="id">`.
 */
export function extractCitationKeys(text: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  const regex = /(?:\[\[@cite:([a-zA-Z0-9_\-\.:]+)\]\]|<span[^>]*data-citation=["']([a-zA-Z0-9_\-\.:]+)["'][^>]*>[\s\S]*?<\/span>)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1] || match[2];
    if (key) {
      keys.push(key.trim());
    }
  }
  return keys;
}

/**
 * Counts the occurrence of each source in the markdown text.
 * Returns a map of source ID -> count.
 */
export function countCitationsBySource(markdown: string, sources: ArticleSource[] = []): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!markdown) return counts;

  // Initialize all known sources with 0
  sources.forEach((s, idx) => {
    const id = getSourceId(s, idx);
    counts[id] = 0;
  });

  const keys = extractCitationKeys(markdown);
  for (const key of keys) {
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
}

/**
 * Safely replaces all occurrences of an old citation key with a new one
 * in markdown content.
 */
export function replaceCitationIdInMarkdown(markdown: string, oldId: string, newId: string): string {
  if (!markdown || !oldId || !newId || oldId === newId) return markdown;
  const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[\\[@cite:${escapedOld}\\]\\]`, 'g');
  return markdown.replace(regex, `[[@cite:${newId}]]`);
}

export interface CitedNote {
  noteNumber: number;
  sourceId: string;
  source: ArticleSource;
  occurrences: string[]; // Anchor IDs for backlinks, e.g. ['cite-ref-1-1', 'cite-ref-1-2']
}

export interface CitationProcessResult {
  processedHtml: string;
  citedNotes: CitedNote[];
  uncitedSources: Array<{ source: ArticleSource; id: string; index: number }>;
  brokenCitations: string[];
}

/**
 * Processes HTML for live preview:
 * - Scans all inline citations in document order
 * - Assigns sequential reference numbers (1, 2, 3...) based on first appearance
 * - Reuses the same number for repeated citations of the same source
 * - Generates unique anchor IDs for each occurrence (e.g. `cite-ref-1-1`, `cite-ref-1-2`)
 * - Replaces inline citations with superscript links pointing to `#cite-note-{number}`
 * - Visibly tags broken/unresolved citation keys with `[?] (missing source)`
 * - Identifies uncited sources in the article bibliography
 */
export function processCitationsForPreview(rawHtml: string, sources: ArticleSource[] = []): CitationProcessResult {
  if (!rawHtml) {
    const uncited = sources.map((source, index) => ({
      source,
      id: getSourceId(source, index),
      index
    }));
    return {
      processedHtml: '',
      citedNotes: [],
      uncitedSources: uncited,
      brokenCitations: []
    };
  }

  // Build lookup map for sources by ID (and aliases)
  const sourceMap = new Map<string, { source: ArticleSource; index: number; id: string }>();
  sources.forEach((s, idx) => {
    const primaryId = getSourceId(s, idx);
    const item = { source: s, index: idx, id: primaryId };
    sourceMap.set(primaryId, item);
    if (s.id && s.id.trim()) {
      sourceMap.set(s.id.trim(), item);
      sourceMap.set(normalizeCitationId(s.id), item);
    }
  });

  const citedNotes: CitedNote[] = [];
  const noteBySourceId = new Map<string, CitedNote>();
  const occurrenceCounts = new Map<string, number>();
  const brokenCitationsSet = new Set<string>();

  const citationPattern = /(?:\[\[@cite:([a-zA-Z0-9_\-\.:]+)\]\]|<span[^>]*data-citation=["']([a-zA-Z0-9_\-\.:]+)["'][^>]*>[\s\S]*?<\/span>)/g;

  const processedHtml = rawHtml.replace(citationPattern, (_match, group1, group2) => {
    const rawKey = (group1 || group2 || '').trim();
    const normalizedKey = normalizeCitationId(rawKey);

    const sourceEntry = sourceMap.get(rawKey) || sourceMap.get(normalizedKey);

    if (!sourceEntry) {
      brokenCitationsSet.add(rawKey);
      return `<sup class="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-700 border border-rose-300 select-none align-super" title="Unresolved citation: source '${rawKey}' not found in article bibliography">[?] <span class="hidden sm:inline font-sans font-normal ml-0.5">missing: ${rawKey}</span></sup>`;
    }

    const canonicalId = sourceEntry.id;
    if (!noteBySourceId.has(canonicalId)) {
      const noteNumber = citedNotes.length + 1;
      const note: CitedNote = {
        noteNumber,
        sourceId: canonicalId,
        source: sourceEntry.source,
        occurrences: []
      };
      citedNotes.push(note);
      noteBySourceId.set(canonicalId, note);
    }

    const note = noteBySourceId.get(canonicalId)!;
    const occIdx = (occurrenceCounts.get(canonicalId) || 0) + 1;
    occurrenceCounts.set(canonicalId, occIdx);

    const anchorId = `cite-ref-${note.noteNumber}-${occIdx}`;
    note.occurrences.push(anchorId);

    const titleTooltip = (sourceEntry.source.title || canonicalId).replace(/"/g, '&quot;');
    const authorTooltip = sourceEntry.source.author ? ` (${sourceEntry.source.author})` : '';

    return `<sup class="citation-ref-item select-none align-super inline-block mx-0.5" id="${anchorId}"><a href="#cite-note-${note.noteNumber}" class="text-[#2A548E] font-semibold text-[11px] font-mono hover:underline px-0.5 rounded hover:bg-[#EEF5FF] transition-colors" title="${titleTooltip}${authorTooltip}" data-cite-target="cite-note-${note.noteNumber}">[${note.noteNumber}]</a></sup>`;
  });

  // Calculate uncited sources
  const citedCanonicalIds = new Set(citedNotes.map(n => n.sourceId));
  const uncitedSources = sources
    .map((source, index) => ({
      source,
      id: getSourceId(source, index),
      index
    }))
    .filter(item => !citedCanonicalIds.has(item.id));

  return {
    processedHtml,
    citedNotes,
    uncitedSources,
    brokenCitations: Array.from(brokenCitationsSet)
  };
}

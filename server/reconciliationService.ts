import {
  ImportAnalysisResult,
  ImportDraft,
  ImportFileItem,
  LivePageExtractedData,
  ReconciliationFieldDiff,
  ReconciliationReport,
  ImportIssue
} from '../src/types/import';
import {
  analyzeImportDocument,
  createInitialDraft,
  extractStructuredLinks,
  detectProductCandidates,
  getKnownCmsProducts
} from './importService';

/**
 * Reconciles Markdown document analysis with live URL extracted page data.
 * Produces detailed side-by-side diffs, identifies enrichments, and adds actionable issues.
 */
export function reconcileMarkdownAndLiveUrl(
  analysis: ImportAnalysisResult,
  liveData: LivePageExtractedData,
  filename: string
): {
  reconciliationReport: ReconciliationReport;
  issues: ImportIssue[];
  suggestedEnrichments: Record<string, any>;
} {
  const mappedFm = analysis.mappedFrontMatter || {};
  const meta = liveData.metadata;
  const content = liveData.content;

  const diffs: ReconciliationFieldDiff[] = [];
  const additionalIssues: ImportIssue[] = [];
  const suggestedEnrichments: Record<string, any> = {};

  // 1. Reader Display Title
  const mdTitle = String(mappedFm.title || '').trim();
  const liveTitle = String(content.h1 || meta.ogTitle || meta.title || '').trim();
  // Strip trailing branding like " | Science of Gifts" or " - Site"
  const cleanLiveTitle = liveTitle.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim();

  const titlesMatch = mdTitle.toLowerCase() === cleanLiveTitle.toLowerCase() || mdTitle.toLowerCase() === liveTitle.toLowerCase();
  diffs.push({
    field: 'title',
    label: 'Title (Reader H1)',
    markdownValue: mdTitle,
    liveUrlValue: cleanLiveTitle || liveTitle,
    status: !mdTitle ? 'missing_in_markdown' : !liveTitle ? 'missing_in_live' : titlesMatch ? 'identical' : 'different',
    category: 'core',
    recommendedSource: titlesMatch ? 'markdown' : 'markdown',
    editorialNote: titlesMatch
      ? 'Title is consistent across Markdown and rendered live page.'
      : `Live rendered title differs: "${cleanLiveTitle || liveTitle}". Markdown: "${mdTitle}".`
  });

  if (!titlesMatch && mdTitle && liveTitle) {
    additionalIssues.push({
      id: 'issue-reconciliation-title-mismatch',
      severity: 'warning',
      field: 'title',
      title: 'Title Discrepancy with Live URL',
      message: `Markdown title ("${mdTitle}") differs from live page H1 ("${cleanLiveTitle}").`,
      suggestion: 'Confirm whether the live page title was edited post-publish, or preserve Markdown title.',
      actionType: 'custom',
      actionPayload: { field: 'title', liveValue: cleanLiveTitle, markdownValue: mdTitle }
    });
  }

  // 2. Search Title (search-title / HTML <title>)
  const mdSearchTitle = String(mappedFm['search-title'] || analysis.seo.searchTitle || '').trim();
  const liveSearchTitle = String(meta.title || meta.ogTitle || '').trim();
  const searchTitlesMatch = mdSearchTitle.toLowerCase() === liveSearchTitle.toLowerCase();

  diffs.push({
    field: 'search-title',
    label: 'Search Title (SERP <title>)',
    markdownValue: mdSearchTitle,
    liveUrlValue: liveSearchTitle,
    status: !mdSearchTitle ? 'missing_in_markdown' : !liveSearchTitle ? 'missing_in_live' : searchTitlesMatch ? 'identical' : 'different',
    category: 'seo',
    recommendedSource: searchTitlesMatch ? 'markdown' : (liveSearchTitle ? 'live' : 'markdown'),
    editorialNote: searchTitlesMatch
      ? 'Search title matches live HTML title tag.'
      : (analysis.seo.searchTitleSource !== 'explicit' && liveSearchTitle)
        ? `Live page contains verified Google title tag: "${liveSearchTitle}".`
        : 'Discrepancy between Markdown search-title and live <title>.'
  });

  if (!mappedFm['search-title'] && liveSearchTitle) {
    suggestedEnrichments['search-title'] = liveSearchTitle;
    additionalIssues.push({
      id: 'issue-reconciliation-live-search-title',
      severity: 'info',
      field: 'search-title',
      title: 'Search Title Found on Live Page',
      message: `Markdown lacked explicit search-title, but live page has <title>: "${liveSearchTitle}".`,
      suggestion: 'Adopt live title tag as canonical search-title.',
      actionType: 'set_search_title',
      actionPayload: { suggestedTitle: liveSearchTitle }
    });
  }

  // 3. Deck / Reader Subhead
  const mdDeck = String(mappedFm.deck || '').trim();
  const liveDeck = String(content.deck || meta.ogDescription || '').trim();
  const decksMatch = mdDeck.toLowerCase() === liveDeck.toLowerCase();

  diffs.push({
    field: 'deck',
    label: 'Deck (Visible Reader Summary)',
    markdownValue: mdDeck,
    liveUrlValue: liveDeck,
    status: !mdDeck ? 'missing_in_markdown' : !liveDeck ? 'missing_in_live' : decksMatch ? 'identical' : 'different',
    category: 'core',
    recommendedSource: mdDeck ? 'markdown' : 'live',
    editorialNote: decksMatch
      ? 'Visible deck text matches live introductory summary.'
      : !mdDeck && liveDeck
        ? 'Live page has intro deck absent in legacy Markdown.'
        : 'Deck wording has subtle variations between source and live publication.'
  });

  if (!mdDeck && liveDeck) {
    suggestedEnrichments.deck = liveDeck;
  }

  // 4. SEO Description (seo-description)
  const mdSeoDesc = String(mappedFm['seo-description'] || '').trim();
  const liveSeoDesc = String(meta.metaDescription || meta.ogDescription || '').trim();
  const seoMatch = mdSeoDesc.toLowerCase() === liveSeoDesc.toLowerCase();

  diffs.push({
    field: 'seo-description',
    label: 'SEO Description (Meta Tag)',
    markdownValue: mdSeoDesc,
    liveUrlValue: liveSeoDesc,
    status: !mdSeoDesc ? 'missing_in_markdown' : !liveSeoDesc ? 'missing_in_live' : seoMatch ? 'identical' : 'different',
    category: 'seo',
    recommendedSource: liveSeoDesc ? 'live' : 'markdown',
    editorialNote: seoMatch
      ? 'SEO meta description matches live metadata.'
      : !mdSeoDesc && liveSeoDesc
        ? `Found live meta description (${liveSeoDesc.length} chars) from published page.`
        : 'Different meta description on live page.'
  });

  if (!mdSeoDesc && liveSeoDesc) {
    suggestedEnrichments['seo-description'] = liveSeoDesc;
    additionalIssues.push({
      id: 'issue-reconciliation-live-seo-desc',
      severity: 'info',
      field: 'seo-description',
      title: 'Live Meta Description Discovered',
      message: `Markdown lacked seo-description, but live page has meta description: "${liveSeoDesc}".`,
      suggestion: 'Enrich draft with live page description.',
      actionType: 'set_seo_desc',
      actionPayload: { suggestedDesc: liveSeoDesc }
    });
  }

  // 5. Author Attribution
  const mdAuthor = typeof mappedFm.author === 'object' ? (mappedFm.author?.name || '') : String(mappedFm.author || '');
  const liveAuthor = String(meta.author || '').trim();
  const authorsMatch = !liveAuthor || mdAuthor.toLowerCase().includes(liveAuthor.toLowerCase()) || liveAuthor.toLowerCase().includes(mdAuthor.toLowerCase());

  diffs.push({
    field: 'author',
    label: 'Author Attribution',
    markdownValue: mdAuthor,
    liveUrlValue: liveAuthor,
    status: !mdAuthor ? 'missing_in_markdown' : !liveAuthor ? 'missing_in_live' : authorsMatch ? 'identical' : 'different',
    category: 'metadata',
    recommendedSource: mdAuthor ? 'markdown' : 'live',
    editorialNote: authorsMatch
      ? 'Author attribution aligns with live byline.'
      : `Author discrepancy: Markdown states "${mdAuthor}", live page displays "${liveAuthor}".`
  });

  // 6. Publication Date
  const mdPubDate = String(mappedFm.publishedDate || mappedFm.date || '').trim();
  const livePubDate = String(meta.publishedDate || '').trim();
  const pubDatesMatch = mdPubDate === livePubDate;

  diffs.push({
    field: 'publishedDate',
    label: 'Published Date',
    markdownValue: mdPubDate,
    liveUrlValue: livePubDate,
    status: !mdPubDate ? 'missing_in_markdown' : !livePubDate ? 'missing_in_live' : pubDatesMatch ? 'identical' : 'different',
    category: 'metadata',
    recommendedSource: mdPubDate ? 'markdown' : 'live',
    editorialNote: pubDatesMatch
      ? 'Publication date matches live article timestamp.'
      : !mdPubDate && livePubDate
        ? `Extracted publication date ${livePubDate} from live page.`
        : `Markdown date: ${mdPubDate}, live date: ${livePubDate}.`
  });

  if (!mdPubDate && livePubDate) {
    suggestedEnrichments.publishedDate = livePubDate;
  }

  // 7. Last Modified / Updated Date
  const mdModDate = String(mappedFm.lastModifiedDate || mappedFm.updatedDate || '').trim();
  const liveModDate = String(meta.modifiedDate || '').trim();
  const modDatesMatch = mdModDate === liveModDate;

  diffs.push({
    field: 'lastModifiedDate',
    label: 'Last Modified Date',
    markdownValue: mdModDate,
    liveUrlValue: liveModDate,
    status: !mdModDate ? 'missing_in_markdown' : !liveModDate ? 'missing_in_live' : modDatesMatch ? 'identical' : 'different',
    category: 'metadata',
    recommendedSource: liveModDate ? 'live' : 'markdown',
    editorialNote: modDatesMatch
      ? 'Update timestamp is identical.'
      : liveModDate && (!mdModDate || liveModDate > mdModDate)
        ? `Live page indicates newer update timestamp: ${liveModDate} (vs Markdown ${mdModDate || 'none'}).`
        : 'Update timestamps differ.'
  });

  if (liveModDate && (!mdModDate || liveModDate > mdModDate)) {
    suggestedEnrichments.lastModifiedDate = liveModDate;
    additionalIssues.push({
      id: 'issue-reconciliation-newer-live-modified-date',
      severity: 'info',
      field: 'lastModifiedDate',
      title: 'Newer Update Date Found on Live Page',
      message: `Live page has modified date ${liveModDate}, which is newer than Markdown's ${mdModDate || 'empty'}.`,
      suggestion: 'Update lastModifiedDate to reflect the live publication revision.'
    });
  }

  // 8. Lead Visual / Hero Image
  const mdHero = String(mappedFm.heroImageType || mappedFm.image || '').trim();
  const liveHero = String(liveData.heroImageCandidate?.src || meta.ogImage || '').trim();
  const heroMatch = mdHero && liveHero && (liveHero.includes(mdHero) || mdHero.includes(liveHero));

  diffs.push({
    field: 'heroImageType',
    label: 'Hero Artwork / Image',
    markdownValue: mdHero,
    liveUrlValue: liveHero,
    status: !mdHero ? 'missing_in_markdown' : !liveHero ? 'missing_in_live' : heroMatch ? 'identical' : 'different',
    category: 'media',
    recommendedSource: mdHero ? 'markdown' : 'live',
    editorialNote: heroMatch
      ? 'Lead visual corresponds to live OpenGraph / hero image.'
      : !mdHero && liveHero
        ? 'Live page has lead artwork absent in Markdown front matter.'
        : 'Image sources differ between Markdown and live page.'
  });

  if (!mdHero && liveHero) {
    suggestedEnrichments.heroImageType = liveHero;
    if (liveData.heroImageCandidate?.alt) {
      suggestedEnrichments.heroImageAlt = liveData.heroImageCandidate.alt;
    }
  }

  // 9. Heading Structure Comparison
  const mdHeadings = (analysis.cleanedBody || analysis.originalBody || '')
    .split('\n')
    .filter(l => l.startsWith('#'))
    .map(l => l.replace(/^#+\s*/, '').trim());

  const liveHeadingsList = content.headings.map(h => h.text.trim());

  const inMarkdownOnly = mdHeadings.filter(h => !liveHeadingsList.includes(h));
  const inLiveOnly = liveHeadingsList.filter(h => !mdHeadings.includes(h));
  const common = mdHeadings.filter(h => liveHeadingsList.includes(h));

  const identicalCount = diffs.filter(d => d.status === 'identical').length;
  const differingCount = diffs.filter(d => d.status === 'different').length;
  const missingInMarkdownCount = diffs.filter(d => d.status === 'missing_in_markdown').length;
  const missingInLiveCount = diffs.filter(d => d.status === 'missing_in_live').length;

  const reconciliationReport: ReconciliationReport = {
    hasDifferences: differingCount > 0 || missingInMarkdownCount > 0,
    totalCompared: diffs.length,
    identicalCount,
    differingCount,
    missingInMarkdownCount,
    missingInLiveCount,
    fieldDiffs: diffs,
    headingDiffs: {
      inMarkdownOnly,
      inLiveOnly,
      common
    },
    imageCountDiff: {
      markdownImages: (analysis.originalBody.match(/!\[.*?\]\(.*?\)/g) || []).length,
      liveImages: content.images.length
    }
  };

  return {
    reconciliationReport,
    issues: additionalIssues,
    suggestedEnrichments
  };
}

/**
 * Creates an import item and draft strictly from a live URL (standalone URL import).
 */
export function createImportItemFromLiveUrl(liveData: LivePageExtractedData): ImportFileItem {
  const meta = liveData.metadata;
  const content = liveData.content;

  // Generate slug & filename from URL pathname
  let urlSlug = 'imported-article';
  try {
    const parsed = new URL(liveData.url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      urlSlug = pathParts[pathParts.length - 1].replace(/\.(html|php|aspx)$/, '');
    }
  } catch {
    // Fallback
  }

  const filename = `${urlSlug}.md`;
  const itemId = `url-import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Synthesize front matter and Markdown document
  const rawTitle = content.h1 || meta.ogTitle || meta.title || 'Untitled Article';
  const cleanTitle = rawTitle.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim();
  const searchTitle = meta.title || meta.ogTitle || cleanTitle;
  const deck = content.deck || meta.ogDescription || '';
  const seoDescription = meta.metaDescription || meta.ogDescription || deck;
  const author = meta.author || 'Clara Vance';
  const publishedDate = meta.publishedDate || new Date().toISOString().split('T')[0];
  const lastModifiedDate = meta.modifiedDate || publishedDate;
  const heroImage = liveData.heroImageCandidate?.src || meta.ogImage || '';
  const heroImageAlt = liveData.heroImageCandidate?.alt || cleanTitle;

  const synthesizedFrontMatter = `---
title: "${cleanTitle.replace(/"/g, '\\"')}"
search-title: "${searchTitle.replace(/"/g, '\\"')}"
deck: "${deck.replace(/"/g, '\\"')}"
seo-description: "${seoDescription.replace(/"/g, '\\"')}"
slug: "${urlSlug}"
category: "Curation"
author: "${author}"
publishedDate: "${publishedDate}"
lastModifiedDate: "${lastModifiedDate}"
heroImageType: "${heroImage}"
heroImageAlt: "${heroImageAlt.replace(/"/g, '\\"')}"
importedFromUrl: "${liveData.url}"
---

${content.markdownBody}
`;

  // Run analysis pipeline on synthesized markdown
  const analysis = analyzeImportDocument(synthesizedFrontMatter, filename);

  // Mark that this came from Live URL
  analysis.classificationReason = `Synthesized from live page URL (${liveData.url})`;

  // Create editable draft
  const draft = createInitialDraft(analysis, filename);
  draft.sourceType = 'url';
  draft.liveUrl = liveData.url;

  const item: ImportFileItem = {
    id: itemId,
    filename,
    fileSize: synthesizedFrontMatter.length,
    rawContent: synthesizedFrontMatter,
    uploadedAt: new Date().toISOString(),
    targetType: draft.targetType,
    status: draft.status,
    sourceType: 'url',
    liveUrl: liveData.url,
    urlFetchStatus: 'success',
    livePageData: liveData,
    reconciliationReport: null,
    analysis,
    draft
  };

  return item;
}

/**
 * Reconciles an existing ImportFileItem with newly fetched live page data.
 */
export function enrichItemWithLiveUrl(
  item: ImportFileItem,
  liveData: LivePageExtractedData
): ImportFileItem {
  item.liveUrl = liveData.url;
  item.urlFetchStatus = 'success';
  item.livePageData = liveData;
  item.sourceType = 'both';

  if (!item.analysis) {
    item.analysis = analyzeImportDocument(item.rawContent, item.filename, item.targetType);
  }

  // Run reconciliation
  const { reconciliationReport, issues, suggestedEnrichments } = reconcileMarkdownAndLiveUrl(
    item.analysis,
    liveData,
    item.filename
  );

  item.reconciliationReport = reconciliationReport;

  // Add reconciliation issues to analysis issues (avoid duplicates)
  const existingIssueIds = new Set(item.analysis.issues.map(i => i.id));
  for (const iss of issues) {
    if (!existingIssueIds.has(iss.id)) {
      item.analysis.issues.push(iss);
      existingIssueIds.add(iss.id);
    }
  }

  // Re-extract structured links and product candidates combining Markdown and Live Page data
  const existingCmsProducts = getKnownCmsProducts();
  const rawFm = item.analysis.rawFrontMatter || item.draft?.customFrontMatter || {};
  const updatedStructuredLinks = extractStructuredLinks(
    item.analysis.cleanedBody || item.analysis.originalBody,
    liveData,
    rawFm
  );
  const updatedProductCandidates = detectProductCandidates(
    updatedStructuredLinks,
    item.analysis.cleanedBody || item.analysis.originalBody,
    liveData,
    existingCmsProducts,
    rawFm
  );

  item.analysis.structuredLinks = updatedStructuredLinks;
  item.analysis.productCandidates = updatedProductCandidates;

  // If draft exists, enrich missing draft fields if applicable
  if (!item.draft) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  } else {
    item.draft.structuredLinks = updatedStructuredLinks;
    item.draft.productCandidates = updatedProductCandidates;
  }

  if (item.draft) {
    item.draft.sourceType = 'both';
    item.draft.liveUrl = liveData.url;

    // Enrich missing core fields if empty in draft
    if (!item.draft.seoDescription && suggestedEnrichments['seo-description']) {
      item.draft.seoDescription = suggestedEnrichments['seo-description'];
    }
    if (!item.draft.searchTitle && suggestedEnrichments['search-title']) {
      item.draft.searchTitle = suggestedEnrichments['search-title'];
    }
    if (!item.draft.deck && suggestedEnrichments.deck) {
      item.draft.deck = suggestedEnrichments.deck;
    }
    if (!item.draft.heroImageType && suggestedEnrichments.heroImageType) {
      item.draft.heroImageType = suggestedEnrichments.heroImageType;
      if (suggestedEnrichments.heroImageAlt) {
        item.draft.heroImageAlt = suggestedEnrichments.heroImageAlt;
      }
    }
    if (!item.draft.publishedDate && suggestedEnrichments.publishedDate) {
      item.draft.publishedDate = suggestedEnrichments.publishedDate;
    }
    if (!item.draft.lastModifiedDate && suggestedEnrichments.lastModifiedDate) {
      item.draft.lastModifiedDate = suggestedEnrichments.lastModifiedDate;
    }

    item.draft.lastSavedAt = new Date().toISOString();
  }

  return item;
}

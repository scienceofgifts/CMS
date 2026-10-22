import fs from 'fs';
import path from 'path';
import * as yamlModule from 'js-yaml';
const yaml: any = (yamlModule as any).default || yamlModule;
import {
  ImportAnalysisResult,
  ImportFileItem,
  ImportDraft,
  ImportIssue,
  ImportTargetType,
  ImportItemStatus,
  FieldMappingStatus,
  FieldMappingItem,
  ImportBodyStats,
  ImportSeoResolution,
  ExtractedProductItem,
  FieldMappingDetail,
  ImportSampleItem,
  StructuredArticleLink,
  ImportLinkClassification,
  ImportLinkStatus,
  ImportLinkSource,
  DetectedProductCandidate,
  ProductDraftItem,
  ProductDraftState,
  LivePageExtractedData,
  CreatedPostInfo,
  CANONICAL_DESTINATION_FIELDS
} from '../src/types/import';

const PROJECT_ROOT = process.cwd();
const JEKYLL_ROOT = path.join(PROJECT_ROOT, 'site');
const GUIDES_DIR = path.join(JEKYLL_ROOT, '_guides');
const ARTICLES_DIR = path.join(JEKYLL_ROOT, '_articles');
const AUTHORS_FILE = path.join(JEKYLL_ROOT, '_data', 'authors.yml');
const COLLECTIONS_FILE = path.join(JEKYLL_ROOT, '_data', 'collections.yml');
const PRODUCTS_FILE = path.join(JEKYLL_ROOT, '_data', 'products.yml');

// In-memory registry of import items for Phase 1 session
const importSessionItems = new Map<string, ImportFileItem>();

// Obsolete layout presentation fields that must be explicitly ignored per rules
export const OBSOLETE_LAYOUT_FIELDS = [
  'home-title',
  'homeTitle',
  'Contents Guide',
  'contents_guide',
  'contentsGuide',
  'Best Overall',
  'best_overall',
  'bestOverall',
  'Topic Picks',
  'topic_picks',
  'topicPicks',
  'layout',
  'sidebar',
  'layout_version',
  'old_template'
];

/**
 * Loads known CMS authors from _data/authors.yml
 */
export function getKnownAuthors(): Array<{ key: string; name: string; role: string; bio: string }> {
  try {
    if (fs.existsSync(AUTHORS_FILE)) {
      const parsed = yaml.load(fs.readFileSync(AUTHORS_FILE, 'utf8')) as Record<string, any>;
      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed).map(([key, val]) => ({
          key,
          name: val.name || key,
          role: val.role || 'Staff Editor',
          bio: val.bio || ''
        }));
      }
    }
  } catch (err) {
    console.warn('Error reading authors.yml for importer:', err);
  }
  return [
    { key: 'clara', name: 'Clara Vance', role: 'Editor-in-Chief & Lead Researcher', bio: 'Former architectural historian and material culture researcher.' },
    { key: 'julian', name: 'Julian Mercer', role: 'Senior Editor, History & Literature', bio: 'Julian writes on material history, classic cartography, and rare editions.' },
    { key: 'elena', name: 'Elena Rostova', role: 'Contributing Editor, Science & Craft', bio: 'Elena investigates the intersection of precision engineering, culinary tools, and optical instruments.' }
  ];
}

/**
 * Loads known site categories/collections from _data/collections.yml
 */
export function getKnownCategories(): { guides: string[]; articles: string[] } {
  const categories = {
    guides: ['History', 'Books', 'Curation', 'Science', 'Food & Craft', 'Travel'],
    articles: ['Gift Psychology', 'Etiquette', 'Research', 'Relationships', 'Culture']
  };
  try {
    if (fs.existsSync(COLLECTIONS_FILE)) {
      const parsed = yaml.load(fs.readFileSync(COLLECTIONS_FILE, 'utf8')) as any;
      if (parsed) {
        if (Array.isArray(parsed.gift_guides)) {
          categories.guides = parsed.gift_guides.map((c: any) => c.title || c.slug).filter((c: string) => c && c.toLowerCase() !== 'all guides');
        }
        if (Array.isArray(parsed.articles)) {
          categories.articles = parsed.articles.map((c: any) => c.title || c.slug).filter((c: string) => c && c.toLowerCase() !== 'all articles');
        }
      }
    }
  } catch (err) {
    console.warn('Error reading collections.yml for importer:', err);
  }
  return categories;
}

/**
 * Loads known CMS products from site/_data/products.yml for duplicate matching
 */
export function getKnownCmsProducts(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const parsed = yaml.load(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading products.yml for duplicate matching:', err);
  }
  return [];
}

/**
 * Checks if a slug already exists on disk in site/_guides/ or site/_articles/
 */
export function checkSlugConflict(slug: string, targetType: ImportTargetType): { exists: boolean; existingType?: 'guide' | 'article' | 'page'; path?: string } {
  if (!slug) return { exists: false };
  const cleanSlug = slug.trim().toLowerCase();

  const guidePath = path.join(GUIDES_DIR, `${cleanSlug}.md`);
  if (fs.existsSync(guidePath)) {
    return { exists: true, existingType: 'guide', path: `_guides/${cleanSlug}.md` };
  }

  const articlePath = path.join(ARTICLES_DIR, `${cleanSlug}.md`);
  if (fs.existsSync(articlePath)) {
    return { exists: true, existingType: 'article', path: `_articles/${cleanSlug}.md` };
  }

  return { exists: false };
}

/**
 * Normalizes title or filename into kebab-case slug
 */
export function normalizeSlug(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/\.md|\.markdown$/i, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Checks if a string represents a generic call-to-action button or link reference identifier
 * (e.g., "view-on-shop-24", "View on Shop", "Shop Now", "Buy Now", "link-md-2") rather than a real product title.
 */
export function isGenericLinkOrReference(text: string): boolean {
  if (!text) return true;
  const clean = text.trim().toLowerCase();
  
  // Link/reference identifiers: view-on-shop-24, link-md-1, ref-1, candidate-1, etc.
  if (/^(?:view[-_\s]+on[-_\s]+shop(?:[-_\s]+\d+)?|view[-_\s]+on[-_\s]+store(?:[-_\s]+\d+)?|view[-_\s]+shop(?:[-_\s]+\d+)?)$/i.test(clean)) return true;
  if (/^(?:link[-_\s]*(?:md|live)?[-_\s]*\d+|ref[-_\s]*\d+|candidate[-_\s]*\d+|view[-_\s]*\d+)$/i.test(clean)) return true;
  if (/^(?:shop[-_\s]*now|buy[-_\s]*now|buy|purchase|order[-_\s]*now|check[-_\s]*price|view[-_\s]*product|see[-_\s]*details|get[-_\s]*it[-_\s]*here|click[-_\s]*here|learn[-_\s]*more|website|source|link)$/i.test(clean)) return true;
  if (/^https?:\/\//i.test(clean)) return true;
  if (clean.length < 2) return true;
  return false;
}

/**
 * Extracts canonical product identity (slug and title) directly from a product/merchant URL
 * (e.g. https://store.scienceofgifts.com/products/everybody-lies-t-shirt -> slug: "everybody-lies-t-shirt", title: "Everybody Lies T-Shirt")
 */
export function extractCanonicalProductIdentityFromUrl(url: string): { slug: string; title: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // E-commerce standard: /products/everybody-lies-t-shirt
    const productsMatch = pathname.match(/\/products\/([a-zA-Z0-9_-]+)/i);
    if (productsMatch && productsMatch[1]) {
      const rawSlug = productsMatch[1].toLowerCase().replace(/^[\W_]+|[\W_]+$/g, '');
      if (rawSlug && !isGenericLinkOrReference(rawSlug)) {
        const title = rawSlug
          .split(/[-_]+/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { slug: rawSlug, title };
      }
    }

    // Etsy: /listing/\d+/title-slug
    const etsyMatch = pathname.match(/\/listing\/\d+\/([a-zA-Z0-9_-]+)/i);
    if (etsyMatch && etsyMatch[1]) {
      const rawSlug = etsyMatch[1].toLowerCase().replace(/^[\W_]+|[\W_]+$/g, '');
      if (rawSlug && !isGenericLinkOrReference(rawSlug)) {
        const title = rawSlug
          .split(/[-_]+/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { slug: rawSlug, title };
      }
    }

    // Generic /product/slug, /items/slug, /p/slug
    const genericMatch = pathname.match(/\/(?:product|items?|p|dp)\/([a-zA-Z0-9_-]+)/i);
    if (genericMatch && genericMatch[1]) {
      const rawSlug = genericMatch[1].toLowerCase().replace(/^[\W_]+|[\W_]+$/g, '');
      if (rawSlug && !isGenericLinkOrReference(rawSlug)) {
        const title = rawSlug
          .split(/[-_]+/)
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        return { slug: rawSlug, title };
      }
    }
  } catch {}
  return null;
}

/**
 * Structured legacy product recommendation group parsed from Jekyll front-matter (itemN-*)
 */
export interface LegacyProductGroup {
  itemNumber: number;
  itemKey: string; // e.g. "item6"
  groupLabel: string; // e.g. "Product #6"
  headline?: string; // from itemN-headline
  name?: string; // from itemN-product
  url?: string; // from itemN-link
  vendor?: string; // from itemN-source
  buyText?: string; // from itemN-buy-text
  image?: string; // from itemN-img
  imageAlt?: string; // from itemN-img-alt
  description?: string; // from itemN-description
  idealFor?: string; // from itemN-ideal
  standOut?: string; // from itemN-so
  thingsToConsider?: string; // from itemN-tc
  giftGuideNotes?: string; // from itemN-gg
  rawFields: Record<string, any>;
}

/**
 * Extracts and groups legacy product recommendations from front-matter keys (item1-*, item2-*, item6-*, etc.)
 */
export function extractLegacyProductGroups(rawFm: Record<string, any>): Map<number, LegacyProductGroup> {
  const groups = new Map<number, LegacyProductGroup>();
  if (!rawFm || typeof rawFm !== 'object') return groups;

  for (const [key, val] of Object.entries(rawFm)) {
    const match = key.match(/^item(\d+)[-_]([a-zA-Z0-9_-]+)$/i);
    if (!match) continue;

    const itemNum = parseInt(match[1], 10);
    const suffix = match[2].toLowerCase();

    if (!groups.has(itemNum)) {
      groups.set(itemNum, {
        itemNumber: itemNum,
        itemKey: `item${itemNum}`,
        groupLabel: `Product #${itemNum}`,
        rawFields: {}
      });
    }

    const group = groups.get(itemNum)!;
    group.rawFields[key] = val;

    const strVal = typeof val === 'string' ? val.trim() : (val ? String(val).trim() : '');

    if (suffix === 'headline' || suffix === 'head') {
      group.headline = strVal;
    } else if (suffix === 'product' || suffix === 'name' || suffix === 'title') {
      group.name = strVal;
    } else if (suffix === 'link' || suffix === 'url') {
      group.url = strVal;
    } else if (suffix === 'source' || suffix === 'vendor') {
      group.vendor = strVal;
    } else if (suffix === 'buy-text' || suffix === 'buy_text' || suffix === 'buytext' || suffix === 'cta') {
      group.buyText = strVal;
    } else if (suffix === 'img' || suffix === 'image') {
      group.image = strVal;
    } else if (suffix === 'img-alt' || suffix === 'img_alt' || suffix === 'alt' || suffix === 'image-alt') {
      group.imageAlt = strVal;
    } else if (suffix === 'description' || suffix === 'desc') {
      group.description = strVal;
    } else if (suffix === 'ideal' || suffix === 'ideal-for' || suffix === 'ideal_for') {
      group.idealFor = strVal;
    } else if (suffix === 'so' || suffix === 'standout' || suffix === 'stand-out') {
      group.standOut = strVal;
    } else if (suffix === 'tc' || suffix === 'things-to-consider' || suffix === 'consider') {
      group.thingsToConsider = strVal;
    } else if (suffix === 'gg' || suffix === 'editorial' || suffix === 'review') {
      group.giftGuideNotes = strVal;
    }
  }

  return groups;
}

/**
 * Distinguishes product identity from link identity.
 * Extracts canonical product slug and title, ensuring link identifiers (such as "view-on-shop-24")
 * or generic call-to-action text ("View on Shop", "Buy Now") are NEVER mistaken for product IDs.
 */
export function extractProductIdentityFromLink(
  link: StructuredArticleLink,
  existingCmsProducts: any[] = []
): { productId: string; productTitle: string; matchedCmsProduct?: any } {
  const normUrl = (link.url || '').toLowerCase().replace(/\/+$/, '');
  const canonicalFromUrl = extractCanonicalProductIdentityFromUrl(link.url);

  // 1. Check existing CMS products catalog by URL or canonical slug
  if (existingCmsProducts.length > 0) {
    const matched = existingCmsProducts.find(p => {
      if (p.vendorUrl) {
        const pUrl = String(p.vendorUrl).toLowerCase().replace(/\/+$/, '');
        if (pUrl === normUrl) return true;
      }
      if (canonicalFromUrl?.slug && p.id === canonicalFromUrl.slug) return true;
      if (link.anchorText && !isGenericLinkOrReference(link.anchorText)) {
        const slug = normalizeSlug(link.anchorText);
        if (slug && p.id === slug) return true;
      }
      return false;
    });

    if (matched) {
      return {
        productId: matched.id,
        productTitle: matched.title || canonicalFromUrl?.title || matched.id,
        matchedCmsProduct: matched
      };
    }
  }

  // 2. Derive canonical title
  let productTitle = '';
  if (link.anchorText && !isGenericLinkOrReference(link.anchorText)) {
    productTitle = link.anchorText.trim();
  } else if (canonicalFromUrl?.title) {
    productTitle = canonicalFromUrl.title;
  } else if (link.location && !isGenericLinkOrReference(link.location)) {
    productTitle = link.location.trim();
  } else {
    productTitle = 'Curated Merchant Product';
  }

  // 3. Derive canonical product ID / slug (guaranteed product identity, never link identity)
  let productId = '';
  const titleSlug = normalizeSlug(productTitle);
  const isPureNumberOrAsin = /^\d+$|^[bB]0[a-zA-Z0-9]{8}$/.test(canonicalFromUrl?.slug || '');

  if (titleSlug && !isGenericLinkOrReference(titleSlug) && !isPureNumberOrAsin) {
    productId = titleSlug;
  } else if (canonicalFromUrl?.slug && !isGenericLinkOrReference(canonicalFromUrl.slug) && !isPureNumberOrAsin) {
    productId = canonicalFromUrl.slug;
  } else if (titleSlug && !isGenericLinkOrReference(titleSlug)) {
    productId = titleSlug;
  } else {
    productId = canonicalFromUrl?.slug || `product-${Date.now().toString(36)}`;
  }

  if (isGenericLinkOrReference(productId)) {
    if (canonicalFromUrl?.slug && !isGenericLinkOrReference(canonicalFromUrl.slug) && !isPureNumberOrAsin) {
      productId = canonicalFromUrl.slug;
    } else {
      productId = `product-${Date.now().toString(36)}`;
    }
  }

  return { productId, productTitle };
}

/**
 * Resolves an arbitrary identifier that might be a link reference (e.g. "view-on-shop-24", "link-md-2", "ref-1")
 * or a candidate ID to its underlying canonical CMS product by checking active migration sessions,
 * structured links, and the products catalog.
 */
export function resolveLinkReferenceToCanonicalProduct(
  referenceOrId: string,
  productsCatalog: any[] = []
): any | null {
  if (!referenceOrId) return null;
  const clean = referenceOrId.trim();
  const cleanLower = clean.toLowerCase();
  const normQuery = cleanLower.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

  // 1. Direct match on catalog by exact ID, slug, title, or URL path
  let found = productsCatalog.find(p =>
    p.id === clean ||
    (p.id && p.id.toLowerCase() === normQuery) ||
    (p.slug && p.slug.toLowerCase() === normQuery) ||
    (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normQuery) ||
    (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normQuery}`) || p.vendorUrl.toLowerCase().includes(`/${normQuery}`)))
  );
  if (found) return found;

  // 2. Search active import sessions for any link matching this referenceId, id, or anchor
  const sessionItems = Array.from(importSessionItems.values());
  for (const item of sessionItems) {
    const links: StructuredArticleLink[] = [
      ...(item.draft?.structuredLinks || []),
      ...(item.analysis?.structuredLinks || [])
    ];

    for (const link of links) {
      const match =
        link.referenceId === clean ||
        link.referenceId?.toLowerCase() === cleanLower ||
        link.id === clean ||
        link.id.toLowerCase() === cleanLower ||
        (link.referenceId && normalizeSlug(link.referenceId) === normQuery) ||
        (link.anchorText && normalizeSlug(link.anchorText) === normQuery);

      if (match) {
        // If link was exported, check exportedProductId
        if (link.exportedProductId) {
          found = productsCatalog.find(p => p.id === link.exportedProductId);
          if (found) return found;
        }

        // Check canonical identity from link URL
        if (link.url) {
          const canonical = extractCanonicalProductIdentityFromUrl(link.url);
          if (canonical?.slug) {
            found = productsCatalog.find(p => p.id === canonical.slug || p.slug === canonical.slug);
            if (found) return found;
          }

          const normUrl = link.url.toLowerCase().replace(/\/+$/, '');
          found = productsCatalog.find(p => p.vendorUrl && String(p.vendorUrl).toLowerCase().replace(/\/+$/, '') === normUrl);
          if (found) return found;
        }
      }
    }

    // Also check productDrafts in this session
    if (item.draft?.productDrafts) {
      for (const draft of item.draft.productDrafts) {
        if (draft.id === clean || draft.id === normQuery) {
          found = productsCatalog.find(p => p.id === draft.id);
          if (found) return found;
        }
        if (draft.vendorUrl) {
          const normUrl = draft.vendorUrl.toLowerCase().replace(/\/+$/, '');
          found = productsCatalog.find(p => p.vendorUrl && String(p.vendorUrl).toLowerCase().replace(/\/+$/, '') === normUrl);
          if (found) return found;
        }
      }
    }
  }

  // 3. Check if reference itself has an embedded canonical slug (e.g. products/everybody-lies-t-shirt)
  const canonicalDirect = extractCanonicalProductIdentityFromUrl(clean);
  if (canonicalDirect?.slug) {
    found = productsCatalog.find(p => p.id === canonicalDirect.slug || p.slug === canonicalDirect.slug);
    if (found) return found;
  }

  return null;
}

/**
 * Parses raw markdown document separating YAML front matter from body
 */
export function parseRawDocument(raw: string): { frontMatter: Record<string, any>; body: string; hasDelimiters: boolean } {
  const content = (raw || '').trim();
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (match) {
    try {
      const loaded = yaml.load(match[1]);
      return {
        frontMatter: loaded && typeof loaded === 'object' ? (loaded as Record<string, any>) : {},
        body: (match[2] || '').trim(),
        hasDelimiters: true
      };
    } catch (err: any) {
      return {
        frontMatter: { _yamlParseError: err.message },
        body: content,
        hasDelimiters: true
      };
    }
  }

  return {
    frontMatter: {},
    body: content,
    hasDelimiters: false
  };
}

/**
 * Calculates metrics and analyzes body structure
 */
export function analyzeBody(bodyText: string): ImportBodyStats {
  const words = bodyText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = bodyText.length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const h1Matches = bodyText.match(/^#\s+.+$/gm) || [];
  const h2Matches = bodyText.match(/^##\s+.+$/gm) || [];
  const h3Matches = bodyText.match(/^###\s+.+$/gm) || [];
  const h4PlusMatches = bodyText.match(/^#{4,6}\s+.+$/gm) || [];

  const liquidMatches = bodyText.match(/{[{%][\s\S]*?[%}]}/g) || [];
  const rawHtmlMatches = bodyText.match(/<\/?(?:div|span|section|article|aside|header|footer|iframe|script|table|tr|td|th)[^>]*>/gi) || [];
  const markdownLinks = bodyText.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

  return {
    wordCount,
    charCount,
    estimatedReadTime: `${readTimeMin} min read`,
    headings: {
      h1: h1Matches.length,
      h2: h2Matches.length,
      h3: h3Matches.length,
      h4Plus: h4PlusMatches.length
    },
    liquidTagsCount: liquidMatches.length,
    rawHtmlTagsCount: rawHtmlMatches.length,
    markdownLinksCount: markdownLinks.length
  };
}

/**
 * Automatically cleans markdown body to conform to Science of Gifts editorial rules
 * (e.g. Demote # H1 to ## H2, strip stray Liquid tags or scripts)
 */
export function sanitizeMarkdownBody(bodyText: string): string {
  let cleaned = bodyText;

  // Convert '# Heading' to '## Heading'
  cleaned = cleaned.replace(/^#\s+(.+)$/gm, '## $1');

  // Remove dangerous script tags
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');

  return cleaned.trim();
}

/**
 * Heuristic detector for content type
 */
export function detectContentType(fm: Record<string, any>, body: string, filename: string): { type: ImportTargetType; confidence: number; reason: string } {
  const fn = (filename || '').toLowerCase();
  const title = String(fm.title || '').toLowerCase();
  const category = String(fm.category || '').toLowerCase();
  const layout = String(fm.layout || '').toLowerCase();

  // Strong guide signals
  if (
    layout === 'guide' ||
    fn.includes('guide') ||
    fn.includes('gifts') ||
    title.includes('gifts for') ||
    title.includes('best gifts') ||
    fm.editorsPick ||
    fm.budgetSections ||
    fm.quickPicks ||
    fm.products
  ) {
    return {
      type: 'guide',
      confidence: 0.95,
      reason: 'Detected gift guide signals (products/gift keywords/layout: guide).'
    };
  }

  // Strong page signals
  if (layout === 'page' || ['about.md', 'contact.md', 'terms.md', 'privacy.md'].some(p => fn.endsWith(p))) {
    return {
      type: 'page',
      confidence: 0.9,
      reason: 'Detected static page signals (page layout or standard static page filename).'
    };
  }

  // Strong article signals
  if (
    layout === 'article' ||
    layout === 'post' ||
    category.includes('psychology') ||
    category.includes('culture') ||
    category.includes('etiquette') ||
    category.includes('essay') ||
    fm.sources ||
    fm.relatedGuideSlug
  ) {
    return {
      type: 'article',
      confidence: 0.9,
      reason: 'Detected editorial essay / article signals (citations/psychology/essay layout).'
    };
  }

  // Body content heuristic
  const priceMatches = body.match(/\$\d+(?:\.\d{2})?/g) || [];
  if (priceMatches.length >= 3) {
    return {
      type: 'guide',
      confidence: 0.75,
      reason: `Found ${priceMatches.length} currency price patterns indicating a curated product guide.`
    };
  }

  // Default to article
  return {
    type: 'article',
    confidence: 0.65,
    reason: 'Standard markdown essay/article structure detected.'
  };
}

/**
 * Checks if a URL or anchor text represents an affiliate link, merchant store, or product candidate
 */
export function isAffiliateOrProductLink(url: string, anchorText: string = ''): boolean {
  if (!url || url.startsWith('#') || url.startsWith('javascript:')) return false;
  const cleanUrl = url.trim().toLowerCase();
  const cleanAnchor = anchorText.trim().toLowerCase();

  // 1. Known E-Commerce Merchants
  const ecomDomains = [
    'fourthwall.com',
    'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amzn.to', 'a.co',
    'etsy.com',
    'ebay.com', 'ebay.to',
    'uncommongoods.com',
    'target.com',
    'walmart.com',
    'bestbuy.com',
    'nordstrom.com',
    'macys.com',
    'wayfair.com',
    'homedepot.com',
    'myshopify.com',
    'agenaastro.com',
    'kendrickastro.com'
  ];
  if (ecomDomains.some(d => cleanUrl.includes(d))) return true;

  if (cleanUrl.includes('//shop.') || cleanUrl.includes('.myshopify.com')) return true;

  // 2. Known Affiliate Networks & Redirectors
  const affiliateDomains = [
    'rstyle.me', 'shopstyle.it', 'shopstyle.com', 'ltk.it',
    'anrdoezrs.net', 'dpbolvg.net', 'jdoqocy.com', 'tkqlhce.com', 'kqzyfj.com', 'cj.dotomi.com', 'commission-junction.com', 'cj.com',
    'shareasale.com', 'shareasale-analytics.com',
    'impact.com', 'impactradius.com', '727net.net', 'pjtra.com', 'evyy.net', 'sjv.io',
    'linksynergy.com', 'ran-tracking.com',
    'skimlinks.com', 'redirectingat.com', 'go.skimresources.com',
    'viglink.com', 'redirect.viglink.com',
    'awin1.com', 'zenaps.com',
    'pepperjam.com',
    'avantlink.com'
  ];
  if (affiliateDomains.some(d => cleanUrl.includes(d))) return true;

  // 3. Known Affiliate Tracking Query Parameters
  const affiliateQueryParams = [
    'tag=',
    'ref=',
    'ref_=',
    'aff=',
    'affiliate=',
    'aff_id=',
    'affid=',
    'subid=',
    'sub_id=',
    'associate=',
    'assoc_id=',
    'tracking=',
    'tracker=',
    'linkcode=',
    'link_code=',
    'clickid=',
    'click_id=',
    'mkevt=',
    'mkcid=',
    'camp=',
    'toolid=',
    'partner=',
    'partner_id=',
    'pid=',
    'aid=',
    'sid=',
    'referrer='
  ];
  if (affiliateQueryParams.some(p => cleanUrl.includes(p))) return true;

  // 4. Product Path Patterns
  const productPaths = [
    '/dp/',
    '/gp/product/',
    '/product/',
    '/products/',
    '/item/',
    '/items/',
    '/p/',
    '/listing/',
    '/listings/',
    '/buy/',
    '/shop/'
  ];
  if (productPaths.some(p => cleanUrl.includes(p))) return true;

  // 5. Commercial Anchor Text Keywords
  const commercialAnchorKeywords = [
    'buy',
    'shop',
    'order',
    'check price',
    'view on',
    'get it here',
    'buy on',
    'available at',
    'purchase',
    'price',
    'add to cart',
    'see deal',
    'view deal',
    'latest price'
  ];
  if (commercialAnchorKeywords.some(kw => cleanAnchor.includes(kw))) return true;

  return false;
}

/**
 * Classifies an extracted URL into canonical editorial category
 */
export function classifyLink(url: string, anchorText: string = ''): ImportLinkClassification {
  if (!url || url.startsWith('#') || url.startsWith('javascript:')) return 'unknown';
  const cleanUrl = url.trim().toLowerCase();

  // Internal link: relative path or site domain
  if (
    cleanUrl.startsWith('/') ||
    cleanUrl.includes('scienceofgifts.com') ||
    cleanUrl.includes('scienceofgifts.example.com')
  ) {
    return 'internal';
  }

  // Media assets
  if (/\.(jpe?g|png|webp|gif|svg|mp4|mov|pdf)(\?.*)?$/i.test(cleanUrl)) {
    return 'media';
  }

  // Social profiles
  if (
    /(?:^|\.)(?:twitter\.com|x\.com|instagram\.com|facebook\.com|youtube\.com|tiktok\.com|pinterest\.com|linkedin\.com|threads\.net|bsky\.app)/i.test(cleanUrl)
  ) {
    return 'social';
  }

  // Shop / Commerce / Product Candidate / Affiliate Link
  if (isAffiliateOrProductLink(url, anchorText)) {
    return 'product';
  }

  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return 'external';
  }

  return 'unknown';
}

/**
 * Determines operational status of a link destination
 */
export function determineLinkStatus(url: string): { status: ImportLinkStatus; reason?: string } {
  if (!url || url.trim() === '' || url === '#' || url.startsWith('javascript:')) {
    return { status: 'broken', reason: 'Empty or anchor placeholder destination' };
  }
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
    return { status: 'valid' };
  }
  return { status: 'needs_review', reason: 'Relative or non-standard URL syntax' };
}

/**
 * Parses all Markdown links into structured models with provenance and surrounding context
 */
export function extractStructuredLinks(
  markdownBody: string,
  livePageData?: LivePageExtractedData | null,
  rawFrontMatter?: Record<string, any>
): StructuredArticleLink[] {
  const links: StructuredArticleLink[] = [];
  const seenUrls = new Set<string>();

  // Mask code blocks (fenced ``` and inline `) to avoid extracting sample links in code examples
  let cleanMarkdown = (markdownBody || '').replace(/---[\s\S]*?---/, ''); // strip YAML FM if present
  cleanMarkdown = cleanMarkdown.replace(/```[\s\S]*?```/g, '\n[CODE_BLOCK_PLACEHOLDER]\n');
  cleanMarkdown = cleanMarkdown.replace(/`[^`\n]+`/g, '[INLINE_CODE_PLACEHOLDER]');

  // 1. Extract reference link definitions: [ref]: url "optional title"
  const refDefs = new Map<string, { url: string; title?: string }>();
  const refDefRegex = /^[ ]{0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?(?:\s+["'(]([^"')]+)["')])?/gm;
  let match: RegExpExecArray | null;
  while ((match = refDefRegex.exec(cleanMarkdown)) !== null) {
    refDefs.set(match[1].trim().toLowerCase(), {
      url: match[2].trim(),
      title: match[3]?.trim()
    });
  }

  // 2. Parse Markdown line by line
  const lines = cleanMarkdown.split('\n');
  let currentSection = 'Introduction';
  let linkCounter = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('#')) {
      currentSection = trimmed.replace(/^#+\s*/, '').replace(/\([^)]+\)/, '').trim();
    }

    // A. Image-wrapped links: [![alt](img)](url)
    const imgLinkRegex = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(\s*<?([^\s>)]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g;
    while ((match = imgLinkRegex.exec(rawLine)) !== null) {
      linkCounter++;
      const anchor = match[1]?.trim() || 'Image Link';
      const targetUrl = match[3]?.trim();
      if (!targetUrl) continue;
      const statusInfo = determineLinkStatus(targetUrl);
      const classification = classifyLink(targetUrl, anchor);
      const start = Math.max(0, match.index - 40);
      const end = Math.min(rawLine.length, match.index + match[0].length + 40);

      links.push({
        id: `link-md-${linkCounter}`,
        anchorText: anchor,
        url: targetUrl,
        source: 'markdown',
        rawMarkdown: match[0],
        contextSnippet: rawLine.substring(start, end).trim(),
        location: currentSection,
        linkType: 'image_link',
        titleAttribute: match[4]?.trim(),
        classification,
        status: statusInfo.status,
        statusReason: statusInfo.reason,
        isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl, anchor)
      });
      seenUrls.add(targetUrl.toLowerCase().replace(/\/+$/, ''));
    }

    // B. Standard inline links: [anchor](url "title")
    const inlineRegex = /(?<![!])\[([^\]]+)\]\(\s*<?([^\s>)]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g;
    while ((match = inlineRegex.exec(rawLine)) !== null) {
      if (match[0].startsWith('[![')) continue;

      linkCounter++;
      const anchor = match[1]?.trim() || 'Link';
      const targetUrl = match[2]?.trim();
      if (!targetUrl) continue;
      const statusInfo = determineLinkStatus(targetUrl);
      const classification = classifyLink(targetUrl, anchor);
      const start = Math.max(0, match.index - 40);
      const end = Math.min(rawLine.length, match.index + match[0].length + 40);

      links.push({
        id: `link-md-${linkCounter}`,
        anchorText: anchor,
        url: targetUrl,
        source: 'markdown',
        rawMarkdown: match[0],
        contextSnippet: rawLine.substring(start, end).trim(),
        location: currentSection,
        linkType: 'inline',
        titleAttribute: match[3]?.trim(),
        classification,
        status: statusInfo.status,
        statusReason: statusInfo.reason,
        isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl, anchor)
      });
      seenUrls.add(targetUrl.toLowerCase().replace(/\/+$/, ''));
    }

    // C. Autolinks: <https://...>
    const autolinkRegex = /<(https?:\/\/[^\s>]+)>/g;
    while ((match = autolinkRegex.exec(rawLine)) !== null) {
      linkCounter++;
      const targetUrl = match[1]?.trim();
      if (!targetUrl) continue;
      const statusInfo = determineLinkStatus(targetUrl);
      const classification = classifyLink(targetUrl);
      const start = Math.max(0, match.index - 30);
      const end = Math.min(rawLine.length, match.index + match[0].length + 30);

      links.push({
        id: `link-md-${linkCounter}`,
        anchorText: targetUrl,
        url: targetUrl,
        source: 'markdown',
        rawMarkdown: match[0],
        contextSnippet: rawLine.substring(start, end).trim(),
        location: currentSection,
        linkType: 'autolink',
        classification,
        status: statusInfo.status,
        statusReason: statusInfo.reason,
        isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl)
      });
      seenUrls.add(targetUrl.toLowerCase().replace(/\/+$/, ''));
    }

    // D. Reference links: [text][ref]
    const refUsageRegex = /(?<![!\w])\[([^\]]+)\]\[([^\]]*)\]/g;
    while ((match = refUsageRegex.exec(rawLine)) !== null) {
      const anchor = match[1]?.trim() || 'Link';
      const refKey = (match[2] || match[1]).trim().toLowerCase();
      const def = refDefs.get(refKey);
      if (def && def.url) {
        linkCounter++;
        const targetUrl = def.url;
        const statusInfo = determineLinkStatus(targetUrl);
        const classification = classifyLink(targetUrl, anchor);
        const start = Math.max(0, match.index - 40);
        const end = Math.min(rawLine.length, match.index + match[0].length + 40);

        links.push({
          id: `link-md-${linkCounter}`,
          referenceId: refKey,
          anchorText: anchor,
          url: targetUrl,
          source: 'markdown',
          rawMarkdown: match[0],
          contextSnippet: rawLine.substring(start, end).trim(),
          location: currentSection,
          linkType: 'reference',
          titleAttribute: def.title,
          classification,
          status: statusInfo.status,
          statusReason: statusInfo.reason,
          isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl, anchor)
        });
        seenUrls.add(targetUrl.toLowerCase().replace(/\/+$/, ''));
      }
    }

    // E. HTML <a> tags in markdown
    const htmlLinkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi;
    while ((match = htmlLinkRegex.exec(rawLine)) !== null) {
      const targetUrl = match[1]?.trim();
      if (!targetUrl) continue;
      const anchor = match[2]?.replace(/<[^>]+>/g, '').trim() || targetUrl;
      const normalized = targetUrl.toLowerCase().replace(/\/+$/, '');
      if (!seenUrls.has(normalized)) {
        linkCounter++;
        const statusInfo = determineLinkStatus(targetUrl);
        const classification = classifyLink(targetUrl, anchor);
        const start = Math.max(0, match.index - 30);
        const end = Math.min(rawLine.length, match.index + match[0].length + 30);

        links.push({
          id: `link-md-${linkCounter}`,
          anchorText: anchor,
          url: targetUrl,
          source: 'markdown',
          rawMarkdown: match[0],
          contextSnippet: rawLine.substring(start, end).trim(),
          location: currentSection,
          linkType: 'html_a',
          classification,
          status: statusInfo.status,
          statusReason: statusInfo.reason,
          isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl, anchor)
        });
        seenUrls.add(normalized);
      }
    }

    // F. Raw HTTP/HTTPS URLs in text not inside brackets
    const rawUrlRegex = /(?<!["'\(<\[])https?:\/\/[^\s<>"'\)]+/g;
    while ((match = rawUrlRegex.exec(rawLine)) !== null) {
      const targetUrl = match[0].trim();
      const normalized = targetUrl.toLowerCase().replace(/\/+$/, '');
      if (!seenUrls.has(normalized)) {
        linkCounter++;
        const statusInfo = determineLinkStatus(targetUrl);
        const classification = classifyLink(targetUrl);
        const start = Math.max(0, match.index - 30);
        const end = Math.min(rawLine.length, match.index + match[0].length + 30);

        links.push({
          id: `link-md-${linkCounter}`,
          anchorText: targetUrl,
          url: targetUrl,
          source: 'markdown',
          rawMarkdown: targetUrl,
          contextSnippet: rawLine.substring(start, end).trim(),
          location: currentSection,
          linkType: 'inline',
          classification,
          status: statusInfo.status,
          statusReason: statusInfo.reason,
          isProductCandidate: classification === 'product' || isAffiliateOrProductLink(targetUrl)
        });
        seenUrls.add(normalized);
      }
    }
  }

  // 3. Extract structured links from legacy front-matter product groups (itemN-link)
  if (rawFrontMatter && typeof rawFrontMatter === 'object') {
    const legacyGroups = extractLegacyProductGroups(rawFrontMatter);
    for (const group of legacyGroups.values()) {
      if (!group.url) continue;

      const cleanUrl = group.url.trim();
      const normalizedUrl = cleanUrl.toLowerCase().replace(/\/+$/, '');

      // Check if already extracted from body links
      const existing = links.find(l => l.url.toLowerCase().replace(/\/+$/, '') === normalizedUrl);
      if (existing) {
        existing.legacyItemId = group.itemKey;
        existing.legacyItemNumber = group.itemNumber;
        existing.legacyGroupLabel = group.groupLabel;
        existing.isProductCandidate = true;
        existing.classification = 'product';
        existing.productCandidateId = `candidate-legacy-${group.itemKey}`;
        if (!existing.originalUrl) existing.originalUrl = group.url;
        if (!existing.anchorText || existing.anchorText.startsWith('http') || existing.anchorText === 'Image Link' || isGenericLinkOrReference(existing.anchorText)) {
          existing.anchorText = group.name || group.headline || 'Product recommendation';
        }
      } else {
        linkCounter++;
        const statusInfo = determineLinkStatus(cleanUrl);
        const anchor = group.name || group.headline || group.buyText || (group.vendor ? `Buy on ${group.vendor}` : `Product #${group.itemNumber}`);

        links.push({
          id: `link-legacy-${group.itemKey}`,
          referenceId: group.itemKey,
          legacyItemId: group.itemKey,
          legacyItemNumber: group.itemNumber,
          legacyGroupLabel: group.groupLabel,
          productCandidateId: `candidate-legacy-${group.itemKey}`,
          anchorText: anchor,
          url: cleanUrl,
          originalUrl: group.url,
          source: 'markdown',
          rawMarkdown: `${group.itemKey}-link: ${cleanUrl}`,
          contextSnippet: group.description || group.headline || `${anchor} - ${group.vendor || ''}`,
          location: `Front Matter (${group.itemKey}-link)`,
          linkType: 'reference',
          classification: 'product',
          status: statusInfo.status,
          statusReason: statusInfo.reason,
          isProductCandidate: true,
          exportStatus: 'not_exported'
        });
        seenUrls.add(normalizedUrl);
      }
    }
  }

  // 4. Reconcile with livePageData links if available
  if (livePageData?.content?.links && Array.isArray(livePageData.content.links)) {
    for (const liveLink of livePageData.content.links) {
      if (!liveLink.href) continue;
      const cleanLiveUrl = liveLink.href.trim();
      const normalizedLive = cleanLiveUrl.toLowerCase().replace(/\/+$/, '');

      const existing = links.find(l => {
        const norm = l.url.toLowerCase().replace(/\/+$/, '');
        return norm === normalizedLive;
      });

      if (existing) {
        existing.source = 'both';
        if (liveLink.text && liveLink.text !== existing.anchorText) {
          existing.liveUrlAlternative = liveLink.text;
        }
        // Upgrade classification if live link shows affiliate/product candidate
        if (liveLink.isAffiliateCandidate || isAffiliateOrProductLink(cleanLiveUrl, liveLink.text)) {
          existing.classification = 'product';
          existing.isProductCandidate = true;
        }
      } else {
        linkCounter++;
        const statusInfo = determineLinkStatus(cleanLiveUrl);
        const isProd = liveLink.isAffiliateCandidate || isAffiliateOrProductLink(cleanLiveUrl, liveLink.text);
        const classification = isProd ? 'product' : classifyLink(cleanLiveUrl, liveLink.text);

        links.push({
          id: `link-live-${linkCounter}`,
          anchorText: liveLink.text || cleanLiveUrl,
          url: cleanLiveUrl,
          source: 'live',
          location: 'Live Page Body',
          linkType: 'html_a',
          classification,
          status: statusInfo.status,
          statusReason: statusInfo.reason,
          isProductCandidate: isProd
        });
        seenUrls.add(normalizedLive);
      }
    }
  }

  return links;
}

/**
 * Intelligently discovers product candidates from links, headings, prices, and live page recommendations.
 * Cross-references against site/_data/products.yml to detect existing duplicates.
 */
export function detectProductCandidates(
  links: StructuredArticleLink[],
  body: string,
  livePageData?: LivePageExtractedData | null,
  existingCmsProducts: any[] = [],
  rawFrontMatter?: Record<string, any>
): DetectedProductCandidate[] {
  const candidates: DetectedProductCandidate[] = [];
  const seenUrls = new Map<string, DetectedProductCandidate>();
  let candidateCounter = 0;

  // 1. Process legacy front-matter product groups FIRST (highest fidelity and authority)
  if (rawFrontMatter && typeof rawFrontMatter === 'object') {
    const legacyGroups = extractLegacyProductGroups(rawFrontMatter);
    for (const group of legacyGroups.values()) {
      if (!group.url && !group.name) continue;

      const normUrl = group.url ? group.url.toLowerCase().replace(/\/+$/, '') : `legacy-${group.itemKey}`;
      const matchingLink = links.find(l =>
        l.legacyItemId === group.itemKey ||
        (group.url && l.url.toLowerCase().replace(/\/+$/, '') === normUrl)
      );

      const candidateTitle = group.name || group.headline || `Product #${group.itemNumber}`;
      const candidate: DetectedProductCandidate = {
        id: `candidate-legacy-${group.itemKey}`,
        name: candidateTitle,
        url: group.url || matchingLink?.url || '',
        source: matchingLink?.source || 'markdown',
        anchorText: matchingLink?.anchorText || group.name,
        description: group.description || group.headline || '',
        contextSnippet: group.description || group.headline || '',
        image: group.image,
        imageAlt: group.imageAlt || `${candidateTitle} visual`,
        vendor: group.vendor || 'Merchant Vendor',
        confidence: 'high',
        detectionReason: `Legacy front-matter product group (${group.groupLabel})`,
        state: 'detected',
        associatedLinkId: matchingLink?.id || `link-legacy-${group.itemKey}`,
        legacyItemId: group.itemKey,
        legacyItemNumber: group.itemNumber,
        legacyGroupLabel: group.groupLabel,
        headline: group.headline,
        buyText: group.buyText,
        idealFor: group.idealFor,
        whatMakesItStandOut: group.standOut,
        thingsToConsider: group.thingsToConsider,
        editorialReview: group.giftGuideNotes
      };

      candidates.push(candidate);
      if (group.url) {
        seenUrls.set(normUrl, candidate);
      }
    }
  }

  // 2. Scan for numbered product sections in Markdown: e.g. "### 1. Solid Marine Brass Sextant ($165)"
  const lines = body.split('\n');
  const sectionHeadingRegex = /^(?:###|\d+\.|\*|\-)\s+\*?\*?(?:(?:\d+\.|\#\d+)\s+)?([A-Z0-9][\w\s&',.\-–—]{2,70})\*?\*?\s*(?:\((?:approx\.?\s*)?\$(\d+(?:\.\d{2})?)\)|[-–—]\s*\$(\d+(?:\.\d{2})?))?/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headingMatch = line.match(sectionHeadingRegex);
    if (headingMatch) {
      const candidateTitle = headingMatch[1].trim();
      const rawPrice = headingMatch[2] || headingMatch[3];
      const priceNum = rawPrice ? parseFloat(rawPrice) : undefined;

      // Skip generic structural headings
      const lower = candidateTitle.toLowerCase();
      if (
        lower.startsWith('table of') ||
        lower.startsWith('how to') ||
        lower.startsWith('what to avoid') ||
        lower.startsWith('why ') ||
        lower.startsWith('frequently asked') ||
        lower.startsWith('faq') ||
        lower.startsWith('conclusion') ||
        lower.startsWith('summary') ||
        lower.startsWith('primary research')
      ) {
        continue;
      }

      // Collect section context (lines immediately following this heading)
      let sectionSnippet = '';
      let vendorUrl = '';
      let vendorName = '';
      let sectionImage = '';

      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('#')) break; // Next section

        // Check for vendor link: - Vendor: [Name](url)
        const vendorLinkMatch = nextLine.match(/Vendor:\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i) ||
                                nextLine.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
        if (vendorLinkMatch && !vendorUrl) {
          vendorName = vendorLinkMatch[1].trim();
          vendorUrl = vendorLinkMatch[2].trim();
        }

        // Check for image
        const imgMatch = nextLine.match(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/);
        if (imgMatch && !sectionImage) {
          sectionImage = imgMatch[2].trim();
        }

        if (nextLine) {
          sectionSnippet += (sectionSnippet ? ' ' : '') + nextLine;
        }
      }

      if (vendorUrl) {
        candidateCounter++;
        const normUrl = vendorUrl.toLowerCase().replace(/\/+$/, '');
        const isFourthwall = normUrl.includes('fourthwall.com');

        const candidate: DetectedProductCandidate = {
          id: `candidate-${candidateCounter}`,
          name: candidateTitle,
          url: vendorUrl,
          source: 'markdown',
          anchorText: vendorName || candidateTitle,
          price: rawPrice ? `$${rawPrice}` : undefined,
          priceNumber: priceNum,
          vendor: vendorName || undefined,
          image: sectionImage || undefined,
          description: sectionSnippet.slice(0, 240),
          contextSnippet: line,
          confidence: isFourthwall ? 'high' : rawPrice ? 'high' : 'medium',
          detectionReason: isFourthwall
            ? 'Fourthwall product URL + product-style anchor text + surrounding product description'
            : rawPrice
            ? `Numbered guide heading with price ($${rawPrice}) + merchant vendor link`
            : 'Product heading structure with external vendor link',
          state: 'detected'
        };

        candidates.push(candidate);
        seenUrls.set(normUrl, candidate);
      }
    }
  }

  // 2. Discover product candidates from structured links (especially Fourthwall & Merchant links)
  for (const link of links) {
    const normUrl = link.url.toLowerCase().replace(/\/+$/, '');
    if (seenUrls.has(normUrl)) {
      const existing = seenUrls.get(normUrl)!;
      if (link.source === 'live' || link.source === 'both') {
        existing.source = 'both';
      }
      existing.associatedLinkId = link.id;
      continue;
    }

    const isFourthwall = normUrl.includes('fourthwall.com');
    const isProductClass = link.classification === 'product';

    if (isFourthwall || isProductClass) {
      candidateCounter++;
      const priceMatch = link.contextSnippet?.match(/\$(\d+(?:\.\d{2})?)/);
      const detectedPrice = priceMatch ? `$${priceMatch[1]}` : undefined;
      const detectedPriceNum = priceMatch ? parseFloat(priceMatch[1]) : undefined;

      let productName = '';
      const canonicalIdentity = extractCanonicalProductIdentityFromUrl(link.url);
      if (link.anchorText && !isGenericLinkOrReference(link.anchorText)) {
        productName = link.anchorText.trim();
      } else if (canonicalIdentity?.title) {
        productName = canonicalIdentity.title;
      } else if (link.location && !isGenericLinkOrReference(link.location)) {
        productName = link.location.trim();
      } else {
        productName = 'Curated Product Candidate';
      }

      const confidence: 'high' | 'medium' | 'low' = isFourthwall
        ? 'high'
        : detectedPrice
        ? 'high'
        : link.anchorText && !link.anchorText.toLowerCase().includes('click here')
        ? 'medium'
        : 'low';

      const reason = isFourthwall
        ? 'Fourthwall product URL + product-style anchor text + surrounding product description'
        : detectedPrice
        ? `Outbound product link with price mention (${detectedPrice}) in context`
        : `Product/merchant domain link (${normUrl.split('/')[2] || 'store'}) with commercial intent`;

      const candidate: DetectedProductCandidate = {
        id: `candidate-${candidateCounter}`,
        name: productName,
        url: link.url,
        source: link.source,
        anchorText: link.anchorText,
        price: detectedPrice,
        priceNumber: detectedPriceNum,
        contextSnippet: link.contextSnippet,
        description: link.contextSnippet,
        confidence,
        detectionReason: reason,
        state: 'detected',
        associatedLinkId: link.id
      };

      candidates.push(candidate);
      seenUrls.set(normUrl, candidate);
    }
  }

  // 3. Reconcile with livePageData images / affiliate candidates if available
  if (livePageData?.content?.images) {
    for (const img of livePageData.content.images) {
      if (!img.src) continue;
      for (const cand of candidates) {
        if (!cand.image && img.caption && cand.name) {
          const words = cand.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          if (words.some(w => img.caption?.toLowerCase().includes(w))) {
            cand.image = img.src;
            cand.imageAlt = img.alt || cand.name;
          }
        }
      }
    }
  }

  // 4. Duplicate Check against existing CMS catalog (_data/products.yml)
  for (const cand of candidates) {
    const candNormUrl = cand.url.toLowerCase().replace(/\/+$/, '');
    const candSlug = normalizeSlug(cand.name);

    const matchedCmsProduct = existingCmsProducts.find(cmsProd => {
      if (cmsProd.vendorUrl) {
        const cmsNormUrl = String(cmsProd.vendorUrl).toLowerCase().replace(/\/+$/, '');
        if (cmsNormUrl === candNormUrl) return true;
      }
      if (cmsProd.title && cand.name) {
        if (normalizeSlug(cmsProd.title) === candSlug) return true;
        if (cmsProd.title.toLowerCase().trim() === cand.name.toLowerCase().trim()) return true;
      }
      if (cmsProd.id && candSlug === cmsProd.id) return true;
      return false;
    });

    if (matchedCmsProduct) {
      cand.existingCmsProduct = {
        id: matchedCmsProduct.id,
        title: matchedCmsProduct.title,
        vendor: matchedCmsProduct.vendor,
        price: matchedCmsProduct.price,
        image: matchedCmsProduct.image,
        category: matchedCmsProduct.category
      };
      cand.detectionReason += ' · Existing product detected in CMS database (_data/products.yml).';

      // Mark associated link as already existing in CMS catalog
      if (cand.associatedLinkId) {
        const matchingLink = links.find(l => l.id === cand.associatedLinkId);
        if (matchingLink) {
          matchingLink.exportStatus = 'already_exists';
          matchingLink.exportedProductId = matchedCmsProduct.id;
          matchingLink.duplicateReason = `Matched existing CMS product "${matchedCmsProduct.title}" (${matchedCmsProduct.id}).`;
        }
      }
    }
  }

  return candidates;
}

/**
 * Creates a pre-populated product draft inside the migration review workflow (does NOT publish to Jekyll)
 */
export function createProductDraftFromCandidate(
  candidate: DetectedProductCandidate,
  existingProducts: any[] = []
): ProductDraftItem {
  const canonicalIdentity = extractCanonicalProductIdentityFromUrl(candidate.url);
  let normTitle = candidate.name.trim();
  if (isGenericLinkOrReference(normTitle) && canonicalIdentity?.title) {
    normTitle = canonicalIdentity.title;
  }
  const slug = (canonicalIdentity?.slug && !isGenericLinkOrReference(canonicalIdentity.slug))
    ? canonicalIdentity.slug
    : normalizeSlug(normTitle) || `imported-product-${Date.now()}`;

  // Extract vendor
  let vendor = candidate.vendor;
  if (!vendor && candidate.url) {
    try {
      const parsed = new URL(candidate.url);
      const host = parsed.hostname.replace(/^www\./, '');
      if (host.includes('fourthwall.com')) {
        vendor = host.split('.')[0] + ' (Fourthwall)';
      } else {
        vendor = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
      }
    } catch {
      vendor = 'Curated Vendor';
    }
  }

  // Price range calculation matching CMS taxonomy
  let priceRange = '50-100';
  if (candidate.priceNumber !== undefined) {
    if (candidate.priceNumber < 25) priceRange = 'under-25';
    else if (candidate.priceNumber <= 50) priceRange = '25-50';
    else if (candidate.priceNumber <= 100) priceRange = '50-100';
    else if (candidate.priceNumber <= 250) priceRange = '100-250';
    else priceRange = 'splurge';
  }

  const existingMatch = candidate.existingCmsProduct || existingProducts.find(p =>
    (p.vendorUrl && p.vendorUrl === candidate.url) ||
    normalizeSlug(p.title) === slug
  );

  return {
    id: `prod-draft-${slug}-${Date.now().toString(36).slice(2, 6)}`,
    title: normTitle,
    vendorUrl: candidate.url,
    vendor: vendor || 'Curated Merchant',
    price: candidate.price || '',
    priceNumber: candidate.priceNumber,
    priceRange,
    category: candidate.category || 'editors-pick',
    image: candidate.image || '',
    imageAlt: candidate.imageAlt || `${normTitle} photography`,
    description: candidate.description || candidate.contextSnippet || '',
    editorialReview: candidate.editorialReview || candidate.description || candidate.contextSnippet || '',
    whyItMakesAGreatGift: candidate.headline || 'Curated recommendation from article migration.',
    idealFor: candidate.idealFor || '',
    whatMakesItStandOut: candidate.whatMakesItStandOut || '',
    thingsToConsider: candidate.thingsToConsider || '',
    badgeLabel: null,
    recipients: [],
    interests: [],
    occasions: [],
    tags: [],
    state: 'draft_created',
    source: candidate.source,
    candidateId: candidate.id,
    contextSnippet: candidate.contextSnippet,
    matchedExistingProductId: existingMatch ? existingMatch.id : undefined,
    isDuplicate: !!existingMatch,
    duplicateResolution: existingMatch ? 'use_existing' : undefined,
    createdAt: new Date().toISOString()
  };
}

/**
 * Extracts potential product mentions from markdown body text
 */
export function extractProductsFromBody(body: string): ExtractedProductItem[] {
  const products: ExtractedProductItem[] = [];
  const lines = body.split('\n');

  const productHeadingRegex = /^(?:###|\d+\.|\*|\-)\s+\*?\*?([A-Z0-9][\w\s&',.-]{3,60})\*?\*?\s*(?:\((?:approx\.?\s*)?\$(\d+(?:\.\d{2})?)\)|[-–—]\s*\$(\d+(?:\.\d{2})?))?/i;

  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(productHeadingRegex);
    if (match) {
      const title = match[1].trim();
      const rawPrice = match[2] || match[3];
      const priceNum = rawPrice ? parseFloat(rawPrice) : undefined;

      // Extract vendor URL if present in line
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      const vendor = linkMatch ? linkMatch[1] : undefined;
      const vendorUrl = linkMatch ? linkMatch[2] : undefined;

      if (title.length > 3 && !title.toLowerCase().startsWith('table of') && !title.toLowerCase().startsWith('how to') && !title.toLowerCase().startsWith('what to avoid')) {
        count++;
        products.push({
          id: normalizeSlug(title) || `imported-prod-${count}`,
          title,
          price: rawPrice ? `$${rawPrice}` : undefined,
          priceNumber: priceNum,
          vendor,
          vendorUrl,
          contextSnippet: line.slice(0, 120)
        });
      }
    }
  }

  return products.slice(0, 25);
}

/**
 * Maps old front matter fields to canonical Science of Gifts CMS schema
 * (Enforces Known Old-Site Rules)
 */
export function mapFieldsToSchema(
  rawFm: Record<string, any>,
  body: string,
  targetType: ImportTargetType,
  filename: string
): {
  mappedFm: Record<string, any>;
  fieldMappings: FieldMappingDetail[];
  seo: ImportSeoResolution;
  issues: ImportIssue[];
} {
  const mappedFm: Record<string, any> = {};
  const fieldMappings: FieldMappingDetail[] = [];
  const issues: ImportIssue[] = [];

  const knownAuthors = getKnownAuthors();
  const knownCategories = getKnownCategories();

  // 1. Title (title -> title)
  const rawTitle = rawFm.title || rawFm.name || rawFm.headline || '';
  if (rawTitle && typeof rawTitle === 'string' && rawTitle.trim()) {
    mappedFm.title = rawTitle.trim();
    fieldMappings.push({
      oldKey: 'title',
      newKey: 'title',
      oldValue: rawTitle,
      newValue: mappedFm.title,
      status: 'mapped',
      note: 'Primary reader-facing display title'
    });
  } else {
    mappedFm.title = filename.replace(/\.md|\.markdown$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    issues.push({
      id: 'issue-missing-title',
      severity: 'error',
      field: 'title',
      title: 'Missing Title in Front Matter',
      message: 'No title field found in YAML front matter. Derived title from filename.',
      suggestion: 'Provide an explicit editorial title.',
      actionType: 'map_field',
      actionPayload: { field: 'title' }
    });
    fieldMappings.push({
      oldKey: '(missing)',
      newKey: 'title',
      oldValue: undefined,
      newValue: mappedFm.title,
      status: 'fallback',
      note: 'Derived from filename'
    });
  }

  // 2. Slug (slug -> slug)
  const rawSlug = rawFm.slug || rawFm.permalink || '';
  if (rawSlug && typeof rawSlug === 'string' && rawSlug.trim()) {
    mappedFm.slug = normalizeSlug(rawSlug);
    fieldMappings.push({
      oldKey: rawFm.slug ? 'slug' : 'permalink',
      newKey: 'slug',
      oldValue: rawSlug,
      newValue: mappedFm.slug,
      status: mappedFm.slug === rawSlug ? 'mapped' : 'normalized',
      note: 'Kebab-case URL pathname'
    });
  } else {
    mappedFm.slug = normalizeSlug(mappedFm.title || filename);
    fieldMappings.push({
      oldKey: '(missing)',
      newKey: 'slug',
      oldValue: undefined,
      newValue: mappedFm.slug,
      status: 'fallback',
      note: 'Derived from title/filename'
    });
  }

  // Check slug conflict
  const conflict = checkSlugConflict(mappedFm.slug, targetType);
  if (conflict.exists) {
    issues.push({
      id: 'issue-slug-conflict',
      severity: 'warning',
      field: 'slug',
      title: 'Slug Conflict Detected',
      message: `An existing ${conflict.existingType} file already exists at "${conflict.path}". In Phase 2, this will require renaming or user confirmation. (No files modified during Phase 1).`,
      suggestion: `Consider adjusting slug to "${mappedFm.slug}-imported" or rename in the review draft.`,
      actionType: 'fix_slug',
      actionPayload: { currentSlug: mappedFm.slug }
    });
  }

  // 3. Search Title (`search-title`)
  const rawSearchTitle = rawFm['search-title'] || rawFm.searchTitle || rawFm.seo_title || rawFm.meta_title;
  let resolvedSearchTitle = '';
  let searchTitleSource: ImportSeoResolution['searchTitleSource'] = 'fallback_to_title';

  if (rawSearchTitle && typeof rawSearchTitle === 'string' && rawSearchTitle.trim()) {
    mappedFm['search-title'] = rawSearchTitle.trim();
    resolvedSearchTitle = mappedFm['search-title'];
    searchTitleSource = 'explicit';
    fieldMappings.push({
      oldKey: rawFm['search-title'] ? 'search-title' : (rawFm.searchTitle ? 'searchTitle' : 'seo_title'),
      newKey: 'search-title',
      oldValue: rawSearchTitle,
      newValue: mappedFm['search-title'],
      status: 'mapped',
      note: 'Canonical Jekyll SEO <title> and OpenGraph title'
    });
  } else {
    // Missing search-title: falls back to title
    resolvedSearchTitle = mappedFm.title;
    searchTitleSource = 'fallback_to_title';
    fieldMappings.push({
      oldKey: '(not provided)',
      newKey: 'search-title',
      oldValue: undefined,
      newValue: `(Falls back to title: "${mappedFm.title}")`,
      status: 'fallback',
      note: 'Jekyll head.html automatically falls back to page.title when search-title is omitted.'
    });
    issues.push({
      id: 'issue-seo-title-fallback',
      severity: 'info',
      field: 'search-title',
      title: 'Search Title Uses Fallback',
      message: `No explicit search-title provided. Jekyll site template will fall back to reader title "${mappedFm.title}".`,
      suggestion: 'You can provide an explicit search-title optimized for Google SERPs (under 60 chars).',
      actionType: 'set_search_title',
      actionPayload: { fallbackTitle: mappedFm.title }
    });
  }

  // 4. Reader-Facing Deck / Description
  // Rule: old `display-excerpt` -> new visible description/deck
  const rawDeck = rawFm.deck || rawFm['display-excerpt'] || rawFm.displayExcerpt || rawFm.subtitle || rawFm.excerpt || rawFm.description;
  if (rawDeck && typeof rawDeck === 'string' && rawDeck.trim()) {
    mappedFm.deck = rawDeck.trim();
    const sourceKey = rawFm.deck
      ? 'deck'
      : (rawFm['display-excerpt']
        ? 'display-excerpt'
        : (rawFm.displayExcerpt
          ? 'displayExcerpt'
          : (rawFm.subtitle
            ? 'subtitle'
            : (rawFm.excerpt ? 'excerpt' : 'description'))));

    fieldMappings.push({
      oldKey: sourceKey,
      newKey: 'deck',
      oldValue: rawDeck,
      newValue: mappedFm.deck,
      status: sourceKey === 'deck' ? 'mapped' : 'normalized',
      note: sourceKey === 'display-excerpt'
        ? 'Transformed old display-excerpt to reader-facing deck'
        : 'Reader-facing visible deck / summary'
    });
  } else {
    issues.push({
      id: 'issue-missing-deck',
      severity: 'warning',
      field: 'deck',
      title: 'Missing Reader Deck / Subtitle',
      message: 'No deck, display-excerpt, or subtitle was provided in the source file.',
      suggestion: 'Add a 1-2 sentence compelling summary for readers.',
      actionType: 'map_field',
      actionPayload: { field: 'deck' }
    });
  }

  // 5. SEO Description (`seo-description`)
  const rawSeoDesc = rawFm['seo-description'] || rawFm.seoDescription || rawFm.meta_description;
  let resolvedSeoDesc = '';
  let seoDescSource: ImportSeoResolution['seoDescriptionSource'] = 'missing';

  if (rawSeoDesc && typeof rawSeoDesc === 'string' && rawSeoDesc.trim()) {
    mappedFm['seo-description'] = rawSeoDesc.trim();
    resolvedSeoDesc = mappedFm['seo-description'];
    seoDescSource = 'explicit';
    fieldMappings.push({
      oldKey: rawFm['seo-description'] ? 'seo-description' : (rawFm.seoDescription ? 'seoDescription' : 'meta_description'),
      newKey: 'seo-description',
      oldValue: rawSeoDesc,
      newValue: mappedFm['seo-description'],
      status: 'mapped',
      note: 'Canonical Jekyll SEO meta description'
    });
  } else if (mappedFm.deck) {
    resolvedSeoDesc = mappedFm.deck;
    seoDescSource = 'fallback_to_deck';
    fieldMappings.push({
      oldKey: '(not provided)',
      newKey: 'seo-description',
      oldValue: undefined,
      newValue: `(Falls back to deck: "${mappedFm.deck.slice(0, 50)}...")`,
      status: 'fallback',
      note: 'Jekyll head.html automatically falls back to page.deck when seo-description is omitted.'
    });
    issues.push({
      id: 'issue-seo-desc-fallback',
      severity: 'info',
      field: 'seo-description',
      title: 'SEO Description Uses Fallback',
      message: 'No explicit seo-description provided. Jekyll site template will fall back to deck.',
      suggestion: 'You can provide an explicit search snippet (120-160 chars) if you want search engines to use a different text than the reader deck.',
      actionType: 'set_seo_desc',
      actionPayload: { fallbackDesc: mappedFm.deck }
    });
  } else {
    issues.push({
      id: 'issue-seo-desc-missing',
      severity: 'warning',
      field: 'seo-description',
      title: 'No SEO Description Available',
      message: 'Neither seo-description nor deck were found. Search engines will fall back to site-wide default description.',
      suggestion: 'Provide an seo-description or deck for optimal search indexing.',
      actionType: 'set_seo_desc',
      actionPayload: {}
    });
  }

  // 6. Category
  const rawCat = rawFm.category || rawFm.categories || rawFm.tag || '';
  const catString = Array.isArray(rawCat) ? (rawCat[0] || '') : String(rawCat || '');
  if (catString.trim()) {
    mappedFm.category = catString.trim();
    const validCats = targetType === 'guide' ? knownCategories.guides : knownCategories.articles;
    const isKnown = validCats.some(c => c.toLowerCase() === mappedFm.category.toLowerCase());

    fieldMappings.push({
      oldKey: Array.isArray(rawCat) ? 'categories' : 'category',
      newKey: 'category',
      oldValue: rawCat,
      newValue: mappedFm.category,
      status: 'mapped',
      note: isKnown ? 'Matched to verified CMS collection taxonomy' : 'Custom / Unmatched category'
    });

    if (!isKnown) {
      issues.push({
        id: 'issue-unmatched-category',
        severity: 'info',
        field: 'category',
        title: 'Unmatched Taxonomy Category',
        message: `Category "${mappedFm.category}" is not in the standard ${targetType} collections list (${validCats.join(', ')}).`,
        suggestion: `Consider mapping to one of the verified categories: ${validCats.join(', ')}.`
      });
    }
  } else {
    mappedFm.category = targetType === 'guide' ? 'Curation' : 'Gift Psychology';
    fieldMappings.push({
      oldKey: '(missing)',
      newKey: 'category',
      oldValue: undefined,
      newValue: mappedFm.category,
      status: 'fallback',
      note: 'Defaulted to standard primary category'
    });
    issues.push({
      id: 'issue-missing-category',
      severity: 'warning',
      field: 'category',
      title: 'Missing Category',
      message: `No category specified. Defaulted to "${mappedFm.category}".`,
      suggestion: 'Select the appropriate editorial category.'
    });
  }

  // 7. Author
  const rawAuthor = rawFm.author || rawFm.by || rawFm.writer;
  if (rawAuthor) {
    if (typeof rawAuthor === 'string') {
      const matchStaff = knownAuthors.find(a => a.name.toLowerCase() === rawAuthor.toLowerCase() || a.key.toLowerCase() === rawAuthor.toLowerCase());
      if (matchStaff) {
        mappedFm.author = {
          name: matchStaff.name,
          role: matchStaff.role,
          bio: matchStaff.bio
        };
        fieldMappings.push({
          oldKey: rawFm.author ? 'author' : (rawFm.by ? 'by' : 'writer'),
          newKey: 'author',
          oldValue: rawAuthor,
          newValue: `${mappedFm.author.name} (${mappedFm.author.role})`,
          status: 'mapped',
          note: 'Matched to verified staff author record in authors.yml'
        });
      } else {
        mappedFm.author = {
          name: rawAuthor.trim(),
          role: 'Contributing Editor',
          bio: ''
        };
        fieldMappings.push({
          oldKey: rawFm.author ? 'author' : (rawFm.by ? 'by' : 'writer'),
          newKey: 'author',
          oldValue: rawAuthor,
          newValue: mappedFm.author.name,
          status: 'mapped',
          note: 'String author converted to structured { name, role, bio } object'
        });
      }
    } else if (typeof rawAuthor === 'object') {
      mappedFm.author = {
        name: rawAuthor.name || 'Staff Editor',
        role: rawAuthor.role || 'Contributing Editor',
        bio: rawAuthor.bio || ''
      };
      fieldMappings.push({
        oldKey: 'author',
        newKey: 'author',
        oldValue: rawAuthor,
        newValue: `${mappedFm.author.name} (${mappedFm.author.role})`,
        status: 'mapped',
        note: 'Structured author object preserved'
      });
    }
  } else {
    // Default author
    mappedFm.author = {
      name: 'Clara Vance',
      role: 'Editor-in-Chief & Lead Researcher',
      bio: 'Former architectural historian and material culture researcher.'
    };
    fieldMappings.push({
      oldKey: '(missing)',
      newKey: 'author',
      oldValue: undefined,
      newValue: 'Clara Vance (Default)',
      status: 'fallback',
      note: 'Defaulted to Editor-in-Chief'
    });
    issues.push({
      id: 'issue-missing-author',
      severity: 'warning',
      field: 'author',
      title: 'Missing Author Attribution',
      message: 'No author specified in source front matter. Defaulted to Clara Vance.',
      suggestion: 'Assign an authentic author in the review layer.'
    });
  }

  // 8. Dates & Deprecation Handling (`lastModifiedDate` vs `updatedDate`)
  if (rawFm.updatedDate) {
    const targetDate = rawFm.lastModifiedDate || rawFm.updatedDate;
    mappedFm.lastModifiedDate = String(targetDate);
    fieldMappings.push({
      oldKey: 'updatedDate',
      newKey: 'lastModifiedDate',
      oldValue: rawFm.updatedDate,
      newValue: mappedFm.lastModifiedDate,
      status: 'deprecated_mapped',
      note: 'Per CMS specification: deprecated "updatedDate" mapped to canonical "lastModifiedDate". Old key will not be written.'
    });
    issues.push({
      id: 'issue-updated-date-deprecated',
      severity: 'info',
      field: 'updatedDate',
      title: 'Deprecated updatedDate Handled',
      message: `Source front matter contains legacy "updatedDate: ${rawFm.updatedDate}". This was cleanly mapped to canonical "lastModifiedDate" per the CMS contract.`,
      suggestion: 'No action needed; the system automatically modernizes this field.'
    });
  } else if (rawFm.lastModifiedDate) {
    mappedFm.lastModifiedDate = String(rawFm.lastModifiedDate);
    fieldMappings.push({
      oldKey: 'lastModifiedDate',
      newKey: 'lastModifiedDate',
      oldValue: rawFm.lastModifiedDate,
      newValue: mappedFm.lastModifiedDate,
      status: 'mapped',
      note: 'Canonical last modification timestamp'
    });
  }

  if (rawFm.publishedDate || rawFm.date) {
    const rawPub = rawFm.publishedDate || rawFm.date;
    mappedFm.publishedDate = String(rawPub);
    fieldMappings.push({
      oldKey: rawFm.publishedDate ? 'publishedDate' : 'date',
      newKey: 'publishedDate',
      oldValue: rawPub,
      newValue: mappedFm.publishedDate,
      status: 'mapped',
      note: 'Canonical publication date'
    });
  }

  // 9. Read time
  if (rawFm.readTime) {
    mappedFm.readTime = String(rawFm.readTime);
    fieldMappings.push({
      oldKey: 'readTime',
      newKey: 'readTime',
      oldValue: rawFm.readTime,
      newValue: mappedFm.readTime,
      status: 'mapped',
      note: 'Reader time estimate'
    });
  } else {
    const words = body.trim().split(/\s+/).filter(Boolean);
    const mins = Math.max(1, Math.ceil(words.length / 200));
    mappedFm.readTime = `${mins} min read`;
    fieldMappings.push({
      oldKey: '(calculated)',
      newKey: 'readTime',
      oldValue: undefined,
      newValue: mappedFm.readTime,
      status: 'fallback',
      note: `Calculated from ${words.length} words`
    });
  }

  // 10. Hero image fields
  if (rawFm.heroImageType || rawFm.image) {
    mappedFm.heroImageType = rawFm.heroImageType || rawFm.image;
    mappedFm.image = mappedFm.heroImageType;
    fieldMappings.push({
      oldKey: rawFm.heroImageType ? 'heroImageType' : 'image',
      newKey: 'heroImageType',
      oldValue: rawFm.heroImageType || rawFm.image,
      newValue: mappedFm.heroImageType,
      status: 'mapped',
      note: 'Lead visual identifier'
    });
  }
  if (rawFm.heroImageAlt) mappedFm.heroImageAlt = rawFm.heroImageAlt;
  if (rawFm.heroImageCaption) mappedFm.heroImageCaption = rawFm.heroImageCaption;

  // 11. Quotes & Citations
  if (rawFm.introQuote) mappedFm.introQuote = rawFm.introQuote;
  if (rawFm.sources && Array.isArray(rawFm.sources)) mappedFm.sources = rawFm.sources;
  if (rawFm.relatedGuideSlug) mappedFm.relatedGuideSlug = rawFm.relatedGuideSlug;
  if (rawFm.relatedArticleSlugs) mappedFm.relatedArticleSlugs = rawFm.relatedArticleSlugs;

  // 12. Guide-specific fields
  if (targetType === 'guide') {
    if (rawFm.editorsPick) mappedFm.editorsPick = rawFm.editorsPick;
    if (rawFm.quickPicks) mappedFm.quickPicks = rawFm.quickPicks;
    if (rawFm.budgetSections) mappedFm.budgetSections = rawFm.budgetSections;
    if (rawFm.howToPick) mappedFm.howToPick = rawFm.howToPick;
    if (rawFm.whatToAvoid) mappedFm.whatToAvoid = rawFm.whatToAvoid;
    if (rawFm.relatedGuideSlugs) mappedFm.relatedGuideSlugs = rawFm.relatedGuideSlugs;
  }

  // 13. Explicit Old-Site Rule: Handle Obsolete Layout Features (IGNORE)
  // `home-title`, `Contents Guide`, `Best Overall`, `Topic Picks`, etc.
  for (const obsoleteKey of OBSOLETE_LAYOUT_FIELDS) {
    if (rawFm[obsoleteKey] !== undefined) {
      fieldMappings.push({
        oldKey: obsoleteKey,
        newKey: '(ignore)',
        oldValue: rawFm[obsoleteKey],
        newValue: '(Ignored)',
        status: 'preserved',
        note: `Obsolete layout/presentation feature from old site. Intentionally omitted from new schema per rules.`
      });
    }
  }

  // 14. Unknown Fields Detection: NEVER silently discard an unknown field!
  const handledKeys = new Set([
    'title', 'name', 'headline', 'slug', 'permalink',
    'search-title', 'searchTitle', 'seo_title', 'meta_title',
    'deck', 'display-excerpt', 'displayExcerpt', 'subtitle', 'excerpt', 'description',
    'seo-description', 'seoDescription', 'meta_description',
    'category', 'categories', 'tag',
    'author', 'by', 'writer',
    'date', 'publishedDate', 'updatedDate', 'lastModifiedDate',
    'readTime', 'heroImageType', 'image', 'heroImageAlt', 'heroImageCaption',
    'introQuote', 'sources', 'relatedGuideSlug', 'relatedArticleSlugs',
    'editorsPick', 'quickPicks', 'budgetSections', 'howToPick', 'whatToAvoid', 'relatedGuideSlugs',
    '_yamlParseError',
    ...OBSOLETE_LAYOUT_FIELDS
  ]);

  for (const [k, v] of Object.entries(rawFm)) {
    if (!handledKeys.has(k)) {
      // Check if key belongs to a structured legacy product recommendation record (itemN-*)
      const itemMatch = k.match(/^item(\d+)[-_]([a-zA-Z0-9_-]+)$/i);
      if (itemMatch) {
        const itemNum = parseInt(itemMatch[1], 10);
        const suffix = itemMatch[2].toLowerCase();
        fieldMappings.push({
          oldKey: k,
          newKey: `product-${suffix}`,
          oldValue: v,
          newValue: v,
          status: 'mapped',
          note: `Legacy Product Record (Product #${itemNum}): ${suffix}`
        });
        continue;
      }

      fieldMappings.push({
        oldKey: k,
        newKey: k,
        oldValue: v,
        newValue: v,
        status: 'preserved',
        note: 'Unknown legacy field. Surfaced for editorial review.'
      });

      issues.push({
        id: `issue-unknown-field-${k}`,
        severity: 'warning',
        field: k,
        title: `Unknown Old Field: "${k}"`,
        message: `Legacy front matter key "${k}" has value: ${typeof v === 'object' ? JSON.stringify(v) : `"${v}"`}. It does not have a direct equivalent in the standard Science of Gifts schema.`,
        suggestion: 'Map this to a canonical CMS field, choose "Ignore this field", edit its value, or keep as custom front matter.',
        actionType: 'map_field',
        actionPayload: { oldKey: k, oldValue: v }
      });
    }
  }

  return {
    mappedFm,
    fieldMappings,
    seo: {
      searchTitle: resolvedSearchTitle,
      searchTitleSource,
      searchTitleLength: resolvedSearchTitle.length,
      seoDescription: resolvedSeoDesc,
      seoDescriptionSource: seoDescSource,
      seoDescriptionLength: resolvedSeoDesc.length
    },
    issues
  };
}

/**
 * Builds the interactive FieldMappingItem list for the editable review layer
 */
export function buildInteractiveFieldMappings(
  rawFm: Record<string, any>,
  mappedFm: Record<string, any>,
  targetType: ImportTargetType
): FieldMappingItem[] {
  const items: FieldMappingItem[] = [];
  const processedKeys = new Set<string>();

  // 1. Process explicit keys from rawFrontMatter
  for (const [key, val] of Object.entries(rawFm)) {
    if (key === '_yamlParseError') continue;
    processedKeys.add(key);

    // Rule: home-title and layout features -> Ignored
    if (OBSOLETE_LAYOUT_FIELDS.includes(key)) {
      items.push({
        oldKey: key,
        newKey: '(ignore)',
        oldValue: val,
        currentValue: val,
        status: 'ignored',
        isUnknown: false,
        isModified: false,
        editorialNote: `Obsolete presentation feature from old site. Intentionally omitted from new CMS per rules.`
      });
      continue;
    }

    // Rule: display-excerpt -> deck (Transformed)
    if (key === 'display-excerpt' || key === 'displayExcerpt') {
      items.push({
        oldKey: key,
        newKey: 'deck',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed old display-excerpt to reader-facing deck.'
      });
      continue;
    }

    // Rule: title -> title (Migrated)
    if (key === 'title') {
      items.push({
        oldKey: 'title',
        newKey: 'title',
        oldValue: val,
        currentValue: val,
        status: 'migrated',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Direct migration to canonical reader title.'
      });
      continue;
    }

    // Rule: search-title -> search-title (Migrated)
    if (key === 'search-title') {
      items.push({
        oldKey: 'search-title',
        newKey: 'search-title',
        oldValue: val,
        currentValue: val,
        status: 'migrated',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Direct migration to canonical search-title.'
      });
      continue;
    }

    if (key === 'searchTitle' || key === 'seo_title' || key === 'meta_title') {
      items.push({
        oldKey: key,
        newKey: 'search-title',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Renamed legacy SEO title key to canonical search-title.'
      });
      continue;
    }

    // Rule: seo-description
    if (key === 'seo-description') {
      items.push({
        oldKey: 'seo-description',
        newKey: 'seo-description',
        oldValue: val,
        currentValue: val,
        status: 'migrated',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Direct migration to canonical seo-description.'
      });
      continue;
    }

    if (key === 'seoDescription' || key === 'meta_description') {
      items.push({
        oldKey: key,
        newKey: 'seo-description',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Renamed legacy meta description key to canonical seo-description.'
      });
      continue;
    }

    // Excerpt / subtitle / description
    if (key === 'deck') {
      items.push({
        oldKey: 'deck',
        newKey: 'deck',
        oldValue: val,
        currentValue: val,
        status: 'migrated',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Direct migration to canonical reader deck.'
      });
      continue;
    }

    if (key === 'subtitle' || key === 'excerpt') {
      items.push({
        oldKey: key,
        newKey: 'deck',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: `Transformed old ${key} into reader deck.`
      });
      continue;
    }

    if (key === 'description') {
      items.push({
        oldKey: 'description',
        newKey: mappedFm.deck === val ? 'deck' : 'seo-description',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed generic description field.'
      });
      continue;
    }

    // updatedDate -> lastModifiedDate (Transformed)
    if (key === 'updatedDate') {
      items.push({
        oldKey: 'updatedDate',
        newKey: 'lastModifiedDate',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed deprecated updatedDate to canonical lastModifiedDate.'
      });
      continue;
    }

    if (key === 'date') {
      items.push({
        oldKey: 'date',
        newKey: 'publishedDate',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed generic date to publishedDate.'
      });
      continue;
    }

    if (key === 'by' || key === 'writer') {
      items.push({
        oldKey: key,
        newKey: 'author',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: `Transformed ${key} to canonical author attribution.`
      });
      continue;
    }

    if (key === 'categories') {
      items.push({
        oldKey: 'categories',
        newKey: 'category',
        oldValue: val,
        currentValue: Array.isArray(val) ? val[0] : val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed categories array into primary canonical category.'
      });
      continue;
    }

    if (key === 'image') {
      items.push({
        oldKey: 'image',
        newKey: 'heroImageType',
        oldValue: val,
        currentValue: val,
        status: 'transformed',
        isUnknown: false,
        isModified: false,
        editorialNote: 'Transformed legacy image to heroImageType.'
      });
      continue;
    }

    // Standard direct fields
    const directFields = [
      'slug', 'category', 'author', 'publishedDate', 'lastModifiedDate',
      'readTime', 'heroImageType', 'heroImageAlt', 'heroImageCaption',
      'introQuote', 'sources', 'relatedGuideSlug', 'relatedArticleSlugs',
      'editorsPick', 'quickPicks', 'budgetSections', 'howToPick', 'whatToAvoid'
    ];

    if (directFields.includes(key)) {
      items.push({
        oldKey: key,
        newKey: key,
        oldValue: val,
        currentValue: val,
        status: 'migrated',
        isUnknown: false,
        isModified: false,
        editorialNote: `Direct migration to canonical ${key}.`
      });
      continue;
    }

    // Legacy Product Fields (itemN-*)
    const itemMatch = key.match(/^item(\d+)[-_]([a-zA-Z0-9_-]+)$/i);
    if (itemMatch) {
      const itemNum = parseInt(itemMatch[1], 10);
      const suffix = itemMatch[2].toLowerCase();
      let destKey = 'product-name';
      let destStatus: FieldMappingStatus = 'migrated';
      let destLabel = 'Product Name';

      if (suffix === 'link' || suffix === 'url') {
        destKey = 'product-link';
        destStatus = 'migrated';
        destLabel = 'Product URL';
      } else if (suffix === 'product' || suffix === 'name' || suffix === 'title') {
        destKey = 'product-name';
        destStatus = 'migrated';
        destLabel = 'Product Name';
      } else if (suffix === 'headline' || suffix === 'head') {
        destKey = 'product-headline';
        destStatus = 'migrated';
        destLabel = 'Product Headline';
      } else if (suffix === 'source' || suffix === 'vendor') {
        destKey = 'product-source';
        destStatus = 'migrated';
        destLabel = 'Vendor / Source';
      } else if (suffix === 'buy-text' || suffix === 'buy_text' || suffix === 'buytext' || suffix === 'cta') {
        destKey = 'product-buy-text';
        destStatus = 'transformed';
        destLabel = 'Purchase CTA Text';
      } else if (suffix === 'img' || suffix === 'image') {
        destKey = 'product-img';
        destStatus = 'migrated';
        destLabel = 'Product Image';
      } else if (suffix === 'img-alt' || suffix === 'img_alt' || suffix === 'alt' || suffix === 'image-alt') {
        destKey = 'product-img-alt';
        destStatus = 'migrated';
        destLabel = 'Image Alt Text';
      } else if (suffix === 'description' || suffix === 'desc') {
        destKey = 'product-description';
        destStatus = 'migrated';
        destLabel = 'Product Description';
      } else if (suffix === 'ideal' || suffix === 'ideal-for' || suffix === 'ideal_for') {
        destKey = 'product-ideal';
        destStatus = 'migrated';
        destLabel = 'Ideal For (Audience)';
      } else if (suffix === 'so' || suffix === 'standout' || suffix === 'stand-out') {
        destKey = 'product-so';
        destStatus = 'transformed';
        destLabel = 'What Makes It Stand Out';
      } else if (suffix === 'tc' || suffix === 'things-to-consider' || suffix === 'consider') {
        destKey = 'product-tc';
        destStatus = 'transformed';
        destLabel = 'Things to Consider';
      } else if (suffix === 'gg' || suffix === 'editorial' || suffix === 'review') {
        destKey = 'product-gg';
        destStatus = 'transformed';
        destLabel = 'Gift Guide Editorial Notes';
      } else {
        destKey = '(custom)';
        destStatus = 'transformed';
        destLabel = 'Legacy Product Metadata';
      }

      items.push({
        oldKey: key,
        newKey: destKey,
        oldValue: val,
        currentValue: val,
        status: destStatus,
        isUnknown: false,
        isModified: false,
        isLegacyProductField: true,
        legacyGroup: `Product #${itemNum}`,
        legacyItemId: `item${itemNum}`,
        legacyItemNumber: itemNum,
        legacyFieldType: suffix,
        editorialNote: `Grouped under Product #${itemNum}. Destination: ${destLabel}.`
      });
      continue;
    }

    // Any other key is UNKNOWN and requires review!
    items.push({
      oldKey: key,
      newKey: '(review)',
      oldValue: val,
      currentValue: val,
      status: 'needs_review',
      isUnknown: true,
      isModified: false,
      editorialNote: 'Unrecognized legacy field. Choose destination field, ignore, or preserve as custom front matter.'
    });
  }

  // 2. Add synthetic rows for missing core fields with fallbacks
  if (!rawFm.title) {
    items.unshift({
      oldKey: '(missing)',
      newKey: 'title',
      oldValue: null,
      currentValue: mappedFm.title || '',
      status: 'transformed',
      isUnknown: false,
      isModified: false,
      editorialNote: 'Derived fallback title from filename.'
    });
  }

  if (!rawFm['search-title'] && !rawFm.searchTitle && !rawFm.seo_title) {
    items.push({
      oldKey: '(not provided)',
      newKey: 'search-title',
      oldValue: null,
      currentValue: mappedFm['search-title'] || mappedFm.title || '',
      status: 'transformed',
      isUnknown: false,
      isModified: false,
      editorialNote: 'Falls back automatically to page title.'
    });
  }

  if (!rawFm['seo-description'] && !rawFm.seoDescription && !rawFm.meta_description) {
    items.push({
      oldKey: '(not provided)',
      newKey: 'seo-description',
      oldValue: null,
      currentValue: mappedFm['seo-description'] || mappedFm.deck || '',
      status: 'transformed',
      isUnknown: false,
      isModified: false,
      editorialNote: 'Falls back automatically to reader deck.'
    });
  }

  return items;
}

/**
 * Creates initial editable import draft representation
 */
export function createInitialDraft(analysis: ImportAnalysisResult, filename: string): ImportDraft {
  const mappedFm = analysis.mappedFrontMatter || {};
  const rawFm = analysis.rawFrontMatter || {};
  const fieldMappings = buildInteractiveFieldMappings(rawFm, mappedFm, analysis.detectedType);

  const hasUnknownFields = fieldMappings.some(m => m.status === 'needs_review');
  const hasErrors = analysis.issues.some(i => i.severity === 'error');
  const hasActiveWarnings = analysis.issues.some(i => i.severity === 'warning');

  const initialStatus: ImportItemStatus = (hasUnknownFields || hasErrors || hasActiveWarnings)
    ? 'needs_review'
    : 'analyzed';

  return {
    targetType: analysis.detectedType,
    title: String(mappedFm.title || ''),
    searchTitle: String(mappedFm['search-title'] || analysis.seo.searchTitle || ''),
    deck: String(mappedFm.deck || ''),
    seoDescription: String(mappedFm['seo-description'] || analysis.seo.seoDescription || ''),
    slug: String(mappedFm.slug || ''),
    category: String(mappedFm.category || (analysis.detectedType === 'guide' ? 'Curation' : 'Gift Psychology')),
    authorName: typeof mappedFm.author === 'object' ? (mappedFm.author?.name || 'Clara Vance') : String(mappedFm.author || 'Clara Vance'),
    authorRole: typeof mappedFm.author === 'object' ? (mappedFm.author?.role || 'Staff Editor') : 'Staff Editor',
    authorBio: typeof mappedFm.author === 'object' ? (mappedFm.author?.bio || '') : '',
    publishedDate: String(mappedFm.publishedDate || ''),
    lastModifiedDate: String(mappedFm.lastModifiedDate || ''),
    readTime: String(mappedFm.readTime || analysis.bodyStats.estimatedReadTime || '5 min read'),
    heroImageType: String(mappedFm.heroImageType || mappedFm.image || ''),
    heroImageAlt: String(mappedFm.heroImageAlt || ''),
    heroImageCaption: String(mappedFm.heroImageCaption || ''),
    introQuote: typeof mappedFm.introQuote === 'string' ? mappedFm.introQuote : (mappedFm.introQuote ? JSON.stringify(mappedFm.introQuote) : ''),
    body: analysis.cleanedBody || analysis.originalBody || '',
    structuredLinks: analysis.structuredLinks ? [...analysis.structuredLinks] : [],
    productCandidates: analysis.productCandidates ? [...analysis.productCandidates] : [],
    productDrafts: [],
    fieldMappings,
    resolvedIssueIds: [],
    customFrontMatter: {},
    status: initialStatus,
    lastSavedAt: new Date().toISOString()
  };
}

/**
 * Main Analysis Pipeline (Phase 1)
 */
export function analyzeImportDocument(
  rawContent: string,
  filename: string,
  targetTypeOverride?: ImportTargetType,
  livePageData?: LivePageExtractedData | null
): ImportAnalysisResult {
  const { frontMatter: rawFm, body: originalBody, hasDelimiters } = parseRawDocument(rawContent);
  const detected = detectContentType(rawFm, originalBody, filename);
  const effectiveTargetType = targetTypeOverride || detected.type;

  const bodyStats = analyzeBody(originalBody);
  const cleanedBody = sanitizeMarkdownBody(originalBody);

  const { mappedFm, fieldMappings, seo, issues } = mapFieldsToSchema(rawFm, originalBody, effectiveTargetType, filename);

  // Additional body-level issue detection
  if (bodyStats.headings.h1 > 0) {
    issues.push({
      id: 'issue-h1-in-body',
      severity: 'warning',
      field: 'body',
      title: 'Disallowed # H1 Headings in Markdown Body',
      message: `Found ${bodyStats.headings.h1} single-hash (# H1) headings in the markdown body. Science of Gifts contract requires ## for main sections and ### for subsections.`,
      suggestion: 'Demote # H1 headings to ## H2 in the editable body tab.',
      actionType: 'demote_h1',
      actionPayload: { count: bodyStats.headings.h1 }
    });
  }

  if (bodyStats.liquidTagsCount > 0) {
    issues.push({
      id: 'issue-liquid-tags',
      severity: 'warning',
      field: 'body',
      title: 'Liquid Tags Detected in Body',
      message: `Found ${bodyStats.liquidTagsCount} Liquid tags ({% ... %} or {{ ... }}). The CMS prefers pure Markdown to ensure cross-platform rendering.`,
      suggestion: 'Review body in editor to ensure template tags are intentional.'
    });
  }

  if (!hasDelimiters) {
    issues.push({
      id: 'issue-missing-delimiters',
      severity: 'warning',
      title: 'No YAML Front Matter Delimiters Found',
      message: 'The file does not contain standard "---" YAML front matter delimiters. Front matter was synthesized from heuristics.',
      suggestion: 'Verify all metadata fields in the review draft before proceeding.'
    });
  }

  // Extract products if guide
  const existingCmsProducts = getKnownCmsProducts();
  const extractedProducts = effectiveTargetType === 'guide' ? extractProductsFromBody(originalBody) : [];
  const structuredLinks = extractStructuredLinks(cleanedBody, livePageData, rawFm);
  const productCandidates = detectProductCandidates(structuredLinks, cleanedBody, livePageData, existingCmsProducts, rawFm);

  return {
    detectedType: effectiveTargetType,
    confidence: detected.confidence,
    classificationReason: detected.reason,
    rawFrontMatter: rawFm,
    mappedFrontMatter: mappedFm,
    originalBody,
    cleanedBody,
    bodyStats,
    seo,
    extractedProducts,
    structuredLinks,
    productCandidates,
    fieldMappings,
    issues,
    aiAssisted: false
  };
}

/**
 * Built-in Sample Legacy Files for Instant Testing
 */
export const SAMPLE_LEGACY_FILES: ImportSampleItem[] = [
  {
    id: 'sample-guide-parisian-gifts',
    title: 'Legacy Guide with itemN-* Product Records (Parisian Gifts)',
    filename: '2023-parisian-gift-inspirations.md',
    type: 'guide',
    description: 'Demonstrates legacy item1-* and item6-* front-matter product records, Amazon affiliate links, and structured link/product migration.',
    sampleLiveUrl: 'https://scienceofgifts.example.com/curation/best-parisian-gifts',
    sampleContent: `---
title: The 10 Best Parisian Gift Inspirations
search-title: Best Parisian Gifts (Tested Architectural & Literary Curation)
deck: Curated French aesthetic gifts, architectural photography, and artisanal keepsakes.
category: Curation
author: Clara Vance
publishedDate: 2023-11-20
item1-headline: The Flâneur's Field Guide
item1-product: Paris in Stride Walking Guide
item1-link: https://www.amazon.com/dp/1452105941/
item1-source: Amazon
item1-buy-text: Buy on Amazon
item1-img: paris-in-stride.jpg
item1-img-alt: Cover of Paris in Stride Walking Guide
item1-description: An architectural walking tour of Parisian backstreets and secret covered passages.
item1-ideal: Travelers, walkers, and urban explorers.
item1-so: Illustrated watercolor maps of historical passages.
item1-tc: Pocket-sized flexibound edition.
item6-headline: Paris in Radiant Hue
item6-product: Paris in Color
item6-link: https://www.amazon.com/Paris-Color-Nichole-Robertson/dp/1452105944/
item6-source: Amazon
item6-buy-text: Buy on Amazon
item6-img: paris-in-color.jpg
item6-img-alt: Cover of Paris in Color by Nichole Robertson
item6-description: A visual exploration of the city of light organized room by room and neighborhood by neighborhood in monochromatic palettes.
item6-gg: Featured in our 2023 Curation of Visual Arts & Travel Gifts.
item6-ideal: Photographers, Francophiles, and interior styling enthusiasts.
item6-so: Organized by saturated chromatic themes from robin egg blue doors to terracotta chimneys.
item6-tc: Hardcover visual volume; best displayed on an entryway console.
---

# The Best Parisian Gift Inspirations

Finding an authentic Parisian gift means avoiding souvenir zinc towers and seeking tactile, archival items that evoke the quiet light of the Île Saint-Louis.

Check out our full visual curation below.
`
  },
  {
    id: 'sample-guide-astrophotography',
    title: 'Legacy 2022 Guide with Old Layout Fields & Unknowns',
    filename: '2022-astrophotography-gifts.md',
    type: 'guide',
    description: 'Demonstrates home-title (ignored), display-excerpt (deck), Contents Guide (ignored), and sample live URL reconciliation.',
    sampleLiveUrl: 'https://scienceofgifts.example.com/curation/best-astrophotography-gifts',
    sampleContent: `---
title: The 10 Best Precision Gifts for Astrophotographers
search-title: Best Gifts for Astrophotographers (Tested Night-Sky Optics)
display-excerpt: From apochromatic doublets to heated dew shields, practical optical gear that actually gets used in the field.
home-title: Astrophotography Holiday Gift Guide 2022
Contents Guide: true
Best Overall: William Optics Zenithstar 73 APO
Topic Picks:
  - Telescopes
  - Dew Control
  - Tripods
category: Science
author: Elena Rostova
date: 2022-11-20
updatedDate: 2023-12-01
heroImageType: astrophotography-gear
old_sponsor_id: "nightsky-network-affiliate-88"
---

# The Best Gifts for Astrophotographers

Buying gifts for an astrophotographer is notoriously risky because astronomy forums are filled with well-meaning family members purchasing department store "trashscopes."

### 1. William Optics Zenithstar 73 APO ($780)
- Vendor: [Agena Astro](https://example.com/zenithstar)
- Price: $780
Apochromatic refractor featuring FPL-53 synthetic fluorite glass and a 2.5-inch rack-and-pinion focuser.

### 2. Kendrick Dual-Channel Dew Controller ($145)
- Vendor: [Kendrick Astro](https://example.com/dew-controller)
- Price: $145
Keeps optical corrector plates free of moisture during cold midnight observation runs.
`
  },
  {
    id: 'sample-guide-historical',
    title: 'Legacy 2023 Gift Guide (Historical Objects)',
    filename: '2023-gifts-for-historians.md',
    type: 'guide',
    description: 'Contains legacy updatedDate, informal product listings in body, missing search-title, and H1 tags.',
    sampleContent: `---
title: The 12 Greatest Gifts for History Enthusiasts
categories: [History, Research]
date: 2023-11-14
updatedDate: 2024-01-05
by: Julian Mercer
description: Hand-tested cartographic prints, bronze astrolabes, and museum replicas for anyone fascinated by the past.
image: history-buffs-hero
---

# The Best Gifts for History Enthusiasts

Most holiday gift guides for history nerds insult the reader with plastic Spartan warrior figurines or coffee mugs bearing trite Latin puns. Here, we present tactile artifacts and archival volumes worthy of display.

### 1. Solid Marine Brass Sextant ($165)
- Vendor: [London Nautical Atelier](https://example.com/brass-sextant)
- Price: $165
- Ideal For: Maritime history buffs and amateur astronomers.
A functional 19th-century naval sextant replica machined from solid brass in a mahogany presentation box.

### 2. Antiquarian Carta Marina Parchment Print ($48)
- Vendor: [Archival Map Reprints](https://example.com/carta-marina)
- Price: $48
- Ideal For: Cartography and Renaissance scholars.
High-resolution giclée print on 280gsm textured cotton rag of Olaus Magnus's celebrated 1539 sea chart.

### 3. Renaissance Cryptographic Cipher Wheel ($72)
- Vendor: [Venetian Works](https://example.com/cipher-wheel)
- Price: $72
Hand-turned walnut and laser-etched brass concentric cipher disk modeled after Alberti's 1467 treatise.
`
  },
  {
    id: 'sample-article-psychology',
    title: 'Legacy Essay on Social Reciprocity & Gifts',
    filename: 'the-psychology-of-social-reciprocity.md',
    type: 'article',
    description: 'Editorial essay with # H1 in body, legacy author string, no search-title, and inline academic citations.',
    sampleContent: `---
title: The Anxious Mathematics of Social Reciprocity
subtitle: Why matching the exact monetary value of a gift destroys the emotional bond of the gesture.
category: Gift Psychology
publishedDate: 2024-03-12
author: Clara Vance
heroImageType: reciprocity-anxiety
sources:
  - title: "The Gift: Forms and Functions of Exchange in Archaic Societies"
    author: Marcel Mauss
    year: 1925
---

# The Anxious Mathematics of Social Reciprocity

When someone gives you a gift that feels distinctly more lavish than what you presented in return, the physiological response is not gratitude—it is mild distress. Economists call this "debt aversion," but anthropologists have a more nuanced explanation.

## The Poison in the Balanced Ledger

Marcel Mauss famously demonstrated that an unreciprocated gift creates an asymmetrical power dynamic. When gift exchange becomes a transactional tit-for-tat ledger, the transcendent grace of spontaneous generosity evaporates.

Recipients do not catalog the wholesale price index of your contribution; they seek evidence of focused, attentive consideration.
`
  },
  {
    id: 'sample-minimal-page',
    title: 'Minimalist Markdown Document (No Delimiters)',
    filename: 'vintage-horology-overview.md',
    type: 'article',
    description: 'Raw markdown without YAML front matter delimiters to demonstrate fallback extraction.',
    sampleContent: `# Understanding Mechanical Watch Gifts for Horology Lovers

Choosing a vintage mechanical timepiece requires an understanding of escapement mechanisms, service history, and dial provenance.

Never purchase a vintage chronograph without demanding movement photographs showing the column wheel or cam configuration. A pristine dial frequently indicates a redial—a mortal sin among serious collectors.
`
  }
];

// Session Management Functions
export function getSessionItems(): ImportFileItem[] {
  return Array.from(importSessionItems.values());
}

export function getSessionItem(id: string): ImportFileItem | undefined {
  return importSessionItems.get(id);
}

export function setSessionItem(item: ImportFileItem): void {
  importSessionItems.set(item.id, item);
}

export function removeSessionItem(id: string): boolean {
  return importSessionItems.delete(id);
}

export function clearSessionItems(): void {
  importSessionItems.clear();
}

/**
 * Saves edits made to an import draft in the current session
 * (Zero Jekyll site writes!)
 */
export function saveImportDraft(id: string, updatedDraft: Partial<ImportDraft>): ImportFileItem | null {
  const item = importSessionItems.get(id);
  if (!item) return null;

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (item.draft) {
    item.draft = {
      ...item.draft,
      ...updatedDraft,
      lastSavedAt: new Date().toISOString()
    };

    if (updatedDraft.targetType) {
      item.targetType = updatedDraft.targetType;
    }

    if (updatedDraft.status) {
      item.status = updatedDraft.status;
    } else {
      // Re-evaluate status based on resolved issues and mapping status
      const hasUnresolvedMappings = item.draft.fieldMappings.some(m => m.status === 'needs_review');
      const unresolvedIssues = (item.analysis?.issues || []).filter(
        iss => (iss.severity === 'error' || iss.severity === 'warning') && !item.draft?.resolvedIssueIds.includes(iss.id)
      );

      if (hasUnresolvedMappings || unresolvedIssues.length > 0) {
        item.draft.status = 'needs_review';
        item.status = 'needs_review';
      } else if (item.status === 'needs_review') {
        item.draft.status = 'ready';
        item.status = 'ready';
      }
    }
  }

  setSessionItem(item);
  return item;
}

/**
 * Reverts import draft back to original pristine analysis
 */
export function revertImportDraft(id: string): ImportFileItem | null {
  const item = importSessionItems.get(id);
  if (!item || !item.analysis) return null;

  item.draft = createInitialDraft(item.analysis, item.filename);
  item.targetType = item.analysis.detectedType;
  item.status = item.draft.status;

  setSessionItem(item);
  return item;
}

/**
 * Toggles or marks an issue as resolved in the draft
 */
export function resolveDraftIssue(id: string, issueId: string, resolved: boolean = true, note?: string): ImportFileItem | null {
  const item = importSessionItems.get(id);
  if (!item) return null;

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (item.draft) {
    const currentResolved = new Set(item.draft.resolvedIssueIds || []);
    if (resolved) {
      currentResolved.add(issueId);
    } else {
      currentResolved.delete(issueId);
    }
    item.draft.resolvedIssueIds = Array.from(currentResolved);
    item.draft.lastSavedAt = new Date().toISOString();

    // Check if all warnings are resolved
    const unresolvedIssues = (item.analysis?.issues || []).filter(
      iss => (iss.severity === 'error' || iss.severity === 'warning') && !item.draft?.resolvedIssueIds.includes(iss.id)
    );
    const hasUnresolvedMappings = item.draft.fieldMappings.some(m => m.status === 'needs_review');

    if (unresolvedIssues.length === 0 && !hasUnresolvedMappings) {
      if (item.draft.status === 'needs_review') {
        item.draft.status = 'ready';
        item.status = 'ready';
      }
    }

    setSessionItem(item);
  }

  return item;
}

/**
 * Updates a specific field mapping in the editable draft
 */
export function updateDraftFieldMapping(
  id: string,
  oldKey: string,
  newKey: string,
  statusOverride?: FieldMappingStatus,
  customValue?: any
): ImportFileItem | null {
  const item = importSessionItems.get(id);
  if (!item) return null;

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (item.draft) {
    const mappingIndex = item.draft.fieldMappings.findIndex(m => m.oldKey === oldKey);
    let effectiveStatus: FieldMappingStatus = statusOverride || 'migrated';

    if (newKey === '(ignore)') {
      effectiveStatus = 'ignored';
    } else if (newKey === '(review)') {
      effectiveStatus = 'needs_review';
    } else if (newKey === '(custom)') {
      effectiveStatus = 'custom';
    } else if (newKey !== oldKey) {
      effectiveStatus = 'transformed';
    }

    const currentVal = customValue !== undefined ? customValue : (mappingIndex >= 0 ? item.draft.fieldMappings[mappingIndex].currentValue : undefined);

    const updatedEntry: FieldMappingItem = {
      oldKey,
      newKey,
      oldValue: mappingIndex >= 0 ? item.draft.fieldMappings[mappingIndex].oldValue : currentVal,
      currentValue: currentVal,
      status: effectiveStatus,
      isUnknown: false,
      isModified: true,
      editorialNote: newKey === '(ignore)'
        ? 'Ignored per user selection'
        : (newKey === '(review)' ? 'Requires editorial decision' : `Mapped to canonical ${newKey}`)
    };

    if (mappingIndex >= 0) {
      item.draft.fieldMappings[mappingIndex] = updatedEntry;
    } else {
      item.draft.fieldMappings.push(updatedEntry);
    }

    // Automatically resolve corresponding unknown field issue if one exists
    const issueId = `issue-unknown-field-${oldKey}`;
    if (newKey !== '(review)') {
      if (!item.draft.resolvedIssueIds.includes(issueId)) {
        item.draft.resolvedIssueIds.push(issueId);
      }
    }

    // Sync draft core fields if the mapping targets them
    if (currentVal !== undefined && newKey !== '(ignore)' && newKey !== '(review)') {
      if (newKey === 'title') item.draft.title = String(currentVal);
      if (newKey === 'search-title') item.draft.searchTitle = String(currentVal);
      if (newKey === 'deck') item.draft.deck = String(currentVal);
      if (newKey === 'seo-description') item.draft.seoDescription = String(currentVal);
      if (newKey === 'slug') item.draft.slug = normalizeSlug(String(currentVal));
      if (newKey === 'category') item.draft.category = String(currentVal);
    }

    item.draft.lastSavedAt = new Date().toISOString();
    setSessionItem(item);
  }

  return item;
}

/**
 * Updates status of draft (e.g. 'ready' or 'needs_review')
 */
export function updateDraftStatus(id: string, status: ImportItemStatus): ImportFileItem | null {
  const item = importSessionItems.get(id);
  if (!item) return null;

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (item.draft) {
    item.draft.status = status;
    item.status = status;
    item.draft.lastSavedAt = new Date().toISOString();
    setSessionItem(item);
  }

  return item;
}

/**
 * Exports specified product/affiliate links into actual CMS product entries in _data/products.yml
 * Enforces duplicate checks by exact URL, slug, and title to prevent duplicate entries.
 */
export function exportProductsFromLinks(
  itemId: string,
  linkIds: string[]
): {
  success: boolean;
  message: string;
  created: number;
  alreadyExisted: number;
  needsReview: number;
  failed: number;
  results: Array<{ linkId: string; status: string; productId?: string; message?: string }>;
  item: ImportFileItem;
} {
  const item = importSessionItems.get(itemId);
  if (!item) {
    throw new Error(`Import file "${itemId}" was not found.`);
  }

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (!item.draft) {
    throw new Error(`Draft for import file "${itemId}" could not be created.`);
  }

  const links = item.draft.structuredLinks || item.analysis?.structuredLinks || [];
  const linksToProcess = links.filter(l =>
    linkIds.includes(l.id) ||
    (l.productCandidateId && linkIds.includes(l.productCandidateId)) ||
    (l.legacyItemId && linkIds.includes(l.legacyItemId)) ||
    (l.referenceId && linkIds.includes(l.referenceId))
  );

  let created = 0;
  let alreadyExisted = 0;
  let needsReview = 0;
  let failed = 0;
  const results: Array<{ linkId: string; status: string; productId?: string; message?: string }> = [];

  // Read existing CMS products from _data/products.yml
  let existingCmsProducts: any[] = [];
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const parsed = yaml.load(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        existingCmsProducts = parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading products.yml during export:', err);
  }

  if (!item.draft.productDrafts) {
    item.draft.productDrafts = [];
  }

  for (const link of linksToProcess) {
    const normUrl = link.url.toLowerCase().replace(/\/+$/, '');

    // 1. Check if link was already exported on this draft
    if (link.exportStatus === 'exported' && link.exportedProductId) {
      alreadyExisted++;
      results.push({
        linkId: link.id,
        status: 'already_exists',
        productId: link.exportedProductId,
        message: 'Link was already exported previously.'
      });
      continue;
    }

    // Extract canonical product identity (guaranteed product ID, never a link/reference ID like view-on-shop-24)
    const { productId: prodSlug, productTitle: rawTitle, matchedCmsProduct } = extractProductIdentityFromLink(
      link,
      existingCmsProducts
    );

    // 2. Check duplicate in site/_data/products.yml by URL, canonical slug, or existing match
    if (matchedCmsProduct) {
      link.exportStatus = 'already_exists';
      link.exportedProductId = matchedCmsProduct.id;
      link.exportedAt = new Date().toISOString();
      link.duplicateReason = `Matched existing CMS product "${matchedCmsProduct.title}" (${matchedCmsProduct.id}).`;
      alreadyExisted++;
      results.push({
        linkId: link.id,
        status: 'already_exists',
        productId: matchedCmsProduct.id,
        message: `Matched existing catalog product "${matchedCmsProduct.title}".`
      });
      continue;
    }

    // 3. Check duplicate in session productDrafts
    const matchedDraft = item.draft.productDrafts.find(d => {
      if (d.vendorUrl) {
        const dUrl = d.vendorUrl.toLowerCase().replace(/\/+$/, '');
        if (dUrl === normUrl) return true;
      }
      if (d.id === prodSlug) return true;
      return false;
    });

    if (matchedDraft) {
      link.exportStatus = 'exported';
      link.exportedProductId = matchedDraft.id;
      link.exportedAt = new Date().toISOString();
      alreadyExisted++;
      results.push({
        linkId: link.id,
        status: 'already_exists',
        productId: matchedDraft.id,
        message: `Matched existing draft entry "${matchedDraft.title}".`
      });
      continue;
    }

    // 4. Create new product entry in _data/products.yml and productDrafts
    try {
      let vendorName = 'Merchant Vendor';
      try {
        const parsedUrl = new URL(link.url);
        const host = parsedUrl.hostname.replace(/^www\./, '');
        if (host.includes('fourthwall.com') || host.includes('store.scienceofgifts.com')) {
          vendorName = host.split('.')[0] + ' (Fourthwall)';
        } else {
          vendorName = host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1);
        }
      } catch {}

      const priceMatch = link.contextSnippet?.match(/\$(\d+(?:\.\d{2})?)/);
      const priceStr = priceMatch ? `$${priceMatch[1]}` : '';
      const priceNum = priceMatch ? parseFloat(priceMatch[1]) : undefined;

      // Look up candidate and legacy front-matter product group for rich editorial metadata
      const cand = (item.draft.productCandidates || []).find(c =>
        c.associatedLinkId === link.id ||
        (link.legacyItemId && c.legacyItemId === link.legacyItemId) ||
        (c.url && c.url.toLowerCase().replace(/\/+$/, '') === normUrl)
      );

      const rawFm = item.analysis?.rawFrontMatter || item.draft?.customFrontMatter || {};
      const legacyGroups = extractLegacyProductGroups(rawFm);
      const legacyGroup = link.legacyItemNumber ? legacyGroups.get(link.legacyItemNumber) : (link.legacyItemId ? Array.from(legacyGroups.values()).find(g => g.itemKey === link.legacyItemId) : null);

      const finalTitle = legacyGroup?.name || cand?.name || rawTitle || legacyGroup?.headline || 'Curated Product Candidate';
      const cleanSlug = normalizeSlug(finalTitle);
      const finalProdSlug = (cleanSlug && !isGenericLinkOrReference(cleanSlug) && !/^\d+$/.test(cleanSlug))
        ? cleanSlug
        : (prodSlug && !/^\d+$/.test(prodSlug) ? prodSlug : (cleanSlug || `product-${Date.now().toString(36)}`));

      const finalVendor = legacyGroup?.vendor || cand?.vendor || vendorName;
      const finalImage = legacyGroup?.image || cand?.image || '';
      const finalImageAlt = legacyGroup?.imageAlt || cand?.imageAlt || (finalImage ? `${finalTitle} product photography` : '');
      const finalIdeal = legacyGroup?.idealFor || cand?.idealFor || '';
      const finalStandOut = legacyGroup?.standOut || cand?.whatMakesItStandOut || '';
      const finalConsider = legacyGroup?.thingsToConsider || cand?.thingsToConsider || '';
      const finalEditorial = legacyGroup?.giftGuideNotes || cand?.editorialReview || legacyGroup?.description || cand?.description || link.contextSnippet || '';
      const finalWhyGreat = legacyGroup?.headline || cand?.headline || '';
      const finalDescription = legacyGroup?.description || cand?.description || link.contextSnippet || '';
      const finalBuyText = legacyGroup?.buyText || cand?.buyText || '';

      const isAffiliate = link.url.toLowerCase().includes('amazon') || link.url.toLowerCase().includes('amzn') || finalVendor.toLowerCase().includes('amazon');

      const newProductCmsEntry: any = {
        id: finalProdSlug,
        title: finalTitle,
        ...(finalImage ? { image: finalImage, imageType: finalImage } : {}),
        ...(finalImageAlt ? { imageAlt: finalImageAlt } : {}),
        ...(priceNum ? { price: priceStr, priceNumber: priceNum, priceRange: priceNum < 25 ? 'under-25' : priceNum <= 50 ? '25-50' : priceNum <= 100 ? '50-100' : 'splurge' } : {}),
        vendor: finalVendor,
        vendorUrl: link.url,
        category: 'editors-pick',
        ...(isAffiliate ? { affiliate: { sponsored: true, rel: 'noopener noreferrer sponsored' } } : {}),
        ...(finalEditorial ? { editorialReview: finalEditorial } : {}),
        ...(finalWhyGreat ? { whyItMakesAGreatGift: finalWhyGreat } : {}),
        ...(finalIdeal ? { idealFor: finalIdeal } : {}),
        ...(finalStandOut ? { whatMakesItStandOut: finalStandOut } : {}),
        ...(finalConsider ? { thingsToConsider: finalConsider } : {}),
        ...(finalBuyText ? { buyText: finalBuyText } : {}),
        tags: ['imported', 'migration', ...(finalVendor ? [normalizeSlug(finalVendor)] : [])]
      };

      // Append to _data/products.yml file
      existingCmsProducts.push(newProductCmsEntry);
      fs.writeFileSync(PRODUCTS_FILE, yaml.dump(existingCmsProducts, { lineWidth: -1 }), 'utf8');

      // Add to session productDrafts
      const newProductDraft: ProductDraftItem = {
        id: finalProdSlug,
        title: finalTitle,
        vendorUrl: link.url,
        vendor: finalVendor,
        price: priceStr,
        priceNumber: priceNum,
        priceRange: newProductCmsEntry.priceRange || '50-100',
        category: 'editors-pick',
        image: finalImage,
        imageAlt: finalImageAlt,
        description: finalDescription,
        editorialReview: finalEditorial,
        whyItMakesAGreatGift: finalWhyGreat,
        idealFor: finalIdeal,
        whatMakesItStandOut: finalStandOut,
        thingsToConsider: finalConsider,
        state: 'approved',
        source: link.source,
        candidateId: cand?.id,
        createdAt: new Date().toISOString()
      };
      item.draft.productDrafts.push(newProductDraft);

      // Update candidate status if present
      if (cand) {
        cand.state = 'approved';
        cand.existingCmsProduct = {
          id: finalProdSlug,
          title: finalTitle,
          vendor: finalVendor,
          price: priceStr,
          image: finalImage
        };
      }

      // Mark link status
      link.exportStatus = 'exported';
      link.exportedProductId = finalProdSlug;
      link.exportedAt = new Date().toISOString();

      // Synchronize any matching link and candidate records in the draft
      for (const otherLink of links) {
        if (otherLink.id !== link.id && (otherLink.url.toLowerCase().replace(/\/+$/, '') === normUrl || (link.legacyItemId && otherLink.legacyItemId === link.legacyItemId))) {
          otherLink.exportStatus = 'exported';
          otherLink.exportedProductId = finalProdSlug;
          otherLink.exportedAt = new Date().toISOString();
        }
      }

      for (const otherCand of (item.draft.productCandidates || [])) {
        if (otherCand.id === cand?.id || (link.legacyItemId && otherCand.legacyItemId === link.legacyItemId) || (otherCand.url && otherCand.url.toLowerCase().replace(/\/+$/, '') === normUrl)) {
          otherCand.state = 'approved';
          otherCand.existingCmsProduct = {
            id: finalProdSlug,
            title: finalTitle,
            vendor: finalVendor,
            price: priceStr,
            image: finalImage
          };
        }
      }

      created++;
      results.push({
        linkId: link.id,
        status: 'created',
        productId: finalProdSlug,
        message: `Successfully created product "${finalTitle}" in CMS.`
      });
    } catch (err: any) {
      failed++;
      link.exportStatus = 'export_failed';
      results.push({
        linkId: link.id,
        status: 'failed',
        message: err.message
      });
    }
  }

  item.draft.structuredLinks = links;
  item.draft.lastSavedAt = new Date().toISOString();
  setSessionItem(item);

  return {
    success: true,
    message: `Export completed: ${created} created, ${alreadyExisted} already existed, ${failed} failed.`,
    created,
    alreadyExisted,
    needsReview,
    failed,
    results,
    item
  };
}

/**
 * Converts approved migration draft into an actual unpublished post in site/_articles/ or site/_guides/
 * Enforces single post creation to prevent duplicates upon re-clicking.
 */
export function createPostFromDraft(itemId: string): {
  success: boolean;
  message: string;
  alreadyExisted?: boolean;
  createdPost: CreatedPostInfo;
  item: ImportFileItem;
} {
  const item = importSessionItems.get(itemId);
  if (!item) {
    throw new Error(`Import file "${itemId}" was not found.`);
  }

  if (!item.draft && item.analysis) {
    item.draft = createInitialDraft(item.analysis, item.filename);
  }

  if (!item.draft) {
    throw new Error(`Draft for import file "${itemId}" could not be created.`);
  }

  // Prevent duplicate post creation if already created
  if (item.createdPostInfo || item.draft.createdPostInfo) {
    const info = item.createdPostInfo || item.draft.createdPostInfo!;
    return {
      success: true,
      message: 'This migration has already created a post.',
      alreadyExisted: true,
      createdPost: info,
      item
    };
  }

  const draft = item.draft;
  const targetType = draft.targetType === 'guide' ? 'guide' : 'article';
  const targetDir = targetType === 'guide' ? GUIDES_DIR : ARTICLES_DIR;
  const filename = `${draft.slug || 'imported-post'}.md`;
  const filePath = path.join(targetDir, filename);

  // Build Front Matter object using canonical schema
  const frontMatter: Record<string, any> = {
    title: draft.title || 'Untitled Migration Post',
    'search-title': draft.searchTitle || draft.title || 'Untitled Migration Post',
    deck: draft.deck || '',
    'seo-description': draft.seoDescription || draft.deck?.slice(0, 160) || '',
    slug: draft.slug || normalizeSlug(draft.title),
    category: draft.category || (targetType === 'guide' ? 'History' : 'Gift Psychology'),
    author: draft.authorName || 'Clara Vance',
    readTime: draft.readTime || '5 min read',
    publishedDate: draft.publishedDate || new Date().toISOString().slice(0, 10),
    lastModifiedDate: new Date().toISOString().slice(0, 10)
  };

  if (draft.heroImageType) frontMatter.image = draft.heroImageType;
  if (draft.heroImageAlt) frontMatter.heroImageAlt = draft.heroImageAlt;
  if (draft.heroImageCaption) frontMatter.heroImageCaption = draft.heroImageCaption;
  if (draft.introQuote) frontMatter.introQuote = draft.introQuote;

  // Append custom front matter if present, excluding obsolete fields
  if (draft.customFrontMatter) {
    for (const [k, v] of Object.entries(draft.customFrontMatter)) {
      if (!OBSOLETE_LAYOUT_FIELDS.includes(k) && frontMatter[k] === undefined) {
        frontMatter[k] = v;
      }
    }
  }

  // Convert Front Matter & Body into final markdown document
  const yamlHeader = yaml.dump(frontMatter, { lineWidth: -1 });
  const fileContent = `---\n${yamlHeader}---\n\n${draft.body || ''}\n`;

  // Write file to Jekyll content folder
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(filePath, fileContent, 'utf8');

  const createdPostInfo: CreatedPostInfo = {
    postId: frontMatter.slug,
    postType: targetType,
    postPath: filePath.replace(PROJECT_ROOT + '/', ''),
    createdAt: new Date().toISOString()
  };

  item.createdPostInfo = createdPostInfo;
  item.draft.createdPostInfo = createdPostInfo;
  item.draft.status = 'approved';
  item.status = 'approved';

  item.approvalInfo = {
    approvedAt: new Date().toISOString(),
    notes: `Post created automatically from migration review draft at ${createdPostInfo.postPath}`
  };

  setSessionItem(item);

  return {
    success: true,
    message: `Post created successfully as ${targetType} at ${createdPostInfo.postPath}.`,
    createdPost: createdPostInfo,
    item
  };
}

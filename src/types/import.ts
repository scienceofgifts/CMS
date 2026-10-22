export type ImportTargetType = 'guide' | 'article' | 'page' | 'unknown';
export type ImportItemStatus = 'pending' | 'analyzing' | 'analyzed' | 'needs_review' | 'ready' | 'approved' | 'error';
export type IssueSeverity = 'error' | 'warning' | 'info';
export type FieldMappingStatus = 'migrated' | 'transformed' | 'ignored' | 'needs_review' | 'custom';
export type ImportSourceType = 'markdown' | 'url' | 'both';

// --- Live URL Extraction Types ---

export interface LivePageHeading {
  level: number;
  text: string;
}

export interface LivePageImage {
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  isHeroCandidate?: boolean;
}

export interface LivePageLink {
  href: string;
  text: string;
  isExternal?: boolean;
  isAffiliateCandidate?: boolean;
}

export interface LivePageExtractedMetadata {
  title?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogSiteName?: string;
  ogType?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  articleType?: string;
  siteName?: string;
  jsonLd?: any[];
  keywords?: string[];
}

export interface LivePageExtractedContent {
  h1?: string;
  headings: LivePageHeading[];
  deck?: string;
  leadParagraph?: string;
  markdownBody: string;
  wordCount: number;
  blockquotes: string[];
  faqItems: { question: string; answer: string }[];
  labels: string[];
  images: LivePageImage[];
  links: LivePageLink[];
}

export interface LivePageExtractedData {
  url: string;
  fetchStatus: 'idle' | 'fetching' | 'success' | 'failed';
  fetchError?: string;
  fetchedAt?: string;
  httpStatus?: number;
  contentType?: string;
  metadata: LivePageExtractedMetadata;
  content: LivePageExtractedContent;
  heroImageCandidate?: LivePageImage;
}

// --- Reconciliation Types (Markdown vs Live URL) ---

export type ReconciliationDiffStatus =
  | 'identical'
  | 'different'
  | 'missing_in_markdown'
  | 'missing_in_live'
  | 'only_markdown'
  | 'only_live';

export interface ReconciliationFieldDiff {
  field: string;
  label: string;
  markdownValue: any;
  liveUrlValue: any;
  status: ReconciliationDiffStatus;
  category: 'core' | 'seo' | 'metadata' | 'content' | 'media';
  recommendedSource?: 'markdown' | 'live' | 'merge';
  adoptedSource?: 'markdown' | 'live' | 'custom';
  currentValue?: any;
  editorialNote?: string;
}

export interface ReconciliationReport {
  hasDifferences: boolean;
  totalCompared: number;
  identicalCount: number;
  differingCount: number;
  missingInMarkdownCount: number;
  missingInLiveCount: number;
  fieldDiffs: ReconciliationFieldDiff[];
  headingDiffs?: {
    inMarkdownOnly: string[];
    inLiveOnly: string[];
    common: string[];
  };
  imageCountDiff?: {
    markdownImages: number;
    liveImages: number;
  };
}

export interface ImportIssue {
  id: string;
  severity: IssueSeverity;
  field?: string;
  title: string;
  message: string;
  suggestion?: string;
  resolved?: boolean;
  resolutionNote?: string;
  actionType?: 'set_content_type' | 'map_field' | 'ignore_field' | 'set_search_title' | 'set_seo_desc' | 'fix_slug' | 'demote_h1' | 'custom';
  actionPayload?: Record<string, any>;
}

export type ImportLinkSource = 'markdown' | 'live' | 'both';
export type ImportLinkClassification =
  | 'internal'
  | 'product'
  | 'external'
  | 'social'
  | 'media'
  | 'unknown';

export type ImportLinkStatus =
  | 'valid'
  | 'redirected'
  | 'broken'
  | 'unavailable'
  | 'needs_review';

export type ProductExportStatus =
  | 'not_exported'
  | 'exported'
  | 'already_exists'
  | 'export_failed'
  | 'needs_review';

export interface StructuredArticleLink {
  id: string; // Link ID (link identity)
  referenceId?: string; // Markdown reference label e.g. "view-on-shop-24" (link identity)
  legacyItemId?: string; // Legacy product item key e.g. "item6"
  legacyItemNumber?: number; // Numeric item ID e.g. 6
  legacyGroupLabel?: string; // Display label e.g. "Product #6"
  anchorText: string;
  url: string;
  originalUrl?: string;
  source: ImportLinkSource;
  rawMarkdown?: string;
  contextSnippet?: string;
  location?: string;
  linkType: 'inline' | 'reference' | 'autolink' | 'image_link' | 'html_a';
  titleAttribute?: string;
  classification: ImportLinkClassification;
  status: ImportLinkStatus;
  statusReason?: string;
  liveUrlAlternative?: string;
  isRemoved?: boolean;
  isProductCandidate?: boolean;
  productCandidateId?: string;
  convertedProductId?: string;
  exportStatus?: ProductExportStatus;
  exportedProductId?: string;
  exportedAt?: string;
  duplicateReason?: string;
}

export type ProductDraftState =
  | 'detected'
  | 'draft_created'
  | 'needs_review'
  | 'approved'
  | 'rejected';

export interface ProductDraftItem {
  id: string;
  title: string;
  vendorUrl: string;
  vendor?: string;
  price?: string;
  priceNumber?: number;
  priceRange?: string;
  category?: string;
  image?: string;
  imageAlt?: string;
  description?: string;
  editorialReview?: string;
  whyItMakesAGreatGift?: string;
  idealFor?: string;
  whatMakesItStandOut?: string;
  thingsToConsider?: string;
  badgeLabel?: string | null;
  recipients?: string[];
  interests?: string[];
  occasions?: string[];
  tags?: string[];
  state: ProductDraftState;
  source: ImportLinkSource;
  candidateId?: string;
  contextSnippet?: string;
  matchedExistingProductId?: string;
  isDuplicate?: boolean;
  duplicateResolution?: 'use_existing' | 'create_new' | 'ignore';
  createdAt: string;
  notes?: string;
}

export interface DetectedProductCandidate {
  id: string;
  name: string;
  url: string;
  source: ImportLinkSource;
  anchorText?: string;
  description?: string;
  contextSnippet?: string;
  image?: string;
  imageAlt?: string;
  price?: string;
  priceNumber?: number;
  vendor?: string;
  category?: string;
  confidence: 'high' | 'medium' | 'low';
  detectionReason: string;
  state: ProductDraftState;
  associatedLinkId?: string;
  legacyItemId?: string; // Legacy product item key e.g. "item6"
  legacyItemNumber?: number; // Numeric item ID e.g. 6
  legacyGroupLabel?: string; // Display label e.g. "Product #6"
  headline?: string;
  buyText?: string;
  idealFor?: string;
  whatMakesItStandOut?: string;
  thingsToConsider?: string;
  editorialReview?: string;
  existingCmsProduct?: {
    id: string;
    title: string;
    vendor?: string;
    price?: string;
    image?: string;
    category?: string;
  };
  productDraft?: ProductDraftItem;
}

export interface ExtractedProductItem {
  id: string;
  title: string;
  price?: string;
  priceNumber?: number;
  vendor?: string;
  vendorUrl?: string;
  category?: string;
  badgeLabel?: string;
  editorialReview?: string;
  contextSnippet?: string;
}

export interface FieldMappingDetail {
  oldKey: string;
  newKey: string;
  oldValue: any;
  newValue: any;
  status: 'mapped' | 'renamed' | 'normalized' | 'deprecated_mapped' | 'fallback' | 'preserved';
  note?: string;
}

export interface FieldMappingItem {
  oldKey: string;
  newKey: string; // Destination canonical key, or '(ignore)', or '(review)', or '(custom)'
  oldValue: any;
  currentValue: any;
  status: FieldMappingStatus;
  isUnknown?: boolean;
  isModified?: boolean;
  editorialNote?: string;
  legacyGroup?: string; // e.g. "Product #6"
  legacyItemId?: string; // e.g. "item6"
  legacyItemNumber?: number; // e.g. 6
  isLegacyProductField?: boolean;
  legacyFieldType?: string; // e.g. "link", "product", "headline", "source", "img", etc.
}

export interface ImportBodyStats {
  wordCount: number;
  charCount: number;
  estimatedReadTime: string;
  headings: {
    h1: number;
    h2: number;
    h3: number;
    h4Plus: number;
  };
  liquidTagsCount: number;
  rawHtmlTagsCount: number;
  markdownLinksCount: number;
}

export interface ImportSeoResolution {
  searchTitle: string;
  searchTitleSource: 'explicit' | 'fallback_to_title' | 'ai_suggested';
  searchTitleLength: number;
  seoDescription: string;
  seoDescriptionSource: 'explicit' | 'fallback_to_deck' | 'fallback_to_desc' | 'ai_suggested' | 'missing';
  seoDescriptionLength: number;
}

export interface ImportAnalysisResult {
  detectedType: ImportTargetType;
  confidence: number;
  classificationReason: string;
  rawFrontMatter: Record<string, any>;
  mappedFrontMatter: Record<string, any>;
  originalBody: string;
  cleanedBody: string;
  bodyStats: ImportBodyStats;
  seo: ImportSeoResolution;
  extractedProducts: ExtractedProductItem[];
  structuredLinks?: StructuredArticleLink[];
  productCandidates?: DetectedProductCandidate[];
  fieldMappings: FieldMappingDetail[];
  issues: ImportIssue[];
  aiAssisted: boolean;
  aiSuggestions?: {
    searchTitle?: string;
    seoDescription?: string;
    suggestedCategory?: string;
    editorialObservations?: string[];
  };
}

export interface CreatedPostInfo {
  postId: string;
  postType: ImportTargetType;
  postPath: string;
  createdAt: string;
}

export interface ImportDraft {
  targetType: ImportTargetType;
  title: string;
  searchTitle: string;
  deck: string;
  seoDescription: string;
  slug: string;
  category: string;
  authorName: string;
  authorRole: string;
  authorBio?: string;
  publishedDate: string;
  lastModifiedDate: string;
  readTime: string;
  heroImageType?: string;
  heroImageAlt?: string;
  heroImageCaption?: string;
  introQuote?: string;
  body: string; // editable markdown body
  structuredLinks?: StructuredArticleLink[];
  productCandidates?: DetectedProductCandidate[];
  productDrafts?: ProductDraftItem[];
  createdPostInfo?: CreatedPostInfo;
  fieldMappings: FieldMappingItem[];
  resolvedIssueIds: string[];
  customFrontMatter: Record<string, any>;
  status: ImportItemStatus;
  sourceType?: ImportSourceType;
  liveUrl?: string;
  lastSavedAt?: string;
}

export interface ImportFileItem {
  id: string;
  filename: string;
  fileSize: number;
  rawContent: string;
  uploadedAt: string;
  targetType: ImportTargetType;
  status: ImportItemStatus;
  sourceType: ImportSourceType;
  liveUrl?: string;
  urlFetchStatus?: 'idle' | 'fetching' | 'success' | 'failed';
  urlFetchError?: string;
  livePageData?: LivePageExtractedData | null;
  reconciliationReport?: ReconciliationReport | null;
  analysis: ImportAnalysisResult | null; // Pristine original parse and AI analysis
  draft: ImportDraft | null; // User-editable draft representation
  createdPostInfo?: CreatedPostInfo;
  approvalInfo?: {
    approvedAt: string;
    notes?: string;
  };
}

export interface ImportSampleItem {
  id: string;
  title: string;
  filename: string;
  type: ImportTargetType;
  description: string;
  sampleContent: string;
  sampleLiveUrl?: string;
}

export interface DestinationFieldOption {
  key: string;
  label: string;
  group: 'Titles & SEO' | 'Core Metadata' | 'Dates' | 'Visual Media' | 'Editorial Content' | 'Guide Structure' | 'Legacy Product Record' | 'Actions';
  description?: string;
}

export const CANONICAL_DESTINATION_FIELDS: DestinationFieldOption[] = [
  { key: 'title', label: 'title (Reader H1 Title)', group: 'Titles & SEO', description: 'Primary reader-facing display title' },
  { key: 'search-title', label: 'search-title (Search & SERP Title)', group: 'Titles & SEO', description: 'SEO title tag & OpenGraph title (under 60 chars)' },
  { key: 'deck', label: 'deck (Visible Reader Subtitle/Summary)', group: 'Titles & SEO', description: 'Reader-facing lead summary below title' },
  { key: 'seo-description', label: 'seo-description (Meta Description)', group: 'Titles & SEO', description: 'Search engine SERP snippet (120-160 chars)' },
  
  { key: 'slug', label: 'slug (URL Permalink)', group: 'Core Metadata', description: 'Kebab-case URL pathname' },
  { key: 'category', label: 'category (Taxonomy Section)', group: 'Core Metadata', description: 'Matching site/_data/collections.yml' },
  { key: 'author', label: 'author (Staff Attribution)', group: 'Core Metadata', description: 'Editorial author name & role' },
  { key: 'readTime', label: 'readTime (Reading Time)', group: 'Core Metadata', description: 'E.g. 5 min read' },
  
  { key: 'publishedDate', label: 'publishedDate (Publication Date)', group: 'Dates', description: 'YYYY-MM-DD original publication date' },
  { key: 'lastModifiedDate', label: 'lastModifiedDate (Update Timestamp)', group: 'Dates', description: 'Canonical update date (replaces deprecated updatedDate)' },
  
  { key: 'heroImageType', label: 'heroImageType / image (Lead Visual)', group: 'Visual Media', description: 'Hero artwork asset key or URL' },
  { key: 'heroImageAlt', label: 'heroImageAlt (Image Alt Text)', group: 'Visual Media', description: 'Accessible description of lead visual' },
  { key: 'heroImageCaption', label: 'heroImageCaption (Image Caption)', group: 'Visual Media', description: 'Editorial caption text' },
  
  { key: 'introQuote', label: 'introQuote (Editorial Callout Quote)', group: 'Editorial Content', description: 'Featured quotation callout block' },
  { key: 'sources', label: 'sources (Academic Citations)', group: 'Editorial Content', description: 'List of reference citations' },
  { key: 'relatedGuideSlug', label: 'relatedGuideSlug (Associated Guide)', group: 'Editorial Content', description: 'Slug of linked gift guide' },
  { key: 'relatedArticleSlugs', label: 'relatedArticleSlugs (Related Articles)', group: 'Editorial Content', description: 'Array of related article slugs' },
  
  { key: 'editorsPick', label: 'editorsPick (Guide: Primary Pick)', group: 'Guide Structure', description: 'Highlight selection for gift guide' },
  { key: 'quickPicks', label: 'quickPicks (Guide: Quick Recommendations)', group: 'Guide Structure', description: 'Top instant recommendation list' },
  { key: 'budgetSections', label: 'budgetSections (Guide: Price Tier Blocks)', group: 'Guide Structure', description: 'Under $50, Under $100, Splurge' },
  { key: 'howToPick', label: 'howToPick (Guide: Methodology Steps)', group: 'Guide Structure', description: 'Selection criteria advice' },
  { key: 'whatToAvoid', label: 'whatToAvoid (Guide: Pitfalls to Avoid)', group: 'Guide Structure', description: 'Warning guidelines' },
  
  { key: 'product-name', label: 'Product Name (itemN-product)', group: 'Legacy Product Record', description: 'Primary recommendation product name' },
  { key: 'product-headline', label: 'Product Headline (itemN-headline)', group: 'Legacy Product Record', description: 'Editorial section headline for recommendation' },
  { key: 'product-link', label: 'Product URL / Affiliate Link (itemN-link)', group: 'Legacy Product Record', description: 'Outbound merchant or affiliate destination URL' },
  { key: 'product-source', label: 'Vendor / Merchant Source (itemN-source)', group: 'Legacy Product Record', description: 'Store, marketplace, or brand name' },
  { key: 'product-img', label: 'Product Image Asset (itemN-img)', group: 'Legacy Product Record', description: 'Product photo filename or image URL' },
  { key: 'product-img-alt', label: 'Image Alt Text (itemN-img-alt)', group: 'Legacy Product Record', description: 'Accessible description for product image' },
  { key: 'product-description', label: 'Product Description (itemN-description)', group: 'Legacy Product Record', description: 'Editorial summary and feature review' },
  { key: 'product-buy-text', label: 'Purchase CTA Text (itemN-buy-text)', group: 'Legacy Product Record', description: 'Button text e.g. Buy on Amazon' },
  { key: 'product-ideal', label: 'Ideal For Audience (itemN-ideal)', group: 'Legacy Product Record', description: 'Audience and recipient recommendation notes' },
  { key: 'product-so', label: 'What Makes It Stand Out (itemN-so)', group: 'Legacy Product Record', description: 'Differentiating craftsmanship or feature details' },
  { key: 'product-tc', label: 'Things to Consider (itemN-tc)', group: 'Legacy Product Record', description: 'Caveats, sizing, or purchasing considerations' },
  { key: 'product-gg', label: 'Gift Guide Editorial Notes (itemN-gg)', group: 'Legacy Product Record', description: 'Editorial review and curation notes' },

  { key: '(ignore)', label: 'Ignore this field (Do not migrate to new CMS)', group: 'Actions', description: 'Old site layout/widget field that intentionally does not exist' },
  { key: '(review)', label: 'Needs Review (Leave unresolved)', group: 'Actions', description: 'Flag field for further editorial decision' },
  { key: '(custom)', label: 'Keep as Custom Front Matter property', group: 'Actions', description: 'Preserve in front matter under original key' }
];

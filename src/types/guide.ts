export interface GuideAuthor {
  name: string;
  role: string;
  bio: string;
}

export interface GuideIntroQuote {
  quote: string;
  author: string;
  source?: string;
}

export interface GuideHowToPickRule {
  title: string;
  explanation: string;
}

export interface GuideHowToPick {
  title: string;
  content?: string;
  rules: GuideHowToPickRule[];
}

export interface GuideWhatToAvoidItem {
  mistake?: string;
  title?: string;
  mistake_short?: string;
  explanation?: string;
  description?: string;
}

export interface GuideWhatToAvoid {
  title: string;
  content?: string;
  summary?: string;
  items: GuideWhatToAvoidItem[];
}

export interface GuideBudgetSection {
  id: string;
  title: string;
  description?: string;
  products: any[];
}

export interface GiftGuideFrontMatter {
  title: string;
  slug: string;
  deck: string;
  'search-title'?: string;
  'seo-description'?: string;
  searchTitle?: string;
  seoDescription?: string;
  category: string;
  readTime: string;
  /** Canonical publication date: YYYY-MM-DD */
  publishedDate?: string;
  /** Canonical last modification date: YYYY-MM-DD */
  lastModifiedDate?: string;
  /** @deprecated Legacy alias only used for backward-compatible reading. Do not write. */
  updatedDate?: string;
  author: GuideAuthor;
  heroImageAlt?: string;
  heroImageType?: string;
  image?: string;
  heroImageCaption?: string;
  introQuote?: GuideIntroQuote;
  editorsPick?: any;
  quickPicks?: any[];
  budgetSections?: GuideBudgetSection[];
  howToPick?: GuideHowToPick;
  whatToAvoid?: GuideWhatToAvoid;
  relatedGuideSlugs?: string[];
  [key: string]: any;
}

export interface GiftGuide {
  slug: string;
  frontMatter: GiftGuideFrontMatter;
  body: string;
  html?: string;
  stats?: {
    wordCount: number;
    charCount: number;
  };
}

export interface GuideSummary {
  slug: string;
  title: string;
  category: string;
  deck: string;
  readTime: string;
  publishedDate?: string;
  lastModifiedDate?: string;
  authorName: string;
  authorRole?: string;
  heroImage?: string;
  heroImageAlt?: string;
  productCount: number;
  budgetSectionCount: number;
  wordCount: number;
  fileMtime: string;
}

export interface GuideBackup {
  filename: string;
  timestamp: string;
  size: number;
  slug: string;
  action: string;
}

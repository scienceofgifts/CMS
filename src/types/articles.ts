export interface ArticleAuthor {
  name: string;
  role: string;
  bio?: string;
  avatarSeed?: string;
}

export interface ArticleIntroQuote {
  quote: string;
  author: string;
  source?: string;
}

export interface ArticleSource {
  id?: string;
  title: string;
  author: string;
  publication?: string;
  year?: string | number;
  url?: string;
  annotation?: string;
  [key: string]: any;
}

export interface ArticleFrontMatter {
  title: string;
  slug: string;
  deck?: string;
  'search-title'?: string;
  'seo-description'?: string;
  searchTitle?: string;
  seoDescription?: string;
  category?: string;
  readTime?: string;
  /** Canonical publication date: YYYY-MM-DD */
  publishedDate?: string;
  /** Canonical last modification date: YYYY-MM-DD */
  lastModifiedDate?: string;
  /** @deprecated Legacy alias only used for backward-compatible reading. Do not write. */
  updatedDate?: string;
  author?: ArticleAuthor;
  heroImageType?: string;
  image?: string;
  heroImageAlt?: string;
  heroImageCaption?: string;
  introQuote?: ArticleIntroQuote;
  relatedGuideSlug?: string;
  relatedArticleSlugs?: string[];
  sources?: ArticleSource[];
  tags?: string[];
  [key: string]: any; // Preserves unknown / custom front matter
}

export interface ArticleListItem {
  slug: string;
  title: string;
  category: string;
  deck: string;
  readTime: string;
  publishedDate: string;
  lastModifiedDate: string;
  authorName: string;
  authorRole: string;
  heroImage: string;
  heroImageAlt: string;
  heroImageCaption?: string;
  wordCount: number;
  sourcesCount: number;
  relatedGuideSlug?: string;
  relatedArticleCount: number;
  fileMtime: string;
}

export interface ArticleDetail {
  slug: string;
  frontMatter: ArticleFrontMatter;
  body: string;
  html: string;
  stats: {
    wordCount: number;
    charCount: number;
  };
}

export interface ArticleBackupItem {
  filename: string;
  timestamp: string;
  size: number;
  slug: string;
  action: string;
}

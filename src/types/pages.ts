export type StaticPageSlug =
  | 'about'
  | 'affiliate-disclosure'
  | 'contact'
  | 'privacy'
  | 'terms'
  | '404'
  | 'sitemap';

export interface StaticPageData {
  slug: StaticPageSlug;
  title: string;
  description: string;
  'search-title'?: string;
  'seo-description'?: string;
  searchTitle?: string;
  seoDescription?: string;
  badge?: string;
  lead?: string;
  content?: string; // Markdown body content for standard pages
  pageType?: 'standard' | 'special' | 'structured';
  robots?: any;
  // Fields for 404
  headline?: string;
  quote?: string;
  btnHome?: string;
  btnFinder?: string;
  btnGuides?: string;
  // Fields for sitemap
  cardsHtml?: string;
  rawHtml?: string;
  mtime?: string;
}

export interface StaticPageBackupItem {
  filename: string;
  slug: string;
  timestamp: string;
  action: string;
  size: number;
}

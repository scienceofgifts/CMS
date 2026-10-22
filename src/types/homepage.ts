export interface HomepageShopBanner {
  title: string;
  deck: string;
  url: string;
}

export interface HomepageNewsletter {
  title: string;
  deck: string;
  subscribers_count: string;
}

export interface HomepageFrontMatter {
  title?: string;
  description?: string;
  edition_badge?: string;
  hero_title?: string;
  hero_lead?: string;
  hero_image?: string;
  hero_image_alt?: string;
  hero_image_caption?: string;
  featured_guide_slug?: string;
  featured_article_slug?: string;
  secondary_guides_limit?: number;
  secondary_articles_limit?: number;
  shop_banner?: HomepageShopBanner;
  quote?: string;
  quote_author?: string;
  newsletter?: HomepageNewsletter;
  [key: string]: any; // Preserve unknown fields
}

export interface HomepageDocument {
  frontMatter: HomepageFrontMatter;
  body: string;
  raw?: string;
}

export interface HomepageBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

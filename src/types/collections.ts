export interface CollectionItem {
  slug: string;
  title: string;
  section: 'men' | 'women' | 'gift_guides' | 'articles' | string;
  description?: string;
  recipients?: string[];
  image?: string;
  imageAlt?: string;
  featured?: boolean;
  productIds?: string[];
  [key: string]: any; // Preserves unknown / custom fields
}

export interface CollectionCalculatedItem extends CollectionItem {
  matchingProductCount: number;
  matchingGuideCount?: number;
  matchingArticleCount?: number;
}

export interface CollectionsData {
  gift_guides?: Array<{ slug: string; title: string; [key: string]: any }>;
  articles?: Array<{ slug: string; title: string; [key: string]: any }>;
  men?: Array<{ slug: string; title: string; recipients?: string[]; [key: string]: any }>;
  women?: Array<{ slug: string; title: string; recipients?: string[]; [key: string]: any }>;
  [sectionKey: string]: any;
}

export interface TaxonomyStats {
  recipients: Array<{ tag: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  interests: Array<{ id: string; name: string; count: number; description?: string }>;
}

export interface CollectionBackupItem {
  filename: string;
  timestamp: string;
  size: number;
  action: string;
}

import { Product, TaxonomyOptions } from '../../src/types/product';
import { ArticleFrontMatter } from '../../src/types/articles';
import { GiftGuideFrontMatter } from '../../src/types/guide';
import { CollectionItem } from '../../src/types/collections';
import { InterestItem } from '../../src/types/interests';
import { AuthorItem } from '../../src/types/authors';
import { AiSettingsData } from '../../src/types/aiSettings';
import { CatalogItemRef } from '../articleAiService';

export interface ContentRepository {
  // Products
  getProducts(): Promise<{ products: Product[]; taxonomies: TaxonomyOptions }>;
  getProductById(id: string): Promise<Product | null>;
  saveProduct(productData: Product): Promise<{ success: boolean; message?: string; error?: string }>;
  updateProduct(id: string, productData: Product): Promise<{ success: boolean; message?: string; error?: string }>;
  deleteProduct(id: string): Promise<{ success: boolean; message?: string; error?: string }>;
  duplicateProduct(id: string): Promise<{ success: boolean; product?: Product; message?: string; error?: string }>;
  getProductBackups(): Promise<any[]>;
  restoreProductBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Articles
  getArticles(): Promise<any[]>;
  getArticleBySlug(slug: string): Promise<any | null>;
  saveArticle(articleData: { frontMatter: ArticleFrontMatter; body: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }>;
  updateArticle(slug: string, articleData: { frontMatter: ArticleFrontMatter; body: string; originalSlug?: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }>;
  deleteArticle(slug: string): Promise<{ success: boolean; message?: string; backupFile?: string | null; error?: string }>;
  getArticleBackups(): Promise<any[]>;
  restoreArticleBackup(backupFileName: string): Promise<{ success: boolean; message?: string; restoredSlug?: string; error?: string }>;

  // Gift Guides
  getGuides(): Promise<any[]>;
  getGuideBySlug(slug: string): Promise<any | null>;
  saveGuide(guideData: { frontMatter: GiftGuideFrontMatter; body: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }>;
  updateGuide(slug: string, guideData: { frontMatter: GiftGuideFrontMatter; body: string; originalSlug?: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }>;
  deleteGuide(slug: string): Promise<{ success: boolean; message?: string; backupFile?: string | null; error?: string }>;
  getGuideBackups(): Promise<any[]>;
  restoreGuideBackup(backupFileName: string): Promise<{ success: boolean; message?: string; restoredSlug?: string; error?: string }>;

  // Collections
  getCollections(): Promise<Record<string, CollectionItem[]>>;
  getCollectionItem(section: string, slug: string): Promise<CollectionItem | null>;
  saveCollectionItem(section: string, item: CollectionItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  updateCollectionItem(section: string, slug: string, item: CollectionItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  deleteCollectionItem(section: string, slug: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getCollectionBackups(): Promise<any[]>;
  restoreCollectionBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Taxonomies
  getTaxonomies(): Promise<TaxonomyOptions>;

  // Authors
  getAuthors(): Promise<AuthorItem[]>;
  getAuthorById(id: string): Promise<AuthorItem | null>;
  saveAuthor(author: AuthorItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  updateAuthor(id: string, author: AuthorItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  deleteAuthor(id: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getAuthorBackups(): Promise<any[]>;
  restoreAuthorBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Interests
  getInterests(): Promise<InterestItem[]>;
  getInterestById(id: string): Promise<InterestItem | null>;
  saveInterest(interest: InterestItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  updateInterest(id: string, interest: InterestItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  deleteInterest(id: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getInterestBackups(): Promise<any[]>;
  restoreInterestBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Navigation
  getNavigation(): Promise<any>;
  saveNavigation(data: any): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getNavigationBackups(): Promise<any[]>;
  restoreNavigationBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Homepage
  getHomepage(): Promise<{ frontMatter: any; body: string }>;
  saveHomepage(frontMatter: any, body: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getHomepageBackups(): Promise<any[]>;
  restoreHomepageBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Gift Finder
  getGiftFinderConfig(): Promise<any>;
  getGiftFinderHtml(): Promise<string>;
  saveGiftFinder(html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getGiftFinderBackups(): Promise<any[]>;
  restoreGiftFinderBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Static Pages
  getPages(): Promise<any[]>;
  getPageBySlug(slug: string): Promise<any | null>;
  savePage(slug: string, html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getPageBackups(): Promise<any[]>;
  restorePageBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Global Components
  getGlobalComponents(): Promise<any[]>;
  getGlobalComponentByKey(key: string): Promise<any | null>;
  saveGlobalComponent(key: string, html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getGlobalComponentBackups(): Promise<any[]>;
  restoreGlobalComponentBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Site Settings
  getSiteSettings(): Promise<{ rawYaml: string; parsed: any; mtime: string }>;
  saveSiteSettings(rawYaml: string): Promise<{ success: boolean; parsed?: any; backupFile?: string | null; error?: string }>;
  getSiteSettingsBackups(): Promise<any[]>;
  restoreSiteSettingsBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // AI Settings
  getAiSettings(): Promise<AiSettingsData>;
  saveAiSettings(settings: Partial<AiSettingsData>): Promise<AiSettingsData>;

  // Robots.txt
  getRobotsTxt(): Promise<string>;
  saveRobotsTxt(content: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }>;
  getRobotsTxtBackups(): Promise<any[]>;
  restoreRobotsTxtBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }>;

  // Assets
  getAssets(): Promise<any[]>;
  getAssetUsage(filename: string): Promise<any>;
  checkAssetExists(filename: string): Promise<boolean>;
  uploadAssetFile(file: any, options?: { customName?: string; altText?: string }): Promise<any>;
  generateAssetDerivatives(): Promise<{ success: boolean; count: number; log: string[] }>;
  deleteAsset(filename: string): Promise<{ success: boolean; message?: string; error?: string }>;
  renameAsset(oldFilename: string, newBaseName: string): Promise<{ success: boolean; oldFilename?: string; newFilename?: string; updatedReferences?: string[]; error?: string }>;

  // Diagnostics & Status
  runDiagnostics(): Promise<any>;
  getProjectStatus(): Promise<any>;

  // Internal Linking catalog helper
  getSiteCatalogForInternalLinking(): Promise<CatalogItemRef[]>;

  // Generic raw file management
  getProjectFiles(): Promise<string[]>;
  getRawFile(relativePath: string): Promise<{ content: string; path: string; mtime?: string } | null>;
  saveRawFile(relativePath: string, content: string): Promise<{ success: boolean; error?: string }>;
}

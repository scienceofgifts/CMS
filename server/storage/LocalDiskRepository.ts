import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import * as yamlModule from 'js-yaml';
const yaml: any = (yamlModule as any).default || yamlModule;
import { marked } from 'marked';
import TurndownService from 'turndown';
import sharp from 'sharp';

import { ContentRepository } from './ContentRepository';
import { Product, TaxonomyOptions } from '../../src/types/product';
import { ArticleFrontMatter } from '../../src/types/articles';
import { GiftGuideFrontMatter } from '../../src/types/guide';
import { CollectionItem } from '../../src/types/collections';
import { InterestItem as Interest } from '../../src/types/interests';
import { AuthorItem as Author } from '../../src/types/authors';
import { AiSettingsData, DEFAULT_AI_SETTINGS } from '../../src/types/aiSettings';
import { CatalogItemRef } from '../articleAiService';
import { resolveLinkReferenceToCanonicalProduct } from '../importService';

export class LocalDiskRepository implements ContentRepository {
  private projectRoot: string;
  private jekyllRoot: string;

  // Directories & Files
  private productsFile: string;
  private productsBackupsDir: string;

  private articlesDir: string;
  private articlesBackupsDir: string;

  private guidesDir: string;
  private guidesBackupsDir: string;

  private collectionsFile: string;
  private collectionsBackupsDir: string;

  private interestsFile: string;
  private interestsBackupsDir: string;

  private authorsFile: string;
  private authorsBackupsDir: string;

  private navigationFile: string;
  private navigationBackupsDir: string;

  private homepageFile: string;
  private homepageBackupsDir: string;

  private giftFinderYaml: string;
  private giftFinderFile: string;
  private giftFinderBackupsDir: string;

  private pagesBackupsDir: string;

  private globalComponentsDir: string;
  private globalComponentsBackupsDir: string;

  private configFile: string;
  private settingsBackupsDir: string;

  private aiSettingsPath: string;

  private robotsFile: string;
  private seoBackupsDir: string;

  private assetsDir: string;
  private assetsBackupsDir: string;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || path.resolve(process.cwd());
    this.jekyllRoot = process.env.JEKYLL_DIR
      ? path.resolve(this.projectRoot, process.env.JEKYLL_DIR)
      : path.join(this.projectRoot, 'site');

    this.productsFile = path.join(this.jekyllRoot, '_data', 'products.yml');
    this.productsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'products');

    this.articlesDir = path.join(this.jekyllRoot, '_articles');
    this.articlesBackupsDir = path.join(this.projectRoot, 'editor-backups', 'articles');

    this.guidesDir = path.join(this.jekyllRoot, '_guides');
    this.guidesBackupsDir = path.join(this.projectRoot, 'editor-backups', 'guides');

    this.collectionsFile = path.join(this.jekyllRoot, '_data', 'collections.yml');
    this.collectionsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'collections');

    this.interestsFile = path.join(this.jekyllRoot, '_data', 'interests.yml');
    this.interestsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'interests');

    this.authorsFile = path.join(this.jekyllRoot, '_data', 'authors.yml');
    this.authorsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'authors');

    this.navigationFile = path.join(this.jekyllRoot, '_data', 'navigation.yml');
    this.navigationBackupsDir = path.join(this.projectRoot, 'editor-backups', 'navigation');

    this.homepageFile = path.join(this.jekyllRoot, 'index.md');
    this.homepageBackupsDir = path.join(this.projectRoot, 'editor-backups', 'homepage');

    this.giftFinderYaml = path.join(this.jekyllRoot, '_data', 'gift_finder.yml');
    this.giftFinderFile = path.join(this.jekyllRoot, 'gift-finder', 'index.html');
    this.giftFinderBackupsDir = path.join(this.projectRoot, 'editor-backups', 'gift-finder');

    this.pagesBackupsDir = path.join(this.projectRoot, 'editor-backups', 'pages');

    this.globalComponentsDir = path.join(this.jekyllRoot, '_includes');
    this.globalComponentsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'global-components');

    this.configFile = path.join(this.jekyllRoot, '_config.yml');
    this.settingsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'site-settings');

    this.aiSettingsPath = path.join(this.jekyllRoot, '_data', 'ai_settings.json');

    this.robotsFile = path.join(this.jekyllRoot, 'robots.txt');
    this.seoBackupsDir = path.join(this.projectRoot, 'editor-backups', 'seo');

    this.assetsDir = path.join(this.jekyllRoot, 'assets');
    this.assetsBackupsDir = path.join(this.projectRoot, 'editor-backups', 'assets');

    this.ensureDirs();
  }

  private ensureDirs() {
    const dirs = [
      path.dirname(this.productsFile),
      this.productsBackupsDir,
      this.articlesDir,
      this.articlesBackupsDir,
      this.guidesDir,
      this.guidesBackupsDir,
      this.collectionsBackupsDir,
      this.interestsBackupsDir,
      this.authorsBackupsDir,
      this.navigationBackupsDir,
      this.homepageBackupsDir,
      this.giftFinderBackupsDir,
      this.pagesBackupsDir,
      this.globalComponentsDir,
      this.globalComponentsBackupsDir,
      this.settingsBackupsDir,
      this.seoBackupsDir,
      this.assetsDir,
      this.assetsBackupsDir,
    ];

    dirs.forEach(d => {
      try {
        if (!fs.existsSync(d)) {
          fs.mkdirSync(d, { recursive: true });
        }
      } catch (err) {
        console.warn(`[LocalDiskRepository] Could not initialize directory ${d}:`, err);
      }
    });
  }

  // =================================-------------------------------------------
  // PRODUCTS
  // =================================-------------------------------------------

  private readRawProductsData(): Product[] {
    if (!fs.existsSync(this.productsFile)) {
      return [];
    }
    const raw = fs.readFileSync(this.productsFile, 'utf8');
    const parsed = yaml.load(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as Product[];
  }

  private validateCatalogIntegrity(catalog: any[], contextLabel: string): { valid: boolean; error?: string } {
    if (!Array.isArray(catalog)) {
      return { valid: false, error: `${contextLabel} is not an array.` };
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < catalog.length; i++) {
      const item = catalog[i];
      if (!item || typeof item !== 'object') {
        return { valid: false, error: `${contextLabel} item at index ${i} is not an object.` };
      }
      if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
        return { valid: false, error: `${contextLabel} item at index ${i} is missing a valid product id.` };
      }
      const slug = item.id.trim();
      if (seenIds.has(slug)) {
        return { valid: false, error: `${contextLabel} contains duplicate product id "${slug}".` };
      }
      seenIds.add(slug);

      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
        return { valid: false, error: `${contextLabel} item "${slug}" is missing a valid title.` };
      }
    }
    return { valid: true };
  }

  private backupProductsYml(action: string, targetId: string): string | null {
    try {
      if (!fs.existsSync(this.productsFile)) return null;
      if (!fs.existsSync(this.productsBackupsDir)) {
        fs.mkdirSync(this.productsBackupsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `products_${timestamp}_${action}_${targetId.replace(/[^a-zA-Z0-9_-]/g, '_')}.yml`;
      const destPath = path.join(this.productsBackupsDir, filename);
      fs.copyFileSync(this.productsFile, destPath);

      const files = fs.readdirSync(this.productsBackupsDir).filter(f => f.endsWith('.yml')).sort();
      if (files.length > 50) {
        for (let i = 0; i < files.length - 50; i++) {
          try { fs.unlinkSync(path.join(this.productsBackupsDir, files[i])); } catch {}
        }
      }
      return filename;
    } catch (err) {
      console.error('Failed to create product backup:', err);
      return null;
    }
  }

  private executeAtomicProductWrite(params: {
    action: 'create' | 'update' | 'delete' | 'duplicate' | 'restore';
    targetId: string;
    originalId?: string;
    expectedFieldCheck?: { fieldName: string; expectedValue: any };
    updater: (currentCatalog: any[]) => any[];
  }): { success: boolean; backupFile: string | null; count: number } {
    const { action, targetId, expectedFieldCheck, updater } = params;

    if (!fs.existsSync(this.productsFile)) {
      throw new Error(`Catalog file does not exist at ${this.productsFile}`);
    }
    const currentRaw = fs.readFileSync(this.productsFile, 'utf8');

    let currentProducts: any[];
    try {
      currentProducts = yaml.load(currentRaw) as any[];
    } catch (err: any) {
      throw new Error(`Pre-write validation failed: products.yml is malformed YAML: ${err.message}`);
    }

    const preValidation = this.validateCatalogIntegrity(currentProducts, 'Pre-write catalog');
    if (!preValidation.valid) {
      throw new Error(`Pre-write validation failed: ${preValidation.error}`);
    }

    const backupFile = this.backupProductsYml(action, targetId);
    if (!backupFile) {
      throw new Error('Pre-write backup failed: unable to write snapshot to editor-backups/products/');
    }

    const updatedProducts = updater(currentProducts);
    const inMemoryValidation = this.validateCatalogIntegrity(updatedProducts, 'In-memory modified catalog');
    if (!inMemoryValidation.valid) {
      throw new Error(`In-memory modification validation failed: ${inMemoryValidation.error}`);
    }

    const dumpedYaml = yaml.dump(updatedProducts, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });
    const formattedYaml = dumpedYaml.replace(/\n- id:/g, '\n\n- id:');

    let inMemoryParsed: any[];
    try {
      inMemoryParsed = yaml.load(formattedYaml) as any[];
    } catch (err: any) {
      throw new Error(`In-memory serialized YAML parsing failed: ${err.message}`);
    }

    const serializedValidation = this.validateCatalogIntegrity(inMemoryParsed, 'Serialized in-memory catalog');
    if (!serializedValidation.valid) {
      throw new Error(`Serialized YAML integrity check failed: ${serializedValidation.error}`);
    }
    if (inMemoryParsed.length !== updatedProducts.length) {
      throw new Error(`Serialized product count mismatch (expected ${updatedProducts.length}, got ${inMemoryParsed.length}).`);
    }

    const tempFileName = `.products.yml.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    const tempFilePath = path.join(path.dirname(this.productsFile), tempFileName);

    try {
      fs.writeFileSync(tempFilePath, formattedYaml, 'utf8');

      if (!fs.existsSync(tempFilePath)) {
        throw new Error('Temporary file write verification failed: file does not exist.');
      }
      const tempRaw = fs.readFileSync(tempFilePath, 'utf8');
      const tempParsed = yaml.load(tempRaw) as any[];
      const tempValidation = this.validateCatalogIntegrity(tempParsed, 'Temporary file catalog');
      if (!tempValidation.valid) {
        throw new Error(`Temporary file integrity check failed: ${tempValidation.error}`);
      }
      if (tempParsed.length !== updatedProducts.length) {
        throw new Error(`Temporary file item count mismatch (expected ${updatedProducts.length}, got ${tempParsed.length}).`);
      }

      fs.renameSync(tempFilePath, this.productsFile);

      const postRaw = fs.readFileSync(this.productsFile, 'utf8');
      let postParsed: any[];
      try {
        postParsed = yaml.load(postRaw) as any[];
      } catch (err: any) {
        throw new Error(`Post-write disk read parse failed: ${err.message}`);
      }

      const postValidation = this.validateCatalogIntegrity(postParsed, 'Post-write catalog');
      if (!postValidation.valid) {
        throw new Error(`Post-write integrity check failed: ${postValidation.error}`);
      }

      let expectedCount = currentProducts.length;
      if (action === 'create' || action === 'duplicate') expectedCount = currentProducts.length + 1;
      else if (action === 'delete') expectedCount = currentProducts.length - 1;
      else if (action === 'update') expectedCount = currentProducts.length;
      else if (action === 'restore') expectedCount = updatedProducts.length;

      if (postParsed.length !== expectedCount) {
        throw new Error(`Post-write product count mismatch: expected ${expectedCount}, found ${postParsed.length}.`);
      }

      if (action === 'create' || action === 'update' || action === 'duplicate') {
        const targetInDisk = postParsed.find(p => p.id === targetId);
        if (!targetInDisk) {
          throw new Error(`Post-write validation failed: target product "${targetId}" not found in written catalog.`);
        }
        const targetMatches = postParsed.filter(p => p.id === targetId);
        if (targetMatches.length !== 1) {
          throw new Error(`Post-write validation failed: expected exactly 1 product with ID "${targetId}", found ${targetMatches.length}.`);
        }
        if (expectedFieldCheck) {
          const actualValue = targetInDisk[expectedFieldCheck.fieldName];
          if (JSON.stringify(actualValue) !== JSON.stringify(expectedFieldCheck.expectedValue)) {
            throw new Error(`Post-write field verification failed for "${expectedFieldCheck.fieldName}": expected ${JSON.stringify(expectedFieldCheck.expectedValue)}, got ${JSON.stringify(actualValue)}.`);
          }
        }
      } else if (action === 'delete') {
        const targetInDisk = postParsed.find(p => p.id === targetId);
        if (targetInDisk) {
          throw new Error(`Post-write validation failed: deleted product "${targetId}" still exists in written catalog.`);
        }
      }

      if (action !== 'restore') {
        const idToExclude = (action === 'update' && params.originalId) ? params.originalId : targetId;
        const originalOtherIds = currentProducts
          .filter(p => p.id !== idToExclude)
          .map(p => p.id);
        const postIdsSet = new Set(postParsed.map(p => p.id));
        for (const otherId of originalOtherIds) {
          if (!postIdsSet.has(otherId)) {
            throw new Error(`Post-write validation failed: unrelated product "${otherId}" is missing from written catalog.`);
          }
        }
        if (action === 'update' && params.originalId && params.originalId !== targetId) {
          if (postIdsSet.has(params.originalId)) {
            throw new Error(`Post-write validation failed: original product ID "${params.originalId}" still exists after rename to "${targetId}".`);
          }
        }
      }

      return {
        success: true,
        backupFile,
        count: postParsed.length
      };
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }
  }

  private validateProductData(
    product: any,
    isNew: boolean,
    currentId?: string,
    existingProducts: any[] = []
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!product.id || typeof product.id !== 'string' || !product.id.trim()) {
      errors.push('Product ID is required.');
    } else {
      const slug = product.id.trim();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        errors.push('Product ID must be lowercase letters, numbers, and hyphens only (e.g., brass-book-weight).');
      }
      const duplicate = existingProducts.find(p => p.id === slug && (!isNew ? p.id !== currentId : true));
      if (duplicate) {
        errors.push(`Product ID "${slug}" is already in use by another product.`);
      }
    }

    if (!product.title || typeof product.title !== 'string' || !product.title.trim()) {
      errors.push('Product title is required.');
    }

    if (!product.vendor || typeof product.vendor !== 'string' || !product.vendor.trim()) {
      errors.push('Vendor name is required.');
    }

    if (product.priceNumber === undefined || product.priceNumber === null || isNaN(Number(product.priceNumber))) {
      errors.push('Price number is required and must be a valid number.');
    } else if (Number(product.priceNumber) <= 0) {
      errors.push('Price number must be greater than zero.');
    }

    if (!product.category || typeof product.category !== 'string' || !product.category.trim()) {
      errors.push('Category is required.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public async getProducts(): Promise<{ products: Product[]; taxonomies: TaxonomyOptions }> {
    const products = this.readRawProductsData();
    const taxonomies = await this.getTaxonomies();
    return { products, taxonomies };
  }

  public async getProductById(id: string): Promise<Product | null> {
    const products = this.readRawProductsData();
    let found = products.find(p => p.id === id);
    if (!found) {
      const normQuery = (id || '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      found = products.find(p =>
        (p.id && p.id.toLowerCase() === normQuery) ||
        (p.slug && p.slug.toLowerCase() === normQuery) ||
        (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normQuery) ||
        (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normQuery}`) || p.vendorUrl.toLowerCase().includes(`/${normQuery}`)))
      );
    }
    // If not found by direct fields, check if id is a link reference (e.g. view-on-shop-24) resolving to a product
    if (!found) {
      found = resolveLinkReferenceToCanonicalProduct(id, products);
    }
    return found || null;
  }

  public async saveProduct(productData: Product): Promise<{ success: boolean; message?: string; error?: string }> {
    const products = this.readRawProductsData();
    const validation = this.validateProductData(productData, true, undefined, products);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    const numPrice = Number(productData.priceNumber);
    const formattedPrice = productData.price && productData.price.startsWith('$')
      ? productData.price
      : `$${numPrice}`;

    let priceRange = productData.priceRange;
    if (!priceRange) {
      if (numPrice < 25) priceRange = 'under-25';
      else if (numPrice <= 50) priceRange = '25-50';
      else if (numPrice <= 100) priceRange = '50-100';
      else priceRange = '100-plus';
    }

    let cleanedSpecs: any[] | undefined = undefined;
    if (Array.isArray(productData.specs) && productData.specs.length > 0) {
      const validSpecs = productData.specs
        .filter((s: any) => s && (s.label?.trim() || s.value?.trim()))
        .map((s: any) => ({
          label: (s.label || '').trim(),
          value: (s.value || '').trim()
        }));
      if (validSpecs.length > 0) cleanedSpecs = validSpecs;
    }

    const newProduct: Product = {
      id: productData.id.trim(),
      title: productData.title.trim(),
      image: (productData.image || productData.id.trim()).trim(),
      imageType: (productData.imageType || productData.id.trim()).trim(),
      price: formattedPrice,
      priceNumber: numPrice,
      priceRange,
      vendor: productData.vendor.trim(),
      vendorUrl: (productData.vendorUrl || '').trim(),
      affiliate: {
        sponsored: productData.affiliate?.sponsored ?? true,
        rel: productData.affiliate?.rel || 'noopener noreferrer sponsored'
      },
      category: productData.category.trim(),
      badgeLabel: productData.badgeLabel || null,
      recipients: Array.isArray(productData.recipients) ? productData.recipients : [],
      interests: Array.isArray(productData.interests) ? productData.interests : [],
      occasions: Array.isArray(productData.occasions) ? productData.occasions : [],
      ageRanges: Array.isArray(productData.ageRanges) ? productData.ageRanges : [],
      personalityStyles: Array.isArray(productData.personalityStyles) ? productData.personalityStyles : [],
      tags: Array.isArray(productData.tags) ? productData.tags : [],
      editorialReview: (productData.editorialReview || '').trim(),
      whyItMakesAGreatGift: (productData.whyItMakesAGreatGift || '').trim(),
      idealFor: (productData.idealFor || '').trim(),
      whatMakesItStandOut: (productData.whatMakesItStandOut || '').trim(),
      thingsToConsider: (productData.thingsToConsider || '').trim(),
      specs: cleanedSpecs
    };

    const atomicResult = this.executeAtomicProductWrite({
      action: 'create',
      targetId: newProduct.id,
      expectedFieldCheck: { fieldName: 'title', expectedValue: newProduct.title },
      updater: (catalog) => [...catalog, newProduct]
    });

    return {
      success: true,
      message: `Product "${newProduct.title}" created successfully in _data/products.yml (Snapshot backup: ${atomicResult.backupFile}).`
    };
  }

  public async updateProduct(id: string, productData: Product): Promise<{ success: boolean; message?: string; error?: string }> {
    const products = this.readRawProductsData();
    let existingIndex = products.findIndex(p => p.id === id);
    if (existingIndex === -1) {
      const normQuery = (id || '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      existingIndex = products.findIndex(p =>
        (p.id && p.id.toLowerCase() === normQuery) ||
        (p.slug && p.slug.toLowerCase() === normQuery) ||
        (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normQuery) ||
        (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normQuery}`) || p.vendorUrl.toLowerCase().includes(`/${normQuery}`))) ||
        (p.vendorUrl && productData?.vendorUrl && p.vendorUrl.toLowerCase().replace(/\/+$/, '') === String(productData.vendorUrl).toLowerCase().replace(/\/+$/, ''))
      );
    }
    if (existingIndex === -1) {
      const resolved = resolveLinkReferenceToCanonicalProduct(id, products);
      if (resolved) {
        existingIndex = products.findIndex(p => p.id === resolved.id);
      }
    }
    if (existingIndex === -1) {
      return { success: false, error: `Product with ID "${id}" not found.` };
    }

    const existingItem = products[existingIndex];
    const resolvedOriginalId = existingItem.id;

    const validation = this.validateProductData(productData, false, resolvedOriginalId, products);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(' ') };
    }

    const targetId = productData.id.trim();
    const numPrice = Number(productData.priceNumber);
    const formattedPrice = productData.price && productData.price.startsWith('$')
      ? productData.price
      : `$${numPrice}`;

    let priceRange = productData.priceRange;
    if (!priceRange) {
      if (numPrice < 25) priceRange = 'under-25';
      else if (numPrice <= 50) priceRange = '25-50';
      else if (numPrice <= 100) priceRange = '50-100';
      else priceRange = '100-plus';
    }

    let cleanedSpecs: any[] | undefined = undefined;
    if (Array.isArray(productData.specs) && productData.specs.length > 0) {
      const validSpecs = productData.specs
        .filter((s: any) => s && (s.label?.trim() || s.value?.trim()))
        .map((s: any) => ({
          label: (s.label || '').trim(),
          value: (s.value || '').trim()
        }));
      if (validSpecs.length > 0) cleanedSpecs = validSpecs;
    }

    const updatedProduct: Product = {
      ...existingItem,
      id: targetId,
      title: productData.title !== undefined ? String(productData.title).trim() : existingItem.title,
      image: (productData.image !== undefined && String(productData.image).trim() !== '')
        ? String(productData.image).trim()
        : (existingItem.image || targetId).trim(),
      imageType: (productData.imageType !== undefined && String(productData.imageType).trim() !== '')
        ? String(productData.imageType).trim()
        : (existingItem.imageType || productData.image || targetId).trim(),
      price: formattedPrice,
      priceNumber: numPrice,
      priceRange,
      vendor: productData.vendor !== undefined ? String(productData.vendor).trim() : existingItem.vendor,
      vendorUrl: productData.vendorUrl !== undefined ? String(productData.vendorUrl).trim() : (existingItem.vendorUrl || ''),
      affiliate: {
        sponsored: productData.affiliate?.sponsored ?? existingItem.affiliate?.sponsored ?? true,
        rel: productData.affiliate?.rel || existingItem.affiliate?.rel || 'noopener noreferrer sponsored'
      },
      category: productData.category.trim(),
      badgeLabel: productData.badgeLabel || null,
      recipients: Array.isArray(productData.recipients) ? productData.recipients : (existingItem.recipients || []),
      interests: Array.isArray(productData.interests) ? productData.interests : (existingItem.interests || []),
      occasions: Array.isArray(productData.occasions) ? productData.occasions : (existingItem.occasions || []),
      ageRanges: Array.isArray(productData.ageRanges) ? productData.ageRanges : (existingItem.ageRanges || []),
      personalityStyles: Array.isArray(productData.personalityStyles) ? productData.personalityStyles : (existingItem.personalityStyles || []),
      tags: Array.isArray(productData.tags) ? productData.tags : (existingItem.tags || []),
      editorialReview: productData.editorialReview !== undefined ? String(productData.editorialReview).trim() : (existingItem.editorialReview || ''),
      whyItMakesAGreatGift: productData.whyItMakesAGreatGift !== undefined ? String(productData.whyItMakesAGreatGift).trim() : (existingItem.whyItMakesAGreatGift || ''),
      idealFor: productData.idealFor !== undefined ? String(productData.idealFor).trim() : (existingItem.idealFor || ''),
      whatMakesItStandOut: productData.whatMakesItStandOut !== undefined ? String(productData.whatMakesItStandOut).trim() : (existingItem.whatMakesItStandOut || ''),
      thingsToConsider: productData.thingsToConsider !== undefined ? String(productData.thingsToConsider).trim() : (existingItem.thingsToConsider || ''),
      specs: cleanedSpecs
    };

    const atomicResult = this.executeAtomicProductWrite({
      action: 'update',
      targetId: targetId,
      originalId: resolvedOriginalId,
      expectedFieldCheck: { fieldName: 'title', expectedValue: updatedProduct.title },
      updater: (catalog) => {
        const next = [...catalog];
        let idx = next.findIndex(p => p.id === resolvedOriginalId);
        if (idx === -1 && resolvedOriginalId !== id) {
          idx = next.findIndex(p => p.id === id);
        }
        if (idx !== -1) {
          next[idx] = updatedProduct;
        } else {
          throw new Error(`Product with ID "${resolvedOriginalId}" not found during write update.`);
        }
        return next;
      }
    });

    return {
      success: true,
      message: `Product "${updatedProduct.title}" updated successfully in _data/products.yml (Snapshot backup: ${atomicResult.backupFile}).`
    };
  }

  public async deleteProduct(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const products = this.readRawProductsData();
    const existing = products.find(p => p.id === id);
    if (!existing) {
      return { success: false, error: `Product with ID "${id}" not found.` };
    }

    const atomicResult = this.executeAtomicProductWrite({
      action: 'delete',
      targetId: id,
      updater: (catalog) => catalog.filter(p => p.id !== id)
    });

    return {
      success: true,
      message: `Product "${existing.title || id}" deleted successfully from _data/products.yml (Snapshot backup: ${atomicResult.backupFile}).`
    };
  }

  public async duplicateProduct(id: string): Promise<{ success: boolean; product?: Product; message?: string; error?: string }> {
    const products = this.readRawProductsData();
    const source = products.find(p => p.id === id);
    if (!source) {
      return { success: false, error: `Source product with ID "${id}" not found.` };
    }

    let newId = `${id}-copy`;
    let counter = 1;
    while (products.some(p => p.id === newId)) {
      counter++;
      newId = `${id}-copy-${counter}`;
    }

    const duplicatedProduct: Product = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      title: `${source.title} (Copy)`,
      image: source.image || newId,
      imageType: source.imageType || newId
    };

    const atomicResult = this.executeAtomicProductWrite({
      action: 'duplicate',
      targetId: newId,
      expectedFieldCheck: { fieldName: 'id', expectedValue: newId },
      updater: (catalog) => [...catalog, duplicatedProduct]
    });

    return {
      success: true,
      product: duplicatedProduct,
      message: `Product duplicated as "${duplicatedProduct.title}" (${newId}) in _data/products.yml (Snapshot backup: ${atomicResult.backupFile}).`
    };
  }

  public async getProductBackups(): Promise<any[]> {
    if (!fs.existsSync(this.productsBackupsDir)) {
      return [];
    }
    const files = fs.readdirSync(this.productsBackupsDir)
      .filter(f => f.endsWith('.yml'))
      .sort((a, b) => b.localeCompare(a));

    return files.map(filename => {
      const fullPath = path.join(this.productsBackupsDir, filename);
      const stats = fs.statSync(fullPath);
      const match = filename.match(/^products_([^_]+)_(create|update|delete|duplicate|restore)_?(.*)\.yml$/);
      return {
        filename,
        timestamp: match ? match[1].replace(/-/g, ':') : stats.mtime.toISOString(),
        size: stats.size,
        action: match ? match[2] : 'snapshot',
        targetId: match ? match[3] : ''
      };
    });
  }

  public async restoreProductBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!backupFileName || typeof backupFileName !== 'string') {
      return { success: false, error: 'Backup filename is required.' };
    }
    const safeName = path.basename(backupFileName);
    const backupPath = path.join(this.productsBackupsDir, safeName);
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: `Backup file "${safeName}" not found.` };
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const restoredCatalog = yaml.load(rawBackup) as any[];

    const validation = this.validateCatalogIntegrity(restoredCatalog, 'Backup snapshot');
    if (!validation.valid) {
      return { success: false, error: `Backup file contains invalid catalog structure: ${validation.error}` };
    }

    this.executeAtomicProductWrite({
      action: 'restore',
      targetId: 'all',
      updater: () => restoredCatalog
    });

    return {
      success: true,
      message: `Successfully restored products.yml from snapshot "${safeName}" (${restoredCatalog.length} products restored).`
    };
  }

  // =================================-------------------------------------------
  // ARTICLES
  // =================================-------------------------------------------

  private backupArticleFile(slug: string, action: string): string | null {
    try {
      const filePath = path.join(this.articlesDir, `${slug}.md`);
      if (!fs.existsSync(filePath)) return null;
      if (!fs.existsSync(this.articlesBackupsDir)) {
        fs.mkdirSync(this.articlesBackupsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `article_${safeSlug}_${timestamp}_${action}.md`;
      const destPath = path.join(this.articlesBackupsDir, filename);
      fs.copyFileSync(filePath, destPath);

      const files = fs.readdirSync(this.articlesBackupsDir).filter(f => f.endsWith('.md')).sort();
      if (files.length > 50) {
        for (let i = 0; i < files.length - 50; i++) {
          try { fs.unlinkSync(path.join(this.articlesBackupsDir, files[i])); } catch {}
        }
      }
      return filename;
    } catch (err) {
      console.error('Failed to create article backup:', err);
      return null;
    }
  }

  private parseArticleFile(slug: string): { frontMatter: any; body: string; raw: string } | null {
    const filePath = path.join(this.articlesDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      throw new Error(`Article file "${slug}.md" does not contain valid YAML front matter delimiters (---).`);
    }
    const frontMatter = yaml.load(match[1]);
    const body = (match[2] || '').trim();
    return { frontMatter, body, raw };
  }

  private serializeArticleDocument(frontMatter: any, body: string): string {
    const cleanFrontMatter = { ...frontMatter };
    delete cleanFrontMatter.updatedDate;

    let dumpedYaml = yaml.dump(cleanFrontMatter, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });

    dumpedYaml = dumpedYaml.replace(/^(publishedDate|lastModifiedDate):\s*(?:['"]?(\d{4}-\d{2}-\d{2})['"]?)$/gm, '$1: "$2"');

    const cleanBody = (body || '').trim();
    return `---\n${dumpedYaml}---\n${cleanBody ? cleanBody + '\n' : ''}`;
  }

  private validateArticleFrontMatter(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Front matter must be a valid object.' };
    }
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      return { valid: false, error: 'Article title is required.' };
    }
    if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
      return { valid: false, error: 'Article slug is required.' };
    }
    const slug = data.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { valid: false, error: 'Article slug must be lowercase alphanumeric with hyphens only (e.g., psychology-of-regifting).' };
    }
    if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
      return { valid: false, error: 'Article category is required.' };
    }
    if (!data.author || typeof data.author !== 'object' || !data.author.name) {
      return { valid: false, error: 'Article author object with author name is required.' };
    }
    return { valid: true };
  }

  private executeAtomicArticleWrite(params: {
    slug: string;
    originalSlug?: string;
    action: 'create' | 'update' | 'restore';
    frontMatter: any;
    body: string;
  }): { success: boolean; backupFile: string | null } {
    const { slug, originalSlug, action, frontMatter, body } = params;
    const targetSlug = slug.trim();
    const sourceSlug = (originalSlug || targetSlug).trim();

    const targetFilePath = path.join(this.articlesDir, `${targetSlug}.md`);
    const sourceFilePath = path.join(this.articlesDir, `${sourceSlug}.md`);

    if (action === 'update' || action === 'restore') {
      if (!fs.existsSync(sourceFilePath)) {
        throw new Error(`Article file "${sourceSlug}.md" does not exist.`);
      }
    } else if (action === 'create') {
      if (fs.existsSync(targetFilePath)) {
        throw new Error(`An article with slug "${targetSlug}" already exists.`);
      }
    }

    let backupFile: string | null = null;
    if (fs.existsSync(sourceFilePath)) {
      backupFile = this.backupArticleFile(sourceSlug, action);
      if (!backupFile) {
        throw new Error(`Failed to create pre-write backup for article "${sourceSlug}".`);
      }
    }

    const val = this.validateArticleFrontMatter(frontMatter);
    if (!val.valid) {
      throw new Error(val.error);
    }

    const serialized = this.serializeArticleDocument(frontMatter, body);

    const inMemoryMatch = serialized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!inMemoryMatch) {
      throw new Error('Serialized article document failed front-matter delimiter check.');
    }
    const inMemoryParsed = yaml.load(inMemoryMatch[1]);
    const inMemoryVal = this.validateArticleFrontMatter(inMemoryParsed);
    if (!inMemoryVal.valid) {
      throw new Error('Serialized front matter failed validation: ' + inMemoryVal.error);
    }

    const tempFileName = `.${targetSlug}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.md`;
    const tempFilePath = path.join(this.articlesDir, tempFileName);

    try {
      fs.writeFileSync(tempFilePath, serialized, 'utf8');

      if (!fs.existsSync(tempFilePath)) {
        throw new Error('Temporary file was not written to disk.');
      }
      const tempRaw = fs.readFileSync(tempFilePath, 'utf8');
      const tempMatch = tempRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!tempMatch) {
        throw new Error('Temporary file failed delimiter check.');
      }
      const tempParsed = yaml.load(tempMatch[1]);
      if (!tempParsed || tempParsed.title !== frontMatter.title) {
        throw new Error('Temporary file verification failed: title mismatch.');
      }

      fs.renameSync(tempFilePath, targetFilePath);

      if (sourceSlug !== targetSlug && fs.existsSync(sourceFilePath)) {
        try { fs.unlinkSync(sourceFilePath); } catch (e) { console.warn('Could not remove old article file after rename:', e); }
      }

      const postRaw = fs.readFileSync(targetFilePath, 'utf8');
      const postMatch = postRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!postMatch) {
        throw new Error('Post-write file check failed.');
      }

      return { success: true, backupFile };
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }
  }

  public async getArticles(): Promise<any[]> {
    if (!fs.existsSync(this.articlesDir)) {
      return [];
    }
    const files = fs.readdirSync(this.articlesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    const list: any[] = [];

    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      try {
        const parsed = this.parseArticleFile(slug);
        if (!parsed) continue;
        const fm = parsed.frontMatter;
        const stats = fs.statSync(path.join(this.articlesDir, file));

        const words = parsed.body.trim() ? parsed.body.trim().split(/\s+/).length : 0;
        const readTimeMinutes = Math.max(1, Math.ceil(words / 200));

        list.push({
          slug,
          title: fm.title || slug,
          category: fm.category || 'Uncategorized',
          deck: fm.deck || '',
          readTime: fm.readTime || `${readTimeMinutes} min read`,
          publishedDate: fm.publishedDate || fm.updatedDate || '',
          lastModifiedDate: fm.lastModifiedDate || fm.publishedDate || fm.updatedDate || '',
          authorName: fm.author?.name || 'Science of Gifts Staff',
          authorRole: fm.author?.role || 'Editorial Team',
          heroImage: fm.image || '',
          heroImageAlt: fm.heroImageAlt || '',
          heroImageCaption: fm.heroImageCaption || '',
          wordCount: words,
          sourcesCount: Array.isArray(fm.sources) ? fm.sources.length : 0,
          relatedGuideSlug: fm.relatedGuideSlug || '',
          relatedArticleCount: Array.isArray(fm.relatedArticleSlugs) ? fm.relatedArticleSlugs.length : 0,
          fileMtime: stats.mtime.toISOString()
        });
      } catch (e) {
        console.warn(`Could not parse article ${file}:`, e);
      }
    }

    return list.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  }

  public async getArticleBySlug(slug: string): Promise<any | null> {
    try {
      const parsed = this.parseArticleFile(slug);
      if (!parsed) return null;
      const html = await marked.parse(parsed.body);
      const words = parsed.body.trim() ? parsed.body.trim().split(/\s+/).length : 0;

      return {
        slug,
        frontMatter: parsed.frontMatter,
        body: parsed.body,
        html,
        stats: {
          wordCount: words,
          charCount: parsed.body.length
        }
      };
    } catch {
      return null;
    }
  }

  public async saveArticle(articleData: { frontMatter: ArticleFrontMatter; body: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }> {
    const { frontMatter, body } = articleData;
    const slug = (frontMatter.slug || '').trim();

    try {
      const result = this.executeAtomicArticleWrite({
        slug,
        action: 'create',
        frontMatter,
        body
      });
      return { success: true, slug, backupFile: result.backupFile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async updateArticle(slug: string, articleData: { frontMatter: ArticleFrontMatter; body: string; originalSlug?: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }> {
    const { frontMatter, body, originalSlug } = articleData;
    const targetSlug = (frontMatter.slug || slug).trim();

    try {
      const result = this.executeAtomicArticleWrite({
        slug: targetSlug,
        originalSlug: originalSlug || slug,
        action: 'update',
        frontMatter,
        body
      });
      return { success: true, slug: targetSlug, backupFile: result.backupFile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async deleteArticle(slug: string): Promise<{ success: boolean; message?: string; backupFile?: string | null; error?: string }> {
    const filePath = path.join(this.articlesDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Article file "${slug}.md" not found.` };
    }

    const backupFile = this.backupArticleFile(slug, 'delete');
    fs.unlinkSync(filePath);

    return {
      success: true,
      message: `Article "${slug}" deleted successfully.`,
      backupFile
    };
  }

  public async getArticleBackups(): Promise<any[]> {
    if (!fs.existsSync(this.articlesBackupsDir)) {
      return [];
    }
    const files = fs.readdirSync(this.articlesBackupsDir).filter(f => f.endsWith('.md')).sort().reverse();
    return files.map(filename => {
      const fullPath = path.join(this.articlesBackupsDir, filename);
      const stats = fs.statSync(fullPath);
      const match = filename.match(/^article_(.+?)_(\d{4}-\d{2}-\d{2}T[^_]+)_(create|update|delete|restore)\.md$/);
      return {
        filename,
        timestamp: match ? match[2].replace(/-/g, ':') : stats.mtime.toISOString(),
        size: stats.size,
        slug: match ? match[1] : '',
        action: match ? match[3] : 'snapshot'
      };
    });
  }

  public async restoreArticleBackup(backupFileName: string): Promise<{ success: boolean; message?: string; restoredSlug?: string; error?: string }> {
    if (!backupFileName || typeof backupFileName !== 'string') {
      return { success: false, error: 'Backup filename is required.' };
    }
    const safeName = path.basename(backupFileName);
    const backupPath = path.join(this.articlesBackupsDir, safeName);
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: `Article backup file "${safeName}" not found.` };
    }

    const raw = fs.readFileSync(backupPath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { success: false, error: 'Backup file does not contain valid YAML front matter.' };
    }

    const frontMatter = yaml.load(match[1]) as any;
    const body = (match[2] || '').trim();
    if (!frontMatter || !frontMatter.slug) {
      return { success: false, error: 'Backup file front matter is missing article slug.' };
    }

    const slug = frontMatter.slug.trim();
    this.executeAtomicArticleWrite({
      slug,
      action: 'restore',
      frontMatter,
      body
    });

    return {
      success: true,
      restoredSlug: slug,
      message: `Successfully restored article "${slug}" from snapshot "${safeName}".`
    };
  }

  // =================================-------------------------------------------
  // GIFT GUIDES
  // =================================-------------------------------------------

  private backupGuideFile(slug: string, action: string): string | null {
    try {
      const filePath = path.join(this.guidesDir, `${slug}.md`);
      if (!fs.existsSync(filePath)) return null;
      if (!fs.existsSync(this.guidesBackupsDir)) {
        fs.mkdirSync(this.guidesBackupsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `guide_${safeSlug}_${timestamp}_${action}.md`;
      const destPath = path.join(this.guidesBackupsDir, filename);
      fs.copyFileSync(filePath, destPath);

      const files = fs.readdirSync(this.guidesBackupsDir).filter(f => f.endsWith('.md')).sort();
      if (files.length > 50) {
        for (let i = 0; i < files.length - 50; i++) {
          try { fs.unlinkSync(path.join(this.guidesBackupsDir, files[i])); } catch {}
        }
      }
      return filename;
    } catch (err) {
      console.error('Failed to create guide backup:', err);
      return null;
    }
  }

  private parseGuideFile(slug: string): { frontMatter: any; body: string; raw: string } | null {
    const filePath = path.join(this.guidesDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      throw new Error(`Guide file "${slug}.md" does not contain valid YAML front matter delimiters (---).`);
    }
    const frontMatter = yaml.load(match[1]);
    const body = (match[2] || '').trim();
    return { frontMatter, body, raw };
  }

  private serializeGuideDocument(frontMatter: any, body: string): string {
    const cleanFrontMatter = { ...frontMatter };
    delete cleanFrontMatter.updatedDate;

    let dumpedYaml = yaml.dump(cleanFrontMatter, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"',
      forceQuotes: false
    });

    dumpedYaml = dumpedYaml.replace(/^(publishedDate|lastModifiedDate):\s*(?:['"]?(\d{4}-\d{2}-\d{2})['"]?)$/gm, '$1: "$2"');

    const cleanBody = (body || '').trim();
    return `---\n${dumpedYaml}---\n${cleanBody ? cleanBody + '\n' : ''}`;
  }

  private validateGuideFrontMatter(data: any): { valid: boolean; error?: string } {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Front matter must be a valid object.' };
    }
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      return { valid: false, error: 'Guide title is required.' };
    }
    if (!data.slug || typeof data.slug !== 'string' || !data.slug.trim()) {
      return { valid: false, error: 'Guide slug is required.' };
    }
    const slug = data.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return { valid: false, error: 'Guide slug must be lowercase alphanumeric with hyphens only.' };
    }
    if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
      return { valid: false, error: 'Guide category is required.' };
    }
    return { valid: true };
  }

  private executeAtomicGuideWrite(params: {
    slug: string;
    originalSlug?: string;
    action: 'create' | 'update' | 'restore';
    frontMatter: any;
    body: string;
  }): { success: boolean; backupFile: string | null } {
    const { slug, originalSlug, action, frontMatter, body } = params;
    const targetSlug = slug.trim();
    const sourceSlug = (originalSlug || targetSlug).trim();

    const targetFilePath = path.join(this.guidesDir, `${targetSlug}.md`);
    const sourceFilePath = path.join(this.guidesDir, `${sourceSlug}.md`);

    if (action === 'update' || action === 'restore') {
      if (!fs.existsSync(sourceFilePath)) {
        throw new Error(`Guide file "${sourceSlug}.md" does not exist.`);
      }
    } else if (action === 'create') {
      if (fs.existsSync(targetFilePath)) {
        throw new Error(`A guide with slug "${targetSlug}" already exists.`);
      }
    }

    let backupFile: string | null = null;
    if (fs.existsSync(sourceFilePath)) {
      backupFile = this.backupGuideFile(sourceSlug, action);
      if (!backupFile) {
        throw new Error(`Failed to create pre-write backup for guide "${sourceSlug}".`);
      }
    }

    const val = this.validateGuideFrontMatter(frontMatter);
    if (!val.valid) {
      throw new Error(val.error);
    }

    const serialized = this.serializeGuideDocument(frontMatter, body);

    const tempFileName = `.${targetSlug}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.md`;
    const tempFilePath = path.join(this.guidesDir, tempFileName);

    try {
      fs.writeFileSync(tempFilePath, serialized, 'utf8');

      if (!fs.existsSync(tempFilePath)) {
        throw new Error('Temporary file was not written to disk.');
      }

      fs.renameSync(tempFilePath, targetFilePath);

      if (sourceSlug !== targetSlug && fs.existsSync(sourceFilePath)) {
        try { fs.unlinkSync(sourceFilePath); } catch (e) { console.warn('Could not remove old guide file after rename:', e); }
      }

      return { success: true, backupFile };
    } finally {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }
  }

  public async getGuides(): Promise<any[]> {
    if (!fs.existsSync(this.guidesDir)) {
      return [];
    }
    const files = fs.readdirSync(this.guidesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    const list: any[] = [];

    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      try {
        const parsed = this.parseGuideFile(slug);
        if (!parsed) continue;
        const fm = parsed.frontMatter;
        const stats = fs.statSync(path.join(this.guidesDir, file));

        let productCount = 0;
        if (fm.editorsPick) productCount++;
        if (Array.isArray(fm.quickPicks)) productCount += fm.quickPicks.length;
        if (Array.isArray(fm.budgetSections)) {
          fm.budgetSections.forEach((b: any) => {
            if (Array.isArray(b.products)) productCount += b.products.length;
          });
        }

        const words = parsed.body.trim() ? parsed.body.trim().split(/\s+/).length : 0;

        list.push({
          slug,
          title: fm.title || slug,
          category: fm.category || 'Uncategorized',
          deck: fm.deck || '',
          readTime: fm.readTime || '5 min read',
          publishedDate: fm.publishedDate || fm.updatedDate || '',
          lastModifiedDate: fm.lastModifiedDate || fm.publishedDate || fm.updatedDate || '',
          authorName: fm.author?.name || 'Science of Gifts Curators',
          authorRole: fm.author?.role || 'Curatorial Team',
          heroImage: fm.image || '',
          heroImageAlt: fm.heroImageAlt || '',
          productCount,
          budgetSectionCount: Array.isArray(fm.budgetSections) ? fm.budgetSections.length : 0,
          wordCount: words,
          fileMtime: stats.mtime.toISOString()
        });
      } catch (e) {
        console.warn(`Could not parse guide ${file}:`, e);
      }
    }

    return list.sort((a, b) => (b.publishedDate || '').localeCompare(a.publishedDate || ''));
  }

  public async getGuideBySlug(slug: string): Promise<any | null> {
    try {
      const parsed = this.parseGuideFile(slug);
      if (!parsed) return null;
      const html = await marked.parse(parsed.body);
      const words = parsed.body.trim() ? parsed.body.trim().split(/\s+/).length : 0;

      return {
        slug,
        frontMatter: parsed.frontMatter,
        body: parsed.body,
        html,
        stats: {
          wordCount: words,
          charCount: parsed.body.length
        }
      };
    } catch {
      return null;
    }
  }

  public async saveGuide(guideData: { frontMatter: GiftGuideFrontMatter; body: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }> {
    const { frontMatter, body } = guideData;
    const slug = (frontMatter.slug || '').trim();

    try {
      const result = this.executeAtomicGuideWrite({
        slug,
        action: 'create',
        frontMatter,
        body
      });
      return { success: true, slug, backupFile: result.backupFile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async updateGuide(slug: string, guideData: { frontMatter: GiftGuideFrontMatter; body: string; originalSlug?: string }): Promise<{ success: boolean; slug?: string; backupFile?: string | null; error?: string }> {
    const { frontMatter, body, originalSlug } = guideData;
    const targetSlug = (frontMatter.slug || slug).trim();

    try {
      const result = this.executeAtomicGuideWrite({
        slug: targetSlug,
        originalSlug: originalSlug || slug,
        action: 'update',
        frontMatter,
        body
      });
      return { success: true, slug: targetSlug, backupFile: result.backupFile };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async deleteGuide(slug: string): Promise<{ success: boolean; message?: string; backupFile?: string | null; error?: string }> {
    const filePath = path.join(this.guidesDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Guide file "${slug}.md" not found.` };
    }

    const backupFile = this.backupGuideFile(slug, 'delete');
    fs.unlinkSync(filePath);

    return {
      success: true,
      message: `Guide "${slug}" deleted successfully.`,
      backupFile
    };
  }

  public async getGuideBackups(): Promise<any[]> {
    if (!fs.existsSync(this.guidesBackupsDir)) {
      return [];
    }
    const files = fs.readdirSync(this.guidesBackupsDir).filter(f => f.endsWith('.md')).sort().reverse();
    return files.map(filename => {
      const fullPath = path.join(this.guidesBackupsDir, filename);
      const stats = fs.statSync(fullPath);
      const match = filename.match(/^guide_(.+?)_(\d{4}-\d{2}-\d{2}T[^_]+)_(create|update|delete|restore)\.md$/);
      return {
        filename,
        timestamp: match ? match[2].replace(/-/g, ':') : stats.mtime.toISOString(),
        size: stats.size,
        slug: match ? match[1] : '',
        action: match ? match[3] : 'snapshot'
      };
    });
  }

  public async restoreGuideBackup(backupFileName: string): Promise<{ success: boolean; message?: string; restoredSlug?: string; error?: string }> {
    if (!backupFileName || typeof backupFileName !== 'string') {
      return { success: false, error: 'Backup filename is required.' };
    }
    const safeName = path.basename(backupFileName);
    const backupPath = path.join(this.guidesBackupsDir, safeName);
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: `Guide backup file "${safeName}" not found.` };
    }

    const raw = fs.readFileSync(backupPath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { success: false, error: 'Backup file does not contain valid YAML front matter.' };
    }

    const frontMatter = yaml.load(match[1]) as any;
    const body = (match[2] || '').trim();
    if (!frontMatter || !frontMatter.slug) {
      return { success: false, error: 'Backup file front matter is missing guide slug.' };
    }

    const slug = frontMatter.slug.trim();
    this.executeAtomicGuideWrite({
      slug,
      action: 'restore',
      frontMatter,
      body
    });

    return {
      success: true,
      restoredSlug: slug,
      message: `Successfully restored guide "${slug}" from snapshot "${safeName}".`
    };
  }

  // =================================-------------------------------------------
  // COLLECTIONS
  // =================================-------------------------------------------

  private readRawCollectionsData(): Record<string, CollectionItem[]> {
    if (!fs.existsSync(this.collectionsFile)) {
      return {};
    }
    const raw = fs.readFileSync(this.collectionsFile, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed as Record<string, CollectionItem[]>;
  }

  private backupCollectionsYml(action: string, targetSlug: string): string | null {
    try {
      if (!fs.existsSync(this.collectionsFile)) return null;
      if (!fs.existsSync(this.collectionsBackupsDir)) {
        fs.mkdirSync(this.collectionsBackupsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `collections_${timestamp}_${action}_${targetSlug.replace(/[^a-zA-Z0-9_-]/g, '_')}.yml`;
      const destPath = path.join(this.collectionsBackupsDir, filename);
      fs.copyFileSync(this.collectionsFile, destPath);
      return filename;
    } catch (err) {
      console.error('Failed to create collections backup:', err);
      return null;
    }
  }

  private executeAtomicCollectionWrite(updater: (current: Record<string, CollectionItem[]>) => Record<string, CollectionItem[]>, action: string, targetSlug: string): { success: boolean; backupFile: string | null } {
    const current = this.readRawCollectionsData();
    const backupFile = this.backupCollectionsYml(action, targetSlug);

    const updated = updater(current);
    const dumped = yaml.dump(updated, { indent: 2, lineWidth: -1, noRefs: true });

    const tempFileName = `.collections.yml.tmp.${Date.now()}`;
    const tempFilePath = path.join(path.dirname(this.collectionsFile), tempFileName);

    try {
      fs.writeFileSync(tempFilePath, dumped, 'utf8');
      fs.renameSync(tempFilePath, this.collectionsFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}
    }
  }

  public async getCollections(): Promise<Record<string, CollectionItem[]>> {
    return this.readRawCollectionsData();
  }

  public async getCollectionItem(section: string, slug: string): Promise<CollectionItem | null> {
    const collections = this.readRawCollectionsData();
    const list = collections[section] || [];
    const item = list.find(i => i.slug === slug);
    return item || null;
  }

  public async saveCollectionItem(section: string, item: CollectionItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    if (!section || !item || !item.slug) {
      return { success: false, error: 'Section and item slug are required.' };
    }
    const result = this.executeAtomicCollectionWrite(current => {
      const list = current[section] || [];
      const existingIdx = list.findIndex(i => i.slug === item.slug);
      if (existingIdx !== -1) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      return { ...current, [section]: list };
    }, 'save', item.slug);

    return { success: true, backupFile: result.backupFile };
  }

  public async updateCollectionItem(section: string, slug: string, item: CollectionItem): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    return this.saveCollectionItem(section, item);
  }

  public async deleteCollectionItem(section: string, slug: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const result = this.executeAtomicCollectionWrite(current => {
      const list = current[section] || [];
      const filtered = list.filter(i => i.slug !== slug);
      return { ...current, [section]: filtered };
    }, 'delete', slug);

    return { success: true, backupFile: result.backupFile };
  }

  public async getCollectionBackups(): Promise<any[]> {
    if (!fs.existsSync(this.collectionsBackupsDir)) {
      return [];
    }
    const files = fs.readdirSync(this.collectionsBackupsDir).filter(f => f.endsWith('.yml')).sort().reverse();
    return files.map(filename => {
      const fullPath = path.join(this.collectionsBackupsDir, filename);
      const stats = fs.statSync(fullPath);
      return {
        filename,
        timestamp: stats.mtime.toISOString(),
        size: stats.size
      };
    });
  }

  public async restoreCollectionBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const safeName = path.basename(backupFileName);
    const backupPath = path.join(this.collectionsBackupsDir, safeName);
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Collection backup file not found.' };
    }

    const raw = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid backup file YAML structure.' };
    }

    this.executeAtomicCollectionWrite(() => parsed, 'restore', 'all');
    return { success: true, message: 'Collection snapshot restored successfully.' };
  }

  // =================================-------------------------------------------
  // TAXONOMIES
  // =================================-------------------------------------------

  public async getTaxonomies(): Promise<TaxonomyOptions> {
    const products = this.readRawProductsData();

    const presetCategories = ['editors-pick', 'quick-pick', 'under-50', 'under-30', 'under-100', 'heirloom'];
    const presetPriceRanges = ['under-25', '25-50', '50-100', '100-plus'];
    const presetRecipients = [
      'friend', 'partner', 'coworker', 'teacher', 'parent', 'sibling', 'other',
      'him', 'her', 'dad', 'mom', 'husband', 'wife', 'boyfriend', 'girlfriend',
      'brother', 'sister', 'son', 'daughter'
    ];
    const presetInterests = [
      'books', 'art-design', 'stationery', 'food-drink', 'cooking',
      'science', 'curiosities', 'history', 'travel', 'philosophy', 'education', 'craft'
    ];
    const presetOccasions = [
      'birthday', 'holidays', 'thank-you', 'just-because',
      'graduation', 'anniversary', 'parents-day', 'wedding', 'housewarming'
    ];
    const presetAgeRanges = ['under-18', '18-24', '25-34', '35-44', '45-54', '55-plus'];
    const presetPersonalityStyles = [
      'practical', 'thoughtful', 'compact', 'scholarly',
      'heirloom', 'unusual', 'indulgent', 'curious', 'minimalist'
    ];

    const categories = new Set(presetCategories);
    const priceRanges = new Set(presetPriceRanges);
    const recipients = new Set(presetRecipients);
    const interests = new Set(presetInterests);
    const occasions = new Set(presetOccasions);
    const ageRanges = new Set(presetAgeRanges);
    const personalityStyles = new Set(presetPersonalityStyles);
    const imageTypes = new Set<string>();
    const vendors = new Set<string>();
    const tags = new Set<string>();

    products.forEach(p => {
      if (p.category) categories.add(p.category);
      if (p.priceRange) priceRanges.add(p.priceRange);
      if (p.imageType) imageTypes.add(p.imageType);
      if (p.image && !imageTypes.has(p.image)) imageTypes.add(p.image);
      if (p.vendor) vendors.add(p.vendor);
      (p.recipients || []).forEach((r: string) => recipients.add(r));
      (p.interests || []).forEach((i: string) => interests.add(i));
      (p.occasions || []).forEach((o: string) => occasions.add(o));
      (p.ageRanges || []).forEach((a: string) => ageRanges.add(a));
      (p.personalityStyles || []).forEach((s: string) => personalityStyles.add(s));
      (p.tags || []).forEach((t: string) => tags.add(t));
    });

    return {
      categories: Array.from(categories),
      priceRanges: Array.from(priceRanges),
      recipients: Array.from(recipients),
      interests: Array.from(interests),
      occasions: Array.from(occasions),
      ageRanges: Array.from(ageRanges),
      personalityStyles: Array.from(personalityStyles),
      imageTypes: Array.from(imageTypes),
      vendors: Array.from(vendors).sort(),
      tags: Array.from(tags).sort()
    };
  }

  // =================================-------------------------------------------
  // AUTHORS
  // =================================-------------------------------------------

  private readRawAuthorsData(): Author[] {
    if (!fs.existsSync(this.authorsFile)) return [];
    const raw = fs.readFileSync(this.authorsFile, 'utf8');
    const parsed = yaml.load(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  private executeAtomicAuthorWrite(updater: (current: Author[]) => Author[], action: string, targetId: string): { success: boolean; backupFile: string | null } {
    const current = this.readRawAuthorsData();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `authors_${timestamp}_${action}_${targetId}.yml`;
    const backupPath = path.join(this.authorsBackupsDir, backupFile);
    if (fs.existsSync(this.authorsFile)) {
      fs.copyFileSync(this.authorsFile, backupPath);
    }

    const updated = updater(current);
    const dumped = yaml.dump(updated, { indent: 2, lineWidth: -1, noRefs: true });

    const tempFile = `.authors.yml.tmp.${Date.now()}`;
    const tempPath = path.join(path.dirname(this.authorsFile), tempFile);

    try {
      fs.writeFileSync(tempPath, dumped, 'utf8');
      fs.renameSync(tempPath, this.authorsFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getAuthors(): Promise<Author[]> {
    return this.readRawAuthorsData();
  }

  public async getAuthorById(id: string): Promise<Author | null> {
    const authors = this.readRawAuthorsData();
    return authors.find((a: any) => a.id === id || a.slug === id) || null;
  }

  public async saveAuthor(author: Author): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const id = author.id || author.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fullAuthor = { ...author, id };
    const result = this.executeAtomicAuthorWrite(current => {
      const idx = current.findIndex(a => a.id === id);
      if (idx !== -1) {
        current[idx] = fullAuthor;
        return current;
      }
      return [...current, fullAuthor];
    }, 'save', id);

    return { success: true, backupFile: result.backupFile };
  }

  public async updateAuthor(id: string, author: Author): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    return this.saveAuthor({ ...author, id });
  }

  public async deleteAuthor(id: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const result = this.executeAtomicAuthorWrite(current => current.filter(a => a.id !== id), 'delete', id);
    return { success: true, backupFile: result.backupFile };
  }

  public async getAuthorBackups(): Promise<any[]> {
    if (!fs.existsSync(this.authorsBackupsDir)) return [];
    const files = fs.readdirSync(this.authorsBackupsDir).filter(f => f.endsWith('.yml')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.authorsBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreAuthorBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.authorsBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const raw = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(raw) as Author[];
    this.executeAtomicAuthorWrite(() => parsed, 'restore', 'all');
    return { success: true, message: 'Authors restored successfully.' };
  }

  // =================================-------------------------------------------
  // INTERESTS
  // =================================-------------------------------------------

  private readRawInterestsData(): Interest[] {
    if (!fs.existsSync(this.interestsFile)) return [];
    const raw = fs.readFileSync(this.interestsFile, 'utf8');
    const parsed = yaml.load(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  private executeAtomicInterestWrite(updater: (current: Interest[]) => Interest[], action: string, targetId: string): { success: boolean; backupFile: string | null } {
    const current = this.readRawInterestsData();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `interests_${timestamp}_${action}_${targetId}.yml`;
    const backupPath = path.join(this.interestsBackupsDir, backupFile);
    if (fs.existsSync(this.interestsFile)) {
      fs.copyFileSync(this.interestsFile, backupPath);
    }

    const updated = updater(current);
    const dumped = yaml.dump(updated, { indent: 2, lineWidth: -1, noRefs: true });

    const tempFile = `.interests.yml.tmp.${Date.now()}`;
    const tempPath = path.join(path.dirname(this.interestsFile), tempFile);

    try {
      fs.writeFileSync(tempPath, dumped, 'utf8');
      fs.renameSync(tempPath, this.interestsFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getInterests(): Promise<Interest[]> {
    return this.readRawInterestsData();
  }

  public async getInterestById(id: string): Promise<Interest | null> {
    const interests = this.readRawInterestsData();
    return interests.find((i: any) => i.id === id || i.slug === id) || null;
  }

  public async saveInterest(interest: Interest): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const id = interest.id || interest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fullInterest = { ...interest, id };
    const result = this.executeAtomicInterestWrite(current => {
      const idx = current.findIndex(i => i.id === id);
      if (idx !== -1) {
        current[idx] = fullInterest;
        return current;
      }
      return [...current, fullInterest];
    }, 'save', id);

    return { success: true, backupFile: result.backupFile };
  }

  public async updateInterest(id: string, interest: Interest): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    return this.saveInterest({ ...interest, id });
  }

  public async deleteInterest(id: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const result = this.executeAtomicInterestWrite(current => current.filter(i => i.id !== id), 'delete', id);
    return { success: true, backupFile: result.backupFile };
  }

  public async getInterestBackups(): Promise<any[]> {
    if (!fs.existsSync(this.interestsBackupsDir)) return [];
    const files = fs.readdirSync(this.interestsBackupsDir).filter(f => f.endsWith('.yml')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.interestsBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreInterestBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.interestsBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const raw = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(raw) as Interest[];
    this.executeAtomicInterestWrite(() => parsed, 'restore', 'all');
    return { success: true, message: 'Interests restored successfully.' };
  }

  // =================================-------------------------------------------
  // NAVIGATION
  // =================================-------------------------------------------

  private readRawNavigationData(): any {
    if (!fs.existsSync(this.navigationFile)) return {};
    const raw = fs.readFileSync(this.navigationFile, 'utf8');
    return yaml.load(raw) || {};
  }

  private executeAtomicNavigationWrite(navData: any): { success: boolean; backupFile: string | null } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `navigation_${timestamp}_update.yml`;
    const backupPath = path.join(this.navigationBackupsDir, backupFile);
    if (fs.existsSync(this.navigationFile)) {
      fs.copyFileSync(this.navigationFile, backupPath);
    }

    const dumped = yaml.dump(navData, { indent: 2, lineWidth: -1, noRefs: true });
    const tempFile = `.navigation.yml.tmp.${Date.now()}`;
    const tempPath = path.join(path.dirname(this.navigationFile), tempFile);

    try {
      fs.writeFileSync(tempPath, dumped, 'utf8');
      fs.renameSync(tempPath, this.navigationFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getNavigation(): Promise<any> {
    return this.readRawNavigationData();
  }

  public async saveNavigation(data: any): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const result = this.executeAtomicNavigationWrite(data);
    return { success: true, backupFile: result.backupFile };
  }

  public async getNavigationBackups(): Promise<any[]> {
    if (!fs.existsSync(this.navigationBackupsDir)) return [];
    const files = fs.readdirSync(this.navigationBackupsDir).filter(f => f.endsWith('.yml')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.navigationBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreNavigationBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.navigationBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const raw = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(raw);
    this.executeAtomicNavigationWrite(parsed);
    return { success: true, message: 'Navigation restored successfully.' };
  }

  // =================================-------------------------------------------
  // HOMEPAGE
  // =================================-------------------------------------------

  public async getHomepage(): Promise<{ frontMatter: any; body: string }> {
    if (!fs.existsSync(this.homepageFile)) {
      return { frontMatter: {}, body: '' };
    }
    const raw = fs.readFileSync(this.homepageFile, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { frontMatter: {}, body: raw };
    }
    const frontMatter = yaml.load(match[1]) || {};
    const body = (match[2] || '').trim();
    return { frontMatter, body };
  }

  public async saveHomepage(frontMatter: any, body: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `homepage_${timestamp}_update.md`;
    const backupPath = path.join(this.homepageBackupsDir, backupFile);
    if (fs.existsSync(this.homepageFile)) {
      fs.copyFileSync(this.homepageFile, backupPath);
    }

    const dumpedYaml = yaml.dump(frontMatter, { indent: 2, lineWidth: -1, noRefs: true });
    const content = `---\n${dumpedYaml}---\n${(body || '').trim()}\n`;

    const tempFile = `.homepage.tmp.${Date.now()}.md`;
    const tempPath = path.join(path.dirname(this.homepageFile), tempFile);

    try {
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, this.homepageFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getHomepageBackups(): Promise<any[]> {
    if (!fs.existsSync(this.homepageBackupsDir)) return [];
    const files = fs.readdirSync(this.homepageBackupsDir).filter(f => f.endsWith('.md')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.homepageBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreHomepageBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.homepageBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const raw = fs.readFileSync(backupPath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const frontMatter = match ? yaml.load(match[1]) : {};
    const body = match ? (match[2] || '').trim() : raw;
    await this.saveHomepage(frontMatter, body);
    return { success: true, message: 'Homepage restored successfully.' };
  }

  // =================================-------------------------------------------
  // GIFT FINDER
  // =================================-------------------------------------------

  public async getGiftFinderConfig(): Promise<any> {
    if (fs.existsSync(this.giftFinderYaml)) {
      const raw = fs.readFileSync(this.giftFinderYaml, 'utf8');
      return yaml.load(raw) || {};
    }
    return {};
  }

  public async getGiftFinderHtml(): Promise<string> {
    if (fs.existsSync(this.giftFinderFile)) {
      return fs.readFileSync(this.giftFinderFile, 'utf8');
    }
    return '';
  }

  public async saveGiftFinder(html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `gift-finder_${timestamp}_update.html`;
    const backupPath = path.join(this.giftFinderBackupsDir, backupFile);
    if (fs.existsSync(this.giftFinderFile)) {
      fs.copyFileSync(this.giftFinderFile, backupPath);
    }

    const tempFile = `.gift-finder.tmp.${Date.now()}.html`;
    const tempPath = path.join(path.dirname(this.giftFinderFile), tempFile);

    try {
      fs.writeFileSync(tempPath, html, 'utf8');
      fs.renameSync(tempPath, this.giftFinderFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getGiftFinderBackups(): Promise<any[]> {
    if (!fs.existsSync(this.giftFinderBackupsDir)) return [];
    const files = fs.readdirSync(this.giftFinderBackupsDir).filter(f => f.endsWith('.html')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.giftFinderBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreGiftFinderBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.giftFinderBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const html = fs.readFileSync(backupPath, 'utf8');
    await this.saveGiftFinder(html);
    return { success: true, message: 'Gift finder restored successfully.' };
  }

  // =================================-------------------------------------------
  // STATIC PAGES
  // =================================-------------------------------------------

  private resolvePagePath(slug: string): string | null {
    const allowed = ['about', 'contact', 'privacy', 'terms', 'affiliate-disclosure'];
    const cleanSlug = slug.replace(/[^a-z0-9-]/gi, '');
    if (!allowed.includes(cleanSlug)) return null;

    const htmlPath = path.join(this.jekyllRoot, cleanSlug, 'index.html');
    if (fs.existsSync(htmlPath)) return htmlPath;

    const topHtml = path.join(this.jekyllRoot, `${cleanSlug}.html`);
    if (fs.existsSync(topHtml)) return topHtml;

    return htmlPath;
  }

  public async getPages(): Promise<any[]> {
    const slugs = ['about', 'contact', 'privacy', 'terms', 'affiliate-disclosure'];
    const result: any[] = [];
    for (const slug of slugs) {
      const pagePath = this.resolvePagePath(slug);
      if (pagePath && fs.existsSync(pagePath)) {
        const stats = fs.statSync(pagePath);
        const rawHtml = fs.readFileSync(pagePath, 'utf8');
        result.push({
          slug,
          path: path.relative(this.jekyllRoot, pagePath),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          snippet: rawHtml.slice(0, 200)
        });
      }
    }
    return result;
  }

  public async getPageBySlug(slug: string): Promise<any | null> {
    const pagePath = this.resolvePagePath(slug);
    if (!pagePath || !fs.existsSync(pagePath)) return null;

    const stats = fs.statSync(pagePath);
    const rawHtml = fs.readFileSync(pagePath, 'utf8');
    return {
      slug,
      path: path.relative(this.jekyllRoot, pagePath),
      content: rawHtml,
      stats: {
        size: stats.size,
        mtime: stats.mtime.toISOString()
      }
    };
  }

  public async savePage(slug: string, html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const pagePath = this.resolvePagePath(slug);
    if (!pagePath) return { success: false, error: 'Invalid page slug.' };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${slug}_${timestamp}_update_page.html`;
    const backupPath = path.join(this.pagesBackupsDir, backupFile);

    if (fs.existsSync(pagePath)) {
      fs.copyFileSync(pagePath, backupPath);
    }

    const dir = path.dirname(pagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tempFile = `.${slug}.tmp.${Date.now()}.html`;
    const tempPath = path.join(dir, tempFile);

    try {
      fs.writeFileSync(tempPath, html, 'utf8');
      fs.renameSync(tempPath, pagePath);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getPageBackups(): Promise<any[]> {
    if (!fs.existsSync(this.pagesBackupsDir)) return [];
    const files = fs.readdirSync(this.pagesBackupsDir).filter(f => f.endsWith('.html')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.pagesBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restorePageBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.pagesBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const html = fs.readFileSync(backupPath, 'utf8');
    const slug = backupFileName.split('_')[0];
    await this.savePage(slug, html);
    return { success: true, message: `Page "${slug}" restored successfully.` };
  }

  // =================================-------------------------------------------
  // GLOBAL COMPONENTS
  // =================================-------------------------------------------

  private resolveComponentPath(key: string): string | null {
    const cleanKey = key.replace(/[^a-z0-9_-]/gi, '');
    const filePath = path.join(this.globalComponentsDir, `${cleanKey}.html`);
    return filePath;
  }

  public async getGlobalComponents(): Promise<any[]> {
    if (!fs.existsSync(this.globalComponentsDir)) return [];
    const files = fs.readdirSync(this.globalComponentsDir).filter(f => f.endsWith('.html'));
    return files.map(f => {
      const key = f.replace(/\.html$/, '');
      const full = path.join(this.globalComponentsDir, f);
      const stats = fs.statSync(full);
      const content = fs.readFileSync(full, 'utf8');
      return {
        key,
        filename: f,
        size: stats.size,
        mtime: stats.mtime.toISOString(),
        snippet: content.slice(0, 150)
      };
    });
  }

  public async getGlobalComponentByKey(key: string): Promise<any | null> {
    const compPath = this.resolveComponentPath(key);
    if (!compPath || !fs.existsSync(compPath)) return null;

    const stats = fs.statSync(compPath);
    const content = fs.readFileSync(compPath, 'utf8');
    return {
      key,
      content,
      stats: {
        size: stats.size,
        mtime: stats.mtime.toISOString()
      }
    };
  }

  public async saveGlobalComponent(key: string, html: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const compPath = this.resolveComponentPath(key);
    if (!compPath) return { success: false, error: 'Invalid component key.' };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${key}_${timestamp}_update_component.html`;
    const backupPath = path.join(this.globalComponentsBackupsDir, backupFile);

    if (fs.existsSync(compPath)) {
      fs.copyFileSync(compPath, backupPath);
    }

    const tempFile = `.${key}.tmp.${Date.now()}.html`;
    const tempPath = path.join(this.globalComponentsDir, tempFile);

    try {
      fs.writeFileSync(tempPath, html, 'utf8');
      fs.renameSync(tempPath, compPath);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getGlobalComponentBackups(): Promise<any[]> {
    if (!fs.existsSync(this.globalComponentsBackupsDir)) return [];
    const files = fs.readdirSync(this.globalComponentsBackupsDir).filter(f => f.endsWith('.html')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.globalComponentsBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreGlobalComponentBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.globalComponentsBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const html = fs.readFileSync(backupPath, 'utf8');
    const key = backupFileName.split('_')[0];
    await this.saveGlobalComponent(key, html);
    return { success: true, message: `Global component "${key}" restored successfully.` };
  }

  // =================================-------------------------------------------
  // SITE SETTINGS
  // =================================-------------------------------------------

  public async getSiteSettings(): Promise<{ rawYaml: string; parsed: any; mtime: string }> {
    if (!fs.existsSync(this.configFile)) {
      return { rawYaml: '', parsed: {}, mtime: new Date().toISOString() };
    }
    const stats = fs.statSync(this.configFile);
    const rawYaml = fs.readFileSync(this.configFile, 'utf8');
    const parsed = yaml.load(rawYaml) || {};
    return { rawYaml, parsed, mtime: stats.mtime.toISOString() };
  }

  public async saveSiteSettings(rawYaml: string): Promise<{ success: boolean; parsed?: any; backupFile?: string | null; error?: string }> {
    let parsed: any;
    try {
      parsed = yaml.load(rawYaml);
    } catch (err: any) {
      return { success: false, error: `YAML Parse Error: ${err.message}` };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `_config_${timestamp}_update_settings.yml`;
    const backupPath = path.join(this.settingsBackupsDir, backupFile);

    if (fs.existsSync(this.configFile)) {
      fs.copyFileSync(this.configFile, backupPath);
    }

    const tempFile = `.config.tmp.${Date.now()}.yml`;
    const tempPath = path.join(path.dirname(this.configFile), tempFile);

    try {
      fs.writeFileSync(tempPath, rawYaml, 'utf8');
      yaml.load(fs.readFileSync(tempPath, 'utf8'));
      fs.renameSync(tempPath, this.configFile);
      return { success: true, parsed, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getSiteSettingsBackups(): Promise<any[]> {
    if (!fs.existsSync(this.settingsBackupsDir)) return [];
    const files = fs.readdirSync(this.settingsBackupsDir).filter(f => f.endsWith('.yml')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.settingsBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreSiteSettingsBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.settingsBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const rawYaml = fs.readFileSync(backupPath, 'utf8');
    await this.saveSiteSettings(rawYaml);
    return { success: true, message: 'Site settings restored successfully.' };
  }

  // =================================-------------------------------------------
  // AI SETTINGS
  // =================================-------------------------------------------

  public async getAiSettings(): Promise<AiSettingsData> {
    try {
      if (fs.existsSync(this.aiSettingsPath)) {
        const raw = fs.readFileSync(this.aiSettingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_AI_SETTINGS,
          ...parsed
        };
      }
    } catch (err: any) {
      console.warn(`[LocalDiskRepository] Could not read ${this.aiSettingsPath}:`, err.message);
    }
    return { ...DEFAULT_AI_SETTINGS };
  }

  public async saveAiSettings(settings: Partial<AiSettingsData>): Promise<AiSettingsData> {
    const current = await this.getAiSettings();
    const updated: AiSettingsData = {
      ...current,
      ...settings
    };

    const dir = path.dirname(this.aiSettingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.aiSettingsPath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  // =================================-------------------------------------------
  // ROBOTS.TXT
  // =================================-------------------------------------------

  public async getRobotsTxt(): Promise<string> {
    if (fs.existsSync(this.robotsFile)) {
      return fs.readFileSync(this.robotsFile, 'utf8');
    }
    return '';
  }

  public async saveRobotsTxt(content: string): Promise<{ success: boolean; backupFile?: string | null; error?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `robots_${timestamp}_update.txt`;
    const backupPath = path.join(this.seoBackupsDir, backupFile);

    if (fs.existsSync(this.robotsFile)) {
      fs.copyFileSync(this.robotsFile, backupPath);
    }

    const tempFile = `.robots.tmp.${Date.now()}.txt`;
    const tempPath = path.join(path.dirname(this.robotsFile), tempFile);

    try {
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, this.robotsFile);
      return { success: true, backupFile };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }

  public async getRobotsTxtBackups(): Promise<any[]> {
    if (!fs.existsSync(this.seoBackupsDir)) return [];
    const files = fs.readdirSync(this.seoBackupsDir).filter(f => f.startsWith('robots_')).sort().reverse();
    return files.map(filename => ({
      filename,
      timestamp: fs.statSync(path.join(this.seoBackupsDir, filename)).mtime.toISOString()
    }));
  }

  public async restoreRobotsTxtBackup(backupFileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backupPath = path.join(this.seoBackupsDir, path.basename(backupFileName));
    if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup not found' };
    const content = fs.readFileSync(backupPath, 'utf8');
    await this.saveRobotsTxt(content);
    return { success: true, message: 'robots.txt restored successfully.' };
  }

  // =================================-------------------------------------------
  // ASSETS
  // =================================-------------------------------------------

  public async getAssets(): Promise<any[]> {
    if (!fs.existsSync(this.assetsDir)) return [];
    const files = fs.readdirSync(this.assetsDir);
    const assetMap = new Map<string, any>();

    for (const file of files) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext)) continue;

      const isThumb = file.endsWith('-thumb.webp');
      const baseNameWithoutThumb = isThumb ? file.slice(0, -'-thumb.webp'.length) : file;
      const baseKey = baseNameWithoutThumb.replace(/\.(jpg|jpeg|png|webp|svg|gif)$/i, '');

      if (!assetMap.has(baseKey)) {
        assetMap.set(baseKey, {
          key: baseKey,
          name: baseKey,
          formats: [],
          hasThumb: false,
          thumbUrl: '',
          primaryUrl: '',
          primaryFormat: '',
          sizeBytes: 0,
          mtime: ''
        });
      }

      const asset = assetMap.get(baseKey)!;
      const fullPath = path.join(this.assetsDir, file);
      const stats = fs.statSync(fullPath);

      if (isThumb) {
        asset.hasThumb = true;
        asset.thumbUrl = `/assets/${file}`;
      } else {
        asset.formats.push({
          format: ext.slice(1),
          file,
          url: `/assets/${file}`,
          sizeBytes: stats.size,
          mtime: stats.mtime.toISOString()
        });

        if (!asset.primaryUrl || ext === '.webp') {
          asset.primaryUrl = `/assets/${file}`;
          asset.primaryFormat = ext.slice(1);
          asset.sizeBytes = stats.size;
          asset.mtime = stats.mtime.toISOString();
        }
      }
    }

    const result = Array.from(assetMap.values());
    result.forEach(a => {
      if (!a.thumbUrl && a.primaryUrl) a.thumbUrl = a.primaryUrl;
    });

    return result.sort((a, b) => b.mtime.localeCompare(a.mtime));
  }

  public async getAssetUsage(filename: string): Promise<any> {
    const usage: any[] = [];
    const cleanName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');

    const checkText = (text: string, location: string) => {
      if (text.includes(filename) || text.includes(cleanName)) {
        usage.push({ location });
      }
    };

    // Products
    if (fs.existsSync(this.productsFile)) {
      const raw = fs.readFileSync(this.productsFile, 'utf8');
      checkText(raw, '_data/products.yml');
    }

    // Guides
    if (fs.existsSync(this.guidesDir)) {
      const files = fs.readdirSync(this.guidesDir).filter(f => f.endsWith('.md'));
      for (const f of files) {
        const raw = fs.readFileSync(path.join(this.guidesDir, f), 'utf8');
        checkText(raw, `_guides/${f}`);
      }
    }

    // Articles
    if (fs.existsSync(this.articlesDir)) {
      const files = fs.readdirSync(this.articlesDir).filter(f => f.endsWith('.md'));
      for (const f of files) {
        const raw = fs.readFileSync(path.join(this.articlesDir, f), 'utf8');
        checkText(raw, `_articles/${f}`);
      }
    }

    return { filename, isUsed: usage.length > 0, usage };
  }

  public async checkAssetExists(filename: string): Promise<boolean> {
    const cleanName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    if (!fs.existsSync(this.assetsDir)) return false;
    const files = fs.readdirSync(this.assetsDir);
    return files.some(f => f.startsWith(cleanName));
  }

  public async uploadAssetFile(file: any, options?: { customName?: string; altText?: string }): Promise<any> {
    if (!file) throw new Error('No image file uploaded.');

    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const baseName = (options?.customName || path.basename(originalName, ext))
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    const masterName = `${baseName}${ext}`;
    const masterPath = path.join(this.assetsDir, masterName);

    fs.copyFileSync(file.path, masterPath);

    // Generate WebP and WebP Thumb
    let webpCreated = false;
    let thumbCreated = false;

    if (ext !== '.svg') {
      try {
        const webpPath = path.join(this.assetsDir, `${baseName}.webp`);
        await sharp(masterPath).webp({ quality: 85 }).toFile(webpPath);
        webpCreated = true;

        const thumbPath = path.join(this.assetsDir, `${baseName}-thumb.webp`);
        await sharp(masterPath).resize(150, 150, { fit: 'cover' }).webp({ quality: 80 }).toFile(thumbPath);
        thumbCreated = true;
      } catch (err) {
        console.warn('Derivatives creation failed:', err);
      }
    }

    const masterStats = fs.statSync(masterPath);
    let meta: any = {};
    try {
      meta = await sharp(masterPath).metadata();
    } catch {}

    return {
      success: true,
      name: baseName,
      path: webpCreated ? `/assets/${baseName}.webp` : `/assets/${masterName}`,
      fullUrl: webpCreated ? `/assets/${baseName}.webp` : `/assets/${masterName}`,
      width: meta.width || 800,
      height: meta.height || 600,
      mimeType: file.mimetype,
      sizeBytes: masterStats.size
    };
  }

  public async generateAssetDerivatives(): Promise<{ success: boolean; count: number; log: string[] }> {
    if (!fs.existsSync(this.assetsDir)) return { success: true, count: 0, log: [] };

    const files = fs.readdirSync(this.assetsDir);
    const log: string[] = [];
    let count = 0;

    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (['.jpg', '.jpeg', '.png'].includes(ext) && !f.endsWith('-thumb.webp')) {
        const base = path.basename(f, ext);
        const webpPath = path.join(this.assetsDir, `${base}.webp`);
        const thumbPath = path.join(this.assetsDir, `${base}-thumb.webp`);
        const full = path.join(this.assetsDir, f);

        try {
          await sharp(full).webp({ quality: 85 }).toFile(webpPath);
          await sharp(full).resize(150, 150, { fit: 'cover' }).webp({ quality: 80 }).toFile(thumbPath);
          count++;
          log.push(`Generated WebP derivatives for ${f}`);
        } catch (e: any) {
          log.push(`Error on ${f}: ${e.message}`);
        }
      }
    }

    return { success: true, count, log };
  }

  public async deleteAsset(filename: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanName = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    if (!fs.existsSync(this.assetsDir)) return { success: false, error: 'Assets directory not found.' };

    const files = fs.readdirSync(this.assetsDir).filter(f => f.startsWith(cleanName));
    for (const f of files) {
      try {
        fs.unlinkSync(path.join(this.assetsDir, f));
      } catch {}
    }

    return { success: true, message: `Asset "${cleanName}" and derivative files deleted.` };
  }

  public async renameAsset(oldFilename: string, newBaseName: string): Promise<{ success: boolean; oldFilename?: string; newFilename?: string; updatedReferences?: string[]; error?: string }> {
    const oldClean = oldFilename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const newClean = newBaseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    if (oldClean === newClean) {
      return { success: false, error: 'New asset name matches old asset name.' };
    }

    const files = fs.readdirSync(this.assetsDir).filter(f => f.startsWith(oldClean));
    for (const f of files) {
      const ext = f.slice(oldClean.length);
      const newFile = `${newClean}${ext}`;
      fs.renameSync(path.join(this.assetsDir, f), path.join(this.assetsDir, newFile));
    }

    const updatedRefs: string[] = [];

    // Replace in products.yml
    if (fs.existsSync(this.productsFile)) {
      let raw = fs.readFileSync(this.productsFile, 'utf8');
      if (raw.includes(oldClean)) {
        raw = raw.replace(new RegExp(oldClean, 'g'), newClean);
        fs.writeFileSync(this.productsFile, raw, 'utf8');
        updatedRefs.push('_data/products.yml');
      }
    }

    // Replace in guides
    if (fs.existsSync(this.guidesDir)) {
      const gf = fs.readdirSync(this.guidesDir).filter(f => f.endsWith('.md'));
      for (const f of gf) {
        const p = path.join(this.guidesDir, f);
        let raw = fs.readFileSync(p, 'utf8');
        if (raw.includes(oldClean)) {
          raw = raw.replace(new RegExp(oldClean, 'g'), newClean);
          fs.writeFileSync(p, raw, 'utf8');
          updatedRefs.push(`_guides/${f}`);
        }
      }
    }

    // Replace in articles
    if (fs.existsSync(this.articlesDir)) {
      const af = fs.readdirSync(this.articlesDir).filter(f => f.endsWith('.md'));
      for (const f of af) {
        const p = path.join(this.articlesDir, f);
        let raw = fs.readFileSync(p, 'utf8');
        if (raw.includes(oldClean)) {
          raw = raw.replace(new RegExp(oldClean, 'g'), newClean);
          fs.writeFileSync(p, raw, 'utf8');
          updatedRefs.push(`_articles/${f}`);
        }
      }
    }

    return {
      success: true,
      oldFilename: oldClean,
      newFilename: newClean,
      updatedReferences: updatedRefs
    };
  }

  // =================================-------------------------------------------
  // DIAGNOSTICS & STATUS
  // =================================-------------------------------------------

  public async getProjectStatus(): Promise<any> {
    const exists = (p: string) => fs.existsSync(p);
    const count = (p: string) => exists(p) ? fs.readdirSync(p).filter(f => !f.startsWith('.')).length : 0;

    return {
      success: true,
      jekyllDir: this.jekyllRoot,
      structure: {
        _data: exists(path.join(this.jekyllRoot, '_data')),
        _articles: count(this.articlesDir),
        _guides: count(this.guidesDir),
        _includes: count(this.globalComponentsDir),
        assets: count(this.assetsDir)
      }
    };
  }

  public async runDiagnostics(): Promise<any> {
    const issues: any[] = [];
    const warnings: any[] = [];

    const products = this.readRawProductsData();
    const productIds = new Set(products.map(p => p.id));

    // Check images
    products.forEach(p => {
      if (p.image) {
        const imgPath = path.join(this.assetsDir, p.image.endsWith('.webp') || p.image.endsWith('.jpg') ? p.image : `${p.image}.webp`);
        if (!fs.existsSync(imgPath) && !fs.existsSync(path.join(this.assetsDir, `${p.image}.jpg`))) {
          warnings.push({
            category: 'products',
            message: `Product "${p.id}" references missing asset "${p.image}".`
          });
        }
      }
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      issues,
      warnings,
      summary: {
        totalProducts: products.length,
        issueCount: issues.length,
        warningCount: warnings.length
      }
    };
  }

  public async getSiteCatalogForInternalLinking(): Promise<CatalogItemRef[]> {
    const refs: CatalogItemRef[] = [];

    // Articles
    if (fs.existsSync(this.articlesDir)) {
      const files = fs.readdirSync(this.articlesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this.articlesDir, file), 'utf8');
          const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            const fm = yaml.load(match[1]) as any;
            if (fm && fm.slug) {
              refs.push({
                type: 'article',
                title: fm.title || fm.slug,
                url: `/articles/${fm.slug}/`,
                slug: fm.slug,
                category: fm.category
              });
            }
          }
        } catch {}
      }
    }

    // Guides
    if (fs.existsSync(this.guidesDir)) {
      const files = fs.readdirSync(this.guidesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this.guidesDir, file), 'utf8');
          const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (match) {
            const fm = yaml.load(match[1]) as any;
            if (fm && fm.slug) {
              refs.push({
                type: 'guide',
                title: fm.title || fm.slug,
                url: `/gift-guides/${fm.slug}/`,
                slug: fm.slug,
                category: fm.category
              });
            }
          }
        } catch {}
      }
    }

    // Products
    const products = this.readRawProductsData();
    for (const p of products) {
      if (p.id) {
        refs.push({
          type: 'product',
          title: p.title || p.id,
          url: `/products/${p.id}/`,
          slug: p.id,
          category: p.category
        });
      }
    }

    return refs;
  }

  // =================================-------------------------------------------
  // RAW FILE MANAGEMENT
  // =================================-------------------------------------------

  public async getProjectFiles(): Promise<string[]> {
    const list: string[] = [];
    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item.startsWith('.')) continue;
        const full = path.join(dir, item);
        const rel = path.relative(this.jekyllRoot, full);
        if (fs.statSync(full).isDirectory()) {
          scan(full);
        } else {
          list.push(rel.replace(/\\/g, '/'));
        }
      }
    };
    scan(this.jekyllRoot);
    return list;
  }

  public async getRawFile(relativePath: string): Promise<{ content: string; path: string; mtime?: string } | null> {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.join(this.projectRoot, cleanRel);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      return null;
    }
    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      content,
      path: cleanRel,
      mtime: stats.mtime.toISOString()
    };
  }

  public async saveRawFile(relativePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.join(this.projectRoot, cleanRel);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tempFile = `.${path.basename(cleanRel)}.tmp.${Date.now()}`;
    const tempPath = path.join(dir, tempFile);

    try {
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, fullPath);
      return { success: true };
    } finally {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
    }
  }
}

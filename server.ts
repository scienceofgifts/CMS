import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import multer from 'multer';
import * as yamlModule from 'js-yaml';
const yaml: any = (yamlModule as any).default || yamlModule;
import { marked } from 'marked';
import TurndownService from 'turndown';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { renderJekyllPage } from './server-liquid-renderer';
import { fetchProductPage, FetchedPageData } from './server/productFetcher';
import { resolveProductImageBase64, ResolvedImageResult } from './server/productImageResolver';
import { executeProductAiOperation } from './server/productAiService';
import { executeArticleAiOperation, CatalogItemRef } from './server/articleAiService';
import { executeGuideAiOperation } from './server/guideAiService';
import { getAiSettings, saveAiSettings } from './server/aiSettingsService';
import {
  analyzeImportDocument,
  createInitialDraft,
  saveImportDraft,
  revertImportDraft,
  resolveDraftIssue,
  updateDraftFieldMapping,
  updateDraftStatus,
  exportProductsFromLinks,
  createPostFromDraft,
  resolveLinkReferenceToCanonicalProduct,
  SAMPLE_LEGACY_FILES,
  getSessionItems,
  getSessionItem,
  setSessionItem,
  removeSessionItem,
  clearSessionItems
} from './server/importService';
import { executeImportAiAnalysis } from './server/importAiService';
import { fetchAndExtractLiveUrl } from './server/urlScraperService';
import { fetchAndImportProductImage } from './server/productImageFetcher';
import {
  reconcileMarkdownAndLiveUrl,
  createImportItemFromLiveUrl,
  enrichItemWithLiveUrl
} from './server/reconciliationService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Resolve project root dynamically based on process.cwd()
export const PROJECT_ROOT = path.resolve(process.cwd());
export const JEKYLL_ROOT = process.env.JEKYLL_DIR
  ? path.resolve(PROJECT_ROOT, process.env.JEKYLL_DIR)
  : path.join(PROJECT_ROOT, 'site');

app.use(express.json({ limit: '10mb' }));

// Serve static assets directly from Jekyll assets directory (images, logos, svgs)
const ASSETS_ROOT_DIR = path.join(JEKYLL_ROOT, 'assets');
app.use('/assets', express.static(ASSETS_ROOT_DIR));
app.use(express.static(path.resolve(PROJECT_ROOT, 'public')));

// Dynamic Jekyll Live Preview Route
app.get(['/preview', '/preview/*'], async (req: Request, res: Response) => {
  try {
    const rawSubpath = req.path.replace(/^\/preview\/?/, '');
    const result = await renderJekyllPage(rawSubpath);
    res.status(result.status).set('Content-Type', 'text/html; charset=utf-8').send(result.html);
  } catch (err: any) {
    console.error('Preview render error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Preview Error</title></head>
        <body style="font-family:sans-serif; padding:40px;">
          <h2>Jekyll Template Render Error</h2>
          <pre style="background:#f4f4f4; padding:20px; border-radius:4px; overflow:auto;">${err.stack || err.message}</pre>
        </body>
      </html>
    `);
  }
});

/**
 * PATH VALIDATION & SECURITY MODULE
 * Enforces strict containment within the Science of Gifts project root.
 */
export function validateSafePath(userPath: string): {
  safe: boolean;
  error?: string;
  resolvedPath?: string;
  relativePath?: string;
} {
  if (!userPath || typeof userPath !== 'string') {
    return { safe: false, error: 'Path parameter must be a non-empty string.' };
  }

  // Reject null bytes and URL-encoded traversal
  if (userPath.includes('\0') || userPath.includes('%00')) {
    return { safe: false, error: 'Null bytes are strictly prohibited.' };
  }

  // Normalize slashes
  const normalized = userPath.replace(/\\/g, '/').trim();

  // Reject relative traversal tokens
  const segments = normalized.split('/');
  if (segments.some(seg => seg === '..' || seg === '%2e%2e' || seg === '%2E%2E')) {
    return { safe: false, error: 'Directory traversal (..) is strictly prohibited.' };
  }

  // Resolve absolute path
  let resolved: string;
  if (path.isAbsolute(userPath)) {
    resolved = path.resolve(userPath);
  } else {
    // Check if relative path exists in JEKYLL_ROOT first, else resolve in PROJECT_ROOT
    const jekyllCandidate = path.resolve(JEKYLL_ROOT, normalized);
    if (fs.existsSync(jekyllCandidate)) {
      resolved = jekyllCandidate;
    } else {
      resolved = path.resolve(PROJECT_ROOT, normalized);
    }
  }

  // Ensure resolved path is strictly within PROJECT_ROOT
  const relative = path.relative(PROJECT_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { safe: false, error: 'Access outside the Science of Gifts project directory is prohibited.' };
  }

  const cleanRel = relative.replace(/\\/g, '/');

  // Block sensitive, internal, or environment files
  const lowerRel = cleanRel.toLowerCase();
  if (
    lowerRel.startsWith('node_modules') ||
    lowerRel.startsWith('.git') ||
    lowerRel.startsWith('.env')
  ) {
    return { safe: false, error: `Access to '${cleanRel}' is restricted for security.` };
  }

  return {
    safe: true,
    resolvedPath: resolved,
    relativePath: cleanRel
  };
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. GET /api/project/status - Project information and Jekyll detection
app.get('/api/project/status', (req: Request, res: Response) => {
  try {
    const configPath = path.join(JEKYLL_ROOT, '_config.yml');
    const jekyllDetected = fs.existsSync(configPath);
    let configData: any = {};

    if (jekyllDetected) {
      try {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        configData = yaml.load(rawConfig) || {};
      } catch (err) {
        console.warn('Could not parse _config.yml:', err);
      }
    }

    // Check counts
    let productsCount = 0;
    const productsPath = path.join(JEKYLL_ROOT, '_data', 'products.yml');
    if (fs.existsSync(productsPath)) {
      try {
        const rawProducts = fs.readFileSync(productsPath, 'utf8');
        const parsed = yaml.load(rawProducts);
        if (Array.isArray(parsed)) {
          productsCount = parsed.length;
        }
      } catch (e) {
        // Fallback count
      }
    }

    const countFiles = (dirRel: string, ext = '.md'): string[] => {
      const dirAbs = path.join(JEKYLL_ROOT, dirRel);
      if (fs.existsSync(dirAbs) && fs.statSync(dirAbs).isDirectory()) {
        return fs.readdirSync(dirAbs).filter(f => f.endsWith(ext));
      }
      return [];
    };

    const guides = countFiles('_guides');
    const articles = countFiles('_articles');
    const dataFiles = countFiles('_data', '.yml');
    const layoutFiles = countFiles('_layouts', '.html');
    const includeFiles = countFiles('_includes', '.html');

    // Sanitized display of project root for portability (doesn't leak private user directories unnecessarily)
    const folderName = path.basename(JEKYLL_ROOT);

    res.json({
      success: true,
      connected: true,
      jekyllDetected,
      project: {
        name: configData.title || 'Science of Gifts',
        tagline: configData.tagline || 'Thoughtful gifts, chosen with a little more thought.',
        description: configData.description || '',
        url: configData.url || 'https://scienceofgifts.com',
        collections: configData.collections ? Object.keys(configData.collections) : ['guides', 'articles'],
        folderName,
        rootDisplay: `./${folderName}`
      },
      counts: {
        products: productsCount,
        guides: guides.length,
        articles: articles.length,
        dataFiles: dataFiles.length,
        layouts: layoutFiles.length,
        includes: includeFiles.length
      },
      inventory: {
        guides,
        articles,
        dataFiles
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        serverTime: new Date().toISOString(),
        port: PORT
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to determine project status'
    });
  }
});

// 2. GET /api/files - List relevant project files
app.get('/api/files', (req: Request, res: Response) => {
  try {
    const listDirectory = (relDir: string) => {
      const absDir = path.join(JEKYLL_ROOT, relDir);
      if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
        return [];
      }
      return fs.readdirSync(absDir).map(filename => {
        const filePath = path.join(absDir, filename);
        const stats = fs.statSync(filePath);
        let extraInfo: any = {};

        if (filename.endsWith('.md')) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (match) {
              const fm: any = yaml.load(match[1]) || {};
              extraInfo = {
                title: fm.title || filename,
                slug: fm.slug || filename.replace('.md', ''),
                category: fm.category || 'General',
                publishedDate: fm.publishedDate || fm.updatedDate || null,
                deck: fm.deck || null
              };
            }
          } catch {
            // Ignore parse errors on list
          }
        } else if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = yaml.load(content);
            if (Array.isArray(parsed)) {
              extraInfo.itemCount = parsed.length;
            } else if (typeof parsed === 'object' && parsed !== null) {
              extraInfo.itemCount = Object.keys(parsed).length;
            }
          } catch {
            // Ignore
          }
        }

        return {
          name: filename,
          path: `${relDir}/${filename}`,
          size: stats.size,
          mtime: stats.mtime,
          isDirectory: stats.isDirectory(),
          ...extraInfo
        };
      });
    };

    const files = {
      data: listDirectory('_data'),
      guides: listDirectory('_guides'),
      articles: listDirectory('_articles'),
      config: [
        {
          name: '_config.yml',
          path: '_config.yml',
          exists: fs.existsSync(path.join(JEKYLL_ROOT, '_config.yml')),
          size: fs.existsSync(path.join(JEKYLL_ROOT, '_config.yml')) ? fs.statSync(path.join(JEKYLL_ROOT, '_config.yml')).size : 0
        },
        {
          name: 'Gemfile',
          path: 'Gemfile',
          exists: fs.existsSync(path.join(JEKYLL_ROOT, 'Gemfile')),
          size: fs.existsSync(path.join(JEKYLL_ROOT, 'Gemfile')) ? fs.statSync(path.join(JEKYLL_ROOT, 'Gemfile')).size : 0
        },
        {
          name: 'index.md',
          path: 'index.md',
          exists: fs.existsSync(path.join(JEKYLL_ROOT, 'index.md')),
          size: fs.existsSync(path.join(JEKYLL_ROOT, 'index.md')) ? fs.statSync(path.join(JEKYLL_ROOT, 'index.md')).size : 0
        }
      ],
      layouts: listDirectory('_layouts'),
      includes: listDirectory('_includes')
    };

    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. GET /api/file - Read a known file with strict security
app.get('/api/file', (req: Request, res: Response) => {
  const targetPath = req.query.path as string;
  const validation = validateSafePath(targetPath);

  if (!validation.safe || !validation.resolvedPath || !validation.relativePath) {
    return res.status(403).json({
      success: false,
      error: validation.error || 'Access denied by path validation.'
    });
  }

  if (!fs.existsSync(validation.resolvedPath)) {
    return res.status(404).json({
      success: false,
      error: `File not found: ${validation.relativePath}`
    });
  }

  const stat = fs.statSync(validation.resolvedPath);
  if (stat.isDirectory()) {
    return res.status(400).json({
      success: false,
      error: 'Cannot read directory as file.'
    });
  }

  try {
    const content = fs.readFileSync(validation.resolvedPath, 'utf8');
    const ext = path.extname(validation.resolvedPath).toLowerCase();
    let parsed: any = null;

    if (ext === '.yml' || ext === '.yaml') {
      try {
        parsed = yaml.load(content);
      } catch {
        parsed = null;
      }
    } else if (ext === '.json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
    } else if (ext === '.md') {
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (match) {
        try {
          parsed = {
            frontmatter: yaml.load(match[1]),
            body: content.slice(match[0].length).trim()
          };
        } catch {
          parsed = null;
        }
      }
    }

    res.json({
      success: true,
      path: validation.relativePath,
      size: stat.size,
      mtime: stat.mtime,
      content,
      extension: ext,
      parsed
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Failed to read file: ${error.message}`
    });
  }
});

// 4. POST /api/file - Safely write a file
app.post('/api/file', (req: Request, res: Response) => {
  const { path: targetPath, content } = req.body;

  if (typeof content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'File content must be a string.'
    });
  }

  const validation = validateSafePath(targetPath);
  if (!validation.safe || !validation.resolvedPath || !validation.relativePath) {
    return res.status(403).json({
      success: false,
      error: validation.error || 'Access denied by path validation.'
    });
  }

  // Phase 1 Safety Constraint: Guard against inadvertent overwrites to production products or core content in test calls
  if (req.body.isTest && validation.relativePath.includes('products.yml')) {
    return res.status(400).json({
      success: false,
      error: 'Protected: Phase 1 testing must not modify _data/products.yml.'
    });
  }

  try {
    const parentDir = path.dirname(validation.resolvedPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(validation.resolvedPath, content, 'utf8');
    const stat = fs.statSync(validation.resolvedPath);

    res.json({
      success: true,
      path: validation.relativePath,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
      mtime: stat.mtime
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Failed to write file: ${error.message}`
    });
  }
});

// 5. POST /api/test/operation - Automated Phase 1 Filesystem & Security Diagnostics
app.post('/api/test/operation', (req: Request, res: Response) => {
  const results: {
    name: string;
    description: string;
    passed: boolean;
    details?: string;
    durationMs?: number;
  }[] = [];

  const startAll = Date.now();

  // Test 1: Safe Read from _config.yml
  const t1Start = Date.now();
  try {
    const configPath = path.join(JEKYLL_ROOT, '_config.yml');
    if (!fs.existsSync(configPath)) {
      throw new Error('_config.yml does not exist in jekyll root');
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed: any = yaml.load(raw);
    const titleMatch = parsed?.title === 'Science of Gifts';
    results.push({
      name: 'Safe Configuration Read',
      description: 'Read _config.yml and verified title matches "Science of Gifts"',
      passed: titleMatch,
      details: `Read ${Buffer.byteLength(raw, 'utf8')} bytes. Title: "${parsed?.title}"`,
      durationMs: Date.now() - t1Start
    });
  } catch (err: any) {
    results.push({
      name: 'Safe Configuration Read',
      description: 'Read _config.yml',
      passed: false,
      details: err.message,
      durationMs: Date.now() - t1Start
    });
  }

  // Test 2: Safe Scratchpad Write to dedicated .local-editor folder
  const t2Start = Date.now();
  const testDir = path.join(PROJECT_ROOT, '.local-editor');
  const testFileRel = '.local-editor/phase1-verification.json';
  const testFileAbs = path.join(testDir, 'phase1-verification.json');
  const testPayload = {
    test: 'local-filesystem-verification',
    phase: 1,
    verifiedAt: new Date().toISOString(),
    status: 'ACTIVE_AND_SECURE'
  };

  try {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFileAbs, JSON.stringify(testPayload, null, 2), 'utf8');
    results.push({
      name: 'Safe Scratchpad Write',
      description: `Wrote isolated test verification file to ${testFileRel}`,
      passed: true,
      details: `Successfully wrote ${Buffer.byteLength(JSON.stringify(testPayload))} bytes without touching site content.`,
      durationMs: Date.now() - t2Start
    });
  } catch (err: any) {
    results.push({
      name: 'Safe Scratchpad Write',
      description: 'Write test file',
      passed: false,
      details: err.message,
      durationMs: Date.now() - t2Start
    });
  }

  // Test 3: Safe Read-back verification
  const t3Start = Date.now();
  try {
    const readBackRaw = fs.readFileSync(testFileAbs, 'utf8');
    const parsedReadBack = JSON.parse(readBackRaw);
    const matches = parsedReadBack.status === 'ACTIVE_AND_SECURE';
    results.push({
      name: 'Integrity Read-Back',
      description: 'Read back written scratchpad verification file to confirm data integrity',
      passed: matches,
      details: `Read-back confirmed status: ${parsedReadBack.status}`,
      durationMs: Date.now() - t3Start
    });
  } catch (err: any) {
    results.push({
      name: 'Integrity Read-Back',
      description: 'Read back test file',
      passed: false,
      details: err.message,
      durationMs: Date.now() - t3Start
    });
  }

  // Test 4: Path Traversal Security Defense
  const t4Start = Date.now();
  try {
    const maliciousPaths = [
      '../../package.json',
      '..\\..\\Windows\\System32',
      '/etc/passwd',
      '..%2f..%2f_config.yml',
      'node_modules/express/package.json'
    ];

    let allBlocked = true;
    const blockedLog: string[] = [];

    for (const badPath of maliciousPaths) {
      const check = validateSafePath(badPath);
      if (check.safe) {
        allBlocked = false;
        blockedLog.push(`FAIL: ${badPath} was not blocked!`);
      } else {
        blockedLog.push(`Blocked: ${badPath} (${check.error})`);
      }
    }

    results.push({
      name: 'Path Traversal Defense',
      description: 'Verified strict rejection of traversal attacks (../, %2e%2e, absolute system paths, node_modules)',
      passed: allBlocked,
      details: blockedLog.slice(0, 3).join('; '),
      durationMs: Date.now() - t4Start
    });
  } catch (err: any) {
    results.push({
      name: 'Path Traversal Defense',
      description: 'Security traversal test',
      passed: false,
      details: err.message,
      durationMs: Date.now() - t4Start
    });
  }

  // Test 5: Scratchpad Cleanup
  const t5Start = Date.now();
  try {
    if (fs.existsSync(testFileAbs)) {
      fs.unlinkSync(testFileAbs);
    }
    results.push({
      name: 'Safe Scratchpad Cleanup',
      description: 'Cleaned up temporary test verification file',
      passed: !fs.existsSync(testFileAbs),
      details: 'Temporary test artifact removed cleanly.',
      durationMs: Date.now() - t5Start
    });
  } catch (err: any) {
    results.push({
      name: 'Safe Scratchpad Cleanup',
      description: 'Cleanup test file',
      passed: false,
      details: err.message,
      durationMs: Date.now() - t5Start
    });
  }

  const allPassed = results.every(r => r.passed);

  res.json({
    success: true,
    allPassed,
    summary: allPassed
      ? 'All filesystem operations and security path constraints passed successfully.'
      : 'One or more diagnostic tests failed.',
    totalDurationMs: Date.now() - startAll,
    tests: results
  });
});

// -------------------------------------------------------------
// PRODUCT MANAGEMENT API (PHASE 2)
// Source of truth: _data/products.yml
// Direct local filesystem read / write with automatic backups
// -------------------------------------------------------------

const PRODUCTS_FILE = path.join(JEKYLL_ROOT, '_data', 'products.yml');
const BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'products');

// Ensure backups directory exists on startup
try {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize BACKUPS_DIR:', e);
}

/**
 * Creates a timestamped backup of _data/products.yml before any write
 * Stored in editor-backups/products/
 */
function backupProductsYml(action: string, targetId?: string): string | null {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) return null;
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTarget = (targetId || 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `products_${timestamp}_${action}_${safeTarget}.yml`;
    const destPath = path.join(BACKUPS_DIR, filename);
    fs.copyFileSync(PRODUCTS_FILE, destPath);

    // Retain up to 50 recent backups to avoid disk bloat
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create products backup:', err);
    return null;
  }
}

/**
 * Validates the structural integrity of a product catalog.
 * Follows pre-write & post-write validation rules:
 * - root structure must be an Array
 * - product records are objects
 * - IDs are present (string, non-empty)
 * - IDs are unique
 * - expected product structure remains intact (title, basic fields)
 * - does not reject valid existing fields
 */
function validateCatalogIntegrity(catalog: any, contextLabel = 'Catalog'): { valid: boolean; error?: string } {
  if (!Array.isArray(catalog)) {
    return { valid: false, error: `${contextLabel} root structure must be a YAML array.` };
  }
  if (catalog.length === 0) {
    return { valid: false, error: `${contextLabel} is empty (expected catalog items).` };
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `${contextLabel} item at index ${i} is not a valid object.` };
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

/**
 * Safely reads and parses _data/products.yml
 */
function readProductsData(): any[] {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
  const parsed = yaml.load(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
}

interface AtomicWriteParams {
  action: 'create' | 'update' | 'delete' | 'duplicate' | 'restore';
  targetId: string;
  originalId?: string;
  expectedFieldCheck?: { fieldName: string; expectedValue: any };
  updater: (currentCatalog: any[]) => any[];
}

interface AtomicWriteResult {
  success: boolean;
  backupFile: string | null;
  count: number;
}

/**
 * Complete 14-step Atomic Product Catalog Write:
 * 1. Read current products.yml.
 * 2. Parse and validate the current catalog.
 * 3. Create the pre-write backup in editor-backups/products/.
 * 4. Apply the requested product change in memory.
 * 5. Serialize the complete catalog with js-yaml.
 * 6. Parse the serialized YAML in memory.
 * 7. Confirm that the serialized result is valid.
 * 8. Write the result to a temporary file in the same directory as products.yml.
 * 9. Verify the temporary file can be read and parsed.
 * 10. Rename the temporary file to products.yml.
 * 11. Read products.yml from disk again.
 * 12. Parse it again.
 * 13. Verify the intended operation succeeded.
 * 14. Only then return success to the caller.
 */
function executeAtomicProductWrite(params: AtomicWriteParams): AtomicWriteResult {
  const { action, targetId, expectedFieldCheck, updater } = params;

  // 1. Read the current products.yml
  if (!fs.existsSync(PRODUCTS_FILE)) {
    throw new Error(`Catalog file does not exist at ${PRODUCTS_FILE}`);
  }
  const currentRaw = fs.readFileSync(PRODUCTS_FILE, 'utf8');

  // 2. Parse and validate the current catalog (pre-write validation)
  let currentProducts: any[];
  try {
    currentProducts = yaml.load(currentRaw) as any[];
  } catch (err: any) {
    throw new Error(`Pre-write validation failed: products.yml is malformed YAML: ${err.message}`);
  }

  const preValidation = validateCatalogIntegrity(currentProducts, 'Pre-write catalog');
  if (!preValidation.valid) {
    throw new Error(`Pre-write validation failed: ${preValidation.error}`);
  }

  // 3. Create the pre-write backup
  const backupFile = backupProductsYml(action, targetId);
  if (!backupFile) {
    throw new Error('Pre-write backup failed: unable to write snapshot to editor-backups/products/');
  }

  // 4. Apply the requested product change in memory
  const updatedProducts = updater(currentProducts);
  const inMemoryValidation = validateCatalogIntegrity(updatedProducts, 'In-memory modified catalog');
  if (!inMemoryValidation.valid) {
    throw new Error(`In-memory modification validation failed: ${inMemoryValidation.error}`);
  }

  // 5. Serialize the complete catalog with js-yaml
  const dumpedYaml = yaml.dump(updatedProducts, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
  // Preserve visual spacing between top-level products where reasonable
  const formattedYaml = dumpedYaml.replace(/\n- id:/g, '\n\n- id:');

  // 6. Parse the serialized YAML in memory
  let inMemoryParsed: any[];
  try {
    inMemoryParsed = yaml.load(formattedYaml) as any[];
  } catch (err: any) {
    throw new Error(`In-memory serialized YAML parsing failed: ${err.message}`);
  }

  // 7. Confirm that the serialized result is valid
  const serializedValidation = validateCatalogIntegrity(inMemoryParsed, 'Serialized in-memory catalog');
  if (!serializedValidation.valid) {
    throw new Error(`Serialized YAML integrity check failed: ${serializedValidation.error}`);
  }
  if (inMemoryParsed.length !== updatedProducts.length) {
    throw new Error(`Serialized product count mismatch (expected ${updatedProducts.length}, got ${inMemoryParsed.length}).`);
  }

  // 8. Write the result to a temporary file in the same directory as products.yml
  const tempFileName = `.products.yml.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tempFilePath = path.join(path.dirname(PRODUCTS_FILE), tempFileName);

  try {
    fs.writeFileSync(tempFilePath, formattedYaml, 'utf8');

    // 9. Verify the temporary file can be read and parsed
    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Temporary file write verification failed: file does not exist.');
    }
    const tempRaw = fs.readFileSync(tempFilePath, 'utf8');
    const tempParsed = yaml.load(tempRaw) as any[];
    const tempValidation = validateCatalogIntegrity(tempParsed, 'Temporary file catalog');
    if (!tempValidation.valid) {
      throw new Error(`Temporary file integrity check failed: ${tempValidation.error}`);
    }
    if (tempParsed.length !== updatedProducts.length) {
      throw new Error(`Temporary file item count mismatch (expected ${updatedProducts.length}, got ${tempParsed.length}).`);
    }

    // 10. Rename the temporary file to products.yml (atomic filesystem rename)
    fs.renameSync(tempFilePath, PRODUCTS_FILE);

    // 11. Read products.yml from disk again
    const postRaw = fs.readFileSync(PRODUCTS_FILE, 'utf8');

    // 12. Parse it again
    let postParsed: any[];
    try {
      postParsed = yaml.load(postRaw) as any[];
    } catch (err: any) {
      throw new Error(`Post-write disk read parse failed: ${err.message}`);
    }

    // 13. Verify the intended operation succeeded (post-write validation)
    const postValidation = validateCatalogIntegrity(postParsed, 'Post-write catalog');
    if (!postValidation.valid) {
      throw new Error(`Post-write integrity check failed: ${postValidation.error}`);
    }

    // Confirm product count is correct
    let expectedCount = currentProducts.length;
    if (action === 'create' || action === 'duplicate') expectedCount = currentProducts.length + 1;
    else if (action === 'delete') expectedCount = currentProducts.length - 1;
    else if (action === 'update') expectedCount = currentProducts.length;
    else if (action === 'restore') expectedCount = updatedProducts.length;

    if (postParsed.length !== expectedCount) {
      throw new Error(`Post-write product count mismatch: expected ${expectedCount}, found ${postParsed.length}.`);
    }

    // Target product checks
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

    // Confirm unrelated products still exist
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

    // 14. Only then return success to the caller
    return {
      success: true,
      backupFile,
      count: postParsed.length
    };
  } finally {
    // Clean up temporary file if it still exists
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  }
}

/**
 * Extracts and consolidates all taxonomies from existing catalog and presets
 */
function extractTaxonomies(products: any[]) {
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

/**
 * Validates product object structure and rules
 */
function validateProduct(
  product: any,
  isNew: boolean,
  currentId?: string,
  existingProducts: any[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ID validation
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

  // Title validation
  if (!product.title || typeof product.title !== 'string' || !product.title.trim()) {
    errors.push('Product title is required.');
  }

  // Vendor validation
  if (!product.vendor || typeof product.vendor !== 'string' || !product.vendor.trim()) {
    errors.push('Vendor name is required.');
  }

  // Price validation
  if (product.priceNumber === undefined || product.priceNumber === null || isNaN(Number(product.priceNumber))) {
    errors.push('Price number is required and must be a valid number.');
  } else if (Number(product.priceNumber) <= 0) {
    errors.push('Price number must be greater than zero.');
  }

  // Category validation
  if (!product.category || typeof product.category !== 'string' || !product.category.trim()) {
    errors.push('Category is required.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 6. GET /api/products - List all products & taxonomy definitions
app.get('/api/products', (req: Request, res: Response) => {
  try {
    const products = readProductsData();
    const taxonomies = extractTaxonomies(products);

    res.json({
      success: true,
      count: products.length,
      products,
      taxonomies
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to load products: ${err.message}`
    });
  }
});

// 7. GET /api/products/:id - Get a single product by ID
app.get('/api/products/:id', (req: Request, res: Response) => {
  try {
    const products = readProductsData();
    const queryId = req.params.id;
    let product = products.find(p => p.id === queryId);

    // If not found by exact ID, attempt lookup by slug or canonical URL slug
    if (!product) {
      const normQuery = queryId.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      product = products.find(p =>
        (p.id && p.id.toLowerCase() === normQuery) ||
        (p.slug && p.slug.toLowerCase() === normQuery) ||
        (p.image && p.image.toLowerCase() === normQuery) ||
        (p.imageType && p.imageType.toLowerCase() === normQuery) ||
        (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normQuery) ||
        (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normQuery}`) || p.vendorUrl.toLowerCase().includes(`/${normQuery}`)))
      );
    }

    // If still not found, check if queryId is a link/reference identifier (such as view-on-shop-24)
    if (!product) {
      product = resolveLinkReferenceToCanonicalProduct(queryId, products);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: `Product with ID "${queryId}" not found.`
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch product: ${err.message}`
    });
  }
});

// 8. POST /api/products - Create a new product
app.post('/api/products', (req: Request, res: Response) => {
  try {
    const rawProduct = req.body;
    const products = readProductsData();

    const validation = validateProduct(rawProduct, true, undefined, products);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(' ')
      });
    }

    // Format fields cleanly
    const numPrice = Number(rawProduct.priceNumber);
    const formattedPrice = rawProduct.price && rawProduct.price.startsWith('$')
      ? rawProduct.price
      : `$${numPrice}`;

    // Auto calculate priceRange if empty
    let priceRange = rawProduct.priceRange;
    if (!priceRange) {
      if (numPrice < 25) priceRange = 'under-25';
      else if (numPrice <= 50) priceRange = '25-50';
      else if (numPrice <= 100) priceRange = '50-100';
      else priceRange = '100-plus';
    }

    // Clean specs
    let cleanedSpecs: any[] | undefined = undefined;
    if (Array.isArray(rawProduct.specs) && rawProduct.specs.length > 0) {
      const validSpecs = rawProduct.specs
        .filter((s: any) => s && (s.label?.trim() || s.value?.trim()))
        .map((s: any) => ({
          label: String(s.label || '').trim(),
          value: String(s.value || '').trim()
        }));
      if (validSpecs.length > 0) {
        cleanedSpecs = validSpecs;
      }
    }

    // Assemble new product preserving all fields
    const newProduct: any = {
      id: rawProduct.id.trim(),
      title: rawProduct.title.trim(),
      image: (rawProduct.image || rawProduct.id).trim(),
      imageType: (rawProduct.imageType || rawProduct.image || rawProduct.id).trim(),
      price: formattedPrice,
      priceNumber: numPrice,
      priceRange,
      vendor: rawProduct.vendor.trim(),
      vendorUrl: (rawProduct.vendorUrl || '').trim(),
      affiliate: {
        sponsored: rawProduct.affiliate?.sponsored ?? true,
        rel: rawProduct.affiliate?.rel || 'noopener noreferrer sponsored'
      },
      category: (rawProduct.category || 'editors-pick').trim(),
      badgeLabel: rawProduct.badgeLabel?.trim() ? rawProduct.badgeLabel.trim() : null,
      recipients: Array.isArray(rawProduct.recipients) ? rawProduct.recipients : [],
      interests: Array.isArray(rawProduct.interests) ? rawProduct.interests : [],
      occasions: Array.isArray(rawProduct.occasions) ? rawProduct.occasions : [],
      ageRanges: Array.isArray(rawProduct.ageRanges) ? rawProduct.ageRanges : [],
      personalityStyles: Array.isArray(rawProduct.personalityStyles) ? rawProduct.personalityStyles : [],
      tags: Array.isArray(rawProduct.tags) ? rawProduct.tags : [],
      editorialReview: (rawProduct.editorialReview || '').trim(),
      whyItMakesAGreatGift: (rawProduct.whyItMakesAGreatGift || '').trim(),
      idealFor: (rawProduct.idealFor || '').trim(),
      whatMakesItStandOut: (rawProduct.whatMakesItStandOut || '').trim(),
      thingsToConsider: (rawProduct.thingsToConsider || '').trim(),
      ...(cleanedSpecs ? { specs: cleanedSpecs } : {})
    };

    // Prepend so the newly added product appears at top of catalog
    const writeResult = executeAtomicProductWrite({
      action: 'create',
      targetId: newProduct.id,
      expectedFieldCheck: { fieldName: 'title', expectedValue: newProduct.title },
      updater: (current) => [newProduct, ...current]
    });

    res.json({
      success: true,
      product: newProduct,
      message: `Product "${newProduct.title}" created successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to create product: ${err.message}`
    });
  }
});

// 9. PUT /api/products/:id - Update an existing product
app.put('/api/products/:id', (req: Request, res: Response) => {
  try {
    const originalId = req.params.id;
    const rawProduct = req.body;
    const products = readProductsData();

    let targetIndex = products.findIndex(p => p.id === originalId);
    if (targetIndex === -1) {
      const normQuery = originalId.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      targetIndex = products.findIndex(p =>
        (p.id && p.id.toLowerCase() === normQuery) ||
        (p.slug && p.slug.toLowerCase() === normQuery) ||
        (p.image && p.image.toLowerCase() === normQuery) ||
        (p.imageType && p.imageType.toLowerCase() === normQuery) ||
        (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normQuery) ||
        (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normQuery}`) || p.vendorUrl.toLowerCase().includes(`/${normQuery}`))) ||
        (p.vendorUrl && rawProduct?.vendorUrl && p.vendorUrl.toLowerCase().replace(/\/+$/, '') === String(rawProduct.vendorUrl).toLowerCase().replace(/\/+$/, ''))
      );
    }
    if (targetIndex === -1) {
      const resolved = resolveLinkReferenceToCanonicalProduct(originalId, products);
      if (resolved) {
        targetIndex = products.findIndex(p => p.id === resolved.id);
      }
    }
    if (targetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Product with ID "${originalId}" not found.`
      });
    }

    const existingItem = products[targetIndex];
    const resolvedOriginalId = existingItem.id;

    const validation = validateProduct(rawProduct, false, resolvedOriginalId, products);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(' ')
      });
    }

    const numPrice = Number(rawProduct.priceNumber);
    const formattedPrice = rawProduct.price && rawProduct.price.startsWith('$')
      ? rawProduct.price
      : `$${numPrice}`;

    let priceRange = rawProduct.priceRange;
    if (!priceRange) {
      if (numPrice < 25) priceRange = 'under-25';
      else if (numPrice <= 50) priceRange = '25-50';
      else if (numPrice <= 100) priceRange = '50-100';
      else priceRange = '100-plus';
    }

    let cleanedSpecs: any[] | undefined = undefined;
    if (Array.isArray(rawProduct.specs) && rawProduct.specs.length > 0) {
      const validSpecs = rawProduct.specs
        .filter((s: any) => s && (s.label?.trim() || s.value?.trim()))
        .map((s: any) => ({
          label: String(s.label || '').trim(),
          value: String(s.value || '').trim()
        }));
      if (validSpecs.length > 0) {
        cleanedSpecs = validSpecs;
      }
    }

    // Merge onto existing item to guarantee preservation of any unexpected/custom fields
    const updatedProduct: any = {
      ...existingItem,
      id: rawProduct.id.trim(),
      title: rawProduct.title !== undefined ? String(rawProduct.title).trim() : existingItem.title,
      image: (rawProduct.image !== undefined && String(rawProduct.image).trim() !== '')
        ? String(rawProduct.image).trim()
        : (existingItem.image || rawProduct.id).trim(),
      imageType: (rawProduct.imageType !== undefined && String(rawProduct.imageType).trim() !== '')
        ? String(rawProduct.imageType).trim()
        : (existingItem.imageType || rawProduct.image || rawProduct.id).trim(),
      price: formattedPrice,
      priceNumber: numPrice,
      priceRange,
      vendor: rawProduct.vendor !== undefined ? String(rawProduct.vendor).trim() : existingItem.vendor,
      vendorUrl: rawProduct.vendorUrl !== undefined ? String(rawProduct.vendorUrl).trim() : (existingItem.vendorUrl || ''),
      affiliate: {
        sponsored: rawProduct.affiliate?.sponsored ?? existingItem.affiliate?.sponsored ?? true,
        rel: rawProduct.affiliate?.rel || existingItem.affiliate?.rel || 'noopener noreferrer sponsored'
      },
      category: (rawProduct.category || existingItem.category || 'editors-pick').trim(),
      badgeLabel: rawProduct.badgeLabel !== undefined ? (rawProduct.badgeLabel?.trim() ? rawProduct.badgeLabel.trim() : null) : (existingItem.badgeLabel || null),
      recipients: Array.isArray(rawProduct.recipients) ? rawProduct.recipients : (existingItem.recipients || []),
      interests: Array.isArray(rawProduct.interests) ? rawProduct.interests : (existingItem.interests || []),
      occasions: Array.isArray(rawProduct.occasions) ? rawProduct.occasions : (existingItem.occasions || []),
      ageRanges: Array.isArray(rawProduct.ageRanges) ? rawProduct.ageRanges : (existingItem.ageRanges || []),
      personalityStyles: Array.isArray(rawProduct.personalityStyles) ? rawProduct.personalityStyles : (existingItem.personalityStyles || []),
      tags: Array.isArray(rawProduct.tags) ? rawProduct.tags : (existingItem.tags || []),
      editorialReview: rawProduct.editorialReview !== undefined ? String(rawProduct.editorialReview).trim() : (existingItem.editorialReview || ''),
      whyItMakesAGreatGift: rawProduct.whyItMakesAGreatGift !== undefined ? String(rawProduct.whyItMakesAGreatGift).trim() : (existingItem.whyItMakesAGreatGift || ''),
      idealFor: rawProduct.idealFor !== undefined ? String(rawProduct.idealFor).trim() : (existingItem.idealFor || ''),
      whatMakesItStandOut: rawProduct.whatMakesItStandOut !== undefined ? String(rawProduct.whatMakesItStandOut).trim() : (existingItem.whatMakesItStandOut || ''),
      thingsToConsider: rawProduct.thingsToConsider !== undefined ? String(rawProduct.thingsToConsider).trim() : (existingItem.thingsToConsider || '')
    };

    if (cleanedSpecs) {
      updatedProduct.specs = cleanedSpecs;
    } else {
      delete updatedProduct.specs;
    }

    let finalUpdatedProduct: any = null;
    const writeResult = executeAtomicProductWrite({
      action: 'update',
      targetId: updatedProduct.id,
      originalId: resolvedOriginalId,
      expectedFieldCheck: { fieldName: 'title', expectedValue: updatedProduct.title },
      updater: (current) => {
        let idx = current.findIndex(p => p.id === resolvedOriginalId);
        if (idx === -1 && resolvedOriginalId !== originalId) {
          idx = current.findIndex(p => p.id === originalId);
        }
        if (idx === -1) {
          throw new Error(`Product with ID "${resolvedOriginalId}" not found during write update.`);
        }
        finalUpdatedProduct = updatedProduct;
        const copy = [...current];
        copy[idx] = updatedProduct;
        return copy;
      }
    });

    res.json({
      success: true,
      product: finalUpdatedProduct || updatedProduct,
      message: `Product "${updatedProduct.title}" updated successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to update product: ${err.message}`
    });
  }
});

// 10. DELETE /api/products/:id - Delete a product by ID
app.delete('/api/products/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const products = readProductsData();

    const targetIndex = products.findIndex(p => p.id === id);
    if (targetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Product with ID "${id}" not found.`
      });
    }

    const removedProduct = products[targetIndex];
    const writeResult = executeAtomicProductWrite({
      action: 'delete',
      targetId: id,
      updater: (current) => {
        const idx = current.findIndex(p => p.id === id);
        if (idx === -1) {
          throw new Error(`Product with ID "${id}" not found.`);
        }
        const copy = [...current];
        copy.splice(idx, 1);
        return copy;
      }
    });

    res.json({
      success: true,
      message: `Product "${removedProduct.title}" (${id}) deleted successfully.`,
      remainingCount: writeResult.count,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to delete product: ${err.message}`
    });
  }
});

// 11. POST /api/products/:id/duplicate - Clone an existing product
app.post('/api/products/:id/duplicate', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const products = readProductsData();

    const original = products.find(p => p.id === id);
    if (!original) {
      return res.status(404).json({
        success: false,
        error: `Product with ID "${id}" not found.`
      });
    }

    // Generate unique duplicate ID
    let newId = `${original.id}-copy`;
    let counter = 2;
    while (products.some(p => p.id === newId)) {
      newId = `${original.id}-copy-${counter}`;
      counter++;
    }

    const cloned = JSON.parse(JSON.stringify(original));
    cloned.id = newId;
    cloned.title = `${original.title} (Copy)`;

    // Insert right after the original item
    const writeResult = executeAtomicProductWrite({
      action: 'duplicate',
      targetId: newId,
      expectedFieldCheck: { fieldName: 'id', expectedValue: newId },
      updater: (current) => {
        const idx = current.findIndex(p => p.id === id);
        if (idx === -1) {
          throw new Error(`Original product "${id}" not found.`);
        }
        const copy = [...current];
        copy.splice(idx + 1, 0, cloned);
        return copy;
      }
    });

    res.json({
      success: true,
      product: cloned,
      message: `Product duplicated as "${newId}".`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to duplicate product: ${err.message}`
    });
  }
});

// 11b. POST /api/products/fetch-image - Fetch product page, extract best product image, download and import to asset library
app.post('/api/products/fetch-image', async (req: Request, res: Response) => {
  try {
    const { url, productId, title } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Direct Product URL is required.'
      });
    }

    const result = await fetchAndImportProductImage(url.trim(), {
      productId: typeof productId === 'string' ? productId.trim() : undefined,
      title: typeof title === 'string' ? title.trim() : undefined,
      jekyllRoot: JEKYLL_ROOT,
      projectRoot: PROJECT_ROOT
    });

    if (!result.success) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch product image: ${err.message}`
    });
  }
});

// 12. GET /api/products-backups - List snapshot backups
app.get('/api/products-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.yml'));
    const backups = files.map(filename => {
      const filePath = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(filePath);
      let productCount = 0;
      try {
        const parsed = yaml.load(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(parsed)) productCount = parsed.length;
      } catch {}

      return {
        filename,
        timestamp: stat.mtime.toISOString(),
        size: stat.size,
        productCount
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. POST /api/products-backups/restore - Restore a previous snapshot
app.post('/api/products-backups/restore', (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'Backup filename is required.' });
    }

    // Prevent directory traversal on filename
    const safeFilename = path.basename(filename);
    const backupFilePath = path.join(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, error: 'Backup snapshot not found.' });
    }

    // Verify valid YAML and catalog structure before restoring
    const backupContent = fs.readFileSync(backupFilePath, 'utf8');
    let parsed: any;
    try {
      parsed = yaml.load(backupContent);
    } catch (err: any) {
      return res.status(400).json({ success: false, error: `Backup file contains invalid YAML: ${err.message}` });
    }

    const backupValidation = validateCatalogIntegrity(parsed, 'Backup snapshot');
    if (!backupValidation.valid) {
      return res.status(400).json({ success: false, error: `Backup integrity check failed: ${backupValidation.error}` });
    }

    // Execute atomic write using the backup content with full pre/post integrity checks
    const writeResult = executeAtomicProductWrite({
      action: 'restore',
      targetId: safeFilename,
      updater: () => parsed
    });

    res.json({
      success: true,
      message: `Restored catalog from "${safeFilename}" (${writeResult.count} products).`,
      count: writeResult.count,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// 14. POST /api/ai/product - CMS Product AI Assistant (Phase 1B)
app.post('/api/ai/product', async (req: Request, res: Response) => {
  try {
    const { operation, product, taxonomy, researchContext, forceRefresh } = req.body || {};
    if (!operation) {
      return res.status(400).json({ success: false, error: 'AI Operation parameter is required.' });
    }
    if (!product || typeof product !== 'object') {
      return res.status(400).json({ success: false, error: 'Product data object is required.' });
    }

    // 1. Fetch Product Page Server-side (if vendorUrl is provided)
    const vendorUrl = String(product.vendorUrl || '').trim();
    let fetchedUrlData: FetchedPageData;
    if (vendorUrl) {
      try {
        fetchedUrlData = await fetchProductPage(vendorUrl);
      } catch (err: any) {
        fetchedUrlData = { fetched: false, error: `Failed to fetch URL: ${err.message}`, url: vendorUrl };
      }
    } else {
      fetchedUrlData = { fetched: false, error: 'No product URL provided.', url: '' };
    }

    if (!fetchedUrlData || typeof fetchedUrlData.fetched !== 'boolean') {
      fetchedUrlData = { fetched: false, error: 'Failed to retrieve product URL.', url: vendorUrl };
    }

    // 2. Read Product Image locally if available
    const imageRef = String(product.image || product.imageType || product.id || '').trim();
    let imageData: ResolvedImageResult;
    try {
      imageData = resolveProductImageBase64(imageRef, JEKYLL_ROOT);
    } catch (err: any) {
      imageData = { found: false, error: `Failed to resolve image: ${err.message}` };
    }

    if (!imageData || typeof imageData.found !== 'boolean') {
      imageData = { found: false };
    }

    // 3. Extract or fallback taxonomy
    const allProducts = readProductsData();
    const activeTaxonomies = taxonomy || extractTaxonomies(allProducts);

    // 4. Execute Product AI Operation (handles research caching and custom settings)
    const aiResult = await executeProductAiOperation({
      operation,
      product,
      taxonomies: activeTaxonomies,
      fetchedUrlData,
      imageData,
      researchContext: researchContext || null,
      forceRefresh: Boolean(forceRefresh),
      jekyllRoot: JEKYLL_ROOT
    });

    res.json(aiResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Server-side Product AI error: ${err.message}`,
      sources: {
        urlFetched: false,
        imageAnalyzed: false
      }
    });
  }
});

/**
 * Helper to build a verified list of real URLs from the site's catalog
 * for internal linking recommendations in AI operations.
 */
function getSiteCatalogForInternalLinking(): CatalogItemRef[] {
  const catalog: CatalogItemRef[] = [];
  try {
    // 1. Articles
    const articlesDir = path.join(JEKYLL_ROOT, '_articles');
    if (fs.existsSync(articlesDir)) {
      const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const slug = file.replace(/\.md$/, '');
        try {
          const content = fs.readFileSync(path.join(articlesDir, file), 'utf8');
          const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (m) {
            const data = yaml.load(m[1]) || {};
            catalog.push({
              url: `/articles/${slug}/`,
              title: data.title || slug,
              type: 'article',
              category: data.category
            });
          }
        } catch {}
      }
    }

    // 2. Guides
    const guidesDir = path.join(JEKYLL_ROOT, '_guides');
    if (fs.existsSync(guidesDir)) {
      const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const slug = file.replace(/\.md$/, '');
        try {
          const content = fs.readFileSync(path.join(guidesDir, file), 'utf8');
          const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (m) {
            const data = yaml.load(m[1]) || {};
            catalog.push({
              url: `/guides/${slug}/`,
              title: data.title || slug,
              type: 'guide',
              category: data.category
            });
          }
        } catch {}
      }
    }

    // 3. Products
    const products = readProductsData();
    if (Array.isArray(products)) {
      for (const p of products.slice(0, 40)) {
        if (p && (p.id || p.title)) {
          catalog.push({
            url: `/products/${p.id || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
            title: p.title || p.id,
            type: 'product',
            category: p.category
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error assembling site catalog for AI internal linking:', err);
  }
  return catalog;
}

// 15. POST /api/ai/article - CMS Article AI Assistant
app.post('/api/ai/article', async (req: Request, res: Response) => {
  try {
    const { operation, article } = req.body || {};
    if (!operation) {
      return res.status(400).json({ success: false, error: 'AI Operation parameter is required.' });
    }
    if (!article || typeof article !== 'object') {
      return res.status(400).json({ success: false, error: 'Article data object is required.' });
    }

    const availableCatalog = getSiteCatalogForInternalLinking();

    const aiResult = await executeArticleAiOperation({
      operation,
      article,
      availableCatalog
    });

    res.json(aiResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Server-side Article AI error: ${err.message}`
    });
  }
});

// 16. POST /api/ai/guide - CMS Gift Guide AI Assistant
app.post('/api/ai/guide', async (req: Request, res: Response) => {
  try {
    const { operation, guide } = req.body || {};
    if (!operation) {
      return res.status(400).json({ success: false, error: 'AI Operation parameter is required.' });
    }
    if (!guide || typeof guide !== 'object') {
      return res.status(400).json({ success: false, error: 'Guide data object is required.' });
    }

    const availableCatalog = getSiteCatalogForInternalLinking();

    const aiResult = await executeGuideAiOperation({
      operation,
      guide,
      availableCatalog
    });

    res.json(aiResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Server-side Gift Guide AI error: ${err.message}`
    });
  }
});

// -------------------------------------------------------------
// GIFT GUIDE MANAGEMENT API (PHASE 3)
// Source of truth: _guides/*.md
// Safe atomic operations with snapshot backups in editor-backups/guides/
// -------------------------------------------------------------

const GUIDES_DIR = path.join(JEKYLL_ROOT, '_guides');
const GUIDES_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'guides');
const AUTHORS_FILE = path.join(JEKYLL_ROOT, '_data', 'authors.yml');

// Ensure directories exist on startup
try {
  if (!fs.existsSync(GUIDES_BACKUPS_DIR)) {
    fs.mkdirSync(GUIDES_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize GUIDES_BACKUPS_DIR:', e);
}

/**
 * Creates a timestamped snapshot backup of a guide file before modification or deletion
 */
function backupGuideFile(slug: string, action: string): string | null {
  try {
    const filePath = path.join(GUIDES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    if (!fs.existsSync(GUIDES_BACKUPS_DIR)) {
      fs.mkdirSync(GUIDES_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `guide_${safeSlug}_${timestamp}_${action}.md`;
    const destPath = path.join(GUIDES_BACKUPS_DIR, filename);
    fs.copyFileSync(filePath, destPath);

    // Retain up to 50 recent backups
    const files = fs.readdirSync(GUIDES_BACKUPS_DIR).filter(f => f.endsWith('.md')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(GUIDES_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create guide backup:', err);
    return null;
  }
}

/**
 * Parses a Jekyll guide markdown file into front matter object and markdown body
 */
function parseGuideFile(slug: string): { frontMatter: any; body: string; raw: string } | null {
  const filePath = path.join(GUIDES_DIR, `${slug}.md`);
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

/**
 * Serializes front matter and markdown body into valid Jekyll Markdown file
 */
function serializeGuideDocument(frontMatter: any, body: string): string {
  const cleanFrontMatter = { ...frontMatter };
  delete cleanFrontMatter.updatedDate;

  // Normalize search-title and seo-description keys
  if (cleanFrontMatter.searchTitle !== undefined && cleanFrontMatter['search-title'] === undefined) {
    cleanFrontMatter['search-title'] = cleanFrontMatter.searchTitle;
  }
  delete cleanFrontMatter.searchTitle;

  if (cleanFrontMatter.seoDescription !== undefined && cleanFrontMatter['seo-description'] === undefined) {
    cleanFrontMatter['seo-description'] = cleanFrontMatter.seoDescription;
  }
  delete cleanFrontMatter.seoDescription;

  if (typeof cleanFrontMatter['search-title'] === 'string') {
    const trimmed = cleanFrontMatter['search-title'].trim();
    if (trimmed) {
      cleanFrontMatter['search-title'] = trimmed;
    } else {
      delete cleanFrontMatter['search-title'];
    }
  } else if (!cleanFrontMatter['search-title']) {
    delete cleanFrontMatter['search-title'];
  }

  if (typeof cleanFrontMatter['seo-description'] === 'string') {
    const trimmed = cleanFrontMatter['seo-description'].trim();
    if (trimmed) {
      cleanFrontMatter['seo-description'] = trimmed;
    } else {
      delete cleanFrontMatter['seo-description'];
    }
  } else if (!cleanFrontMatter['seo-description']) {
    delete cleanFrontMatter['seo-description'];
  }

  let dumpedYaml = yaml.dump(cleanFrontMatter, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });

  // Ensure canonical date values (YYYY-MM-DD) are serialized as double-quoted strings
  dumpedYaml = dumpedYaml.replace(/^(publishedDate|lastModifiedDate):\s*(?:['"]?(\d{4}-\d{2}-\d{2})['"]?)$/gm, '$1: "$2"');

  const cleanBody = (body || '').trim();
  return `---\n${dumpedYaml}---\n${cleanBody ? cleanBody + '\n' : ''}`;
}

/**
 * Validates guide front matter structure without discarding extra fields
 */
function validateGuideFrontMatter(data: any): { valid: boolean; error?: string } {
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
    return { valid: false, error: 'Guide slug must be lowercase alphanumeric with hyphens only (e.g., book-lovers-gifts).' };
  }
  if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
    return { valid: false, error: 'Guide category is required.' };
  }
  if (!data.author || typeof data.author !== 'object' || !data.author.name) {
    return { valid: false, error: 'Guide author object with author name is required.' };
  }
  return { valid: true };
}

/**
 * Complete 14-Step Atomic Guide File Write
 */
function executeAtomicGuideWrite(params: {
  slug: string;
  originalSlug?: string;
  action: 'create' | 'update' | 'restore';
  frontMatter: any;
  body: string;
}): { success: boolean; backupFile: string | null } {
  const { slug, originalSlug, action, frontMatter, body } = params;
  const targetSlug = slug.trim();
  const sourceSlug = (originalSlug || targetSlug).trim();

  const targetFilePath = path.join(GUIDES_DIR, `${targetSlug}.md`);
  const sourceFilePath = path.join(GUIDES_DIR, `${sourceSlug}.md`);

  // Pre-write checks
  if (action === 'update' || action === 'restore') {
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`Guide file "${sourceSlug}.md" does not exist.`);
    }
  } else if (action === 'create') {
    if (fs.existsSync(targetFilePath)) {
      throw new Error(`A guide with slug "${targetSlug}" already exists.`);
    }
  }

  // Pre-write backup if source file exists
  let backupFile: string | null = null;
  if (fs.existsSync(sourceFilePath)) {
    backupFile = backupGuideFile(sourceSlug, action);
    if (!backupFile) {
      throw new Error(`Failed to create pre-write backup for guide "${sourceSlug}".`);
    }
  }

  // Validate front matter
  const val = validateGuideFrontMatter(frontMatter);
  if (!val.valid) {
    throw new Error(val.error);
  }

  // Serialize
  const serialized = serializeGuideDocument(frontMatter, body);

  // In-memory verification
  const inMemoryMatch = serialized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!inMemoryMatch) {
    throw new Error('Serialized guide document failed front-matter delimiter check.');
  }
  const inMemoryParsed = yaml.load(inMemoryMatch[1]);
  const inMemoryVal = validateGuideFrontMatter(inMemoryParsed);
  if (!inMemoryVal.valid) {
    throw new Error('Serialized front matter failed validation: ' + inMemoryVal.error);
  }

  // Temporary file in same directory
  const tempFileName = `.${targetSlug}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.md`;
  const tempFilePath = path.join(GUIDES_DIR, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, serialized, 'utf8');

    // Read and verify temporary file from disk
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

    // Atomic rename
    fs.renameSync(tempFilePath, targetFilePath);

    // If slug changed, delete old file safely
    if (sourceSlug !== targetSlug && fs.existsSync(sourceFilePath)) {
      try { fs.unlinkSync(sourceFilePath); } catch (e) { console.warn('Could not remove old guide file after rename:', e); }
    }

    // Read back target file from disk
    const postRaw = fs.readFileSync(targetFilePath, 'utf8');
    const postMatch = postRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!postMatch) {
      throw new Error('Post-write file delimiter check failed.');
    }
    const postParsed = yaml.load(postMatch[1]);
    if (!postParsed || postParsed.slug !== targetSlug) {
      throw new Error('Post-write verification failed: slug mismatch.');
    }

    return {
      success: true,
      backupFile
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  }
}

// 14. GET /api/authors - List available authors from _data/authors.yml
app.get('/api/authors', (req: Request, res: Response) => {
  try {
    const authorsObj = parseAuthorsFile();
    const authorsList = Object.keys(authorsObj).map(id => {
      const author = authorsObj[id];
      const refs = getAuthorReferences(id, author.name);
      return {
        id,
        ...author,
        guideCount: refs.guideReferences.length,
        articleCount: refs.articleReferences.length
      };
    });

    res.json({
      success: true,
      authors: authorsList,
      authorsMap: authorsObj,
      total: authorsList.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load authors: ${err.message}` });
  }
});

// 15. GET /api/guides - List all gift guides with metadata
app.get('/api/guides', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GUIDES_DIR)) {
      return res.json({ success: true, count: 0, guides: [] });
    }

    const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    const guides = files.map(filename => {
      const slug = filename.replace(/\.md$/, '');
      const filePath = path.join(GUIDES_DIR, filename);
      const stat = fs.statSync(filePath);
      const parsed = parseGuideFile(slug);

      if (!parsed) {
        return {
          slug,
          title: slug,
          category: 'General',
          deck: '',
          readTime: '',
          authorName: 'Science of Gifts Staff',
          productCount: 0,
          budgetSectionCount: 0,
          wordCount: 0,
          fileMtime: stat.mtime.toISOString(),
          robots: null
        };
      }

      const fm = parsed.frontMatter || {};
      let productCount = 0;
      if (fm.editorsPick) productCount += 1;
      if (Array.isArray(fm.quickPicks)) productCount += fm.quickPicks.length;
      if (Array.isArray(fm.budgetSections)) {
        fm.budgetSections.forEach((s: any) => {
          if (Array.isArray(s.products)) productCount += s.products.length;
        });
      }

      const words = parsed.body ? parsed.body.trim().split(/\s+/).filter(Boolean).length : 0;

      return {
        slug: fm.slug || slug,
        title: fm.title || slug,
        category: fm.category || 'General',
        deck: fm.deck || '',
        readTime: fm.readTime || `${Math.ceil(words / 200)} min read`,
        publishedDate: fm.publishedDate || '',
        lastModifiedDate: fm.lastModifiedDate || fm.updatedDate || '',
        authorName: fm.author?.name || 'Science of Gifts Staff',
        authorRole: fm.author?.role || '',
        heroImage: fm.heroImageType || fm.image || fm.slug,
        heroImageAlt: fm.heroImageAlt || '',
        productCount,
        budgetSectionCount: Array.isArray(fm.budgetSections) ? fm.budgetSections.length : 0,
        wordCount: words,
        fileMtime: stat.mtime.toISOString(),
        robots: fm.robots || null
      };
    }).sort((a, b) => new Date(b.fileMtime).getTime() - new Date(a.fileMtime).getTime());

    res.json({
      success: true,
      count: guides.length,
      guides
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to load guides: ${err.message}`
    });
  }
});

// 16. GET /api/guides/:slug - Get full guide details with rendered HTML
app.get('/api/guides/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const parsed = parseGuideFile(slug);
    if (!parsed) {
      return res.status(404).json({
        success: false,
        error: `Guide with slug "${slug}" not found.`
      });
    }

    const words = parsed.body ? parsed.body.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = parsed.body ? parsed.body.length : 0;

    res.json({
      success: true,
      guide: {
        slug,
        frontMatter: parsed.frontMatter,
        body: parsed.body,
        html: marked.parse(parsed.body),
        stats: {
          wordCount: words,
          charCount: chars
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch guide: ${err.message}`
    });
  }
});

// 17. POST /api/guides - Create a new gift guide
app.post('/api/guides', (req: Request, res: Response) => {
  try {
    const { frontMatter, body } = req.body;
    if (!frontMatter || typeof frontMatter !== 'object') {
      return res.status(400).json({ success: false, error: 'Front matter is required.' });
    }

    const slug = String(frontMatter.slug || '').trim();
    const writeResult = executeAtomicGuideWrite({
      slug,
      action: 'create',
      frontMatter,
      body: body || ''
    });

    res.json({
      success: true,
      slug,
      message: `Gift guide "${frontMatter.title}" created successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to create guide: ${err.message}`
    });
  }
});

// 18. PUT /api/guides/:slug - Update an existing gift guide
app.put('/api/guides/:slug', (req: Request, res: Response) => {
  try {
    const originalSlug = req.params.slug;
    const { frontMatter, body } = req.body;

    if (!frontMatter || typeof frontMatter !== 'object') {
      return res.status(400).json({ success: false, error: 'Front matter is required.' });
    }

    // Merge onto existing front matter to preserve any unexposed or custom fields
    const existing = parseGuideFile(originalSlug);
    const existingFrontMatter = existing ? existing.frontMatter : {};
    const mergedFrontMatter = {
      ...existingFrontMatter,
      ...frontMatter,
      // Ensure nested objects merge properly
      author: {
        ...(existingFrontMatter.author || {}),
        ...(frontMatter.author || {})
      }
    };

    const newSlug = String(frontMatter.slug || originalSlug).trim();
    mergedFrontMatter.slug = newSlug;
    delete mergedFrontMatter.updatedDate;

    const writeResult = executeAtomicGuideWrite({
      slug: newSlug,
      originalSlug,
      action: 'update',
      frontMatter: mergedFrontMatter,
      body: body !== undefined ? body : (existing ? existing.body : '')
    });

    res.json({
      success: true,
      slug: newSlug,
      message: `Gift guide "${mergedFrontMatter.title}" updated successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to update guide: ${err.message}`
    });
  }
});

// 19. DELETE /api/guides/:slug - Delete a gift guide with snapshot backup
app.delete('/api/guides/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const filePath = path.join(GUIDES_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `Guide "${slug}.md" not found.` });
    }

    const backupFile = backupGuideFile(slug, 'delete');
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Guide "${slug}" deleted successfully.`,
      backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to delete guide: ${err.message}`
    });
  }
});

// 20. GET /api/guides-backups - List guide snapshot backups
app.get('/api/guides-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GUIDES_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(GUIDES_BACKUPS_DIR).filter(f => f.endsWith('.md'));
    const backups = files.map(filename => {
      const filePath = path.join(GUIDES_BACKUPS_DIR, filename);
      const stat = fs.statSync(filePath);

      // Extract slug from filename (format: guide_[slug]_[timestamp]_[action].md)
      const parts = filename.replace(/\.md$/, '').split('_');
      const slug = parts.length >= 2 ? parts[1] : filename;
      const action = parts.length >= 4 ? parts[parts.length - 1] : 'snapshot';

      return {
        filename,
        timestamp: stat.mtime.toISOString(),
        size: stat.size,
        slug,
        action
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 21. POST /api/guides-backups/restore - Restore a guide from snapshot
app.post('/api/guides-backups/restore', (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'Backup filename is required.' });
    }

    const safeFilename = path.basename(filename);
    const backupFilePath = path.join(GUIDES_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, error: 'Backup snapshot not found.' });
    }

    const raw = fs.readFileSync(backupFilePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Backup file does not contain valid front matter.' });
    }

    const frontMatter = yaml.load(match[1]);
    const body = match[2] || '';
    const slug = frontMatter.slug;

    if (!slug) {
      return res.status(400).json({ success: false, error: 'Backup file is missing guide slug.' });
    }

    const writeResult = executeAtomicGuideWrite({
      slug,
      action: 'restore',
      frontMatter,
      body
    });

    res.json({
      success: true,
      message: `Restored guide "${slug}" from "${safeFilename}".`,
      slug,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// ARTICLE MANAGEMENT API (PHASE 4)
// Source of truth: _articles/*.md
// Safe atomic operations with snapshot backups in editor-backups/articles/
// -------------------------------------------------------------

const ARTICLES_DIR = path.join(JEKYLL_ROOT, '_articles');
const ARTICLES_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'articles');

// Ensure required backup directory exists on startup
try {
  if (!fs.existsSync(ARTICLES_BACKUPS_DIR)) {
    fs.mkdirSync(ARTICLES_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize ARTICLES_BACKUPS_DIR:', e);
}

/**
 * Creates a timestamped snapshot backup of an article file before modification or deletion
 */
function backupArticleFile(slug: string, action: string): string | null {
  try {
    const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    if (!fs.existsSync(ARTICLES_BACKUPS_DIR)) {
      fs.mkdirSync(ARTICLES_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `article_${safeSlug}_${timestamp}_${action}.md`;
    const destPath = path.join(ARTICLES_BACKUPS_DIR, filename);
    fs.copyFileSync(filePath, destPath);

    // Retain up to 50 recent backups
    const files = fs.readdirSync(ARTICLES_BACKUPS_DIR).filter(f => f.endsWith('.md')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(ARTICLES_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create article backup:', err);
    return null;
  }
}

/**
 * Parses a Jekyll article markdown file into front matter object and markdown body
 */
function parseArticleFile(slug: string): { frontMatter: any; body: string; raw: string } | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
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

/**
 * Serializes front matter and markdown body into valid Jekyll Article Markdown file
 */
function serializeArticleDocument(frontMatter: any, body: string): string {
  const cleanFrontMatter = { ...frontMatter };
  delete cleanFrontMatter.updatedDate;

  // Normalize search-title and seo-description keys
  if (cleanFrontMatter.searchTitle !== undefined && cleanFrontMatter['search-title'] === undefined) {
    cleanFrontMatter['search-title'] = cleanFrontMatter.searchTitle;
  }
  delete cleanFrontMatter.searchTitle;

  if (cleanFrontMatter.seoDescription !== undefined && cleanFrontMatter['seo-description'] === undefined) {
    cleanFrontMatter['seo-description'] = cleanFrontMatter.seoDescription;
  }
  delete cleanFrontMatter.seoDescription;

  if (typeof cleanFrontMatter['search-title'] === 'string') {
    const trimmed = cleanFrontMatter['search-title'].trim();
    if (trimmed) {
      cleanFrontMatter['search-title'] = trimmed;
    } else {
      delete cleanFrontMatter['search-title'];
    }
  } else if (!cleanFrontMatter['search-title']) {
    delete cleanFrontMatter['search-title'];
  }

  if (typeof cleanFrontMatter['seo-description'] === 'string') {
    const trimmed = cleanFrontMatter['seo-description'].trim();
    if (trimmed) {
      cleanFrontMatter['seo-description'] = trimmed;
    } else {
      delete cleanFrontMatter['seo-description'];
    }
  } else if (!cleanFrontMatter['seo-description']) {
    delete cleanFrontMatter['seo-description'];
  }

  let dumpedYaml = yaml.dump(cleanFrontMatter, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });

  // Ensure canonical date values (YYYY-MM-DD) are serialized as double-quoted strings
  dumpedYaml = dumpedYaml.replace(/^(publishedDate|lastModifiedDate):\s*(?:['"]?(\d{4}-\d{2}-\d{2})['"]?)$/gm, '$1: "$2"');

  const cleanBody = (body || '').trim();
  return `---\n${dumpedYaml}---\n${cleanBody ? cleanBody + '\n' : ''}`;
}

/**
 * Validates article front matter structure without discarding extra fields
 */
function validateArticleFrontMatter(data: any): { valid: boolean; error?: string } {
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

/**
 * Complete 14-Step Atomic Article File Write
 */
function executeAtomicArticleWrite(params: {
  slug: string;
  originalSlug?: string;
  action: 'create' | 'update' | 'restore';
  frontMatter: any;
  body: string;
}): { success: boolean; backupFile: string | null } {
  const { slug, originalSlug, action, frontMatter, body } = params;
  const targetSlug = slug.trim();
  const sourceSlug = (originalSlug || targetSlug).trim();

  const targetFilePath = path.join(ARTICLES_DIR, `${targetSlug}.md`);
  const sourceFilePath = path.join(ARTICLES_DIR, `${sourceSlug}.md`);

  // Pre-write checks
  if (action === 'update' || action === 'restore') {
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`Article file "${sourceSlug}.md" does not exist.`);
    }
  } else if (action === 'create') {
    if (fs.existsSync(targetFilePath)) {
      throw new Error(`An article with slug "${targetSlug}" already exists.`);
    }
  }

  // Pre-write backup if source file exists
  let backupFile: string | null = null;
  if (fs.existsSync(sourceFilePath)) {
    backupFile = backupArticleFile(sourceSlug, action);
    if (!backupFile) {
      throw new Error(`Failed to create pre-write backup for article "${sourceSlug}".`);
    }
  }

  // Validate front matter
  const val = validateArticleFrontMatter(frontMatter);
  if (!val.valid) {
    throw new Error(val.error);
  }

  // Serialize
  const serialized = serializeArticleDocument(frontMatter, body);

  // In-memory verification
  const inMemoryMatch = serialized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!inMemoryMatch) {
    throw new Error('Serialized article document failed front-matter delimiter check.');
  }
  const inMemoryParsed = yaml.load(inMemoryMatch[1]);
  const inMemoryVal = validateArticleFrontMatter(inMemoryParsed);
  if (!inMemoryVal.valid) {
    throw new Error('Serialized front matter failed validation: ' + inMemoryVal.error);
  }

  // Temporary file in same directory
  const tempFileName = `.${targetSlug}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.md`;
  const tempFilePath = path.join(ARTICLES_DIR, tempFileName);

  try {
    fs.writeFileSync(tempFilePath, serialized, 'utf8');

    // Read and verify temporary file from disk
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

    // Atomic rename
    fs.renameSync(tempFilePath, targetFilePath);

    // If slug changed, delete old file safely
    if (sourceSlug !== targetSlug && fs.existsSync(sourceFilePath)) {
      try { fs.unlinkSync(sourceFilePath); } catch (e) { console.warn('Could not remove old article file after rename:', e); }
    }

    // Read back target file from disk
    const postRaw = fs.readFileSync(targetFilePath, 'utf8');
    const postMatch = postRaw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!postMatch) {
      throw new Error('Post-write file delimiter check failed.');
    }
    const postParsed = yaml.load(postMatch[1]);
    if (!postParsed || postParsed.slug !== targetSlug) {
      throw new Error('Post-write verification failed: slug mismatch.');
    }

    return {
      success: true,
      backupFile
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  }
}

// -------------------------------------------------------------
// ARTICLE API ENDPOINTS
// -------------------------------------------------------------

// GET /api/articles - List all articles
app.get('/api/articles', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(ARTICLES_DIR)) {
      return res.json({ success: true, count: 0, articles: [] });
    }

    const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md') && !f.startsWith('.'));
    const articles = files.map(filename => {
      const slug = filename.replace(/\.md$/, '');
      const filePath = path.join(ARTICLES_DIR, filename);
      const stat = fs.statSync(filePath);
      const parsed = parseArticleFile(slug);

      if (!parsed) {
        return {
          slug,
          title: slug,
          category: 'Editorial',
          deck: '',
          readTime: '',
          publishedDate: '',
          lastModifiedDate: '',
          authorName: 'Science of Gifts Editorial',
          authorRole: '',
          heroImage: slug,
          heroImageAlt: '',
          heroImageCaption: '',
          wordCount: 0,
          sourcesCount: 0,
          relatedGuideSlug: '',
          relatedArticleCount: 0,
          fileMtime: stat.mtime.toISOString(),
          robots: null
        };
      }

      const fm = parsed.frontMatter || {};
      const words = parsed.body ? parsed.body.trim().split(/\s+/).filter(Boolean).length : 0;

      return {
        slug: fm.slug || slug,
        title: fm.title || slug,
        category: fm.category || 'Editorial',
        deck: fm.deck || '',
        readTime: fm.readTime || `${Math.ceil(words / 200)} min read`,
        publishedDate: fm.publishedDate || '',
        lastModifiedDate: fm.lastModifiedDate || fm.updatedDate || '',
        authorName: fm.author?.name || 'Science of Gifts Editorial',
        authorRole: fm.author?.role || '',
        heroImage: fm.heroImageType || fm.image || fm.slug,
        heroImageAlt: fm.heroImageAlt || '',
        heroImageCaption: fm.heroImageCaption || '',
        wordCount: words,
        sourcesCount: Array.isArray(fm.sources) ? fm.sources.length : 0,
        relatedGuideSlug: fm.relatedGuideSlug || '',
        relatedArticleCount: Array.isArray(fm.relatedArticleSlugs) ? fm.relatedArticleSlugs.length : 0,
        fileMtime: stat.mtime.toISOString(),
        robots: fm.robots || null
      };
    }).sort((a, b) => new Date(b.fileMtime).getTime() - new Date(a.fileMtime).getTime());

    res.json({
      success: true,
      count: articles.length,
      articles
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to load articles: ${err.message}`
    });
  }
});

// GET /api/articles/:slug - Get full article details with rendered HTML
app.get('/api/articles/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const parsed = parseArticleFile(slug);
    if (!parsed) {
      return res.status(404).json({
        success: false,
        error: `Article with slug "${slug}" not found.`
      });
    }

    const words = parsed.body ? parsed.body.trim().split(/\s+/).filter(Boolean).length : 0;
    const chars = parsed.body ? parsed.body.length : 0;

    res.json({
      success: true,
      article: {
        slug,
        frontMatter: parsed.frontMatter,
        body: parsed.body,
        html: marked.parse(parsed.body),
        stats: {
          wordCount: words,
          charCount: chars
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch article: ${err.message}`
    });
  }
});

// POST /api/articles - Create a new article
app.post('/api/articles', (req: Request, res: Response) => {
  try {
    const { frontMatter, body } = req.body;
    if (!frontMatter || typeof frontMatter !== 'object') {
      return res.status(400).json({ success: false, error: 'Front matter is required.' });
    }

    const slug = String(frontMatter.slug || '').trim();
    const writeResult = executeAtomicArticleWrite({
      slug,
      action: 'create',
      frontMatter,
      body: body || ''
    });

    res.json({
      success: true,
      slug,
      message: `Article "${frontMatter.title}" created successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to create article: ${err.message}`
    });
  }
});

// PUT /api/articles/:slug - Update an existing article
app.put('/api/articles/:slug', (req: Request, res: Response) => {
  try {
    const originalSlug = req.params.slug;
    const { frontMatter, body } = req.body;

    if (!frontMatter || typeof frontMatter !== 'object') {
      return res.status(400).json({ success: false, error: 'Front matter is required.' });
    }

    // Merge onto existing front matter to preserve any unexposed or custom fields
    const existing = parseArticleFile(originalSlug);
    const existingFrontMatter = existing ? existing.frontMatter : {};
    const mergedFrontMatter = {
      ...existingFrontMatter,
      ...frontMatter,
      // Ensure nested objects merge properly
      author: {
        ...(existingFrontMatter.author || {}),
        ...(frontMatter.author || {})
      },
      introQuote: frontMatter.introQuote !== undefined ? frontMatter.introQuote : existingFrontMatter.introQuote
    };

    const newSlug = String(frontMatter.slug || originalSlug).trim();
    mergedFrontMatter.slug = newSlug;
    delete mergedFrontMatter.updatedDate;

    const writeResult = executeAtomicArticleWrite({
      slug: newSlug,
      originalSlug,
      action: 'update',
      frontMatter: mergedFrontMatter,
      body: body !== undefined ? body : (existing ? existing.body : '')
    });

    res.json({
      success: true,
      slug: newSlug,
      message: `Article "${mergedFrontMatter.title}" updated successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to update article: ${err.message}`
    });
  }
});

// DELETE /api/articles/:slug - Delete an article with snapshot backup
app.delete('/api/articles/:slug', (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const filePath = path.join(ARTICLES_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `Article "${slug}.md" not found.` });
    }

    const backupFile = backupArticleFile(slug, 'delete');
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Article "${slug}" deleted successfully.`,
      backupFile
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to delete article: ${err.message}`
    });
  }
});

// GET /api/articles-backups - List article snapshot backups
app.get('/api/articles-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(ARTICLES_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(ARTICLES_BACKUPS_DIR).filter(f => f.endsWith('.md'));
    const backups = files.map(filename => {
      const filePath = path.join(ARTICLES_BACKUPS_DIR, filename);
      const stat = fs.statSync(filePath);

      const parts = filename.replace(/\.md$/, '').split('_');
      const slug = parts.length >= 2 ? parts[1] : filename;
      const action = parts.length >= 4 ? parts[parts.length - 1] : 'snapshot';

      return {
        filename,
        timestamp: stat.mtime.toISOString(),
        size: stat.size,
        slug,
        action
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/articles-backups/restore - Restore an article from snapshot
app.post('/api/articles-backups/restore', (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'Backup filename is required.' });
    }

    const safeFilename = path.basename(filename);
    const backupFilePath = path.join(ARTICLES_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, error: 'Backup snapshot not found.' });
    }

    const raw = fs.readFileSync(backupFilePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return res.status(400).json({ success: false, error: 'Backup file does not contain valid front matter.' });
    }

    const frontMatter = yaml.load(match[1]);
    const body = match[2] || '';
    const slug = frontMatter.slug;

    if (!slug) {
      return res.status(400).json({ success: false, error: 'Backup file is missing article slug.' });
    }

    const writeResult = executeAtomicArticleWrite({
      slug,
      action: 'restore',
      frontMatter,
      body
    });

    res.json({
      success: true,
      message: `Restored article "${slug}" from "${safeFilename}".`,
      slug,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// COLLECTIONS & TAXONOMY MANAGEMENT API (PHASE 5)
// Source of truth: _data/collections.yml, _data/products.yml, _data/interests.yml
// Safe atomic operations with snapshot backups in editor-backups/collections/
// -------------------------------------------------------------

const COLLECTIONS_FILE = path.join(JEKYLL_ROOT, '_data', 'collections.yml');
const INTERESTS_FILE = path.join(JEKYLL_ROOT, '_data', 'interests.yml');
const COLLECTIONS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'collections');

// Ensure required backup directory exists on startup
try {
  if (!fs.existsSync(COLLECTIONS_BACKUPS_DIR)) {
    fs.mkdirSync(COLLECTIONS_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize COLLECTIONS_BACKUPS_DIR:', e);
}

/**
 * Creates a timestamped snapshot backup of collections.yml
 */
function backupCollectionsFile(action: string): string | null {
  try {
    if (!fs.existsSync(COLLECTIONS_FILE)) return null;
    if (!fs.existsSync(COLLECTIONS_BACKUPS_DIR)) {
      fs.mkdirSync(COLLECTIONS_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `collections_${timestamp}_${action}.yml`;
    const destPath = path.join(COLLECTIONS_BACKUPS_DIR, filename);
    fs.copyFileSync(COLLECTIONS_FILE, destPath);

    // Retain up to 50 recent backups
    const files = fs.readdirSync(COLLECTIONS_BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(COLLECTIONS_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create collections backup:', err);
    return null;
  }
}

/**
 * Parses _data/collections.yml
 */
function parseCollectionsFile(): any {
  if (!fs.existsSync(COLLECTIONS_FILE)) {
    return { gift_guides: [], articles: [], men: [], women: [] };
  }
  const raw = fs.readFileSync(COLLECTIONS_FILE, 'utf8');
  return yaml.load(raw) || { gift_guides: [], articles: [], men: [], women: [] };
}

/**
 * Serializes collections object to valid YAML string
 */
function serializeCollectionsDocument(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

/**
 * Validates collections root structure
 */
function validateCollectionsData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Collections data must be a valid root object.' };
  }
  return { valid: true };
}

/**
 * Complete 14-Step Atomic Collections Write
 */
function executeAtomicCollectionsWrite(data: any, action: string): { success: boolean; backupFile: string | null } {
  const val = validateCollectionsData(data);
  if (!val.valid) {
    throw new Error(val.error);
  }

  // Pre-write backup
  let backupFile: string | null = null;
  if (fs.existsSync(COLLECTIONS_FILE)) {
    backupFile = backupCollectionsFile(action);
    if (!backupFile) {
      throw new Error('Failed to create pre-write backup for collections.yml.');
    }
  }

  // Serialize
  const serialized = serializeCollectionsDocument(data);

  // In-memory verification
  const inMemoryParsed = yaml.load(serialized);
  if (!inMemoryParsed || typeof inMemoryParsed !== 'object') {
    throw new Error('Serialized collections failed in-memory YAML parsing check.');
  }

  // Temporary file
  const tempFileName = `.collections.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.yml`;
  const tempFilePath = path.join(JEKYLL_ROOT, '_data', tempFileName);

  try {
    fs.writeFileSync(tempFilePath, serialized, 'utf8');

    // Verify temp file
    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Temporary file was not written to disk.');
    }
    const tempRaw = fs.readFileSync(tempFilePath, 'utf8');
    const tempParsed = yaml.load(tempRaw);
    if (!tempParsed || typeof tempParsed !== 'object') {
      throw new Error('Temporary file failed YAML parsing check.');
    }

    // Atomic rename
    fs.renameSync(tempFilePath, COLLECTIONS_FILE);

    // Read back target file from disk and verify
    const postRaw = fs.readFileSync(COLLECTIONS_FILE, 'utf8');
    const postParsed = yaml.load(postRaw);
    if (!postParsed || typeof postParsed !== 'object') {
      throw new Error('Post-write file verification failed.');
    }

    return {
      success: true,
      backupFile
    };
  } finally {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch {}
  }
}

// -------------------------------------------------------------
// COLLECTIONS & TAXONOMY API ENDPOINTS
// -------------------------------------------------------------

// Helper to count matching products from products.yml for a collection item
function calculateCollectionMetrics(item: any, section: string, products: any[]): number {
  if (Array.isArray(item.productIds) && item.productIds.length > 0) {
    return item.productIds.length;
  }

  if (section === 'men' || section === 'women') {
    if (item.slug === 'all') {
      return products.length;
    }
    const recs: string[] = Array.isArray(item.recipients) ? item.recipients.map((r: string) => r.toLowerCase()) : [];
    if (recs.length === 0) return 0;
    return products.filter(p => {
      const pRecs: string[] = Array.isArray(p.recipients) ? p.recipients.map((r: string) => String(r).toLowerCase()) : [];
      return recs.some(r => pRecs.includes(r));
    }).length;
  }

  if (section === 'gift_guides' || section === 'articles') {
    if (item.slug === 'all') return products.length;
    return products.filter(p => String(p.category || '').toLowerCase() === String(item.title || item.slug).toLowerCase()).length;
  }

  return 0;
}

// GET /api/collections - List all collection sections and items with calculated stats
app.get('/api/collections', (req: Request, res: Response) => {
  try {
    const rawCollections = parseCollectionsFile();
    const products = readProductsData();

    const flatItems: any[] = [];
    const sectionSummaries: Record<string, number> = {};

    for (const [sectionKey, sectionVal] of Object.entries(rawCollections)) {
      if (Array.isArray(sectionVal)) {
        sectionSummaries[sectionKey] = sectionVal.length;
        for (const item of sectionVal) {
          const matchingCount = calculateCollectionMetrics(item, sectionKey, products);
          flatItems.push({
            ...item,
            section: sectionKey,
            matchingProductCount: matchingCount
          });
        }
      }
    }

    res.json({
      success: true,
      data: rawCollections,
      flatItems,
      sectionSummaries,
      totalCollections: flatItems.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load collections: ${err.message}` });
  }
});

// GET /api/collections/:section/:slug - Get single collection item details with matching products
app.get('/api/collections/:section/:slug', (req: Request, res: Response) => {
  try {
    const { section, slug } = req.params;
    const rawCollections = parseCollectionsFile();
    const products = readProductsData();

    const list = rawCollections[section];
    if (!Array.isArray(list)) {
      return res.status(404).json({ success: false, error: `Section "${section}" not found in collections.yml.` });
    }

    const item = list.find((i: any) => i.slug === slug);
    if (!item) {
      return res.status(404).json({ success: false, error: `Collection "${slug}" not found in section "${section}".` });
    }

    // Get matching products
    let matchingProducts: any[] = [];
    if (section === 'men' || section === 'women') {
      const recs: string[] = Array.isArray(item.recipients) ? item.recipients.map((r: string) => r.toLowerCase()) : [];
      if (item.slug === 'all') {
        matchingProducts = products;
      } else if (recs.length > 0) {
        matchingProducts = products.filter((p: any) => {
          const pRecs: string[] = Array.isArray(p.recipients) ? p.recipients.map((r: string) => String(r).toLowerCase()) : [];
          return recs.some(r => pRecs.includes(r));
        });
      }
    }

    res.json({
      success: true,
      item: {
        ...item,
        section
      },
      matchingProducts,
      matchingCount: matchingProducts.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to fetch collection details: ${err.message}` });
  }
});

// POST /api/collections - Add a new collection into a section
app.post('/api/collections', (req: Request, res: Response) => {
  try {
    const { section, item } = req.body;
    if (!section || !item || !item.title || !item.slug) {
      return res.status(400).json({ success: false, error: 'Section, item title, and slug are required.' });
    }

    const rawCollections = parseCollectionsFile();
    if (!Array.isArray(rawCollections[section])) {
      rawCollections[section] = [];
    }

    const cleanSlug = item.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    if (rawCollections[section].some((i: any) => i.slug === cleanSlug)) {
      return res.status(409).json({ success: false, error: `A collection with slug "${cleanSlug}" already exists in section "${section}".` });
    }

    const newItem = {
      ...item,
      slug: cleanSlug
    };

    rawCollections[section].push(newItem);

    const writeResult = executeAtomicCollectionsWrite(rawCollections, 'add');

    res.json({
      success: true,
      section,
      slug: cleanSlug,
      message: `Collection "${item.title}" created successfully in section "${section}".`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to create collection: ${err.message}` });
  }
});

// PUT /api/collections/:section/:slug - Update an existing collection item, preserving unknown fields
app.put('/api/collections/:section/:slug', (req: Request, res: Response) => {
  try {
    const { section, slug: originalSlug } = req.params;
    const { item } = req.body;

    if (!item || !item.title) {
      return res.status(400).json({ success: false, error: 'Updated collection title is required.' });
    }

    const rawCollections = parseCollectionsFile();
    if (!Array.isArray(rawCollections[section])) {
      return res.status(404).json({ success: false, error: `Section "${section}" not found in collections.yml.` });
    }

    const index = rawCollections[section].findIndex((i: any) => i.slug === originalSlug);
    if (index === -1) {
      return res.status(404).json({ success: false, error: `Collection "${originalSlug}" not found in section "${section}".` });
    }

    const existingItem = rawCollections[section][index];
    const newSlug = (item.slug || originalSlug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');

    // Merge onto existing item to preserve unknown/unexposed fields
    const mergedItem = {
      ...existingItem,
      ...item,
      slug: newSlug
    };

    rawCollections[section][index] = mergedItem;

    const writeResult = executeAtomicCollectionsWrite(rawCollections, 'update');

    res.json({
      success: true,
      section,
      slug: newSlug,
      message: `Collection "${mergedItem.title}" updated successfully in section "${section}".`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update collection: ${err.message}` });
  }
});

// DELETE /api/collections/:section/:slug - Delete a collection item with snapshot backup
app.delete('/api/collections/:section/:slug', (req: Request, res: Response) => {
  try {
    const { section, slug } = req.params;
    const rawCollections = parseCollectionsFile();

    if (!Array.isArray(rawCollections[section])) {
      return res.status(404).json({ success: false, error: `Section "${section}" not found.` });
    }

    const index = rawCollections[section].findIndex((i: any) => i.slug === slug);
    if (index === -1) {
      return res.status(404).json({ success: false, error: `Collection "${slug}" not found in section "${section}".` });
    }

    rawCollections[section].splice(index, 1);

    const writeResult = executeAtomicCollectionsWrite(rawCollections, 'delete');

    res.json({
      success: true,
      section,
      slug,
      message: `Collection "${slug}" deleted from section "${section}".`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to delete collection: ${err.message}` });
  }
});

// GET /api/collections-backups - List collections snapshot backups
app.get('/api/collections-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(COLLECTIONS_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(COLLECTIONS_BACKUPS_DIR).filter(f => f.endsWith('.yml'));
    const backups = files.map(filename => {
      const filePath = path.join(COLLECTIONS_BACKUPS_DIR, filename);
      const stat = fs.statSync(filePath);

      const parts = filename.replace(/\.yml$/, '').split('_');
      const action = parts.length >= 3 ? parts[parts.length - 1] : 'snapshot';

      return {
        filename,
        timestamp: stat.mtime.toISOString(),
        size: stat.size,
        action
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/collections-backups/restore - Restore collections.yml from backup
app.post('/api/collections-backups/restore', (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ success: false, error: 'Backup filename is required.' });
    }

    const safeFilename = path.basename(filename);
    const backupFilePath = path.join(COLLECTIONS_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupFilePath)) {
      return res.status(404).json({ success: false, error: 'Backup snapshot file not found.' });
    }

    const raw = fs.readFileSync(backupFilePath, 'utf8');
    const parsed = yaml.load(raw);

    const writeResult = executeAtomicCollectionsWrite(parsed, 'restore');

    res.json({
      success: true,
      message: `Restored collections.yml from "${safeFilename}".`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// GET /api/taxonomies - Returns derived taxonomy lists from products.yml & interests.yml
app.get('/api/taxonomies', (req: Request, res: Response) => {
  try {
    const products = readProductsData();
    let interests: any[] = [];
    if (fs.existsSync(INTERESTS_FILE)) {
      try {
        interests = yaml.load(fs.readFileSync(INTERESTS_FILE, 'utf8')) || [];
      } catch {}
    }

    const recipientCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    for (const p of products) {
      if (Array.isArray(p.recipients)) {
        for (const r of p.recipients) {
          const tag = String(r).toLowerCase().trim();
          if (tag) recipientCounts.set(tag, (recipientCounts.get(tag) || 0) + 1);
        }
      }
      if (p.category) {
        const cat = String(p.category).trim();
        if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    }

    const recipientList = Array.from(recipientCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const categoryList = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      recipients: recipientList,
      categories: categoryList,
      interests
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load taxonomies: ${err.message}` });
  }
});

// -------------------------------------------------------------
// PHASE 3.5: ASSET MANAGER MODULE & LOCAL IMAGE PIPELINE
// -------------------------------------------------------------

const ASSETS_IMAGES_DIR = path.join(JEKYLL_ROOT, 'assets', 'images');
const ASSETS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'assets');

// Ensure required directories exist on startup
try {
  if (!fs.existsSync(ASSETS_IMAGES_DIR)) {
    fs.mkdirSync(ASSETS_IMAGES_DIR, { recursive: true });
  }
  if (!fs.existsSync(ASSETS_BACKUPS_DIR)) {
    fs.mkdirSync(ASSETS_BACKUPS_DIR, { recursive: true });
  }
} catch (e: any) {
  console.warn('Notice: Could not initialize asset directories:', e.message);
}

// Memory cache for image dimensions to keep library snappy
const assetDimensionCache = new Map<string, { mtime: number; width: number; height: number }>();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validates and sanitizes asset filenames.
 * Rejects path traversal, null bytes, and unauthorized file extensions.
 */
function validateAssetSecurity(filename: string): {
  valid: boolean;
  sanitizedFilename: string;
  ext: string;
  baseName: string;
  absolutePath: string;
  error?: string;
} {
  if (!filename || typeof filename !== 'string') {
    return { valid: false, sanitizedFilename: '', ext: '', baseName: '', absolutePath: '', error: 'Filename is required' };
  }

  // Reject path traversal and dangerous characters
  if (
    filename.includes('\0') ||
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('%')
  ) {
    return { valid: false, sanitizedFilename: '', ext: '', baseName: '', absolutePath: '', error: 'Path traversal or invalid path characters detected' };
  }

  const rawExt = path.extname(filename).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  if (!allowed.includes(rawExt)) {
    return { valid: false, sanitizedFilename: '', ext: '', baseName: '', absolutePath: '', error: `Unsupported image format (${rawExt}). Supported: JPG, PNG, WebP, SVG` };
  }

  const rawBase = path.basename(filename, rawExt);
  let sanitizedBase = rawBase
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-');

  if (!sanitizedBase) {
    sanitizedBase = 'asset';
  }

  const sanitizedFilename = `${sanitizedBase}${rawExt}`;
  const absolutePath = path.join(ASSETS_IMAGES_DIR, sanitizedFilename);

  // Strict containment boundary check
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(ASSETS_IMAGES_DIR) && !resolved.startsWith(ASSETS_ROOT_DIR)) {
    return { valid: false, sanitizedFilename: '', ext: '', baseName: '', absolutePath: '', error: 'Asset path must be inside assets directory' };
  }

  return {
    valid: true,
    sanitizedFilename,
    ext: rawExt,
    baseName: sanitizedBase,
    absolutePath: resolved
  };
}

/**
 * Reads dimensions using ImageMagick identify with memory mtime caching
 */
function getAssetDimensions(filePath: string): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    const cached = assetDimensionCache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) {
      return { width: cached.width, height: cached.height };
    }

    const ext = path.extname(filePath).toLowerCase();

    // 1. For SVG files, parse dimensions directly from SVG XML/text without calling ImageMagick delegate
    if (ext === '.svg') {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const widthMatch = content.match(/width=["']([0-9.]+)(?:px)?["']/i);
        const heightMatch = content.match(/height=["']([0-9.]+)(?:px)?["']/i);
        if (widthMatch && heightMatch) {
          const width = Math.round(parseFloat(widthMatch[1]));
          const height = Math.round(parseFloat(heightMatch[1]));
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            assetDimensionCache.set(filePath, { mtime: stats.mtimeMs, width, height });
            return { width, height };
          }
        }
        const viewBoxMatch = content.match(/viewBox=["']\s*([0-9.-]+)\s+([0-9.-]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
        if (viewBoxMatch) {
          const width = Math.round(parseFloat(viewBoxMatch[3]));
          const height = Math.round(parseFloat(viewBoxMatch[4]));
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            assetDimensionCache.set(filePath, { mtime: stats.mtimeMs, width, height });
            return { width, height };
          }
        }
      } catch {}
      return null;
    }

    // 2. For raster images, invoke ImageMagick identify with suppressed stderr to prevent delegate errors
    const output = execFileSync('identify', ['-format', '%w %h', filePath], {
      timeout: 3000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    const parts = output.split(/\s+/);
    if (parts.length >= 2) {
      const width = parseInt(parts[0], 10);
      const height = parseInt(parts[1], 10);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        assetDimensionCache.set(filePath, { mtime: stats.mtimeMs, width, height });
        return { width, height };
      }
    }
  } catch {
    // Graceful fallback if identify fails
  }
  return null;
}

/**
 * Generates WebP and thumbnail derivatives matching _plugins/image_converter.rb exactly
 */
function generateAssetDerivatives(srcPath: string): { webpCreated: boolean; thumbCreated: boolean; error?: string } {
  const ext = path.extname(srcPath).toLowerCase();
  
  // Vector SVGs do not need raster WebP or thumbnail derivatives
  if (ext === '.svg') {
    return { webpCreated: false, thumbCreated: false };
  }

  const baseWithoutExt = srcPath.slice(0, -ext.length);
  const webpPath = `${baseWithoutExt}.webp`;
  const thumbPath = `${baseWithoutExt}-thumb.webp`;

  let webpCreated = false;
  let thumbCreated = false;

  try {
    // 1. WebP conversion at quality 85 (same as Jekyll plugin)
    if (!fs.existsSync(webpPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(webpPath).mtimeMs) {
      execFileSync('convert', [srcPath, '-quality', '85', webpPath], {
        stdio: ['ignore', 'ignore', 'ignore']
      });
      webpCreated = true;
    }
  } catch (err: any) {
    console.warn(`WebP conversion failed for ${srcPath}:`, err.message);
  }

  try {
    // 2. Thumbnail version max 800x600 at quality 82 (same as Jekyll plugin)
    if (!fs.existsSync(thumbPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(thumbPath).mtimeMs) {
      execFileSync('convert', [srcPath, '-resize', '800x600>', '-quality', '82', thumbPath], {
        stdio: ['ignore', 'ignore', 'ignore']
      });
      thumbCreated = true;
    }
  } catch (err: any) {
    console.warn(`Thumbnail generation failed for ${srcPath}:`, err.message);
  }

  return { webpCreated, thumbCreated };
}

/**
 * Scans _guides/, _articles/, and _data/products.yml for references to an asset
 */
function scanAssetReferences(assetBaseName: string, assetFilename: string): Array<{
  type: 'guide' | 'article' | 'product' | 'page' | 'author';
  id: string;
  title: string;
  file: string;
}> {
  const references: Array<{ type: 'guide' | 'article' | 'product' | 'page' | 'author'; id: string; title: string; file: string }> = [];

  try {
    // 1. Scan guides
    const guidesDir = path.join(JEKYLL_ROOT, '_guides');
    if (fs.existsSync(guidesDir)) {
      const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(guidesDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        if (
          content.includes(assetBaseName) ||
          content.includes(assetFilename) ||
          content.includes(`images/${assetFilename}`)
        ) {
          let title = file.replace(/\.md$/, '');
          const titleMatch = content.match(/^title:\s*["']?([^"\n\r]+)["']?/m);
          if (titleMatch) title = titleMatch[1];
          references.push({
            type: 'guide',
            id: file.replace(/\.md$/, ''),
            title,
            file: `_guides/${file}`
          });
        }
      }
    }

    // 2. Scan articles
    const articlesDir = path.join(JEKYLL_ROOT, '_articles');
    if (fs.existsSync(articlesDir)) {
      const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const fullPath = path.join(articlesDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        if (
          content.includes(assetBaseName) ||
          content.includes(assetFilename) ||
          content.includes(`images/${assetFilename}`)
        ) {
          let title = file.replace(/\.md$/, '');
          const titleMatch = content.match(/^title:\s*["']?([^"\n\r]+)["']?/m);
          if (titleMatch) title = titleMatch[1];
          references.push({
            type: 'article',
            id: file.replace(/\.md$/, ''),
            title,
            file: `_articles/${file}`
          });
        }
      }
    }

    // 3. Scan products.yml
    const productsFile = path.join(JEKYLL_ROOT, '_data', 'products.yml');
    if (fs.existsSync(productsFile)) {
      const rawProducts = fs.readFileSync(productsFile, 'utf8');
      const parsed = yaml.load(rawProducts);
      if (Array.isArray(parsed)) {
        for (const prod of parsed) {
          const imgField = String(prod.image || prod.imageType || '');
          if (
            imgField === assetBaseName ||
            imgField === assetFilename ||
            imgField.includes(assetBaseName) ||
            (prod.id && prod.id === assetBaseName)
          ) {
            references.push({
              type: 'product',
              id: prod.id || 'product',
              title: prod.title || prod.id,
              file: '_data/products.yml'
            });
          }
        }
      }
    }

    // 4. Scan homepage (index.md)
    const homepageFile = path.join(JEKYLL_ROOT, 'index.md');
    if (fs.existsSync(homepageFile)) {
      const homeRaw = fs.readFileSync(homepageFile, 'utf8');
      if (homeRaw.includes(assetBaseName) || homeRaw.includes(assetFilename)) {
        references.push({
          type: 'page',
          id: 'homepage',
          title: 'Homepage Hero & Index',
          file: 'index.md'
        });
      }
    }

    // 5. Scan authors.yml
    const authorsFile = path.join(JEKYLL_ROOT, '_data', 'authors.yml');
    if (fs.existsSync(authorsFile)) {
      const authRaw = fs.readFileSync(authorsFile, 'utf8');
      if (authRaw.includes(assetBaseName) || authRaw.includes(assetFilename)) {
        references.push({
          type: 'author',
          id: 'authors',
          title: 'Editorial Authors Directory',
          file: '_data/authors.yml'
        });
      }
    }
  } catch (err: any) {
    console.warn('Notice: Error scanning asset references:', err.message);
  }

  // Deduplicate by file + id
  const seen = new Set<string>();
  return references.filter(ref => {
    const key = `${ref.file}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Discovers and parses all assets in approved directories (assets/images and assets)
 */
function discoverAllAssets(): {
  assets: any[];
  stats: {
    totalAssets: number;
    sourceCount: number;
    webpCount: number;
    thumbCount: number;
    inUseCount: number;
    unusedCount: number;
    totalSize: number;
    formattedTotalSize: string;
  };
} {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  const allFoundFiles: Array<{ filename: string; dir: string; fullPath: string }> = [];

  // 1. Scan assets/images/
  if (fs.existsSync(ASSETS_IMAGES_DIR)) {
    const files = fs.readdirSync(ASSETS_IMAGES_DIR);
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        allFoundFiles.push({ filename: f, dir: 'assets/images', fullPath: path.join(ASSETS_IMAGES_DIR, f) });
      }
    }
  }

  // 2. Scan top-level assets/ (excluding subdirectories like css, js, logos, images)
  if (fs.existsSync(ASSETS_ROOT_DIR)) {
    const topFiles = fs.readdirSync(ASSETS_ROOT_DIR);
    for (const f of topFiles) {
      const fullPath = path.join(ASSETS_ROOT_DIR, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const ext = path.extname(f).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            // Avoid duplicate entry if same filename already present in assets/images/
            if (!allFoundFiles.some(item => item.filename === f)) {
              allFoundFiles.push({ filename: f, dir: 'assets', fullPath });
            }
          }
        }
      } catch {}
    }
  }

  // Build lookup maps for derivatives
  const filesSet = new Set(allFoundFiles.map(f => f.filename));

  const primaryAssets: any[] = [];
  let totalBytes = 0;
  let sourceCount = 0;
  let webpCount = 0;
  let thumbCount = 0;
  let inUseCount = 0;
  let unusedCount = 0;

  for (const item of allFoundFiles) {
    const ext = path.extname(item.filename).toLowerCase();
    const baseWithoutExt = path.basename(item.filename, ext);

    // Filter out pure derivatives from primary list
    // A: *-thumb.webp is always a thumbnail derivative
    if (item.filename.endsWith('-thumb.webp')) {
      thumbCount++;
      continue;
    }

    // B: .webp is a derivative if a corresponding .jpg, .jpeg, or .png exists
    if (ext === '.webp') {
      const hasJpg = filesSet.has(`${baseWithoutExt}.jpg`) || filesSet.has(`${baseWithoutExt}.jpeg`);
      const hasPng = filesSet.has(`${baseWithoutExt}.png`);
      if (hasJpg || hasPng) {
        webpCount++;
        continue;
      }
    }

    // This is a PRIMARY ASSET (Source JPG/PNG, Standalone WebP, or SVG vector)
    try {
      const stat = fs.statSync(item.fullPath);
      totalBytes += stat.size;
      sourceCount++;

      let format: 'JPG' | 'PNG' | 'WebP' | 'SVG' | 'OTHER' = 'OTHER';
      if (ext === '.jpg' || ext === '.jpeg') format = 'JPG';
      else if (ext === '.png') format = 'PNG';
      else if (ext === '.webp') {
        format = 'WebP';
        webpCount++;
      } else if (ext === '.svg') format = 'SVG';

      // Check existing derivatives for this asset
      const derivatives: {
        webp?: { exists: boolean; path: string; size?: number; formattedSize?: string; url?: string };
        thumb?: { exists: boolean; path: string; size?: number; formattedSize?: string; url?: string };
      } = {};

      const candidateWebp = `${baseWithoutExt}.webp`;
      const candidateThumb = `${baseWithoutExt}-thumb.webp`;

      if (filesSet.has(candidateWebp)) {
        const webpAbs = path.join(item.dir === 'assets/images' ? ASSETS_IMAGES_DIR : ASSETS_ROOT_DIR, candidateWebp);
        if (fs.existsSync(webpAbs)) {
          const wStat = fs.statSync(webpAbs);
          derivatives.webp = {
            exists: true,
            path: `${item.dir}/${candidateWebp}`,
            url: `/${item.dir}/${candidateWebp}`,
            size: wStat.size,
            formattedSize: formatBytes(wStat.size)
          };
        }
      }

      if (filesSet.has(candidateThumb)) {
        const thumbAbs = path.join(item.dir === 'assets/images' ? ASSETS_IMAGES_DIR : ASSETS_ROOT_DIR, candidateThumb);
        if (fs.existsSync(thumbAbs)) {
          const tStat = fs.statSync(thumbAbs);
          derivatives.thumb = {
            exists: true,
            path: `${item.dir}/${candidateThumb}`,
            url: `/${item.dir}/${candidateThumb}`,
            size: tStat.size,
            formattedSize: formatBytes(tStat.size)
          };
        }
      }

      const dimensions = getAssetDimensions(item.fullPath);
      const usedBy = scanAssetReferences(baseWithoutExt, item.filename);

      if (usedBy.length > 0) {
        inUseCount++;
      } else {
        unusedCount++;
      }

      primaryAssets.push({
        id: `${item.dir}/${item.filename}`,
        filename: item.filename,
        name: baseWithoutExt,
        ext,
        format,
        directory: item.dir,
        relativePath: `${item.dir}/${item.filename}`,
        publicUrl: `/${item.dir}/${item.filename}`,
        size: stat.size,
        formattedSize: formatBytes(stat.size),
        mtime: stat.mtime.toISOString(),
        dimensions,
        isDerivative: false,
        derivativeOf: null,
        derivatives,
        usedBy
      });
    } catch (e: any) {
      console.warn(`Could not process asset ${item.fullPath}:`, e.message);
    }
  }

  return {
    assets: primaryAssets,
    stats: {
      totalAssets: primaryAssets.length,
      sourceCount,
      webpCount,
      thumbCount,
      inUseCount,
      unusedCount,
      totalSize: totalBytes,
      formattedTotalSize: formatBytes(totalBytes)
    }
  };
}

// Multer memory storage configuration for file uploads (max 15MB)
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 Megabytes limit
  }
});

/**
 * GET /api/assets
 * Lists all assets with search, filtering, and sorting
 */
app.get('/api/assets', (req: Request, res: Response) => {
  try {
    const { assets, stats } = discoverAllAssets();
    const search = String(req.query.search || '').toLowerCase().trim();
    const filter = String(req.query.filter || 'all').toLowerCase();
    const sort = String(req.query.sort || 'newest').toLowerCase();

    let filtered = assets;

    // Search filter
    if (search) {
      filtered = filtered.filter(a =>
        a.filename.toLowerCase().includes(search) ||
        a.name.toLowerCase().includes(search) ||
        a.relativePath.toLowerCase().includes(search) ||
        a.usedBy.some((u: any) => u.title.toLowerCase().includes(search))
      );
    }

    // Type / Status filter
    if (filter === 'source') {
      filtered = filtered.filter(a => a.format === 'JPG' || a.format === 'PNG');
    } else if (filter === 'webp') {
      filtered = filtered.filter(a => a.format === 'WebP');
    } else if (filter === 'svg') {
      filtered = filtered.filter(a => a.format === 'SVG');
    } else if (filter === 'in_use') {
      filtered = filtered.filter(a => a.usedBy.length > 0);
    } else if (filter === 'unused') {
      filtered = filtered.filter(a => a.usedBy.length === 0);
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sort === 'oldest') {
        return new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
      } else if (sort === 'name_asc') {
        return a.filename.localeCompare(b.filename);
      } else if (sort === 'name_desc') {
        return b.filename.localeCompare(a.filename);
      } else if (sort === 'size_desc') {
        return b.size - a.size;
      } else if (sort === 'size_asc') {
        return a.size - b.size;
      }
      // Default: newest first
      return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
    });

    res.json({
      success: true,
      assets: filtered,
      totalCount: filtered.length,
      stats
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load assets: ${err.message}` });
  }
});

/**
 * GET /api/assets/usage/:filename
 * Scans usage references across guides, articles, and products
 */
app.get('/api/assets/usage/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const val = validateAssetSecurity(filename);
  if (!val.valid) {
    return res.status(400).json({ success: false, error: val.error });
  }

  const references = scanAssetReferences(val.baseName, val.sanitizedFilename);
  res.json({
    success: true,
    filename: val.sanitizedFilename,
    references,
    inUse: references.length > 0
  });
});

/**
 * POST /api/assets/check-exists
 * Checks if a filename already exists before uploading
 */
app.post('/api/assets/check-exists', (req: Request, res: Response) => {
  const { filename } = req.body;
  const val = validateAssetSecurity(filename);
  if (!val.valid) {
    return res.status(400).json({ success: false, error: val.error });
  }

  const exists = fs.existsSync(val.absolutePath);
  res.json({
    success: true,
    exists,
    sanitizedFilename: val.sanitizedFilename,
    originalFilename: filename
  });
});

/**
 * POST /api/assets/upload
 * Handles browser-based image uploads with duplicate conflict resolution
 */
app.post('/api/assets/upload', assetUpload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided.' });
    }

    const originalName = req.file.originalname || 'uploaded-image.jpg';
    const val = validateAssetSecurity(originalName);
    if (!val.valid) {
      return res.status(400).json({ success: false, error: val.error });
    }

    const action = String(req.body.action || '').toLowerCase(); // 'replace' | 'keep_both' | ''
    let finalFilename = val.sanitizedFilename;
    let finalPath = val.absolutePath;

    // Check if target file already exists
    if (fs.existsSync(finalPath)) {
      if (action === 'replace') {
        // Create backup of existing file in editor-backups/assets/
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `${val.baseName}_${timestamp}${val.ext}`;
        const backupPath = path.join(ASSETS_BACKUPS_DIR, backupName);
        fs.copyFileSync(finalPath, backupPath);

        // Also backup WebP derivative if it exists
        const oldWebp = path.join(ASSETS_IMAGES_DIR, `${val.baseName}.webp`);
        if (fs.existsSync(oldWebp)) {
          fs.copyFileSync(oldWebp, path.join(ASSETS_BACKUPS_DIR, `${val.baseName}_${timestamp}.webp`));
        }
      } else if (action === 'keep_both') {
        // Generate unique filename: photo-1.jpg, photo-2.jpg, etc.
        let counter = 1;
        while (fs.existsSync(finalPath)) {
          finalFilename = `${val.baseName}-${counter}${val.ext}`;
          finalPath = path.join(ASSETS_IMAGES_DIR, finalFilename);
          counter++;
        }
      } else {
        // Conflict! Require explicit user decision
        return res.status(409).json({
          success: false,
          conflict: true,
          filename: val.sanitizedFilename,
          message: `An asset named "${val.sanitizedFilename}" already exists. Please choose Replace, Keep Both, or Cancel.`
        });
      }
    }

    // Atomic write to temporary file first, then rename
    const tempPath = `${finalPath}.tmp-${Date.now()}`;
    fs.writeFileSync(tempPath, req.file.buffer);

    // Verify temp file written successfully
    const tempStat = fs.statSync(tempPath);
    if (tempStat.size !== req.file.buffer.length) {
      fs.unlinkSync(tempPath);
      return res.status(500).json({ success: false, error: 'Asset write verification failed.' });
    }

    // Rename temp file to final location
    fs.renameSync(tempPath, finalPath);

    // Also sync to top-level assets/ for backward-compatibility with older layouts
    try {
      const topLevelPath = path.join(ASSETS_ROOT_DIR, finalFilename);
      fs.copyFileSync(finalPath, topLevelPath);
    } catch {}

    // Auto-generate WebP and Thumbnail derivatives via ImageMagick pipeline
    const derivativeResult = generateAssetDerivatives(finalPath);

    // If derivatives created, also sync to top-level assets/
    try {
      const base = path.basename(finalFilename, path.extname(finalFilename));
      const webpPath = path.join(ASSETS_IMAGES_DIR, `${base}.webp`);
      const thumbPath = path.join(ASSETS_IMAGES_DIR, `${base}-thumb.webp`);
      if (fs.existsSync(webpPath)) fs.copyFileSync(webpPath, path.join(ASSETS_ROOT_DIR, `${base}.webp`));
      if (fs.existsSync(thumbPath)) fs.copyFileSync(thumbPath, path.join(ASSETS_ROOT_DIR, `${base}-thumb.webp`));
    } catch {}

    // Invalidate dimension cache for this file
    assetDimensionCache.delete(finalPath);
    const dimensions = getAssetDimensions(finalPath);

    res.json({
      success: true,
      filename: finalFilename,
      relativePath: `assets/images/${finalFilename}`,
      publicUrl: `/assets/images/${finalFilename}`,
      dimensions,
      derivatives: derivativeResult,
      message: `Asset "${finalFilename}" uploaded successfully.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
  }
});

/**
 * POST /api/assets/generate-derivatives
 * Triggers ImageMagick conversion for a single asset or all missing derivatives
 */
app.post('/api/assets/generate-derivatives', (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    let convertedCount = 0;
    let thumbCount = 0;

    if (filename) {
      const val = validateAssetSecurity(filename);
      if (!val.valid) {
        return res.status(400).json({ success: false, error: val.error });
      }
      if (!fs.existsSync(val.absolutePath)) {
        return res.status(404).json({ success: false, error: `Asset "${filename}" not found.` });
      }
      const resVal = generateAssetDerivatives(val.absolutePath);
      if (resVal.webpCreated) convertedCount++;
      if (resVal.thumbCreated) thumbCount++;
    } else {
      // Run across all source assets in assets/images/
      const files = fs.readdirSync(ASSETS_IMAGES_DIR);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && !f.endsWith('-thumb.webp')) {
          const fullPath = path.join(ASSETS_IMAGES_DIR, f);
          const resVal = generateAssetDerivatives(fullPath);
          if (resVal.webpCreated) convertedCount++;
          if (resVal.thumbCreated) thumbCount++;
        }
      }
    }

    res.json({
      success: true,
      convertedCount,
      thumbCount,
      message: `Derivative generation complete: ${convertedCount} WebP conversions, ${thumbCount} thumbnails generated.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Derivative generation failed: ${err.message}` });
  }
});

/**
 * DELETE /api/assets/:filename
 * Safely removes a source asset after creating an automatic backup in editor-backups/assets/
 */
app.delete('/api/assets/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const cleanupDerivatives = req.query.cleanupDerivatives === 'true';

    const val = validateAssetSecurity(filename);
    if (!val.valid) {
      return res.status(400).json({ success: false, error: val.error });
    }

    if (!fs.existsSync(val.absolutePath)) {
      return res.status(404).json({ success: false, error: `Asset "${filename}" does not exist.` });
    }

    // 1. Create timestamped snapshot backup in editor-backups/assets/
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${val.baseName}_${timestamp}${val.ext}`;
    const backupPath = path.join(ASSETS_BACKUPS_DIR, backupName);
    fs.copyFileSync(val.absolutePath, backupPath);

    // 2. Remove source asset
    fs.unlinkSync(val.absolutePath);
    assetDimensionCache.delete(val.absolutePath);

    // Also remove from top-level assets/ if it was mirrored there
    try {
      const topLevelPath = path.join(ASSETS_ROOT_DIR, val.sanitizedFilename);
      if (fs.existsSync(topLevelPath)) {
        fs.unlinkSync(topLevelPath);
      }
    } catch {}

    let derivativesCleaned = 0;
    if (cleanupDerivatives) {
      const webpPath = path.join(ASSETS_IMAGES_DIR, `${val.baseName}.webp`);
      const thumbPath = path.join(ASSETS_IMAGES_DIR, `${val.baseName}-thumb.webp`);

      if (fs.existsSync(webpPath)) {
        // Backup derivative before removing
        fs.copyFileSync(webpPath, path.join(ASSETS_BACKUPS_DIR, `${val.baseName}_${timestamp}.webp`));
        fs.unlinkSync(webpPath);
        derivativesCleaned++;
      }
      if (fs.existsSync(thumbPath)) {
        fs.copyFileSync(thumbPath, path.join(ASSETS_BACKUPS_DIR, `${val.baseName}_${timestamp}-thumb.webp`));
        fs.unlinkSync(thumbPath);
        derivativesCleaned++;
      }

      // Also clean up top-level mirrors
      try {
        const topWebp = path.join(ASSETS_ROOT_DIR, `${val.baseName}.webp`);
        const topThumb = path.join(ASSETS_ROOT_DIR, `${val.baseName}-thumb.webp`);
        if (fs.existsSync(topWebp)) fs.unlinkSync(topWebp);
        if (fs.existsSync(topThumb)) fs.unlinkSync(topThumb);
      } catch {}
    }

    res.json({
      success: true,
      filename: val.sanitizedFilename,
      backupFile: backupName,
      derivativesCleaned,
      message: `Asset "${val.sanitizedFilename}" deleted. Snapshot backup saved to editor-backups/assets/${backupName}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Delete failed: ${err.message}` });
  }
});

/**
 * Safely renames a source asset, its derivatives, and updates all authoritative CMS references.
 */
function executeAssetRename(oldFilename: string, newFilenameRaw: string): {
  success: boolean;
  oldFilename: string;
  newFilename: string;
  relativePath: string;
  publicUrl: string;
  derivativesRenamed: number;
  updatedReferencesCount: number;
  updatedFiles: Array<{ file: string; type: string; title: string }>;
  backupFiles: string[];
} {
  // 1. Validate old asset
  const valOld = validateAssetSecurity(oldFilename);
  if (!valOld.valid) {
    throw new Error(valOld.error || 'Invalid source asset filename.');
  }
  if (!fs.existsSync(valOld.absolutePath)) {
    throw new Error(`Source asset "${oldFilename}" does not exist.`);
  }

  // 2. Validate and sanitize new asset filename
  if (!newFilenameRaw || typeof newFilenameRaw !== 'string') {
    throw new Error('New filename is required.');
  }

  if (
    newFilenameRaw.includes('\0') ||
    newFilenameRaw.includes('..') ||
    newFilenameRaw.includes('/') ||
    newFilenameRaw.includes('\\') ||
    newFilenameRaw.includes('%')
  ) {
    throw new Error('New filename cannot contain path separators or traversal characters.');
  }

  const rawExt = path.extname(newFilenameRaw).toLowerCase();
  const rawBase = rawExt ? path.basename(newFilenameRaw, rawExt) : newFilenameRaw;
  let sanitizedBase = rawBase
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-');

  if (!sanitizedBase) {
    throw new Error('New filename must contain at least one valid alphanumeric character.');
  }

  if (sanitizedBase === valOld.baseName) {
    throw new Error('New filename must be different from current filename.');
  }

  // Preserve original extension
  const newSanitizedFilename = `${sanitizedBase}${valOld.ext}`;
  const newAbsolutePath = path.join(ASSETS_IMAGES_DIR, newSanitizedFilename);

  // Check collision
  if (fs.existsSync(newAbsolutePath) || fs.existsSync(path.join(ASSETS_ROOT_DIR, newSanitizedFilename))) {
    const err: any = new Error(`An asset named "${newSanitizedFilename}" already exists.`);
    err.status = 409;
    throw err;
  }

  // Check containment
  const resolvedNew = path.resolve(newAbsolutePath);
  if (!resolvedNew.startsWith(ASSETS_IMAGES_DIR) && !resolvedNew.startsWith(ASSETS_ROOT_DIR)) {
    throw new Error('Target asset path must remain inside assets directory.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFiles: string[] = [];
  const rollbackMap = new Map<string, Buffer | string>();

  try {
    // 3. Backup source asset & derivatives
    if (!fs.existsSync(ASSETS_BACKUPS_DIR)) {
      fs.mkdirSync(ASSETS_BACKUPS_DIR, { recursive: true });
    }

    const srcBackupName = `${valOld.baseName}_${timestamp}_prerename${valOld.ext}`;
    const srcBackupPath = path.join(ASSETS_BACKUPS_DIR, srcBackupName);
    fs.copyFileSync(valOld.absolutePath, srcBackupPath);
    backupFiles.push(srcBackupName);

    const oldWebpPath = path.join(ASSETS_IMAGES_DIR, `${valOld.baseName}.webp`);
    if (fs.existsSync(oldWebpPath)) {
      const webpBackup = `${valOld.baseName}_${timestamp}_prerename.webp`;
      fs.copyFileSync(oldWebpPath, path.join(ASSETS_BACKUPS_DIR, webpBackup));
      backupFiles.push(webpBackup);
    }

    const oldThumbPath = path.join(ASSETS_IMAGES_DIR, `${valOld.baseName}-thumb.webp`);
    if (fs.existsSync(oldThumbPath)) {
      const thumbBackup = `${valOld.baseName}_${timestamp}_prerename-thumb.webp`;
      fs.copyFileSync(oldThumbPath, path.join(ASSETS_BACKUPS_DIR, thumbBackup));
      backupFiles.push(thumbBackup);
    }

    // 4. Discover all content references to update
    const references = scanAssetReferences(valOld.baseName, valOld.sanitizedFilename);
    const updatedFiles: Array<{ file: string; type: string; title: string }> = [];
    let updatedReferencesCount = 0;

    // 5. Pre-mutation backup of all content files that reference this asset
    const productsFile = path.join(JEKYLL_ROOT, '_data', 'products.yml');
    const homepageFile = path.join(JEKYLL_ROOT, 'index.md');
    const authorsFile = path.join(JEKYLL_ROOT, '_data', 'authors.yml');

    // Pre-backup products if referenced
    if (references.some(r => r.type === 'product')) {
      const bk = backupProductsYml(`rename_${valOld.baseName}`);
      if (bk) backupFiles.push(bk);
      if (fs.existsSync(productsFile)) {
        rollbackMap.set(productsFile, fs.readFileSync(productsFile));
      }
    }

    // Pre-backup guides and articles
    for (const ref of references) {
      if (ref.type === 'guide') {
        const guidePath = path.join(JEKYLL_ROOT, ref.file);
        if (fs.existsSync(guidePath)) {
          rollbackMap.set(guidePath, fs.readFileSync(guidePath));
          const bk = backupGuideFile(ref.id, `rename_${valOld.baseName}`);
          if (bk) backupFiles.push(bk);
        }
      } else if (ref.type === 'article') {
        const artPath = path.join(JEKYLL_ROOT, ref.file);
        if (fs.existsSync(artPath)) {
          rollbackMap.set(artPath, fs.readFileSync(artPath));
          const bk = backupArticleFile(ref.id, `rename_${valOld.baseName}`);
          if (bk) backupFiles.push(bk);
        }
      }
    }

    // Check homepage (index.md)
    if (fs.existsSync(homepageFile)) {
      const homeRaw = fs.readFileSync(homepageFile, 'utf8');
      if (homeRaw.includes(valOld.baseName) || homeRaw.includes(valOld.sanitizedFilename)) {
        rollbackMap.set(homepageFile, homeRaw);
        const bk = backupHomepageFile(`rename_${valOld.baseName}`);
        if (bk) backupFiles.push(bk);
      }
    }

    // Check authors.yml
    if (fs.existsSync(authorsFile)) {
      const authRaw = fs.readFileSync(authorsFile, 'utf8');
      if (authRaw.includes(valOld.baseName) || authRaw.includes(valOld.sanitizedFilename)) {
        rollbackMap.set(authorsFile, authRaw);
        const bk = backupAuthorsFile(`rename_${valOld.baseName}`);
        if (bk) backupFiles.push(bk);
      }
    }

    // 6. Rename source file
    fs.renameSync(valOld.absolutePath, newAbsolutePath);

    // 7. Manage derivatives
    let derivativesRenamed = 0;
    const newWebpPath = path.join(ASSETS_IMAGES_DIR, `${sanitizedBase}.webp`);
    const newThumbPath = path.join(ASSETS_IMAGES_DIR, `${sanitizedBase}-thumb.webp`);

    if (fs.existsSync(oldWebpPath)) {
      try {
        fs.renameSync(oldWebpPath, newWebpPath);
        derivativesRenamed++;
      } catch {
        // regenerate
      }
    }

    if (fs.existsSync(oldThumbPath)) {
      try {
        fs.renameSync(oldThumbPath, newThumbPath);
        derivativesRenamed++;
      } catch {
        // regenerate
      }
    }

    // Top level mirrors cleanup & sync
    try {
      const oldTopSource = path.join(ASSETS_ROOT_DIR, valOld.sanitizedFilename);
      const oldTopWebp = path.join(ASSETS_ROOT_DIR, `${valOld.baseName}.webp`);
      const oldTopThumb = path.join(ASSETS_ROOT_DIR, `${valOld.baseName}-thumb.webp`);
      if (fs.existsSync(oldTopSource)) fs.unlinkSync(oldTopSource);
      if (fs.existsSync(oldTopWebp)) fs.unlinkSync(oldTopWebp);
      if (fs.existsSync(oldTopThumb)) fs.unlinkSync(oldTopThumb);

      fs.copyFileSync(newAbsolutePath, path.join(ASSETS_ROOT_DIR, newSanitizedFilename));
    } catch {}

    // Regenerate derivatives if needed to ensure fresh files
    generateAssetDerivatives(newAbsolutePath);

    // If new derivatives exist, mirror them to top level
    try {
      if (fs.existsSync(newWebpPath)) fs.copyFileSync(newWebpPath, path.join(ASSETS_ROOT_DIR, `${sanitizedBase}.webp`));
      if (fs.existsSync(newThumbPath)) fs.copyFileSync(newThumbPath, path.join(ASSETS_ROOT_DIR, `${sanitizedBase}-thumb.webp`));
    } catch {}

    // Clear caches
    assetDimensionCache.delete(valOld.absolutePath);
    assetDimensionCache.delete(newAbsolutePath);
    getAssetDimensions(newAbsolutePath);

    // 8. Update references in _data/products.yml
    if (fs.existsSync(productsFile)) {
      const rawProducts = fs.readFileSync(productsFile, 'utf8');
      const products = yaml.load(rawProducts);
      if (Array.isArray(products)) {
        let prodsModified = false;
        for (const prod of products) {
          let modifiedThisProd = false;
          if (prod.image) {
            if (prod.image === valOld.baseName) {
              prod.image = sanitizedBase;
              modifiedThisProd = true;
            } else if (prod.image === valOld.sanitizedFilename) {
              prod.image = newSanitizedFilename;
              modifiedThisProd = true;
            } else if (prod.image === `assets/images/${valOld.sanitizedFilename}`) {
              prod.image = `assets/images/${newSanitizedFilename}`;
              modifiedThisProd = true;
            } else if (prod.image === `/assets/images/${valOld.sanitizedFilename}`) {
              prod.image = `/assets/images/${newSanitizedFilename}`;
              modifiedThisProd = true;
            }
          }

          if (prod.imageType) {
            if (prod.imageType === valOld.baseName) {
              prod.imageType = sanitizedBase;
              modifiedThisProd = true;
            } else if (prod.imageType === valOld.sanitizedFilename) {
              prod.imageType = newSanitizedFilename;
              modifiedThisProd = true;
            }
          }

          if (modifiedThisProd) {
            prodsModified = true;
            updatedReferencesCount++;
            updatedFiles.push({
              file: '_data/products.yml',
              type: 'product',
              title: prod.title || prod.id
            });
          }
        }

        if (prodsModified) {
          const tempP = `${productsFile}.tmp-${Date.now()}`;
          fs.writeFileSync(tempP, yaml.dump(products, { indent: 2, lineWidth: -1, noRefs: true }), 'utf8');
          fs.renameSync(tempP, productsFile);
        }
      }
    }

    // 9. Update references in _guides/*.md
    const guidesDir = path.join(JEKYLL_ROOT, '_guides');
    if (fs.existsSync(guidesDir)) {
      const guideFiles = fs.readdirSync(guidesDir).filter(f => f.endsWith('.md'));
      for (const gf of guideFiles) {
        const fullGPath = path.join(guidesDir, gf);
        const rawContent = fs.readFileSync(fullGPath, 'utf8');
        const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
          let fm: any = {};
          try {
            fm = yaml.load(match[1]) || {};
          } catch {
            continue;
          }

          let modified = false;
          let body = rawContent.slice(match[0].length);

          // Check hero / main images
          if (fm.image === valOld.baseName) { fm.image = sanitizedBase; modified = true; }
          else if (fm.image === valOld.sanitizedFilename) { fm.image = newSanitizedFilename; modified = true; }
          else if (fm.image === `assets/images/${valOld.sanitizedFilename}`) { fm.image = `assets/images/${newSanitizedFilename}`; modified = true; }

          if (fm.heroImageType === valOld.baseName) { fm.heroImageType = sanitizedBase; modified = true; }
          else if (fm.heroImageType === valOld.sanitizedFilename) { fm.heroImageType = newSanitizedFilename; modified = true; }

          // Check editorsPick
          if (fm.editorsPick) {
            if (fm.editorsPick.imageType === valOld.baseName) { fm.editorsPick.imageType = sanitizedBase; modified = true; }
            if (fm.editorsPick.image === valOld.baseName) { fm.editorsPick.image = sanitizedBase; modified = true; }
          }

          // Check quickPicks
          if (Array.isArray(fm.quickPicks)) {
            for (const qp of fm.quickPicks) {
              if (qp.imageType === valOld.baseName) { qp.imageType = sanitizedBase; modified = true; }
              if (qp.image === valOld.baseName) { qp.image = sanitizedBase; modified = true; }
            }
          }

          // Check budgetSections
          if (Array.isArray(fm.budgetSections)) {
            for (const sec of fm.budgetSections) {
              if (Array.isArray(sec.products)) {
                for (const p of sec.products) {
                  if (p.imageType === valOld.baseName) { p.imageType = sanitizedBase; modified = true; }
                  if (p.image === valOld.baseName) { p.image = sanitizedBase; modified = true; }
                }
              }
            }
          }

          // Body markdown image link replacement
          const oldPatterns = [
            `/assets/images/${valOld.sanitizedFilename}`,
            `assets/images/${valOld.sanitizedFilename}`,
            `/assets/${valOld.sanitizedFilename}`,
            `assets/${valOld.sanitizedFilename}`,
            `type="${valOld.baseName}"`,
            `type='${valOld.baseName}'`,
            `image="${valOld.baseName}"`,
            `image='${valOld.baseName}'`
          ];
          const newPatterns = [
            `/assets/images/${newSanitizedFilename}`,
            `assets/images/${newSanitizedFilename}`,
            `/assets/${newSanitizedFilename}`,
            `assets/${newSanitizedFilename}`,
            `type="${sanitizedBase}"`,
            `type='${sanitizedBase}'`,
            `image="${sanitizedBase}"`,
            `image='${sanitizedBase}'`
          ];

          for (let i = 0; i < oldPatterns.length; i++) {
            if (body.includes(oldPatterns[i])) {
              body = body.split(oldPatterns[i]).join(newPatterns[i]);
              modified = true;
            }
          }

          if (modified) {
            updatedReferencesCount++;
            updatedFiles.push({
              file: `_guides/${gf}`,
              type: 'guide',
              title: fm.title || gf.replace(/\.md$/, '')
            });

            const newYaml = yaml.dump(fm, { indent: 2, lineWidth: -1, noRefs: true }).trim();
            const newGuideText = `---\n${newYaml}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
            const tempG = `${fullGPath}.tmp-${Date.now()}`;
            fs.writeFileSync(tempG, newGuideText, 'utf8');
            fs.renameSync(tempG, fullGPath);
          }
        }
      }
    }

    // 10. Update references in _articles/*.md
    const articlesDir = path.join(JEKYLL_ROOT, '_articles');
    if (fs.existsSync(articlesDir)) {
      const artFiles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
      for (const af of artFiles) {
        const fullAPath = path.join(articlesDir, af);
        const rawContent = fs.readFileSync(fullAPath, 'utf8');
        const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
          let fm: any = {};
          try {
            fm = yaml.load(match[1]) || {};
          } catch {
            continue;
          }

          let modified = false;
          let body = rawContent.slice(match[0].length);

          if (fm.image === valOld.baseName) { fm.image = sanitizedBase; modified = true; }
          else if (fm.image === valOld.sanitizedFilename) { fm.image = newSanitizedFilename; modified = true; }
          else if (fm.image === `assets/images/${valOld.sanitizedFilename}`) { fm.image = `assets/images/${newSanitizedFilename}`; modified = true; }

          if (fm.heroImageType === valOld.baseName) { fm.heroImageType = sanitizedBase; modified = true; }
          else if (fm.heroImageType === valOld.sanitizedFilename) { fm.heroImageType = newSanitizedFilename; modified = true; }

          const oldPatterns = [
            `/assets/images/${valOld.sanitizedFilename}`,
            `assets/images/${valOld.sanitizedFilename}`,
            `/assets/${valOld.sanitizedFilename}`,
            `assets/${valOld.sanitizedFilename}`,
            `type="${valOld.baseName}"`,
            `type='${valOld.baseName}'`
          ];
          const newPatterns = [
            `/assets/images/${newSanitizedFilename}`,
            `assets/images/${newSanitizedFilename}`,
            `/assets/${newSanitizedFilename}`,
            `assets/${newSanitizedFilename}`,
            `type="${sanitizedBase}"`,
            `type='${sanitizedBase}'`
          ];

          for (let i = 0; i < oldPatterns.length; i++) {
            if (body.includes(oldPatterns[i])) {
              body = body.split(oldPatterns[i]).join(newPatterns[i]);
              modified = true;
            }
          }

          if (modified) {
            updatedReferencesCount++;
            updatedFiles.push({
              file: `_articles/${af}`,
              type: 'article',
              title: fm.title || af.replace(/\.md$/, '')
            });

            const newYaml = yaml.dump(fm, { indent: 2, lineWidth: -1, noRefs: true }).trim();
            const newArtText = `---\n${newYaml}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
            const tempA = `${fullAPath}.tmp-${Date.now()}`;
            fs.writeFileSync(tempA, newArtText, 'utf8');
            fs.renameSync(tempA, fullAPath);
          }
        }
      }
    }

    // 11. Update references in index.md (Homepage)
    if (fs.existsSync(homepageFile)) {
      const rawContent = fs.readFileSync(homepageFile, 'utf8');
      const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (match) {
        let fm: any = {};
        try { fm = yaml.load(match[1]) || {}; } catch {}
        let modified = false;
        let body = rawContent.slice(match[0].length);

        if (fm.hero_image === valOld.baseName) { fm.hero_image = sanitizedBase; modified = true; }
        else if (fm.hero_image === valOld.sanitizedFilename) { fm.hero_image = newSanitizedFilename; modified = true; }

        if (modified) {
          updatedReferencesCount++;
          updatedFiles.push({
            file: 'index.md',
            type: 'page',
            title: 'Homepage'
          });
          const newYaml = yaml.dump(fm, { indent: 2, lineWidth: -1, noRefs: true }).trim();
          const newText = `---\n${newYaml}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
          const tempH = `${homepageFile}.tmp-${Date.now()}`;
          fs.writeFileSync(tempH, newText, 'utf8');
          fs.renameSync(tempH, homepageFile);
        }
      }
    }

    return {
      success: true,
      oldFilename: valOld.sanitizedFilename,
      newFilename: newSanitizedFilename,
      relativePath: `assets/images/${newSanitizedFilename}`,
      publicUrl: `/assets/images/${newSanitizedFilename}`,
      derivativesRenamed,
      updatedReferencesCount,
      updatedFiles,
      backupFiles
    };
  } catch (err: any) {
    // Rollback modified content files
    for (const [filePath, content] of rollbackMap.entries()) {
      try {
        fs.writeFileSync(filePath, content);
      } catch (rbErr: any) {
        console.error(`Rollback failed for ${filePath}:`, rbErr.message);
      }
    }

    // Rollback asset if renamed
    if (fs.existsSync(newAbsolutePath) && !fs.existsSync(valOld.absolutePath)) {
      try {
        fs.renameSync(newAbsolutePath, valOld.absolutePath);
      } catch {}
    }

    throw err;
  }
}

/**
 * POST /api/assets/rename
 * Safely renames an asset, regenerates/renames derivatives, and updates all content references
 */
app.post('/api/assets/rename', (req: Request, res: Response) => {
  try {
    const { oldFilename, newFilename } = req.body;
    if (!oldFilename || !newFilename) {
      return res.status(400).json({ success: false, error: 'Both oldFilename and newFilename are required.' });
    }

    const result = executeAssetRename(oldFilename, newFilename);
    res.json({
      ...result,
      message: `Asset "${result.oldFilename}" successfully renamed to "${result.newFilename}". Updated ${result.updatedReferencesCount} reference(s) across ${result.updatedFiles.length} file(s).`
    });
  } catch (err: any) {
    const status = (err as any).status || 500;
    res.status(status).json({
      success: false,
      error: err.message || 'Failed to rename asset.'
    });
  }
});

// =============================================================
// PHASE 6A: HOMEPAGE, NAVIGATION, AUTHORS & INTERESTS APIs
// =============================================================

// -------------------------------------------------------------
// 1. HOMEPAGE MANAGEMENT API (/index.md)
// -------------------------------------------------------------
const HOMEPAGE_FILE = path.join(JEKYLL_ROOT, 'index.md');
const HOMEPAGE_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'homepage');

try {
  if (!fs.existsSync(HOMEPAGE_BACKUPS_DIR)) {
    fs.mkdirSync(HOMEPAGE_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize HOMEPAGE_BACKUPS_DIR:', e);
}

function backupHomepageFile(action: string): string | null {
  try {
    if (!fs.existsSync(HOMEPAGE_FILE)) return null;
    if (!fs.existsSync(HOMEPAGE_BACKUPS_DIR)) {
      fs.mkdirSync(HOMEPAGE_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `homepage_${timestamp}_${action}.md`;
    const destPath = path.join(HOMEPAGE_BACKUPS_DIR, filename);
    fs.copyFileSync(HOMEPAGE_FILE, destPath);

    const files = fs.readdirSync(HOMEPAGE_BACKUPS_DIR).filter(f => f.endsWith('.md')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(HOMEPAGE_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create homepage backup:', err);
    return null;
  }
}

function parseHomepageFile(): { frontMatter: any; body: string; raw: string } {
  if (!fs.existsSync(HOMEPAGE_FILE)) {
    throw new Error('index.md does not exist.');
  }
  const raw = fs.readFileSync(HOMEPAGE_FILE, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('index.md does not contain valid YAML front matter delimiters (---).');
  }
  const frontMatter = yaml.load(match[1]) || {};
  const body = (match[2] || '').trim();
  return { frontMatter, body, raw };
}

function serializeHomepageDocument(frontMatter: any, body: string): string {
  const dumpedYaml = yaml.dump(frontMatter, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
  const cleanBody = (body || '').trim();
  return `---\n${dumpedYaml}---\n${cleanBody ? cleanBody + '\n' : ''}`;
}

function executeAtomicHomepageWrite(options: {
  frontMatter: any;
  body: string;
  action: string;
}): { backupFile: string | null } {
  const backupFile = backupHomepageFile(options.action);
  if (!backupFile) {
    throw new Error('Failed to create pre-write snapshot backup for index.md.');
  }

  const serialized = serializeHomepageDocument(options.frontMatter, options.body);
  const match = serialized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error('Serialized homepage document failed regex front-matter validation.');
  }
  try {
    yaml.load(match[1]);
  } catch (err: any) {
    throw new Error(`Serialized homepage failed in-memory YAML verification: ${err.message}`);
  }

  const tempFilename = `.homepage.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.md`;
  const tempPath = path.join(JEKYLL_ROOT, tempFilename);

  try {
    fs.writeFileSync(tempPath, serialized, 'utf8');
    const readTemp = fs.readFileSync(tempPath, 'utf8');
    if (readTemp !== serialized) {
      throw new Error('Temporary file content mismatch during homepage write verification.');
    }
    fs.renameSync(tempPath, HOMEPAGE_FILE);

    const verifyFinal = fs.readFileSync(HOMEPAGE_FILE, 'utf8');
    if (verifyFinal !== serialized) {
      throw new Error('Final index.md readback verification failed.');
    }
    return { backupFile };
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

// GET /api/homepage
app.get('/api/homepage', (req: Request, res: Response) => {
  try {
    const doc = parseHomepageFile();
    res.json({
      success: true,
      frontMatter: doc.frontMatter,
      body: doc.body,
      raw: doc.raw
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load homepage: ${err.message}` });
  }
});

// PUT /api/homepage
app.put('/api/homepage', (req: Request, res: Response) => {
  try {
    const { frontMatter, body } = req.body;
    if (!frontMatter || typeof frontMatter !== 'object') {
      return res.status(400).json({ success: false, error: 'frontMatter object is required.' });
    }

    const currentDoc = parseHomepageFile();
    const mergedFrontMatter = { ...currentDoc.frontMatter, ...frontMatter };
    const targetBody = body !== undefined ? body : currentDoc.body;

    const result = executeAtomicHomepageWrite({
      frontMatter: mergedFrontMatter,
      body: targetBody,
      action: 'update'
    });

    res.json({
      success: true,
      message: 'Homepage (index.md) updated successfully.',
      frontMatter: mergedFrontMatter,
      body: targetBody,
      backupFile: result.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update homepage: ${err.message}` });
  }
});

// GET /api/homepage-backups
app.get('/api/homepage-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(HOMEPAGE_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(HOMEPAGE_BACKUPS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const full = path.join(HOMEPAGE_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.md', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list homepage backups: ${err.message}` });
  }
});

// POST /api/homepage-backups/restore
app.post('/api/homepage-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(HOMEPAGE_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Homepage backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const match = rawBackup.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return res.status(400).json({ success: false, error: `Backup file "${safeFilename}" contains invalid front matter.` });
    }
    const frontMatter = yaml.load(match[1]) || {};
    const body = (match[2] || '').trim();

    const writeResult = executeAtomicHomepageWrite({
      frontMatter,
      body,
      action: 'restore'
    });

    res.json({
      success: true,
      message: `Restored index.md from backup "${safeFilename}".`,
      frontMatter,
      body,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});


// -------------------------------------------------------------
// 2. NAVIGATION MANAGEMENT API (_data/navigation.yml)
// -------------------------------------------------------------
const NAVIGATION_FILE = path.join(JEKYLL_ROOT, '_data', 'navigation.yml');
const NAVIGATION_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'navigation');

try {
  if (!fs.existsSync(NAVIGATION_BACKUPS_DIR)) {
    fs.mkdirSync(NAVIGATION_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize NAVIGATION_BACKUPS_DIR:', e);
}

function backupNavigationFile(action: string): string | null {
  try {
    if (!fs.existsSync(NAVIGATION_FILE)) return null;
    if (!fs.existsSync(NAVIGATION_BACKUPS_DIR)) {
      fs.mkdirSync(NAVIGATION_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `navigation_${timestamp}_${action}.yml`;
    const destPath = path.join(NAVIGATION_BACKUPS_DIR, filename);
    fs.copyFileSync(NAVIGATION_FILE, destPath);

    const files = fs.readdirSync(NAVIGATION_BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(NAVIGATION_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create navigation backup:', err);
    return null;
  }
}

function parseNavigationFile(): any {
  if (!fs.existsSync(NAVIGATION_FILE)) {
    return { header: [], footer_explore: [], footer_editorial: [], footer_legal: [] };
  }
  const raw = fs.readFileSync(NAVIGATION_FILE, 'utf8');
  return yaml.load(raw) || { header: [], footer_explore: [], footer_editorial: [], footer_legal: [] };
}

function serializeNavigationData(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

function executeAtomicNavigationWrite(options: {
  data: any;
  action: string;
}): { backupFile: string | null } {
  const backupFile = backupNavigationFile(options.action);
  if (!backupFile) {
    throw new Error('Failed to create pre-write backup for navigation.yml.');
  }

  const serialized = serializeNavigationData(options.data);
  try {
    yaml.load(serialized);
  } catch (err: any) {
    throw new Error(`Serialized navigation data failed in-memory YAML verification: ${err.message}`);
  }

  const tempFilename = `.navigation.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.yml`;
  const tempPath = path.join(JEKYLL_ROOT, tempFilename);

  try {
    fs.writeFileSync(tempPath, serialized, 'utf8');
    const readTemp = fs.readFileSync(tempPath, 'utf8');
    if (readTemp !== serialized) {
      throw new Error('Temporary file content mismatch during navigation write verification.');
    }
    fs.renameSync(tempPath, NAVIGATION_FILE);

    const verifyFinal = fs.readFileSync(NAVIGATION_FILE, 'utf8');
    if (verifyFinal !== serialized) {
      throw new Error('Final navigation.yml readback verification failed.');
    }
    return { backupFile };
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

// GET /api/navigation
app.get('/api/navigation', (req: Request, res: Response) => {
  try {
    const navData = parseNavigationFile();
    res.json({
      success: true,
      navigation: navData
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load navigation: ${err.message}` });
  }
});

// PUT /api/navigation
app.put('/api/navigation', (req: Request, res: Response) => {
  try {
    const { navigation } = req.body;
    if (!navigation || typeof navigation !== 'object') {
      return res.status(400).json({ success: false, error: 'navigation object is required.' });
    }

    const currentNav = parseNavigationFile();
    const mergedNav = { ...currentNav, ...navigation };

    const writeResult = executeAtomicNavigationWrite({
      data: mergedNav,
      action: 'update'
    });

    res.json({
      success: true,
      message: 'navigation.yml updated successfully.',
      navigation: mergedNav,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update navigation: ${err.message}` });
  }
});

// GET /api/navigation-backups
app.get('/api/navigation-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(NAVIGATION_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(NAVIGATION_BACKUPS_DIR)
      .filter(f => f.endsWith('.yml'))
      .map(f => {
        const full = path.join(NAVIGATION_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.yml', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list navigation backups: ${err.message}` });
  }
});

// POST /api/navigation-backups/restore
app.post('/api/navigation-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(NAVIGATION_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Navigation backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(rawBackup) || {};

    const writeResult = executeAtomicNavigationWrite({
      data: parsed,
      action: 'restore'
    });

    res.json({
      success: true,
      message: `Restored navigation.yml from backup "${safeFilename}".`,
      navigation: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});


// -------------------------------------------------------------
// 3. AUTHORS MANAGEMENT API (_data/authors.yml)
// -------------------------------------------------------------
const AUTHORS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'authors');

try {
  if (!fs.existsSync(AUTHORS_BACKUPS_DIR)) {
    fs.mkdirSync(AUTHORS_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize AUTHORS_BACKUPS_DIR:', e);
}

function backupAuthorsFile(action: string): string | null {
  try {
    if (!fs.existsSync(AUTHORS_FILE)) return null;
    if (!fs.existsSync(AUTHORS_BACKUPS_DIR)) {
      fs.mkdirSync(AUTHORS_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `authors_${timestamp}_${action}.yml`;
    const destPath = path.join(AUTHORS_BACKUPS_DIR, filename);
    fs.copyFileSync(AUTHORS_FILE, destPath);

    const files = fs.readdirSync(AUTHORS_BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(AUTHORS_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create authors backup:', err);
    return null;
  }
}

function parseAuthorsFile(): Record<string, any> {
  if (!fs.existsSync(AUTHORS_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(AUTHORS_FILE, 'utf8');
  return yaml.load(raw) || {};
}

function serializeAuthorsData(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

function executeAtomicAuthorsWrite(options: {
  data: any;
  action: string;
}): { backupFile: string | null } {
  const backupFile = backupAuthorsFile(options.action);
  if (!backupFile) {
    throw new Error('Failed to create pre-write backup for authors.yml.');
  }

  const serialized = serializeAuthorsData(options.data);
  try {
    yaml.load(serialized);
  } catch (err: any) {
    throw new Error(`Serialized authors data failed in-memory YAML verification: ${err.message}`);
  }

  const tempFilename = `.authors.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.yml`;
  const tempPath = path.join(JEKYLL_ROOT, tempFilename);

  try {
    fs.writeFileSync(tempPath, serialized, 'utf8');
    const readTemp = fs.readFileSync(tempPath, 'utf8');
    if (readTemp !== serialized) {
      throw new Error('Temporary file content mismatch during authors write verification.');
    }
    fs.renameSync(tempPath, AUTHORS_FILE);

    const verifyFinal = fs.readFileSync(AUTHORS_FILE, 'utf8');
    if (verifyFinal !== serialized) {
      throw new Error('Final authors.yml readback verification failed.');
    }
    return { backupFile };
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

/**
 * Scans guides and articles to determine author references
 */
function getAuthorReferences(authorId: string, authorName?: string): {
  guideReferences: any[];
  articleReferences: any[];
  count: number;
} {
  const guideReferences: any[] = [];
  const articleReferences: any[] = [];

  // 1. Scan _guides/*.md
  if (fs.existsSync(GUIDES_DIR)) {
    const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace('.md', '');
      try {
        const doc = parseGuideFile(slug);
        if (doc) {
          const authorVal = doc.frontMatter.author;
          let match = false;
          if (typeof authorVal === 'string' && (authorVal.toLowerCase() === authorId.toLowerCase() || (authorName && authorVal.toLowerCase() === authorName.toLowerCase()))) {
            match = true;
          } else if (authorVal && typeof authorVal === 'object') {
            if ((authorVal.name && authorName && authorVal.name.toLowerCase() === authorName.toLowerCase()) || (authorVal.id && authorVal.id.toLowerCase() === authorId.toLowerCase())) {
              match = true;
            }
          }
          if (match) {
            guideReferences.push({
              type: 'guide',
              title: doc.frontMatter.title || slug,
              slug,
              field: 'author'
            });
          }
        }
      } catch {}
    }
  }

  // 2. Scan _articles/*.md
  if (fs.existsSync(ARTICLES_DIR)) {
    const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace('.md', '');
      try {
        const doc = parseArticleFile(slug);
        if (doc) {
          const authorVal = doc.frontMatter.author;
          let match = false;
          if (typeof authorVal === 'string' && (authorVal.toLowerCase() === authorId.toLowerCase() || (authorName && authorVal.toLowerCase() === authorName.toLowerCase()))) {
            match = true;
          } else if (authorVal && typeof authorVal === 'object') {
            if ((authorVal.name && authorName && authorVal.name.toLowerCase() === authorName.toLowerCase()) || (authorVal.id && authorVal.id.toLowerCase() === authorId.toLowerCase())) {
              match = true;
            }
          }
          if (match) {
            articleReferences.push({
              type: 'article',
              title: doc.frontMatter.title || slug,
              slug,
              field: 'author'
            });
          }
        }
      } catch {}
    }
  }

  return {
    guideReferences,
    articleReferences,
    count: guideReferences.length + articleReferences.length
  };
}

// GET /api/authors/:id
app.get('/api/authors/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authorsObj = parseAuthorsFile();
    if (!authorsObj[id]) {
      return res.status(404).json({ success: false, error: `Author "${id}" not found.` });
    }
    const author = authorsObj[id];
    const refs = getAuthorReferences(id, author.name);

    res.json({
      success: true,
      author: {
        id,
        ...author,
        guideCount: refs.guideReferences.length,
        articleCount: refs.articleReferences.length
      },
      references: refs
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to fetch author: ${err.message}` });
  }
});

// POST /api/authors
app.post('/api/authors', (req: Request, res: Response) => {
  try {
    const { id, name, role, bio, avatarSeed, ...extra } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Author id is required.' });
    }
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Author name is required.' });
    }

    const authorsObj = parseAuthorsFile();
    if (authorsObj[cleanId]) {
      return res.status(400).json({ success: false, error: `Author id "${cleanId}" already exists.` });
    }

    authorsObj[cleanId] = {
      name,
      role: role || 'Contributor',
      bio: bio || '',
      avatarSeed: avatarSeed || cleanId,
      ...extra
    };

    const writeResult = executeAtomicAuthorsWrite({
      data: authorsObj,
      action: `add_${cleanId}`
    });

    res.json({
      success: true,
      message: `Author "${name}" (${cleanId}) created successfully.`,
      author: { id: cleanId, ...authorsObj[cleanId] },
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to create author: ${err.message}` });
  }
});

// PUT /api/authors/:id
app.put('/api/authors/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, bio, avatarSeed, newId, ...extra } = req.body;

    const authorsObj = parseAuthorsFile();
    if (!authorsObj[id]) {
      return res.status(404).json({ success: false, error: `Author "${id}" not found.` });
    }

    const targetId = newId && typeof newId === 'string' ? newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') : id;

    if (targetId !== id && authorsObj[targetId]) {
      return res.status(400).json({ success: false, error: `Target author id "${targetId}" already exists.` });
    }

    const updatedAuthor = {
      ...authorsObj[id],
      ...(name ? { name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(avatarSeed !== undefined ? { avatarSeed } : {}),
      ...extra
    };

    if (targetId !== id) {
      delete authorsObj[id];
    }
    authorsObj[targetId] = updatedAuthor;

    const writeResult = executeAtomicAuthorsWrite({
      data: authorsObj,
      action: `update_${targetId}`
    });

    res.json({
      success: true,
      message: `Author "${targetId}" updated successfully.`,
      author: { id: targetId, ...updatedAuthor },
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update author: ${err.message}` });
  }
});

// DELETE /api/authors/:id
app.delete('/api/authors/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const authorsObj = parseAuthorsFile();
    if (!authorsObj[id]) {
      return res.status(404).json({ success: false, error: `Author "${id}" not found.` });
    }

    const author = authorsObj[id];
    const refs = getAuthorReferences(id, author.name);

    if (refs.count > 0 && !force) {
      return res.status(409).json({
        success: false,
        warning: true,
        message: `Cannot delete author "${author.name}" because they are referenced in ${refs.count} item(s).`,
        hasReferences: true,
        guideReferences: refs.guideReferences,
        articleReferences: refs.articleReferences,
        count: refs.count
      });
    }

    delete authorsObj[id];

    const writeResult = executeAtomicAuthorsWrite({
      data: authorsObj,
      action: `delete_${id}`
    });

    res.json({
      success: true,
      message: `Author "${author.name}" (${id}) deleted successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to delete author: ${err.message}` });
  }
});

// GET /api/authors-backups
app.get('/api/authors-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(AUTHORS_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(AUTHORS_BACKUPS_DIR)
      .filter(f => f.endsWith('.yml'))
      .map(f => {
        const full = path.join(AUTHORS_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.yml', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list authors backups: ${err.message}` });
  }
});

// POST /api/authors-backups/restore
app.post('/api/authors-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(AUTHORS_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Authors backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(rawBackup) || {};

    const writeResult = executeAtomicAuthorsWrite({
      data: parsed,
      action: 'restore'
    });

    res.json({
      success: true,
      message: `Restored authors.yml from backup "${safeFilename}".`,
      authors: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});


// -------------------------------------------------------------
// 4. INTERESTS MANAGEMENT API (_data/interests.yml)
// -------------------------------------------------------------
const INTERESTS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'interests');

try {
  if (!fs.existsSync(INTERESTS_BACKUPS_DIR)) {
    fs.mkdirSync(INTERESTS_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize INTERESTS_BACKUPS_DIR:', e);
}

function backupInterestsFile(action: string): string | null {
  try {
    if (!fs.existsSync(INTERESTS_FILE)) return null;
    if (!fs.existsSync(INTERESTS_BACKUPS_DIR)) {
      fs.mkdirSync(INTERESTS_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `interests_${timestamp}_${action}.yml`;
    const destPath = path.join(INTERESTS_BACKUPS_DIR, filename);
    fs.copyFileSync(INTERESTS_FILE, destPath);

    const files = fs.readdirSync(INTERESTS_BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(INTERESTS_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create interests backup:', err);
    return null;
  }
}

function parseInterestsFile(): any[] {
  if (!fs.existsSync(INTERESTS_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(INTERESTS_FILE, 'utf8');
  return yaml.load(raw) || [];
}

function serializeInterestsData(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
}

function executeAtomicInterestsWrite(options: {
  data: any;
  action: string;
}): { backupFile: string | null } {
  const backupFile = backupInterestsFile(options.action);
  if (!backupFile) {
    throw new Error('Failed to create pre-write backup for interests.yml.');
  }

  const serialized = serializeInterestsData(options.data);
  try {
    yaml.load(serialized);
  } catch (err: any) {
    throw new Error(`Serialized interests data failed in-memory YAML verification: ${err.message}`);
  }

  const tempFilename = `.interests.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.yml`;
  const tempPath = path.join(JEKYLL_ROOT, tempFilename);

  try {
    fs.writeFileSync(tempPath, serialized, 'utf8');
    const readTemp = fs.readFileSync(tempPath, 'utf8');
    if (readTemp !== serialized) {
      throw new Error('Temporary file content mismatch during interests write verification.');
    }
    fs.renameSync(tempPath, INTERESTS_FILE);

    const verifyFinal = fs.readFileSync(INTERESTS_FILE, 'utf8');
    if (verifyFinal !== serialized) {
      throw new Error('Final interests.yml readback verification failed.');
    }
    return { backupFile };
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

/**
 * Scans products, guides, homepage, and gift-finder for interest references
 */
function getInterestReferences(interestId: string, interestUrl?: string): {
  references: any[];
  calculatedCount: number;
} {
  const references: any[] = [];
  let calculatedCount = 0;

  // 1. Scan _data/products.yml
  const PRODUCTS_FILE = path.join(JEKYLL_ROOT, '_data', 'products.yml');
  if (fs.existsSync(PRODUCTS_FILE)) {
    try {
      const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
      const products = yaml.load(raw) || [];
      if (Array.isArray(products)) {
        for (const p of products) {
          if (p.category && p.category.toLowerCase() === interestId.toLowerCase()) {
            calculatedCount++;
            references.push({ type: 'product', title: p.title || p.id, idOrSlug: p.id, field: 'category' });
          } else if (p.recipient && p.recipient.toLowerCase() === interestId.toLowerCase()) {
            references.push({ type: 'product', title: p.title || p.id, idOrSlug: p.id, field: 'recipient' });
          }
        }
      }
    } catch {}
  }

  // 2. Scan _guides/*.md
  if (fs.existsSync(GUIDES_DIR)) {
    const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const slug = file.replace('.md', '');
      try {
        const doc = parseGuideFile(slug);
        if (doc) {
          const cat = doc.frontMatter.category;
          if (cat && typeof cat === 'string' && cat.toLowerCase() === interestId.toLowerCase()) {
            calculatedCount++;
            references.push({ type: 'guide', title: doc.frontMatter.title || slug, idOrSlug: slug, field: 'category' });
          } else if (interestUrl && doc.frontMatter.permalink === interestUrl) {
            references.push({ type: 'guide', title: doc.frontMatter.title || slug, idOrSlug: slug, field: 'permalink' });
          }
        }
      } catch {}
    }
  }

  // 3. Scan Gift Finder (/gift-finder/index.html)
  const GIFT_FINDER_FILE = path.join(JEKYLL_ROOT, 'gift-finder', 'index.html');
  if (fs.existsSync(GIFT_FINDER_FILE)) {
    try {
      const raw = fs.readFileSync(GIFT_FINDER_FILE, 'utf8');
      if (raw.includes(`data-value="${interestId}"`)) {
        references.push({ type: 'gift-finder', title: 'Gift Finder Step 4 Option', idOrSlug: interestId, field: 'data-value' });
      }
    } catch {}
  }

  return { references, calculatedCount };
}

// GET /api/interests
app.get('/api/interests', (req: Request, res: Response) => {
  try {
    const list = parseInterestsFile();
    const enriched = list.map((item: any) => {
      const refs = getInterestReferences(item.id, item.url);
      return {
        ...item,
        calculatedCount: refs.calculatedCount
      };
    });

    res.json({
      success: true,
      interests: enriched,
      total: enriched.length
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load interests: ${err.message}` });
  }
});

// GET /api/interests/:id
app.get('/api/interests/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = parseInterestsFile();
    const found = list.find((item: any) => item.id === id);
    if (!found) {
      return res.status(404).json({ success: false, error: `Interest "${id}" not found.` });
    }
    const refs = getInterestReferences(id, found.url);

    res.json({
      success: true,
      interest: {
        ...found,
        calculatedCount: refs.calculatedCount
      },
      references: refs.references
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to fetch interest: ${err.message}` });
  }
});

// POST /api/interests
app.post('/api/interests', (req: Request, res: Response) => {
  try {
    const { id, name, count, url, description, ...extra } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Interest id is required.' });
    }
    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Interest name is required.' });
    }

    const list = parseInterestsFile();
    if (list.some((item: any) => item.id === cleanId)) {
      return res.status(400).json({ success: false, error: `Interest id "${cleanId}" already exists.` });
    }

    const newInterest = {
      id: cleanId,
      name,
      count: typeof count === 'number' ? count : parseInt(count || '0', 10),
      url: url || `/${cleanId}-gifts/`,
      description: description || '',
      ...extra
    };

    list.push(newInterest);

    const writeResult = executeAtomicInterestsWrite({
      data: list,
      action: `add_${cleanId}`
    });

    res.json({
      success: true,
      message: `Interest "${name}" (${cleanId}) created successfully.`,
      interest: newInterest,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to create interest: ${err.message}` });
  }
});

// PUT /api/interests/:id
app.put('/api/interests/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, count, url, description, newId, ...extra } = req.body;

    const list = parseInterestsFile();
    const index = list.findIndex((item: any) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: `Interest "${id}" not found.` });
    }

    const targetId = newId && typeof newId === 'string' ? newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') : id;

    if (targetId !== id && list.some((item: any) => item.id === targetId)) {
      return res.status(400).json({ success: false, error: `Target interest id "${targetId}" already exists.` });
    }

    const existingItem = list[index];
    const updatedItem = {
      ...existingItem,
      id: targetId,
      ...(name ? { name } : {}),
      ...(count !== undefined ? { count: typeof count === 'number' ? count : parseInt(count, 10) } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(description !== undefined ? { description } : {}),
      ...extra
    };

    list[index] = updatedItem;

    const writeResult = executeAtomicInterestsWrite({
      data: list,
      action: `update_${targetId}`
    });

    res.json({
      success: true,
      message: `Interest "${targetId}" updated successfully.`,
      interest: updatedItem,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update interest: ${err.message}` });
  }
});

// DELETE /api/interests/:id
app.delete('/api/interests/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const list = parseInterestsFile();
    const found = list.find((item: any) => item.id === id);
    if (!found) {
      return res.status(404).json({ success: false, error: `Interest "${id}" not found.` });
    }

    const refs = getInterestReferences(id, found.url);

    if (refs.references.length > 0 && !force) {
      return res.status(409).json({
        success: false,
        warning: true,
        message: `Cannot delete interest "${found.name}" because it is referenced in ${refs.references.length} place(s).`,
        hasReferences: true,
        references: refs.references,
        count: refs.references.length
      });
    }

    const filtered = list.filter((item: any) => item.id !== id);

    const writeResult = executeAtomicInterestsWrite({
      data: filtered,
      action: `delete_${id}`
    });

    res.json({
      success: true,
      message: `Interest "${found.name}" (${id}) deleted successfully.`,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to delete interest: ${err.message}` });
  }
});

// GET /api/interests-backups
app.get('/api/interests-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(INTERESTS_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(INTERESTS_BACKUPS_DIR)
      .filter(f => f.endsWith('.yml'))
      .map(f => {
        const full = path.join(INTERESTS_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.yml', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list interests backups: ${err.message}` });
  }
});

// POST /api/interests-backups/restore
app.post('/api/interests-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(INTERESTS_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Interests backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = yaml.load(rawBackup) || [];

    const writeResult = executeAtomicInterestsWrite({
      data: parsed,
      action: 'restore'
    });

    res.json({
      success: true,
      message: `Restored interests.yml from backup "${safeFilename}".`,
      interests: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// =============================================================
// PHASE 6B: GIFT FINDER EDITORIAL API (/gift-finder/index.html)
// =============================================================
const GIFT_FINDER_FILE = path.join(JEKYLL_ROOT, 'gift-finder', 'index.html');
const GIFT_FINDER_YAML = path.join(JEKYLL_ROOT, '_data', 'gift_finder.yml');
const GIFT_FINDER_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'gift-finder');

try {
  if (!fs.existsSync(GIFT_FINDER_BACKUPS_DIR)) {
    fs.mkdirSync(GIFT_FINDER_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize GIFT_FINDER_BACKUPS_DIR:', e);
}

function backupGiftFinderFile(action: string): string | null {
  try {
    if (!fs.existsSync(GIFT_FINDER_FILE)) return null;
    if (!fs.existsSync(GIFT_FINDER_BACKUPS_DIR)) {
      fs.mkdirSync(GIFT_FINDER_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gift-finder_${timestamp}_${action}.html`;
    const destPath = path.join(GIFT_FINDER_BACKUPS_DIR, filename);
    fs.copyFileSync(GIFT_FINDER_FILE, destPath);

    const files = fs.readdirSync(GIFT_FINDER_BACKUPS_DIR).filter(f => f.endsWith('.html')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(GIFT_FINDER_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create gift finder backup:', err);
    return null;
  }
}

function parseGiftFinderHtml(rawHtml: string): any {
  let frontMatter = {
    layout: 'default',
    title: 'Gift Finder | Science of Gifts',
    description: 'Answer a few thoughtful questions to discover recommendations.'
  };

  const fmMatch = rawHtml.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    try {
      const parsedFm = yaml.load(fmMatch[1]);
      if (parsedFm && typeof parsedFm === 'object') {
        frontMatter = { ...frontMatter, ...parsedFm };
      }
    } catch (e) {}
  }

  const badgeMatch = rawHtml.match(/<div id="finder-results-header"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) || rawHtml.match(/Editorial Gift Matching Engine/i);
  const badge = badgeMatch ? (badgeMatch[1] || 'Editorial Gift Matching Engine').trim() : 'Editorial Gift Matching Engine';

  const titleMatch = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Find the Exact Right Gift';

  const leadMatch = rawHtml.match(/<p class="text-base sm:text-lg text-\[#5A6270\][^>]*>([\s\S]*?)<\/p>/i);
  const lead = leadMatch ? leadMatch[1].trim() : 'Answer six brief questions about the person you are buying for.';

  const steps: any[] = [];
  for (let s = 1; s <= 6; s++) {
    const stepBlockRegex = new RegExp(`<div data-step="${s}" data-field="([^"]+)" class="finder-step-pane[^"]*">([\\s\\S]*?)(?=<div data-step="${s + 1}"|<div class="pt-6 border-t)`, 'i');
    const stepMatch = rawHtml.match(stepBlockRegex);
    
    if (stepMatch) {
      const field = stepMatch[1];
      const content = stepMatch[2];

      const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const stepTitle = h2Match ? h2Match[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim() : `Step ${s}`;

      const subBadgeMatch = content.match(/<span class="text-xs text-\[#226E56\] font-semibold">([\s\S]*?)<\/span>/i);
      const subBadge = subBadgeMatch ? subBadgeMatch[1].trim() : undefined;

      const promptMatch = content.match(/<p class="text-xs sm:text-sm text-\[#5A6270\][^>]*>([\s\S]*?)<\/p>/i);
      const prompt = promptMatch ? promptMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim() : '';

      const options: any[] = [];
      const optionBtnRegex = /<button data-value="([^"]+)" class="finder-option-btn[^"]*">([\s\S]*?)<\/button>/g;
      let btnMatch;
      while ((btnMatch = optionBtnRegex.exec(content)) !== null) {
        const value = btnMatch[1];
        const btnInner = btnMatch[2];

        const fontSemiboldMatch = btnInner.match(/<div class="font-semibold text-sm">([\s\S]*?)<\/div>/i);
        const descMatch = btnInner.match(/<div class="text-xs text-\[#5A6270\] mt-1">([\s\S]*?)<\/div>/i);

        if (fontSemiboldMatch) {
          options.push({
            value,
            label: fontSemiboldMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim(),
            description: descMatch ? descMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim() : ''
          });
        } else {
          const labelMatch = btnInner.match(/<span class="text-xs sm:text-sm">([\s\S]*?)<\/span>/i) || btnInner.match(/<div class="text-sm">([\s\S]*?)<\/div>/i) || btnInner.match(/<div class="text-xs sm:text-sm">([\s\S]*?)<\/div>/i);
          const labelText = labelMatch ? labelMatch[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim() : value;
          options.push({
            value,
            label: labelText
          });
        }
      }

      steps.push({
        step: s,
        field,
        title: stepTitle,
        prompt,
        ...(subBadge ? { subBadge } : {}),
        options
      });
    }
  }

  const prevBtnMatch = rawHtml.match(/<button id="finder-prev-btn"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
  const nextBtnMatch = rawHtml.match(/<button id="finder-next-btn"[^>]*><span>([\s\S]*?)<\/span>/i);
  const submitBtnMatch = rawHtml.match(/<button id="finder-submit-btn"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);

  const prevButtonText = prevBtnMatch ? prevBtnMatch[1].trim() : 'Previous';
  const nextButtonText = nextBtnMatch ? nextBtnMatch[1].trim() : 'Next Step';
  const submitButtonText = submitBtnMatch ? submitBtnMatch[1].trim() : 'View Recommendations';

  return {
    badge,
    title,
    lead,
    steps,
    prevButtonText,
    nextButtonText,
    submitButtonText
  };
}

function getGiftFinderConfig(): any {
  if (fs.existsSync(GIFT_FINDER_YAML)) {
    try {
      const raw = fs.readFileSync(GIFT_FINDER_YAML, 'utf8');
      const parsed = yaml.load(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {}
  }

  let parsedSteps = {
    badge: 'Editorial Gift Matching Engine',
    title: 'Find the Exact Right Gift',
    lead: 'Answer six brief questions about the person you are buying for, their passions, and your target budget.',
    steps: [],
    prevButtonText: 'Previous',
    nextButtonText: 'Next Step',
    submitButtonText: 'View Recommendations'
  };
  if (fs.existsSync(GIFT_FINDER_FILE)) {
    try {
      const rawHtml = fs.readFileSync(GIFT_FINDER_FILE, 'utf8');
      parsedSteps = parseGiftFinderHtml(rawHtml);
    } catch (e) {}
  }

  const defaultConfig = {
    ...parsedSteps,
    budgetRules: [
      { value: 'under-25', label: 'Under $25', minPrice: null, maxPrice: 28 },
      { value: '25-50', label: '$25 to $50', minPrice: 35, maxPrice: 50 },
      { value: '50-100', label: '$50 to $100', minPrice: 35, maxPrice: 100 },
      { value: '100-plus', label: '$100 and above', minPrice: 85, maxPrice: null },
      { value: 'any', label: 'Any Budget', minPrice: null, maxPrice: null }
    ],
    scoring: {
      recipientMatch: 15,
      interestMatchPerItem: 10,
      personalityMatch: 8,
      occasionMatch: 5,
      ageMatch: 12,
      editorsPickBonus: 10
    },
    resultsConfig: {
      bestMatchCount: 1,
      alsoConsiderCount: 3,
      moreIdeasCount: 4
    },
    labels: {
      bestMatchLabel: "Best Match",
      alsoConsiderLabel: "Also Consider",
      moreIdeasLabel: "More Ideas",
      viewRecommendations: "View Recommendations",
      adjustAnswers: "Adjust Answers",
      startOver: "Start Over",
      nextStep: "Next Step",
      previous: "Previous"
    },
    faqs: [
      { question: "How does the Science of Gifts Gift Finder match recommendations?", answer: "The Gift Finder uses an in-browser weighted scoring engine across our independently tested catalog. It cross-references recipient relationships, age ranges, strict price ceilings, passions (such as history, books, or science), occasions, and desired gift personality (e.g. heirloom or practical) without using external AI APIs or tracking personal data." },
      { question: "How are maximum budget limits enforced?", answer: "Our engine strictly filters candidate products against your chosen price tier before ranking. When you select Under $25, $25–$50, or $50–$100, items priced higher than the ceiling are excluded from your primary recommendations so you never see out-of-budget suggestions." },
      { question: "What is the best gift strategy for someone who \"has everything\"?", answer: "For recipients who readily purchase their own everyday necessities, we recommend narrative objects: single-harvest extra virgin olive oils in hand-painted ceramics, laboratory-grade optical prisms that refract natural sunlight, or bespoke desk ephemera crafted from solid brass and archival rag paper." },
      { question: "What is the \"periphery gifting\" rule for deep enthusiasts and specialists?", answer: "When shopping for someone with deep domain expertise (e.g., an archivist, chef, or astronomer), avoid guessing their core technical tools. Instead, choose items that celebrate the culture, history, or tactile ceremony of their craft—such as museum-grade cartography prints, unlacquered brass book weights, or facsimile primary sources." },
      { question: "Are any product rankings or recommendations sponsored?", answer: "No. Science of Gifts maintains absolute editorial independence. We never accept paid product placements, sponsored rankings, or promotional free samples in exchange for positive reviews. Selections are chosen solely based on physical durability, craftsmanship, and narrative value." },
      { question: "Can I save recommended items for later review?", answer: "Yes. Clicking the \"Save\" bookmark button on any recommendation adds the object to your personal shortlist, stored locally on your device in your browser. You can access your saved items at any time from the top navigation bar." }
    ]
  };

  if (!fs.existsSync(path.dirname(GIFT_FINDER_YAML))) {
    fs.mkdirSync(path.dirname(GIFT_FINDER_YAML), { recursive: true });
  }
  fs.writeFileSync(GIFT_FINDER_YAML, yaml.dump(defaultConfig), 'utf8');
  return defaultConfig;
}

function generateGiftFinderHtml(data: any): string {
  const escapeHtml = (str: string) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const renderOption = (stepField: string, opt: any) => {
    if (stepField === 'budget' || stepField === 'personalityStyle') {
      return `<button data-value="${escapeHtml(opt.value)}" class="finder-option-btn p-4 text-left border rounded transition-all cursor-pointer w-full bg-[#FAF9F6] border-stone-200 text-[#1E232B] hover:border-[#99BFF9]"><div class="font-semibold text-sm">${escapeHtml(opt.label)}</div>${opt.description ? `<div class="text-xs text-[#5A6270] mt-1">${escapeHtml(opt.description)}</div>` : ''}</button>`;
    } else if (stepField === 'interests') {
      return `<button data-value="${escapeHtml(opt.value)}" class="finder-option-btn p-3.5 text-left border rounded transition-all cursor-pointer flex items-center justify-between w-full bg-[#FAF9F6] border-stone-200 text-[#1E232B] hover:border-[#99BFF9]"><span class="text-xs sm:text-sm">${escapeHtml(opt.label)}</span></button>`;
    } else if (stepField === 'occasion') {
      return `<button data-value="${escapeHtml(opt.value)}" class="finder-option-btn p-3.5 text-left border rounded transition-all cursor-pointer w-full bg-[#FAF9F6] border-stone-200 text-[#1E232B] hover:border-[#99BFF9]"><div class="text-xs sm:text-sm">${escapeHtml(opt.label)}</div></button>`;
    } else {
      return `<button data-value="${escapeHtml(opt.value)}" class="finder-option-btn p-4 text-left border rounded transition-all cursor-pointer w-full bg-[#FAF9F6] border-stone-200 text-[#1E232B] hover:border-[#99BFF9]"><div class="text-sm">${escapeHtml(opt.label)}</div></button>`;
    }
  };

  const renderStep = (s: any) => {
    const isHidden = s.step !== 1 ? 'hidden' : '';
    let gridCols = 'grid-cols-2 sm:grid-cols-3';
    if (s.field === 'budget') gridCols = 'grid-cols-1 sm:grid-cols-2';
    if (s.field === 'occasion') gridCols = 'grid-cols-2 sm:grid-cols-4';
    if (s.field === 'personalityStyle') gridCols = 'grid-cols-1 sm:grid-cols-2';

    const subBadgeHtml = s.subBadge ? `<span class="text-xs text-[#226E56] font-semibold">${escapeHtml(s.subBadge)}</span>` : '';
    const headerTitleInner = s.subBadge ? `<div class="flex items-center justify-between"><h2 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">${escapeHtml(s.title)}</h2>${subBadgeHtml}</div>` : `<h2 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">${escapeHtml(s.title)}</h2>`;

    return `<div data-step="${s.step}" data-field="${escapeHtml(s.field)}" class="finder-step-pane space-y-6 ${isHidden}">
<div class="space-y-1 text-center sm:text-left">
${headerTitleInner}
<p class="text-xs sm:text-sm text-[#5A6270]">${escapeHtml(s.prompt)}</p>
</div>
<div class="grid ${gridCols} gap-3 pt-2">
${(s.options || []).map((opt: any) => renderOption(s.field, opt)).join('\n')}
</div>
</div>`;
  };

  const faqsHtml = (data.faqs || []).map((faq: any, idx: number) => `
  <div class="faq-item bg-white border border-[#99BFF9]/30 rounded overflow-hidden transition-all shadow-2xs">
    <button class="faq-trigger w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#EEF5FF]/40 transition-colors" aria-expanded="${idx === 0 ? 'true' : 'false'}">
      <span class="font-serif-display text-base text-[#1E232B]">${escapeHtml(faq.question)}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="faq-chevron w-4 h-4 text-[#2A548E] shrink-0 transition-transform duration-200 ${idx === 0 ? 'rotate-180 transform' : ''}">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    <div class="faq-content px-4 pb-5 sm:px-5 text-sm text-[#5A6270] leading-relaxed border-t border-[#99BFF9]/15 pt-3 ${idx !== 0 ? 'hidden' : ''}">
      ${escapeHtml(faq.answer)}
    </div>
  </div>
  `).join('');

  return `---
layout: default
title: "Gift Finder   Curated Recommendations | Science of Gifts"
description: "Answer a few thoughtful questions to discover tested, research-backed gift recommendations tailored to your recipient's passions and habits."
---
<script>
  window.SOG_GIFT_FINDER = ${JSON.stringify(data)};
</script>
<div id="gift-finder-container" class="pb-16 space-y-12"><div class="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#5A6270]"><nav class="flex items-center space-x-2"><a href="/" class="hover:text-[#2A548E] transition-colors cursor-pointer">Home</a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-3 h-3 text-[#5A6270]/40" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg><span class="text-[#2A548E] font-medium">Gift Finder</span></nav></div></div><header class="pt-6 pb-6 border-b border-[#99BFF9]/25"><div id="finder-results-header" class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center"><div class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-semibold uppercase tracking-wider rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles w-3.5 h-3.5 text-[#226E56]" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><span>${escapeHtml(data.badge)}</span></div><h1 class="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-[#1E232B] font-normal leading-[1.18] text-balance">${escapeHtml(data.title)}</h1><p class="text-base sm:text-lg text-[#5A6270] leading-relaxed max-w-2xl mx-auto">${escapeHtml(data.lead)}</p></div></header><div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"><div id="finder-questionnaire-flow" class="bg-white border border-[#99BFF9]/35 p-6 sm:p-10 space-y-8 shadow-xs"><div class="space-y-3 border-b border-[#99BFF9]/20 pb-4"><div class="flex items-center justify-between text-xs"><div id="finder-step-count-text" class="text-[#2A548E] font-semibold uppercase tracking-wider flex items-center gap-1.5">Step 1 of 6 · 0% Complete</div></div><div class="w-full h-1 bg-[#EEF5FF] rounded-full overflow-hidden"><div id="finder-progress-bar" class="h-full bg-linear-to-r from-[#99BFF9] to-[#C3F3DF] transition-all duration-300" style="width:0%"></div></div></div>
${(data.steps || []).map(renderStep).join('\n')}
<div class="pt-6 border-t border-[#99BFF9]/20 flex items-center justify-between"><button id="finder-prev-btn" class="px-4 py-2 border border-stone-300 text-xs font-medium text-[#5A6270] hover:text-[#1E232B] rounded flex items-center gap-1 cursor-pointer invisible"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left w-4 h-4" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg><span>${escapeHtml(data.prevButtonText)}</span></button><div class="flex items-center gap-3"><button id="finder-next-btn" class="px-6 py-2.5 bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] text-[#1B365D] text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 duration-300 flex items-center gap-1.5 cursor-pointer shadow-sm rounded-none "><span>${escapeHtml(data.nextButtonText)}</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-4 h-4" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button><button id="finder-submit-btn" class="px-6 py-2.5 bg-gradient-to-r from-[#C3F3DF] to-[#99BFF9] text-[#1E232B] text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 duration-300 flex items-center gap-1.5 cursor-pointer shadow-sm rounded-none hidden"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles w-4 h-4" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><span>${escapeHtml(data.submitButtonText)}</span></button></div></div></div><div id="finder-results-view" class="space-y-12 hidden"></div>

<div class="mt-16 pt-12 border-t border-[#99BFF9]/30 space-y-8 max-w-3xl mx-auto">
  <h2 class="font-serif-display text-2xl text-[#1E232B] font-medium mb-6 text-center">Frequently Asked Questions</h2>
  <div class="space-y-4">
    ${faqsHtml}
  </div>
</div>
</div></div>
`;
}

function executeAtomicGiftFinderWrite(params: { data: any; action: string }): { backupFile: string | null } {
  const { data, action } = params;
  if (!fs.existsSync(path.dirname(GIFT_FINDER_YAML))) {
    fs.mkdirSync(path.dirname(GIFT_FINDER_YAML), { recursive: true });
  }
  const backupFile = backupGiftFinderFile(action);
  fs.writeFileSync(GIFT_FINDER_YAML, yaml.dump(data), 'utf8');

  const newHtml = generateGiftFinderHtml(data);
  const tempFile = `${GIFT_FINDER_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, newHtml, 'utf8');
  fs.renameSync(tempFile, GIFT_FINDER_FILE);

  return { backupFile };
}

function saveGiftFinderConfig(data: any): { backupFile: string | null } {
  return executeAtomicGiftFinderWrite({ data, action: 'update_gift_finder' });
}

// GET /api/gift-finder
app.get('/api/gift-finder', (req: Request, res: Response) => {
  try {
    const config = getGiftFinderConfig();
    res.json({ success: true, giftFinder: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to read gift finder data: ${err.message}` });
  }
});

// PUT /api/gift-finder
app.put('/api/gift-finder', (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data || !data.title || !Array.isArray(data.steps)) {
      return res.status(400).json({ success: false, error: 'Invalid gift finder payload. Title and steps required.' });
    }

    const writeResult = saveGiftFinderConfig(data);

    res.json({
      success: true,
      message: 'Gift Finder editorial configuration updated successfully.',
      giftFinder: data,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update gift finder: ${err.message}` });
  }
});

// GET /api/gift-finder-backups
app.get('/api/gift-finder-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GIFT_FINDER_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(GIFT_FINDER_BACKUPS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const full = path.join(GIFT_FINDER_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.html', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list gift finder backups: ${err.message}` });
  }
});

// POST /api/gift-finder-backups/restore
app.post('/api/gift-finder-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(GIFT_FINDER_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = parseGiftFinderHtml(rawBackup);

    const writeResult = executeAtomicGiftFinderWrite({
      data: parsed,
      action: 'restore'
    });

    res.json({
      success: true,
      message: `Restored gift finder from backup "${safeFilename}".`,
      giftFinder: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// =============================================================
// PHASE 7 & 8: STATIC EDITORIAL, LEGAL & SYSTEM PAGES API
// =============================================================
const ALLOWED_PAGE_SLUGS = [
  'about', 'affiliate-disclosure', 'contact', 'privacy', 'terms', '404', 'sitemap',
  'home', 'gift-guides', 'articles', 'gift-finder', 'for-men', 'for-women'
];
const PAGES_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'pages');

try {
  if (!fs.existsSync(PAGES_BACKUPS_DIR)) {
    fs.mkdirSync(PAGES_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize PAGES_BACKUPS_DIR:', e);
}

function getPageFilePath(slug: string): string | null {
  if (!ALLOWED_PAGE_SLUGS.includes(slug)) return null;
  if (slug === '404') return path.join(JEKYLL_ROOT, '404.html');
  if (slug === 'home') return path.join(JEKYLL_ROOT, 'index.md');
  return path.join(JEKYLL_ROOT, slug, 'index.html');
}

function backupPageFile(slug: string, action: string): string | null {
  try {
    const pagePath = getPageFilePath(slug);
    if (!pagePath || !fs.existsSync(pagePath)) return null;
    if (!fs.existsSync(PAGES_BACKUPS_DIR)) {
      fs.mkdirSync(PAGES_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${slug}_${timestamp}_${action}.html`;
    const destPath = path.join(PAGES_BACKUPS_DIR, filename);
    fs.copyFileSync(pagePath, destPath);

    const files = fs.readdirSync(PAGES_BACKUPS_DIR).filter(f => f.endsWith('.html')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(PAGES_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error(`Failed to create backup for page ${slug}:`, err);
    return null;
  }
}

function parseStaticPageHtml(slug: string, rawHtml: string): any {
  let title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  let description = '';
  let searchTitle: string | undefined = undefined;
  let seoDescription: string | undefined = undefined;
  let badge = 'Editorial Standards';
  let lead = '';
  let bodyMarkdown = '';
  let robots: any = null;

  // Extract frontmatter
  const fmMatch = rawHtml.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    try {
      const parsedFm = yaml.load(fmMatch[1]) as any;
      if (parsedFm && typeof parsedFm === 'object') {
        if (parsedFm.title) title = parsedFm.title.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        if (parsedFm.description) description = parsedFm.description.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        if (parsedFm['search-title']) searchTitle = String(parsedFm['search-title']).replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        if (parsedFm['seo-description']) seoDescription = String(parsedFm['seo-description']).replace(/&amp;/g, '&').replace(/&#x27;/g, "'");
        if (parsedFm.robots) robots = parsedFm.robots;
      }
    } catch (e) {}
  }

  const SYSTEM_LAYOUT_PAGE_SLUGS = ['home', 'gift-guides', 'articles', 'gift-finder', 'for-men', 'for-women'];

  if (SYSTEM_LAYOUT_PAGE_SLUGS.includes(slug)) {
    return {
      slug,
      pageType: 'system-layout',
      title,
      description,
      'search-title': searchTitle,
      'seo-description': seoDescription,
      searchTitle,
      seoDescription,
      robots,
      badge,
      lead,
      content: ''
    };
  }

  // Handling 404 Special System Page
  if (slug === '404') {
    let headline = 'A Cartographic Deviation';
    let quote = '"Not all who wander are lost, but some are definitely off-route."';
    let btnHome = 'Return to Home';
    let btnFinder = 'Launch Gift Finder';
    let btnGuides = 'Browse Gift Guides';

    const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) headline = h1Match[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();

    const pMatch = rawHtml.match(/<p class="text-base sm:text-lg text-\[#5A6270\][^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) lead = pMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    else lead = description;

    const quoteMatch = rawHtml.match(/<div class="text-\[11px\] text-\[#5A6270\] italic font-serif">([\s\S]*?)<\/div>/i);
    if (quoteMatch) quote = quoteMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();

    const homeMatch = rawHtml.match(/href="\/"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (homeMatch) btnHome = homeMatch[1].trim();

    const finderMatch = rawHtml.match(/href="\/gift-finder\/"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (finderMatch) btnFinder = finderMatch[1].trim();

    const guidesMatch = rawHtml.match(/href="\/gift-guides\/"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (guidesMatch) btnGuides = guidesMatch[1].trim();

    return {
      slug,
      pageType: 'special',
      title,
      description,
      'search-title': searchTitle,
      'seo-description': seoDescription,
      searchTitle,
      seoDescription,
      robots,
      headline,
      lead,
      quote,
      btnHome,
      btnFinder,
      btnGuides,
      content: ''
    };
  }

  // Handling Sitemap Structured Page
  if (slug === 'sitemap') {
    const badgeMatch = rawHtml.match(/<div class="text-xs uppercase tracking-widest text-\[#226E56\] font-semibold">([\s\S]*?)<\/div>/i);
    if (badgeMatch) badge = badgeMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();

    const leadMatch = rawHtml.match(/<p class="text-base sm:text-lg text-\[#5A6270\] leading-relaxed">([\s\S]*?)<\/p>/i);
    if (leadMatch) lead = leadMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    else lead = description;

    // Preserve cards directory HTML block inside <div class="max-w-3xl ... space-y-10 ...">...</div>
    const cardsMatch = rawHtml.match(/<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-base text-\[#1E232B\] leading-relaxed">([\s\S]*?)<\/div>\s*<\/div>/i);
    const cardsHtml = cardsMatch ? cardsMatch[1].trim() : '';

    return {
      slug,
      pageType: 'structured',
      title,
      description,
      'search-title': searchTitle,
      'seo-description': seoDescription,
      searchTitle,
      seoDescription,
      robots,
      badge: badge || 'Directory & Navigation',
      lead,
      cardsHtml,
      content: ''
    };
  }

  // Handling Standard Rich-Text Pages (about, affiliate-disclosure, contact, privacy, terms)
  const badgeMatch = rawHtml.match(/<div class="text-xs uppercase tracking-widest text-\[#226E56\] font-semibold">([\s\S]*?)<\/div>/i);
  if (badgeMatch) {
    badge = badgeMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
  }

  const leadMatch = rawHtml.match(/<p class="text-base sm:text-lg text-\[#5A6270\] leading-relaxed">([\s\S]*?)<\/p>/i);
  if (leadMatch) {
    lead = leadMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
  } else {
    lead = description;
  }

  const bodyMatch = rawHtml.match(/<div class="markdown-body space-y-6">([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/i) || rawHtml.match(/<div class="markdown-body space-y-6">([\s\S]*?)<\/div>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1].trim() : '';

  if (bodyHtml) {
    const td = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });
    bodyMarkdown = td.turndown(bodyHtml);
  }

  return {
    slug,
    pageType: 'standard',
    title,
    description,
    'search-title': searchTitle,
    'seo-description': seoDescription,
    searchTitle,
    seoDescription,
    robots,
    badge,
    lead,
    content: bodyMarkdown || bodyHtml
  };
}

function generateStaticPageHtml(slug: string, data: any): string {
  const escapeHtml = (str: string) => (str || '')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let robotsStr = '';
  if (data.robots) {
    if (typeof data.robots === 'object') {
      robotsStr = `\nrobots:\n  index: ${data.robots.index ?? true}\n  follow: ${data.robots.follow ?? true}`;
    } else if (typeof data.robots === 'string') {
      robotsStr = `\nrobots: ${data.robots}`;
    }
  }

  const searchTitleVal = data['search-title'] || data.searchTitle;
  const seoDescVal = data['seo-description'] || data.seoDescription;
  const searchTitleStr = searchTitleVal ? `\nsearch-title: "${String(searchTitleVal).replace(/"/g, '\\"')}"` : '';
  const seoDescStr = seoDescVal ? `\nseo-description: "${String(seoDescVal).replace(/"/g, '\\"')}"` : '';

  if (slug === '404') {
    return `---
layout: default
title: "${escapeHtml(data.title)}"
description: "${escapeHtml(data.description || data.lead || '')}"${searchTitleStr}${seoDescStr}
permalink: /404.html${robotsStr}
---
<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center space-y-8"><div class="w-20 h-20 rounded-full bg-[#EEF5FF] text-[#2A548E] mx-auto flex items-center justify-center border border-[#99BFF9]/30 relative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-10 h-10 animate-pulse text-[#2A548E]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span class="absolute -top-1 -right-1 flex h-4 w-4"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C3F3DF] opacity-75"></span><span class="relative inline-flex rounded-full h-4 w-4 bg-[#226E56]"></span></span></div><div class="space-y-3"><span class="text-xs uppercase tracking-widest text-[#226E56] font-semibold font-mono-code">Error Code: 404</span><h1 class="font-serif-display text-4xl sm:text-5xl lg:text-6xl text-[#1E232B] font-normal leading-tight text-balance">${escapeHtml(data.headline || data.title)}</h1><p class="text-base sm:text-lg text-[#5A6270] leading-relaxed max-w-xl mx-auto font-serif italic">${escapeHtml(data.lead || data.description)}</p></div><div class="max-w-md mx-auto p-6 bg-white border border-[#99BFF9]/25 shadow-xs space-y-4"><div class="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/25 aspect-[16/9] rounded-sm flex items-center justify-center"><svg class="w-full h-full opacity-80" viewBox="0 0 800 450" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="450" fill="#FAF9F6"></rect><ellipse cx="400" cy="225" rx="160" ry="160" fill="none" stroke="#99BFF9" stroke-opacity="0.3" stroke-width="1"></ellipse><ellipse cx="400" cy="225" rx="120" ry="120" fill="none" stroke="#2A548E" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="4 4"></ellipse><ellipse cx="400" cy="225" rx="80" ry="80" fill="none" stroke="#C5A059" stroke-opacity="0.5" stroke-width="1"></ellipse><line x1="400" y1="0" x2="400" y2="450" stroke="#99BFF9" stroke-opacity="0.2" stroke-width="1"></line><line x1="0" y1="225" x2="800" y2="225" stroke="#99BFF9" stroke-opacity="0.2" stroke-width="1"></line><circle cx="400" cy="225" r="4" fill="#1B365D"></circle><polygon points="400,165 408,225 400,217" fill="#1B365D"></polygon><polygon points="400,285 408,225 400,217" fill="#C5A059"></polygon><polygon points="400,165 392,225 400,217" fill="#2A548E"></polygon><polygon points="400,285 392,225 400,217" fill="#8E6B2A"></polygon><text x="400" y="145" text-anchor="middle" fill="#2D3748" font-size="10" font-family="JetBrains Mono, monospace" letter-spacing="1">TERRA INCOGNITA</text></svg></div><div class="text-[11px] text-[#5A6270] italic font-serif">${escapeHtml(data.quote || '"Not all who wander are lost, but some are definitely off-route."')}</div></div><div class="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4"><a href="/" class="w-full sm:w-auto px-6 py-3 bg-[#2A548E] hover:bg-[#1B365D] text-white text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-2 shadow-xs"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg><span>${escapeHtml(data.btnHome || 'Return to Home')}</span></a><a href="/gift-finder/" class="w-full sm:w-auto px-6 py-3 bg-[#EEF5FF] hover:bg-[#D8E8FC] text-[#2A548E] border border-[#99BFF9]/40 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#226E56]"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"></path></svg><span>${escapeHtml(data.btnFinder || 'Launch Gift Finder')}</span></a><a href="/gift-guides/" class="w-full sm:w-auto px-6 py-3 bg-white hover:bg-stone-50 text-[#1E232B] border border-stone-200 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>${escapeHtml(data.btnGuides || 'Browse Gift Guides')}</span></a></div></div>
`;
  }

  if (slug === 'sitemap') {
    return `---
layout: default
title: "${escapeHtml(data.title)}"
description: "${escapeHtml(data.description || data.lead || '')}"${searchTitleStr}${seoDescStr}${robotsStr}
---
<div class="pb-16 space-y-12"><div class="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#5A6270]"><nav class="flex items-center space-x-2"><a href="/" class="hover:text-[#2A548E] transition-colors">Home</a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-3 h-3 text-[#5A6270]/40" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg><span class="text-[#2A548E] font-medium">${escapeHtml(data.title)}</span></nav></div></div><header class="pt-8 pb-8 border-b border-[#99BFF9]/25"><div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center sm:text-left"><div class="text-xs uppercase tracking-widest text-[#226E56] font-semibold">${escapeHtml(data.badge || 'Directory & Navigation')}</div><h1 class="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-[#1E232B] font-normal leading-[1.18] text-balance">${escapeHtml(data.title)}</h1><p class="text-base sm:text-lg text-[#5A6270] leading-relaxed">${escapeHtml(data.lead || data.description)}</p></div></header><div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-base text-[#1E232B] leading-relaxed">${data.cardsHtml || ''}</div></div>
`;
  }

  // Convert markdown to clean HTML body
  const bodyHtml = marked.parse(data.content || '') as string;

  return `---
layout: default
title: "${escapeHtml(data.title)}"
description: "${escapeHtml(data.description || data.lead || '')}"${searchTitleStr}${seoDescStr}${robotsStr}
---
<article class="pb-16 space-y-12"><div class="bg-[#EEF5FF]/80 border-b border-[#99BFF9]/20 py-3"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-[#5A6270]"><nav class="flex items-center space-x-2"><a href="/" class="hover:text-[#2A548E] transition-colors">Home</a><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-3 h-3 text-[#5A6270]/40" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg><span class="text-[#2A548E] font-medium">${escapeHtml(data.title)}</span></nav></div></div><header class="pt-8 pb-8 border-b border-[#99BFF9]/25"><div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center sm:text-left"><div class="text-xs uppercase tracking-widest text-[#226E56] font-semibold">${escapeHtml(data.badge)}</div><h1 class="font-serif-display text-3xl sm:text-4xl lg:text-5xl text-[#1E232B] font-normal leading-[1.18] text-balance">${escapeHtml(data.title)}</h1><p class="text-base sm:text-lg text-[#5A6270] leading-relaxed">${escapeHtml(data.lead)}</p></div></header><div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-base text-[#1E232B] leading-relaxed"><div class="markdown-body space-y-6">${bodyHtml}</div></div></article>
`;
}

function executeAtomicPageWrite(slug: string, data: any, action: string): { backupFile: string | null } {
  const pagePath = getPageFilePath(slug);
  if (!pagePath) throw new Error(`Invalid page slug: ${slug}`);

  const backupFile = backupPageFile(slug, action);

  let newContent = '';
  const rawContent = fs.readFileSync(pagePath, 'utf8');
  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (fmMatch) {
    // Surgical YAML Front Matter Update
    const originalFm = yaml.load(fmMatch[1]) as any || {};
    
    const searchVal = data['search-title'] !== undefined ? data['search-title'] : data.searchTitle;
    const seoDescVal = data['seo-description'] !== undefined ? data['seo-description'] : data.seoDescription;

    // Preserve every existing front matter field byte-for-byte/unchanged except what was explicitly changed
    const mergedFm = {
      ...originalFm,
      ...(data.robots !== undefined ? { robots: data.robots } : {})
    };

    if (searchVal !== undefined) {
      if (searchVal && String(searchVal).trim()) {
        mergedFm['search-title'] = String(searchVal).trim();
      } else {
        delete mergedFm['search-title'];
      }
    }

    if (seoDescVal !== undefined) {
      if (seoDescVal && String(seoDescVal).trim()) {
        mergedFm['seo-description'] = String(seoDescVal).trim();
      } else {
        delete mergedFm['seo-description'];
      }
    }

    if (data.title && typeof data.title === 'string') {
      mergedFm.title = data.title;
    }
    if (data.description && typeof data.description === 'string') {
      mergedFm.description = data.description;
    }
    
    const serializedFm = yaml.dump(mergedFm).trim();
    const originalBody = rawContent.substring(fmMatch[0].length);
    newContent = `---\n${serializedFm}\n---${originalBody}`;
  } else {
    newContent = generateStaticPageHtml(slug, data);
  }

  const tempFile = `${pagePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, newContent, 'utf8');
  fs.renameSync(tempFile, pagePath);

  return { backupFile };
}

// GET /api/pages
app.get('/api/pages', (req: Request, res: Response) => {
  try {
    const list = ALLOWED_PAGE_SLUGS.map(slug => {
      const pagePath = getPageFilePath(slug);
      if (!pagePath || !fs.existsSync(pagePath)) return null;
      const stats = fs.statSync(pagePath);
      const rawHtml = fs.readFileSync(pagePath, 'utf8');
      const parsed = parseStaticPageHtml(slug, rawHtml);
      return {
        ...parsed,
        mtime: stats.mtime.toISOString(),
        size: stats.size
      };
    }).filter(Boolean);

    res.json({ success: true, pages: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list static pages: ${err.message}` });
  }
});

// GET /api/pages/:slug
app.get('/api/pages/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!ALLOWED_PAGE_SLUGS.includes(slug)) {
      return res.status(403).json({ success: false, error: `Access forbidden for slug "${slug}". Only static editorial pages are allowed.` });
    }

    const pagePath = getPageFilePath(slug);
    if (!pagePath || !fs.existsSync(pagePath)) {
      return res.status(404).json({ success: false, error: `Page "/${slug}/index.html" does not exist.` });
    }

    const stats = fs.statSync(pagePath);
    const rawHtml = fs.readFileSync(pagePath, 'utf8');
    const parsed = parseStaticPageHtml(slug, rawHtml);

    res.json({
      success: true,
      page: {
        ...parsed,
        mtime: stats.mtime.toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to read page: ${err.message}` });
  }
});

// PUT /api/pages/:slug
app.put('/api/pages/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!ALLOWED_PAGE_SLUGS.includes(slug)) {
      return res.status(403).json({ success: false, error: `Access forbidden for slug "${slug}".` });
    }

    const data = req.body;
    if (!data || !data.title || data.content === undefined) {
      return res.status(400).json({ success: false, error: 'Invalid page payload. Title and content required.' });
    }

    const writeResult = executeAtomicPageWrite(slug, data, 'update_page');

    res.json({
      success: true,
      message: `Static page "/${slug}/" updated successfully.`,
      page: { ...data, slug },
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update page: ${err.message}` });
  }
});

// GET /api/pages-backups
app.get('/api/pages-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(PAGES_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(PAGES_BACKUPS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const full = path.join(PAGES_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.html', '').split('_');
        const slug = parts[0];
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          slug,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list page backups: ${err.message}` });
  }
});

// POST /api/pages-backups/restore
app.post('/api/pages-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(PAGES_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file "${safeFilename}" not found.` });
    }

    const parts = safeFilename.replace('.html', '').split('_');
    const slug = parts[0];

    if (!ALLOWED_PAGE_SLUGS.includes(slug)) {
      return res.status(403).json({ success: false, error: `Invalid page slug in backup filename: ${slug}` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = parseStaticPageHtml(slug, rawBackup);

    const writeResult = executeAtomicPageWrite(slug, parsed, 'restore');

    res.json({
      success: true,
      message: `Restored "/${slug}/" from backup "${safeFilename}".`,
      page: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// =============================================================
// PHASE 9: GLOBAL SITE COMPONENTS API (newsletter, footer, editors-pick)
// =============================================================
const ALLOWED_GLOBAL_COMPONENTS = ['newsletter', 'footer', 'editors-pick'];
const GLOBAL_COMPONENTS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'global-components');

try {
  if (!fs.existsSync(GLOBAL_COMPONENTS_BACKUPS_DIR)) {
    fs.mkdirSync(GLOBAL_COMPONENTS_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize GLOBAL_COMPONENTS_BACKUPS_DIR:', e);
}

function getGlobalComponentFilePath(key: string): string | null {
  if (!ALLOWED_GLOBAL_COMPONENTS.includes(key)) return null;
  if (key === 'newsletter') return path.join(JEKYLL_ROOT, '_includes', 'newsletter.html');
  if (key === 'footer') return path.join(JEKYLL_ROOT, '_includes', 'footer.html');
  if (key === 'editors-pick') return path.join(JEKYLL_ROOT, '_includes', 'editors-pick.html');
  return null;
}

function backupGlobalComponentFile(key: string, action: string): string | null {
  try {
    const filePath = getGlobalComponentFilePath(key);
    if (!filePath || !fs.existsSync(filePath)) return null;
    if (!fs.existsSync(GLOBAL_COMPONENTS_BACKUPS_DIR)) {
      fs.mkdirSync(GLOBAL_COMPONENTS_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${key}_${timestamp}_${action}.html`;
    const destPath = path.join(GLOBAL_COMPONENTS_BACKUPS_DIR, filename);
    fs.copyFileSync(filePath, destPath);

    const files = fs.readdirSync(GLOBAL_COMPONENTS_BACKUPS_DIR).filter(f => f.endsWith('.html')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(GLOBAL_COMPONENTS_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error(`Failed to create backup for global component ${key}:`, err);
    return null;
  }
}

function parseGlobalComponentHtml(key: string, rawHtml: string): any {
  if (key === 'newsletter') {
    let badge = 'The Sunday Curation';
    let headline = 'One thoughtfully selected object. Every Sunday morning.';
    let description = 'We send a single curated gift recommendation, the short history behind its craft, and practical advice on gift psychology. No marketing spam, ever.';
    let emailPlaceholder = 'Your email address';
    let buttonText = 'Subscribe';
    let submitMessage = 'Thank you for subscribing to The Sunday Curation.';
    let socialProof = 'Over 42,000 discerning readers. Free forever. Unsubscribe in one click.';

    const badgeMatch = rawHtml.match(/<div class="inline-flex[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
    if (badgeMatch) badge = badgeMatch[1].trim();

    const headlineMatch = rawHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (headlineMatch) headline = headlineMatch[1].trim();

    const descMatch = rawHtml.match(/<p class="text-sm sm:text-base text-\[#5A6270\][^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch) description = descMatch[1].trim();

    const phMatch = rawHtml.match(/placeholder="([^"]*)"/i);
    if (phMatch) emailPlaceholder = phMatch[1];

    const btnMatch = rawHtml.match(/<button type="submit"[^>]*>([\s\S]*?)<\/button>/i);
    if (btnMatch) buttonText = btnMatch[1].trim();

    const msgMatch = rawHtml.match(/Thank you for subscribing to [^<']*/i) || rawHtml.match(/this\.innerHTML = '<div[^>]*>([\s\S]*?)<\/div>'/i);
    if (msgMatch) submitMessage = msgMatch[1] || msgMatch[0];

    const proofMatch = rawHtml.match(/<div class="text-\[11px\] text-\[#5A6270\]">([\s\S]*?)<\/div>/i);
    if (proofMatch) socialProof = proofMatch[1].trim();

    return {
      key,
      name: 'Newsletter Subscription Banner',
      filename: '_includes/newsletter.html',
      description: 'The global Sunday Curation newsletter signup section rendered on articles, guides, and category pages.',
      badge,
      headline,
      descriptionText: description,
      emailPlaceholder,
      buttonText,
      submitMessage,
      socialProof
    };
  }

  if (key === 'footer') {
    let publicationDescription = 'An independent editorial publication dedicated to the art, psychology, and material culture of thoughtful gift giving.';
    let publishingLocations = 'Published quarterly   London & New York';
    let guidesColumnTitle = 'Essential Guides';
    let guidesLinks: any[] = [];
    let essaysColumnTitle = 'Editorial Essays';
    let essaysLinks: any[] = [];
    let utilityLinks: any[] = [];
    let integrityStatement = 'When you purchase through links on our site, we may earn an affiliate commission. We never accept paid placements, free promotional products in exchange for positive reviews, or sponsored rankings. Every item is researched and field-tested independently.';
    let copyrightText = '2026 Science of Gifts. All rights reserved.';

    const descMatch = rawHtml.match(/<p class="text-sm text-\[#EEF5FF\]\/80 leading-relaxed max-w-sm">([\s\S]*?)<\/p>/i);
    if (descMatch) publicationDescription = descMatch[1].trim();

    const locMatch = rawHtml.match(/<div class="pt-2 text-xs text-\[#99BFF9\] font-mono-code">([\s\S]*?)<\/div>/i);
    if (locMatch) publishingLocations = locMatch[1].trim();

    // Column 1 (Guides)
    const col1Match = rawHtml.match(/<div class="md:col-span-3 space-y-3">([\s\S]*?)<\/div>/i);
    if (col1Match) {
      const h3M = col1Match[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (h3M) guidesColumnTitle = h3M[1].trim();

      const linkMatches = [...col1Match[1].matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      guidesLinks = linkMatches.map(m => ({
        url: m[1],
        label: m[2].replace(/<[^>]+>/g, '').trim()
      }));
    }

    // Column 2 (Essays)
    const col2Match = rawHtml.match(/<div class="md:col-span-4 space-y-3">([\s\S]*?)<\/div>/i);
    if (col2Match) {
      const h3M = col2Match[1].match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (h3M) essaysColumnTitle = h3M[1].trim();

      const linkMatches = [...col2Match[1].matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      essaysLinks = linkMatches.map(m => ({
        url: m[1],
        label: m[2].replace(/<[^>]+>/g, '').trim()
      }));
    }

    // Utility links
    const utilMatch = rawHtml.match(/<div class="pt-8 pb-4 flex flex-wrap items-center[^>]*>([\s\S]*?)<\/div>/i);
    if (utilMatch) {
      const linkMatches = [...utilMatch[1].matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
      utilityLinks = linkMatches.map(m => {
        const rawLabel = m[2].replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').trim();
        const isExt = m[0].includes('external-link') || m[1].startsWith('http');
        return {
          url: m[1],
          label: rawLabel,
          isExternal: isExt
        };
      });
    }

    // Integrity statement
    const integrityMatch = rawHtml.match(/<p class="max-w-2xl leading-relaxed">([\s\S]*?)<\/p>/i);
    if (integrityMatch) {
      integrityStatement = integrityMatch[1].replace(/<strong[^>]*>[\s\S]*?<\/strong>/i, '').trim();
    }

    // Copyright text
    const copyMatch = rawHtml.match(/<div class="shrink-0 text-left md:text-right font-mono-code text-\[11px\]">([\s\S]*?)<\/div>/i);
    if (copyMatch) copyrightText = copyMatch[1].trim();

    return {
      key,
      name: 'Global Site Footer',
      filename: '_includes/footer.html',
      description: 'The primary publication footer with logo, essential guide links, research essays, utility navigation, and editorial integrity statement.',
      publicationDescription,
      publishingLocations,
      guidesColumnTitle,
      guidesLinks: guidesLinks.length > 0 ? guidesLinks : [
        { label: 'Gifts for History Buffs', url: '/history-gifts/' },
        { label: 'Gifts for Book Lovers', url: '/book-lovers-gifts/' },
        { label: 'Gifts for People Who Have Everything', url: '/people-who-have-everything/' },
        { label: 'Browse All Gift Guides', url: '/gift-guides/' }
      ],
      essaysColumnTitle,
      essaysLinks: essaysLinks.length > 0 ? essaysLinks : [
        { label: 'Why We Overthink Giving Gifts', url: '/avoid-overthinking-gift-decisions/' },
        { label: 'The Psychology of the Regift', url: '/psychology-of-regifting/' },
        { label: 'Why Physical Objects Outlast Experiences', url: '/physical-objects-vs-experiences/' }
      ],
      utilityLinks: utilityLinks.length > 0 ? utilityLinks : [
        { label: 'Gift Finder', url: '/gift-finder/' },
        { label: 'Gift Guides', url: '/gift-guides/' },
        { label: 'Articles', url: '/articles/' },
        { label: 'For Men', url: '/for-men/' },
        { label: 'For Women', url: '/for-women/' },
        { label: 'Shop Science of Gifts', url: 'https://shop.scienceofgifts.com/', isExternal: true },
        { label: 'About', url: '/about/' },
        { label: 'Contact', url: '/contact/' },
        { label: 'Sitemap', url: '/sitemap/' },
        { label: 'Affiliate Disclosure', url: '/affiliate-disclosure/' },
        { label: 'Privacy Policy', url: '/privacy/' },
        { label: 'Terms of Service', url: '/terms/' }
      ],
      integrityStatement,
      copyrightText
    };
  }

  if (key === 'editors-pick') {
    let subBadge = 'The Standout Choice';
    let title = 'Editor s Pick 2026';
    let badgeLabelDefault = 'Editor s Pick 2026';
    let whyGiftHeader = 'Why it makes a singular gift:';
    let idealForHeader = 'Ideal For:';
    let standoutHeader = 'What Makes It Stand Out:';
    let considerHeader = 'Things to Consider:';
    let specsHeader = 'Specifications & Details';

    const subBadgeMatch = rawHtml.match(/<span class="text-xs uppercase tracking-widest text-\[#226E56\] font-semibold">([\s\S]*?)<\/span>/i);
    if (subBadgeMatch) subBadge = subBadgeMatch[1].trim();

    const titleMatch = rawHtml.match(/<h2 class="font-serif-display text-2xl sm:text-3xl text-\[#1E232B\] font-normal">([\s\S]*?)<\/h2>/i);
    if (titleMatch) title = titleMatch[1].trim();

    const badgeDefMatch = rawHtml.match(/default:\s*'([^']*)'/i);
    if (badgeDefMatch) badgeLabelDefault = badgeDefMatch[1].trim();

    const whyMatch = rawHtml.match(/<strong class="text-xs uppercase tracking-wider text-\[#154D3B\] block">([\s\S]*?)<\/strong>/i);
    if (whyMatch) whyGiftHeader = whyMatch[1].trim();

    const idealMatch = rawHtml.match(/<strong class="text-\[#2A548E\] block uppercase tracking-wider mb-1">([\s\S]*?)<\/strong>/i);
    if (idealMatch) idealForHeader = idealMatch[1].trim();

    const standMatch = rawHtml.match(/<strong class="text-\[#226E56\] block uppercase tracking-wider mb-1">([\s\S]*?)<\/strong>/i);
    if (standMatch) standoutHeader = standMatch[1].trim();

    const considerMatch = rawHtml.match(/<strong class="text-\[#B85D38\] block uppercase tracking-wider mb-1">([\s\S]*?)<\/strong>/i);
    if (considerMatch) considerHeader = considerMatch[1].trim();

    const specsMatch = rawHtml.match(/<div class="text-\[11px\] font-semibold text-\[#5A6270\] uppercase tracking-wider">([\s\S]*?)<\/div>/i);
    if (specsMatch) specsHeader = specsMatch[1].trim();

    return {
      key,
      name: 'Editor s Pick Highlight Box',
      filename: '_includes/editors-pick.html',
      description: 'The featured standout choice presentation card used across gift guides to highlight top curated recommendations.',
      subBadge,
      title,
      badgeLabelDefault,
      whyGiftHeader,
      idealForHeader,
      standoutHeader,
      considerHeader,
      specsHeader,
      featuredProductId: 'cast-iron-book-weight'
    };
  }

  throw new Error(`Unsupported component key: ${key}`);
}

function generateGlobalComponentHtml(key: string, data: any): string {
  if (key === 'newsletter') {
    return `<section class="bg-[#FAF9F6] border-y border-[#99BFF9]/30 py-16 px-4 sm:px-6 lg:px-8">
  <div class="max-w-3xl mx-auto text-center space-y-6">
    <div class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#226E56]">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail w-3.5 h-3.5 text-[#226E56]" aria-hidden="true"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path><rect x="2" y="4" width="20" height="16" rx="2"></rect></svg>
      <span>${data.badge || 'The Sunday Curation'}</span>
    </div>
    <h2 class="font-serif-display text-2xl sm:text-3xl lg:text-4xl text-[#1E232B] font-normal leading-tight">
      ${data.headline || 'One thoughtfully selected object. Every Sunday morning.'}
    </h2>
    <p class="text-sm sm:text-base text-[#5A6270] leading-relaxed max-w-xl mx-auto">
      ${data.descriptionText || data.description || 'We send a single curated gift recommendation, the short history behind its craft, and practical advice on gift psychology. No marketing spam, ever.'}
    </p>
    <form class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onsubmit="event.preventDefault(); this.innerHTML = '<div class=\\'w-full py-2.5 px-4 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-semibold rounded text-center\\'>${(data.submitMessage || 'Thank you for subscribing to The Sunday Curation.').replace(/'/g, "\\'")}</div>';">
      <input type="email" placeholder="${data.emailPlaceholder || 'Your email address'}" required="" class="flex-1 px-4 py-2.5 text-sm bg-white border border-[#99BFF9]/40 focus:border-[#2A548E] focus:ring-1 focus:ring-[#99BFF9] outline-none transition-colors" value=""/>
      <button type="submit" class="px-6 py-2.5 bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] text-[#1E232B] text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 duration-300 whitespace-nowrap shadow-xs cursor-pointer">
        ${data.buttonText || 'Subscribe'}
      </button>
    </form>
    <div class="text-[11px] text-[#5A6270]">
      ${data.socialProof || 'Over 42,000 discerning readers. Free forever. Unsubscribe in one click.'}
    </div>
  </div>
</section>
`;
  }

  if (key === 'footer') {
    const renderLink = (item: any) => {
      const isExt = item.isExternal || item.url.startsWith('http');
      if (isExt) {
        return `<li><a href="${item.url}" class="text-[#99BFF9] font-medium hover:text-[#C3F3DF] hover:underline transition-colors flex items-center gap-1"><span>${item.label}</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link w-3 h-3 opacity-75" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg></a></li>`;
      }
      return `<li><a href="${item.url}" class="hover:text-[#C3F3DF] transition-colors text-left block">${item.label}</a></li>`;
    };

    const renderUtilLink = (item: any) => {
      const isExt = item.isExternal || item.url.startsWith('http');
      if (isExt) {
        return `<a href="${item.url}" class="text-[#99BFF9] font-medium hover:text-[#C3F3DF] hover:underline transition-colors flex items-center gap-1"><span>${item.label}</span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link w-3 h-3 opacity-75" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg></a>`;
      }
      const isSpecial = item.url === '/gift-finder/' || item.url === '/gift-guides/';
      const cls = isSpecial ? 'text-[#C3F3DF] font-medium hover:underline transition-colors' : 'hover:text-white transition-colors';
      return `<a href="${item.url}" class="${cls}">${item.label}</a>`;
    };

    const guidesHtml = (data.guidesLinks || []).map(renderLink).join('\n          ');
    const essaysHtml = (data.essaysLinks || []).map(renderLink).join('\n          ');
    const utilityHtml = (data.utilityLinks || []).map(renderUtilLink).join('\n      ');

    return `<footer class="bg-[#132644] text-[#EEF5FF] border-t border-[#99BFF9]/20 pt-16 pb-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-[#99BFF9]/20">
      <div class="md:col-span-5 space-y-4">
        <a href="/" class="inline-block group cursor-pointer">
          <img src="/assets/logo-white.webp" data-fallback="/assets/logo-white.png" alt="Science of Gifts" class="h-10 sm:h-12 w-auto object-contain transition-opacity group-hover:opacity-85" onerror="this.onerror=null; this.src=this.dataset.fallback;"/>
          <span class="sr-only">Science of Gifts</span>
        </a>
        <p class="text-sm text-[#EEF5FF]/80 leading-relaxed max-w-sm">
          ${data.publicationDescription || 'An independent editorial publication dedicated to the art, psychology, and material culture of thoughtful gift giving.'}
        </p>
        <div class="pt-2 text-xs text-[#99BFF9] font-mono-code">
          ${data.publishingLocations || 'Published quarterly   London & New York'}
        </div>
      </div>
      <div class="md:col-span-3 space-y-3">
        <h3 class="text-xs uppercase tracking-widest text-[#C3F3DF] font-semibold">${data.guidesColumnTitle || 'Essential Guides'}</h3>
        <ul class="space-y-2 text-sm text-[#EEF5FF]/80">
          ${guidesHtml}
        </ul>
      </div>
      <div class="md:col-span-4 space-y-3">
        <h3 class="text-xs uppercase tracking-widest text-[#C3F3DF] font-semibold">${data.essaysColumnTitle || 'Editorial Essays'}</h3>
        <ul class="space-y-2 text-sm text-[#EEF5FF]/80">
          ${essaysHtml}
        </ul>
      </div>
    </div>
    <div class="pt-8 pb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#EEF5FF]/70 border-b border-[#99BFF9]/20">
      ${utilityHtml}
    </div>
    <div class="pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs text-[#EEF5FF]/60">
      <p class="max-w-2xl leading-relaxed">
        <strong class="text-[#EEF5FF]/90 font-medium">Editorial Integrity:</strong> ${data.integrityStatement || 'When you purchase through links on our site, we may earn an affiliate commission. We never accept paid placements, free promotional products in exchange for positive reviews, or sponsored rankings. Every item is researched and field-tested independently.'}
      </p>
      <div class="shrink-0 text-left md:text-right font-mono-code text-[11px]">
          ${data.copyrightText || '2026 Science of Gifts. All rights reserved.'}
      </div>
    </div>
  </div>
</footer>
`;
  }

  if (key === 'editors-pick') {
    return `{% assign p = include.product %}
{% if p %}
<section id="editors-pick" class="scroll-mt-24 space-y-6">
  <div class="flex items-center justify-between border-b border-[#99BFF9]/30 pb-2">
    <div>
      <span class="text-xs uppercase tracking-widest text-[#226E56] font-semibold">${data.subBadge || 'The Standout Choice'}</span>
      <h2 class="font-serif-display text-2xl sm:text-3xl text-[#1E232B] font-normal">${data.title || 'Editor s Pick 2026'}</h2>
    </div>
    <span class="font-mono-code text-xl font-bold text-[#154D3B]">{{ p.price }}</span>
  </div>
  <div class="bg-white border-2 border-[#C3F3DF] p-6 sm:p-8 space-y-6 shadow-xs">
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
      <div class="md:col-span-6">
        <div class="relative overflow-hidden bg-[#FAF9F6] border border-[#99BFF9]/30 rounded-sm aspect-[4/3] shadow-sm" role="img" aria-label="{{ p.title }}">
          {% assign p_img = p.image | default: p.imageType | default: p.id %}
          {% include editorial-image.html type=p_img alt=p.title %}
        </div>
      </div>
      <div class="md:col-span-6 space-y-3">
        <div class="text-xs font-semibold text-[#226E56] uppercase tracking-wider">
          {{ p.badgeLabel | default: '${data.badgeLabelDefault || "Editor s Pick 2026"}' }}
        </div>
        <h3 class="font-serif-display text-2xl text-[#1E232B] font-normal leading-snug">
          {{ p.title }}
        </h3>
        {% if p.tagline %}
        <p class="text-xs sm:text-sm text-[#5A6270] italic">
          {{ p.tagline }}
        </p>
        {% endif %}
        <div class="pt-3 flex flex-wrap items-center gap-3">
          {% assign vendor_clean = p.vendor | default: p.merchant | downcase %}
          {% assign vendor_url_clean = p.vendorUrl | default: p.product_url | downcase %}
          {% assign is_own_product = false %}
          {% if vendor_clean contains "scienceofgifts" or vendor_clean contains "science of gifts" or vendor_url_clean contains "scienceofgifts.com" %}
            {% assign is_own_product = true %}
          {% endif %}
          <a href="{{ p.vendorUrl | default: p.product_url }}"{% unless is_own_product %} rel="noopener noreferrer sponsored"{% endunless %} class="px-5 py-2.5 bg-white text-black border border-black hover:opacity-80 transition-opacity duration-200 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 rounded-none shadow-2xs">
            View on {{ p.vendor | default: p.merchant | split: ',' | first }}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
          </a>
          <button data-id="{{ p.id }}" class="toggle-product-bookmark px-3 py-2.5 border text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer border-[#99BFF9]/40 text-[#5A6270] hover:text-[#1E232B] rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>
            <span class="save-label">Save</span>
          </button>
        </div>
      </div>
    </div>
    <div class="pt-4 border-t border-stone-200 space-y-4 text-sm text-[#1E232B] leading-relaxed">
      <p>{{ p.editorialReview | default: p.description }}</p>
    </div>
    {% if p.whyItMakesAGreatGift or p.why_it_makes_a_great_gift %}
    <div class="p-4 bg-[#E8F8F1]/80 border-l-4 border-[#226E56] space-y-1">
      <strong class="text-xs uppercase tracking-wider text-[#154D3B] block">${data.whyGiftHeader || 'Why it makes a singular gift:'}</strong>
      <p class="text-xs text-[#226E56]">{{ p.whyItMakesAGreatGift | default: p.why_it_makes_a_great_gift }}</p>
    </div>
    {% endif %}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {% if p.idealFor or p.ideal_for %}
      <div class="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20">
        <strong class="text-[#2A548E] block uppercase tracking-wider mb-1">${data.idealForHeader || 'Ideal For:'}</strong>
        <p class="text-[#5A6270]">{{ p.idealFor | default: p.ideal_for }}</p>
      </div>
      {% endif %}
      {% if p.whatMakesItStandOut or p.what_makes_it_stand_out %}
      <div class="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20">
        <strong class="text-[#226E56] block uppercase tracking-wider mb-1">${data.standoutHeader || 'What Makes It Stand Out:'}</strong>
        <p class="text-[#5A6270]">{{ p.whatMakesItStandOut | default: p.what_makes_it_stand_out }}</p>
      </div>
      {% endif %}
      {% if p.thingsToConsider or p.things_to_consider %}
      <div class="p-3 bg-[#FAF9F6] border border-[#99BFF9]/20 sm:col-span-2">
        <strong class="text-[#B85D38] block uppercase tracking-wider mb-1">${data.considerHeader || 'Things to Consider:'}</strong>
        <p class="text-[#5A6270]">{{ p.thingsToConsider | default: p.things_to_consider }}</p>
      </div>
      {% endif %}
    </div>
    {% if p.specs and p.specs.size > 0 %}
    <div class="pt-4 border-t border-[#99BFF9]/20 space-y-2">
      <div class="text-[11px] font-semibold text-[#5A6270] uppercase tracking-wider">${data.specsHeader || 'Specifications & Details'}</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {% for s in p.specs %}
        <div class="p-2.5 bg-white border border-[#99BFF9]/15">
          <div class="text-[10px] text-[#5A6270] uppercase tracking-wider">{{ s.label }}</div>
          <div class="font-medium text-[#1E232B] truncate mt-0.5">{{ s.value }}</div>
        </div>
        {% endfor %}
      </div>
    </div>
    {% endif %}
  </div>
</section>
{% endif %}
`;
  }

  throw new Error(`Unsupported component key: ${key}`);
}

function executeAtomicComponentWrite(key: string, data: any, action: string): { backupFile: string | null } {
  const filePath = getGlobalComponentFilePath(key);
  if (!filePath) throw new Error(`Invalid global component key: ${key}`);

  const backupFile = backupGlobalComponentFile(key, action);
  const newHtml = generateGlobalComponentHtml(key, data);

  const tempFile = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, newHtml, 'utf8');
  fs.renameSync(tempFile, filePath);

  return { backupFile };
}

// GET /api/global-components
app.get('/api/global-components', (req: Request, res: Response) => {
  try {
    const list = ALLOWED_GLOBAL_COMPONENTS.map(key => {
      const filePath = getGlobalComponentFilePath(key);
      if (!filePath || !fs.existsSync(filePath)) return null;
      const stats = fs.statSync(filePath);
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const parsed = parseGlobalComponentHtml(key, rawHtml);
      return {
        ...parsed,
        mtime: stats.mtime.toISOString(),
        size: stats.size
      };
    }).filter(Boolean);

    res.json({ success: true, components: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list global components: ${err.message}` });
  }
});

// GET /api/global-components/:key
app.get('/api/global-components/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_GLOBAL_COMPONENTS.includes(key)) {
      return res.status(403).json({ success: false, error: `Access forbidden for component key "${key}".` });
    }

    const filePath = getGlobalComponentFilePath(key);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `Component file for "${key}" does not exist.` });
    }

    const stats = fs.statSync(filePath);
    const rawHtml = fs.readFileSync(filePath, 'utf8');
    const parsed = parseGlobalComponentHtml(key, rawHtml);

    res.json({
      success: true,
      component: {
        ...parsed,
        mtime: stats.mtime.toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to read global component: ${err.message}` });
  }
});

// PUT /api/global-components/:key
app.put('/api/global-components/:key', (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_GLOBAL_COMPONENTS.includes(key)) {
      return res.status(403).json({ success: false, error: `Access forbidden for component key "${key}".` });
    }

    const data = req.body;
    if (!data) {
      return res.status(400).json({ success: false, error: 'Invalid payload for global component.' });
    }

    const writeResult = executeAtomicComponentWrite(key, data, 'update_component');

    res.json({
      success: true,
      message: `Global component "${key}" updated successfully.`,
      component: { ...data, key },
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update global component: ${err.message}` });
  }
});

// GET /api/global-components-backups
app.get('/api/global-components-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GLOBAL_COMPONENTS_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(GLOBAL_COMPONENTS_BACKUPS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const full = path.join(GLOBAL_COMPONENTS_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.html', '').split('_');
        const key = parts[0];
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          key,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list component backups: ${err.message}` });
  }
});

// POST /api/global-components-backups/restore
app.post('/api/global-components-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(GLOBAL_COMPONENTS_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file "${safeFilename}" not found.` });
    }

    const parts = safeFilename.replace('.html', '').split('_');
    const key = parts[0];

    if (!ALLOWED_GLOBAL_COMPONENTS.includes(key)) {
      return res.status(403).json({ success: false, error: `Invalid component key in backup filename: ${key}` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = parseGlobalComponentHtml(key, rawBackup);

    const writeResult = executeAtomicComponentWrite(key, parsed, 'restore');

    res.json({
      success: true,
      message: `Restored component "${key}" from backup "${safeFilename}".`,
      component: parsed,
      backupFile: writeResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// =============================================================
// PHASE 10: SITE SETTINGS API (_config.yml)
// =============================================================
const SETTINGS_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'site-settings');
const CONFIG_FILE_PATH = path.join(JEKYLL_ROOT, '_config.yml');

try {
  if (!fs.existsSync(SETTINGS_BACKUPS_DIR)) {
    fs.mkdirSync(SETTINGS_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize SETTINGS_BACKUPS_DIR:', e);
}

function backupConfigFile(action: string): string | null {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) return null;
    if (!fs.existsSync(SETTINGS_BACKUPS_DIR)) {
      fs.mkdirSync(SETTINGS_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `_config_${timestamp}_${action}.yml`;
    const destPath = path.join(SETTINGS_BACKUPS_DIR, filename);
    fs.copyFileSync(CONFIG_FILE_PATH, destPath);

    const files = fs.readdirSync(SETTINGS_BACKUPS_DIR).filter(f => f.endsWith('.yml')).sort();
    if (files.length > 50) {
      for (let i = 0; i < files.length - 50; i++) {
        try { fs.unlinkSync(path.join(SETTINGS_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to create backup for _config.yml:', err);
    return null;
  }
}

function readAndParseConfig(): { settings: any; protectedConfig: any; fullRaw: any; mtime: string } {
  if (!fs.existsSync(CONFIG_FILE_PATH)) {
    throw new Error('_config.yml file not found in project root.');
  }

  const stats = fs.statSync(CONFIG_FILE_PATH);
  const rawYaml = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
  const parsed = (yaml.load(rawYaml) as any) || {};

  const settings = {
    title: parsed.title || 'Science of Gifts',
    tagline: parsed.tagline || '',
    description: parsed.description || '',
    url: parsed.url || 'https://scienceofgifts.com',
    timezone: parsed.timezone || 'Europe/London'
  };

  const protectedConfig = {
    baseurl: parsed.baseurl !== undefined ? parsed.baseurl : '',
    permalink: parsed.permalink || '/:title/',
    collectionsCount: parsed.collections ? Object.keys(parsed.collections).length : 0,
    defaultsCount: Array.isArray(parsed.defaults) ? parsed.defaults.length : 0,
    markdownEngine: parsed.markdown || 'kramdown',
    excludedCount: Array.isArray(parsed.exclude) ? parsed.exclude.length : 0
  };

  return {
    settings,
    protectedConfig,
    fullRaw: parsed,
    mtime: stats.mtime.toISOString()
  };
}

function validateAndSaveConfig(newSettings: any, action: string): { backupFile: string | null; settings: any } {
  if (!newSettings || typeof newSettings !== 'object') {
    throw new Error('Invalid settings payload.');
  }

  const title = (newSettings.title || '').trim();
  const tagline = (newSettings.tagline || '').trim();
  const description = (newSettings.description || '').trim();
  const url = (newSettings.url || '').trim();
  const timezone = (newSettings.timezone || '').trim();

  if (!title) {
    throw new Error('Publication Title is required.');
  }

  if (url && !/^https?:\/\//i.test(url)) {
    throw new Error('Publication URL must be a valid URL starting with http:// or https://');
  }

  const current = readAndParseConfig();
  const updatedYamlObj = { ...current.fullRaw };

  updatedYamlObj.title = title;
  updatedYamlObj.tagline = tagline;
  updatedYamlObj.description = description;
  updatedYamlObj.url = url;
  updatedYamlObj.timezone = timezone;

  const backupFile = backupConfigFile(action);

  const newYamlContent = yaml.dump(updatedYamlObj, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"'
  });

  const tempFile = `${CONFIG_FILE_PATH}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, newYamlContent, 'utf8');

  try {
    yaml.load(fs.readFileSync(tempFile, 'utf8'));
  } catch (err: any) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw new Error(`Generated _config.yml failed YAML validation: ${err.message}`);
  }

  fs.renameSync(tempFile, CONFIG_FILE_PATH);

  return {
    backupFile,
    settings: {
      title,
      tagline,
      description,
      url,
      timezone
    }
  };
}

// GET /api/site-settings
app.get('/api/site-settings', (req: Request, res: Response) => {
  try {
    const configData = readAndParseConfig();
    res.json({
      success: true,
      settings: configData.settings,
      protectedConfig: configData.protectedConfig,
      mtime: configData.mtime
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to read _config.yml: ${err.message}` });
  }
});

// GET /api/ai-settings
app.get('/api/ai-settings', (req: Request, res: Response) => {
  try {
    const settings = getAiSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load AI settings: ${err.message}` });
  }
});

// PUT /api/ai-settings
app.put('/api/ai-settings', (req: Request, res: Response) => {
  try {
    const updated = saveAiSettings(req.body || {});
    res.json({ success: true, settings: updated, message: 'AI Settings saved successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to save AI settings: ${err.message}` });
  }
});

// PUT /api/site-settings
app.put('/api/site-settings', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const allowedKeys = ['title', 'tagline', 'description', 'url', 'timezone'];
    const bodyKeys = Object.keys(body || {});
    const unexpectedKeys = bodyKeys.filter(k => !allowedKeys.includes(k));

    if (unexpectedKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Security Violation: Unexpected configuration keys [${unexpectedKeys.join(', ')}]. Only safe publication settings may be edited.`
      });
    }

    const saveResult = validateAndSaveConfig(body, 'update_settings');

    res.json({
      success: true,
      message: 'Publication settings updated successfully in _config.yml.',
      settings: saveResult.settings,
      backupFile: saveResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to update site settings: ${err.message}` });
  }
});

// GET /api/site-settings-backups
app.get('/api/site-settings-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(SETTINGS_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(SETTINGS_BACKUPS_DIR)
      .filter(f => f.endsWith('.yml'))
      .map(f => {
        const full = path.join(SETTINGS_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        const parts = f.replace('.yml', '').split('_');
        const action = parts[parts.length - 1] || 'backup';
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          action,
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list settings backups: ${err.message}` });
  }
});

// POST /api/site-settings-backups/restore
app.post('/api/site-settings-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(SETTINGS_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file "${safeFilename}" not found.` });
    }

    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const parsed = (yaml.load(rawBackup) as any) || {};

    const restoredSettings = {
      title: parsed.title,
      tagline: parsed.tagline,
      description: parsed.description,
      url: parsed.url,
      timezone: parsed.timezone
    };

    const saveResult = validateAndSaveConfig(restoredSettings, 'restore');

    res.json({
      success: true,
      message: `Restored _config.yml settings from backup "${safeFilename}".`,
      settings: saveResult.settings,
      backupFile: saveResult.backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// PHASE 11: SITE DIAGNOSTICS & VERIFICATION (_api/diagnostics/run)
app.get('/api/diagnostics/run', (req: Request, res: Response) => {
  try {
    const issues: Array<{
      severity: 'error' | 'warning';
      scope: 'Products' | 'Guides' | 'Articles' | 'Navigation' | 'Taxonomies' | 'Assets' | 'Global Components' | 'Settings' | 'Environment';
      location: string;
      description: string;
      action?: {
        label: string;
        tab: string;
        id?: string;
      };
    }> = [];

    // Helper to resolve files and directories
    const productsPath = path.join(JEKYLL_ROOT, '_data', 'products.yml');
    const authorsPath = path.join(JEKYLL_ROOT, '_data', 'authors.yml');
    const collectionsPath = path.join(JEKYLL_ROOT, '_data', 'collections.yml');
    const interestsPath = path.join(JEKYLL_ROOT, '_data', 'interests.yml');
    const navigationPath = path.join(JEKYLL_ROOT, '_data', 'navigation.yml');
    const configPath = path.join(JEKYLL_ROOT, '_config.yml');
    const guidesDir = path.join(JEKYLL_ROOT, '_guides');
    const articlesDir = path.join(JEKYLL_ROOT, '_articles');
    const backupsDir = path.join(PROJECT_ROOT, 'editor-backups');

    // Parse robots.txt disallows for indexing conflict verification
    const robotsPath = path.join(JEKYLL_ROOT, 'robots.txt');
    const disallowedPaths: string[] = [];
    if (fs.existsSync(robotsPath)) {
      try {
        const robotsContent = fs.readFileSync(robotsPath, 'utf8');
        const lines = robotsContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const parts = trimmed.split(':');
          if (parts.length >= 2 && parts[0].trim().toLowerCase() === 'disallow') {
            const val = parts.slice(1).join(':').trim().toLowerCase();
            if (val) disallowedPaths.push(val);
          }
        }
      } catch (e) {
        console.warn('Diagnostics: Failed to parse robots.txt', e);
      }
    }

    const assetsDir = path.join(JEKYLL_ROOT, 'assets');
    const assetsImagesDir = path.join(JEKYLL_ROOT, 'assets', 'images');

    // Counts for dashboard
    let counts = {
      products: 0,
      guides: 0,
      articles: 0,
      collections: 0,
      interests: 0,
      backups: 0
    };

    // Tracking referenced and found images
    const foundImagesMap = new Map<string, string>(); // relative path -> file path
    const referencedImagesSet = new Set<string>();

    const scanDirectoryImages = (dir: string, prefix: string) => {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (lower.endsWith('.webp') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.svg') || lower.endsWith('.gif')) {
            const relPath = path.join(prefix, file).replace(/\\/g, '/');
            foundImagesMap.set(file, relPath);
            foundImagesMap.set(relPath, relPath);
            foundImagesMap.set('/' + relPath, relPath);
          }
        }
      }
    };

    scanDirectoryImages(assetsDir, 'assets');
    scanDirectoryImages(assetsImagesDir, 'assets/images');

    // Loaded Taxonomies and Authors for foreign key validation
    let validAuthors = new Set<string>();
    let validCollections = new Set<string>();
    let validInterests = new Set<string>();

    // 1. Authors Verification
    if (fs.existsSync(authorsPath)) {
      try {
        const rawAuthors = fs.readFileSync(authorsPath, 'utf8');
        const parsed = yaml.load(rawAuthors);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(slug => {
            validAuthors.add(slug);
          });
        }
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Environment',
          location: '_data/authors.yml',
          description: `Failed to parse authors list: ${err.message}`,
          action: { label: 'Open Authors Manager', tab: 'authors' }
        });
      }
    } else {
      issues.push({
        severity: 'error',
        scope: 'Environment',
        location: '_data/authors.yml',
        description: 'Authors data file is missing on disk',
        action: { label: 'Open Authors Manager', tab: 'authors' }
      });
    }

    // 2. Collections Verification
    if (fs.existsSync(collectionsPath)) {
      try {
        const rawColls = fs.readFileSync(collectionsPath, 'utf8');
        const parsed: any = yaml.load(rawColls) || {};
        let collectionCount = 0;
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(groupKey => {
            const list = parsed[groupKey];
            if (Array.isArray(list)) {
              list.forEach((col: any) => {
                if (col && col.slug) {
                  validCollections.add(col.slug);
                  collectionCount++;
                }
              });
            }
          });
        }
        counts.collections = collectionCount;
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Taxonomies',
          location: '_data/collections.yml',
          description: `Failed to parse collections taxonomy: ${err.message}`,
          action: { label: 'Open Collections', tab: 'collections' }
        });
      }
    } else {
      issues.push({
        severity: 'error',
        scope: 'Taxonomies',
        location: '_data/collections.yml',
        description: 'Collections taxonomy file is missing',
        action: { label: 'Open Collections', tab: 'collections' }
      });
    }

    // 3. Interests Verification
    if (fs.existsSync(interestsPath)) {
      try {
        const rawInts = fs.readFileSync(interestsPath, 'utf8');
        const parsed: any = yaml.load(rawInts) || {};
        let interestCount = 0;
        if (Array.isArray(parsed)) {
          parsed.forEach((interest: any) => {
            if (interest && interest.id) {
              validInterests.add(interest.id);
              interestCount++;
            }
          });
        }
        counts.interests = interestCount;
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Taxonomies',
          location: '_data/interests.yml',
          description: `Failed to parse interests taxonomy: ${err.message}`,
          action: { label: 'Open Interests Taxonomy', tab: 'interests' }
        });
      }
    } else {
      issues.push({
        severity: 'error',
        scope: 'Taxonomies',
        location: '_data/interests.yml',
        description: 'Interests taxonomy file is missing',
        action: { label: 'Open Interests Taxonomy', tab: 'interests' }
      });
    }

    // 4. Products Catalog Validation
    let productsList: any[] = [];
    if (fs.existsSync(productsPath)) {
      try {
        const rawProducts = fs.readFileSync(productsPath, 'utf8');
        const parsed = yaml.load(rawProducts);
        if (Array.isArray(parsed)) {
          productsList = parsed;
          counts.products = parsed.length;
          const seenIds = new Set<string>();

          parsed.forEach((prod, idx) => {
            const prodId = prod.id || `unnamed_at_index_${idx}`;
            
            // Check ID
            if (!prod.id) {
              issues.push({
                severity: 'error',
                scope: 'Products',
                location: `_data/products.yml [Index ${idx}]`,
                description: `Product record is missing required "id" field`,
                action: { label: 'Open Product Editor', tab: 'products' }
              });
            } else if (seenIds.has(prod.id)) {
              issues.push({
                severity: 'error',
                scope: 'Products',
                location: `_data/products.yml [ID: ${prod.id}]`,
                description: `Duplicate product ID found: "${prod.id}"`,
                action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
              });
            } else {
              seenIds.add(prod.id);
            }

            // Check Title
            if (!prod.title || typeof prod.title !== 'string' || !prod.title.trim()) {
              issues.push({
                severity: 'error',
                scope: 'Products',
                location: `_data/products.yml [ID: ${prodId}]`,
                description: `Product missing required "title" field`,
                action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
              });
            }

            // Check Price
            if (prod.price === undefined || prod.price === null || isNaN(Number(prod.price)) || Number(prod.price) < 0) {
              issues.push({
                severity: 'warning',
                scope: 'Products',
                location: `_data/products.yml [ID: ${prodId}]`,
                description: `Product "${prod.title || prodId}" has invalid or missing price: "${prod.price}"`,
                action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
              });
            }

            // Check Image reference
            if (prod.image) {
              const imgName = String(prod.image);
              referencedImagesSet.add(imgName);
              if (!foundImagesMap.has(imgName)) {
                issues.push({
                  severity: 'error',
                  scope: 'Assets',
                  location: `_data/products.yml [Product ID: ${prodId}]`,
                  description: `Product references missing image file on disk: "${imgName}"`,
                  action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
                });
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Products',
                location: `_data/products.yml [ID: ${prodId}]`,
                description: `Product "${prod.title || prodId}" has no image specified`,
                action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
              });
            }

            // Check URL
            if (!prod.url || typeof prod.url !== 'string' || !prod.url.startsWith('http')) {
              issues.push({
                severity: 'warning',
                scope: 'Products',
                location: `_data/products.yml [ID: ${prodId}]`,
                description: `Product "${prod.title || prodId}" has missing or invalid affiliate URL: "${prod.url}"`,
                action: { label: 'Open Product Editor', tab: 'products', id: prod.id }
              });
            }
          });
        } else {
          issues.push({
            severity: 'error',
            scope: 'Products',
            location: '_data/products.yml',
            description: 'Products catalog data is not structured as a YAML list',
            action: { label: 'Open Product Editor', tab: 'products' }
          });
        }
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Products',
          location: '_data/products.yml',
          description: `Failed to load or parse products: ${err.message}`,
          action: { label: 'Open Product Editor', tab: 'products' }
        });
      }
    } else {
      issues.push({
        severity: 'error',
        scope: 'Products',
        location: '_data/products.yml',
        description: 'Products catalog file products.yml is missing',
        action: { label: 'Open Product Editor', tab: 'products' }
      });
    }

    // Build product sets for fast guide validation
    const productIdsSet = new Set(productsList.map(p => p.id).filter(Boolean));

    // 5. Gift Guides & Front Matter validation
    const registeredPermalinks = new Map<string, string>(); // permalink -> filename

    if (fs.existsSync(guidesDir)) {
      try {
        const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
        counts.guides = files.length;

        for (const file of files) {
          const filePath = path.join(guidesDir, file);
          const raw = fs.readFileSync(filePath, 'utf8');
          const slug = file.replace(/\.md$/, '');

          try {
            const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
            if (!match) {
              issues.push({
                severity: 'error',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: `Jekyll guide file is missing proper front matter delimiters (---)`,
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
              continue;
            }

            const fm = yaml.load(match[1]) as any;
            const body = match[2] || '';

            if (!fm || typeof fm !== 'object') {
              issues.push({
                severity: 'error',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: 'Failed to decode front matter block',
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
              continue;
            }

            // Indexing conflict check against robots.txt disallows
            let isNoindex = false;
            if (fm.robots) {
              if (typeof fm.robots === 'object' && fm.robots.index === false) {
                isNoindex = true;
              } else if (typeof fm.robots === 'string' && fm.robots.toLowerCase().includes('noindex')) {
                isNoindex = true;
              }
            }
            if (isNoindex) {
              const guideUrl = `/gift-guides/${slug}/`;
              const isBlocked = disallowedPaths.some(p => p === '/' || guideUrl.startsWith(p));
              if (isBlocked) {
                issues.push({
                  severity: 'warning',
                  scope: 'Settings',
                  location: `_guides/${file}`,
                  description: `SEO Conflict: Guide is marked as Noindex but is blocked from crawling in robots.txt. Crawlers can't see the noindex tag.`,
                  action: { label: 'Open SEO & Indexing', tab: 'seo' }
                });
              }
            }

            // Title validation
            if (!fm.title || typeof fm.title !== 'string' || !fm.title.trim()) {
              issues.push({
                severity: 'error',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: 'Guide is missing required front matter field: "title"',
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
            }

            // Permalink register
            if (fm.permalink) {
              if (registeredPermalinks.has(fm.permalink)) {
                issues.push({
                  severity: 'error',
                  scope: 'Guides',
                  location: `_guides/${file}`,
                  description: `Duplicate permalink registered: "${fm.permalink}" (also used by ${registeredPermalinks.get(fm.permalink)})`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              } else {
                registeredPermalinks.set(fm.permalink, `_guides/${file}`);
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: 'Guide has no explicit "permalink" specified',
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
            }

            // Category validation
            if (fm.category) {
              if (!validCollections.has(fm.category)) {
                issues.push({
                  severity: 'warning',
                  scope: 'Guides',
                  location: `_guides/${file}`,
                  description: `Guide has category "${fm.category}" which does not exist in collections.yml`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: 'Guide has no "category" specified',
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
            }

            // Author validation
            if (fm.author) {
              const authorSlug = typeof fm.author === 'string' ? fm.author : fm.author.slug || fm.author.name?.toLowerCase();
              if (authorSlug && !validAuthors.has(authorSlug)) {
                issues.push({
                  severity: 'warning',
                  scope: 'Guides',
                  location: `_guides/${file}`,
                  description: `Guide references unknown or unmapped author slug: "${authorSlug}"`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Guides',
                location: `_guides/${file}`,
                description: 'Guide is missing an assigned author',
                action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
              });
            }

            // Product references validation
            // Check editorPick product
            if (fm.editorsPick) {
              const epId = String(fm.editorsPick);
              if (!productIdsSet.has(epId)) {
                issues.push({
                  severity: 'error',
                  scope: 'Guides',
                  location: `_guides/${file}`,
                  description: `Guide references non-existent Editor's Pick product ID: "${epId}"`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              }
            }

            // Check quickPicks products
            if (Array.isArray(fm.quickPicks)) {
              fm.quickPicks.forEach((qpId: any, idx: number) => {
                const qId = String(qpId);
                if (!productIdsSet.has(qId)) {
                  issues.push({
                    severity: 'error',
                    scope: 'Guides',
                    location: `_guides/${file} [quickPicks index ${idx}]`,
                    description: `Guide references missing product ID in Quick Picks: "${qId}"`,
                    action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                  });
                }
              });
            }

            // Check budgetSections products
            if (Array.isArray(fm.budgetSections)) {
              fm.budgetSections.forEach((sect: any, sectIdx: number) => {
                if (sect && Array.isArray(sect.products)) {
                  sect.products.forEach((prodId: any, prodIdx: number) => {
                    const pId = typeof prodId === 'string' ? prodId : prodId?.id;
                    if (pId && !productIdsSet.has(pId)) {
                      issues.push({
                        severity: 'error',
                        scope: 'Guides',
                        location: `_guides/${file} [Section: "${sect.title || sectIdx}", Product index ${prodIdx}]`,
                        description: `Section references missing product ID: "${pId}"`,
                        action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                  });
                    }
                  });
                }
              });
            }

            // Image references
            if (fm.image) {
              const imgName = String(fm.image);
              referencedImagesSet.add(imgName);
              if (!foundImagesMap.has(imgName)) {
                issues.push({
                  severity: 'error',
                  scope: 'Assets',
                  location: `_guides/${file}`,
                  description: `Guide references missing hero image asset: "${imgName}"`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              }
            }

            // Scan body content for raw image references or product links
            const imgRegex = /!\[.*?\]\((.*?)\)/g;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(body)) !== null) {
              const imgLink = imgMatch[1];
              const basename = path.basename(imgLink);
              referencedImagesSet.add(basename);
              if (!foundImagesMap.has(basename)) {
                issues.push({
                  severity: 'warning',
                  scope: 'Assets',
                  location: `_guides/${file}`,
                  description: `Body Markdown references missing image file: "${imgLink}"`,
                  action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
                });
              }
            }

          } catch (yamlErr: any) {
            issues.push({
              severity: 'error',
              scope: 'Guides',
              location: `_guides/${file}`,
              description: `Front matter YAML syntax error: ${yamlErr.message}`,
              action: { label: 'Open Gift Guides', tab: 'guides', id: slug }
            });
          }
        }
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Environment',
          location: '_guides',
          description: `Failed to audit guides directory: ${err.message}`
        });
      }
    }

    // 6. Articles Verification
    if (fs.existsSync(articlesDir)) {
      try {
        const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md') && !f.startsWith('.'));
        counts.articles = files.length;

        for (const file of files) {
          const filePath = path.join(articlesDir, file);
          const raw = fs.readFileSync(filePath, 'utf8');
          const slug = file.replace(/\.md$/, '');

          try {
            const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
            if (!match) {
              issues.push({
                severity: 'error',
                scope: 'Articles',
                location: `_articles/${file}`,
                description: 'Jekyll article file is missing proper front matter delimiters (---)',
                action: { label: 'Open Articles', tab: 'articles', id: slug }
              });
              continue;
            }

            const fm = yaml.load(match[1]) as any;
            const body = match[2] || '';

            if (!fm || typeof fm !== 'object') {
              issues.push({
                severity: 'error',
                scope: 'Articles',
                location: `_articles/${file}`,
                description: 'Failed to decode article front matter',
                action: { label: 'Open Articles', tab: 'articles', id: slug }
              });
              continue;
            }

            // Indexing conflict check against robots.txt disallows
            let isNoindex = false;
            if (fm.robots) {
              if (typeof fm.robots === 'object' && fm.robots.index === false) {
                isNoindex = true;
              } else if (typeof fm.robots === 'string' && fm.robots.toLowerCase().includes('noindex')) {
                isNoindex = true;
              }
            }
            if (isNoindex) {
              const articleUrl = `/articles/${slug}/`;
              const isBlocked = disallowedPaths.some(p => p === '/' || articleUrl.startsWith(p));
              if (isBlocked) {
                issues.push({
                  severity: 'warning',
                  scope: 'Settings',
                  location: `_articles/${file}`,
                  description: `SEO Conflict: Article is marked as Noindex but is blocked from crawling in robots.txt. Crawlers can't see the noindex tag.`,
                  action: { label: 'Open SEO & Indexing', tab: 'seo' }
                });
              }
            }

            if (!fm.title || typeof fm.title !== 'string' || !fm.title.trim()) {
              issues.push({
                severity: 'error',
                scope: 'Articles',
                location: `_articles/${file}`,
                description: 'Article is missing required front matter field: "title"',
                action: { label: 'Open Articles', tab: 'articles', id: slug }
              });
            }

            // Permalink register
            if (fm.permalink) {
              if (registeredPermalinks.has(fm.permalink)) {
                issues.push({
                  severity: 'error',
                  scope: 'Articles',
                  location: `_articles/${file}`,
                  description: `Duplicate permalink registered: "${fm.permalink}" (also used by ${registeredPermalinks.get(fm.permalink)})`,
                  action: { label: 'Open Articles', tab: 'articles', id: slug }
                });
              } else {
                registeredPermalinks.set(fm.permalink, `_articles/${file}`);
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Articles',
                location: `_articles/${file}`,
                description: 'Article has no explicit "permalink" specified',
                action: { label: 'Open Articles', tab: 'articles', id: slug }
              });
            }

            // Author validation
            if (fm.author) {
              const authorSlug = typeof fm.author === 'string' ? fm.author : fm.author.slug || fm.author.name?.toLowerCase();
              if (authorSlug && !validAuthors.has(authorSlug)) {
                issues.push({
                  severity: 'warning',
                  scope: 'Articles',
                  location: `_articles/${file}`,
                  description: `Article references unknown or unmapped author slug: "${authorSlug}"`,
                  action: { label: 'Open Articles', tab: 'articles', id: slug }
                });
              }
            } else {
              issues.push({
                severity: 'warning',
                scope: 'Articles',
                location: `_articles/${file}`,
                description: 'Article has no assigned author',
                action: { label: 'Open Articles', tab: 'articles', id: slug }
              });
            }

            // Image references
            if (fm.image) {
              const imgName = String(fm.image);
              referencedImagesSet.add(imgName);
              if (!foundImagesMap.has(imgName)) {
                issues.push({
                  severity: 'error',
                  scope: 'Assets',
                  location: `_articles/${file}`,
                  description: `Article references missing image asset: "${imgName}"`,
                  action: { label: 'Open Articles', tab: 'articles', id: slug }
                });
              }
            }

            // Scan markdown body for image files
            const imgRegex = /!\[.*?\]\((.*?)\)/g;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(body)) !== null) {
              const imgLink = imgMatch[1];
              const basename = path.basename(imgLink);
              referencedImagesSet.add(basename);
              if (!foundImagesMap.has(basename)) {
                issues.push({
                  severity: 'warning',
                  scope: 'Assets',
                  location: `_articles/${file}`,
                  description: `Markdown body references missing image file: "${imgLink}"`,
                  action: { label: 'Open Articles', tab: 'articles', id: slug }
                });
              }
            }

          } catch (yamlErr: any) {
            issues.push({
              severity: 'error',
              scope: 'Articles',
              location: `_articles/${file}`,
              description: `Front matter YAML syntax error: ${yamlErr.message}`,
              action: { label: 'Open Articles', tab: 'articles', id: slug }
            });
          }
        }
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Environment',
          location: '_articles',
          description: `Failed to audit articles directory: ${err.message}`
        });
      }
    }

    // 7. Site Navigation Links validation
    if (fs.existsSync(navigationPath)) {
      try {
        const rawNav = fs.readFileSync(navigationPath, 'utf8');
        const parsed = yaml.load(rawNav) as any;

        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(sectionKey => {
            const list = parsed[sectionKey];
            if (Array.isArray(list)) {
              list.forEach((item: any, idx: number) => {
                if (!item || !item.title || !item.url) {
                  issues.push({
                    severity: 'error',
                    scope: 'Navigation',
                    location: `_data/navigation.yml [Section: ${sectionKey}, Index: ${idx}]`,
                    description: 'Navigation link is missing required fields "title" or "url"',
                    action: { label: 'Open Navigation Data', tab: 'navigation' }
                  });
                  return;
                }

                // If link is external, skip file validation
                if (item.external || item.url.startsWith('http')) return;

                // Validate internal URL targets
                const url = item.url;
                const pathClean = url.split('#')[0].split('?')[0];
                if (pathClean === '/' || pathClean === '') return; // Home is always resolved

                // Check static files or directories
                let foundTarget = false;

                // 1. Check if matches custom permalinks from articles/guides
                if (registeredPermalinks.has(pathClean) || registeredPermalinks.has(pathClean + '/') || registeredPermalinks.has('/' + pathClean)) {
                  foundTarget = true;
                }

                // 2. Check if a directory with index.html exists
                if (!foundTarget) {
                  const localDir = path.join(JEKYLL_ROOT, pathClean);
                  const indexHtml = path.join(localDir, 'index.html');
                  const indexMd = path.join(localDir, 'index.md');
                  if (fs.existsSync(indexHtml) || fs.existsSync(indexMd) || fs.existsSync(localDir + '.html') || fs.existsSync(localDir + '.md')) {
                    foundTarget = true;
                  }
                }

                if (!foundTarget) {
                  issues.push({
                    severity: 'warning',
                    scope: 'Navigation',
                    location: `_data/navigation.yml [Link: "${item.title}"]`,
                    description: `Link URL "${url}" could not be resolved to any active file, directory index, or markdown permalink`,
                    action: { label: 'Open Navigation Data', tab: 'navigation' }
                  });
                }
              });
            }
          });
        }
      } catch (err: any) {
        issues.push({
          severity: 'error',
          scope: 'Navigation',
          location: '_data/navigation.yml',
          description: `Failed to load or parse navigation structure: ${err.message}`,
          action: { label: 'Open Navigation Data', tab: 'navigation' }
        });
      }
    } else {
      issues.push({
        severity: 'error',
        scope: 'Navigation',
        location: '_data/navigation.yml',
        description: 'Site Navigation taxonomy file navigation.yml is missing',
        action: { label: 'Open Navigation Data', tab: 'navigation' }
      });
    }

    // 8. Global Components Safety Audit (_includes/)
    const expectedIncludes = [
      { name: 'newsletter.html', label: 'Newsletter Component' },
      { name: 'footer.html', label: 'Global Footer' },
      { name: 'editors-pick.html', label: "Editor's Pick Widget" }
    ];

    expectedIncludes.forEach(inc => {
      const incPath = path.join(JEKYLL_ROOT, '_includes', inc.name);
      if (fs.existsSync(incPath)) {
        try {
          const raw = fs.readFileSync(incPath, 'utf8');
          if (!raw || !raw.trim()) {
            issues.push({
              severity: 'warning',
              scope: 'Global Components',
              location: `_includes/${inc.name}`,
              description: `${inc.label} file is empty. Component will render blank content.`,
              action: { label: 'Open Global Components', tab: 'global-components' }
            });
          }

          // Search for any loose Liquid braces or broken tags
          const openCount = (raw.match(/\{\%/g) || []).length;
          const closeCount = (raw.match(/\%\}/g) || []).length;
          const openVarCount = (raw.match(/\{\{/g) || []).length;
          const closeVarCount = (raw.match(/\}\}/g) || []).length;

          if (openCount !== closeCount) {
            issues.push({
              severity: 'error',
              scope: 'Global Components',
              location: `_includes/${inc.name}`,
              description: `Mismatched Liquid block tags found: {% count (${openCount}) vs %} count (${closeCount})`,
              action: { label: 'Open Global Components', tab: 'global-components' }
            });
          }
          if (openVarCount !== closeVarCount) {
            issues.push({
              severity: 'error',
              scope: 'Global Components',
              location: `_includes/${inc.name}`,
              description: `Mismatched Liquid variable curly braces: {{ count (${openVarCount}) vs }} count (${closeVarCount})`,
              action: { label: 'Open Global Components', tab: 'global-components' }
            });
          }

        } catch (err: any) {
          issues.push({
            severity: 'error',
            scope: 'Global Components',
            location: `_includes/${inc.name}`,
            description: `Failed to parse component template: ${err.message}`,
            action: { label: 'Open Global Components', tab: 'global-components' }
          });
        }
      } else {
        issues.push({
          severity: 'error',
          scope: 'Global Components',
          location: `_includes/${inc.name}`,
          description: `Required Jekyll include file "${inc.name}" is missing on disk. Web pages will error or crash on compilation.`,
          action: { label: 'Open Global Components', tab: 'global-components' }
        });
      }
    });

    // 9. Backups Directory Audit
    let backupFileCount = 0;
    const backupBreakdown: any = {};
    if (fs.existsSync(backupsDir)) {
      try {
        const categories = fs.readdirSync(backupsDir);
        for (const cat of categories) {
          const catPath = path.join(backupsDir, cat);
          if (fs.statSync(catPath).isDirectory()) {
            const bFiles = fs.readdirSync(catPath).filter(f => !f.startsWith('.'));
            backupFileCount += bFiles.length;
            backupBreakdown[cat] = bFiles.length;
          }
        }
        counts.backups = backupFileCount;
      } catch (err: any) {
        issues.push({
          severity: 'warning',
          scope: 'Environment',
          location: 'editor-backups/',
          description: `Failed to inspect backup snapshots: ${err.message}`
        });
      }
    } else {
      issues.push({
        severity: 'warning',
        scope: 'Environment',
        location: 'editor-backups/',
        description: 'Snapshots folder editor-backups/ does not exist. Backups are disabled until an editor initiates a save.'
      });
    }

    // 10. Assets Audit - Orphaned / Missing Images
    const orphanedImages: string[] = [];
    const missingImagesSet = new Set<string>();

    foundImagesMap.forEach((relPath, key) => {
      // Don't check prefixes, check base filenames
      if (!key.includes('/') && !key.includes('\\')) {
        const isReferenced = referencedImagesSet.has(key);
        if (!isReferenced) {
          orphanedImages.push(relPath);
        }
      }
    });

    // Clean orphans duplicates
    const uniqueOrphans = Array.from(new Set(orphanedImages)).sort();

    // Check if jekyll CLI detects ruby tooling
    let jekyllTooling = {
      jekyllDetected: fs.existsSync(configPath),
      configValid: true,
      toolingAvailable: false,
      rubyVersion: 'unknown'
    };

    // Safe execution check for Ruby/Jekyll
    try {
      const { execSync } = require('child_process');
      const versionOutput = execSync('jekyll --version', { timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
      if (versionOutput) {
        jekyllTooling.toolingAvailable = true;
        jekyllTooling.rubyVersion = versionOutput.toString().trim();
      }
    } catch {}

    // Verify _config.yml health
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        yaml.load(raw);
      } catch (err: any) {
        jekyllTooling.configValid = false;
        issues.push({
          severity: 'error',
          scope: 'Settings',
          location: '_config.yml',
          description: `Site _config.yml has invalid YAML syntax: ${err.message}`,
          action: { label: 'Open Site Settings', tab: 'settings' }
        });
      }
    } else {
      jekyllTooling.configValid = false;
      issues.push({
        severity: 'error',
        scope: 'Settings',
        location: '_config.yml',
        description: 'Jekyll _config.yml is missing from the project root',
        action: { label: 'Open Site Settings', tab: 'settings' }
      });
    }

    // Verify Static Editorial Pages Indexing Conflicts
    ALLOWED_PAGE_SLUGS.forEach(slug => {
      const pagePath = getPageFilePath(slug);
      if (pagePath && fs.existsSync(pagePath)) {
        try {
          const rawHtml = fs.readFileSync(pagePath, 'utf8');
          const parsed = parseStaticPageHtml(slug, rawHtml);
          
          let isNoindex = false;
          if (parsed.robots) {
            if (typeof parsed.robots === 'object' && parsed.robots.index === false) {
              isNoindex = true;
            } else if (typeof parsed.robots === 'string' && parsed.robots.toLowerCase().includes('noindex')) {
              isNoindex = true;
            }
          }
          if (isNoindex) {
            const pageUrl = slug === '404' ? '/404.html' : `/${slug}/`;
            const isBlocked = disallowedPaths.some(p => p === '/' || pageUrl.startsWith(p));
            if (isBlocked) {
              issues.push({
                severity: 'warning',
                scope: 'Settings',
                location: `Static Page: /${slug}/`,
                description: `SEO Conflict: Static page "${parsed.title || slug}" is marked as 'noindex' but is blocked from crawling in robots.txt. Crawlers can't see the noindex tag.`,
                action: { label: 'Open SEO & Indexing', tab: 'seo' }
              });
            }
          }
        } catch (e: any) {
          issues.push({
            severity: 'error',
            scope: 'Settings',
            location: `Static Page: /${slug}/`,
            description: `Failed to parse static page payload during diagnostic audit: ${e.message}`,
            action: { label: 'Open Static Pages', tab: 'pages' }
          });
        }
      }
    });

    // Sort issues: errors first, then warnings
    issues.sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === 'error' ? -1 : 1;
    });

    res.json({
      success: true,
      issues,
      counts,
      assetsAudit: {
        totalImages: foundImagesMap.size / 3, // divided by map key variations
        referencedImages: referencedImagesSet.size,
        orphanedImages: uniqueOrphans,
        missingImages: Array.from(missingImagesSet)
      },
      backupsAudit: {
        totalCount: backupFileCount,
        modules: backupBreakdown
      },
      jekyllHealth: jekyllTooling
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: `Diagnostics run failed: ${err.message}` });
  }
});


// PHASE 13: SEO & ROBOTS.TXT MANAGEMENT API
const SEO_BACKUPS_DIR = path.join(PROJECT_ROOT, 'editor-backups', 'seo');

try {
  if (!fs.existsSync(SEO_BACKUPS_DIR)) {
    fs.mkdirSync(SEO_BACKUPS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize SEO_BACKUPS_DIR:', e);
}

// Helper to back up robots.txt
function backupRobotsTxt(): string | null {
  const robotsPath = path.join(JEKYLL_ROOT, 'robots.txt');
  if (!fs.existsSync(robotsPath)) return null;

  try {
    if (!fs.existsSync(SEO_BACKUPS_DIR)) {
      fs.mkdirSync(SEO_BACKUPS_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const filename = `robots_${timestamp}_update.txt`;
    const destPath = path.join(SEO_BACKUPS_DIR, filename);
    fs.copyFileSync(robotsPath, destPath);

    // Enforce 10-backup limit
    const files = fs.readdirSync(SEO_BACKUPS_DIR).filter(f => f.startsWith('robots_') && f.endsWith('.txt')).sort();
    if (files.length > 10) {
      for (let i = 0; i < files.length - 10; i++) {
        try { fs.unlinkSync(path.join(SEO_BACKUPS_DIR, files[i])); } catch {}
      }
    }
    return filename;
  } catch (err) {
    console.error('Failed to back up robots.txt:', err);
    return null;
  }
}

// GET /api/robots-txt
app.get('/api/robots-txt', (req: Request, res: Response) => {
  try {
    const robotsPath = path.join(JEKYLL_ROOT, 'robots.txt');
    let content = '';
    if (fs.existsSync(robotsPath)) {
      content = fs.readFileSync(robotsPath, 'utf8');
    }
    res.json({ success: true, content });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to load robots.txt: ${err.message}` });
  }
});

// PUT /api/robots-txt
app.put('/api/robots-txt', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (content === undefined || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'robots.txt content is required.' });
    }

    // Safety checks against injection
    if (content.includes('\0')) {
      return res.status(400).json({ success: false, error: 'Null bytes are strictly prohibited.' });
    }

    // Create backup of old state
    const backupFile = backupRobotsTxt();

    // Validate content rules
    const warnings: string[] = [];
    const lines = content.split(/\r?\n/);
    
    let hasUserAgent = false;
    let siteWideBlocked = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const lower = trimmed.toLowerCase();
      if (lower.startsWith('user-agent:')) {
        hasUserAgent = true;
      }

      // Check for User-agent: * followed by Disallow: /
      if (lower.replace(/\s+/g, '') === 'disallow:/') {
        siteWideBlocked = true;
      }
    }

    if (lines.length > 0 && !hasUserAgent) {
      warnings.push('No active "User-agent" directive found in robots.txt rules.');
    }
    if (siteWideBlocked) {
      warnings.push('WARNING: "Disallow: /" blocks search engine crawlers from indexing your entire site!');
    }

    // Write atomically
    const robotsPath = path.join(JEKYLL_ROOT, 'robots.txt');
    const tempPath = robotsPath + '.tmp';
    
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, robotsPath);

    // Read back verification
    const verifiedContent = fs.readFileSync(robotsPath, 'utf8');

    res.json({
      success: true,
      message: 'robots.txt updated successfully on local disk.',
      content: verifiedContent,
      warnings,
      backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to save robots.txt: ${err.message}` });
  }
});

// GET /api/robots-backups
app.get('/api/robots-backups', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(SEO_BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs.readdirSync(SEO_BACKUPS_DIR)
      .filter(f => f.startsWith('robots_') && f.endsWith('.txt'))
      .map(f => {
        const full = path.join(SEO_BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        return {
          filename: f,
          timestamp: stats.mtime.toISOString(),
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ success: true, backups: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to list robots.txt backups: ${err.message}` });
  }
});

// POST /api/robots-backups/restore
app.post('/api/robots-backups/restore', (req: Request, res: Response) => {
  try {
    const { backupFilename } = req.body;
    if (!backupFilename || typeof backupFilename !== 'string') {
      return res.status(400).json({ success: false, error: 'backupFilename is required.' });
    }
    const safeFilename = path.basename(backupFilename);
    const backupPath = path.join(SEO_BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, error: `Backup file "${safeFilename}" not found.` });
    }

    // Safety backup of the current robots.txt before overwriting
    const backupFile = backupRobotsTxt();

    const backupContent = fs.readFileSync(backupPath, 'utf8');
    
    // Write atomically
    const robotsPath = path.join(JEKYLL_ROOT, 'robots.txt');
    const tempPath = robotsPath + '.tmp';
    fs.writeFileSync(tempPath, backupContent, 'utf8');
    fs.renameSync(tempPath, robotsPath);

    res.json({
      success: true,
      message: `Restored robots.txt rules from backup "${safeFilename}".`,
      content: backupContent,
      backupFile
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Restore failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// PHASE 14: CONTENT IMPORT & MIGRATION ENGINE (PHASE 1: ANALYSIS & PREVIEW)
// -------------------------------------------------------------

// 1. GET /api/import/samples - Get built-in legacy sample Markdown files for 1-click testing
app.get('/api/import/samples', (req: Request, res: Response) => {
  res.json({
    success: true,
    samples: SAMPLE_LEGACY_FILES
  });
});

// 2. GET /api/import/items - Get all files uploaded to the current import session
app.get('/api/import/items', (req: Request, res: Response) => {
  res.json({
    success: true,
    items: getSessionItems()
  });
});

// 3. POST /api/import/upload - Upload and parse one or more Markdown files (.md, .markdown), optionally with live article URL
app.post('/api/import/upload', async (req: Request, res: Response) => {
  try {
    const { files, content, filename, targetType, liveUrl } = req.body || {};

    const itemsToProcess: Array<{ filename: string; content: string; targetType?: any; liveUrl?: string }> = [];

    if (Array.isArray(files)) {
      itemsToProcess.push(...files);
    } else if (typeof content === 'string') {
      itemsToProcess.push({
        filename: filename || 'untitled.md',
        content,
        targetType,
        liveUrl
      });
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({ success: false, error: 'No Markdown content provided for import.' });
    }

    const createdItems: any[] = [];

    for (let i = 0; i < itemsToProcess.length; i++) {
      const item = itemsToProcess[i];
      const fn = item.filename || `document-${Date.now()}-${i + 1}.md`;
      const rawContent = item.content || '';
      const urlToReconcile = item.liveUrl || liveUrl;

      const analysis = analyzeImportDocument(rawContent, fn, item.targetType);
      const draft = createInitialDraft(analysis, fn);

      let newItem: any = {
        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        filename: fn,
        fileSize: Buffer.byteLength(rawContent, 'utf8'),
        rawContent,
        uploadedAt: new Date().toISOString(),
        targetType: analysis.detectedType,
        status: draft.status,
        sourceType: urlToReconcile ? 'both' : 'markdown',
        liveUrl: urlToReconcile || undefined,
        urlFetchStatus: urlToReconcile ? 'fetching' : 'idle',
        analysis,
        draft
      };

      if (urlToReconcile) {
        try {
          const liveData = await fetchAndExtractLiveUrl(urlToReconcile);
          newItem = enrichItemWithLiveUrl(newItem, liveData);
        } catch (fetchErr: any) {
          console.warn('[IMPORT URL] Could not fetch live page during upload:', fetchErr.message);
          newItem.urlFetchStatus = 'failed';
          newItem.urlFetchError = `Could not fetch live page: ${fetchErr.message}`;
          newItem.analysis.issues.push({
            id: 'issue-url-fetch-failed',
            severity: 'warning',
            title: 'Could Not Fetch Live Page',
            message: `Could not fetch live page (${urlToReconcile}): ${fetchErr.message}. The import continues using the Markdown source.`,
            suggestion: 'Verify the URL is publicly reachable, or retry the fetch.'
          });
        }
      }

      setSessionItem(newItem);
      createdItems.push(newItem);
    }

    res.json({
      success: true,
      count: createdItems.length,
      items: createdItems
    });
  } catch (err: any) {
    console.error('Import upload error:', err);
    res.status(500).json({ success: false, error: `Failed to process import: ${err.message}` });
  }
});

// 3b. POST /api/import/fetch-url - Fetch a live article URL (Standalone or Reconcile with existing item)
app.post('/api/import/fetch-url', async (req: Request, res: Response) => {
  try {
    const { url, attachToItemId } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'A valid URL is required.' });
    }

    const trimmedUrl = url.trim();

    // If attaching to existing item in session
    if (attachToItemId) {
      const existing = getSessionItem(attachToItemId);
      if (!existing) {
        return res.status(404).json({ success: false, error: `Import file "${attachToItemId}" not found.` });
      }

      existing.liveUrl = trimmedUrl;
      existing.urlFetchStatus = 'fetching';
      delete existing.urlFetchError;

      try {
        const liveData = await fetchAndExtractLiveUrl(trimmedUrl);
        const enriched = enrichItemWithLiveUrl(existing, liveData);
        setSessionItem(enriched);

        return res.json({
          success: true,
          message: 'Live page successfully fetched and reconciled with Markdown.',
          item: enriched,
          liveData
        });
      } catch (err: any) {
        console.warn(`[IMPORT URL] Fetch failed for ${trimmedUrl}:`, err.message);
        existing.urlFetchStatus = 'failed';
        existing.urlFetchError = `Could not fetch live page: ${err.message}`;

        if (!existing.analysis?.issues.some(i => i.id === 'issue-url-fetch-failed')) {
          existing.analysis?.issues.push({
            id: 'issue-url-fetch-failed',
            severity: 'warning',
            title: 'Could Not Fetch Live Page',
            message: `Could not fetch live page: ${err.message}`,
            suggestion: 'Verify the URL is reachable and returns standard HTML.'
          });
        }

        setSessionItem(existing);

        return res.status(200).json({
          success: false,
          error: `Could not fetch live page: ${err.message}`,
          item: existing
        });
      }
    }

    // Standalone URL import (No Markdown uploaded)
    try {
      const liveData = await fetchAndExtractLiveUrl(trimmedUrl);
      const newItem = createImportItemFromLiveUrl(liveData);
      setSessionItem(newItem);

      return res.json({
        success: true,
        message: 'Live article URL analyzed and converted into editable import draft.',
        item: newItem,
        liveData
      });
    } catch (err: any) {
      console.warn(`[IMPORT URL] Standalone fetch failed for ${trimmedUrl}:`, err.message);
      return res.status(400).json({
        success: false,
        error: `Could not fetch live page: ${err.message}`
      });
    }
  } catch (err: any) {
    console.error('Fetch URL route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3c. POST /api/import/adopt-diff/:id - 1-Click Adopt a value from Live URL or Markdown
app.post('/api/import/adopt-diff/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { field, value, source } = req.body || {};

    const item = getSessionItem(id);
    if (!item) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    if (!item.draft && item.analysis) {
      item.draft = createInitialDraft(item.analysis, item.filename);
    }

    if (item.draft && field) {
      // Update draft property
      if (field === 'title') item.draft.title = String(value || '');
      else if (field === 'search-title' || field === 'searchTitle') item.draft.searchTitle = String(value || '');
      else if (field === 'deck') item.draft.deck = String(value || '');
      else if (field === 'seo-description' || field === 'seoDescription') item.draft.seoDescription = String(value || '');
      else if (field === 'author') {
        item.draft.authorName = String(value || '');
      } else if (field === 'publishedDate') item.draft.publishedDate = String(value || '');
      else if (field === 'lastModifiedDate') item.draft.lastModifiedDate = String(value || '');
      else if (field === 'heroImageType') item.draft.heroImageType = String(value || '');
      else if (field === 'category') item.draft.category = String(value || '');

      // Mark reconciliation report diff as adopted
      if (item.reconciliationReport) {
        const diff = item.reconciliationReport.fieldDiffs.find(d => d.field === field);
        if (diff) {
          diff.adoptedSource = source || 'live';
          diff.currentValue = value;
        }
      }

      item.draft.lastSavedAt = new Date().toISOString();
      setSessionItem(item);
    }

    res.json({
      success: true,
      message: `Adopted ${source || 'live'} value for "${field}".`,
      item
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/import/analyze/:id - Re-analyze or AI-enhance a document in the import session
app.post('/api/import/analyze/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetType, useAi, resetDraft } = req.body || {};

    const existing = getSessionItem(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found in session.` });
    }

    const effectiveTargetType = targetType || existing.targetType;

    // Run deterministic heuristic analysis
    let analysis = analyzeImportDocument(existing.rawContent, existing.filename, effectiveTargetType);

    // If AI enhancement is requested
    if (useAi) {
      const aiResponse = await executeImportAiAnalysis({
        rawContent: existing.rawContent,
        filename: existing.filename,
        currentAnalysis: analysis
      });
      if (aiResponse.refinedAnalysis) {
        analysis = aiResponse.refinedAnalysis;
      }
    }

    existing.targetType = effectiveTargetType;
    existing.analysis = analysis;

    // Reset or refresh draft if requested or if no draft existed
    if (resetDraft || !existing.draft) {
      existing.draft = createInitialDraft(analysis, existing.filename);
      existing.status = existing.draft.status;
    } else {
      // Sync any updated AI SEO suggestions into draft if draft currently matches original fallback
      if (analysis.seo.searchTitle && (!existing.draft.searchTitle || existing.draft.searchTitle === existing.draft.title)) {
        existing.draft.searchTitle = analysis.seo.searchTitle;
      }
      if (analysis.seo.seoDescription && (!existing.draft.seoDescription || existing.draft.seoDescription === existing.draft.deck)) {
        existing.draft.seoDescription = analysis.seo.seoDescription;
      }
      existing.draft.lastSavedAt = new Date().toISOString();
    }

    setSessionItem(existing);

    res.json({
      success: true,
      item: existing
    });
  } catch (err: any) {
    console.error('Import analysis error:', err);
    res.status(500).json({ success: false, error: `Analysis failed: ${err.message}` });
  }
});

// 5. PUT /api/import/draft/:id & POST /api/import/draft/:id - Save edited import draft in session
const handleSaveImportDraft = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const draftData = req.body || {};

    const updated = saveImportDraft(id, draftData);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    res.json({
      success: true,
      message: 'Draft saved to import session (No files written to Jekyll site).',
      item: updated
    });
  } catch (err: any) {
    console.error('Save draft error:', err);
    res.status(500).json({ success: false, error: `Failed to save draft: ${err.message}` });
  }
};
app.put('/api/import/draft/:id', handleSaveImportDraft);
app.post('/api/import/draft/:id', handleSaveImportDraft);

// 6. POST /api/import/draft/:id/resolve-issue - Toggle or resolve warning issue inline
app.post('/api/import/draft/:id/resolve-issue', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { issueId, resolved, note } = req.body || {};

    const updated = resolveDraftIssue(id, issueId, resolved !== false, note);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    res.json({
      success: true,
      message: `Issue "${issueId}" ${resolved !== false ? 'marked resolved' : 'reopened'}.`,
      item: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST /api/import/draft/:id/remap-field - Update a front matter field destination mapping
app.post('/api/import/draft/:id/remap-field', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { oldKey, newKey, status, customValue } = req.body || {};

    if (!oldKey || !newKey) {
      return res.status(400).json({ success: false, error: 'Both oldKey and newKey are required.' });
    }

    const updated = updateDraftFieldMapping(id, oldKey, newKey, status, customValue);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    res.json({
      success: true,
      message: `Field "${oldKey}" remapped to "${newKey}".`,
      item: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. POST /api/import/draft/:id/status - Update draft lifecycle status (e.g. 'ready', 'needs_review')
app.post('/api/import/draft/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const updated = updateDraftStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    res.json({
      success: true,
      message: `Status updated to ${status}.`,
      item: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/import/draft/:id/revert - Revert draft back to original AI / parser analysis
app.post('/api/import/draft/:id/revert', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = revertImportDraft(id);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    res.json({
      success: true,
      message: 'Draft reverted to original analysis.',
      item: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. POST /api/import/approve/:id - Approve analysis for Phase 2 (Does NOT write to Jekyll site!)
app.post('/api/import/approve/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const existing = getSessionItem(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    existing.status = 'approved';
    existing.approvalInfo = {
      approvedAt: new Date().toISOString(),
      notes: notes || undefined
    };

    setSessionItem(existing);

    res.json({
      success: true,
      message: 'Stage 1 Approved: Analysis and schema mapping verified. IMPORTANT: Per Phase 1 requirements, no files have been written to the Jekyll site or products catalog.',
      item: existing
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Approval failed: ${err.message}` });
  }
});

// 6. POST /api/import/unapprove/:id - Revert approval back to analyzed state
app.post('/api/import/unapprove/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getSessionItem(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Import file "${id}" not found.` });
    }

    existing.status = 'analyzed';
    delete existing.approvalInfo;

    setSessionItem(existing);

    res.json({
      success: true,
      message: 'Approval removed. File is back in analyzed state.',
      item: existing
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Revert failed: ${err.message}` });
  }
});

// 11. POST /api/import/export-products/:id - Export specified link IDs to CMS products catalog (_data/products.yml)
app.post('/api/import/export-products/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { linkIds } = req.body || {};

    if (!Array.isArray(linkIds) || linkIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one link ID is required for export.' });
    }

    const result = exportProductsFromLinks(id, linkIds);
    res.json(result);
  } catch (err: any) {
    console.error('Export products error:', err);
    res.status(500).json({ success: false, error: `Export failed: ${err.message}` });
  }
});

// 12. POST /api/import/create-post/:id - Approve and convert current edited draft into new Jekyll post
app.post('/api/import/create-post/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = createPostFromDraft(id);
    res.json(result);
  } catch (err: any) {
    console.error('Create post error:', err);
    res.status(500).json({ success: false, error: `Create post failed: ${err.message}` });
  }
});

// 7. DELETE /api/import/items/:id - Remove single file from import queue
app.delete('/api/import/items/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = removeSessionItem(id);
    res.json({ success: true, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. DELETE /api/import/items - Clear import session queue
app.delete('/api/import/items', (req: Request, res: Response) => {
  try {
    clearSessionItems();
    res.json({ success: true, message: 'All import items cleared.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// -------------------------------------------------------------
// VITE MIDDLEWARE / STATIC ASSET SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev middleware in development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/site/**',
            '**/editor-backups/**',
            '**/.local-editor/**',
            '**/_data/**',
            '**/_guides/**',
            '**/_articles/**',
            '**/_layouts/**',
            '**/_includes/**',
            '**/*.yml',
            '**/*.yaml',
            '**/*.md',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built Vite output from dist/
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Science of Gifts Local Content Editor running at http://localhost:${PORT}`);
    console.log(`Operating on Jekyll project root: ${JEKYLL_ROOT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { execFileSync } from 'child_process';
import * as cheerio from 'cheerio';
import { isPrivateOrReservedIp, validateUrlForSsrf } from './urlScraperService';

export interface ImageExtractionCandidate {
  url: string;
  source: 'json-ld' | 'open-graph' | 'twitter' | 'amazon-dynamic' | 'product-container' | 'html-img';
  score: number;
}

export interface FetchProductImageResult {
  success: boolean;
  error?: string;
  filename?: string;
  relativePath?: string;
  publicUrl?: string;
  nameWithoutExt?: string;
  sourceImageUrl?: string;
  sourcePageUrl?: string;
  extractionMethod?: string;
  dimensions?: { width: number; height: number } | null;
  message?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB
const FETCH_TIMEOUT_MS = 12000; // 12 seconds
const MAX_REDIRECTS = 5;

/**
 * Safely fetches an HTML page server-side following redirects with SSRF validation at every hop.
 */
async function safeFetchHtmlPage(initialUrl: string): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = initialUrl;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    const ssrfCheck = await validateUrlForSsrf(currentUrl);
    if (!ssrfCheck.valid) {
      throw new Error(ssrfCheck.error || 'SSRF check failed for URL.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        redirect: 'manual',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle redirect status codes manually to enforce SSRF validation on the target
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response (${response.status}) missing Location header.`);
        }
        currentUrl = new URL(location, currentUrl).href;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status} (${response.statusText}).`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        // Some ecommerce endpoints return text/plain with HTML, allow fallback check
        if (!contentType.includes('text/plain') && !contentType.includes('application/xml')) {
          throw new Error(`Unexpected content-type (${contentType}). Expected an HTML page.`);
        }
      }

      const rawHtml = await response.text();
      const truncatedHtml = rawHtml.slice(0, MAX_HTML_SIZE);
      return { html: truncatedHtml, finalUrl: currentUrl };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`);
      }
      throw err;
    }
  }

  throw new Error(`Exceeded maximum redirect limit (${MAX_REDIRECTS}).`);
}

/**
 * Parses and extracts candidate product images deterministically from HTML.
 * Priority:
 * 1. Product JSON-LD (<script type="application/ld+json">)
 * 2. Open Graph meta tags (og:image, og:image:url, og:image:secure_url)
 * 3. Twitter card image (twitter:image, twitter:image:src)
 * 4. High-priority product containers / Amazon dynamic images / itemprop="image"
 * 5. Scored generic <img> tags
 */
export function extractCandidatesFromHtml(html: string, baseUrl: string): ImageExtractionCandidate[] {
  const $ = cheerio.load(html);
  const candidates: ImageExtractionCandidate[] = [];

  const resolveUrl = (raw: string | undefined | null): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
      return null;
    }
    try {
      const resolved = new URL(trimmed, baseUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        return resolved.href;
      }
    } catch {}
    return null;
  };

  // Helper to test if a candidate URL seems like a low-value icon/logo/spacer
  const isLikelyUnwanted = (url: string, contextText = ''): boolean => {
    const combined = `${url} ${contextText}`.toLowerCase();
    return /(favicon|logo|icon|avatar|spacer|spinner|loading|pixel|tracking|badge|star|rating|cart|payment|visa|mastercard|paypal|banner|button|share|print|email|1x1)/i.test(combined);
  };

  // 1. JSON-LD Structured Data
  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const content = $(elem).html();
      if (!content) return;
      const parsed = JSON.parse(content.trim());

      const processJsonLdNode = (node: any) => {
        if (!node || typeof node !== 'object') return;

        // Recursively handle @graph or array
        if (Array.isArray(node)) {
          node.forEach(processJsonLdNode);
          return;
        }
        if (node['@graph'] && Array.isArray(node['@graph'])) {
          node['@graph'].forEach(processJsonLdNode);
          return;
        }

        const type = String(node['@type'] || node.type || '');
        const isProduct = /product/i.test(type);

        if (isProduct && node.image) {
          const rawImages = Array.isArray(node.image) ? node.image : [node.image];
          for (const item of rawImages) {
            let imgUrl: string | null = null;
            if (typeof item === 'string') {
              imgUrl = resolveUrl(item);
            } else if (item && typeof item === 'object') {
              imgUrl = resolveUrl(item.contentUrl || item.url || item.thumbnail);
            }
            if (imgUrl && !isLikelyUnwanted(imgUrl)) {
              candidates.push({
                url: imgUrl,
                source: 'json-ld',
                score: 100
              });
            }
          }
        }
      };

      processJsonLdNode(parsed);
    } catch {
      // Ignore JSON parse errors in malformed script tags
    }
  });

  // 2. Open Graph Meta Tags
  const ogProps = ['og:image', 'og:image:url', 'og:image:secure_url'];
  for (const prop of ogProps) {
    const content = $(`meta[property="${prop}"]`).attr('content') || $(`meta[name="${prop}"]`).attr('content');
    const resolved = resolveUrl(content);
    if (resolved && !isLikelyUnwanted(resolved)) {
      candidates.push({
        url: resolved,
        source: 'open-graph',
        score: 85
      });
      break; // Pick the first valid OG image
    }
  }

  // 3. Twitter Card Meta Tags
  const twitterProps = ['twitter:image', 'twitter:image:src'];
  for (const prop of twitterProps) {
    const content = $(`meta[name="${prop}"]`).attr('content') || $(`meta[property="${prop}"]`).attr('content');
    const resolved = resolveUrl(content);
    if (resolved && !isLikelyUnwanted(resolved)) {
      candidates.push({
        url: resolved,
        source: 'twitter',
        score: 75
      });
      break;
    }
  }

  // 4. Amazon Dynamic Image Data (Amazon stores high-res images in data-a-dynamic-image attribute)
  $('[data-a-dynamic-image]').each((_, elem) => {
    try {
      const dynamicJson = $(elem).attr('data-a-dynamic-image');
      if (dynamicJson) {
        const parsed = JSON.parse(dynamicJson);
        let bestUrl = '';
        let maxArea = 0;
        for (const [imgUrl, dims] of Object.entries(parsed)) {
          if (Array.isArray(dims) && dims.length >= 2) {
            const area = (dims[0] || 0) * (dims[1] || 0);
            if (area > maxArea) {
              maxArea = area;
              bestUrl = imgUrl;
            }
          } else if (!bestUrl) {
            bestUrl = imgUrl;
          }
        }
        const resolved = resolveUrl(bestUrl);
        if (resolved && !isLikelyUnwanted(resolved)) {
          candidates.push({
            url: resolved,
            source: 'amazon-dynamic',
            score: 95
          });
        }
      }
    } catch {}
  });

  // 5. High-Priority Product Containers & itemprop="image"
  const prioritySelectors = [
    '[itemprop="image"]',
    '#landingImage',
    '#imgBlkFront',
    '#main-image',
    '.main-image img',
    'img.main-image',
    '.product-image img',
    '.product__image img',
    '.product-gallery img',
    '.product-media img',
    '.product-featured-media img',
    '.woocommerce-product-gallery__image img',
    'img[data-carousel-first-image]',
    'img[data-palette-listing-image]',
    '.product-single__photo',
    '#product-image img',
    '[data-gallery] img'
  ];

  for (const sel of prioritySelectors) {
    $(sel).each((_, elem) => {
      const $el = $(elem);
      const raw =
        $el.attr('data-old-hires') ||
        $el.attr('data-zoom-image') ||
        $el.attr('data-high-res-src') ||
        $el.attr('data-hires') ||
        $el.attr('data-large') ||
        $el.attr('data-src') ||
        $el.attr('data-lazy-src') ||
        $el.attr('src');

      const resolved = resolveUrl(raw);
      if (resolved && !isLikelyUnwanted(resolved, `${$el.attr('class') || ''} ${$el.attr('alt') || ''}`)) {
        candidates.push({
          url: resolved,
          source: 'product-container',
          score: 80
        });
      }
    });
  }

  // 6. Generic <img> tags with heuristic scoring
  $('img').each((_, elem) => {
    const $img = $(elem);
    const src =
      $img.attr('data-old-hires') ||
      $img.attr('data-zoom-image') ||
      $img.attr('data-high-res-src') ||
      $img.attr('data-large') ||
      $img.attr('data-src') ||
      $img.attr('data-lazy-src') ||
      $img.attr('data-original') ||
      $img.attr('src');

    const resolved = resolveUrl(src);
    if (!resolved) return;

    const classAndAlt = `${$img.attr('class') || ''} ${$img.attr('id') || ''} ${$img.attr('alt') || ''}`;
    if (isLikelyUnwanted(resolved, classAndAlt)) return;

    let score = 40;
    const width = parseInt($img.attr('width') || '0', 10);
    const height = parseInt($img.attr('height') || '0', 10);

    if (width > 0 && width < 120 && height > 0 && height < 120) {
      return; // Skip small thumbnail or icon
    }
    if (width >= 400 || height >= 400) {
      score += 20;
    }

    if (/(product|item|photo|detail|feature|gallery|main|hero)/i.test(classAndAlt)) {
      score += 20;
    }

    // Check parent elements for product context
    const parentClass = $img.closest('[class*="product"], [class*="gallery"], [id*="product"], main, article').attr('class') || '';
    if (parentClass) {
      score += 15;
    }

    candidates.push({
      url: resolved,
      source: 'html-img',
      score
    });
  });

  return candidates;
}

/**
 * Downloads image bytes from a URL with full SSRF check and content-type validation.
 */
async function safeDownloadImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; ext: string; mimeType: string }> {
  let currentUrl = imageUrl;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    const ssrfCheck = await validateUrlForSsrf(currentUrl);
    if (!ssrfCheck.valid) {
      throw new Error(ssrfCheck.error || 'SSRF check failed for image URL.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': currentUrl
        },
        redirect: 'manual',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response (${response.status}) missing Location header.`);
        }
        currentUrl = new URL(location, currentUrl).href;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`Failed to download image (HTTP ${response.status} ${response.statusText}).`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_IMAGE_SIZE) {
        throw new Error(`Image size exceeds maximum limit of 15MB.`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 500) {
        throw new Error('Downloaded image file is too small or corrupt (< 500 bytes).');
      }
      if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error('Downloaded image exceeds maximum size limit (15 MB).');
      }

      // Determine extension from content-type or magic numbers
      const rawContentType = (response.headers.get('content-type') || '').toLowerCase();
      let ext = '.jpg';
      let mimeType = 'image/jpeg';

      if (rawContentType.includes('png') || (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47)) {
        ext = '.png';
        mimeType = 'image/png';
      } else if (rawContentType.includes('webp') || (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')) {
        ext = '.webp';
        mimeType = 'image/webp';
      } else if (rawContentType.includes('avif')) {
        ext = '.avif';
        mimeType = 'image/avif';
      } else if (rawContentType.includes('gif') || (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) {
        ext = '.gif';
        mimeType = 'image/gif';
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        ext = '.jpg';
        mimeType = 'image/jpeg';
      }

      return { buffer, ext, mimeType };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Image download timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`);
      }
      throw err;
    }
  }

  throw new Error(`Exceeded maximum redirect limit (${MAX_REDIRECTS}) while downloading image.`);
}

/**
 * Generates WebP and thumbnail derivatives using ImageMagick CLI (identical to server.ts pipeline)
 */
function generateLocalAssetDerivatives(srcPath: string): { webpCreated: boolean; thumbCreated: boolean } {
  const ext = path.extname(srcPath).toLowerCase();
  if (ext === '.svg') return { webpCreated: false, thumbCreated: false };

  const baseWithoutExt = srcPath.slice(0, -ext.length);
  const webpPath = `${baseWithoutExt}.webp`;
  const thumbPath = `${baseWithoutExt}-thumb.webp`;

  let webpCreated = false;
  let thumbCreated = false;

  try {
    if (!fs.existsSync(webpPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(webpPath).mtimeMs) {
      execFileSync('convert', [srcPath, '-quality', '85', webpPath], { stdio: ['ignore', 'ignore', 'ignore'] });
      webpCreated = true;
    }
  } catch {}

  try {
    if (!fs.existsSync(thumbPath) || fs.statSync(srcPath).mtimeMs > fs.statSync(thumbPath).mtimeMs) {
      execFileSync('convert', [srcPath, '-resize', '800x600>', '-quality', '82', thumbPath], { stdio: ['ignore', 'ignore', 'ignore'] });
      thumbCreated = true;
    }
  } catch {}

  return { webpCreated, thumbCreated };
}

/**
 * Computes image dimensions via ImageMagick identify
 */
function readLocalAssetDimensions(filePath: string): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
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
        return { width, height };
      }
    }
  } catch {}
  return null;
}

/**
 * Main orchestrator: fetches product URL, extracts best product image, downloads it,
 * writes to asset/library system, generates derivatives, and returns selection details.
 */
export async function fetchAndImportProductImage(
  targetUrl: string,
  options: {
    productId?: string;
    title?: string;
    jekyllRoot: string;
    projectRoot: string;
  }
): Promise<FetchProductImageResult> {
  const cleanUrl = (targetUrl || '').trim();
  if (!cleanUrl) {
    return { success: false, error: 'Direct Product URL is required.' };
  }

  // 1. Fetch the product page HTML
  let fetchedData: { html: string; finalUrl: string };
  try {
    fetchedData = await safeFetchHtmlPage(cleanUrl);
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to fetch product page: ${err.message}`
    };
  }

  // 2. Extract candidate images deterministically
  const candidates = extractCandidatesFromHtml(fetchedData.html, fetchedData.finalUrl);
  if (!candidates || candidates.length === 0) {
    return {
      success: false,
      error: 'No suitable product image found on the target page. Please select an image from the library manually.'
    };
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];

  // 3. Download the selected image buffer
  let downloaded: { buffer: Buffer; ext: string; mimeType: string } | null = null;
  try {
    downloaded = await safeDownloadImageBuffer(bestCandidate.url);
  } catch (err: any) {
    // If the top candidate download failed and we have other candidates, try next candidate
    for (let i = 1; i < Math.min(candidates.length, 3); i++) {
      try {
        downloaded = await safeDownloadImageBuffer(candidates[i].url);
        break;
      } catch {}
    }
    if (!downloaded) {
      return {
        success: false,
        error: `Found candidate image (${bestCandidate.url}) but download failed: ${err.message}`
      };
    }
  }

  if (!downloaded) {
    return {
      success: false,
      error: 'Failed to download product image from any candidate URL.'
    };
  }

  // 4. Determine sanitized asset filename
  const jekyllRoot = options.jekyllRoot;
  const projectRoot = options.projectRoot;
  const assetsImagesDir = path.join(jekyllRoot, 'assets', 'images');
  const assetsRootDir = path.join(jekyllRoot, 'assets');
  const assetsBackupsDir = path.join(projectRoot, '.local-editor', 'backups', 'assets');

  // Ensure directories exist
  [assetsImagesDir, assetsRootDir, assetsBackupsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Base slug priority: options.productId -> options.title -> candidate URL pathname
  let baseSlug = (options.productId || '').trim();
  if (!baseSlug && options.title) {
    baseSlug = options.title.trim();
  }
  if (!baseSlug) {
    try {
      const urlPath = new URL(bestCandidate.url).pathname;
      baseSlug = path.basename(urlPath, path.extname(urlPath));
    } catch {
      baseSlug = 'product-image';
    }
  }

  // Sanitize baseSlug to match asset naming convention (kebab-case)
  let sanitizedBase = baseSlug
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  if (!sanitizedBase) {
    sanitizedBase = 'product-image';
  }

  const finalFilename = `${sanitizedBase}${downloaded.ext}`;
  const finalPath = path.join(assetsImagesDir, finalFilename);

  // If file already exists, create timestamped backup in editor-backups/assets/
  if (fs.existsSync(finalPath)) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${sanitizedBase}_${timestamp}${downloaded.ext}`;
      fs.copyFileSync(finalPath, path.join(assetsBackupsDir, backupName));
    } catch {}
  }

  // Atomic write to temporary file first, then rename
  const tempPath = `${finalPath}.tmp-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, downloaded.buffer);
    fs.renameSync(tempPath, finalPath);

    // Sync to top-level assets/ directory for backward compatibility
    try {
      fs.copyFileSync(finalPath, path.join(assetsRootDir, finalFilename));
    } catch {}

    // Auto-generate WebP and thumbnail derivatives
    generateLocalAssetDerivatives(finalPath);

    // Sync derivatives to top-level assets/ directory if created
    try {
      const webpPath = path.join(assetsImagesDir, `${sanitizedBase}.webp`);
      const thumbPath = path.join(assetsImagesDir, `${sanitizedBase}-thumb.webp`);
      if (fs.existsSync(webpPath)) fs.copyFileSync(webpPath, path.join(assetsRootDir, `${sanitizedBase}.webp`));
      if (fs.existsSync(thumbPath)) fs.copyFileSync(thumbPath, path.join(assetsRootDir, `${sanitizedBase}-thumb.webp`));
    } catch {}

    const dimensions = readLocalAssetDimensions(finalPath);

    return {
      success: true,
      filename: finalFilename,
      relativePath: `assets/images/${finalFilename}`,
      publicUrl: `/assets/images/${finalFilename}`,
      nameWithoutExt: sanitizedBase,
      sourceImageUrl: bestCandidate.url,
      sourcePageUrl: fetchedData.finalUrl,
      extractionMethod: bestCandidate.source,
      dimensions,
      message: `Product image "${finalFilename}" downloaded and imported to asset library via ${bestCandidate.source}.`
    };
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    return {
      success: false,
      error: `Failed to save imported image: ${err.message}`
    };
  }
}

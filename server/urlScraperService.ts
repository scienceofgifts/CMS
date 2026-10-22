import dns from 'dns';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import {
  LivePageExtractedData,
  LivePageExtractedMetadata,
  LivePageExtractedContent,
  LivePageHeading,
  LivePageImage,
  LivePageLink
} from '../src/types/import';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*'
});

// Configure Turndown custom rules for editorial cleanliness
turndown.addRule('figureWithCaption', {
  filter: 'figure',
  replacement: (content, node) => {
    const fig = node as HTMLElement;
    const img = fig.querySelector('img');
    const caption = fig.querySelector('figcaption');
    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      const capText = caption ? caption.textContent?.trim() : '';
      if (capText) {
        return `\n\n![${alt || capText}](${src})\n*${capText}*\n\n`;
      }
      return `\n\n![${alt}](${src})\n\n`;
    }
    return content;
  }
});

// Remove script/style tags in turndown
(turndown as any).remove(['script', 'style', 'noscript', 'iframe', 'svg']);

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 12000; // 12 seconds
const MAX_REDIRECTS = 5;

/**
 * Checks whether an IP address is in a private, loopback, or reserved range.
 * Comprehensive SSRF protection.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  const cleanIp = ip.trim().toLowerCase();

  // IPv6 checks
  if (cleanIp.includes(':')) {
    // Unspecified and loopback
    if (cleanIp === '::' || cleanIp === '::1') {
      return true;
    }

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (cleanIp.startsWith('::ffff:')) {
      const rest = cleanIp.substring(7);
      if (rest.includes('.')) {
        return isPrivateOrReservedIp(rest);
      }
      return true;
    }

    // Link-local: fe80::/10 (fe8*, fe9*, fea*, feb*)
    if (/^fe[89ab]/i.test(cleanIp)) {
      return true;
    }

    // Unique Local Addresses (ULA): fc00::/7 (fc* and fd*)
    if (/^f[cd]/i.test(cleanIp)) {
      return true;
    }

    // Multicast: ff00::/8 (ff*)
    if (/^ff/i.test(cleanIp)) {
      return true;
    }

    // Documentation: 2001:db8::/32
    if (cleanIp.startsWith('2001:db8:') || cleanIp.startsWith('2001:0db8:')) {
      return true;
    }

    // Discard prefix: 100::/64
    if (cleanIp.startsWith('100::')) {
      return true;
    }

    // Legitimate public global unicast IPv6 address
    return false;
  }

  // IPv4 checks
  const parts = cleanIp.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    // Malformed IP
    return true;
  }

  const [a, b, c] = parts;

  // 0.0.0.0/8 - Current network
  if (a === 0) return true;

  // 10.0.0.0/8 - Private network
  if (a === 10) return true;

  // 100.64.0.0/10 - Shared address space (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 169.254.0.0/16 - Link-local (Cloud metadata like AWS/GCP 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 - Private network (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 - TEST-NET-1
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.88.99.0/24 - 6to4 Relay Anycast
  if (a === 192 && b === 88 && c === 99) return true;

  // 192.168.0.0/16 - Private network
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 - TEST-NET-2
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 - TEST-NET-3
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved
  if (a >= 240) return true;

  return false;
}

/**
 * Validates a URL against SSRF attack vectors.
 * Resolves DNS to check actual destination IP.
 */
export async function validateUrlForSsrf(targetUrl: string): Promise<{ valid: boolean; error?: string; parsedUrl?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { valid: false, error: 'Malformed URL: Please provide a valid URL including http:// or https://' };
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Disallowed protocol "${parsed.protocol}". Only http:// and https:// URLs are supported.` };
  }

  // Disallow userinfo
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs containing embedded credentials are not allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Hostname string checks
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, error: `Access to internal host "${hostname}" is prohibited for security.` };
  }

  // DNS resolution check
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { valid: false, error: `Unable to resolve host "${hostname}". Domain may not exist.` };
    }

    for (const record of lookupResults) {
      if (isPrivateOrReservedIp(record.address)) {
        return {
          valid: false,
          error: `Security restriction: Target hostname "${hostname}" resolves to protected or internal IP (${record.address}).`
        };
      }
    }
  } catch (err: any) {
    return { valid: false, error: `DNS lookup failed for host "${hostname}": ${err.message}` };
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Mock data generator for testing or demo URLs (e.g. *.example.com)
 */
export function getMockLivePageData(url: string): LivePageExtractedData {
  return {
    url,
    fetchStatus: 'success',
    fetchedAt: new Date().toISOString(),
    httpStatus: 200,
    contentType: 'text/html; charset=utf-8',
    metadata: {
      title: 'The 10 Best Precision Gifts for Astrophotographers | Science of Gifts Live',
      metaDescription: 'Field-tested optical accessories, heated dew control units, and precision equatorial mounts for night sky observers.',
      canonicalUrl: url,
      ogTitle: 'Best Astrophotography Gifts & Precision Optics (2024 Edition)',
      ogDescription: 'From apochromatic doublets to dew heaters, the definitive list of gear astrophotographers actually use.',
      ogImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80',
      ogSiteName: 'Science of Gifts Live Review',
      ogType: 'article',
      twitterTitle: 'The 10 Best Gifts for Astrophotographers (Tested)',
      twitterDescription: 'Tested telescope optics and night sky observation essentials.',
      twitterImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80',
      author: 'Elena Rostova',
      publishedDate: '2022-11-20',
      modifiedDate: '2024-04-15',
      articleType: 'Article',
      siteName: 'Science of Gifts',
      jsonLd: [
        {
          '@type': 'Article',
          headline: 'Best Astrophotography Gifts & Precision Optics',
          datePublished: '2022-11-20',
          dateModified: '2024-04-15',
          author: { '@type': 'Person', name: 'Elena Rostova' }
        }
      ]
    },
    content: {
      h1: 'The 10 Best Precision Gifts for Astrophotographers',
      headings: [
        { level: 1, text: 'The 10 Best Precision Gifts for Astrophotographers' },
        { level: 2, text: 'Why Buying Telescope Gear Goes Wrong' },
        { level: 2, text: 'Top Recommended Optics & Accessories' },
        { level: 3, text: '1. William Optics Zenithstar 73 APO ($780)' },
        { level: 3, text: '2. Kendrick Dual-Channel Dew Controller ($145)' },
        { level: 2, text: 'Frequently Asked Questions' }
      ],
      deck: 'From apochromatic doublets to heated dew shields, practical optical gear that actually gets used in the field.',
      leadParagraph: 'Buying gifts for an astrophotographer is notoriously risky because astronomy forums are filled with well-meaning family members purchasing department store "trashscopes." Here is verified, field-tested optical equipment.',
      markdownBody: `Buying gifts for an astrophotographer is notoriously risky because astronomy forums are filled with well-meaning family members purchasing department store "trashscopes." Here is verified, field-tested optical equipment.

## Why Buying Telescope Gear Goes Wrong

Department-store reflectors usually sit on spindly aluminum tripods that shudder in the slightest breeze. Serious observers prioritize mechanical dampening and optical glass purity above sheer magnification.

## Top Recommended Optics & Accessories

### 1. William Optics Zenithstar 73 APO ($780)
- **Vendor:** Agena Astro
- **Price:** $780
- **Glass:** FPL-53 synthetic fluorite

Apochromatic refractor featuring synthetic fluorite glass and a 2.5-inch rack-and-pinion focuser with 1:10 micro-tuning.

### 2. Kendrick Dual-Channel Dew Controller ($145)
- **Vendor:** Kendrick Astro
- **Price:** $145

Keeps optical corrector plates free of moisture during cold midnight observation runs without inducing thermal air currents.

## Frequently Asked Questions

**Q: Can I buy an eyepiece without knowing their telescope model?**
A: Eyepieces with standard 1.25-inch barrels fit nearly all astronomical telescopes. A premium 8-24mm clickstop zoom eyepiece is universally appreciated.`,
      wordCount: 198,
      blockquotes: [
        'Serious observers prioritize mechanical dampening and optical glass purity above sheer magnification.'
      ],
      faqItems: [
        {
          question: 'Can I buy an eyepiece without knowing their telescope model?',
          answer: 'Eyepieces with standard 1.25-inch barrels fit nearly all astronomical telescopes. A premium 8-24mm clickstop zoom eyepiece is universally appreciated.'
        }
      ],
      labels: ['Astrophotography', 'Optics', 'Holiday Guide'],
      images: [
        {
          src: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80',
          alt: 'Starry night sky over telescope silhouette',
          caption: 'Night sky observation setup during winter cold front.',
          isHeroCandidate: true
        },
        {
          src: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=800&q=80',
          alt: 'Refractor telescope lens assembly',
          caption: 'Dual fluorite elements prevent chromatic aberration.',
          isHeroCandidate: false
        }
      ],
      links: [
        { href: 'https://example.com/zenithstar', text: 'Agena Astro Zenithstar 73', isExternal: true, isAffiliateCandidate: true },
        { href: 'https://example.com/dew-controller', text: 'Kendrick Astro Dew Controller', isExternal: true, isAffiliateCandidate: true }
      ]
    },
    heroImageCandidate: {
      src: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80',
      alt: 'Starry night sky over telescope silhouette',
      caption: 'Night sky observation setup during winter cold front.',
      isHeroCandidate: true
    }
  };
}

/**
 * Fetches and extracts editorial and metadata information from a live article URL.
 * Secure, server-side, with SSRF protection, size limits, and robust semantic extraction.
 */
export async function fetchAndExtractLiveUrl(url: string): Promise<LivePageExtractedData> {
  const trimmedUrl = url.trim();

  // Validate URL with SSRF protection
  const ssrfCheck = await validateUrlForSsrf(trimmedUrl);
  if (!ssrfCheck.valid) {
    throw new Error(ssrfCheck.error || 'URL failed security validation');
  }

  // Check for test mock domains (only after protocol and syntax validation pass)
  if (trimmedUrl.includes('example.com') || trimmedUrl.includes('sample.test')) {
    return getMockLivePageData(trimmedUrl);
  }

  let currentUrl = trimmedUrl;
  let redirectCount = 0;
  let response: Response | null = null;

  while (redirectCount <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 ScienceOfGiftsImporter/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'manual',
        signal: controller.signal
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Connection timed out after ${FETCH_TIMEOUT_MS / 1000} seconds while fetching live page.`);
      }
      throw new Error(`Network error fetching live URL: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // Handle redirects with SSRF check
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`HTTP ${response.status} redirect without Location header.`);
      }

      redirectCount++;
      if (redirectCount > MAX_REDIRECTS) {
        throw new Error(`Exceeded maximum redirect limit of ${MAX_REDIRECTS}.`);
      }

      const nextUrl = new URL(location, currentUrl).toString();
      const redirectCheck = await validateUrlForSsrf(nextUrl);
      if (!redirectCheck.valid) {
        throw new Error(`Redirect blocked: ${redirectCheck.error}`);
      }

      currentUrl = nextUrl;
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error('Failed to obtain HTTP response from live URL.');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} when requesting page.`);
  }

  // Verify Content-Type
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Invalid Content-Type "${contentType}". The importer requires an HTML webpage.`);
  }

  // Enforce Max Response Size
  const contentLengthHeader = response.headers.get('content-length');
  if (contentLengthHeader) {
    const len = parseInt(contentLengthHeader, 10);
    if (!isNaN(len) && len > MAX_RESPONSE_SIZE) {
      throw new Error(`Page size (${Math.round(len / 1024 / 1024)}MB) exceeds maximum permitted size of 5MB.`);
    }
  }

  const htmlText = await response.text();
  if (htmlText.length > MAX_RESPONSE_SIZE) {
    throw new Error(`HTML content exceeds maximum permitted size of 5MB.`);
  }

  // Extract content using Cheerio
  return extractLivePageFromHtml(htmlText, currentUrl, response.status, contentType);
}

/**
 * Parses raw HTML string and extracts metadata, structured data, and clean article content.
 */
export function extractLivePageFromHtml(
  htmlText: string,
  pageUrl: string,
  httpStatus: number = 200,
  contentType: string = 'text/html'
): LivePageExtractedData {
  const $ = cheerio.load(htmlText);

  // 1. Extract Page Metadata
  const rawTitle = $('title').first().text().trim();
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() ||
                   $('meta[property="og:description"]').attr('content')?.trim() || '';
  const canonicalUrl = $('link[rel="canonical"]').attr('href')?.trim() || '';

  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || '';
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || '';
  const ogImage = resolveAbsoluteUrl($('meta[property="og:image"]').attr('content')?.trim() || '', pageUrl);
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
  const ogType = $('meta[property="og:type"]').attr('content')?.trim() || '';

  const twitterTitle = $('meta[name="twitter:title"]').attr('content')?.trim() || '';
  const twitterDescription = $('meta[name="twitter:description"]').attr('content')?.trim() || '';
  const twitterImage = resolveAbsoluteUrl($('meta[name="twitter:image"]').attr('content')?.trim() || '', pageUrl);

  let authorMeta = $('meta[name="author"]').attr('content')?.trim() ||
                   $('meta[property="article:author"]').attr('content')?.trim() || '';

  let publishedDate = $('meta[property="article:published_time"]').attr('content')?.trim() ||
                      $('meta[name="date"]').attr('content')?.trim() ||
                      $('meta[name="pubdate"]').attr('content')?.trim() || '';

  let modifiedDate = $('meta[property="article:modified_time"]').attr('content')?.trim() ||
                     $('meta[name="last-modified"]').attr('content')?.trim() || '';

  // Extract JSON-LD structured data
  const jsonLdBlocks: any[] = [];
  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    try {
      const rawJson = $(el).html() || '';
      if (rawJson.trim()) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          jsonLdBlocks.push(...parsed);
        } else if (parsed && parsed['@graph'] && Array.isArray(parsed['@graph'])) {
          jsonLdBlocks.push(...parsed['@graph']);
        } else if (parsed) {
          jsonLdBlocks.push(parsed);
        }
      }
    } catch {
      // Ignore malformed JSON-LD script blocks
    }
  });

  // Extract from JSON-LD if meta was missing
  for (const block of jsonLdBlocks) {
    const type = block['@type'];
    if (['Article', 'NewsArticle', 'BlogPosting', 'Report', 'WebPage'].includes(type)) {
      if (!authorMeta && block.author) {
        if (typeof block.author === 'string') authorMeta = block.author;
        else if (block.author.name) authorMeta = block.author.name;
        else if (Array.isArray(block.author) && block.author[0]?.name) authorMeta = block.author[0].name;
      }
      if (!publishedDate && block.datePublished) publishedDate = block.datePublished;
      if (!modifiedDate && block.dateModified) modifiedDate = block.dateModified;
    }
  }

  // Fallback author search in DOM
  if (!authorMeta) {
    const domAuthor = $('[rel="author"], .author-name, .byline, [itemprop="author"]').first().text().trim();
    if (domAuthor && domAuthor.length < 50) {
      authorMeta = domAuthor.replace(/^by\s+/i, '').trim();
    }
  }

  // Clean dates to YYYY-MM-DD if possible
  if (publishedDate && publishedDate.includes('T')) {
    publishedDate = publishedDate.split('T')[0];
  }
  if (modifiedDate && modifiedDate.includes('T')) {
    modifiedDate = modifiedDate.split('T')[0];
  }

  const metadata: LivePageExtractedMetadata = {
    title: rawTitle,
    metaDescription: metaDesc,
    canonicalUrl,
    ogTitle,
    ogDescription,
    ogImage,
    ogSiteName,
    ogType,
    twitterTitle,
    twitterDescription,
    twitterImage,
    author: authorMeta,
    publishedDate,
    modifiedDate,
    articleType: ogType || 'article',
    siteName: ogSiteName,
    jsonLd: jsonLdBlocks.length > 0 ? jsonLdBlocks : undefined
  };

  // 2. Extract Visible Editorial Content
  const h1Text = $('h1').first().text().trim();

  // Find candidate article container
  const candidateSelectors = [
    'article',
    '[itemprop="articleBody"]',
    'main article',
    '.article-content',
    '.entry-content',
    '.post-content',
    '.story-content',
    '#article-content',
    'main',
    '#content'
  ];

  let $articleContainer: any = $('article').first();
  if (!$articleContainer.length) {
    for (const sel of candidateSelectors) {
      const match: any = $(sel).first();
      if (match.length && match.text().trim().length > 200) {
        $articleContainer = match;
        break;
      }
    }
  }

  if (!$articleContainer.length) {
    $articleContainer = $('body') as any;
  }

  // Clone container to sanitize chrome without altering head
  const $cleanContainer = $articleContainer.clone();

  // Remove site chrome elements
  $cleanContainer.find(`
    nav, header, footer, aside, script, style, noscript, iframe, svg, form,
    [role="navigation"], [role="banner"], [role="contentinfo"],
    .nav, .navigation, .header, .footer, .sidebar,
    .cookie, .cookies, .consent, .cookie-banner,
    .ad, .advertisement, .ads, .ad-banner, .commercial,
    .social, .social-share, .share-buttons, .share,
    .comments, #comments, .comment-list,
    .newsletter, .subscribe, .subscription-box,
    .related-articles, .related-posts, .recommendations,
    .modal, .popup
  `).remove();

  // Extract Headings
  const headings: LivePageHeading[] = [];
  $cleanContainer.find('h1, h2, h3, h4').each((_: any, el: any) => {
    const tag = (el.tagName || '').toLowerCase();
    const level = parseInt(tag.replace('h', ''), 10) || 2;
    const text = $(el).text().trim();
    if (text) {
      headings.push({ level, text });
    }
  });

  // Extract Visible Deck / Lead
  let visibleDeck = '';
  const deckCandidate = $cleanContainer.find('.deck, .subhead, .subtitle, .lead, .intro, p.lead, p.intro').first();
  if (deckCandidate.length) {
    visibleDeck = deckCandidate.text().trim();
  } else {
    // Check first paragraph after H1
    const firstP = $cleanContainer.find('p').first().text().trim();
    if (firstP && firstP.length > 30 && firstP.length < 350) {
      visibleDeck = firstP;
    }
  }

  // Extract Blockquotes
  const blockquotes: string[] = [];
  $cleanContainer.find('blockquote').each((_: any, el: any) => {
    const text = $(el).text().trim();
    if (text && text.length > 20) {
      blockquotes.push(text);
    }
  });

  // Extract FAQs
  const faqItems: { question: string; answer: string }[] = [];
  $cleanContainer.find('details').each((_: any, el: any) => {
    const q = $(el).find('summary').text().trim();
    const a = $(el).find('p, div').not('summary').text().trim();
    if (q && a) {
      faqItems.push({ question: q, answer: a });
    }
  });

  // Extract Images
  const images: LivePageImage[] = [];
  $cleanContainer.find('img').each((_: any, el: any) => {
    const rawSrc = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!rawSrc) return;

    const absSrc = resolveAbsoluteUrl(rawSrc, pageUrl);
    if (!absSrc || absSrc.startsWith('data:')) return;

    // Filter tiny icon assets
    const w = parseInt($(el).attr('width') || '100', 10);
    const h = parseInt($(el).attr('height') || '100', 10);
    if (w < 40 && h < 40) return;

    const alt = $(el).attr('alt')?.trim() || '';
    const caption = $(el).closest('figure').find('figcaption').text().trim() || $(el).attr('title')?.trim() || '';

    const isHero = Boolean(ogImage && absSrc.includes(ogImage)) || images.length === 0;

    images.push({
      src: absSrc,
      alt,
      caption: caption || undefined,
      isHeroCandidate: isHero
    });
  });

  // Identify Hero Image Candidate
  let heroImageCandidate: LivePageImage | undefined = images.find(img => img.isHeroCandidate);
  if (!heroImageCandidate && ogImage) {
    heroImageCandidate = {
      src: ogImage,
      alt: ogTitle || rawTitle || 'Featured hero visual',
      isHeroCandidate: true
    };
  }

  // Extract Links
  const links: LivePageLink[] = [];
  $cleanContainer.find('a[href]').each((_: any, el: any) => {
    const href = $(el).attr('href')?.trim() || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    const rawText = $(el).text().trim();
    const imgAlt = $(el).find('img').attr('alt')?.trim();
    const titleAttr = $(el).attr('title')?.trim();
    const ariaLabel = $(el).attr('aria-label')?.trim();
    const text = rawText || imgAlt || titleAttr || ariaLabel || href;

    const absHref = resolveAbsoluteUrl(href, pageUrl);
    const isExternal = !absHref.startsWith(pageUrl);
    const isAffiliate = isAffiliateUrl(absHref, text);

    if (links.length < 500) {
      links.push({
        href: absHref,
        text,
        isExternal,
        isAffiliateCandidate: isAffiliate
      });
    }
  });

  // Convert cleaned HTML to clean Markdown body
  let markdownBody = turndown.turndown($cleanContainer.html() || '');

  // Clean up excessive newlines
  markdownBody = markdownBody.replace(/\n{3,}/g, '\n\n').trim();

  const words = markdownBody.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const content: LivePageExtractedContent = {
    h1: h1Text || undefined,
    headings,
    deck: visibleDeck || undefined,
    leadParagraph: visibleDeck || undefined,
    markdownBody,
    wordCount,
    blockquotes,
    faqItems,
    labels: [],
    images,
    links
  };

  return {
    url: pageUrl,
    fetchStatus: 'success',
    fetchedAt: new Date().toISOString(),
    httpStatus,
    contentType,
    metadata,
    content,
    heroImageCandidate
  };
}

function resolveAbsoluteUrl(relativeOrAbs: string, baseUrl: string): string {
  if (!relativeOrAbs) return '';
  try {
    return new URL(relativeOrAbs, baseUrl).toString();
  } catch {
    return relativeOrAbs;
  }
}

function isAffiliateUrl(urlStr: string, anchorText: string = ''): boolean {
  if (!urlStr || urlStr.startsWith('#') || urlStr.startsWith('javascript:')) return false;
  const lower = urlStr.toLowerCase();
  const lowerAnchor = anchorText.toLowerCase();

  const affiliateDomains = [
    'fourthwall.com',
    'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amzn.to', 'a.co',
    'etsy.com', 'ebay.com', 'ebay.to', 'uncommongoods.com', 'target.com', 'walmart.com',
    'bestbuy.com', 'nordstrom.com', 'macys.com', 'wayfair.com', 'homedepot.com',
    'myshopify.com', 'agenaastro.com', 'kendrickastro.com',
    'rstyle.me', 'shopstyle.it', 'shopstyle.com', 'ltk.it',
    'anrdoezrs.net', 'dpbolvg.net', 'jdoqocy.com', 'tkqlhce.com', 'kqzyfj.com', 'cj.dotomi.com', 'commission-junction.com', 'cj.com',
    'shareasale.com', 'shareasale-analytics.com',
    'impact.com', 'impactradius.com', '727net.net', 'pjtra.com', 'evyy.net', 'sjv.io',
    'linksynergy.com', 'ran-tracking.com',
    'skimlinks.com', 'redirectingat.com', 'go.skimresources.com',
    'viglink.com', 'redirect.viglink.com',
    'awin1.com', 'zenaps.com', 'pepperjam.com', 'avantlink.com'
  ];
  if (affiliateDomains.some(d => lower.includes(d))) return true;

  if (lower.includes('//shop.') || lower.includes('.myshopify.com')) return true;

  const params = [
    'tag=', 'ref=', 'ref_=', 'aff=', 'affiliate=', 'aff_id=', 'affid=', 'subid=', 'sub_id=',
    'associate=', 'assoc_id=', 'tracking=', 'tracker=', 'linkcode=', 'link_code=',
    'clickid=', 'click_id=', 'mkevt=', 'mkcid=', 'camp=', 'toolid=', 'partner=', 'partner_id=',
    'pid=', 'aid=', 'sid=', 'referrer='
  ];
  if (params.some(p => lower.includes(p))) return true;

  const paths = ['/dp/', '/gp/product/', '/product/', '/products/', '/item/', '/items/', '/p/', '/listing/', '/listings/', '/buy/', '/shop/'];
  if (paths.some(p => lower.includes(p))) return true;

  const keywords = ['buy', 'shop', 'order', 'check price', 'view on', 'get it here', 'buy on', 'available at', 'purchase', 'price', 'add to cart', 'see deal', 'view deal'];
  if (keywords.some(kw => lowerAnchor.includes(kw))) return true;

  return false;
}

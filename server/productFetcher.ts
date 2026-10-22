import { URL } from 'url';

export interface FetchedPageData {
  fetched: boolean;
  error?: string;
  url: string;
  title?: string;
  description?: string;
  vendor?: string;
  price?: string;
  textContent?: string;
}

/**
 * Server-side product URL research fetcher.
 * Safely retrieves HTML from a vendor or product URL, extracts metadata
 * and main article text while filtering out navigation/footer boilerplate.
 */
export async function fetchProductPage(rawUrl: string): Promise<FetchedPageData> {
  const cleanUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  if (!cleanUrl) {
    return { fetched: false, error: 'No product URL provided.', url: '' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(cleanUrl);
  } catch {
    return { fetched: false, error: 'Invalid URL format.', url: cleanUrl };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { fetched: false, error: 'Only HTTP and HTTPS URLs are supported.', url: cleanUrl };
  }

  // Prevent local network/private IP SSRF if applicable
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    return { fetched: false, error: 'Internal network URLs are restricted.', url: cleanUrl };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ScienceOfGiftsProductResearcher/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        fetched: false,
        error: `Product page returned HTTP ${response.status} (${response.statusText}).`,
        url: cleanUrl
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {
        fetched: false,
        error: `Unexpected content type (${contentType}). HTML page expected.`,
        url: cleanUrl
      };
    }

    // Limit maximum read size (max 1 MB)
    const rawHtml = await response.text();
    const truncatedHtml = (rawHtml || '').slice(0, 1024 * 1024);

    // Parse Meta Tags & Title
    const titleMatch = truncatedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitleMatch = truncatedHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const ogDescMatch = truncatedHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const descMatch = truncatedHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogVendorMatch = truncatedHtml.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    const ogPriceMatch = truncatedHtml.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i);

    const title = decodeHtmlEntities((ogTitleMatch?.[1] || titleMatch?.[1] || '').trim());
    const description = decodeHtmlEntities((ogDescMatch?.[1] || descMatch?.[1] || '').trim());
    const vendor = decodeHtmlEntities((ogVendorMatch?.[1] || '').trim());
    const price = decodeHtmlEntities((ogPriceMatch?.[1] || '').trim());

    // Extract main body text and clean boilerplate
    let cleanText = truncatedHtml;
    // Strip scripts, styles, header, footer, nav, svg, comments
    cleanText = cleanText.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    cleanText = cleanText.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    cleanText = cleanText.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    cleanText = cleanText.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
    cleanText = cleanText.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
    cleanText = cleanText.replace(/<header[\s\S]*?<\/header>/gi, ' ');
    cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, ' ');
    // Strip remaining tags
    cleanText = cleanText.replace(/<[^>]+>/g, ' ');
    cleanText = decodeHtmlEntities(cleanText);
    // Normalize whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    // Truncate to reasonable token length (~3500 chars)
    const textContent = cleanText.slice(0, 3500);

    return {
      fetched: true,
      url: cleanUrl,
      title,
      description,
      vendor,
      price,
      textContent
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { fetched: false, error: 'Product URL request timed out after 8 seconds.', url: cleanUrl };
    }
    return { fetched: false, error: `Failed to retrieve product URL: ${err.message}`, url: cleanUrl };
  }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

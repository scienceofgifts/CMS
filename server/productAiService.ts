import { GoogleGenAI, Type } from '@google/genai';
import { Product, TaxonomyOptions, ProductAiOperation, ProductAiResponse, ProductAiSourcesStatus } from '../src/types/product';
import { fetchProductPage, FetchedPageData } from './productFetcher';
import { resolveProductImageBase64, ResolvedImageResult } from './productImageResolver';

export interface ProductAiOperationParams {
  operation: ProductAiOperation;
  product: Product;
  taxonomies: TaxonomyOptions;
  fetchedUrlData?: FetchedPageData;
  imageData?: ResolvedImageResult;
  researchContext?: any;
  forceRefresh?: boolean;
  jekyllRoot?: string;
}

/**
 * Product AI Service
 * Communicates server-side with Gemini 3.8 Flash using @google/genai SDK.
 * Analyzes product visual evidence, URL source research, and CMS metadata.
 */
export async function executeProductAiOperation(params: ProductAiOperationParams): Promise<ProductAiResponse> {
  const { operation, product, taxonomies } = params || {};

  if (!product || typeof product !== 'object') {
    return {
      success: false,
      error: 'Product data object is required.',
      sources: {
        urlFetched: false,
        imageAnalyzed: false
      }
    };
  }

  // 1. Ensure fetchedUrlData exists and is safely resolved if not provided
  let fetchedUrlData: FetchedPageData = params?.fetchedUrlData as FetchedPageData;
  if (!fetchedUrlData || typeof fetchedUrlData !== 'object' || typeof fetchedUrlData.fetched !== 'boolean') {
    const vendorUrl = String(product?.vendorUrl || '').trim();
    if (vendorUrl) {
      try {
        fetchedUrlData = await fetchProductPage(vendorUrl);
      } catch (err: any) {
        fetchedUrlData = {
          fetched: false,
          error: `URL research error: ${err.message}`,
          url: vendorUrl
        };
      }
    } else {
      fetchedUrlData = {
        fetched: false,
        error: 'No product URL provided.',
        url: ''
      };
    }
  }

  // Guarantee well-formed fallback if fetchProductPage returned unexpected structure
  if (!fetchedUrlData || typeof fetchedUrlData.fetched !== 'boolean') {
    fetchedUrlData = {
      fetched: false,
      error: 'URL research unavailable.',
      url: String(product?.vendorUrl || '')
    };
  }

  // 2. Ensure imageData exists and is safely resolved if not provided
  let imageData: ResolvedImageResult = params?.imageData as ResolvedImageResult;
  if (!imageData || typeof imageData !== 'object' || typeof imageData.found !== 'boolean') {
    const imageRef = String(product?.image || product?.imageType || product?.id || '').trim();
    try {
      imageData = resolveProductImageBase64(imageRef, params?.jekyllRoot || process.env.JEKYLL_DIR);
    } catch (err: any) {
      imageData = {
        found: false,
        error: `Image resolution error: ${err.message}`
      };
    }
  }

  if (!imageData || typeof imageData.found !== 'boolean') {
    imageData = {
      found: false
    };
  }

  // Construct source status
  const sourcesStatus: ProductAiSourcesStatus = {
    urlFetched: Boolean(fetchedUrlData.fetched),
    urlError: fetchedUrlData.error || null,
    imageAnalyzed: Boolean(imageData.found),
    imageError: imageData.error || null,
    imagePath: imageData.filename || null,
    productUrl: product?.vendorUrl || null,
    cmsDataAvailable: Boolean(product && (product.id || product.title))
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server. Please configure your API key in Settings > Secrets.',
      sources: sourcesStatus
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  // Log the visual and source inputs for strict server-side verification
  console.log(`[Product AI Request] Operation: "${operation}"`);
  console.log(`[Product AI Request] Image resolution result: found=${imageData.found}, filename=${imageData.filename || 'none'}, mimeType=${imageData.mimeType || 'none'}, base64Length=${imageData.base64 ? imageData.base64.length : 0}`);
  console.log(`[Product AI Request] URL fetch result: fetched=${fetchedUrlData.fetched}${fetchedUrlData.error ? `, failureReason=${fetchedUrlData.error}` : ''}`);

  // Build prompt parts
  const promptParts: any[] = [];

  // Add Image Part if available for multimodal analysis
  if (imageData.found && imageData.base64 && imageData.mimeType) {
    promptParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64
      }
    });
  }

  // Build Context Text
  let contextText = `=== CMS PRODUCT METADATA ===\n`;
  contextText += `ID/Slug: ${product.id || 'N/A'}\n`;
  contextText += `Current Title: ${product.title || 'N/A'}\n`;
  contextText += `Vendor: ${product.vendor || 'N/A'}\n`;
  contextText += `Vendor URL: ${product.vendorUrl || 'N/A'}\n`;
  contextText += `Price: ${product.price || '$' + product.priceNumber || 'N/A'}\n`;
  contextText += `Category: ${product.category || 'N/A'}\n`;
  contextText += `Badge Label: ${product.badgeLabel || 'None'}\n`;
  contextText += `Existing Editorial Review: ${product.editorialReview || 'Empty'}\n`;
  contextText += `Existing Why Great Gift: ${product.whyItMakesAGreatGift || 'Empty'}\n`;
  contextText += `Existing Ideal For: ${product.idealFor || 'Empty'}\n`;
  contextText += `Existing What Stand Out: ${product.whatMakesItStandOut || 'Empty'}\n`;
  contextText += `Existing Things To Consider: ${product.thingsToConsider || 'Empty'}\n`;
  contextText += `Existing Tagline: ${product.tagline || 'Empty'}\n`;
  contextText += `Existing Specs: ${JSON.stringify(product.specs || [])}\n\n`;

  if (fetchedUrlData.fetched) {
    contextText += `=== VERIFIED PRODUCT URL SOURCE RESEARCH ===\n`;
    contextText += `Page Title: ${fetchedUrlData.title || 'N/A'}\n`;
    contextText += `Meta Description: ${fetchedUrlData.description || 'N/A'}\n`;
    if (fetchedUrlData.price) contextText += `Extracted Price: ${fetchedUrlData.price}\n`;
    if (fetchedUrlData.vendor) contextText += `Extracted Vendor: ${fetchedUrlData.vendor}\n`;
    contextText += `Page Text Snippet:\n${fetchedUrlData.textContent || 'N/A'}\n\n`;
  } else {
    contextText += `=== PRODUCT URL SOURCE RESEARCH STATUS ===\n`;
    contextText += `URL Fetch Status: Failed or Not Provided (${fetchedUrlData.error || 'No URL'}). Base analysis strictly on image evidence and CMS metadata.\n\n`;
  }

  contextText += `=== ALLOWED CMS TAXONOMY CONSTRAINTS ===\n`;
  contextText += `Recipients: ${JSON.stringify(taxonomies.recipients || [])}\n`;
  contextText += `Interests: ${JSON.stringify(taxonomies.interests || [])}\n`;
  contextText += `Occasions: ${JSON.stringify(taxonomies.occasions || [])}\n`;
  contextText += `Age Ranges: ${JSON.stringify(taxonomies.ageRanges || [])}\n`;
  contextText += `Personality Styles: ${JSON.stringify(taxonomies.personalityStyles || [])}\n\n`;

  contextText += `=== REQUESTED OPERATION ===\n`;
  contextText += `Operation: "${operation}"\n\n`;

  contextText += `Produce structured JSON according to the requested operation details:
- For "suggest_title": Provide 3 to 4 distinct, elegant, precise title suggestions with concise editorial reasoning. Avoid vendor hype, SEO keyword stuffing, or excessive length.
- For "editorial_review": Provide an insightful, original, 2-4 sentence human editorial recommendation describing what is interesting about the object, its design balance, and why it belongs in a curated gift guide. Do NOT copy vendor marketing prose.
- For "why_it_makes_a_great_gift": Provide 1-2 sentences highlighting why it makes a memorable gift (usefulness, craftsmanship, tactile charm).
- For "ideal_for": Provide a concise target recipient/use-case phrase (e.g. "Anyone who reads while writing, eating, or studying.").
- For "what_makes_it_stand_out": Highlight 1-2 verified differentiating physical or design features (material, construction, unusual design).
- For "things_to_consider": Identify legitimate physical/practical caveats (e.g., heavier than expected, requires particular desk setup, niche appeal) supported by verified facts. If no caveat is supported, explicitly state "No major physical or design caveats identified from available evidence."
- For "suggest_tagline": Provide 1 short, evocative editorial tagline (6-12 words).
- For "suggest_taxonomy": Select matching items STRICTLY from the ALLOWED CMS TAXONOMY lists. Provide a brief reason for each suggested tag. Do NOT invent new tags outside the lists.
- For "analyze_product": Provide comprehensive analysis including product identification (verifying actual product name and type), verified facts, visual observations, editorial opportunities, uncertainties/discrepancies, AND provide candidate field suggestions for titles, editorial review, why it makes a great gift, ideal for, stand out, things to consider, tagline, and taxonomy.
`;

  promptParts.push({ text: contextText });

  const systemInstruction = `You are an expert editorial curator for "Science of Gifts", a discerning publication dedicated to thoughtful, well-designed material-culture gift recommendations.

CRITICAL PRODUCT IDENTIFICATION RULE:
- The existing CMS product title and other CMS fields may be stale, placeholder data, or leftover information from another product. Treat them as secondary context, NOT proof of identity.
- Resolve conflicts using stronger evidence. Do NOT let a stale or leftover CMS title dominate your understanding of the product.
- For product identification, prioritize evidence in this exact order:
  1. Product image (multimodal visual proof of what the product actually is)
  2. URL/page evidence (evidence from the fetched vendor page data)
  3. URL slug / ID (which often contains clues, e.g. "himym-tshirt")
  4. Visible text/design in the image (inspect wording, logos, characters, print)
  5. Product page information
  6. Existing CMS data (treat as lowest priority)

- For apparel, clothing, or graphic-print images, specifically inspect:
  - visible wording / text printed on the garment
  - logos, icons, characters, pop-culture/show/movie/franchise references (e.g., "How I Met Your Mother" / "HIMYM", blue horn, yellow umbrella, Barney, etc.)
  - graphic design style
  - garment type (T-shirt, hoodie, sweatshirt, etc.)
  - other identifying visual evidence.
  If the visual evidence shows a T-shirt with HIMYM-related design but the CMS title says "Craighill Cast Solid Brass Desk Page Anchor", identify the product as the HIMYM T-shirt and ignore the stale CMS title completely. Mention this discrepancy in your uncertainties/conflicts analysis.

CRITICAL CONSTRAINTS:
1. Distinguish strictly between VERIFIED FACTS (materials, dimensions, vendor, price, actual mechanics) and EDITORIAL INTERPRETATION.
2. Never invent or hallucinate facts (such as unsupported specs, fake origins, or non-existent features).
3. Do NOT copy vendor marketing hype, cliché AI jargon (e.g., "perfect gift for anyone"), or exaggerated superlatives.
4. For TAXONOMY suggestions: You MUST ONLY pick values that strictly exist in the provided CMS Taxonomy list. Do NOT invent new taxonomy terms.
5. For "Things to Consider": Identify legitimate caveats supported by verified information. Never invent fake disadvantages.
6. Provide output strictly as a JSON object matching the expected schema.`;

  try {
    const reqPayload = {
      contents: { parts: promptParts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ['value', 'reason']
              }
            },
            editorialReview: { type: Type.STRING },
            whyItMakesAGreatGift: { type: Type.STRING },
            idealFor: { type: Type.STRING },
            whatMakesItStandOut: { type: Type.STRING },
            thingsToConsider: { type: Type.STRING },
            tagline: { type: Type.STRING },
            taxonomy: {
              type: Type.OBJECT,
              properties: {
                recipients: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['value', 'reason']
                  }
                },
                interests: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['value', 'reason']
                  }
                },
                occasions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['value', 'reason']
                  }
                },
                ageRanges: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['value', 'reason']
                  }
                },
                personalityStyles: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      value: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['value', 'reason']
                  }
                }
              }
            },
            analysis: {
              type: Type.OBJECT,
              properties: {
                productIdentification: { type: Type.STRING },
                verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
                visualObservations: { type: Type.ARRAY, items: { type: Type.STRING } },
                editorialOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                uncertainties: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    };

    let response;
    let lastError: any = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        response = await ai.models.generateContent({
          ...reqPayload,
          model: 'gemini-3.5-flash-lite'
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('high demand');
        if (isTransient && attempt < 4) {
          const delay = attempt * 1500;
          console.warn(`[Product AI Service] Attempt ${attempt} hit transient upstream load. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to obtain AI response from Gemini model.');
    }

    let rawJsonText = (response.text || '{}').trim();
    if (rawJsonText.startsWith('```')) {
      rawJsonText = rawJsonText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawJsonText);
    } catch (parseErr: any) {
      console.error('Gemini JSON parse error:', parseErr?.message, 'Raw response:', response.text);
      return {
        success: false,
        error: 'Failed to parse structured JSON response from Gemini model.',
        sources: sourcesStatus
      };
    }

    // STRICT SERVER-SIDE TAXONOMY VALIDATION
    if (parsed.taxonomy) {
      parsed.taxonomy.recipients = filterValidTaxonomy(parsed.taxonomy.recipients, taxonomies.recipients);
      parsed.taxonomy.interests = filterValidTaxonomy(parsed.taxonomy.interests, taxonomies.interests);
      parsed.taxonomy.occasions = filterValidTaxonomy(parsed.taxonomy.occasions, taxonomies.occasions);
      parsed.taxonomy.ageRanges = filterValidTaxonomy(parsed.taxonomy.ageRanges, taxonomies.ageRanges);
      parsed.taxonomy.personalityStyles = filterValidTaxonomy(parsed.taxonomy.personalityStyles, taxonomies.personalityStyles);
    }

    return {
      success: true,
      sources: sourcesStatus,
      suggestions: parsed
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Gemini Product AI processing error: ${err.message}`,
      sources: sourcesStatus
    };
  }
}

/**
 * Validates that every suggested taxonomy value strictly exists in the CMS allowed taxonomy array.
 */
function filterValidTaxonomy(
  suggestedItems: any[] | undefined,
  allowedList: string[] | undefined
): any[] {
  if (!Array.isArray(suggestedItems) || !Array.isArray(allowedList)) return [];
  const allowedSet = new Set(allowedList.map(item => item.toLowerCase().trim()));
  return suggestedItems.filter(item => item && item.value && allowedSet.has(String(item.value).toLowerCase().trim()));
}

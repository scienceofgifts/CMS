import { GoogleGenAI, Type } from '@google/genai';
import { GiftGuideFrontMatter } from '../src/types/guide';
import { GuideAiOperation, GuideAiResponse, GuideAiSourcesStatus } from '../src/types/guideAi';
import { getAiSettings } from './aiSettingsService';
import { CatalogItemRef } from './articleAiService';

export interface GuideAiOperationParams {
  operation: GuideAiOperation;
  guide: {
    frontMatter: GiftGuideFrontMatter;
    body: string;
  };
  availableCatalog?: CatalogItemRef[];
}

/**
 * Gift Guide AI Service
 * Communicates server-side with Gemini 3.8 Flash using @google/genai SDK.
 * Contextually analyzes gift curation, product assortment, ordering, SEO, and real internal link opportunities.
 */
export async function executeGuideAiOperation(params: GuideAiOperationParams): Promise<GuideAiResponse> {
  const { operation, guide, availableCatalog = [] } = params || {};

  if (!guide || !guide.frontMatter) {
    return {
      success: false,
      error: 'Valid guide object and frontMatter are required.'
    };
  }

  const fm = guide.frontMatter;
  const bodyText = (guide.body || '').trim();

  // Aggregate all included products from editorsPick, quickPicks, and budgetSections
  const includedProducts: Array<{
    title: string;
    price?: string;
    vendor?: string;
    section: string;
    description?: string;
  }> = [];

  if (fm.editorsPick) {
    includedProducts.push({
      title: fm.editorsPick.title || fm.editorsPick.name || 'Editor\'s Pick',
      price: fm.editorsPick.price,
      vendor: fm.editorsPick.vendor,
      section: "Editor's Pick",
      description: fm.editorsPick.description || fm.editorsPick.whyPick
    });
  }

  if (Array.isArray(fm.quickPicks)) {
    fm.quickPicks.forEach((qp: any, i: number) => {
      includedProducts.push({
        title: qp.title || qp.name || `Quick Pick #${i + 1}`,
        price: qp.price,
        vendor: qp.vendor,
        section: 'Quick Picks',
        description: qp.description || qp.badge
      });
    });
  }

  if (Array.isArray(fm.budgetSections)) {
    fm.budgetSections.forEach((bs: any) => {
      if (Array.isArray(bs.products)) {
        bs.products.forEach((p: any) => {
          includedProducts.push({
            title: p.title || p.name || 'Product',
            price: p.price,
            vendor: p.vendor,
            section: bs.title || 'Budget Section',
            description: p.description || p.whyPick
          });
        });
      }
    });
  }

  const sourcesStatus: GuideAiSourcesStatus = {
    productCount: includedProducts.length,
    hasIntroDeck: Boolean(fm.deck && fm.deck.trim()),
    hasCuratorialRules: Boolean(Array.isArray(fm.howToPick?.rules) && fm.howToPick.rules.length > 0),
    hasAvoidList: Boolean(Array.isArray(fm.whatToAvoid?.items) && fm.whatToAvoid.items.length > 0),
    availableCatalogUrlsCount: availableCatalog.length
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

  const aiSettings = await getAiSettings();

  // Build Context Text
  let contextText = `=== GIFT GUIDE CONTEXT ===\n`;
  contextText += `Title: ${fm.title || 'Untitled'}\n`;
  contextText += `Slug: ${fm.slug || 'N/A'}\n`;
  contextText += `Category: ${fm.category || 'General'}\n`;
  contextText += `Deck / Subtitle: ${fm.deck || 'None'}\n`;
  contextText += `Read Time: ${fm.readTime || 'N/A'}\n`;
  contextText += `Author: ${fm.author?.name || 'Clara Vance'} (${fm.author?.role || 'Lead Researcher'})\n`;
  contextText += `Published Date: ${fm.publishedDate || 'N/A'}\n`;
  contextText += `Last Modified Date: ${fm.lastModifiedDate || 'N/A'}\n`;
  contextText += `Hero Image: ${fm.heroImageType || fm.image || 'None'}\n`;
  contextText += `Related Guide Slugs: ${JSON.stringify(fm.relatedGuideSlugs || [])}\n\n`;

  contextText += `=== CURATORIAL RULES & CRITERIA (HOW TO PICK) ===\n`;
  contextText += `Principles Title: ${fm.howToPick?.title || 'None'}\n`;
  contextText += `Principles Description: ${fm.howToPick?.content || 'None'}\n`;
  contextText += `Rules: ${JSON.stringify(fm.howToPick?.rules || [])}\n\n`;

  contextText += `=== PITFALLS & WHAT TO AVOID ===\n`;
  contextText += `Avoid Title: ${fm.whatToAvoid?.title || 'None'}\n`;
  contextText += `Avoid Summary: ${fm.whatToAvoid?.summary || 'None'}\n`;
  contextText += `Avoid Items: ${JSON.stringify(fm.whatToAvoid?.items || [])}\n\n`;

  contextText += `=== CURATED PRODUCTS INCLUDED (${includedProducts.length} items) ===\n`;
  if (includedProducts.length === 0) {
    contextText += `(No products added yet)\n\n`;
  } else {
    includedProducts.forEach((p, idx) => {
      contextText += `${idx + 1}. [${p.section}] ${p.title} | Price: ${p.price || 'N/A'} | Vendor: ${p.vendor || 'N/A'} | Notes: ${p.description || 'None'}\n`;
    });
    contextText += `\n`;
  }

  contextText += `=== GUIDE NARRATIVE BODY CONTENT (MARKDOWN) ===\n`;
  contextText += `${bodyText || '(Guide body narrative is currently empty)'}\n\n`;

  if (availableCatalog.length > 0) {
    contextText += `=== REAL EXISTING CMS CATALOG URLS (ONLY RECOMMEND LINKS FROM THIS VERIFIED LIST) ===\n`;
    contextText += availableCatalog
      .slice(0, 80)
      .map(c => `- [${c.type.toUpperCase()}] "${c.title}": ${c.url}`)
      .join('\n');
    contextText += `\n\n`;
  }

  contextText += `=== REQUESTED OPERATION ===\n`;
  contextText += `Operation: "${operation}"\n\n`;

  contextText += `Produce structured JSON according to the requested operation:
- For "suggest_title": Generate 3 to 5 distinct, high-converting yet tasteful guide title suggestions (e.g., "The Best Gifts for Coffee Enthusiasts (That They Won't Already Own)"). Provide concise editorial reasoning.
- For "suggest_deck": Generate 3 to 5 concise guide subtitle / deck options (1-2 sentences) summarizing who the guide is for and its curatorial focus.
- For "suggest_intro": Suggest an improved introduction (2-3 paragraphs) that frames the gift challenge, establishes the curatorial philosophy, and primes the reader for the assortment.
- For "improve_copy": Provide 3 to 5 specific editorial improvements for sections (curatorial principles, mistakes to avoid, product commentary, or transitions).
- For "product_ordering": Analyze the progression of products across price, variety, wow-factor, and recipient fit. Critique the current flow and recommend an optimized sequence with clear rationales.
- For "seo_analysis": Provide an objective SEO critique analyzing search intent, recipient query targeting, heading hierarchy, commercial vs editorial balance, and keyword coverage.
- For "internal_linking": Recommend 3 to 6 high-value internal links drawn STRICTLY from the provided REAL EXISTING CMS CATALOG list. Provide target URL, target title, natural anchor text, placement context snippet, and why it enriches the guide. Never invent URLs.
- For "analyze_guide": Provide comprehensive analysis including search intent, audience, editorial quality, organization, product relevance, coverage gaps, SEO issues, internal link opportunities, AND provide candidate suggestions for titles, decks, intro, copy improvements, product ordering, SEO analysis, and internal links.
`;

  const systemInstruction = `${aiSettings.globalInstructions || 'You are an AI editorial assistant for Science of Gifts, a curated gift publication.'}

${aiSettings.guideWritingInstructions || `Apply Science of Gifts curation standards:
- Cohesive curatorial narrative tailored to specific recipient psychology, interests, or occasions.
- High editorial standards: select items for tactile charm, utility, durability, and craftsmanship.
- Provide transparent curatorial principles and highlight common mistakes to avoid.
- Balance price tiers meaningfully without compromising aesthetic or functional integrity.`}

STRICT CONSTRAINTS:
1. Base all analysis and suggestions directly on the provided guide and product assortment. Never invent unsupported product specs.
2. For Internal Linking: You MUST ONLY recommend links from the provided list of REAL EXISTING CMS CATALOG URLs. NEVER fabricate or assume URLs not present in the verified list.
3. Keep the tone discerning, helpful, and elevated.
4. Output strictly valid JSON matching the schema.`;

  try {
    let response;
    let lastError: any = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        response = await ai.models.generateContent({
          contents: { parts: [{ text: contextText }] },
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
                decks: {
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
                improvedIntro: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ['text', 'explanation']
                },
                copyImprovements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      section: { type: Type.STRING },
                      critique: { type: Type.STRING },
                      suggestion: { type: Type.STRING }
                    },
                    required: ['section', 'critique', 'suggestion']
                  }
                },
                productOrdering: {
                  type: Type.OBJECT,
                  properties: {
                    currentFlowCritique: { type: Type.STRING },
                    suggestedSequence: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          productName: { type: Type.STRING },
                          recommendedPosition: { type: Type.NUMBER },
                          rationale: { type: Type.STRING }
                        },
                        required: ['productName', 'recommendedPosition', 'rationale']
                      }
                    }
                  }
                },
                seoAnalysis: {
                  type: Type.OBJECT,
                  properties: {
                    searchIntent: { type: Type.STRING },
                    targetAudience: { type: Type.STRING },
                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                    headingStructureAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keywordCoverageAdvice: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                },
                internalLinks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      targetUrl: { type: Type.STRING },
                      targetTitle: { type: Type.STRING },
                      suggestedAnchor: { type: Type.STRING },
                      placementContext: { type: Type.STRING },
                      reason: { type: Type.STRING }
                    },
                    required: ['targetUrl', 'targetTitle', 'suggestedAnchor', 'placementContext', 'reason']
                  }
                },
                analysis: {
                  type: Type.OBJECT,
                  properties: {
                    searchIntent: { type: Type.STRING },
                    audience: { type: Type.STRING },
                    editorialQuality: { type: Type.STRING },
                    organization: { type: Type.STRING },
                    productRelevance: { type: Type.ARRAY, items: { type: Type.STRING } },
                    coverageGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    seoIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    internalLinkOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            }
          },
          model: 'gemini-3.5-flash-lite'
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('high demand');
        if (isTransient && attempt < 4) {
          const delay = attempt * 1500;
          console.warn(`[Gift Guide AI Service] Attempt ${attempt} hit transient upstream load. Retrying in ${delay}ms...`);
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

    const parsed = JSON.parse(rawJsonText);

    return {
      success: true,
      sources: sourcesStatus,
      suggestions: parsed
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Gift Guide AI processing error: ${err.message}`,
      sources: sourcesStatus
    };
  }
}

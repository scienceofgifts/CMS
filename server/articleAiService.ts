import { GoogleGenAI, Type } from '@google/genai';
import { ArticleFrontMatter } from '../src/types/articles';
import { ArticleAiOperation, ArticleAiResponse, ArticleAiSourcesStatus } from '../src/types/articleAi';
import { getAiSettings } from './aiSettingsService';

export interface CatalogItemRef {
  url: string;
  title: string;
  type: 'article' | 'guide' | 'product';
  category?: string;
  slug?: string;
}

export interface ArticleAiOperationParams {
  operation: ArticleAiOperation;
  article: {
    frontMatter: ArticleFrontMatter;
    body: string;
  };
  availableCatalog?: CatalogItemRef[];
}

/**
 * Article AI Service
 * Communicates server-side with Gemini 3.8 Flash using @google/genai SDK.
 * Contextually analyzes essay structure, titles, decks, SEO, and real internal link opportunities.
 */
export async function executeArticleAiOperation(params: ArticleAiOperationParams): Promise<ArticleAiResponse> {
  const { operation, article, availableCatalog = [] } = params || {};

  if (!article || !article.frontMatter) {
    return {
      success: false,
      error: 'Valid article object and frontMatter are required.'
    };
  }

  const fm = article.frontMatter;
  const bodyText = (article.body || '').trim();

  const sourcesStatus: ArticleAiSourcesStatus = {
    articleLength: bodyText.length,
    hasExistingDeck: Boolean(fm.deck && fm.deck.trim()),
    hasCitations: Boolean(Array.isArray(fm.sources) && fm.sources.length > 0),
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
  let contextText = `=== ARTICLE ESSAY CONTEXT ===\n`;
  contextText += `Title: ${fm.title || 'Untitled'}\n`;
  contextText += `Slug: ${fm.slug || 'N/A'}\n`;
  contextText += `Category: ${fm.category || 'Gift Psychology'}\n`;
  contextText += `Deck / Subtitle: ${fm.deck || 'None'}\n`;
  contextText += `Read Time: ${fm.readTime || 'N/A'}\n`;
  contextText += `Author: ${fm.author?.name || 'Clara Vance'} (${fm.author?.role || 'Contributing Psychology Editor'})\n`;
  contextText += `Published Date: ${fm.publishedDate || 'N/A'}\n`;
  contextText += `Last Modified Date: ${fm.lastModifiedDate || 'N/A'}\n`;
  contextText += `Hero Image: ${fm.heroImageType || fm.image || 'None'}\n`;
  contextText += `Related Guide Slug: ${fm.relatedGuideSlug || 'None'}\n`;
  contextText += `Related Article Slugs: ${JSON.stringify(fm.relatedArticleSlugs || [])}\n`;
  contextText += `Existing Citations/Sources: ${JSON.stringify(fm.sources || [])}\n\n`;

  contextText += `=== ARTICLE FULL BODY CONTENT (MARKDOWN) ===\n`;
  contextText += `${bodyText || '(Article body is currently empty)'}\n\n`;

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
- For "suggest_title": Generate 3 to 5 distinct, compelling, editorial titles that accurately capture the article's core thesis without clickbait or keyword stuffing. Provide a concise editorial reasoning for each.
- For "suggest_deck": Generate 3 to 5 concise, eloquent meta description / subtitle deck options (1-2 sentences) summarizing the key insight.
- For "improve_intro": Suggest an improved introduction (2-4 paragraphs) that hooks the reader, clearly frames the material-culture or psychological puzzle, and leads naturally into the body. Include explanation.
- For "improve_article": Provide 3 to 5 actionable editorial improvement recommendations for specific sections (weak arguments, transitions, pacing, readability, or examples).
- For "seo_analysis": Provide an objective SEO critique analyzing search intent, target audience, content strengths, weaknesses, heading hierarchy advice, and topical/keyword coverage notes.
- For "internal_linking": Recommend 3 to 6 high-value internal links drawn STRICTLY from the provided REAL EXISTING CMS CATALOG list. Provide exact target URL, target title, natural anchor text, placement context snippet, and why it enriches the article. Never invent URLs.
- For "analyze_article": Provide comprehensive analysis including primary topic, search intent, target audience, content strengths, weaknesses, missing opportunities, SEO issues, title/deck issues, readability notes, AND provide candidate suggestions for titles, decks, improved intro, editorial improvements, SEO analysis, and internal links.
`;

  const systemInstruction = `${aiSettings.globalInstructions || 'You are an AI editorial assistant for Science of Gifts, a curated gift publication.'}

${aiSettings.articleWritingInstructions || `Apply Science of Gifts editorial standards:
- Intellectual depth, cultural anthropology, behavioral economics, and material culture nuance.
- Clear, engaging thesis that unpacks the psychology, etiquette, and philosophy of gift giving.
- Restrained, sophisticated vocabulary; avoid hype, sensationalism, and generic SEO filler.`}

STRICT CONSTRAINTS:
1. Base all analysis and suggestions directly on the provided article content. Never hallucinate unsupported claims.
2. For Internal Linking: You MUST ONLY recommend links from the provided list of REAL EXISTING CMS CATALOG URLs. NEVER fabricate, invent, or assume URLs that are not explicitly present in the verified list.
3. Keep the tone discerning, intellectually rigorous, and editorially elevated.
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
                editorialImprovements: {
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
                    primaryTopic: { type: Type.STRING },
                    searchIntent: { type: Type.STRING },
                    targetAudience: { type: Type.STRING },
                    contentStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                    contentWeaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                    missingOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                    seoIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    titleIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    deckIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
                    readabilityNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
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
          console.warn(`[Article AI Service] Attempt ${attempt} hit transient upstream load. Retrying in ${delay}ms...`);
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
      error: `Article AI processing error: ${err.message}`,
      sources: sourcesStatus
    };
  }
}

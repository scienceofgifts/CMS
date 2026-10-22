import { GoogleGenAI, Type } from '@google/genai';
import { ImportAnalysisResult, ImportTargetType } from '../src/types/import';
import { getAiSettings } from './aiSettingsService';
import { getKnownCategories } from './importService';

export interface AiImportEnhancementParams {
  rawContent: string;
  filename: string;
  currentAnalysis: ImportAnalysisResult;
}

export interface AiImportEnhancementResponse {
  success: boolean;
  aiAssisted: boolean;
  refinedAnalysis?: ImportAnalysisResult;
  error?: string;
}

/**
 * AI Service for Migration & Import Analysis
 * Uses Gemini (via @google/genai SDK) to intelligently assess unstructured legacy Markdown,
 * suggest SEO titles (search-title), SEO meta descriptions (seo-description), category taxonomy alignment,
 * and provide editorial critique.
 */
export async function executeImportAiAnalysis(params: AiImportEnhancementParams): Promise<AiImportEnhancementResponse> {
  const { rawContent, filename, currentAnalysis } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      success: true,
      aiAssisted: false,
      error: 'GEMINI_API_KEY is not configured on the server. Utilizing rule-based heuristic import engine.',
      refinedAnalysis: currentAnalysis
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
  const knownCategories = getKnownCategories();
  const categoriesList = [...new Set([...knownCategories.guides, ...knownCategories.articles])].join(', ');

  const currentFm = currentAnalysis.mappedFrontMatter || {};
  const currentTitle = currentFm.title || filename;
  const currentDeck = currentFm.deck || '';
  const currentType = currentAnalysis.detectedType;

  const promptText = `=== MIGRATION IMPORT ANALYSIS TASK ===
You are an expert editorial archivist and SEO strategist for "Science of Gifts", a publication celebrated for intellectual depth, material culture, and discerning curation.

Analyze this legacy Markdown document being imported into the CMS:
Filename: ${filename}
Detected Target Type: ${currentType}
Current Title: ${currentTitle}
Current Deck: ${currentDeck}
Available Site Taxonomy Categories: ${categoriesList}

--- RAW DOCUMENT CONTENT ---
${rawContent.slice(0, 8000)}
--- END CONTENT ---

Provide an intelligent structured analysis to modernize this legacy document for Science of Gifts:
1. Verify if content type is "guide" (product gift recommendations), "article" (psychological/cultural essay), or "page" (static page).
2. Generate an optimized "searchTitle" (SEO/browser title, under 60 characters, compelling for Google search without clickbait).
3. Generate an optimized "seoDescription" (SEO meta description, 120-155 characters, summarizes core insight or gift thesis).
4. Recommend the best matching category from our verified taxonomy: [${categoriesList}].
5. Provide 2 to 4 actionable editorial observations regarding content quality, missing sections, formatting, or taxonomy.`;

  const systemInstruction = `${aiSettings.globalInstructions || 'You are an AI editorial assistant for Science of Gifts.'}
Ensure the tone is erudite, thoughtful, and discerning. Adhere strictly to the requested JSON schema.`;

  try {
    const response = await ai.models.generateContent({
      contents: { parts: [{ text: promptText }] },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedType: { type: Type.STRING },
            searchTitle: { type: Type.STRING },
            seoDescription: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            editorialObservations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['suggestedType', 'searchTitle', 'seoDescription', 'suggestedCategory', 'editorialObservations']
        }
      },
      model: 'gemini-3.8-flash'
    });

    if (response && response.text) {
      const parsed = JSON.parse(response.text);

      const refinedAnalysis: ImportAnalysisResult = {
        ...currentAnalysis,
        aiAssisted: true,
        aiSuggestions: {
          searchTitle: parsed.searchTitle,
          seoDescription: parsed.seoDescription,
          suggestedCategory: parsed.suggestedCategory,
          editorialObservations: parsed.editorialObservations || []
        }
      };

      // If search-title was missing or fallback, enrich it with AI suggestion
      if (parsed.searchTitle && (!currentFm['search-title'] || currentAnalysis.seo.searchTitleSource === 'fallback_to_title')) {
        refinedAnalysis.mappedFrontMatter['search-title'] = parsed.searchTitle;
        refinedAnalysis.seo.searchTitle = parsed.searchTitle;
        refinedAnalysis.seo.searchTitleSource = 'ai_suggested';
        refinedAnalysis.seo.searchTitleLength = parsed.searchTitle.length;

        // Add to field mappings
        refinedAnalysis.fieldMappings.push({
          oldKey: '(ai_generated)',
          newKey: 'search-title',
          oldValue: undefined,
          newValue: parsed.searchTitle,
          status: 'mapped',
          note: 'AI-generated SEO title tailored for search rankings (< 60 chars)'
        });
      }

      // If seo-description was missing or fallback, enrich it with AI suggestion
      if (parsed.seoDescription && (!currentFm['seo-description'] || currentAnalysis.seo.seoDescriptionSource !== 'explicit')) {
        refinedAnalysis.mappedFrontMatter['seo-description'] = parsed.seoDescription;
        refinedAnalysis.seo.seoDescription = parsed.seoDescription;
        refinedAnalysis.seo.seoDescriptionSource = 'ai_suggested';
        refinedAnalysis.seo.seoDescriptionLength = parsed.seoDescription.length;

        refinedAnalysis.fieldMappings.push({
          oldKey: '(ai_generated)',
          newKey: 'seo-description',
          oldValue: undefined,
          newValue: parsed.seoDescription,
          status: 'mapped',
          note: 'AI-generated SEO description tailored for Google SERP snippet (120-155 chars)'
        });
      }

      // If category was unmatched and AI suggested a valid one
      if (parsed.suggestedCategory && refinedAnalysis.mappedFrontMatter.category) {
        refinedAnalysis.mappedFrontMatter.category = parsed.suggestedCategory;
      }

      return {
        success: true,
        aiAssisted: true,
        refinedAnalysis
      };
    }
  } catch (err: any) {
    console.warn('[IMPORT AI] Error executing Gemini AI import analysis, using rule-based analysis:', err.message);
  }

  // Fallback to rule-based analysis
  return {
    success: true,
    aiAssisted: false,
    refinedAnalysis: currentAnalysis
  };
}

import { ArticleFrontMatter } from './articles';

export type ArticleAiOperation =
  | 'analyze_article'
  | 'suggest_title'
  | 'suggest_deck'
  | 'improve_intro'
  | 'improve_article'
  | 'seo_analysis'
  | 'internal_linking';

export interface ArticleAiAnalysisDetails {
  primaryTopic: string;
  searchIntent: string;
  targetAudience: string;
  contentStrengths: string[];
  contentWeaknesses: string[];
  missingOpportunities: string[];
  seoIssues: string[];
  titleIssues: string[];
  deckIssues: string[];
  readabilityNotes: string[];
}

export interface ArticleAiTitleSuggestion {
  value: string;
  reason: string;
}

export interface ArticleAiDeckSuggestion {
  value: string;
  reason: string;
}

export interface ArticleAiIntroSuggestion {
  text: string;
  explanation: string;
}

export interface ArticleAiEditorialImprovement {
  section: string;
  critique: string;
  suggestion: string;
}

export interface ArticleAiSeoAnalysis {
  searchIntent: string;
  targetAudience: string;
  strengths: string[];
  weaknesses: string[];
  headingStructureAdvice: string[];
  keywordCoverageAdvice: string[];
}

export interface ArticleAiInternalLinkSuggestion {
  targetUrl: string;
  targetTitle: string;
  suggestedAnchor: string;
  placementContext: string;
  reason: string;
}

export interface ArticleAiSuggestions {
  titles?: ArticleAiTitleSuggestion[];
  decks?: ArticleAiDeckSuggestion[];
  improvedIntro?: ArticleAiIntroSuggestion;
  editorialImprovements?: ArticleAiEditorialImprovement[];
  seoAnalysis?: ArticleAiSeoAnalysis;
  internalLinks?: ArticleAiInternalLinkSuggestion[];
  analysis?: ArticleAiAnalysisDetails;
}

export interface ArticleAiSourcesStatus {
  articleLength: number;
  hasExistingDeck: boolean;
  hasCitations: boolean;
  availableCatalogUrlsCount: number;
}

export interface ArticleAiResponse {
  success: boolean;
  error?: string;
  sources?: ArticleAiSourcesStatus;
  suggestions?: ArticleAiSuggestions;
}

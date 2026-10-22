import { GiftGuideFrontMatter } from './guide';

export type GuideAiOperation =
  | 'analyze_guide'
  | 'suggest_title'
  | 'suggest_deck'
  | 'suggest_intro'
  | 'improve_copy'
  | 'product_ordering'
  | 'seo_analysis'
  | 'internal_linking';

export interface GuideAiAnalysisDetails {
  searchIntent: string;
  audience: string;
  editorialQuality: string;
  organization: string;
  productRelevance: string[];
  coverageGaps: string[];
  seoIssues: string[];
  internalLinkOpportunities: string[];
}

export interface GuideAiTitleSuggestion {
  value: string;
  reason: string;
}

export interface GuideAiDeckSuggestion {
  value: string;
  reason: string;
}

export interface GuideAiIntroSuggestion {
  text: string;
  explanation: string;
}

export interface GuideAiCopyImprovement {
  section: string;
  critique: string;
  suggestion: string;
}

export interface GuideAiProductOrderingSuggestion {
  currentFlowCritique: string;
  suggestedSequence: Array<{
    productName: string;
    recommendedPosition: number;
    rationale: string;
  }>;
}

export interface GuideAiSeoAnalysis {
  searchIntent: string;
  targetAudience: string;
  strengths: string[];
  weaknesses: string[];
  headingStructureAdvice: string[];
  keywordCoverageAdvice: string[];
}

export interface GuideAiInternalLinkSuggestion {
  targetUrl: string;
  targetTitle: string;
  suggestedAnchor: string;
  placementContext: string;
  reason: string;
}

export interface GuideAiSuggestions {
  titles?: GuideAiTitleSuggestion[];
  decks?: GuideAiDeckSuggestion[];
  improvedIntro?: GuideAiIntroSuggestion;
  copyImprovements?: GuideAiCopyImprovement[];
  productOrdering?: GuideAiProductOrderingSuggestion;
  seoAnalysis?: GuideAiSeoAnalysis;
  internalLinks?: GuideAiInternalLinkSuggestion[];
  analysis?: GuideAiAnalysisDetails;
}

export interface GuideAiSourcesStatus {
  productCount: number;
  hasIntroDeck: boolean;
  hasCuratorialRules: boolean;
  hasAvoidList: boolean;
  availableCatalogUrlsCount: number;
}

export interface GuideAiResponse {
  success: boolean;
  error?: string;
  sources?: GuideAiSourcesStatus;
  suggestions?: GuideAiSuggestions;
}

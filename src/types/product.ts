export interface ProductAffiliate {
  sponsored: boolean;
  rel: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  title: string;
  image: string;
  imageType: string;
  price: string;
  priceNumber: number;
  priceRange: string;
  vendor: string;
  vendorUrl: string;
  affiliate: ProductAffiliate;
  category: string;
  badgeLabel: string | null;
  recipients: string[];
  interests: string[];
  occasions: string[];
  ageRanges: string[];
  personalityStyles: string[];
  tags: string[];
  editorialReview: string;
  whyItMakesAGreatGift: string;
  idealFor: string;
  whatMakesItStandOut: string;
  thingsToConsider: string;
  tagline?: string;
  specs?: ProductSpec[];
  [key: string]: any; // Preserve arbitrary fields
}

export type ProductAiOperation =
  | 'analyze_product'
  | 'suggest_title'
  | 'editorial_review'
  | 'why_it_makes_a_great_gift'
  | 'ideal_for'
  | 'what_makes_it_stand_out'
  | 'things_to_consider'
  | 'suggest_taxonomy'
  | 'suggest_tagline';

export interface ProductAiTitleSuggestion {
  value: string;
  reason: string;
}

export interface TaxonomySuggestionItem {
  value: string;
  reason: string;
}

export interface ProductAiTaxonomySuggestions {
  recipients: TaxonomySuggestionItem[];
  interests: TaxonomySuggestionItem[];
  occasions: TaxonomySuggestionItem[];
  ageRanges: TaxonomySuggestionItem[];
  personalityStyles: TaxonomySuggestionItem[];
}

export interface ProductAiAnalysisDetails {
  productIdentification?: string;
  verifiedFacts: string[];
  visualObservations: string[];
  editorialOpportunities: string[];
  uncertainties: string[];
}

export interface ProductAiSuggestions {
  titles?: ProductAiTitleSuggestion[];
  editorialReview?: string;
  whyItMakesAGreatGift?: string;
  idealFor?: string;
  whatMakesItStandOut?: string;
  thingsToConsider?: string;
  tagline?: string;
  taxonomy?: ProductAiTaxonomySuggestions;
  analysis?: ProductAiAnalysisDetails;
}

export interface ProductAiSourcesStatus {
  urlFetched: boolean;
  urlError?: string | null;
  imageAnalyzed: boolean;
  imageError?: string | null;
  imagePath?: string | null;
  productUrl?: string | null;
  cmsDataAvailable?: boolean;
}

export interface ProductAiResponse {
  success: boolean;
  error?: string;
  sources: ProductAiSourcesStatus;
  suggestions?: ProductAiSuggestions;
}

export interface TaxonomyOptions {
  categories: string[];
  priceRanges: string[];
  recipients: string[];
  interests: string[];
  occasions: string[];
  ageRanges: string[];
  personalityStyles: string[];
  imageTypes: string[];
  vendors: string[];
  tags: string[];
}

export interface ProductBackup {
  filename: string;
  timestamp: string;
  action: string;
  targetId?: string;
  size: number;
  productCount: number;
}

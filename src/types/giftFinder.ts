export interface GiftFinderOption {
  value: string;
  label: string;
  description?: string;
}

export interface GiftFinderStep {
  step: number;
  field: string;
  title: string;
  prompt: string;
  subBadge?: string;
  options: GiftFinderOption[];
}

export interface BudgetRule {
  value: string;
  label: string;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface ScoringRules {
  recipientMatch: number;
  interestMatchPerItem: number;
  personalityMatch: number;
  occasionMatch: number;
  ageMatch: number;
  editorsPickBonus: number;
}

export interface ResultsConfig {
  bestMatchCount: number;
  alsoConsiderCount: number;
  moreIdeasCount: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface GiftFinderData {
  badge: string;
  title: string;
  lead: string;
  steps: GiftFinderStep[];
  budgetRules: BudgetRule[];
  scoring: ScoringRules;
  resultsConfig: ResultsConfig;
  labels: Record<string, string>;
  faqs: FaqItem[];
  prevButtonText: string;
  nextButtonText: string;
  submitButtonText: string;
}

export interface GiftFinderBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

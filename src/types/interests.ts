export interface InterestItem {
  id: string;
  name: string;
  count: number;
  url: string;
  description: string;
  calculatedCount?: number;
  [key: string]: any; // Preserve unknown fields
}

export interface InterestReference {
  type: 'product' | 'guide' | 'homepage' | 'gift-finder';
  title: string;
  idOrSlug: string;
  field: string;
}

export interface InterestDeleteWarning {
  interestId: string;
  interestName: string;
  hasReferences: boolean;
  references: InterestReference[];
  count: number;
}

export interface InterestBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

export type GlobalComponentKey = 'newsletter' | 'footer' | 'editors-pick';

export interface LinkItem {
  label: string;
  url: string;
  isExternal?: boolean;
}

export interface NewsletterData {
  badge: string;
  headline: string;
  description: string;
  emailPlaceholder: string;
  buttonText: string;
  submitMessage: string;
  socialProof: string;
}

export interface FooterData {
  publicationDescription: string;
  publishingLocations: string;
  guidesColumnTitle: string;
  guidesLinks: LinkItem[];
  essaysColumnTitle: string;
  essaysLinks: LinkItem[];
  utilityLinks: LinkItem[];
  integrityStatement: string;
  copyrightText: string;
}

export interface EditorsPickComponentData {
  subBadge: string;
  title: string;
  badgeLabelDefault: string;
  whyGiftHeader: string;
  idealForHeader: string;
  standoutHeader: string;
  considerHeader: string;
  specsHeader: string;
  featuredProductId?: string;
}

export interface GlobalComponentInfo {
  key: GlobalComponentKey;
  name: string;
  filename: string;
  description: string;
  mtime?: string;
  size?: number;
}

export interface GlobalComponentBackupItem {
  filename: string;
  key: GlobalComponentKey;
  timestamp: string;
  action: string;
  size: number;
}

export interface SiteSettingsData {
  title: string;
  tagline: string;
  description: string;
  url: string;
  timezone: string;
}

export interface ProtectedConfigSummary {
  baseurl?: string;
  permalink?: string;
  collectionsCount?: number;
  defaultsCount?: number;
  markdownEngine?: string;
  excludedCount?: number;
}

export interface SiteSettingsBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

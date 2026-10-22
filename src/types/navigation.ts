export interface NavigationItem {
  title: string;
  url: string;
  external?: boolean;
  badge?: boolean;
  sparkle?: boolean;
  [key: string]: any; // Preserve unknown item fields
}

export interface NavigationData {
  header: NavigationItem[];
  footer_explore: NavigationItem[];
  footer_editorial: NavigationItem[];
  footer_legal: NavigationItem[];
  [key: string]: any; // Preserve unknown sections
}

export interface NavigationBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

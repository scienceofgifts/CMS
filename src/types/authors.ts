export interface AuthorItem {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatarSeed?: string;
  guideCount?: number;
  articleCount?: number;
  [key: string]: any; // Preserve unknown author fields
}

export interface AuthorReference {
  type: 'guide' | 'article';
  title: string;
  slug: string;
  field: string;
}

export interface AuthorDeleteWarning {
  authorId: string;
  authorName: string;
  hasReferences: boolean;
  guideReferences: AuthorReference[];
  articleReferences: AuthorReference[];
  count: number;
}

export interface AuthorBackupItem {
  filename: string;
  timestamp: string;
  action: string;
  size: number;
}

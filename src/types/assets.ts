export interface AssetDerivativeInfo {
  exists: boolean;
  path: string;
  size?: number;
  formattedSize?: string;
  url?: string;
}

export interface AssetUsage {
  type: 'guide' | 'article' | 'product' | 'page' | 'author';
  id: string;
  title: string;
  file: string;
  context?: string;
}

export interface AssetItem {
  id: string;
  filename: string;
  name: string;
  ext: string;
  format: 'JPG' | 'PNG' | 'WebP' | 'SVG' | 'OTHER';
  directory: string;
  relativePath: string;
  publicUrl: string;
  size: number;
  formattedSize: string;
  mtime: string;
  dimensions: { width: number; height: number } | null;
  isDerivative: boolean;
  derivativeOf: string | null;
  derivatives: {
    webp?: AssetDerivativeInfo;
    thumb?: AssetDerivativeInfo;
  };
  usedBy: AssetUsage[];
}

export interface AssetStats {
  totalAssets: number;
  sourceCount: number;
  webpCount: number;
  thumbCount: number;
  inUseCount: number;
  unusedCount: number;
  totalSize: number;
  formattedTotalSize: string;
}

export interface AssetPickerResult {
  path: string;
  publicUrl: string;
  filename: string;
  nameWithoutExt: string;
  altText: string;
  caption?: string;
  dimensions?: { width: number; height: number } | null;
}

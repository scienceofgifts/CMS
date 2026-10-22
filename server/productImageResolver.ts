import fs from 'fs';
import path from 'path';

export interface ResolvedImageResult {
  found: boolean;
  base64?: string;
  mimeType?: string;
  filename?: string;
  error?: string;
}

/**
 * Resolves a product's local image file and reads it as a base64 buffer for Gemini multi-modal input.
 */
export function resolveProductImageBase64(imageRef?: string | null, jekyllRoot?: string): ResolvedImageResult {
  if (!imageRef || typeof imageRef !== 'string') {
    return { found: false };
  }

  const cleanRef = imageRef.trim().replace(/^\/+/, '').replace(/^assets\/images\//, '');
  if (!cleanRef) {
    return { found: false };
  }

  const possibleDirs = [
    jekyllRoot ? path.join(jekyllRoot, 'assets', 'images') : null,
    jekyllRoot ? path.join(jekyllRoot, 'assets') : null,
    jekyllRoot ? jekyllRoot : null,
    path.join(process.cwd(), 'site', 'assets', 'images'),
    path.join(process.cwd(), 'site', 'assets'),
    path.join(process.cwd(), 'assets', 'images'),
    path.join(process.cwd(), 'assets'),
    path.join(process.cwd(), 'public', 'assets', 'images'),
    path.join(process.cwd(), 'public', 'assets')
  ].filter(Boolean) as string[];

  const possibleFilenames = [
    cleanRef,
    cleanRef.endsWith('.jpg') || cleanRef.endsWith('.jpeg') || cleanRef.endsWith('.png') || cleanRef.endsWith('.webp')
      ? cleanRef
      : `${cleanRef}.jpg`,
    `${cleanRef}.jpeg`,
    `${cleanRef}.png`,
    `${cleanRef}.webp`
  ];

  for (const dir of possibleDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const file of possibleFilenames) {
      const fullPath = path.join(dir, file);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        try {
          const buffer = fs.readFileSync(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          let mimeType = 'image/jpeg';
          if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.webp') mimeType = 'image/webp';
          else if (ext === '.svg') mimeType = 'image/svg+xml';

          return {
            found: true,
            base64: buffer.toString('base64'),
            mimeType,
            filename: path.basename(fullPath)
          };
        } catch (err: any) {
          return { found: false, error: `Failed to read image file: ${err.message}` };
        }
      }
    }
  }

  return { found: false };
}

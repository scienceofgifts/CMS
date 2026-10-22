/**
 * Resolves a product's existing image reference to a valid asset URL.
 * Handles bare identifiers ("brass-book-weight"), filenames with extension ("brass-book-weight.jpg"),
 * relative paths ("assets/images/brass-book-weight.jpg"), and absolute URLs.
 * Reuses the same URL resolution strategy as the Article Manager.
 */
export function getProductImageUrl(product?: { image?: string; imageType?: string; id?: string } | null): string {
  if (!product) return '/assets/images/home-hero.jpg';
  const rawImage = product.image || product.imageType || product.id || '';
  if (!rawImage) return '/assets/images/home-hero.jpg';

  // Remote or Data URLs
  if (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('data:')) {
    return rawImage;
  }

  // Already prefixed with path
  if (rawImage.startsWith('/') || rawImage.startsWith('assets/')) {
    const cleanPath = `/${rawImage.replace(/^\/+/, '')}`;
    if (/\.(jpg|jpeg|png|webp|svg)$/i.test(cleanPath)) {
      return cleanPath;
    }
    return `${cleanPath}.jpg`;
  }

  // Bare filename with extension
  if (/\.(jpg|jpeg|png|webp|svg)$/i.test(rawImage)) {
    return `/assets/images/${rawImage}`;
  }

  // Bare base name identifier without extension
  return `/assets/images/${rawImage}.jpg`;
}

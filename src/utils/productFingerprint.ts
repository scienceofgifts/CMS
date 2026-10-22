import { Product } from '../types/product';

export function computeProductFingerprint(product: Partial<Product>): string {
  const parts = [
    product.id || 'new-product',
    (product.vendorUrl || '').trim(),
    (product.image || '').trim(),
    (product.title || '').trim()
  ];
  return parts.join('::');
}

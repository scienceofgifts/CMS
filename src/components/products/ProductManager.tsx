import React, { useState, useEffect } from 'react';
import { Product, TaxonomyOptions } from '../../types/product';
import { ProductList } from './ProductList';
import { ProductForm } from './ProductForm';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { BackupsModal } from './BackupsModal';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

interface ProductManagerProps {
  initialProductId?: string | null;
  onClearInitialProduct?: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  initialProductId,
  onClearInitialProduct
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [taxonomies, setTaxonomies] = useState<TaxonomyOptions>({
    categories: ['editors-pick', 'quick-pick', 'under-50', 'under-30', 'under-100', 'heirloom'],
    priceRanges: ['under-25', '25-50', '50-100', '100-plus'],
    recipients: [],
    interests: [],
    occasions: [],
    ageRanges: [],
    personalityStyles: [],
    imageTypes: [],
    vendors: [],
    tags: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Modals
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isBackupsOpen, setIsBackupsOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', text: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    loadProducts(initialProductId);
  }, []);

  useEffect(() => {
    if (initialProductId && products.length > 0) {
      const normTarget = initialProductId.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      const found = products.find(p =>
        p.id === initialProductId ||
        (p.id && p.id.toLowerCase() === normTarget) ||
        (p.slug && p.slug.toLowerCase() === normTarget) ||
        (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normTarget) ||
        (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normTarget}`) || p.vendorUrl.toLowerCase().includes(`/${normTarget}`)))
      );

      if (found) {
        setSelectedProduct(found);
        setIsCreatingNew(false);
      } else {
        // Attempt backend resolution in case target is a link/reference identifier or slug
        fetch(`/api/products/${encodeURIComponent(initialProductId)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.product) {
              setSelectedProduct(data.product);
              setIsCreatingNew(false);
            } else {
              addToast('error', `Product with ID "${initialProductId}" not found.`);
            }
          })
          .catch(() => {
            addToast('error', `Product with ID "${initialProductId}" not found.`);
          });
      }
    }
  }, [initialProductId]);

  const loadProducts = async (targetIdOverride?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok && data.success) {
        const catalog: Product[] = data.products || [];
        setProducts(catalog);
        if (data.taxonomies) {
          setTaxonomies(data.taxonomies);
        }

        const idToResolve = targetIdOverride !== undefined ? targetIdOverride : initialProductId;
        if (idToResolve) {
          const normTarget = idToResolve.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
          const found = catalog.find(p =>
            p.id === idToResolve ||
            (p.id && p.id.toLowerCase() === normTarget) ||
            (p.slug && p.slug.toLowerCase() === normTarget) ||
            (p.title && p.title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') === normTarget) ||
            (p.vendorUrl && (p.vendorUrl.toLowerCase().includes(`/products/${normTarget}`) || p.vendorUrl.toLowerCase().includes(`/${normTarget}`)))
          );

          if (found) {
            setSelectedProduct(found);
            setIsCreatingNew(false);
          } else {
            // Attempt backend resolution in case target is a link/reference identifier or slug
            try {
              const resSingle = await fetch(`/api/products/${encodeURIComponent(idToResolve)}`);
              const dataSingle = await resSingle.json();
              if (resSingle.ok && dataSingle.success && dataSingle.product) {
                setSelectedProduct(dataSingle.product);
                setIsCreatingNew(false);
              } else {
                addToast('error', `Product with ID "${idToResolve}" not found.`);
              }
            } catch {
              addToast('error', `Product with ID "${idToResolve}" not found.`);
            }
          }
        }
      } else {
        addToast('error', data.error || 'Failed to fetch products.');
      }
    } catch (err: any) {
      addToast('error', `Error communicating with local server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async (productData: Product): Promise<boolean> => {
    try {
      const isUpdate = !isCreatingNew && selectedProduct !== null;
      // Original product identity when the editor was opened
      const originalId = isUpdate ? selectedProduct.id : null;
      const url = isUpdate ? `/api/products/${encodeURIComponent(originalId!)}` : '/api/products';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        addToast('success', data.message || 'Product saved successfully to _data/products.yml.');
        // Adopt the canonical product returned by the server
        const savedProduct: Product = data.product || productData;
        if (onClearInitialProduct && initialProductId && initialProductId !== savedProduct.id) {
          onClearInitialProduct();
        }
        // Update local state and synchronize with the new canonical product identity
        await loadProducts(savedProduct.id);
        setSelectedProduct(savedProduct);
        setIsCreatingNew(false);
        return true;
      } else {
        addToast('error', data.error || 'Validation failed on server.');
        return false;
      }
    } catch (err: any) {
      addToast('error', `Network error saving product: ${err.message}`);
      return false;
    }
  };

  const handleDuplicateProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        addToast('success', data.message);
        await loadProducts();
        // Immediately open the duplicated product for editing if user wishes
        setSelectedProduct(data.product);
        setIsCreatingNew(false);
      } else {
        addToast('error', data.error || 'Failed to duplicate product.');
      }
    } catch (err: any) {
      addToast('error', `Error duplicating product: ${err.message}`);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(deleteCandidate.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        addToast('success', data.message);
        setDeleteCandidate(null);
        if (selectedProduct && selectedProduct.id === deleteCandidate.id) {
          setSelectedProduct(null);
        }
        await loadProducts();
      } else {
        addToast('error', data.error || 'Failed to delete product.');
      }
    } catch (err: any) {
      addToast('error', `Error deleting product: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 border shadow-lg flex items-start gap-3 pointer-events-auto animate-in slide-in-from-bottom-3 duration-200 ${
              toast.type === 'success'
                ? 'bg-[#E8F8F1] border-[#226E56]/30 text-[#154D3B]'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#226E56] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs flex-1 leading-relaxed">
              {toast.text}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Main View Router: List vs Form */}
      {selectedProduct || isCreatingNew ? (
        <ProductForm
          key={selectedProduct ? selectedProduct.id : (isCreatingNew ? 'new-product' : 'none')}
          product={selectedProduct}
          taxonomies={taxonomies}
          existingProducts={products}
          onSave={handleSaveProduct}
          onCancel={() => {
            setSelectedProduct(null);
            setIsCreatingNew(false);
          }}
          onDelete={(id) => {
            const p = products.find(item => item.id === id);
            if (p) setDeleteCandidate(p);
          }}
          onDuplicate={handleDuplicateProduct}
        />
      ) : (
        <ProductList
          products={products}
          taxonomies={taxonomies}
          onSelectProduct={(p) => {
            setSelectedProduct(p);
            setIsCreatingNew(false);
          }}
          onCreateNew={() => {
            setSelectedProduct(null);
            setIsCreatingNew(true);
          }}
          onDuplicate={handleDuplicateProduct}
          onDeleteRequest={(p) => setDeleteCandidate(p)}
          onOpenBackups={() => setIsBackupsOpen(true)}
          onRefresh={loadProducts}
          isLoading={loading}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        product={deleteCandidate}
        isOpen={deleteCandidate !== null}
        isDeleting={isDeleting}
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteCandidate(null)}
      />

      {/* Backups & Rollback Modal */}
      <BackupsModal
        isOpen={isBackupsOpen}
        onClose={() => setIsBackupsOpen(false)}
        onRestoreSuccess={() => {
          loadProducts();
          addToast('success', 'Catalog restored from snapshot backup successfully.');
        }}
      />
    </div>
  );
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPDATE ProductsSection.jsx (True Server-Side Pagination & Filtering)
// ─────────────────────────────────────────────────────────────────────────────
const psPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');

const newProductsSectionCode = `import BulkImportModal from './BulkImportModal';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '@api/axiosInstance';
import { ENDPOINTS } from '@api/endpoints';
import { toast } from 'react-toastify';
import { getImageUrl, getProductThumbnail } from '@utils/imageUrl';
import styles from '../Dashboard.module.css';

const parseImages = (imgs) => {
  if (!imgs) return [];
  if (Array.isArray(imgs)) return imgs.map((s) => String(s).trim()).filter(Boolean);
  if (typeof imgs === 'string') {
    const trimmed = imgs.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
      } catch (e) {}
    }
    if (trimmed.includes('|||')) {
      return trimmed.split('|||').map((s) => s.trim()).filter(Boolean);
    }
    if (trimmed.startsWith('data:')) {
      return [trimmed];
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const handleImageFileUpload = (file, idx, imageList, handleProductFormChange) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const dataUrl = evt.target?.result;
    if (!dataUrl) return;

    try {
      const res = await axiosInstance.post('/uploads', { image: dataUrl });
      const uploadedUrl = res.data?.url || res.url || res.data?.data?.url;
      if (uploadedUrl) {
        const updated = [...imageList];
        updated[idx] = uploadedUrl;
        handleProductFormChange({ target: { name: 'images', value: updated.filter(Boolean).join('|||') } });
        toast.success('Image saved directly to backend storage!');
        return;
      }
    } catch (err) {
      console.warn('Backend image upload fallback:', err.message);
    }

    const updated = [...imageList];
    updated[idx] = dataUrl;
    handleProductFormChange({ target: { name: 'images', value: updated.filter(Boolean).join('|||') } });
  };
  reader.readAsDataURL(file);
};

// Helper function to resolve product's Main Category ID robustly
const resolveMainCategoryId = (product, categoriesList = []) => {
  const catId = product.categoryId || (typeof product.category === 'object' ? product.category?.id : product.category);
  const subId = product.subCategoryId || (typeof product.subcategory === 'object' ? product.subcategory?.id : product.subcategory) || (typeof product.subCategory === 'object' ? product.subCategory?.id : product.subCategory);

  if (catId) {
    const matchedCat = categoriesList.find(c => c.id === catId || c.slug === catId || String(c.name).toLowerCase() === String(catId).toLowerCase());
    if (matchedCat) {
      if (!matchedCat.parentId) return matchedCat.id;
      const parentCat = categoriesList.find(c => c.id === matchedCat.parentId);
      if (parentCat) return parentCat.id;
    }
  }

  if (subId) {
    const matchedSub = categoriesList.find(c => c.id === subId || c.slug === subId || String(c.name).toLowerCase() === String(subId).toLowerCase());
    if (matchedSub && matchedSub.parentId) {
      const parentCat = categoriesList.find(c => c.id === matchedSub.parentId);
      if (parentCat) return parentCat.id;
      return matchedSub.parentId;
    }
  }

  if (product.category?.name || (typeof product.category === 'string' && product.category)) {
    const catName = String(product.category?.name || product.category).toLowerCase().trim();
    const matchedByName = categoriesList.find(c => !c.parentId && c.name.toLowerCase().trim() === catName);
    if (matchedByName) return matchedByName.id;

    const matchedSubByName = categoriesList.find(c => c.parentId && c.name.toLowerCase().trim() === catName);
    if (matchedSubByName && matchedSubByName.parentId) return matchedSubByName.parentId;
  }

  return 'unassigned';
};

const resolveMainCategoryName = (product, categoriesList = []) => {
  const mainId = resolveMainCategoryId(product, categoriesList);
  if (mainId === 'unassigned') return 'Unassigned';
  const found = categoriesList.find(c => c.id === mainId);
  return found ? found.name : 'Unassigned';
};

const resolveSubCategoryName = (product, categoriesList = []) => {
  const subId = product.subCategoryId || (typeof product.subcategory === 'object' ? product.subcategory?.id : product.subcategory) || (typeof product.subCategory === 'object' ? product.subCategory?.id : product.subCategory);
  if (subId) {
    const found = categoriesList.find(c => c.id === subId || c.slug === subId);
    if (found) return found.name;
  }
  if (product.category?.parentId && product.category?.name) {
    return product.category.name;
  }
  if (product.subcategory?.name) return product.subcategory.name;
  if (typeof product.subcategory === 'string' && product.subcategory) return product.subcategory;
  if (product.subCategory?.name) return product.subCategory.name;
  if (typeof product.subCategory === 'string' && product.subCategory) return product.subCategory;
  return null;
};

const ProductsSection = ({
  categories = [],
  showProductForm,
  editingProduct,
  savingProduct,
  productForm,
  resetProductForm,
  handleOpenAddProduct,
  handleEditProductClick,
  handleProductFormChange,
  handleProductSubmit,
  handleDeleteProduct,
  onRefresh,
}) => {
  const [maxSlots, setMaxSlots] = useState(1);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [activeSubCategoryFilter, setActiveSubCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Server-side loaded page data and pagination metadata
  const [pageProducts, setPageProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategoryFilter, activeSubCategoryFilter, debouncedSearch, pageSize]);

  // Fetch products from backend with exact filters & pagination
  const fetchPageProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        showAll: 'true',
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (activeCategoryFilter !== 'all' && activeCategoryFilter !== 'unassigned') {
        params.categoryId = activeCategoryFilter;
      }

      if (activeSubCategoryFilter !== 'all') {
        params.subCategoryId = activeSubCategoryFilter;
      }

      const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST, { params });
      const body = res.data || res;
      const productList = Array.isArray(body.data)
        ? body.data
        : (Array.isArray(body.products) ? body.products : (Array.isArray(body) ? body : []));

      setPageProducts(productList);

      if (body.meta) {
        setMeta(body.meta);
      } else {
        setMeta({
          total: productList.length,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(productList.length / pageSize) || 1,
          hasNext: false,
          hasPrev: currentPage > 1,
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard products:', err);
      toast.error(\`Failed to fetch products: \${err.message}\`);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, activeCategoryFilter, activeSubCategoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchPageProducts();
  }, [fetchPageProducts]);

  // Listen for realtime product updates
  useEffect(() => {
    const handleUpdate = () => {
      fetchPageProducts();
    };
    window.addEventListener('products_updated', handleUpdate);
    return () => window.removeEventListener('products_updated', handleUpdate);
  }, [fetchPageProducts]);

  const handleCloseModal = () => {
    setMaxSlots(1);
    resetProductForm();
  };

  // Main Categories and subcategories
  const mainCategories = useMemo(() => categories.filter(c => !c.parentId), [categories]);

  // Calculate live category counts from category relationships
  const categoryStats = useMemo(() => {
    let totalCount = meta.total || 0;
    const mainCountMap = {};

    categories.forEach(c => {
      const pCount = c._count?.products || 0;
      if (c.parentId) {
        mainCountMap[c.parentId] = (mainCountMap[c.parentId] || 0) + pCount;
      } else {
        mainCountMap[c.id] = (mainCountMap[c.id] || 0) + pCount;
      }
    });

    return { total: totalCount, mainCountMap };
  }, [categories, meta.total]);

  // Subcategories available for active Category filter
  const filterSubcategories = useMemo(() => {
    if (activeCategoryFilter === 'all' || activeCategoryFilter === 'unassigned') return [];
    return categories.filter(c => c.parentId === activeCategoryFilter);
  }, [categories, activeCategoryFilter]);

  // Subcategories available for form
  const availableSubcategories = useMemo(() => {
    if (!productForm.categoryId) return [];
    const matchedMain = categories.find(c => c.id === productForm.categoryId || c.slug === productForm.categoryId);
    const mainId = matchedMain ? matchedMain.id : productForm.categoryId;
    return categories.filter(c => c.parentId === mainId);
  }, [categories, productForm.categoryId]);

  const totalPages = meta.totalPages || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner: Title, Category Filter Pills, Searchbar & Add Button */}
      <div className={styles.cardContainer} style={{ background: '#ffffff', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 className={styles.cardTitle} style={{ fontSize: '1.2rem', color: '#0f172a' }}>
              Products Management ({meta.total || pageProducts.length} {(meta.total === 1 || pageProducts.length === 1) ? 'Product' : 'Products'})
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Server-side filtered & paginated product catalog
            </p>
          </div>

          {/* Interactive Main Category Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            
            <button
              type="button"
              onClick={() => { setActiveCategoryFilter('all'); setActiveSubCategoryFilter('all'); }}
              style={{
                background: activeCategoryFilter === 'all' ? '#fffcf5' : '#f8fafc',
                border: activeCategoryFilter === 'all' ? '1.5px solid #d99b26' : '1px solid #e2e8f0',
                padding: '0.4rem 0.85rem',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: activeCategoryFilter === 'all' ? '700' : '600',
                color: activeCategoryFilter === 'all' ? '#92400e' : '#475569',
                cursor: 'pointer',
                boxShadow: activeCategoryFilter === 'all' ? '0 2px 6px rgba(217, 155, 38, 0.2)' : 'none',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>All Products</span>
              <span style={{
                background: activeCategoryFilter === 'all' ? '#d99b26' : '#e2e8f0',
                color: activeCategoryFilter === 'all' ? '#ffffff' : '#64748b',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: '700'
              }}>
                {activeCategoryFilter === 'all' && !debouncedSearch ? meta.total : (meta.total || 0)}
              </span>
            </button>

            {mainCategories.map((cat) => {
              const isActive = activeCategoryFilter === cat.id;
              const catCount = categoryStats.mainCountMap[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setActiveCategoryFilter(cat.id);
                    setActiveSubCategoryFilter('all');
                  }}
                  style={{
                    background: isActive ? '#fffcf5' : '#f8fafc',
                    border: isActive ? '1.5px solid #d99b26' : '1px solid #e2e8f0',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#92400e' : '#475569',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 2px 6px rgba(217, 155, 38, 0.2)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{cat.name}</span>
                  <span style={{
                    background: isActive ? '#d99b26' : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#64748b',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '10px',
                    fontSize: '0.72rem',
                    fontWeight: '700'
                  }}>
                    {isActive ? (meta.total || 0) : catCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowBulkImportModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontWeight: '600',
                color: '#334155',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              📥 <span>Bulk Import (Excel)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddProduct}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'linear-gradient(135deg, #d99b26, #b45309)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(217, 155, 38, 0.3)',
              }}
            >
              ➕ <span>Add Single Product</span>
            </button>
          </div>
        </div>

        {/* Subcategories Filter Chips */}
        {filterSubcategories.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginRight: '0.25rem' }}>Subcategory:</span>
            
            <button
              type="button"
              onClick={() => setActiveSubCategoryFilter('all')}
              style={{
                background: activeSubCategoryFilter === 'all' ? '#e0f2fe' : '#f8fafc',
                border: activeSubCategoryFilter === 'all' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                color: activeSubCategoryFilter === 'all' ? '#0369a1' : '#64748b',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: activeSubCategoryFilter === 'all' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              All Subcategories
            </button>

            {filterSubcategories.map(sub => {
              const isSubActive = activeSubCategoryFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubCategoryFilter(sub.id)}
                  style={{
                    background: isSubActive ? '#e0f2fe' : '#f8fafc',
                    border: isSubActive ? '1px solid #0284c7' : '1px solid #e2e8f0',
                    color: isSubActive ? '#0369a1' : '#64748b',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: isSubActive ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Search Bar */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Search products by name, SKU, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.2rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#1e293b',
              }}
            />
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔍
            </span>
          </div>

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                padding: '0.55rem 0.85rem',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <BulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onImportSuccess={() => {
            fetchPageProducts();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Add / Edit Product Modal */}
      {showProductForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHeader}>
              <h3>{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
              <button className={styles.modalClose} onClick={handleCloseModal}>&times;</button>
            </div>
            
            <form onSubmit={async (e) => {
              await handleProductSubmit(e);
              fetchPageProducts();
            }} className={styles.productForm}>
              <div className={styles.formGrid}>
                {/* Product Name */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={productForm.name}
                    onChange={handleProductFormChange}
                    placeholder="Enter product title..."
                    required
                  />
                </div>

                {/* SKU */}
                <div className={styles.formGroup}>
                  <label>SKU (Stock Keeping Unit)</label>
                  <input
                    type="text"
                    name="sku"
                    value={productForm.sku || ''}
                    onChange={handleProductFormChange}
                    placeholder="e.g. SKU-12345"
                  />
                </div>

                {/* Main Category */}
                <div className={styles.formGroup}>
                  <label>Main Category *</label>
                  <select
                    name="categoryId"
                    value={productForm.categoryId}
                    onChange={(e) => {
                      handleProductFormChange({
                        target: { name: 'categoryId', value: e.target.value }
                      });
                      handleProductFormChange({
                        target: { name: 'subCategoryId', value: '' }
                      });
                    }}
                    required
                  >
                    <option value="">Select Main Category</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory */}
                <div className={styles.formGroup}>
                  <label>Subcategory (Optional)</label>
                  <select
                    name="subCategoryId"
                    value={productForm.subCategoryId || ''}
                    onChange={handleProductFormChange}
                    disabled={!productForm.categoryId || availableSubcategories.length === 0}
                  >
                    <option value="">None / Direct Category</option>
                    {availableSubcategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Price & Compare Price */}
                <div className={styles.formGroup}>
                  <label>Selling Price (₹) *</label>
                  <input
                    type="number"
                    name="price"
                    value={productForm.price}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Original / Compare Price (₹)</label>
                  <input
                    type="number"
                    name="comparePrice"
                    value={productForm.comparePrice || ''}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* Stock */}
                <div className={styles.formGroup}>
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    name="stock"
                    value={productForm.stock}
                    onChange={handleProductFormChange}
                    min="0"
                  />
                </div>

                {/* Product Tags */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Product Tags (comma separated)</label>
                  <input
                    type="text"
                    name="tags"
                    value={productForm.tags || ''}
                    onChange={handleProductFormChange}
                    placeholder="e.g. leather, premium, anniversary"
                  />
                </div>

                {/* Specifications */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Specifications / Key Features</label>
                  <textarea
                    name="specifications"
                    rows="3"
                    value={productForm.specifications || ''}
                    onChange={handleProductFormChange}
                    placeholder="Enter specifications..."
                  />
                </div>

                {/* Description */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Description *</label>
                  <textarea
                    name="description"
                    rows="4"
                    value={productForm.description}
                    onChange={handleProductFormChange}
                    required
                  />
                </div>

                {/* Image Upload Slots */}
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Product Images (URL or Upload)</label>
                  {(() => {
                    const parsedImgs = parseImages(productForm.images);
                    const slotCount = Math.max(maxSlots, parsedImgs.length);
                    const slots = Array.from({ length: slotCount }).map((_, idx) => parsedImgs[idx] || '');

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {slots.map((url, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', width: '60px' }}>Slot {idx + 1}:</span>
                            <input
                              type="text"
                              value={url}
                              onChange={(e) => {
                                const updated = [...slots];
                                updated[idx] = e.target.value;
                                handleProductFormChange({
                                  target: { name: 'images', value: updated.filter(Boolean).join('|||') }
                                });
                              }}
                              placeholder="Image URL..."
                              style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageFileUpload(e.target.files[0], idx, slots, handleProductFormChange);
                                }
                              }}
                              style={{ fontSize: '0.75rem', maxWidth: '180px' }}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setMaxSlots(prev => prev + 1)}
                          style={{ alignSelf: 'flex-start', padding: '0.35rem 0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          + Add Another Image Slot
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className={styles.modalActions} style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className={styles.btnSecondary} onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={savingProduct}>
                  {savingProduct ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          <span>Loading products from server...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && pageProducts.length === 0 && (
        <div className={styles.cardContainer} style={{ textAlign: 'center', padding: '3rem 1rem', background: '#ffffff' }}>
          <p style={{ fontSize: '1rem', color: '#64748b' }}>No products found matching your search or filter.</p>
        </div>
      )}

      {/* Products Data Table */}
      {!loading && pageProducts.length > 0 && (
        <div className={styles.tableCard} style={{ background: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <table className={styles.table}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Product</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>SKU</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Subcategory</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Price</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Stock</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageProducts.map((product) => {
                const mainName = resolveMainCategoryName(product, categories);
                const subName = resolveSubCategoryName(product, categories);
                const thumb = getProductThumbnail(product);

                return (
                  <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img
                          src={thumb}
                          alt={product.name}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                          onError={(e) => { e.target.src = '/placeholder.jpg'; }}
                        />
                        <div>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.85rem' }}>{product.name}</div>
                          {product.slug && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>/{product.slug}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#64748b' }}>
                      {product.sku || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#334155', fontWeight: '500' }}>
                      {mainName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#64748b' }}>
                      {subName || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#0f172a' }}>
                      ₹{product.price}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: (product.stock || 0) > 5 ? '#dcfce7' : ((product.stock || 0) > 0 ? '#fef9c3' : '#fee2e2'),
                        color: (product.stock || 0) > 5 ? '#15803d' : ((product.stock || 0) > 0 ? '#a16207' : '#b91c1c'),
                      }}>
                        {product.stock || 0} in stock
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={\`\${styles.pillStatus} \${product.isActive ? styles.pillDelivered : styles.pillCancelled}\`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleEditProductClick(product)}
                          style={{ padding: '0.35rem 0.75rem', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDeleteProduct(product.id, product.name);
                            fetchPageProducts();
                          }}
                          style={{ padding: '0.35rem 0.75rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Server-Side Table Pagination Controls */}
          {meta.total > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                <span>
                  Showing{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {Math.min((currentPage - 1) * pageSize + 1, meta.total)}
                  </strong>{' '}
                  to{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {Math.min(currentPage * pageSize, meta.total)}
                  </strong>{' '}
                  of{' '}
                  <strong style={{ color: '#0f172a' }}>{meta.total}</strong> products
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem' }}>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '0.2rem 0.5rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      background: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      background: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
                      color: currentPage <= 1 ? '#94a3b8' : '#334155',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Prev
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, pIdx) => {
                    let pageNum = pIdx + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + pIdx + 1;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - pIdx);
                    }
                    const isCurrent = currentPage === pageNum;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          border: isCurrent ? '1.5px solid #d99b26' : '1px solid #cbd5e1',
                          background: isCurrent ? '#fffcf5' : '#ffffff',
                          color: isCurrent ? '#92400e' : '#475569',
                          fontWeight: isCurrent ? 700 : 500,
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      background: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                      color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductsSection;
`;

fs.writeFileSync(psPath, newProductsSectionCode, 'utf8');
console.log('✅ ProductsSection.jsx updated with true server-side pagination and filtering');


// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE Shop/index.jsx (Storefront Server-Side Pagination)
// ─────────────────────────────────────────────────────────────────────────────
const shopPath = path.join(frontendDir, 'src/pages/Shop/index.jsx');

const newShopCode = `import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@components/layout/Layout';
import ProductGrid from '@components/product/ProductGrid';
import Pagination from '@components/common/Pagination';
import axiosInstance from '@api/axiosInstance';
import { ENDPOINTS } from '@api/endpoints';
import styles from './Shop.module.css';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'featured', label: 'Featured' },
];

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const [liveProducts, setLiveProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1, limit: 24 });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 24,
        sort,
      };

      if (search.trim()) params.search = search.trim();
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;

      const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST, { params });
      const body = res.data || res;
      const productList = Array.isArray(body.data)
        ? body.data
        : (Array.isArray(body.products) ? body.products : (Array.isArray(body) ? body : []));

      setLiveProducts(productList.filter(p => p.isActive !== false));

      if (body.meta) {
        setMeta(body.meta);
      } else {
        setMeta({
          total: productList.length,
          page: currentPage,
          limit: 24,
          totalPages: Math.ceil(productList.length / 24) || 1,
        });
      }
    } catch (e) {
      console.warn('Shop products fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, sort, minPrice, maxPrice]);

  useEffect(() => {
    loadProducts();
    window.addEventListener('products_updated', loadProducts);
    return () => {
      window.removeEventListener('products_updated', loadProducts);
    };
  }, [loadProducts]);

  const setParam = (key, val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === '' || val === null || val === undefined) {
        next.delete(key);
      } else {
        next.set(key, val);
      }
      if (key !== 'page') {
        next.set('page', '1');
      }
      return next;
    });
  };

  const handlePageChange = (newPage) => {
    setParam('page', String(newPage));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Layout>
      <div className="container section">
        <div className={styles.header}>
          <h1 className={styles.title}>All Products</h1>
          <p className={styles.count}>
            Showing {Math.min((currentPage - 1) * 24 + 1, meta.total || 0)}–{Math.min(currentPage * 24, meta.total || 0)} of {meta.total || liveProducts.length} products
          </p>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            className={styles.searchInput}
            aria-label="Search products"
          />
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={(e) => setParam('sort', e.target.value)}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className={styles.priceRange}>
            <input
              type="number" placeholder="Min ₹" min={0}
              value={minPrice}
              onChange={(e) => setParam('minPrice', e.target.value)}
              className={styles.priceInput}
            />
            <span>–</span>
            <input
              type="number" placeholder="Max ₹" min={0}
              value={maxPrice}
              onChange={(e) => setParam('maxPrice', e.target.value)}
              className={styles.priceInput}
            />
          </div>
        </div>

        <ProductGrid products={liveProducts} loading={loading} />

        {/* Scalable Server Pagination Component */}
        {!loading && meta.totalPages > 1 && (
          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={meta.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Shop;
`;

fs.writeFileSync(shopPath, newShopCode, 'utf8');
console.log('✅ Shop/index.jsx updated with true server-side pagination');

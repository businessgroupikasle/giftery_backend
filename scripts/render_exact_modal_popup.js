import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const psPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');

const exactModalProductsSectionCode = `import BulkImportModal from './BulkImportModal';
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
    if (resetProductForm) resetProductForm();
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
    if (!productForm?.categoryId) return [];
    const matchedMain = categories.find(c => c.id === productForm.categoryId || c.slug === productForm.categoryId);
    const mainId = matchedMain ? matchedMain.id : productForm.categoryId;
    return categories.filter(c => c.parentId === mainId);
  }, [categories, productForm?.categoryId]);

  // Handle direct file upload for an image slot
  const handleSlotFileUpload = (file, idx) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result;
      if (!dataUrl) return;

      const parsed = parseImages(productForm?.images);
      const updated = [...parsed];
      while (updated.length <= idx) updated.push('');

      try {
        const res = await axiosInstance.post('/uploads', { image: dataUrl });
        const uploadedUrl = res.data?.url || res.url || res.data?.data?.url;
        if (uploadedUrl) {
          updated[idx] = uploadedUrl;
          if (handleProductFormChange) {
            handleProductFormChange({ target: { name: 'images', value: updated.filter(Boolean).join('|||') } });
          }
          toast.success('Image uploaded successfully!');
          return;
        }
      } catch (err) {
        console.warn('Backend image upload note:', err.message);
      }

      updated[idx] = dataUrl;
      if (handleProductFormChange) {
        handleProductFormChange({ target: { name: 'images', value: updated.filter(Boolean).join('|||') } });
      }
    };
    reader.readAsDataURL(file);
  };

  const totalPages = meta.totalPages || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner: Title, Category Filter Pills, Searchbar, Bulk Import & Add Button */}
      <div className={styles.cardContainer} style={{ background: '#ffffff', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 className={styles.cardTitle} style={{ fontSize: '1.2rem', color: '#0f172a', margin: 0 }}>
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
                {activeCategoryFilter === 'all' && !debouncedSearch ? (meta.total || 0) : (meta.total || 0)}
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

          {/* Action Buttons: Bulk Import & Add Single Product */}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowBulkImportModal(true)}
              style={{
                background: '#ffffff',
                border: '1.5px solid #d99b26',
                color: '#92400e',
                fontWeight: '700',
                fontSize: '0.85rem',
                padding: '0.52rem 1.1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 6px rgba(217, 155, 38, 0.15)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              title="Bulk import products from Excel (.xlsx) or ZIP package with images"
            >
              <span style={{ fontSize: '1rem' }}>📥</span>
              <span>Bulk Import</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMaxSlots(1);
                if (handleOpenAddProduct) handleOpenAddProduct();
              }}
              style={{
                background: 'linear-gradient(135deg, #d99b26, #b45309)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.85rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 6px rgba(217, 155, 38, 0.3)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>+ Add Product</span>
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

      {/* Bulk Import Modal Window */}
      {showBulkImportModal && (
        <BulkImportModal
          isOpen={showBulkImportModal}
          categories={categories}
          onClose={() => setShowBulkImportModal(false)}
          onImportSuccess={() => {
            fetchPageProducts();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* ── EXACT POPUP MODAL WINDOW (Matching User Image Specification) ── */}
      {showProductForm && productForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '1.75rem',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
          }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  fontSize: '1rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={async (e) => {
              if (handleProductSubmit) await handleProductSubmit(e);
              fetchPageProducts();
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Row 1: Product Name & SKU */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={productForm.name || ''}
                    onChange={handleProductFormChange}
                    placeholder="e.g. Premium Gift Hamper"
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    SKU
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={productForm.sku || ''}
                    onChange={handleProductFormChange}
                    placeholder="e.g. GH-2024-001"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 2: Price, Compare Price, Stock Qty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={productForm.price || ''}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    required
                    placeholder="999"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Compare Price (₹)
                  </label>
                  <input
                    type="number"
                    name="comparePrice"
                    value={productForm.comparePrice || ''}
                    onChange={handleProductFormChange}
                    min="0"
                    step="0.01"
                    placeholder="1299"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Stock Qty *
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={productForm.stock !== undefined ? productForm.stock : '0'}
                    onChange={handleProductFormChange}
                    min="0"
                    placeholder="0"
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row 3: Main Category & Subcategory */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Main Category *
                  </label>
                  <select
                    name="categoryId"
                    value={productForm.categoryId || ''}
                    onChange={(e) => {
                      if (handleProductFormChange) {
                        handleProductFormChange({ target: { name: 'categoryId', value: e.target.value } });
                        handleProductFormChange({ target: { name: 'subCategoryId', value: '' } });
                      }
                    }}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="">Select Main Category</option>
                    {mainCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Subcategory (Optional)
                  </label>
                  <select
                    name="subCategoryId"
                    value={productForm.subCategoryId || ''}
                    onChange={handleProductFormChange}
                    disabled={!productForm.categoryId || availableSubcategories.length === 0}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', cursor: 'pointer' }}
                  >
                    <option value="">— Select Subcategory (Optional) —</option>
                    {availableSubcategories.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Description *
                </label>
                <textarea
                  name="description"
                  rows="3"
                  value={productForm.description || ''}
                  onChange={handleProductFormChange}
                  required
                  placeholder="Describe the product in detail..."
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {/* Row 5: Specifications */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Specifications <span style={{ fontWeight: 400, color: '#64748b' }}>(Key: Value pairs)</span>
                </label>
                <textarea
                  name="specifications"
                  rows="3"
                  value={productForm.specifications || ''}
                  onChange={handleProductFormChange}
                  placeholder={"Material: Genuine Leather\\nDimensions: 15cm x 10cm\\nColor: Matte Black"}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {/* Row 6: Product Tags & Search Keywords */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                  Product Tags & Search Keywords <span style={{ fontWeight: 400, color: '#64748b' }}>(Comma separated, e.g. luxury, leather, onboarding, office)</span>
                </label>
                <input
                  type="text"
                  name="tags"
                  value={Array.isArray(productForm.tags) ? productForm.tags.join(', ') : (productForm.tags || '')}
                  onChange={handleProductFormChange}
                  placeholder="e.g. luxury, leather, onboarding, corporate gift, bottle"
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                />
              </div>

              {/* Row 7: Product Images & "+ Add More Image Slot" */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155' }}>
                    Product Images
                  </label>
                  <button
                    type="button"
                    onClick={() => setMaxSlots(prev => prev + 1)}
                    style={{ background: 'none', border: 'none', color: '#d97706', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    + Add More Image Slot
                  </button>
                </div>

                {(() => {
                  const parsedImgs = parseImages(productForm.images);
                  const slotCount = Math.max(maxSlots, parsedImgs.length || 1);
                  const slots = Array.from({ length: slotCount }).map((_, idx) => parsedImgs[idx] || '');

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
                      {slots.map((url, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: '110px',
                            height: '110px',
                            background: '#f8fafc',
                            border: '1.5px dashed #cbd5e1',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {url ? (
                            <>
                              <img
                                src={url}
                                alt={\`Slot \${idx + 1}\`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...slots];
                                  updated.splice(idx, 1);
                                  if (handleProductFormChange) {
                                    handleProductFormChange({ target: { name: 'images', value: updated.filter(Boolean).join('|||') } });
                                  }
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  right: '4px',
                                  background: 'rgba(220, 38, 38, 0.85)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '0.7rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer', padding: '0.5rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>+ Upload Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleSlotFileUpload(e.target.files[0], idx);
                                  }
                                }}
                                style={{ display: 'none' }}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Row 8: Collections & Visibility Checkboxes Card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>
                  Show Product on Homepage Tabs & Store Collections:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {/* Col 1 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isFeatured"
                      checked={!!productForm.isFeatured || !!productForm.featured}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    Featured Products
                  </label>

                  {/* Col 2 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isBestseller"
                      checked={!!productForm.isBestseller}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    Best Sellers
                  </label>

                  {/* Col 3 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isPopular"
                      checked={!!productForm.isPopular}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    Popular Products
                  </label>

                  {/* Col 1 Row 2 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isNewArrival"
                      checked={!!productForm.isNewArrival}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    New Arrivals
                  </label>

                  {/* Col 2 Row 2 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isMostLoved"
                      checked={!!productForm.isMostLoved}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    Most Loved
                  </label>

                  {/* Col 3 Row 2 */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    <input
                      type="checkbox"
                      name="isGiftSet"
                      checked={!!productForm.isGiftSet}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#d99b26' }}
                    />
                    Gift Sets
                  </label>

                  {/* Active Store Visible */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#059669', gridColumn: '1 / -1' }}>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={productForm.isActive !== false}
                      onChange={handleProductFormChange}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#059669' }}
                    />
                    Active (Store Visible)
                  </label>
                </div>
              </div>

              {/* Row 9: Footer Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: '#475569',
                    fontSize: '0.85rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  style={{
                    padding: '0.65rem 1.75rem',
                    background: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                  }}
                >
                  {savingProduct ? 'Saving...' : (editingProduct ? 'Update Product' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className={styles.cardContainer} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
          Loading products from database...
        </div>
      )}

      {/* Empty State (Matching User Image 2) */}
      {!loading && pageProducts.length === 0 && (
        <div className={styles.cardContainer} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
          <p style={{ fontSize: '1rem', margin: 0 }}>No products found matching your search/category filter.</p>
          <button
            type="button"
            onClick={() => {
              setMaxSlots(1);
              if (handleOpenAddProduct) handleOpenAddProduct();
            }}
            style={{ marginTop: '0.75rem', padding: '0.5rem 1.2rem', background: '#d99b26', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
          >
            + Add Product
          </button>
        </div>
      )}

      {/* Products Table (ordersTable styling from original dashboard) */}
      {!loading && pageProducts.length > 0 && (
        <div className={styles.cardContainer} style={{ overflowX: 'auto', padding: 0, borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <table className={styles.ordersTable}>
            <thead>
              <tr>
                <th>Image</th>
                <th>Product Name</th>
                <th>Main Category</th>
                <th>Subcategory</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageProducts.map((product) => {
                const mainCatName = resolveMainCategoryName(product, categories);
                const subCatName = resolveSubCategoryName(product, categories);

                return (
                  <tr key={product.id}>
                    <td>
                      <img
                        src={getProductThumbnail(product)}
                        alt={product.name}
                        style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                        onError={(e) => { e.currentTarget.src = '/placeholder-product.png'; }}
                      />
                    </td>
                    <td>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>{product.name}</strong>
                      {product.sku && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>SKU: {product.sku}</span>}
                    </td>
                    <td>
                      <span style={{ background: '#fffcf5', color: '#92400e', border: '1px solid #fde68a', padding: '0.2rem 0.65rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' }}>
                        {mainCatName}
                      </span>
                    </td>
                    <td>
                      {subCatName ? (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '600' }}>
                          {subCatName}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>None</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: '#d99b26', fontSize: '0.9rem' }}>₹{product.price?.toLocaleString('en-IN')}</strong>
                      {product.comparePrice && <div style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through' }}>₹{product.comparePrice?.toLocaleString('en-IN')}</div>}
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: product.stock > 10 ? '#16a34a' : product.stock > 0 ? '#ea580c' : '#dc2626' }}>
                        {product.stock}
                      </span>
                    </td>
                    <td>
                      <span className={\`\${styles.pillStatus} \${product.isActive ? styles.pillDelivered : styles.pillCancelled}\`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (handleEditProductClick) handleEditProductClick(product);
                          }}
                          style={{ padding: '0.35rem 0.75rem', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (handleDeleteProduct) await handleDeleteProduct(product.id, product.name);
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

fs.writeFileSync(psPath, exactModalProductsSectionCode, 'utf8');
console.log('✅ ProductsSection.jsx updated with the exact modal popup window matching the user screenshot');

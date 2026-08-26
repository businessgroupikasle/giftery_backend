import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// 1. Update Dashboard/index.jsx to fetch limit=1000
const dashboardIndexPath = path.join(frontendDir, 'src/pages/Dashboard/index.jsx');
let dashContent = fs.readFileSync(dashboardIndexPath, 'utf8');

dashContent = dashContent.replace(
  "const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=200&showAll=true');",
  "const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000&showAll=true');"
);
dashContent = dashContent.replace(
  "const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=100&showAll=true');",
  "const res = await axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000&showAll=true');"
);

fs.writeFileSync(dashboardIndexPath, dashContent, 'utf8');
console.log('✅ Updated Dashboard/index.jsx to fetch limit=1000');

// 2. Update ProductsSection.jsx
const productsSectionPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(productsSectionPath, 'utf8');

// Add activeSubCategoryFilter state
if (!psContent.includes('activeSubCategoryFilter')) {
  psContent = psContent.replace(
    "const [activeCategoryFilter, setActiveCategoryFilter] = useState('all'); // 'all' | mainCategoryId | 'unassigned'",
    `const [activeCategoryFilter, setActiveCategoryFilter] = useState('all'); // 'all' | mainCategoryId | 'unassigned'
  const [activeSubCategoryFilter, setActiveSubCategoryFilter] = useState('all');`
  );
}

// Update filteredProducts calculation to support subcategory filtering
const targetFilteredMemo = `  // Filtered Products List for Table View
  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      // Category filter
      if (activeCategoryFilter !== 'all') {
        const pMainId = resolveMainCategoryId(p, categories);
        if (pMainId !== activeCategoryFilter) return false;
      }

      // Search text filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const tagsStr = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
      const subName = resolveSubCategoryName(p, categories) || '';
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
        subName.toLowerCase().includes(q) ||
        tagsStr.toLowerCase().includes(q)
      );
    });
  }, [productsList, categories, activeCategoryFilter, searchQuery]);`;

const replacementFilteredMemo = `  // Filtered Products List for Table View (Main Category + Subcategory Filtering)
  const filteredProducts = useMemo(() => {
    return productsList.filter(p => {
      // 1. Main Category filter
      if (activeCategoryFilter !== 'all') {
        const pMainId = resolveMainCategoryId(p, categories);
        if (pMainId !== activeCategoryFilter) return false;

        // 2. Subcategory filter within selected Main Category
        if (activeSubCategoryFilter !== 'all') {
          const subId = p.subCategoryId || (p.category?.parentId ? p.category.id : null);
          const subName = resolveSubCategoryName(p, categories);
          const matchesSub =
            subId === activeSubCategoryFilter ||
            (subName && String(subName).toLowerCase().trim() === String(activeSubCategoryFilter).toLowerCase().trim());
          if (!matchesSub) return false;
        }
      }

      // 3. Search text filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const tagsStr = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags || '');
      const subName = resolveSubCategoryName(p, categories) || '';
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
        subName.toLowerCase().includes(q) ||
        tagsStr.toLowerCase().includes(q)
      );
    });
  }, [productsList, categories, activeCategoryFilter, activeSubCategoryFilter, searchQuery]);`;

psContent = psContent.replace(targetFilteredMemo, replacementFilteredMemo);

// Add dynamic Subcategory Chips UI right below the Main Category pills
const targetMainCatButtons = `            {/* Main Category Filter Pills */}
            {mainCategoryGroups.map(group => {`;

const subCatsSnippet = `            {/* Main Category Filter Pills */}
            {mainCategoryGroups.map(group => {`;

// Also check where subcategories row should be rendered
const subCategoryChipsRow = `
          {/* Subcategories Filter Chips (Shown when a Main Category is active) */}
          {activeCategoryFilter !== 'all' && activeCategoryFilter !== 'unassigned' && (() => {
            const subCatsForActive = categories.filter(c => c.parentId === activeCategoryFilter);
            if (subCatsForActive.length === 0) return null;

            const activeMainProducts = productsList.filter(p => resolveMainCategoryId(p, categories) === activeCategoryFilter);

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                flexWrap: 'wrap',
                width: '100%',
                marginTop: '0.85rem',
                paddingTop: '0.85rem',
                borderTop: '1px dashed #e2e8f0',
              }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginRight: '0.3rem' }}>
                  Subcategories:
                </span>

                {/* 'All Subcategories' chip */}
                <button
                  type="button"
                  onClick={() => setActiveSubCategoryFilter('all')}
                  style={{
                    background: activeSubCategoryFilter === 'all' ? '#1e293b' : '#f1f5f9',
                    color: activeSubCategoryFilter === 'all' ? '#ffffff' : '#475569',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>All</span>
                  <span style={{
                    background: activeSubCategoryFilter === 'all' ? '#334155' : '#cbd5e1',
                    color: activeSubCategoryFilter === 'all' ? '#ffffff' : '#334155',
                    fontSize: '0.68rem',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '8px',
                  }}>
                    {activeMainProducts.length}
                  </span>
                </button>

                {/* Individual Subcategory chips */}
                {subCatsForActive.map(subCat => {
                  const isSubActive = activeSubCategoryFilter === subCat.id || activeSubCategoryFilter === subCat.name;
                  const countForSub = activeMainProducts.filter(p => {
                    const sId = p.subCategoryId || (p.category?.parentId ? p.category.id : null);
                    const sName = resolveSubCategoryName(p, categories);
                    return sId === subCat.id || (sName && sName.toLowerCase().trim() === subCat.name.toLowerCase().trim());
                  }).length;

                  return (
                    <button
                      key={subCat.id}
                      type="button"
                      onClick={() => setActiveSubCategoryFilter(isSubActive ? 'all' : subCat.id)}
                      style={{
                        background: isSubActive ? '#2563eb' : '#eff6ff',
                        color: isSubActive ? '#ffffff' : '#1d4ed8',
                        border: isSubActive ? '1px solid #1d4ed8' : '1px solid #bfdbfe',
                        borderRadius: '14px',
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{subCat.name}</span>
                      <span style={{
                        background: isSubActive ? '#1d4ed8' : '#dbeafe',
                        color: isSubActive ? '#ffffff' : '#1e40af',
                        fontSize: '0.68rem',
                        padding: '0.05rem 0.35rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                      }}>
                        {countForSub}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}`;

// Replace when active category button is clicked to also reset subcategory filter
psContent = psContent.replace(
  "onClick={() => setActiveCategoryFilter('all')}",
  "onClick={() => { setActiveCategoryFilter('all'); setActiveSubCategoryFilter('all'); }}"
);

psContent = psContent.replace(
  "onClick={() => setActiveCategoryFilter(isSelected ? 'all' : group.mainCategory.id)}",
  "onClick={() => { setActiveCategoryFilter(isSelected ? 'all' : group.mainCategory.id); setActiveSubCategoryFilter('all'); }}"
);

// Inject subcategory chips row before the closing of header banner
const targetHeaderBannerClose = `          </div>

          {/* Right Side Corner Container: Searchbar & Add New Product Button */}`;

if (!psContent.includes('Subcategories Filter Chips')) {
  psContent = psContent.replace(
    targetHeaderBannerClose,
    `          </div>\n${subCategoryChipsRow}\n\n          {/* Right Side Corner Container: Searchbar & Add New Product Button */}`
  );
}

fs.writeFileSync(productsSectionPath, psContent, 'utf8');
console.log('✅ Updated ProductsSection.jsx with dynamic subcategory filter chips and hierarchical filtering');

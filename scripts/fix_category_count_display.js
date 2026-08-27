import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// 1. Fix Dashboard/index.jsx fetchCategories
const dashPath = path.join(frontendDir, 'src/pages/Dashboard/index.jsx');
let dashContent = fs.readFileSync(dashPath, 'utf8');

const targetFetchCategories = `  const fetchCategories = async () => {
    let apiCats = [];
    try {
      const res = await axiosInstance.get(ENDPOINTS.CATEGORIES.LIST);
      const data = res.data || res;
      if (data && Array.isArray(data.categories)) apiCats = data.categories;
      else if (Array.isArray(data.data)) apiCats = data.data;
      else if (Array.isArray(data)) apiCats = data;
    } catch (err) {
      console.warn('Categories fetch error:', err.message);
    } finally {
      const localCats = JSON.parse(localStorage.getItem('giftery_categories') || '[]');
      const merged = [...localCats];
      apiCats.forEach(ac => {
        if (!merged.find(m => m.id === ac.id || m.slug === ac.slug)) {
          merged.push(ac);
        }
      });
      setCategories(merged);
    }
  };`;

const newFetchCategories = `  const fetchCategories = async () => {
    let apiCats = [];
    try {
      const res = await axiosInstance.get(ENDPOINTS.CATEGORIES.LIST);
      if (Array.isArray(res)) apiCats = res;
      else if (Array.isArray(res?.categories)) apiCats = res.categories;
      else if (Array.isArray(res?.data?.categories)) apiCats = res.data.categories;
      else if (Array.isArray(res?.data)) apiCats = res.data;
    } catch (err) {
      console.warn('Categories fetch error:', err.message);
    }

    if (apiCats.length > 0) {
      setCategories(apiCats);
      localStorage.setItem('giftery_categories', JSON.stringify(apiCats));
    } else {
      const localCats = JSON.parse(localStorage.getItem('giftery_categories') || '[]');
      setCategories(localCats);
    }
  };`;

dashContent = dashContent.replace(targetFetchCategories, newFetchCategories);
fs.writeFileSync(dashPath, dashContent, 'utf8');
console.log('✅ Dashboard/index.jsx fetchCategories updated to parse API response accurately');

// 2. Fix ProductsSection.jsx to fetch/refresh categories and calculate accurate live counts
const psPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(psPath, 'utf8');

// Ensure ProductsSection has internal live categories state synced with backend API
psContent = psContent.replace(
  'const ProductsSection = ({\n  categories = [],',
  `const ProductsSection = ({\n  categories: initialCategories = [],`
);

psContent = psContent.replace(
  'const [maxSlots, setMaxSlots] = useState(1);',
  `const [categories, setCategories] = useState(initialCategories);
  const [maxSlots, setMaxSlots] = useState(1);

  // Fetch live categories with accurate DB product counts
  const refreshCategories = useCallback(async () => {
    try {
      const res = await axiosInstance.get(ENDPOINTS.CATEGORIES.LIST);
      let apiCats = [];
      if (Array.isArray(res)) apiCats = res;
      else if (Array.isArray(res?.categories)) apiCats = res.categories;
      else if (Array.isArray(res?.data?.categories)) apiCats = res.data.categories;
      else if (Array.isArray(res?.data)) apiCats = res.data;
      if (apiCats.length > 0) {
        setCategories(apiCats);
      }
    } catch (e) {
      console.warn('Failed to refresh category counts:', e.message);
    }
  }, []);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
    }
  }, [initialCategories]);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);`
);

// In categoryStats:
const oldStats = `  const categoryStats = useMemo(() => {
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
  }, [categories, meta.total]);`;

const newStats = `  const categoryStats = useMemo(() => {
    let totalCount = 0;
    const mainCountMap = {};

    categories.forEach(c => {
      const pCount = c._count?.products || (c.products ? c.products.length : 0);
      if (c.parentId) {
        mainCountMap[c.parentId] = (mainCountMap[c.parentId] || 0) + pCount;
      } else {
        mainCountMap[c.id] = (mainCountMap[c.id] || 0) + pCount;
        mainCountMap[c.name?.toLowerCase()] = (mainCountMap[c.name?.toLowerCase()] || 0) + pCount;
        mainCountMap[c.slug] = (mainCountMap[c.slug] || 0) + pCount;
        totalCount += pCount;
      }
    });

    return { total: totalCount || meta.total || 0, mainCountMap };
  }, [categories, meta.total]);`;

psContent = psContent.replace(oldStats, newStats);

// In mainCategories button render:
psContent = psContent.replace(
  `{isActive ? (meta.total || 0) : catCount}`,
  `{isActive && !debouncedSearch ? (meta.total || catCount) : catCount}`
);

fs.writeFileSync(psPath, psContent, 'utf8');
console.log('✅ ProductsSection.jsx updated with live category count syncing');

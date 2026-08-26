import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// =========================================================================
// 1. UPDATE CorporateGifts/index.jsx -> Pure DB Category Relationships
// =========================================================================
const corpPath = path.join(frontendDir, 'src/pages/CorporateGifts/index.jsx');
let corpContent = fs.readFileSync(corpPath, 'utf8');

const targetCorpEffect = `  useEffect(() => {
    const fetchLiveProducts = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000'),
          axiosInstance.get(ENDPOINTS.CATEGORIES.LIST),
        ]);

        let allCats = [];
        if (catRes.status === 'fulfilled') {
          const cData = catRes.value?.data?.categories || catRes.value?.categories || catRes.value?.data || [];
          if (Array.isArray(cData)) allCats = cData;
        }
        setCategoriesList(allCats);

        const catIdMap = new Map(allCats.map(c => [c.id, c]));

        // 1. Identify Corporate Gifts Main Category and its Subcategories using pure DB relationships
        const corpMainCat = allCats.find(c =>
          !c.parentId && (
            c.slug === 'corporate-gifts' ||
            c.name.toLowerCase().trim() === 'corporate gifts'
          )
        );
        const corpMainCatId = corpMainCat ? corpMainCat.id : null;
        const corpSubCats = allCats.filter(c => corpMainCatId && c.parentId === corpMainCatId);
        const corpSubCatIds = new Set(corpSubCats.map(c => c.id));

        let extracted = [];
        if (prodRes.status === 'fulfilled') {
          const res = prodRes.value;
          if (Array.isArray(res)) extracted = res;
          else if (res?.data && Array.isArray(res.data)) extracted = res.data;
          else if (res?.data?.data && Array.isArray(res.data.data)) extracted = res.data.data;
          else if (res?.data?.products && Array.isArray(res.data.products)) extracted = res.data.products;
          else if (res?.products && Array.isArray(res.products)) extracted = res.products;
        }

        const formatted = extracted
          .filter(p => {
            // DATABASE CATEGORY RELATIONSHIPS (NO keyword matching)
            const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
            const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);
            const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);

            // A product belongs to Corporate Gifts if:
            if (corpMainCatId && prodCatId === corpMainCatId) return true;
            if (corpMainCatId && pCatObj?.parentId === corpMainCatId) return true;
            if (prodSubId && corpSubCatIds.has(prodSubId)) return true;
            if (prodCatId && corpSubCatIds.has(prodCatId)) return true;
            if (pCatObj?.slug === 'corporate-gifts' || pCatObj?.name?.toLowerCase().trim() === 'corporate gifts') return true;

            return false;
          })
          .map((p) => {
            const imgList = Array.isArray(p.images)
              ? p.images
              : (typeof p.images === 'string' ? p.images.split(',').map(s => s.trim()) : [p.image || '/placeholder.jpg']);

            const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
            const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);

            const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);
            const pSubObj = prodSubId ? catIdMap.get(prodSubId) : (pCatObj?.parentId ? pCatObj : null);

            const catName = corpMainCat?.name || pCatObj?.name || 'Corporate Gifts';
            const catSlug = corpMainCat?.slug || pCatObj?.slug || 'corporate-gifts';
            const subCatName = pSubObj?.name || '';
            const subCatSlug = pSubObj?.slug || '';

            return {
              id: p.id,
              name: p.name,
              price: p.price,
              comparePrice: p.comparePrice,
              stock: p.stock !== undefined ? p.stock : 0,
              rating: p.rating || 4.8,
              reviewsCount: p.reviewsCount || p._count?.reviews || 24,
              discount: p.comparePrice ? \`\${Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100)}%\` : null,
              images: imgList,
              image: imgList[0] || '/placeholder.jpg',
              slug: p.slug || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              categoryId: prodCatId,
              subCategoryId: pSubObj?.id || prodSubId || null,
              categoryName: catName,
              categorySlug: catSlug,
              subCategoryName: subCatName,
              subCategorySlug: subCatSlug,
              _catName: catName.toLowerCase(),
              _catSlug: catSlug.toLowerCase(),
              _subCatName: subCatName.toLowerCase(),
            };
          });

        setLiveProducts(formatted);
      } catch (err) {
        console.warn('Live Corporate Gifts fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveProducts();
    window.addEventListener('products_updated', fetchLiveProducts);
    return () => window.removeEventListener('products_updated', fetchLiveProducts);
  }, []);`;

const corpEffectRegex = /useEffect\(\(\) => \{\s*const fetchLiveProducts = async \(\) => \{[\s\S]*?return \(\) => window\.removeEventListener\('products_updated', fetchLiveProducts\);\s*\}, \[\]\);/;
corpContent = corpContent.replace(corpEffectRegex, targetCorpEffect);

// Update dynamicCategories in CorporateGifts/index.jsx
const corpDynRegex = /\/\/ ── Dynamic Subcategories built from real DB products ──[\s\S]*?return \[\{ id: 'all', name: 'All Products', count: liveProducts\.length \}, \.\.\.subList\];\s*\}\)\(\);/;

const targetCorpDyn = `// ── Dynamic Subcategories built from real DB products ──────────────
  const dynamicCategories = (() => {
    const corpMainCat = categoriesList.find(c =>
      !c.parentId && (
        c.slug === 'corporate-gifts' ||
        c.name.toLowerCase().trim() === 'corporate gifts'
      )
    );
    const dbSubCats = corpMainCat
      ? categoriesList.filter(c => c.parentId === corpMainCat.id)
      : [];

    const subMap = new Map();

    dbSubCats.forEach(s => {
      subMap.set(s.id, {
        id: s.id,
        slug: s.slug || s.id,
        name: s.name,
        count: 0,
      });
    });

    liveProducts.forEach(p => {
      const pSubId = p.subCategoryId;
      if (pSubId && subMap.has(pSubId)) {
        subMap.get(pSubId).count += 1;
      } else if (p.subCategorySlug) {
        for (const item of subMap.values()) {
          if (item.slug === p.subCategorySlug || item.name.toLowerCase() === p.subCategoryName?.toLowerCase()) {
            item.count += 1;
            break;
          }
        }
      }
    });

    const subList = Array.from(subMap.values());
    return [{ id: 'all', name: 'All Products', count: liveProducts.length }, ...subList];
  })();`;

corpContent = corpContent.replace(corpDynRegex, targetCorpDyn);

// Update filteredProducts category filter in CorporateGifts/index.jsx
const corpSubFilterRegex = /\/\/ 2\. Category \/ Subcategory Filter[\s\S]*?return false;\s*\}\s*\n\s*\/\/ 3\. Occasion Filter/;

const targetCorpSubFilter = `// 2. Category / Subcategory Filter using DB relations
      const activeCat = selectedCategory !== 'all' ? selectedCategory : activeSubCategory;
      if (activeCat !== 'all') {
        const catObj = categoriesForFilter.find(c => c.id === activeCat || c.slug === activeCat);
        const targetId = catObj?.id || activeCat;
        const targetSlug = (catObj?.slug || activeCat).toLowerCase();

        // Exact DB Subcategory ID match or slug match
        if (prod.subCategoryId && (prod.subCategoryId === targetId || prod.subCategoryId === targetSlug)) return true;
        if (prod.subCategorySlug && (prod.subCategorySlug.toLowerCase() === targetSlug || prod.subCategorySlug === targetId)) return true;
        if (prod.categoryId && prod.categoryId === targetId) return true;

        return false;
      }

      // 3. Occasion Filter`;

corpContent = corpContent.replace(corpSubFilterRegex, targetCorpSubFilter);
fs.writeFileSync(corpPath, corpContent, 'utf8');
console.log('✅ Standardized CorporateGifts/index.jsx with pure DB Category Relationships');

// =========================================================================
// 2. UPDATE PersonalizedGifts/index.jsx -> Pure DB Category Relationships
// =========================================================================
const persPath = path.join(frontendDir, 'src/pages/PersonalizedGifts/index.jsx');
let persContent = fs.readFileSync(persPath, 'utf8');

const targetPersEffect = `  useEffect(() => {
    const fetchLiveProducts = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000'),
          axiosInstance.get(ENDPOINTS.CATEGORIES.LIST),
        ]);

        let allCats = [];
        if (catRes.status === 'fulfilled') {
          const cData = catRes.value?.data?.categories || catRes.value?.categories || catRes.value?.data || [];
          if (Array.isArray(cData)) allCats = cData;
        }
        setCategoriesList(allCats);

        const catIdMap = new Map(allCats.map(c => [c.id, c]));

        // 1. Identify Personalized Gifts Main Category and its Subcategories using pure DB relationships
        const persMainCat = allCats.find(c =>
          !c.parentId && (
            c.slug === 'personalized-gifts' ||
            c.name.toLowerCase().trim() === 'personalized gifts'
          )
        );
        const persMainCatId = persMainCat ? persMainCat.id : null;
        const persSubCats = allCats.filter(c => persMainCatId && c.parentId === persMainCatId);
        const persSubCatIds = new Set(persSubCats.map(c => c.id));

        let extracted = [];
        if (prodRes.status === 'fulfilled') {
          const res = prodRes.value;
          if (Array.isArray(res)) extracted = res;
          else if (res?.data && Array.isArray(res.data)) extracted = res.data;
          else if (res?.data?.data && Array.isArray(res.data.data)) extracted = res.data.data;
          else if (res?.data?.products && Array.isArray(res.data.products)) extracted = res.data.products;
          else if (res?.products && Array.isArray(res.products)) extracted = res.products;
        }

        const formatted = extracted
          .filter(p => {
            // DATABASE CATEGORY RELATIONSHIPS (NO keyword matching)
            const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
            const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);
            const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);

            // A product belongs to Personalized Gifts if:
            if (persMainCatId && prodCatId === persMainCatId) return true;
            if (persMainCatId && pCatObj?.parentId === persMainCatId) return true;
            if (prodSubId && persSubCatIds.has(prodSubId)) return true;
            if (prodCatId && persSubCatIds.has(prodCatId)) return true;
            if (pCatObj?.slug === 'personalized-gifts' || pCatObj?.name?.toLowerCase().trim() === 'personalized gifts') return true;

            return false;
          })
          .map((p) => {
            const imgList = Array.isArray(p.images)
              ? p.images
              : (typeof p.images === 'string' ? p.images.split(',').map(s => s.trim()) : [p.image || '/placeholder.jpg']);

            const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
            const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);

            const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);
            const pSubObj = prodSubId ? catIdMap.get(prodSubId) : (pCatObj?.parentId ? pCatObj : null);

            const catName = persMainCat?.name || pCatObj?.name || 'Personalized Gifts';
            const catSlug = persMainCat?.slug || pCatObj?.slug || 'personalized-gifts';
            const subCatName = pSubObj?.name || '';
            const subCatSlug = pSubObj?.slug || '';

            return {
              id: p.id,
              name: p.name,
              price: p.price,
              comparePrice: p.comparePrice,
              stock: p.stock !== undefined ? p.stock : 0,
              rating: p.rating || 4.8,
              reviewsCount: p.reviewsCount || p._count?.reviews || 24,
              discount: p.comparePrice ? \`\${Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100)}%\` : null,
              images: imgList,
              image: imgList[0] || '/placeholder.jpg',
              slug: p.slug || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              categoryId: prodCatId,
              subCategoryId: pSubObj?.id || prodSubId || null,
              categoryName: catName,
              categorySlug: catSlug,
              subCategoryName: subCatName,
              subCategorySlug: subCatSlug,
              _catName: catName.toLowerCase(),
              _catSlug: catSlug.toLowerCase(),
              _subCatName: subCatName.toLowerCase(),
            };
          });

        setLiveProducts(formatted);
      } catch (err) {
        console.warn('Live Personalized Gifts fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveProducts();
    window.addEventListener('products_updated', fetchLiveProducts);
    return () => window.removeEventListener('products_updated', fetchLiveProducts);
  }, []);`;

const persEffectRegex = /useEffect\(\(\) => \{\s*const fetchLiveProducts = async \(\) => \{[\s\S]*?return \(\) => window\.removeEventListener\('products_updated', fetchLiveProducts\);\s*\}, \[\]\);/;
persContent = persContent.replace(persEffectRegex, targetPersEffect);

// Update dynamicCategories in PersonalizedGifts/index.jsx
const persDynRegex = /\/\/ ── Dynamic Subcategories built from real DB products ──[\s\S]*?return \[\{ id: 'all', name: 'All Personalized Gifts', count: liveProducts\.length \}, \.\.\.subList\];\s*\}\)\(\);/;

const targetPersDyn = `// ── Dynamic Subcategories built from real DB products ──────────────
  const dynamicCategories = (() => {
    const persMainCat = categoriesList.find(c =>
      !c.parentId && (
        c.slug === 'personalized-gifts' ||
        c.name.toLowerCase().trim() === 'personalized gifts'
      )
    );
    const dbSubCats = persMainCat
      ? categoriesList.filter(c => c.parentId === persMainCat.id)
      : [];

    const subMap = new Map();

    dbSubCats.forEach(s => {
      subMap.set(s.id, {
        id: s.id,
        slug: s.slug || s.id,
        name: s.name,
        count: 0,
      });
    });

    liveProducts.forEach(p => {
      const pSubId = p.subCategoryId;
      if (pSubId && subMap.has(pSubId)) {
        subMap.get(pSubId).count += 1;
      } else if (p.subCategorySlug) {
        for (const item of subMap.values()) {
          if (item.slug === p.subCategorySlug || item.name.toLowerCase() === p.subCategoryName?.toLowerCase()) {
            item.count += 1;
            break;
          }
        }
      }
    });

    const subList = Array.from(subMap.values());
    return [{ id: 'all', name: 'All Personalized Gifts', count: liveProducts.length }, ...subList];
  })();`;

persContent = persContent.replace(persDynRegex, targetPersDyn);

// Update filteredProducts category filter in PersonalizedGifts/index.jsx
const persSubFilterRegex = /\/\/ 2\. Category \/ Subcategory Filter[\s\S]*?return false;\s*\}\s*\n\s*\/\/ 3\. Occasion Filter/;

const targetPersSubFilter = `// 2. Category / Subcategory Filter using DB relations
      const activeCat = selectedCategory !== 'all' ? selectedCategory : activeSubCategory;
      if (activeCat !== 'all') {
        const catObj = categoriesForFilter.find(c => c.id === activeCat || c.slug === activeCat);
        const targetId = catObj?.id || activeCat;
        const targetSlug = (catObj?.slug || activeCat).toLowerCase();

        // Exact DB Subcategory ID match or slug match
        if (prod.subCategoryId && (prod.subCategoryId === targetId || prod.subCategoryId === targetSlug)) return true;
        if (prod.subCategorySlug && (prod.subCategorySlug.toLowerCase() === targetSlug || prod.subCategorySlug === targetId)) return true;
        if (prod.categoryId && prod.categoryId === targetId) return true;

        return false;
      }

      // 3. Occasion Filter`;

persContent = persContent.replace(persSubFilterRegex, targetPersSubFilter);
fs.writeFileSync(persPath, persContent, 'utf8');
console.log('✅ Standardized PersonalizedGifts/index.jsx with pure DB Category Relationships');

// =========================================================================
// 3. UPDATE Categories/index.jsx -> limit=1000 & DB slug match
// =========================================================================
const categoriesPath = path.join(frontendDir, 'src/pages/Categories/index.jsx');
let categoriesContent = fs.readFileSync(categoriesPath, 'utf8');
categoriesContent = categoriesContent.replace("axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=200')", "axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000')");
categoriesContent = categoriesContent.replace("axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=100')", "axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000')");

// Also in Categories/index.jsx, when slug is present, filter by DB category slug and parentId
const targetCatFilter = `  const products = slug
    ? liveProducts.filter(p => {
        const pCatSlug = p.category?.slug || p.categorySlug;
        const pCatParentSlug = p.category?.parent?.slug;
        return pCatSlug === slug || pCatParentSlug === slug;
      })
    : liveProducts;`;

categoriesContent = categoriesContent.replace('const products = liveProducts;', targetCatFilter);
fs.writeFileSync(categoriesPath, categoriesContent, 'utf8');
console.log('✅ Updated Categories/index.jsx');

// =========================================================================
// 4. UPDATE Shop/index.jsx -> limit=1000
// =========================================================================
const shopPath = path.join(frontendDir, 'src/pages/Shop/index.jsx');
let shopContent = fs.readFileSync(shopPath, 'utf8');
shopContent = shopContent.replace("axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=200')", "axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000')");
shopContent = shopContent.replace("axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=100')", "axiosInstance.get(ENDPOINTS.PRODUCTS.LIST + '?limit=1000')");
fs.writeFileSync(shopPath, shopContent, 'utf8');
console.log('✅ Updated Shop/index.jsx');

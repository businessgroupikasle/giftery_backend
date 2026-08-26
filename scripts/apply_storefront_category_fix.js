import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// Clean replacement for fetchLiveProducts in Toys/index.jsx
const toysPath = path.join(frontendDir, 'src/pages/Toys/index.jsx');
let toysContent = fs.readFileSync(toysPath, 'utf8');

const targetEffect = `  useEffect(() => {
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

        // 1. Identify Toys Main Category and its Subcategories using pure DB relationships
        const toysMainCat = allCats.find(c =>
          !c.parentId && (
            c.slug === 'toys' ||
            c.slug.includes('toy') ||
            c.name.toLowerCase().trim() === 'toys' ||
            c.name.toLowerCase().includes('toy')
          )
        );
        const toysMainCatId = toysMainCat ? toysMainCat.id : null;
        const toysSubCats = allCats.filter(c => toysMainCatId && c.parentId === toysMainCatId);
        const toysSubCatIds = new Set(toysSubCats.map(c => c.id));

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
            // DATABASE CATEGORY RELATIONSHIPS (NO generic keyword matching)
            const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
            const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);
            const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);

            // A product belongs to Toys if:
            // 1. Product's categoryId is the Toys Main Category
            if (toysMainCatId && prodCatId === toysMainCatId) return true;
            // 2. Product's category is a subcategory of Toys (parentId matches Toys Main Category)
            if (toysMainCatId && pCatObj?.parentId === toysMainCatId) return true;
            // 3. Product's subCategoryId matches one of Toys subcategories
            if (prodSubId && toysSubCatIds.has(prodSubId)) return true;
            // 4. Product's categoryId matches one of Toys subcategories
            if (prodCatId && toysSubCatIds.has(prodCatId)) return true;
            // 5. Explicit Toys slug/name match on Category object
            if (pCatObj?.slug === 'toys' || pCatObj?.name?.toLowerCase().trim() === 'toys') return true;

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

            const catName = toysMainCat?.name || pCatObj?.name || 'Toys';
            const catSlug = toysMainCat?.slug || pCatObj?.slug || 'toys';
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
        console.warn('Live Toys fetch note:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveProducts();
    window.addEventListener('products_updated', fetchLiveProducts);
    return () => window.removeEventListener('products_updated', fetchLiveProducts);
  }, []);`;

// Replace from `useEffect(() => { const fetchLiveProducts` to `}, []);`
const effectRegex = /useEffect\(\(\) => \{\s*const fetchLiveProducts = async \(\) => \{[\s\S]*?return \(\) => window\.removeEventListener\('products_updated', fetchLiveProducts\);\s*\}, \[\]\);/;

toysContent = toysContent.replace(effectRegex, targetEffect);
fs.writeFileSync(toysPath, toysContent, 'utf8');
console.log('✅ Cleaned up and updated Toys/index.jsx useEffect');

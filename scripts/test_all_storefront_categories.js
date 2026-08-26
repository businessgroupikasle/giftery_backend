import prisma from '../src/config/db.js';
import { productService } from '../src/services/productService.js';

async function testAllStorefrontCategories() {
  console.log('🚀 =============================================================');
  console.log('🚀 TESTING ALL STOREFRONT PAGES: PURE DB CATEGORY RELATIONSHIPS');
  console.log('🚀 =============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, msg = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} (${msg})`);
      failed++;
    }
  }

  const testSuffix = Date.now();

  // Find or create main categories
  async function getOrCreateMainCat(slug, name) {
    let cat = await prisma.category.findFirst({ where: { slug, parentId: null } });
    if (!cat) {
      cat = await prisma.category.create({
        data: { name, slug, description: `${name} Main Category` },
      });
    }
    return cat;
  }

  const corpMain = await getOrCreateMainCat('corporate-gifts', 'Corporate Gifts');
  const persMain = await getOrCreateMainCat('personalized-gifts', 'Personalized Gifts');
  const toysMain = await getOrCreateMainCat('toys', 'Toys');

  // Create subcategories
  const corpSub = await prisma.category.create({
    data: { name: `Executive Hamper ${testSuffix}`, slug: `exec-hamper-${testSuffix}`, parentId: corpMain.id },
  });
  const persSub = await prisma.category.create({
    data: { name: `Custom Photo Frame ${testSuffix}`, slug: `photo-frame-${testSuffix}`, parentId: persMain.id },
  });
  const toysSub = await prisma.category.create({
    data: { name: `Brain Teaser Puzzle ${testSuffix}`, slug: `puzzle-${testSuffix}`, parentId: toysMain.id },
  });

  // Create products with ambiguous names to test pure DB resolution
  const testSkus = [
    `CORP-ITEM-${testSuffix}`,
    `PERS-ITEM-${testSuffix}`,
    `TOY-ITEM-${testSuffix}`,
  ];

  await prisma.product.create({
    data: {
      name: 'Item Alpha - Neutral Title',
      slug: `item-alpha-${testSuffix}`,
      sku: testSkus[0],
      price: 1500,
      categoryId: corpMain.id,
      subCategoryId: corpSub.id,
      description: 'Test product for corporate gifts',
      stock: 10,
      isActive: true,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Item Beta - Neutral Title',
      slug: `item-beta-${testSuffix}`,
      sku: testSkus[1],
      price: 2000,
      categoryId: persMain.id,
      subCategoryId: persSub.id,
      description: 'Test product for personalized gifts',
      stock: 15,
      isActive: true,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Item Gamma - Neutral Title',
      slug: `item-gamma-${testSuffix}`,
      sku: testSkus[2],
      price: 999,
      categoryId: toysMain.id,
      subCategoryId: toysSub.id,
      description: 'Test product for toys',
      stock: 20,
      isActive: true,
    },
  });

  try {
    const [prodResult, allCats] = await Promise.all([
      productService.getAll({ page: '1', limit: '1000', showAll: 'true' }),
      prisma.category.findMany(),
    ]);

    const catIdMap = new Map(allCats.map(c => [c.id, c]));

    // Helper resolution replicating storefront components
    function resolveForMainCat(targetSlug, targetName) {
      const mainCat = allCats.find(c => !c.parentId && (c.slug === targetSlug || c.name.toLowerCase().trim() === targetName.toLowerCase().trim()));
      const mainCatId = mainCat ? mainCat.id : null;
      const subCats = allCats.filter(c => mainCatId && c.parentId === mainCatId);
      const subCatIds = new Set(subCats.map(c => c.id));

      return prodResult.data.filter(p => {
        const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
        const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);
        const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);

        if (mainCatId && prodCatId === mainCatId) return true;
        if (mainCatId && pCatObj?.parentId === mainCatId) return true;
        if (prodSubId && subCatIds.has(prodSubId)) return true;
        if (prodCatId && subCatIds.has(prodCatId)) return true;
        if (pCatObj?.slug === targetSlug || pCatObj?.name?.toLowerCase().trim() === targetName.toLowerCase().trim()) return true;

        return false;
      });
    }

    // 1. Test Corporate Gifts storefront
    const corpProds = resolveForMainCat('corporate-gifts', 'Corporate Gifts');
    const corpSkus = new Set(corpProds.map(p => p.sku));
    assert(corpSkus.has(testSkus[0]), 'Corporate Gifts storefront resolved Item Alpha strictly via DB relations');
    assert(!corpSkus.has(testSkus[1]) && !corpSkus.has(testSkus[2]), 'Corporate Gifts strictly excludes Personalized & Toys items');

    // 2. Test Personalized Gifts storefront
    const persProds = resolveForMainCat('personalized-gifts', 'Personalized Gifts');
    const persSkus = new Set(persProds.map(p => p.sku));
    assert(persSkus.has(testSkus[1]), 'Personalized Gifts storefront resolved Item Beta strictly via DB relations');
    assert(!persSkus.has(testSkus[0]) && !persSkus.has(testSkus[2]), 'Personalized Gifts strictly excludes Corporate & Toys items');

    // 3. Test Toys storefront
    const toysProds = resolveForMainCat('toys', 'Toys');
    const toysSkus = new Set(toysProds.map(p => p.sku));
    assert(toysSkus.has(testSkus[2]), 'Toys storefront resolved Item Gamma strictly via DB relations');
    assert(!toysSkus.has(testSkus[0]) && !toysSkus.has(testSkus[1]), 'Toys strictly excludes Corporate & Personalized items');

  } catch (err) {
    console.error('💥 Test error:', err);
    failed++;
  } finally {
    await prisma.product.deleteMany({ where: { sku: { in: testSkus } } });
    await prisma.category.deleteMany({ where: { id: { in: [corpSub.id, persSub.id, toysSub.id] } } });
    await prisma.$disconnect();
  }

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

testAllStorefrontCategories();

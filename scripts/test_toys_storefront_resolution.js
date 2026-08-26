import prisma from '../src/config/db.js';
import { productService } from '../src/services/productService.js';
import { slugify } from '../src/utils/slugify.js';

async function testToysStorefrontResolution() {
  console.log('🚀 =============================================================');
  console.log('🚀 TESTING TOYS STOREFRONT DATABASE CATEGORY RELATIONSHIPS');
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
  let toysMain = await prisma.category.findFirst({
    where: { slug: 'toys', parentId: null },
  });

  if (!toysMain) {
    toysMain = await prisma.category.create({
      data: {
        name: 'Toys',
        slug: 'toys',
        description: 'Toys & Games Collection',
      },
    });
  }

  // Create 2 test subcategories
  const subEdu = await prisma.category.create({
    data: {
      name: `Educational Kit ${testSuffix}`,
      slug: `educational-kit-${testSuffix}`,
      parentId: toysMain.id,
      description: 'Educational Kits',
    },
  });

  const subRC = await prisma.category.create({
    data: {
      name: `RC Vehicle ${testSuffix}`,
      slug: `rc-vehicle-${testSuffix}`,
      parentId: toysMain.id,
      description: 'RC Vehicles',
    },
  });

  // Create test products with NO "toy" or "game" words in name/tags to verify pure DB relationship resolution
  const testProductSkus = [
    `TOY-TEST-1-${testSuffix}`,
    `TOY-TEST-2-${testSuffix}`,
    `CORP-TEST-1-${testSuffix}`,
  ];

  const p1 = await prisma.product.create({
    data: {
      name: 'Advanced Microcontroller Circuit Board', // No "toy" keyword!
      slug: `circuit-board-${testSuffix}`,
      sku: testProductSkus[0],
      price: 1299,
      categoryId: toysMain.id,
      subCategoryId: subEdu.id,
      description: 'STEM experimental logic board',
      stock: 15,
      isActive: true,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: 'Precision Dual Motor Chassis V4', // No "toy" keyword!
      slug: `motor-chassis-${testSuffix}`,
      sku: testProductSkus[1],
      price: 2499,
      categoryId: toysMain.id,
      subCategoryId: subRC.id,
      description: 'High torque proportional speed controller',
      stock: 25,
      isActive: true,
    },
  });

  // Create a Corporate product for exclusion test
  const corpCat = await prisma.category.findFirst({ where: { slug: 'corporate-gifts' } }) || toysMain;
  const p3 = await prisma.product.create({
    data: {
      name: 'Executive Metal Rollerball Pen & Diary',
      slug: `executive-pen-${testSuffix}`,
      sku: testProductSkus[2],
      price: 899,
      categoryId: corpCat.id,
      description: 'Formal office stationery kit',
      stock: 50,
      isActive: true,
    },
  });

  try {
    // 1. Fetch products & categories like the frontend storefront
    const [prodResult, allCats] = await Promise.all([
      productService.getAll({ page: '1', limit: '1000', showAll: 'true' }),
      prisma.category.findMany(),
    ]);

    const catIdMap = new Map(allCats.map(c => [c.id, c]));
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

    // Run exact frontend storefront matching
    const resolvedToysProducts = prodResult.data.filter(p => {
      const prodCatId = p.categoryId || (typeof p.category === 'object' ? p.category?.id : p.category);
      const prodSubId = p.subCategoryId || (typeof p.subCategory === 'object' ? p.subCategory?.id : p.subCategory) || (typeof p.subcategory === 'object' ? p.subcategory?.id : p.subcategory);
      const pCatObj = catIdMap.get(prodCatId) || (typeof p.category === 'object' ? p.category : null);

      if (toysMainCatId && prodCatId === toysMainCatId) return true;
      if (toysMainCatId && pCatObj?.parentId === toysMainCatId) return true;
      if (prodSubId && toysSubCatIds.has(prodSubId)) return true;
      if (prodCatId && toysSubCatIds.has(prodCatId)) return true;
      if (pCatObj?.slug === 'toys' || pCatObj?.name?.toLowerCase().trim() === 'toys') return true;

      return false;
    });

    const resolvedSkus = new Set(resolvedToysProducts.map(p => p.sku));

    assert(
      resolvedSkus.has(testProductSkus[0]),
      'Product 1 (Circuit Board) resolved to Toys via DB Category relationship without keyword matching'
    );
    assert(
      resolvedSkus.has(testProductSkus[1]),
      'Product 2 (Motor Chassis) resolved to Toys via DB Category relationship without keyword matching'
    );

    if (corpCat.id !== toysMain.id) {
      assert(
        !resolvedSkus.has(testProductSkus[2]),
        'Product 3 (Corporate Pen) is strictly excluded from Toys page'
      );
    }

    // 2. Subcategory Drill-down Filter Verification
    const eduFiltered = resolvedToysProducts.filter(p => {
      return p.subCategoryId === subEdu.id || p.categoryId === subEdu.id;
    });

    assert(
      eduFiltered.length >= 1 && eduFiltered.some(p => p.sku === testProductSkus[0]),
      'Subcategory filter correctly isolated Educational Kit product via subCategoryId'
    );

    const rcFiltered = resolvedToysProducts.filter(p => {
      return p.subCategoryId === subRC.id || p.categoryId === subRC.id;
    });

    assert(
      rcFiltered.length >= 1 && rcFiltered.some(p => p.sku === testProductSkus[1]),
      'Subcategory filter correctly isolated RC Vehicle product via subCategoryId'
    );

  } catch (err) {
    console.error('💥 Test error:', err);
    failed++;
  } finally {
    // Cleanup
    await prisma.product.deleteMany({ where: { sku: { in: testProductSkus } } });
    await prisma.category.deleteMany({ where: { id: { in: [subEdu.id, subRC.id] } } });
    await prisma.$disconnect();
  }

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

testToysStorefrontResolution();

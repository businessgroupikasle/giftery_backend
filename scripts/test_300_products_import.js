import * as XLSX from 'xlsx';
import prisma from '../src/config/db.js';
import { bulkImportService } from '../src/services/bulkImportService.js';
import { productService } from '../src/services/productService.js';

async function run300ProductsTest() {
  console.log('🚀 =============================================================');
  console.log('🚀 STARTING 300+ PRODUCTS BULK IMPORT & CATEGORY AUDIT TEST');
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
  const testMainCats = [
    `Corporate Gifts ${testSuffix}`,
    `Personalized Lux ${testSuffix}`,
    `Toys & Kids ${testSuffix}`,
  ];

  const testSubCats = {
    [`Corporate Gifts ${testSuffix}`]: [`Executive Hampers ${testSuffix}`, `Desk Organizers ${testSuffix}`],
    [`Personalized Lux ${testSuffix}`]: [`Engraved Pens ${testSuffix}`, `Leather Wallets ${testSuffix}`],
    [`Toys & Kids ${testSuffix}`]: [`Educational Games ${testSuffix}`, `Plush Bears ${testSuffix}`],
  };

  const sampleRows = [];
  const createdSkus = [];

  // Generate 300 products (100 per Main Category, 50 per Subcategory)
  for (let i = 1; i <= 300; i++) {
    const mainCatIdx = (i - 1) % testMainCats.length;
    const mainCat = testMainCats[mainCatIdx];
    const subCatList = testSubCats[mainCat];
    const subCat = subCatList[i % subCatList.length];
    const sku = `SKU-300-${testSuffix}-${String(i).padStart(4, '0')}`;
    createdSkus.push(sku);

    sampleRows.push({
      'Product Name': `Luxury Catalog Item #${i} - ${subCat}`,
      'SKU': sku,
      'Price': 499 + (i * 10),
      'Compare Price': 699 + (i * 10),
      'Stock Qty': 20 + (i % 50),
      'Main Category': mainCat,
      'Subcategory': subCat,
      'Description': `Detailed description for catalog item #${i} in category ${mainCat} under ${subCat}.`,
      'Specifications': `Material: Premium Grade\nModel: 2026-${i}\nOrigin: Handcrafted`,
      'Product Tags': `bulk, test, item${i}, ${mainCat.toLowerCase()}, ${subCat.toLowerCase()}`,
      'Image 1': '',
      'Image 2': '',
      'Image 3': '',
      'Image 4': '',
      'Featured': i % 10 === 0 ? 'TRUE' : 'FALSE',
      'Best Sellers': i % 5 === 0 ? 'TRUE' : 'FALSE',
      'Popular': i % 7 === 0 ? 'TRUE' : 'FALSE',
      'New Arrivals': i % 3 === 0 ? 'TRUE' : 'FALSE',
      'Most Loved': 'FALSE',
      'Gift Sets': i % 8 === 0 ? 'TRUE' : 'FALSE',
    });
  }

  try {
    console.log(`📦 Generating Excel workbook with ${sampleRows.length} product rows...`);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // TEST 1: Validate 300 rows via bulkImportService.parseAndValidate
    console.log('\n--- TEST 1: Parse & Validate 300 Excel Rows ---');
    const validationResult = await bulkImportService.parseAndValidate(excelBuffer, 'products_300_batch.xlsx');
    
    assert(
      validationResult.summary.total === 300,
      'Excel Parser correctly read all 300 product rows without truncation'
    );
    assert(
      validationResult.summary.valid === 300 && validationResult.summary.invalid === 0,
      'All 300 rows are validated with 0 errors (auto-category creation enabled)'
    );

    // TEST 2: Execute Bulk Import of 300 products
    console.log('\n--- TEST 2: Execute Bulk Import & Auto-Create Categories ---');
    const importPayload = validationResult.rows.map(r => ({ ...r.data, action: r.action }));
    const importResult = await bulkImportService.executeBulkImport(importPayload);

    assert(
      importResult.importedCount === 300 && importResult.failedCount === 0,
      'All 300 products imported successfully into PostgreSQL (0 failures)'
    );

    // TEST 3: Verify Categories Distribution in PostgreSQL
    console.log('\n--- TEST 3: Verify Multi-Category Distribution ---');
    const dbMainCategories = await prisma.category.findMany({
      where: { name: { in: testMainCats } },
      include: { children: true },
    });

    assert(
      dbMainCategories.length === 3,
      'All 3 Main Categories auto-created properly in database'
    );

    const subCategoriesCount = dbMainCategories.reduce((acc, cat) => acc + cat.children.length, 0);
    assert(
      subCategoriesCount === 6,
      'All 6 Subcategories auto-created with valid parentId links'
    );

    // Verify products are NOT all in one category
    const categoryCounts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { sku: { in: createdSkus } },
      _count: { id: true },
    });

    assert(
      categoryCounts.length === 3 && categoryCounts.every(c => c._count.id === 100),
      'Products are distributed evenly (100 per category), NOT dumped into a single category'
    );

    // TEST 4: Verify Subcategory IDs stored on products
    const productsWithSubCat = await prisma.product.count({
      where: {
        sku: { in: createdSkus },
        subCategoryId: { not: null },
      },
    });

    assert(
      productsWithSubCat === 300,
      'All 300 products have their exact subCategoryId saved'
    );

    // TEST 5: Verify Pagination Limit allows 1000 products retrieval
    console.log('\n--- TEST 4: Verify Dashboard Pagination Limit ---');
    const queryResult = await productService.getAll({
      page: '1',
      limit: '1000',
      showAll: 'true',
    });

    assert(
      queryResult.meta.limit === 1000 && queryResult.data.length >= 300,
      `productService.getAll({ limit: 1000 }) successfully returned ${queryResult.data.length} products without 100-item cap`
    );

    // Cleanup
    console.log('\n🧹 Cleaning up test products and categories...');
    await prisma.product.deleteMany({ where: { sku: { in: createdSkus } } });
    for (const mainCat of dbMainCategories) {
      await prisma.category.deleteMany({ where: { parentId: mainCat.id } });
      await prisma.category.delete({ where: { id: mainCat.id } });
    }
    console.log('✅ Test cleanup completed.');

  } catch (err) {
    console.error('💥 Test suite error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run300ProductsTest();

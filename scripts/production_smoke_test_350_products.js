import * as XLSX from 'xlsx';
import prisma from '../src/config/db.js';
import { bulkImportService } from '../src/services/bulkImportService.js';
import { productService } from '../src/services/productService.js';

async function runProductionSmokeTest() {
  console.log('🚀 =========================================================================');
  console.log('🚀 PRODUCTION SMOKE TEST: 350+ PRODUCTS IMPORT & CATALOG INTEGRITY AUDIT');
  console.log('🚀 =========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, details = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  const testSuffix = Date.now();
  const PRODUCT_COUNT = 350;
  const CHUNK_SIZE = 50;

  const testMainCats = [
    `Prod Smoke Corp ${testSuffix}`,
    `Prod Smoke Personalized ${testSuffix}`,
    `Prod Smoke Toys ${testSuffix}`,
  ];

  const testSubCats = {
    [`Prod Smoke Corp ${testSuffix}`]: [`Luxury Hampers ${testSuffix}`, `Desk Sets ${testSuffix}`],
    [`Prod Smoke Personalized ${testSuffix}`]: [`Engraved Pens ${testSuffix}`, `Custom Wallets ${testSuffix}`],
    [`Prod Smoke Toys ${testSuffix}`]: [`STEM Puzzles ${testSuffix}`, `Wooden Blocks ${testSuffix}`],
  };

  const sampleRows = [];
  const createdSkus = [];

  // Generate 350 products across categories
  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const mainCat = testMainCats[(i - 1) % testMainCats.length];
    const subCatList = testSubCats[mainCat];
    const subCat = subCatList[i % subCatList.length];
    const sku = `SKU-PROD-${testSuffix}-${String(i).padStart(4, '0')}`;
    createdSkus.push(sku);

    sampleRows.push({
      'Product Name': `Production Smoke Item #${i} - ${subCat}`,
      'SKU': sku,
      'Price': 599 + i,
      'Compare Price': 899 + i,
      'Stock Qty': 15 + (i % 20),
      'Main Category': mainCat,
      'Subcategory': subCat,
      'Description': `Production-grade detailed description for item #${i} in category ${mainCat}`,
      'Specifications': `Material: Eco-friendly\nWarranty: 1 Year\nBatch: 2026-${testSuffix}`,
      'Product Tags': `smoke, prod, item${i}, ${mainCat.toLowerCase()}`,
      'Image 1': i % 3 === 0 ? 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800' : '',
      'Image 2': '',
      'Image 3': '',
      'Image 4': '',
      'Featured': i % 10 === 0 ? 'TRUE' : 'FALSE',
      'Best Sellers': i % 5 === 0 ? 'TRUE' : 'FALSE',
      'Popular': i % 7 === 0 ? 'TRUE' : 'FALSE',
      'New Arrivals': i % 4 === 0 ? 'TRUE' : 'FALSE',
      'Most Loved': 'FALSE',
      'Gift Sets': i % 6 === 0 ? 'TRUE' : 'FALSE',
    });
  }

  try {
    // ── STEP 1: Generate & Validate 350-Row Excel File ────────────────────────
    console.log(`📦 Generating Excel workbook with ${sampleRows.length} product rows...`);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    console.log('\n--- 1. PARSE & VALIDATE EXCEL ---');
    const valResult = await bulkImportService.parseAndValidate(excelBuffer, 'prod_smoke_350.xlsx');
    assert(valResult.summary.total === PRODUCT_COUNT, `Read all ${PRODUCT_COUNT} rows from Excel`);
    assert(valResult.summary.valid === PRODUCT_COUNT, `All ${PRODUCT_COUNT} rows valid with 0 errors`);

    // ── STEP 2: Execute Chunked Bulk Import (Simulating Frontend Batches) ──────
    console.log('\n--- 2. EXECUTE CHUNKED BULK IMPORT (7 BATCHES OF 50) ---');
    const totalBatches = Math.ceil(PRODUCT_COUNT / CHUNK_SIZE);
    let totalImported = 0;
    let totalFailed = 0;
    const batchTimes = [];

    const totalStartTime = Date.now();
    for (let b = 0; b < totalBatches; b++) {
      const batchStartTime = Date.now();
      const chunk = valResult.rows.slice(b * CHUNK_SIZE, (b + 1) * CHUNK_SIZE).map(r => ({ ...r.data, action: r.action }));
      
      const batchRes = await bulkImportService.executeBulkImport(chunk);
      const batchElapsed = Date.now() - batchStartTime;
      batchTimes.push(batchElapsed);

      totalImported += batchRes.importedCount;
      totalFailed += batchRes.failedCount;
      console.log(`   Batch ${b + 1}/${totalBatches} (${chunk.length} items): ${batchRes.importedCount} imported in ${batchElapsed}ms`);
    }
    const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2);
    console.log(`⏱️ Total import time for ${PRODUCT_COUNT} products: ${totalElapsed}s (Avg per batch: ${(batchTimes.reduce((a, b) => a + b, 0) / totalBatches).toFixed(0)}ms)`);

    assert(totalImported === PRODUCT_COUNT, `All ${PRODUCT_COUNT} products imported successfully (${totalImported}/${PRODUCT_COUNT})`);
    assert(totalFailed === 0, `Zero failed products (failedCount = 0)`);
    assert(totalImported > 200, `Import passed the 200-product mark without stopping (Imported: ${totalImported})`);

    // ── STEP 3: Live PostgreSQL Product Count Verification ────────────────────
    console.log('\n--- 3. LIVE DATABASE COUNT & INTEGRITY VERIFICATION ---');
    const directDbCount = await prisma.product.count({
      where: { sku: { in: createdSkus } },
    });
    assert(directDbCount === PRODUCT_COUNT, `Live PostgreSQL product count matches exactly ${PRODUCT_COUNT} records (SELECT COUNT = ${directDbCount})`);

    // ── STEP 4: Category & Subcategory Integrity Audit ────────────────────────
    console.log('\n--- 4. CATEGORY & SUBCATEGORY DISTRIBUTION AUDIT ---');
    const dbMainCategories = await prisma.category.findMany({
      where: { name: { in: testMainCats } },
      include: { children: true },
    });
    assert(dbMainCategories.length === 3, 'All 3 Main Categories created with proper IDs');

    const totalSubCats = dbMainCategories.reduce((acc, c) => acc + c.children.length, 0);
    assert(totalSubCats === 6, 'All 6 Subcategories created with valid parentId links');

    const productsWithSubCats = await prisma.product.count({
      where: { sku: { in: createdSkus }, subCategoryId: { not: null } },
    });
    assert(productsWithSubCats === PRODUCT_COUNT, `All ${PRODUCT_COUNT} products have valid subCategoryId references`);

    // ── STEP 5: Storefront Product Listing & Query Verification ───────────────
    console.log('\n--- 5. STOREFRONT PRODUCT LISTING & QUERY AUDIT ---');
    const storefrontRes = await productService.getAll({
      search: `Production Smoke Item`,
      limit: '1000',
      showAll: 'true',
    });
    assert(storefrontRes.data.length === PRODUCT_COUNT, `productService.getAll returned exactly ${PRODUCT_COUNT} products (${storefrontRes.data.length}/${PRODUCT_COUNT})`);

    // ── STEP 6: Single Product CRUD Regression Test ───────────────────────────
    console.log('\n--- 6. SINGLE PRODUCT CRUD REGRESSION AUDIT ---');
    const singleCat = dbMainCategories[0];
    const singleProd = await productService.create({
      name: `Single Add Smoke Product ${testSuffix}`,
      price: 1299,
      stock: 10,
      categoryId: singleCat.id,
      description: 'Single product add test',
      sku: `SKU-SINGLE-SMOKE-${testSuffix}`,
    });
    assert(singleProd && singleProd.id, 'Single product creation works seamlessly');

    const updatedSingle = await productService.update(singleProd.id, {
      price: 1599,
      stock: 20,
    });
    assert(updatedSingle.price === 1599 && updatedSingle.stock === 20, 'Single product update works seamlessly');

    await productService.delete(singleProd.id);
    const checkDeleted = await prisma.product.findUnique({ where: { id: singleProd.id } });
    assert(checkDeleted === null, 'Single product deletion works seamlessly');

    // ── STEP 7: Cleanup Test Data ─────────────────────────────────────────────
    console.log('\n🧹 Cleaning up 350 smoke test products & test categories...');
    await prisma.product.deleteMany({ where: { sku: { in: createdSkus } } });
    for (const c of dbMainCategories) {
      await prisma.category.deleteMany({ where: { parentId: c.id } });
      await prisma.category.delete({ where: { id: c.id } });
    }
    console.log('✅ Cleanup completed cleanly.');

  } catch (err) {
    console.error('💥 Smoke test encountered an error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=========================================================================');
  console.log(`📊 PRODUCTION SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runProductionSmokeTest();

import * as XLSX from 'xlsx';
import prisma from '../src/config/db.js';
import { bulkImportService } from '../src/services/bulkImportService.js';
import { productService } from '../src/services/productService.js';

async function runRigorousPaginationAudit() {
  console.log('🚀 =========================================================================');
  console.log('🚀 RIGOROUS 350+ PRODUCTS SERVER-SIDE PAGINATION & CATALOG AUDIT');
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
    `Server Pag Main Cat 1 ${testSuffix}`,
    `Server Pag Main Cat 2 ${testSuffix}`,
  ];

  const testSubCats = {
    [`Server Pag Main Cat 1 ${testSuffix}`]: [`Server Sub 1A ${testSuffix}`, `Server Sub 1B ${testSuffix}`],
    [`Server Pag Main Cat 2 ${testSuffix}`]: [`Server Sub 2A ${testSuffix}`, `Server Sub 2B ${testSuffix}`],
  };

  const sampleRows = [];
  const createdSkus = [];

  for (let i = 1; i <= PRODUCT_COUNT; i++) {
    const mainCat = testMainCats[(i - 1) % testMainCats.length];
    const subCatList = testSubCats[mainCat];
    const subCat = subCatList[i % subCatList.length];
    const sku = `SKU-SP-${testSuffix}-${String(i).padStart(4, '0')}`;
    createdSkus.push(sku);

    sampleRows.push({
      'Product Name': `Server Paginated Item #${i} ${subCat}`,
      'SKU': sku,
      'Price': 250 + (i * 5),
      'Compare Price': 350 + (i * 5),
      'Stock Qty': 20,
      'Main Category': mainCat,
      'Subcategory': subCat,
      'Description': `Detailed description for server paginated product #${i}`,
      'Specifications': 'Color: Navy',
      'Product Tags': `server, test, item${i}, batch`,
      'Image 1': '',
      'Featured': i % 10 === 0 ? 'TRUE' : 'FALSE',
      'Best Sellers': 'FALSE',
      'Popular': 'FALSE',
      'New Arrivals': 'FALSE',
      'Most Loved': 'FALSE',
      'Gift Sets': 'FALSE',
    });
  }

  try {
    // ── 1. BULK IMPORT 350 PRODUCTS IN 50-ITEM CHUNKS ─────────────────────────
    console.log(`📦 Generating Excel sheet for ${PRODUCT_COUNT} products...`);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    console.log('\n--- 1. PARSE & VALIDATE EXCEL ---');
    const valResult = await bulkImportService.parseAndValidate(excelBuffer, 'server_pag_350.xlsx');
    assert(valResult.summary.total === PRODUCT_COUNT, `Parsed all ${PRODUCT_COUNT} products`);

    console.log('\n--- 2. CHUNKED IMPORT (7 BATCHES OF 50) ---');
    const totalBatches = Math.ceil(PRODUCT_COUNT / CHUNK_SIZE);
    let totalImported = 0;
    for (let b = 0; b < totalBatches; b++) {
      const chunk = valResult.rows.slice(b * CHUNK_SIZE, (b + 1) * CHUNK_SIZE).map(r => ({ ...r.data, action: r.action }));
      const res = await bulkImportService.executeBulkImport(chunk);
      totalImported += res.importedCount;
    }
    assert(totalImported === PRODUCT_COUNT, `All ${PRODUCT_COUNT} products imported successfully`);

    // ── 2. DATABASE PERSISTENCE CHECKS (Products 1, 201, 350) ─────────────────
    console.log('\n--- 3. DATABASE VERIFICATION (Products 1, 201, 350) ---');
    const dbCount = await prisma.product.count({
      where: { sku: { in: createdSkus } },
    });
    assert(dbCount === PRODUCT_COUNT, `PostgreSQL contains exactly ${PRODUCT_COUNT} records (SELECT COUNT = ${dbCount})`);

    const prod1 = await prisma.product.findFirst({ where: { sku: createdSkus[0] } });
    const prod201 = await prisma.product.findFirst({ where: { sku: createdSkus[200] } });
    const prod350 = await prisma.product.findFirst({ where: { sku: createdSkus[349] } });

    assert(prod1 !== null, `Product #1 (${createdSkus[0]}) exists in PostgreSQL`);
    assert(prod201 !== null, `Product #201 (${createdSkus[200]}) exists in PostgreSQL`);
    assert(prod350 !== null, `Product #350 (${createdSkus[349]}) exists in PostgreSQL`);

    // ── 3. SERVER-SIDE PAGINATION API VERIFICATION ───────────────────────────
    console.log('\n--- 4. SERVER-SIDE PAGINATION (Page 1 vs Page 3/4) ---');
    // Page 1 (limit 100)
    const page1Res = await productService.getAll({
      search: `Server Paginated Item`,
      page: '1',
      limit: '100',
      showAll: 'true',
    });
    assert(page1Res.data.length === 100, `Page 1 returns exactly 100 products (${page1Res.data.length}/100)`);
    assert(page1Res.meta.total === PRODUCT_COUNT, `meta.total reflects full database filtered count (${page1Res.meta.total} === ${PRODUCT_COUNT})`);
    assert(page1Res.meta.totalPages === 4, `meta.totalPages is 4 for limit=100 (${page1Res.meta.totalPages})`);
    assert(page1Res.meta.hasNext === true, 'Page 1 hasNext is true');
    assert(page1Res.meta.hasPrev === false, 'Page 1 hasPrev is false');

    // Page 3 (limit 100 -> items 201..300)
    const page3Res = await productService.getAll({
      search: `Server Paginated Item`,
      page: '3',
      limit: '100',
      showAll: 'true',
    });
    assert(page3Res.data.length === 100, `Page 3 returns exactly 100 products (${page3Res.data.length}/100)`);
    assert(page3Res.meta.page === 3, 'Page 3 meta.page is 3');

    // Page 4 (limit 100 -> items 301..350)
    const page4Res = await productService.getAll({
      search: `Server Paginated Item`,
      page: '4',
      limit: '100',
      showAll: 'true',
    });
    assert(page4Res.data.length === 50, `Page 4 returns remaining 50 products (${page4Res.data.length}/50)`);
    assert(page4Res.meta.hasNext === false, 'Page 4 hasNext is false');
    assert(page4Res.meta.hasPrev === true, 'Page 4 hasPrev is true');

    // ── 4. STOREFRONT 24/PAGE PAGINATION ──────────────────────────────────────
    console.log('\n--- 5. STOREFRONT 24/PAGE PAGINATION ---');
    const sfPage1 = await productService.getAll({
      search: `Server Paginated Item`,
      page: '1',
      limit: '24',
    });
    assert(sfPage1.data.length === 24, `Storefront Page 1 returns 24 items (${sfPage1.data.length}/24)`);
    assert(sfPage1.meta.totalPages === Math.ceil(PRODUCT_COUNT / 24), `Storefront totalPages is ${Math.ceil(PRODUCT_COUNT / 24)}`);

    // Storefront last page (Page 15 for 350 items at 24/page: 350 - 14*24 = 14 items)
    const sfLastPage = await productService.getAll({
      search: `Server Paginated Item`,
      page: '15',
      limit: '24',
    });
    assert(sfLastPage.data.length === 14, `Storefront Page 15 (last page) returns remaining 14 products (${sfLastPage.data.length}/14)`);

    // ── 5. SEARCH BEYOND PAGE 2 ───────────────────────────────────────────────
    console.log('\n--- 6. SEARCH FOR PRODUCT BEYOND PAGE 2 ---');
    const searchTargetSku = createdSkus[249]; // Product #250
    const searchRes = await productService.getAll({
      search: searchTargetSku,
      page: '1',
      limit: '10',
    });
    assert(searchRes.data.length === 1 && searchRes.data[0].sku === searchTargetSku, `Search found product #250 (${searchTargetSku}) directly`);
    assert(searchRes.meta.total === 1, `Search meta.total is 1 for exact SKU search`);

    // ── 6. CATEGORY & SUBCATEGORY SERVER-SIDE FILTERING ──────────────────────
    console.log('\n--- 7. CATEGORY & SUBCATEGORY FILTERING ---');
    const targetCat = await prisma.category.findFirst({ where: { name: testMainCats[0] } });
    const catFilteredRes = await productService.getAll({
      categoryId: targetCat.id,
      page: '1',
      limit: '50',
    });
    assert(catFilteredRes.meta.total === 175, `Category filter returned exact matching count of 175 items (${catFilteredRes.meta.total}/175)`);
    assert(catFilteredRes.data.length === 50, `Category Page 1 returns 50 products`);

    // ── 7. ADDING PRODUCT 351 (VERIFY PRODUCT 1 NEVER DISAPPEARS/DELETED) ────
    console.log('\n--- 8. ADD PRODUCT 351 & VERIFY PRODUCT 1 INTEGRITY ---');
    const prod351Sku = `SKU-SP-${testSuffix}-0351`;
    const prod351 = await productService.create({
      name: `Server Paginated Item #351`,
      sku: prod351Sku,
      price: 999,
      stock: 50,
      categoryId: targetCat.id,
      description: 'Additive product #351 test',
    });
    createdSkus.push(prod351Sku);

    // Verify Product 1 still exists in database
    const prod1CheckAfter351 = await prisma.product.findFirst({ where: { sku: createdSkus[0] } });
    assert(prod1CheckAfter351 !== null, `Product #1 STILL EXISTS in database after adding Product #351 (No deletion)`);

    // Verify total count incremented by exactly 1
    const finalDbCount = await prisma.product.count({
      where: { sku: { in: createdSkus } },
    });
    assert(finalDbCount === PRODUCT_COUNT + 1, `Total PostgreSQL count is now exactly 351 (${finalDbCount} === 351)`);

    // ── 8. CLEANUP TEST DATA ──────────────────────────────────────────────────
    console.log('\n🧹 Cleaning up test products and categories...');
    await prisma.product.deleteMany({ where: { sku: { in: createdSkus } } });
    for (const cName of testMainCats) {
      const c = await prisma.category.findFirst({ where: { name: cName } });
      if (c) {
        await prisma.category.deleteMany({ where: { parentId: c.id } });
        await prisma.category.delete({ where: { id: c.id } });
      }
    }
    console.log('✅ Cleanup completed cleanly.');

  } catch (err) {
    console.error('💥 Audit error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n=========================================================================');
  console.log(`📊 SERVER PAGINATION AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runRigorousPaginationAudit();

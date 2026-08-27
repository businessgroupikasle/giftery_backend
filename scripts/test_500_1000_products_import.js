import * as XLSX from 'xlsx';
import prisma from '../src/config/db.js';
import { bulkImportService } from '../src/services/bulkImportService.js';

async function run500And1000Test() {
  console.log('🚀 STARTING 500 & 1000 PRODUCTS BULK IMPORT TEST\n');
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
  const mainCat = `High Volume Test Cat ${testSuffix}`;
  const subCat = `Batch Subcat ${testSuffix}`;

  // Generate 500 products
  const count = 500;
  const sampleRows = [];
  const createdSkus = [];

  for (let i = 1; i <= count; i++) {
    const sku = `SKU-HV-${testSuffix}-${String(i).padStart(4, '0')}`;
    createdSkus.push(sku);
    sampleRows.push({
      'Product Name': `High Volume Product #${i}`,
      'SKU': sku,
      'Price': 299 + i,
      'Compare Price': 399 + i,
      'Stock Qty': 50,
      'Main Category': mainCat,
      'Subcategory': subCat,
      'Description': `Detailed description for high volume product #${i}`,
      'Specifications': 'Material: Metal',
      'Product Tags': `tag${i}, test, bulk`,
      'Image 1': '',
      'Featured': 'FALSE',
      'Best Sellers': 'FALSE',
      'Popular': 'FALSE',
      'New Arrivals': 'FALSE',
      'Most Loved': 'FALSE',
      'Gift Sets': 'FALSE',
    });
  }

  try {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    console.log(`--- TEST: Parse & Validate ${count} Rows ---`);
    const valResult = await bulkImportService.parseAndValidate(excelBuffer, 'hv_test.xlsx');
    assert(valResult.summary.total === count, `Parsed all ${count} rows`);
    assert(valResult.summary.valid === count, `All ${count} rows valid`);

    console.log(`\n--- TEST: Execute Chunked Bulk Import of ${count} Products ---`);
    const CHUNK_SIZE = 50;
    const totalBatches = Math.ceil(count / CHUNK_SIZE);
    let totalImported = 0;
    let totalFailed = 0;

    const startTime = Date.now();
    for (let b = 0; b < totalBatches; b++) {
      const chunk = valResult.rows.slice(b * CHUNK_SIZE, (b + 1) * CHUNK_SIZE).map(r => ({ ...r.data, action: r.action }));
      const result = await bulkImportService.executeBulkImport(chunk);
      totalImported += result.importedCount;
      totalFailed += result.failedCount;
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    assert(totalImported === count, `All ${count} products imported successfully in ${elapsed}s (0 failures)`);
    assert(totalFailed === 0, 'No failed rows');

    const dbCount = await prisma.product.count({
      where: { sku: { in: createdSkus } }
    });
    assert(dbCount === count, `Database contains exactly ${count} imported product records`);

    // Cleanup
    console.log('\n🧹 Cleaning up test products and categories...');
    await prisma.product.deleteMany({ where: { sku: { in: createdSkus } } });
    const cat = await prisma.category.findFirst({ where: { name: mainCat } });
    if (cat) {
      await prisma.category.deleteMany({ where: { parentId: cat.id } });
      await prisma.category.delete({ where: { id: cat.id } });
    }
    console.log('✅ Cleanup finished.');

  } catch (err) {
    console.error('💥 Test error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run500And1000Test();

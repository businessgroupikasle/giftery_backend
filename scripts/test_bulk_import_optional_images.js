import * as XLSX from 'xlsx';
import prisma from '../src/config/db.js';
import { bulkImportService } from '../src/services/bulkImportService.js';

async function testOptionalImages() {
  console.log('🧪 Starting Bulk Import Optional Images Test...\n');
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

  try {
    // 1. Get or create a sample category
    let category = await prisma.category.findFirst({ where: { parentId: null } });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'Test Category',
          slug: `test-cat-${Date.now()}`,
        },
      });
    }

    const testSku = `NO-IMG-${Date.now()}`;
    const sampleRows = [
      {
        'Product Name': 'Product Without Any Images',
        'SKU': testSku,
        'Price': 999,
        'Compare Price': 1299,
        'Stock Qty': 25,
        'Main Category': category.name,
        'Subcategory': '',
        'Description': 'A great product that does not have any image specified in the Excel sheet.',
        'Specifications': 'Color: Black\nMaterial: Wood',
        'Product Tags': 'testing, bulk, noimage',
        'Image 1': '',
        'Image 2': '',
        'Image 3': '',
        'Image 4': '',
        'Featured': 'FALSE',
      },
      {
        'Product Name': 'Product With One Image',
        'SKU': `ONE-IMG-${Date.now()}`,
        'Price': 1499,
        'Compare Price': 1999,
        'Stock Qty': 10,
        'Main Category': category.name,
        'Subcategory': '',
        'Description': 'A product with only Image 1 provided.',
        'Specifications': '',
        'Product Tags': 'testing',
        'Image 1': 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
        'Image 2': '',
        'Image 3': '',
        'Image 4': '',
        'Featured': 'TRUE',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Test Validation
    const validationResult = await bulkImportService.parseAndValidate(excelBuffer, 'test_optional_images.xlsx');
    assert(
      validationResult.summary.total === 2 && validationResult.summary.valid === 2 && validationResult.summary.invalid === 0,
      'Validation passes with 0 image errors for products without images'
    );

    const noImgRow = validationResult.rows.find(r => r.data.sku === testSku);
    assert(
      noImgRow && noImgRow.isValid && noImgRow.errors.length === 0,
      'Row without images is marked isValid: true with 0 errors'
    );

    // Test Execution
    const importResult = await bulkImportService.executeBulkImport(
      validationResult.rows.map(r => ({ ...r.data, action: r.action }))
    );

    assert(
      importResult.importedCount === 2 && importResult.failedCount === 0,
      'Bulk import executes and creates both products successfully'
    );

    // Verify in database
    const createdProduct = await prisma.product.findFirst({
      where: { sku: testSku },
    });

    assert(
      createdProduct && Array.isArray(createdProduct.images) && createdProduct.images.length === 0,
      'Database record created with empty images array'
    );

    // Cleanup
    await prisma.product.deleteMany({
      where: {
        sku: { in: [testSku, `ONE-IMG-${testSku.replace('NO-IMG-', '')}`] },
      },
    });

    console.log('\n🧹 Test data cleaned up.');
  } catch (err) {
    console.error('Test crashed:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

testOptionalImages();

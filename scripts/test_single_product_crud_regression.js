import prisma from '../src/config/db.js';
import { productService } from '../src/services/productService.js';

async function runSingleCrudRegressionTest() {
  console.log('🧪 Starting Single Product CRUD Regression Test...\n');
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

  let createdProduct = null;
  const testSuffix = Date.now();
  const testSku = `SKU-SINGLE-${testSuffix}`;

  try {
    // 1. Get or create test category
    let testCategory = await prisma.category.findFirst();
    if (!testCategory) {
      testCategory = await prisma.category.create({
        data: { name: 'Single Test Cat', slug: `single-cat-${testSuffix}` }
      });
    }

    // 2. Test Single Product Add (POST /api/v1/products flow)
    console.log('--- TEST 1: Single Product Add via productService.create ---');
    createdProduct = await productService.create({
      name: `Single Regression Product ${testSuffix}`,
      price: 1499,
      comparePrice: 1999,
      stock: 25,
      categoryId: testCategory.id,
      description: 'Single product add test description',
      sku: testSku,
      tags: ['single', 'regression'],
      featured: true,
      isBestseller: true,
      images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=800'],
    });

    assert(createdProduct && createdProduct.id, 'Product created successfully with unique ID');
    assert(createdProduct.sku === testSku, 'SKU matches test SKU');
    assert(createdProduct.price === 1499, 'Price saved correctly as 1499');
    assert(createdProduct.stock === 25, 'Stock saved correctly as 25');
    assert(createdProduct.categoryId === testCategory.id, 'Category ID linked accurately');

    // 3. Test Single Product Get by Slug (Storefront flow)
    console.log('\n--- TEST 2: Single Product Get by Slug ---');
    const fetchedProduct = await productService.getBySlug(createdProduct.slug);
    assert(fetchedProduct && fetchedProduct.id === createdProduct.id, 'Product fetched by slug correctly');
    assert(fetchedProduct.category && fetchedProduct.category.id === testCategory.id, 'Category relation loaded');

    // 4. Test Single Product Edit (PUT /api/v1/products/:id flow)
    console.log('\n--- TEST 3: Single Product Update via productService.update ---');
    const updatedProduct = await productService.update(createdProduct.id, {
      name: `Single Regression Product ${testSuffix} (Updated)`,
      price: 1799,
      stock: 40,
    });
    assert(updatedProduct.price === 1799, 'Product price updated to 1799');
    assert(updatedProduct.stock === 40, 'Product stock updated to 40');

    // 5. Test Single Product Delete (DELETE /api/v1/products/:id flow)
    console.log('\n--- TEST 4: Single Product Delete via productService.delete ---');
    await productService.delete(createdProduct.id);
    const checkDeleted = await prisma.product.findUnique({ where: { id: createdProduct.id } });
    assert(checkDeleted === null, 'Product deleted cleanly from database');
    createdProduct = null;

  } catch (err) {
    console.error('💥 Regression test error:', err);
    failed++;
  } finally {
    if (createdProduct) {
      await prisma.product.deleteMany({ where: { id: createdProduct.id } });
    }
    await prisma.$disconnect();
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runSingleCrudRegressionTest();

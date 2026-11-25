// Adds the "N-in-1 Combo" subcategories under Corporate Gifts.
// Safe to run on a live database: it only creates the combos that are missing,
// never deletes or changes existing categories or products, and can be re-run.
//
// Usage (from the backend folder): node scripts/add-combo-subcategories.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMBO_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

async function main() {
  const corporateGifts = await prisma.category.findUnique({ where: { slug: 'corporate-gifts' } });
  if (!corporateGifts) {
    throw new Error('Main category "corporate-gifts" not found. Nothing was changed.');
  }

  let created = 0;
  for (const n of COMBO_COUNTS) {
    const name = `${n}-in-1 Combo`;
    const slug = `${n}-in-1-combo`;

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      const where = existing.parentId === corporateGifts.id ? 'Corporate Gifts' : `another parent (${existing.parentId || 'none'})`;
      console.log(`skip    ${name} (already exists under ${where})`);
      continue;
    }

    await prisma.category.create({
      data: {
        name,
        slug,
        parentId: corporateGifts.id,
        description: `${name} under Corporate Gifts collection`,
        image: '/images/cat_corporate.png',
      },
    });
    created += 1;
    console.log(`created ${name}`);
  }

  console.log(`Done: ${created} created, ${COMBO_COUNTS.length - created} already present.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

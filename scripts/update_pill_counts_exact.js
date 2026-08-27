import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const psPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(psPath, 'utf8');

// Replace categoryStats computation
const oldStats = `  const categoryStats = useMemo(() => {
    let totalCount = 0;
    const mainCountMap = {};

    categories.forEach(c => {
      const pCount = c._count?.products || (c.products ? c.products.length : 0);
      if (c.parentId) {
        mainCountMap[c.parentId] = (mainCountMap[c.parentId] || 0) + pCount;
      } else {
        mainCountMap[c.id] = (mainCountMap[c.id] || 0) + pCount;
        mainCountMap[c.name?.toLowerCase()] = (mainCountMap[c.name?.toLowerCase()] || 0) + pCount;
        mainCountMap[c.slug] = (mainCountMap[c.slug] || 0) + pCount;
        totalCount += pCount;
      }
    });

    return { total: totalCount || meta.total || 0, mainCountMap };
  }, [categories, meta.total]);`;

const newStats = `  const categoryStats = useMemo(() => {
    const mainCountMap = {};
    let grandTotal = 0;

    categories.forEach(c => {
      const pCount = c._count?.products || (c.products ? c.products.length : 0);
      if (c.parentId) {
        mainCountMap[c.parentId] = (mainCountMap[c.parentId] || 0) + pCount;
      } else {
        mainCountMap[c.id] = (mainCountMap[c.id] || 0) + pCount;
      }
    });

    categories.filter(c => !c.parentId).forEach(mc => {
      grandTotal += (mainCountMap[mc.id] || 0);
    });

    return { total: grandTotal || meta.total || 0, mainCountMap };
  }, [categories, meta.total]);`;

psContent = psContent.replace(oldStats, newStats);

// Replace All Products badge number
const oldAllBadge = `{activeCategoryFilter === 'all' && !debouncedSearch ? (meta.total || 0) : (meta.total || 0)}`;
const newAllBadge = `{categoryStats.total}`;
psContent = psContent.replace(oldAllBadge, newAllBadge);

// Replace Main Category badge number
const oldCatBadge = `{isActive && !debouncedSearch ? (meta.total || catCount) : catCount}`;
const newCatBadge = `{catCount}`;
psContent = psContent.replace(oldCatBadge, newCatBadge);

fs.writeFileSync(psPath, psContent, 'utf8');
console.log('✅ ProductsSection.jsx pill counts updated to show exact numbers');

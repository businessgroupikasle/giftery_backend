import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const psPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(psPath, 'utf8');

const targetSubcategorySection = `        {/* Subcategories Filter Chips */}
        {filterSubcategories.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginRight: '0.25rem' }}>Subcategory:</span>
            
            <button
              type="button"
              onClick={() => setActiveSubCategoryFilter('all')}
              style={{
                background: activeSubCategoryFilter === 'all' ? '#e0f2fe' : '#f8fafc',
                border: activeSubCategoryFilter === 'all' ? '1px solid #0284c7' : '1px solid #e2e8f0',
                color: activeSubCategoryFilter === 'all' ? '#0369a1' : '#64748b',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: activeSubCategoryFilter === 'all' ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              All Subcategories
            </button>

            {filterSubcategories.map(sub => {
              const isSubActive = activeSubCategoryFilter === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveSubCategoryFilter(sub.id)}
                  style={{
                    background: isSubActive ? '#e0f2fe' : '#f8fafc',
                    border: isSubActive ? '1px solid #0284c7' : '1px solid #e2e8f0',
                    color: isSubActive ? '#0369a1' : '#64748b',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: isSubActive ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        )}`;

// Normalize newlines and remove
const normalizedPs = psContent.replace(/\r\n/g, '\n');
const normalizedTarget = targetSubcategorySection.replace(/\r\n/g, '\n');

if (normalizedPs.includes(normalizedTarget)) {
  const updated = normalizedPs.replace(normalizedTarget, '');
  fs.writeFileSync(psPath, updated, 'utf8');
  console.log('✅ Successfully removed subcategory filter chips from Dashboard ProductsSection');
} else {
  console.log('❌ Target subcategory section not matched');
}

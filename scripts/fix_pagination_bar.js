import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

const productsSectionPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(productsSectionPath, 'utf8');

const target = `            </tbody>
          </table>
        </div>`;

const replacement = `            </tbody>
          </table>

          {/* Additive Client Table Pagination Bar */}
          {filteredProducts.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                <span>
                  Showing{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {pageSize === 'all' ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredProducts.length)}
                  </strong>{' '}
                  to{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {pageSize === 'all' ? filteredProducts.length : Math.min(currentPage * pageSize, filteredProducts.length)}
                  </strong>{' '}
                  of{' '}
                  <strong style={{ color: '#0f172a' }}>{filteredProducts.length}</strong> products
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem' }}>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setPageSize(val);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '0.2rem 0.5rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      background: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All ({filteredProducts.length})</option>
                  </select>
                </div>
              </div>

              {pageSize !== 'all' && totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      background: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
                      color: currentPage <= 1 ? '#94a3b8' : '#334155',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ← Prev
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, pIdx) => {
                    let pageNum = pIdx + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + pIdx + 1;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - pIdx);
                    }
                    const isCurrent = currentPage === pageNum;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: '0.3rem 0.65rem',
                          border: isCurrent ? '1.5px solid #d99b26' : '1px solid #cbd5e1',
                          background: isCurrent ? '#fffcf5' : '#ffffff',
                          color: isCurrent ? '#92400e' : '#475569',
                          fontWeight: isCurrent ? 700 : 500,
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{
                      padding: '0.3rem 0.65rem',
                      border: '1px solid #cbd5e1',
                      background: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                      color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>`;

// Normalize newlines for match
const normalizedContent = psContent.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(productsSectionPath, updated, 'utf8');
  console.log('✅ Injected pagination bar into ProductsSection.jsx');
} else {
  console.log('❌ Target not found');
}

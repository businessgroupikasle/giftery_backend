import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPDATE BulkImportModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
const modalPath = path.join(frontendDir, 'src/pages/Dashboard/components/BulkImportModal.jsx');
let modalContent = fs.readFileSync(modalPath, 'utf8');

// A. Add importProgress state
if (!modalContent.includes('const [importProgress, setImportProgress] = useState(null);')) {
  modalContent = modalContent.replace(
    "const [importSummary, setImportSummary] = useState(null);",
    `const [importSummary, setImportSummary] = useState(null);
  const [importProgress, setImportProgress] = useState(null);`
  );
}

// B. Reset importProgress in handleFileChange
if (!modalContent.includes('setImportProgress(null);')) {
  modalContent = modalContent.replace(
    "setImportSummary(null);",
    `setImportSummary(null);
    setImportProgress(null);`
  );
}

// C. Replace handleConfirmImport with chunked 50/batch execution
const targetHandleConfirmImport = `  // 4. Confirm and Execute Bulk Import
  const handleConfirmImport = async () => {
    if (!validationData || !validationData.rows) return;
    const validProducts = validationData.rows.filter(r => r.isValid).map(r => ({
      ...r.data,
      action: r.action,
    }));

    if (validProducts.length === 0) {
      toast.error('No valid products to import');
      return;
    }

    setImporting(true);
    try {
      const res = await axiosInstance.post(ENDPOINTS.PRODUCTS.BULK.IMPORT, {
        products: validProducts,
      });
      const result = res.data?.data || res.data || res;
      setImportSummary(result);
      toast.success(\`Import completed: \${result.importedCount || 0} created, \${result.updatedCount || 0} updated!\`);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error('Bulk import error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Bulk import failed';
      toast.error(\`Import failed: \${errMsg}\`);
    } finally {
      setImporting(false);
    }
  };`;

const replacementHandleConfirmImport = `  // 4. Confirm and Execute Bulk Import in Safe Chunks (50 items/batch)
  const handleConfirmImport = async () => {
    if (!validationData || !validationData.rows) return;
    const validProducts = validationData.rows.filter(r => r.isValid).map(r => ({
      ...r.data,
      action: r.action,
    }));

    if (validProducts.length === 0) {
      toast.error('No valid products to import');
      return;
    }

    const CHUNK_SIZE = 50;
    const totalCount = validProducts.length;
    const totalBatches = Math.ceil(totalCount / CHUNK_SIZE);

    setImporting(true);
    setImportProgress({
      currentBatch: 1,
      totalBatches,
      processedCount: 0,
      totalCount,
      percentage: 0,
    });

    const aggregated = {
      success: true,
      totalRequested: totalCount,
      importedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      imported: [],
      updated: [],
      failed: [],
    };

    try {
      for (let b = 0; b < totalBatches; b++) {
        const chunk = validProducts.slice(b * CHUNK_SIZE, (b + 1) * CHUNK_SIZE);
        setImportProgress({
          currentBatch: b + 1,
          totalBatches,
          processedCount: b * CHUNK_SIZE,
          totalCount,
          percentage: Math.round((b / totalBatches) * 100),
        });

        try {
          const res = await axiosInstance.post(
            ENDPOINTS.PRODUCTS.BULK.IMPORT,
            { products: chunk },
            { timeout: 120000 } // Extended 2-minute timeout for bulk batch execution
          );
          const result = res.data?.data || res.data || res;
          aggregated.importedCount += (result.importedCount || 0);
          aggregated.updatedCount += (result.updatedCount || 0);
          aggregated.failedCount += (result.failedCount || 0);
          if (Array.isArray(result.imported)) aggregated.imported.push(...result.imported);
          if (Array.isArray(result.updated)) aggregated.updated.push(...result.updated);
          if (Array.isArray(result.failed)) aggregated.failed.push(...result.failed);
        } catch (chunkErr) {
          console.error(\`Error importing batch \${b + 1}:\`, chunkErr);
          const reason = chunkErr.response?.data?.message || chunkErr.message || 'Batch request failed';
          chunk.forEach(p => {
            aggregated.failedCount += 1;
            aggregated.failed.push({
              name: p.name,
              sku: p.sku,
              reason,
            });
          });
        }
      }

      setImportProgress({
        currentBatch: totalBatches,
        totalBatches,
        processedCount: totalCount,
        totalCount,
        percentage: 100,
      });

      setImportSummary(aggregated);
      toast.success(
        \`Import completed: \${aggregated.importedCount} created, \${aggregated.updatedCount} updated\${aggregated.failedCount > 0 ? \`, \${aggregated.failedCount} failed\` : ''}!\`
      );
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error('Bulk import error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Bulk import encountered an error';
      toast.error(\`Import failed: \${errMsg}\`);
    } finally {
      setImporting(false);
    }
  };`;

modalContent = modalContent.replace(targetHandleConfirmImport, replacementHandleConfirmImport);

// D. Add progress bar in footer or preview table area
const targetImportBtn = `                  {importing ? (
                    <>
                      <FiRefreshCw className="spinIcon" />
                      <span>Importing & Processing Images...</span>
                    </>
                  ) : (
                    <span>
                      Import {validationData.summary?.valid || 0} Valid Products
                    </span>
                  )}`;

const replacementImportBtn = `                  {importing ? (
                    <>
                      <FiRefreshCw className="spinIcon" />
                      <span>
                        {importProgress
                          ? \`Importing Batch \${importProgress.currentBatch}/\${importProgress.totalBatches} (\${importProgress.percentage}%)... key\`
                          : 'Importing & Processing Images...'}
                      </span>
                    </>
                  ) : (
                    <span>
                      Import {validationData.summary?.valid || 0} Valid Products
                    </span>
                  )}`;

modalContent = modalContent.replace(targetImportBtn, replacementImportBtn);

// Also add progress bar display above footer if importing
const targetModalFooter = `        {/* Footer Actions */}
        {!importSummary && (
          <div className={styles.modalFooter}>`;

const replacementModalFooter = `        {/* Live Import Progress Bar */}
        {importing && importProgress && (
          <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              <span>Importing Batch {importProgress.currentBatch} of {importProgress.totalBatches} ({importProgress.processedCount} of {importProgress.totalCount} products)</span>
              <span style={{ color: '#d99b26' }}>{importProgress.percentage}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: \`\${importProgress.percentage}%\`, height: '100%', background: 'linear-gradient(90deg, #d99b26, #16a34a)', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!importSummary && (
          <div className={styles.modalFooter}>`;

modalContent = modalContent.replace(targetModalFooter, replacementModalFooter);

fs.writeFileSync(modalPath, modalContent, 'utf8');
console.log('✅ BulkImportModal.jsx successfully updated with chunked execution and live progress bar');


// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATE ProductsSection.jsx (ADDITIVE Table Pagination)
// ─────────────────────────────────────────────────────────────────────────────
const productsSectionPath = path.join(frontendDir, 'src/pages/Dashboard/components/ProductsSection.jsx');
let psContent = fs.readFileSync(productsSectionPath, 'utf8');

// Add pagination state
if (!psContent.includes('const [currentPage, setCurrentPage] = useState(1);')) {
  psContent = psContent.replace(
    "const [searchQuery, setSearchQuery] = useState('');",
    `const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // 25 | 50 | 100 | 'all'`
  );
}

// Reset currentPage when filter/search changes
if (!psContent.includes('useEffect(() => { setCurrentPage(1); }, [activeCategoryFilter')) {
  psContent = psContent.replace(
    "const handleCloseModal = () => {",
    `React.useEffect(() => {
    setCurrentPage(1);
  }, [activeCategoryFilter, activeSubCategoryFilter, searchQuery]);

  const handleCloseModal = () => {`
  );
}

// Add paginatedProducts slice
if (!psContent.includes('const paginatedProducts = useMemo(() => {')) {
  psContent = psContent.replace(
    "  // Subcategories available for currently selected Main Category in form",
    `  // Sliced products for Table View (Additive Client Pagination)
  const paginatedProducts = useMemo(() => {
    if (pageSize === 'all') return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'all' || filteredProducts.length === 0) return 1;
    return Math.ceil(filteredProducts.length / pageSize);
  }, [filteredProducts.length, pageSize]);

  // Subcategories available for currently selected Main Category in form`
  );
}

// Update table mapping from filteredProducts.map to paginatedProducts.map
psContent = psContent.replace(
  "{filteredProducts.map(product => {",
  "{paginatedProducts.map(product => {"
);

// Add Pagination Controls at the bottom of the table
const targetTableClosing = `          </table>
        </div>
      )}`;

const replacementTableClosing = `          </table>

          {/* Additive Table Pagination Bar */}
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
        </div>
      )}`;

psContent = psContent.replace(targetTableClosing, replacementTableClosing);

fs.writeFileSync(productsSectionPath, psContent, 'utf8');
console.log('✅ ProductsSection.jsx successfully updated with additive client pagination');

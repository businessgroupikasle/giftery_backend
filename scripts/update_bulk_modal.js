import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend');
const modalPath = path.join(frontendDir, 'src/pages/Dashboard/components/BulkImportModal.jsx');

let content = fs.readFileSync(modalPath, 'utf8');

// Update description
content = content.replace(
  'Tags, Images & Collections.',
  'Tags, Images (Optional) & Collections.'
);

// Update images column rendering in table
const targetImagesCol = `                          <td>
                            <span style={{ fontSize: '0.74rem', color: '#475569' }}>
                              {r.data?.images?.length || 0} {r.data?.images?.length === 1 ? 'img' : 'imgs'}
                            </span>
                          </td>`;

const replacementImagesCol = `                          <td>
                            {r.data?.images?.length > 0 ? (
                              <span style={{ fontSize: '0.74rem', color: '#166534', background: '#f0fdf4', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: 600 }}>
                                🖼️ {r.data.images.length} {r.data.images.length === 1 ? 'img' : 'imgs'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: '#64748b', background: '#f1f5f9', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                                None (Optional)
                              </span>
                            )}
                          </td>`;

content = content.replace(targetImagesCol, replacementImagesCol);

fs.writeFileSync(modalPath, content, 'utf8');
console.log('✅ BulkImportModal.jsx updated to clearly show optional images');

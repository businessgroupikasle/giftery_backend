import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import { productService } from './productService.js';

const getUploadDir = () => {
  return path.isAbsolute(env.UPLOAD_DIR)
    ? env.UPLOAD_DIR
    : path.resolve(process.cwd(), env.UPLOAD_DIR);
};

const parseBoolean = (val) => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }
  return false;
};

/**
 * Helper to process an image string or buffer into /uploads directory
 */
const processImageForImport = async (imgRef, zipImagesMap = new Map()) => {
  if (!imgRef || typeof imgRef !== 'string') return null;
  const trimmed = imgRef.trim();
  if (!trimmed) return null;

  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // 1. Check if image exists in ZIP extracted map
  const cleanZipKey = trimmed.replace(/^[/\\]+/, '').replace(/^images[/\\]+/, '');
  const foundZipBuffer = zipImagesMap.get(trimmed) || zipImagesMap.get(cleanZipKey) || zipImagesMap.get(path.basename(trimmed));

  if (foundZipBuffer) {
    const ext = path.extname(trimmed).replace('.', '') || 'jpg';
    const filename = `product-bulk-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, foundZipBuffer);
    return `/uploads/${filename}`;
  }

  // 2. If it's already a relative /uploads/ path
  if (trimmed.startsWith('/uploads/')) {
    const subPath = trimmed.replace('/uploads/', '');
    const localPath = path.join(uploadDir, subPath);
    if (fs.existsSync(localPath)) {
      return trimmed;
    }
    return trimmed;
  }

  // 3. If it's a data URI
  if (trimmed.startsWith('data:image/')) {
    try {
      const matches = trimmed.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        const filename = `product-bulk-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        return `/uploads/${filename}`;
      }
    } catch (e) {
      console.warn('Failed to parse base64 image during import:', e.message);
    }
  }

  // 4. If it's a remote HTTP/HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const response = await fetch(trimmed, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';
        else if (contentType.includes('svg')) ext = 'svg';
        else {
          const urlExt = path.extname(new URL(trimmed).pathname).replace('.', '');
          if (urlExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt.toLowerCase())) {
            ext = urlExt.toLowerCase();
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filename = `product-bulk-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
      }
    } catch (e) {
      console.warn(`Remote image download fallback for ${trimmed}:`, e.message);
    }
    return trimmed;
  }

  return trimmed;
};

export const bulkImportService = {
  /**
   * Generates a downloadable .xlsx template workbook containing all required columns and sample rows
   */
  generateTemplate: async () => {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    const mainCats = categories.filter(c => !c.parentId);
    const sampleMainCat = mainCats[0]?.name || 'Corporate Gifts';
    const sampleSubCats = categories.filter(c => c.parentId === (mainCats[0]?.id || ''));
    const sampleSubCat = sampleSubCats[0]?.name || 'Gift Hampers';

    const headers = [
      'Product Name',
      'SKU',
      'Price',
      'Compare Price',
      'Stock Qty',
      'Main Category',
      'Subcategory',
      'Description',
      'Specifications',
      'Product Tags',
      'Image 1',
      'Image 2',
      'Image 3',
      'Image 4',
      'Featured',
      'Best Sellers',
      'Popular',
      'New Arrivals',
      'Most Loved',
      'Gift Sets',
    ];

    const sampleRows = [
      {
        'Product Name': 'Executive Leather Desk Organiser Gift Set',
        'SKU': 'CORP-DSK-001',
        'Price': 2499,
        'Compare Price': 3299,
        'Stock Qty': 50,
        'Main Category': sampleMainCat,
        'Subcategory': sampleSubCat,
        'Description': 'Premium handcrafted vegan leather desktop organiser with integrated wireless charger and custom gold foil debossing.',
        'Specifications': 'Material: Vegan Leather\nColor: Tan Brown\nDimensions: 25cm x 15cm x 4cm\nPackaging: Luxury Rigid Gift Box',
        'Product Tags': 'luxury, leather, corporate gift, office, organizer, desk set',
        'Image 1': 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
        'Image 2': 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80',
        'Image 3': '',
        'Image 4': '',
        'Featured': 'TRUE',
        'Best Sellers': 'TRUE',
        'Popular': 'FALSE',
        'New Arrivals': 'TRUE',
        'Most Loved': 'FALSE',
        'Gift Sets': 'TRUE',
      },
      {
        'Product Name': 'Artisanal Scented Soy Candle & Aroma Diffuser Kit',
        'SKU': 'HOME-CAN-002',
        'Price': 1299,
        'Compare Price': 1699,
        'Stock Qty': 80,
        'Main Category': sampleMainCat,
        'Subcategory': '',
        'Description': 'Hand-poured 100% natural soy wax candle scented with French Lavender and Madagascar Vanilla, paired with a ceramic aroma diffuser.',
        'Specifications': 'Wax Type: 100% Soy Wax\nBurn Time: 45 Hours\nFragrance: Lavender & Vanilla\nWeight: 450g',
        'Product Tags': 'scented candle, aroma, relaxation, wellness, gift hamper',
        'Image 1': 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80',
        'Image 2': '',
        'Image 3': '',
        'Image 4': '',
        'Featured': 'FALSE',
        'Best Sellers': 'TRUE',
        'Popular': 'TRUE',
        'New Arrivals': 'FALSE',
        'Most Loved': 'TRUE',
        'Gift Sets': 'FALSE',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

    ws['!cols'] = [
      { wch: 38 },
      { wch: 16 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
      { wch: 45 },
      { wch: 35 },
      { wch: 30 },
      { wch: 35 },
      { wch: 35 },
      { wch: 35 },
      { wch: 35 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 13 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

    const categoryGuideRows = categories.map(c => {
      const parent = c.parentId ? categories.find(p => p.id === c.parentId) : null;
      return {
        'Type': c.parentId ? 'Subcategory' : 'Main Category',
        'Category Name': c.name,
        'Parent Main Category': parent ? parent.name : '— (Top-level Category) —',
      };
    });

    if (categoryGuideRows.length > 0) {
      const wsGuide = XLSX.utils.json_to_sheet(categoryGuideRows, {
        header: ['Type', 'Category Name', 'Parent Main Category'],
      });
      wsGuide['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 32 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, 'Categories Reference');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },

  /**
   * Extracts Excel workbook and images map from uploaded buffer (supports both .zip and .xlsx)
   */
  extractUploadBuffer: (fileBuffer, originalFilename = '') => {
    const fn = (originalFilename || '').toLowerCase();

    // 1. Explicit Excel extensions are never package zip files
    if (fn.endsWith('.xlsx') || fn.endsWith('.xls') || fn.endsWith('.csv')) {
      return {
        excelBuffer: fileBuffer,
        zipImagesMap: new Map(),
      };
    }

    // 2. Explicit ZIP package containing products.xlsx + images/ folder
    if (fn.endsWith('.zip')) {
      try {
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();

        // Check if this zip is actually an .xlsx file (which is internally an OpenXML zip)
        const isDirectOpenXml = zipEntries.some(
          e => e.entryName.startsWith('xl/') || e.entryName === '[Content_Types].xml'
        );
        if (isDirectOpenXml) {
          return {
            excelBuffer: fileBuffer,
            zipImagesMap: new Map(),
          };
        }

        const zipImagesMap = new Map();
        let excelBuffer = null;

        zipEntries.forEach(entry => {
          if (entry.isDirectory) return;
          const entryName = entry.entryName;
          const lowerName = entryName.toLowerCase();

          if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
            if (!excelBuffer || lowerName.includes('product')) {
              excelBuffer = entry.getData();
            }
          } else if (
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg') ||
            lowerName.endsWith('.png') ||
            lowerName.endsWith('.webp') ||
            lowerName.endsWith('.gif') ||
            lowerName.endsWith('.svg')
          ) {
            const buffer = entry.getData();
            zipImagesMap.set(entryName, buffer);
            zipImagesMap.set(entry.name, buffer); // Filename only
          }
        });

        if (!excelBuffer) {
          const err = new Error('No .xlsx or .xls Excel sheet found inside the uploaded ZIP archive.');
          err.statusCode = 400;
          throw err;
        }

        return { excelBuffer, zipImagesMap };
      } catch (e) {
        if (e.statusCode) throw e;
        const err = new Error(`Failed to parse ZIP archive: ${e.message}`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 3. Fallback: treat buffer as direct Excel workbook
    return {
      excelBuffer: fileBuffer,
      zipImagesMap: new Map(),
    };
  },

  /**
   * Parses and validates uploaded Excel buffer against database rules and existing product schema
   */
  parseAndValidate: async (fileBuffer, originalFilename = '') => {
    if (!fileBuffer || fileBuffer.length === 0) {
      const err = new Error('No file buffer provided');
      err.statusCode = 400;
      throw err;
    }

    const { excelBuffer, zipImagesMap } = bulkImportService.extractUploadBuffer(fileBuffer, originalFilename);

    const workbook = XLSX.read(excelBuffer, { type: 'buffer', raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      const err = new Error('The uploaded Excel file contains no worksheets');
      err.statusCode = 400;
      throw err;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return {
        summary: { total: 0, valid: 0, invalid: 0, newCount: 0, updateCount: 0 },
        rows: [],
        message: 'The uploaded worksheet contains no product data rows.',
      };
    }

    const [allCategories, existingProducts] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true, slug: true, parentId: true } }),
      prisma.product.findMany({ select: { id: true, name: true, sku: true, slug: true } }),
    ]);

    const existingProductBySku = new Map();
    existingProducts.forEach(p => {
      if (p.sku) existingProductBySku.set(String(p.sku).trim().toLowerCase(), p);
    });

    const sheetSkuMap = new Map();

    const validatedRows = [];
    let validCount = 0;
    let invalidCount = 0;
    let newCount = 0;
    let updateCount = 0;

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors = [];
      let action = 'CREATE';
      let existingProductId = null;

      // 1. Product Name (Required)
      const name = String(row['Product Name'] || row['name'] || '').trim();
      if (!name) {
        errors.push('Product Name is required');
      } else if (name.length < 2) {
        errors.push('Product Name must be at least 2 characters');
      }

      // 2. SKU
      const rawSku = String(row['SKU'] || row['sku'] || '').trim();
      const sku = rawSku || null;
      if (sku) {
        const lowerSku = sku.toLowerCase();
        if (existingProductBySku.has(lowerSku)) {
          action = 'UPDATE';
          existingProductId = existingProductBySku.get(lowerSku).id;
        }

        if (sheetSkuMap.has(lowerSku)) {
          errors.push(`SKU "${sku}" is duplicated at row ${sheetSkuMap.get(lowerSku)} in this Excel file`);
        } else {
          sheetSkuMap.set(lowerSku, rowNumber);
        }
      }

      // 3. Price
      const rawPrice = row['Price'] || row['price'];
      const price = parseFloat(rawPrice);
      if (rawPrice === '' || rawPrice === undefined || isNaN(price)) {
        errors.push('Price is required and must be a valid number');
      } else if (price < 0) {
        errors.push('Price cannot be negative');
      }

      // 4. Compare Price
      const rawComparePrice = row['Compare Price'] || row['comparePrice'];
      let comparePrice = null;
      if (rawComparePrice !== '' && rawComparePrice !== undefined && rawComparePrice !== null) {
        const cp = parseFloat(rawComparePrice);
        if (isNaN(cp) || cp < 0) {
          errors.push('Compare Price must be 0 or a positive number');
        } else {
          comparePrice = cp;
        }
      }

      // 5. Stock Qty
      const rawStock = row['Stock Qty'] || row['stock'] || row['Stock'];
      let stock = 0;
      if (rawStock !== '' && rawStock !== undefined) {
        const st = parseInt(rawStock, 10);
        if (isNaN(st) || st < 0) {
          errors.push('Stock Qty must be 0 or a positive integer');
        } else {
          stock = st;
        }
      }

      // 6. Category Mapping
      const rawMainCat = String(row['Main Category'] || row['Category'] || row['category'] || '').trim();
      const rawSubCat = String(row['Subcategory'] || row['Sub Category'] || row['subcategory'] || '').trim();
      let matchedCategoryId = null;
      let matchedCategoryName = '';
      let matchedSubCategoryId = null;
      let matchedSubCategoryName = '';

      if (!rawMainCat) {
        errors.push('Main Category is required');
      } else {
        const mainCat = allCategories.find(
          c => !c.parentId && c.name.toLowerCase().trim() === rawMainCat.toLowerCase()
        );

        if (!mainCat) {
          errors.push(`Main Category "${rawMainCat}" not found in database`);
        } else {
          matchedCategoryId = mainCat.id;
          matchedCategoryName = mainCat.name;

          if (rawSubCat) {
            const subCat = allCategories.find(
              c => c.parentId === mainCat.id && c.name.toLowerCase().trim() === rawSubCat.toLowerCase()
            );

            if (!subCat) {
              errors.push(`Subcategory "${rawSubCat}" not found under Main Category "${mainCat.name}"`);
            } else {
              matchedSubCategoryId = subCat.id;
              matchedSubCategoryName = subCat.name;
            }
          }
        }
      }

      // 7. Description
      const description = String(row['Description'] || row['description'] || '').trim();
      if (!description) {
        errors.push('Description is required');
      }

      // 8. Specifications
      const specifications = String(row['Specifications'] || row['specifications'] || '').trim() || null;

      // 9. Product Tags
      const rawTags = String(row['Product Tags'] || row['tags'] || '').trim();
      const tags = rawTags
        ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // 10. Images (1 to 4)
      const img1 = String(row['Image 1'] || row['image1'] || row['image'] || '').trim();
      const img2 = String(row['Image 2'] || row['image2'] || '').trim();
      const img3 = String(row['Image 3'] || row['image3'] || '').trim();
      const img4 = String(row['Image 4'] || row['image4'] || '').trim();

      const images = [img1, img2, img3, img4].filter(Boolean);
      if (images.length === 0) {
        errors.push('At least one product image is required (Image 1)');
      } else if (zipImagesMap.size > 0) {
        // Validate if image path exists in zip when image is a relative filename
        images.forEach((im, imgIdx) => {
          if (!im.startsWith('http://') && !im.startsWith('https://') && !im.startsWith('/uploads/') && !im.startsWith('data:')) {
            const cleanKey = im.replace(/^[/\\]+/, '').replace(/^images[/\\]+/, '');
            if (!zipImagesMap.has(im) && !zipImagesMap.has(cleanKey) && !zipImagesMap.has(path.basename(im))) {
              errors.push(`Image ${imgIdx + 1} "${im}" not found in the ZIP images folder`);
            }
          }
        });
      }

      // 11. Collections
      const featured = parseBoolean(row['Featured'] || row['isFeatured']);
      const isBestseller = parseBoolean(row['Best Sellers'] || row['isBestseller'] || row['Bestseller']);
      const isPopular = parseBoolean(row['Popular'] || row['isPopular']);
      const isNewArrival = parseBoolean(row['New Arrivals'] || row['isNewArrival'] || row['New Arrival']);
      const isMostLoved = parseBoolean(row['Most Loved'] || row['isMostLoved']);
      const isGiftSet = parseBoolean(row['Gift Sets'] || row['isGiftSet'] || row['Gift Set']);

      const isValid = errors.length === 0;
      if (isValid) {
        validCount += 1;
        if (action === 'UPDATE') updateCount += 1;
        else newCount += 1;
      } else {
        invalidCount += 1;
        action = 'ERROR';
      }

      validatedRows.push({
        rowNumber,
        isValid,
        action,
        existingProductId,
        errors,
        data: {
          id: existingProductId,
          name,
          sku,
          price,
          comparePrice,
          stock,
          categoryId: matchedCategoryId,
          mainCategoryName: matchedCategoryName || rawMainCat,
          subCategoryId: matchedSubCategoryId,
          subcategoryName: matchedSubCategoryName || rawSubCat,
          description,
          specifications,
          tags,
          images,
          featured,
          isFeatured: featured,
          isBestseller,
          isPopular,
          isNewArrival,
          isMostLoved,
          isGiftSet,
          isActive: true,
        },
      });
    });

    return {
      summary: {
        total: validatedRows.length,
        valid: validCount,
        invalid: invalidCount,
        newCount,
        updateCount,
      },
      rows: validatedRows,
    };
  },

  /**
   * Executes bulk creation / updates of validated product rows into PostgreSQL using the standard productService logic
   */
  executeBulkImport: async (productsToImport = [], zipImagesMap = new Map()) => {
    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      const err = new Error('No valid products provided for import');
      err.statusCode = 400;
      throw err;
    }

    const results = {
      imported: [],
      updated: [],
      failed: [],
    };

    for (let i = 0; i < productsToImport.length; i++) {
      const item = productsToImport[i];
      try {
        const processedImages = [];
        for (const imgUrl of item.images || []) {
          const storedUrl = await processImageForImport(imgUrl, zipImagesMap);
          if (storedUrl) processedImages.push(storedUrl);
        }

        const payload = {
          name: item.name,
          sku: item.sku || undefined,
          price: parseFloat(item.price),
          comparePrice: item.comparePrice ? parseFloat(item.comparePrice) : null,
          stock: parseInt(item.stock, 10) || 0,
          categoryId: item.categoryId,
          subCategoryId: item.subCategoryId || null,
          description: item.description,
          specifications: item.specifications || undefined,
          tags: Array.isArray(item.tags) ? item.tags : [],
          images: processedImages.length > 0 ? processedImages : item.images,
          featured: Boolean(item.featured || item.isFeatured),
          isFeatured: Boolean(item.isFeatured || item.featured),
          isBestseller: Boolean(item.isBestseller),
          isPopular: Boolean(item.isPopular),
          isNewArrival: Boolean(item.isNewArrival),
          isMostLoved: Boolean(item.isMostLoved),
          isGiftSet: Boolean(item.isGiftSet),
          isActive: true,
        };

        if (item.id && item.action === 'UPDATE') {
          const updatedProduct = await productService.update(item.id, payload);
          results.updated.push({
            id: updatedProduct.id,
            name: updatedProduct.name,
            sku: updatedProduct.sku,
            price: updatedProduct.price,
          });
        } else {
          const createdProduct = await productService.create(payload);
          results.imported.push({
            id: createdProduct.id,
            name: createdProduct.name,
            sku: createdProduct.sku,
            price: createdProduct.price,
          });
        }
      } catch (err) {
        console.error(`Failed to import/update product "${item.name}":`, err);
        results.failed.push({
          name: item.name,
          sku: item.sku,
          reason: err.message,
        });
      }
    }

    return {
      success: true,
      totalRequested: productsToImport.length,
      importedCount: results.imported.length,
      updatedCount: results.updated.length,
      failedCount: results.failed.length,
      imported: results.imported,
      updated: results.updated,
      failed: results.failed,
    };
  },
};

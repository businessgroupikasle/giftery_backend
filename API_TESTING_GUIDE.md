# Product Management API Testing Guide

## Base URL
```
http://localhost:5000
```

## Authentication
All dashboard endpoints require:
- **Header**: `Authorization: Bearer <token>`
- **Role**: ADMIN

---

## 1. UPLOAD ENDPOINTS

### Single File Upload
```
POST /upload
Content-Type: multipart/form-data

Body: 
- Field: "image"
- Value: <binary image file>

Response (201):
{
  "success": true,
  "data": {
    "url": "/uploads/product-1723456789-123456.jpg",
    "filename": "product-1723456789-123456.jpg",
    "size": 45678,
    "mimetype": "image/jpeg"
  },
  "message": "Image uploaded successfully"
}
```

### Multiple File Upload (Batch)
```
POST /upload/multiple
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- Field: "images"
- Values: <multiple image files>

Response (201):
{
  "success": true,
  "data": {
    "files": [
      {
        "url": "/uploads/file1.jpg",
        "filename": "file1.jpg",
        "size": 45678,
        "mimetype": "image/jpeg"
      }
    ],
    "failed": [],
    "total": 1,
    "succeeded": 1
  }
}
```

### Delete File
```
DELETE /upload/:filename
Authorization: Bearer <token>

Example: DELETE /upload/product-1723456789-123456.jpg

Response (200):
{
  "success": true,
  "data": { "filename": "product-1723456789-123456.jpg" },
  "message": "File deleted successfully"
}
```

### Validate Image URL
```
GET /upload/validate/:url
Authorization: Bearer <token>

Example: GET /upload/validate//uploads/product-1723456789-123456.jpg

Response (200):
{
  "success": true,
  "data": {
    "url": "/uploads/product-1723456789-123456.jpg",
    "valid": true
  }
}
```

---

## 2. PRODUCT DASHBOARD ENDPOINTS

### Get Product Stats
```
GET /dashboard/products/stats
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "totalProducts": 45,
    "activeProducts": 40,
    "inactiveProducts": 5,
    "lowStockCount": 8,
    "outOfStockCount": 2,
    "totalRevenue": 15000.50
  }
}
```

### Get All Products (with pagination, search, filters)
```
GET /dashboard/products?page=1&limit=20&search=gift&categoryId=cat123&status=active&stock=low&sort=newest
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- search: string (searches name, description, sku)
- categoryId: string
- status: "active" | "inactive"
- stock: "low" | "outofstock"
- sort: "newest" | "oldest" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc"

Response (200):
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "prod123",
        "name": "Gift Box",
        "slug": "gift-box",
        "price": 29.99,
        "stock": 5,
        "images": ["/uploads/img1.jpg"],
        "isActive": true,
        "category": { "name": "Gifts" },
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:25:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

### Get Product By ID
```
GET /dashboard/products/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "product": {
      "id": "prod123",
      "name": "Gift Box",
      "slug": "gift-box",
      "description": "Beautiful gift box",
      "price": 29.99,
      "comparePrice": 39.99,
      "stock": 5,
      "images": ["/uploads/img1.jpg", "/uploads/img2.jpg"],
      "sku": "GIFT-BOX-001",
      "weight": 0.5,
      "featured": true,
      "isBestseller": false,
      "isPopular": true,
      "isNewArrival": true,
      "isMostLoved": false,
      "isGiftSet": true,
      "isActive": true,
      "categoryId": "cat123",
      "subCategoryId": "subcat456",
      "specifications": "...",
      "customization": "...",
      "shippingReturns": "...",
      "tags": ["premium", "gift"],
      "rating": 4.8,
      "reviewsCount": 128,
      "category": { "id": "cat123", "name": "Gifts", "slug": "gifts" },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:25:00Z"
    }
  }
}
```

### Create Product
```
POST /dashboard/products
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "name": "Gift Box",
  "description": "Beautiful gift box for special occasions",
  "price": 29.99,
  "comparePrice": 39.99,
  "stock": 50,
  "images": ["/uploads/img1.jpg", "/uploads/img2.jpg"],
  "sku": "GIFT-BOX-001",
  "weight": 0.5,
  "featured": true,
  "isBestseller": false,
  "isPopular": true,
  "isNewArrival": true,
  "isMostLoved": false,
  "isGiftSet": true,
  "isActive": true,
  "categoryId": "cat123",
  "subCategoryId": "subcat456",
  "specifications": "100% premium material",
  "customization": "Engraving available",
  "shippingReturns": "Free shipping, 30-day returns",
  "tags": ["premium", "gift", "seasonal"],
  "rating": 4.8,
  "reviewsCount": 128
}

Response (201):
{
  "success": true,
  "data": { "product": { ...created product } },
  "message": "Product created"
}
```

### Update Product
```
PUT /dashboard/products/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body: (all fields optional)
{
  "name": "Updated Gift Box",
  "price": 34.99,
  "stock": 45,
  "images": ["/uploads/new-img1.jpg"],
  "isActive": true
}

Response (200):
{
  "success": true,
  "data": { "product": { ...updated product } },
  "message": "Product updated"
}
```

### Delete Product (with image cleanup)
```
DELETE /dashboard/products/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": null,
  "message": "Product deleted"
}
```

### Update Product Status (Active/Inactive)
```
PATCH /dashboard/products/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "isActive": false
}

Response (200):
{
  "success": true,
  "data": { "product": { ...updated product } },
  "message": "Product status updated"
}
```

### Update Inventory
```
PATCH /dashboard/products/:id/inventory
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "quantity": 100
}

Response (200):
{
  "success": true,
  "data": { "product": { ...updated product } },
  "message": "Inventory updated"
}
```

### Clone Product
```
POST /dashboard/products/:id/clone
Authorization: Bearer <token>

Response (201):
{
  "success": true,
  "data": { "product": { ...cloned product with new slug, SKU } },
  "message": "Product cloned"
}
```

---

## 3. BULK OPERATIONS

### Bulk Update Status
```
PATCH /dashboard/products/batch/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "ids": ["prod123", "prod456", "prod789"],
  "isActive": true
}

Response (200):
{
  "success": true,
  "data": {
    "updated": 3,
    "ids": ["prod123", "prod456", "prod789"]
  },
  "message": "Bulk status update completed"
}
```

### Bulk Delete
```
POST /dashboard/products/batch/delete
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "ids": ["prod123", "prod456", "prod789"]
}

Response (200):
{
  "success": true,
  "data": {
    "deleted": ["prod123", "prod456"],
    "failed": [{ "id": "prod789", "reason": "Product not found" }],
    "total": 3
  },
  "message": "Bulk deletion completed"
}
```

---

## 4. INVENTORY REPORTS

### Low Stock Products
```
GET /dashboard/products/stock/low?page=1&limit=20&threshold=10
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "data": [ ...products with stock <= 10 ],
    "meta": { "page": 1, "limit": 20, "total": 8, "pages": 1 }
  }
}
```

### Out of Stock Products
```
GET /dashboard/products/stock/outofstock?page=1&limit=20
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "data": [ ...products with stock == 0 ],
    "meta": { "page": 1, "limit": 20, "total": 2, "pages": 1 }
  }
}
```

### Products by Status
```
GET /dashboard/products/status/:status?page=1&limit=20
Authorization: Bearer <token>

Parameters:
- status: "active" | "inactive"

Response (200):
{
  "success": true,
  "data": {
    "data": [ ...products with specified status ],
    "meta": { "page": 1, "limit": 20, "total": 40, "pages": 2 }
  }
}
```

### Top Selling Products
```
GET /dashboard/products/top-selling?days=30&limit=10
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod123",
        "name": "Top Seller",
        "slug": "top-seller",
        "price": 29.99,
        "images": [...],
        "category": { "name": "Gifts" },
        "totalSold": 156
      }
    ]
  }
}
```

---

## 5. TESTING CHECKLIST

### ✅ Upload Operations
- [ ] Upload single image
- [ ] Upload multiple images
- [ ] Delete single file
- [ ] Validate image URL (valid)
- [ ] Validate image URL (invalid)
- [ ] Try uploading invalid file type (should fail)
- [ ] Try uploading oversized file (should fail)

### ✅ Product CRUD
- [ ] Create product without images (should fail)
- [ ] Create product with valid images
- [ ] Create product without required fields (should fail)
- [ ] Get all products with pagination
- [ ] Get all products with search filter
- [ ] Get all products with category filter
- [ ] Get all products with status filter
- [ ] Get single product by ID
- [ ] Update product (name, price, stock)
- [ ] Update product images (old images deleted)
- [ ] Delete product (images cleanup verified)
- [ ] Try accessing without auth token (should fail)
- [ ] Try accessing with invalid role (should fail)

### ✅ Status & Inventory
- [ ] Toggle product active/inactive status
- [ ] Update inventory quantity
- [ ] Try setting negative quantity (should fail)

### ✅ Bulk Operations
- [ ] Bulk update status (multiple products)
- [ ] Bulk delete (multiple products, verify images deleted)
- [ ] Bulk operations with invalid IDs (partial failure)

### ✅ Reports
- [ ] Get product stats
- [ ] Get low stock products
- [ ] Get out of stock products
- [ ] Get active products
- [ ] Get inactive products
- [ ] Get top selling products (last 30 days)

### ✅ Clone
- [ ] Clone product (new slug, new SKU, stock=0, inactive)
- [ ] Clone product with existing slug (should create unique)

---

## Error Responses

### Bad Request (400)
```json
{
  "success": false,
  "error": "Validation error message",
  "statusCode": 400
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": "Access denied. No token provided.",
  "statusCode": 401
}
```

### Forbidden (403)
```json
{
  "success": false,
  "error": "Access forbidden: insufficient permissions",
  "statusCode": 403
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Product not found",
  "statusCode": 404
}
```

### Conflict (409)
```json
{
  "success": false,
  "error": "Resource conflict",
  "statusCode": 409
}
```

### Internal Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error message",
  "statusCode": 500
}
```

---

## Notes

1. **Authentication**: Get a valid JWT token by logging in first
2. **Image URLs**: All images must be uploaded first, then referenced by their URLs
3. **Slugs**: Automatically generated from product name, conflicts resolved with timestamp
4. **File Cleanup**: Automatic on product delete and when updating with new images
5. **Pagination**: Default limit is 20, max recommended 100
6. **Filters**: Can be combined (e.g., search + category + status)
7. **Transactions**: Bulk operations use database transactions for consistency

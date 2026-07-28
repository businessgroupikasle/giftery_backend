/**
 * @fileoverview Shared JSDoc type definitions for backend.
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {'USER'|'ADMIN'|'VENDOR'} role
 * @property {string|null} avatar
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string|null} parentId
 * @property {string|null} image
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string} description
 * @property {number} price
 * @property {number} comparePrice
 * @property {number} stock
 * @property {string[]} images
 * @property {string} categoryId
 * @property {Category} category
 * @property {number} rating
 * @property {number} reviewCount
 * @property {boolean} featured
 * @property {string} createdAt
 */

/**
 * @typedef {Object} CartItem
 * @property {string} id
 * @property {string} productId
 * @property {Product} product
 * @property {number} quantity
 * @property {number} price
 */

/**
 * @typedef {Object} Cart
 * @property {string} id
 * @property {string} userId
 * @property {CartItem[]} items
 * @property {number} total
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} id
 * @property {string} productId
 * @property {Product} product
 * @property {number} quantity
 * @property {number} price
 */

/**
 * @typedef {Object} ShippingAddress
 * @property {string} fullName
 * @property {string} street
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {string} phone
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} userId
 * @property {'PENDING'|'CONFIRMED'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CANCELLED'|'REFUNDED'} status
 * @property {number} totalAmount
 * @property {ShippingAddress} shippingAddress
 * @property {OrderItem[]} items
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Review
 * @property {string} id
 * @property {string} userId
 * @property {string} productId
 * @property {User} user
 * @property {number} rating
 * @property {string} comment
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} orderId
 * @property {string} stripePaymentId
 * @property {'PENDING'|'PROCESSING'|'SUCCEEDED'|'FAILED'|'CANCELLED'|'REFUNDED'} status
 * @property {number} amount
 * @property {string} createdAt
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {any[]} data
 * @property {number} page
 * @property {number} limit
 * @property {number} total
 * @property {number} totalPages
 * @property {boolean} hasNext
 * @property {boolean} hasPrev
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} message
 * @property {any} data
 */

import { sendSuccess } from '../utils/response.js';

const MOCK_COLLECTIONS = [
  { id: 'col-1', name: 'Luxury Executive Suite', slug: 'executive-suite', productsCount: 24, status: 'Active' },
  { id: 'col-2', name: 'Bespoke Festive Keepsakes', slug: 'festive-keepsakes', productsCount: 38, status: 'Active' },
];

const MOCK_BRANDS = [
  { id: 'b-1', name: 'Montblanc Royal', logo: '/brands/montblanc.png', origin: 'Germany', productsCount: 15 },
  { id: 'b-2', name: 'Waterford Crystal', logo: '/brands/waterford.png', origin: 'Ireland', productsCount: 22 },
  { id: 'b-3', name: 'Swarovski Prestige', logo: '/brands/swarovski.png', origin: 'Austria', productsCount: 18 },
];

const MOCK_ATTRIBUTES = [
  { id: 'attr-1', name: 'Engraving Material', type: 'Select', options: ['Brass', 'Silver', 'Gold Foil', 'Laser Wood'] },
  { id: 'attr-2', name: 'Gift Box Color', type: 'Color Swatch', options: ['Royal Midnight', 'Champagne Gold', 'Ruby Velvet'] },
];

const MOCK_INVENTORY = [
  { id: 'inv-1', sku: 'GFT-CRYS-01', name: 'Royal Crystal Decanter Set', inStock: 45, reserved: 5, warehouse: 'Main Hub NY' },
  { id: 'inv-2', sku: 'GFT-LTHR-09', name: 'Custom Leather Journal', inStock: 120, reserved: 12, warehouse: 'West Coast LA' },
];

export const catalogController = {
  getCollections: (req, res) => sendSuccess(res, MOCK_COLLECTIONS, 'Collections fetched'),
  getBrands: (req, res) => sendSuccess(res, MOCK_BRANDS, 'Brands fetched'),
  getAttributes: (req, res) => sendSuccess(res, MOCK_ATTRIBUTES, 'Attributes fetched'),
  getInventory: (req, res) => sendSuccess(res, MOCK_INVENTORY, 'Inventory fetched'),
};

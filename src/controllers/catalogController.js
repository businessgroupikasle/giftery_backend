import { sendSuccess } from '../utils/response.js';

const MOCK_COLLECTIONS = [];
const MOCK_BRANDS = [];
const MOCK_ATTRIBUTES = [];
const MOCK_INVENTORY = [];

export const catalogController = {
  getCollections: (req, res) => sendSuccess(res, MOCK_COLLECTIONS, 'Collections fetched'),
  getBrands: (req, res) => sendSuccess(res, MOCK_BRANDS, 'Brands fetched'),
  getAttributes: (req, res) => sendSuccess(res, MOCK_ATTRIBUTES, 'Attributes fetched'),
  getInventory: (req, res) => sendSuccess(res, MOCK_INVENTORY, 'Inventory fetched'),
};


import { sendSuccess } from '../utils/response.js';

const MOCK_CMS_PAGES = [];
const MOCK_MEDIA_LIBRARY = [];

export const cmsController = {
  getPages: (req, res) => sendSuccess(res, MOCK_CMS_PAGES, 'CMS pages fetched'),
  getMedia: (req, res) => sendSuccess(res, MOCK_MEDIA_LIBRARY, 'Media library assets fetched'),
};


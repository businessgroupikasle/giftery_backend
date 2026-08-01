import { sendSuccess } from '../utils/response.js';

const MOCK_CMS_PAGES = [
  { id: 'cms-1', title: 'Corporate Gifting Guide 2026', slug: 'corporate-guide', status: 'Published', updatedAt: '2026-07-25' },
  { id: 'cms-2', title: 'Luxury Bespoke Packaging Terms', slug: 'packaging-terms', status: 'Published', updatedAt: '2026-07-29' },
];

const MOCK_MEDIA_LIBRARY = [
  { id: 'media-1', filename: 'crystal_decanter_hd.jpg', size: '2.4 MB', type: 'image/jpeg', url: '/uploads/crystal_decanter_hd.jpg' },
  { id: 'media-2', filename: 'luxury_box_gold_stamp.png', size: '1.8 MB', type: 'image/png', url: '/uploads/luxury_box_gold_stamp.png' },
  { id: 'media-3', filename: 'brand_video_teaser.mp4', size: '14.2 MB', type: 'video/mp4', url: '/uploads/brand_video_teaser.mp4' },
];

export const cmsController = {
  getPages: (req, res) => sendSuccess(res, MOCK_CMS_PAGES, 'CMS pages fetched'),
  getMedia: (req, res) => sendSuccess(res, MOCK_MEDIA_LIBRARY, 'Media library assets fetched'),
};

/**
 * Converts a string to a URL-safe slug.
 * @param {string} text - Input string.
 * @returns {string} Lowercase, hyphenated slug.
 */
export const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')    // Remove invalid chars
    .replace(/\s+/g, '-')             // Spaces to hyphens
    .replace(/-+/g, '-')              // Multiple hyphens to one
    .replace(/^-+|-+$/g, '');         // Strip leading/trailing hyphens
};

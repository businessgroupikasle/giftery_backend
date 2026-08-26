/**
 * Calculates pagination metadata and Prisma skip/take values.
 * @param {number|string} page - Current page (1-indexed).
 * @param {number|string} limit - Items per page.
 * @param {number} total - Total number of records.
 * @returns {{ skip: number, take: number, page: number, limit: number, total: number, totalPages: number, hasNext: boolean, hasPrev: boolean }}
 */
export const paginate = (page = 1, limit = 12, total = 0) => {
  const parsedPage  = Math.max(1, parseInt(page, 10)  || 1);
  const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 12));
  const totalPages  = Math.ceil(total / parsedLimit);
  const skip        = (parsedPage - 1) * parsedLimit;

  return {
    skip,
    take: parsedLimit,
    page: parsedPage,
    limit: parsedLimit,
    total,
    totalPages,
    hasNext: parsedPage < totalPages,
    hasPrev: parsedPage > 1,
  };
};

/**
 * Formats a paginated Prisma result into a standard response shape.
 * @param {any[]} data
 * @param {{ page: number, limit: number, total: number, totalPages: number, hasNext: boolean, hasPrev: boolean }} meta
 */
export const paginatedResponse = (data, meta) => ({
  data,
  meta: {
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    totalPages: meta.totalPages,
    hasNext: meta.hasNext,
    hasPrev: meta.hasPrev,
  },
});

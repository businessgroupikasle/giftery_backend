/**
 * Next readable enquiry ID for this year, e.g. "ENQ-2026-0042".
 * Counts existing enquiries and skips forward past any ID already taken.
 * @param {import('@prisma/client').PrismaClient} client
 */
export const nextEnquiryId = async (client) => {
  const year = new Date().getFullYear();
  let seq = (await client.enquiry.count()) + 1;
  let readableId = `ENQ-${year}-${String(seq).padStart(4, '0')}`;
  while (await client.enquiry.findUnique({ where: { id: readableId }, select: { id: true } })) {
    seq += 1;
    readableId = `ENQ-${year}-${String(seq).padStart(4, '0')}`;
  }
  return readableId;
};

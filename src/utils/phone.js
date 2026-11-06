import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile';

const NO_NUMBER = new Set(['', 'n/a', 'not provided']);

/**
 * Validates an optional phone number and returns it in international form.
 * The storefront always sends a full +countrycode number. Numbers without one came from
 * older pages, which only accepted Indian mobiles, so they're read as Indian.
 * @returns {string|null} e.g. "+971501234567", or null when no number was given.
 * @throws an error with statusCode 400 when a number was given but isn't valid.
 */
export const normalizeContactPhone = (value) => {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  if (NO_NUMBER.has(text.toLowerCase())) return null;
  const parsed = text.startsWith('+') ? parsePhoneNumberFromString(text) : parsePhoneNumberFromString(text, 'IN');
  if (!parsed?.isValid()) {
    throw Object.assign(new Error('Please enter a valid mobile number with its country code.'), { statusCode: 400 });
  }
  return parsed.number;
};

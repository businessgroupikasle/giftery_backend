import sharp from 'sharp';

const MAX_INPUT_PIXELS = 40000000;
const SVG_RASTER_EDGE = 2048;

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });

/**
 * Markup that can run code or fetch remote content.
 * SVG uploads containing any of it are refused outright; nothing is stripped or rewritten.
 */
const SVG_FORBIDDEN = [
  /<!doctype/i,
  /<!entity/i,
  /<\s*script/i,
  /<\s*foreignObject/i,
  /<\s*(iframe|embed|object|audio|video|animate|set)\b/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpe?g);base64,)/i,
  /url\(\s*["']?\s*(?!#)/i,
  /@import/i,
];

export function assertSafeSvg(buffer) {
  const text = buffer.toString('utf8');
  if (!/<svg[\s>]/i.test(text)) throw invalid('Invalid SVG file');
  if (SVG_FORBIDDEN.some((pattern) => pattern.test(text))) {
    throw invalid('This SVG contains scripts or external references. Export a plain SVG and try again.');
  }
}

const looksLikeSvg = (buffer) => /^\s*(?:\xEF\xBB\xBF)?(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i
  .test(buffer.subarray(0, 4096).toString('latin1'));

/**
 * Decodes an upload on the server, trusting neither its file name nor its declared type.
 * @returns {Promise<{ mimeType: string, data: Buffer, width: number, height: number, source: Buffer|null }>}
 */
export async function inspectArtwork(buffer) {
  if (looksLikeSvg(buffer)) {
    assertSafeSvg(buffer);
    try {
      // Browsers only ever receive this PNG, so uploaded SVG markup is never rendered by them.
      const data = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error', density: 300 })
        .resize({ width: SVG_RASTER_EDGE, height: SVG_RASTER_EDGE, fit: 'inside' })
        .png()
        .toBuffer();
      const { width, height } = await sharp(data).metadata();
      return { mimeType: 'image/png', data, width, height, source: buffer };
    } catch {
      throw invalid('This SVG could not be read. Export a plain SVG and try again.');
    }
  }
  try {
    const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' };
    const metadata = await sharp(buffer, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height || metadata.pages > 1) throw new Error('unsupported');
    await sharp(buffer, options).toBuffer();
    return { mimeType: `image/${metadata.format}`, data: buffer, width: metadata.width, height: metadata.height, source: null };
  } catch {
    throw invalid('Invalid image; PNG, JPG, SVG or WebP required');
  }
}

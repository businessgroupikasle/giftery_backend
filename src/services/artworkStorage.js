import path from 'path';
import { randomUUID } from 'crypto';
import { mkdir, open, unlink, readFile, realpath } from 'fs/promises';
import prisma from '../config/db.js';
import { env } from '../config/env.js';

const root = path.resolve(env.PRIVATE_ARTWORK_DIR);
const publicRoot = path.resolve(env.UPLOAD_DIR);
const relative = path.relative(publicRoot, root);
if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
  throw new Error('Private artwork directory must be outside the public upload directory');
}

async function ensurePrivateDirectory() {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const actualRoot = await realpath(root);
  const actualPublic = await realpath(publicRoot).catch((error) => {
    if (error.code === 'ENOENT') return publicRoot;
    throw error;
  });
  const relativeRoot = path.relative(actualPublic, actualRoot);
  if (!relativeRoot || (!relativeRoot.startsWith('..' + path.sep) && relativeRoot !== '..' && !path.isAbsolute(relativeRoot))) {
    throw new Error('Private artwork directory resolves inside public uploads');
  }
}

function filePath(key) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) throw new Error('Invalid artwork storage key');
  return path.join(root, key);
}

const MAX_ASSETS_PER_USER = 200;
const MAX_BYTES_PER_USER = 100 * 1024 * 1024;

const writePrivateFile = async (filename, data) => {
  const file = await open(filename, 'wx', 0o600);
  try { await file.writeFile(data); } finally { await file.close(); }
};

/**
 * Stores a validated image outside the public uploads directory and records it against its owner.
 * `source` optionally keeps a scanned original (an SVG) next to the file the browser renders.
 */
export async function storeArtwork(userId, mimeType, data, { kind = 'LOGO', originalName = null, width = null, height = null, source = null } = {}) {
  const key = randomUUID();
  const sourceKey = source ? randomUUID() : null;
  const written = [];
  const totalSize = data.length + (source?.length || 0);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      const usage = await tx.customizationAsset.aggregate({ where: { userId }, _sum: { size: true }, _count: true });
      if (usage._count >= MAX_ASSETS_PER_USER || (usage._sum.size || 0) + totalSize > MAX_BYTES_PER_USER) {
        const error = new Error('Artwork storage quota exceeded'); error.statusCode = 413; throw error;
      }
      await ensurePrivateDirectory();
      await writePrivateFile(filePath(key), data);
      written.push(filePath(key));
      if (source) {
        await writePrivateFile(filePath(sourceKey), source);
        written.push(filePath(sourceKey));
      }
      return tx.customizationAsset.create({
        data: { userId, mimeType, storageKey: key, size: totalSize, kind, originalName, width, height, sourceStorageKey: sourceKey },
        select: { id: true, kind: true, originalName: true, mimeType: true, width: true, height: true, size: true, createdAt: true },
      });
    });
  } catch (error) {
    await Promise.all(written.map((filename) => unlink(filename).catch(() => {})));
    throw error;
  }
}

export const readArtwork = (key) => readFile(filePath(key));

export const deleteArtwork = (key) => unlink(filePath(key)).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});

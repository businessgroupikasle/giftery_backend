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

export async function storeArtwork(userId, mimeType, data) {
  const key = randomUUID();
  const filename = filePath(key);
  let written = false;
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
      const usage = await tx.customizationAsset.aggregate({ where: { userId }, _sum: { size: true }, _count: true });
      if (usage._count >= 100 || (usage._sum.size || 0) + data.length > 100 * 1024 * 1024) {
        const error = new Error('Artwork storage quota exceeded'); error.statusCode = 413; throw error;
      }
      await ensurePrivateDirectory();
      const file = await open(filename, 'wx', 0o600);
      written = true;
      try { await file.writeFile(data); } finally { await file.close(); }
      return tx.customizationAsset.create({ data: { userId, mimeType, storageKey: key, size: data.length }, select: { id: true } });
    });
  } catch (error) {
    if (written) await unlink(filename).catch(() => {});
    throw error;
  }
}

export const readArtwork = (key) => readFile(filePath(key));

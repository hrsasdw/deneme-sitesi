import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { isSafeLocalId, resolveInside } from "@/lib/security";

export const MAX_SIZE = 50 * 1024 * 1024;
export const DATA_DIR = path.join(process.cwd(), ".data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const META_PATH = path.join(DATA_DIR, "files.json");

export function createId() {
  return randomBytes(6).toString("hex");
}

export function safeFileName(name) {
  return (name || "dosya").replace(/[^\w.\-()şŞıİğĞüÜöÖçÇ ]+/g, "_").slice(0, 180);
}

export function contentTypeFor() {
  return "application/octet-stream";
}

async function ensureStore() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await readFile(META_PATH, "utf8");
  } catch {
    await writeFile(META_PATH, "[]", "utf8");
  }
}

export async function readMeta() {
  await ensureStore();
  const raw = await readFile(META_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMeta(files) {
  await ensureStore();
  await writeFile(META_PATH, JSON.stringify(files, null, 2), "utf8");
}

export async function saveLocalFile({ id, originalName, buffer, size }) {
  if (!isSafeLocalId(id)) throw new Error("invalid_id");
  await ensureStore();
  const storedName = `${id}-${safeFileName(originalName)}`;
  const filePath = resolveInside(UPLOAD_DIR, storedName);
  if (!filePath) throw new Error("invalid_path");
  await writeFile(filePath, buffer);
  const record = {
    id,
    name: safeFileName(originalName),
    size,
    storedName,
    createdAt: new Date().toISOString(),
    storage: "local",
  };
  const files = await readMeta();
  files.unshift(record);
  await writeMeta(files);
  return record;
}

export async function getLocalFile(id) {
  if (!isSafeLocalId(id)) return null;
  const files = await readMeta();
  const record = files.find((file) => file.id === id);
  if (!record) return null;
  const filePath = resolveInside(UPLOAD_DIR, record.storedName);
  if (!filePath) return null;
  const buffer = await readFile(filePath);
  return { record, buffer };
}

export async function deleteLocalFile(id) {
  if (!isSafeLocalId(id)) return false;
  const files = await readMeta();
  const record = files.find((file) => file.id === id);
  if (!record) return false;
  const filePath = resolveInside(UPLOAD_DIR, record.storedName);
  if (filePath) {
    try {
      await unlink(filePath);
    } catch {
      // already gone
    }
  }
  await writeMeta(files.filter((file) => file.id !== id));
  return true;
}

export function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isVercelHost() {
  return Boolean(process.env.VERCEL);
}

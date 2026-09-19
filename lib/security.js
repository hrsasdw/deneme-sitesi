import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";

const buckets = new Map();

export function isAuthConfigured() {
  return (process.env.UPLOAD_KEY || "").length >= 20;
}

export function checkUploadKey(provided) {
  if (!isAuthConfigured()) return false;
  const left = createHash("sha256").update(String(provided || "")).digest();
  const right = createHash("sha256").update(process.env.UPLOAD_KEY).digest();
  return timingSafeEqual(left, right);
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0 };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count };
}

export function isSafeLocalId(id) {
  return typeof id === "string" && /^[a-f0-9]{12}$/.test(id);
}

export function isSafeBlobPath(pathname) {
  if (typeof pathname !== "string") return false;
  if (!pathname.startsWith("uploads/")) return false;
  if (pathname.includes("..") || pathname.includes("\\") || pathname.includes("\0")) return false;
  return pathname.length < 240;
}

export function resolveInside(root, name) {
  const base = path.basename(name);
  const resolved = path.resolve(root, base);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

export function isVercelBlobUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return (
      parsed.hostname === "blob.vercel-storage.com" ||
      parsed.hostname.endsWith(".blob.vercel-storage.com") ||
      parsed.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function contentDisposition(name) {
  const fallback = (name || "dosya")
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/["\\\r\n]/g, "_")
    .slice(0, 120) || "dosya";
  const encoded = encodeURIComponent(name || "dosya").replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

import { NextResponse } from "next/server";
import { createId, hasBlobToken, isVercelHost, MAX_SIZE, saveLocalFile } from "@/lib/files";
import { checkUploadKey, clientIp, isAuthConfigured, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (isVercelHost()) {
    return NextResponse.json({ error: "Canlı sitede yerel yükleme kapalı." }, { status: 403 });
  }
  if (!isAuthConfigured() || !checkUploadKey(request.headers.get("x-upload-key") || "")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (hasBlobToken()) {
    return NextResponse.json({ error: "Blob yapılandırılmışken yerel yükleme kullanılmaz." }, { status: 400 });
  }

  const limited = rateLimit(`upload:${clientIp(request)}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok fazla istek. Biraz bekleyin." }, { status: 429 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Dosya seçilmedi." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya 50 MB sınırını aşıyor." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const record = await saveLocalFile({
    id: createId(),
    originalName: file.name,
    buffer,
    size: file.size,
  });

  return NextResponse.json({
    id: record.id,
    name: record.name,
    size: record.size,
    createdAt: record.createdAt,
    storage: "local",
  });
}

import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { hasBlobToken, MAX_SIZE } from "@/lib/files";
import { checkUploadKey, clientIp, isAuthConfigured, isSafeBlobPath, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isAuthConfigured() || !checkUploadKey(request.headers.get("x-upload-key") || "")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  if (!hasBlobToken()) {
    return NextResponse.json({ error: "Depolama yapılandırılmamış." }, { status: 503 });
  }

  const limited = rateLimit(`upload:${clientIp(request)}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!limited.ok) {
    return NextResponse.json({ error: "Çok fazla istek. Biraz bekleyin." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isSafeBlobPath(pathname)) {
          throw new Error("invalid_path");
        }
        return {
          maximumSizeInBytes: MAX_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false,
          allowedContentTypes: ["application/octet-stream"],
          validUntil: Date.now() + 60 * 1000,
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch {
    return NextResponse.json({ error: "Yükleme başarısız." }, { status: 400 });
  }
}

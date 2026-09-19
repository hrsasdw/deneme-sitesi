import { del, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { deleteLocalFile, hasBlobToken, isVercelHost, readMeta } from "@/lib/files";
import { checkUploadKey, isAuthConfigured, isSafeBlobPath, isSafeLocalId, isVercelBlobUrl } from "@/lib/security";

export const runtime = "nodejs";

function publicStatus() {
  return {
    blobReady: hasBlobToken(),
    keyRequired: true,
    authConfigured: isAuthConfigured(),
    vercelHost: isVercelHost(),
  };
}

export async function GET(request) {
  const status = publicStatus();
  if (!checkUploadKey(request.headers.get("x-upload-key") || "")) {
    return NextResponse.json({ files: [], ...status });
  }

  const local = (await readMeta()).map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    createdAt: file.createdAt,
    storage: "local",
    url: `/f/${file.id}`,
    downloadUrl: `/f/${file.id}`,
  }));

  let remote = [];
  if (hasBlobToken()) {
    const { blobs } = await list({ prefix: "uploads/" });
    remote = blobs
      .filter((blob) => isSafeBlobPath(blob.pathname))
      .map((blob) => {
        const name = blob.pathname.split("/").pop() || blob.pathname;
        return {
          id: blob.pathname,
          name,
          size: blob.size,
          createdAt: blob.uploadedAt,
          storage: "blob",
          url: blob.url,
          downloadUrl: blob.downloadUrl || blob.url,
        };
      });
  }

  const files = [...remote, ...local].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return NextResponse.json({ files, ...status });
}

export async function DELETE(request) {
  if (!isAuthConfigured() || !checkUploadKey(request.headers.get("x-upload-key") || "")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { id, storage, url } = payload || {};
  if (storage === "blob") {
    if (!isVercelBlobUrl(url) || !isSafeBlobPath(id)) {
      return NextResponse.json({ error: "Geçersiz dosya." }, { status: 400 });
    }
    await del(url);
    return NextResponse.json({ ok: true });
  }
  if (isSafeLocalId(id)) {
    await deleteLocalFile(id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Silinecek dosya yok." }, { status: 400 });
}

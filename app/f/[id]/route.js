import { NextResponse } from "next/server";
import { contentTypeFor, getLocalFile } from "@/lib/files";
import { contentDisposition, isSafeLocalId } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!isSafeLocalId(id)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  const found = await getLocalFile(id);
  if (!found) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }

  const { record, buffer } = found;
  const headers = new Headers();
  headers.set("Content-Type", contentTypeFor());
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  headers.set("Content-Disposition", contentDisposition(record.name));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return new NextResponse(new Uint8Array(buffer), { headers });
}

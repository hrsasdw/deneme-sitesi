# Dosya yükleme

Paylaşılan indirme linkleri herkese açık olur. Yükleme, silme ve dosya listesi yalnızca `UPLOAD_KEY` ile çalışır.

## Vercel

1. Application Preset: **Next.js**
2. Storage → **Blob** → `BLOB_READ_WRITE_TOKEN`
3. Environment Variable: `UPLOAD_KEY` (en az 20 karakter, gizli tut)
4. Redeploy

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import "./globals.css";

const MAX_SIZE = 50 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name) {
  const match = /\.([^.]+)$/.exec(name || "");
  return match ? match[1].toLowerCase() : "dosya";
}

export default function HomePage() {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [blobReady, setBlobReady] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [vercelHost, setVercelHost] = useState(false);
  const [uploadKey, setUploadKey] = useState("");
  const [copied, setCopied] = useState("");

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/files", {
      headers: { "x-upload-key": uploadKey },
    });
    const data = await response.json();
    setFiles(data.files || []);
    setBlobReady(Boolean(data.blobReady));
    setAuthConfigured(data.authConfigured !== false);
    setVercelHost(Boolean(data.vercelHost));
  }, [uploadKey]);

  useEffect(() => {
    refresh().catch(() => setMessage("Dosya listesi alınamadı."));
  }, [refresh]);

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 1600);
  }

  async function sendFiles(fileList) {
    const selected = [...fileList];
    if (!selected.length) return;
    if (!uploadKey) {
      setMessage("Yüklemek için anahtarı gir.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      for (const file of selected) {
        if (file.size > MAX_SIZE) {
          throw new Error(`${file.name} 50 MB sınırını aşıyor.`);
        }
        setProgress(8);
        if (blobReady) {
          await upload(`uploads/${file.name.replace(/[/\\]/g, "_")}`, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            headers: { "x-upload-key": uploadKey },
            contentType: "application/octet-stream",
            multipart: true,
            onUploadProgress: ({ percentage }) => setProgress(Math.max(8, Math.round(percentage))),
          });
        } else {
          const body = new FormData();
          body.append("file", file);
          const response = await fetch("/api/upload-local", {
            method: "POST",
            headers: { "x-upload-key": uploadKey },
            body,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Yükleme başarısız.");
          setProgress(100);
        }
      }
      await refresh();
      setMessage("Yükleme tamamlandı. Paylaşmak için doğrudan bağlantıyı kopyala.");
    } catch (error) {
      setMessage(error.message || "Yükleme başarısız.");
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile(file) {
    const response = await fetch("/api/files", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        "x-upload-key": uploadKey,
      },
      body: JSON.stringify({ id: file.id, storage: file.storage, url: file.url }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Silinemedi.");
      return;
    }
    await refresh();
  }

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Doğrudan bağlantılı paylaşım</p>
          <h1>Dosya yükle, linki kopyala</h1>
          <p className="lede">
            Yükleme yalnızca anahtar ile. Ziyaretçiler dosya listesini göremez; sadece
            verdiğin indirme linkini kullanır. `.exe`, `.bat` ve `.cmd` çalıştırılmaz,
            indirme olarak verilir.
          </p>
        </div>
        <div className="chip-row">
          <span className="chip">.exe</span>
          <span className="chip">.bat</span>
          <span className="chip">.cmd</span>
          <span className="chip">50 MB</span>
        </div>
      </header>

      {!authConfigured ? (
        <p className="notice">
          Yükleme kapalı. Vercel Environment Variables içine en az 20 karakterlik
          `UPLOAD_KEY` ekleyip yeniden deploy et.
        </p>
      ) : null}

      {!blobReady && vercelHost ? (
        <p className="notice">
          Kalıcı dosya için Vercel → Storage → Blob oluştur ve `BLOB_READ_WRITE_TOKEN`
          ekle. Application Preset: Next.js.
        </p>
      ) : null}

      <section className="panel">
        <label htmlFor="upload-key">Yükleme anahtarı</label>
        <input
          id="upload-key"
          type="password"
          autoComplete="off"
          value={uploadKey}
          onChange={(event) => setUploadKey(event.target.value)}
          placeholder="Sadece sende olan anahtar"
        />
      </section>

      <section
        className={`drop ${dragOver ? "over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          sendFiles(event.dataTransfer.files);
        }}
      >
        <h2>Dosyayı buraya bırak</h2>
        <p>Anahtarı girdikten sonra yükle. Linki paylaştığın kişi indirebilir.</p>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          onChange={(event) => sendFiles(event.target.files)}
        />
        {busy ? (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </section>

      {message ? <p className="notice">{message}</p> : null}

      <section className="file-list">
        {files.length === 0 ? (
          <div className="empty">
            {uploadKey
              ? "Henüz dosya yok."
              : "Dosyalar herkese açık listelenmez. Anahtarı girince kendi yüklemelerin görünür."}
          </div>
        ) : (
          files.map((file) => {
            const absolute = file.url.startsWith("http")
              ? file.url
              : `${origin}${file.url}`;
            const downloadAbs = file.downloadUrl.startsWith("http")
              ? file.downloadUrl
              : `${origin}${file.downloadUrl}`;
            return (
              <article className="file-card" key={`${file.storage}-${file.id}`}>
                <h3>
                  {file.name} <span className="ext">.{extensionOf(file.name)}</span>
                </h3>
                <div className="file-meta">
                  <span className="chip">{formatSize(file.size || 0)}</span>
                  <span className="chip">{file.storage === "blob" ? "Vercel Blob" : "Yerel"}</span>
                  <span className="chip">
                    {file.createdAt ? new Date(file.createdAt).toLocaleString("tr-TR") : ""}
                  </span>
                </div>
                <div className="link-row" style={{ marginTop: 12 }}>
                  <div className="link-box" title={absolute}>
                    {absolute}
                  </div>
                  <button type="button" onClick={() => copyText(file.id, absolute)}>
                    {copied === file.id ? "Kopyalandı" : "Linki kopyala"}
                  </button>
                  <a className="btn ghost" href={downloadAbs}>
                    İndir
                  </a>
                  <button type="button" className="danger" onClick={() => removeFile(file)}>
                    Sil
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

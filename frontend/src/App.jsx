import React, { useMemo, useState } from "react";

/**
 * SCZN3 / Smart Target — simple uploader
 * Sends multipart/form-data with field name: "image"
 * Endpoint: /api/sec
 */
export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const apiBase = useMemo(() => {
    // Prefer env if present, otherwise same-origin (works when frontend+backend are together)
    const envBase =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_API_BASE || import.meta.env.VITE_BACKEND_URL)) ||
      "";
    return (envBase || "").replace(/\/$/, "");
  }, []);

  const endpoint = useMemo(() => {
    // IMPORTANT: backend currently accepts POST /api/sec (not /api/sec/compute)
    const path = "/api/sec";
    return apiBase ? `${apiBase}${path}` : path;
  }, [apiBase]);

  function onPickFile(e) {
    const f = e.target.files && e.target.files[0];
    setError("");
    setResult(null);
    setFile(f || null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError('Pick an image first (required field: "image").');
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      // MUST be exactly "image" (matches backend)
      fd.append("image", file, file.name);

      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
      });

      const contentType = res.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        throw new Error(
          isJson ? JSON.stringify(data, null, 2) : String(data || res.statusText)
        );
      }

      setResult(data);
    } catch (err) {
      setError(err?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: "8px 0" }}>The Smart Target™</h1>
      <div style={{ opacity: 0.8, marginBottom: 16 }}>Upload → /api/sec → show response</div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="file"
          accept="image/*"
          onChange={onPickFile}
        />

        {previewUrl && (
          <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
            <div style={{ marginBottom: 8, opacity: 0.8 }}>Preview</div>
            <img
              src={previewUrl}
              alt="preview"
              style={{ maxWidth: "100%", height: "auto", borderRadius: 6 }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {busy ? "Sending..." : "Send to SCZN3 SEC backend"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Endpoint: <code>{endpoint}</code> (multipart field: <code>image</code>)
        </div>
      </form>

      {error && (
        <pre style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#2b0000", color: "#ffd6d6", overflowX: "auto" }}>
          {error}
        </pre>
      )}

      {result != null && (
        <pre style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "#111", color: "#cfe8ff", overflowX: "auto" }}>
          {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

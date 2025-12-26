import React, { useMemo, useState } from "react";

export default function App() {
  // Backend base (can override with VITE_API_BASE on Render)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const fallback = "https://sczn3-sec-backend-pipe.onrender.com";
    const base = raw || fallback;
    return base.replace(/\/+$/, "");
  }, []);

  const ENDPOINT = `${API_BASE}/api/sec`;

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState("");

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setError("");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  }

  async function onSend() {
    setResp(null);
    setError("");

    if (!file) {
      setError("Pick an image first.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      // IMPORTANT: multipart field name must be exactly "image"
      form.append("image", file);

      const r = await fetch(ENDPOINT, {
        method: "POST",
        body: form,
      });

      const text = await r.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!r.ok) {
        setError(`HTTP ${r.status}`);
      }
      setResp(data);
    } catch (err) {
      setError(err?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 8px" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 12, lineHeight: 1.4 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 320 }}>
          <input type="file" accept="image/*" onChange={onPickFile} />
          <div style={{ height: 10 }} />
          <button
            onClick={onSend}
            disabled={loading || !file}
            style={{
              padding: "10px 14px",
              fontSize: 16,
              cursor: loading || !file ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 10, color: "crimson" }}>
              <b>Error:</b> {error}
            </div>
          ) : null}
        </div>

        {previewUrl ? (
          <div>
            <img
              src={previewUrl}
              alt="preview"
              style={{
                maxWidth: 520,
                width: "100%",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
          </div>
        ) : null}
      </div>

      <h2 style={{ marginTop: 22 }}>Response</h2>
      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 10, overflowX: "auto" }}>
        {resp ? JSON.stringify(resp, null, 2) : "(no response yet)"}
      </pre>
    </div>
  );
}

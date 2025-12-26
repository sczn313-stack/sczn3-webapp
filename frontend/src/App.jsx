import React, { useMemo, useState } from "react";

export default function App() {
  // Always point at the real backend (NOT /api/sec on the static site)
  const API_BASE = useMemo(() => {
    const raw = (import.meta?.env?.VITE_API_BASE || "").trim();
    const base = raw || "https://sczn3-sec-backend-pipe.onrender.com";
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
        setError(`Request failed (${r.status}). See response below.`);
      }

      setResp(data);
    } catch (err) {
      setError(
        `Network/CORS error. If this happens, we’ll allow your site domain in backend CORS.\n\n${String(
          err?.message || err
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h2 style={{ marginTop: 0 }}>SCZN3 SEC — Upload Test</h2>

      <div style={{ marginBottom: 10, fontSize: 14, opacity: 0.85 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <input
            type="file"
            accept="image/*"
            onChange={onPickFile}
            style={{ marginBottom: 10 }}
          />

          <button
            onClick={onSend}
            disabled={loading || !file}
            style={{
              width: "100%",
              padding: "14px 12px",
              fontSize: 16,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              cursor: loading || !file ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
          </button>

          {error ? (
            <div style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "crimson" }}>
              {error}
            </div>
          ) : null}
        </div>

        <div style={{ flex: "1 1 320px" }}>
          {previewUrl ? (
            <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, overflow: "hidden" }}>
              <img src={previewUrl} alt="preview" style={{ width: "100%", display: "block" }} />
            </div>
          ) : (
            <div style={{ opacity: 0.7, fontSize: 14 }}>Preview will show here after you pick an image.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Response</h3>
        <pre style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.06)", overflowX: "auto" }}>
          {resp ? JSON.stringify(resp, null, 2) : "(none yet)"}
        </pre>
      </div>
    </div>
  );
}

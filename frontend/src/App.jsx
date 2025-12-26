import { useEffect, useMemo, useState } from "react";

export default function App() {
  // Backend base (can override with VITE_API_BASE in Render later)
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

  useEffect(() => {
    // manage preview URL cleanly
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResp(null);
    setError("");
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
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 8px" }}>SCZN3 SEC — Upload Test</h1>

      <div style={{ marginBottom: 10, opacity: 0.9 }}>
        <div><b>Endpoint:</b> {ENDPOINT}</div>
        <div><b>multipart field:</b> image</div>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 320, flex: "1 1 320px" }}>
          <input type="file" accept="image/*" onChange={onPickFile} />
          <div style={{ marginTop: 10 }}>
            <button
              onClick={onSend}
              disabled={loading}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #999",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {loading ? "Sending..." : "Send to SCZN3 SEC backend"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 10, color: "#b00020", fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ minWidth: 320, flex: "1 1 420px" }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid #ccc" }}
            />
          ) : (
            <div style={{ padding: 16, border: "1px dashed #777", borderRadius: 10, opacity: 0.8 }}>
              Pick an image to preview it here.
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Response</h2>
      <pre style={{ background: "#f4f4f4", padding: 12, borderRadius: 10, overflow: "auto" }}>
        {resp ? JSON.stringify(resp, null, 2) : "(none yet)"}
      </pre>
    </div>
  );
}

import React, { useMemo, useState } from "react";

/*
  frontend/src/App.jsx
  SCZN3 Upload Test — clean version (no checkmarks / no extra UI indicators)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-123.onrender.com";
const UPLOAD_PATH = "/api/upload";

function sanitizeApiBase(maybeBase) {
  const raw = (maybeBase || "").trim();
  return (raw || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function validateApiBase(base) {
  if (!base) return "API Base is empty.";
  if (base.includes("<") || base.includes(">"))
    return "API Base contains placeholder text (< >).";
  if (base.includes("onrenderder.com"))
    return "API Base has a typo: onrenderder.com (should be onrender.com).";

  try {
    const u = new URL(base);
    if (u.username || u.password)
      return "API Base contains user credentials (not allowed).";
    if (u.protocol !== "https:" && u.protocol !== "http:")
      return "API Base must start with http:// or https://";
    return null;
  } catch {
    return "API Base is not a valid URL.";
  }
}

export default function App() {
  const apiBase = useMemo(() => {
    const envBase =
      typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_API_BASE_URL
        : "";
    return sanitizeApiBase(envBase);
  }, []);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Ready.");
  const [uploading, setUploading] = useState(false);
  const [responseText, setResponseText] = useState("");

  const baseError = useMemo(() => validateApiBase(apiBase), [apiBase]);

  async function onUpload() {
    setResponseText("");

    if (baseError) {
      setStatus(`Upload error: ${baseError}`);
      return;
    }

    if (!file) {
      setStatus("Upload error: Please choose a file first.");
      return;
    }

    setUploading(true);
    setStatus("Uploading…");

    try {
      const url = `${apiBase}${UPLOAD_PATH}`;

      const form = new FormData();
      form.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      setResponseText(text);

      if (!res.ok) {
        setStatus(`Upload error: ${res.status} ${res.statusText}`);
      } else {
        setStatus("Upload successful.");
      }
    } catch (err) {
      setStatus(`Upload error: ${err?.message || String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 44, margin: "10px 0 18px" }}>SCZN3 Upload Test</h1>

      <div style={{ marginBottom: 14 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setStatus(f ? "File selected." : "Ready.");
          }}
        />
        <button
          onClick={onUpload}
          disabled={uploading}
          style={{
            marginLeft: 10,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: uploading ? "#f2f2f2" : "white",
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      <div style={{ fontSize: 20, marginBottom: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ fontSize: 18, opacity: 0.85, marginBottom: 16 }}>
        <strong>API Base:</strong> {apiBase}
      </div>

      {responseText ? (
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Response</div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              color: "#eee",
              padding: 12,
              borderRadius: 10,
              overflowX: "auto",
            }}
          >
            {responseText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

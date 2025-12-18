import React, { useMemo, useState } from "react";

/*
  frontend/src/App.jsx
  SCZN3 Upload Test + Analyze/SEC (two-button version)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-123.onrender.com";

// You can override these with Render env vars if you want:
// VITE_UPLOAD_PATH=/api/upload
// VITE_SEC_PATH=/api/sec
const DEFAULT_UPLOAD_PATH = "/api/upload";
const DEFAULT_SEC_PATH = "/api/sec";

function sanitizeApiBase(maybeBase) {
  const raw = (maybeBase || "").trim();
  return (raw || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function sanitizePath(maybePath, fallback) {
  const raw = (maybePath || "").trim();
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
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

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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

  const uploadPath = useMemo(() => {
    const envPath =
      typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_UPLOAD_PATH
        : "";
    return sanitizePath(envPath, DEFAULT_UPLOAD_PATH);
  }, []);

  const secPath = useMemo(() => {
    const envPath =
      typeof import.meta !== "undefined" ? import.meta.env?.VITE_SEC_PATH : "";
    return sanitizePath(envPath, DEFAULT_SEC_PATH);
  }, []);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [secResult, setSecResult] = useState(null);

  const baseError = useMemo(() => validateApiBase(apiBase), [apiBase]);

  async function postMultipart(path) {
    setResponseText("");
    setSecResult(null);

    if (baseError) {
      setStatus(`Error: ${baseError}`);
      return;
    }
    if (!file) {
      setStatus("Error: Please choose a file first.");
      return;
    }

    setBusy(true);
    setStatus("Working…");

    try {
      const url = `${apiBase}${path}`;

      const form = new FormData();
      // If your backend expects "image" instead of "file", change this key:
      form.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      const text = await res.text();
      setResponseText(text);

      if (!res.ok) {
        setStatus(`Error: ${res.status} ${res.statusText}`);
        return;
      }

      const json = tryParseJson(text);
      if (json) setSecResult(json);

      setStatus("Success.");
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function renderSecPreview(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Try to find windage/elevation in common shapes
    const windage =
      obj.windage ??
      obj.Windage ??
      obj.sec?.windage ??
      obj.sec?.Windage ??
      obj.result?.windage ??
      obj.result?.Windage;

    const elevation =
      obj.elevation ??
      obj.Elevation ??
      obj.sec?.elevation ??
      obj.sec?.Elevation ??
      obj.result?.elevation ??
      obj.result?.Elevation;

    if (windage == null && elevation == null) return null;

    return (
      <div
        style={{
          marginTop: 14,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>SEC Preview</div>
        <div style={{ fontSize: 18 }}>
          <div>
            <strong>Windage:</strong> {String(windage)}
          </div>
          <div>
            <strong>Elevation:</strong> {String(elevation)}
          </div>
        </div>
      </div>
    );
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
            setResponseText("");
            setSecResult(null);
          }}
        />

        <button
          onClick={() => postMultipart(uploadPath)}
          disabled={busy}
          style={{
            marginLeft: 10,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: busy ? "#f2f2f2" : "white",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Working…" : "Upload"}
        </button>

        <button
          onClick={() => postMultipart(secPath)}
          disabled={busy}
          style={{
            marginLeft: 10,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: busy ? "#f2f2f2" : "white",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Working…" : "Analyze / SEC"}
        </button>
      </div>

      <div style={{ fontSize: 20, marginBottom: 12 }}>
        <strong>Status:</strong> {status}
      </div>

      <div style={{ fontSize: 18, opacity: 0.85, marginBottom: 8 }}>
        <strong>API Base:</strong> {apiBase}
      </div>

      <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
        <div>
          <strong>Upload Path:</strong> {uploadPath}
        </div>
        <div>
          <strong>SEC Path:</strong> {secPath}
        </div>
      </div>

      {renderSecPreview(secResult)}

      {responseText ? (
        <div style={{ marginTop: 16 }}>
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

import React, { useMemo, useState } from "react";

/**
 * frontend/src/App.jsx
 * SCZN3 SEC Test — clean UI
 * - Uploads image to /api/upload
 * - Requests SEC clicks from /api/sec
 * - Displays ONLY click corrections + arrows (two decimals)
 */

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const UPLOAD_PATH = "/api/upload";
const SEC_PATH = "/api/sec";

function sanitizeApiBase(maybeBase) {
  const raw = (maybeBase || "").trim();
  return raw || DEFAULT_API_BASE;
}

function validateApiBase(base) {
  if (!base) return "API Base is empty.";
  if (base.includes("<") || base.includes(">")) return "API Base contains placeholder <> characters.";
  let u;
  try {
    u = new URL(base);
  } catch {
    return "API Base is not a valid URL.";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "API Base must start with http:// or https://";
  return null;
}

function fmt2(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function windArrow(clicks) {
  const n = Number(clicks);
  if (!Number.isFinite(n) || n === 0) return "•";
  return n > 0 ? "→" : "←";
}

function elevArrow(clicks) {
  const n = Number(clicks);
  if (!Number.isFinite(n) || n === 0) return "•";
  return n > 0 ? "↑" : "↓";
}

export default function App() {
  const [apiBaseInput, setApiBaseInput] = useState(DEFAULT_API_BASE);
  const apiBase = useMemo(() => sanitizeApiBase(apiBaseInput), [apiBaseInput]);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Idle.");
  const [busy, setBusy] = useState(false);

  const [sec, setSec] = useState(null); // { windage_clicks, elevation_clicks }

  const apiBaseError = useMemo(() => validateApiBase(apiBase), [apiBase]);

  async function postForm(path) {
    if (!file) throw new Error("Pick an image first.");
    if (apiBaseError) throw new Error(apiBaseError);

    const url = new URL(path, apiBase).toString();
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(url, { method: "POST", body: form });
    const text = await res.text();

    // Try JSON first, fall back to text
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

  async function onUpload() {
    try {
      setBusy(true);
      setSec(null);
      setStatus("Uploading...");
      await postForm(UPLOAD_PATH);
      setStatus("Upload: Success.");
    } catch (e) {
      setStatus(`Upload: Error — ${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyzeSEC() {
    try {
      setBusy(true);
      setStatus("Analyzing / SEC...");
      const data = await postForm(SEC_PATH);

      // Expect: { ok:true, sec:{ windage_clicks, elevation_clicks } }
      const nextSec = data?.sec || null;
      if (!nextSec) throw new Error("No SEC object returned from /api/sec.");
      setSec({
        windage_clicks: Number(nextSec.windage_clicks ?? 0),
        elevation_clicks: Number(nextSec.elevation_clicks ?? 0),
      });
      setStatus("SEC: Success.");
    } catch (e) {
      setSec(null);
      setStatus(`SEC: Error — ${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 48, margin: "0 0 16px" }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy}
        />
        <button onClick={onUpload} disabled={busy || !file}>Upload</button>
        <button onClick={onAnalyzeSEC} disabled={busy || !file}>Analyze / SEC</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div><strong>Status:</strong> {status}</div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div><strong>API Base:</strong> {apiBase}</div>
        <div style={{ opacity: 0.75, marginTop: 4 }}>
          Upload Path: {UPLOAD_PATH} <br />
          SEC Path: {SEC_PATH}
        </div>
        {apiBaseError && (
          <div style={{ marginTop: 8 }}>
            <strong>API Base Error:</strong> {apiBaseError}
          </div>
        )}
      </div>

      {/* SEC Card — clicks only */}
      {sec && (
        <div style={{ border: "2px solid #111", borderRadius: 12, padding: 18, maxWidth: 520 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Windage</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
              {windArrow(sec.windage_clicks)} {fmt2(sec.windage_clicks)}
            </div>

            <div style={{ height: 10 }} />

            <div style={{ fontSize: 22, fontWeight: 700 }}>Elevation</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
              {elevArrow(sec.elevation_clicks)} {fmt2(sec.elevation_clicks)}
            </div>

            <div style={{ marginTop: 14, fontStyle: "italic", opacity: 0.8 }}>
              Index: 000
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

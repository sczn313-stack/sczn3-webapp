import React, { useMemo, useState, useEffect } from "react";

/*
  frontend/src/App.jsx
  SCZN3 Shooter Experience Card (SEC)
  - Analyze / SEC (POST /api/sec)
  - Shows clicks only (two decimals) + arrows + 3-digit index
  - Download SEC card as PNG image
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

function sanitizeApiBase(maybeBase) {
  const raw = (maybeBase || "").trim();
  return raw || DEFAULT_API_BASE;
}

function validateApiBase(base) {
  if (!base) return "API Base is empty.";
  if (base.includes("<") || base.includes(">")) return "API Base contains placeholder <> characters.";
  try {
    const u = new URL(base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "API Base must start with http:// or https://";
    return null;
  } catch {
    return "API Base is not a valid URL.";
  }
}

function fmt2(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

function pad3(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return "000";
  return String(Math.floor(num)).padStart(3, "0");
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

function makeSecPng({ windageClicks, elevationClicks, index }) {
  // 4x6-ish aspect, but sized for crisp phone viewing
  const W = 1200;
  const H = 800;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // helpers
  const centerX = W / 2;

  // title
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", centerX, 95);

  // labels
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Windage", centerX, 235);

  // windage value
  ctx.font = "800 92px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const wArrow = windArrow(windageClicks);
  const wVal = fmt2(windageClicks);
  ctx.fillText(`${wArrow} ${wVal}`, centerX, 330);

  // elevation label
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Elevation", centerX, 480);

  // elevation value
  ctx.font = "800 92px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const eArrow = elevArrow(elevationClicks);
  const eVal = fmt2(elevationClicks);
  ctx.fillText(`${eArrow} ${eVal}`, centerX, 575);

  // footer index
  ctx.font = "italic 34px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.globalAlpha = 0.85;
  ctx.fillText(`Index: ${index}`, centerX, 710);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

export default function App() {
  const [apiBaseInput] = useState(DEFAULT_API_BASE);
  const apiBase = useMemo(() => sanitizeApiBase(apiBaseInput), [apiBaseInput]);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("Idle.");
  const [busy, setBusy] = useState(false);

  const [sec, setSec] = useState(null); // { windage_clicks, elevation_clicks }
  const [secIndex, setSecIndex] = useState("000");

  const apiBaseError = useMemo(() => validateApiBase(apiBase), [apiBase]);

  useEffect(() => {
    const raw = localStorage.getItem(INDEX_KEY);
    const n = raw ? Number(raw) : 0;
    const safe = Number.isFinite(n) && n >= 0 ? n : 0;
    setSecIndex(pad3(safe));
  }, []);

  function bumpIndex() {
    const raw = localStorage.getItem(INDEX_KEY);
    const current = raw ? Number(raw) : 0;
    const next = (Number.isFinite(current) && current >= 0 ? current : 0) + 1;
    localStorage.setItem(INDEX_KEY, String(next));
    const p = pad3(next);
    setSecIndex(p);
    return p;
  }

  async function postSec() {
    if (!file) throw new Error("Pick an image first.");
    if (apiBaseError) throw new Error(apiBaseError);

    const url = new URL(SEC_PATH, apiBase).toString();
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(url, { method: "POST", body: form });
    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

  async function onAnalyzeSEC() {
    try {
      setBusy(true);
      setStatus("Analyzing / SEC...");
      const data = await postSec();

      const nextSec = data?.sec || null;
      if (!nextSec) throw new Error("No SEC object returned from /api/sec.");

      setSec({
        windage_clicks: Number(nextSec.windage_clicks ?? 0),
        elevation_clicks: Number(nextSec.elevation_clicks ?? 0),
      });

      const newIndex = bumpIndex();
      setStatus(`SEC: Success. Saved Index ${newIndex}.`);
    } catch (e) {
      setSec(null);
      setStatus(`SEC: Error — ${e.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function onDownloadPng() {
    if (!sec) return;
    const png = makeSecPng({
      windageClicks: sec.windage_clicks,
      elevationClicks: sec.elevation_clicks,
      index: secIndex,
    });

    const a = document.createElement("a");
    a.href = png;
    a.download = `SCZN3_SEC_${secIndex}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        <button onClick={onAnalyzeSEC} disabled={busy || !file}>Analyze / SEC</button>
        <button onClick={onDownloadPng} disabled={!sec}>Download SEC (PNG)</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div><strong>Status:</strong> {status}</div>
        {apiBaseError && (
          <div style={{ marginTop: 8 }}>
            <strong>API Base Error:</strong> {apiBaseError}
          </div>
        )}
      </div>

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
              Index: {secIndex}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

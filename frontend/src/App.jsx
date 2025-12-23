import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SCZN3 Shooter Experience Card (SEC) — v1 (Simple)
 *
 * HARD RULE (LOCK):
 *  - Direction is determined ONLY from the RAW SIGNED click numbers.
 *  - Display shows ABS(value) with 2 decimals AFTER direction is chosen.
 *
 * Signed convention (required):
 *  - windage_clicks:  negative = LEFT,  positive = RIGHT
 *  - elevation_clicks: negative = DOWN, positive = UP
 *
 * If your backend uses the opposite sign, fix backend. Do not “flip” in the UI.
 */

// ✅ Default backend (change only if you deploy a new backend)
const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// ---------- small helpers ----------
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function isNum(n) {
  return Number.isFinite(Number(n));
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Try hard to extract windage/elevation clicks from many possible backend shapes.
 * Returns { w, e } as NUMBERS (signed).
 */
function extractClicks(payload) {
  if (!payload) return { w: null, e: null };

  // If backend wraps result
  const obj = payload.result && typeof payload.result === "object" ? payload.result : payload;

  // Common key variants
  const wCandidates = [
    obj.windage_clicks,
    obj.windageClicks,
    obj.windage,
    obj.w,
    obj.clicks?.windage_clicks,
    obj.clicks?.windageClicks,
    obj.clicks?.windage,
  ];

  const eCandidates = [
    obj.elevation_clicks,
    obj.elevationClicks,
    obj.elevation,
    obj.e,
    obj.clicks?.elevation_clicks,
    obj.clicks?.elevationClicks,
    obj.clicks?.elevation,
  ];

  const w = wCandidates.find((v) => isNum(v));
  const e = eCandidates.find((v) => isNum(v));

  return {
    w: isNum(w) ? Number(w) : null,
    e: isNum(e) ? Number(e) : null,
  };
}

/**
 * LOCKED direction logic:
 * - Decide arrow from SIGN.
 * - Display ABS(value) formatted to 2 decimals.
 */
function lockedDirection(value, axis) {
  const v = Number(value);
  if (!Number.isFinite(v) || v === 0) {
    return { arrow: "", text: "0.00" };
  }

  if (axis === "windage") {
    // negative LEFT, positive RIGHT
    const arrow = v < 0 ? "←" : "→";
    return { arrow, text: Math.abs(v).toFixed(2) };
  }

  if (axis === "elevation") {
    // negative DOWN, positive UP
    const arrow = v < 0 ? "↓" : "↑";
    return { arrow, text: Math.abs(v).toFixed(2) };
  }

  return { arrow: "", text: Math.abs(v).toFixed(2) };
}

/**
 * Simple SEC PNG generator (canvas)
 */
function renderSecPng({ windage, elevation, index }) {
  const W = 1200;
  const H = 800;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 4;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // Title
  ctx.fillStyle = "#111111";
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 140);

  // Labels
  ctx.font = "bold 52px Arial";
  ctx.fillText("Windage", W / 2, 270);
  ctx.fillText("Elevation", W / 2, 520);

  // Values
  ctx.font = "bold 150px Arial";
  ctx.fillText(`${windage.arrow} ${windage.text}`, W / 2, 410);
  ctx.fillText(`${elevation.arrow} ${elevation.text}`, W / 2, 660);

  // Index
  ctx.font = "italic 44px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`Index: ${String(index).padStart(3, "0")}`, W / 2, 740);

  return canvas.toDataURL("image/png");
}

function nextIndex() {
  const raw = localStorage.getItem(INDEX_KEY);
  const n = Number(raw);
  const next = Number.isFinite(n) ? n + 1 : 1;
  localStorage.setItem(INDEX_KEY, String(next));
  return next;
}

function useApiBase() {
  // Allow build-time override if you ever set VITE_API_BASE in Vite:
  // const base = import.meta.env.VITE_API_BASE;
  // but keep safe for environments where import.meta is undefined.
  let base = "";
  try {
    base = (import.meta?.env?.VITE_API_BASE || "").trim();
  } catch {
    base = "";
  }
  return base || DEFAULT_API_BASE;
}

export default function App() {
  const apiBase = useApiBase();

  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [rawBackend, setRawBackend] = useState(null);

  const [result, setResult] = useState(null); // { windage_clicks, elevation_clicks, index, pngDataUrl }
  const [secPngUrl, setSecPngUrl] = useState("");

  // revoke old object URLs
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile(f) {
    setError("");
    setRawBackend(null);
    setResult(null);
    setSecPngUrl("");

    if (!f) {
      setFile(null);
      setPreviewUrl("");
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  }

  async function onAnalyze() {
    setError("");
    setRawBackend(null);
    setResult(null);
    setSecPngUrl("");

    if (!file) {
      setError("Pick a target photo first.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const url = `${apiBase}${SEC_PATH}`;

      const res = await fetch(url, {
        method: "POST",
        body: fd,
      });

      const text = await res.text().catch(() => "");
      const json = safeJsonParse(text);

      // Preserve raw for Debug section
      setRawBackend(json ?? { raw: text, status: res.status });

      if (!res.ok) {
        setError(`Backend error (${res.status}). Check Debug.`);
        return;
      }

      const payload = json ?? {};
      const { w, e } = extractClicks(payload);

      // FAIL CLOSED if missing clicks
      if (!isNum(w) || !isNum(e)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      // LOCKED direction + formatting
      const windage = lockedDirection(w, "windage");
      const elevation = lockedDirection(e, "elevation");

      const index = nextIndex();

      const png = renderSecPng({ windage, elevation, index });
      if (!png) {
        setError("PNG render failed.");
        return;
      }

      setResult({
        windage_clicks: round2(w),
        elevation_clicks: round2(e),
        index,
        windage,
        elevation,
        pngDataUrl: png,
      });

      setSecPngUrl(png);
    } catch (err) {
      setError("Load failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadPng() {
    if (!secPngUrl) return;
    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${String(result?.index ?? 0).padStart(3, "0")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function sharePng() {
    if (!secPngUrl) return;

    // Convert dataURL to Blob/File for Web Share
    try {
      const res = await fetch(secPngUrl);
      const blob = await res.blob();
      const fileObj = new File([blob], "SCZN3_SEC.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          title: "SCZN3 SEC",
          text: "SCZN3 Shooter Experience Card (SEC)",
          files: [fileObj],
        });
      } else {
        // fallback: just download
        downloadPng();
      }
    } catch {
      downloadPng();
    }
  }

  const analyzeDisabled = busy || !file;
  const downloadDisabled = !secPngUrl;
  const shareDisabled = !secPngUrl;

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 46, marginBottom: 20 }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <button
          onClick={() => cameraInputRef.current?.click()}
          style={btnStyle}
          disabled={busy}
        >
          Take Target Photo
        </button>

        <button
          onClick={() => uploadInputRef.current?.click()}
          style={btnStyle}
          disabled={busy}
        >
          Upload Target Photo
        </button>

        <button
          onClick={onAnalyze}
          style={{ ...btnStyle, opacity: analyzeDisabled ? 0.55 : 1 }}
          disabled={analyzeDisabled}
        >
          Analyze / SEC
        </button>

        <button
          onClick={downloadPng}
          style={{ ...btnStyle, opacity: downloadDisabled ? 0.55 : 1 }}
          disabled={downloadDisabled}
        >
          Download SEC (PNG)
        </button>

        <button
          onClick={sharePng}
          style={{ ...btnStyle, opacity: shareDisabled ? 0.55 : 1 }}
          disabled={shareDisabled}
        >
          Share SEC
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
      />

      {error ? (
        <div style={errorStyle}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* Target Preview */}
        <div>
          <h2 style={{ marginTop: 14 }}>Target Preview</h2>
          <div style={panelStyle}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Target preview"
                style={{ width: "100%", display: "block", borderRadius: 8 }}
              />
            ) : (
              <div style={{ color: "#666" }}>Pick a photo to preview it here.</div>
            )}
          </div>
        </div>

        {/* SEC Preview */}
        <div>
          <h2 style={{ marginTop: 14 }}>SEC Preview</h2>
          <div style={panelStyle}>
            {secPngUrl ? (
              <img
                src={secPngUrl}
                alt="SEC preview"
                style={{ width: "100%", display: "block", borderRadius: 8 }}
              />
            ) : (
              <div style={{ color: "#666" }}>Analyze to generate the SEC card.</div>
            )}
          </div>
        </div>
      </div>

      {/* Unlock section (kept simple) */}
      <div style={{ marginTop: 18, ...panelStyle }}>
        <b>Want more?</b>
        <div style={{ marginTop: 6, fontSize: 16 }}>
          Unlock Advanced Mode (distance-aware clicks, saved sessions, coaching).
        </div>
        <button style={{ ...btnStyle, marginTop: 10 }} disabled>
          Unlock Advanced
        </button>
      </div>

      {/* Debug */}
      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Debug</summary>
        <div style={{ marginTop: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          <div><b>API Base:</b> {apiBase}</div>
          <div><b>SEC Path:</b> {SEC_PATH}</div>
          <div><b>Has file:</b> {file ? "yes" : "no"}</div>
          <div style={{ marginTop: 10 }}>
            <b>Raw backend response:</b>
            <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
{rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none)"}
            </pre>
          </div>

          {result ? (
            <div style={{ marginTop: 10 }}>
              <b>Parsed clicks (SIGNED):</b>
              <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 8 }}>
{JSON.stringify(
  {
    windage_clicks: result.windage_clicks,
    elevation_clicks: result.elevation_clicks,
    index: result.index,
    windage_display: `${result.windage.arrow} ${result.windage.text}`,
    elevation_display: `${result.elevation.arrow} ${result.elevation.text}`,
  },
  null,
  2
)}
              </pre>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

const btnStyle = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #cfcfcf",
  background: "#ffffff",
  fontSize: 16,
  fontWeight: 700,
};

const panelStyle = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
  minHeight: 260,
};

const errorStyle = {
  marginTop: 8,
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #f3b5b5",
  background: "#ffe6e6",
};

import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — LOCKED
  - Arrows MUST come from raw SIGNED values.
  - Display MUST be ABS(value) with two decimals.
  - Frontend normalizes uploads to JPEG (downscaled) to prevent iOS/HEIC/huge-image backend 500s.
  - Backend: POST /api/sec returns { sec: { windage_clicks, elevation_clicks } }
*/

const BUILD_TAG = "LOCK_v5_2025-12-23";

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// ----------------- helpers -----------------

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// Strict numeric parse:
// - treats "" / " " as NaN (prevents accidental 0)
// - parses number-like strings safely
function toNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function abs2(n) {
  if (!isNum(n)) return "0.00";
  return Math.abs(n).toFixed(2);
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = cur + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return String(nxt).padStart(3, "0");
}

function arrowForWindage(w) {
  // DIAL_TO_CENTER: negative => LEFT, positive => RIGHT
  if (!isNum(w) || w === 0) return "";
  return w < 0 ? "←" : "→";
}

function arrowForElevation(e) {
  // DIAL_TO_CENTER: negative => DOWN, positive => UP
  if (!isNum(e) || e === 0) return "";
  return e < 0 ? "↓" : "↑";
}

function getApiBase() {
  try {
    const u = new URL(window.location.href);
    const api = u.searchParams.get("api");
    if (api) return api.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_API_BASE;
}

function getClicksFromBackend(data) {
  // Expected shapes:
  // 1) { sec: { windage_clicks, elevation_clicks }, ... }
  // 2) { windage_clicks, elevation_clicks, ... }  (fallback)
  const src =
    data && typeof data === "object" && data.sec && typeof data.sec === "object"
      ? data.sec
      : data;

  const w = toNum(src?.windage_clicks);
  const e = toNum(src?.elevation_clicks);
  return { w, e };
}

async function normalizeToJpeg(file, maxDim = 1800, quality = 0.9) {
  // Converts browser-decodable images into a safe JPEG (and downscales big images).
  // This prevents many iOS-related backend 500s (HEIC / huge resolution / memory spikes).
  const imgUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = imgUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const scale = Math.min(1, maxDim / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, outW, outH);

    const blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );

    if (!blob) throw new Error("JPEG conversion failed");

    return { blob, filename: "target.jpg" };
  } finally {
    URL.revokeObjectURL(imgUrl);
  }
}

// ----------------- UI -----------------

export default function App() {
  const [apiBase] = useState(getApiBase());

  const [file, setFile] = useState(null);
  const [imgUrl, setImgUrl] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Raw backend response for debug panel
  const [rawBackend, setRawBackend] = useState(null);

  // Locked signed results
  const [result, setResult] = useState({
    windage_clicks: 0,
    elevation_clicks: 0,
    index: "000",
  });

  const inputCameraRef = useRef(null);
  const inputUploadRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const view = useMemo(() => {
    const w = Number(result.windage_clicks);
    const e = Number(result.elevation_clicks);

    return {
      wind: { arrow: arrowForWindage(w), text: abs2(w), signed: w },
      elev: { arrow: arrowForElevation(e), text: abs2(e), signed: e },
      index: result.index,
    };
  }, [result]);

  async function onAnalyze() {
    setError("");
    setBusy(true);

    try {
      if (!file) {
        setError("Pick a target photo first.");
        return;
      }

      // Normalize upload to safe JPEG (prevents many backend 500s from iOS images)
      const norm = await normalizeToJpeg(file);

      const form = new FormData();
      form.append("image", norm.blob, norm.filename);

      const url = `${apiBase}${SEC_PATH}`;
      const res = await fetch(url, {
        method: "POST",
        body: form,
        headers: { Accept: "application/json" },
      });

      const text = await res.text().catch(() => "");
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      setRawBackend(data);

      if (!res.ok) {
        setError(`Backend error (${res.status}).`);
        return;
      }

      const { w, e } = getClicksFromBackend(data);

      // Fail closed if missing clicks
      if (!isNum(w) || !isNum(e)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      setResult({
        windage_clicks: w,
        elevation_clicks: e,
        index,
      });
    } catch (err) {
      setError("Error: Load failed");
    } finally {
      setBusy(false);
    }
  }

  function onPickCamera() {
    setError("");
    inputCameraRef.current?.click();
  }

  function onPickUpload() {
    setError("");
    inputUploadRef.current?.click();
  }

  function onFilePicked(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setRawBackend(null);
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 56, margin: 0, lineHeight: 1.05 }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onPickCamera} style={btnStyle}>
          Take Target Photo
        </button>
        <button onClick={onPickUpload} style={btnStyle}>
          Upload Target Photo
        </button>
        <button onClick={onAnalyze} style={{ ...btnStyle, fontWeight: 700 }} disabled={busy}>
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>
      </div>

      {error ? (
        <div style={errStyle}>
          <b>{error}</b>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 18 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Target Preview</h2>
          <div style={panelStyle}>
            {imgUrl ? (
              <img
                src={imgUrl}
                alt="Target preview"
                style={{ width: "100%", borderRadius: 10, display: "block" }}
              />
            ) : (
              <div style={{ opacity: 0.6 }}>Choose a target photo to preview.</div>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 8 }}>SEC Preview</h2>
          <div style={panelStyle}>
            <SecCard wind={view.wind} elev={view.elev} index={view.index} />
          </div>
        </div>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          <b>Debug</b>
        </summary>

        <div style={{ marginTop: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          <div>Build: {BUILD_TAG}</div>
          <div>API Base: {apiBase}</div>
          <div>SEC Path: {SEC_PATH}</div>
          <div>Has file: {file ? "yes" : "no"}</div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Raw backend response:</div>
            <pre style={preStyle}>
              {rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none)"}
            </pre>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Parsed clicks (SIGNED):</div>
            <pre style={preStyle}>
              {JSON.stringify(
                {
                  windage_clicks: view.wind.signed,
                  elevation_clicks: view.elev.signed,
                  index: view.index,
                  windage_display: view.wind.text,
                  elevation_display: view.elev.text,
                  windage_arrow: view.wind.arrow,
                  elevation_arrow: view.elev.arrow,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </details>

      {/* hidden inputs */}
      <input
        ref={inputCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />
      <input
        ref={inputUploadRef}
        type="file"
        accept="image/*"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />
    </div>
  );
}

function SecCard({ wind, elev, index }) {
  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700 }}>
        SCZN3 Shooter Experience Card (SEC)
      </div>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Windage</div>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1 }}>
          <span style={{ display: "inline-block", width: 92, textAlign: "center" }}>
            {wind.arrow}
          </span>
          <span>{wind.text}</span>
        </div>
      </div>

      <div style={{ marginTop: 26, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Elevation</div>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1 }}>
          <span style={{ display: "inline-block", width: 92, textAlign: "center" }}>
            {elev.arrow}
          </span>
          <span>{elev.text}</span>
        </div>
      </div>

      <div style={{ marginTop: 22, textAlign: "center", fontStyle: "italic", fontSize: 22 }}>
        Index: {index}
      </div>
    </div>
  );
}

// ----------------- styles -----------------

const btnStyle = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #cfd6dd",
  background: "#fff",
  cursor: "pointer",
};

const errStyle = {
  marginTop: 14,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #f1b1b1",
  background: "#fde7e7",
};

const panelStyle = {
  border: "1px solid #e2e6ea",
  borderRadius: 14,
  padding: 14,
  minHeight: 260,
  background: "#fff",
};

const cardStyle = {
  border: "6px solid #111",
  borderRadius: 14,
  padding: 20,
  minHeight: 420,
  background: "#fff",
};

const preStyle = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  background: "#f7f7f7",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e6e6e6",
};

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SCZN3 Shooter Experience Card (SEC) UI
 * - Take Photo OR Upload Photo (two buttons so iOS can’t force camera-only)
 * - POST image to /api/sec (multipart/form-data key MUST be: "file")
 * - Shows target preview
 * - Renders SEC card (clicks only, two decimals)
 * - Download PNG + Share (if supported)
 *
 * IMPORTANT:
 * - We FAIL CLOSED if backend does NOT return click values.
 * - We DO NOT default missing clicks to 0.00.
 */

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// Hard-wired message for blank / not-enough-holes cases
const NO_SHOTS_MSG =
  "No / not enough bullet holes detected.\nShoot 3–7 rounds, then take or upload a target photo.";

// If your arrow directions are reversed, set these to true.
// (You said BOTH windage + elevation were wrong.)
const FLIP_WINDAGE = true;
const FLIP_ELEVATION = true;

function toFixed2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toFixed(2);
}

function isNum(x) {
  return Number.isFinite(Number(x));
}

// Safely read nested paths like "clicks.windage" or "result.windage_clicks"
function getPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

// Extract click values ONLY from click-looking keys (no generic "windage"/"elevation").
function pickClickNumber(obj, paths) {
  for (const p of paths) {
    const cur = getPath(obj, p);
    if (isNum(cur)) return Number(cur);

    // Also handle strings like "R 2.50" or "2.50 clicks"
    if (typeof cur === "string") {
      const m = cur.match(/-?\d+(\.\d+)?/);
      if (m && isNum(m[0])) return Number(m[0]);
    }
  }
  return null;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = Number.isFinite(cur) ? cur + 1 : 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return String(nxt).padStart(3, "0");
}

function arrowForWindage(clicks) {
  if (!isNum(clicks) || Number(clicks) === 0) return "→";
  const right = Number(clicks) > 0;
  const effectiveRight = FLIP_WINDAGE ? !right : right;
  return effectiveRight ? "→" : "←";
}

function arrowForElevation(clicks) {
  if (!isNum(clicks) || Number(clicks) === 0) return "↑";
  const up = Number(clicks) > 0;
  const effectiveUp = FLIP_ELEVATION ? !up : up;
  return effectiveUp ? "↑" : "↓";
}

function abs2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return Math.abs(x).toFixed(2);
}

// Build the SEC SVG (4x6 portrait ratio)
function buildSecSvg({ windageClicks, elevationClicks, index }) {
  const W = 1200;
  const H = 1800;

  const wArrow = arrowForWindage(windageClicks);
  const eArrow = arrowForElevation(elevationClicks);

  const wVal = abs2(windageClicks);
  const eVal = abs2(elevationClicks);

  // Clean, customer-facing: clicks only, two decimals
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="#fff" stroke="#000" stroke-width="8"/>
  <rect x="70" y="70" width="${W - 140}" height="${H - 140}" fill="none" stroke="#000" stroke-width="4"/>

  <text x="${W / 2}" y="190" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" text-anchor="middle">
    SCZN3 Shooter Experience Card (SEC)
  </text>

  <text x="${W / 2}" y="620" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" text-anchor="middle">
    Windage
  </text>
  <text x="${W / 2 - 220}" y="780" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="700" text-anchor="middle">
    ${wArrow}
  </text>
  <text x="${W / 2 + 120}" y="810" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="700" text-anchor="middle">
    ${wVal}
  </text>

  <text x="${W / 2}" y="1140" font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700" text-anchor="middle">
    Elevation
  </text>
  <text x="${W / 2 - 220}" y="1300" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="700" text-anchor="middle">
    ${eArrow}
  </text>
  <text x="${W / 2 + 120}" y="1330" font-family="Arial, Helvetica, sans-serif" font-size="140" font-weight="700" text-anchor="middle">
    ${eVal}
  </text>

  <text x="${W / 2}" y="${H - 120}" font-family="Arial, Helvetica, sans-serif" font-size="54" font-style="italic" text-anchor="middle">
    Index ${index}
  </text>
</svg>
`.trim();
}

async function svgToPngDataUrl(svgString, scale = 2) {
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";

    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });

    img.src = url;
    await loaded;

    const W = img.width || 1200;
    const H = img.height || 1800;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw scaled (prevents weird clipping on some Safari builds)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function App() {
  const apiBase = useMemo(() => {
    return (import.meta.env.VITE_API_BASE || DEFAULT_API_BASE).trim();
  }, []);

  const takeRef = useRef(null);
  const uploadRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [rawBackend, setRawBackend] = useState(null);

  const [sec, setSec] = useState(null);
  const [secPngUrl, setSecPngUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setTargetUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setTargetUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function onPickFile(f) {
    if (!f) return;
    setFile(f);
    setFileName(f.name || "target.jpg");
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");
  }

  async function onAnalyze() {
    if (!file || busy) return;

    setBusy(true);
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");

    try {
      const form = new FormData();
      form.append("file", file);

      const url = new URL(SEC_PATH, apiBase).toString();
      const res = await fetch(url, { method: "POST", body: form });

      // 422 = expected “no holes” fail-closed behavior
      if (res.status === 422) {
        setNote(NO_SHOTS_MSG);
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}). ${txt}`.trim());
      }

      const data = await res.json();
      setRawBackend(data);

      // Click extraction: ONLY click-ish keys (do not accept generic windage/elevation).
      const windageClicks = pickClickNumber(data, [
        "windageClicks",
        "windage_clicks",
        "clicks.windage",
        "clicks.windageClicks",
        "result.windage_clicks",
        "result.windageClicks",
        "result.clicks.windage",
        "result.clicks.windageClicks",
      ]);

      const elevationClicks = pickClickNumber(data, [
        "elevationClicks",
        "elevation_clicks",
        "clicks.elevation",
        "clicks.elevationClicks",
        "result.elevation_clicks",
        "result.elevationClicks",
        "result.clicks.elevation",
        "result.clicks.elevationClicks",
      ]);

      // FAIL CLOSED: if missing, show the same clear error
      if (!isNum(windageClicks) || !isNum(elevationClicks)) {
        throw new Error("Backend response missing windage/elevation click values.");
      }

      const index = nextIndex();

      const secObj = { windageClicks, elevationClicks, index };
      setSec(secObj);

      const svg = buildSecSvg(secObj);
      const png = await svgToPngDataUrl(svg, 2);
      setSecPngUrl(png);
    } catch (e) {
      setError(e?.message || "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPng() {
    if (!secPngUrl) return;
    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${sec?.index || "000"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function sharePng() {
    if (!secPngUrl) return;
    try {
      const resp = await fetch(secPngUrl);
      const blob = await resp.blob();
      const file = new File([blob], `SCZN3_SEC_${sec?.index || "000"}.png`, {
        type: "image/png",
      });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "SCZN3 Shooter Experience Card (SEC)",
          files: [file],
        });
      } else {
        setNote("Sharing not supported on this device/browser. Use Download SEC (PNG).");
      }
    } catch {
      setNote("Share failed. Use Download SEC (PNG).");
    }
  }

  const uiMax = 900;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 18 }}>
      <h1 style={{ margin: "6px 0 14px", fontSize: 44, fontWeight: 800 }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      <div style={{ maxWidth: uiMax }}>
        <div style={{ marginBottom: 10, fontWeight: 700 }}>Convention:</div>
        <select
          value="dial_to_center"
          onChange={() => {}}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: "fit-content" }}
        >
          <option value="dial_to_center">Dial to center (move impact to center)</option>
        </select>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          {/* Hidden inputs */}
          <input
            ref={takeRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            // NOTE: no capture here so iOS offers Photo Library / Files
            style={{ display: "none" }}
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => takeRef.current?.click()}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 700,
              background: "#f7f7f7",
            }}
          >
            Take Target Photo
          </button>

          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 700,
              background: "#f7f7f7",
            }}
          >
            Upload Target Photo
          </button>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={!file || busy}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 800,
              background: busy ? "#eee" : "#e9f2ff",
              cursor: !file || busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Analyzing..." : "Analyze / SEC"}
          </button>

          <button
            type="button"
            onClick={downloadPng}
            disabled={!secPngUrl}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 700,
              background: secPngUrl ? "#f7f7f7" : "#eee",
              cursor: secPngUrl ? "pointer" : "not-allowed",
            }}
          >
            Download SEC (PNG)
          </button>

          <button
            type="button"
            onClick={sharePng}
            disabled={!secPngUrl}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 700,
              background: secPngUrl ? "#f7f7f7" : "#eee",
              cursor: secPngUrl ? "pointer" : "not-allowed",
            }}
          >
            Share SEC
          </button>

          <div style={{ alignSelf: "center", opacity: 0.75, fontWeight: 700 }}>
            {fileName}
          </div>
        </div>

        {error ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "2px solid #b00020",
              borderRadius: 12,
              background: "#fff5f5",
              color: "#111",
              fontWeight: 800,
            }}
          >
            <div style={{ marginBottom: 6 }}>Error</div>
            <div style={{ fontWeight: 700 }}>{error}</div>
          </div>
        ) : null}

        {note ? (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "1px solid #ccc",
              borderRadius: 12,
              background: "#fafafa",
              whiteSpace: "pre-wrap",
              fontWeight: 800,
            }}
          >
            {note}
          </div>
        ) : null}

        {targetUrl ? (
          <div style={{ marginTop: 18 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 26 }}>Target Preview</h2>
            <img
              src={targetUrl}
              alt="Target preview"
              style={{
                width: "100%",
                maxWidth: 520,
                height: "auto",
                display: "block",
                borderRadius: 12,
                border: "1px solid #ddd",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          </div>
        ) : null}

        {secPngUrl ? (
          <div style={{ marginTop: 18 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 26 }}>SEC Preview</h2>

            {/* Wrap in a container that prevents weird cropping */}
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fff",
                overflow: "hidden",
              }}
            >
              <img
                src={secPngUrl}
                alt="SEC preview"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  objectFit: "contain",
                  objectPosition: "center",
                }}
              />
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => {
              // simple toggle: show/hide by setting rawBackend null if already set
              // (keeps UI simple)
              setRawBackend((v) => (v ? null : v));
              if (!rawBackend) setNote("");
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              fontWeight: 800,
              background: "#f7f7f7",
            }}
          >
            Debug
          </button>

          {rawBackend ? (
            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "#fafafa",
                maxWidth: uiMax,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(rawBackend, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

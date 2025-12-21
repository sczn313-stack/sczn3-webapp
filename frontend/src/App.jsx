import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SCZN3 Shooter Experience Card (SEC) UI
 * - Upload target photo -> POST /api/sec (multipart/form-data key: "file")
 * - Shows target preview
 * - Renders SEC card (clicks only, two decimals, arrows)
 * - Download PNG + Share (if supported)
 *
 * Notes:
 * - We intentionally DO NOT set `capture` on the file input so iOS shows options (Camera or Photo Library).
 * - Arrow mapping is "normal":
 *      windageClicks > 0 => RIGHT arrow
 *      elevationClicks > 0 => UP arrow
 *   (If your backend uses opposite sign, flip it in the Debug toggles.)
 */

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

function pad3(n) {
  const s = String(n);
  if (s.length >= 3) return s;
  return "0".repeat(3 - s.length) + s;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = Number.isFinite(cur) ? cur + 1 : 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return pad3(nxt);
}

function isNum(x) {
  return Number.isFinite(Number(x));
}

function toFixed2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toFixed(2);
}

// Safely read nested paths like "result.windage_clicks"
function getPath(obj, path) {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

// Try many shapes the backend might return.
function pickFirstNumber(obj, paths) {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (isNum(v)) return Number(v);
    // Sometimes values are strings like "+4.25"
    if (typeof v === "string") {
      const m = v.match(/-?\d+(\.\d+)?/);
      if (m && isNum(m[0])) return Number(m[0]);
    }
  }
  return null;
}

function buildSecSvg({ windageArrow, windageAbs, elevationArrow, elevationAbs, index }) {
  // Portrait 4x6 ratio (2:3). Use high-res for crisp PNG.
  const W = 1200;
  const H = 1800;

  // Layout anchors
  const titleY = 210;
  const label1Y = 650;
  const value1Y = 820;
  const label2Y = 1120;
  const value2Y = 1290;
  const indexY = 1600;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff" />
    <!-- Outer + inner border -->
    <rect x="45" y="45" width="${W - 90}" height="${H - 90}" fill="none" stroke="#000" stroke-width="10" />
    <rect x="80" y="80" width="${W - 160}" height="${H - 160}" fill="none" stroke="#000" stroke-width="6" />

    <text x="${W / 2}" y="${titleY}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800">
      SCZN3 Shooter Experience Card (SEC)
    </text>

    <text x="${W / 2}" y="${label1Y}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700">
      Windage
    </text>

    <text x="${W / 2}" y="${value1Y}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="160" font-weight="900">
      ${windageArrow} ${windageAbs}
    </text>

    <text x="${W / 2}" y="${label2Y}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="68" font-weight="700">
      Elevation
    </text>

    <text x="${W / 2}" y="${value2Y}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="160" font-weight="900">
      ${elevationArrow} ${elevationAbs}
    </text>

    <text x="${W / 2}" y="${indexY}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="60" font-style="italic" fill="#111">
      Index: ${index}
    </text>
  </svg>`;
}

async function svgToPngDataUrl(svgText) {
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";
    img.src = svgUrl;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function App() {
  const fileInputRef = useRef(null);

  const [apiBase] = useState(DEFAULT_API_BASE);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [rawBackend, setRawBackend] = useState(null);

  // Direction controls (in case backend sign convention differs)
  const [flipWindage, setFlipWindage] = useState(false);
  const [flipElevation, setFlipElevation] = useState(false);

  const [sec, setSec] = useState(null); // { windageClicks, elevationClicks, index }
  const [secSvg, setSecSvg] = useState("");
  const [secPngUrl, setSecPngUrl] = useState("");

  // Convention selector (UI only for now, keeps your current label)
  const [convention] = useState("Dial to center (move impact to center)");

  useEffect(() => {
    // Cleanup object URL when file changes
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFileClick() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecSvg("");
    setSecPngUrl("");

    if (!f) {
      setFile(null);
      setFileUrl("");
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setFileUrl(url);
  }

  function arrowForWindage(clicks) {
    // normal: + => right, - => left
    const c = flipWindage ? -clicks : clicks;
    if (c === 0) return "→";
    return c > 0 ? "→" : "←";
  }

  function arrowForElevation(clicks) {
    // normal: + => up, - => down
    const c = flipElevation ? -clicks : clicks;
    if (c === 0) return "↑";
    return c > 0 ? "↑" : "↓";
  }

  async function onAnalyze() {
    if (!file) return;

    setBusy(true);
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecSvg("");
    setSecPngUrl("");

    try {
      const url = new URL(SEC_PATH, apiBase).toString();
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(url, { method: "POST", body: fd });

      // If your backend uses 422 for "no holes", handle cleanly
      if (res.status === 422) {
        setError(NO_SHOTS_MSG);
        return;
      }

      let data = null;
      const text = await res.text();
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

      // Try to find click values in many possible keys
      const w = pickFirstNumber(data, [
        "windageClicks",
        "windage_clicks",
        "windage",
        "clicks.windage",
        "clicks.windageClicks",
        "result.windageClicks",
        "result.windage_clicks",
        "result.windage",
        "data.windageClicks",
        "data.windage_clicks",
        "data.windage",
      ]);

      const el = pickFirstNumber(data, [
        "elevationClicks",
        "elevation_clicks",
        "elevation",
        "clicks.elevation",
        "clicks.elevationClicks",
        "result.elevationClicks",
        "result.elevation_clicks",
        "result.elevation",
        "data.elevationClicks",
        "data.elevation_clicks",
        "data.elevation",
      ]);

      if (!isNum(w) || !isNum(el)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      const windageArrow = arrowForWindage(Number(w));
      const elevationArrow = arrowForElevation(Number(el));

      const windageAbs = toFixed2(Math.abs(Number(flipWindage ? -w : w)));
      const elevationAbs = toFixed2(Math.abs(Number(flipElevation ? -el : el)));

      const svg = buildSecSvg({
        windageArrow,
        windageAbs,
        elevationArrow,
        elevationAbs,
        index,
      });

      setSec({ windageClicks: Number(w), elevationClicks: Number(el), index });
      setSecSvg(svg);

      const png = await svgToPngDataUrl(svg);
      setSecPngUrl(png);
    } catch (err) {
      setError("Network or parsing error.");
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    if (!secPngUrl || !sec) return;
    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${sec.index}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onShare() {
    if (!secPngUrl || !sec) return;
    if (!navigator.share) {
      setNote("Sharing not supported on this device/browser.");
      return;
    }

    try {
      const blob = await (await fetch(secPngUrl)).blob();
      const file = new File([blob], `SCZN3_SEC_${sec.index}.png`, { type: "image/png" });

      // Some browsers require `files` support check
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        setNote("Sharing not supported for files on this device/browser.");
        return;
      }

      await navigator.share({
        title: "SCZN3 SEC",
        text: "SCZN3 Shooter Experience Card (SEC)",
        files: [file],
      });
    } catch {
      // user cancelled share or share error
    }
  }

  const canDownload = Boolean(secPngUrl);
  const canShare = Boolean(secPngUrl) && typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div style={{ padding: 18, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <h1 style={{ margin: "8px 0 16px", fontSize: 44, fontWeight: 900 }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      <div style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, marginRight: 8 }}>Convention:</span>
        <select value={convention} disabled style={{ padding: "6px 10px", borderRadius: 8 }}>
          <option>{convention}</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        <button
          type="button"
          onClick={onPickFileClick}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #bbb",
            background: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Take or Upload Target Photo
        </button>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!file || busy}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #bbb",
            background: !file || busy ? "#eee" : "#fff",
            fontWeight: 800,
            cursor: !file || busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button
          type="button"
          onClick={onDownload}
          disabled={!canDownload}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #bbb",
            background: canDownload ? "#fff" : "#eee",
            fontWeight: 800,
            cursor: canDownload ? "pointer" : "not-allowed",
          }}
        >
          Download SEC (PNG)
        </button>

        <button
          type="button"
          onClick={onShare}
          disabled={!canShare}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "1px solid #bbb",
            background: canShare ? "#fff" : "#eee",
            fontWeight: 800,
            cursor: canShare ? "pointer" : "not-allowed",
          }}
        >
          Share SEC
        </button>

        <div style={{ fontWeight: 700, opacity: 0.8 }}>
          {file ? file.name : ""}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 10,
            border: "2px solid #b11",
            background: "#fff7f7",
            color: "#111",
            fontWeight: 700,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6 }}>Error</div>
          <div style={{ fontWeight: 700 }}>{error}</div>
        </div>
      ) : null}

      {note ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}>
          {note}
        </div>
      ) : null}

      {fileUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Target Preview</div>
          <img
            src={fileUrl}
            alt="Target preview"
            style={{ maxWidth: 520, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      ) : null}

      {secPngUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>SEC Preview</div>
          <img
            src={secPngUrl}
            alt="SEC preview"
            style={{ maxWidth: 520, width: "100%", borderRadius: 10, border: "1px solid #ddd" }}
          />
        </div>
      ) : null}

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Debug</summary>

        <div style={{ marginTop: 10, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={flipWindage}
              onChange={(e) => setFlipWindage(e.target.checked)}
            />
            Flip Windage Direction
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={flipElevation}
              onChange={(e) => setFlipElevation(e.target.checked)}
            />
            Flip Elevation Direction
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Backend Raw</div>
          <pre
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fafafa",
              maxWidth: 900,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none)"}
          </pre>
        </div>
      </details>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * SCZN3 Shooter Experience Card (SEC) UI
 * - Upload photo -> POST /api/sec
 * - Shows target preview
 * - Renders SEC card (clicks only, two decimals)
 * - Download PNG (generated locally from SVG)
 *
 * Notes:
 * - We intentionally DO NOT set `capture` on the file input so iOS shows options.
 * - “Dial to center” inverts arrow direction (fixes your windage/elevation direction issue).
 */

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

function toFixed2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toFixed(2);
}

function isNum(x) {
  return Number.isFinite(Number(x));
}

function pickFirstNumber(obj, paths) {
  // paths like: "windageClicks", "clicks.windage", "result.windage_clicks"
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else {
        cur = undefined;
        break;
      }
    }
    if (isNum(cur)) return Number(cur);
  }
  return null;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const next = (cur + 1) % 1000;
  localStorage.setItem(INDEX_KEY, String(next));
  return String(next).padStart(3, "0");
}

function svgToPngDataUrl(svgText, width, height) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export default function App() {
  const [apiBase] = useState(DEFAULT_API_BASE);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [windageClicks, setWindageClicks] = useState(null);
  const [elevationClicks, setElevationClicks] = useState(null);
  const [index, setIndex] = useState("000");

  const [secPngUrl, setSecPngUrl] = useState("");

  // Convention: only one shown right now, but we keep this for future expansion
  const [convention, setConvention] = useState("DIAL_TO_CENTER"); // DIAL_TO_CENTER

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const arrows = useMemo(() => {
    // “Dial to center” = invert arrow direction relative to sign
    // Windage: + means impacts right -> dial LEFT
    // Elevation: + means impacts high -> dial DOWN
    const w = windageClicks;
    const e = elevationClicks;

    const wAbs = isNum(w) ? Math.abs(Number(w)) : null;
    const eAbs = isNum(e) ? Math.abs(Number(e)) : null;

    const wArrow =
      isNum(w) && w !== 0
        ? (convention === "DIAL_TO_CENTER"
            ? (w > 0 ? "←" : "→")
            : (w > 0 ? "→" : "←"))
        : "";

    const eArrow =
      isNum(e) && e !== 0
        ? (convention === "DIAL_TO_CENTER"
            ? (e > 0 ? "↓" : "↑")
            : (e > 0 ? "↑" : "↓"))
        : "";

    return {
      wArrow,
      eArrow,
      wAbs,
      eAbs,
    };
  }, [windageClicks, elevationClicks, convention]);

  function buildSecSvg({ wAbs, eAbs, wArrow, eArrow, indexStr }) {
    // Simple clean SEC card (4x6 aspect). We render at 1200x800.
    const W = 1200;
    const H = 800;

    const wTxt = wAbs == null ? "--" : toFixed2(wAbs);
    const eTxt = eAbs == null ? "--" : toFixed2(eAbs);

    return {
      width: W,
      height: H,
      svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="18" ry="18" fill="#ffffff" stroke="#000000" stroke-width="6"/>
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="14" ry="14" fill="none" stroke="#000000" stroke-width="3"/>

  <text x="${W / 2}" y="145" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800">
    SCZN3 Shooter Experience Card (SEC)
  </text>

  <text x="${W / 2}" y="285" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">Windage</text>
  <text x="${W / 2}" y="395" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="900">
    ${wArrow ? `${wArrow} ` : ""}${wTxt}
  </text>

  <text x="${W / 2}" y="520" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">Elevation</text>
  <text x="${W / 2}" y="630" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="900">
    ${eArrow ? `${eArrow} ` : ""}${eTxt}
  </text>

  <text x="${W / 2}" y="725" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" font-style="italic" fill="#111">
    Index: ${indexStr}
  </text>
</svg>`,
    };
  }

  async function generateSecPngAndSet() {
    const { wAbs, eAbs, wArrow, eArrow } = arrows;
    const indexStr = index;

    const { svg, width, height } = buildSecSvg({ wAbs, eAbs, wArrow, eArrow, indexStr });
    const pngUrl = await svgToPngDataUrl(svg, width, height);
    setSecPngUrl(pngUrl);
  }

  async function onAnalyze() {
    if (!file) return;

    setBusy(true);
    setError("");
    setNote("");
    setWindageClicks(null);
    setElevationClicks(null);
    setSecPngUrl("");

    try {
      const url = new URL(SEC_PATH, apiBase).toString();

      const form = new FormData();
      // backend expects key "file"
      form.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      if (res.status === 422) {
        setError(NO_SHOTS_MSG);
        setBusy(false);
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(`Backend error (${res.status}). ${text || ""}`.trim());
        setBusy(false);
        return;
      }

      const data = await res.json();

      // Try many possible shapes for compatibility
      const w = pickFirstNumber(data, [
        "windageClicks",
        "windage_clicks",
        "windage",
        "clicks.windage",
        "clicks.windageClicks",
        "result.windageClicks",
        "result.windage_clicks",
        "sec.windageClicks",
        "sec.windage_clicks",
      ]);

      const e = pickFirstNumber(data, [
        "elevationClicks",
        "elevation_clicks",
        "elevation",
        "clicks.elevation",
        "clicks.elevationClicks",
        "result.elevationClicks",
        "result.elevation_clicks",
        "sec.elevationClicks",
        "sec.elevation_clicks",
      ]);

      if (!isNum(w) || !isNum(e)) {
        setError("Backend response missing windage/elevation click values.");
        setBusy(false);
        return;
      }

      setWindageClicks(Number(w));
      setElevationClicks(Number(e));

      const idx = nextIndex();
      setIndex(idx);

      setNote("SEC ready.");
      // Build the download image locally
      // (wait for state to apply)
      setTimeout(() => {
        generateSecPngAndSet().catch(() => {});
      }, 0);
    } catch (err) {
      setError(`Request failed. ${String(err?.message || err)}`);
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    if (!secPngUrl) return;
    const a = document.createElement("a

import React, { useEffect, useMemo, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC)
  - Upload image -> POST /api/sec (multipart/form-data key MUST be "file")
  - Renders clean SEC preview (clicks only, two decimals, arrows)
  - Download PNG + Share (if supported)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

// Button / UI wording
const UPLOAD_LABEL = "Take or Upload Target Photo!!!!!";

// Hard-wired message for blank / not-enough-holes cases
const NO_SHOTS_MSG =
  "No / not enough bullet holes detected.\nShoot 3–7 rounds, then Take or Upload Target Photo.";

function pad3(n) {
  return String(n).padStart(3, "0");
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = cur + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return pad3(nxt);
}

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function toAbs2(n) {
  const x = Math.abs(Number(n) || 0);
  return x.toFixed(2);
}

// IMPORTANT: windage arrow is intentionally flipped to fix the “wrong direction” issue.
// Positive windage_clicks -> show LEFT arrow
// Negative windage_clicks -> show RIGHT arrow
function windArrow(clicks) {
  const v = Number(clicks) || 0;
  if (v > 0) return "←";
  if (v < 0) return "→";
  return "→";
}

// Elevation kept standard:
// Positive elevation_clicks -> UP arrow
// Negative elevation_clicks -> DOWN arrow
function elevArrow(clicks) {
  const v = Number(clicks) || 0;
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "↑";
}

function buildSecPng({ windageClicks, elevationClicks, indexStr }) {
  // 4x6 look (landscape-ish) for a clean screenshot/print
  const W = 1600;
  const H = 1067;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 14;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // title
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 86px Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", W / 2, 190);

  // section labels
  ctx.font = "bold 64px Arial";
  ctx.fillText("Windage", W / 2, 370);

  // windage value
  ctx.font = "bold 190px Arial";
  ctx.fillText(`${windArrow(windageClicks)} ${toAbs2(windageClicks)}`, W / 2, 560);

  // elevation label
  ctx.font = "bold 64px Arial";
  ctx.fillText("Elevation", W / 2, 715);

  // elevation value
  ctx.font = "bold 190px Arial";
  ctx.fillText(`${elevArrow(elevationClicks)} ${toAbs2(elevationClicks)}`, W / 2, 905);

  // index (italic)
  ctx.font = "italic 58px Arial";
  ctx.fillText(`Index: ${indexStr}`, W / 2, 1010);

  return canvas.toDataURL("image/png");
}

export default function App() {
  const [convention, setConvention] = useState("DIAL_TO_CENTER");

  const [file, setFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [rawBackend, setRawBackend] = useState(null);
  const [sec, setSec] = useState(null); // { windage_clicks, elevation_clicks }
  const [secPngUrl, setSecPngUrl] = useState("");

  const apiBase = useMemo(() => {
    // Vite env var (must start with VITE_)
    return (import.meta?.env?.VITE_API_BASE_URL || DEFAULT_API_BASE).trim();
  }, []);

  useEffect(() => {
    // clear png when sec changes
    setSecPngUrl("");
  }, [sec?.windage_clicks, sec?.elevation_clicks]);

  async function onAnalyze() {
    if (!file) return;

    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");

    setBusy(true);

    try {
      const url = new URL(SEC_PATH, apiBase).toString();

      const fd = new FormData();
      // key MUST be "file"
      fd.append("file", file);

      // Optional: send convention (backend can ignore if not implemented)
      fd.append("convention", convention);

      const res = await fetch(url, {
        method: "POST",
        body: fd,
      });

      // 422 -> fail-closed for no holes (expected)
      if (res.status === 422) {
        setNote(NO_SHOTS_MSG);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : { ok: false, raw: await res.text() };

      setRawBackend(data);

      if (!res.ok || !data?.ok || !data?.sec) {
        setError(
          data?.error ||
            `Request failed (${res.status}). Check backend logs if this keeps happening.`
        );
        return;
      }

      setSec({
        windage_clicks: Number(data.sec.windage_clicks || 0),
        elevation_clicks: Number(data.sec.elevation_clicks || 0),
      });
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function onDownloadPng() {
    if (!sec) return;

    const idx = nextIndex();
    const png = buildSecPng({
      windageClicks: sec.windage_clicks,
      elevationClicks: sec.elevation_clicks,
      indexStr: idx,
    });

    setSecPngUrl(png);

    const a = document.createElement("a");
    a.href = png;
    a.download = `SCZN3_SEC_${idx}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onSharePng() {
    if (!sec) return;

    const idx = nextIndex();
    const png = buildSecPng({
      windageClicks: sec.windage_clicks,
      elevationClicks: sec.elevation_clicks,
      indexStr: idx,
    });

    setSecPngUrl(png);

    if (!navigator.share) {
      setNote("Share is not supported on this browser/device.");
      return;
    }

    // Convert data URL -> Blob -> File
    const blob = await (await fetch(png)).blob();
    const fileToShare = new File([blob], `SCZN3_SEC_${idx}.png`, { type: "image/png" });

    try {
      await navigator.share({
        title: "SCZN3 Shooter Experience Card (SEC)",
        text: "SEC (click corrections)",
        files: [fileToShare],
      });
    } catch (e) {
      // user cancel is fine
      if (String(e).toLowerCase().includes("abort")) return;
      setError(String(e?.message || e));
    }
  }

  const canAnalyze = !!file && !busy;
  const canDownload = !!sec && !busy;
  const canShare = !!sec && !busy;

  return (
    <div style={{ padding: 18, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: "0 0 14px 0", fontSize: 44 }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 700 }}>
          Convention:&nbsp;
          <select
            value={convention}
            onChange={(e) => setConvention(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 16 }}
          >
            <option value="DIAL_TO_CENTER">Dial to center (move impact to center)</option>
          </select>
        </label>

        <label style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>{UPLOAD_LABEL}</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          style={{ padding: "10px 14px", fontSize: 16, fontWeight: 700 }}
        >
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button
          onClick={onDownloadPng}
          disabled={!canDownload}
          style={{ padding: "10px 14px", fontSize: 16, fontWeight: 700 }}
        >
          Download SEC (PNG)
        </button>

        <button
          onClick={onSharePng}
          disabled={!canShare}
          style={{ padding: "10px 14px", fontSize: 16, fontWeight: 700 }}
        >
          Share SEC
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "2px solid #000",
            background: "#fff",
            whiteSpace: "pre-wrap",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      {note ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "2px solid #000",
            background: "#fff",
            whiteSpace: "pre-wrap",
            fontWeight: 700,
          }}
        >
          {note}
        </div>
      ) : null}

      {sec ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Preview</div>

          <div
            style={{
              width: "min(960px, 100%)",
              border: "8px solid #000",
              padding: 18,
              background: "#fff",
            }}
          >
            <div style={{ textAlign: "center", fontSize: 34, fontWeight: 900 }}>
              SCZN3 Shooter Experience Card (SEC)
            </div>

            <div style={{ height: 18 }} />

            <div style={{ textAlign: "center", fontSize: 28, fontWeight: 900 }}>
              Windage
            </div>
            <div style={{ textAlign: "center", fontSize: 96, fontWeight: 900 }}>
              {windArrow(sec.windage_clicks)} {toAbs2(sec.windage_clicks)}
            </div>

            <div style={{ height: 10 }} />

            <div style={{ textAlign: "center", fontSize: 28, fontWeight: 900 }}>
              Elevation
            </div>
            <div style={{ textAlign: "center", fontSize: 96, fontWeight: 900 }}>
              {elevArrow(sec.elevation_clicks)} {toAbs2(sec.elevation_clicks)}
            </div>

            <div style={{ height: 6 }} />

            <div style={{ textAlign: "center", fontSize: 26, fontStyle: "italic" }}>
              Index: {pad3(Number(localStorage.getItem(INDEX_KEY) || "0") || 0)}
            </div>
          </div>

          {secPngUrl ? (
            <div style={{ marginTop: 14 }}>
              <img
                src={secPngUrl}
                alt="SEC PNG"
                style={{ width: "min(960px, 100%)", border: "2px solid #000" }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <details style={{ marginTop: 18 }}>
        <summary style={{ fontSize: 18, fontWeight: 700 }}>Debug</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
apiBase: {apiBase}
{"\n"}file: {file ? `${file.name} (${file.type || "unknown"}, ${file.size} bytes)` : "none"}
{"\n"}convention: {convention}
{"\n"}rawBackend: {rawBackend ? JSON.stringify(rawBackend, null, 2) : "null"}
{"\n"}sec: {sec ? JSON.stringify(sec, null, 2) : "null"}
        </pre>
      </details>
    </div>
  );
}

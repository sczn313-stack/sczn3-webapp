import React, { useEffect, useMemo, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC)
  - Preview + Download + Share
  - Fixes:
    1) Treat backend values as MOA by default and convert to clicks (MOA * 4 for 1/4 MOA per click)
    2) Add per-axis flip toggles (hidden in Debug) to stop direction flip-flop
    3) "Share cancelled" (AbortError) shows as a note, not an error
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

// Backend unit assumption (most likely correct based on your numbers)
const DEFAULT_BACKEND_UNIT = "MOA"; // "MOA" or "CLICKS"

// Your default scope adjustment: 1/4 MOA per click
const MOA_PER_CLICK = 0.25;

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
  const W = 1200;
  const H = 800;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = W / 2;

  ctx.font = "bold 52px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", cx, 110);

  ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Windage", cx, 250);

  ctx.font = "800 110px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${windArrow(windageClicks)} ${fmt2(windageClicks)}`, cx, 360);

  ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Elevation", cx, 505);

  ctx.font = "800 110px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${elevArrow(elevationClicks)} ${fmt2(elevationClicks)}`, cx, 615);

  ctx.font = "italic 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.globalAlpha = 0.9;
  ctx.fillText(`Index: ${index}`, cx, 725);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(",");
  if (parts.length < 2) throw new Error("Invalid data URL.");
  const header = parts[0] || "";
  const base64 = parts[1] || "";

  const mimeMatch = header.match(/data:(.*?);base64/i);
  const mime = mimeMatch?.[1] || "image/png";

  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  return new Blob([bytes], { type: mime });
}

export default function App() {
  const apiBase = useMemo(() => {
    const fromEnv = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
    return String(fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "");
  }, []);

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [sec, setSec] = useState(null);
  const [secPngUrl, setSecPngUrl] = useState("");
  const [secIndex, setSecIndex] = useState("000");

  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Controls (keep simple; flips live under Debug)
  const [convention, setConvention] = useState("DIAL_TO_CENTER"); // or DIAL_TO_GROUP
  const [backendUnit, setBackendUnit] = useState(DEFAULT_BACKEND_UNIT); // MOA or CLICKS

  // Axis flips (Debug)
  const [flipWind, setFlipWind] = useState(false);
  const [flipElev, setFlipElev] = useState(false);

  // Debug capture
  const [rawBackend, setRawBackend] = useState(null);

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

  function applyConvention(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return convention === "DIAL_TO_GROUP" ? -n : n;
  }

  function unitToClicks(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;

    if (backendUnit === "MOA") {
      // clicks = MOA / 0.25
      return n / MOA_PER_CLICK;
    }
    // already clicks
    return n;
  }

  function applyAxisFlip(n, flip) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return flip ? -v : v;
  }

  async function onAnalyze() {
    if (!file) return;

    setError("");
    setNote("");
    setRawBackend(null);
    setBusy(true);

    try {
      const url = new URL(SEC_PATH, apiBase).toString();
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(url, { method: "POST", body: form });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Backend error (${res.status}): ${body || "Request failed"}`);
      }

      const data = await safeJson(res);
      const nextSec = data?.sec;
      if (!nextSec) throw new Error("No SEC returned from backend.");

      const rawWind = Number(nextSec.windage_clicks ?? 0);
      const rawElev = Number(nextSec.elevation_clicks ?? 0);

      setRawBackend({ rawWind, rawElev, backendUnit, convention, flipWind, flipElev });

      const newIndex = bumpIndex();

      // Pipeline:
      // backend value -> (unit convert) -> (convention) -> (axis flip)
      let w = unitToClicks(rawWind);
      let e = unitToClicks(rawElev);

      w = applyConvention(w);
      e = applyConvention(e);

      w = applyAxisFlip(w, flipWind);
      e = applyAxisFlip(e, flipElev);

      const next = { windage_clicks: w, elevation_clicks: e, index: newIndex };

      setSec(next);

      const png = makeSecPng({
        windageClicks: next.windage_clicks,
        elevationClicks: next.elevation_clicks,
        index: next.index,
      });
      setSecPngUrl(png);
    } catch (e) {
      setSec(null);
      setSecPngUrl("");
      setError(e?.message || "Analyze failed.");
    } finally {
      setBusy(false);
    }
  }

  function onDownload() {
    if (!sec || !secPngUrl) return;

    const a = document.createElement("a");
    a.href = secPngUrl;
    a.download = `SCZN3_SEC_${sec.index}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onShare() {
    if (!sec || !secPngUrl) return;

    setError("");
    setNote("");

    try {
      const blob = dataUrlToBlob(secPngUrl);
      const filename = `SCZN3_SEC_${sec.index}.png`;
      const fileObj = new File([blob], filename, { type: "image/png" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare({ files: [fileObj] }));

      if (canShareFiles) {
        await navigator.share({
          title: "SCZN3 SEC",
          text: "Shooter Experience Card (SEC)",
          files: [fileObj],
        });
        return;
      }

      const objUrl = URL.createObjectURL(blob);
      window.open(objUrl, "_blank", "noopener,noreferrer");
      setNote("Opened the SEC image. Long-press it to Save Image / Share.");
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    } catch (e) {
      // iOS Safari: user cancellation often throws AbortError
      if (e?.name === "AbortError") {
        setNote("Share cancelled.");
        return;
      }
      setError(e?.message || "Share failed.");
    }
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1 style={{ fontSize: 40, margin: "0 0 16px" }}>SCZN3 Shooter Experience Card (SEC)</h1>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 14 }}>
          Convention:&nbsp;
          <select value={convention} onChange={(e) => setConvention(e.target.value)} disabled={busy}>
            <option value="DIAL_TO_CENTER">Dial to center (move impact to center)</option>
            <option value="DIAL_TO_GROUP">Dial to group (dial toward impacts)</option>
          </select>
        </label>

        <label style={{ fontSize: 14 }}>
          Backend units:&nbsp;
          <select value={backendUnit} onChange={(e) => setBackendUnit(e.target.value)} disabled={busy}>
            <option value="MOA">MOA (convert to clicks)</option>
            <option value="CLICKS">Clicks (use as-is)</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={busy}
        />
        <button onClick={onAnalyze} disabled={busy || !file}>
          {busy ? "Analyzing…" : "Analyze / SEC"}
        </button>
        <button onClick={onDownload} disabled={!sec || !secPngUrl}>
          Download SEC (PNG)
        </button>
        <button onClick={onShare} disabled={!sec || !secPngUrl}>
          Share SEC
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #d33", borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {note ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #111", borderRadius: 10 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{note}</div>
        </div>
      ) : null}

      {secPngUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>Preview</div>
          <img
            src={secPngUrl}
            alt="SEC Preview"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              border: "1px solid #111",
              borderRadius: 12,
            }}
          />
        </div>
      ) : null}

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>Debug</summary>

        <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 14 }}>
            <input type="checkbox" checked={flipWind} onChange={(e) => setFlipWind(e.target.checked)} /> Flip windage
          </label>
          <label style={{ fontSize: 14 }}>
            <input type="checkbox" checked={flipElev} onChange={(e) => setFlipElev(e.target.checked)} /> Flip elevation
          </label>
        </div>

        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.4 }}>
          <div><b>API Base:</b> {apiBase}</div>
          <div><b>Backend units:</b> {backendUnit} (MOA_per_click={MOA_PER_CLICK})</div>
          <div><b>Convention:</b> {convention}</div>
          <div><b>Axis flips:</b> wind={String(flipWind)}, elev={String(flipElev)}</div>
          <div>
            <b>Raw backend:</b>{" "}
            {rawBackend ? `wind=${rawBackend.rawWind}, elev=${rawBackend.rawElev}` : "—"}
          </div>
          <div>
            <b>Displayed clicks:</b>{" "}
            {sec ? `wind=${sec.windage_clicks}, elev=${sec.elevation_clicks}` : "—"}
          </div>
        </div>
      </details>
    </div>
  );
}

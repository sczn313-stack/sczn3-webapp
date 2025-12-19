import React, { useEffect, useMemo, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — Locked customer format
  - On-screen: Choose File + Analyze + Download + Share (minimal controls)
  - On-screen preview: shows the generated SEC PNG after Analyze
  - Downloaded/Shared PNG: Title, Windage, Elevation, Index only (no extra text)
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";

const INDEX_KEY = "SCZN3_SEC_INDEX";

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

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Clean border
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = W / 2;

  // Title
  ctx.font = "bold 52px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", cx, 110);

  // Windage label
  ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Windage", cx, 250);

  // Windage value
  ctx.font = "800 110px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${windArrow(windageClicks)} ${fmt2(windageClicks)}`, cx, 360);

  // Elevation label
  ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Elevation", cx, 505);

  // Elevation value
  ctx.font = "800 110px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${elevArrow(elevationClicks)} ${fmt2(elevationClicks)}`, cx, 615);

  // Index footer (italic)
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
    // Vite env var (Render sets this)
    const fromEnv = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
    return String(fromEnv || DEFAULT_API_BASE).replace(/\/+$/, "");
  }, []);

  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [sec, setSec] = useState(null);
  const [secIndex, setSecIndex] = useState("000");
  const [secPngUrl, setSecPngUrl] = useState(""); // preview + share/download source
  const [error, setError] = useState("");
  const [shareNote, setShareNote] = useState("");

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

  async function onAnalyze() {
    if (!file) return;

    setError("");
    setShareNote("");
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

      const newIndex = bumpIndex();

      const next = {
        windage_clicks: Number(nextSec.windage_clicks ?? 0),
        elevation_clicks: Number(nextSec.elevation_clicks ?? 0),
        index: newIndex,
      };

      setSec(next);

      // Generate the PNG immediately so it can be previewed + downloaded + shared
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
    setShareNote("");

    try {
      const blob = dataUrlToBlob(secPngUrl);
      const filename = `SCZN3_SEC_${sec.index}.png`;
      const fileObj = new File([blob], filename, { type: "image/png" });

      // Best path: Web Share w/ files (iOS share sheet)
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

      // Fallback: open the image in a new tab so iOS can long-press → Save Image
      const objUrl = URL.createObjectURL(blob);
      window.open(objUrl, "_blank", "noopener,noreferrer");
      setShareNote("Share not supported here — opened the SEC image. Long-press it to Save Image / Share.");
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    } catch (e) {
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

      {shareNote ? (
        <div style={{ marginTop: 14, padding: 12, border: "1px solid #111", borderRadius: 10 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{shareNote}</div>
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
    </div>
  );
}

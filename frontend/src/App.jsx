import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — v1 (Simple)
  - Defaults are locked in v1 experience:
      Distance = 100 yards
      MOA per click = 0.25
      Target = 23x23
  - Frontend does NOT ask for yardage in the primary flow.
  - Two file buttons so iPad/iOS doesn’t force camera-only.
  - FAIL CLOSED on no holes (422) and on missing click values.
  - SEC PNG stays clean: Title + Windage + Elevation + Index ONLY.
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

const NO_SHOTS_MSG =
  "No / not enough bullet holes detected.\nShoot 3–7 rounds, then take or upload a target photo.";

function fmt2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}
function abs2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return Math.abs(x).toFixed(2);
}
function pad3(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return "000";
  return String(Math.floor(x)).padStart(3, "0");
}
function nextIndex() {
  const raw = localStorage.getItem(INDEX_KEY);
  const cur = raw ? Number(raw) : 0;
  const nxt = (Number.isFinite(cur) && cur >= 0 ? cur : 0) + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return pad3(nxt);
}
function isNum(v) {
  return Number.isFinite(Number(v));
}

// Read click values from common shapes
function getClicks(payload) {
  const p = payload || {};

  // Preferred shape: { sec: { windage_clicks, elevation_clicks } }
  const w1 = p?.sec?.windage_clicks;
  const e1 = p?.sec?.elevation_clicks;

  // Fallbacks (in case backend changes)
  const w2 = p?.windage_clicks ?? p?.windageClicks ?? p?.clicks?.windage;
  const e2 = p?.elevation_clicks ?? p?.elevationClicks ?? p?.clicks?.elevation;

  const w = isNum(w1) ? Number(w1) : isNum(w2) ? Number(w2) : null;
  const e = isNum(e1) ? Number(e1) : isNum(e2) ? Number(e2) : null;

  return { w, e };
}

function windArrow(clicks, flipWind) {
  const n0 = Number(clicks);
  if (!Number.isFinite(n0) || n0 === 0) return "→";
  const n = flipWind ? -n0 : n0;
  return n > 0 ? "→" : "←";
}
function elevArrow(clicks, flipElev) {
  const n0 = Number(clicks);
  if (!Number.isFinite(n0) || n0 === 0) return "↑";
  const n = flipElev ? -n0 : n0;
  return n > 0 ? "↑" : "↓";
}

function makeSecPng({ windageClicks, elevationClicks, index, flipWind, flipElev }) {
  // 4x6 portrait-ish (2:3)
  const W = 1200;
  const H = 1800;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // borders
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 10;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 5;
  ctx.strokeRect(75, 75, W - 150, H - 150);

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = W / 2;

  // Title
  ctx.font = "800 64px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("SCZN3 Shooter Experience Card (SEC)", cx, 185);

  // Windage
  ctx.font = "800 70px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Windage", cx, 630);

  ctx.font = "900 160px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${windArrow(windageClicks, flipWind)} ${abs2(windageClicks)}`, cx, 820);

  // Elevation
  ctx.font = "800 70px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText("Elevation", cx, 1140);

  ctx.font = "900 160px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillText(`${elevArrow(elevationClicks, flipElev)} ${abs2(elevationClicks)}`, cx, 1330);

  // Index
  ctx.font = "italic 60px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.globalAlpha = 0.92;
  ctx.fillText(`Index: ${index}`, cx, 1635);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = String(dataUrl).split(",");
  const mime = (header.match(/data:(.*?);base64/i) || [])[1] || "image/png";
  const bin = atob(b64 || "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function App() {
  const apiBase = useMemo(() => {
    const env =
      (import.meta?.env?.VITE_API_BASE_URL || import.meta?.env?.VITE_API_BASE || "").trim();
    return (env || DEFAULT_API_BASE).replace(/\/+$/, "");
  }, []);

  const takeRef = useRef(null);
  const uploadRef = useRef(null);

  const [file, setFile] = useState(null);
  const [targetUrl, setTargetUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const [flipWind, setFlipWind] = useState(false);
  const [flipElev, setFlipElev] = useState(false);

  const [rawBackend, setRawBackend] = useState(null);

  const [sec, setSec] = useState(null); // { windage_clicks, elevation_clicks, index }
  const [secPngUrl, setSecPngUrl] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!file) {
      setTargetUrl("");
      return;
    }
    const u = URL.createObjectURL(file);
    setTargetUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function resetOutputs() {
    setError("");
    setNote("");
    setRawBackend(null);
    setSec(null);
    setSecPngUrl("");
  }

  function onPickFile(f) {
    resetOutputs();
    setFile(f || null);
  }

  async function onAnalyze() {
    if (!file || busy) return;

    resetOutputs();
    setBusy(true);

    try {
      const url = new URL(SEC_PATH, apiBase).toString();
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(url, { method: "POST", body: form });

      // Fail-closed “no holes”
      if (res.status === 422) {
        setNote(NO_SHOTS_MSG);
        return;
      }

      let data = null;
      const text = await res.text().catch(() => "");
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

      const { w, e } = getClicks(data);

      // Fail closed if missing clicks
      if (!isNum(w) || !isNum(e)) {
        setError("Backend response missing windage/elevation click values.");
        return;
      }

      const index = nextIndex();

      const next = {
        windage_clicks: Number(w),
        elevation_clicks: Number(e),
        index,
      };

      setSec(next);

      const png = makeSecPng({
        windageClicks: next.windage_clicks,
        elevationClicks: next.elevation_clicks,
        index: next.index,
        flipWind,
        flipElev,
      });

      setSecPngUrl(png);
    } catch (e) {
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

      // fallback: open image so user can long-press -> Save Image
      const objUrl = URL.createObjectURL(blob);
      window.open(objUrl, "_blank", "noopener,noreferrer");
      setNote("Opened the SEC image. Long-press it to Save Image / Share.");
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    } catch (e) {
      // Share cancel on iOS often throws AbortError
      if (e?.name === "AbortError") {
        setNote("Share cancelled.");
        return;
      }
      setError("Share failed. Use Download SEC (PNG).");
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "32px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 40, margin: "0 0 14px", fontWeight: 900 }}>
        SCZN3 Shooter Experience Card (SEC)
      </h1>

      {/* Primary controls (simple) */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {/* Hidden inputs (two-button strategy for iOS) */}
        <input
          ref={takeRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          disabled={busy}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          disabled={busy}
        />

        <button onClick={() => takeRef.current?.click()} disabled={busy} style={btn()}>
          Take Target Photo
        </button>

        <button onClick={() => uploadRef.current?.click()} disabled={busy} style={btn()}>
          Upload Target Photo
        </button>

        <button onClick={onAnalyze} disabled={busy || !file} style={btn({ strong: true, disabled: busy || !file })}>
          {busy ? "Analyzing..." : "Analyze / SEC"}
        </button>

        <button onClick={onDownload} disabled={!secPngUrl} style={btn({ disabled: !secPngUrl })}>
          Download SEC (PNG)
        </button>

        <button onClick={onShare} disabled={!secPngUrl} style={btn({ disabled: !secPngUrl })}>
          Share SEC
        </button>
      </div>

      {/* Message boxes */}
      {error ? (
        <div style={box({ border: "#b00020", bg: "#fff5f5" })}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap", fontWeight: 700 }}>{error}</div>
        </div>
      ) : null}

      {note ? (
        <div style={box({ border: "#111", bg: "#fafafa" })}>
          <div style={{ whiteSpace: "pre-wrap", fontWeight: 800 }}>{note}</div>
        </div>
      ) : null}

      {/* Target Preview */}
      {targetUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 8, fontWeight: 800 }}>Target Preview</div>
          <img
            src={targetUrl}
            alt="Target preview"
            style={{ width: "100%", maxWidth: 520, height: "auto", display: "block", border: "1px solid #111", borderRadius: 12 }}
          />
        </div>
      ) : null}

      {/* SEC Preview */}
      {secPngUrl ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 8, fontWeight: 800 }}>SEC Preview</div>
          <img
            src={secPngUrl}
            alt="SEC preview"
            style={{ width: "100%", maxWidth: 520, height: "auto", display: "block", border: "1px solid #111", borderRadius: 12 }}
          />

          {/* Come-back hook (page only; NOT on the SEC image) */}
          <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 12, maxWidth: 520 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Want more?</div>
            <div style={{ fontWeight: 700, opacity: 0.85, marginBottom: 10 }}>
              Unlock Advanced Mode (distance-aware clicks, saved sessions, coaching).
            </div>
            <button onClick={() => setShowAdvanced((v) => !v)} style={btn({ strong: true })}>
              {showAdvanced ? "Hide Advanced" : "Unlock Advanced"}
            </button>

            {showAdvanced ? (
              <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Advanced (optional)</div>
                <div style={{ fontWeight: 700, opacity: 0.85 }}>
                  v1 defaults are locked: <b>100 yards</b> and <b>¼ MOA/click</b>.
                  (We’ll wire the controls here next.)
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Debug (kept minimal) */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900 }}>Debug</summary>

        <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 14, fontWeight: 800 }}>
            <input type="checkbox" checked={flipWind} onChange={(e) => setFlipWind(e.target.checked)} /> Flip windage
          </label>
          <label style={{ fontSize: 14, fontWeight: 800 }}>
            <input type="checkbox" checked={flipElev} onChange={(e) => setFlipElev(e.target.checked)} /> Flip elevation
          </label>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
          <div><b>API Base:</b> {apiBase}</div>
          <div><b>Raw backend:</b></div>
          <pre style={{ padding: 10, border: "1px solid #ddd", borderRadius: 12, background: "#fafafa", maxWidth: 900, overflowX: "auto" }}>
            {rawBackend ? JSON.stringify(rawBackend, null, 2) : "—"}
          </pre>
          <div>
            <b>Displayed clicks:</b>{" "}
            {sec ? `wind=${fmt2(sec.windage_clicks)}, elev=${fmt2(sec.elevation_clicks)}` : "—"}
          </div>
        </div>
      </details>
    </div>
  );
}

function btn(opts = {}) {
  const strong = !!opts.strong;
  const disabled = !!opts.disabled;
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #bbb",
    background: disabled ? "#eee" : strong ? "#fff" : "#f7f7f7",
    fontWeight: strong ? 900 : 800,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
function box({ border, bg }) {
  return {
    marginTop: 14,
    padding: 12,
    border: `2px solid ${border}`,
    borderRadius: 12,
    background: bg,
    maxWidth: 720,
  };
}

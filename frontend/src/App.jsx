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

// ----------------- helpers (LOCK) -----------------

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function toNum(v) {
  if (v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = cur + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return String(nxt).padStart(3, "0");
}

function labelForWindage(w) {
  // IMPORTANT: direction from SIGN, magnitude displayed as ABS.
  // Do NOT decide direction from a formatted string.
  if (!isNum(w)) return "0.00";
  return Math.abs(w).toFixed(2);
}

function labelForElevation(e) {
  // IMPORTANT: direction from SIGN, magnitude displayed as ABS.
  if (!isNum(e)) return "0.00";
  return Math.abs(e).toFixed(2);
}

function arrowForWindage(w) {
  // LOCK: sign decides arrow
  // negative => LEFT, positive => RIGHT
  if (!isNum(w) || w === 0) return "";
  return w < 0 ? "←" : "→";
}

function arrowForElevation(e) {
  // LOCK: sign decides arrow
  // negative => DOWN, positive => UP
  if (!isNum(e) || e === 0) return "";
  return e < 0 ? "↓" : "↑";
}

function getApiBase() {
  // Allows override via ?api=... if you ever need it.
  try {
    const u = new URL(window.location.href);
    const api = u.searchParams.get("api");
    if (api) return api.replace(/\/+$/, "");
  } catch {}
  return DEFAULT_API_BASE;
}

function getClicksFromBackend(data) {
  // Only pull the raw signed values from backend.
  // DO NOT use Math.abs here.
  // Backend may return clicks at top-level OR nested under `sec`.
  const src =
    data && typeof data === "object" && data.sec && typeof data.sec === "object"
      ? data.sec
      : data;

  const w = toNum(src?.windage_clicks);
  const e = toNum(src?.elevation_clicks);
  return { w, e };
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

  // The LOCKED signed values stored separately from display text
  const [result, setResult] = useState({
    windage_clicks: 0,
    elevation_clicks: 0,
    index: "000",
  });

  const inputCameraRef = useRef(null);
  const inputUploadRef = useRef(null);

  // create preview URL
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const secView = useMemo(() => {
    const w = Number(result.windage_clicks);
    const e = Number(result.elevation_clicks);

    return {
      windArrow: arrowForWindage(w),
      elevArrow: arrowForElevation(e),
      windText: labelForWindage(w),
      elevText: labelForElevation(e),
      index: result.index,
      // Helpful for debug
      windSigned: w,
      elevSigned: e,
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

      const form = new FormData();
      form.append("image", file);

      const url = `${apiBase}${SEC_PATH}`;
      const res = await fetch(url, {
        method: "POST",
        body: form,
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
        windage_clicks: Number(w),
        elevation_clicks: Number(e),
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
            <SecCard wind={secView} elev={secView} />
          </div>
        </div>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          <b>Debug</b>
        </summary>

        <div style={{ marginTop: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          <div>API Base: {apiBase}</div>
          <div>SEC Path: {SEC_PATH}</div>
          <div>Has file: {file ? "yes" : "no"}</div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Raw backend response:</div>
            <pre style={preStyle}>{rawBackend ? JSON.stringify(rawBackend, null, 2) : "(none)"}</pre>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700 }}>Parsed clicks (SIGNED):</div>
            <pre style={preStyle}>
{JSON.stringify(
  {
    windage_clicks: secView.windSigned,
    elevation_clicks: secView.elevSigned,
    index: result.index,
    windage_display: secView.windText,
    elevation_display: secView.elevText,
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

function SecCard({ wind, elev }) {
  return (
    <div style={cardStyle}>
      <div style={{ textAlign: "center", fontSize: 18, fontWeight: 700 }}>
        SCZN3 Shooter Experience Card (SEC)
      </div>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Windage</div>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1 }}>
          <span style={{ display: "inline-block", width: 92, textAlign: "center" }}>
            {wind.windArrow}
          </span>
          <span>{wind.windText}</span>
        </div>
      </div>

      <div style={{ marginTop: 26, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Elevation</div>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1 }}>
          <span style={{ display: "inline-block", width: 92, textAlign: "center" }}>
            {elev.elevArrow}
          </span>
          <span>{elev.elevText}</span>
        </div>
      </div>

      <div style={{ marginTop: 22, textAlign: "center", fontStyle: "italic", fontSize: 22 }}>
        Index: {wind.index}
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
  word

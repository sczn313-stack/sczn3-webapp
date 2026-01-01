import React, { useEffect, useMemo, useState } from "react";

const APP_BUILD = "FRONT_NO_POPUP_V1_2026-01-01";
const STORAGE_KEY_ENDPOINT = "sczn3_backend_endpoint";

function num(v) {
  const n = typeof v === "string" ? Number(v.trim()) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeEndpoint(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  // If user pastes full compute endpoint, keep it.
  if (s.includes("/api/sec")) return s.replace(/\/+$/, "");
  // Otherwise append /api/sec
  return s.replace(/\/+$/, "") + "/api/sec";
}

function prettyJson(obj) {
  return JSON.stringify(obj, null, 2);
}

// Accepts:
// - array: [{x,y}, ...]
// - object: { holes: [...] }
// - object: { poib: {x,y} }  (allowed, but holes is preferred)
function parseHolesJson(text) {
  const t = (text || "").trim();
  if (!t) return { ok: false, error: "Paste holes JSON first." };

  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, error: "Invalid JSON. Fix formatting and try again." };
  }

  if (Array.isArray(parsed)) {
    return { ok: true, holes: parsed };
  }

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.holes)) {
      return { ok: true, holes: parsed.holes };
    }
    if (parsed.poib && typeof parsed.poib === "object") {
      const x = num(parsed.poib.x);
      const y = num(parsed.poib.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { ok: false, error: "poib must include numeric x and y." };
      }
      return { ok: true, poib: { x, y } };
    }
  }

  return {
    ok: false,
    error: "JSON must be an array of holes, or an object with holes[] (or poib{}).",
  };
}

export default function App() {
  const [endpointInput, setEndpointInput] = useState(
    () =>
      localStorage.getItem(STORAGE_KEY_ENDPOINT) ||
      "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const endpoint = useMemo(() => normalizeEndpoint(endpointInput), [endpointInput]);

  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [deadbandInches, setDeadbandInches] = useState("0.10");
  const [bullX, setBullX] = useState("4.25");
  const [bullY, setBullY] = useState("5.50");

  const [holesText, setHolesText] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENDPOINT, endpointInput);
  }, [endpointInput]);

  function loadDemoHolesUL() {
    // UL relative to bull (x lower, y lower) with Y axis DOWN convention
    const demo = [
      { x: 3.90, y: 4.80 },
      { x: 3.95, y: 4.78 },
      { x: 3.92, y: 4.85 },
    ];
    setHolesText(prettyJson({ holes: demo }));
    setErrorMsg("");
    setStatusMsg("Demo holes loaded.");
    setResult(null);
  }

  async function onSend() {
    setErrorMsg("");
    setStatusMsg("");
    setResult(null);

    const dist = num(distanceYards);
    const click = num(clickValueMoa);
    const dead = num(deadbandInches);
    const bx = num(bullX);
    const by = num(bullY);

    if (!endpoint) {
      setErrorMsg("Backend endpoint is empty.");
      return;
    }
    if (!Number.isFinite(dist) || dist <= 0) {
      setErrorMsg("Distance (yards) must be a positive number.");
      return;
    }
    if (!Number.isFinite(click) || click <= 0) {
      setErrorMsg("Click Value (MOA) must be a positive number (example: 0.25).");
      return;
    }
    if (!Number.isFinite(dead) || dead < 0) {
      setErrorMsg("Deadband (inches) must be 0 or greater.");
      return;
    }
    if (!Number.isFinite(bx) || !Number.isFinite(by)) {
      setErrorMsg("Bull X and Bull Y must be numbers.");
      return;
    }

    const parsed = parseHolesJson(holesText);
    if (!parsed.ok) {
      setErrorMsg(parsed.error);
      return;
    }

    const payload = {
      targetSize,
      distanceYards: dist,
      clickValueMoa: click,
      deadbandInches: dead,
      bullX: bx,
      bullY: by,
      ...(parsed.holes ? { holes: parsed.holes } : {}),
      ...(parsed.poib ? { poib: parsed.poib } : {}),
    };

    setStatusMsg("Sending to backend...");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        setErrorMsg(
          (data && (data.message || data.error)) ||
            `Request failed (${r.status}).`
        );
        setStatusMsg("");
        return;
      }

      if (!data || data.ok !== true) {
        setErrorMsg((data && (data.message || data.error)) || "Backend returned an error.");
        setStatusMsg("");
        return;
      }

      setResult(data);
      setStatusMsg("Done.");
    } catch (e) {
      setErrorMsg(e && e.message ? e.message : "Network error.");
      setStatusMsg("");
    }
  }

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";
  const wSigned = result?.clicksSigned?.windage ?? 0;
  const eSigned = result?.clicksSigned?.elevation ?? 0;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>POIB Anchor Test</h2>
        <div style={{ fontSize: 12, opacity: 0.75 }}>BUILD: {APP_BUILD}</div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Backend Endpoint</div>
        <input
          value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
          placeholder="https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
        />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Using: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{endpoint}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Target Size</div>
          <select
            value={targetSize}
            onChange={(e) => setTargetSize(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="8.5x11">8.5x11</option>
            <option value="23x23">23x23</option>
            <option value="12x18">12x18</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
          <input
            value={distanceYards}
            onChange={(e) => setDistanceYards(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
          <input
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</div>
          <input
            value={deadbandInches}
            onChange={(e) => setDeadbandInches(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</div>
          <input
            value={bullX}
            onChange={(e) => setBullX(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</div>
          <input
            value={bullY}
            onChange={(e) => setBullY(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Holes JSON (in inches)</div>
        <textarea
          value={holesText}
          onChange={(e) => setHolesText(e.target.value)}
          placeholder='Example: { "holes": [ { "x": 3.90, "y": 4.80 } ] }'
          style={{ width: "100%", minHeight: 180, padding: 10, borderRadius: 10, border: "1px solid #ccc", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13 }}
        />
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
          Tip: You can test without detection by using Demo Holes.
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button
          onClick={loadDemoHolesUL}
          style={{ padding: 14, borderRadius: 12, border: "2px solid #1e66ff", background: "white", fontSize: 18, fontWeight: 700 }}
        >
          Load Demo Holes (UL)
        </button>

        <button
          onClick={onSend}
          style={{ padding: 14, borderRadius: 12, border: "2px solid #1e66ff", background: "white", fontSize: 18, fontWeight: 700 }}
        >
          Send
        </button>
      </div>

      {errorMsg ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #d33", background: "#fff5f5" }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Error</div>
          <div>{errorMsg}</div>
        </div>
      ) : null}

      {statusMsg ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          {statusMsg}
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "2px solid #2a8a2a", background: "white" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            clicksSigned: w={wSigned} , e={eSigned}
          </div>

          <details style={{ marginTop: 10 }}>
            <summary style={{ fontWeight: 800, cursor: "pointer" }}>Show raw JSON</summary>
            <pre style={{ marginTop: 10, background: "#111", color: "#eee", padding: 12, borderRadius: 10, overflowX: "auto", fontSize: 12 }}>
              {prettyJson(result)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

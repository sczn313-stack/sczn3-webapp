import React, { useEffect, useMemo, useState } from "react";

const BUILD = "SCZN3_APP_JSX_FIX__NO_POPUPS__NO_FALLBACK__PAYLOAD_VISIBLE__V1";

const STORAGE_KEY_ENDPOINT = "sczn3_backend_endpoint_v1";

function normalizeEndpoint(raw) {
  let s = String(raw || "").trim();

  // remove invisible whitespace & trailing commas
  s = s.replace(/\s+/g, "");
  s = s.replace(/,+$/g, "");

  if (!s) return "";
  s = s.replace(/\/+$/g, "");

  // if they paste /health, convert to root
  if (s.endsWith("/health")) s = s.slice(0, -"/health".length);

  // auto-append /api/sec
  if (!s.endsWith("/api/sec")) s = s + "/api/sec";
  return s;
}

function toNumberStrict(value) {
  // Keep digits and dot only (kills hidden characters)
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function parseHoles(text) {
  const t = (text || "").trim();
  if (!t) return { ok: false, error: "Holes JSON is empty." };

  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, error: "Holes JSON is not valid JSON." };
  }

  // Accept: [ {x,y}, ... ]
  if (Array.isArray(parsed)) return { ok: true, holes: parsed };

  // Accept: { holes: [ ... ] }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.holes)) {
    return { ok: true, holes: parsed.holes };
  }

  return { ok: false, error: 'Holes JSON must be an array: [ {"x":1,"y":2}, ... ]' };
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

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastPayload, setLastPayload] = useState(null);
  const [response, setResponse] = useState(null);
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENDPOINT, endpointInput);
  }, [endpointInput]);

  function loadDemoHolesUL() {
    // Optional helper; NOT required to compute; NO popups.
    const demo = [
      { x: 3.9, y: 4.8 },
      { x: 3.95, y: 4.85 },
      { x: 3.88, y: 4.78 }
    ];
    setHolesText(pretty(demo));
    setStatus("Demo holes loaded.");
    setError("");
    setResponse(null);
    setLastPayload(null);
  }

  async function onSend() {
    setError("");
    setStatus("");
    setResponse(null);
    setLastPayload(null);

    const dist = toNumberStrict(distanceYards);
    const click = toNumberStrict(clickValueMoa);
    const dead = toNumberStrict(deadbandInches);
    const bx = toNumberStrict(bullX);
    const by = toNumberStrict(bullY);

    if (!endpoint || !endpoint.startsWith("http")) {
      setError("Backend Endpoint is missing/invalid.");
      return;
    }

    if (!Number.isFinite(dist) || dist <= 0) {
      setError(`Distance (yards) must be a positive number. (You typed: "${distanceYards}")`);
      return;
    }

    const holesParsed = parseHoles(holesText);
    if (!holesParsed.ok) {
      setError(holesParsed.error);
      return;
    }

    const payload = {
      targetSize,
      distanceYards: dist,
      clickValueMoa: Number.isFinite(click) ? click : 0.25,
      deadbandInches: Number.isFinite(dead) ? dead : 0.10,
      bullX: Number.isFinite(bx) ? bx : 4.25,
      bullY: Number.isFinite(by) ? by : 5.5,
      holes: holesParsed.holes,
      frontendBuild: BUILD
    };

    setLastPayload(payload);
    setStatus("Sending...");

    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        setError((data && (data.message || data.error)) || `Request failed (${r.status}).`);
        setResponse(data);
        setStatus("");
        return;
      }

      setResponse(data);
      setStatus("Done.");
    } catch (e) {
      setError(e?.message || "Network error.");
      setStatus("");
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 14, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>POIB Anchor Test</h2>
        <div style={{ fontSize: 12, opacity: 0.75 }}>BUILD: {BUILD}</div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Backend Endpoint</div>
        <input
          value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
          placeholder="https://...onrender.com/api/sec"
        />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Using: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{endpoint}</span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Target Size</div>
          <select value={targetSize} onChange={(e) => setTargetSize(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}>
            <option value="8.5x11">8.5x11</option>
            <option value="12x18">12x18</option>
            <option value="23x23">23x23</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Distance (yards)</div>
          <input
            value={distanceYards}
            onChange={(e) => setDistanceYards(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            placeholder="100"
          />
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Click Value (MOA)</div>
          <input
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Deadband (inches)</div>
          <input
            value={deadbandInches}
            onChange={(e) => setDeadbandInches(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Bull X (inches)</div>
          <input
            value={bullX}
            onChange={(e) => setBullX(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Bull Y (inches)</div>
          <input
            value={bullY}
            onChange={(e) => setBullY(e.target.value)}
            inputMode="decimal"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Holes JSON (in inches)</div>
        <textarea
          value={holesText}
          onChange={(e) => setHolesText(e.target.value)}
          placeholder='Example: [ {"x":3.9,"y":4.8}, {"x":3.95,"y":4.85} ]'
          style={{
            width: "100%",
            minHeight: 180,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ccc",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 13
          }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button
          onClick={loadDemoHolesUL}
          style={{ padding: 14, borderRadius: 12, border: "2px solid #1e66ff", background: "white", fontSize: 18, fontWeight: 800 }}
        >
          Load Demo Holes (UL)
        </button>

        <button
          onClick={onSend}
          style={{ padding: 14, borderRadius: 12, border: "2px solid #1e66ff", background: "white", fontSize: 18, fontWeight: 800 }}
        >
          Send
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #d33", background: "#fff5f5" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>ERROR</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {status ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          {status}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          <span style={{ fontWeight: 800 }}>Show debug</span>
        </label>
      </div>

      {showDebug ? (
        <>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Exact payload sent</div>
            <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 10, overflowX: "auto", fontSize: 12 }}>
              {lastPayload ? pretty(lastPayload) : "No payload sent yet."}
            </pre>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Backend response</div>
            <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 10, overflowX: "auto", fontSize: 12 }}>
              {response ? pretty(response) : "No response yet."}
            </pre>
          </div>
        </>
      ) : null}
    </div>
  );
}

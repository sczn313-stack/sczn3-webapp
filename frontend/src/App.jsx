import React, { useMemo, useState } from "react";

const BUILD = "APPJSX_FIX_DISTANCEYARDS__2026-01-01__01";

const STORAGE_KEY_ENDPOINT = "sczn3_backend_endpoint";

function normalizeEndpoint(raw) {
  let s = String(raw || "").trim();

  // remove invisible whitespace + trailing commas (the “comma” issue)
  s = s.replace(/\s+/g, "");
  s = s.replace(/,+$/g, "");

  if (!s) return "";

  // if they paste /health, convert to root
  if (s.endsWith("/health")) s = s.slice(0, -"/health".length);

  // auto-append /api/sec if missing
  if (!s.endsWith("/api/sec")) s = s + "/api/sec";

  return s;
}

function toNumberStrict(value) {
  // Digits and dot only. Anything else => NaN.
  const cleaned = String(value ?? "").trim().replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function parseHoles(text) {
  const t = (text || "").trim();
  if (!t) return { ok: false, error: "Holes JSON is empty." };

  try {
    const parsed = JSON.parse(t);

    // allow either:
    // 1) [ {x,y}, {x,y} ]
    // 2) { holes: [ {x,y}, ... ] }
    const holes = Array.isArray(parsed) ? parsed : parsed?.holes;

    if (!Array.isArray(holes)) {
      return { ok: false, error: "Holes JSON must be an array OR { holes: [...] }." };
    }

    const cleaned = holes
      .map((h) => ({
        x: toNumberStrict(h?.x),
        y: toNumberStrict(h?.y),
      }))
      .filter((h) => Number.isFinite(h.x) && Number.isFinite(h.y));

    if (cleaned.length === 0) {
      return { ok: false, error: "No valid holes found (need numeric x/y)." };
    }

    return { ok: true, holes: cleaned };
  } catch (e) {
    return { ok: false, error: "Holes JSON is not valid JSON." };
  }
}

const DEMO_HOLES_UL = [
  { x: 3.9, y: 4.8 },
  { x: 3.95, y: 4.85 },
  { x: 3.88, y: 4.78 },
];

export default function App() {
  const [endpoint, setEndpoint] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENDPOINT);
    return saved || "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec";
  });

  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distance, setDistance] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [deadbandInches, setDeadbandInches] = useState("0.10");
  const [bullX, setBullX] = useState("4.25");
  const [bullY, setBullY] = useState("5.50");
  const [holesJson, setHolesJson] = useState(pretty(DEMO_HOLES_UL));

  const [result, setResult] = useState(null);
  const [rawOpen, setRawOpen] = useState(true);
  const [lastRequest, setLastRequest] = useState(null);

  const normalizedEndpoint = useMemo(() => normalizeEndpoint(endpoint), [endpoint]);

  async function send() {
    setResult(null);

    const d = toNumberStrict(distance);
    const cv = toNumberStrict(clickValueMoa);
    const db = toNumberStrict(deadbandInches);
    const bx = toNumberStrict(bullX);
    const by = toNumberStrict(bullY);

    if (!normalizedEndpoint) {
      setResult({ ok: false, error: "BAD_INPUT", message: "Backend endpoint is empty." });
      return;
    }
    if (!Number.isFinite(d) || d <= 0) {
      setResult({ ok: false, error: "BAD_INPUT", message: "Distance must be a positive number." });
      return;
    }
    if (!Number.isFinite(cv) || cv <= 0) {
      setResult({ ok: false, error: "BAD_INPUT", message: "Click Value (MOA) must be a positive number." });
      return;
    }
    if (!Number.isFinite(db) || db < 0) {
      setResult({ ok: false, error: "BAD_INPUT", message: "Deadband (inches) must be 0 or more." });
      return;
    }
    if (!Number.isFinite(bx) || !Number.isFinite(by)) {
      setResult({ ok: false, error: "BAD_INPUT", message: "Bull X/Y must be numbers." });
      return;
    }

    const holesParsed = parseHoles(holesJson);
    if (!holesParsed.ok) {
      setResult({ ok: false, error: "BAD_INPUT", message: holesParsed.error });
      return;
    }

    // IMPORTANT: backend expects distanceYards, bullX, bullY, clickValueMoa, deadbandInches
    const payload = {
      targetSize,
      distanceYards: d,
      clickValueMoa: cv,
      deadbandInches: db,
      bullX: bx,
      bullY: by,
      holes: holesParsed.holes,
    };

    setLastRequest(payload);

    try {
      const res = await fetch(normalizedEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!data) {
        setResult({ ok: false, error: "BAD_RESPONSE", message: "Server did not return JSON." });
        return;
      }
      setResult(data);
    } catch (e) {
      setResult({ ok: false, error: "NETWORK_ERROR", message: "Fetch failed (endpoint or CORS/network)." });
    }
  }

  function loadDemoHoles() {
    setHolesJson(pretty(DEMO_HOLES_UL));
    setResult(null);
  }

  return (
    <div style={{ maxWidth: 760, margin: "18px auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 44, margin: "8px 0 14px" }}>POIB Anchor Test</h1>

      <div style={{ marginBottom: 10, opacity: 0.8 }}>
        <b>Build:</b> {BUILD}
      </div>

      <div style={{ border: "2px solid #111", borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Backend Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => {
            const v = e.target.value;
            setEndpoint(v);
            localStorage.setItem(STORAGE_KEY_ENDPOINT, v);
          }}
          style={{ width: "100%", fontSize: 18, padding: 12, borderRadius: 10, border: "1px solid #bbb" }}
          placeholder="https://...onrender.com/api/sec"
        />
        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.75 }}>
          Normalized: <code>{normalizedEndpoint || "(empty)"}</code>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Target Size</div>
            <select value={targetSize} onChange={(e) => setTargetSize(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }}>
              <option value="8.5x11">8.5x11</option>
              <option value="23x23">23x23</option>
              <option value="12x18">12x18</option>
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 800 }}>Distance (yards)</div>
            <input value={distance} onChange={(e) => setDistance(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }} />
          </div>

          <div>
            <div style={{ fontWeight: 800 }}>Click Value (MOA)</div>
            <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }} />
          </div>

          <div>
            <div style={{ fontWeight: 800 }}>Deadband (inches)</div>
            <input value={deadbandInches} onChange={(e) => setDeadbandInches(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }} />
          </div>

          <div>
            <div style={{ fontWeight: 800 }}>Bull X (inches)</div>
            <input value={bullX} onChange={(e) => setBullX(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }} />
          </div>

          <div>
            <div style={{ fontWeight: 800 }}>Bull Y (inches)</div>
            <input value={bullY} onChange={(e) => setBullY(e.target.value)} style={{ width: "100%", fontSize: 18, padding: 10, borderRadius: 10 }} />
          </div>
        </div>

        <div style={{ marginTop: 14, fontWeight: 800 }}>Holes JSON (in inches)</div>
        <textarea
          value={holesJson}
          onChange={(e) => setHolesJson(e.target.value)}
          rows={8}
          style={{ width: "100%", fontSize: 16, padding: 12, borderRadius: 10, border: "1px solid #bbb" }}
        />

        <div style={{ fontSize: 13, marginTop: 6, opacity: 0.75 }}>
          Tip: You can test without detection by using Demo Holes.
        </div>

        <button onClick={loadDemoHoles} style={{ width: "100%", marginTop: 12, padding: 16, fontSize: 22, borderRadius: 12, border: "2px solid #1a73e8", background: "white", fontWeight: 800, color: "#1a73e8" }}>
          Load Demo Holes (UL)
        </button>

        <button onClick={send} style={{ width: "100%", marginTop: 12, padding: 18, fontSize: 26, borderRadius: 12, border: "2px solid #1a73e8", background: "white", fontWeight: 900, color: "#1a73e8" }}>
          Send
        </button>
      </div>

      <div style={{ marginTop: 14, border: "3px solid #1b5e20", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 900 }}>RESULT</div>

        {result?.ok === false ? (
          <div style={{ marginTop: 8, fontSize: 18 }}>
            <b style={{ display: "block" }}>CAN'T COMPUTE</b>
            <div style={{ opacity: 0.85 }}>{result?.message || "Error"}</div>
          </div>
        ) : result?.ok === true ? (
          <div style={{ marginTop: 8, fontSize: 18 }}>
            <b style={{ display: "block" }}>OK</b>
          </div>
        ) : (
          <div style={{ marginTop: 8, opacity: 0.75 }}>No result yet.</div>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={{ fontWeight: 800 }}>
            <input type="checkbox" checked={rawOpen} onChange={(e) => setRawOpen(e.target.checked)} style={{ marginRight: 8 }} />
            Show raw JSON
          </label>
        </div>

        {rawOpen && (
          <pre style={{ marginTop: 10, padding: 12, background: "#111", color: "#fff", borderRadius: 12, overflowX: "auto" }}>
            {pretty({ request: lastRequest, response: result })}
          </pre>
        )}
      </div>
    </div>
  );
}

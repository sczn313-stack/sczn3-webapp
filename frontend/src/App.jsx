// frontend/src/App.jsx
import React, { useMemo, useState } from "react";

/**
 * SCZN3 POIB Anchor Test — CLEAN (NO DEMO / NO POPUPS)
 * - Send is NEVER blocked by a "paste holes" alert.
 * - No "Load Demo Holes" button.
 * - Shows exactly what holes[] will be sent (holesCount + first hole).
 * - Adds a frontend build stamp so you can prove you're on the new bundle.
 */

const FRONTEND_BUILD = "FE_NO_DEMO_V1_2025-12-31_1635";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const defaultByTarget = (spec) => {
  // Your locked test defaults:
  // 8.5x11 bull at (4.25, 5.50)
  if (spec === "8.5x11") return { w: 8.5, h: 11, bullX: 4.25, bullY: 5.5 };
  // Add more if needed later
  return { w: 8.5, h: 11, bullX: 4.25, bullY: 5.5 };
};

function safeParseHoles(text) {
  const t = (text || "").trim();
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return [];
    const holes = [];
    for (const item of v) {
      if (
        item &&
        typeof item === "object" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        Number.isFinite(item.x) &&
        Number.isFinite(item.y)
      ) {
        holes.push({ x: item.x, y: item.y });
      }
    }
    return holes;
  } catch {
    return [];
  }
}

export default function App() {
  // Endpoint (can also be injected by env build later; keep simple for now)
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);

  const defaults = useMemo(() => defaultByTarget(targetSize), [targetSize]);

  const [bullX, setBullX] = useState(defaults.bullX);
  const [bullY, setBullY] = useState(defaults.bullY);

  // If target changes, refresh bull defaults (but do not change holes)
  React.useEffect(() => {
    setBullX(defaults.bullX);
    setBullY(defaults.bullY);
  }, [defaults.bullX, defaults.bullY]);

  // Optional image input (not used for detection yet)
  const [file, setFile] = useState(null);

  // Holes JSON textarea (optional; never blocks send)
  const [holesText, setHolesText] = useState("");

  // Result
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const holes = useMemo(() => safeParseHoles(holesText), [holesText]);

  const holesCount = holes.length;
  const firstHole = holesCount ? holes[0] : null;

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";

  async function onSend() {
    setLoading(true);
    setResult(null);

    const payload = {
      targetSizeSpec: targetSize,
      targetSizeInches: { widthIn: defaults.w, heightIn: defaults.h },
      distanceYards: Number(distanceYards),
      clickValueMoa: Number(clickValueMoa),
      deadbandInches: Number(deadbandIn),
      bull: { x: Number(bullX), y: Number(bullY) },
      holes: holes, // inches
      // Frontend build stamp to prove which UI is sending:
      frontendBuild: FRONTEND_BUILD,
    };

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Always try to parse JSON
      const data = await resp.json().catch(() => ({
        ok: false,
        error: { code: "BAD_JSON", message: "Response was not JSON" },
      }));

      // If backend returns non-2xx, still show payload+error
      setResult({
        ...data,
        _http: { ok: resp.ok, status: resp.status },
        _sent: {
          holesCount: holes.length,
          firstHole: firstHole ? { x: firstHole.x, y: firstHole.y } : null,
          targetSize,
          bull: { x: Number(bullX), y: Number(bullY) },
        },
      });
    } catch (e) {
      setResult({
        ok: false,
        error: { code: "NETWORK", message: String(e?.message || e) },
        _sent: {
          holesCount: holes.length,
          firstHole: firstHole ? { x: firstHole.x, y: firstHole.y } : null,
          targetSize,
          bull: { x: Number(bullX), y: Number(bullY) },
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
        POIB Anchor Test
      </div>

      {/* Build stamps so you can PROVE you're on the new frontend */}
      <div style={{ marginBottom: 14, opacity: 0.8 }}>
        frontendBuild: <b>{FRONTEND_BUILD}</b>
      </div>

      {/* Endpoint */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Backend POST endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      {/* Inputs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Target Size</div>
          <select
            value={targetSize}
            onChange={(e) => setTargetSize(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="8.5x11">8.5x11</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
          <input
            type="number"
            value={distanceYards}
            onChange={(e) => setDistanceYards(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
          <input
            type="number"
            step="0.01"
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</div>
          <input
            type="number"
            step="0.01"
            value={deadbandIn}
            onChange={(e) => setDeadbandIn(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullX}
            onChange={(e) => setBullX(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullY}
            onChange={(e) => setBullY(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      {/* Image (optional) */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Image (optional for now)</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {file ? `Selected: ${file.name}` : "No image selected."}
        </div>
      </div>

      {/* Holes JSON */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Holes JSON (in inches) — optional</div>
        <textarea
          value={holesText}
          onChange={(e) => setHolesText(e.target.value)}
          placeholder='Example: [{"x":3.82,"y":4.88},{"x":3.93,"y":4.85}]'
          rows={7}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
          }}
        />
        {/* Always-visible proof of what will be sent */}
        <div style={{ marginTop: 8, opacity: 0.9 }}>
          holesCount: <b>{holesCount}</b>
          {" | "}
          first:{" "}
          <b>
            {firstHole ? `(${round2(firstHole.x)}, ${round2(firstHole.y)})` : "(none)"}
          </b>
        </div>
      </div>

      {/* Send */}
      <button
        onClick={onSend}
        disabled={loading}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "2px solid #1e6bd6",
          background: loading ? "#e9eef7" : "white",
          fontWeight: 900,
          fontSize: 18,
          cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 12,
        }}
      >
        {loading ? "Sending..." : "Send"}
      </button>

      {/* Output */}
      {result && (
        <div
          style={{
            border: "2px solid #2e9b4f",
            borderRadius: 10,
            padding: 12,
            background: "#f6fff9",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>

          <div style={{ opacity: 0.85, marginBottom: 10 }}>
            clicksSigned: w=
            {round2(result?.clicksSigned?.windage ?? 0)}, e=
            {round2(result?.clicksSigned?.elevation ?? 0)}
          </div>

          <details>
            <summary style={{ fontWeight: 900, cursor: "pointer" }}>Show raw JSON</summary>
            <pre
              style={{
                marginTop: 10,
                background: "#111",
                color: "#eee",
                padding: 12,
                borderRadius: 10,
                overflowX: "auto",
                fontSize: 12,
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function safeParseHoles(text) {
  const t = (text || "").trim();
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    if (!Array.isArray(v)) return null;
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
    return null;
  }
}

export default function App() {
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);

  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  const [file, setFile] = useState(null);
  const [holesText, setHolesText] = useState("");

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);

  const holesParsed = useMemo(() => safeParseHoles(holesText), [holesText]);

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    // IMPORTANT: stop “same output” by clearing the old holes when you pick a new image
    setHolesText("");
    setResult(null);
    setErrorMsg("");
  }

  async function onSend() {
    setErrorMsg("");
    setResult(null);

    // No more goofy popup. Just a clean inline message.
    if (holesParsed === null) {
      setErrorMsg("Holes JSON is not valid JSON. Paste an array like [{\"x\":1.2,\"y\":3.4}].");
      return;
    }

    if (!holesParsed || holesParsed.length === 0) {
      setErrorMsg(
        "No holes provided. This build uses holes[] (in inches). Image upload does not change math yet."
      );
      return;
    }

    const payload = {
      targetSizeSpec,
      distanceYards: Number(distanceYards),
      clickValueMoa: Number(clickValueMoa),
      deadbandIn: Number(deadbandIn),
      bull: { x: Number(bullX), y: Number(bullY) },
      holes: holesParsed,
    };

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setErrorMsg(`Backend error (${res.status}).`);
        return;
      }
      setResult(data);
    } catch (err) {
      setErrorMsg("Network error calling backend.");
    } finally {
      setBusy(false);
    }
  }

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 14, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>POIB Anchor Test</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Target Size</div>
          <select
            value={targetSizeSpec}
            onChange={(e) => setTargetSizeSpec(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          >
            <option value="8.5x11">8.5x11</option>
            <option value="11x17">11x17</option>
            <option value="12x18">12x18</option>
            <option value="23x23">23x23</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Distance (yards)</div>
          <input
            type="number"
            value={distanceYards}
            onChange={(e) => setDistanceYards(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
          <input
            type="number"
            step="0.01"
            value={clickValueMoa}
            onChange={(e) => setClickValueMoa(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Deadband (inches)</div>
          <input
            type="number"
            step="0.01"
            value={deadbandIn}
            onChange={(e) => setDeadbandIn(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Bull X (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullX}
            onChange={(e) => setBullX(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Bull Y (inches)</div>
          <input
            type="number"
            step="0.01"
            value={bullY}
            onChange={(e) => setBullY(e.target.value)}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Backend Endpoint</div>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Image (optional for now)</div>
        <input type="file" accept="image/*" onChange={onPickFile} />
        {file ? (
          <div style={{ marginTop: 6, opacity: 0.85 }}>Selected: {file.name}</div>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Holes JSON (in inches)</div>
        <textarea
          value={holesText}
          onChange={(e) => setHolesText(e.target.value)}
          placeholder='Example: [{"x":3.82,"y":4.88},{"x":3.93,"y":4.85}]'
          rows={6}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
        />
        <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
          (No demo button. No popup. If holes[] is empty, we show a clean message.)
        </div>
      </div>

      <button
        onClick={onSend}
        disabled={busy}
        style={{
          marginTop: 14,
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "2px solid #2b6cb0",
          fontSize: 18,
          fontWeight: 800,
          cursor: busy ? "not-allowed" : "pointer",
          background: busy ? "#e2e8f0" : "white",
        }}
      >
        {busy ? "Sending..." : "Send"}
      </button>

      {errorMsg ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "2px solid #c53030", background: "#fff5f5", fontWeight: 700 }}>
          {errorMsg}
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: "2px solid #2f855a" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>
            clicksSigned: w={round2(result?.clicksSigned?.windage ?? 0)}, e={round2(result?.clicksSigned?.elevation ?? 0)}
          </div>

          <details style={{ marginTop: 10 }}>
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
      ) : null}
    </div>
  );
}

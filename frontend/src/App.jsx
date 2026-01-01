import React, { useMemo, useRef, useState } from "react";

function round2(n) {
  return Math.round(n * 100) / 100;
}

const TARGETS = {
  "8.5x11": { widthIn: 8.5, heightIn: 11.0 },
};

export default function App() {
  const imgRef = useRef(null);

  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);

  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  // IMPORTANT: default to your live backend
  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [file, setFile] = useState(null);
  const [imgUrl, setImgUrl] = useState("");

  const [holes, setHoles] = useState([]); // [{x,y}] IN INCHES
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const target = useMemo(() => TARGETS[targetSizeSpec], [targetSizeSpec]);

  function clearAll() {
    setHoles([]);
    setResult(null);
    setErr("");
  }

  function onPickFile(e) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setErr("");
    setHoles([]); // critical: new target must start fresh
    if (f) setImgUrl(URL.createObjectURL(f));
    else setImgUrl("");
  }

  function addHoleFromTap(evt) {
    if (!imgRef.current) return;
    if (!target) return;

    const rect = imgRef.current.getBoundingClientRect();

    // Works for mouse + touch
    const clientX = evt.touches?.[0]?.clientX ?? evt.clientX;
    const clientY = evt.touches?.[0]?.clientY ?? evt.clientY;

    const pxX = clientX - rect.left;
    const pxY = clientY - rect.top;

    const fracX = Math.min(1, Math.max(0, pxX / rect.width));
    const fracY = Math.min(1, Math.max(0, pxY / rect.height));

    const xIn = round2(fracX * target.widthIn);
    const yIn = round2(fracY * target.heightIn); // yAxisUsed = "down" (top=0)

    setHoles((prev) => [...prev, { x: xIn, y: yIn }]);
    setResult(null);
    setErr("");
  }

  function undoHole() {
    setHoles((prev) => prev.slice(0, -1));
    setResult(null);
    setErr("");
  }

  async function send() {
    setErr("");
    setResult(null);

    if (!holes || holes.length < 3) {
      setErr("Tap the image to add at least 3 holes (no JSON paste needed).");
      return;
    }

    const payload = {
      targetSizeSpec,
      distanceYards: Number(distanceYards),
      clickValueMoa: Number(clickValueMoa),
      deadbandIn: Number(deadbandIn),
      bull: { x: Number(bullX), y: Number(bullY) },
      holesInches: holes.map((h) => ({ x: Number(h.x), y: Number(h.y) })),
    };

    try {
      setSending(true);
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.error || `Request failed (${r.status})`);
      }
      setResult(data);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSending(false);
    }
  }

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 14, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h2 style={{ margin: "6px 0 14px" }}>POIB Anchor Test</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Target Size</div>
          <select value={targetSizeSpec} onChange={(e) => setTargetSizeSpec(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }}>
            <option value="8.5x11">8.5x11</option>
          </select>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
          <input value={distanceYards} onChange={(e) => setDistanceYards(e.target.value)} inputMode="numeric" style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
          <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</div>
          <input value={deadbandIn} onChange={(e) => setDeadbandIn(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</div>
          <input value={bullX} onChange={(e) => setBullX(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</div>
          <input value={bullY} onChange={(e) => setBullY(e.target.value)} inputMode="decimal" style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Backend endpoint</div>
        <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 14 }} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Image (tap to add holes)</div>
        <input type="file" accept="image/*" onChange={onPickFile} />
      </div>

      {imgUrl ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
            Tap on the image to mark each bullet hole. (Y is DOWN from the top.)
          </div>

          <div
            style={{
              border: "2px solid #111",
              borderRadius: 10,
              overflow: "hidden",
              width: "100%",
              maxWidth: 520,
              touchAction: "none",
            }}
          >
            <img
              ref={imgRef}
              src={imgUrl}
              alt="target"
              style={{ width: "100%", display: "block" }}
              onClick={addHoleFromTap}
              onTouchStart={addHoleFromTap}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={undoHole} disabled={holes.length === 0} style={{ padding: "10px 14px", fontSize: 16 }}>
              Undo last
            </button>
            <button onClick={() => { setHoles([]); setResult(null); setErr(""); }} style={{ padding: "10px 14px", fontSize: 16 }}>
              Clear holes
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
          Pick an image first, then tap to mark holes.
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Holes captured (inches)</div>
        <pre style={{ background: "#f3f3f3", padding: 10, borderRadius: 10, maxHeight: 180, overflow: "auto", fontSize: 13 }}>
{JSON.stringify(holes, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          onClick={send}
          disabled={sending}
          style={{
            width: "100%",
            padding: "14px 12px",
            fontSize: 20,
            fontWeight: 800,
            borderRadius: 12,
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, border: "2px solid #b00020", borderRadius: 10, color: "#b00020", fontWeight: 700 }}>
          {err}
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 14, padding: 12, border: "3px solid #0a7a2f", borderRadius: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>

          <div style={{ marginTop: 6, opacity: 0.9 }}>
            clicksSigned: w={round2(result?.clicksSigned?.windage ?? 0)}, e={round2(result?.clicksSigned?.elevation ?? 0)}
          </div>

          <details style={{ marginTop: 10 }}>
            <summary style={{ fontWeight: 900, cursor: "pointer" }}>Show raw JSON</summary>
            <pre style={{ marginTop: 10, background: "#111", color: "#eee", padding: 12, borderRadius: 10, overflowX: "auto", fontSize: 12 }}>
{JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      <div style={{ marginTop: 18, fontSize: 12, opacity: 0.75 }}>
        Build: NO_JSON_POPUP_TAP_HOLES_V1
      </div>
    </div>
  );
}

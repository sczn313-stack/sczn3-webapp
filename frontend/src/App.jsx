import React, { useEffect, useMemo, useRef, useState } from "react";

const BUILD_STAMP = "TAP_HOLES_NO_DEMO_V1_2025-12-31";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function parseNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function targetSizeToInches(spec) {
  // Keep it simple: only what you're testing now.
  // Add more later if needed.
  if (spec === "8.5x11") return { widthIn: 8.5, heightIn: 11 };
  if (spec === "11x17") return { widthIn: 11, heightIn: 17 };
  if (spec === "23x23") return { widthIn: 23, heightIn: 23 };
  return { widthIn: 8.5, heightIn: 11 };
}

export default function App() {
  const [targetSizeSpec, setTargetSizeSpec] = useState("8.5x11");
  const targetSize = useMemo(() => targetSizeToInches(targetSizeSpec), [targetSizeSpec]);

  const [distanceYards, setDistanceYards] = useState(100);
  const [clickValueMoa, setClickValueMoa] = useState(0.25);
  const [deadbandIn, setDeadbandIn] = useState(0.1);

  // Bull is in inches from LEFT and from TOP (Y DOWN)
  const [bullX, setBullX] = useState(4.25);
  const [bullY, setBullY] = useState(5.5);

  const [endpoint, setEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [imgUrl, setImgUrl] = useState("");
  const [holes, setHoles] = useState([]); // [{x,y}] in inches (Y DOWN)
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isSending, setIsSending] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  // Try to unregister any service worker (helps iOS/Safari cache weirdness)
  useEffect(() => {
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
        }
      } catch {}
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }
      } catch {}
    })();
  }, []);

  // Draw image to canvas whenever it changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgUrl) return;

    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fit canvas to container width, keep aspect ratio
      const maxW = Math.min(700, canvas.parentElement?.clientWidth || 700);
      const scale = maxW / img.naturalWidth;
      const w = Math.floor(img.naturalWidth * scale);
      const h = Math.floor(img.naturalHeight * scale);

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Draw holes overlay
      drawHoleOverlay();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl]);

  // Redraw overlay when holes change
  useEffect(() => {
    drawHoleOverlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holes]);

  function drawHoleOverlay() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Re-draw image first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw each hole as a small circle + index
    holes.forEach((h, idx) => {
      const xPx = (h.x / targetSize.widthIn) * canvas.width;
      const yPx = (h.y / targetSize.heightIn) * canvas.height;

      ctx.beginPath();
      ctx.arc(xPx, yPx, 8, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 140, 255, 0.95)";
      ctx.stroke();

      ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillStyle = "rgba(0, 140, 255, 0.95)";
      ctx.fillText(String(idx + 1), xPx + 10, yPx - 10);
    });
  }

  function onPickFile(e) {
    setError("");
    setResult(null);
    setHoles([]);
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImgUrl(url);
  }

  function onCanvasTap(e) {
    setError("");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;

    const xPx = clientX - rect.left;
    const yPx = clientY - rect.top;

    // Convert pixel point to inches (Y DOWN)
    const xIn = (xPx / canvas.width) * targetSize.widthIn;
    const yIn = (yPx / canvas.height) * targetSize.heightIn;

    const hole = {
      x: round2(clamp(xIn, 0, targetSize.widthIn)),
      y: round2(clamp(yIn, 0, targetSize.heightIn)),
    };

    setHoles((prev) => [...prev, hole]);
  }

  function popLastHole() {
    setHoles((prev) => prev.slice(0, -1));
  }

  function clearHoles() {
    setHoles([]);
    setResult(null);
    setError("");
  }

  async function send() {
    setError("");
    setResult(null);

    if (!holes || holes.length === 0) {
      setError("Tap the bullet holes on the image first (3–7 is ideal), then press Send.");
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        targetSizeSpec,
        targetSizeInches: { widthIn: targetSize.widthIn, heightIn: targetSize.heightIn },
        distanceYards: parseNum(distanceYards, 100),
        clickValueMoa: parseNum(clickValueMoa, 0.25),
        deadbandIn: parseNum(deadbandIn, 0.1),
        bull: { x: parseNum(bullX, 4.25), y: parseNum(bullY, 5.5) },
        // holes in INCHES, with Y DOWN (top-left origin)
        holes,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(String(err?.message || err || "Unknown error"));
    } finally {
      setIsSending(false);
    }
  }

  const windageLabel = result?.scopeClicks?.windage || "";
  const elevationLabel = result?.scopeClicks?.elevation || "";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>POIB Anchor Test</div>
      <div style={{ opacity: 0.85, marginBottom: 14 }}>
        BUILD: <b>{BUILD_STAMP}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>Target Size</div>
          <select value={targetSizeSpec} onChange={(e) => setTargetSizeSpec(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }}>
            <option value="8.5x11">8.5x11</option>
            <option value="11x17">11x17</option>
            <option value="23x23">23x23</option>
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Distance (yards)</div>
          <input value={distanceYards} onChange={(e) => setDistanceYards(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Click Value (MOA)</div>
          <input value={clickValueMoa} onChange={(e) => setClickValueMoa(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Deadband (inches)</div>
          <input value={deadbandIn} onChange={(e) => setDeadbandIn(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Bull X (inches)</div>
          <input value={bullX} onChange={(e) => setBullX(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Bull Y (inches)</div>
          <input value={bullY} onChange={(e) => setBullY(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16 }} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Backend endpoint</div>
        <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 15 }} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Image</div>
        <input type="file" accept="image/*" onChange={onPickFile} />
      </div>

      <div style={{ marginTop: 12 }}>
        {!imgUrl ? (
          <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 10, opacity: 0.8 }}>
            Pick an image, then tap the bullet holes.
          </div>
        ) : (
          <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden" }}>
            <img ref={imgRef} src={imgUrl} alt="target" style={{ display: "none" }} />
            <canvas
              ref={canvasRef}
              onClick={onCanvasTap}
              onTouchStart={(e) => {
                e.preventDefault();
                onCanvasTap(e);
              }}
              style={{ width: "100%", display: "block", touchAction: "none" }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={popLastHole} style={{ flex: 1, padding: 14, fontSize: 18, fontWeight: 800 }}>
          Undo last
        </button>
        <button onClick={clearHoles} style={{ flex: 1, padding: 14, fontSize: 18, fontWeight: 800 }}>
          Clear holes
        </button>
      </div>

      <button
        onClick={send}
        disabled={isSending}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 16,
          fontSize: 22,
          fontWeight: 900,
          borderRadius: 12,
        }}
      >
        {isSending ? "Sending..." : "Send"}
      </button>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "2px solid #b00020", color: "#b00020", fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      {holes?.length ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Holes (inches, Y DOWN): {holes.length}</div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(holes, null, 2)}
          </div>
        </div>
      ) : null}

      {result ? (
        <div style={{ marginTop: 14, border: "2px solid #2e7d32", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            Windage: {windageLabel} | Elevation: {elevationLabel}
          </div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>
            clicksSigned: w={round2(result?.clicksSigned?.windage)} , e={round2(result?.clicksSigned?.elevation)}
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

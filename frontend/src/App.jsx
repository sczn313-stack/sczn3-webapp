import React, { useMemo, useRef, useState } from "react";

/**
 * SCZN3 — Tap Holes UI (inches-only)
 * - Upload an image
 * - Tap to add holes
 * - Converts taps to inches using targetSize (W x H)
 * - Sends POST to /api/sec backend
 *
 * Coordinate convention (LOCKED):
 *  - x increases RIGHT
 *  - y increases DOWN (top of image is y=0)
 */

const FRONTEND_BUILD = "FE_TAP_HOLES_V1_2026_01_01";

const TARGET_SIZES = [
  { label: "8.5x11", w: 8.5, h: 11 },
  { label: "12x18", w: 12, h: 18 },
  { label: "23x23", w: 23, h: 23 },
];

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function normalizeBackendUrl(raw) {
  let s = (raw || "").trim();

  // common user mistake: trailing commas/spaces
  s = s.replace(/,+\s*$/g, "");

  // if they paste root service, auto-append /api/sec
  // e.g. https://xxx.onrender.com  -> https://xxx.onrender.com/api/sec
  if (!s) return "";

  // remove trailing slash
  s = s.replace(/\/+$/g, "");

  // if they accidentally paste /health, swap to /api/sec
  if (s.endsWith("/health")) s = s.slice(0, -"/health".length);

  if (!s.endsWith("/api/sec")) s = s + "/api/sec";
  return s;
}

export default function App() {
  const [backendEndpoint, setBackendEndpoint] = useState(
    "https://sczn3-sec-backend-pipe-17.onrender.com/api/sec"
  );

  const [targetSize, setTargetSize] = useState("8.5x11");
  const [distanceYards, setDistanceYards] = useState("50");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");
  const [deadbandInches, setDeadbandInches] = useState("0.10");
  const [bullX, setBullX] = useState("4.25");
  const [bullY, setBullY] = useState("5.50");

  const [imageUrl, setImageUrl] = useState("");
  const [holesPx, setHolesPx] = useState([]); // stored as normalized percent coords: { px, py } in [0..1]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resp, setResp] = useState(null);
  const [showRaw, setShowRaw] = useState(true);

  const imgRef = useRef(null);
  const wrapperRef = useRef(null);

  const size = useMemo(() => {
    return TARGET_SIZES.find((t) => t.label === targetSize) || TARGET_SIZES[0];
  }, [targetSize]);

  const holesInches = useMemo(() => {
    // Convert normalized percents to inches
    return holesPx.map((p) => ({
      x: round2(p.px * size.w),
      y: round2(p.py * size.h),
    }));
  }, [holesPx, size.w, size.h]);

  function onPickFile(e) {
    setErr("");
    setResp(null);
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    setHolesPx([]); // reset holes on new image
  }

  function addHoleFromEvent(e) {
    if (!imageUrl) {
      setErr("Pick an image first, then tap holes on it.");
      return;
    }
    const wrapper = wrapperRef.current;
    const img = imgRef.current;
    if (!wrapper || !img) return;

    // Get click/tap position relative to the *rendered* image box
    const rect = img.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    if (clientX == null || clientY == null) return;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Ignore taps outside the image
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const px = x / rect.width;  // 0..1
    const py = y / rect.height; // 0..1 (Y DOWN)

    setHolesPx((prev) => [...prev, { px, py }]);
  }

  function undo() {
    setHolesPx((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setHolesPx([]);
  }

  async function send() {
    setErr("");
    setResp(null);

    const endpoint = normalizeBackendUrl(backendEndpoint);

    const dist = Number(distanceYards);
    const click = Number(clickValueMoa);
    const dead = Number(deadbandInches);
    const bx = Number(bullX);
    const by = Number(bullY);

    // Hard validation so you never get that BAD_INPUT again
    if (!endpoint.startsWith("http")) return setErr("Backend Endpoint URL is missing/invalid.");
    if (!Number.isFinite(dist) || dist <= 0) return setErr("Distance (yards) must be a positive number.");
    if (!Number.isFinite(click) || click <= 0) return setErr("Click Value (MOA) must be a positive number.");
    if (!Number.isFinite(dead) || dead < 0) return setErr("Deadband (inches) must be 0 or greater.");
    if (!Number.isFinite(bx) || !Number.isFinite(by)) return setErr("Bull X/Y must be valid numbers.");
    if (holesInches.length < 1) return setErr("Tap at least 1 hole on the image.");

    const payload = {
      targetSize,
      distanceYards: dist,
      clickValueMoa: click,
      deadbandInches: dead,
      bullX: bx,
      bullY: by,
      holes: holesInches,
      frontendBuild: FRONTEND_BUILD,
    };

    try {
      setBusy(true);
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setResp(data);
        setErr(data?.message || `Request failed: ${r.status}`);
        return;
      }
      setResp(data);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", padding: 14, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ margin: "10px 0 6px" }}>SCZN3 — Tap Holes</h1>
      <div style={{ color: "#444", marginBottom: 10 }}>
        Frontend build: <b>{FRONTEND_BUILD}</b>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Backend Endpoint</div>
          <input
            value={backendEndpoint}
            onChange={(e) => setBackendEndpoint(e.target.value)}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
            placeholder="https://...onrender.com/api/sec"
          />
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
            Tip: you can paste the service root; this UI will auto-append <code>/api/sec</code>.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Target Size</div>
            <select
              value={targetSize}
              onChange={(e) => setTargetSize(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
            >
              {TARGET_SIZES.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Distance (yards)</div>
            <input
              inputMode="decimal"
              value={distanceYards}
              onChange={(e) => setDistanceYards(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
              placeholder="50"
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Click Value (MOA)</div>
            <input
              inputMode="decimal"
              value={clickValueMoa}
              onChange={(e) => setClickValueMoa(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
              placeholder="0.25"
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Deadband (inches)</div>
            <input
              inputMode="decimal"
              value={deadbandInches}
              onChange={(e) => setDeadbandInches(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
              placeholder="0.10"
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull X (inches)</div>
            <input
              inputMode="decimal"
              value={bullX}
              onChange={(e) => setBullX(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
              placeholder="4.25"
            />
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Bull Y (inches)</div>
            <input
              inputMode="decimal"
              value={bullY}
              onChange={(e) => setBullY(e.target.value)}
              style={{ width: "100%", padding: 10, fontSize: 16 }}
              placeholder="5.50"
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Image</div>
          <input type="file" accept="image/*" onChange={onPickFile} />
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>
            After selecting an image: <b>tap each bullet hole</b> to add it.
          </div>
        </div>

        {/* Tap Area */}
        <div
          ref={wrapperRef}
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 10,
            minHeight: 200,
            position: "relative",
            userSelect: "none",
          }}
        >
          {!imageUrl ? (
            <div style={{ color: "#777" }}>Pick an image above to enable tapping.</div>
          ) : (
            <div style={{ position: "relative" }}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="target"
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}
                onClick={addHoleFromEvent}
                onTouchStart={(e) => {
                  // iOS: touchstart gives touches[0]
                  addHoleFromEvent(e);
                }}
              />

              {/* Markers */}
              {holesPx.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${p.px * 100}%`,
                    top: `${p.py * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={undo} disabled={holesPx.length < 1} style={{ padding: "10px 14px", fontSize: 16 }}>
            Undo
          </button>
          <button onClick={clearAll} disabled={holesPx.length < 1} style={{ padding: "10px 14px", fontSize: 16 }}>
            Clear
          </button>
          <button onClick={send} disabled={busy} style={{ padding: "10px 14px", fontSize: 16, fontWeight: 700 }}>
            {busy ? "Sending..." : "Send"}
          </button>
        </div>

        {/* Holes preview */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Holes (inches) — generated from taps ({holesInches.length})
          </div>
          <textarea
            readOnly
            value={JSON.stringify(holesInches, null, 2)}
            style={{ width: "100%", minHeight: 140, padding: 10, fontSize: 14 }}
          />
        </div>

        {/* Output */}
        <div style={{ marginTop: 12, border: "2px solid #2f7d32", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>OUTPUT</div>

          {err ? (
            <div style={{ color: "#b00020", fontWeight: 700, marginBottom: 8 }}>{err}</div>
          ) : null}

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} />
            <b>Show raw JSON</b>
          </label>

          {showRaw && (
            <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 10, overflowX: "auto" }}>
              {JSON.stringify(resp ?? { ok: false, message: "No response yet." }, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

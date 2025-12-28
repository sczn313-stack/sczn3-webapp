import React, { useMemo, useState } from "react";

const DEFAULT_ENDPOINT = "https://sczn3-sec-backend-pipe.onrender.com/api/sec";

function toFixed2(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return (Math.round(num * 100) / 100).toFixed(2);
}

function abs2(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00";
  return toFixed2(Math.abs(num));
}

function parseTargetSizeSpec(specRaw) {
  // Accept: "11", "8.5x11", "8.5×11", "8.5 x 11"
  const spec = String(specRaw || "").trim().toLowerCase().replace("×", "x").replace(/\s+/g, "");
  if (!spec) return { ok: false, spec: "", long: null, short: null, reason: "EMPTY" };

  // pure number = assume it's the long side
  if (/^\d+(\.\d+)?$/.test(spec)) {
    const v = Number(spec);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, spec, long: null, short: null, reason: "BAD_NUMBER" };
    return { ok: true, spec, long: v, short: null, reason: null };
  }

  const m = spec.match(/^(\d+(\.\d+)?)(x)(\d+(\.\d+)?)$/);
  if (!m) return { ok: false, spec, long: null, short: null, reason: "BAD_FORMAT" };

  const a = Number(m[1]);
  const b = Number(m[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return { ok: false, spec, long: null, short: null, reason: "BAD_DIMENSIONS" };
  }

  const long = Math.max(a, b);
  const short = Math.min(a, b);
  return { ok: true, spec, long, short, reason: null };
}

function dialFromPoib(poibInches, clicksSigned) {
  const x = Number(poibInches?.x);
  const y = Number(poibInches?.y);

  // POIB truth rules (image y+ means down on photo, correction is UP)
  const wDir = !Number.isFinite(x) || x === 0 ? "CENTER" : x > 0 ? "LEFT" : "RIGHT";
  const eDir = !Number.isFinite(y) || y === 0 ? "LEVEL" : y > 0 ? "UP" : "DOWN";

  const wAbs = abs2(clicksSigned?.windage);
  const eAbs = abs2(clicksSigned?.elevation);

  return {
    windage: `${wDir} ${wAbs} clicks`,
    elevation: `${eDir} ${eAbs} clicks`,
    wDir,
    eDir,
    wAbs,
    eAbs,
  };
}

function extractDirFromDialString(s) {
  const t = String(s || "").toUpperCase();
  if (t.includes("LEFT")) return "LEFT";
  if (t.includes("RIGHT")) return "RIGHT";
  if (t.includes("UP")) return "UP";
  if (t.includes("DOWN")) return "DOWN";
  if (t.includes("CENTER")) return "CENTER";
  if (t.includes("LEVEL")) return "LEVEL";
  return null;
}

function buildIncongruenceLog({ parsedLong, backendTargetSizeInches, poibInches, backendDial }) {
  const log = [];

  // 1) target size congruence
  const pLong = Number(parsedLong);
  const bSize = Number(backendTargetSizeInches);
  if (Number.isFinite(pLong) && Number.isFinite(bSize)) {
    // strict 2-decimal compare (because backend sends 11, 23, etc.)
    const p2 = Number(toFixed2(pLong));
    const b2 = Number(toFixed2(bSize));
    if (p2 !== b2) {
      log.push({
        code: "TARGET_SIZE_INCONGRUENT",
        parsedLong: toFixed2(pLong),
        backendTargetSizeInches: toFixed2(bSize),
        fix: "UI should send the long side (11.00 for 8.5x11). Backend should receive the same. If mismatch, block trust.",
      });
    }
  }

  // 2) elevation direction congruence (POIB truth vs backend dial string)
  const y = Number(poibInches?.y);
  const expectedElevDir = !Number.isFinite(y) || y === 0 ? "LEVEL" : y > 0 ? "UP" : "DOWN";
  const backendElevDir = extractDirFromDialString(backendDial?.elevation);

  if (backendElevDir && backendElevDir !== expectedElevDir) {
    log.push({
      code: "ELEVATION_DIRECTION_INCONGRUENT",
      poib: { y: toFixed2(y) },
      uiDial: expectedElevDir,
      backendDial: backendDial?.elevation || "",
      fix: "Backend dial strings must be derived from POIB sign (truth). If backend uses flipped y-axis or clicksSigned sign, it will lie. Fix backend dial generation.",
    });
  }

  // 3) windage direction congruence (POIB truth vs backend dial string)
  const x = Number(poibInches?.x);
  const expectedWindDir = !Number.isFinite(x) || x === 0 ? "CENTER" : x > 0 ? "LEFT" : "RIGHT";
  const backendWindDir = extractDirFromDialString(backendDial?.windage);

  if (backendWindDir && backendWindDir !== expectedWindDir) {
    log.push({
      code: "WINDAGE_DIRECTION_INCONGRUENT",
      poib: { x: toFixed2(x) },
      uiDial: expectedWindDir,
      backendDial: backendDial?.windage || "",
      fix: "Backend windage dial strings must be derived from POIB sign (truth). Fix backend dial generation.",
    });
  }

  return log;
}

export default function App() {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);

  const [file, setFile] = useState(null);

  const [targetPreset, setTargetPreset] = useState("8.5x11");
  const [targetSpec, setTargetSpec] = useState("8.5x11");

  const [distanceYards, setDistanceYards] = useState("100");
  const [clickValueMoa, setClickValueMoa] = useState("0.25");

  const [showRaw, setShowRaw] = useState(true);

  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");

  const parsed = useMemo(() => parseTargetSizeSpec(targetSpec), [targetSpec]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  async function onSend() {
    setErr("");
    setResp(null);

    if (!file) {
      setErr("Choose an image first.");
      return;
    }

    if (!parsed.ok || !Number.isFinite(Number(parsed.long))) {
      setErr("Target size is invalid. Use 11 or 8.5x11.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();

      // REQUIRED
      form.append("image", file);

      // OPTIONAL fields your backend already accepts
      form.append("distanceYards", String(distanceYards || "100"));
      form.append("clickValueMoa", String(clickValueMoa || "0.25"));

      // IMPORTANT: always send LONG side in inches (8.5x11 => 11)
      form.append("targetSizeInches", String(Number(parsed.long)));

      const r = await fetch(endpoint, { method: "POST", body: form });

      // If backend returns non-200, surface readable text
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Backend error ${r.status}: ${text || r.statusText}`);
      }

      const json = await r.json();
      setResp(json);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  // derived display
  const poibInches = resp?.poibInches || null;
  const clicksSigned = resp?.clicksSigned || null;

  const minimal = useMemo(() => {
    if (!resp) return null;
    return dialFromPoib(poibInches, clicksSigned);
  }, [resp, poibInches, clicksSigned]);

  const incongruenceLog = useMemo(() => {
    if (!resp) return [];
    return buildIncongruenceLog({
      parsedLong: parsed.long,
      backendTargetSizeInches: resp?.sec?.targetSizeInches,
      poibInches,
      backendDial: resp?.dial,
    });
  }, [resp, parsed.long, poibInches]);

  const hasIncongruence = incongruenceLog.length > 0;

  const styles = {
    page: {
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      padding: 16,
      maxWidth: 1400,
      margin: "0 auto",
    },
    title: { fontSize: 42, fontWeight: 800, margin: "8px 0 6px" },
    label: { fontWeight: 700, marginTop: 10 },
    input: {
      width: "100%",
      padding: "10px 12px",
      border: "2px solid #111",
      borderRadius: 10,
      fontSize: 16,
      boxSizing: "border-box",
    },
    row: { display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
    colLeft: { flex: "1 1 420px", minWidth: 360 },
    colRight: { flex: "1 1 520px", minWidth: 360 },
    card: {
      border: "3px solid #111",
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
    },
    btn: {
      width: "100%",
      padding: "14px 14px",
      borderRadius: 12,
      border: "3px solid #1f4ed8",
      background: busy ? "#e8efff" : "#ffffff",
      fontSize: 18,
      fontWeight: 800,
      cursor: busy ? "not-allowed" : "pointer",
      marginTop: 14,
    },
    okBox: {
      border: "3px solid #2a8a3a",
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
    },
    badBox: {
      border: "3px solid #b32020",
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
      background: "#fff6f6",
    },
    mono: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    },
    previewWrap: {
      border: "3px solid #111",
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
    },
    previewImg: {
      width: "100%",
      height: "auto",
      border: "3px solid #111",
      borderRadius: 10,
      display: "block",
      background: "#fff",
    },
    small: { fontSize: 13, opacity: 0.8, marginTop: 6 },
    checkboxRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  };

  return (
    <div style={styles.page}>
      <div style={styles.title}>SCZN3 SEC — Upload Test</div>

      <div style={{ marginTop: 8 }}>
        <div style={styles.label}>Endpoint</div>
        <input
          style={styles.input}
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={DEFAULT_ENDPOINT}
        />
        <div style={styles.small}>POST multipart field: <b>image</b></div>
      </div>

      <div style={styles.row}>
        {/* LEFT */}
        <div style={styles.colLeft}>
          <div style={styles.card}>
            <div style={styles.label}>Choose file</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ marginTop: 8 }}
            />
            <div style={styles.small}>{file ? file.name : "No file selected."}</div>

            <div style={styles.label}>Target Size</div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <select
                style={{ ...styles.input, width: 150 }}
                value={targetPreset}
                onChange={(e) => {
                  const v = e.target.value;
                  setTargetPreset(v);
                  setTargetSpec(v);
                }}
              >
                <option value="8.5x11">8.5x11</option>
                <option value="11">11</option>
                <option value="23">23</option>
              </select>

              <input
                style={styles.input}
                value={targetSpec}
                onChange={(e) => setTargetSpec(e.target.value)}
                placeholder="8.5x11"
              />
            </div>

            <div style={styles.small}>
              Parsed:{" "}
              {parsed.ok ? (
                <>
                  spec=<b>{parsed.spec}</b> &nbsp; long=<b>{toFixed2(parsed.long)}</b>
                  {parsed.short ? <> &nbsp; short=<b>{toFixed2(parsed.short)}</b></> : null}
                </>
              ) : (
                <>
                  <b>INVALID</b> ({parsed.reason})
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>Distance (yards)</div>
                <input
                  style={styles.input}
                  value={distanceYards}
                  onChange={(e) => setDistanceYards(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>Click Value (MOA)</div>
                <input
                  style={styles.input}
                  value={clickValueMoa}
                  onChange={(e) => setClickValueMoa(e.target.value)}
                  placeholder="0.25"
                />
              </div>
            </div>

            <button style={styles.btn} disabled={busy} onClick={onSend}>
              {busy ? "Sending..." : "Send (with Congruence Gate)"}
            </button>

            {err ? (
              <div style={{ ...styles.badBox, marginTop: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
                <div style={styles.mono}>{err}</div>
              </div>
            ) : null}

            {resp ? (
              <>
                <div style={styles.okBox}>
                  <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>
                    Scope Clicks (Minimal)
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    Windage:{" "}
                    <span style={{ fontWeight: 900 }}>
                      {minimal?.windage || "—"}
                    </span>
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                    Elevation:{" "}
                    <span style={{ fontWeight: 900 }}>
                      {minimal?.elevation || "—"}
                    </span>
                  </div>

                  <div style={{ marginTop: 12, ...styles.mono }}>
                    clicksSigned: w={toFixed2(clicksSigned?.windage)}, e={toFixed2(clicksSigned?.elevation)}{" "}
                    POIB inches: x={toFixed2(poibInches?.x)}, y={toFixed2(poibInches?.y)}{"\n"}
                    computeStatus: {resp?.computeStatus || "—"}{" "}
                    backend sec.targetSizeInches: {toFixed2(resp?.sec?.targetSizeInches)}
                  </div>

                  <div style={styles.checkboxRow}>
                    <input
                      id="showraw"
                      type="checkbox"
                      checked={showRaw}
                      onChange={(e) => setShowRaw(e.target.checked)}
                    />
                    <label htmlFor="showraw" style={{ fontWeight: 800 }}>
                      Show raw JSON
                    </label>
                  </div>
                </div>

                {hasIncongruence ? (
                  <div style={styles.badBox}>
                    <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10 }}>
                      Incongruence Log
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>
                      This result was received, but one or more variables are not congruent.
                      Do not trust the output until fixed.
                    </div>
                    {incongruenceLog.map((item, idx) => (
                      <div key={idx} style={{ ...styles.card, borderColor: "#b32020", marginTop: 10 }}>
                        <div style={{ fontWeight: 900 }}>{item.code}</div>
                        <div style={styles.mono}>{JSON.stringify(item, null, 2)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* RIGHT */}
        <div style={styles.colRight}>
          <div style={styles.previewWrap}>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Preview</div>

            <div style={styles.checkboxRow}>
              <input
                id="showraw2"
                type="checkbox"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
              />
              <label htmlFor="showraw2" style={{ fontWeight: 800 }}>
                Show raw JSON
              </label>
            </div>

            {previewUrl ? <img alt="preview" src={previewUrl} style={styles.previewImg} /> : <div style={styles.small}>Choose an image to preview.</div>}

            {showRaw && resp ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Response</div>
                <div style={{ ...styles.mono, border: "3px solid #111", borderRadius: 12, padding: 12 }}>
                  {JSON.stringify(resp, null, 2)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

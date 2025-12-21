// HARD-WIRED message for blank / not-enough-holes cases
const NO_SHOTS_MSG =
  "No / not enough bullet holes detected. Shoot 3–7 rounds, then Take or Upload Target Photo.";

// Analyze -> calls backend -> FAILS CLOSED on 422 (no holes)
async function onAnalyze() {
  if (!file) return;

  setError("");
  setNote("");
  setRawBackend?.(null);
  setSec?.(null);
  setSecPngUrl?.("");

  setBusy(true);

  try {
    const url = new URL(SEC_PATH, apiBase).toString();
    const form = new FormData();
    form.append("file", file); // MUST be "file"

    const res = await fetch(url, { method: "POST", body: form });

    // ----- HARD-WIRED FAIL-CLOSED -----
    if (!res.ok) {
      let msg = `Backend error (${res.status}).`;

      // Try to read backend JSON error
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}

      // HARD-WIRE: 422 = no/not enough bullet holes
      if (res.status === 422) msg = NO_SHOTS_MSG;

      setSec(null);
      setSecPngUrl("");
      setError(msg);
      return;
    }

    // Success JSON
    const data = await res.json();
    const nextSec = data?.sec;
    if (!nextSec) throw new Error("No SEC returned from backend.");

    const w = Number(nextSec.windage_clicks ?? 0);
    const e = Number(nextSec.elevation_clicks ?? 0);

    if (!Number.isFinite(w) || !Number.isFinite(e)) {
      throw new Error("SEC values missing/invalid.");
    }

    const newIndex = bumpIndex();

    const next = {
      windage_clicks: w,
      elevation_clicks: e,
      index: newIndex,
    };

    setSec(next);

    const png = makeSecPng({
      windageClicks: next.windage_clicks,
      elevationClicks: next.elevation_clicks,
      index: next.index,
    });

    setSecPngUrl(png);
  } catch (e) {
    setSec(null);
    setSecPngUrl("");
    setError(e?.message || "Analyze failed.");
  } finally {
    setBusy(false);
  }
}

import React, { useEffect, useMemo, useRef, useState } from "react";

/*
  SCZN3 Shooter Experience Card (SEC) — v1 (Simple)
  - Defaults are locked in v1 experience:
      Distance = 100 yards
      MOA per click = 0.25
      Target = 23x23
  - Frontend does NOT ask for yardage in the primary flow.
  - Two file buttons so iPad/iOS doesn’t force camera-only.
  - FAIL CLOSED on no holes (422) and on missing click values.
  - SEC PNG stays clean: Title + Windage + Elevation + Index ONLY.
*/

const DEFAULT_API_BASE = "https://sczn3-sec-backend-144.onrender.com";
const SEC_PATH = "/api/sec";
const INDEX_KEY = "SCZN3_SEC_INDEX";

// ----------------- helpers (LOCK) -----------------

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

// Strict numeric parse:
// - treats "" / " " as NaN (prevents accidental 0)
// - parses number-like strings safely
function toNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function nextIndex() {
  const cur = Number(localStorage.getItem(INDEX_KEY) || "0");
  const nxt = cur + 1;
  localStorage.setItem(INDEX_KEY, String(nxt));
  return String(nxt).padStart(3, "0");
}

function arrowForWindage(w) {
  // LOCK: sign decides arrow (DIAL_TO_CENTER)
  // negative => LEFT, positive => RIGHT
  if (!isNum(w) || w === 0) return "";
  return w < 0 ? "←" : "→";
}

function arrowForElevation(e) {
  // LOCK: sign decides arrow (DIAL_TO_CENTER)
  // negative => DOWN, positive => UP
  if (!isNum(e) || e |oai:code-citation|

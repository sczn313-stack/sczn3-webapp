// ---- Tap capture on overlay (BULL FIRST LOCK) ----
if (tapLayer) {
  const MAX_HOLES = 10; // optional cap

  const onTap = (e) => {
    e.preventDefault();

    if (!thumb || !thumb.naturalWidth) return;

    const pt = clientToNatural(e);
    if (!pt) return;

    const taps = loadTaps();

    // Bull must be first
    if (taps.length === 0) {
      taps.push({ x: pt.x, y: pt.y, kind: "BULL" });
      saveTaps(taps);
      redrawTapLayer();
      return;
    }

    // Then holes
    const holesCount = taps.length - 1;
    if (holesCount >= MAX_HOLES) return;

    taps.push({ x: pt.x, y: pt.y, kind: "HOLE" });
    saveTaps(taps);
    redrawTapLayer();
  };

  tapLayer.addEventListener("click", onTap);
  tapLayer.addEventListener("touchstart", onTap, { passive: false });
}

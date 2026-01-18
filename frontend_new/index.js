// sczn3-webapp/frontend_new/index.js
// iOS-safe Tap-n-Score tap handling (FULL REPLACEMENT)

(() => {
  const imageWrap   = document.getElementById("targetImageWrap");
  const imageEl     = document.getElementById("targetImage");
  const tapsCountEl = document.getElementById("tapsCount");
  const clearBtn    = document.getElementById("clearTapsBtn");

  let taps = [];

  function updateCount() {
    tapsCountEl.textContent = String(taps.length);
  }

  function addMarker(x, y) {
    const dot = document.createElement("div");
    dot.className = "tapDot";
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;
    imageWrap.appendChild(dot);
  }

  function handleTap(clientX, clientY) {
    const rect = imageWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Bounds check
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    taps.push({ x, y });
    addMarker(x, y);
    updateCount();
  }

  function onTouch(e) {
    e.preventDefault(); // CRITICAL for iOS
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
  }

  function onClick(e) {
    handleTap(e.clientX, e.clientY);
  }

  function clearTaps() {
    taps = [];
    updateCount();
    imageWrap.querySelectorAll(".tapDot").forEach(d => d.remove());
  }

  // ===== INIT =====
  function bind() {
    if (!imageWrap) return;

    // Ensure taps go THROUGH
    imageWrap.style.pointerEvents = "auto";
    imageWrap.style.touchAction   = "none";

    imageWrap.addEventListener("touchstart", onTouch, { passive: false });
    imageWrap.addEventListener("click", onClick);

    if (clearBtn) clearBtn.addEventListener("click", clearTaps);

    updateCount();
  }

  window.addEventListener("load", bind);
})();

<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#000000" />
  <title>Tap-n-Score™</title>
  <link rel="stylesheet" href="./styles.css?v=20260119_uploadfix1" />
</head>

<body>
  <main class="page">
    <!-- BRAND -->
    <div class="brandRow" aria-label="Tap-n-Score brand">
      <div class="brand">
        <span class="brandTap">TAP</span><span class="brandN">-N-</span><span class="brandScore">SCORE</span><span class="brandTM">™</span>
      </div>
    </div>

    <!-- UPLOAD HERO (iOS SAFE) -->
    <section class="hero">
      <div class="heroCard">
        <div class="heroTitle">Upload target photo</div>
        <div class="heroSub">Camera • Photo Library • Files</div>

        <!-- IMPORTANT: input is NOT display:none (iOS Safari reliability) -->
        <input
          id="fileInput"
          class="fileInput"
          type="file"
          accept="image/*"
        />
      </div>
    </section>

    <!-- CONTROLS -->
    <section class="controls">
      <div class="ctrl">
        <div class="ctrlLabel">Distance</div>
        <div class="ctrlRow">
          <input id="distanceYds" class="ctrlInput" type="number" inputmode="numeric" min="1" value="100" />
          <div class="ctrlUnit">yds</div>
        </div>
      </div>

      <div class="ctrlRight">
        <div class="ctrlSmall">
          <div class="ctrlLabel">Taps:</div>
          <div id="tapCount" class="ctrlValue">0</div>
        </div>
        <button id="clearBtn" class="btnSecondary" type="button">Clear</button>
      </div>
    </section>

    <section class="actions">
      <button id="seeResultsBtn" class="btnPrimary" type="button">See results</button>
    </section>

    <!-- PREVIEW / TAP AREA -->
    <section class="card">
      <div id="instructionLine" class="cardTitle">Add a photo to begin.</div>

      <div id="previewWrap" class="previewWrap" aria-label="Target preview">
        <img id="previewImg" class="previewImg" alt="Target preview" />
        <canvas id="tapCanvas" class="tapCanvas"></canvas>
      </div>
    </section>

    <section class="card">
      <div class="cardTitle">Vendor link (optional)</div>
      <input id="vendorLink" class="vendorInput" type="url" placeholder="Paste vendor buy link here" />
    </section>

    <section class="card">
      <div class="cardTitle">Results</div>
      <pre id="resultsBox" class="resultsBox">{}</pre>
    </section>

    <footer class="footer">Tap-n-Score™</footer>
  </main>

  <script src="./api.js?v=20260119_uploadfix1"></script>
  <script src="./app.js?v=20260119_uploadfix1"></script>
</body>
</html>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SEC Output</title>
  <link rel="stylesheet" href="./styles.css" />
</head>

<body>
  <div class="pageWrap">

    <h1 class="secTitle">SEC OUTPUT</h1>

    <!-- TARGET PREVIEW -->
    <div class="card">
      <div class="cardHeader">TARGET THUMBNAIL</div>
      <img id="targetPreview" alt="Target preview" style="display:none; max-width:100%; border-radius:10px;" />
      <div id="noPreview" style="margin-top:10px;">No photo loaded</div>
    </div>

    <!-- RESULTS -->
    <div class="card">
      <div class="cardHeader">RESULTS</div>

      <div class="row">
        <div class="label">Distance (yards)</div>
        <div class="value" id="distanceOut">—</div>
      </div>

      <div class="row">
        <div class="label">Score</div>
        <div class="value" id="scoreOut">—</div>
      </div>

      <div class="row">
        <div class="label">Scope</div>
        <div class="value" id="scopeOut">—</div>
      </div>

      <div class="row">
        <div class="label">Clicks</div>
        <div class="value" id="clicksOut">—</div>
      </div>

      <div class="row">
        <div class="label">Tip</div>
        <div class="value" id="tipOut">—</div>
      </div>

      <div id="statusOut" style="margin-top:12px; font-style:italic;"></div>
    </div>

    <!-- ACTIONS -->
    <div class="actions">
      <a class="pillBtn" href="./index.html">UPLOAD ANOTHER PHOTO</a>
      <a class="pillBtn" id="buyMoreBtn" href="#" target="_blank" rel="noopener">BUY MORE TARGETS</a>
    </div>

  </div>

  <script src="./output.js"></script>
</body>
</html>

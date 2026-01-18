<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Tap-n-Score™ — Receipt</title>
  <link rel="stylesheet" href="./styles.css" />
  <style>
    /* Sticky receipt bar */
    .receiptSticky{
      position: sticky;
      bottom: 0;
      margin-top: 14px;
      padding-top: 10px;
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      background: rgba(0,0,0,.35);
      border-top: 1px solid rgba(255,255,255,.10);
      backdrop-filter: blur(10px);
    }
    .receiptStickyInner{
      display:flex;
      gap: 10px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .receiptStickyInner .btnPrimary,
    .receiptStickyInner .btnSecondary{
      flex: 1 1 140px;
      min-width: 140px;
    }
    /* Give content breathing room so it doesn't hide under sticky bar */
    .receiptPadBottom{
      padding-bottom: 80px;
    }
  </style>
</head>
<body>
  <div class="appFender">
    <div class="wrap">
      <div class="card receiptPadBottom">

        <div class="kicker">RECEIPT</div>
        <div class="title">Receipt</div>
        <div class="sub" id="miniStatus">Add setup details, then Save or Export.</div>

        <div id="previewBox" style="margin-top:14px;"></div>

        <div class="hr" style="margin:14px 0; border-top:1px solid rgba(255,255,255,.10)"></div>

        <div class="vendorRow">
          <a id="buyMoreBtn" class="btnGhost" href="#" target="_blank" rel="noopener" style="display:none;">Buy more targets</a>
        </div>

        <div style="margin-top:14px;">
          <div class="vendorLabel">Scope (optional)</div>
          <input id="scopeInput" class="vendorInput" placeholder="e.g., Vortex Razor 1-10" />
        </div>

        <div style="margin-top:10px;">
          <div class="vendorLabel">Ammo (optional)</div>
          <input id="ammoInput" class="vendorInput" placeholder="e.g., 77gr OTM" />
        </div>

        <div style="margin-top:10px;">
          <div class="vendorLabel">Gun (optional)</div>
          <input id="gunInput" class="vendorInput" placeholder="e.g., 16&quot; SPR / AR-15" />
        </div>

        <div style="margin-top:10px;">
          <div class="vendorLabel">Distance (yds)</div>
          <input id="yardsInput" class="vendorInput" inputmode="numeric" pattern="[0-9]*" />
        </div>

        <div style="margin-top:10px;">
          <div class="vendorLabel">Notes (optional)</div>
          <input id="notesInput" class="vendorInput" placeholder="Anything you want to remember..." />
        </div>

        <!-- Sticky bar -->
        <div class="receiptSticky">
          <div class="receiptStickyInner">
            <button id="backBtn" class="btnSecondary" type="button">Back</button>
            <button id="savedBtn" class="btnSecondary" type="button">Saved</button>
            <button id="exportBtn" class="btnSecondary" type="button">Export</button>
            <button id="saveBtn" class="btnPrimary" type="button">Save</button>
          </div>
        </div>

        <div class="bottomMark">Tap-n-Score™</div>
      </div>
    </div>
  </div>

  <script src="./receipt.js"></script>
</body>
</html>

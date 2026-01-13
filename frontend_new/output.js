(function(){
  const secIdEl = document.getElementById("secId");
  const outThumbImg = document.getElementById("outThumbImg");
  const outThumbEmpty = document.getElementById("outThumbEmpty");
  const outError = document.getElementById("outError");
  const buyBtn2 = document.getElementById("buyBtn2");

  // Robust parsing (prevents: "The string did not match the expected pattern.")
  // That error usually happens when code tries: new URL(badString) or decode on null.
  try{
    const url = new URL(window.location.href);
    const idFromQuery = url.searchParams.get("id");

    const idFromStorage = sessionStorage.getItem("secId");
    const thumbFromStorage = sessionStorage.getItem("secThumb");

    const secId = idFromQuery || idFromStorage || "---";
    secIdEl.textContent = `SEC-ID ${pad3(secId)}`;

    if (thumbFromStorage){
      outThumbImg.src = thumbFromStorage;
      outThumbImg.style.display = "block";
      outThumbEmpty.style.display = "none";
    } else {
      outThumbImg.style.display = "none";
      outThumbEmpty.style.display = "flex";
    }

    outError.textContent = ""; // clear
  } catch (e){
    console.error(e);
    outError.textContent = "Output page loaded, but URL parsing failed. (Fixed by this file version.)";
  }

  buyBtn2?.addEventListener("click", () => {
    alert("Buy More Targets (placeholder)");
  });

  function pad3(x){
    const s = String(x).replace(/\D/g, "") || "0";
    return s.padStart(3, "0").slice(-3);
  }
})();

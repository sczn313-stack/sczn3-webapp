(function(){
  const fileInput = document.getElementById("fileInput");
  const distanceInput = document.getElementById("distanceInput");
  const thumbImg = document.getElementById("thumbImg");
  const thumbEmpty = document.getElementById("thumbEmpty");
  const generateBtn = document.getElementById("generateBtn");
  const pressToSee = document.getElementById("pressToSee");
  const buyBtn = document.getElementById("buyBtn");

  let selectedFile = null;
  let thumbDataUrl = null;
  let lastSecId = null;

  function setThumb(dataUrl){
    thumbDataUrl = dataUrl || null;
    if (thumbDataUrl){
      thumbImg.src = thumbDataUrl;
      thumbImg.style.display = "block";
      thumbEmpty.style.display = "none";
      generateBtn.disabled = false;
    } else {
      thumbImg.removeAttribute("src");
      thumbImg.style.display = "none";
      thumbEmpty.style.display = "flex";
      generateBtn.disabled = true;
    }
  }

  async function handleFile(file){
    selectedFile = file || null;
    if (!selectedFile){
      setThumb(null);
      window.SEC_APP?.setStatus("");
      return;
    }

    // Show thumbnail immediately
    const dataUrl = await fileToDataUrl(selectedFile);
    setThumb(dataUrl);
    window.SEC_APP?.setStatus("Photo loaded. Ready to generate SEC.");
  }

  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    handleFile(file);
  });

  generateBtn?.addEventListener("click", async () => {
    try{
      if (!selectedFile) return;

      const distanceYards = parseInt(distanceInput.value || "100", 10) || 100;
      window.SEC_APP?.setStatus("Generating SEC...");

      const res = await window.SEC_API.analyzeTarget({ file: selectedFile, distanceYards });
      lastSecId = res.secId;

      // Store for output page
      sessionStorage.setItem("secId", res.secId);
      sessionStorage.setItem("secDistance", String(distanceYards));
      sessionStorage.setItem("secThumb", res.thumbDataUrl || thumbDataUrl || "");

      // Make PRESS TO SEE go to the output with an id (safe)
      pressToSee.href = `output.html?id=${encodeURIComponent(res.secId)}`;

      window.SEC_APP?.setStatus(`SEC generated: ${res.secId}. Tap PRESS TO SEE.`);
    } catch(err){
      console.error(err);
      window.SEC_APP?.setStatus("Error generating SEC. Check console.");
    }
  });

  pressToSee?.addEventListener("click", () => {
    // if user clicks before generate, still allow output to load without crashing
    if (!pressToSee.href || pressToSee.href.endsWith("output.html")){
      pressToSee.href = "output.html";
    }
  });

  buyBtn?.addEventListener("click", () => {
    alert("Buy More Targets (placeholder)");
  });

  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
})();

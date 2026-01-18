const addPhotoBtn = document.getElementById("addPhotoBtn");
const photoInput  = document.getElementById("photoInput");

const targetImage = document.getElementById("targetImage");       // <img>
const imageWrap   = document.getElementById("targetImageWrap");   // wrapper div

function setStatus(msg){
  const el = document.getElementById("statusLine");
  if (el) el.textContent = msg;
}

function clearPreview(){
  if (targetImage) targetImage.src = "";
  if (imageWrap) imageWrap.style.display = "none";
}

function showPreview(dataUrl){
  if (!targetImage) return;
  targetImage.src = dataUrl;
  if (imageWrap) imageWrap.style.display = "block";
}

if (addPhotoBtn && photoInput){
  const openPicker = () => photoInput.click();

  addPhotoBtn.addEventListener("click", openPicker);
  addPhotoBtn.addEventListener("touchstart", openPicker, { passive: true });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file){
      setStatus("No photo selected.");
      clearPreview();
      return;
    }

    if (!file.type || !file.type.startsWith("image/")){
      setStatus("That file is not an image.");
      clearPreview();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      showPreview(String(reader.result || ""));
      setStatus("Photo loaded. Tap bullet holes.");
    };
    reader.onerror = () => {
      setStatus("Could not read that photo.");
      clearPreview();
    };
    reader.readAsDataURL(file);
  });
}

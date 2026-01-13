const fileInput = document.getElementById("targetPhoto");
const thumb = document.getElementById("thumb");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    thumb.src = e.target.result;
    thumb.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// api.js (frontend_new)
// If you later wire a backend, put your fetch calls here.

window.SEC_API = {
  async analyzeTarget({ file, distanceYards }) {
    // Placeholder stub: returns a fake SEC id and thumbnail
    // Replace with real backend call when ready.
    const id = String(Math.floor(Math.random() * 900) + 100);
    return {
      secId: id,
      distanceYards,
      thumbDataUrl: await fileToDataUrl(file)
    };
  }
};

function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

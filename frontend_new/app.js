// app.js (frontend_new)
// Shared helpers used by both pages

window.SEC_APP = {
  setStatus(msg){
    const el = document.getElementById("status");
    if (el) el.textContent = msg || "";
  },
  qs(name){
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  }
};

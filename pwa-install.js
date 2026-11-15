(() => {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(error => console.info("DIPVTC offline screen is unavailable", error));
  const button = document.getElementById("installAppButton");
  const help = document.getElementById("installAppHelp");
  if (!button) return;
  const installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (installed) { button.hidden = true; return; }
  let installPrompt = null;
  button.hidden = false;
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; button.textContent = "Install DIPVTC app"; });
  button.addEventListener("click", async () => {
    if (!installPrompt) {
      if (help) { help.hidden = false; help.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "On iPhone or iPad, open the Share menu in Safari and choose Add to Home Screen." : "In Chrome, open the menu ⋮ and choose Install app or Add to Home screen."; }
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
  });
  window.addEventListener("appinstalled", () => { button.hidden = true; if (help) { help.hidden = false; help.textContent = "DIPVTC Family Portal is installed on this device."; } });
})();
(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .catch(error => console.info("DIPVTC offline screen is unavailable", error));
  }

  // Keep the install prompt on public pages only.
  if (window.__DIPVTC_USER__) return;

  const installButton = document.getElementById("installAppButton");
  const installHelp = document.getElementById("installAppHelp");
  const requestedTarget = new URLSearchParams(location.search).get("next") || "";
  const managementKind = requestedTarget === "/staff.html" ? "staff" : ["/admin.html", "/owner.html"].includes(requestedTarget) ? "admin" : "";
  const appName = managementKind === "staff" ? "DIPVTC Staff" : managementKind === "admin" ? "DIPVTC Admin" : "DIPVTC Family";
  const installedKey = `dipvtc_pwa_installed_${managementKind || "family"}`;
  const noticeSessionKey = `dipvtc_install_notice_seen_${managementKind || "family"}`;
  const installedMode = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const installedBefore = (() => { try { return localStorage.getItem(installedKey) === "1" || (!managementKind && localStorage.getItem("dipvtc_pwa_installed") === "1"); } catch { return false; } })();
  if (installedMode || installedBefore) {
    if (installButton) installButton.hidden = true;
    return;
  }

  let deferredPrompt = null;
  let modal;
  let details;
  let modalInstallButton;
  let instructionsShown = false;

  function helpText() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "In Safari, tap Share, then choose Add to Home Screen.";
    if (/Android/i.test(ua)) return "Open your browser menu and choose Install app or Add to Home screen.";
    return "Use your browser menu and choose Install DIPVTC or Install app. You can also install from the icon at the end of the address bar.";
  }

  function closeModal() {
    if (modal) modal.hidden = true;
  }

  function openModal() {
    if (!modal) createModal();
    instructionsShown = false;
    modal.hidden = false;
    updateInstallState();
    modalInstallButton.focus();
  }

  function updateInstallState() {
    if (!modal) return;
    if (deferredPrompt) {
      details.textContent = `Install the ${appName} app for faster access to its sign-in and dashboard.`;
      modalInstallButton.textContent = "Install app";
    } else {
      details.textContent = `${helpText()} Installing adds a shortcut to your device; you can keep using the website if you choose to do it later.`;
      modalInstallButton.textContent = "Show install steps";
    }
  }

  function createModal() {
    const style = document.createElement("style");
    style.textContent = `
      .dipvtc-install-backdrop{position:fixed;inset:0;z-index:99998;display:grid;place-items:center;padding:18px;background:rgba(5,16,34,.62)}
      .dipvtc-install-backdrop[hidden]{display:none}
      .dipvtc-install-dialog{position:relative;width:min(440px,100%);padding:26px 24px 22px;border:1px solid #dce5f0;border-radius:20px;background:#fff;color:#10213d;box-shadow:0 24px 80px rgba(0,0,0,.3);font:14px Montserrat,Arial,sans-serif}
      .dipvtc-install-dialog h2{margin:0 36px 9px 0;color:#0a1931;font-size:20px;font-weight:900;line-height:1.3}
      .dipvtc-install-dialog p{margin:0;color:#58677c;line-height:1.65}
      .dipvtc-install-close{position:absolute;top:12px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f1f5f9;color:#0a1931;font-size:22px;line-height:1;cursor:pointer}
      .dipvtc-install-actions{display:flex;gap:10px;margin-top:20px}
      .dipvtc-install-actions button{flex:1;min-height:44px;border:1px solid #d6deea;border-radius:10px;padding:10px 12px;font:800 12px Montserrat,Arial,sans-serif;cursor:pointer}
      .dipvtc-install-primary{background:#0a1931;color:#fff;border-color:#0a1931!important}
      .dipvtc-install-later{background:#fff;color:#263b59}
      .dipvtc-install-note{margin-top:13px!important;font-size:11px;color:#7b8798!important}
      @media(prefers-reduced-motion:no-preference){.dipvtc-install-dialog{animation:dipvtc-install-pop .18s ease-out}@keyframes dipvtc-install-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}}
    `;
    document.head.append(style);
    modal = document.createElement("div");
    modal.className = "dipvtc-install-backdrop";
    modal.hidden = true;
    modal.innerHTML = `<section class="dipvtc-install-dialog" role="dialog" aria-modal="true" aria-labelledby="dipvtcInstallTitle" aria-describedby="dipvtcInstallDetails"><button type="button" class="dipvtc-install-close" aria-label="Close install notice">×</button><h2 id="dipvtcInstallTitle">Install ${appName}</h2><p id="dipvtcInstallDetails"></p><div class="dipvtc-install-actions"><button type="button" class="dipvtc-install-primary">Install app</button><button type="button" class="dipvtc-install-later">Maybe later</button></div><p class="dipvtc-install-note">You can continue using the website without installing.</p></section>`;
    document.body.append(modal);
    details = modal.querySelector("#dipvtcInstallDetails");
    modalInstallButton = modal.querySelector(".dipvtc-install-primary");
    modal.querySelector(".dipvtc-install-close").addEventListener("click", closeModal);
    modal.querySelector(".dipvtc-install-later").addEventListener("click", closeModal);
    modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });
    modalInstallButton.addEventListener("click", installOrExplain);
    updateInstallState();
  }

  async function installOrExplain() {
    if (!deferredPrompt) {
      if (instructionsShown) { closeModal(); return; }
      instructionsShown = true;
      details.textContent = helpText();
      if (installHelp) { installHelp.hidden = false; installHelp.textContent = helpText(); }
      modalInstallButton.textContent = "Got it";
      return;
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    updateInstallState();
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") {
        try { localStorage.setItem(installedKey, "1"); } catch { /* Installed-mode detection still works. */ }
        closeModal();
        if (installButton) installButton.hidden = true;
      } else {
        details.textContent = "No problem. You can install the app later from your browser menu.";
      }
    } catch {
      details.textContent = helpText();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallState();
  });

  window.addEventListener("appinstalled", () => {
    try { localStorage.setItem(installedKey, "1"); } catch { /* Standalone detection still works. */ }
    closeModal();
    if (installButton) installButton.hidden = true;
    if (installHelp) { installHelp.hidden = false; installHelp.textContent = `${appName} is installed on this device.`; }
  });

  if (installButton) {
    installButton.hidden = false;
    installButton.textContent = `Install ${appName}`;
    installButton.addEventListener("click", openModal);
  }

  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(noticeSessionKey) === "1"; } catch { /* Show the notice if storage is unavailable. */ }
  if (!alreadyShown) {
    try { sessionStorage.setItem(noticeSessionKey, "1"); } catch { /* The notice can still be dismissed for this page. */ }
    window.setTimeout(openModal, 700);
  }
})();

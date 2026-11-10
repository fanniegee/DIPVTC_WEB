(() => {
  const state = { ...(window.__DIPVTC_STATE__ || {}) };
  const pending = new Map();
  let timer = 0;
  let failed = false;
  const storage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(state, String(key)) ? state[String(key)] : null; },
    setItem(key, value) { state[String(key)] = String(value); queue(String(key), String(value)); },
    removeItem(key) { delete state[String(key)]; queue(String(key), null); },
    key(index) { return Object.keys(state)[index] ?? null; },
    flush() { clearTimeout(timer); return flush(); },
    get length() { return Object.keys(state).length; }
  };
  window.dipvtcStore = storage;
  window.DIPVTC_SERVER_STORAGE = true;

  function queue(key, value) {
    pending.set(key, value);
    clearTimeout(timer);
    timer = setTimeout(flush, 120);
  }
  async function flush(keepalive = false) {
    if (!pending.size) return true;
    const batch = Object.fromEntries(pending);
    try {
      const response = await fetch("/api/state/batch", {
        method: "PUT", credentials: "same-origin", keepalive,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: batch })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      for (const key of Object.keys(batch)) if (pending.get(key) === batch[key]) pending.delete(key);
      if (pending.size) timer = setTimeout(flush, 120);
      if (failed) { failed = false; showStatus("Changes saved to the server.", false); }
      return true;
    } catch {
      failed = true;
      showStatus("Could not save changes to the server. Keep this page open and try again.", true);
      timer = setTimeout(flush, 1500);
      return false;
    }
  }
  function showStatus(message, isError) {
    let el = document.getElementById("server-save-status");
    if (!el) { el = document.createElement("div"); el.id = "server-save-status"; el.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9999;padding:9px 13px;border-radius:8px;background:#fff;box-shadow:0 2px 12px #0002;font:12px Montserrat,Arial,sans-serif"; document.body.appendChild(el); }
    el.textContent = message; el.style.color = isError ? "#a12626" : "#176b43";
    clearTimeout(el._hideTimer); if (!isError) el._hideTimer = setTimeout(() => el.remove(), 2400);
  }
  addEventListener("pagehide", () => { if (pending.size) flush(true); });
})();

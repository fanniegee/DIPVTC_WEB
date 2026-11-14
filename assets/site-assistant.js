(() => {
  const launcher = document.getElementById('dipvtc-assistant-launcher');
  const panel = document.getElementById('dipvtc-assistant-panel');
  const close = document.getElementById('dipvtc-assistant-close');
  const form = document.getElementById('dipvtc-assistant-form');
  const input = document.getElementById('dipvtc-assistant-input');
  const messagesNode = document.getElementById('dipvtc-assistant-messages');
  const send = document.getElementById('dipvtc-assistant-send');
  const whatsappLink = document.getElementById('dipvtc-assistant-whatsapp');
  const history = [];
  async function loadWhatsAppSupport() {
    if (!whatsappLink) return;
    try {
      const response = await fetch('/api/public/site-content', { cache: 'no-store' });
      if (!response.ok) return;
      const state = (await response.json()).state || {};
      const raw = String(state.dipvtc_site_whatsapp || '').trim();
      if (!raw) return;
      let url;
      if (/^https?:\/\//i.test(raw)) url = new URL(raw);
      else if (/^(?:wa\.me|(?:www\.)?(?:whatsapp\.com|api\.whatsapp\.com))(?:\/|$)/i.test(raw)) url = new URL(`https://${raw}`);
      else {
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 8 || digits.length > 15) return;
        url = new URL(`https://wa.me/${digits}`);
      }
      if (url.protocol !== 'https:' || !['wa.me', 'www.whatsapp.com', 'whatsapp.com', 'api.whatsapp.com'].includes(url.hostname.toLowerCase())) return;
      whatsappLink.href = url.href;
      whatsappLink.hidden = false;
    } catch {}
  }
  loadWhatsAppSupport();
  let busy = false;

  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `dipvtc-assistant-message ${role}`;
    bubble.textContent = text;
    messagesNode.appendChild(bubble);
    messagesNode.scrollTop = messagesNode.scrollHeight;
  }
  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    addMessage('user', text);
    input.value = '';
    busy = true;
    send.disabled = true;
    const pending = document.createElement('div');
    pending.className = 'dipvtc-assistant-message assistant';
    pending.textContent = 'Checking the school’s published information…';
    messagesNode.appendChild(pending);
    messagesNode.scrollTop = messagesNode.scrollHeight;
    try {
      const response = await fetch('/api/public/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history.slice(-6), { role: 'user', content: text }] })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The assistant is temporarily unavailable. Please contact the school.');
      const answer = String(result.answer || 'I could not find that in the published school information. Please contact the office for help.');
      pending.textContent = answer;
      history.push({ role: 'user', content: text }, { role: 'assistant', content: answer });
      if (history.length > 6) history.splice(0, history.length - 6);
    } catch (error) {
      pending.textContent = error.message || 'The assistant is temporarily unavailable. Please contact the school.';
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  });
})();

(() => {
  const launcher = document.getElementById('dipvtc-assistant-launcher');
  const panel = document.getElementById('dipvtc-assistant-panel');
  const close = document.getElementById('dipvtc-assistant-close');
  const form = document.getElementById('dipvtc-assistant-form');
  const input = document.getElementById('dipvtc-assistant-input');
  const messagesNode = document.getElementById('dipvtc-assistant-messages');
  const send = document.getElementById('dipvtc-assistant-send');
  const whatsappLink = document.getElementById('dipvtc-assistant-whatsapp');
  const directionsLink = document.getElementById('dipvtc-assistant-directions');
  const history = [];
  let approvedDirectionsHref = '';
  async function loadWhatsAppSupport() {
    if (!whatsappLink && !directionsLink) return;
    try {
      const response = await fetch('/api/public/site-content', { cache: 'no-store' });
      if (!response.ok) return;
      const state = (await response.json()).state || {};
      const raw = String(state.dipvtc_site_whatsapp || '').trim();
      const address = String(state.dipvtc_site_address || '').trim();
      if (directionsLink && address) {
        directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
        approvedDirectionsHref = directionsLink.href;
        directionsLink.hidden = false;
      }
      if (!whatsappLink || !raw) return;
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
    if (role === 'assistant') renderAssistantAnswer(bubble, text);
    else bubble.textContent = text;
    messagesNode.appendChild(bubble);
    messagesNode.scrollTop = messagesNode.scrollHeight;
  }
  function renderAssistantAnswer(node, answer) {
    const cleaned = String(answer || '')
      .replace(/(?:please\s+)?(?:visit|open|go to|contact the school at)\s+(?:https?:\/\/[^\s/]+)?\/?contact\.html\b/gi, 'use the Contact the school button above')
      .replace(/(?:https?:\/\/[^\s/]+)?\/?contact\.html\b/gi, 'use the Contact the school button above');
    const mapUrl = /https:\/\/(?:www\.)?google\.com\/maps\/dir\/[^\s<>"']+/gi;
    let cursor = 0;
    let match;
    while ((match = mapUrl.exec(cleaned))) {
      let raw = match[0];
      let trailing = '';
      while (/[.,;!?)]$/.test(raw)) { trailing = raw.slice(-1) + trailing; raw = raw.slice(0, -1); }
      node.append(document.createTextNode(cleaned.slice(cursor, match.index)));
      if (approvedDirectionsHref && /^https:\/\/(?:www\.)?google\.com\/maps\/dir\//i.test(raw)) {
        const link = document.createElement('a');
        link.href = approvedDirectionsHref;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open Google Maps directions';
        node.append(link);
      } else node.append(document.createTextNode('Please use the Contact the school button above to confirm the address.'));
      if (trailing) node.append(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }
    node.append(document.createTextNode(cleaned.slice(cursor)));
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
      renderAssistantAnswer(pending, answer);
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

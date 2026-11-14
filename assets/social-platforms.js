(async () => {
  const storage = window.dipvtcStore || localStorage;
  let sharedState = {};
  try {
    const response = await fetch('/api/public/site-content', { cache: 'no-store' });
    if (response.ok) sharedState = (await response.json()).state || {};
  } catch {}
  const read = key => {
    if (Object.prototype.hasOwnProperty.call(sharedState, key)) {
      const value = sharedState[key];
      return typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
    }
    try { return storage.getItem(key) || ''; } catch { return ''; }
  };
  const platforms = [
    { name: 'Facebook', key: 'dipvtc_site_facebook', mark: 'f', host: 'facebook.com', domains: ['facebook.com', 'www.facebook.com', 'm.facebook.com'] },
    { name: 'WhatsApp', key: 'dipvtc_site_whatsapp', mark: '◉', host: 'wa.me', domains: ['wa.me', 'www.whatsapp.com', 'whatsapp.com', 'api.whatsapp.com'], chat: true },
    { name: 'Instagram', key: 'dipvtc_site_instagram', mark: '◎', host: 'instagram.com', domains: ['instagram.com', 'www.instagram.com'] },
    { name: 'TikTok', key: 'dipvtc_site_tiktok', mark: '♪', host: 'tiktok.com', domains: ['tiktok.com', 'www.tiktok.com'] },
    { name: 'YouTube', key: 'dipvtc_site_youtube', mark: '▶', host: 'youtube.com', domains: ['youtube.com', 'www.youtube.com', 'youtu.be'] },
    { name: 'X (Twitter)', key: 'dipvtc_site_x', mark: '𝕏', host: 'x.com', domains: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'] },
    { name: 'LinkedIn', key: 'dipvtc_site_linkedin', mark: 'in', host: 'linkedin.com/company', domains: ['linkedin.com', 'www.linkedin.com'] },
    { name: 'Telegram', key: 'dipvtc_site_telegram', mark: '➤', host: 't.me', domains: ['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'] },
    { name: 'Threads', key: 'dipvtc_site_threads', mark: '@', host: 'threads.net', domains: ['threads.net', 'www.threads.net'] },
    { name: 'Pinterest', key: 'dipvtc_site_pinterest', mark: 'P', host: 'pinterest.com', domains: ['pinterest.com', 'www.pinterest.com'] }
  ];

  function profileUrl(platform, value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (platform.chat && !/^https?:\/\//i.test(raw)) {
      const digits = raw.replace(/\D/g, '');
      return digits.length >= 8 ? `https://wa.me/${digits}` : '';
    }
    let candidate = raw;
    if (!/^https?:\/\//i.test(candidate)) {
      const knownDomain = platform.domains.some(domain => candidate.toLowerCase() === domain || candidate.toLowerCase().startsWith(`${domain}/`));
      if (knownDomain) candidate = `https://${candidate}`;
      else {
      let handle = candidate.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
      if (!handle || /\s/.test(handle)) return '';
      if (platform.key === 'dipvtc_site_tiktok' || platform.key === 'dipvtc_site_threads') handle = `@${handle}`;
      candidate = `https://${platform.host}/${handle}`;
      }
    }
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || !platform.domains.includes(url.hostname.toLowerCase())) return '';
      return url.href;
    } catch { return ''; }
  }

  function addText(parent, tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    parent.append(node);
    return node;
  }

  const list = document.getElementById('socialList');
  if (!list) return;
  const style = document.createElement('style');
  style.textContent = `
    .social-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .social-card{display:block;overflow:hidden;padding:0;background:#fff;border:1px solid var(--line);border-radius:19px;box-shadow:0 9px 24px #0a193110}
    .social-top{display:flex;align-items:center;gap:10px;padding:14px;min-width:0}
    .social-top .social-mark{flex:none}.social-top .social-copy{min-width:0;flex:1}
    .social-top .social-copy b{display:block}.social-top .social-copy p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .social-top .action{white-space:nowrap;padding:8px 10px}
    .social-preview{position:relative;height:260px;background:linear-gradient(145deg,#edf1f6,#fff6ee);overflow:hidden}
    .social-preview iframe{display:block;width:100%;height:100%;border:0;background:#fff}
    .social-preview.tiktok-preview{height:470px;overflow:auto;background:#fff}
    .social-preview.tiktok-preview.social-link-preview{background:radial-gradient(ellipse at 18% 18%,#ffffff32,transparent 34%),linear-gradient(140deg,#0a1931,#263f63)}
    .social-preview.tiktok-preview blockquote{margin:0 auto!important}
    .social-preview .preview-loader{display:flex;min-height:100%;padding:24px;align-items:center;justify-content:center;text-align:center}
    .preview-loader-inner{max-width:260px}.preview-loader-inner strong{display:block;color:#ffd0b0;font-size:14px}
    .preview-loader-inner span{display:block;color:#e2e9f2;font-size:10px;margin:7px 0 14px}
    .preview-loader button{border:0;border-radius:999px;background:#ffd0b0;color:#0a1931;padding:10px 15px;font:800 10px Montserrat,Arial,sans-serif;cursor:pointer}
    .preview-loader button:disabled{opacity:.65;cursor:wait}
    .social-link-preview{display:flex;align-items:center;justify-content:center;text-align:center;padding:22px;background:radial-gradient(ellipse at 18% 18%,#ffffff32,transparent 34%),linear-gradient(140deg,#0a1931,#263f63)}
    .social-link-preview>div{max-width:260px}.social-link-preview .preview-brand{width:48px;height:48px;margin:0 auto 12px;border:1px solid #ffd0b0a0;border-radius:16px;background:#ffffff12;color:#ffd0b0;display:grid;place-items:center;font-size:21px;font-weight:900}
    .social-link-preview strong{display:block;color:#ffd0b0;font-size:14px}.social-link-preview span{display:block;color:#e2e9f2;font-size:10px;margin-top:6px}
    .preview-note{padding:8px 12px;background:#f7f8fa;color:#718096;font-size:9px;line-height:1.5}
    .wa-preview{height:260px;display:flex;align-items:center;justify-content:center;text-align:center;padding:22px;background:radial-gradient(ellipse at 18% 18%,#ffffff32,transparent 34%),linear-gradient(140deg,#0a1931,#263f63)}
    .wa-preview strong{display:block;color:#ffd0b0;font-size:14px}.wa-preview span{display:block;margin-top:5px;color:#e2e9f2;font-size:10px}
    @media(max-width:900px){.social-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:700px){.social-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);
  list.replaceChildren();
  let active = 0;
  for (const platform of platforms) {
    const url = profileUrl(platform, read(platform.key));
    if (!url) continue;
    active++;
    const card = document.createElement('article');
    card.className = 'social-card';
    const top = document.createElement('div');
    top.className = 'social-top';
    addText(top, 'div', 'social-mark', platform.mark);
    const copy = document.createElement('div');
    copy.className = 'social-copy';
    addText(copy, 'b', '', platform.name);
    addText(copy, 'p', '', `DIPVTC on ${platform.name}`);
    top.append(copy);
    const open = addText(top, 'a', 'action', 'Open profile');
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    top.append(open);
    card.append(top);

    if (platform.chat) {
      const preview = document.createElement('div');
      preview.className = 'wa-preview';
      const message = document.createElement('div');
      addText(message, 'strong', '', 'Chat with DIPVTC');
      addText(message, 'span', '', 'Open WhatsApp to view the school profile or start a conversation.');
      preview.append(message);
      card.append(preview);
    } else if (platform.key === 'dipvtc_site_facebook') {
      const preview = document.createElement('div');
      preview.className = 'social-preview social-link-preview';
      const loader = createPreviewLoader(platform.mark, 'Load Facebook Page preview', 'Facebook Pages can be previewed with Meta’s Page Plugin.');
      loader.button.addEventListener('click', () => {
        loader.button.disabled = true;
        loader.button.textContent = 'Loading Facebook…';
        const frame = document.createElement('iframe');
        const plugin = new URL('https://www.facebook.com/plugins/page.php');
        plugin.searchParams.set('href', url);
        plugin.searchParams.set('tabs', 'timeline');
        plugin.searchParams.set('width', '500');
        plugin.searchParams.set('height', '260');
        plugin.searchParams.set('adapt_container_width', 'true');
        plugin.searchParams.set('hide_cover', 'false');
        plugin.searchParams.set('show_facepile', 'true');
        frame.src = plugin.href;
        frame.title = 'DIPVTC Facebook Page';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
        preview.classList.remove('social-link-preview');
        preview.replaceChildren(frame);
      });
      preview.append(loader.element);
      card.append(preview);
      addText(card, 'div', 'preview-note', 'If Facebook cannot display the embedded preview, use Open profile to visit the school Page.');
    } else if (platform.key === 'dipvtc_site_instagram') {
      const preview = document.createElement('div');
      preview.className = 'social-preview social-link-preview';
      const loader = createPreviewLoader(platform.mark, 'Load Instagram profile preview', 'Load the school’s public Instagram profile preview.');
      loader.button.addEventListener('click', () => {
        loader.button.disabled = true;
        loader.button.textContent = 'Loading Instagram…';
        const frame = document.createElement('iframe');
        const embedUrl = new URL(url);
        embedUrl.pathname = embedUrl.pathname.replace(/\/?$/, '/embed/');
        frame.src = embedUrl.href;
        frame.title = 'DIPVTC Instagram profile';
        frame.referrerPolicy = 'no-referrer';
        preview.classList.remove('social-link-preview');
        preview.replaceChildren(frame);
      });
      preview.append(loader.element);
      card.append(preview);
      addText(card, 'div', 'preview-note', 'If Instagram does not show the profile preview, use Open profile to visit the school page.');
    } else if (platform.key === 'dipvtc_site_tiktok') {
      const handle = new URL(url).pathname.match(/^\/@([^/]+)/)?.[1];
      if (handle) {
        const preview = document.createElement('div');
        preview.className = 'social-preview tiktok-preview social-link-preview';
        const loader = createPreviewLoader(platform.mark, 'Load TikTok profile preview', 'TikTok’s embed can temporarily return an overload response.');
        loader.button.addEventListener('click', () => {
          loader.button.disabled = true;
          loader.button.textContent = 'Loading TikTok…';
          const quote = document.createElement('blockquote');
          quote.className = 'tiktok-embed';
          quote.setAttribute('cite', url);
          quote.setAttribute('data-unique-id', handle);
          quote.setAttribute('data-embed-type', 'creator');
          quote.style.maxWidth = '720px';
          quote.style.minWidth = '288px';
          const section = document.createElement('section');
          const link = addText(section, 'a', '', `@${handle}`);
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          quote.append(section);
          preview.classList.remove('social-link-preview');
          preview.replaceChildren(quote);
          if (!document.querySelector('script[data-dipvtc-tiktok-embed]')) {
            const embedScript = document.createElement('script');
            embedScript.src = 'https://www.tiktok.com/embed.js';
            embedScript.async = true;
            embedScript.dataset.dipvtcTiktokEmbed = 'true';
            document.body.append(embedScript);
          }
        });
        preview.append(loader.element);
        card.append(preview);
        addText(card, 'div', 'preview-note', 'TikTok only embeds eligible public creator profiles. If it cannot load, use Open profile.');
      } else {
        addPlatformLinkPreview(card, platform);
      }
    } else {
      addPlatformLinkPreview(card, platform);
    }
    list.append(card);
  }

  if (!active) {
    const empty = document.createElement('div');
    empty.className = 'social-empty';
    empty.textContent = 'No school social profiles have been configured yet. Add the official links in Owner → All Site Content.';
    list.append(empty);
  }

  function addPlatformLinkPreview(card, platform) {
    const preview = document.createElement('div');
    preview.className = 'social-preview social-link-preview';
    const message = document.createElement('div');
    addText(message, 'div', 'preview-brand', platform.mark);
    addText(message, 'strong', '', `DIPVTC on ${platform.name}`);
    addText(message, 'span', '', 'Open the school’s live profile to see its latest page and updates.');
    preview.append(message);
    card.append(preview);
  }

  function createPreviewLoader(mark, buttonLabel, messageText) {
    const element = document.createElement('div');
    element.className = 'preview-loader';
    const inner = document.createElement('div');
    inner.className = 'preview-loader-inner';
    addText(inner, 'div', 'preview-brand', mark);
    addText(inner, 'strong', '', 'Live profile preview');
    addText(inner, 'span', '', messageText);
    const button = addText(inner, 'button', '', buttonLabel);
    element.append(inner);
    return { element, button };
  }
})();

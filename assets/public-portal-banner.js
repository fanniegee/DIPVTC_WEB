(() => {
  if (document.querySelector(".dipvtc-public-portal-banner")) return;

  const banner = document.createElement("aside");
  banner.className = "dipvtc-public-portal-banner";
  banner.setAttribute("aria-label", "Parent and student portal access");
  banner.innerHTML = '<strong>Parent &amp; Student Services</strong><span>Students can apply online; parents may help complete the form.</span>';

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/assets/public-portal-banner.css";
  document.head.appendChild(stylesheet);
  document.body.insertBefore(banner, document.body.firstChild);

  const actions = document.createElement("div");
  actions.className = "dipvtc-family-actions";
  actions.innerHTML = '<a class="dipvtc-family-register" href="/family-registration.html">New Family Registration</a><a class="dipvtc-family-login" href="/portal-login.html">Parent / Student Login</a>';

  const heroActions = document.querySelector(".header-hero .hero-cta");
  const heading = document.querySelector("h1");
  const hero = heading?.closest(".hero-inner, .header-hero, .header, .hero") || heading?.parentElement;
  if (heroActions) heroActions.append(actions);
  else if (hero) hero.append(actions);
  else document.body.insertBefore(actions, document.body.children[1] || null);
})();

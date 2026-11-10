(() => {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/assets/public-portal-banner.css";
  document.head.appendChild(stylesheet);

  if (document.querySelector(".dipvtc-family-actions")) return;
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

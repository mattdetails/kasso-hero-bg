/*! Kasso — Locomotive Scroll v5 smooth scrolling (POC) v2
 *  v5 is built on Lenis and drives the real window scroll, so window.scrollY,
 *  position:fixed and IntersectionObserver all keep working — the other
 *  modules on this site depend on all three.
 *
 *  Loads as an ordinary <script defer>. Uses dynamic import() rather than a
 *  static one so a CDN failure is catchable: a top-level import that fails
 *  throws an uncaught promise rejection and takes the page's console with it.
 */
(function () {
  "use strict";

  var CONFIG = {
    src: "https://cdn.jsdelivr.net/npm/locomotive-scroll@5.0.1/+esm",
    lerp: 0.09,            // 0..1, lower is smoother and heavier
    wheelMultiplier: 1,
    touchMultiplier: 1.6,
    smoothWheel: true,
    anchorExtraOffset: 12, // px of breathing room below the fixed navbar
    navSelector: "nav.navbar-floating"
  };

  // Respect the setting before loading anything. Hijacked scrolling is one of
  // the clearest cases for honouring this.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Dynamic import works in classic scripts, so this file needs no
  // type="module" and can be dropped in beside the others.
  var pending;
  try {
    pending = import(CONFIG.src);
  } catch (e) {
    return;                       // no dynamic import support: no smooth scroll
  }

  pending.then(function (mod) {
    var LocomotiveScroll = mod && mod.default;
    if (typeof LocomotiveScroll !== "function") throw new Error("no default export");
    start(LocomotiveScroll);
  }).catch(function (err) {
    // The module graph is two fetches — locomotive-scroll, then lenis. Either
    // can be blocked by an extension, a proxy or a bad network. Degrade to the
    // browser's native scrolling and say so once, rather than leaving an
    // uncaught rejection in the console.
    if (window.console) console.warn("[kx-scroll] smooth scrolling unavailable:", err && err.message ? err.message : err);
  });

  function start(LocomotiveScroll) {
    // Lenis's own stylesheet, inlined — it is 380 bytes and this saves a
    // request. The scroll-behavior override is the important part: this theme
    // sets `scroll-behavior: smooth` on <html>, which fights Lenis and makes
    // anchor jumps stutter as both animations run at once.
    var css =
      "html.lenis,html.lenis body{height:auto}" +
      "html.lenis{scroll-behavior:auto!important}" +
      ".lenis:not(.lenis-autoToggle).lenis-stopped{overflow:clip}" +
      ".lenis [data-lenis-prevent-touch],.lenis [data-lenis-prevent-wheel],.lenis [data-lenis-prevent]{overscroll-behavior:contain}" +
      ".lenis.lenis-smooth iframe{pointer-events:none}" +
      ".lenis.lenis-autoToggle{transition-behavior:allow-discrete;transition-duration:1ms;transition-property:overflow}";

    var style = document.createElement("style");
    style.setAttribute("data-kx-scroll-style", "");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    var scroll;
    try {
      scroll = new LocomotiveScroll({
        lenisOptions: {
          lerp: CONFIG.lerp,
          smoothWheel: CONFIG.smoothWheel,
          wheelMultiplier: CONFIG.wheelMultiplier,
          touchMultiplier: CONFIG.touchMultiplier
        }
      });
    } catch (e) {
      // Construction failed: take the stylesheet back out so the theme's own
      // scroll-behavior is restored rather than left forced to auto.
      style.remove();
      if (window.console) console.warn("[kx-scroll]", e);
      return;
    }

    window.__kxScroll = scroll;   // handy for tuning from the console

    function anchorOffset() {
      var nav = document.querySelector(CONFIG.navSelector);
      var h = nav ? nav.getBoundingClientRect().height : 0;
      return -(h + CONFIG.anchorExtraOffset);
    }

    // This theme writes its in-page links as "/#id", not "#id", so matching on
    // a leading hash would miss every one of them. Compare the resolved path
    // against the current one instead.
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank") return;

      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname !== location.pathname) return;
      if (!url.hash || url.hash === "#") return;

      var target = null;
      try {
        // An id that isn't a valid CSS identifier makes querySelector throw,
        // so getElementById leads and the selector is only a fallback.
        target = document.getElementById(decodeURIComponent(url.hash.slice(1))) ||
                 document.querySelector(url.hash);
      } catch (err) { target = null; }
      if (!target) return;   // let the browser do whatever it would have done

      e.preventDefault();
      try {
        scroll.scrollTo(target, { offset: anchorOffset() });
        if (history.pushState) history.pushState(null, "", url.hash);
      } catch (err) {
        target.scrollIntoView();   // never leave a nav link doing nothing
      }
    }, false);

    // A hash in the URL on arrival lands before layout has settled; re-run it
    // once with the offset applied.
    if (location.hash) {
      window.addEventListener("load", function () {
        var t = null;
        try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { t = null; }
        if (!t) return;
        setTimeout(function () {
          try { scroll.scrollTo(t, { offset: anchorOffset(), immediate: true }); } catch (err) { }
        }, 60);
      }, { once: true });
    }
  }
})();

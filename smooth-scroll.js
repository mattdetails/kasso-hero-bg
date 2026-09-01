/*! Kasso — Locomotive Scroll v5 smooth scrolling (POC) v1
 *  Load as <script type="module">. v5 is built on Lenis and drives the real
 *  window scroll, so window.scrollY, position:fixed and IntersectionObserver
 *  all keep working — the other modules on this site depend on all three.
 */
import LocomotiveScroll from "https://cdn.jsdelivr.net/npm/locomotive-scroll@5.0.1/+esm";

var CONFIG = {
  lerp: 0.09,            // 0..1, lower is smoother and heavier
  wheelMultiplier: 1,
  touchMultiplier: 1.6,
  smoothWheel: true,
  anchorExtraOffset: 12, // px of breathing room below the fixed navbar
  navSelector: "nav.navbar-floating"
};

// Respect the setting before doing anything else. Hijacked scrolling is one
// of the clearest cases for honouring this.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {

  // Lenis's own stylesheet, inlined — it is 380 bytes and this saves a request.
  // The scroll-behavior override is the important part: this theme sets
  // `scroll-behavior: smooth` on <html>, which fights Lenis and produces a
  // stuttering double-animation on anchor jumps.
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

  var scroll = new LocomotiveScroll({
    lenisOptions: {
      lerp: CONFIG.lerp,
      smoothWheel: CONFIG.smoothWheel,
      wheelMultiplier: CONFIG.wheelMultiplier,
      touchMultiplier: CONFIG.touchMultiplier
    }
  });

  window.__kxScroll = scroll;   // handy for tuning from the console

  // The fixed navbar would otherwise cover whatever an anchor lands on.
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
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank") return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname !== location.pathname) return;
    if (!url.hash || url.hash === "#") return;

    var target = document.getElementById(url.hash.slice(1)) ||
                 document.querySelector(url.hash);
    if (!target) return;   // let the browser do whatever it would have done

    e.preventDefault();
    scroll.scrollTo(target, { offset: anchorOffset() });
    if (history.pushState) history.pushState(null, "", url.hash);
  }, false);

  // A hash in the URL on arrival lands before layout has settled; re-run it
  // once with the offset applied.
  if (location.hash) {
    window.addEventListener("load", function () {
      var t = document.getElementById(location.hash.slice(1));
      if (t) setTimeout(function () { scroll.scrollTo(t, { offset: anchorOffset(), immediate: true }); }, 60);
    }, { once: true });
  }
}

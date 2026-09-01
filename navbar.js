/*! Kasso navbar — full width at rest, floating pill on scroll (POC) v2
 *  Inverse of v1: the bar spans the viewport at the top of the page and
 *  contracts to the theme's floating pill once you scroll.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    // Every candidate is styled, since the CSS goes in before the nav is
    // parsed and we cannot yet know which one matches.
    targets: [
      "nav.navbar-floating",
      "[id^='sc-navbar'] nav"
    ],
    contractAt: 40,   // scrollY at or past which it becomes the pill
    expandAt: 12,     // scrollY at or below which it spans full width
    contentWidth: 1024,
    duration: 380
  };

  var PAD_FALLBACK = "20px";

  // The wide state is expressed as "not floating", so the floating state needs
  // no hardcoded values at all — removing the overrides lets the theme's own
  // rules apply. That keeps the pill exactly as designed.
  function styleFor(sel) {
    return (
      sel + ":not(.kx-nav-float){" +
        "top:0!important;left:0!important;right:0!important;" +
        "max-width:100%!important;border-radius:0!important;" +
        "border-top-color:transparent!important;" +
        "border-left-color:transparent!important;" +
        "border-right-color:transparent!important;" +
        "padding-left:max(var(--kx-nav-pad," + PAD_FALLBACK + ")," +
          "calc((100% - " + CONFIG.contentWidth + "px)/2 + var(--kx-nav-pad," + PAD_FALLBACK + ")))!important;" +
        "padding-right:max(var(--kx-nav-pad," + PAD_FALLBACK + ")," +
          "calc((100% - " + CONFIG.contentWidth + "px)/2 + var(--kx-nav-pad," + PAD_FALLBACK + ")))!important;" +
      "}" +
      // Transitions are gated behind .kx-nav-ready so a page restored at a
      // scrolled position doesn't animate the contraction on load.
      sel + ".kx-nav-ready{" +
        "transition:max-width var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "top var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "left var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "right var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "padding var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "border-radius var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "border-color var(--kxd) linear;" +
        "will-change:max-width,padding;" +
      "}"
    );
  }

  // Injected at parse time, before the nav exists, so the very first paint is
  // already full width. Applying this from JS after DOM ready would show the
  // theme's pill for a frame and then snap.
  var css = "";
  for (var i = 0; i < CONFIG.targets.length; i++) css += styleFor(CONFIG.targets[i]);
  css += "@media (prefers-reduced-motion: reduce){" +
           CONFIG.targets.join(",") + "{transition:none!important;}}";

  var style = document.createElement("style");
  style.setAttribute("data-kx-nav-style", "");
  style.textContent = ":root{--kxd:" + CONFIG.duration + "ms}" + css;
  (document.head || document.documentElement).appendChild(style);

  function init() {
    var nav = null;
    for (var i = 0; i < CONFIG.targets.length && !nav; i++) {
      nav = document.querySelector(CONFIG.targets[i]);
    }
    if (!nav || nav.dataset.kxNav) return;

    var pos = getComputedStyle(nav).position;
    if (pos !== "fixed" && pos !== "sticky") { style.remove(); return; }
    nav.dataset.kxNav = "1";

    // Read the theme's own horizontal padding from the floating state, which
    // is the one the wide state has to stay aligned with. Measured with
    // transitions still gated, so nothing animates.
    function refreshPad() {
      var had = nav.classList.contains("kx-nav-float");
      if (!had) nav.classList.add("kx-nav-float");
      var pad = getComputedStyle(nav).paddingLeft;
      if (!had) nav.classList.remove("kx-nav-float");
      nav.style.setProperty("--kx-nav-pad", pad);
    }
    refreshPad();

    var floating = false, ticking = false;

    function apply() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (!floating && y >= CONFIG.contractAt) {
        floating = true;
        nav.classList.add("kx-nav-float");
      } else if (floating && y <= CONFIG.expandAt) {
        floating = false;
        nav.classList.remove("kx-nav-float");
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    apply(); // settle the correct state for a restored scroll position...
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { nav.classList.add("kx-nav-ready"); });
    }); // ...then enable transitions, so that settling was instant

    window.addEventListener("scroll", onScroll, { passive: true });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!floating) refreshPad(); }, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

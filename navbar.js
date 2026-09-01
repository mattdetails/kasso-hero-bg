/*! Kasso navbar — dock to full width on scroll (POC) v1
 *  Expands the floating navbar to the full viewport width once the page is
 *  scrolled, and returns it to the floating pill at the top.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    // First selector that matches wins.
    targets: [
      "nav.navbar-floating",
      "[id^='sc-navbar'] nav"
    ],
    expandAt: 40,     // scrollY at or past which the bar docks
    collapseAt: 12,   // scrollY at or below which it floats again (hysteresis)
    contentWidth: 1024, // keep nav content aligned to this column when docked
    duration: 380     // ms
  };

  function init() {
    var nav = null;
    for (var i = 0; i < CONFIG.targets.length && !nav; i++) {
      nav = document.querySelector(CONFIG.targets[i]);
    }
    if (!nav || nav.dataset.kxNav) return;
    nav.dataset.kxNav = "1";

    var cs = getComputedStyle(nav);
    // Only makes sense for a bar that is already pinned to the viewport.
    if (cs.position !== "fixed" && cs.position !== "sticky") return;

    // The floating state's own values, read rather than assumed, so the
    // collapsed state restores exactly what the theme specified.
    var restTop = cs.top === "auto" ? "0px" : cs.top;

    // The resting horizontal padding is held in a custom property rather than
    // baked into the stylesheet, so a theme that pads differently per
    // breakpoint still docks with its content on the same column.
    function refreshPad() {
      nav.style.setProperty("--kx-nav-pad", getComputedStyle(nav).paddingLeft);
    }
    refreshPad();

    var css =
      "nav[data-kx-nav]{" +
        "transition:max-width var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "top var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "left var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "right var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "padding var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "border-radius var(--kxd) cubic-bezier(.4,0,.2,1)," +
                   "border-color var(--kxd) linear," +
                   "box-shadow var(--kxd) linear;" +
        "will-change:max-width,padding;" +
      "}" +
      "nav[data-kx-nav].kx-nav-docked{" +
        "top:0!important;left:0!important;right:0!important;" +
        "max-width:100%!important;border-radius:0!important;" +
        "border-top-color:transparent!important;" +
        "border-left-color:transparent!important;" +
        "border-right-color:transparent!important;" +
        "padding-left:max(var(--kx-nav-pad),calc((100% - " + CONFIG.contentWidth + "px)/2 + var(--kx-nav-pad)))!important;" +
        "padding-right:max(var(--kx-nav-pad),calc((100% - " + CONFIG.contentWidth + "px)/2 + var(--kx-nav-pad)))!important;" +
        "box-shadow:0 1px 24px rgba(20,10,60,.18)!important;" +
      "}" +
      "@media (prefers-reduced-motion: reduce){" +
        "nav[data-kx-nav]{transition:none!important;}" +
      "}";

    var style = document.createElement("style");
    style.setAttribute("data-kx-nav-style", "");
    style.textContent = ":root{--kxd:" + CONFIG.duration + "ms}" + css;
    document.head.appendChild(style);

    var docked = false, ticking = false;

    function apply() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (!docked && y >= CONFIG.expandAt) {
        docked = true;
        nav.classList.add("kx-nav-docked");
      } else if (docked && y <= CONFIG.collapseAt) {
        docked = false;
        nav.classList.remove("kx-nav-docked");
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    // Re-read the resting padding after a breakpoint change, but only while
    // floating — docked, the computed value is the docked one.
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (!docked) refreshPad(); }, 150);
    });

    apply(); // correct on load when the browser restores a scroll position

    // Expose the resting top for anything that wants it; harmless otherwise.
    nav.dataset.kxNavRestTop = restTop;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

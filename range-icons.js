/*! Kasso — "The Range" icon animation (POC) v1
 *  Staggered rise as the section enters view, replayed on every entry, plus
 *  an outline-to-filled morph on card hover.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    section: "#sc-feature-list-section-horizontal",
    cardSelector: "div.stack.gap-element-large",  // nearest ancestor that is the card
    rise: 10,             // px the icon lifts in from
    revealMs: 520,
    stagger: 90,          // ms between the three
    hoverScale: 1.12,
    hoverLift: 1,         // px
    hoverMs: 280,
    enterRatio: 0.25,     // section must be this visible to play
    easing: "cubic-bezier(.16,1,.3,1)"
  };

  function init() {
    var sec = document.querySelector(CONFIG.section);
    if (!sec || sec.dataset.kxIcons) return;

    // The icons are Material Symbols ligatures, not SVG — find them by the
    // font actually in use rather than by a class that may change.
    var icons = [].slice.call(sec.querySelectorAll("*")).filter(function (e) {
      return /material symbols/i.test(getComputedStyle(e).fontFamily || "");
    });
    if (!icons.length) return;
    sec.dataset.kxIcons = "1";

    // The theme already drives this font's axes. Read its exact settings and
    // change only FILL, so the hover state can interpolate cleanly instead of
    // snapping the other axes back to their defaults.
    var baseFVS = getComputedStyle(icons[0]).fontVariationSettings || "";
    var fillFVS = /"FILL"\s*0/.test(baseFVS) ? baseFVS.replace(/"FILL"\s*0/, '"FILL" 1') : null;

    var css =
      // Wrapper carries the reveal, icon carries the hover: two elements, two
      // transforms, so neither has to overwrite the other.
      ".kx-ico-w{transition:opacity " + CONFIG.revealMs + "ms " + CONFIG.easing + "," +
        "transform " + CONFIG.revealMs + "ms " + CONFIG.easing + ";}" +
      ".kx-ico-w.kx-ico-out{opacity:0;transform:translateY(" + CONFIG.rise + "px);}" +
      ".kx-ico-w.kx-ico-in{opacity:1;transform:none;}" +
      ".kx-ico{display:block;transform-origin:50% 50%;" +
        "transition:transform " + CONFIG.hoverMs + "ms " + CONFIG.easing +
        (fillFVS ? ",font-variation-settings " + CONFIG.hoverMs + "ms " + CONFIG.easing : "") + ";}" +
      ".kx-ico-card:hover .kx-ico,.kx-ico-card:focus-within .kx-ico{" +
        "transform:translateY(-" + CONFIG.hoverLift + "px) scale(" + CONFIG.hoverScale + ");" +
        (fillFVS ? "font-variation-settings:" + fillFVS + ";" : "") +
      "}" +
      // Reduced motion: keep the fill morph, which is not movement, and drop
      // every transform.
      "@media (prefers-reduced-motion: reduce){" +
        ".kx-ico-w,.kx-ico-w.kx-ico-out,.kx-ico-w.kx-ico-in{opacity:1!important;transform:none!important;transition:none!important;}" +
        ".kx-ico-card:hover .kx-ico,.kx-ico-card:focus-within .kx-ico{transform:none;}" +
      "}";

    var style = document.createElement("style");
    style.setAttribute("data-kx-icons-style", "");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    var wraps = [];
    for (var i = 0; i < icons.length; i++) {
      var icon = icons[i];
      icon.classList.add("kx-ico");
      var wrap = icon.parentElement;
      wrap.classList.add("kx-ico-w", "kx-ico-out");
      wraps.push(wrap);
      var card = icon.closest(CONFIG.cardSelector);
      // Hovering a 32px glyph is a fiddly target; the card is the real one.
      if (card) card.classList.add("kx-ico-card");
    }

    var playing = false;
    var timers = [];

    function clearTimers() {
      for (var t = 0; t < timers.length; t++) clearTimeout(timers[t]);
      timers = [];
    }

    function play() {
      if (playing) return;
      playing = true;
      clearTimers();
      wraps.forEach(function (w, i) {
        timers.push(setTimeout(function () {
          w.classList.remove("kx-ico-out");
          w.classList.add("kx-ico-in");
        }, i * CONFIG.stagger));
      });
    }

    function reset() {
      if (!playing) return;
      playing = false;
      clearTimers();
      wraps.forEach(function (w) {
        w.classList.remove("kx-ico-in");
        w.classList.add("kx-ico-out");
      });
    }

    // No unobserve: the brief is that this replays on every entry. Reset only
    // once the section is fully clear, so scrolling near the boundary can't
    // retrigger it repeatedly.
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && e.intersectionRatio >= CONFIG.enterRatio) play();
      else if (!e.isIntersecting) reset();
    }, { threshold: [0, CONFIG.enterRatio] });

    io.observe(sec);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

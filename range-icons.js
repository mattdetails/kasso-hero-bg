/*! Kasso — "The Range" icon line-draw (POC) v2
 *  Swaps the three Material Symbols glyphs for stroked SVGs and draws them
 *  in, replayed on every entry into view and on card hover.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    section: "#sc-feature-list-section-horizontal",
    cardSelector: "div.stack.gap-element-large",
    strokeWidth: 1.75,    // 2 is Lucide's default; 1.75 is closer to the
                          // theme's wght-200 Material glyphs
    drawMs: 900,          // scroll-in draw
    partStagger: 90,      // ms between parts within one icon
    iconStagger: 140,     // ms between the three icons
    hoverMs: 600,         // hover redraw, snappier
    hoverPartStagger: 60,
    enterRatio: 0.25,
    easing: "cubic-bezier(.65,0,.35,1)"
  };

  // Lucide (ISC). Genuinely stroked paths — Material Symbols ships filled
  // shapes that only look like line art, so there is no centreline to draw.
  var ICONS = {
    spa:         '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    water_drop:  '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    content_cut: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>'
  };
  var ORDER = ["spa", "water_drop", "content_cut"];

  var SVG_NS = "http://www.w3.org/2000/svg";

  function buildSvg(body, px) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", px);
    svg.setAttribute("height", px);
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", CONFIG.strokeWidth);
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.display = "block";
    svg.style.overflow = "visible";
    svg.innerHTML = body;
    return svg;
  }

  function init() {
    var sec = document.querySelector(CONFIG.section);
    if (!sec || sec.dataset.kxIcons) return;

    var glyphs = [].slice.call(sec.querySelectorAll("*")).filter(function (e) {
      return /material symbols/i.test(getComputedStyle(e).fontFamily || "");
    });
    if (!glyphs.length) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var items = [];

    for (var i = 0; i < glyphs.length; i++) {
      var g = glyphs[i];
      var name = (g.textContent || "").trim();
      var body = ICONS[name] || ICONS[ORDER[i]];
      if (!body) continue;

      var px = Math.round(parseFloat(getComputedStyle(g).fontSize)) || 32;
      var svg = buildSvg(body, px);

      // Keep the original ligature so this can be undone, then swap.
      g.dataset.kxGlyph = name;
      g.textContent = "";
      g.appendChild(svg);

      // getTotalLength needs the node in the document. Measuring and setting
      // the initial offset happen in this same task, so nothing paints
      // half-drawn in between.
      var parts = [].slice.call(svg.querySelectorAll("path,circle,line,polyline,rect"));
      for (var p = 0; p < parts.length; p++) {
        var el = parts[p];
        var len = 0;
        try { len = el.getTotalLength(); } catch (e) { len = 0; }
        if (!len || !isFinite(len)) len = 100;
        el.__len = len;
        el.style.strokeDasharray = len + " " + len;
        el.style.strokeDashoffset = reduce ? "0" : String(len);
      }
      items.push({ svg: svg, parts: parts, card: g.closest(CONFIG.cardSelector) });
    }

    if (!items.length) return;
    sec.dataset.kxIcons = "1";

    if (reduce) return;   // lines shown complete, nothing animates

    function draw(item, baseDelay, dur, partStep) {
      item.parts.forEach(function (el, i) {
        el.style.transition = "none";
        el.style.strokeDashoffset = String(el.__len);
        void el.getBoundingClientRect();      // flush, so the restart takes
        el.style.transition = "stroke-dashoffset " + dur + "ms " + CONFIG.easing +
                              " " + (baseDelay + i * partStep) + "ms";
        el.style.strokeDashoffset = "0";
      });
    }

    function undraw(item) {
      item.parts.forEach(function (el) {
        el.style.transition = "none";
        el.style.strokeDashoffset = String(el.__len);
      });
    }

    // Hover redraws the same lines, quicker.
    items.forEach(function (item) {
      var target = item.card || item.svg;
      target.addEventListener("mouseenter", function () {
        draw(item, 0, CONFIG.hoverMs, CONFIG.hoverPartStagger);
      });
      target.addEventListener("focusin", function () {
        draw(item, 0, CONFIG.hoverMs, CONFIG.hoverPartStagger);
      });
    });

    var playing = false;

    // No unobserve: the brief is that this replays on every entry. Reset only
    // once the section is fully clear, so scrolling near the boundary cannot
    // retrigger it repeatedly.
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && e.intersectionRatio >= CONFIG.enterRatio) {
        if (playing) return;
        playing = true;
        items.forEach(function (item, i) {
          draw(item, i * CONFIG.iconStagger, CONFIG.drawMs, CONFIG.partStagger);
        });
      } else if (!e.isIntersecting) {
        if (!playing) return;
        playing = false;
        items.forEach(undraw);
      }
    }, { threshold: [0, CONFIG.enterRatio] });

    io.observe(sec);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

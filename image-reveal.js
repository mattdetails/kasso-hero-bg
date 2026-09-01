/*! Kasso — image reveal on scroll (POC) v1
 *  Fades images in with a short slide up as they enter the viewport.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    // Content images in this theme all carry .media; logos carry
    // .company-logo. Kept narrow on purpose — see the note on the failsafe.
    selector: "img.media",
    minSize: 96,          // px; anything smaller is shown at once, never animated
    distance: 16,         // px of slide
    duration: 700,        // ms
    easing: "cubic-bezier(.16,1,.3,1)",
    threshold: 0.1,
    rootMargin: "0px 0px -6% 0px",
    stagger: 70,          // ms between images that enter together
    maxStagger: 4,        // cap, so a long row doesn't crawl
    failsafeMs: 2500
  };

  var GATE = "kx-ir";     // on <html>
  var SHOWN = "kx-shown";

  // Bail before touching anything if the browser can't drive this.
  if (!("IntersectionObserver" in window) || !document.documentElement.classList) return;

  var css =
    "html." + GATE + " " + CONFIG.selector + "{" +
      "opacity:0;transform:translateY(" + CONFIG.distance + "px);" +
      "transition:opacity " + CONFIG.duration + "ms " + CONFIG.easing + "," +
                 "transform " + CONFIG.duration + "ms " + CONFIG.easing + ";" +
    "}" +
    "html." + GATE + " " + CONFIG.selector + "." + SHOWN + "{" +
      "opacity:1;transform:none;" +
    "}" +
    // Anyone who asked for less motion gets the images, immediately, as-is.
    "@media (prefers-reduced-motion: reduce){" +
      "html." + GATE + " " + CONFIG.selector + "{" +
        "opacity:1!important;transform:none!important;transition:none!important;" +
      "}" +
    "}";

  var style = document.createElement("style");
  style.setAttribute("data-kx-reveal-style", "");
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  // Hide at parse time so nothing paints and then jumps. Everything below is
  // written so that any failure path still ends with the images visible.
  var root = document.documentElement;
  root.classList.add(GATE);

  var released = false;
  function releaseAll() {
    if (released) return;
    released = true;
    root.classList.remove(GATE);
  }

  // Armed immediately, before any other work. If anything throws between here
  // and the observer being wired, the images appear anyway — a short delay is
  // an acceptable failure, invisible content is not.
  var failsafe = setTimeout(releaseAll, CONFIG.failsafeMs);

  function reveal(img, delay) {
    var go = function () { img.classList.add(SHOWN); };
    if (delay) window.setTimeout(go, delay);
    else go();
  }

  // Revealing a lazy image that hasn't decoded fades in an empty frame, so
  // wait for it. complete covers the common case; onload the rest.
  function revealWhenReady(img, delay) {
    if (img.complete && img.naturalWidth > 0) { reveal(img, delay); return; }
    var done = false;
    var fire = function () { if (!done) { done = true; reveal(img, delay); } };
    img.addEventListener("load", fire, { once: true });
    img.addEventListener("error", fire, { once: true });   // broken image still un-hides
    window.setTimeout(fire, 1500);
  }

  function init() {
    var imgs = [].slice.call(document.querySelectorAll(CONFIG.selector));
    if (!imgs.length) { clearTimeout(failsafe); releaseAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      // Stagger within a batch, ordered down the page rather than by whatever
      // order the observer hands them over.
      var hits = entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      for (var i = 0; i < hits.length; i++) {
        var img = hits[i].target;
        io.unobserve(img);
        revealWhenReady(img, Math.min(i, CONFIG.maxStagger) * CONFIG.stagger);
      }
    }, { threshold: CONFIG.threshold, rootMargin: CONFIG.rootMargin });

    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var r = img.getBoundingClientRect();
      // Icons, logos and zero-size variants: show now, never animate. Done by
      // measured size so it holds even if the theme's class names change.
      if (r.width < CONFIG.minSize || r.height < CONFIG.minSize) {
        img.classList.add(SHOWN);
        continue;
      }
      io.observe(img);
    }

    // Wiring succeeded, so the failsafe has done its job. Leaving it armed
    // would un-hide every below-fold image at 2.5s and cancel the effect.
    clearTimeout(failsafe);
  }

  function boot() {
    try {
      init();
    } catch (e) {
      if (window.console) console.warn("[kx-reveal]", e);
      clearTimeout(failsafe);
      releaseAll();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

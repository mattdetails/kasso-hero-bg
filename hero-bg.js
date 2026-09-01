/*! Kasso hero — ambient background (POC) v5
 *  Drops a slow-drifting light field behind the hero card.
 *  No dependencies. ~6KB. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    // First selector that matches wins.
    targets: [
      "#sc-hero-header-card-horizontal section",
      "[id^='sc-hero'] section"
    ],
    fps: 58,          // frames per second cap
    speed: 3,         // multiplier on the calibrated drift rates below
    intensity: 1.95,  // multiplier on blob alpha
    resolution: 440   // canvas backing width in px; upscaled by the browser
  };

  // Clamp on height/width, so a transient layout can't allocate a huge canvas.
  var MAX_ASPECT = 4;

  // Sampled from the hero: card purple, the mint + lavender from the
  // product photography, and a deeper purple to keep the corners weighted.
  // px/py are drift rates in radians per second. They are calibrated, not
  // arbitrary: at the original rates the brightest moving pixel changed by
  // 0.5/255 per second, which is below the threshold of perception — the
  // effect measured as animated but read as a static gradient. These rates
  // put it near 3/255 per second, which reads as gentle drift.
  var BLOBS = [
    { c: [126, 115, 192], r: 0.55, a: 0.55, sx: 0.18, sy: 0.30, px: 0.126, py: 0.078, o: 0.0 },
    { c: [ 92, 214, 190], r: 0.42, a: 0.22, sx: 0.72, sy: 0.20, px: 0.102, py: 0.138, o: 1.7 },
    { c: [176, 164, 240], r: 0.50, a: 0.38, sx: 0.86, sy: 0.72, px: 0.078, py: 0.114, o: 3.1 },
    { c: [ 58,  44, 138], r: 0.60, a: 0.45, sx: 0.34, sy: 0.88, px: 0.138, py: 0.066, o: 4.6 }
  ];

  function init() {
    var host = null;
    for (var i = 0; i < CONFIG.targets.length && !host; i++) {
      host = document.querySelector(CONFIG.targets[i]);
    }
    if (!host || host.querySelector(".kx-hero-bg")) return;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;

    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.overflow = "hidden";
    host.style.isolation = "isolate";

    canvas.className = "kx-hero-bg";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;z-index:0;" +
      "pointer-events:none;display:block;opacity:0;transition:opacity 1.2s ease";
    host.insertBefore(canvas, host.firstChild);

    // Lift the real content above the canvas.
    Array.prototype.forEach.call(host.children, function (el) {
      if (el === canvas) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.zIndex = "1";
    });

    // Render small and let the browser upscale — the gradients are soft
    // enough that this is indistinguishable from full-res, and far cheaper
    // than a full-size CSS blur.
    var w = 0, h = 0, lastT = 0;
    function resize() {
      var r = host.getBoundingClientRect();
      // Bail on a degenerate box: a head script can run before layout has
      // settled, and a bad measurement would otherwise be locked in.
      if (r.width < 1 || r.height < 1) return false;
      var nw = CONFIG.resolution;
      var nh = Math.max(1, Math.round(nw * Math.min(r.height / r.width, MAX_ASPECT)));
      if (nw === w && nh === h) return false;
      w = nw; h = nh;
      canvas.width = w;
      canvas.height = h;
      return true;
    }

    function draw(t) {
      if (!w || !h) return;
      lastT = t;
      t *= CONFIG.speed;
      ctx.clearRect(0, 0, w, h);
      var span = Math.max(w, h);
      for (var i = 0; i < BLOBS.length; i++) {
        var b = BLOBS[i];
        // Two out-of-phase sines per axis, so the drift never visibly loops.
        var x = (b.sx + 0.16 * Math.sin(t * b.px + b.o) + 0.07 * Math.sin(t * b.px * 1.7 + b.o * 2)) * w;
        var y = (b.sy + 0.14 * Math.cos(t * b.py + b.o) + 0.06 * Math.sin(t * b.py * 2.1 + b.o)) * h;
        var rad = span * b.r * (1 + 0.08 * Math.sin(t * 0.06 + b.o));
        var a = b.a * CONFIG.intensity;
        var rgb = b.c[0] + "," + b.c[1] + "," + b.c[2];
        var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(" + rgb + "," + a + ")");
        g.addColorStop(0.55, "rgba(" + rgb + "," + a * 0.32 + ")");
        g.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }

    resize();
    requestAnimationFrame(function () { canvas.style.opacity = "1"; });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0);
      return;
    }

    var running = false, raf = 0, last = 0, start = 0;

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!start) start = now;
      // 10% slack. Without it a target whose interval sits just above the
      // display's vsync (e.g. 58fps -> 17.24ms against a 16.67ms refresh)
      // rejects every frame and delivers half the requested rate.
      if (now - last < (1000 / CONFIG.fps) * 0.9) return;
      last = now;
      draw((now - start) / 1000);
    }
    function play() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); } }
    function pause() { if (running) { running = false; cancelAnimationFrame(raf); } }

    play();

    // Idle whenever the hero is scrolled away or the tab is backgrounded.
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) play(); else pause();
      }, { threshold: 0 }).observe(host);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause(); else play();
    });

    // Re-measure whenever the hero's own box changes. This also fires once on
    // observe, which self-corrects any bad measurement taken before layout
    // settled — the reason a plain resize listener wasn't enough.
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (resize() && !running) draw(lastT);
      }).observe(host);
    } else {
      var rt;
      window.addEventListener("resize", function () {
        clearTimeout(rt);
        rt = setTimeout(function () { if (resize() && !running) draw(lastT); }, 150);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

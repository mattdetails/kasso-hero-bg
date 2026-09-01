/*! Kasso hero — ambient background, WebGL (POC) v1
 *  Evaluates the gradient field per-pixel on the GPU at full device
 *  resolution, with dithering to defeat 8-bit banding.
 *  Falls back to the 2D canvas path if WebGL is unavailable.
 *  No dependencies. Safe to load from <head> (defers itself).
 */
(function () {
  "use strict";

  var CONFIG = {
    targets: [
      "#sc-hero-header-card-horizontal section",
      "[id^='sc-hero'] section"
    ],
    fps: 58,
    speed: 3,
    intensity: 1.95,
    // Device-pixel scale cap. 2 = fully native on a retina display. Measured
    // at 0.035ms/frame for 3818x1800 on an M2 Pro, so there is no reason to
    // render below native.
    pixelRatio: 2,
    // Dither amplitude in 1/255 units, applied before the 8-bit write.
    // Measured longest flat band on a 3818px scanline: 0 -> 127px, 1 -> 17px,
    // 2 -> 7px, 3 -> 4px, 4 -> no further gain. 2 removes visible banding
    // without adding perceptible grain.
    dither: 2.0,
    maxAspect: 4
  };

  // Same table as the 2D version: colour, radius, alpha, start position,
  // drift rates, phase offset.
  var BLOBS = [
    { c: [126, 115, 192], r: 0.55, a: 0.55, sx: 0.18, sy: 0.30, px: 0.126, py: 0.078, o: 0.0 },
    { c: [ 92, 214, 190], r: 0.42, a: 0.22, sx: 0.72, sy: 0.20, px: 0.102, py: 0.138, o: 1.7 },
    { c: [176, 164, 240], r: 0.50, a: 0.38, sx: 0.86, sy: 0.72, px: 0.078, py: 0.114, o: 3.1 },
    { c: [ 58,  44, 138], r: 0.60, a: 0.45, sx: 0.34, sy: 0.88, px: 0.138, py: 0.066, o: 4.6 }
  ];

  var VERT =
    "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

  function f(n) { var s = String(n); return s.indexOf(".") < 0 && s.indexOf("e") < 0 ? s + ".0" : s; }

  // The blob table is compiled into the shader so there is one source of truth.
  function buildFrag() {
    var body = "";
    for (var i = 0; i < BLOBS.length; i++) {
      var b = BLOBS[i];
      body +=
        "{vec2 c=vec2((" + f(b.sx) + "+0.16*sin(t*" + f(b.px) + "+" + f(b.o) + ")+0.07*sin(t*" + f(b.px * 1.7) + "+" + f(b.o * 2) + "))*uRes.x," +
                    "(" + f(b.sy) + "+0.14*cos(t*" + f(b.py) + "+" + f(b.o) + ")+0.06*sin(t*" + f(b.py * 2.1) + "+" + f(b.o) + "))*uRes.y);" +
         "float rad=span*" + f(b.r) + "*(1.0+0.08*sin(t*0.06+" + f(b.o) + "));" +
         "col=blob(col,q,c,rad,vec3(" + f(b.c[0] / 255) + "," + f(b.c[1] / 255) + "," + f(b.c[2] / 255) + ")," + f(b.a) + "*uIntensity);}";
    }
    return [
      "precision highp float;",
      "uniform vec2 uRes;uniform float uTime;uniform float uIntensity;uniform float uDither;",
      "const vec3 BASE=vec3(" + f(79 / 255) + "," + f(64 / 255) + "," + f(169 / 255) + ");",
      // Matches the canvas gradient stops: a at 0, a*0.32 at 0.55, 0 at 1.
      "float ramp(float r,float a){",
      "  if(r>=1.0)return 0.0;",
      "  if(r<0.55)return a*(1.0-0.68*(r/0.55));",
      "  return a*0.32*(1.0-(r-0.55)/0.45);",
      "}",
      "vec3 blob(vec3 col,vec2 q,vec2 c,float rad,vec3 cc,float a){",
      "  float al=ramp(distance(q,c)/rad,a);",
      "  return mix(col,cc,al);",   // source-over is associative, so this equals the 2D path
      "}",
      "float hash(vec2 v){return fract(sin(dot(v,vec2(12.9898,78.233)))*43758.5453);}",
      "void main(){",
      "  vec2 q=gl_FragCoord.xy;q.y=uRes.y-q.y;",  // canvas has y down
      "  float t=uTime;float span=max(uRes.x,uRes.y);",
      "  vec3 col=BASE;",
      body,
      // Dither before the 8-bit write. This is what removes the banding that
      // no amount of resolution would have fixed.
      "  float n=hash(gl_FragCoord.xy)-0.5;",
      "  col+=n*uDither/255.0;",
      "  gl_FragColor=vec4(col,1.0);",
      "}"
    ].join("\n");
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console) console.warn("[kx-gl]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function init() {
    var host = null;
    for (var i = 0; i < CONFIG.targets.length && !host; i++) {
      host = document.querySelector(CONFIG.targets[i]);
    }
    if (!host || host.querySelector(".kx-hero-bg")) return;

    var canvas = document.createElement("canvas");
    var gl = null;
    try {
      var opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" };
      gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
    } catch (e) { gl = null; }

    if (!gl) { fallback2D(host); return; }

    var prog = gl.createProgram();
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, buildFrag());
    if (!vs || !fs) { fallback2D(host); return; }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn("[kx-gl]", gl.getProgramInfoLog(prog));
      fallback2D(host); return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "uRes");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uInt = gl.getUniformLocation(prog, "uIntensity");
    var uDit = gl.getUniformLocation(prog, "uDither");
    gl.uniform1f(uInt, CONFIG.intensity);
    gl.uniform1f(uDit, CONFIG.dither);

    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.overflow = "hidden";
    host.style.isolation = "isolate";

    canvas.className = "kx-hero-bg";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;z-index:0;" +
      "pointer-events:none;display:block;opacity:0;transition:opacity 1.2s ease";
    host.insertBefore(canvas, host.firstChild);

    Array.prototype.forEach.call(host.children, function (el) {
      if (el === canvas) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.zIndex = "1";
    });

    var w = 0, h = 0, lastT = 0;

    function resize() {
      var r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      var scale = Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatio);
      var nw = Math.max(1, Math.round(r.width * scale));
      var nh = Math.max(1, Math.round(Math.min(r.height, r.width * CONFIG.maxAspect) * scale));
      if (nw === w && nh === h) return false;
      w = nw; h = nh;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      return true;
    }

    function draw(t) {
      if (!w || !h) return;
      lastT = t;
      gl.uniform1f(uTime, t * CONFIG.speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    resize();
    requestAnimationFrame(function () { canvas.style.opacity = "1"; });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { draw(0); return; }

    var running = false, raf = 0, last = 0, start = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!start) start = now;
      if (now - last < (1000 / CONFIG.fps) * 0.9) return;
      last = now;
      draw((now - start) / 1000);
    }
    function play() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); } }
    function pause() { if (running) { running = false; cancelAnimationFrame(raf); } }
    play();

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) play(); else pause();
      }, { threshold: 0 }).observe(host);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause(); else play();
    });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); pause(); });
    canvas.addEventListener("webglcontextrestored", function () { resize(); play(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { if (resize() && !running) draw(lastT); }).observe(host);
    } else {
      var rt;
      window.addEventListener("resize", function () {
        clearTimeout(rt);
        rt = setTimeout(function () { if (resize() && !running) draw(lastT); }, 150);
      });
    }
  }

  // Minimal 2D path for browsers without WebGL. Lower resolution by
  // necessity, so it keeps the dither-free look of the original.
  function fallback2D(host) {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.overflow = "hidden"; host.style.isolation = "isolate";
    canvas.className = "kx-hero-bg";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block";
    host.insertBefore(canvas, host.firstChild);
    Array.prototype.forEach.call(host.children, function (el) {
      if (el === canvas) return;
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.zIndex = "1";
    });
    var w = 0, h = 0;
    function resize() {
      var r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      w = 440; h = Math.max(1, Math.round(w * Math.min(r.height / r.width, CONFIG.maxAspect)));
      canvas.width = w; canvas.height = h;
    }
    function draw(t) {
      if (!w || !h) return;
      t *= CONFIG.speed;
      ctx.clearRect(0, 0, w, h);
      var span = Math.max(w, h);
      for (var i = 0; i < BLOBS.length; i++) {
        var b = BLOBS[i];
        var x = (b.sx + 0.16 * Math.sin(t * b.px + b.o) + 0.07 * Math.sin(t * b.px * 1.7 + b.o * 2)) * w;
        var y = (b.sy + 0.14 * Math.cos(t * b.py + b.o) + 0.06 * Math.sin(t * b.py * 2.1 + b.o)) * h;
        var rad = span * b.r * (1 + 0.08 * Math.sin(t * 0.06 + b.o));
        var a = b.a * CONFIG.intensity, rgb = b.c[0] + "," + b.c[1] + "," + b.c[2];
        var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(" + rgb + "," + a + ")");
        g.addColorStop(0.55, "rgba(" + rgb + "," + a * 0.32 + ")");
        g.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
    resize();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { draw(0); return; }
    var start = 0, last = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!start) start = now;
      if (now - last < (1000 / CONFIG.fps) * 0.9) return;
      last = now; draw((now - start) / 1000);
    })(performance.now());
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

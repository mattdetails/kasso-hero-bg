# kasso-hero-bg

Front-end enhancements for the Kasso (Relume) site, injected via `<script>` tags in
the site's head. No dependencies, no build step. Built as a proof of concept.

| File | What it does |
| --- | --- |
| `hero-bg-gl.js` | Ambient background, WebGL — **use this one** |
| `hero-bg.js` | The original 2D-canvas version, kept for reference |
| `navbar.js` | Full-width navbar at rest, floating pill on scroll |
| `image-reveal.js` | Fades and slides images in as they enter the viewport |
| `range-icons.js` | Animates the three icons in "The Range" section |
| `smooth-scroll.js` | Locomotive Scroll v5 smooth scrolling |

`hero-bg-gl.js` supersedes `hero-bg.js` and carries its own 2D fallback, so load
one or the other, never both — whichever runs first wins and the second is a no-op.

## Why WebGL

The 2D path renders a 440px-wide canvas and lets the browser upscale it. On a 2560px
hi-DPI display that is 5.78x in CSS pixels, 11.6x in device pixels. That is the
obvious problem, but it is not the main one.

Measured on a full-resolution 3818px scanline with dithering off, the longest run of
a single colour is **127px**. That is 8-bit quantisation, and it survives at any
resolution — rendering at 4K would not have removed it. It is also amplified by the
shipped `intensity: 1.95`, which roughly doubles the step between adjacent bands
versus the original `1.0`.

So the fix is two things, and the second matters more:

1. Evaluate the field per-pixel in a fragment shader at device resolution, removing
   the upscale entirely.
2. Dither by a fraction of a colour step before the 8-bit write, breaking the bands.

Longest flat band against dither amplitude, measured:

| `dither` | Longest flat band |
| --- | --- |
| 0 | 127px |
| 1 | 17px |
| **2** (shipped) | **7px** |
| 3 | 4px |
| 4 | 4px, no further gain |

It is also far cheaper. The fragment shader costs **0.035ms/frame** at 3818x1800 on
an M2 Pro — about 2ms of GPU per second at 58fps, against ~47ms of CPU per second for
the 2D path.

The blob table is compiled into the shader source so it stays the single source of
truth. Source-over compositing is associative, so applying each blob onto the base in
order gives exactly the 2D path's accumulate-then-composite result.

## Install

Add to **Site Settings → Custom Code → Head**, pinned to a commit SHA:

```html
<script src="https://cdn.jsdelivr.net/gh/mattdetails/kasso-hero-bg@COMMIT_SHA/hero-bg.js" defer></script>
```

**Pin to a commit SHA, not `@main`.** jsDelivr caches branch and tag refs for up to
7 days, so `@main` will keep serving stale code while you iterate. Every commit is a
fresh, permanent URL that goes live immediately.

Get the current SHA with:

```
git rev-parse HEAD
```

## range-icons.js — "The Range" icon line-draw

The three icons draw themselves in, stroke by stroke, each time the section enters
view, and redraw faster on card hover.

### Why the icons had to be replaced

The originals were Material Symbols ligatures. A line-draw animates
`stroke-dashoffset` along a stroked path, and text cannot be stroke-animated. Nor can
Material's own SVGs: they are single **filled** shapes that only look like line art —
`stroke=0`, no centreline to draw along.

So the glyphs are swapped for stroked Lucide equivalents:

| Card | Was | Now | Parts |
| --- | --- | --- | --- |
| Skin Care | `spa` | `leaf` | 2 |
| Face Wash | `water_drop` | `droplet` | 1 |
| Hair Products | `content_cut` | `scissors` | 5 |

The bottom two are near-identical to what they replace. `leaf` is the one genuinely
visible change — swap it for `flower` or `sparkles` in the `ICONS` map if you prefer
something closer to the original lotus.

### How it draws

Each part is measured with `getTotalLength()`, then `stroke-dasharray` and
`stroke-dashoffset` are set to that length and animated to zero, staggered within an
icon and across the three. Measuring and setting the initial offset happen in the
same task as the swap, so nothing ever paints half-drawn.

The redraw resets the offset, forces a reflow, then re-applies the transition —
without that flush the browser coalesces both writes and no animation runs.

Size comes from the glyph's computed `font-size` and the stroke uses `currentColor`,
so the theme keeps control of both. The original ligature is kept in `data-kx-glyph`,
so the swap is reversible.

Hover is bound to the surrounding card rather than the 32px glyph, with `focusin`
matching for keyboard users. The observer never unobserves — the brief was to replay
on every entry — and resets only once the section is fully clear, so scrolling around
the boundary can't retrigger it. Under `prefers-reduced-motion` the lines render
complete and nothing animates.

## smooth-scroll.js — Locomotive Scroll v5

Loads Locomotive `5.0.1` through jsDelivr's `/+esm` endpoint. It uses a **dynamic**
`import()`, which works in a classic script, so it loads exactly like the others:

```html
<script src="https://cdn.jsdelivr.net/gh/mattdetails/kasso-hero-bg@SHA/smooth-scroll.js" defer></script>
```

### Why dynamic import, not a static one

A top-level `import` that fails has nothing to catch it, so the failure surfaces as an
**uncaught promise rejection** in the console and the page silently loses smooth
scrolling. The module graph here is two separate fetches — `locomotive-scroll@5.0.1/+esm`
and the `lenis@1.3.17/+esm` it imports — and either can be blocked by a content
blocker, a corporate proxy, or a flaky network.

The dynamic import is wrapped in a `.catch`, so a CDN failure degrades to the browser's
native scrolling and logs one warning. Verified by pointing `CONFIG.src` at a
non-existent version: 0 unhandled rejections, 1 warning, `scroll-behavior` restored to
the theme's own value, and the injected stylesheet removed rather than left behind.

Worth knowing: the Locomotive bundle itself contains no `Promise`, `async`, `await`,
`.then` or `.catch` at all, so this import is the only promise in the whole stack and
therefore the only thing here that can produce a rejection.

**Version 5 specifically, not 4.** v4 hijacks scrolling with a `transform` container:
`window.scrollY` stays near zero, `position: fixed` misbehaves, and
`IntersectionObserver` gets unreliable. All three other modules here depend on exactly
those, so v4 would break the navbar, the image reveal, and the hero's off-screen
pause. v5 is built on Lenis (`lenis@1.3.17`) and drives the real window scroll —
verified with `body { transform: none }` and the navbar reacting to Lenis-driven
scroll.

Two things this theme forces:

- It sets `scroll-behavior: smooth` on `<html>`. That fights Lenis and makes anchor
  jumps stutter as both animations run at once, so it is forced back to `auto`.
- In-page links are written as `/#id`, not `#id`. A `a[href^="#"]` handler would miss
  every one of them, so anchors are matched by comparing the resolved pathname, then
  offset by the fixed navbar's measured height.

Skipped entirely under `prefers-reduced-motion` — hijacked scrolling is one of the
clearest cases for honouring that. Lenis's 380-byte stylesheet is inlined rather than
fetched separately.

Tune `lerp` at the top: lower is smoother and heavier, higher is snappier. `0` would
disable smoothing.

## navbar.js — full width at rest, pill on scroll

At the top of the page the bar spans the full viewport, flush at the top edge with
square corners. Past `contractAt` (40px of scroll) it contracts to the theme's own
floating pill — `top/left/right: 24px`, `max-width: 1024px`, 16px radius — and
expands again at `expandAt` (12px). The two thresholds differ on purpose, so a scroll
position resting near the boundary can't flip the state back and forth.

**The floating state has no hardcoded values.** The wide state is written as
`:not(.kx-nav-float)`, so adding that class simply drops the overrides and the theme's
own rules take over. That matters across breakpoints: the pill rests at `top: 24px` on
desktop and `top: 20px` on mobile, and both restore correctly without the module
knowing either number.

**Content does not move.** While wide, horizontal padding grows to
`max(pad, calc((100% - 1024px)/2 + pad))`, keeping the logo and links on the same
column they occupy in the pill — the logo measures x=487 in both states at 1970px
wide. Only the bar's chrome changes.

Two ordering details matter, because the *resting* state is now the modified one:

- **The stylesheet is injected at parse time**, not on DOM ready. The nav does not
  exist yet, so every candidate selector is styled up front. Applying it after DOM
  ready would paint the theme's pill for a frame and then snap to full width.
- **Transitions are gated behind `.kx-nav-ready`**, added two frames after the initial
  state settles, so a page restored at a scrolled position doesn't animate the
  contraction on load.

`max-width: 100%` rather than `100vw`: for a fixed element the containing block
excludes the scrollbar, so the bar can't overflow the viewport.

The overrides use `!important` deliberately — they exist to beat the theme's own rules
from an injected stylesheet, and the module has no other way to win the cascade.

Scroll handling is passive and coalesced into one `requestAnimationFrame`, and the
transition is disabled under `prefers-reduced-motion`.

## hero-bg.js — how it works

The hero is a solid purple `section` (`rgb(79,64,169)`) with an inset card floating
on top, leaving a visible purple frame around it (`176px` top, `121px` sides,
`80px` bottom). That frame is where the motion lives — nothing else occupies it.

Four large radial gradients drift across it, coloured from the page itself: the card
purple, a deeper purple to weight the corners, and the mint + lavender from the
product photography. Each blob moves on two out-of-phase sine waves per axis, so the
drift never visibly loops.

### Drift rates are calibrated

The `px`/`py` rates in `BLOBS` are not arbitrary. At the rates this shipped with
originally, the brightest moving pixel in the visible frame changed by **0.5 out of
255 per second** — below the threshold of perception. The effect measured as animated
(diff two screenshots seconds apart and they differ) but read as a completely static
gradient to anyone actually looking at it.

The current rates put the baseline near **3/255 per second**, about 20/255 over ten
seconds. The shipped `CONFIG.speed` of 3 multiplies that to roughly 9/255 per second.
If you retune, measure the change per second rather than trusting a screenshot diff —
that distinction is what the original rates got wrong.

### Performance

- Canvas renders at a **440px backing width** and is upscaled by the browser, which
  is still far cheaper than the full-size CSS blur this started as.
- Capped at **58fps**. The limiter allows 10% slack: without it, a target whose
  interval sits just above the display's vsync (58fps is 17.24ms against a 16.67ms
  refresh) rejects every frame and delivers half the requested rate. Measured at 35.5
  of a requested 58 before the fix.
- Draw cost at these settings is ~0.82ms/frame, about 47ms of CPU per second, versus
  ~0.46ms and 11ms at 200px/24fps. Roughly 4.7% of the frame budget at 58fps on an
  Apple-silicon Mac; proportionally more on low-end mobile.
- An `IntersectionObserver` idles it when the hero scrolls out of view, and
  `visibilitychange` pauses it when the tab is backgrounded.
- Honours `prefers-reduced-motion` by painting a single static frame.

### Robustness

A head script runs before layout has settled, so the canvas can take a bad first
measurement. Two guards handle that:

- A `ResizeObserver` on the hero re-measures whenever its box changes. It also fires
  once on `observe`, which self-corrects any measurement taken too early. A plain
  `window.resize` listener was not enough — without a resize event, a wrong size was
  locked in permanently. Falls back to a debounced resize listener where
  `ResizeObserver` is unavailable.
- `MAX_ASPECT` clamps the derived height, so a transient layout can't allocate a
  huge canvas. Degenerate boxes (zero width or height) are skipped entirely.

### Safety

- Script is a no-op if the hero isn't found, if `<canvas>` is unsupported, or if it
  has already run (guards against double-injection).
- The canvas is `aria-hidden` and `pointer-events: none`.
- Existing hero content is lifted to `z-index: 1` so nothing is covered.

## Tuning

The `CONFIG` block at the top of `hero-bg.js`:

| Key | Default | Notes |
| --- | --- | --- |
| `intensity` | `1.95` | Multiplier on blob alpha. `1` is the subtle baseline. |
| `speed` | `3` | Multiplier on the calibrated drift rates. |
| `fps` | `58` | |
| `resolution` | `440` | Canvas backing width in px. |
| `targets` | — | Selector list, first match wins. |

Colours live in the `BLOBS` array — each entry is an `[r,g,b]` plus a start
position, radius, alpha and drift rate.

## Compatibility

Targets `#sc-hero-header-card-horizontal section`, falling back to
`[id^='sc-hero'] section` so it survives Relume renaming the hero block. Verified
identical on two generated sites from the same template. A hero with a full-bleed
background image instead of the purple frame would need rework — there'd be no
exposed background for the motion to live in.

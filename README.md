# kasso-hero-bg

Front-end enhancements for the Kasso (Relume) site, injected via `<script>` tags in
the site's head. No dependencies, no build step. Built as a proof of concept.

| File | What it does |
| --- | --- |
| `hero-bg.js` | Ambient animated background behind the hero card |
| `navbar.js` | Docks the floating navbar to full width on scroll |

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

## navbar.js — dock on scroll

The navbar is `position: fixed` at `top/left/right: 24px` with `max-width: 1024px`
and a 16px radius — a floating pill. Past `expandAt` (40px of scroll) it animates to
`top/left/right: 0`, full width, square corners, with a soft shadow; it returns to
the pill at `collapseAt` (12px). The two thresholds differ on purpose, so a scroll
position resting near the boundary can't flip the state back and forth.

**Content does not move.** When docked, horizontal padding grows to
`max(pad, calc((100% - 1024px)/2 + pad))`, which keeps the logo and links on exactly
the column they occupied while floating — verified at 1970px wide, where the logo sits
at x=487 in both states. Only the bar's chrome expands. That padding base is held in a
`--kx-nav-pad` custom property refreshed on resize, so a theme that pads differently
per breakpoint still lands on the right column.

`max-width: 100%` rather than `100vw`: for a fixed element the containing block
excludes the scrollbar, so the bar can't overflow the viewport.

The overrides use `!important` deliberately — they exist to beat the theme's own
rules from an injected stylesheet, and the module has no other way to win the cascade.

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

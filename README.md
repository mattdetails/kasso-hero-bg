# kasso-hero-bg

Ambient animated background for the Kasso (Relume) hero — a slow-drifting light
field behind the hero card. No dependencies, ~5KB, injected via a single `<script>`
tag in the site's head. Built as a proof of concept.

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

## How it works

The hero is a solid purple `section` (`rgb(79,64,169)`) with an inset card floating
on top, leaving a visible purple frame around it (`176px` top, `121px` sides,
`80px` bottom). That frame is where the motion lives — nothing else occupies it.

Four large radial gradients drift across it, coloured from the page itself: the card
purple, a deeper purple to weight the corners, and the mint + lavender from the
product photography. Each blob moves on two out-of-phase sine waves per axis, so the
drift never visibly loops.

### Performance

- Canvas renders at a **200px backing width** and is upscaled by the browser. The
  gradients are soft enough that this is indistinguishable from full resolution, and
  far cheaper than the full-size CSS blur this started as.
- Capped at **24fps** — plenty for motion this slow.
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
| `intensity` | `1` | Deliberately subtle. `1.5` makes it clearly noticeable. |
| `speed` | `1` | `0.5` = half as fast, `2` = twice as fast. |
| `fps` | `24` | |
| `resolution` | `200` | Canvas backing width in px. |
| `targets` | — | Selector list, first match wins. |

Colours live in the `BLOBS` array — each entry is an `[r,g,b]` plus a start
position, radius, alpha and drift rate.

## Compatibility

Targets `#sc-hero-header-card-horizontal section`, falling back to
`[id^='sc-hero'] section` so it survives Relume renaming the hero block. Verified
identical on two generated sites from the same template. A hero with a full-bleed
background image instead of the purple frame would need rework — there'd be no
exposed background for the motion to live in.

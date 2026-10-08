# StudySpot SG — Design System

**IS216 · G10 · Team T3**

One shared visual language so six people's pages look like one product.
Open `style-guide.html` in a browser to see every component rendered next to
its markup, or read `StudySpot-SG-Design-System.pdf`.

---

## Setup — do this once

Copy `theme.css` into `client/src/assets/`, then import it **after** Bootstrap
in `client/src/main.js`:

```js
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/theme.css'          // ← ours last, so it wins
```

No SCSS, no build step, no extra dependency. `theme.css` is plain CSS custom
properties layered over Bootstrap 5.3, which exposes its own variables
(`--bs-primary`, `--bs-btn-bg`, …) for exactly this.

---

## Colour

The four hues come from the project proposal — Sky Blue, Light Green, Light
Purple, Light Pink. Each is expanded into a 50–900 tonal scale so there is
always a step dark enough to read on white. Raw pastels fail contrast; the
scale fixes that while keeping the palette recognisably ours.

| Hue | Role |
|---|---|
| **Sky** | Primary actions, links, focus rings |
| **Green** | Open now, Quiet crowd, good weather |
| **Purple** | AI assistant, accents |
| **Pink** | Favourites, Packed crowd, closed |
| **Amber** | *Functional only* — the crowd meter's middle state. Not a brand hue; don't use it decoratively. |
| **Ink** | Text, borders, surfaces |

### Use semantic tokens, never a raw step

```css
color: var(--ss-primary);     /* ✅ */
color: var(--ss-sky-700);     /* ✖ works, but breaks if we retune the scale */
color: #1173B9;               /* ✖ never */
```

| Token | Value | Contrast on white |
|---|---|---|
| `--ss-primary` | sky-700 | 5.03:1 ✅ |
| `--ss-text` | ink-900 | 17.52:1 ✅ |
| `--ss-text-muted` | ink-700 | 6.08:1 ✅ |
| `--ss-success` | green-800 | 5.34:1 ✅ |
| `--ss-warning` | amber-800 | 5.11:1 ✅ |
| `--ss-danger` | pink-700 | 6.78:1 ✅ |
| `--ss-accent` | purple-700 | 9.20:1 ✅ |

Every pair above was measured, not estimated. **`--ss-text-muted` is the
lightest text allowed on white** — ink-600 and lighter fail WCAG AA (4.5:1).

---

## Type scale

Inter, falling back to the system stack. Seven sizes only.

`--ss-text-xs` 12 · `sm` 14 · `base` 16 · `lg` 18 · `xl` 22 · `2xl` 28 · `3xl` 36 · `4xl` 48

Headings are 700 weight, line-height 1.2. Body is 1.6.

---

## Spacing, radius, elevation

- Spacing: `--ss-1` (4px) through `--ss-8` (64px), or Bootstrap's `g-3 / py-4 / gap-2`.
  No arbitrary pixel margins.
- Radius: `--ss-radius-sm` 8px (inputs) · `--ss-radius` 14px (cards) ·
  `--ss-radius-lg` 20px · `--ss-radius-pill` (buttons, chips, badges).
- Shadow: `--ss-shadow-sm` at rest, `--ss-shadow` on hover, `--ss-shadow-lg` for overlays.

---

## Components

Full markup for each is in `style-guide.html`. Summary:

| Class | What it is |
|---|---|
| `.ss-card` | The study-space card. The repeating unit of the catalogue — use this exact structure everywhere a place appears. |
| `.ss-badge` + `--sky/green/purple/pink/amber/neutral` | Describes something (Open now, Wi-Fi, Indoor). Not clickable. |
| `.ss-chip` | A **clickable filter**. State lives in `aria-pressed`, which also drives the styling. |
| `.ss-crowd` + `--quiet/moderate/packed` | Three-state crowd meter from user reports. |
| `.ss-score` + `--high/mid/low` | Suitability ring. Set `--ss-score: 0–100` inline. |
| `.ss-search` | Pill search bar with a focus ring on the whole group. |
| `.ss-weather` | Weather strip (Open-Meteo). |
| `.ss-hero` | Landing hero with the layered brand gradient. |
| `.ss-empty` | Empty state. Every list needs one. |
| `.ss-skeleton` | Loading placeholder. Use while a request is in flight. |
| `.ss-rise` | Staggered entry animation — the proposal's "UI moves when you first load the page". |

### Buttons

`btn btn-primary` (one per view) · `btn btn-outline-primary` · `btn btn-accent`
(AI assistant only) · `btn btn-ghost` (tertiary).

---

## Rules

1. Semantic tokens only — never a raw scale step or a hex literal in a component.
2. Never put text lighter than `--ss-text-muted` on white.
3. One primary button per view.
4. Spacing from the scale, not arbitrary pixels.
5. Every list has three states: loading (`.ss-skeleton`), empty (`.ss-empty`), loaded.
6. Keep the `prefers-reduced-motion` block in `theme.css`. Do not delete it.
7. Keep the shared `:focus-visible` outline. Never `outline: none` without a replacement.
8. Test from **375px (iPhone SE)** to **1200px+ (XL)** in Chrome DevTools — that is
   the range the markers use.
9. Images get `alt`. Icon-only buttons get `aria-label`.
10. Add `data-test="..."` to anything Playwright needs, so tests survive restyling.

---

## Why we customised Bootstrap at all

The course teaches Bootstrap with no customisation. We went further on purpose:
styling is **18% of the final deliverable grade**, and the A+ band asks for
*"a beautiful site that makes effective use of style and is fully responsive"*.
Stock Bootstrap does not get there. The customisation is deliberately thin —
one CSS file, no SCSS, no build change — so it stays easy to explain and
impossible to break.

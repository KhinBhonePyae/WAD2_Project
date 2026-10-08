<!--
  TO INSTALL THIS SKILL
  Copy this file to:   .claude/skills/studyspot-ui/SKILL.md
  (Claude cannot write into .claude/ remotely, so it lives here instead.)

      mkdir -p .claude/skills/studyspot-ui
      cp design/studyspot-ui-SKILL.md .claude/skills/studyspot-ui/SKILL.md

  Each teammate does this once in their own clone. After that, their Claude
  Code / Cowork session picks it up automatically when editing .vue files.
-->

---
name: studyspot-ui
description: Write Vue 3 + Bootstrap markup for the StudySpot SG project (IS216 G10 Team T3) so every teammate's pages match the shared design system and the course's coding conventions. Use whenever adding or editing a .vue component, view, or any UI in this repo.
---

# StudySpot SG — UI conventions

Apply these when writing or editing any UI in this repo. They encode the team's
design system (`design/theme.css`) and the conventions IS216 actually taught.

## Stack, fixed

Vue 3 with `<script setup>` · vue-router · Bootstrap 5.3 · axios · Express +
Mongoose on the API. No TypeScript, no Pinia, no SCSS, no Tailwind, no UI kit.

## Course conventions — follow these exactly

- **`<script setup>` + Composition API.** Never the Options API.
- **`ref()` only.** The course never uses `reactive()`. Use `computed()` and
  `onMounted()` freely.
- **`defineProps`** object form with a type: `defineProps({ place: Object, score: Number })`.
  No `required`, no defaults, no TS types.
- **`defineEmits`** array form with **kebab-case** names: `defineEmits(['toggle-save'])`.
- **Relative imports** (`'../components/PlaceCard.vue'`). The `@` alias exists but
  the course never uses it — don't start now.
- **Views** live in `src/views/` and end in `View` (`CatalogueView.vue`).
  **Reusable components** live in `src/components/` with no suffix (`PlaceCard.vue`).
- **Router**: flat `routes` array, static top-of-file imports, no `name:` property,
  no lazy loading.
- **API calls**: axios with the shared base URL —
  `import { BASE_URL } from '../utils/api.js'` then `axios.get(\`${BASE_URL}/places\`)`.
  Wrap in `try/catch`, log with `console.error`, and always clear a `loading` ref
  in `finally`.
- Server code is **CommonJS** (`require` / `module.exports`). Client code is ESM.

## Design system — never improvise

Import order in `main.js` is Bootstrap CSS → Bootstrap JS → `./assets/theme.css`.

**Colour:** use semantic tokens only.
`var(--ss-primary)`, `--ss-text`, `--ss-text-muted`, `--ss-success`,
`--ss-warning`, `--ss-danger`, `--ss-accent`, `--ss-border`, `--ss-surface`.
Never a raw scale step (`--ss-sky-700`) and never a hex literal inside a component.
`--ss-text-muted` is the lightest text allowed on white.

**Use the existing classes** rather than writing new CSS:

| Need | Use |
|---|---|
| A study space | `.ss-card` with `__media`, `__body`, `__title`, `__foot` |
| Descriptive label | `.ss-badge .ss-badge--sky\|green\|purple\|pink\|amber\|neutral` |
| Clickable filter | `.ss-chip` with `:aria-pressed="isOn"` |
| Crowd level | `.ss-crowd .ss-crowd--quiet\|moderate\|packed` |
| Suitability 0–100 | `.ss-score .ss-score--high\|mid\|low` + `:style="{ '--ss-score': n }"` |
| Search input | `.ss-search` |
| Weather | `.ss-weather` |
| Loading | `.ss-skeleton` |
| Empty list | `.ss-empty` |
| Entry animation | `.ss-rise` on grid items |

Buttons: `btn btn-primary` (one per view), `btn btn-outline-primary`,
`btn btn-accent` (AI assistant only), `btn btn-ghost`.

Layout: Bootstrap grid — `container`, `row g-3`,
`col-12 col-md-6 col-lg-4`. Spacing via Bootstrap utilities or `--ss-1…8`.

## Always do

- Give every list three states: `.ss-skeleton` while loading, `.ss-empty` when
  the result set is empty, cards when loaded.
- Add `data-test="..."` to anything a Playwright test clicks or reads.
- `alt` on every image; `aria-label` on every icon-only button.
- Keep the shared `:focus-visible` outline — never `outline: none` alone.
- Check 375px → 1200px. Markers test with Chrome DevTools across that range.

## Never do

- Invent a colour, radius, shadow or font size outside `theme.css`.
- Add a CSS framework, icon package or component library.
- Use the Options API, `reactive()`, Pinia, or TypeScript.
- Put more than one `btn-primary` in a view.
- Remove the `prefers-reduced-motion` block from `theme.css`.
- Hardcode an API key in client code. Open-Meteo needs none; everything else
  goes through the Express server.

## Who owns what

| Area | Owner |
|---|---|
| Map and location search, Places API | Leong Yew Kai |
| Auth and profile management | Khin Bhone Pyae |
| Study space catalogue and detail pages | Thet Htar Nwe |
| Search, filters, suitability scoring | Gerena Lim |
| Ratings, reviews, crowd reporting | Jeffrey Wen |
| Weather integration, AI assistant | Liew Tian Le |

Stay inside your area unless you've agreed otherwise — six people editing the
same component is how merge conflicts start.

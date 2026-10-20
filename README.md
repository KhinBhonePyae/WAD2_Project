# StudySpot SG

**IS216 — Web Application Development II · Group Project**
Section **G10** · Team **T3**

A web application that helps students discover suitable study locations across Singapore — libraries, cafés, university study areas and other public study spaces.

---

## Links

| | |
|---|---|
| **Source repository** | https://github.com/KhinBhonePyae/WAD2_Project |
| **Deployed application** | ⚠️ **TODO — cloud platform not yet selected.** Required for Week 12 submission. |

> ⚠️ The deployed link and the hosting platform are still undecided. The project proposal lists only "Cloud Deployment Platform". This must be resolved and this section filled in before the Week 12 deadline (Fri 6 Nov, 9:00am).

---

## Overview

### The problem

Students often waste time travelling to study locations only to discover that the environment is unsuitable due to overcrowding, excessive noise, a lack of power sockets or insufficient seating. Information about study locations is also scattered across platforms such as Google Maps, university websites and social media, making it difficult for students to compare locations based on their individual study requirements.

### The solution

StudySpot SG provides a centralized platform where users can browse, search and filter study locations based on facilities, study environment, opening hours and location. The application integrates external APIs to retrieve location information, photographs and weather forecasts, and incorporates a suitability scoring system that evaluates study locations based on users' selected preferences and weather conditions.

Additional features include user accounts, saved places, reviews, crowd-level reporting and an AI-powered assistant that helps users find suitable study locations and answer study-related queries.

---

## Features

1. User authentication and profile management
2. Study place discovery and management
3. Search, advanced filters and suitability scoring
4. Map and location search
5. Ratings, reviews and crowd reporting
6. Saved places and personal preferences
7. Weather integration
8. AI-powered study assistant

---

## Tech stack

| Layer | Technology |
|---|---|
| Markup & styling | HTML, CSS, **Bootstrap** |
| Front-end framework | **Vue.js** (interactive components) |
| Back-end | **Node.js + Express.js** |
| Database | **MongoDB + Mongoose** |
| HTTP client | **Axios** (async requests from the client to our API and to external APIs) |
| Version control | **GitHub** |
| Deployment | ⚠️ **TODO — not yet selected** |
| Testing | **Playwright** (end-to-end) + **Vitest** (unit) |

---

## External APIs

| API | Use | Docs |
|---|---|---|
| **Google Places API (New)** | Primary source of study space data: name, address, coordinates, opening hours and place photos | [Overview](https://developers.google.com/maps/documentation/places/web-service/op-overview) · [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos) |
| **Open-Meteo Weather API** | Current and forecast weather per study-space location, used as an input to the suitability score | [Docs](https://open-meteo.com/en/docs) |
| **Google Maps API / OneMap API** *(tentative)* | Map rendering and location search | [OneMap](https://www.onemap.gov.sg/apidocs/) |
| **LLM chatbot — Claude API / OpenAI GPT API** | AI study assistant: recommendations and general study-related questions | [Claude keys](https://platform.claude.com/settings/keys) · [OpenAI keys](https://platform.openai.com/api-keys) |

### API cost controls

The Google Places API requires a Google Cloud **billing account**, and both the Claude and OpenAI APIs are **paid**. The application must remain running and operational for grading until Week 18, so the following controls apply:

- **One nominated owner per paid account.** Record who owns each below.
- **Hard spend cap / quota limit** set in each provider console, so a runaway loop cannot drain credit.
- **Cache Places API responses into MongoDB** on first fetch. Repeat page views read from our own database rather than re-calling the API. This protects both cost and the grading window.
- **Graceful fallback for the AI assistant.** If the LLM key fails, is rate-limited or runs out of credit, the assistant returns a clear message and the rest of the application continues to work. The assistant must never block a core user journey.

| Service | Account owner | Spend cap |
|---|---|---|
| Google Cloud (Places API) | *TODO* | *TODO* |
| Claude / OpenAI API | *TODO* | *TODO* |

---

## Data stores

MongoDB collections, per the project proposal:

| Collection | Contents |
|---|---|
| **Users** | User IDs, names, email addresses, hashed passwords and study preferences |
| **Study Spaces** | Study space IDs, names, addresses, locations, opening hours, descriptions and facility information |
| **Reviews and Ratings** | User-submitted reviews, ratings, associated study locations, submission dates |
| **Crowd Reports** | Reported crowd levels, associated study locations and submission dates |
| **Saved Places** | User IDs and references to their saved study locations |

---

## Repository structure

> Mirrors the `client/` + `server/` layout used in the IS216 course scaffold (see the Week 5 and Lab Test projects).

```
WAD2_Project/
├─ client/                 # Vite + Vue 3 single-page application
│  ├─ e2e/                 # Playwright end-to-end specs
│  ├─ src/
│  ├─ playwright.config.js
│  ├─ vitest.config.js
│  └─ package.json
├─ server/                 # Express + Mongoose REST API
│  ├─ models/
│  ├─ routes/
│  ├─ server.js
│  └─ package.json
└─ README.md
```

---

## Prerequisites

- **Node.js** — `^22.18.0 || >=24.12.0` (as required by the course Vue scaffold)
- **npm** (or pnpm)
- A **MongoDB** connection string (local `mongod` or a hosted cluster)
- API keys — see [Environment variables](#environment-variables)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/KhinBhonePyae/WAD2_Project.git
cd WAD2_Project
```

### 2. Install dependencies

The team uses **pnpm** (install it once with `npm install -g pnpm`). npm still works too: swap `pnpm` for `npm` / `pnpm <script>` for `npm run <script>` in any command below.

```bash
cd client && pnpm install
cd ../server && pnpm install
```

### 3. Environment variables

Copy `server/config.env.example` to `server/config.env` and fill it in. The server only ever reads `server/config.env` (found relative to the server folder, so it works whichever folder you start it from); the `.example` file is just the template.

```
DB=<your MongoDB Atlas connection string>
JWT_SECRET=<any long random string>
GEMINI_API_KEY=<Google Gemini key>
ONEMAP_EMAIL=<OneMap account email>
ONEMAP_PASSWORD=<OneMap account password>
```

| Key | Required? | What happens without it |
|---|---|---|
| `JWT_SECRET` | **Yes** | Sign-up and login fail with a 500 error. |
| `GEMINI_API_KEY` | No | The AI study assistant replies that it isn't switched on. |
| `ONEMAP_EMAIL` + `ONEMAP_PASSWORD` | No | Directions on the map are unavailable. With them, the server fetches a new OneMap token by itself before the old one expires (tokens last 3 days). Finding a place on the map needs no key. |
| `ONEMAP_TOKEN` | No | Fallback used only when the OneMap account details are empty. Stops working after 3 days. |
| `DB` | No | The server starts in **mock mode**: places load from `server/data/places.json`, and users and reviews are kept in memory (lost on restart). `GET /health` reports which mode is active. |

If `DB` is set but `/health` still reports `mock`, check that your IP is on the Atlas **Network Access** allowlist.

The server always runs on port 8000. The client needs no env file — the API base URL is set in `client/src/utils/api.js`.

> `config.env` is git-ignored and must **never** be committed. The repo is public at submission, so a committed password is a public password. Copy `server/config.env.example` and fill it in. Keys are shared within the team privately.
> Open-Meteo requires no API key.

---

## Running the application

Two terminals:

```bash
# Terminal 1 — API
cd server
pnpm dev             # http://localhost:8000

# Terminal 2 — client
cd client
pnpm dev             # http://localhost:5173
```

Open **http://localhost:5173** — this is the first page of the application.

Production preview:

```bash
cd client
pnpm build
pnpm preview         # http://localhost:4173
```

---

## Testing

The project uses the testing setup that ships with the course Vue scaffold.

### End-to-end tests (Playwright)

```bash
cd client
pnpm exec playwright install chromium   # first run only — downloads the test browser
pnpm test:e2e
```

Specs live in `client/e2e/`. Playwright starts the dev server automatically (`http://localhost:5173`) and runs against Chromium. Configuration is in `client/playwright.config.js`.

Useful variations:

```bash
pnpm test:e2e --debug                         # step through interactively
pnpm exec playwright show-report              # open the HTML report
```

> Start the API first (`cd server && pnpm dev`): Playwright starts the client by itself but not the API. The API server must be running and the database reachable for end-to-end tests that hit live data.

### Unit tests (Vitest)

```bash
cd client
pnpm test:unit
```

### Core user journeys covered

| # | Journey | Status |
|---|---|---|
| 1 | Register, log in, log out | *TODO* |
| 2 | Browse the study space catalogue and open a place detail page | *TODO* |
| 3 | Search and apply advanced filters | *TODO* |
| 4 | Submit, edit and delete a review | *TODO* |
| 5 | Submit a crowd-level report | *TODO* |
| 6 | Save and remove a favourite place | *TODO* |

> Each team member writes the end-to-end tests for the feature they own. Use stable `data-test` attributes as selectors rather than CSS classes, so tests do not break when styling changes.

---

## Test accounts

> ⚠️ **TODO** — seeded demo credentials must be listed here before submission.

| Role | Email | Password |
|---|---|---|
| Standard user | *TODO* | *TODO* |

---

## Deployment

> ⚠️ **TODO — platform not yet selected.**
>
> Required before Week 12: the hosting platform, the deployment steps, and the live URL. The project briefing states that if the instructional team cannot deploy the application by following these instructions, the final application is treated as not fully working — so this section must be written and verified by someone following it from scratch.

---

## Use of AI / LLM tools

Per IS216 Group Project FAQ 20.

**Permitted** — information search; generating website concepts, layouts or themes; exploring UI/UX design inspiration; explaining coding errors and debugging hints; boilerplate and starter code snippets; generating unit test cases, sample inputs or mock data.

**Not permitted** — core implementation (main business logic, backend endpoints, critical frontend interactivity); problem solving, where students must demonstrate their own capability rather than relying on automated AI fixes.

### Declaration

Parts of this project that rely **solely** on AI/LLM generation:

| Area / file | What was AI-generated | Member |
|---|---|---|
| *TODO — complete as development progresses* | | |

> Note: the AI study assistant is a **product feature** that calls an LLM API at runtime. That is separate from this declaration, which covers AI assistance used while writing the code.

---

## Team and task allocation

| # | Name | Email ID | Responsibility |
|---|---|---|---|
| 1 | Leong Yew Kai | yk.leong.2025 | Location search, including location-based search, and Google Places API integration |
| 2 | Khin Bhone Pyae | bp.khin.2025 | User authentication and profile management, including registration, login, logout, profile updates, account deletion and saved user preferences |
| 3 | Thet Htar Nwe | hn.thet.2025 | Study space catalogue and management, including listing and detail pages, facility information, image carousel, CRUD functionality and responsive Vue/CSS interface development |
| 4 | Gerena Lim | gerena.lim.2025 | Search, advanced filters and suitability scoring, including filtering study spaces by facilities, study preferences and location suitability |
| 5 | Jeffrey Wen | jeffrey.wen.2025 | Ratings, reviews and crowd reporting, including creating, viewing, editing and deleting reviews, calculating ratings and displaying user-reported crowd levels |
| 6 | Liew Tian Le | tianle.liew.2024 | Weather API integration, weather-based suitability information and AI-powered study assistant development |

---

## Design

Colour palette: Sky Blue, Light Green, Light Purple, Light Pink.

Responsive design is tested with Chrome DevTools from iPhone-class widths up to the Bootstrap XL breakpoint.

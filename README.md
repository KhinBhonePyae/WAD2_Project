# LockedIN

IS216 Web Application Development II, Group Project, Section G10, Team T3

LockedIN helps students in Singapore find a good place to study. You can browse and filter libraries, cafés and study spaces by facilities, opening hours, crowd level and distance, see a suitability score based on your preferences and the live weather, read and write reviews, report how busy a place is, get directions and ask an AI study assistant for suggestions.

## Links

| | |
|---|---|
| Live application | https://lockedin-bice-three.vercel.app |
| Source repository | https://github.com/KhinBhonePyae/WAD2_Project |
| API server | https://lockedin-api-oxey.onrender.com |

The API is on Render's free plan, so the first request after a quiet period can take 30 to 60 seconds while it wakes up.

## Test accounts

| Role | Email | Password |
|---|---|---|
| Standard user | `Rubert@gmail.com` | `12345678` |
| Admin | `demo.admin@lockedin.test` | `LockedIN-Admin-2026` |

The admin account can also open the Manage, Users and Reports pages. You can sign up for a new account too.

## Deployment instructions (run it locally)

You need Node.js `^22.18.0 || >=24.12.0` and pnpm (`npm install -g pnpm`). npm also works, just use `npm install` and `npm run <script>` instead of `pnpm`.

1. Unzip the project (or `git clone https://github.com/KhinBhonePyae/WAD2_Project.git`) and open a terminal in the `WAD2_Project` folder.

2. Install the packages:

```bash
cd client
pnpm install
cd ../server
pnpm install
```

3. Copy `server/config.env.example` to `server/config.env` and fill in these values:

```
DB=<MongoDB Atlas connection string>
JWT_SECRET=<any long random string>
GEMINI_API_KEY=<Google Gemini key>
ONEMAP_EMAIL=<OneMap login email>
ONEMAP_PASSWORD=<OneMap login password>
```

`DB` connects to our shared database, which has all 159 study spaces and the test accounts below. Most reviews in it are demo data from `server/seed-reviews.js`, so every place has ratings and crowd levels. Without `DB`, the server still starts but in mock mode, with only 5 sample places and no test accounts. Without `GEMINI_API_KEY` the AI assistant is off, and without the OneMap login the map works but directions don't.

4. Start the API in one terminal:

```bash
cd server
pnpm dev
```

It runs on http://localhost:8000. Opening http://localhost:8000/health should show `{"ok":true,"mode":"mongodb"}`.

5. Start the website in a second terminal:

```bash
cd client
pnpm dev
```

6. Open http://localhost:5173, which is the home page of the app.

## Deployment instructions (online)

This is how the live version is hosted, if you want to deploy your own copy.

API on Render: create a Web Service from the GitHub repo with Root Directory `server`, Build Command `npx --yes pnpm@12.3.4 install --frozen-lockfile`, Start Command `npm start` and Health Check Path `/health`. Add `DB`, `JWT_SECRET`, `GEMINI_API_KEY`, `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` as environment variables. In MongoDB Atlas, Network Access must allow `0.0.0.0/0`, because Render's free plan has no fixed IP.

Website on Vercel:

```bash
cd client
npx vercel link
npx vercel env add VITE_API_BASE_URL production    # the Render URL, no trailing slash
npx vercel --prod
```

## How to use the app

Open https://lockedin-bice-three.vercel.app (or http://localhost:5173 if you're running it locally). The first load can take up to 60 seconds while the API wakes up.

### Account

1. Press Sign up in the navigation bar, or press "Yes" under "Ready to lock in?" at the bottom of the home page. You can also log in with one of the test accounts above.
2. Enter your details and your study preferences (favourite kinds of spot and must-haves like Wi-Fi, sockets or quiet), then create the account. You're taken to the home page.
3. On the Profile page you can edit your name, email and study preferences, change your password, log out or delete your account.

### Home page

1. Vibe check: switch between the "Deep focus", "Group grind", "Coffee & cram" and "Night owl" cards to see places that suit that kind of session. Press "Browse all 159 spots" to see the full list.
2. Explore by area: scroll through the area cards (Raffles Place, Orchard, Bugis and more) and pick one to see the spots in that area.
3. Global chat: the green globe button at the bottom left opens a chat room for logged-in users.
4. Locker Bot: the purple robot button below it opens the AI study assistant. Ask it to find a spot or plan a study session.
5. Saving a spot: press the heart on any place card. Your saved places are under the Saved icon in the navigation bar (Saved Places in the phone menu).

### Browse page

Open it from Browse in the navigation bar, from "Browse all 159 spots", or by searching from the home page.

1. Search bar: the list updates as you type.
2. Weather: the live weather for central Singapore shows at the top and as the page background, and it affects each place's suitability score.
3. Filters: filter by facilities, area, crowd level, rating, open now, free entry, indoor or outdoor, and distance from you.
4. Places: all 159 study spots, from cafés and study spaces around SMU to public libraries across Singapore, 12 per page. Places that match your favourite kinds of spot come first.

### Place page

Click any place to open its page.

1. Details: name, address, rating, crowd level, opening hours, whether it's open now, facilities, tags and photos.
2. Planning to go: say you're going today or tomorrow in a time slot, and see how busy that slot is likely to be.
3. Community insights ("How busy is it?"): see how busy the place is from recent reports and reviews. If you're there, tap Quiet, Moderate or Packed to report it, and change or undo it within the hour.
4. Reviews: read other users' reviews, and write, edit or delete your own.
5. Map and directions: see the place on a map and get directions by walking, car, bus or train.
6. Report incorrect information: tell the admins if something about the place is wrong.

### Admin pages

Log in as the admin test account to see Manage, Users and Reports in the navigation bar.

1. Manage: add, edit and delete study spaces.
2. Users: promote or demote users and delete accounts.
3. Reports: see the incorrect-information reports, then resolve, reopen or delete them.

## Testing

| Tests | Command | Count |
|---|---|---|
| Client unit and component tests (Vitest) | `cd client` then `pnpm test:unit -- --run` | 326 |
| Server tests (Node test runner, mock mode) | `cd server` then `pnpm test` | 47 |
| End-to-end tests (Playwright) | `cd client` then `pnpm test:e2e` | 34 |

The unit, component and server tests don't need a database. For the end-to-end tests:

1. Start the API first (`cd server && pnpm dev`). Playwright starts the client by itself.
2. Run `pnpm exec playwright install chromium` once to download the test browser.
3. Set the admin login in the same terminal:

```powershell
$env:E2E_ADMIN_EMAIL = "demo.admin@lockedin.test"; $env:E2E_ADMIN_PASSWORD = "LockedIN-Admin-2026"
```

```bash
export E2E_ADMIN_EMAIL=demo.admin@lockedin.test E2E_ADMIN_PASSWORD=LockedIN-Admin-2026
```

The end-to-end tests cover these user journeys:

| # | Journey | Test file |
|---|---|---|
| 1 | Sign up, log in, log out | `accounts.spec.js` |
| 2 | Browse places and open a place page | `reviews.spec.js`, `search.spec.js`, `carousel.spec.js` |
| 3 | Search and filter | `search.spec.js`, `reviews.spec.js` |
| 4 | Post, edit and delete a review | `reviews.spec.js` |
| 5 | Report the crowd level | `crowd.spec.js` |
| 6 | Save and remove a place | `saved.spec.js` |
| 7 | Report wrong information, and an admin resolves it | `reports.spec.js` |
| 8 | Admin creates, edits and deletes a study space | `admin-places.spec.js` |
| 9 | Admin promotes, demotes and deletes users | `admin-users.spec.js` |

## Use of AI / LLM tools

Following FAQ 20, each of us lists the parts we wrote with AI tools. If a member used no AI for their area, their row says so.

| Member | Area / files | How AI was used |
|---|---|---|
| Jeffrey Wen | Crowd check-ins and the "How busy is it?" card (`checkin-model.js`, `crowd-controller.js`, `crowd-routes.js`, `CrowdHistogram.vue`, `crowd.js`) | Written with Claude Code, then reviewed and tested by Jeffrey |
| Jeffrey Wen | Favourite spots and preference ordering (`studySpots.js`, sign-up, profile, home, Browse), star picker (`StarPicker.vue`), review pagination, weather background (`WeatherBackdrop.vue`), "Nearby" tags, walking-route steps, admin route guard | Written with Claude Code, then reviewed and tested by Jeffrey |
| Jeffrey Wen | Bug fixes from the team code audits (20 to 21 Oct, 25 Oct and 4 Nov), including `place-summary.js`, reviews, places, users, search, map routes, the AI assistant and API error handling | Found and fixed with Claude Code, then reviewed and tested by Jeffrey |
| Jeffrey Wen | Tests (unit, component, server and end-to-end for these features), chat button behaviour (`AssistantBubble.vue`, `WorldChat.vue`), styling fixes on place cards, library credit comments (FAQ 6), pnpm setup and this README | Written with Claude Code, then checked by Jeffrey |
| Leong Yew Kai | Location search and Google Places import (`HomeView.vue`, `PlaceCard.vue`, `SearchFilters.vue`, `import-google-places.js`, `import-libraries.js`, `place-model.js`), responsive sizing | *To be filled in by Yew Kai* |
| Khin Bhone Pyae | User authentication, account and profile management, including registration, login/logout, profile and information updates, password change, account deletion and study preferences (`SignUpView.vue`, `LoginView.vue`, `ProfileView.vue`, `server/controllers/users-controller.js`, `server/routes/users-routes.js`, `server/models/user-model.js`) | Used Claude for debugging, explaining errors, reviewing code and suggesting UI/UX improvements, then reviewed, integrated and tested by Khin |
| Khin Bhone Pyae | Saved places and related user flows, including connecting the heart/save controls to authenticated save/remove actions, displaying saved study spaces and integrating the Saved page into navigation (`SavedView.vue` and backend routes/controllers) | Used Claude for debugging, resolving frontend-backend integration issues and suggesting UI improvements, then reviewed and tested by Khin |
| Khin Bhone Pyae | Admin user management and UI/testing improvements, including viewing users, promoting/demoting users, deleting users, protecting admin actions, and Playwright E2E coverage for account, saved-place and admin-user flows (`AdminUsersView.vue`, user management backend files, `client/e2e/accounts.spec.js`, `client/e2e/saved.spec.js`, `client/e2e/admin-users.spec.js`, `client/playwright.config.js`) | Used Claude/ChatGPT for debugging UI and integration issues, explaining Playwright failures, suggesting test cases and improving test configuration, and all changes and tests were reviewed and verified by Khin |
| Thet Htar Nwe | Study-space catalogue and place details (`client/src/views/PlaceDetailView.vue`, catalogue UI, `server/data/places.json`, and place image assets), including image carousel, facilities, opening hours and responsive design | Used Claude Code for debugging, UI improvements and troubleshooting, then reviewed and tested by Thet |
| Thet Htar Nwe | Study-space management and place data/API integration (`client/src/views/AdminPlacesView.vue`, `client/src/views/PlaceFormView.vue`, `server/models/place-model.js`, `server/controllers/places-controller.js`, `server/routes/places-routes.js`), including CRUD operations and form validation | Used Claude Code for debugging, code explanations and troubleshooting, then reviewed and tested by Thet |
| Thet Htar Nwe | Admin user management (`client/src/views/AdminUsersView.vue`), including user management, role changes, account deletion and admin functionality | Used Claude Code for debugging and fixing issues, then reviewed and tested by Thet |
| Thet Htar Nwe | Report Issue feature (`client/src/components/ReportIssue.vue`, user-facing report submission and admin report-management integration), including form validation, login handling and submission feedback | Used Claude Code for debugging, validation checks and troubleshooting, then reviewed and tested by Thet |
| Thet Htar Nwe | Automated testing: end-to-end tests (`client/e2e/admin-places.spec.js`, `client/e2e/admin-users.spec.js`, `client/e2e/carousel.spec.js`, `client/e2e/reports.spec.js`), component tests (`client/src/components/__tests__/ReportIssue.spec.js`, `client/src/views/__tests__/AdminReportsView.spec.js`), and server tests (`server/tests/report-model.test.js`, `server/tests/reports-integration.test.js`), covering admin place management, user management, image carousel, report submission, validation, authentication, API integration and admin reporting workflows | Used Claude Code to generate test cases and debug failures, then run and verified by Thet |
| Thet Htar Nwe | UI improvements, bug fixes and feature testing (study-space catalogue, place details, image carousel, search filters, admin management and reporting workflows) | Used Claude Code for troubleshooting and debugging, then reviewed and tested by Thet |
| Gerena Lim | Search, filters and suitability (`SearchView.vue`, `SearchFilters.vue`, `CatalogueView.vue`, `searchFilters.js`, `WeatherScene.vue`), most unit and component tests, `search.spec.js` | *To be filled in by Gerena* |
| Liew Tian Le | Weather and AI assistant (`ai-routes.js`, `AssistantBubble.vue`, `world-chat-routes.js`), OneMap map and directions (`PlaceMap.vue`, `onemap-auth.js`, `places-controller.js`) | *To be filled in by Tian Le* |

## Team

| Name | Responsibility |
|---|---|
| Leong Yew Kai | Location search and the Google Places API |
| Khin Bhone Pyae | Accounts and profiles |
| Thet Htar Nwe | Study space catalogue, place pages and admin management |
| Gerena Lim | Search, filters and suitability scoring |
| Jeffrey Wen | Reviews, ratings and crowd reporting |
| Liew Tian Le | Weather and the AI study assistant |

# Local Business Demos · Punjab

A portfolio of **three fictional local-business demos** for Punjab, India. Each demo has:

- a **public website** (mobile-first, fast, English / हिंदी / ਪੰਜਾਬੀ), and
- an **owner app**: an installable, offline-first PWA that runs the business's daily work.

| Demo | Public site | Owner app (demo PIN **1234**) | What the app does |
|---|---|---|---|
| **IronCore Fitness Club** (gym) | `/gym/` | `/gym/app/` | Members, fees and receipts, renewals with partial payments and late fees, freezes, attendance, WhatsApp reminder queues, reports, CSV export |
| **Spice Route Rasoi** (restaurant) | `/restaurant/` | `/restaurant/app/` | Orders board (website cart → kitchen), menu manager, table bookings, KOT and bill printing, sales charts, customers, menu QR code |
| **Shree Heera Jewellers** | `/jewellers/` | `/jewellers/app/` | Daily gold/silver rates (every price recomputes), stock, customer ledgers, gold savings schemes, orders and repairs, birthday/anniversary wishes, item cards as images |

All businesses, people, phone numbers, prices, reviews and photos are **fictional**. Nothing in this repo is a real brand, logo, person, phone number, email or address.

Plain **HTML, CSS and vanilla JavaScript**. No frameworks, no build step, no backend.

---

## Run it locally

Service workers and ES modules need a web server (opening the files with `file://` will not work).

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. Any static server works (`npx serve`, nginx, etc.).

Run the unit tests (Node 18+; no dependencies to install):

```bash
npm test
```

## Deploy

`.github/workflows/pages.yml` runs the tests and deploys the repo to **GitHub Pages** on every push to `main`.
All links are relative, so the site works under `https://<user>.github.io/local-business-demos/`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

---

## Folder layout

```
index.html                 hub page (one card per demo + "what a client gets")
js/config.js               WHATSAPP_NUMBER, CONTACT_EMAIL, ADDRESS, MAPS_URL placeholders
js/i18n-*.js               all labels: hub, gym, gym-app, restaurant, restaurant-app, jewellers, jewellers-app
shared/                    code shared by every site and app
  tokens.css fonts.css     design tokens, base styles, self-hosted fonts (font-display: swap)
  app.css                  owner-app UI kit (bottom nav, cards, chips, sheets, PIN screen, print)
  dates.js                 calendar-date maths ('YYYY-MM-DD', DST-proof) + EN/HI/PA formatting
  storage.js               versioned localStorage store: migrations, JSON export/import, demo reset
  i18n.js                  tiny i18n helper (EN/हिं/ਪੰ switch, fallback to English)
  wa.js                    WhatsApp click-to-chat (wa.me) link builder
  qr.js                    QR code generator (no library) — used for the restaurant menu QR
  chart.js csv.js ui.js    inline-SVG charts, CSV export, DOM helpers, image sharing
  pin.js pwa.js sw-core.js demo PIN lock, service-worker registration, shared SW logic
gym/  restaurant/  jewellers/   each: index.html (site), css/, js/, app/ (owner PWA)
  <demo>/app/manifest.json + sw.js   PWA manifest and service worker scoped to that app folder
tests/                     node:test unit tests
tools/                     QA helpers: screenshots, overflow check, PWA icon generator
```

## The owner apps

All three apps share the same pattern:

- **Demo PIN screen** (`1234`, shown on screen while it is still the default). It is a convenience lock for a shared phone, not security.
- **Bottom navigation, big buttons, sticky primary action** (the round button above the nav), designed for a 360 px phone.
- **Works offline**: the service worker pre-caches the whole app on first visit. Install it with the browser's “Add to Home screen” / “Install app” (also offered in Settings when the browser supports it).
- **Demo data**: on first open each app seeds realistic fictional data, generated *relative to today* so the demo always looks current (members due this week, today's orders, schemes due…). Every screen is marked **Demo data**, and Settings has **Reset demo data**.
- **Backup / restore** as JSON (Settings), and CSV exports in the gym reports.
- **Everything recalculates by itself**: on every open, at midnight, and when the app comes back to the foreground on a new day.

### Gym — “add a member once, everything else runs by itself”

1. **Add member**: one short form (name, phone, optional photo/gender/birthday, plan, start date, amount paid, Cash/UPI/Card, notes). An ID like `IC0043` and a receipt are created.
2. **Automatic status** for every member: expiry date, days left, *Active*, *Due soon* (≤ 5 days, configurable), *Overdue* (“N days late”), *Expired* (after the overdue window), *Frozen*, *Left*; pending balance, next due date, member since, last payment, total paid.
3. **Fees**: ledger per member with receipt numbers and the period each payment covers. **Renew / Mark paid** continues from the old expiry (no lost or free days) or restarts today if the plan has fully lapsed; supports partial payments (balance carried forward), discounts and an optional late fee after X days late. Receipts print as clean HTML or share as a PNG image.
4. **Attendance**: type name/phone/ID (Enter checks in the first match) or tap a big button; “usually here around now” suggestions; duplicate check-ins blocked; clear warning for expired/frozen members with “Renew now”; per-member calendar and streak; lists of *not visiting for 7+ days* and *expired members who still visited*.
5. **Freeze**: pick a start date and days; the expiry moves automatically and the freeze is kept in history.
6. **Dashboard** cards (collection, active, due this week, overdue amount, today's check-ins, new joins, expiring soon, inactive, birthdays) — tap any card for the filtered list.
7. **Reminders**: auto-built queues (due soon, overdue, expired, inactive, birthdays). Each row opens WhatsApp with a ready message (name, amount, date) in English, Hindi or Punjabi. **Send one by one** walks the queue and marks each person *reminded today*, so nobody gets messaged twice.
8. **Reports**: monthly collection chart, payment modes, members by plan, dues list, members who left, CSV export of members / payments / attendance, printable member statement (from a member's profile).
9. **Members list**: search, status pills, plan filter, sort, quick actions (call, WhatsApp, renew, check in), profile with payments, attendance calendar and a timeline of joins, payments, freezes, reminders and visits.
10. **Settings**: gym name, plan names/months/prices, due-soon days, overdue→expired window, late fee and when it applies, inactive days, language, PIN, backup/restore, reset.

### Restaurant

The public site and the owner app share one store, so **orders placed from the website cart appear on the owner's orders board** (open both in the same browser to see the loop; the board updates live across tabs). The owner can mark dishes sold out or “Today's special” and the website menu follows. The app has the orders board (New → Preparing → Ready → Delivered / Cancelled), counter orders, “your order is ready” WhatsApp messages, printable KOT and bill, bookings, daily sales and best sellers (SVG charts), customers with repeat-order counts, and a **menu QR code generated in the browser** (no external service).

### Jewellers

The owner enters today's **gold 24K/22K/18K (per 10 g) and silver (per kg)** rates; every item price is recomputed (weight × rate + making % + stones, + 3 % GST), and the public site's **Today's rate** widget and collection prices update. The app also keeps **customer ledgers** (purchases, payments, balance, WhatsApp balance reminder), a **gold savings scheme** tracker (“pay 11, shop adds the 12th”: paid/pending, next due, overdue days, maturity date and value, one-tap instalment entry and WhatsApp reminders), **custom orders and repairs** with promised dates and a “ready” WhatsApp message, **birthday/anniversary wishes**, **share an item card as an image**, and a simple monthly sales chart.

---

## Reusing a demo for a real client

1. Copy the demo folder (e.g. `gym/`) plus `shared/` and `js/` into a new repo.
2. Edit **`js/config.js`**: paste the client's WhatsApp number (with country code, e.g. `9198…`), email, address and Google Maps link. Anything still starting with `PASTE_` is hidden automatically — no placeholder text ever shows. Until a number is set, WhatsApp buttons open WhatsApp's contact picker with the message ready.
3. Change the business name and texts in `js/i18n-<site>.js` (all three languages sit side by side), and the colours in `<demo>/css/site.css` and `<demo>/app/css/app.css`.
4. Replace the illustrations with real photos (restaurant and jeweller items already accept a photo URL in the owner app).
5. To start a real client with **no sample data**, make the demo's seed function (`gym/app/js/seed.js` → `seedGym`, `restaurant/js/data.js` → `seedRestaurant`, `jewellers/js/data.js` → `seedJewellers`) return empty lists and remove the “Demo data” strip; then set real plans/prices/PIN in Settings.
6. Regenerate icons with `node tools/make-icons.cjs` after changing colours/initials.

### What “demo data” means

The sample members, orders, customers and schemes are made up and regenerated relative to today, so they never go stale. Sample phone numbers start with **5**, which no Indian mobile number does, so tapping WhatsApp in the demo can never message a real person. Demo data lives only in your browser; “Reset demo data” replaces it with a fresh sample.

## Honest limits

- **Data lives in the browser (localStorage)** on one device. Clearing browser data deletes it, and two phones do not sync. Take regular JSON backups. localStorage holds roughly 5 MB per site — enough for years of a small business's records, but member photos are shrunk to small thumbnails for this reason.
- **No server means no automatic messages.** Reminders, receipts and order updates open WhatsApp with a pre-filled message; a person taps *Send*. Nothing is sent in the background, and the demo cannot know whether a message was actually delivered.
- **The PIN is not security.** Data is not encrypted; anyone with the unlocked phone and browser can read it.
- Website forms (free trial, bookings, viewings) are demos: they save to the same browser and offer a WhatsApp hand-off; they do not email anyone.
- Gold/silver rates are typed in by the owner; there is no live market feed.

## Production upgrade path

1. **Supabase** (Postgres + Row Level Security) as the backend: one table per entity (members, payments, attendance…), the same JSON shapes as today. The `shared/storage.js` interface (`load`, `update`, `exportJSON`, `importJSON`) becomes a thin sync layer, keeping offline-first behaviour with a local cache and background sync.
2. **Auth**: Supabase Auth with phone OTP for the owner and optional staff logins with roles (front desk can check in and collect fees, only the owner sees reports).
3. **Automatic WhatsApp messages**: a scheduled job (Supabase Edge Function + cron) builds the same reminder queues server-side and sends approved message templates through the **WhatsApp Business (Cloud) API**, recording delivery status so the “reminded today” mark becomes real.
4. **Online payments**: UPI payment links / payment gateway webhooks that mark fees, orders and instalments as paid automatically.
5. Real photos on a CDN, a custom domain, and analytics.

---

## Tests

`npm test` runs Node's built-in test runner over `tests/` (no dependencies):

- `dates.test.js` — day/month arithmetic (month-end clamping, leap years, DST-safe), anniversaries incl. 29 Feb, Punjabi date formatting.
- `gym-logic.test.js` — expiry, due-soon window, overdue days and expired, freeze shifting expiry, renewal start date, partial payments and balance, discounts, late fee rules, streaks, inactivity, visits after expiry, reminder queues, monthly collection.
- `restaurant-logic.test.js` — cart, GST/delivery totals, WhatsApp order text, daily sales, best sellers, customers.
- `jewellers-logic.test.js` — rate per gram, price breakup, **gold-rate price recompute**, **savings-scheme dues** (on track / due soon / due / overdue / completed / matured), ledger balance, late jobs, occasions.
- `storage.test.js` — **schema migration**, seeding, **export/import round-trip**, importing older versions, wrong-app protection, corrupt data recovery, WhatsApp link building, CSV quoting.
- `i18n.test.js` — every English label has a Hindi and Punjabi translation with the same `{placeholders}`.

The QR encoder was additionally verified by decoding generated codes (all four error-correction levels, versions 1–20, ASCII and Gurmukhi/Devanagari text) with the `jsqr` library during development.

## Lighthouse (measured, mobile)

Measured with **Lighthouse 13.6.0** (default mobile emulation: Moto G-class device, simulated slow 4G), served locally with `python3 -m http.server`, Chromium headless. Three runs per page; the table shows the range. These are real local measurements, not GitHub Pages measurements — scores on a live host will vary with network and server.

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Hub `/` | 98–100 | 100 | 100 | 100 | 0.9 s | 0 ms | 0.005–0.097 |
| Gym `/gym/` | 98–100 | 100 | 100 | 100 | 1.1 s | 50–160 ms | 0 |
| Restaurant `/restaurant/` | 99 | 100 | 100 | 100 | 1.1 s | 140–150 ms | 0.032 |
| Jewellers `/jewellers/` | 100 | 100 | 100 | 100 | 1.1 s | 50–90 ms | 0.017 |

Owner apps were not Lighthouse-scored (they sit behind the PIN screen); they were checked by hand at 360 px, 414 px and desktop.

## QA

Screenshots of every main screen were taken at **360 px, 414 px and 1280 px** in **English, Hindi and Punjabi** with `tools/shoot.cjs` (Playwright), and reviewed for cramped layouts, overflow and broken matras. `tools/overflow.cjs` checks for horizontal page overflow. Fixes made during review are listed in the pull request.

Fonts: Inter, Bebas Neue, Fraunces, Cormorant Garamond, Noto Sans Devanagari and Noto Sans Gurmukhi — all SIL Open Font License, self-hosted under `shared/fonts/`.

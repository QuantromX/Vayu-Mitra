# VayuMitra (वायुमित्र) — Breath Companion for Indian Families

![CI](https://img.shields.io/badge/CI-lint%20%7C%20typecheck%20%7C%20test%20%7C%20build-10b981)
![Tests](https://img.shields.io/badge/Tests-32%2F32%20passed%20(7%20suites)-0ea5e9)
![Accessibility](https://img.shields.io/badge/WCAG%202.1-AA-6366f1)

VayuMitra turns **live Open-Meteo air-quality & weather telemetry** into personalized, explained household action plans for Indian families — combining an **India NAQI engine**, an interactive **24-hour forward Time Scrubber**, grounded **Ask VayuMitra Q&A**, privacy-preserving **Photo Check**, and transparent **Data Confidence** disclosures in English and Hindi (हिन्दी).

---

## Problem Statement

Most air-quality apps stop at raw AQI numbers (`"245 — Poor"`) without explaining what a specific family should actually do right now: whether kids can play after school, when the lowest-pollution window arrives today or tomorrow, whether N95 protection applies in Moderate air for seniors, where to place a purifier, or how to adapt daily commutes. VayuMitra bridges that gap with zero invented data and deterministic offline resilience.

---

## Core Features

1. **India CPCB NAQI Engine (`src/lib/naqi/naqi.ts`)**: Linearly interpolates official PM2.5 (`0–380 µg/m³`) and PM10 (`0–510 µg/m³`) breakpoints, selects the dominant pollutant, computes rolling 24h or current readings, and scans strictly forward (`Today` / `Tomorrow`) for the cleanest and worst 3-hour windows.
2. **Dynamic Weather & Haze Hero + 24h Time Scrubber**: Animated NAQI ring gauge, city-aware 3-layer SVG Indian skylines (Delhi, Mumbai, Lucknow, Kolkata, general), lazy-loaded atmospheric `<canvas>` particle haze/rain/stars, and an accessible 24-hour scrub slider (`[ / ]` or drag) updating the Hero live.
3. **Personalized Action Plan + "Today's Plan" Tracker**: Collapsible household profile (`CitySearch`, sensitive groups, commute lifestyle, HEPA purifier toggle, plus **"Try a sample"** menu with 8 Indian household presets), checkable action items with expandable `"Why this?"` reasoning, and 1080×1350 PNG **Share Air Card** export.
4. **Ask VayuMitra (`POST /api/ask`)**: Natural-language household Q&A chips and custom input returning `{ verdict: yes|no|caution, answer, why, bestTime, dataUsed }` grounded strictly in live Open-Meteo metrics.
5. **Photo Check (`POST /api/photo-check`)**: Upload or capture a room/sky photo (`jpeg`/`png`/`webp`, `<= 4 MB`). All EXIF/GPS metadata is stripped locally on an offscreen `<canvas>` before upload; Gemini Vision returns visual purifier placement, ventilation tips, and confidence (`low`/`medium`/`high`).
6. **Data Confidence ("How reliable is this?")**: Explains Open-Meteo's CAMS/ECMWF model estimate vs physical CPCB stations, rolling/current NAQI basis, IST update timestamp, and direct source links.

---

## Architecture & Data Flow

```text
+-------------------------------------------------------------------------+
| React 19 + TypeScript + Tailwind Browser Client                         |
|                                                                         |
|  CitySearch / Sample  --->  openMeteo.ts (10m cache + in-flight dedupe) |
|                                  |                                      |
|                                  v                                      |
|                       naqi.ts (India NAQI + forward windows)            |
|                                  |                                      |
|         +------------------------+-------------------------+            |
|         v                        v                         v            |
|  useAdvice (/api/advice)   AskVayuMitra (/api/ask)   PhotoCheck         |
|  10m session/mem cache     live profile + forecast   local EXIF strip   |
+-------------------------------------------------------------------------+
                                   | HTTPS / JSON (strict Zod schemas)
                                   v
+-------------------------------------------------------------------------+
| Express Backend (server.ts)                                             |
|  * Security headers (CSP, frame-ancestors, nosniff, Permissions-Policy) |
|  * Per-IP, per-route rate limiting (429 + Retry-After)                  |
|  * 10m response cache + in-flight deduplication                         |
|  * Google GenAI SDK (gemini-4-hydrogen -> gemini-3.1-flash-lite)        |
|  * Deterministic bilingual rule-based fallback if key absent / 429/5xx  |
+-------------------------------------------------------------------------+
```

---

## Prompt Design & JSON Schemas

See [`docs/PROMPTS.md`](docs/PROMPTS.md) for the exact system instructions, safety guardrails (such as banning `"clean air"` whenever NAQI ≠ `Good`, banning invented readings/diagnoses, and enforcing stated `approx.` CO₂ assumptions), and JSON schemas used by `/api/advice`, `/api/ask`, and `/api/photo-check`.

---

## Security, Accessibility & Performance

- **Security** ([`SECURITY.md`](SECURITY.md)): Server-only `GEMINI_API_KEY`, strict CSP + security headers, Zod validation on all inputs, `CITY_NAME_REGEX` & control-char sanitization, route-scoped JSON limits (`64kb` for text, `6mb` for photo), per-IP rate limiting, zero raw HTML rendering, and local EXIF stripping with zero photo persistence.
- **Accessibility** ([`ACCESSIBILITY.md`](ACCESSIBILITY.md)): Skip-to-content link, single `<h1>` + logical heading order, `aria-live` announcements, dialog focus traps, 44px minimum touch targets, WCAG AA scrim contrast across all themes, `prefers-reduced-motion` support, and 200% zoom resilience.
- **Performance**:
  - **Code Splitting**: Heavy interactive modules are dynamically imported into separate chunks (`HeroParticleCanvas` `1.56 kB` gz, `ShortcutsModal` `1.71 kB` gz, `shareCard` `2.33 kB` gz, `HourlyDetailsSheet` `2.41 kB` gz, `AskVayuMitra` `3.51 kB` gz, `PhotoCheckCard` `4.93 kB` gz).
  - **Caching & Deduplication**: 10-minute TTL caches and concurrent in-flight request deduplication in both `src/lib/api/openMeteo.ts` and `server.ts`.
  - **Input Debouncing & Pausing**: 320 ms search debounce, 350–850 ms profile-edit advice debounce, and automatic `<canvas>` animation pause when the browser tab is hidden.

---

## Verification & Coverage Summary

Latest `npm run test:coverage` output (**7 test files, 32 tests passed**):

| Module / Area | Stmts | Branch | Funcs | Lines | Scope |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `samples/*.json` | 100.0% | 100.0% | 100.0% | 100.0% | All 8 Indian household sample JSON profiles |
| `src/lib/api/openMeteo.ts` | 98.2% | 75.3% | 100.0% | 98.2% | Geocoding, AQ & Weather fetch, 10m cache & dedupe |
| `src/lib/vision/schema.ts` | 95.2% | 40.5% | 100.0% | 100.0% | MIME/4MB/base64 validation & vision fallback |
| `src/lib/naqi/naqi.ts` | 93.0% | 83.9% | 95.2% | 95.2% | Every PM2.5/PM10 breakpoint, forward windows, mask rules |
| `src/lib/advice/schema.ts` | 84.6% | 59.2% | 100.0% | 86.3% | Advice Zod schemas & deterministic fallback |
| `src/lib/ask/schema.ts` | 83.9% | 31.6% | 100.0% | 84.6% | Ask VayuMitra Zod schemas & grounded fallback |
| `server.ts` | 79.6% | 56.6% | 80.6% | 80.5% | Security headers, validation, mock Gemini & 429 limits |
| **All Covered Files** | **65.4%** | **53.0%** | **71.5%** | **65.8%** | Combined suite across logic, schemas, and server routes |

---

## Sample Household Profiles (`/samples`)

| Sample File | City | Household Profile | Purifier | Language |
| :--- | :--- | :--- | :---: | :---: |
| `samples/delhi-kids.json` | Delhi | Kids · Metro commute | Yes | EN |
| `samples/lucknow-senior.json` | Lucknow | Seniors · Work from home | No | HI |
| `samples/patna-commuter.json` | Patna | Outdoor worker · Two-wheeler | No | EN |
| `samples/mumbai-asthma.json` | Mumbai | Asthma / Heart · Bus commute | Yes | EN |
| `samples/bengaluru-wfh.json` | Bengaluru | General · Work from home | No | EN |
| `samples/kolkata-outdoor.json` | Kolkata | Seniors + Outdoor worker · Bus commute | No | EN |
| `samples/jaipur-runner.json` | Jaipur | General · Daily runner / walker | No | EN |
| `samples/chennai-pregnant.json` | Chennai | Pregnancy · Car commute | Yes | EN |

---

## How to Run & Test

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (optional for live Gemini; deterministic fallbacks work without a key)
cp .env.example .env
# Set GEMINI_API_KEY in .env

# 3. Start full-stack dev server on http://localhost:3000
npm run dev

# 4. Run quality gates (CI pipeline in .github/workflows/ci.yml)
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
```

---

## Known Limitations

- **Model Estimates vs Ground Stations**: Open-Meteo derives PM2.5/PM10 from regional CAMS/ECMWF atmospheric assimilation grids rather than physical street-level CPCB monitors; localized traffic, construction, or crop burning can differ.
- **No Medical Advice**: Recommendations follow general public-health exposure practices and do not constitute clinical diagnosis or emergency guidance.
- **Visual Photo Check**: Photo Check identifies visible layout, ventilation, and haze cues only; camera images cannot measure PM2.5 or AQI concentrations.

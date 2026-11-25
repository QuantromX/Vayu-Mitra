# VayuMitra (वायुमित्र) — Breath Companion for Indian Families

![CI](https://img.shields.io/badge/CI-audit%20%7C%20format%20%7C%20lint%20%7C%20typecheck%20%7C%20test%20%7C%20build-10b981)
![Node](https://img.shields.io/badge/Node-%3E%3D22.18-0ea5e9)
![Accessibility](https://img.shields.io/badge/WCAG%202.1-AA-6366f1)
![License: MIT](https://img.shields.io/badge/License-MIT-blue)

VayuMitra turns **live Open-Meteo air-quality & weather telemetry** into personalized, explained household action plans for Indian families — combining an **India NAQI engine**, an interactive **24-hour forward Time Scrubber**, grounded **Ask VayuMitra Q&A**, privacy-preserving **Photo Check**, and transparent **Data Confidence** disclosures in English and Hindi (हिन्दी).

---

## Problem Statement

Most air-quality apps stop at raw AQI numbers (`"245 — Poor"`) without explaining what a specific family should actually do right now: whether kids can play after school, when the lowest-pollution window arrives today or tomorrow, whether N95 protection applies in Moderate air for seniors, where to place a purifier, or how to adapt daily commutes. VayuMitra bridges that gap with zero invented data and deterministic offline resilience.

---

## Core Features

1. **India CPCB NAQI Engine (`src/lib/naqi/naqi.ts`)**: Linearly interpolates official PM2.5 (`0–380 µg/m³`) and PM10 (`0–510 µg/m³`) breakpoints, selects the dominant pollutant, computes rolling 24h or current readings, and scans strictly forward (`Today` / `Tomorrow`) for the cleanest and worst 3-hour windows.
2. **Dynamic Weather & Haze Hero + 24h Time Scrubber**: Animated NAQI ring gauge, city-aware 3-layer SVG Indian skylines (Delhi, Mumbai, Lucknow, Kolkata, general), lazy-loaded atmospheric `<canvas>` particle haze/rain/stars, and an accessible 24-hour scrub slider (`[ / ]` or drag) updating the Hero live.
3. **Personalized Action Plan + "Today's Plan" Tracker**: Collapsible household profile (`CitySearch`, sensitive groups, commute lifestyle, HEPA purifier toggle, plus **"Try a sample"** menu with 8 Indian household presets), checkable action items with expandable `"Why this?"` reasoning, and 1080×1350 PNG **Share Air Card** export.
4. **Ask VayuMitra (`POST /api/ask`)**: Natural-language household Q&A chips and custom input (up to 300 chars) returning `{ verdict: yes|no|caution, answer, why, bestTime, dataUsed }` grounded strictly in live Open-Meteo metrics.
5. **Photo Check (`POST /api/photo-check`)**: Upload or capture a room/sky photo (`jpeg`/`png`/`webp`, `<= 4 MB`). All EXIF/GPS metadata is stripped locally on an offscreen `<canvas>`, magic bytes are verified server-side, and Gemini Vision returns visual purifier placement, ventilation tips, and confidence (`low`/`medium`/`high`).
6. **Data Confidence ("How reliable is this?")**: Explains Open-Meteo's CAMS/ECMWF model estimate vs physical CPCB stations, rolling/current NAQI basis, IST update timestamp, and direct source links.

---

## Architecture & Module Layout

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the complete module map, `/api/advice` sequence flow, caching/dedupe design, and defense-in-depth layers.

```text
+-----------------------------------------------------------------------------+
| React 19 + TypeScript + Tailwind Browser Client (src/)                      |
|                                                                             |
|  components/{advice,assistant,hero,profile,scrubber,search,skyline}         |
|  hooks/{useAirData,useAdvice,useAppLayoutState,useDashboardTheme,...}       |
|  lib/{naqi,advice,ask,vision,api,theme,share,profiles,shared}               |
+-----------------------------------------------------------------------------+
                                       | HTTPS / JSON (.strict() Zod schemas)
                                       v
+-----------------------------------------------------------------------------+
| Express Backend (server.ts + server/)                                       |
|  * server/gemini.ts     - Fail-fast API key guard, timeouts, model failover |
|  * server/middleware.ts - Per-request nonce CSP, HSTS, origin CORS, errors  |
|  * server/rateLimiter.ts- Per-IP sliding-window limits (429 + Retry-After)  |
|  * server/cache.ts      - Bounded 10m TTL cache + in-flight deduplication   |
|  * server/prompts.ts    - <untrusted_input> prompts & Gemini schemas        |
|  * server/logger.ts     - Redacted structured JSON logging                  |
|  * server/frontend.ts   - CSP nonce HTML injection, Vite/static serving     |
|  * server/routes/*      - /api/advice, /api/ask, /api/photo-check handlers  |
+-----------------------------------------------------------------------------+
```

---

## Prompt Design & JSON Schemas

See [`docs/PROMPTS.md`](docs/PROMPTS.md) for the `<untrusted_input>` prompt-injection delimiters, exact system instructions, safety guardrails (such as banning `"clean air"` whenever NAQI ≠ `Good`, banning invented readings/diagnoses, and enforcing stated `approx.` CO₂ assumptions), and `.strict()` JSON schemas used by `/api/advice`, `/api/ask`, and `/api/photo-check`.

---

## Security, Accessibility & Performance

- **Security** ([`SECURITY.md`](SECURITY.md)): Fail-fast server-only `GEMINI_API_KEY`, per-request nonce CSP (no `'unsafe-inline'`/`'unsafe-eval'`), `frame-ancestors 'none'`, HSTS, origin-locked CORS (`403` on foreign origins), `.strict()` Zod validation with India coordinate bounds, JPEG/PNG/WebP magic-byte verification, `<untrusted_input>` prompt isolation, redacted structured logging, and `npm audit --omit=dev --audit-level=high` in CI.
- **Accessibility** ([`ACCESSIBILITY.md`](ACCESSIBILITY.md)): Skip-to-content link, single `<h1>` + logical heading order, dynamic `<html lang="en|hi">`, `aria-describedby` alert bindings, `aria-live` announcements, dialog focus traps, 44px minimum touch targets, WCAG AA scrim contrast + `prefers-contrast: more`, `prefers-reduced-motion` support, and `320px` / 200% zoom resilience verified with `jest-axe` and Playwright.
- **Performance**: Route-level code splitting (`PhotoCheckCard`, `AskVayuMitra`, `HourlyDetailsSheet`, `shareCard`, `ShortcutsModal`, `HeroParticleCanvas`), Vite vendor chunk splitting, 10-minute TTL caches with concurrent in-flight deduplication in both `src/lib/api/openMeteo.ts` and `server/cache.ts`, `compression` middleware + immutable `/assets/*` headers, `hardwareConcurrency`-capped `<canvas>` particles that pause on hidden tabs, and font preloading with `display=swap`.

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

# 2. Configure required server environment variable (server fails fast if missing)
cp .env.example .env
# Set GEMINI_API_KEY in .env

# 3. Start full-stack dev server on http://localhost:3000
npm run dev

# 4. Run quality gates (CI pipeline in .github/workflows/ci.yml)
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

---

## Known Limitations

- **Model Estimates vs Ground Stations**: Open-Meteo derives PM2.5/PM10 from regional CAMS/ECMWF atmospheric assimilation grids rather than physical street-level CPCB monitors; localized traffic, construction, or crop burning can differ.
- **No Medical Advice**: Recommendations follow general public-health exposure practices and do not constitute clinical diagnosis or emergency guidance.
- **Visual Photo Check**: Photo Check identifies visible layout, ventilation, and haze cues only; camera images cannot measure PM2.5 or AQI concentrations.

---

## Coverage Summary

Generated from `coverage/coverage-summary.json` via `npm run test:coverage`:

| Module / Area | Stmts | Branch | Funcs | Lines | Scope |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `server.ts` | 83.78% | 52.00% | 40.00% | 83.78% | Entry point, boot & re-exported public API |
| `server/*` | 84.44% | 70.11% | 92.54% | 84.59% | Middleware, CSP/CORS, rate limit, cache, failover, routes |
| `src/lib (config & errors)` | 96.30% | 83.33% | 100.00% | 96.30% | Centralized config & typed `AppError` hierarchy |
| `src/lib/theme` | 100.00% | 100.00% | 100.00% | 100.00% | All 6 NAQI themes, day/night & weather selection |
| `src/lib/share` | 95.77% | 65.91% | 94.12% | 96.20% | Share Air Card 1080×1350 spec & canvas export |
| `src/lib/shared` | 95.24% | 85.71% | 100.00% | 94.44% | Sanitizers, `<untrusted_input>` wrapper, disclaimers |
| `src/lib/api` | 88.51% | 77.10% | 90.91% | 90.57% | Open-Meteo fetch, retries, 10m cache & offline snapshots |
| `src/lib/advice` | 84.62% | 68.89% | 91.18% | 85.12% | `.strict()` Zod schemas, fallbacks & plan tracker |
| `src/lib/naqi` | 88.59% | 69.10% | 97.06% | 89.94% | Breakpoints, forward windows, scrubber & mask rules |
| `src/lib/vision` | 83.61% | 54.88% | 92.59% | 88.29% | Local EXIF strip, magic-byte check & vision fallback |
| `src/lib/profiles` | 84.00% | 75.00% | 100.00% | 83.33% | Saved household profile validation & 8 Indian presets |
| `src/lib/ask` | 65.12% | 31.25% | 81.82% | 65.48% | `.strict()` Q&A Zod schemas & grounded fallback |
| `src/hooks` | 63.39% | 39.18% | 63.39% | 67.23% | State, data-fetching, theme & layout hooks |
| `src/components` | 48.59% | 45.71% | 53.44% | 52.14% | React UI views, modals, accessibility & scrubbers |
| **All Covered Files** | **68.60%** | **54.08%** | **69.79%** | **71.39%** | Combined suite across server & client modules |


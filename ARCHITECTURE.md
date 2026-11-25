# VayuMitra — System Architecture

VayuMitra is a full-stack TypeScript web application pairing a Vite/React 19 client with a Node 22 native type-stripped Express server (`node server.ts`).

---

## 1. Repository & Module Map

```text
├── server.ts                         # Production & dev entry point; re-exports public server API
├── server/
│   ├── cache.ts                      # Bounded TTL cache + generic getOrCompute in-flight deduplication
│   ├── frontend.ts                   # Nonce HTML injection, Vite dev middleware, static/SPA serving
│   ├── gemini.ts                     # requireGeminiApiKey, abort timeouts, quota cooldown, model failover
│   ├── logger.ts                     # Structured JSON logger with automatic secret/PII redaction
│   ├── middleware.ts                 # Nonce CSP, HSTS, origin-locked CORS, JSON body parser, error handler
│   ├── prompts.ts                    # Gemini response schemas & untrusted-input system instructions
│   ├── rateLimiter.ts                # Per-IP sliding-window rate limiter factory (429 + Retry-After)
│   └── routes/
│       ├── advice.ts                 # POST /api/advice route handler + deterministic fallback
│       ├── ask.ts                    # POST /api/ask route handler + deterministic fallback
│       └── photoCheck.ts             # POST /api/photo-check (6mb body cap, magic bytes, fallback)
├── src/
│   ├── App.tsx                       # Root layout wiring ErrorBoundary, header, hero, main & footer
│   ├── main.tsx                      # React 19 mount entry point
│   ├── index.css                     # Tailwind CSS v4 tokens, glass surfaces, contrast & motion rules
│   ├── types/index.ts                # Shared frontend domain types
│   ├── hooks/
│   │   ├── adviceHelpers.ts          # Advice cache keys, request payload builders, fallback helpers
│   │   ├── useAdvice.ts              # Advice fetching with 10m cache & stale-request cancellation
│   │   ├── useAirData.ts             # Open-Meteo fetching, retries & offline snapshot recovery
│   │   ├── useAppLayoutState.ts      # Dashboard UI/modal/shortcut orchestration hook
│   │   ├── useDashboardController.ts # Plan progress, language fade, share card & global shortcuts
│   │   ├── useDashboardTheme.ts      # Scrubbed hour resolution, CSS variable theme sync & scroll state
│   │   └── useUserProfile.ts         # Persistent household profile & city selection state
│   ├── components/
│   │   ├── AppHeader.tsx             # Skip link, compact city bar, sample menu & EN/HI toggle
│   │   ├── AppMainBody.tsx           # Main dashboard composition (verdict, scrubber, advice, assistants)
│   │   ├── AqiRingGauge.tsx          # Animated SVG NAQI ring gauge & segment ticks
│   │   ├── CitySearch.tsx            # Debounced Indian city autocomplete controller
│   │   ├── DataConfidenceCard.tsx    # Model-vs-station disclosure & attribution card
│   │   ├── ErrorBanner.tsx           # Accessible error/offline notice with retry action
│   │   ├── ErrorBoundary.tsx         # React error boundary with reset recovery
│   │   ├── HeroParticleCanvas.tsx    # Lazy-loaded canvas wrapper respecting prefers-reduced-motion
│   │   ├── HeroReadout.tsx           # Hero scene container, NAQI readout, verdict & mask status
│   │   ├── HourlyDetailsSheet.tsx    # Accessible bottom-sheet dialog for scrubbed hour telemetry
│   │   ├── OnboardingBanner.tsx      # Dismissible first-run helper banner
│   │   ├── ProfileControls.tsx       # Collapsible household, lifestyle & purifier profile card
│   │   ├── ShortcutsModal.tsx        # Keyboard shortcuts reference modal
│   │   ├── SkylineBackdrop.tsx       # Parallax 3-layer Indian skyline backdrop with PM2.5 haze
│   │   ├── TimeScrubber.tsx          # Interactive 24h forward scrubber with keyboard/pointer drag
│   │   ├── advice/                   # AdviceCategoryCards, AdvicePrimitives, AdviceSection
│   │   ├── assistant/                # AskVayuMitra, PhotoCheckCard, AskSubcomponents, PhotoResultPanel
│   │   ├── hero/                     # HeroHeaderBar, HeroSubcomponents, particleEngine
│   │   ├── profile/                  # ProfileExpandedPanel, ProfilePickers
│   │   ├── scrubber/                 # ScrubberBar, ScrubberSubcomponents, ScrubberTrack, HourlySheetParts
│   │   ├── search/                   # CitySearchParts (input box, listbox, key handler)
│   │   └── skyline/                  # LandmarkLayers (Delhi, Mumbai, Lucknow, Kolkata, generic)
│   └── lib/
│       ├── config.ts                 # Centralized timeouts, TTLs, limits & model defaults
│       ├── errors.ts                 # Typed AppError, ConfigError, UpstreamError, ValidationError
│       ├── advice/                   # Advice Zod schemas, deterministic fallback & Today's Plan state
│       ├── api/                      # Open-Meteo client, parsers, httpClient retries & offline snapshots
│       ├── ask/                      # Ask Q&A Zod schemas & deterministic fallback
│       ├── naqi/                     # India CPCB NAQI breakpoints, forward windows & scrubber calculations
│       ├── profiles/                 # Saved profile schema & 8 Indian household presets
│       ├── share/                    # 1080x1350 Share Air Card spec & offscreen canvas renderer
│       ├── shared/                   # Sanitizers, <untrusted_input> delimiter & shared domain helpers
│       ├── theme/                    # 6 NAQI x day/night x weather palettes & CSS token generator
│       ├── vision/                   # Client EXIF canvas strip, server magic-byte check & fallback
│       └── __tests__/                # Vitest unit, API integration, accessibility & UI test suites
├── docs/PROMPTS.md                   # Exact Gemini system instructions & response schemas
└── samples/                          # 8 Indian household JSON presets
```

---

## 2. `/api/advice` Request Flow

1. **Client (`useAdvice` -> `src/hooks/adviceHelpers.ts` -> `src/lib/api/httpClient.ts`)**
   - Reads cached bilingual advice (session/memory, keyed by city + hourly profile + household) with a 10-minute TTL (`APP_CONFIG.cacheTtlMs`).
   - Sends `POST /api/advice` with an `AbortController` timeout (`APP_CONFIG.apiTimeoutMs`), canceling superseded requests automatically.
2. **Express Security & Parsing Pipeline (`server/middleware.ts`)**
   - Assigns a `correlationId` (`crypto.randomUUID()`), generates a fresh 16-byte cryptographic CSP nonce, and writes strict security headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`).
   - Validates `Origin` against allowed/same-host origins (`403` on foreign origins).
   - Parses JSON with a `64kb` body cap (`413` on oversized payloads, sanitized `400` on malformed JSON).
3. **Rate Limiting & Schema Validation (`server/rateLimiter.ts`, `server/routes/advice.ts`)**
   - Checks per-IP sliding-window quota (`20 req/min` for `/api/advice`); returns `429` with `Retry-After` if exceeded.
   - Validates payload against `.strict()` `AdviceRequestSchema` (rejecting unknown keys, out-of-bounds India coordinates, or invalid enums with HTTP `400`).
4. **Bounded Cache & In-Flight Deduplication (`server/cache.ts`)**
   - Computes a normalized cache key (city, rounded coordinates, NAQI category/value, dominant pollutant, weather condition, household, lifestyle, purifier, language).
   - `getOrCompute(cache, inFlight, key, producer)` returns a non-expired cached entry or joins an existing in-flight `Promise` for identical concurrent requests, pruning expired/oldest entries at the capacity bound (`200` entries).
5. **Gemini Invocation, Cooldown & Deterministic Fallback (`server/gemini.ts`, `server/prompts.ts`)**
   - Wraps untrusted strings inside `<untrusted_input name="...">...</untrusted_input>` delimiters with `buildAdviceSystemInstruction(language)`.
   - `createGeminiCaller(aiClient)` invokes `gemini-4-hydrogen` under `withAbortTimeout`, enforces strict Gemini `responseSchema`, parses with `AdviceResponseSchema` (`.strict()`), and enforces safety post-checks (e.g., disallowing `"clean air"` when NAQI ≠ `Good`).
   - On `429 RESOURCE_EXHAUSTED` or auth error, activates a bounded model cooldown (`modelCooldownUntil`) and fails over to `gemini-3.1-flash-lite`.
   - If both models fail or time out, logs a redacted `gemini_fallback_used` event (`server/logger.ts`) and returns a deterministic bilingual rule-based response (`buildFallbackAdvice`) with `source: 'fallback'`.

---

## 3. Caching, Rate Limiting & Security Layers

| Layer | Mechanism | Scope & Guarantees |
| :--- | :--- | :--- |
| **Client Telemetry Cache** | `src/lib/api/openMeteo.ts` + `offlineSnapshot.ts` | 10m in-memory TTL + in-flight dedupe + persistent last-known city snapshot fallback on upstream failure. |
| **Server Response Cache** | `server/cache.ts` (`createBoundedCache`, `getOrCompute`) | 10m TTL, max `200` entries per route (`/api/advice`, `/api/ask`), concurrent promise deduplication; zero caching on `/api/photo-check`. |
| **Per-IP Rate Limiter** | `server/rateLimiter.ts` (`createRateLimiter`) | Fixed/sliding 60s window per IP (`advice`: 20/min, `ask`: 12/min, `photo-check`: 6/min); evicts expired buckets and responds `429` + `Retry-After`. |
| **Key & Startup Isolation** | `server/gemini.ts` (`requireGeminiApiKey`) | Fails fast on startup with `ConfigError` if `GEMINI_API_KEY` is missing or placeholder `'MY_GEMINI_API_KEY'`. |
| **Transport & XSS Defense** | `server/middleware.ts`, `server/frontend.ts` | Per-request random CSP nonce injected into headers and HTML `<script>`/`<style>`/`<meta>` tags; zero `'unsafe-inline'`, zero `'unsafe-eval'`, zero `dangerouslySetInnerHTML`. |
| **Image Privacy** | `src/lib/vision/exifStrip.ts`, `server/routes/photoCheck.ts` | Client redraws uploads to offscreen `<canvas>` to strip EXIF/GPS; server validates `6mb` body limit, `<= 4 MB` decoded bytes, MIME allowlist, and binary JPEG/PNG/WebP magic bytes. |
| **Redacted Observability** | `server/logger.ts` (`logStructured`) | Structured JSON logs with recursive `[REDACTED]` masking of keys matching `/key\|token\|secret\|password\|auth\|imagebase64\|prompt\|question/i`. |

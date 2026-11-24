# Security & Threat Model — VayuMitra

VayuMitra processes live environmental telemetry, household sensitivity profiles, user questions, and optional user-uploaded room/sky photos. This document summarizes the application's threat model and implemented controls.

## 1. Threat Model & Mitigations

| Asset / Surface | Threat | Control Implemented |
| :--- | :--- | :--- |
| **`GEMINI_API_KEY`** | Key leakage to browser bundle or git history | Strictly server-side (`process.env.GEMINI_API_KEY` in `server.ts`). Never prefixed with `VITE_`. `.env*` ignored in `.gitignore`; `.env.example` holds placeholder names only. |
| **User Photos (Photo Check)** | GPS/EXIF metadata leakage, oversized payloads, executable file types (SVG/HTML), photo retention | Client validates MIME (`image/jpeg`, `image/png`, `image/webp`) and size (`<= 4 MB`), redraws onto an offscreen `<canvas>` (`src/lib/vision/exifStrip.ts`) to strip all EXIF/GPS/XMP headers locally, and clears object URLs on reset. Server `/api/photo-check` re-validates MIME, base64 charset, and decoded byte length `<= 4 MB` under a route-scoped `6mb` limit, never stores or caches photos, and never logs image payloads. |
| **API Inputs (`/api/*`)** | Injection, malformed payloads, oversized bodies, prompt tampering | Every route parses request bodies with strict **Zod** schemas (`AdviceRequestSchema`, `AskRequestSchema`, `PhotoCheckRequestSchema`). `cityName` enforces length `1..80` and `CITY_NAME_REGEX`; control chars and `<` / `>` are stripped (`sanitizeText`). `/api/advice` and `/api/ask` enforce a `64kb` body limit. |
| **AI Output Rendering** | XSS via model-generated HTML/scripts | All Gemini outputs are parsed against strict JSON schemas (`responseMimeType: 'application/json'` + Zod) and rendered exclusively via React JSX text nodes. `dangerouslySetInnerHTML` is never used. |
| **Abuse & Quota Exhaustion** | Rapid automated requests exhausting Gemini quota | Sliding-window per-IP, per-route rate limiting (`24 req / 60s` default) returning HTTP `429` with `Retry-After`, paired with 10-minute server/client caching, concurrent in-flight deduplication, and deterministic offline fallbacks. |
| **Browser Attack Surface** | Script injection, clickjacking, MIME sniffing, sensor leaks | Response headers on all routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `x-powered-by` disabled, and strict `Content-Security-Policy` (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'self' https://aistudio.google.com https://*.google.com`). |
| **Operational Logging** | Secret, PII, prompt, or photo leakage in logs | Server logs only route names, model cooldown durations, and sanitized city names on fallback—never secrets, full prompts, or base64 photos. |

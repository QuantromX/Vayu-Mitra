# Changelog

## Behaviour-Preserving Quality Pass (Part A)

### Modularity & Maintainability
- Decomposed `server.ts` into focused, Node type-stripping-compatible ESM modules under `server/` (`logger.ts`, `rateLimiter.ts`, `cache.ts`, `prompts.ts`, `gemini.ts`, `middleware.ts`, `frontend.ts`, and `server/routes/{advice,ask,photoCheck}.ts`) while preserving every exported symbol and API contract.
- Extracted focused UI subcomponents and controller hooks across `src/components/{advice,assistant,hero,profile,scrubber,search,skyline}` and `src/hooks/` (`useDashboardTheme.ts`, `useDashboardController.ts`, `adviceHelpers.ts`).
- Documented system topology, request lifecycle, caching, rate limiting, and security layers in `ARCHITECTURE.md`.

### Tooling, Quality Gates & Repo Hygiene
- Enforced strict ESLint complexity/size checks (`--max-warnings 0` across `src/`, `server/`, and `server.ts`) and Prettier formatting across backend, frontend, CSS, and HTML entry files.
- Included `server/**/*.ts` in Vitest coverage reporting (`vitest.config.ts`), enabled `noImplicitReturns` and `noImplicitOverride` in `tsconfig.json`, and removed unused build config plugins in `vite.config.ts`.
- Hardened `.github/workflows/ci.yml` with read-only `permissions`, `concurrency` cancellation, `npm audit --omit=dev --audit-level=high`, and `coverage/coverage-summary.json` artifact uploads.
- Added MIT `LICENSE`, standardized `package.json` / `package-lock.json` metadata (`vayumitra@1.0.0`, `engines.node >= 22.18`), updated `.gitignore`, and removed redundant lock/sample/walkthrough files after merging PoC notes into `SECURITY.md`.

## Hardening & Production Polish

### Security
- Enforced fail-fast server startup check (`requireGeminiApiKey`) rejecting missing or placeholder `GEMINI_API_KEY` values.
- Upgraded all request and Gemini response Zod schemas to `.strict()`, added India geographic coordinate bounds (`latitude 6..37.6`, `longitude 68..97.5`), enforced a 300-character max on `AskVayuMitra` questions, and validated real binary JPEG/PNG/WebP magic bytes on uploaded photos.
- Replaced static permissive CSP with per-request cryptographic nonce CSP (`'nonce-...'` on `<script>`, `<style>`, and `<meta property="csp-nonce">`), disabled `'unsafe-inline'` and `'unsafe-eval'`, set `frame-ancestors 'none'`, `Strict-Transport-Security`, and locked CORS to explicit allowed/same-host origins (`403` otherwise).
- Added sliding-window per-route IP rate limiting (`20/12/6 req/min` + `Retry-After`), `AbortController` upstream/client timeouts, `<untrusted_input>` prompt-injection delimiters, and structured JSON logging with automatic sensitive-field redaction.
- Pinned exact dependencies in `package.json`, removed unused `autoprefixer`/`oxlint`/conflicting `esbuild`, regenerated `package-lock.json`, and verified 0 vulnerabilities via `npm audit`.

### Code Quality & Efficiency
- Enabled `noUncheckedIndexedAccess` and strict TypeScript flags with zero `any` types and zero `console.*` calls in production code.
- Standardized typed constants in `src/lib/config.ts`, domain helpers in `src/lib/shared/domain.ts`, and typed `AppError` subclasses in `src/lib/errors.ts`.
- Added gzip/brotli `compression`, immutable caching on `/assets/*`, Vite vendor chunk splitting, explicit `width`/`height` attributes on `<svg>` and `<img>`, `hardwareConcurrency`-aware canvas particle limits, and font `preconnect`/`preload` with `display=swap`.

### Accessibility & Reliability
- Synchronized `<html lang="en|hi">` dynamically on language toggle, added `aria-describedby` error links, added `prefers-contrast: more` overrides, and verified `320px` and `200%` zoom responsiveness with 0 overflow.
- Added React `ErrorBoundary`, Open-Meteo `AbortController` retries + exponential backoff, offline fallback rendering from the last saved city snapshot with an `"Offline"` badge, and visible non-medical disclaimer copy.
- Expanded automated unit, API, React Testing Library, and `jest-axe` test suites alongside Prettier + ESLint (`--max-warnings 0`) CI gates.

# Accessibility Statement & Checklist — VayuMitra

VayuMitra is engineered to meet **WCAG 2.1 Level AA** across all 6 NAQI themes, day/night skies, bilingual English/Hindi modes, desktop, mobile, and 200% browser zoom.

## Implemented Measures

1. **Skip Navigation & Landmarks**
   - Keyboard-accessible **Skip to main content** link (`#main-content`) visible on focus.
   - Explicit `<header>`, `<main id="main-content" tabIndex={-1}>`, labelled `<section>` regions, and `<footer>`.
   - Single `<h1>` (active city heading in `HeroReadout`) with logical `<h2>` and `<h3>` order across cards.

2. **Keyboard Navigation & Focus Management**
   - Full keyboard shortcuts: `/` focuses city search, `R` refreshes Open-Meteo data, `[` / `]` scrub 24h hours, `?` toggles the shortcuts dialog.
   - `HourlyDetailsSheet` and `ShortcutsModal` implement `role="dialog"`, `aria-modal="true"`, `Tab`/`Shift+Tab` focus trapping, `Escape` dismissal, and focus restoration on close.
   - `TimeScrubber` uses `role="slider"` with `ArrowLeft`/`ArrowRight`/`Home`/`End`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and descriptive `aria-valuetext`.
   - `"Try a sample"` menu supports `aria-haspopup="menu"`, `aria-expanded`, `role="menu"` / `role="menuitem"`, and `Escape` dismissal.

3. **Screen Reader Announcements (`aria-live`)**
   - Live scrubbed hour telemetry, Ask VayuMitra answers, Photo Check results, and Share Air Card notifications announce updates politely via `aria-live="polite"` / `role="status"`, while validation/fetch errors use `role="alert"`.
   - Every form input (`CitySearch`, `AskVayuMitra`, `PhotoCheckCard`) is explicitly bound via `htmlFor` / `id`.

4. **Contrast, Colour Independence & Motion**
   - Dark gradient scrim (`rgba(2, 6, 23, 0.56–0.8)`) behind Hero text guarantees WCAG AA contrast on every day, night, fog, rain, thunder, and AQI theme.
   - NAQI category and verdict cues always pair colour with explicit text labels and distinct Lucide icons (`ShieldCheck`, `Leaf`, `CloudSun`, `AlertTriangle`, `Flame`, `Skull`).
   - All particle animations, parallax, and transitions automatically disable under `prefers-reduced-motion: reduce`.

5. **Touch Targets & 200% Zoom**
   - Interactive buttons, toggles, checkboxes, chips, and menu items enforce `min-h-[44px]` (`>= 44px` touch target).
   - Fluid responsive flex/grid wrapping ensures zero horizontal overflow or clipped text at 200% zoom and 390px mobile viewports.

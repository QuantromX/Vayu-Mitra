import type {
  NaqiCategory,
  ThemeTokens,
  WeatherConditionScene,
} from '../../types/index.ts';
import { CATEGORY_PALETTES } from './themePalettes.ts';

function isRainWeatherCode(weatherCode: number): boolean {
  const isDrizzleOrRain = weatherCode >= 51 && weatherCode <= 67;
  const isShowers = weatherCode >= 80 && weatherCode <= 82;
  return isDrizzleOrRain || isShowers;
}

function isFogWeather(
  weatherCode: number,
  humidityPct: number,
  windSpeedKmh: number
): boolean {
  return (
    weatherCode === 45 || weatherCode === 48 || (humidityPct > 85 && windSpeedKmh < 5)
  );
}

/**
 * Determines the weather scene from WMO weather_code, humidity, and wind speed:
 * - thunder: weatherCode >= 95
 * - rain: weatherCode 51..67 or 80..82
 * - fog: weatherCode 45, 48 OR (humidityPct > 85 && windSpeedKmh < 5)
 * - cloudy: weatherCode 2..3
 * - clear: weatherCode 0..1 (or fallback)
 */
export function selectWeatherScene(params: {
  weatherCode: number;
  humidityPct?: number;
  windSpeedKmh?: number;
}): WeatherConditionScene {
  const { weatherCode, humidityPct = 50, windSpeedKmh = 10 } = params;

  if (weatherCode >= 95) {
    return 'thunder';
  }
  if (isRainWeatherCode(weatherCode)) {
    return 'rain';
  }
  if (isFogWeather(weatherCode, humidityPct, windSpeedKmh)) {
    return 'fog';
  }
  if (weatherCode === 2 || weatherCode === 3) {
    return 'cloudy';
  }
  return 'clear';
}

/**
 * Computes haze opacity (0.08 to 0.9) scaled smoothly with PM2.5 concentration.
 */
export function computeHazeOpacity(pm25: number): number {
  if (!Number.isFinite(pm25) || pm25 <= 10) return 0.08;
  const normalized = Math.min(1, (pm25 - 10) / 240);
  return Number((0.08 + normalized * 0.82).toFixed(2));
}

/**
 * Computes complete theme tokens combining NAQI category palette with weather conditions & is_day.
 */
export function resolveThemeTokens(params: {
  category: NaqiCategory;
  weatherCode: number;
  isDay: boolean;
  pm25: number;
  humidityPct?: number;
  windSpeedKmh?: number;
}): ThemeTokens {
  const palette = CATEGORY_PALETTES[params.category];
  const weatherScene = selectWeatherScene({
    weatherCode: params.weatherCode,
    humidityPct: params.humidityPct,
    windSpeedKmh: params.windSpeedKmh,
  });
  const hazeOpacity = computeHazeOpacity(params.pm25);

  // Nighttime deepens the upper sky while retaining the NAQI category accent and lower glow
  const skyTop = params.isDay ? palette.skyTop : '#070b17';
  const skyMid = params.isDay ? palette.skyMid : '#10182b';

  // Sun/moon disc dims and turns orange-red in elevated PM2.5 smog
  let sunColor = '#fef08a';
  let sunGlow = 'rgba(254, 240, 138, 0.52)';
  if (!params.isDay) {
    sunColor = '#e2e8f0';
    sunGlow = 'rgba(226, 232, 240, 0.35)';
  } else if (params.pm25 >= 121) {
    sunColor = '#ea580c';
    sunGlow = 'rgba(234, 88, 12, 0.24)';
  } else if (params.pm25 >= 61) {
    sunColor = '#fb923c';
    sunGlow = 'rgba(251, 146, 60, 0.32)';
  }

  return {
    category: params.category,
    weatherScene,
    isDay: params.isDay,
    hazeOpacity,
    skyTop,
    skyMid,
    skyBottom: palette.skyBottom,
    accent: palette.accent,
    accentStrong: palette.accentStrong,
    accentContrast: palette.accentContrast,
    glowColor: palette.hazeColor,
    ringTrack: 'rgba(255, 255, 255, 0.14)',
    surfaceGlass: palette.surfaceGlass,
    surfaceElevated: palette.surfaceElevated,
    borderGlass: palette.borderGlass,
    scrim: palette.scrim,
    textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0',
    textMuted: '#cbd5e1',
    hazeColor: palette.hazeColor,
    sunColor,
    sunGlow,
    badgeIcon: palette.badgeIcon,
  };
}

/**
 * Applies theme tokens as CSS custom properties onto a DOM element.
 */
export function applyThemeCssVariables(element: HTMLElement, tokens: ThemeTokens): void {
  const s = element.style;
  s.setProperty('--vm-sky-top', tokens.skyTop);
  s.setProperty('--vm-sky-mid', tokens.skyMid);
  s.setProperty('--vm-sky-bottom', tokens.skyBottom);
  s.setProperty('--vm-accent', tokens.accent);
  s.setProperty('--vm-accent-strong', tokens.accentStrong);
  s.setProperty('--vm-accent-contrast', tokens.accentContrast);
  s.setProperty('--vm-glow', tokens.glowColor);
  s.setProperty('--vm-ring-track', tokens.ringTrack);
  s.setProperty('--vm-surface-glass', tokens.surfaceGlass);
  s.setProperty('--vm-surface-elevated', tokens.surfaceElevated);
  s.setProperty('--vm-border-glass', tokens.borderGlass);
  s.setProperty('--vm-scrim', tokens.scrim);
  s.setProperty('--vm-text-primary', tokens.textPrimary);
  s.setProperty('--vm-text-secondary', tokens.textSecondary);
  s.setProperty('--vm-text-muted', tokens.textMuted);
  s.setProperty('--vm-haze-color', tokens.hazeColor);
  s.setProperty('--vm-haze-opacity', String(tokens.hazeOpacity));
  s.setProperty('--vm-sun-color', tokens.sunColor);
  s.setProperty('--vm-sun-glow', tokens.sunGlow);
}

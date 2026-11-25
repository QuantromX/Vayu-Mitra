import { useEffect, useMemo, useState } from 'react';
import { UI_LIMITS } from '../lib/config.ts';
import { computeScrubbedHourState } from '../lib/naqi/scrubber.ts';
import { applyThemeCssVariables, resolveThemeTokens } from '../lib/theme/theme.ts';
import type {
  HouseholdGroup,
  Language,
  NaqiResult,
  ScrubbedHourState,
  ThemeTokens,
  WeatherData,
} from '../types/index.ts';

function resolveHeroThemeInputs(
  scrubbed: ScrubbedHourState | null,
  naqi: NaqiResult | null,
  weather: WeatherData | null
): ThemeTokens {
  if (scrubbed) {
    return resolveThemeTokens({
      category: scrubbed.category,
      weatherCode: scrubbed.weatherCode,
      isDay: scrubbed.isDay,
      pm25: scrubbed.pm25,
      humidityPct: scrubbed.humidityPct,
      windSpeedKmh: scrubbed.windSpeedKmh,
    });
  }
  return resolveThemeTokens({
    category: naqi ? naqi.category : 'Good',
    weatherCode: weather ? weather.weatherCode : 0,
    isDay: weather ? weather.isDay : true,
    pm25: naqi ? naqi.pm25Used : 20,
    humidityPct: weather ? weather.humidityPct : 50,
    windSpeedKmh: weather ? weather.windSpeedKmh : 10,
  });
}

function useDocumentThemeSync(theme: ThemeTokens, language: Language): void {
  useEffect(() => {
    applyThemeCssVariables(document.documentElement, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
}

export function useScrolledCompact(): boolean {
  const [scrolledCompact, setScrolledCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > UI_LIMITS.scrollCompactThresholdPx;
      setScrolledCompact((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return scrolledCompact;
}

export function useResolvedScrubAndTheme(
  naqi: NaqiResult | null,
  weather: WeatherData | null,
  scrubIndex: number,
  household: HouseholdGroup[],
  language: Language
) {
  const scrubbed = useMemo(() => {
    if (!naqi || !weather) return null;
    return computeScrubbedHourState({
      naqi,
      weather,
      activeIndex: scrubIndex,
      household,
      language,
    });
  }, [naqi, weather, scrubIndex, household, language]);

  const theme = useMemo(
    () => resolveHeroThemeInputs(scrubbed, naqi, weather),
    [scrubbed, naqi, weather]
  );
  useDocumentThemeSync(theme, language);

  return { scrubbed, theme };
}

import { CATEGORY_HINDI } from '../../lib/shared/domain.ts';
import type {
  NaqiCategory,
  NaqiResult,
  ScrubbedHourState,
  WindowDayLabel,
} from '../../types/index.ts';

export function formatDayWord(day: WindowDayLabel | undefined, hi: boolean): string {
  if (!day) return '';
  if (!hi) return day;
  return day === 'Today' ? 'आज' : 'कल';
}

export function getWindowDescriptor(activeCategory: NaqiCategory, hi: boolean): string {
  if (activeCategory === 'Good') return hi ? 'सबसे स्वच्छ समय' : 'Cleanest window ahead';
  return hi ? 'कम प्रदूषण वाला समय' : 'Lowest-pollution window ahead';
}

export function formatUpdatedTime(lastUpdated: Date | null): string | null {
  if (!lastUpdated) return null;
  return lastUpdated.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function resolveActiveCategory(
  scrubbed: ScrubbedHourState | null,
  naqi: NaqiResult | null
): NaqiCategory {
  if (scrubbed) return scrubbed.category;
  if (naqi) return naqi.category;
  return 'Good';
}

function resolveBaseMetrics(scrubbed: ScrubbedHourState | null, naqi: NaqiResult | null) {
  if (scrubbed) {
    return {
      aqi: scrubbed.aqi,
      dominant: scrubbed.dominantPollutant,
      pm25: scrubbed.pm25,
      pm10: scrubbed.pm10,
    };
  }
  if (naqi) {
    return {
      aqi: naqi.aqi,
      dominant: naqi.dominantPollutant,
      pm25: naqi.pm25Used,
      pm10: naqi.pm10Used,
    };
  }
  return { aqi: 0, dominant: 'PM2.5' as const, pm25: 0, pm10: 0 };
}

export function deriveHeroMetrics(params: {
  naqi: NaqiResult | null;
  scrubbed: ScrubbedHourState | null;
  hi: boolean;
}) {
  const { naqi, scrubbed, hi } = params;
  const activeCategory = resolveActiveCategory(scrubbed, naqi);
  const baseValues = resolveBaseMetrics(scrubbed, naqi);

  return {
    activeCategory,
    activeAqi: baseValues.aqi,
    activeDominant: baseValues.dominant,
    activePm25: baseValues.pm25,
    activePm10: baseValues.pm10,
    categoryLabel: hi ? CATEGORY_HINDI[activeCategory] : activeCategory,
    cleanDayLabel: formatDayWord(naqi?.cleanestWindow?.dayLabel, hi),
    scrubbedDayLabel: formatDayWord(scrubbed?.dayLabel, hi),
  };
}

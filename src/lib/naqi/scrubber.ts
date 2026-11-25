import type {
  HourlyPollutantPoint,
  HouseholdGroup,
  Language,
  NaqiResult,
  ScrubbedHourState,
  WeatherData,
} from '../../types/index.ts';
import { computeNaqiFromPair } from './naqi.ts';
import {
  buildVerdictHumanLine,
  computeSunArcPosition,
  getVerdictPill,
  getVerdictPillLabel,
} from './verdict.ts';

export {
  buildVerdictHumanLine,
  computeSunArcPosition,
  getVerdictPill,
  getVerdictPillLabel,
};

function buildLiveScrubbedState(params: {
  naqi: NaqiResult;
  weather: WeatherData;
  point: HourlyPollutantPoint | undefined;
  household: HouseholdGroup[];
  language: Language;
}): ScrubbedHourState {
  const { naqi, weather, point, household, language } = params;
  const hourLabel = point?.hourLabel ?? weather.currentTime.slice(11, 16);
  const dayLabel = point?.dayLabel ?? 'Today';
  const arc = computeSunArcPosition(Number(hourLabel.slice(0, 2)));
  const verdictPill = getVerdictPill(naqi.category, household);

  return {
    index: 0,
    isLive: true,
    time: point?.time ?? weather.currentTime,
    hourLabel,
    dayLabel,
    aqi: naqi.aqi,
    category: naqi.category,
    dominantPollutant: naqi.dominantPollutant,
    pm25: naqi.pm25Used,
    pm10: naqi.pm10Used,
    temperatureC: weather.temperatureC,
    humidityPct: weather.humidityPct,
    windSpeedKmh: weather.windSpeedKmh,
    weatherCode: weather.weatherCode,
    isDay: weather.isDay,
    sunXPercent: arc.sunXPercent,
    sunYPercent: arc.sunYPercent,
    verdictPill,
    verdictLabel: getVerdictPillLabel(verdictPill, language),
    verdictLine: buildVerdictHumanLine({
      category: naqi.category,
      household,
      hourLabel,
      dayLabel,
      isLive: true,
      language,
    }),
  };
}

function buildForecastScrubbedState(params: {
  naqi: NaqiResult;
  weather: WeatherData;
  point: HourlyPollutantPoint;
  clampedIdx: number;
  household: HouseholdGroup[];
  language: Language;
}): ScrubbedHourState {
  const { naqi, weather, point, clampedIdx, household, language } = params;
  const pm25 = Number((point.pm2_5 ?? naqi.pm25Used).toFixed(1));
  const pm10 = Number((point.pm10 ?? naqi.pm10Used).toFixed(1));
  const pair = computeNaqiFromPair(pm25, pm10);
  const matchedWeather = weather.hourly?.find((w) => w.time === point.time);
  const arc = computeSunArcPosition(Number(point.hourLabel.slice(0, 2)));
  const verdictPill = getVerdictPill(pair.category, household);

  return {
    index: clampedIdx,
    isLive: false,
    time: point.time,
    hourLabel: point.hourLabel,
    dayLabel: point.dayLabel,
    aqi: pair.aqi,
    category: pair.category,
    dominantPollutant: pair.dominantPollutant,
    pm25,
    pm10,
    temperatureC: matchedWeather?.temperatureC ?? weather.temperatureC,
    humidityPct: weather.humidityPct,
    windSpeedKmh: matchedWeather?.windSpeedKmh ?? weather.windSpeedKmh,
    weatherCode: matchedWeather?.weatherCode ?? weather.weatherCode,
    isDay: arc.isDay,
    sunXPercent: arc.sunXPercent,
    sunYPercent: arc.sunYPercent,
    verdictPill,
    verdictLabel: getVerdictPillLabel(verdictPill, language),
    verdictLine: buildVerdictHumanLine({
      category: pair.category,
      household,
      hourLabel: point.hourLabel,
      dayLabel: point.dayLabel,
      isLive: false,
      language,
    }),
  };
}

/**
 * Pure hour-to-state mapper powering the 24h Time Scrubber and Hero synchronization.
 */
export function computeScrubbedHourState(params: {
  naqi: NaqiResult;
  weather: WeatherData;
  activeIndex: number;
  household: HouseholdGroup[];
  language: Language;
}): ScrubbedHourState {
  const { naqi, weather, activeIndex, household, language } = params;
  const total = naqi.forwardHourly.length;
  const clampedIdx = total > 0 ? Math.max(0, Math.min(activeIndex, total - 1)) : 0;
  const point = naqi.forwardHourly[clampedIdx];
  if (!point || clampedIdx === 0) {
    return buildLiveScrubbedState({ naqi, weather, point, household, language });
  }
  return buildForecastScrubbedState({
    naqi,
    weather,
    point,
    clampedIdx,
    household,
    language,
  });
}

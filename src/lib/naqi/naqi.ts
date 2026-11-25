import { hasMaskSensitiveGroup } from '../shared/domain.ts';
import type {
  AirQualityData,
  HourlyPollutantPoint,
  HouseholdGroup,
  NaqiCategory,
  NaqiResult,
  WindowDayLabel,
} from '../../types/index.ts';
import { computeForwardCleanestAndWorstWindows } from './windows.ts';

export { computeForwardCleanestAndWorstWindows };

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
  category: NaqiCategory;
}

export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100, category: 'Satisfactory' },
  { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200, category: 'Moderate' },
  { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300, category: 'Poor' },
  { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400, category: 'Very Poor' },
  { cLow: 251, cHigh: 380, iLow: 401, iHigh: 500, category: 'Severe' },
];

export const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100, category: 'Satisfactory' },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200, category: 'Moderate' },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300, category: 'Poor' },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400, category: 'Very Poor' },
  { cLow: 431, cHigh: 510, iLow: 401, iHigh: 500, category: 'Severe' },
];

export const NAQI_CATEGORY_RANGES: ReadonlyArray<{
  category: NaqiCategory;
  categoryHi: string;
  range: string;
}> = [
  { category: 'Good', categoryHi: 'अच्छी', range: '0–50' },
  { category: 'Satisfactory', categoryHi: 'संतोषजनक', range: '51–100' },
  { category: 'Moderate', categoryHi: 'मध्यम', range: '101–200' },
  { category: 'Poor', categoryHi: 'खराब', range: '201–300' },
  { category: 'Very Poor', categoryHi: 'बहुत खराब', range: '301–400' },
  { category: 'Severe', categoryHi: 'गंभीर', range: '401–500' },
];

export function categorizeNaqi(aqi: number): NaqiCategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function computeSubIndex(
  concentration: number,
  breakpoints: readonly Breakpoint[]
): number {
  if (!Number.isFinite(concentration) || concentration <= 0) return 0;
  const last = breakpoints[breakpoints.length - 1];
  if (!last) return 0;
  if (concentration >= last.cHigh) return 500;

  for (let idx = 0; idx < breakpoints.length; idx++) {
    const bp = breakpoints[idx];
    if (!bp || concentration > bp.cHigh) continue;
    if (concentration < bp.cLow && idx > 0) {
      const prev = breakpoints[idx - 1];
      if (!prev) return bp.iLow;
      const ratio = (concentration - prev.cHigh) / (bp.cLow - prev.cHigh);
      return Math.round(prev.iHigh + ratio * (bp.iLow - prev.iHigh));
    }
    const span = bp.cHigh - bp.cLow;
    if (span === 0) return bp.iHigh;
    const ratio = (concentration - bp.cLow) / span;
    return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
  }
  return 500;
}

export function computePm25SubIndex(pm25: number): number {
  return computeSubIndex(pm25, PM25_BREAKPOINTS);
}

export function computePm10SubIndex(pm10: number): number {
  return computeSubIndex(pm10, PM10_BREAKPOINTS);
}

export function computeNaqiFromPair(
  pm25: number,
  pm10: number
): {
  aqi: number;
  category: NaqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10';
  pm25SubIndex: number;
  pm10SubIndex: number;
} {
  const pm25SubIndex = computePm25SubIndex(pm25);
  const pm10SubIndex = computePm10SubIndex(pm10);
  const aqi = Math.max(pm25SubIndex, pm10SubIndex);
  const dominantPollutant = pm25SubIndex >= pm10SubIndex ? 'PM2.5' : 'PM10';
  return {
    aqi,
    category: categorizeNaqi(aqi),
    dominantPollutant,
    pm25SubIndex,
    pm10SubIndex,
  };
}

export function evaluateMaskRule(
  category: NaqiCategory,
  household: HouseholdGroup[]
): {
  recommended: boolean;
  scope: 'optional' | 'sensitive_only' | 'everyone';
  type: string;
} {
  if (category === 'Good' || category === 'Satisfactory') {
    return { recommended: false, scope: 'optional', type: 'Optional' };
  }
  if (category === 'Moderate') {
    return {
      recommended: hasMaskSensitiveGroup(household),
      scope: 'sensitive_only',
      type: 'N95 / FFP2',
    };
  }
  return { recommended: true, scope: 'everyone', type: 'N95 / FFP2' };
}

function findCurrentHourIndex(data: AirQualityData): number {
  const prefix = data.currentTime.slice(0, 13);
  let idx = data.hourly.findIndex((pt) => pt.time.startsWith(prefix));
  if (idx === -1) {
    idx = data.hourly.reduce(
      (lastIdx, pt, i) => (pt.time <= data.currentTime ? i : lastIdx),
      0
    );
  }
  return Math.max(0, idx);
}

function computeRollingBaseline(
  enrichedHourly: HourlyPollutantPoint[],
  currentIdx: number,
  data: AirQualityData
): { pm25Used: number; pm10Used: number; basis: 'rolling_24h' | 'current' } {
  if (enrichedHourly.length === 0) {
    return { pm25Used: data.currentPm25, pm10Used: data.currentPm10, basis: 'current' };
  }
  const windowSlice = enrichedHourly.slice(Math.max(0, currentIdx - 23), currentIdx + 1);
  const validPm25 = windowSlice
    .map((p) => p.pm2_5)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const validPm10 = windowSlice
    .map((p) => p.pm10)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  if (validPm25.length >= 12 && validPm10.length >= 12) {
    const avg25 = validPm25.reduce((a, b) => a + b, 0) / validPm25.length;
    const avg10 = validPm10.reduce((a, b) => a + b, 0) / validPm10.length;
    return {
      pm25Used: Number(avg25.toFixed(1)),
      pm10Used: Number(avg10.toFixed(1)),
      basis: 'rolling_24h',
    };
  }
  return { pm25Used: data.currentPm25, pm10Used: data.currentPm10, basis: 'current' };
}

/**
 * Evaluates live air-quality data into a rolling 24h (or current fallback) NAQI estimate
 * and extracts strictly forward-looking hourly series (current hour + next 23h) and windows.
 */
export function evaluateAirQuality(data: AirQualityData): NaqiResult {
  const currentDate = data.currentTime.slice(0, 10);
  const currentIdx = findCurrentHourIndex(data);

  const enrichedHourly: HourlyPollutantPoint[] = data.hourly.map((pt, idx) => {
    const dayLabel: WindowDayLabel =
      pt.time.slice(0, 10) <= currentDate ? 'Today' : 'Tomorrow';
    const isCurrentHour = idx === currentIdx;
    if (pt.pm2_5 === null && pt.pm10 === null) {
      return { ...pt, dayLabel, isCurrentHour, naqi: null, category: null };
    }
    const pair = computeNaqiFromPair(pt.pm2_5 ?? 0, pt.pm10 ?? 0);
    return { ...pt, dayLabel, isCurrentHour, naqi: pair.aqi, category: pair.category };
  });

  const { pm25Used, pm10Used, basis } = computeRollingBaseline(
    enrichedHourly,
    currentIdx,
    data
  );
  const naqi = computeNaqiFromPair(pm25Used, pm10Used);
  const forwardHourly = enrichedHourly.slice(currentIdx, currentIdx + 24);
  const { cleanestWindow, worstWindow } = computeForwardCleanestAndWorstWindows(
    forwardHourly,
    3
  );

  return {
    ...naqi,
    pm25Used,
    pm10Used,
    basis,
    label: 'NAQI-style estimate',
    cleanestWindow,
    worstWindow,
    forwardHourly,
  };
}

import type { AirQualityData, WeatherData } from '../../types/index.ts';

export interface OfflineSnapshot {
  air: AirQualityData;
  weather: WeatherData;
  savedAt: string;
}

const OFFLINE_SNAPSHOT_PREFIX = 'vayumitra_last_snapshot_v1:';

/**
 * Persists the last known Open-Meteo air & weather snapshot locally for graceful offline fallback.
 */
export function saveLastKnownSnapshot(
  cityId: number,
  air: AirQualityData,
  weather: WeatherData
): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const payload: OfflineSnapshot = { air, weather, savedAt: new Date().toISOString() };
    window.localStorage.setItem(
      `${OFFLINE_SNAPSHOT_PREFIX}${cityId}`,
      JSON.stringify(payload)
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the last known Open-Meteo air & weather snapshot from localStorage for offline resilience.
 */
export function loadLastKnownSnapshot(cityId: number): OfflineSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${OFFLINE_SNAPSHOT_PREFIX}${cityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineSnapshot>;
    const valid =
      parsed &&
      parsed.air &&
      parsed.weather &&
      typeof parsed.savedAt === 'string' &&
      Array.isArray(parsed.air.hourly) &&
      typeof parsed.air.currentPm25 === 'number';
    return valid ? (parsed as OfflineSnapshot) : null;
  } catch {
    return null;
  }
}

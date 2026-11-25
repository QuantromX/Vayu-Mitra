import type {
  AdviceResponse,
  HourWindow,
  NaqiResult,
  UserProfile,
  WeatherData,
} from '../types/index.ts';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const SESSION_CACHE_PREFIX = 'vayumitra.advice.v1:';

interface AdviceCacheEntry {
  expiresAt: number;
  value: AdviceResponse;
}

const adviceCache = new Map<string, AdviceCacheEntry>();

export function readCachedAdvice(key: string): AdviceResponse | null {
  const mem = adviceCache.get(key);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.value;
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdviceCacheEntry;
    if (parsed && parsed.expiresAt > Date.now() && parsed.value) {
      adviceCache.set(key, parsed);
      return parsed.value;
    }
    window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
  } catch {
    // Ignore storage access failures in private browsing or restricted iframes
  }
  return null;
}

export function writeCachedAdvice(key: string, value: AdviceResponse): void {
  const entry: AdviceCacheEntry = {
    expiresAt: Date.now() + TEN_MINUTES_MS,
    value,
  };
  adviceCache.set(key, entry);
  try {
    window.sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore quota or storage restrictions
  }
}

export function deleteCachedAdvice(key: string): void {
  adviceCache.delete(key);
  try {
    window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
  } catch {
    // Ignore storage restrictions
  }
}

function serializeWindow(win: HourWindow | null) {
  if (!win) return null;
  return {
    startHour: win.startHour,
    endHour: win.endHour,
    dayLabel: win.dayLabel,
    endDayLabel: win.endDayLabel,
    avgNaqi: win.avgNaqi,
    avgPm25: win.avgPm25,
  };
}

export function buildAdviceRequestPayload(
  profile: UserProfile,
  naqi: NaqiResult,
  weather: WeatherData
) {
  return {
    cityName: profile.city.name,
    latitude: profile.city.latitude,
    longitude: profile.city.longitude,
    aqi: naqi.aqi,
    category: naqi.category,
    dominantPollutant: naqi.dominantPollutant,
    pm25: naqi.pm25Used,
    pm10: naqi.pm10Used,
    basis: naqi.basis,
    temperatureC: weather.temperatureC,
    humidityPct: weather.humidityPct,
    windSpeedKmh: weather.windSpeedKmh,
    cleanestWindow: serializeWindow(naqi.cleanestWindow),
    worstWindow: serializeWindow(naqi.worstWindow),
    household: profile.household,
    lifestyle: profile.lifestyle,
    hasPurifier: profile.hasPurifier,
    language: profile.language,
  };
}

async function postAdviceAttempt(
  payload: ReturnType<typeof buildAdviceRequestPayload>,
  outerSignal: AbortSignal
): Promise<{ status: number; data?: AdviceResponse }> {
  const reqController = new AbortController();
  const onOuterAbort = () => reqController.abort();
  outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  const reqTimeout = window.setTimeout(() => reqController.abort(), 18_000);

  try {
    const res = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: reqController.signal,
    });
    if (!res.ok) {
      return { status: res.status };
    }
    const data = (await res.json()) as AdviceResponse;
    return { status: res.status, data };
  } finally {
    window.clearTimeout(reqTimeout);
    outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

export async function postAdviceWithRetry(
  payload: ReturnType<typeof buildAdviceRequestPayload>,
  signal: AbortSignal
): Promise<AdviceResponse> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const outcome = await postAdviceAttempt(payload, signal);
      if (outcome.data) return outcome.data;

      const err = new Error(`Advice service error (HTTP ${outcome.status})`);
      if (outcome.status < 500 || attempt === 1) throw err;
      lastErr = err;
    } catch (err) {
      if (signal.aborted || attempt === 1) throw err;
      lastErr = err;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }

  throw lastErr instanceof Error ? lastErr : new Error('Advice request failed');
}

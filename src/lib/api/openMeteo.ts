import type {
  AirQualityData,
  CityLocation,
  HourlyPollutantPoint,
  WeatherData,
} from '../../types/index.ts';

const TEN_MINUTES_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const geoCache = new Map<string, CacheEntry<CityLocation[]>>();
const airCache = new Map<string, CacheEntry<AirQualityData>>();
const weatherCache = new Map<string, CacheEntry<WeatherData>>();

const inFlightGeo = new Map<string, Promise<CityLocation[]>>();
const inFlightAir = new Map<string, Promise<AirQualityData>>();
const inFlightWeather = new Map<string, Promise<WeatherData>>();

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

/**
 * Searches Indian cities using Open-Meteo's free Geocoding API with 10-minute caching
 * and concurrent in-flight request deduplication.
 */
export async function searchIndianCities(
  query: string,
  signal?: AbortSignal
): Promise<CityLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inFlightGeo.get(cacheKey);
  if (pending) {
    return pending;
  }

  const requestPromise = (async () => {
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', trimmed);
      url.searchParams.set('count', '5');
      url.searchParams.set('countryCode', 'IN');
      url.searchParams.set('language', 'en');

      const response = await fetch(url.toString(), { signal });
      if (!response.ok) {
        throw new Error(`City search failed (HTTP ${response.status})`);
      }

      const json = (await response.json()) as {
        results?: Array<{
          id: number;
          name: string;
          admin1?: string;
          latitude: number;
          longitude: number;
        }>;
      };

      const results: CityLocation[] = (json.results ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        admin1: item.admin1,
        latitude: item.latitude,
        longitude: item.longitude,
      }));

      geoCache.set(cacheKey, {
        expiresAt: Date.now() + TEN_MINUTES_MS,
        value: results,
      });

      return results;
    } finally {
      inFlightGeo.delete(cacheKey);
    }
  })();

  inFlightGeo.set(cacheKey, requestPromise);
  return requestPromise;
}

/**
 * Fetches live current and hourly PM2.5 / PM10 data from Open-Meteo Air Quality API
 * in Asia/Kolkata timezone, with 10-minute caching and in-flight deduplication.
 */
export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  options?: { forceRefresh?: boolean; signal?: AbortSignal }
): Promise<AirQualityData> {
  const key = coordKey(latitude, longitude);
  const cached = airCache.get(key);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!options?.forceRefresh) {
    const pending = inFlightAir.get(key);
    if (pending) {
      return pending;
    }
  }

  const requestPromise = (async () => {
    try {
      const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set('current', 'pm2_5,pm10');
      url.searchParams.set('hourly', 'pm2_5,pm10');
      url.searchParams.set('past_days', '1');
      url.searchParams.set('forecast_days', '2');
      url.searchParams.set('timezone', 'Asia/Kolkata');

      const response = await fetch(url.toString(), { signal: options?.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo air quality error (HTTP ${response.status})`);
      }

      const json = (await response.json()) as {
        latitude: number;
        longitude: number;
        current?: {
          time?: string;
          pm2_5?: number;
          pm10?: number;
        };
        hourly?: {
          time?: string[];
          pm2_5?: Array<number | null>;
          pm10?: Array<number | null>;
        };
      };

      if (
        !json.current ||
        typeof json.current.pm2_5 !== 'number' ||
        typeof json.current.pm10 !== 'number' ||
        !json.current.time
      ) {
        throw new Error('Incomplete live air-quality payload from Open-Meteo.');
      }

      const times = json.hourly?.time ?? [];
      const pm25Series = json.hourly?.pm2_5 ?? [];
      const pm10Series = json.hourly?.pm10 ?? [];

      const hourly: HourlyPollutantPoint[] = times.map((time, idx) => ({
        time,
        hourLabel: time.slice(11, 16),
        dayLabel: 'Today',
        isCurrentHour: false,
        pm2_5: typeof pm25Series[idx] === 'number' ? pm25Series[idx] : null,
        pm10: typeof pm10Series[idx] === 'number' ? pm10Series[idx] : null,
        naqi: null,
        category: null,
      }));

      const parsed: AirQualityData = {
        latitude: json.latitude,
        longitude: json.longitude,
        currentTime: json.current.time,
        currentPm25: Number(json.current.pm2_5.toFixed(1)),
        currentPm10: Number(json.current.pm10.toFixed(1)),
        hourly,
        fetchedAt: new Date().toISOString(),
      };

      airCache.set(key, {
        expiresAt: Date.now() + TEN_MINUTES_MS,
        value: parsed,
      });

      return parsed;
    } finally {
      inFlightAir.delete(key);
    }
  })();

  if (!options?.forceRefresh) {
    inFlightAir.set(key, requestPromise);
  }
  return requestPromise;
}

/**
 * Fetches live current weather conditions from Open-Meteo Forecast API
 * in Asia/Kolkata timezone, with 10-minute caching and in-flight deduplication.
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  options?: { forceRefresh?: boolean; signal?: AbortSignal }
): Promise<WeatherData> {
  const key = coordKey(latitude, longitude);
  const cached = weatherCache.get(key);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!options?.forceRefresh) {
    const pending = inFlightWeather.get(key);
    if (pending) {
      return pending;
    }
  }

  const requestPromise = (async () => {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
      );
      url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,weather_code');
      url.searchParams.set('timezone', 'Asia/Kolkata');

      const response = await fetch(url.toString(), { signal: options?.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo weather error (HTTP ${response.status})`);
      }

      const json = (await response.json()) as {
        current?: {
          time?: string;
          temperature_2m?: number;
          relative_humidity_2m?: number;
          wind_speed_10m?: number;
          weather_code?: number;
          is_day?: number;
        };
        hourly?: {
          time?: string[];
          temperature_2m?: Array<number | null>;
          wind_speed_10m?: Array<number | null>;
          weather_code?: Array<number | null>;
        };
      };

      if (
        !json.current ||
        typeof json.current.temperature_2m !== 'number' ||
        typeof json.current.relative_humidity_2m !== 'number' ||
        typeof json.current.wind_speed_10m !== 'number' ||
        typeof json.current.weather_code !== 'number'
      ) {
        throw new Error('Incomplete live weather payload from Open-Meteo.');
      }

      const wTimes = json.hourly?.time ?? [];
      const wTemps = json.hourly?.temperature_2m ?? [];
      const wWinds = json.hourly?.wind_speed_10m ?? [];
      const wCodes = json.hourly?.weather_code ?? [];

      const hourly = wTimes.map((time, idx) => ({
        time,
        temperatureC: typeof wTemps[idx] === 'number' ? Math.round(wTemps[idx]) : null,
        windSpeedKmh: typeof wWinds[idx] === 'number' ? Math.round(wWinds[idx]) : null,
        weatherCode: typeof wCodes[idx] === 'number' ? wCodes[idx] : null,
      }));

      const parsed: WeatherData = {
        currentTime: json.current.time ?? new Date().toISOString(),
        temperatureC: Math.round(json.current.temperature_2m),
        humidityPct: Math.round(json.current.relative_humidity_2m),
        windSpeedKmh: Math.round(json.current.wind_speed_10m),
        weatherCode: json.current.weather_code,
        isDay: json.current.is_day === 1,
        hourly,
        fetchedAt: new Date().toISOString(),
      };

      weatherCache.set(key, {
        expiresAt: Date.now() + TEN_MINUTES_MS,
        value: parsed,
      });

      return parsed;
    } finally {
      inFlightWeather.delete(key);
    }
  })();

  if (!options?.forceRefresh) {
    inFlightWeather.set(key, requestPromise);
  }
  return requestPromise;
}

/**
 * Clears all Open-Meteo caches and in-flight tracking maps (useful in tests or hard refresh).
 */
export function clearOpenMeteoCache(): void {
  geoCache.clear();
  airCache.clear();
  weatherCache.clear();
  inFlightGeo.clear();
  inFlightAir.clear();
  inFlightWeather.clear();
}

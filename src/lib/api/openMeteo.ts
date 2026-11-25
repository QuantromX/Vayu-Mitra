import { UpstreamApiError } from '../errors.ts';
import {
  fetchJsonWithTimeoutAndRetry,
  resolveWithSwrCache,
  type SwrCacheEntry,
} from './httpClient.ts';
import {
  type OfflineSnapshot,
  loadLastKnownSnapshot,
  saveLastKnownSnapshot,
} from './offlineSnapshot.ts';
import {
  type RawAirPayload,
  type RawWeatherPayload,
  parseAirQualityPayload,
  parseWeatherPayload,
} from './openMeteoParsers.ts';
import type { AirQualityData, CityLocation, WeatherData } from '../../types/index.ts';

export type { OfflineSnapshot };
export { loadLastKnownSnapshot, saveLastKnownSnapshot };

export interface FetchOptions {
  forceRefresh?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

const geoCache = new Map<string, SwrCacheEntry<CityLocation[]>>();
const airCache = new Map<string, SwrCacheEntry<AirQualityData>>();
const weatherCache = new Map<string, SwrCacheEntry<WeatherData>>();
const inFlightGeo = new Map<string, Promise<CityLocation[]>>();
const inFlightAir = new Map<string, Promise<AirQualityData>>();
const inFlightWeather = new Map<string, Promise<WeatherData>>();

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function assertValidCoordinates(latitude: number, longitude: number): void {
  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  if (!valid) {
    throw new UpstreamApiError('Invalid geographic coordinates.', { statusCode: 400 });
  }
}

export async function searchIndianCities(
  query: string,
  signalOrOptions?: AbortSignal | FetchOptions
): Promise<CityLocation[]> {
  const options: FetchOptions =
    signalOrOptions && 'aborted' in signalOrOptions
      ? { signal: signalOrOptions }
      : (signalOrOptions ?? {});
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return resolveWithSwrCache({
    cache: geoCache,
    inFlight: inFlightGeo,
    key: trimmed.toLowerCase(),
    forceRefresh: Boolean(options.forceRefresh),
    dedupeOnRefresh: true,
    fetcher: async () => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', trimmed);
      url.searchParams.set('count', '5');
      url.searchParams.set('countryCode', 'IN');
      url.searchParams.set('language', 'en');
      const json = await fetchJsonWithTimeoutAndRetry<{ results?: CityLocation[] }>(
        url.toString(),
        'City search failed',
        options
      );
      return (json.results ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        admin1: item.admin1,
        latitude: item.latitude,
        longitude: item.longitude,
      }));
    },
  });
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  options?: FetchOptions
): Promise<AirQualityData> {
  assertValidCoordinates(latitude, longitude);
  return resolveWithSwrCache({
    cache: airCache,
    inFlight: inFlightAir,
    key: coordKey(latitude, longitude),
    forceRefresh: Boolean(options?.forceRefresh),
    dedupeOnRefresh: false,
    fetcher: async () => {
      const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set('current', 'pm2_5,pm10');
      url.searchParams.set('hourly', 'pm2_5,pm10');
      url.searchParams.set('past_days', '1');
      url.searchParams.set('forecast_days', '2');
      url.searchParams.set('timezone', 'Asia/Kolkata');
      const json = await fetchJsonWithTimeoutAndRetry<RawAirPayload>(
        url.toString(),
        'Open-Meteo air quality error',
        options
      );
      return parseAirQualityPayload(json);
    },
  });
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  options?: FetchOptions
): Promise<WeatherData> {
  assertValidCoordinates(latitude, longitude);
  return resolveWithSwrCache({
    cache: weatherCache,
    inFlight: inFlightWeather,
    key: coordKey(latitude, longitude),
    forceRefresh: Boolean(options?.forceRefresh),
    dedupeOnRefresh: false,
    fetcher: async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set(
        'current',
        'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day'
      );
      url.searchParams.set('hourly', 'temperature_2m,wind_speed_10m,weather_code');
      url.searchParams.set('timezone', 'Asia/Kolkata');
      const json = await fetchJsonWithTimeoutAndRetry<RawWeatherPayload>(
        url.toString(),
        'Open-Meteo weather error',
        options
      );
      return parseWeatherPayload(json);
    },
  });
}

export function clearOpenMeteoCache(): void {
  geoCache.clear();
  airCache.clear();
  weatherCache.clear();
  inFlightGeo.clear();
  inFlightAir.clear();
  inFlightWeather.clear();
}

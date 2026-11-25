import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAirQuality,
  fetchWeather,
  loadLastKnownSnapshot,
  saveLastKnownSnapshot,
} from '../lib/api/openMeteo.ts';
import { evaluateAirQuality } from '../lib/naqi/naqi.ts';
import type {
  AirQualityData,
  CityLocation,
  NaqiResult,
  WeatherData,
} from '../types/index.ts';

export interface UseAirDataState {
  air: AirQualityData | null;
  weather: WeatherData | null;
  naqi: NaqiResult | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isOfflineData: boolean;
  offlineSavedAt: string | null;
  retry: (forceRefresh?: boolean) => void;
}

interface AirFetchCallbacks {
  signal: AbortSignal;
  isActive: () => boolean;
  city: CityLocation;
  forceRefresh: boolean;
  setAir: (data: AirQualityData) => void;
  setWeather: (data: WeatherData) => void;
  setLastUpdated: (date: Date) => void;
  setIsOfflineData: (val: boolean) => void;
  setOfflineSavedAt: (val: string | null) => void;
  setError: (val: string | null) => void;
  setLoading: (val: boolean) => void;
}

async function runAirAndWeatherFetch(cb: AirFetchCallbacks): Promise<void> {
  cb.setLoading(true);
  cb.setError(null);

  try {
    const [airRes, weatherRes] = await Promise.all([
      fetchAirQuality(cb.city.latitude, cb.city.longitude, {
        forceRefresh: cb.forceRefresh,
        signal: cb.signal,
      }),
      fetchWeather(cb.city.latitude, cb.city.longitude, {
        forceRefresh: cb.forceRefresh,
        signal: cb.signal,
      }),
    ]);

    if (!cb.isActive()) return;
    cb.setAir(airRes);
    cb.setWeather(weatherRes);
    cb.setLastUpdated(new Date(airRes.fetchedAt));
    cb.setIsOfflineData(false);
    cb.setOfflineSavedAt(null);
    saveLastKnownSnapshot(cb.city.id, airRes, weatherRes);
  } catch (err) {
    if (!cb.isActive()) return;
    if (err instanceof DOMException && err.name === 'AbortError') return;

    const message =
      err instanceof Error ? err.message : 'Unable to load live Open-Meteo data.';
    const saved = loadLastKnownSnapshot(cb.city.id);
    if (saved) {
      cb.setAir(saved.air);
      cb.setWeather(saved.weather);
      cb.setLastUpdated(new Date(saved.savedAt));
      cb.setIsOfflineData(true);
      cb.setOfflineSavedAt(saved.savedAt);
    } else {
      cb.setIsOfflineData(false);
      cb.setOfflineSavedAt(null);
    }
    cb.setError(message);
  } finally {
    if (cb.isActive()) {
      cb.setLoading(false);
    }
  }
}

/**
 * Fetches live Open-Meteo air quality and weather data for the active city,
 * saves the last-known snapshot locally for graceful offline fallback, and derives the India NAQI estimate.
 */
export function useAirData(city: CityLocation): UseAirDataState {
  const [air, setAir] = useState<AirQualityData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOfflineData, setIsOfflineData] = useState<boolean>(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<{ count: number; force: boolean }>({
    count: 0,
    force: false,
  });

  const retry = useCallback((forceRefresh = true) => {
    setRefreshTick((prev) => ({ count: prev.count + 1, force: forceRefresh }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void runAirAndWeatherFetch({
      signal: controller.signal,
      isActive: () => active,
      city,
      forceRefresh: refreshTick.force,
      setAir,
      setWeather,
      setLastUpdated,
      setIsOfflineData,
      setOfflineSavedAt,
      setError,
      setLoading,
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [city, refreshTick]);

  const naqi = useMemo(() => (air ? evaluateAirQuality(air) : null), [air]);

  return {
    air,
    weather,
    naqi,
    loading,
    error,
    lastUpdated,
    isOfflineData,
    offlineSavedAt,
    retry,
  };
}

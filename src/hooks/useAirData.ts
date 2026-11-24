import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAirQuality, fetchWeather } from '../lib/api/openMeteo';
import { evaluateAirQuality } from '../lib/naqi/naqi';
import type { AirQualityData, CityLocation, NaqiResult, WeatherData } from '../types';

export interface UseAirDataState {
  air: AirQualityData | null;
  weather: WeatherData | null;
  naqi: NaqiResult | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  retry: (forceRefresh?: boolean) => void;
}

/**
 * Fetches live Open-Meteo air quality and weather data for the active city
 * and derives the India NAQI estimate and hourly windows.
 */
export function useAirData(city: CityLocation): UseAirDataState {
  const [air, setAir] = useState<AirQualityData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [airRes, weatherRes] = await Promise.all([
          fetchAirQuality(city.latitude, city.longitude, {
            forceRefresh: refreshTick.force,
            signal: controller.signal,
          }),
          fetchWeather(city.latitude, city.longitude, {
            forceRefresh: refreshTick.force,
            signal: controller.signal,
          }),
        ]);

        if (!active) return;
        setAir(airRes);
        setWeather(weatherRes);
        setLastUpdated(new Date(airRes.fetchedAt));
      } catch (err) {
        if (!active) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load live Open-Meteo data.';
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [city.latitude, city.longitude, refreshTick]);

  const naqi = useMemo(() => {
    if (!air) return null;
    return evaluateAirQuality(air);
  }, [air]);

  return {
    air,
    weather,
    naqi,
    loading,
    error,
    lastUpdated,
    retry,
  };
}

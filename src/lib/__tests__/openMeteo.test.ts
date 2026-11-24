import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOpenMeteoCache,
  fetchAirQuality,
  fetchWeather,
  searchIndianCities,
} from '../api/openMeteo.ts';

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Open-Meteo API Client (Mocked Fetch, 10m Cache & In-Flight Dedupe)', () => {
  beforeEach(() => {
    clearOpenMeteoCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearOpenMeteoCache();
    vi.restoreAllMocks();
  });

  it('caches city search for 10 minutes and deduplicates concurrent requests', async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({
        results: [
          {
            id: 1273294,
            name: 'Delhi',
            admin1: 'National Capital Territory of Delhi',
            latitude: 28.65195,
            longitude: 77.23149,
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    // Concurrent calls for the same query share 1 network fetch
    const [a, b] = await Promise.all([
      searchIndianCities('Delhi'),
      searchIndianCities('  delhi '),
    ]);
    expect(a).toHaveLength(1);
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Subsequent call within 10 minutes hits cache
    const c = await searchIndianCities('Delhi');
    expect(c).toEqual(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Short queries (<2 chars) skip fetch
    expect(await searchIndianCities('D')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches air quality & weather responses for 10 minutes and supports forceRefresh', async () => {
    const airPayload = {
      latitude: 28.65,
      longitude: 77.23,
      current: { time: '2026-11-23T10:00', pm2_5: 112.4, pm10: 185.2 },
      hourly: {
        time: ['2026-11-23T10:00', '2026-11-23T11:00'],
        pm2_5: [112.4, 108.1],
        pm10: [185.2, 179.0],
      },
    };
    const weatherPayload = {
      current: {
        time: '2026-11-23T10:00',
        temperature_2m: 23.4,
        relative_humidity_2m: 56,
        wind_speed_10m: 8.2,
        weather_code: 1,
        is_day: 1,
      },
      hourly: {
        time: ['2026-11-23T10:00', '2026-11-23T11:00'],
        temperature_2m: [23.4, 24.8],
        wind_speed_10m: [8.2, 9.5],
        weather_code: [1, 1],
      },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('air-quality-api')) return mockJsonResponse(airPayload);
      return mockJsonResponse(weatherPayload);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Deduplicated concurrent air quality fetches
    const [air1, air2] = await Promise.all([
      fetchAirQuality(28.65, 77.23),
      fetchAirQuality(28.65, 77.23),
    ]);
    expect(air1.currentPm25).toBe(112.4);
    expect(air2).toEqual(air1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Force refresh bypasses cache
    await fetchAirQuality(28.65, 77.23, { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Weather dedupe + cache hit
    const [w1, w2] = await Promise.all([
      fetchWeather(28.65, 77.23),
      fetchWeather(28.65, 77.23),
    ]);
    expect(w1.temperatureC).toBe(23);
    expect(w1.isDay).toBe(true);
    expect(w2).toEqual(w1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await fetchWeather(28.65, 77.23);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws clear errors on upstream HTTP failures or incomplete payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Server error', { status: 503 }))
    );

    await expect(fetchAirQuality(19.07, 72.87)).rejects.toThrow(/HTTP 503/);
    await expect(fetchWeather(19.07, 72.87)).rejects.toThrow(/HTTP 503/);
    await expect(searchIndianCities('Mumbai')).rejects.toThrow(/HTTP 503/);

    clearOpenMeteoCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mockJsonResponse({ current: {} }))
    );
    await expect(fetchAirQuality(19.07, 72.87)).rejects.toThrow(/Incomplete/);
  });
});

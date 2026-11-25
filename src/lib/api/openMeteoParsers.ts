import { UpstreamApiError } from '../errors.ts';
import type {
  AirQualityData,
  HourlyPollutantPoint,
  WeatherData,
} from '../../types/index.ts';

export interface RawAirPayload {
  latitude: number;
  longitude: number;
  current?: { time?: string; pm2_5?: number; pm10?: number };
  hourly?: { time?: string[]; pm2_5?: Array<number | null>; pm10?: Array<number | null> };
}

export function parseAirQualityPayload(json: RawAirPayload): AirQualityData {
  if (
    !json.current ||
    typeof json.current.pm2_5 !== 'number' ||
    typeof json.current.pm10 !== 'number' ||
    !json.current.time
  ) {
    throw new UpstreamApiError('Incomplete live air-quality payload from Open-Meteo.');
  }

  const times = json.hourly?.time ?? [];
  const pm25Series = json.hourly?.pm2_5 ?? [];
  const pm10Series = json.hourly?.pm10 ?? [];

  const hourly: HourlyPollutantPoint[] = times.map((time, idx) => {
    const pm25Val = pm25Series[idx];
    const pm10Val = pm10Series[idx];
    return {
      time,
      hourLabel: time.slice(11, 16),
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: typeof pm25Val === 'number' ? pm25Val : null,
      pm10: typeof pm10Val === 'number' ? pm10Val : null,
      naqi: null,
      category: null,
    };
  });

  return {
    latitude: json.latitude,
    longitude: json.longitude,
    currentTime: json.current.time,
    currentPm25: Number(json.current.pm2_5.toFixed(1)),
    currentPm10: Number(json.current.pm10.toFixed(1)),
    hourly,
    fetchedAt: new Date().toISOString(),
  };
}

interface RawWeatherCurrent {
  time?: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  weather_code: number;
  is_day?: number;
}

export interface RawWeatherPayload {
  current?: Partial<RawWeatherCurrent>;
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
}

function hasValidWeatherCurrent(
  cur: Partial<RawWeatherCurrent> | undefined
): cur is RawWeatherCurrent {
  return Boolean(
    cur &&
    typeof cur.temperature_2m === 'number' &&
    typeof cur.relative_humidity_2m === 'number' &&
    typeof cur.wind_speed_10m === 'number' &&
    typeof cur.weather_code === 'number'
  );
}

function mapWeatherHourlyPoint(
  time: string,
  idx: number,
  hourly: NonNullable<RawWeatherPayload['hourly']>
) {
  const tempVal = hourly.temperature_2m?.[idx];
  const windVal = hourly.wind_speed_10m?.[idx];
  const codeVal = hourly.weather_code?.[idx];
  return {
    time,
    temperatureC: typeof tempVal === 'number' ? Math.round(tempVal) : null,
    windSpeedKmh: typeof windVal === 'number' ? Math.round(windVal) : null,
    weatherCode: typeof codeVal === 'number' ? codeVal : null,
  };
}

export function parseWeatherPayload(json: RawWeatherPayload): WeatherData {
  if (!hasValidWeatherCurrent(json.current)) {
    throw new UpstreamApiError('Incomplete live weather payload from Open-Meteo.');
  }
  const hourlyRaw = json.hourly ?? {};
  const hourly = (hourlyRaw.time ?? []).map((time, idx) =>
    mapWeatherHourlyPoint(time, idx, hourlyRaw)
  );

  return {
    currentTime: json.current.time ?? new Date().toISOString(),
    temperatureC: Math.round(json.current.temperature_2m),
    humidityPct: Math.round(json.current.relative_humidity_2m),
    windSpeedKmh: Math.round(json.current.wind_speed_10m),
    weatherCode: json.current.weather_code,
    isDay: json.current.is_day === 1,
    hourly,
    fetchedAt: new Date().toISOString(),
  };
}

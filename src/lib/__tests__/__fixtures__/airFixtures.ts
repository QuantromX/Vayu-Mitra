import { evaluateAirQuality } from '../../naqi/naqi.ts';
import { computeScrubbedHourState } from '../../naqi/scrubber.ts';
import { DEFAULT_PROFILE } from '../../profiles/samples.ts';
import { resolveThemeTokens } from '../../theme/theme.ts';
import type {
  AdviceResponse,
  AirQualityData,
  AskResponse,
  NaqiResult,
  PhotoCheckResponse,
  ScrubbedHourState,
  ThemeTokens,
  WeatherData,
} from '../../../types/index.ts';

export function buildHourlyOpenMeteoAirPayload() {
  const times: string[] = [];
  const pm25: number[] = [];
  const pm10: number[] = [];
  for (let day = 22; day <= 23; day++) {
    for (let h = 0; h < 24; h++) {
      times.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
      pm25.push(h >= 14 && h <= 16 ? 48 : 112);
      pm10.push(h >= 14 && h <= 16 ? 88 : 185);
    }
  }
  return {
    latitude: 28.65,
    longitude: 77.23,
    current: { time: '2026-11-22T10:00', pm2_5: 112, pm10: 185 },
    hourly: { time: times, pm2_5: pm25, pm10 },
  };
}

export function buildHourlyOpenMeteoWeatherPayload() {
  const times: string[] = [];
  const temps: number[] = [];
  const winds: number[] = [];
  const codes: number[] = [];
  for (let day = 22; day <= 23; day++) {
    for (let h = 0; h < 24; h++) {
      times.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
      temps.push(24);
      winds.push(8);
      codes.push(1);
    }
  }
  return {
    current: {
      time: '2026-11-22T10:00',
      temperature_2m: 24,
      relative_humidity_2m: 56,
      wind_speed_10m: 8,
      weather_code: 1,
      is_day: 1,
    },
    hourly: {
      time: times,
      temperature_2m: temps,
      wind_speed_10m: winds,
      weather_code: codes,
    },
  };
}

export const SAMPLE_ADVICE: AdviceResponse = {
  verdict: {
    level: 'Poor',
    headline: 'Cut outdoor exertion; shift errands to Today 14:00–17:00',
    summary: 'Fine PM2.5 is elevated across Delhi right now.',
  },
  outdoor: [
    {
      action: 'Shift walks to Today 14:00–17:00.',
      why: 'Afternoon mixing reduces particulate density.',
      timeWindow: 'Today 14:00–17:00',
    },
  ],
  indoor: [
    {
      action: 'Run HEPA purifier on high during peak evening hours.',
      why: 'Keeps indoor PM2.5 infiltration controlled.',
    },
  ],
  routine: [
    {
      action: 'Use the metro instead of solo driving.',
      why: 'Reduces roadside particle exposure and tailpipe dust.',
      co2Benefit: 'Approx. 1.4 kg CO2 saved (assumes 10 km car vs metro)',
    },
  ],
  mask: {
    recommended: true,
    type: 'N95 / FFP2',
    why: 'Poor NAQI recommends N95 outdoors for everyone.',
  },
  forWhom: [{ group: 'Children', advice: 'Keep evening sports indoors today.' }],
  disclaimer:
    'NAQI-style estimate, not medical advice. Grounded in Open-Meteo readings; consult a doctor for symptoms.',
  source: 'fallback',
};

export const SAMPLE_ASK_RESPONSE: AskResponse = {
  answer: 'Keep outdoor play indoors after 4 PM; aim for Today 14:00–17:00.',
  verdict: 'no',
  why: 'Live NAQI is 245 (Poor) with PM2.5 at 102 µg/m³.',
  bestTime: 'Today 14:00–17:00',
  dataUsed: ['NAQI 245 (Poor)', 'PM2.5 102 µg/m³'],
  disclaimer: 'NAQI-style estimate, not medical advice.',
  source: 'gemini',
};

export const SAMPLE_PHOTO_RESPONSE: PhotoCheckResponse = {
  observations: ['Balcony door seal shows a visible gap near the bottom frame.'],
  purifierPlacement: 'Place HEPA purifier 1.5 m from the bed with clear vents.',
  ventilationTip: 'Keep balcony doors shut until Today 14:00–17:00.',
  confidence: 'medium',
  disclaimer: 'Advisory visual estimate only, not a PM2.5 measurement.',
  source: 'gemini',
};

export function makeNaqiAndWeatherFixtures(): {
  air: AirQualityData;
  weather: WeatherData;
  naqi: NaqiResult;
  theme: ThemeTokens;
  scrubbed: ScrubbedHourState;
} {
  const airRaw = buildHourlyOpenMeteoAirPayload();
  const weatherRaw = buildHourlyOpenMeteoWeatherPayload();
  const air: AirQualityData = {
    latitude: airRaw.latitude,
    longitude: airRaw.longitude,
    currentTime: airRaw.current.time,
    currentPm25: airRaw.current.pm2_5,
    currentPm10: airRaw.current.pm10,
    hourly: airRaw.hourly.time.map((time, idx) => ({
      time,
      hourLabel: time.slice(11, 16),
      dayLabel: 'Today',
      isCurrentHour: false,
      pm2_5: airRaw.hourly.pm2_5[idx] ?? null,
      pm10: airRaw.hourly.pm10[idx] ?? null,
      naqi: null,
      category: null,
    })),
    fetchedAt: '2026-11-22T04:30:00Z',
  };
  const weather: WeatherData = {
    currentTime: weatherRaw.current.time,
    temperatureC: weatherRaw.current.temperature_2m,
    humidityPct: weatherRaw.current.relative_humidity_2m,
    windSpeedKmh: weatherRaw.current.wind_speed_10m,
    weatherCode: weatherRaw.current.weather_code,
    isDay: true,
    hourly: weatherRaw.hourly.time.map((time, idx) => ({
      time,
      temperatureC: weatherRaw.hourly.temperature_2m[idx] ?? null,
      windSpeedKmh: weatherRaw.hourly.wind_speed_10m[idx] ?? null,
      weatherCode: weatherRaw.hourly.weather_code[idx] ?? null,
    })),
    fetchedAt: '2026-11-22T04:30:00Z',
  };
  const naqi = evaluateAirQuality(air);
  const theme = resolveThemeTokens({
    category: naqi.category,
    weatherCode: weather.weatherCode,
    isDay: weather.isDay,
    pm25: naqi.pm25Used,
  });
  const scrubbed = computeScrubbedHourState({
    naqi,
    weather,
    activeIndex: 0,
    household: DEFAULT_PROFILE.household,
    language: 'en',
  });
  return { air, weather, naqi, theme, scrubbed };
}

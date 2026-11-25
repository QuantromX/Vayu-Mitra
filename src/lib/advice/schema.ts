import { z } from 'zod';
import { APP_CONFIG, INDIA_BOUNDS } from '../config.ts';
import { isWithinIndiaBounds } from '../shared/domain.ts';

export { buildFallbackAdvice } from './fallback.ts';

export const NaqiCategorySchema = z.enum([
  'Good',
  'Satisfactory',
  'Moderate',
  'Poor',
  'Very Poor',
  'Severe',
]);

export const AdviceActionSchema = z
  .object({
    action: z.string().min(4).max(320),
    why: z.string().min(8).max(480),
    timeWindow: z.string().min(2).max(100).optional(),
  })
  .strict();

export const RoutineActionSchema = z
  .object({
    action: z.string().min(4).max(320),
    why: z.string().min(8).max(480),
    co2Benefit: z.string().min(2).max(200).optional(),
  })
  .strict();

export const GeminiAdvicePayloadSchema = z
  .object({
    verdict: z
      .object({
        level: NaqiCategorySchema,
        headline: z.string().min(4).max(180),
        summary: z.string().min(10).max(480),
      })
      .strict(),
    outdoor: z.array(AdviceActionSchema).min(1).max(4),
    indoor: z.array(AdviceActionSchema).min(1).max(6),
    routine: z.array(RoutineActionSchema).min(1).max(4),
    mask: z
      .object({
        recommended: z.boolean(),
        type: z.string().min(2).max(140),
        why: z.string().min(8).max(480),
      })
      .strict(),
    forWhom: z
      .array(
        z
          .object({
            group: z.string().min(2).max(100),
            advice: z.string().min(8).max(380),
          })
          .strict()
      )
      .min(1)
      .max(6),
  })
  .strict();

const WindowSchema = z
  .object({
    startHour: z.string().max(16),
    endHour: z.string().max(16),
    dayLabel: z.enum(['Today', 'Tomorrow']),
    endDayLabel: z.enum(['Today', 'Tomorrow']).optional(),
    avgNaqi: z.number().min(0).max(500),
    avgPm25: z.number().min(0).max(2000),
  })
  .strict();

/**
 * Restricts city names to Unicode letters, combining marks, digits, spaces, and common punctuation.
 */
export const CITY_NAME_REGEX = /^[\p{L}\p{M}0-9\s.,'()-]+$/u;

export const AdviceRequestSchema = z
  .object({
    cityName: z
      .string()
      .trim()
      .min(1, 'City name is required')
      .max(
        APP_CONFIG.maxCityNameLength,
        `City name must be ${APP_CONFIG.maxCityNameLength} characters or fewer`
      )
      .regex(CITY_NAME_REGEX, 'City name contains unsupported characters'),
    latitude: z
      .number()
      .min(INDIA_BOUNDS.minLat, 'Latitude must be within India bounds')
      .max(INDIA_BOUNDS.maxLat, 'Latitude must be within India bounds')
      .optional(),
    longitude: z
      .number()
      .min(INDIA_BOUNDS.minLon, 'Longitude must be within India bounds')
      .max(INDIA_BOUNDS.maxLon, 'Longitude must be within India bounds')
      .optional(),
    aqi: z.number().min(0).max(500),
    category: NaqiCategorySchema,
    dominantPollutant: z.enum(['PM2.5', 'PM10']),
    pm25: z.number().min(0).max(2000),
    pm10: z.number().min(0).max(3000),
    basis: z.enum(['rolling_24h', 'current']),
    temperatureC: z.number().min(-30).max(65),
    humidityPct: z.number().min(0).max(100),
    windSpeedKmh: z.number().min(0).max(250),
    cleanestWindow: WindowSchema.nullable(),
    worstWindow: WindowSchema.nullable(),
    household: z
      .array(z.enum(['kids', 'seniors', 'pregnant', 'asthma_heart', 'outdoor_worker']))
      .max(5),
    lifestyle: z.enum([
      'wfh',
      'commute_bike',
      'commute_car',
      'commute_metro',
      'commute_bus',
      'runner_walker',
    ]),
    hasPurifier: z.boolean(),
    language: z.enum(['en', 'hi']),
  })
  .strict()
  .refine(
    (data) => {
      if (data.latitude === undefined && data.longitude === undefined) {
        return true;
      }
      if (data.latitude !== undefined && data.longitude !== undefined) {
        return isWithinIndiaBounds(data.latitude, data.longitude);
      }
      return false;
    },
    {
      message: 'Both latitude and longitude must be provided within India bounds',
      path: ['latitude'],
    }
  );

export type ValidatedAdviceRequest = z.infer<typeof AdviceRequestSchema>;
export type ValidatedGeminiPayload = z.infer<typeof GeminiAdvicePayloadSchema>;

import { describe, expect, it } from 'vitest';
import { AdviceRequestSchema } from '../advice/schema.ts';
import {
  AskGeminiPayloadSchema,
  AskRequestSchema,
  buildFallbackAskAnswer,
} from '../ask/schema.ts';
import { SAMPLE_PROFILES } from '../profiles/samples.ts';
import { validatePhotoFile } from '../vision/exifStrip.ts';
import {
  MAX_PHOTO_BYTES,
  PhotoCheckGeminiPayloadSchema,
  PhotoCheckRequestSchema,
  buildFallbackPhotoCheck,
  getBase64ByteLength,
} from '../vision/schema.ts';

describe('Ask VayuMitra, Photo Check & 8 Sample Profiles', () => {
  it('validates all 8 sample profiles cleanly', () => {
    expect(SAMPLE_PROFILES).toHaveLength(8);
    const ids = new Set(SAMPLE_PROFILES.map((s) => s.id));
    expect(ids.size).toBe(8);

    for (const sample of SAMPLE_PROFILES) {
      const check = AdviceRequestSchema.safeParse({
        cityName: sample.profile.city.name,
        aqi: 150,
        category: 'Moderate',
        dominantPollutant: 'PM2.5',
        pm25: 75,
        pm10: 120,
        basis: 'rolling_24h',
        temperatureC: 25,
        humidityPct: 55,
        windSpeedKmh: 9,
        cleanestWindow: null,
        worstWindow: null,
        household: sample.profile.household,
        lifestyle: sample.profile.lifestyle,
        hasPurifier: sample.profile.hasPurifier,
        language: sample.profile.language,
      });
      expect(check.success).toBe(true);
    }
  });

  it('validates Ask VayuMitra schemas and rejects unsafe city names', () => {
    const validReq = AskRequestSchema.safeParse({
      question: 'Can kids play cricket outside after 4 PM?',
      cityName: 'Delhi',
      aqi: 245,
      category: 'Poor',
      dominantPollutant: 'PM2.5',
      pm25: 102,
      pm10: 168,
      temperatureC: 24,
      humidityPct: 58,
      windSpeedKmh: 6,
      cleanestWindow: {
        startHour: '14:00',
        endHour: '17:00',
        dayLabel: 'Today',
        avgNaqi: 185,
        avgPm25: 84,
      },
      worstWindow: {
        startHour: '21:00',
        endHour: '00:00',
        dayLabel: 'Today',
        avgNaqi: 310,
        avgPm25: 132,
      },
      forwardHourly: [],
      household: ['kids'],
      lifestyle: 'commute_metro',
      hasPurifier: true,
      language: 'en',
    });
    expect(validReq.success).toBe(true);

    const badReq = AskRequestSchema.safeParse({
      question: 'hi',
      cityName: '<script>alert(1)</script>',
    });
    expect(badReq.success).toBe(false);
  });

  it('builds deterministic bilingual Ask VayuMitra fallback grounded without "clean air" when AQI != Good', () => {
    const enFallback = buildFallbackAskAnswer({
      question: 'Can kids play cricket outside right now?',
      cityName: 'Delhi',
      aqi: 320,
      category: 'Very Poor',
      dominantPollutant: 'PM2.5',
      pm25: 145,
      pm10: 215,
      temperatureC: 22,
      humidityPct: 60,
      windSpeedKmh: 5,
      cleanestWindow: {
        startHour: '14:00',
        endHour: '17:00',
        dayLabel: 'Tomorrow',
        avgNaqi: 245,
        avgPm25: 103,
      },
      worstWindow: {
        startHour: '21:00',
        endHour: '00:00',
        dayLabel: 'Today',
        avgNaqi: 360,
        avgPm25: 190,
      },
      household: ['kids'],
      lifestyle: 'commute_metro',
      hasPurifier: true,
      language: 'en',
    });

    expect(enFallback.verdict).toBe('no');
    expect(enFallback.source).toBe('fallback');
    expect(JSON.stringify(enFallback).toLowerCase()).not.toContain('clean air');
    expect(enFallback.bestTime).toBe('Tomorrow 14:00–17:00');
    expect(AskGeminiPayloadSchema.safeParse(enFallback).success).toBe(true);

    const hiWindowFallback = buildFallbackAskAnswer({
      question: 'क्या मुझे अभी खिड़की खोलनी चाहिए?',
      cityName: 'Lucknow',
      aqi: 225,
      category: 'Poor',
      dominantPollutant: 'PM2.5',
      pm25: 98,
      pm10: 140,
      temperatureC: 24,
      humidityPct: 55,
      windSpeedKmh: 7,
      cleanestWindow: {
        startHour: '13:00',
        endHour: '16:00',
        dayLabel: 'Today',
        avgNaqi: 170,
        avgPm25: 80,
      },
      worstWindow: null,
      household: ['seniors'],
      lifestyle: 'wfh',
      hasPurifier: false,
      language: 'hi',
    });

    expect(hiWindowFallback.verdict).toBe('caution');
    expect(hiWindowFallback.bestTime).toBe('आज 13:00–16:00');
    expect(AskGeminiPayloadSchema.safeParse(hiWindowFallback).success).toBe(true);
  });

  it('validates Photo Check file limits, base64 size <= 4MB, and fallback output', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: 1024 }).valid).toBe(true);
    expect(validatePhotoFile({ type: 'image/gif', size: 1024 }).valid).toBe(false);
    expect(
      validatePhotoFile({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }).valid
    ).toBe(false);
    expect(validatePhotoFile({ type: 'image/webp', size: 0 }).valid).toBe(false);

    const validBase64 = 'A'.repeat(64);
    expect(getBase64ByteLength(validBase64)).toBe(48);

    const validPhotoReq = PhotoCheckRequestSchema.safeParse({
      mimeType: 'image/webp',
      imageBase64: validBase64,
      sceneHint: 'room',
      aqi: 240,
      category: 'Poor',
      hasPurifier: true,
      language: 'en',
    });
    expect(validPhotoReq.success).toBe(true);

    const badMime = PhotoCheckRequestSchema.safeParse({
      mimeType: 'image/svg+xml',
      imageBase64: validBase64,
      language: 'en',
    });
    expect(badMime.success).toBe(false);

    // Exceeds 4 MB decoded size
    const oversizedBase64 = 'A'.repeat(5_700_000);
    const oversizedReq = PhotoCheckRequestSchema.safeParse({
      mimeType: 'image/jpeg',
      imageBase64: oversizedBase64,
      language: 'en',
    });
    expect(oversizedReq.success).toBe(false);

    const fallbackPhoto = buildFallbackPhotoCheck({
      sceneHint: 'room',
      aqi: 260,
      category: 'Poor',
      hasPurifier: true,
      language: 'en',
    });
    expect(fallbackPhoto.source).toBe('fallback');
    expect(fallbackPhoto.confidence).toBe('low');
    expect(PhotoCheckGeminiPayloadSchema.safeParse(fallbackPhoto).success).toBe(
      true
    );
  });
});

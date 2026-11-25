import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  getBoundedCache,
  getOrCompute,
  setBoundedCache,
  type BoundedCache,
} from '../../../server/cache.ts';
import {
  createGeminiCaller,
  parseQuotaCooldownMs,
  withAbortTimeout,
  type GeminiLikeClient,
} from '../../../server/gemini.ts';
import {
  createCorsMiddleware,
  createErrorHandler,
  createSecurityHeadersMiddleware,
  parseBody,
} from '../../../server/middleware.ts';
import { createRateLimiter, enforceRateLimit } from '../../../server/rateLimiter.ts';
import { GEMINI_CONFIG, SERVER_RATE_LIMITS } from '../config.ts';
import { AppError, UpstreamApiError } from '../errors.ts';
import { fetchJsonWithTimeoutAndRetry, resolveWithSwrCache } from '../api/httpClient.ts';
import { loadLastKnownSnapshot, saveLastKnownSnapshot } from '../api/offlineSnapshot.ts';
import { buildFallbackAdvice } from '../advice/fallback.ts';
import { buildPrimaryRoutineItem } from '../advice/fallbackRoutines.ts';
import {
  createParticleSet,
  drawParticleFrame,
} from '../../components/hero/particleEngine.ts';
import { buildFallbackAskAnswer } from '../ask/fallback.ts';
import { computeSubIndex, evaluateAirQuality, PM25_BREAKPOINTS } from '../naqi/naqi.ts';
import {
  buildVerdictHumanLine,
  computeSunArcPosition,
  getVerdictPill,
  getVerdictPillLabel,
} from '../naqi/verdict.ts';
import { loadSavedProfile, saveProfileToStorage } from '../profiles/samples.ts';
import { buildFallbackPhotoCheck } from '../vision/fallback.ts';
import { PhotoCheckRequestSchema } from '../vision/schema.ts';
import { z } from 'zod';
import type { HouseholdGroup, LifestyleMode, NaqiCategory } from '../../types/index.ts';
import { makeNaqiAndWeatherFixtures } from './__fixtures__/airFixtures.ts';

function mockExpressRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  let ended = false;
  const res = {
    locals: { correlationId: 'corr-123' },
    headersSent: false,
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    end() {
      ended = true;
      return res;
    },
  };
  return {
    res: res as unknown as Response,
    getStatus: () => statusCode,
    getBody: () => body,
    getHeader: (k: string) => headers[k.toLowerCase()],
    isEnded: () => ended,
  };
}

describe('Core Server & Pure Lib Edge Cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('bounds cache size, expires TTL entries, and skips caching when predicate is false', async () => {
    const cache: BoundedCache<string> = new Map();
    for (let i = 0; i < GEMINI_CONFIG.cacheMaxEntries + 5; i++) {
      setBoundedCache(cache, `k-${i}`, `v-${i}`);
    }
    expect(cache.size).toBe(GEMINI_CONFIG.cacheMaxEntries);
    expect(getBoundedCache(cache, 'k-0')).toBeNull();
    expect(getBoundedCache(cache, `k-${GEMINI_CONFIG.cacheMaxEntries + 4}`)).toBe(
      `v-${GEMINI_CONFIG.cacheMaxEntries + 4}`
    );

    cache.set('expired', { expiresAt: Date.now() - 10, value: 'stale' });
    expect(getBoundedCache(cache, 'expired')).toBeNull();
    expect(cache.has('expired')).toBe(false);

    const inFlight = new Map<string, Promise<string>>();
    const res = await getOrCompute(
      cache,
      inFlight,
      'no-cache',
      async () => 'fallback-val',
      () => false
    );
    expect(res).toBe('fallback-val');
    expect(getBoundedCache(cache, 'no-cache')).toBeNull();
    expect(inFlight.size).toBe(0);
  });

  it('prunes expired rate-limiter buckets and returns 429 with Retry-After', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ advice: 1, ask: 2, 'photo-check': 1 });
    for (let i = 0; i < 2005; i++) {
      limiter.check('advice', `10.0.${Math.floor(i / 255)}.${i % 255}`);
    }
    vi.advanceTimersByTime(SERVER_RATE_LIMITS.windowMs + 100);
    const fresh = limiter.check('advice', '10.9.9.9');
    expect(fresh.allowed).toBe(true);

    const mock = mockExpressRes();
    const req = { ip: '10.9.9.9' } as Request;
    const blocked = enforceRateLimit(
      limiter,
      'advice',
      req,
      mock.res,
      'Too many advice calls'
    );
    expect(blocked).toBe(false);
    expect(mock.getStatus()).toBe(429);
    expect(mock.getHeader('retry-after')).toBeTruthy();
  });

  it('handles middleware dev CORS, validation errors, AppError, and generic 500 safely', () => {
    const devSec = createSecurityHeadersMiddleware(false);
    const devSecRes = mockExpressRes();
    const next = vi.fn();
    devSec({ header: () => undefined } as unknown as Request, devSecRes.res, next);
    expect(devSecRes.getHeader('content-security-policy')).toContain(
      "frame-ancestors 'self' https://aistudio.google.com https://*.google.com"
    );

    const cors = createCorsMiddleware(new Set(), false);
    const devRes = mockExpressRes();
    cors(
      {
        header: (k: string) =>
          k.toLowerCase() === 'origin' ? 'http://127.0.0.1:5173' : undefined,
        get: () => 'localhost:3000',
        protocol: 'http',
        method: 'GET',
        path: '/api/health',
      } as unknown as Request,
      devRes.res,
      next
    );
    expect(devRes.getHeader('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect(next).toHaveBeenCalled();

    const parsedFail = mockExpressRes();
    expect(
      parseBody(z.object({ a: z.number() }), { a: 'bad' }, parsedFail.res, 'Bad')
    ).toBeNull();
    expect(parsedFail.getStatus()).toBe(400);

    const errHandler = createErrorHandler();
    const appErrRes = mockExpressRes();
    errHandler(
      new AppError('Custom bad request', 'VALIDATION_ERROR', 422),
      {} as Request,
      appErrRes.res,
      next
    );
    expect(appErrRes.getStatus()).toBe(422);

    const genericErrRes = mockExpressRes();
    errHandler(new Error('secret stack info'), {} as Request, genericErrRes.res, next);
    expect(genericErrRes.getStatus()).toBe(500);
    expect(JSON.stringify(genericErrRes.getBody())).not.toContain('secret stack info');

    const sentNext = vi.fn();
    const sentRes = { headersSent: true, locals: {} } as unknown as Response;
    errHandler(new Error('late'), {} as Request, sentRes, sentNext);
    expect(sentNext).toHaveBeenCalled();
  });

  it('handles Gemini timeouts, null client, auth/quota parsing, and empty response retries', async () => {
    vi.useFakeTimers();
    const timeoutPromise = withAbortTimeout(
      () => new Promise<string>(() => undefined),
      500
    );
    const assertion = expect(timeoutPromise).rejects.toThrow(/timed out after 500ms/);
    await vi.advanceTimersByTimeAsync(550);
    await assertion;
    vi.useRealTimers();

    expect(parseQuotaCooldownMs({ status: 403, message: 'PERMISSION_DENIED' })).toEqual({
      isQuota: false,
      isAuth: true,
      cooldownMs: 0,
    });
    expect(parseQuotaCooldownMs('rate limit exceeded').cooldownMs).toBeGreaterThanOrEqual(
      60_000
    );

    const nullCaller = createGeminiCaller(null);
    await expect(
      nullCaller({
        contents: 'hi',
        systemInstruction: 'sys',
        responseSchema: {},
        parse: () => ({ success: false }),
        route: 'ask',
        correlationId: 'c1',
      })
    ).resolves.toBeNull();

    const emptyClient: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => ({ text: '   ' })),
      },
    };
    const emptyCaller = createGeminiCaller(emptyClient);
    const out = await emptyCaller({
      contents: 'hi',
      systemInstruction: 'sys',
      responseSchema: {},
      parse: () => ({ success: false }),
      route: 'advice',
      correlationId: 'c2',
    });
    expect(out).toBeNull();

    const unavailableClient: GeminiLikeClient = {
      models: {
        generateContent: vi.fn(async () => {
          const err = new Error('503 UNAVAILABLE') as Error & { status?: number };
          err.status = 503;
          throw err;
        }),
      },
    };
    const unavailableCaller = createGeminiCaller(unavailableClient);
    await expect(
      unavailableCaller({
        contents: 'hi',
        systemInstruction: 'sys',
        responseSchema: {},
        parse: () => ({ success: false }),
        route: 'advice',
        correlationId: 'c3',
      })
    ).resolves.toBeNull();
    // Both models entered short 503 cooldown, so next call skips generateContent
    await expect(
      unavailableCaller({
        contents: 'hi2',
        systemInstruction: 'sys',
        responseSchema: {},
        parse: () => ({ success: false }),
        route: 'advice',
        correlationId: 'c4',
      })
    ).resolves.toBeNull();
    expect(unavailableClient.models.generateContent).toHaveBeenCalledTimes(4);
  });

  it('handles HTTP client timeouts, non-retryable 400s, and SWR background refresh', async () => {
    const abortMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<globalThis.Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', abortMock);

    await expect(
      fetchJsonWithTimeoutAndRetry('https://example.com/slow', 'Open-Meteo', {
        timeoutMs: 10,
        maxRetries: 0,
      })
    ).rejects.toBeInstanceOf(UpstreamApiError);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bad', { status: 400 }))
    );
    await expect(
      fetchJsonWithTimeoutAndRetry('https://example.com/bad', 'Open-Meteo', {
        maxRetries: 2,
        retryBaseDelayMs: 0,
      })
    ).rejects.toThrow(/HTTP 400/);

    const swrCache = new Map<
      string,
      { expiresAt: number; staleUntil: number; value: string }
    >();
    const inFlight = new Map<string, Promise<string>>();
    swrCache.set('k', {
      expiresAt: Date.now() - 1000,
      staleUntil: Date.now() + 60_000,
      value: 'stale-snapshot',
    });
    const immediate = await resolveWithSwrCache({
      cache: swrCache,
      inFlight,
      key: 'k',
      forceRefresh: false,
      dedupeOnRefresh: true,
      fetcher: async () => {
        throw new Error('background fail');
      },
    });
    expect(immediate).toBe('stale-snapshot');
  });

  it('safely handles offline snapshots and profile storage when unavailable or corrupt', () => {
    const { air, weather } = makeNaqiAndWeatherFixtures();
    expect(saveLastKnownSnapshot(101, air, weather)).toBe(false);
    expect(loadLastKnownSnapshot(101)).toBeNull();
    expect(saveProfileToStorage(loadSavedProfile())).toBe(false);

    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });

    expect(saveLastKnownSnapshot(101, air, weather)).toBe(true);
    expect(loadLastKnownSnapshot(101)?.air.currentPm25).toBe(air.currentPm25);

    store.set('vayumitra_last_snapshot_v1:999', '{broken-json');
    expect(loadLastKnownSnapshot(999)).toBeNull();

    store.set('vayumitra_user_profile_v1', JSON.stringify({ bad: true }));
    expect(loadSavedProfile().city.name).toBe('New Delhi');

    store.set(
      'vayumitra_user_profile_v1',
      JSON.stringify({
        city: {
          id: 5,
          name: 'Jaipur',
          latitude: 26.9,
          longitude: 75.8,
          country: 'India',
        },
        household: ['kids'],
        lifestyle: 'runner_walker',
        hasPurifier: false,
        language: 'hi',
      })
    );
    expect(loadSavedProfile().language).toBe('hi');
  });

  it('covers NAQI boundary fallback, verdicts, sun arc, routines, ask topics, and vision fallbacks', () => {
    expect(computeSubIndex(-5, PM25_BREAKPOINTS)).toBe(0);
    expect(computeSubIndex(600, PM25_BREAKPOINTS)).toBe(500);
    const { air } = makeNaqiAndWeatherFixtures();
    const sparseAir = { ...air, hourly: [] };
    expect(evaluateAirQuality(sparseAir).basis).toBe('current');

    expect(getVerdictPill('Good', [])).toBe('GO');
    expect(getVerdictPill('Moderate', [])).toBe('GO');
    expect(getVerdictPill('Moderate', ['kids'])).toBe('CAUTION');
    expect(getVerdictPill('Severe', [])).toBe('STAY IN');
    expect(getVerdictPillLabel('STAY IN', 'hi')).toBe('घर में रहें');

    expect(computeSunArcPosition(12).isDay).toBe(true);
    expect(computeSunArcPosition(22).isDay).toBe(false);
    expect(computeSunArcPosition(2).isDay).toBe(false);

    const groups: HouseholdGroup[][] = [
      ['kids'],
      ['asthma_heart'],
      ['seniors'],
      ['outdoor_worker'],
      [],
    ];
    for (const cat of ['Good', 'Satisfactory', 'Moderate', 'Poor'] as NaqiCategory[]) {
      for (const hh of groups) {
        expect(
          buildVerdictHumanLine({
            category: cat,
            household: hh,
            hourLabel: '18:00',
            dayLabel: 'Tomorrow',
            isLive: false,
            language: 'en',
          })
        ).toBeTruthy();
        expect(
          buildVerdictHumanLine({
            category: cat,
            household: hh,
            hourLabel: '18:00',
            dayLabel: 'Today',
            isLive: true,
            language: 'hi',
          })
        ).toBeTruthy();
      }
    }

    const lifestyles: LifestyleMode[] = [
      'commute_car',
      'commute_metro',
      'commute_bus',
      'wfh',
      'commute_bike',
      'runner_walker',
    ];
    for (const lifestyle of lifestyles) {
      for (const isPoorOrWorse of [true, false]) {
        for (const hi of [true, false]) {
          expect(
            buildPrimaryRoutineItem({
              lifestyle,
              isPoorOrWorse,
              cleanWindowLabel: 'Today 14:00–17:00',
              worstWindowLabel: 'Today 21:00–00:00',
              hi,
            }).action
          ).toBeTruthy();
        }
      }
    }

    const questions = [
      'Should I open windows right now?',
      'Do I need an N95 mask?',
      'Where should I put the HEPA purifier?',
      'Can kids go for a morning run in the park?',
      'What should I do for commute today?',
    ];
    for (const q of questions) {
      for (const cat of ['Good', 'Moderate', 'Poor', 'Severe'] as NaqiCategory[]) {
        for (const language of ['en', 'hi'] as const) {
          const ans = buildFallbackAskAnswer({
            question: q,
            cityName: 'Delhi',
            aqi: 245,
            category: cat,
            dominantPollutant: 'PM2.5',
            pm25: 102,
            pm10: 170,
            temperatureC: 24,
            humidityPct: 58,
            windSpeedKmh: 7,
            cleanestWindow:
              cat === 'Good'
                ? null
                : {
                    startHour: '14:00',
                    endHour: '17:00',
                    dayLabel: 'Today',
                    avgNaqi: 180,
                    avgPm25: 80,
                  },
            worstWindow: null,
            household: ['kids'],
            lifestyle: 'commute_metro',
            hasPurifier: language === 'en',
            language,
          });
          expect(ans.answer.length).toBeGreaterThan(10);
        }
      }
    }

    const photoSkyHi = buildFallbackPhotoCheck({
      sceneHint: 'sky',
      aqi: 290,
      category: 'Poor',
      hasPurifier: true,
      language: 'hi',
    });
    expect(photoSkyHi.observations.length).toBe(2);
    const photoRoomEn = buildFallbackPhotoCheck({
      sceneHint: 'room',
      aqi: 75,
      category: 'Satisfactory',
      hasPurifier: false,
      language: 'en',
    });
    expect(photoRoomEn.purifierPlacement).toContain('bedroom');

    const pngB64 = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]).toString('base64');
    expect(
      PhotoCheckRequestSchema.safeParse({
        mimeType: 'image/png',
        imageBase64: pngB64,
        language: 'en',
      }).success
    ).toBe(true);

    const webpB64 = Buffer.from('RIFF1234WEBPvp8 ').toString('base64');
    expect(
      PhotoCheckRequestSchema.safeParse({
        mimeType: 'image/webp',
        imageBase64: webpB64,
        language: 'en',
      }).success
    ).toBe(true);
  });

  it('covers buildFallbackAdvice across categories, households, purifier, null windows, and both languages', () => {
    const categories: NaqiCategory[] = [
      'Good',
      'Satisfactory',
      'Moderate',
      'Poor',
      'Very Poor',
      'Severe',
    ];
    for (const category of categories) {
      for (const language of ['en', 'hi'] as const) {
        const resEmpty = buildFallbackAdvice({
          cityName: 'Pune',
          aqi: category === 'Good' ? 35 : 260,
          category,
          dominantPollutant: 'PM2.5',
          pm25: category === 'Good' ? 18 : 112,
          pm10: 150,
          windSpeedKmh: 8,
          cleanestWindow:
            category === 'Good'
              ? null
              : {
                  startHour: '14:00',
                  endHour: '17:00',
                  dayLabel: 'Today',
                  avgNaqi: 120,
                },
          worstWindow:
            category === 'Severe'
              ? null
              : {
                  startHour: '21:00',
                  endHour: '00:00',
                  dayLabel: 'Tomorrow',
                  avgNaqi: 310,
                },
          household: [],
          lifestyle: 'runner_walker',
          hasPurifier: language === 'en',
          language,
        });
        expect(resEmpty.forWhom).toHaveLength(1);
        expect(resEmpty.indoor.length).toBeGreaterThanOrEqual(3);

        const resFull = buildFallbackAdvice({
          cityName: 'Delhi',
          aqi: 340,
          category,
          dominantPollutant: 'PM10',
          pm25: 165,
          pm10: 310,
          windSpeedKmh: 4,
          cleanestWindow: {
            startHour: '13:00',
            endHour: '16:00',
            dayLabel: 'Tomorrow',
            avgNaqi: 190,
          },
          worstWindow: {
            startHour: '07:00',
            endHour: '10:00',
            dayLabel: 'Today',
            avgNaqi: 380,
          },
          household: ['kids', 'seniors', 'pregnant', 'asthma_heart', 'outdoor_worker'],
          lifestyle: 'commute_bike',
          hasPurifier: language === 'hi',
          language,
        });
        expect(resFull.forWhom).toHaveLength(5);
      }
    }
  });

  it('covers particleEngine low-end/mobile/desktop, night/stars, fog, rain/thunder, and PM2.5 tints', () => {
    const { theme } = makeNaqiAndWeatherFixtures();
    const fakeCtx = {
      clearRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.stubGlobal('navigator', { hardwareConcurrency: 2 });
    const scenes = [
      { ...theme, isDay: false, weatherScene: 'clear' as const },
      { ...theme, isDay: false, weatherScene: 'fog' as const },
      { ...theme, isDay: true, weatherScene: 'rain' as const },
      { ...theme, isDay: false, weatherScene: 'thunder' as const },
    ];
    for (const s of scenes) {
      for (const pm25 of [20, 80, 150]) {
        const snap = { theme: s, pm25, sunXPercent: 50, sunYPercent: 30 };
        const p = createParticleSet(400, 300, true, snap);
        // Move a particle near edges to trigger wrap-around branches
        if (p.haze[0]) {
          p.haze[0].x = 420;
          p.haze[0].y = -20;
        }
        if (p.rain[0]) {
          p.rain[0].y = 330;
        }
        drawParticleFrame(fakeCtx, { width: 400, height: 300, isMobile: true }, snap, p);
      }
    }
    expect(fakeCtx.clearRect).toHaveBeenCalled();
  });
});

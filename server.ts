import 'dotenv/config';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  AdviceRequestSchema,
  GeminiAdvicePayloadSchema,
  buildFallbackAdvice,
  type ValidatedAdviceRequest,
} from './src/lib/advice/schema.ts';
import {
  AskGeminiPayloadSchema,
  AskRequestSchema,
  buildAskSystemInstruction,
  buildFallbackAskAnswer,
  type ValidatedAskRequest,
} from './src/lib/ask/schema.ts';
import {
  PhotoCheckGeminiPayloadSchema,
  PhotoCheckRequestSchema,
  buildFallbackPhotoCheck,
  buildPhotoCheckSystemInstruction,
} from './src/lib/vision/schema.ts';
import type {
  AdviceResponse,
  AskResponse,
  Language,
  PhotoCheckResponse,
} from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const GEMINI_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const SERVER_CACHE_TTL_MS = 10 * 60_000;
const SERVER_CACHE_MAX_ENTRIES = 250;
const RATE_WINDOW_MS = 60_000;
const DEFAULT_RATE_MAX_REQUESTS = 24;
const DEFAULT_QUOTA_COOLDOWN_MS = 15 * 60_000;

/**
 * Minimal structural interface for the Google GenAI client (enables unit/API testing without network calls).
 */
export interface GeminiLikeClient {
  models: {
    generateContent: (
      params: Parameters<GoogleGenAI['models']['generateContent']>[0]
    ) => Promise<{ text?: string }>;
  };
}

export interface CreateAppOptions {
  aiClient?: GeminiLikeClient | null;
  attachVite?: boolean;
  rateLimitMax?: number;
  isProd?: boolean;
}

/**
 * Gemini structured JSON schema for POST /api/advice.
 */
export const ADVICE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.OBJECT,
      properties: {
        level: {
          type: Type.STRING,
          enum: ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'],
        },
        headline: { type: Type.STRING },
        summary: { type: Type.STRING },
      },
      required: ['level', 'headline', 'summary'],
    },
    outdoor: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          why: { type: Type.STRING },
          timeWindow: { type: Type.STRING },
        },
        required: ['action', 'why'],
      },
    },
    indoor: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          why: { type: Type.STRING },
          timeWindow: { type: Type.STRING },
        },
        required: ['action', 'why'],
      },
    },
    routine: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          why: { type: Type.STRING },
          co2Benefit: { type: Type.STRING },
        },
        required: ['action', 'why'],
      },
    },
    mask: {
      type: Type.OBJECT,
      properties: {
        recommended: { type: Type.BOOLEAN },
        type: { type: Type.STRING },
        why: { type: Type.STRING },
      },
      required: ['recommended', 'type', 'why'],
    },
    forWhom: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          group: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
        required: ['group', 'advice'],
      },
    },
  },
  required: ['verdict', 'outdoor', 'indoor', 'routine', 'mask', 'forWhom'],
};

/**
 * Gemini structured JSON schema for POST /api/ask.
 */
export const ASK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    verdict: {
      type: Type.STRING,
      enum: ['yes', 'no', 'caution'],
    },
    why: { type: Type.STRING },
    bestTime: { type: Type.STRING },
    dataUsed: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['answer', 'verdict', 'why', 'dataUsed'],
};

/**
 * Gemini structured JSON schema for POST /api/photo-check.
 */
export const PHOTO_CHECK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    observations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    purifierPlacement: { type: Type.STRING },
    ventilationTip: { type: Type.STRING },
    confidence: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high'],
    },
    disclaimer: { type: Type.STRING },
  },
  required: [
    'observations',
    'purifierPlacement',
    'ventilationTip',
    'confidence',
    'disclaimer',
  ],
};

function sanitizeText(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127 && ch !== '<' && ch !== '>';
    })
    .join('')
    .trim();
}

/**
 * Builds the grounded system instruction for POST /api/advice.
 */
export function buildAdviceSystemInstruction(
  language: Language,
  category: string
): string {
  const langRule =
    language === 'hi'
      ? 'Write every JSON string value (except verdict.level which must remain the exact English NAQI category enum) in clear, natural Hindi (हिन्दी), keeping English only for units (µg/m³, km/h, °C, kg CO₂, N95 / FFP2) and place names.'
      : 'Write every JSON string value in clear, concise Indian English.';

  const cleanAirRule =
    category === 'Good'
      ? 'NAQI is Good, so you may describe the air as clean.'
      : 'CRITICAL: Because NAQI is NOT Good, NEVER use the phrase "clean air" anywhere. Use "lower-pollution window", "fresher hours", or "less-polluted period" instead.';

  return [
    'You are VayuMitra, a factual air-quality action engine for Indian households.',
    langRule,
    cleanAirRule,
    'Strict rules:',
    '1. Be strictly factual and use ONLY the live numbers, forward-looking Today/Tomorrow windows, weather, and household profile provided in the prompt. NEVER invent measurements or past windows.',
    '2. Verdict headline must be an actionable takeaway (do NOT repeat "City: NAQI x (Category)"). Give NO medical diagnosis or prescription.',
    '3. Mask rule: Good/Satisfactory = optional; Moderate = recommended for kids, seniors, asthma/heart patients, and outdoor workers (optional for others); Poor/Very Poor/Severe = N95/FFP2 recommended for everyone outdoors.',
    '4. Indoor guidance MUST cover (when relevant): purifier placement & running high during worst hours (if hasAirPurifier=true) or keeping one room sealed cleaner & low-cost HEPA options (if false); window/ventilation timing; cooking & exhaust-fan tips; NO incense or mosquito coils when NAQI is Poor or worse; damp mopping; and an honest note that indoor plants help only marginally and cannot replace purifiers or ventilation.',
    '5. Routine guidance MUST depend on householdProfile.lifestyle and NAQI, include trip-batching and travel-time suggestions using the Today/Tomorrow windows, and ONLY cite a CO2 saving figure when derived from an explicit stated assumption labeled "approx.".',
    '6. Every item in outdoor, indoor, routine, and mask MUST include a 1–2 sentence "why" grounded in the provided data.',
    '7. Keep advice genuinely tailored to this specific city, weather, and household combination.',
  ].join(' ');
}

function buildAdviceUserPrompt(req: ValidatedAdviceRequest): string {
  const cleanWin = req.cleanestWindow
    ? `${req.cleanestWindow.dayLabel} ${req.cleanestWindow.startHour}-${req.cleanestWindow.endHour} (avg NAQI ${req.cleanestWindow.avgNaqi}, PM2.5 ${req.cleanestWindow.avgPm25} µg/m³)`
    : 'Not available';
  const worstWin = req.worstWindow
    ? `${req.worstWindow.dayLabel} ${req.worstWindow.startHour}-${req.worstWindow.endHour} (avg NAQI ${req.worstWindow.avgNaqi}, PM2.5 ${req.worstWindow.avgPm25} µg/m³)`
    : 'Not available';

  return JSON.stringify({
    city: sanitizeText(req.cityName),
    naqi: {
      value: req.aqi,
      category: req.category,
      dominantPollutant: req.dominantPollutant,
      pm25_ug_m3: req.pm25,
      pm10_ug_m3: req.pm10,
      basis: req.basis,
    },
    weather: {
      temperature_c: req.temperatureC,
      humidity_pct: req.humidityPct,
      windSpeed_kmh: req.windSpeedKmh,
    },
    forwardWindowsNext24h: {
      cleanest: cleanWin,
      worst: worstWin,
    },
    householdProfile: {
      sensitiveGroups: req.household.length ? req.household : ['general'],
      lifestyle: req.lifestyle,
      hasAirPurifier: req.hasPurifier,
    },
  });
}

function buildAskUserPrompt(req: ValidatedAskRequest): string {
  return JSON.stringify({
    question: sanitizeText(req.question),
    city: sanitizeText(req.cityName),
    liveReadings: {
      naqi: req.aqi,
      category: req.category,
      dominantPollutant: req.dominantPollutant,
      pm25_ug_m3: req.pm25,
      pm10_ug_m3: req.pm10,
      temperature_c: req.temperatureC,
      humidity_pct: req.humidityPct,
      windSpeed_kmh: req.windSpeedKmh,
    },
    forwardWindows: {
      cleanestWindow: req.cleanestWindow,
      worstWindow: req.worstWindow,
      nextHours: req.forwardHourly.slice(0, 12),
    },
    householdProfile: {
      sensitiveGroups: req.household.length ? req.household : ['general'],
      lifestyle: req.lifestyle,
      hasAirPurifier: req.hasPurifier,
    },
  });
}

function parseQuotaCooldownMs(err: unknown): {
  isQuota: boolean;
  isAuth: boolean;
  cooldownMs: number;
} {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : NaN;

  const isQuota =
    status === 429 ||
    msg.includes('"code":429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    /quota exceeded|rate[- ]limit/i.test(msg);

  const isAuth =
    status === 401 ||
    status === 403 ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API_KEY_INVALID');

  if (!isQuota) {
    return { isQuota: false, isAuth, cooldownMs: 0 };
  }

  const retryMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  const retrySec = retryMatch ? Number(retryMatch[1]) : 900;
  const cooldownMs = Math.min(30 * 60_000, Math.max(60_000, retrySec * 1000));
  return { isQuota: true, isAuth: false, cooldownMs };
}

function setBoundedCache<T>(
  map: Map<string, { expiresAt: number; value: T }>,
  key: string,
  value: T
): void {
  if (map.size >= SERVER_CACHE_MAX_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, {
    expiresAt: Date.now() + SERVER_CACHE_TTL_MS,
    value,
  });
}

function getBoundedCache<T>(
  map: Map<string, { expiresAt: number; value: T }>,
  key: string
): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function createDefaultAiClient(): GeminiLikeClient | null {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;
  return new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Builds and configures the Express application with security headers, per-IP rate limiting,
 * Zod-validated Gemini routes (/api/advice, /api/ask, /api/photo-check), caching, and Vite/static serving.
 */
export async function createExpressApp(
  options: CreateAppOptions = {}
): Promise<Express> {
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const attachVite = options.attachVite ?? !isProd;
  const rateLimitMax = options.rateLimitMax ?? DEFAULT_RATE_MAX_REQUESTS;
  const aiClient =
    options.aiClient !== undefined ? options.aiClient : createDefaultAiClient();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const rateBuckets = new Map<string, number[]>();
  const modelCooldownUntil = new Map<string, number>();
  const adviceCache = new Map<string, { expiresAt: number; value: AdviceResponse }>();
  const askCache = new Map<string, { expiresAt: number; value: AskResponse }>();
  const inFlightAdvice = new Map<string, Promise<AdviceResponse>>();
  const inFlightAsk = new Map<string, Promise<AskResponse>>();

  function checkRateLimit(
    routeKey: string,
    clientIp: string
  ): { allowed: boolean; retryAfterSec: number } {
    const bucketKey = `${routeKey}:${clientIp}`;
    const now = Date.now();
    const timestamps = (rateBuckets.get(bucketKey) ?? []).filter(
      (ts) => now - ts < RATE_WINDOW_MS
    );
    if (timestamps.length >= rateLimitMax) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSec = Math.max(
        1,
        Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000)
      );
      rateBuckets.set(bucketKey, timestamps);
      return { allowed: false, retryAfterSec };
    }
    timestamps.push(now);
    rateBuckets.set(bucketKey, timestamps);
    return { allowed: true, retryAfterSec: 0 };
  }

  async function callStructuredGemini<T>(params: {
    contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'];
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
    parse: (raw: unknown) => { success: true; data: T } | { success: false };
    logContext: string;
  }): Promise<T | null> {
    if (!aiClient) return null;

    const now = Date.now();
    let lastReason = 'All configured Gemini models are cooling down';

    for (const model of GEMINI_MODELS) {
      const cooldownEnd = modelCooldownUntil.get(model) ?? 0;
      if (cooldownEnd > now) {
        continue;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await aiClient.models.generateContent({
            model,
            contents: params.contents,
            config: {
              systemInstruction: params.systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: params.responseSchema,
              ...(model === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, seed: 42 }
                : { seed: 42 }),
            },
          });

          const rawText = (response.text ?? '').trim();
          if (!rawText) {
            lastReason = `${model} returned empty text (attempt ${attempt + 1})`;
            continue;
          }

          const parsedJson: unknown = JSON.parse(rawText);
          const validated = params.parse(parsedJson);
          if (validated.success) {
            return validated.data;
          }

          lastReason = `${model} schema mismatch (attempt ${attempt + 1})`;
        } catch (err) {
          const { isQuota, isAuth, cooldownMs } = parseQuotaCooldownMs(err);
          if (isQuota) {
            const duration = cooldownMs || DEFAULT_QUOTA_COOLDOWN_MS;
            modelCooldownUntil.set(model, Date.now() + duration);
            console.info(
              `[VayuMitra] Quota limit reached for ${model}; cooling down for ${Math.round(duration / 60_000)}m.`
            );
            lastReason = `${model} quota cooldown`;
            break;
          }
          if (isAuth) {
            modelCooldownUntil.set(model, Date.now() + DEFAULT_QUOTA_COOLDOWN_MS);
            console.info(
              `[VayuMitra] Gemini API authentication issue for ${model}; using fallback.`
            );
            return null;
          }
          lastReason = `${model} request failed (attempt ${attempt + 1})`;
        }
      }
    }

    console.info(`[VayuMitra] ${params.logContext} fallback used: ${lastReason}`);
    return null;
  }

  // Strict security headers on all routes
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    const devWs = isProd ? '' : ' ws://localhost:* ws://127.0.0.1:*';
    const scriptPolicy = isProd
      ? "script-src 'self'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self' https://aistudio.google.com https://*.google.com",
        scriptPolicy,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        `connect-src 'self'${devWs} https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com https://api.open-meteo.com`,
      ].join('; ')
    );
    next();
  });

  const smallJsonParser = express.json({ limit: '64kb' });
  const photoJsonParser = express.json({ limit: '6mb' });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/advice', smallJsonParser, async (req, res) => {
    const clientIp = req.ip || 'unknown';
    const rate = checkRateLimit('advice', clientIp);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: 'Too many advice requests. Please wait a moment and retry.',
      });
    }

    const parsed = AdviceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid advice request payload.',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    const payload: ValidatedAdviceRequest = {
      ...parsed.data,
      cityName: sanitizeText(parsed.data.cityName),
    };

    const cacheKey = JSON.stringify({
      city: payload.cityName.toLowerCase(),
      aqi: payload.aqi,
      cat: payload.category,
      pm25: payload.pm25,
      pm10: payload.pm10,
      clean: payload.cleanestWindow
        ? `${payload.cleanestWindow.dayLabel}:${payload.cleanestWindow.startHour}-${payload.cleanestWindow.endHour}`
        : null,
      worst: payload.worstWindow
        ? `${payload.worstWindow.dayLabel}:${payload.worstWindow.startHour}-${payload.worstWindow.endHour}`
        : null,
      hh: [...payload.household].sort(),
      life: payload.lifestyle,
      purifier: payload.hasPurifier,
      lang: payload.language,
    });

    const cached = getBoundedCache(adviceCache, cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const existingPromise = inFlightAdvice.get(cacheKey);
    if (existingPromise) {
      const advice = await existingPromise;
      return res.json(advice);
    }

    const job = (async (): Promise<AdviceResponse> => {
      try {
        const geminiData = await callStructuredGemini({
          contents: buildAdviceUserPrompt(payload),
          systemInstruction: buildAdviceSystemInstruction(
            payload.language,
            payload.category
          ),
          responseSchema: ADVICE_RESPONSE_SCHEMA,
          parse: (raw) => GeminiAdvicePayloadSchema.safeParse(raw),
          logContext: `/api/advice (${payload.cityName})`,
        });

        if (geminiData) {
          const disclaimer =
            payload.language === 'hi'
              ? 'यह सामान्य जानकारी है, चिकित्सीय निदान नहीं। साँस या हृदय संबंधी लक्षण होने पर डॉक्टर से सलाह लें।'
              : 'Informational guidance grounded in live Open-Meteo readings, not a medical diagnosis. Consult a doctor for symptoms.';

          const result: AdviceResponse = {
            ...geminiData,
            verdict: {
              ...geminiData.verdict,
              level: payload.category,
            },
            disclaimer,
            source: 'gemini',
          };
          setBoundedCache(adviceCache, cacheKey, result);
          return result;
        }

        return buildFallbackAdvice(payload);
      } finally {
        inFlightAdvice.delete(cacheKey);
      }
    })();

    inFlightAdvice.set(cacheKey, job);
    const advice = await job;
    return res.json(advice);
  });

  app.post('/api/ask', smallJsonParser, async (req, res) => {
    const clientIp = req.ip || 'unknown';
    const rate = checkRateLimit('ask', clientIp);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: 'Too many question requests. Please wait a moment and retry.',
      });
    }

    const parsed = AskRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid question payload.',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    const payload: ValidatedAskRequest = {
      ...parsed.data,
      question: sanitizeText(parsed.data.question),
      cityName: sanitizeText(parsed.data.cityName),
    };

    const cacheKey = JSON.stringify({
      q: payload.question.toLowerCase(),
      city: payload.cityName.toLowerCase(),
      aqi: payload.aqi,
      cat: payload.category,
      hh: [...payload.household].sort(),
      life: payload.lifestyle,
      purifier: payload.hasPurifier,
      lang: payload.language,
    });

    const cached = getBoundedCache(askCache, cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const existingPromise = inFlightAsk.get(cacheKey);
    if (existingPromise) {
      const answer = await existingPromise;
      return res.json(answer);
    }

    const job = (async (): Promise<AskResponse> => {
      try {
        const geminiData = await callStructuredGemini({
          contents: buildAskUserPrompt(payload),
          systemInstruction: buildAskSystemInstruction(
            payload.language,
            payload.category
          ),
          responseSchema: ASK_RESPONSE_SCHEMA,
          parse: (raw) => AskGeminiPayloadSchema.safeParse(raw),
          logContext: `/api/ask (${payload.cityName})`,
        });

        if (geminiData) {
          const result: AskResponse = {
            ...geminiData,
            disclaimer:
              payload.language === 'hi'
                ? 'यह लाइव Open-Meteo डेटा पर आधारित जानकारी है, चिकित्सीय सलाह नहीं।'
                : 'Informational guidance grounded in live Open-Meteo estimates, not medical advice.',
            source: 'gemini',
          };
          setBoundedCache(askCache, cacheKey, result);
          return result;
        }

        return buildFallbackAskAnswer(payload);
      } finally {
        inFlightAsk.delete(cacheKey);
      }
    })();

    inFlightAsk.set(cacheKey, job);
    const answer = await job;
    return res.json(answer);
  });

  app.post('/api/photo-check', photoJsonParser, async (req, res) => {
    const clientIp = req.ip || 'unknown';
    const rate = checkRateLimit('photo-check', clientIp);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      return res.status(429).json({
        error: 'Too many photo checks. Please wait a moment and retry.',
      });
    }

    const parsed = PhotoCheckRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid photo check payload.',
        details: parsed.error.issues.map((i) => i.message),
      });
    }

    const data = parsed.data;
    const contextText = JSON.stringify({
      sceneHint: data.sceneHint,
      currentNaqi: data.aqi ?? null,
      category: data.category ?? null,
      hasAirPurifier: data.hasPurifier,
    });

    const geminiData = await callStructuredGemini({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: data.mimeType,
              data: data.imageBase64,
            },
          },
          {
            text: `Analyze this ${data.sceneHint} photo strictly visually using context: ${contextText}`,
          },
        ],
      },
      systemInstruction: buildPhotoCheckSystemInstruction(data.language),
      responseSchema: PHOTO_CHECK_RESPONSE_SCHEMA,
      parse: (raw) => PhotoCheckGeminiPayloadSchema.safeParse(raw),
      logContext: '/api/photo-check',
    });

    if (geminiData) {
      const result: PhotoCheckResponse = {
        ...geminiData,
        source: 'gemini',
      };
      return res.json(result);
    }

    return res.json(
      buildFallbackPhotoCheck({
        sceneHint: data.sceneHint,
        aqi: data.aqi,
        category: data.category,
        hasPurifier: data.hasPurifier,
        language: data.language,
      })
    );
  });

  // Handle oversized JSON payloads cleanly without leaking stack traces
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (
        typeof err === 'object' &&
        err !== null &&
        'type' in err &&
        (err as { type?: string }).type === 'entity.too.large'
      ) {
        return res.status(413).json({ error: 'Request payload is too large.' });
      }
      if (err instanceof SyntaxError) {
        return res.status(400).json({ error: 'Malformed JSON body.' });
      }
      return next(err);
    }
  );

  if (attachVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const isMainEntry =
  typeof process !== 'undefined' &&
  !process.env.VITEST &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === __filename;

if (isMainEntry) {
  createExpressApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`VayuMitra server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error(
        'Failed to start server:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      process.exit(1);
    });
}

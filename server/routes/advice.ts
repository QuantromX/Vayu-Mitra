import { Router, type RequestHandler } from 'express';
import {
  AdviceRequestSchema,
  GeminiAdvicePayloadSchema,
  buildFallbackAdvice,
  type ValidatedAdviceRequest,
} from '../../src/lib/advice/schema.ts';
import { MEDICAL_DISCLAIMER, sanitizeUserText } from '../../src/lib/shared/domain.ts';
import type { AdviceResponse } from '../../src/types/index.ts';
import { getOrCompute, type BoundedCache } from '../cache.ts';
import type { CallStructuredGemini } from '../gemini.ts';
import { parseBody } from '../middleware.ts';
import {
  ADVICE_RESPONSE_SCHEMA,
  buildAdviceSystemInstruction,
  buildAdviceUserPrompt,
} from '../prompts.ts';
import { enforceRateLimit, type RateLimiter } from '../rateLimiter.ts';

export interface AdviceRouteDeps {
  jsonParser: RequestHandler;
  rateLimiter: RateLimiter;
  cache: BoundedCache<AdviceResponse>;
  inFlight: Map<string, Promise<AdviceResponse>>;
  callStructuredGemini: CallStructuredGemini;
}

function buildAdviceCacheKey(payload: ValidatedAdviceRequest): string {
  return JSON.stringify({
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
}

async function generateAdvice(
  deps: AdviceRouteDeps,
  payload: ValidatedAdviceRequest,
  correlationId: string
): Promise<AdviceResponse> {
  const geminiData = await deps.callStructuredGemini({
    contents: buildAdviceUserPrompt(payload),
    systemInstruction: buildAdviceSystemInstruction(payload.language, payload.category),
    responseSchema: ADVICE_RESPONSE_SCHEMA,
    parse: (raw) => GeminiAdvicePayloadSchema.safeParse(raw),
    route: 'advice',
    correlationId,
  });
  if (!geminiData) return buildFallbackAdvice(payload);

  return {
    ...geminiData,
    verdict: { ...geminiData.verdict, level: payload.category },
    disclaimer: MEDICAL_DISCLAIMER[payload.language],
    source: 'gemini',
  };
}

/**
 * Express route factory for POST /api/advice.
 */
export function createAdviceRouter(deps: AdviceRouteDeps): Router {
  const router = Router();

  router.post('/', deps.jsonParser, async (req, res, next) => {
    const correlationId = String(res.locals.correlationId ?? '');
    try {
      const allowed = enforceRateLimit(
        deps.rateLimiter,
        'advice',
        req,
        res,
        'Too many advice requests. Please wait a moment and retry.'
      );
      if (!allowed) return;

      const parsed = parseBody(
        AdviceRequestSchema,
        req.body,
        res,
        'Invalid advice request payload.'
      );
      if (!parsed) return;

      const payload: ValidatedAdviceRequest = {
        ...parsed,
        cityName: sanitizeUserText(parsed.cityName),
      };
      const advice = await getOrCompute(
        deps.cache,
        deps.inFlight,
        buildAdviceCacheKey(payload),
        () => generateAdvice(deps, payload, correlationId),
        (result) => result.source === 'gemini'
      );
      res.json(advice);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

import { Router, type RequestHandler } from 'express';
import {
  AskGeminiPayloadSchema,
  AskRequestSchema,
  buildAskSystemInstruction,
  buildFallbackAskAnswer,
  type ValidatedAskRequest,
} from '../../src/lib/ask/schema.ts';
import { MEDICAL_DISCLAIMER, sanitizeUserText } from '../../src/lib/shared/domain.ts';
import type { AskResponse } from '../../src/types/index.ts';
import { getOrCompute, type BoundedCache } from '../cache.ts';
import type { CallStructuredGemini } from '../gemini.ts';
import { parseBody } from '../middleware.ts';
import { ASK_RESPONSE_SCHEMA, buildAskUserPrompt } from '../prompts.ts';
import { enforceRateLimit, type RateLimiter } from '../rateLimiter.ts';

export interface AskRouteDeps {
  jsonParser: RequestHandler;
  rateLimiter: RateLimiter;
  cache: BoundedCache<AskResponse>;
  inFlight: Map<string, Promise<AskResponse>>;
  callStructuredGemini: CallStructuredGemini;
}

function buildAskCacheKey(payload: ValidatedAskRequest): string {
  return JSON.stringify({
    q: payload.question.toLowerCase(),
    city: payload.cityName.toLowerCase(),
    aqi: payload.aqi,
    cat: payload.category,
    hh: [...payload.household].sort(),
    life: payload.lifestyle,
    purifier: payload.hasPurifier,
    lang: payload.language,
  });
}

async function generateAskAnswer(
  deps: AskRouteDeps,
  payload: ValidatedAskRequest,
  correlationId: string
): Promise<AskResponse> {
  const geminiData = await deps.callStructuredGemini({
    contents: buildAskUserPrompt(payload),
    systemInstruction: buildAskSystemInstruction(payload.language, payload.category),
    responseSchema: ASK_RESPONSE_SCHEMA,
    parse: (raw) => AskGeminiPayloadSchema.safeParse(raw),
    route: 'ask',
    correlationId,
  });
  if (!geminiData) return buildFallbackAskAnswer(payload);

  return {
    ...geminiData,
    disclaimer: MEDICAL_DISCLAIMER[payload.language],
    source: 'gemini',
  };
}

/**
 * Express route factory for POST /api/ask.
 */
export function createAskRouter(deps: AskRouteDeps): Router {
  const router = Router();

  router.post('/', deps.jsonParser, async (req, res, next) => {
    const correlationId = String(res.locals.correlationId ?? '');
    try {
      const allowed = enforceRateLimit(
        deps.rateLimiter,
        'ask',
        req,
        res,
        'Too many question requests. Please wait a moment and retry.'
      );
      if (!allowed) return;

      const parsed = parseBody(
        AskRequestSchema,
        req.body,
        res,
        'Invalid question payload.'
      );
      if (!parsed) return;

      const payload: ValidatedAskRequest = {
        ...parsed,
        question: sanitizeUserText(parsed.question),
        cityName: sanitizeUserText(parsed.cityName),
      };
      const answer = await getOrCompute(
        deps.cache,
        deps.inFlight,
        buildAskCacheKey(payload),
        () => generateAskAnswer(deps, payload, correlationId),
        (result) => result.source === 'gemini'
      );
      res.json(answer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

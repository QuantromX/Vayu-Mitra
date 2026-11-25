import { Router, type RequestHandler } from 'express';
import { wrapUntrustedPromptInput } from '../../src/lib/shared/domain.ts';
import {
  PhotoCheckGeminiPayloadSchema,
  PhotoCheckRequestSchema,
  buildFallbackPhotoCheck,
  buildPhotoCheckSystemInstruction,
  type ValidatedPhotoCheckRequest,
} from '../../src/lib/vision/schema.ts';
import type { PhotoCheckResponse } from '../../src/types/index.ts';
import type { CallStructuredGemini } from '../gemini.ts';
import { parseBody } from '../middleware.ts';
import { PHOTO_CHECK_RESPONSE_SCHEMA } from '../prompts.ts';
import { enforceRateLimit, type RateLimiter } from '../rateLimiter.ts';

export interface PhotoCheckRouteDeps {
  jsonParser: RequestHandler;
  rateLimiter: RateLimiter;
  callStructuredGemini: CallStructuredGemini;
}

function buildPhotoCheckPrompt(data: ValidatedPhotoCheckRequest): string {
  const contextText = JSON.stringify({
    sceneHint: data.sceneHint,
    currentNaqi: data.aqi ?? null,
    category: data.category ?? null,
    hasAirPurifier: data.hasPurifier,
  });
  return `Analyze this ${data.sceneHint} photo strictly visually using context: ${wrapUntrustedPromptInput('sceneContext', contextText)}`;
}

async function analyzePhoto(
  deps: PhotoCheckRouteDeps,
  data: ValidatedPhotoCheckRequest,
  correlationId: string
): Promise<PhotoCheckResponse> {
  const geminiData = await deps.callStructuredGemini({
    contents: {
      parts: [
        { inlineData: { mimeType: data.mimeType, data: data.imageBase64 } },
        { text: buildPhotoCheckPrompt(data) },
      ],
    },
    systemInstruction: buildPhotoCheckSystemInstruction(data.language),
    responseSchema: PHOTO_CHECK_RESPONSE_SCHEMA,
    parse: (raw) => PhotoCheckGeminiPayloadSchema.safeParse(raw),
    route: 'photo-check',
    correlationId,
  });

  if (geminiData) return { ...geminiData, source: 'gemini' };
  return buildFallbackPhotoCheck({
    sceneHint: data.sceneHint,
    aqi: data.aqi,
    category: data.category,
    hasPurifier: data.hasPurifier,
    language: data.language,
  });
}

/**
 * Express route factory for POST /api/photo-check.
 */
export function createPhotoCheckRouter(deps: PhotoCheckRouteDeps): Router {
  const router = Router();

  router.post('/', deps.jsonParser, async (req, res, next) => {
    const correlationId = String(res.locals.correlationId ?? '');
    try {
      const allowed = enforceRateLimit(
        deps.rateLimiter,
        'photo-check',
        req,
        res,
        'Too many photo checks. Please wait a moment and retry.'
      );
      if (!allowed) return;

      const data = parseBody(
        PhotoCheckRequestSchema,
        req.body,
        res,
        'Invalid photo check payload.'
      );
      if (!data) return;

      res.json(await analyzePhoto(deps, data, correlationId));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

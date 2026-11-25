import 'dotenv/config';
import compression from 'compression';
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SERVER_RATE_LIMITS,
  getAllowedOrigins,
  getServerPort,
} from './src/lib/config.ts';
import type { AdviceResponse, AskResponse } from './src/types/index.ts';
import type { BoundedCache } from './server/cache.ts';
import { registerFrontendServing } from './server/frontend.ts';
import {
  createDefaultAiClient,
  createGeminiCaller,
  requireGeminiApiKey,
  type GeminiLikeClient,
} from './server/gemini.ts';
import { logStructured } from './server/logger.ts';
import {
  createCorsMiddleware,
  createErrorHandler,
  createSecurityHeadersMiddleware,
  injectNonceIntoHtml,
} from './server/middleware.ts';
import {
  ADVICE_RESPONSE_SCHEMA,
  ASK_RESPONSE_SCHEMA,
  PHOTO_CHECK_RESPONSE_SCHEMA,
  buildAdviceSystemInstruction,
} from './server/prompts.ts';
import { createRateLimiter } from './server/rateLimiter.ts';
import { createAdviceRouter } from './server/routes/advice.ts';
import { createAskRouter } from './server/routes/ask.ts';
import { createPhotoCheckRouter } from './server/routes/photoCheck.ts';

export {
  ADVICE_RESPONSE_SCHEMA,
  ASK_RESPONSE_SCHEMA,
  PHOTO_CHECK_RESPONSE_SCHEMA,
  buildAdviceSystemInstruction,
  injectNonceIntoHtml,
  requireGeminiApiKey,
};
export type { GeminiLikeClient };

export interface CreateAppOptions {
  aiClient?: GeminiLikeClient | null;
  attachVite?: boolean;
  rateLimitMax?: number;
  isProd?: boolean;
  port?: number;
}

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);

/**
 * Builds and configures the Express application with security headers, rate limits,
 * Zod-validated Gemini routes, caching, and Vite/static serving.
 */
export async function createExpressApp(options: CreateAppOptions = {}): Promise<Express> {
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const attachVite = options.attachVite ?? !isProd;
  const port = options.port ?? getServerPort();
  const aiClient =
    options.aiClient !== undefined ? options.aiClient : createDefaultAiClient();

  const rateLimiter = createRateLimiter({
    advice: options.rateLimitMax ?? SERVER_RATE_LIMITS.advicePerMinute,
    ask: options.rateLimitMax ?? SERVER_RATE_LIMITS.askPerMinute,
    'photo-check': options.rateLimitMax ?? SERVER_RATE_LIMITS.photoCheckPerMinute,
  });
  const callStructuredGemini = createGeminiCaller(aiClient);
  const adviceCache: BoundedCache<AdviceResponse> = new Map();
  const askCache: BoundedCache<AskResponse> = new Map();
  const inFlightAdvice = new Map<string, Promise<AdviceResponse>>();
  const inFlightAsk = new Map<string, Promise<AskResponse>>();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(createSecurityHeadersMiddleware(isProd));
  app.use('/api', createCorsMiddleware(getAllowedOrigins(port), isProd));

  const smallJsonParser = express.json({ limit: '64kb' });
  const photoJsonParser = express.json({ limit: '6mb' });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(
    '/api/advice',
    createAdviceRouter({
      jsonParser: smallJsonParser,
      rateLimiter,
      cache: adviceCache,
      inFlight: inFlightAdvice,
      callStructuredGemini,
    })
  );
  app.use(
    '/api/ask',
    createAskRouter({
      jsonParser: smallJsonParser,
      rateLimiter,
      cache: askCache,
      inFlight: inFlightAsk,
      callStructuredGemini,
    })
  );
  app.use(
    '/api/photo-check',
    createPhotoCheckRouter({
      jsonParser: photoJsonParser,
      rateLimiter,
      callStructuredGemini,
    })
  );
  app.use(createErrorHandler());

  await registerFrontendServing(app, { isProd, attachVite, rootDir: ROOT_DIR });
  return app;
}

const entryArg = process.argv[1];
const isMainEntry =
  typeof process !== 'undefined' &&
  !process.env.VITEST &&
  typeof entryArg === 'string' &&
  path.resolve(entryArg) === __filename;

if (isMainEntry) {
  const port = getServerPort();
  createExpressApp({ port })
    .then((app) => {
      app.listen(port, '0.0.0.0', () =>
        logStructured('info', 'server_started', { port })
      );
    })
    .catch((err) => {
      logStructured('error', 'server_startup_failed', {
        errorName: err instanceof Error ? err.name : 'UnknownError',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      process.exit(1);
    });
}

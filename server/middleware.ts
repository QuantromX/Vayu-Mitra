import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../src/lib/errors.ts';
import { logStructured } from './logger.ts';

/**
 * Injects the per-request cryptographic CSP nonce into HTML script, style, and csp-nonce meta tags.
 */
export function injectNonceIntoHtml(html: string, nonce: string): string {
  return html
    .replaceAll('__CSP_NONCE__', nonce)
    .replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
    .replace(/<style\b(?![^>]*\bnonce=)/gi, `<style nonce="${nonce}"`);
}

function resolveCorrelationId(req: Request): string {
  const incomingId = req.header('x-request-id');
  if (incomingId && /^[A-Za-z0-9_-]{8,64}$/.test(incomingId)) {
    return incomingId;
  }
  return crypto.randomUUID();
}

function buildCspHeader(nonce: string, isProd: boolean): string {
  const devWs = isProd ? '' : ' ws://localhost:* ws://127.0.0.1:*';
  const frameAncestors = isProd
    ? "frame-ancestors 'none'"
    : "frame-ancestors 'self' https://aistudio.google.com https://*.google.com";
  const previewScriptSrc = isProd ? '' : ' https://cdn.jsdelivr.net';
  const previewStyleHash = isProd
    ? ''
    : " 'sha256-2U3YUekzi35BhXBzyIv5huD1p2kzfBcOYd3sy6mSmhg='";
  const previewImgSrc = isProd ? '' : ' https://fonts.gstatic.com';
  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    frameAncestors,
    `script-src 'self' 'nonce-${nonce}'${previewScriptSrc}`,
    `style-src 'self' 'nonce-${nonce}'${previewStyleHash} https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob:${previewImgSrc}`,
    `connect-src 'self'${devWs} https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com https://api.open-meteo.com`,
  ].join('; ');
}

/**
 * Sets X-Request-Id, per-request CSP nonce, HSTS, and hardening headers on every response.
 */
export function createSecurityHeadersMiddleware(isProd: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = resolveCorrelationId(req);
    res.locals.correlationId = correlationId;
    res.setHeader('X-Request-Id', correlationId);

    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', buildCspHeader(nonce, isProd));
    next();
  };
}

function isOriginAllowed(
  origin: string,
  req: Request,
  allowedOrigins: ReadonlySet<string>,
  isProd: boolean
): boolean {
  const host = req.get('host');
  const sameHostOrigin = host ? `${req.protocol}://${host}` : null;
  const isLocalDevOrigin =
    !isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return (
    allowedOrigins.has(origin) ||
    (sameHostOrigin !== null && origin === sameHostOrigin) ||
    isLocalDevOrigin
  );
}

/**
 * Enforces origin-locked CORS on /api/* and rejects foreign origins with HTTP 403.
 */
export function createCorsMiddleware(
  allowedOrigins: ReadonlySet<string>,
  isProd: boolean
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header('origin');
    if (origin) {
      if (!isOriginAllowed(origin, req, allowedOrigins, isProd)) {
        logStructured('warn', 'cors_rejected', {
          correlationId: res.locals.correlationId,
          origin,
          path: req.path,
        });
        res.status(403).json({
          error: 'Origin not allowed.',
          correlationId: res.locals.correlationId,
        });
        return;
      }
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

/**
 * Validates an incoming request body against a Zod schema and sends HTTP 400 on failure.
 */
export function parseBody<T>(
  schema: ZodType<T>,
  body: unknown,
  res: Response,
  errorMessage: string
): T | null {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const correlationId = String(res.locals.correlationId ?? '');
  res.status(400).json({
    error: errorMessage,
    details: parsed.error.issues.map((issue) => issue.message),
    correlationId,
  });
  return null;
}

function isEntityTooLargeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  );
}

/**
 * Generic client-safe Express error middleware (no stack traces or internal details leaked).
 */
export function createErrorHandler() {
  return (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    const correlationId = String(res.locals.correlationId ?? crypto.randomUUID());
    if (res.headersSent) {
      next(err);
      return;
    }
    if (isEntityTooLargeError(err)) {
      res.status(413).json({ error: 'Request payload is too large.', correlationId });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Malformed JSON body.', correlationId });
      return;
    }
    if (err instanceof AppError) {
      logStructured('warn', 'handled_app_error', {
        correlationId,
        code: err.code,
        statusCode: err.statusCode,
      });
      res.status(err.statusCode).json({ error: err.message, correlationId });
      return;
    }
    logStructured('error', 'unhandled_server_error', {
      correlationId,
      errorName: err instanceof Error ? err.name : 'UnknownError',
    });
    res.status(500).json({
      error: 'Unexpected internal error. Please try again later.',
      correlationId,
    });
  };
}

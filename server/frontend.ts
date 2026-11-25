import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { injectNonceIntoHtml } from './middleware.ts';

export interface FrontendServingOptions {
  attachVite: boolean;
  isProd: boolean;
  rootDir: string;
}

async function registerViteDevFrontend(app: Express, rootDir: string): Promise<void> {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);

  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    try {
      const nonce = typeof res.locals.cspNonce === 'string' ? res.locals.cspNonce : '';
      const template = await fs.promises.readFile(
        path.resolve(rootDir, 'index.html'),
        'utf-8'
      );
      const transformed = await vite.transformIndexHtml(req.originalUrl, template);
      const htmlWithNonce = injectNonceIntoHtml(transformed, nonce);
      res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader('Cache-Control', 'no-cache')
        .end(htmlWithNonce);
    } catch (err) {
      if (err instanceof Error) vite.ssrFixStacktrace(err);
      next(err);
    }
  });
}

function registerProdStaticFrontend(app: Express, rootDir: string): void {
  const distPath = path.resolve(rootDir, 'dist');
  const assetsPath = path.join(distPath, 'assets');
  app.use('/assets', express.static(assetsPath, { maxAge: '1y', immutable: true }));
  app.use(express.static(distPath, { index: false }));

  app.get('*', async (_req, res, next) => {
    try {
      const indexPath = path.join(distPath, 'index.html');
      if (!fs.existsSync(indexPath)) {
        res.status(404).json({ error: 'Not found.' });
        return;
      }
      const rawHtml = await fs.promises.readFile(indexPath, 'utf-8');
      const nonce = typeof res.locals.cspNonce === 'string' ? res.locals.cspNonce : '';
      res
        .status(200)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .setHeader('Cache-Control', 'no-cache')
        .end(injectNonceIntoHtml(rawHtml, nonce));
    } catch (err) {
      next(err);
    }
  });
}

/**
 * Registers either Vite dev middleware or production static serving with nonce injection.
 */
export async function registerFrontendServing(
  app: Express,
  options: FrontendServingOptions
): Promise<void> {
  if (options.attachVite) {
    await registerViteDevFrontend(app, options.rootDir);
    return;
  }
  if (options.isProd) {
    registerProdStaticFrontend(app, options.rootDir);
  }
}

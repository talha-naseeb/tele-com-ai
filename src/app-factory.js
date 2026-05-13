import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from './routes/index.js';
import { connectDb } from './lib/db.js';

/**
 * Retell (and similar) POST custom tools wrap arguments under an `args` key:
 * `{ call: { call_id, from_number, ... }, name, args: { ...tool params } }`.
 *
 * This middleware:
 *  1. Flattens `args` into `req.body` so controllers receive a clean payload.
 *  2. Preserves the `call` metadata on `req.retellCall` so controllers can
 *     verify the caller's real phone number against the requested number.
 */
function unwrapRetellCustomToolBody(req, res, next) {
  const b = req.body;
  if (
    b &&
    typeof b === 'object' &&
    Object.prototype.hasOwnProperty.call(b, 'args') &&
    b.args !== null &&
    typeof b.args === 'object' &&
    !Array.isArray(b.args)
  ) {
    req.retellCall = b.call ?? null;
    req.body = b.args;
  }
  next();
}

/**
 * Require a shared secret on every /api/* route.
 * Retell sends it as a custom header configured in the tool dashboard.
 * Set API_SECRET_KEY in your environment — skip check only if the var is absent
 * (allows local dev without configuration).
 */
function requireApiKey(req, res, next) {
  const secret = process.env.API_SECRET_KEY;
  if (!secret) return next(); // not configured — skip in dev
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== secret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

/** Builds the Express app (shared by `server.js` and `api/index.js` on Vercel). */
export async function createApp() {
  await connectDb();

  const app = express();
  app.disable('x-powered-by');

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : false; // false = block all browser cross-origin requests when not set
  app.use(cors({ origin: allowedOrigins }));

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '5mb' }));

  // ── Retell payload unwrapping (preserves req.retellCall) ─────────────────
  app.use(unwrapRetellCustomToolBody);

  // ── Rate limiting on all agent-facing routes ──────────────────────────────
  app.use(
    '/api/',
    rateLimit({
      windowMs: 60_000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many requests, please try again later.' }
    })
  );

  // ── API key auth on all agent-facing routes ───────────────────────────────
  app.use('/api/', requireApiKey);

  registerRoutes(app);

  // ── Global error handler ──────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body too large' });
    }
    if (err.status === 400 || err.statusCode === 400) {
      return res.status(400).json({ message: err.message || 'Bad request' });
    }
    if (err.name === 'ZodError') {
      return res.status(400).json({ message: 'Invalid payload', issues: err.issues });
    }
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
}

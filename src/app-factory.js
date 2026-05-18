import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { captureRawBodyForApiPost, retellAuth } from './middleware/retellAuth.js';
import { registerRoutes } from './routes/index.js';
import { connectDb } from './lib/db.js';

function retellAuthMiddleware(req, res, next) {
  Promise.resolve(retellAuth(req, res, next)).catch(next);
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

  // ── Body parsing (+ raw buffer for Retell signature verification on POST /api/*) ──
  app.use(
    express.json({
      limit: process.env.JSON_BODY_LIMIT ?? '5mb',
      verify: captureRawBodyForApiPost
    })
  );

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

  // ── Retell signature (or dev shared secret) + unwrap args onto req.body ───
  app.use('/api/', retellAuthMiddleware);

  registerRoutes(app);

  // ── Global error handler (last): log server-side only; never expose internals ──
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    if (res.headersSent) {
      return next(err);
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Request body too large' });
    }
    if (err.name === 'ZodError' || err.status === 400 || err.statusCode === 400) {
      return res.status(400).json({ message: 'Bad request' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  });

  return app;
}

import cors from 'cors';
import express from 'express';
import { registerRoutes } from './routes/index.js';
import { connectDb } from './lib/db.js';

/**
 * Retell (and similar) POST custom tools with a wrapper:
 * `{ call, name, args: { ...actual tool parameters } }`.
 * Our handlers expect the flat shape inside `args`.
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
    req.body = b.args;
  }
  next();
}

/** Builds the Express app (shared by `server.js` and `api/index.js` on Vercel). */

export async function createApp() {
  await connectDb();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? '5mb' }));
  app.use(unwrapRetellCustomToolBody);

  registerRoutes(app);

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

import cors from 'cors';
import express from 'express';
import { registerRoutes } from './routes/index.js';
import { connectDb } from './lib/db.js';

/** Builds the Express app (shared by `server.js` and `api/index.js` on Vercel). */

export async function createApp() {
  await connectDb();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true }));
  app.use(express.json());

  registerRoutes(app);

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
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

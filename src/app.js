import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index.js';
import { connectDb } from './lib/db.js';

export async function createApp() {
  await connectDb();

  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await registerRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (error?.statusCode === 400) {
      return reply.status(400).send({ message: error.message || 'Bad request' });
    }
    if (error?.name === 'ZodError') {
      return reply.status(400).send({ message: 'Invalid payload', issues: error.issues });
    }
    return reply.status(500).send({ message: 'Internal server error' });
  });

  return app;
}

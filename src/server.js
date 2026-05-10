import { config } from './config/index.js';
import { createApp } from './app-factory.js';

const start = async () => {
  try {
    const app = await createApp();
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Telecom demo backend listening on ${config.port}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();

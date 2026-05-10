import { config } from './config/index.js';
import { createApp } from './app-factory.js';

const start = async () => {
  try {
    const app = await createApp();
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Telecom demo backend listening on ${config.port}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();

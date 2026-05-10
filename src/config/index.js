import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  defaultCallbackSlaHours: Number(process.env.DEFAULT_CALLBACK_SLA_HOURS || 2)
};

if (!config.mongodbUri) {
  console.warn('MONGODB_URI is not set. Set it in .env before starting the server.');
}

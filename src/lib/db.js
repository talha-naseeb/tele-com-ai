import mongoose from 'mongoose';
import { config } from '../config/index.js';

export async function connectDb() {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and add your URI.');
  }
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  try {
    await mongoose.connect(config.mongodbUri);
    return mongoose.connection;
  } catch (err) {
    const refused =
      err?.cause?.message?.includes('ECONNREFUSED') ||
      err?.message?.includes('ECONNREFUSED') ||
      String(err).includes('ECONNREFUSED');
    if (refused) {
      console.error(`
MongoDB refused the connection (${config.mongodbUri.replace(/:[^:@/]+@/, ':****@')}).

Set MONGODB_URI in .env to your Atlas connection string (mongodb+srv://…),
or to a reachable local MongoDB URI.
`);
    }
    throw err;
  }
}

export { mongoose };

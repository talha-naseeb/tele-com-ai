import mongoose from 'mongoose';
import { config } from '../config/index.js';

export async function connectDb() {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and add your URI.');
  }
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) {
    const c = mongoose.connection;
    console.log(
      `[mongodb] Already connected (host=${c.host}, db=${c.name}, readyState=${c.readyState})`
    );
    return c;
  }
  try {
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 10000,
    });
    const c = mongoose.connection;
    console.log(`[mongodb] Connected (host=${c.host}, db=${c.name})`);
    return c;
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

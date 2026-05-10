/**
 * Vercel Serverless entry: all HTTP traffic is rewritten here with ?__v_path=$1
 * so Fastify still sees paths like /health and /customers/... at the root.
 */
import { createApp } from '../src/app.js';

let appPromise;

function fixPathFromRewrite(req) {
  try {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    if (!url.searchParams.has('__v_path')) {
      return;
    }
    const vPath = url.searchParams.get('__v_path') ?? '';
    url.searchParams.delete('__v_path');
    const q = url.searchParams.toString();
    const path = vPath === '' ? '/' : `/${vPath.replace(/^\/+/, '')}`;
    req.url = path + (q ? `?${q}` : '');
  } catch (e) {
    console.error('fixPathFromRewrite', e);
  }
}

export default async function handler(req, res) {
  fixPathFromRewrite(req);

  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  await app.ready();
  app.server.emit('request', req, res);
}

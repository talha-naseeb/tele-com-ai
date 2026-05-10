/**
 * Vercel Serverless entry: rewrites send traffic here with ?__v_path=$1
 * so Express sees paths like /health at the root.
 */
import { createApp } from '../src/app-factory.js';

let cachedApp;

async function getApp() {
  if (cachedApp) {
    return cachedApp;
  }
  cachedApp = await createApp();
  return cachedApp;
}

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

/** Wait until the Node response is finished (required on Vercel). */
function awaitResponseEnd(res) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      res.removeListener('finish', onDone);
      res.removeListener('close', onDone);
      res.removeListener('error', onErr);
    };
    function onDone() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }
    function onErr(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }
    res.once('finish', onDone);
    res.once('close', onDone);
    res.once('error', onErr);
  });
}

export default async function handler(req, res) {
  fixPathFromRewrite(req);

  try {
    const app = await getApp();
    const responseDone = awaitResponseEnd(res);

    try {
      app(req, res);
    } catch (routeErr) {
      console.error('Express dispatch failed:', routeErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: 'Internal server error' }));
      }
      await responseDone.catch(() => {});
      return;
    }

    await responseDone;
  } catch (err) {
    console.error('Vercel handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          message: 'Service unavailable',
          detail:
            err?.message ||
            'Set MONGODB_URI in Vercel → Settings → Environment Variables. Atlas must allow outbound IPs (e.g. 0.0.0.0/0 for demos).'
        })
      );
    }
  }
}

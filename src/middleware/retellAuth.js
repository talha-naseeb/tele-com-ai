import { Retell } from 'retell-sdk';

function isPostApiRoute(req) {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  return req.method === 'POST' && path.startsWith('/api');
}

/**
 * Captures the raw JSON body for POST /api/* so Retell.verify can use the exact bytes Retell signed.
 * Attach via express.json({ verify: captureRawBodyForApiPost }).
 */
export function captureRawBodyForApiPost(req, _res, buf) {
  if (!isPostApiRoute(req) || !Buffer.isBuffer(buf)) return;
  req.rawBody = Buffer.from(buf);
}

/**
 * Auth + unwrap for every `/api/*` route.
 *
 * - When **RETELL_API_KEY** is set: verifies `x-retell-signature` over the raw body, then sets
 *   `req.body` from `args`, `req.retellCall` from `call`, and `req.retellArgs`.
 * - Otherwise (local / tests): optional **API_SECRET_KEY** via `x-api-key`, then unwraps Retell-shaped JSON if present.
 */
export async function retellAuth(req, res, next) {
  try {
    const retellKey = process.env.RETELL_API_KEY;

    if (retellKey) {
      const rawBuf = req.rawBody;
      const rawStr = Buffer.isBuffer(rawBuf) ? rawBuf.toString('utf8') : '';

      if (!rawStr) {
        return res.status(400).json({ message: 'Missing or invalid JSON body.' });
      }

      const sigHeader = req.headers['x-retell-signature'];
      const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

      const ok = await Retell.verify(rawStr, retellKey, signature);
      if (!ok) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      let content;
      try {
        content = JSON.parse(rawStr);
      } catch {
        return res.status(400).json({ message: 'Invalid JSON' });
      }

      const args =
        content.args !== null &&
        typeof content.args === 'object' &&
        !Array.isArray(content.args)
          ? content.args
          : {};

      req.retellCall = content.call ?? null;
      req.retellArgs = args;
      req.body = args;
      return next();
    }

    const shared = process.env.API_SECRET_KEY;
    if (shared) {
      const provided = req.headers['x-api-key'];
      const key = Array.isArray(provided) ? provided[0] : provided;
      if (!key || key !== shared) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    const b = req.body;
    if (
      b &&
      typeof b === 'object' &&
      Object.prototype.hasOwnProperty.call(b, 'args') &&
      b.args !== null &&
      typeof b.args === 'object' &&
      !Array.isArray(b.args)
    ) {
      req.retellCall = b.call ?? null;
      req.retellArgs = b.args;
      req.body = b.args;
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

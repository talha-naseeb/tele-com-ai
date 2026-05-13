/**
 * Verifies the Retell caller's real `from_number` matches the phone number
 * being requested. Returns true (safe to proceed) or sends a 403 and returns false.
 *
 * Only enforced when `req.retellCall` is present — direct API calls without a
 * Retell call wrapper are not gated here (they are protected by the API key instead).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} requestedPhone - the normalised phone number from the request body
 * @returns {boolean} true if the caller is allowed to proceed
 */
export function assertCallerOwnership(req, res, requestedPhone) {
  const callerRaw = req.retellCall?.from_number;
  if (!callerRaw) return true; // no Retell call context — skip check
  const callerPhone = normalizePhoneInput(callerRaw);
  if (!callerPhone) return true; // can't parse caller number — skip check
  if (callerPhone === requestedPhone) return true;
  res.status(403).json({
    message: 'Access denied. You can only access your own account information.'
  });
  return false;
}

/** Wraps an async Express handler and forwards rejections to next(). */
export function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Returns true when a value still contains an unresolved {{placeholder}}. */
export function hasTemplatePlaceholder(value) {
  return typeof value === 'string' && /\{\{[\s\S]*?\}\}/.test(value);
}

/** Express / Retell gateways may send a query key as string or string[]. Returns the first string. */
export function firstQueryParam(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v = value[0];
    return typeof v === 'string' ? v : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/** Decode + normalise a phone param from a URL path or request body. Returns null if too short. */
export function normalizePhoneInput(raw) {
  let phone = raw || '';
  try {
    phone = decodeURIComponent(phone);
  } catch {
    /* ignore malformed encoding */
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return phone.trim();
}

/**
 * Validates coverage request fields from either GET query params or POST body.
 * @returns {{ ok: true, params: { city: string, area?: string, serviceType?: string } }
 *          | { ok: false, status: number, body: object }}
 */
export function validateCoverageFields({ city, area, serviceType }) {
  const cityTrimmed = typeof city === 'string' ? city.trim() : String(city ?? '').trim();
  if (!cityTrimmed) {
    return {
      ok: false,
      status: 400,
      body: { message: 'city is required.', found: false }
    };
  }

  const toOpt = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    return s === '' ? undefined : s;
  };
  const areaOpt = toOpt(area);
  const serviceTypeOpt = toOpt(serviceType);

  if (hasTemplatePlaceholder(cityTrimmed) || (areaOpt !== undefined && hasTemplatePlaceholder(areaOpt))) {
    return {
      ok: false,
      status: 400,
      body: {
        message: 'city and area must be real values (e.g. Damascus, Mazzeh), not "{{city}}" / "{{area}}" placeholders.',
        found: false
      }
    };
  }
  if (serviceTypeOpt !== undefined && hasTemplatePlaceholder(serviceTypeOpt)) {
    return {
      ok: false,
      status: 400,
      body: {
        message: 'serviceType must be a real value (fiber, 5g, or 4g), not a "{{serviceType}}" placeholder.',
        found: false
      }
    };
  }

  return { ok: true, params: { city: cityTrimmed, area: areaOpt, serviceType: serviceTypeOpt } };
}

/**
 * Validates package filter fields from either GET query params or POST body.
 * @returns {{ ok: true, params: { type?: string, category?: string } }
 *          | { ok: false, status: number, body: object }}
 */
export function validatePackageFilters(typeRaw, categoryRaw) {
  const toOpt = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = typeof v === 'string' ? v.trim() : String(v).trim();
    return s === '' ? undefined : s;
  };
  const type = toOpt(typeRaw);
  const category = toOpt(categoryRaw);

  if (type !== undefined && hasTemplatePlaceholder(type)) {
    return {
      ok: false,
      status: 400,
      body: { message: 'type must be a real value (e.g. prepaid), not a "{{type}}" placeholder.', count: 0, packages: [] }
    };
  }
  if (category !== undefined && hasTemplatePlaceholder(category)) {
    return {
      ok: false,
      status: 400,
      body: { message: 'category must be a real value (e.g. social), not a "{{category}}" placeholder.', count: 0, packages: [] }
    };
  }

  return { ok: true, params: { type, category } };
}

import mongoose from 'mongoose';
import { z } from 'zod';
import { getOffers, getCoverage, getPackages } from '../services/catalog.service.js';
import {
  getComplaintTicket,
  getComplaintsByPhone,
  getCustomerSnapshot,
  getLatestComplaintTicketByPhone,
  registerComplaint,
  registerNewConnection
} from '../services/telecom.service.js';

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Unfilled Retell / Mustache-style vars (e.g. `{{city}}`) must not be sent as query values. */
function hasTemplatePlaceholder(value) {
  return typeof value === 'string' && /\{\{[\s\S]*?\}\}/.test(value);
}

/** Express / gateways may expose a query key as `string` or `string[]`. */
function firstQueryParam(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const v = value[0];
    return typeof v === 'string' ? v : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/**
 * Shared validation for GET + POST coverage.
 * @returns {{ ok: true, params: { city: string, area?: string, serviceType?: string } } | { ok: false, status: number, body: object }}
 */
function validateCoverageFields({ city, area, serviceType }) {
  const cityTrimmed = typeof city === 'string' ? city.trim() : String(city ?? '').trim();
  if (!cityTrimmed) {
    return {
      ok: false,
      status: 400,
      body: {
        message: 'city is required (query parameter for GET, JSON body field for POST).',
        found: false
      }
    };
  }
  const areaStr =
    area === undefined || area === null
      ? undefined
      : typeof area === 'string'
        ? area.trim()
        : String(area).trim();
  const areaOpt = areaStr === '' ? undefined : areaStr;

  const serviceTypeStr =
    serviceType === undefined || serviceType === null
      ? undefined
      : typeof serviceType === 'string'
        ? serviceType.trim()
        : String(serviceType).trim();
  const serviceTypeOpt = serviceTypeStr === '' ? undefined : serviceTypeStr;

  if (hasTemplatePlaceholder(cityTrimmed) || (areaOpt !== undefined && hasTemplatePlaceholder(areaOpt))) {
    return {
      ok: false,
      status: 400,
      body: {
        message:
          'city and area must be real values from the customer (e.g. Dubai, Downtown), not literal "{{city}}" / "{{area}}" placeholders.',
        found: false
      }
    };
  }
  if (serviceTypeOpt !== undefined && hasTemplatePlaceholder(serviceTypeOpt)) {
    return {
      ok: false,
      status: 400,
      body: {
        message:
          'serviceType must be a real value (fiber, 5g, or 4g), not a literal "{{serviceType}}" placeholder.',
        found: false
      }
    };
  }

  return {
    ok: true,
    params: { city: cityTrimmed, area: areaOpt, serviceType: serviceTypeOpt }
  };
}

/**
 * @returns {{ ok: true, params: { type?: string, category?: string } } | { ok: false, status: number, body: object }}
 */
function validatePackageFilters(typeRaw, categoryRaw) {
  const typeOpt =
    typeRaw === undefined || typeRaw === null
      ? undefined
      : typeof typeRaw === 'string'
        ? typeRaw.trim()
        : String(typeRaw).trim();
  const type = typeOpt === '' ? undefined : typeOpt;

  const categoryOpt =
    categoryRaw === undefined || categoryRaw === null
      ? undefined
      : typeof categoryRaw === 'string'
        ? categoryRaw.trim()
        : String(categoryRaw).trim();
  const category = categoryOpt === '' ? undefined : categoryOpt;

  if (type !== undefined && hasTemplatePlaceholder(type)) {
    return {
      ok: false,
      status: 400,
      body: {
        message:
          'type must be a real value (e.g. prepaid), not a literal "{{type}}" placeholder.',
        count: 0,
        packages: []
      }
    };
  }
  if (category !== undefined && hasTemplatePlaceholder(category)) {
    return {
      ok: false,
      status: 400,
      body: {
        message:
          'category must be a real value (e.g. social), not a literal "{{category}}" placeholder.',
        count: 0,
        packages: []
      }
    };
  }

  return { ok: true, params: { type, category } };
}

/** Normalize phone from path/body; returns canonical prefix string for services or null if invalid. */
function normalizePhoneInput(raw) {
  let phone = raw || '';
  try {
    phone = decodeURIComponent(phone);
  } catch {
    /* ignore */
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return phone.trim();
}

export function registerRoutes(app) {
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'telecom-ai-demo-backend', database: 'mongodb' });
  });

  app.get(
    '/packages',
    wrap(async (req, res) => {
      const type = firstQueryParam(req.query.type);
      const category = firstQueryParam(req.query.category);
      const v = validatePackageFilters(type, category);
      if (!v.ok) return res.status(v.status).json(v.body);
      const data = await getPackages(v.params);
      res.json(data);
    })
  );

  app.post(
    '/packages',
    wrap(async (req, res) => {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const v = validatePackageFilters(body.type, body.category);
      if (!v.ok) return res.status(v.status).json(v.body);
      const data = await getPackages(v.params);
      res.json(data);
    })
  );

  app.get(
    '/offers',
    wrap(async (_req, res) => {
      const data = await getOffers();
      res.json(data);
    })
  );

  app.post(
    '/offers',
    wrap(async (_req, res) => {
      const data = await getOffers();
      res.json(data);
    })
  );

  app.get(
    '/coverage',
    wrap(async (req, res) => {
      const city = firstQueryParam(req.query.city);
      const area = firstQueryParam(req.query.area);
      const serviceType = firstQueryParam(req.query.serviceType);
      const v = validateCoverageFields({
        city: city ?? '',
        area,
        serviceType
      });
      if (!v.ok) return res.status(v.status).json(v.body);
      const data = await getCoverage(v.params);
      const status = data.found ? 200 : 404;
      res.status(status).json(data);
    })
  );

  app.post(
    '/coverage',
    wrap(async (req, res) => {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const v = validateCoverageFields({
        city: body.city,
        area: body.area,
        serviceType: body.serviceType
      });
      if (!v.ok) return res.status(v.status).json(v.body);
      const data = await getCoverage(v.params);
      const status = data.found ? 200 : 404;
      res.status(status).json(data);
    })
  );

  app.get(
    '/customers/:phoneNumber',
    wrap(async (req, res) => {
      const phone = normalizePhoneInput(req.params.phoneNumber || '');
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const usagePreferenceRaw = firstQueryParam(req.query.usagePreference);
      const usagePreference = usagePreferenceRaw ?? 'general';
      if (
        usagePreferenceRaw !== undefined &&
        hasTemplatePlaceholder(usagePreferenceRaw)
      ) {
        return res.status(400).json({
          message:
            'Query parameter usagePreference must be a real value (general, social, stream, …), not a literal "{{usagePreference}}" placeholder.'
        });
      }

      const data = await getCustomerSnapshot(phone, usagePreference);
      res.json(data);
    })
  );

  app.post(
    '/customers/snapshot',
    wrap(async (req, res) => {
      const schema = z.object({
        phoneNumber: z.string().min(1),
        usagePreference: z.string().optional()
      });
      const parsed = schema.parse(req.body ?? {});
      const phone = normalizePhoneInput(parsed.phoneNumber);
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }
      const usagePreferenceRaw = parsed.usagePreference;
      const usagePreference = usagePreferenceRaw ?? 'general';
      if (
        usagePreferenceRaw !== undefined &&
        hasTemplatePlaceholder(usagePreferenceRaw)
      ) {
        return res.status(400).json({
          message:
            'usagePreference must be a real value (general, social, stream, …), not a literal "{{usagePreference}}" placeholder.'
        });
      }
      const data = await getCustomerSnapshot(phone, usagePreference);
      res.json(data);
    })
  );

  app.post(
    '/tools/register-complaint-callback',
    wrap(async (req, res) => {
      const schema = z.object({
        phoneNumber: z.string().min(8),
        issueType: z.string().min(3),
        description: z.string().min(5)
      });
      const payload = schema.parse(req.body);
      const result = await registerComplaint(payload);
      res.json(result);
    })
  );

  app.post(
    '/tools/new-connection-callback',
    wrap(async (req, res) => {
      const schema = z.object({
        fullName: z.string().min(2),
        phoneNumber: z.string().min(8),
        city: z.string().min(1),
        area: z.string().optional(),
        planPreference: z.string().optional(),
        notes: z.string().optional(),
        preferredLanguage: z.enum(['en', 'ar']).optional()
      });
      const parsed = schema.parse(req.body ?? {});

      const placeholderFields = [
        ['fullName', parsed.fullName],
        ['phoneNumber', parsed.phoneNumber],
        ['city', parsed.city],
        ['area', parsed.area],
        ['planPreference', parsed.planPreference],
        ['notes', parsed.notes],
        ['preferredLanguage', parsed.preferredLanguage]
      ];
      for (const [label, val] of placeholderFields) {
        if (typeof val === 'string' && hasTemplatePlaceholder(val)) {
          return res.status(400).json({
            message: `${label} must be a real value from the customer, not a "{{...}}" placeholder.`
          });
        }
      }

      const result = await registerNewConnection(parsed);
      res.json(result);
    })
  );

  app.get(
    '/complaints/by-phone/:phoneNumber',
    wrap(async (req, res) => {
      const phone = normalizePhoneInput(req.params.phoneNumber || '');
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const data = await getComplaintsByPhone(phone);
      res.json(data);
    })
  );

  app.post(
    '/complaints/by-phone',
    wrap(async (req, res) => {
      const schema = z.object({ phoneNumber: z.string().min(1) });
      const { phoneNumber } = schema.parse(req.body ?? {});
      const phone = normalizePhoneInput(phoneNumber);
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const data = await getComplaintsByPhone(phone);
      res.json(data);
    })
  );

  /**
   * GetComplaintTicket by phone — same JSON shape as GET /tickets/:ticketId, no Mongo id required.
   * Register this in Retell as the primary "ticket status" tool (use latest complaint for that line).
   */
  app.get(
    '/tickets/by-phone/:phoneNumber',
    wrap(async (req, res) => {
      const phone = normalizePhoneInput(req.params.phoneNumber || '');
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const ticket = await getLatestComplaintTicketByPhone(phone);
      if (!ticket) {
        return res.status(404).json({
          message: 'No complaint found for this number. Use POST /tools/register-complaint-callback to create one.'
        });
      }
      res.json(ticket);
    })
  );

  app.post(
    '/tickets/by-phone',
    wrap(async (req, res) => {
      const schema = z.object({ phoneNumber: z.string().min(1) });
      const { phoneNumber } = schema.parse(req.body ?? {});
      const phone = normalizePhoneInput(phoneNumber);
      if (!phone) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const ticket = await getLatestComplaintTicketByPhone(phone);
      if (!ticket) {
        return res.status(404).json({
          message: 'No complaint found for this number. Use POST /tools/register-complaint-callback to create one.'
        });
      }
      res.json(ticket);
    })
  );

  app.post(
    '/tickets/lookup',
    wrap(async (req, res) => {
      const schema = z.object({ ticketId: z.string().min(1) });
      const { ticketId } = schema.parse(req.body ?? {});
      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          message:
            'Invalid ticket id. Use POST /tickets/by-phone with phoneNumber, or a valid complaint id from POST /tools/register-complaint-callback — not the "{{ticketId}}" placeholder.'
        });
      }
      const ticket = await getComplaintTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({
          message:
            'Ticket not found. Try POST /tickets/by-phone or POST /complaints/by-phone with phoneNumber if the customer only has their mobile.'
        });
      }
      res.json(ticket);
    })
  );

  app.get(
    '/tickets/:ticketId',
    wrap(async (req, res) => {
      const { ticketId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          message:
            'Invalid ticket id. Use POST /tickets/by-phone with phoneNumber, or a valid complaint id from POST /tools/register-complaint-callback — not the "{{ticketId}}" placeholder.'
        });
      }
      const ticket = await getComplaintTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({
          message:
            'Ticket not found. Try POST /tickets/by-phone or POST /complaints/by-phone with phoneNumber if the customer only has their mobile.'
        });
      }
      res.json(ticket);
    })
  );
}

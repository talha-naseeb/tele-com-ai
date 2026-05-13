import { z } from 'zod';
import { getCustomerSnapshot } from '../services/telecom.service.js';
import { assertCallerOwnership, firstQueryParam, hasTemplatePlaceholder, normalizePhoneInput } from '../utils/route-helpers.js';

export async function customerSnapshotGet(req, res) {
  const phone = normalizePhoneInput(req.params.phoneNumber || '');
  if (!phone) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }

  const usagePreferenceRaw = firstQueryParam(req.query.usagePreference);
  if (usagePreferenceRaw !== undefined && hasTemplatePlaceholder(usagePreferenceRaw)) {
    return res.status(400).json({
      message: 'usagePreference must be a real value (general, social, stream, …), not a "{{usagePreference}}" placeholder.'
    });
  }

  if (!assertCallerOwnership(req, res, phone)) return;
  const data = await getCustomerSnapshot(phone, usagePreferenceRaw ?? 'general');
  res.json(data);
}

export async function customerSnapshotPost(req, res) {
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
  if (usagePreferenceRaw !== undefined && hasTemplatePlaceholder(usagePreferenceRaw)) {
    return res.status(400).json({
      message: 'usagePreference must be a real value (general, social, stream, …), not a "{{usagePreference}}" placeholder.'
    });
  }

  if (!assertCallerOwnership(req, res, phone)) return;
  const data = await getCustomerSnapshot(phone, usagePreferenceRaw ?? 'general');
  res.json(data);
}

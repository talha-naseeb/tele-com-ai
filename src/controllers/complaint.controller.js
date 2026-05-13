import { z } from 'zod';
import { getComplaintsByPhone, registerComplaint } from '../services/telecom.service.js';
import { assertCallerOwnership, normalizePhoneInput } from '../utils/route-helpers.js';

export async function listComplaintsGet(req, res) {
  const phone = normalizePhoneInput(req.params.phoneNumber || '');
  if (!phone) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }
  if (!assertCallerOwnership(req, res, phone)) return;
  const data = await getComplaintsByPhone(phone);
  res.json(data);
}

export async function listComplaintsPost(req, res) {
  const schema = z.object({ phoneNumber: z.string().min(1) });
  const { phoneNumber } = schema.parse(req.body ?? {});
  const phone = normalizePhoneInput(phoneNumber);
  if (!phone) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }
  if (!assertCallerOwnership(req, res, phone)) return;
  const data = await getComplaintsByPhone(phone);
  res.json(data);
}

export async function registerComplaintPost(req, res) {
  const schema = z.object({
    phoneNumber: z.string().min(8),
    issueType: z.string().min(3),
    description: z.string().min(5)
  });
  const payload = schema.parse(req.body);
  const phone = normalizePhoneInput(payload.phoneNumber);
  if (phone && !assertCallerOwnership(req, res, phone)) return;
  const result = await registerComplaint(payload);
  res.json(result);
}

import mongoose from 'mongoose';
import { z } from 'zod';
import {
  getComplaintTicket,
  getComplaintsByPhone,
  getCustomerSnapshot,
  getLatestComplaintTicketByPhone,
  registerComplaint
} from '../services/telecom.service.js';

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function registerRoutes(app) {
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'telecom-ai-demo-backend', database: 'mongodb' });
  });

  app.get(
    '/customers/:phoneNumber',
    wrap(async (req, res) => {
      let phone = req.params.phoneNumber || '';
      try {
        phone = decodeURIComponent(phone);
      } catch {
        /* ignore malformed encoding */
      }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) {
        return res.status(400).json({ message: 'Invalid phone number.' });
      }

      const usagePreference =
        typeof req.query.usagePreference === 'string' ? req.query.usagePreference : 'general';

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

  app.get(
    '/complaints/by-phone/:phoneNumber',
    wrap(async (req, res) => {
      let phone = req.params.phoneNumber || '';
      try {
        phone = decodeURIComponent(phone);
      } catch {
        /* ignore malformed encoding */
      }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) {
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
      let phone = req.params.phoneNumber || '';
      try {
        phone = decodeURIComponent(phone);
      } catch {
        /* ignore */
      }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) {
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

  app.get(
    '/tickets/:ticketId',
    wrap(async (req, res) => {
      const { ticketId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          message:
            'Invalid ticket id. Use GET /tickets/by-phone/:phoneNumber with the customer mobile, or a valid complaint id from POST /tools/register-complaint-callback — not the "{{ticketId}}" placeholder.'
        });
      }
      const ticket = await getComplaintTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({
          message:
            'Ticket not found. Try GET /tickets/by-phone/:phoneNumber or GET /complaints/by-phone/:phoneNumber if the customer only has their mobile.'
        });
      }
      res.json(ticket);
    })
  );
}

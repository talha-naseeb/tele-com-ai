import { z } from 'zod';
import { getComplaintTicket, getCustomerSnapshot, registerComplaint } from '../services/telecom.service.js';

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
    '/tickets/:ticketId',
    wrap(async (req, res) => {
      const ticket = await getComplaintTicket(req.params.ticketId);
      res.json(ticket || { message: 'Ticket not found.' });
    })
  );
}

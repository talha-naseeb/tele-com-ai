import { z } from 'zod';
import { getComplaintTicket, getCustomerSnapshot, registerComplaint } from '../services/telecom.service.js';

export async function registerRoutes(app) {
  app.get('/health', async () => ({ ok: true, service: 'telecom-ai-demo-backend', database: 'mongodb' }));

  app.get('/customers/:phoneNumber', async (request, reply) => {
    let phone = request.params.phoneNumber || '';
    try {
      phone = decodeURIComponent(phone);
    } catch {
      /* ignore malformed encoding */
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      return reply.code(400).send({ message: 'Invalid phone number.' });
    }

    const usagePreference =
      typeof request.query.usagePreference === 'string' ? request.query.usagePreference : 'general';

    return getCustomerSnapshot(phone, usagePreference);
  });

  app.post('/tools/register-complaint-callback', async (request) => {
    const schema = z.object({
      phoneNumber: z.string().min(8),
      issueType: z.string().min(3),
      description: z.string().min(5)
    });
    const payload = schema.parse(request.body);
    return registerComplaint(payload);
  });

  app.get('/tickets/:ticketId', async (request) => {
    const { ticketId } = request.params;
    const ticket = await getComplaintTicket(ticketId);
    return ticket || { message: 'Ticket not found.' };
  });
}

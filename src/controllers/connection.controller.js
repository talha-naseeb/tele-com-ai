import { z } from 'zod';
import { registerNewConnection } from '../services/telecom.service.js';
import { hasTemplatePlaceholder } from '../utils/route-helpers.js';

const schema = z.object({
  fullName: z.string().min(2),
  phoneNumber: z.string().min(8),
  city: z.string().min(1),
  area: z.string().optional(),
  planPreference: z.string().optional(),
  notes: z.string().optional(),
  preferredLanguage: z.enum(['en', 'ar']).optional()
});

export async function newConnectionPost(req, res) {
  const parsed = schema.parse(req.body ?? {});

  for (const [field, val] of Object.entries(parsed)) {
    if (typeof val === 'string' && hasTemplatePlaceholder(val)) {
      return res.status(400).json({
        message: `${field} must be a real value from the customer, not a "{{...}}" placeholder.`
      });
    }
  }

  const result = await registerNewConnection(parsed);
  res.json(result);
}

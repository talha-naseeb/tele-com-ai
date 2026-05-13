import { wrap } from '../utils/route-helpers.js';
import { listPackagesGet, listPackagesPost, listOffers, checkCoverageGet, checkCoveragePost } from '../controllers/catalog.controller.js';
import { customerSnapshotGet, customerSnapshotPost } from '../controllers/customer.controller.js';
import { listComplaintsGet, listComplaintsPost, registerComplaintPost } from '../controllers/complaint.controller.js';
import { complaintTicketByPhoneGet, complaintTicketByPhonePost, ticketByIdGet, ticketByIdPost } from '../controllers/ticket.controller.js';
import { newConnectionPost } from '../controllers/connection.controller.js';

export function registerRoutes(app) {
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'telecom-ai-demo-backend', database: 'mongodb' });
  });

  // ── Packages ────────────────────────────────────────────────────────────────
  app.get('/packages', wrap(listPackagesGet));
  app.post('/api/packages', wrap(listPackagesPost));

  // ── Offers ──────────────────────────────────────────────────────────────────
  app.get('/offers', wrap(listOffers));
  app.post('/api/latest-offers', wrap(listOffers));

  // ── Coverage ────────────────────────────────────────────────────────────────
  app.get('/coverage', wrap(checkCoverageGet));
  app.post('/api/coverage', wrap(checkCoveragePost));

  // ── Customer snapshot ───────────────────────────────────────────────────────
  app.get('/customers/:phoneNumber', wrap(customerSnapshotGet));
  app.post('/api/customer-snapshot', wrap(customerSnapshotPost));

  // ── Complaints ──────────────────────────────────────────────────────────────
  app.get('/complaints/by-phone/:phoneNumber', wrap(listComplaintsGet));
  app.post('/api/list-complaints', wrap(listComplaintsPost));
  app.post('/api/register-complaint', wrap(registerComplaintPost));

  // ── Tickets ─────────────────────────────────────────────────────────────────
  app.get('/tickets/by-phone/:phoneNumber', wrap(complaintTicketByPhoneGet));
  app.post('/api/complaint-ticket', wrap(complaintTicketByPhonePost));
  app.get('/tickets/:ticketId', wrap(ticketByIdGet));
  app.post('/api/ticket-by-id', wrap(ticketByIdPost));

  // ── New connection ──────────────────────────────────────────────────────────
  app.post('/api/new-connection', wrap(newConnectionPost));
}

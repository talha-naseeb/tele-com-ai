import mongoose from 'mongoose';
import { z } from 'zod';
import { getComplaintTicket, getLatestComplaintTicketByPhone } from '../services/telecom.service.js';
import { assertCallerOwnership, normalizePhoneInput } from '../utils/route-helpers.js';

const NOT_FOUND_BY_PHONE =
  'No complaint found for this number. Use POST /api/register-complaint to create one.';
const INVALID_TICKET_ID =
  'Invalid ticket id. Use POST /api/complaint-ticket with phoneNumber, or a valid complaint id from POST /api/register-complaint.';
const TICKET_NOT_FOUND =
  'Ticket not found. Try POST /api/complaint-ticket or POST /api/list-complaints with phoneNumber.';

export async function complaintTicketByPhoneGet(req, res) {
  const phone = normalizePhoneInput(req.params.phoneNumber || '');
  if (!phone) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }
  if (!assertCallerOwnership(req, res, phone)) return;
  const ticket = await getLatestComplaintTicketByPhone(phone);
  if (!ticket) {
    return res.status(404).json({ message: NOT_FOUND_BY_PHONE });
  }
  res.json(ticket);
}

export async function complaintTicketByPhonePost(req, res) {
  const schema = z.object({ phoneNumber: z.string().min(1) });
  const { phoneNumber } = schema.parse(req.body ?? {});
  const phone = normalizePhoneInput(phoneNumber);
  if (!phone) {
    return res.status(400).json({ message: 'Invalid phone number.' });
  }
  if (!assertCallerOwnership(req, res, phone)) return;
  const ticket = await getLatestComplaintTicketByPhone(phone);
  if (!ticket) {
    return res.status(404).json({ message: NOT_FOUND_BY_PHONE });
  }
  res.json(ticket);
}

export async function ticketByIdPost(req, res) {
  const schema = z.object({ ticketId: z.string().min(1) });
  const { ticketId } = schema.parse(req.body ?? {});
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: INVALID_TICKET_ID });
  }
  const ticket = await getComplaintTicket(ticketId);
  if (!ticket) {
    return res.status(404).json({ message: TICKET_NOT_FOUND });
  }
  if (ticket.phoneNumber) {
    const ticketPhone = normalizePhoneInput(ticket.phoneNumber);
    if (ticketPhone && !assertCallerOwnership(req, res, ticketPhone)) return;
  }
  res.json(ticket);
}

export async function ticketByIdGet(req, res) {
  const { ticketId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({ message: INVALID_TICKET_ID });
  }
  const ticket = await getComplaintTicket(ticketId);
  if (!ticket) {
    return res.status(404).json({ message: TICKET_NOT_FOUND });
  }
  res.json(ticket);
}

import mongoose from 'mongoose';
import { BillingRecord, Complaint, ConnectionRequest, Customer } from '../models/index.js';
import { detectPriorityFromIssue } from '../utils/priority.js';
import { canonicalInternationalPhone } from '../utils/phone.js';
import { config } from '../config/index.js';

// Suggested add-on packs shown in customer snapshot — real SyriaTel plans (New SYP pricing).
const PACKAGES = [
  { plan: 'Prepaid Monthly 6GB',  monthlyPrice: 480,  dataGb: 6  },
  { plan: 'Prepaid Monthly 20GB', monthlyPrice: 1200, dataGb: 20 },
  { plan: 'Social Pack (4GB/day for WhatsApp, Telegram, Facebook, Instagram, X)', monthlyPrice: 0, dataGb: 4 }
];

export async function getCustomerByPhone(phoneNumber) {
  const phone = canonicalInternationalPhone(phoneNumber);
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return null;
  }
  return Customer.findOne({
    $or: [{ phone_number: phone }, { phone_number: phoneNumber.trim() }]
  }).lean();
}

function pickSuggestedDataPack(usagePreference = 'general') {
  let recommendation = PACKAGES[0];
  if (usagePreference.includes('stream') || usagePreference.includes('heavy')) {
    recommendation = PACKAGES[1];
  }
  if (usagePreference.includes('social') || usagePreference.includes('chat')) {
    recommendation = PACKAGES[2];
  }
  return recommendation;
}

export async function getCustomerSnapshot(phoneNumber, usagePreference = 'general') {
  const customer = await getCustomerByPhone(phoneNumber);
  if (!customer) {
    return { found: false };
  }

  const bill = await BillingRecord.findOne({ customer_id: customer._id }).sort({ due_date: 1 }).lean();

  let billPayload;
  if (!bill) {
    billPayload = { status: 'no_bill', message: 'No active bill found.' };
  } else {
    billPayload = {
      amountDue: Number(bill.amount_due),
      dueDate: bill.due_date instanceof Date ? bill.due_date.toISOString().slice(0, 10) : bill.due_date,
      status: bill.status,
      currency: 'SYP'
    };
  }

  const simNote =
    customer.sim_status === 'active' ? 'SIM is active and usable.' : 'SIM is not active yet.';

  return {
    found: true,
    customer: {
      name: customer.full_name,
      city: customer.city,
      planName: customer.plan_name,
      preferredLanguage: customer.preferred_language
    },
    balance: {
      planName: customer.plan_name,
      balanceDue: Number(customer.balance_due),
      currency: 'SYP'
    },
    bill: billPayload,
    sim: {
      status: customer.sim_status,
      note: simNote
    },
    suggestedDataPack: pickSuggestedDataPack(usagePreference)
  };
}

export async function registerComplaint({ phoneNumber, issueType, description }) {
  const phone = canonicalInternationalPhone(phoneNumber);
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw Object.assign(new Error('Invalid phone number.'), { statusCode: 400 });
  }

  const customer = await getCustomerByPhone(phone);
  const priority = detectPriorityFromIssue(`${issueType} ${description}`);

  const doc = await Complaint.create({
    customer_id: customer?._id ?? null,
    phone_number: phone,
    issue_type: issueType,
    description,
    priority,
    callback_eta_hours: config.defaultCallbackSlaHours
  });

  return {
    complaintId: doc._id.toString(),
    phoneNumber: phone,
    status: doc.status,
    callbackEtaHours: doc.callback_eta_hours,
    callbackMessage: `Our human agent will call you within ${doc.callback_eta_hours} hours.`
  };
}

/**
 * Capture a new-line / new-customer signup lead from the voice agent.
 * @param {{ fullName: string, phoneNumber: string, city: string, area?: string, planPreference?: string, notes?: string, preferredLanguage?: 'en'|'ar' }} payload
 */
export async function registerNewConnection(payload) {
  const phone = canonicalInternationalPhone(payload.phoneNumber);
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    throw Object.assign(new Error('Invalid phone number.'), { statusCode: 400 });
  }

  const fullName = payload.fullName.trim();
  const city = payload.city.trim();
  if (!fullName || !city) {
    throw Object.assign(new Error('fullName and city are required.'), { statusCode: 400 });
  }

  const preferredLanguage = payload.preferredLanguage === 'ar' ? 'ar' : 'en';

  const doc = await ConnectionRequest.create({
    full_name: fullName,
    phone_number: phone,
    city,
    area: payload.area?.trim() ?? '',
    plan_preference: payload.planPreference?.trim() ?? '',
    notes: payload.notes?.trim() ?? '',
    preferred_language: preferredLanguage,
    callback_eta_hours: config.defaultCallbackSlaHours
  });

  return {
    connectionRequestId: doc._id.toString(),
    phoneNumber: phone,
    fullName: doc.full_name,
    city: doc.city,
    area: doc.area || undefined,
    planPreference: doc.plan_preference || undefined,
    status: doc.status,
    callbackEtaHours: doc.callback_eta_hours,
    callbackMessage: `A sales specialist will call ${phone} within ${doc.callback_eta_hours} hours to complete your new connection.`
  };
}

/** List complaints for this caller line (newest first). Uses linked customer account and/or stored phone on the ticket. */
export async function getComplaintsByPhone(phoneNumber) {
  const phone = canonicalInternationalPhone(phoneNumber);
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return {
      found: false,
      phoneNumber: phoneNumber,
      count: 0,
      complaints: [],
      message: 'Invalid phone number.'
    };
  }

  const customer = await getCustomerByPhone(phone);
  const or = [{ phone_number: phone }, { phone_number: phoneNumber.trim() }];
  if (customer) {
    or.push({ customer_id: customer._id });
  }

  const rows = await Complaint.find({ $or: or })
    .sort({ created_at: -1 })
    .limit(25)
    .lean();

  const complaints = rows.map((c) => ({
    complaintId: c._id.toString(),
    issue_type: c.issue_type,
    description: c.description,
    priority: c.priority,
    status: c.status,
    callback_eta_hours: c.callback_eta_hours,
    created_at: c.created_at
  }));

  return {
    found: true,
    phoneNumber: phone,
    count: complaints.length,
    complaints,
    ...(complaints.length === 0
      ? { message: 'No complaints on file for this number.' }
      : {})
  };
}

function mapComplaintDocToTicket(c) {
  const phoneRaw = c.phone_number;
  return {
    id: c._id.toString(),
    ...(phoneRaw
      ? { phoneNumber: canonicalInternationalPhone(phoneRaw) }
      : {}),
    issue_type: c.issue_type,
    description: c.description,
    priority: c.priority,
    status: c.status,
    callback_eta_hours: c.callback_eta_hours,
    created_at: c.created_at
  };
}

export async function getComplaintTicket(ticketId) {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return null;
  }
  const c = await Complaint.findById(ticketId).lean();
  if (!c) {
    return null;
  }
  return mapComplaintDocToTicket(c);
}

/** Same payload as getComplaintTicket, but keyed by phone — latest complaint first (for voice agents). */
export async function getLatestComplaintTicketByPhone(phoneNumber) {
  const phone = canonicalInternationalPhone(phoneNumber);
  if (!phone || phone.replace(/\D/g, '').length < 8) {
    return null;
  }

  const customer = await getCustomerByPhone(phone);
  const or = [{ phone_number: phone }, { phone_number: phoneNumber.trim() }];
  if (customer) {
    or.push({ customer_id: customer._id });
  }

  const c = await Complaint.findOne({ $or: or }).sort({ created_at: -1 }).lean();
  if (!c) {
    return null;
  }
  return mapComplaintDocToTicket(c);
}

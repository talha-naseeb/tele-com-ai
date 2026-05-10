import mongoose from 'mongoose';
import { BillingRecord, Complaint, Customer } from '../models/index.js';
import { detectPriorityFromIssue } from '../utils/priority.js';
import { config } from '../config/index.js';

const PACKAGES = [
  { plan: 'Starter 10GB Add-on', monthlyPrice: 20, dataGb: 10 },
  { plan: 'Value 50GB Add-on', monthlyPrice: 45, dataGb: 50 },
  { plan: 'Unlimited Social Pack', monthlyPrice: 30, dataGb: 999 }
];

export async function getCustomerByPhone(phoneNumber) {
  return Customer.findOne({ phone_number: phoneNumber }).lean();
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
      currency: 'AED'
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
      currency: 'AED'
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
  const customer = await getCustomerByPhone(phoneNumber);
  const priority = detectPriorityFromIssue(`${issueType} ${description}`);

  const doc = await Complaint.create({
    customer_id: customer?._id ?? null,
    issue_type: issueType,
    description,
    priority,
    callback_eta_hours: config.defaultCallbackSlaHours
  });

  return {
    complaintId: doc._id.toString(),
    status: doc.status,
    callbackEtaHours: doc.callback_eta_hours,
    callbackMessage: `Our human agent will call you within ${doc.callback_eta_hours} hours.`
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
  return {
    id: c._id.toString(),
    issue_type: c.issue_type,
    description: c.description,
    priority: c.priority,
    status: c.status,
    callback_eta_hours: c.callback_eta_hours,
    created_at: c.created_at
  };
}

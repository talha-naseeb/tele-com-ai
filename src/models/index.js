import mongoose from 'mongoose';

const { Schema } = mongoose;

const customerSchema = new Schema(
  {
    full_name: { type: String, required: true },
    phone_number: { type: String, required: true, unique: true, index: true },
    preferred_language: { type: String, required: true, enum: ['en', 'ar'] },
    city: { type: String, required: true },
    plan_name: { type: String, required: true },
    balance_due: { type: Number, required: true, default: 0 },
    sim_status: { type: String, required: true, enum: ['pending', 'active', 'blocked'] }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const billingRecordSchema = new Schema(
  {
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount_due: { type: Number, required: true },
    due_date: { type: Date, required: true },
    status: { type: String, required: true, enum: ['pending', 'paid', 'overdue'] }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const complaintSchema = new Schema(
  {
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    issue_type: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
    status: { type: String, default: 'open', enum: ['open', 'in_progress', 'resolved'] },
    callback_requested: { type: Boolean, default: true },
    callback_eta_hours: { type: Number, required: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

/** Third argument = actual MongoDB collection name (visible in Compass). */
export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema, 'customers');
export const BillingRecord =
  mongoose.models.BillingRecord || mongoose.model('BillingRecord', billingRecordSchema, 'billing_records');
export const Complaint =
  mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema, 'complaints');

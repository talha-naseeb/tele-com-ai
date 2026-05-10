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
    /** Denormalized from registration; used to list complaints when querying by phone without a profile match. */
    phone_number: { type: String, index: true, sparse: true },
    issue_type: { type: String, required: true },
    description: { type: String, required: true },
    priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
    status: { type: String, default: 'open', enum: ['open', 'in_progress', 'resolved'] },
    callback_requested: { type: Boolean, default: true },
    callback_eta_hours: { type: Number, required: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

/** New line / new customer signup interest captured by the voice agent. */
const connectionRequestSchema = new Schema(
  {
    full_name: { type: String, required: true },
    phone_number: { type: String, required: true, index: true },
    city: { type: String, required: true },
    area: { type: String, default: '' },
    plan_preference: { type: String, default: '' },
    notes: { type: String, default: '' },
    preferred_language: { type: String, default: 'en', enum: ['en', 'ar'] },
    status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'in_progress', 'completed', 'cancelled']
    },
    callback_eta_hours: { type: Number, required: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const packageCatalogSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['prepaid', 'postpaid', 'internet', 'data']
    },
    categories: [{ type: String }],
    data_gb: { type: Number, default: 0 },
    price_monthly_aed: { type: Number, required: true },
    currency: { type: String, default: 'AED' },
    description: { type: String, required: true },
    sort_order: { type: Number, default: 0 }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const offerSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    valid_until: { type: Date, default: null },
    discount_percent: { type: Number },
    promo_code: { type: String },
    active: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const coverageAreaSchema = new Schema(
  {
    city: { type: String, required: true, index: true },
    area: { type: String, default: '' },
    fiber_available: { type: Boolean, default: false },
    five_g_available: { type: Boolean, default: true },
    four_g_available: { type: Boolean, default: true },
    notes: { type: String, default: '' }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema, 'customers');
export const BillingRecord =
  mongoose.models.BillingRecord || mongoose.model('BillingRecord', billingRecordSchema, 'billing_records');
export const Complaint =
  mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema, 'complaints');
export const ConnectionRequest =
  mongoose.models.ConnectionRequest ||
  mongoose.model('ConnectionRequest', connectionRequestSchema, 'connection_requests');

/** Catalog collections (third argument = MongoDB collection name). */
export const PackageCatalog =
  mongoose.models.PackageCatalog ||
  mongoose.model('PackageCatalog', packageCatalogSchema, 'packages');
export const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema, 'offers');
export const CoverageArea =
  mongoose.models.CoverageArea || mongoose.model('CoverageArea', coverageAreaSchema, 'coverage_areas');

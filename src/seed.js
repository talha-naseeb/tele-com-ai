import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, mongoose } from './lib/db.js';
import {
  BillingRecord,
  Complaint,
  CoverageArea,
  Customer,
  Offer,
  PackageCatalog
} from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  await connectDb();

  console.log(`[seed] Database name: "${mongoose.connection.name}" (must match the DB you open in Compass)`);
  console.log('[seed] Collections: customers, billing_records, complaints, connection_requests, packages, offers, coverage_areas');

  const filePath = path.join(__dirname, '..', 'data', 'seed-data.json');
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);

  for (const customer of data.customers) {
    await Customer.findOneAndUpdate(
      { phone_number: customer.phone_number },
      {
        full_name: customer.full_name,
        preferred_language: customer.preferred_language,
        city: customer.city,
        plan_name: customer.plan_name,
        balance_due: customer.balance_due,
        sim_status: customer.sim_status
      },
      { upsert: true, new: true }
    );
  }

  await BillingRecord.deleteMany({});

  for (const bill of data.billing_records) {
    const customer = await Customer.findOne({ phone_number: bill.phone_number }).select('_id').lean();
    if (!customer) {
      continue;
    }

    await BillingRecord.create({
      customer_id: customer._id,
      amount_due: bill.amount_due,
      due_date: new Date(bill.due_date),
      status: bill.status
    });
  }

  await Complaint.deleteMany({});

  const complaints = Array.isArray(data.complaints) ? data.complaints : [];
  for (const row of complaints) {
    const customer = await Customer.findOne({ phone_number: row.phone_number }).select('_id').lean();
    await Complaint.create({
      customer_id: customer?._id ?? null,
      phone_number: row.phone_number,
      issue_type: row.issue_type,
      description: row.description,
      priority: row.priority ?? 'medium',
      status: row.status ?? 'open',
      callback_requested: true,
      callback_eta_hours: row.callback_eta_hours ?? 2
    });
  }

  await PackageCatalog.deleteMany({});
  const pkgs = Array.isArray(data.packages) ? data.packages : [];
  if (pkgs.length) {
    await PackageCatalog.insertMany(
      pkgs.map((p) => ({
        slug: p.slug,
        name: p.name,
        type: p.type,
        categories: p.categories || [],
        data_gb: p.data_gb ?? 0,
        price_monthly_aed: p.price_monthly_aed,
        currency: 'AED',
        description: p.description,
        sort_order: p.sort_order ?? 0
      }))
    );
  }

  await Offer.deleteMany({});
  const offers = Array.isArray(data.offers) ? data.offers : [];
  if (offers.length) {
    await Offer.insertMany(
      offers.map((o) => ({
        title: o.title,
        description: o.description,
        valid_until: o.valid_until ? new Date(o.valid_until) : null,
        discount_percent: o.discount_percent,
        promo_code: o.promo_code,
        active: o.active !== false
      }))
    );
  }

  await CoverageArea.deleteMany({});
  const zones = Array.isArray(data.coverage_areas) ? data.coverage_areas : [];
  if (zones.length) {
    await CoverageArea.insertMany(
      zones.map((z) => ({
        city: z.city,
        area: z.area || '',
        fiber_available: Boolean(z.fiber_available),
        five_g_available: z.five_g_available !== false,
        four_g_available: z.four_g_available !== false,
        notes: z.notes || ''
      }))
    );
  }

  console.log(
    `Seed completed: ${data.customers.length} customers, ${data.billing_records.length} bills, ${complaints.length} complaints, ${pkgs.length} packages, ${offers.length} offers, ${zones.length} coverage rows.`
  );
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

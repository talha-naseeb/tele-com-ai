import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, mongoose } from './lib/db.js';
import { BillingRecord, Complaint, Customer } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  await connectDb();

  console.log(`[seed] Database name: "${mongoose.connection.name}" (must match the DB you open in Compass)`);
  console.log('[seed] Collections: customers, billing_records, complaints');

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
      issue_type: row.issue_type,
      description: row.description,
      priority: row.priority ?? 'medium',
      status: row.status ?? 'open',
      callback_requested: true,
      callback_eta_hours: row.callback_eta_hours ?? 2
    });
  }

  console.log(
    `Seed completed: ${data.customers.length} customers, ${data.billing_records.length} bills, ${complaints.length} complaints.`
  );
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

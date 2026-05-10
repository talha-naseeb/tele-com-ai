# Telecom demo backend (Express + MongoDB)

Small API for demo customer data and complaint callbacks. Uses **MongoDB Atlas** (or any MongoDB URI).

## Setup

1. Copy `.env.example` to `.env`.
2. Set **`MONGODB_URI`** to your Atlas connection string (include database name, e.g. `…mongodb.net/telecom_demo?retryWrites=true&w=majority`). Allow your IP in Atlas Network Access (or `0.0.0.0/0` for demos only).
3. Install and seed:

```bash
npm install
npm run seed
npm run dev
```

Server default: `http://localhost:8080` (override with **`PORT`**).

[`data/seed-data.json`](data/seed-data.json) holds demo customers, billing rows, and sample complaints. After `npm run seed`, try GET `/customers/+971501112233` or `/customers/+971554433221`.

### MongoDB Compass

Use the **same** URI as **`MONGODB_URI`**. In the connection string, the **database** is the path segment after the host — e.g. `…mongodb.net/telecom_demo?…` → open database **`telecom_demo`**. If you leave it out (`…mongodb.net/?…`), data often ends up in **`test`**, so you will not see it under a named DB.

After seeding, open these collections: **`customers`**, **`billing_records`**, **`complaints`**.

Optional: drop obsolete collections from older versions of this repo (`calls`, `transcripts`, `agentactions`, `newconnectionrequests`) if they exist in your database.

## Project layout

```text
src/
  server.js              # HTTP server entry (local dev / production Node)
  seed.js                # Loads data/seed-data.json into MongoDB
  app-factory.js         # Builds Express (`createApp`)
  config/index.js        # Environment config
  lib/db.js              # Mongoose connection
  models/index.js        # Schemas
  routes/index.js        # Route registration
  services/
    telecom.service.js   # Customer snapshot & complaints
  utils/
    priority.js          # Complaint priority helper
api/index.js             # Vercel serverless entry → src/app-factory.js
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/customers/:phoneNumber` | Customer snapshot: profile, balance, bill, SIM, suggested add-on. Optional query `usagePreference` (e.g. `social`, `stream`) adjusts the suggestion. |
| `POST` | `/tools/register-complaint-callback` | Body: `{ "phoneNumber", "issueType", "description" }`. Saves **`phone_number`** on the ticket (canonical `+digits`) and returns **`phoneNumber`** plus **`complaintId`** for Retell variables. |
| `GET` | `/complaints/by-phone/:phoneNumber` | List complaints for that line (newest first). |
| `GET` | `/tickets/by-phone/:phoneNumber` | **GetComplaintTicket by phone** — same fields as `/tickets/:id`, returns **latest** complaint for that number (use in Retell when the customer has no ticket id). |
| `GET` | `/tickets/:ticketId` | Single complaint by MongoDB id (when `complaintId` is known). |

### Examples

```bash
curl -s "http://localhost:8080/customers/+971501234567"
curl -s -X POST http://localhost:8080/tools/register-complaint-callback \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+971501234567","issueType":"billing","description":"Wrong charge on last bill"}'
```

## Deploy on Vercel

The repo includes [`api/index.js`](api/index.js) and [`vercel.json`](vercel.json). In **Vercel → Project → Settings → Environment Variables**, add **`MONGODB_URI`** (and optionally **`DEFAULT_CALLBACK_SLA_HOURS`**). Allow MongoDB Atlas access from the internet (`0.0.0.0/0` under Network Access for demos). Seed once from your laptop with the same URI: `npm run seed`.

If the function shows **crashed** or **503**: confirm `MONGODB_URI` is set for **Production** (and Preview if you test previews). In Vercel **Project → Settings → General**, set the framework preset to **Other** if the builder mistakenly detects Fastify from an older deploy.

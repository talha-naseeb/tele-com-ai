# Telecom demo backend (Fastify + MongoDB)

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

Optional: drop obsolete collections from older versions of this repo (`calls`, `transcripts`, `agentactions`, `newconnectionrequests`) if they exist in your database.

## Project layout

```text
src/
  server.js              # HTTP server entry (local dev / production Node)
  seed.js                # Loads data/seed-data.json into MongoDB
  app.js                 # Builds Fastify (also used by api/index.js on Vercel)
  config/index.js        # Environment config
  lib/db.js              # Mongoose connection
  models/index.js        # Schemas
  routes/index.js        # Route registration
  services/
    telecom.service.js   # Customer snapshot & complaints
  utils/
    priority.js          # Complaint priority helper
api/index.js             # Vercel serverless entry → src/app.js
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/customers/:phoneNumber` | Customer snapshot: profile, balance, bill, SIM, suggested add-on. Optional query `usagePreference` (e.g. `social`, `stream`) adjusts the suggestion. |
| `POST` | `/tools/register-complaint-callback` | Body: `{ "phoneNumber", "issueType", "description" }` |
| `GET` | `/tickets/:ticketId` | Complaint ticket by MongoDB id |

### Examples

```bash
curl -s "http://localhost:8080/customers/+971501234567"
curl -s -X POST http://localhost:8080/tools/register-complaint-callback \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+971501234567","issueType":"billing","description":"Wrong charge on last bill"}'
```

## Deploy on Vercel

The repo includes [`api/index.js`](api/index.js) and [`vercel.json`](vercel.json). Add **`MONGODB_URI`** (and optionally **`DEFAULT_CALLBACK_SLA_HOURS`**) in the Vercel project environment variables. Seed once from your machine using the same URI: `npm run seed`.

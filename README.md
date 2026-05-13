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

Re-run **`npm run seed`** after pulling updates so MongoDB matches the current `data/seed-data.json` (e.g. Syria +963 numbers, **`price_monthly`** / **SYP** on packages).

Server default: `http://localhost:8080` (override with **`PORT`**).

[`data/seed-data.json`](data/seed-data.json) holds **Syria-themed** demo data: **+963** mobile numbers, cities (Damascus, Aleppo, Homs, Latakia, …), **SYP** package prices, **customers**, **billing**, **complaints**, **packages**, **offers**, and **coverage** areas. After `npm run seed`, try the examples below.

### MongoDB Compass

Use the **same** URI as **`MONGODB_URI`**. In the connection string, the **database** is the path segment after the host — e.g. `…mongodb.net/telecom_demo?…` → open database **`telecom_demo`**. If you leave it out (`…mongodb.net/?…`), data often ends up in **`test`**, so you will not see it under a named DB.

After seeding, open these collections: **`customers`**, **`billing_records`**, **`complaints`**, **`connection_requests`** (created when leads are submitted), **`packages`**, **`offers`**, **`coverage_areas`**.

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
    catalog.service.js   # Packages, offers, coverage
  utils/
    priority.js          # Complaint priority helper
api/index.js             # Vercel serverless entry → src/app-factory.js
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `POST` | `/api/customer-snapshot` | Body: `phoneNumber`, optional `usagePreference` (`social`, `stream`, …). |
| `POST` | `/api/register-complaint` | Body: `phoneNumber`, `issueType`, `description`. Returns `complaintId` + callback ETA. |
| `POST` | `/api/new-connection` | Body: `fullName`, `phoneNumber`, `city`; optional `area`, `planPreference`, `notes`, `preferredLanguage`. Returns `connectionRequestId`. |
| `POST` | `/api/complaint-ticket` | Body: `phoneNumber`. Latest ticket for that line. |
| `POST` | `/api/list-complaints` | Body: `phoneNumber`. All complaints newest first. |
| `POST` | `/api/ticket-by-id` | Body: `ticketId` (Mongo ObjectId). Single complaint by id. |
| `POST` | `/api/packages` | Body (optional): `type`, `category`. |
| `POST` | `/api/latest-offers` | Active promotions (no body). |
| `POST` | `/api/coverage` | Body: `city` (required), optional `area`, `serviceType` (`fiber`, `5g`, `4g`). |

Legacy `GET` routes (`/packages`, `/offers`, `/coverage`, `/customers/:phoneNumber`, `/complaints/by-phone/:phoneNumber`, `/tickets/by-phone/:phoneNumber`, `/tickets/:ticketId`) still work for direct browser / curl testing.

### Retell tool names

Full mapping is in [docs/retell-apis.md](docs/retell-apis.md). Copy the **voice agent system prompt** from [docs/voice-agent-prompt.md](docs/voice-agent-prompt.md) into Retell.

| Retell function name | POST path |
| --- | --- |
| `customer_snapshot_init` | `POST /api/customer-snapshot` |
| `register_complaint_init` | `POST /api/register-complaint` |
| `new_connection_init` | `POST /api/new-connection` |
| `get_complaint_ticket_init` | `POST /api/complaint-ticket` |
| `list_complaints_init` | `POST /api/list-complaints` |
| `get_ticket_by_id_init` | `POST /api/ticket-by-id` |
| `get_packages_init` | `POST /api/packages` |
| `get_latest_offers_init` | `POST /api/latest-offers` |
| `check_coverage_init` | `POST /api/coverage` |

### Examples

```bash
curl -s "http://localhost:8080/health"
curl -s -X POST http://localhost:8080/api/customer-snapshot \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963941112233","usagePreference":"social"}'
curl -s -X POST http://localhost:8080/api/packages \
  -H "Content-Type: application/json" \
  -d '{"type":"prepaid","category":"social"}'
curl -s -X POST http://localhost:8080/api/latest-offers
curl -s -X POST http://localhost:8080/api/coverage \
  -H "Content-Type: application/json" \
  -d '{"city":"Damascus","area":"Mazzeh","serviceType":"fiber"}'
curl -s -X POST http://localhost:8080/api/register-complaint \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+963951234567","issueType":"billing","description":"Wrong charge on last bill"}'
curl -s -X POST http://localhost:8080/api/new-connection \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Sara Ali","phoneNumber":"+963958887766","city":"Aleppo","area":"Aziziyah","planPreference":"postpaid","notes":"Home fiber interest"}'
```

## Deploy on Vercel

The repo includes [`api/index.js`](api/index.js) and [`vercel.json`](vercel.json). In **Vercel → Project → Settings → Environment Variables**, add **`MONGODB_URI`** (and optionally **`DEFAULT_CALLBACK_SLA_HOURS`**). Allow MongoDB Atlas access from the internet (`0.0.0.0/0` under Network Access for demos). Seed once from your laptop with the same URI: `npm run seed`.

**Build step:** the `build` script in `package.json` is a no-op so Vercel’s default `npm run build` succeeds (this project has no compile step).

**Deploy time:** most of the wait is Vercel cloning the repo, running **`npm ci`** (uses `package-lock.json` for a fast, cacheable install), and bundling the Node function — not your app “compiling.” A **cold** first request after deploy can feel slow because MongoDB must connect; later requests reuse the warm function when possible.

If the function shows **crashed** or **503**: confirm `MONGODB_URI` is set for **Production** (and Preview if you test previews). In Vercel **Project → Settings → General**, set the framework preset to **Other** if the builder mistakenly detects Fastify from an older deploy.

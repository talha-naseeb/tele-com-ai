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

[`data/seed-data.json`](data/seed-data.json) holds demo **customers**, **billing**, **complaints**, **packages**, **offers**, and **coverage** areas. After `npm run seed`, try the examples below.

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
| `POST` | `/customers/snapshot` | **Preferred for agents.** Body: `phoneNumber`, optional `usagePreference` (`social`, `stream`, …). Same response as GET variant. |
| `GET` | `/customers/:phoneNumber` | Customer snapshot (optional query `usagePreference`). |
| `POST` | `/tools/register-complaint-callback` | Body: `{ "phoneNumber", "issueType", "description" }`. Saves **`phone_number`** on the ticket (canonical `+digits`) and returns **`phoneNumber`** plus **`complaintId`** for Retell variables. |
| `POST` | `/tools/new-connection-callback` | Body: **`fullName`**, **`phoneNumber`**, **`city`**; optional **`area`**, **`planPreference`**, **`notes`**, **`preferredLanguage`** (`en` \| `ar`). Stores a new-line lead in **`connection_requests`**; returns **`connectionRequestId`** and callback ETA. |
| `POST` | `/complaints/by-phone` | Body: `phoneNumber`. List complaints for that line (newest first). |
| `GET` | `/complaints/by-phone/:phoneNumber` | Same as POST; path carries the number. |
| `POST` | `/tickets/by-phone` | Body: `phoneNumber`. Latest ticket for that line (same shape as ticket-by-id). |
| `GET` | `/tickets/by-phone/:phoneNumber` | Same as POST. |
| `POST` | `/tickets/lookup` | Body: `ticketId` (Mongo ObjectId). Single complaint by id. |
| `GET` | `/tickets/:ticketId` | Same as POST lookup. |
| `POST` | `/packages` | Body (optional): `type`, `category` — same filters as GET query. |
| `GET` | `/packages` | Plan catalog: query `type`, `category`. |
| `POST` | `/offers` | Active promotions (no body). |
| `GET` | `/offers` | Same as POST. |
| `POST` | `/coverage` | Body: **`city`** (required), optional `area`, `serviceType` (`fiber`, `5g`, `4g`). |
| `GET` | `/coverage` | Same fields as query parameters (legacy). |

### Retell tool names (recommended)

Full mapping (POST bodies and legacy GET) is in [docs/retell-apis.md](docs/retell-apis.md). Copy the **voice agent system prompt** from [docs/voice-agent-prompt.md](docs/voice-agent-prompt.md) into Retell.

| Retell function name | Preferred (POST + JSON) |
| --- | --- |
| `customer_snapshot_init` | `POST /customers/snapshot` |
| `register_complaint_init` | `POST /tools/register-complaint-callback` |
| `new_connection_init` | `POST /tools/new-connection-callback` |
| `get_complaint_ticket_init` | `POST /tickets/by-phone` |
| `list_complaints_init` | `POST /complaints/by-phone` |
| `get_ticket_by_id_init` | `POST /tickets/lookup` |
| `get_packages_init` | `POST /packages` |
| `get_latest_offers_init` | `POST /offers` |
| `check_coverage_init` | `POST /coverage` |

### Examples

```bash
curl -s "http://localhost:8080/customers/+971501112233"
curl -s -X POST http://localhost:8080/customers/snapshot \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+971501112233","usagePreference":"social"}'
curl -s -X POST http://localhost:8080/packages \
  -H "Content-Type: application/json" \
  -d '{"type":"prepaid","category":"social"}'
curl -s -X POST http://localhost:8080/offers
curl -s -X POST http://localhost:8080/coverage \
  -H "Content-Type: application/json" \
  -d '{"city":"Dubai","area":"Dubai Marina","serviceType":"fiber"}'
curl -s -X POST http://localhost:8080/tools/register-complaint-callback \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+971501234567","issueType":"billing","description":"Wrong charge on last bill"}'
curl -s -X POST http://localhost:8080/tools/new-connection-callback \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Sara Ali","phoneNumber":"+971509998877","city":"Dubai","area":"Marina","planPreference":"postpaid","notes":"Home fiber interest"}'
```

## Deploy on Vercel

The repo includes [`api/index.js`](api/index.js) and [`vercel.json`](vercel.json). In **Vercel → Project → Settings → Environment Variables**, add **`MONGODB_URI`** (and optionally **`DEFAULT_CALLBACK_SLA_HOURS`**). Allow MongoDB Atlas access from the internet (`0.0.0.0/0` under Network Access for demos). Seed once from your laptop with the same URI: `npm run seed`.

If the function shows **crashed** or **503**: confirm `MONGODB_URI` is set for **Production** (and Preview if you test previews). In Vercel **Project → Settings → General**, set the framework preset to **Other** if the builder mistakenly detects Fastify from an older deploy.

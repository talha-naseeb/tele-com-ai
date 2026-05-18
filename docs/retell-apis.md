# Retell AI — HTTP Tool Configuration (SyriaTel Demo)

Use your public base URL, e.g. `https://your-project.vercel.app`.

---

## Authentication

### Production (recommended)

Set **`RETELL_API_KEY`** in Vercel / `.env` to your Retell API key. The server verifies each request using Retell’s **`x-retell-signature`** header and the **exact raw JSON body** (do not re-serialize JSON client-side after signing).

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `x-retell-signature` | Provided by Retell on signed tool/webhook requests |

You do **not** send `x-api-key` when signature verification is enabled. Configure signing in the Retell dashboard per their [secure webhook](https://docs.retellai.com/features/secure-webhook) / tool documentation.

### Local development

If **`RETELL_API_KEY`** is **unset**, the server optionally accepts a shared secret instead:

| Header | Value |
| --- | --- |
| `x-api-key` | Your **`API_SECRET_KEY`** value from `.env` |

If neither env var is set, `/api/*` is open (convenient for local curls without secrets).

---

## How Retell sends tool calls

Retell wraps every tool call as:
```json
{
  "call": { "call_id": "...", "from_number": "+963941112233", "to_number": "+963900000000" },
  "name": "customer_snapshot_init",
  "args": { "phoneNumber": "+963941112233" }
}
```
The server verifies the signature on this **full** payload (when `RETELL_API_KEY` is set), then unwraps **`args`** into the request body for handlers. It keeps **`call`** on `req.retellCall` and compares **`call.from_number`** to any **`phoneNumber`** in `args` so a caller cannot impersonate another line.

Endpoints that do not carry a subscriber phone (`/api/packages`, `/api/latest-offers`, `/api/coverage`) rely on signature verification only; **`POST /api/ticket-by-id`** checks that the ticket belongs to the verified caller’s number after lookup.

---

## Tools

### 1. `customer_snapshot_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/customer-snapshot` |
| Body | **`phoneNumber`** (string, required), **`usagePreference`** (optional: `general`, `social`, `chat`, `stream`, `heavy`) |

```http
POST /api/customer-snapshot
Content-Type: application/json
x-api-key: your-secret

{ "phoneNumber": "+963941112233", "usagePreference": "social" }
```

Returns: `found`, `customer` (name, city, planName), `balance`, `bill`, `sim`, `suggestedDataPack`.

---

### 2. `register_complaint_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/register-complaint` |
| Body | **`phoneNumber`** (≥8 chars), **`issueType`** (≥3 chars), **`description`** (≥5 chars) |

```http
POST /api/register-complaint
Content-Type: application/json
x-api-key: your-secret

{ "phoneNumber": "+963941112233", "issueType": "No network signal", "description": "No signal since yesterday morning in Mazzeh area." }
```

Returns: `complaintId`, `phoneNumber`, `status`, `callbackEtaHours`, `callbackMessage`.

---

### 3. `get_complaint_ticket_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/complaint-ticket` |
| Body | **`phoneNumber`** (string, required) |

```http
POST /api/complaint-ticket
Content-Type: application/json
x-api-key: your-secret

{ "phoneNumber": "+963941112233" }
```

Returns: latest ticket for that line, or **404** if none found.

---

### 4. `list_complaints_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/list-complaints` |
| Body | **`phoneNumber`** (string, required) |

```http
POST /api/list-complaints
Content-Type: application/json
x-api-key: your-secret

{ "phoneNumber": "+963941112233" }
```

Returns: `count`, `complaints[]` (newest first, up to 25).

---

### 5. `get_ticket_by_id_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/ticket-by-id` |
| Body | **`ticketId`** — MongoDB ObjectId (24 hex chars), explicitly provided by the customer |

```http
POST /api/ticket-by-id
Content-Type: application/json
x-api-key: your-secret

{ "ticketId": "6642a1b2c3d4e5f678901234" }
```

Returns: ticket detail (includes **`phoneNumber`** when stored on the complaint) or **404** if not found. **403** if the verified caller’s line does not match that ticket’s number.

---

### 6. `get_packages_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/packages` |
| Body | **`type`** (optional: `prepaid`, `postpaid`, `data`), **`category`** (optional: `gaming`, `streaming`, `social`) |

```http
POST /api/packages
Content-Type: application/json
x-api-key: your-secret

{ "type": "prepaid" }
```

Returns: `count`, `packages[]` — real SyriaTel plans including Yahala Classic, Yahala Thwani, Yahala Shabab, Postpaid Monthly, long-term plans, Social Pack, and 3-Hour Surf.

---

### 7. `get_latest_offers_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/latest-offers` |
| Body | _(none required)_ |

```http
POST /api/latest-offers
Content-Type: application/json
x-api-key: your-secret

{}
```

Returns: `count`, `offers[]` — active promotions (Happy Friday, Shukran Points, iShow Gold 40% Off, eSIM).

---

### 8. `check_coverage_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/coverage` |
| Body | **`city`** (required — e.g. Damascus, Aleppo, Homs, Latakia, Tartus, Hama, Deir ez-Zor), **`area`** (optional), **`serviceType`** (optional: `fiber`, `4g`, `5g`) |

```http
POST /api/coverage
Content-Type: application/json
x-api-key: your-secret

{ "city": "Damascus", "area": "Mazzeh", "serviceType": "fiber" }
```

Returns `found`, `fiber_available`, `five_g_available`, `four_g_available`, `notes`.
Returns **400** if `city` is missing or contains an unfilled `{{placeholder}}`.

---

### 9. `new_connection_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/api/new-connection` |
| Body | **`fullName`** (≥2 chars), **`phoneNumber`** (≥8 chars, `+963…` format), **`city`** (required). Optional: **`area`**, **`planPreference`** (e.g. prepaid, postpaid, fiber), **`notes`**, **`preferredLanguage`** (`en` \| `ar`) |

```http
POST /api/new-connection
Content-Type: application/json
x-api-key: your-secret

{
  "fullName": "Ahmad Al-Hassan",
  "phoneNumber": "+963941112233",
  "city": "Damascus",
  "area": "Mazzeh",
  "planPreference": "postpaid",
  "preferredLanguage": "ar"
}
```

Returns: `connectionRequestId`, `phoneNumber`, `fullName`, `city`, `status`, `callbackEtaHours`, `callbackMessage`.

---

## Retell Dashboard Checklist

For each tool above, set in the Retell dashboard:

1. **Function name** — exact name from the list (e.g. `customer_snapshot_init`)
2. **Method** — `POST`
3. **URL** — `https://your-project.vercel.app` + path (e.g. `/api/customer-snapshot`)
4. **Authentication** — Prefer **`RETELL_API_KEY`** + Retell’s **`x-retell-signature`** on the raw JSON body. For dev without that key, use **Custom Headers**: `Content-Type: application/json` and `x-api-key: <your API_SECRET_KEY>`.
5. **Parameters** — define each body field as described above; mark required fields accordingly
6. **Timeout** — set to at least `10000ms` (10 seconds) to allow for DB lookup

---

## Health check (optional)

`GET /health` — returns `{ ok: true }`. Not required by the agent but useful for uptime monitoring.

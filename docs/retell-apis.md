# Retell AI — HTTP Tool Configuration (SyriaTel Demo)

Use your public base URL, e.g. `https://your-project.vercel.app`.

---

## Authentication

Every `/api/*` request must include the shared secret header:

| Header | Value |
| --- | --- |
| `x-api-key` | Your `API_SECRET_KEY` value from `.env` / Vercel environment variables |

Configure this in the Retell dashboard under each tool's **Custom Headers** section.

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
The server automatically unwraps `args` into the request body. The `call.from_number` is used server-side to verify the caller only accesses their own data.

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

Returns: ticket detail or **404** if not found.

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
4. **Custom Headers**:
   - `Content-Type: application/json`
   - `x-api-key: <your API_SECRET_KEY>`
5. **Parameters** — define each body field as described above; mark required fields accordingly
6. **Timeout** — set to at least `10000ms` (10 seconds) to allow for DB lookup

---

## Health check (optional)

`GET /health` — returns `{ ok: true }`. Not required by the agent but useful for uptime monitoring.

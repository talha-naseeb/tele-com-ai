# Retell AI — HTTP tools (Macquires / Syntax-style demo)

Use your public base URL (ngrok or Vercel), e.g. `https://abc123.ngrok-free.app` or `https://your-project.vercel.app`.

**Prefer POST + JSON body** for tools where Retell fills parameters from the conversation — use **GET** only if you rely on query strings.

**Custom function names in Retell must match what you type in the dashboard** — names below use the `*_init` convention.

### Path vs query vs body

| Kind | Where | Notes |
| --- | --- | --- |
| Path param | `{phoneNumber}`, `{ticketId}` | Encode `+` as **`%2B`** in URLs if the tool sends the path literally (e.g. `%2B963941112233`). |
| Query param | `?city=Damascus&area=...` | **GET only.** Encode spaces as **`%20`** (e.g. `city=Deir%20ez-Zor`). |
| JSON body | `POST` endpoints below | **Recommended for agents.** Same fields as queries where applicable. |

Retell may send a wrapper `{ "call", "name", "args" }`; the server **unwraps `args`** so handlers still see flat fields (`city`, `phoneNumber`, etc.).

Duplicate query keys may arrive as arrays; the API accepts the **first** value.

---

## 1. `customer_snapshot_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/customers/snapshot` |
| Body | **`phoneNumber`** (string, ≥8 digits), **`usagePreference`** (optional) — `general` (default), `social`, `chat`, `stream`, `heavy` |
| **Legacy** | `GET` `/customers/{phoneNumber}` — optional query **`usagePreference`** |

Example POST:

```http
POST /customers/snapshot
Content-Type: application/json

{ "phoneNumber": "+963941112233", "usagePreference": "social" }
```

Returns: `found`, `customer`, `balance`, `bill`, `sim`, `suggestedDataPack`.

---

## 2. `register_complaint_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/tools/register-complaint-callback` |
| Headers | `Content-Type: application/json` |
| Body | **`phoneNumber`** (string, ≥8 chars), **`issueType`** (≥3), **`description`** (≥5) |

Returns: `complaintId`, `phoneNumber`, `status`, `callbackEtaHours`, `callbackMessage`.

---

## 3. `new_connection_init`

| | |
| --- | --- |
| Method | `POST` |
| Path | `/tools/new-connection-callback` |
| Headers | `Content-Type: application/json` |
| Body | **`fullName`** (≥2 chars), **`phoneNumber`** (≥8, contact for callback; use **+963…** for Syria), **`city`** (e.g. Damascus, Aleppo, Homs). Optional: **`area`**, **`planPreference`** (e.g. prepaid, postpaid, fiber), **`notes`**, **`preferredLanguage`** (`en` \| `ar`, default `en`). |

Returns: `connectionRequestId`, `phoneNumber`, `fullName`, `city`, optional `area`, optional `planPreference`, `status`, `callbackEtaHours`, `callbackMessage`.

Persists to MongoDB collection **`connection_requests`**.

---

## 4. `get_complaint_ticket_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/tickets/by-phone` |
| Body | **`phoneNumber`** (same rules as customer snapshot) |
| **Legacy** | `GET` `/tickets/by-phone/{phoneNumber}` |

Returns: latest ticket for that line (same shape as ticket-by-id), or **404** if none.

---

## 5. `list_complaints_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/complaints/by-phone` |
| Body | **`phoneNumber`** |
| **Legacy** | `GET` `/complaints/by-phone/{phoneNumber}` |

Returns: `count`, `complaints[]` (newest first).

---

## 6. `get_ticket_by_id_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/tickets/lookup` |
| Body | **`ticketId`** — MongoDB ObjectId (24 hex chars), not `{{ticketId}}`. |
| **Legacy** | `GET` `/tickets/{ticketId}` |

---

## 7. `get_packages_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/packages` |
| Body | **`type`** (optional) — `prepaid`, `postpaid`, `internet`, `data` |
| Body | **`category`** (optional) — `gaming`, `streaming`, `social` (matches package tags) |
| **Legacy** | `GET` `/packages?type=prepaid&category=social` |

Returns: `count`, `packages[]`.

---

## 8. `get_latest_offers_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/offers` or `GET` `/offers` |
| Body | _(none)_ |

No parameters. Returns: `count`, `offers[]` (active, not past `valid_until`).

---

## 9. `check_coverage_init`

| | |
| --- | --- |
| **Recommended** | `POST` `/coverage` |
| Body | **`city`** (required) — must match seeded cities (e.g. Damascus, Aleppo, Homs, Latakia, Tartus, Deir ez-Zor, …). |
| Body | **`area`** (optional) — narrows when multiple zones exist for the same city. |
| Body | **`serviceType`** (optional) — `fiber`, `5g`, `4g`; when set, response may include **`service_summary`**. |
| **Legacy** | `GET` `/coverage?city=Damascus&area=Mazzeh&serviceType=fiber` |

Example POST:

```http
POST /coverage
Content-Type: application/json

{ "city": "Damascus", "area": "Mazzeh", "serviceType": "fiber" }
```

**400** if `city` is missing or a literal `{{city}}` / `{{area}}` / `{{serviceType}}` placeholder was sent.

Returns: `found`, `fiber_available`, `five_g_available`, `four_g_available`, `notes`, optional `service_summary`.

---

## Health (optional)

`GET /health` — liveness only; not required for the agent.

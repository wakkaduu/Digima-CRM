# Payment Portal — Backend API Reference

Internal payment automation portal: **Sales** submit payment proofs against QuickBooks Online (QBO) estimates, **Admins** approve or reject them, and approval posts the payment to QBO.

- **Stack:** Node ≥ 18.18, Express 4, TypeScript, Prisma (PostgreSQL), Zod, S3-compatible object storage (receipts), `intuit-oauth` (QBO)
- **Base URL (dev):** `http://localhost:3000` — all routes are under `/api`
- **Format:** JSON, except `POST /api/payments/submit` (multipart) and `GET /api/payments/:id/receipt` (image) and the QBO OAuth redirects
- **Frontend:** served separately (Vite on `:5173`, proxies `/api` here)

---

## Contents

1. [Conventions](#1-conventions)
2. [Authentication & sessions](#2-authentication--sessions)
3. [Endpoint summary](#3-endpoint-summary)
4. [Health](#4-health)
5. [Auth endpoints](#5-auth-endpoints)
6. [QuickBooks connection (admin)](#6-quickbooks-connection-admin)
7. [QuickBooks estimates](#7-quickbooks-estimates)
8. [Payments — Sales](#8-payments--sales) (8b history and detail, 8c [customers and estimates](#8c-customers-and-estimates-crm-modules))
9. [Payments — Admin](#9-payments--admin)
10. [Error codes](#10-error-codes)
11. [Data model](#11-data-model)
12. [Configuration](#12-configuration)
13. [Operations](#13-operations)

---

## 1. Conventions

### Error format

Every error uses one shape:

```json
{ "error": { "message": "Human-readable summary", "details": { "code": "DUPLICATE_REFERENCE" } } }
```

- `message` — safe to display. On `500` in production it is replaced with `"Internal server error"`.
- `details` — optional. Either an object with a machine-readable `code` (see [Error codes](#10-error-codes)), a Zod field-error map (`{ "amount": ["..."] }`, only on `POST /payments/submit` validation failures), or QBO fault info on `502`.
- Unknown routes return `404` with message `Route not found: <METHOD> <url>`.

> There is no `requestId` in errors yet; correlate using server logs (morgan).

### Status codes used

| Code | Meaning here |
|---|---|
| 200 / 201 | Success / payment created |
| 400 | Malformed input, bad id, bad upload, invalid OAuth state |
| 401 | Not signed in, or your QuickBooks connection expired (`QBO_REAUTH_REQUIRED`) |
| 403 | Wrong role, not your receipt |
| 404 | Payment / receipt / estimate / route not found |
| 409 | Conflict: duplicate payment, already processed, QBO not connected |
| 422 | Business-rule violation (amounts, invalid receiver, rejected estimate) |
| 429 | Sign-in rate limit exceeded |
| 502 | QuickBooks or receipt storage upstream failure |

### Money and dates

- Amounts are **strings with up to 2 decimals** on input (`"24625.00"`; commas are stripped, max 12 integer digits). Output amounts from the DB (`amountSubmitted`, `finalAmount`) are Prisma `Decimal`s serialised as **strings**; QBO figures (`totalAmount`, `pendingAmount`, `approvedAmount`, `fee`, `unappliedCredit`) are **numbers**.
- Timestamps are ISO 8601 UTC. `receivedOn` is a date-only value (`YYYY-MM-DD`), validated against today in `Asia/Manila`.
- IDs of payments and users are UUIDs; QBO ids are numeric strings.

### Request limits

JSON body ≤ 100 kb. Receipt upload ≤ 5 MB. Security headers via Helmet (CSP allows images from `'self'`, `data:` and `blob:` only). Responses are gzip-compressed.

---

## 2. Authentication & sessions

- **Sign in with QuickBooks** (Intuit OpenID Connect) is the only way in; there are no passwords. A successful sign-in creates a signed **cookie session** `pp_session` (`httpOnly`, `sameSite=lax`, `secure` in production, **8 h** lifetime).
- Browser clients must send credentials (`fetch(..., { credentials: 'include' })`) or use the Vite proxy so the cookie is same-origin. No CORS middleware is installed.
- There is **no CSRF token**; protection relies on `sameSite=lax` and JSON/multipart bodies. Keep that in mind if cross-site embedding is ever introduced.
- On every protected request the user is **re-read from the database**, so deactivation and role changes take effect immediately (a deactivated user's session is cleared).
- Roles: `sales`, `admin`, `superadmin`. Roles are **strict, not hierarchical** — each route lists who may call it. SuperAdmin manages accounts, sees reports and can read everything admins can read (all payments, receipts, customers, estimates), but does not submit or approve payments.
- **People join by invite link, not by email.** The production Intuit app only returns the verified Intuit id (`sub`), so accounts are linked to that id. A SuperAdmin adds `{name, email, role}` (`POST /api/users`; the email is only a label) and gets a one-time link `{FRONTEND_URL}/invite#<token>` (valid 7 days; the token is in the URL fragment so it never reaches server logs, and only its SHA-256 is stored). The person opens it (`POST /api/auth/invite`), signs in with QuickBooks, and their Intuit id is linked to the account. After that a plain sign-in works. An Intuit id nobody invited is refused. `POST /api/users/:id/invite` issues a replacement link (lost/expired, or a different Intuit login).
- **One company.** Only sign-ins from the QuickBooks company `QBO_REALM_ID` are accepted.
- **First SuperAdmin.** Leave `SUPERADMIN_QBO_SUB` empty, attempt one sign-in (it is refused and the log prints `unknown Intuit id <sub>`), put that value in `SUPERADMIN_QBO_SUB` and restart. That Intuit login always signs in as SuperAdmin (creating or repairing the account labelled `SUPERADMIN_EMAIL`), which also recovers a lockout.
- **Per-user QuickBooks tokens.** Every user's own QuickBooks tokens are stored (`qbo_tokens`, keyed by user) and every QuickBooks call runs as the signed-in user, so QuickBooks' own permissions and audit trail apply. Estimate and customer caches are per user. Tokens are deleted on logout and on deactivation.
- When a user's QuickBooks connection can no longer be renewed, QuickBooks routes return `401` with `details.code = "QBO_REAUTH_REQUIRED"`; the client must send the user through sign-in again.
- Rate limit: `/api/auth/qbo/login` — **30 requests / 15 min** per IP (`429` afterwards).

Guards used below: **Public** (no auth), **Auth** (any signed-in user), **Sales**, **Admin**, **SuperAdmin**, **Sales|Admin** (a combination; most read routes also admit SuperAdmin).

---

## 3. Endpoint summary

| Method | Path | Guard | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness check |
| GET | `/api/auth/qbo/login` | Public | Start "Sign in with QuickBooks" (redirect) |
| GET | `/api/auth/qbo/callback` | Public | Intuit redirects here; creates the session (redirect) |
| POST | `/api/auth/logout` | Public | Sign out (also deletes the user's QuickBooks tokens) |
| GET | `/api/auth/me` | Public | Current user or `null` |
| GET | `/api/auth/qbo/status` | Auth | The signed-in user's own QuickBooks connection |
| GET | `/api/users` | SuperAdmin | List accounts |
| POST | `/api/users` | SuperAdmin | Add a person; returns their one-time invite link |
| POST | `/api/users/:id/invite` | SuperAdmin | New invite link (replaces the old one) |
| POST | `/api/auth/invite` | Public | Check an invite link and remember it for the next sign-in |
| PATCH | `/api/users/:id` | SuperAdmin | Change name, role or active |
| GET | `/api/qbo/estimates` | Sales\|Admin | Search QBO estimates (`q`, `limit`) |
| GET | `/api/config/banks` | Sales\|Admin | Modes of payment + default fee % |
| GET | `/api/customers` | Sales\|Admin | QuickBooks customers with open estimates, balance, last payment (filtered, sorted, paged) |
| GET | `/api/customers/:id` | Sales\|Admin | One customer with summary figures |
| GET | `/api/estimates` | Sales\|Admin | Recent estimates of any status with payment progress (filtered, sorted, paged) |
| GET | `/api/estimates/:id` | Sales\|Admin | One estimate with line items and payment progress |
| POST | `/api/payments/submit` | Sales | Submit a payment with proof |
| GET | `/api/payments` | Sales\|Admin | Filtered, sorted, paged payment list (sales: own; admin: all) |
| GET | `/api/payments/counts` | Sales\|Admin | Navigation badge numbers |
| GET | `/api/payments/recent-estimates` | Sales | Estimates I submitted for most recently |
| GET | `/api/payments/receivers` | Sales\|Admin | Who can be "received by" / rep filter |
| GET | `/api/payments/mine` | Sales | My last 30 submissions |
| POST | `/api/payments/mine/seen` | Sales | Mark outcomes as read |
| GET | `/api/payments/:id` | Sales\|Admin | One payment with its audit trail |
| GET | `/api/payments/:id/receipt` | Sales\|Admin | Receipt image (`?w=` for a resized copy) |
| GET | `/api/payments/pending` | Admin | Pending approval queue |
| POST | `/api/payments/approve/:id` | Admin | Approve and post to QBO |
| POST | `/api/payments/reject/:id` | Admin | Reject |
| POST | `/api/payments/reject/:id/undo` | Admin | Undo a rejection (30 s window) |
| POST | `/api/payments/void/:id` | Admin | Reverse an approved payment in QBO |
| GET | `/api/estimates/:id/invoices` | Sales\|Admin | The estimate's QBO invoices: balance and paid |
| GET | `/api/payments/qbo-accounts` | Admin\|SuperAdmin | List QBO accounts (setup helper) |

---

## 4. Health

### `GET /api/health`
**200** `{ "ok": true }` — does not check the database or QBO.

---

## 5. Auth endpoints

### `POST /api/auth/logout`
**200** `{ "ok": true }`. Clears the session and deletes the user's stored QuickBooks tokens. Always succeeds.

### `GET /api/auth/me`
**200** `{ "user": { "id": "uuid", "name": "Jane", "email": "jane@company.com", "role": "sales" } }` or `{ "user": null }` when not logged in or deactivated. Use at app start to restore the session.

---

## 6. QuickBooks sign-in and connection

Each user's QBO tokens are stored in `qbo_tokens` (one row per user) and refreshed automatically (5-minute buffer; concurrent refreshes are de-duplicated per user). If Intuit rejects a refresh with `invalid_grant`, the row is deleted.

### `GET /api/auth/qbo/login`
Optional query `next=/some/path` (same-site paths only) is where to land after sign-in. Generates a random `state`, stores it in the session, and **302-redirects** to Intuit's authorize URL (scopes: `openid` and Accounting). Navigate the browser here; do not call with `fetch`.

### `GET /api/auth/qbo/callback`
Intuit redirects here (must match `QBO_REDIRECT_URI`). Validates `state` (constant-time compare), validates `code`/`state`/`realmId` (fixed shapes only; the raw query string is never passed to the OAuth library), exchanges the code, checks the company from the **signed ID token** (`realmid` must equal `QBO_REALM_ID`; the `realmId` in the URL is only an early exit because the browser can edit it), reads who signed in (`sub`) from the verified Intuit ID token, applies the invite link opened in this browser (if any), stores that user's tokens and starts the session. Always **302-redirects** to the frontend:

- success → `{FRONTEND_URL}{next}` (default `/`)
- failure → `{FRONTEND_URL}/login?error=<code>`

| `error` | Meaning |
|---|---|
| `access_denied` | The person cancelled at Intuit |
| `not_authorized` | This Intuit login was never invited (the log prints its id) |
| `invite_invalid` | The invite link is unknown, expired or already used |
| `already_linked` | The invite was opened with an Intuit login that already belongs to another account |
| `deactivated` | The account was deactivated |
| `wrong_company` | Signed in from a different QuickBooks company |
| `sign_in_failed` | Anything else (bad state, Intuit error) |

### `GET /api/auth/qbo/status`
The signed-in user's own connection. Query: `verify=true` (optional) also calls QBO `CompanyInfo`.

**200**
```json
{
  "connected": true,
  "realmId": "9341452",
  "accessTokenExpiresAt": "2026-10-16T05:00:00.000Z",
  "refreshTokenExpiresAt": "2027-01-24T04:00:00.000Z",
  "companyName": "Acme Inc",
  "verifyError": "…"
}
```
`connected: false` (no other fields) when never connected. `connected` is `false` once the refresh token has expired. `companyName` appears only with `verify=true` on success; `verifyError` only on failure.

---

## 7. QuickBooks estimates

### `GET /api/qbo/estimates` — Sales|Admin
Query:

| Param | Description |
|---|---|
| `q` | Case-insensitive substring match on estimate number or customer name |
| `refresh=true` | Bypass the 60 s in-memory cache |

Returns estimates with status `Pending`, `Accepted` or `Closed` (not `Rejected`) from the last `ESTIMATE_LOOKBACK_DAYS` (default 365). The whole list is returned — **no pagination**; filter with `q`.

**200**
```json
{
  "count": 1,
  "estimates": [{
    "id": "1234",
    "docNumber": "EST-0042",
    "customerId": "56",
    "customerName": "Acme Corp",
    "totalAmount": 24625,
    "txnDate": "2026-09-30",
    "expirationDate": null,
    "status": "Accepted",
    "currency": "PHP",
    "email": "billing@acme.com",
    "pendingAmount": 5000,
    "approvedAmount": 10000
  }]
}
```
`pendingAmount` / `approvedAmount` are sums of portal `amountSubmitted` for that estimate (so Sales can see what is already in flight).

Errors: `409` `QBO_NOT_CONNECTED`, `401` `QBO_REAUTH_REQUIRED`, `502` QuickBooks API error.

---

## 8. Payments — Sales

### `POST /api/payments/submit` — Sales
`Content-Type: multipart/form-data`

| Field | Required | Rules |
|---|---|---|
| `proof` (file) | yes | JPG / PNG / WebP, ≤ 5 MB, magic-byte checked |
| `estimateId` | yes | digits only; the QBO estimate id |
| `amount` | yes | > 0, ≤ 2 decimals, commas allowed |
| `bank` | yes | `BDO` \| `UnionBank` \| `Digima` \| `Happy Med` \| `Cash` |
| `receivedOn` | yes | `YYYY-MM-DD`, not in the future (Manila time) |
| `receivedById` | yes | UUID of an **active sales** user (see `/payments/receivers`) |
| `referenceNo` | no | Spaces removed, upper-cased; 4–60 chars if given. Ignored for `Cash` |
| `force` | no | `"true"` skips the soft duplicate warning |

Server flow: validate → check receiver → **re-fetch estimate from QBO** (customer data is never trusted from the client; rejected estimates refused) → duplicate checks → upload to the S3 bucket (original plus 400/800/1200 px copies) → save (image deleted if the DB write fails).

**201**
```json
{ "payment": { "id": "uuid", "status": "pending" } }
```

| Status | `details.code` | When |
|---|---|---|
| 400 | — (field map in `details`) | Validation failure, missing/invalid image |
| 404 | — | Estimate not found in QBO |
| 409 | `DUPLICATE_REFERENCE` | Same bank + reference number already pending/approved (hard block) |
| 409 | `DUPLICATE_PENDING` | Same estimate + amount + bank pending within 24 h (soft; resend with `force=true`) |
| 422 | `INVALID_RECEIVER` | Receiver missing, inactive, or not a sales user |
| 422 | — | Estimate was rejected in QuickBooks |

### `GET /api/payments/receivers` — Sales
**200** `{ "receivers": [{ "id": "uuid", "name": "Jane" }] }` — active sales users, sorted by name.

### `GET /api/payments/mine` — Sales
The caller's **30 most recent** submissions, newest first.

**200**
```json
{
  "unseenCount": 1,
  "payments": [{
    "id": "uuid",
    "customerName": "Acme Corp",
    "qboEstimateId": "1234",
    "qboEstimateNumber": "EST-0042",
    "amountSubmitted": "5000",
    "finalAmount": null,
    "bankDepositedTo": "BDO",
    "status": "pending",
    "rejectionReason": null,
    "createdAt": "2026-10-16T01:00:00.000Z",
    "receivedOn": "2026-10-15T00:00:00.000Z",
    "receivedBy": "Jane",
    "unseen": false
  }]
}
```
`unseen` is `true` when the payment is approved/rejected and the rep has not yet acknowledged it. `bankDepositedTo` is the enum key (`HappyMed`, not `Happy Med`).

### `POST /api/payments/mine/seen` — Sales
Marks all of the caller's approved/rejected payments as seen. **200** `{ "ok": true }`.

### `GET /api/payments/:id/receipt` — Sales|Admin
Streams the receipt image (`Content-Type: image/*`, `Cache-Control: private, max-age=3600`). The image is read server-side from a private S3 bucket (receipts submitted before the move may still be read from Cloudinary), so no storage link is ever exposed. Use it directly as an `<img src>`.

| Status | When |
|---|---|
| 400 | `:id` is not a UUID |
| 403 | Sales user requesting someone else's receipt |
| 404 | Payment not found |
| 502 | Receipt storage read failed or not an image |

---

## 8b. Payments — history, detail, counts, config (UI support)

### `GET /api/payments` — Sales|Admin
Server-side filtered, sorted, paged list. **Sales always get only their own rows** (the `rep` filter is ignored for them); admins get everyone's.

| Query | Rules |
|---|---|
| `status` | comma list of `pending`, `approved`, `rejected` (e.g. `approved,rejected` for history) |
| `q` | ≤ 100 chars; case-insensitive match on customer name or estimate number (admins also match reference no. and submitter name) |
| `rep` | user id (UUID) of the submitter (admin only) |
| `customerId`, `estimateId` | QuickBooks ids; only payments for that customer / estimate (sales still see only their own) |
| `bank` | enum key as returned in `bankDepositedTo` |
| `from`, `to` | `YYYY-MM-DD`, filter on submission date in Manila time; `to` is inclusive |
| `sort` | `createdAt` \| `amountSubmitted` \| `customerName` \| `status`, then `:asc` or `:desc`. Default `createdAt:desc` |
| `page`, `pageSize` | page ≥ 1; pageSize 1–100, default 25 |

**200** `{ "items": [...], "total": 132, "page": 1, "pageSize": 25 }`. Offset paging with a stable `id` tie-break. Items have the fields of `/mine` (sales) or `/pending` (admin) plus `reviewedBy`, `reviewedAt` and `thumbUrl`. Bad input → **400** with field errors.

### `GET /api/payments/:id` — Sales|Admin
One payment (sales: own only, else **403**; unknown id **404**). The list-item fields plus:

```json
{ "payment": {
  "fee": 37.5,
  "events": [
    { "type": "submitted", "at": "…", "by": "Sam" },
    { "type": "approved",  "at": "…", "by": "Ana" }
  ],
  "qbo": { "paymentId": "789", "depositId": "790", "customerId": "56" }
} }
```
`events` is rebuilt from the row (submit, then approve or reject with the reason as `note`); there is no separate audit table. `qbo` is admin only.

### `GET /api/payments/counts` — Sales|Admin
Tiny badge endpoint: admin → `{ "pending": 7 }`, sales → `{ "unseen": 2 }`. Poll this instead of the lists.

### `GET /api/payments/recent-estimates` — Sales
The estimates the caller most recently submitted payments for (up to 5, newest first, current QuickBooks data with portal totals): `{ "estimates": [ …same shape as /qbo/estimates… ] }`. Estimates that are no longer pickable are skipped.

### `GET /api/config/banks` — Sales|Admin
```json
{ "banks": [{ "id": "Happy Med", "key": "HappyMed", "label": "Happy Med", "referenceNumber": "optional" }, …],
  "defaultFeePercent": 1.5 }
```
`id` is what to send as `bank` on submit; `key` is what payments report in `bankDepositedTo`; `referenceNumber` is `none` for Cash. `defaultFeePercent` comes from `DEFAULT_FEE_PERCENT`.

### `POST /api/payments/reject/:id/undo` — Admin
Puts a payment rejected by **the same admin** back in the queue, **within 30 seconds** and only if nothing was posted to QuickBooks. One atomic update. **200** `{ "ok": true }`; otherwise **409** `UNDO_NOT_AVAILABLE`. `POST /reject/:id` now returns `{ "ok": true, "undoUntil": "<ISO time>" }`.

### Idempotent submit
`POST /api/payments/submit` accepts an optional `Idempotency-Key` header (8–100 chars of letters, digits, `-`, `_`; a UUID works). Same key from the same user: the first request creates the payment, a repeat returns **200** `{ "payment": {…}, "replayed": true }` with header `Idempotent-Replayed: true` and creates nothing. The same key for a different estimate or amount → **422** `IDEMPOTENCY_KEY_REUSED`. Concurrent duplicates are settled by a unique index `(submitted_by_id, idempotency_key)`.

### Estimates search
`GET /api/qbo/estimates?q=&limit=` — `limit` (1–50) caps the result and `total` reports all matches: `{ "count": 20, "total": 87, "estimates": [...] }`. Without `limit` every match is returned, as before. Portal totals are only looked up for the rows returned.

### Resized receipts
`GET /api/payments/:id/receipt?w=800` returns a resized copy (width 400, 800 or 1200; never upscaled; WebP, generated once at upload time). Any other width → **400**. List responses carry `thumbUrl` (`?w=800`); `proofImageUrl` stays the original.

### QuickBooks status additions
`GET /api/auth/qbo/status` now also returns `needsReauth` (a connection exists but its refresh token expired), `expiresInDays`, and `lastVerifiedAt` (set whenever `?verify=true` succeeds; stored in `qbo_tokens.last_verified_at`).

---

## 8c. Customers and estimates (CRM modules)

Read-only views over QuickBooks, joined with the portal's payments. Customers are **QuickBooks-synced only**: there is no create/update endpoint (creating customers in the CRM is out of scope until decided, see `UI_REDESIGN_TASKS.md` open question 3b). Lists are cached on the server for 60 s; a QuickBooks outage answers `409 QBO_NOT_CONNECTED` / `401 QBO_REAUTH_REQUIRED` like the other QuickBooks routes. Bad input → **400** with the first problem as the message.

### `GET /api/customers` — Sales|Admin
| Query | Rules |
|---|---|
| `q` | ≤ 100 chars; case-insensitive match on name, company, email, phone |
| `status` | `active` \| `inactive` (QuickBooks `Active` flag) |
| `sort` | `name` \| `openEstimates` \| `balance` \| `lastPayment`, then `:asc` or `:desc`. Default `name:asc` |
| `page`, `pageSize` | page ≥ 1; pageSize 1–100, default 25 |

**200** `{ items, total, page, pageSize, counts: { all, active, inactive } }`. `counts` follow the search but ignore `status` (for the tabs). Each item: `id, name, company, email, phone, active, balance` (QuickBooks open balance), `openEstimates` (Pending + Accepted, within the lookback window), `lastPaymentAt` (latest portal submission, or `null`).

### `GET /api/customers/:id` — Sales|Admin
**200** `{ customer, lookbackDays }`: the item fields plus `paidToDate` (approved portal payments), `pendingPayments` (count awaiting review) and `outstanding` (= QuickBooks balance). **404** if QuickBooks has no such customer.

### `GET /api/estimates` — Sales|Admin
Estimates dated within `ESTIMATE_LOOKBACK_DAYS`, **any status** (the picker endpoint `/api/qbo/estimates` still returns only payable ones).

| Query | Rules |
|---|---|
| `q` | ≤ 100 chars; estimate number or customer name |
| `status` | `Pending` \| `Accepted` \| `Closed` \| `Rejected` |
| `customerId` | QuickBooks customer id |
| `sort` | `date` \| `number` \| `customer` \| `total`, then `:asc` or `:desc`. Default `date:desc` |
| `page`, `pageSize` | as above |

**200** `{ items, total, page, pageSize, counts, lookbackDays }`. `counts` is `{ all, Pending, Accepted, Closed, Rejected }` ignoring the `status` filter. Items carry the estimate fields plus `pendingAmount` and `approvedAmount` (portal payments, all reps).

### `GET /api/estimates/:id` — Sales|Admin
**200** `{ estimate }`: the list fields plus `lines` (`description, quantity, amount`), `memo` and `linkedInvoiceIds`. Works for estimates outside the lookback window. **404** if QuickBooks has no such estimate.

### `GET /api/estimates/:id/invoices` — Sales|Admin
What QuickBooks says about the invoices created from the estimate (read live, not cached).
**200** `{ "invoices": [{ "id", "docNumber", "txnDate", "dueDate", "total", "balance" }], "total", "balance", "paid" }`. `invoices` is empty (and the totals 0) until someone creates the invoice in QuickBooks. `paid` is `total - balance`, so it includes payments recorded directly in QuickBooks. **404** if QuickBooks has no such estimate; **502** if QuickBooks cannot be reached. The UI treats the answer as extra information: it warns on submit/approve when there is no invoice, the invoice is already paid, or the amount is above the balance.

---

## 9. Payments — Admin

### `GET /api/payments/pending` — Admin
All pending payments, **oldest first**, unpaginated.

**200**
```json
{
  "count": 1,
  "payments": [{
    "id": "uuid",
    "customerName": "Acme Corp",
    "qboEstimateId": "1234",
    "qboEstimateNumber": "EST-0042",
    "qboCustomerId": "56",
    "amountSubmitted": "5000",
    "finalAmount": null,
    "bankDepositedTo": "BDO",
    "referenceNo": "ABC1234",
    "receivedOn": "2026-10-15T00:00:00.000Z",
    "receivedBy": "Jane",
    "receivedById": "uuid",
    "submittedBy": "Jane",
    "submittedById": "uuid",
    "status": "pending",
    "createdAt": "…",
    "updatedAt": "…",
    "qboPaymentId": null,
    "qboDepositId": null,
    "approvedBy": null,
    "approvedAt": null,
    "rejectionReason": null,
    "salesSeenAt": null,
    "proofImageUrl": "/api/payments/<id>/receipt",
    "qboPartiallyPosted": false
  }]
}
```
Rows are the same admin shape as `/payments` items (internal columns such as the Cloudinary public id, `salesSeenAt` and QuickBooks ids are no longer included; use `GET /payments/:id` for those). `proofImageUrl` is the portal receipt endpoint, `thumbUrl` a resized copy. `qboPartiallyPosted` is `true` when an earlier approval attempt created the QBO payment but did not finish (see approve).

### `POST /api/payments/approve/:id` — Admin
Body (JSON):
```json
{ "finalAmount": "24625.00" }
```
`finalAmount` is the net amount after any bank/QR fee: must be `> 0` and `≤ amountSubmitted`. The difference is posted to QBO as a fee (`QBO_BANK_FEE_ACCOUNT_ID`); the payment is deposited to the account mapped from the bank (`QBO_DEPOSIT_ACCOUNT_*`).

**Dated by when the money arrived:** the QBO Payment and Deposit use the payment's `receivedOn` as their transaction date (not the approval date). Older rows without `receivedOn` fall back to today in `Asia/Manila`.

**Retry-safe:** if a previous attempt already created the QBO payment (`qboPaymentId` set), the stored `finalAmount` is reused and the body value is ignored.

**200**
```json
{
  "payment": { "id": "uuid", "status": "approved", "finalAmount": "24625", "approvedBy": "Admin", "qboPaymentId": "789", "qboDepositId": "790", "…": "…" },
  "qbo": { "paymentId": "789", "depositId": "790", "fee": 375, "unappliedCredit": 0 }
}
```

| Status | When |
|---|---|
| 400 | Bad id or body |
| 404 | Payment not found |
| 409 | Already approved/rejected, or already being processed (in-process lock) |
| 422 | `finalAmount` ≤ 0 or greater than submitted |
| 401/409/502 | QBO not connected / expired / API error |

> The in-flight lock is per process memory. With more than one server instance, concurrent approvals are not blocked by it (the unique `qboPaymentId` and status check are the remaining guards).

### `POST /api/payments/reject/:id` — Admin
Body: `{ "reason": "Amount does not match the bank statement" }` (3–300 chars).
**200** `{ "ok": true }`.

| Status | When |
|---|---|
| 400 | Bad id or reason |
| 404 | Payment not found |
| 409 | Already processed, or already partly posted to QBO (void in QBO first, or finish approving) |

The status flip is atomic (`pending` → `rejected` only), so double-rejects are safe.

### `POST /api/payments/void/:id` — Admin
Reverses an **approved** payment in QuickBooks. Body: `{ "reason": "Wrong estimate" }` (3–300 chars).
Steps, each safe to repeat: delete the QBO Deposit (fee case only), then void the QBO Payment (`POST /payment?operation=update&include=void`), which puts the balance back on the invoice and leaves a zeroed record marked "Voided". Then the row becomes `voided` with `voided_at`, `voided_by` and `void_reason`, and the rep sees the change as unread.
**200** `{ "ok": true }`.

| Status | When |
|---|---|
| 400 | Bad id or reason |
| 404 | Payment not found |
| 409 | Not `approved` (only approved payments can be voided), or already being processed |
| 502 | QuickBooks refused (for example the period is closed or the deposit was reconciled); nothing is changed in the portal, so it can be retried |

A voided payment stops counting toward the estimate's progress and the customer's paid-to-date, and its bank reference number can be submitted again. **Not yet tested against a live QuickBooks company**: try it on the sandbox first.

### `GET /api/payments/qbo-accounts` — Admin or SuperAdmin
Setup helper for filling the `QBO_*_ACCOUNT*` env vars. Returns active accounts of type Bank, Expense, Other Expense, Other Current Asset, sorted by type then name.

**200** `{ "accounts": [{ "id": "35", "name": "BDO Savings", "type": "Bank", "subType": "Savings" }] }`

---

## 10. Error codes

Machine-readable values in `error.details.code`:

| Code | Status | Meaning | Suggested UI |
|---|---|---|---|
| `INVALID_RECEIVER` | 422 | Chosen receiver not an active sales user | Refresh receivers list |
| `DUPLICATE_REFERENCE` | 409 | Bank reference already used | Block; tell user |
| `DUPLICATE_PENDING` | 409 | Similar pending payment in last 24 h | Confirm, then resubmit with `force=true` |
| `QBO_REAUTH_REQUIRED` | 401 | No QuickBooks connection for this user, or its refresh token expired/revoked | Send the user to `/api/auth/qbo/login` |
| `INVITE_INVALID` | 404 | Invite link unknown, expired, used, or for a deactivated account | Ask the SuperAdmin for a new link |
| `SELF_LOCKOUT` | 409 | A SuperAdmin tried to demote/deactivate themselves | Tell the user |
| `LAST_SUPERADMIN` | 409 | Would leave no active SuperAdmin | Tell the user |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Idempotency-Key already used for a different payment | Generate a new key |
| `UNDO_NOT_AVAILABLE` | 409 | Window passed, not your rejection, or already posted | Tell the admin |

Other failures have no code; switch on HTTP status and show `message`.

---

## 11. Data model

PostgreSQL via Prisma (`prisma/schema.prisma`). Columns are snake_case in the DB.

**`users`** — `id` UUID PK, `name`, `email` (unique), `role` (`sales`|`admin`|`superadmin`), `active` (default true), `qbo_sub` (unique; Intuit account id, set when an invite is accepted), `invite_token_hash` (unique, SHA-256 of the one-time link token) and `invite_expires_at`, timestamps. `email` is a label and is not used to match logins. Legacy columns `password_hash` (nullable) and `must_change_password` are no longer used.

**`payments`** — `id` UUID PK, `customer_name`, `qbo_customer_id`, `qbo_estimate_id`, `qbo_estimate_number`, `amount_submitted` Decimal(14,2), `final_amount` Decimal(14,2)?, `bank_deposited_to` enum (`BDO`, `UnionBank`, `Digima`, `Happy Med`, `Cash`), `reference_no`?, `received_on` DATE?, `received_by` (name snapshot), `received_by_id` → users, `submitted_by` (name snapshot), `submitted_by_id` → users, `proof_image_url`, `proof_public_id`, `status` (`pending`|`approved`|`rejected`|`voided`), `voided_at`, `voided_by`, `void_reason`, `qbo_payment_id` (**unique**, prevents double-posting), `qbo_deposit_id`, `approved_by`, `approved_at`, `rejection_reason`, `sales_seen_at`, `reviewed_by_id` → users (who approved/rejected; set from migration `20261016030000` on), `idempotency_key` (unique per submitter), `created_at`, `updated_at`.
Indexes: `(submitted_by_id, status)`, `(received_by_id)`, `(status, created_at)`, `(qbo_estimate_id)`, `(bank_deposited_to, reference_no)`.

**`qbo_tokens`** — one row per user (`user_id` PK → users, cascade delete; tokens are AES-256-GCM encrypted when `TOKEN_ENCRYPTION_KEY` is set): `realm_id`, access/refresh tokens and their expiry timestamps, `last_verified_at`. Restrict database access either way.

### Payment lifecycle

```
submit ──► pending ──approve (posts to QBO)──► approved
                  └──reject──────────────────► rejected
approved ──void (reverses in QBO)──► voided
```
`rejected` and `voided` are terminal. A partially failed approval leaves the row `pending` with `qboPaymentId` set.

---

## 12. Configuration

Environment variables are validated at boot (the process exits on failure). See `.env.example`.

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no | `development` (default) / `production` / `test` |
| `PORT` | no | default 3000 |
| `APP_BASE_URL` | yes | Public URL of this API; used to rebuild the OAuth callback URL |
| `FRONTEND_URL` | no | default `http://localhost:5173`; QBO callback redirect target |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | yes | Receipt storage |
| `CLOUDINARY_FOLDER` | no | default `payment-proofs` |
| `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` | yes | Intuit app keys |
| `QBO_ENVIRONMENT` | no | `sandbox` (default) / `production` |
| `QBO_REDIRECT_URI` | yes | Must match the Intuit app, e.g. `…/api/auth/qbo/callback` |
| `QBO_REALM_ID` | yes | The one QuickBooks company this portal serves; other companies are refused at sign-in |
| `TOKEN_ENCRYPTION_KEY` | recommended | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts the stored QuickBooks tokens (AES-256-GCM). Tokens saved before it was set stay readable and are encrypted the next time they are saved. Changing or losing it sends everyone back through sign-in. |
| `SUPERADMIN_QBO_SUB` | no | The operator's Intuit id; always signs in as SuperAdmin (first-account bootstrap and lockout recovery) |
| `SUPERADMIN_EMAIL` | with `SUPERADMIN_QBO_SUB` | Label of that SuperAdmin account |
| `QBO_DEPOSIT_ACCOUNT_BDO` / `_UNIONBANK` / `_DIGIMA` / `_HAPPYMED` / `_CASH` | for approval | QBO "Deposit To" account ids (use `/payments/qbo-accounts`) |
| `QBO_BANK_FEE_ACCOUNT_ID` | for fees | Expense account for bank/QR fees |
| `SESSION_SECRET` | yes | ≥ 16 chars |
| `ESTIMATE_LOOKBACK_DAYS` | no | ≥ 30, default 365 |
| `DEFAULT_FEE_PERCENT` | no | 0–20, default 1.5; served by `/config/banks` |

---

## 13. Operations

```bash
npm install
npm run prisma:migrate     # dev: create/apply migrations
npm run prisma:deploy      # prod: apply existing migrations
npm run dev                # tsx watch on src/server.ts
npm run build && npm start # compile to dist/ and run
npm run typecheck
npm test                   # unit tests for validators, query building and serializers (no database needed)

# Add an account from the shell and print its one-time invite link (SuperAdmins can also do this through POST /api/users)
npm run user:create -- admin "Full Name" admin@company.com
npm run user:create -- sales "Full Name" rep@company.com
```

- Graceful shutdown on `SIGINT`/`SIGTERM` (closes the HTTP server, disconnects Prisma).
- Behind a proxy in production (`trust proxy` = 1) so secure cookies work.
- First-time setup: set `QBO_REALM_ID`, enable the OpenID scope (Email/Profile are not needed) and the redirect URI on the Intuit app → bootstrap the first SuperAdmin with `SUPERADMIN_QBO_SUB` (see Authentication) → the SuperAdmin adds the team and shares each person's invite link (`POST /api/users`) → an admin or the SuperAdmin uses `/payments/qbo-accounts` to fill the account env vars.

### Known gaps (worth tracking)

- Set `TOKEN_ENCRYPTION_KEY`: without it the QuickBooks tokens in `qbo_tokens` are stored in plaintext.
- `/payments/pending` is still unpaginated (fine for a review queue; history is paged via `GET /payments`). Paging is offset-based.
- The audit trail is rebuilt from the payment row; a dedicated audit table would also capture partial-post attempts.
- No OpenAPI document or request id in errors; no automated tests in the repo.
- Approval lock is in-memory (single instance only).
- QBO tokens stored unencrypted.

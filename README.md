# Digima CRM — payment portal

A private web app for **DIGIMA WEB SOLUTIONS INC.** that connects the sales team's payment receipts to QuickBooks Online.

- **Sales** submit each payment a customer makes against a QuickBooks estimate, with a photo of the receipt.
- **Admins** check the receipt against the bank and approve or reject it. Approving records the payment in QuickBooks, and for an estimate's first payment creates its invoice for the full estimate; later payments (balances after a downpayment) go on that same invoice.
- **SuperAdmins** invite the team, assign roles, and see the reports and the activity log. They do not submit or approve payments.

Everyone signs in with **Sign in with QuickBooks**; there are no portal passwords.

| Part | Stack |
|---|---|
| `backend/` | Node ≥ 18.18, Express 4, TypeScript, Prisma (PostgreSQL), Zod, S3-compatible storage for receipts, `intuit-oauth` |
| `frontend/` | React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query, React Router |

The full API reference, data model, error codes and configuration are in [`backend/API.md`](backend/API.md).

---

## Run it locally

You need Node 18.18 or later, PostgreSQL, an S3-compatible bucket (UpCloud Object Storage, AWS S3, MinIO…), and a QuickBooks **sandbox** app from [developer.intuit.com](https://developer.intuit.com).

```bash
npm run install:all                    # installs backend/ and frontend/
cp backend/.env.example backend/.env   # then fill it in (see below)
npm run prisma:migrate                 # creates the database tables
npm run dev:backend                    # API on http://localhost:3000
npm run dev:frontend                   # app on http://localhost:5173 (proxies /api to the backend)
```

In `backend/.env`, at least: `DATABASE_URL`, the `S3_*` settings, `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI` (`http://localhost:3000/api/auth/qbo/callback`, also added to the Intuit app), `QBO_REALM_ID` (your sandbox company id), `SESSION_SECRET` (16+ random characters) and `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`). Every variable is listed with its meaning in `backend/.env.example` and in [API.md → Configuration](backend/API.md#12-configuration). The backend refuses to start when one is missing or malformed, and says which.

**The first account.** Sign in once with QuickBooks: you are refused, and the server log prints your Intuit id (`sub`). Put it in `SUPERADMIN_QBO_SUB` (with `SUPERADMIN_EMAIL`), restart, and sign in again as SuperAdmin. Then add the team from **Team**: each person gets a one-time invite link (valid 7 days) to open and sign in with QuickBooks.

**Bank accounts for posting.** As an admin, call `GET /api/payments/qbo-accounts` (or open it in the browser while signed in) to find the QuickBooks account ids, then set `QBO_DEPOSIT_ACCOUNT_*` and `QBO_BANK_FEE_ACCOUNT_ID`.

### Tests and checks

```bash
npm --prefix backend test        # backend unit tests (no database or QuickBooks needed)
npm --prefix backend run typecheck
npm --prefix frontend test       # design lint, then the frontend tests
npm --prefix frontend run typecheck
```

---

## Deploy to production

### 1. One origin for the app and the API
The backend serves only the API (`/api/...`). The sign-in cookie is same-site, so **the built frontend and the API must be served from the same domain**: the web server serves `frontend/dist/` and forwards `/api/` to the Node process. For example, with nginx:

```nginx
server {
    server_name portal.example.com;           # your domain, with HTTPS
    root /srv/digima/frontend/dist;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;  # optional: the same id in nginx and app logs
        client_max_body_size 6m;                    # receipts are up to 5 MB
    }
    location / {
        try_files $uri /index.html;                 # the app handles its own routes
    }
}
```

### 2. Build and start
```bash
npm run install:all
npm run build                         # frontend → frontend/dist, backend → backend/dist
npm run prisma:deploy                 # applies the migrations to the production database
NODE_ENV=production npm start         # node backend/dist/server.js
```
Run it under a process manager that restarts it (systemd, pm2, or your host's own), and **run one instance**: some locks are in memory (see [Known limits](backend/API.md#known-limits)).

### 3. Production settings
In the production `backend/.env`:

- `NODE_ENV=production`, `APP_BASE_URL` and `FRONTEND_URL` both set to `https://portal.example.com`.
- `QBO_ENVIRONMENT=production`, the **production** `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI=https://portal.example.com/api/auth/qbo/callback`, and `QBO_REALM_ID` set to the real company. `QBO_EXTRA_REALM_IDS` must be empty (the backend refuses to start otherwise).
- A new `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`, not the development ones. Keep the encryption key safe: losing it only means everyone signs in again.
- `QBO_DEPOSIT_ACCOUNT_*` and `QBO_BANK_FEE_ACCOUNT_ID` from the **real** company (sandbox ids will not work).

### 4. The Intuit production app
Intuit issues production keys after reviewing the app. In the Intuit developer portal, use these pages (all public, no sign-in needed):

| Intuit asks for | URL |
|---|---|
| Redirect URI | `https://portal.example.com/api/auth/qbo/callback` |
| Launch URL / host domain | `https://portal.example.com/login` |
| Disconnect URL | `https://portal.example.com/disconnect` |
| Privacy policy | `https://portal.example.com/privacy` |
| End-user licence agreement | `https://portal.example.com/terms` |

The company name and contact email on those pages come from `frontend/src/lib/legal.ts`.

### 5. Before the first real payment
Approve one small payment end to end in the real company (submit, approve, check the invoice and payment in QuickBooks, then void it). The flow has been tested only against a US **sandbox** company so far, and tax in particular may behave differently in the real company. If an invoice the portal creates does not match its estimate, the approval stops before anything is recorded and says so.

---

## Run it

### Health and monitoring
- **Uptime monitor:** `GET /api/health` returns 200 when the app and its database answer, 503 when the database does not. Alert on anything but 200.
- **Restart check:** `GET /api/health/live` only says the process is up; give this one to a host that restarts the app on failure.
- **Logs:** every line carries a request id, and every error reply includes it (`requestId`, and the `X-Request-Id` header), so "ref 5f0c…" from a user finds the exact lines. Page crashes in browsers are reported to the server log too. The prefixes to watch (`[error]`, `[qbo]`, `[client-error]`, `[health]`, `[audit]`, `[fatal]`) are listed in [API.md → What to watch in the logs](backend/API.md#what-to-watch-in-the-logs). Keep at least 30 days of logs.
- **Backups:** turn on daily automated backups of the PostgreSQL database (most managed databases do this in one setting) and test a restore once. Receipts live in the S3 bucket; turn on versioning or a backup there too.
- **Who did what:** SuperAdmins see every submission, approval, rejection, void, invite, role change and sign-in, with failed attempts marked, under **Activity**.

### Maintenance mode
Set `MAINTENANCE_MODE=true` (optionally `MAINTENANCE_UNTIL` and `MAINTENANCE_MESSAGE`) and restart. Everyone sees a "Down for maintenance" page that checks every 30 seconds and reloads itself when the portal is back; the health URLs keep answering. Set it back to `false` and restart to finish.

### Releasing a new version
Build, run `npm run prisma:deploy`, restart. People with the app already open get "A new version of the portal is ready" with a reload button the next time they open a page; nothing they submitted is lost.

---

## Repository layout

```
backend/
  prisma/              schema.prisma and the migrations
  src/controllers/     request handlers, one file per area (payments, admin, reports, activity, …)
  src/services/        QuickBooks posting and invoices, reports, the activity log vocabulary, storage
  src/models/          database access
  src/middleware/      auth and roles, request ids, maintenance, uploads, errors
  test/                unit tests (node:test)
  API.md               the API reference
frontend/
  src/pages/           one file per screen
  src/components/      the app shell, UI kit, dashboard and admin pieces
  src/api/             data hooks and types
  src/lib/             formatting, legal details, helpers
  public/              favicon, logo, fonts, robots.txt
```

Contact: [carlinfotech@gmail.com](mailto:carlinfotech@gmail.com)

# GrandPrint — Large Format Printing Order System

## Project Structure

```
project/
├── client/          # React frontend (Vite)
└── server/          # Express backend (Node.js)
```

---

## Quick Setup

### 1. Backend

```bash
cd server
npm install
```

Edit `.env` with your real values:

| Variable                 | Description                                             |
|--------------------------|---------------------------------------------------------|
| `MONGO_URI`              | MongoDB connection string (local, or MongoDB Atlas)     |
| `PORT`                   | Optional decimal TCP port (1–65535); defaults to 5000  |
| `CLIENT_URL`             | Allowed frontend origin(s) for CORS (comma-separated); required in production |
| `ADMIN_PASSWORD`         | Password to log into admin panel                        |
| `JWT_SECRET`             | Secret used to sign admin session tokens                |
| `BREVO_API_KEY`          | Active Brevo API key (not an SMTP or MCP key)           |
| `EMAIL_USER`             | Sender email address verified in Brevo                 |
| `BUSINESS_NAME`          | Optional sender name; defaults to GrandPrint            |
| `CUSTOMER_PORTAL_URL`    | Customer frontend URL; valid HTTPS required in production |
| `CLOUDINARY_CLOUD_NAME`  | Cloudinary cloud name (file storage)                    |
| `CLOUDINARY_API_KEY`     | Cloudinary API key                                      |
| `CLOUDINARY_API_SECRET`  | Cloudinary API secret                                   |
| `GCASH_NAME`             | Your GCash registered name                              |
| `GCASH_NUMBER`           | Your GCash number                                       |
| `BPI_NAME`               | BPI account holder name                                 |
| `BPI_ACCOUNT`            | BPI account number                                      |
| `FB_PAGE`                | Valid HTTPS Facebook contact URL                       |

> **Cloudinary**: Sign up (free) at cloudinary.com and copy the Cloud name, API Key, and API Secret from the dashboard.

#### Brevo email setup

1. In Brevo, click the account dropdown → **Settings → Senders, Domains, IPs → Senders**. Confirm the sender matching `EMAIL_USER` is verified. If missing, click **Add a sender**, enter the From name and From email, then **Save**. If prompted, enter the code sent to that inbox and click **Verify sender**.
2. Click the account dropdown → **Settings → SMTP & API → API Keys & MCP**. Use an active, unexpired ordinary API key. If you need one, click **Generate a new API key**, complete device verification, name it and choose its expiry, then **Generate**. Store it privately, leave **Create MCP server API key** off, and click **OK**.
3. Configure the existing server variables `BREVO_API_KEY`, `EMAIL_USER`, `GCASH_NAME`, `GCASH_NUMBER`, `BPI_NAME`, `BPI_ACCOUNT`, `FB_PAGE`, and `CUSTOMER_PORTAL_URL`. Payment account settings and the API key must be non-empty; email addresses must be valid, and the contact URL must use HTTPS. The portal URL is normalized to remove trailing slashes before payment links are built. `BUSINESS_NAME` remains optional.
4. On Render, open the backend service → **Environment → Environment Variables**. Privately check the settings above; use **+ Add Environment Variable** for missing entries. Choose **Save only** if preparing settings without deploying. They take effect at the next deployment. Do not publish environment values, API keys, verification codes, customer addresses, or private payment links.

Email uses Brevo's HTTPS API, not Gmail SMTP; no Gmail App Password is needed. These email-setting checks run before sending. Missing or invalid settings fail the email attempt without preventing approval or server startup. The existing production portal URL startup requirement still applies.

```bash
npm run dev
# Server runs on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
# App runs on http://localhost:3000
```

The frontend reads the backend URL from `VITE_API_URL` (see `client/.env.example`).
Only the local development server may leave it unset and use `http://localhost:5000`.
Every build and preview, including staging and builds using development mode, must
set an absolute HTTP or HTTPS backend URL. Credentials, query strings and fragments
are rejected; surrounding whitespace and trailing slashes are removed. Backend base
paths are supported. Invalid settings stop the build before an unusable client is shipped.

---

## User Flow

### Customer
1. Visit site → click **Order Now**
2. Fill in details (name, email, contact)
3. Select product + dimensions + upload design
4. Review and submit → get Order ID
5. Wait for email with price quote
6. Send 50% downpayment via GCash or BPI
7. Upload the receipt through the private payment link, or message the FB page: `Name + Order ID + Receipt screenshot`
8. Pay remaining 50% when order is completed

### Admin
1. Visit site → click **Admin Login**
2. Enter admin password (set in `.env`)
3. **Pending Approval tab** → review order → click "Approve & Set Price" → enter price → approval is saved immediately and an email attempt starts in the background
4. **On-Going tab** → verify an uploaded receipt with "Verify Payment → Start Printing", or verify a Messenger receipt with "Confirm Payment (Messenger) → Start Printing" and its confirmation popup → then "Mark as Completed" when done
5. **Completed tab** → click "Confirm Final Payment" once remaining 50% is received

---

## Order Status Flow

```
Pending Approval
     ↓  (admin sets price → background email attempt)
Awaiting Downpayment
     ├─ customer uploads receipt → Payment Submitted → admin verifies ─┐
     └─ admin confirms verified Messenger payment ─────────────────────┤
                                                                      ↓
Printing
     ↓  (admin marks done)
Completed
     ↓  (admin confirms final payment)
Fully Paid ✓
```

### Approval email status and resend

Approval and its email attempt are saved atomically. Admins see **Sending**, **Failed**, **Unknown**, or **Accepted by email provider (delivery not confirmed)**. A provider accepting an email does not confirm inbox delivery. The request has a fixed 10-second timeout; transport uncertainty is Unknown. Sending attempts have a 60-second lease, after which an unfinished attempt displays Unknown. There are no automatic retries.

In **On-Going**, only Awaiting Payment orders offer **Resend approval email**. A missing or invalid recipient or stored price blocks resending with a clear message; the price must be finite and greater than zero. Active attempts block another send and atomically block **Rotate link** until the attempt finishes or its lease expires. Accepted or Unknown attempts require confirmation because another email may be a duplicate. Resending reuses the current private link and only creates a token if a legacy order lacks one.

Existing Awaiting Payment orders without email metadata display Unknown. Other legacy orders have no email badge. Orders with metadata retain their badge; no existing orders are migrated or emailed automatically. Only the matching attempt may save its result. Admin responses expose safe state and timestamps; customer responses do not expose email metadata or private attempt IDs. Email logs contain only the order ID and outcome.

To inspect provider events, open **Brevo → Transactional → Logs**, open the entry's eye icon, then **History**. Report event type and time only; redact recipients, sender addresses, message IDs, subjects, previews, and payment links. See [Brevo sender setup](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [API key setup](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys), and [Render environment settings](https://render.com/docs/configure-environment-variables).

Approval-email changes need no new environment variables, dependencies, or bulk migration. For those client and server changes, deploy the client first, then the server; the client handles unavailable resend routes until the server is updated. Rolling back that code removes tracking and resend behavior; optional metadata can remain stored harmlessly.

### Order integrity and server startup

New orders use `GP-` followed by 16 uppercase hexadecimal characters generated with crypto randomness. Existing six-digit IDs remain unchanged and usable; private access tokens are still required. The single-field unique `orderId` index remains required. Only a duplicate-key error explicitly identifying that index triggers a fresh ID, with at most five total save attempts. Artwork is uploaded once and reused during retries. Exhausted collisions retain the existing safe 409 conflict response.

Order fields and the full model are validated before artwork upload. Failed saves that are known to be rejected delete the new Cloudinary asset using its returned public ID, resource type and delivery type. Concurrent receipt submissions keep the conditional status/token update: the losing request deletes only its own rejected upload. Successful saves retain their assets, including when sending the response fails. Cleanup failures preserve the original API error response and log a safe cleanup failure.

Network or write-concern errors can leave the database write outcome unknown. Those assets are retained and cleanup is deferred, because the order or receipt may still be saved. An orphan may remain if the write never commits; there is no automatic cleanup queue or bulk deletion of existing assets.

Startup requires nonblank `ADMIN_PASSWORD`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Production also requires `MONGO_URI`, the existing valid HTTPS `CUSTOMER_PORTAL_URL`, and at least one comma-separated `CLIENT_URL` origin. Each entry is trimmed, trailing slashes are removed, and the HTTP(S) origin is normalized. Credentials, paths, queries, fragments, malformed URLs and empty list entries stop startup with a safe `CLIENT_URL` error. Missing or blank production `CLIENT_URL` also stops startup before routes or the database are loaded. Development retains the CORS fallback only when the setting is unset or blank. A supplied MongoDB URI must use `mongodb://` or `mongodb+srv://`; the driver checks the remaining URI details. Unset `MONGO_URI` retains the existing local fallback outside production. If supplied, `PORT` must be a decimal integer from 1 to 65535. Email/payment settings still fail only the email attempt.

The backend validates startup settings before loading routes and waits for MongoDB to connect before listening. Failed configuration or connection prevents startup with a safe message. The root readiness route keeps its existing 200 response while Mongoose reports connected and returns 503 otherwise. Outage detection follows Mongoose's heartbeat timing; it is not instantaneous.

Before the backend deployment, check settings in **Render → backend service → Environment → Environment Variables**. Add missing settings privately and select **Save only** to prepare without deploying. In **MongoDB Atlas → organization/project → Database → Data Explorer → application database → orders → Indexes**, inspect the single-field `orderId: 1` index (normally `orderId_1`): it must be Unique and have no Partial/Sparse restriction. Do not create, remove or change an index during this check. See [Atlas index inspection](https://www.mongodb.com/docs/atlas/atlas-ui/indexes/).

In **Render → backend service → Settings → Health Checks**, inspect the configured HTTP health check path. To use the root readiness response after deploying the updated backend, click **Edit**, set the path to `/`, and click **Save Changes**. Without an HTTP path, Render's default TCP check does not inspect the database-aware response. No Render settings were changed by Codex. See [Render health checks](https://render.com/docs/health-checks).

These integrity changes require only the backend deployment, with no new environment variables, dependencies or data migration. Rolling back restores the previous generator, cleanup and startup behavior; newer IDs remain readable as strings. Live Cloudinary deletion, production index presence, and real database concurrency must be verified separately by the owner.

### API configuration and admin sessions

Admin Dashboard requests use a dedicated client that adds the current admin token. A 401 response for that session clears the token and redirects to login for list, approval, status, Copy/Rotate link and email-resend requests. A delayed failure from an older session cannot clear a newer login. Customer requests and incorrect-password responses on the login page keep their existing handling.

Admin login compares fixed-size SHA-256 password hashes using `timingSafeEqual`. Optional throttling allows 10 login requests per IP per 15 minutes, with at most 5,000 tracked IPs per server process. A blocked request receives HTTP 429 and `Retry-After`. All login attempts count; expired entries are discarded, and a full tracking table rejects new IPs instead of evicting active limits. Counts reset on restart and are not shared between instances.

`ADMIN_LOGIN_RATE_LIMIT_ENABLED` is a new optional server setting. It remains disabled unless set to `true`; leave it unset or disabled until proxy handling is confirmed and the owner separately approves enabling it. The existing `ORDER_ACCESS_RATE_LIMIT_ENABLED` hold still applies. No proxy setting is changed by this batch, and no dependency or data migration is added.

Before deploying these configuration and session changes:

1. In **Vercel → frontend project → Settings → Environment Variables**, inspect `VITE_API_URL` for Production and any Preview environment you use. If missing or invalid, click **Add Environment Variable**, enter the setting privately, select the relevant environments, and click **Save**. Changes apply to the next deployment. See [Vercel environment settings](https://vercel.com/academy/vercel-foundations/vercel-settings).
2. In **Render → backend service → Environment → Environment Variables**, inspect `CLIENT_URL` privately. It must contain only the frontend HTTP(S) origin(s) that may call the API, with no credentials, paths, queries, fragments or empty entries. Whitespace and trailing slashes are normalized automatically. Use **+ Add Environment Variable** for a missing entry and choose **Save only** to prepare without deploying. Keep both IP-limit flags disabled. See [Render environment settings](https://render.com/docs/configure-environment-variables).
3. Deploy the client first, then the server. After deployment, check a correct admin login, an incorrect-password message, and an expired-session redirect from a Dashboard action. Report only pass/fail and safe error wording; redact passwords, tokens, private links, customer details, full IP addresses and environment values. Live browser behavior and proxy-derived IP identity were not verified by local mocks.

Rollback restores the previous API fallback, admin-session handling and login behavior. Leave rate-limit flags disabled while investigating. No stored orders or fields need changing.

### Frontend reliability, accessibility and lint

Payment lookup and receipt state are bound to the current private link and lookup sequence. Changing the link or retrying clears the selected receipt, including the native picker; stale lookup and upload responses cannot update the new link. Payment submission stays unavailable during lookup. Network/server failures retain the access token and offer Retry, while 401/403/404 keep the same invalid-or-outdated-link screen and Messenger contact. Confirmation without navigation state uses a replacement redirect to Home.

The Dashboard shows an explicit load error and Retry rather than an empty list after a failed lookup. Existing loaded orders remain visible with the warning. Only the latest list request may update the orders, warning or loading state; leaving the view invalidates pending requests. Admin login distinguishes connection/server outages from incorrect passwords and throttling. Upload controls use keyboard-operable buttons; form labels, hints and errors are programmatically linked. Keyboard focus is visible. The approval dialog traps focus, closes with Escape and restores focus to its trigger, or Refresh if approval removes that card. Long customer details, IDs, filenames and action labels wrap, and flex/grid containers can shrink on narrow screens.

Batch 8 dark-theme contrast separates brighter link/badge text from darker white-text buttons. Computed ratios account for translucent badge backgrounds on the actual card surface: primary/hover buttons 4.70/5.57, Awaiting Payment 4.84, Printing 4.98, Completed 5.94, Pending/Verify Payment 5.83, Fully Paid 4.57, and email badge/secondary text 4.85. The weakest neutral text combination is 4.57; receipt errors are 4.94 and green success checkmarks 8.42. Existing light-theme colors are preserved. Real browser rendering remains owner verification.

Batch 8 deployment order is client first, then server, with no new environment variables or migration. Inspect `CLIENT_URL` before the server deployment because invalid entries now prevent startup. The obsolete server Nodemailer dependency is removed; no other dependency is updated. The root lockfile is retained pending owner confirmation of **Vercel → project → Settings → Build and Deployment → Root Directory** and **Render → backend → Settings → Build & Deploy → Root Directory**. Report the folders and build/start commands only; do not change settings during inspection. Both IP-limit flags stay disabled pending proxy confirmation and separate approval. Rollback restores the previous code and server lockfile without changing stored orders.

Computed light-theme contrast ratios use the stylesheet's sRGB values and account for alpha compositing on the dark sidebar:

| Text / background | Ratio |
|---|---:|
| Secondary text / darkest neutral surface | 5.09:1 |
| Muted text / darkest neutral surface | 4.86:1 |
| Blue / blue status background | 4.92:1 |
| Green / green status background | 4.93:1 |
| Orange / orange status background | 5.24:1 |
| Purple / purple status background | 5.58:1 |
| Red / darkest neutral surface | 4.63:1 |
| Sidebar warning / composited warning background | 7.76:1 |
| Sidebar warning at 80% opacity / warning background | 5.59:1 |

These calculated pairs exceed 4.5:1. They do not establish browser rendering or full accessibility conformance. Dark-theme colors are outside this light-theme contrast fix.

The previously undeclared lint devDependencies are now pinned: `eslint` 10.0.0, `@eslint/js` 10.0.1, `globals` 15.15.0, `eslint-plugin-react-hooks` 7.1.1 and `eslint-plugin-react-refresh` 0.4.20. `npm run lint` runs `eslint .` without fixing or caching. The config retains the traditional Hooks rules and recognizes the Vite compile-time flag and Node-based Tailwind config; it does not enable React Compiler rules. Existing lint errors remain in `src/ThemeToggle.jsx:23` (unused catch binding and empty catch) and `src/pages/Customer/OrderForm.jsx:41` (unnecessary regex escape). They were reported rather than changed as unrelated cleanup.

The new lint tooling requires Node 20.x at least 20.19.0, Node 22.x at least 22.13.0, or Node 24+. Local mocks, JSX checks, lint execution and the production build used Node 22.14.0. The production build ran in memory with a synthetic API URL and environment-file loading disabled; no build output was written.

Owner checks before/after the frontend deployment:

1. Open **Vercel → frontend project → Settings → Build and Deployment → Node.js Version**. Confirm a supported version; 22.x matches the locally tested major and 24.x is also supported. The selection applies to future deployments. Send only the selected version if reporting back. See [Vercel Node.js settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
2. This batch deploys only the frontend. It adds no environment variables, server changes or data migration. Keep the existing IP-limit flags disabled until the separate proxy confirmation and enablement approval. Rollback restores the previous frontend; stored orders and private access tokens need no changes.
3. In the browser, open **Home → Place an Order**, use Tab through the fields, and continue to Order Info after entering valid details. Focus the upload button, press Enter and cancel the native picker. Open an existing private payment link locally in your own browser and repeat the receipt-picker check without submitting. This verifies native keyboard behavior; Codex did not use a real browser or create an order.
4. In **Admin → Sign In → Pending Approval → Approve & Set Price**, check initial price focus, Tab/Shift+Tab containment, Escape and restored focus; cancel without approving. To check outages in Chrome/Edge, press **F12 → Network → throttling dropdown → Offline**, then use Dashboard Refresh or Sign In. For payment lookup, open your private link, click Home, switch to Offline, and use browser Back to return to the payment page; it should show the outage message and Retry. Restore **No throttling**, then retry and confirm recovery. No production records need changing for these checks.
5. For narrow screens in Chrome/Edge, press **F12 → Toggle device toolbar** (or **Ctrl+Shift+M**), select Responsive and test widths 320 and 375. Check the Home navigation, order form, payment/confirmation IDs, Dashboard cards and approval dialog for sideways page scrolling. Native keyboard interaction, screen-reader behavior and responsive rendering remain Not verified until the owner checks them.

Report pass/fail and safe error text only. Redact passwords, session/access tokens, private-link fragments, customer names/emails/contact details, and full IP addresses. These owner checks can be skipped without blocking local implementation, but skipped cases remain Not verified.

---

## Tech Stack

- **Frontend**: React 18, React Router v6, Vite
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Email**: Brevo transactional HTTPS API
- **File uploads**: Multer (in-memory) → Cloudinary (designs & payment receipts stored in the cloud)
- **Deployment**: Frontend on Vercel, backend on Render, database on MongoDB Atlas

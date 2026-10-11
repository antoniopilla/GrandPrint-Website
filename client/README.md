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
| `CLIENT_URL`             | Allowed frontend origin(s) for CORS (comma-separated)   |
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
Leave it unset for local dev (defaults to `http://localhost:5000`); in production set it
to your deployed backend, e.g. `VITE_API_URL=https://grandprint-api.onrender.com`.

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

In **On-Going**, only Awaiting Payment orders offer **Resend approval email**. A missing or invalid recipient blocks resending with a clear message. Active attempts block another send; Accepted or Unknown attempts require confirmation because another email may be a duplicate. Resending reuses the current private link and only creates a token if a legacy order lacks one.

Existing Awaiting Payment orders without email metadata display Unknown. Other legacy orders have no email badge. Orders with metadata retain their badge; no existing orders are migrated or emailed automatically. Only the matching attempt may save its result. Admin responses expose safe state and timestamps; customer responses do not expose email metadata or private attempt IDs. Email logs contain only the order ID and outcome.

To inspect provider events, open **Brevo → Transactional → Logs**, open the entry's eye icon, then **History**. Report event type and time only; redact recipients, sender addresses, message IDs, subjects, previews, and payment links. See [Brevo sender setup](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [API key setup](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys), and [Render environment settings](https://render.com/docs/configure-environment-variables).

This batch needs no new environment variables, dependencies, or bulk migration. Deploy the client first, then the server; the client handles unavailable resend routes until the server is updated. Rolling back the code removes tracking and resend behavior; optional metadata can remain stored harmlessly.

---

## Tech Stack

- **Frontend**: React 18, React Router v6, Vite
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Email**: Brevo transactional HTTPS API
- **File uploads**: Multer (in-memory) → Cloudinary (designs & payment receipts stored in the cloud)
- **Deployment**: Frontend on Vercel, backend on Render, database on MongoDB Atlas

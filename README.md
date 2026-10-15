<div align="center">

# GrandPrint — Large Format Printing Order System

**A full-stack printing platform for customer orders, artwork uploads, manual quotes and payment verification, production tracking, and an admin workspace with order editing, archiving, and deletion.**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express_4-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![Cloudinary](https://img.shields.io/badge/Media-Cloudinary-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)

</div>

---

## Overview

**GrandPrint** manages made-to-order Tarpaulin, Sintra Board, and Sticker requests. Customers submit their details, dimensions, quantities, notes, and optional artwork. An administrator reviews the request, sets a price, verifies a downpayment receipt, and advances production through completion and final payment.

The React client and Express API are separate packages. MongoDB stores orders, Cloudinary stores uploaded files, and Brevo sends approval emails containing the quote and private payment link. GCash and BPI instructions support manual payment collection; there is no payment gateway integration.

## Key Features

### Customer ordering & payments

- **Validated order form** — customer details, product choice, dimensions in feet, quantity, notes, and optional artwork, followed by an order confirmation.
- **Private payment access** — the quote email and confirmation link open the payment page; an order number alone does not grant access. Invalid or outdated links show a contact fallback.
- **Receipt submission** — upload a receipt while awaiting downpayment, then wait for admin verification. Customers can also send a receipt through Messenger for manual confirmation.
- **Responsive presentation** — light/dark themes, file previews, upload feedback, and a floating Messenger contact button on the landing page.

### Admin order management

- **Status-based dashboard** — Pending Approval, On-Going, and Completed tabs, with counts, manual refresh, and 20-second polling.
- **Order editing** — update contact details and notes on active orders. Product, dimensions, quantity, and artwork replacement are editable only while Pending Approval; approval locks those quote inputs on the API as well as in the editor.
- **Archive & restore** — separate Active/Archived views preserve order details and files. Archived orders are unavailable through customer lookup and payment upload; restoring re-enables their private links.
- **Permanent deletion** — available for archived orders after an explicit confirmation. The API attempts to remove artwork and receipt assets from Cloudinary and reports a warning if file cleanup fails.
- **Quote & production workflow** — approve a price, inspect artwork and receipts, verify payment, mark production complete, and confirm the remaining balance. Messenger verification has its own confirmation prompt.
- **Approval email tracking** — background sends report Sending, Failed, Unknown, or Accepted by email provider. Guarded resends are available while awaiting downpayment; changing an email address does not send automatically.
- **Payment-link controls** — copying reuses the existing private token; rotating invalidates the previous link and is blocked during an active approval email send.

### Validation & access

- **Admin authentication** — shared-password login issues a 12-hour JWT; the client stores it in `sessionStorage`, and protected API routes verify the token.
- **Upload validation** — extension, MIME type, file signature, multipart, and size checks precede Cloudinary storage. Artwork accepts PDF, PNG, JPG/JPEG, PSD, AI, and EPS; receipts accept PDF, PNG, and JPG/JPEG.
- **Order integrity** — new public order numbers use `GP-` plus 16 cryptographically random hexadecimal characters; existing legacy numbers remain usable with their private access tokens. Lifecycle updates use conditional database writes.
- **Regression coverage** — a Node.js HTTP test harness covers admin editing, quote locks, archive/restore, deletion, upload cleanup, and customer access to archived orders using mocked persistence and media services.

## Screenshots

No application screenshots are currently tracked in this repository. To inspect the current UI locally, visit `/` (landing), `/order` (customer form), and `/admin` (authenticated dashboard and editor). The `/pay` page requires a private order link to display a quote. Use disposable orders when capturing payment or admin screens.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React / React DOM 18.3.1, React Router DOM 6.30.3, Vite 6.4.3, Axios 1.13.6, Lucide React, custom CSS and responsive inline styles |
| **Backend** | Node.js, Express 4.22.1, Mongoose 8.23.0, MongoDB |
| **Auth & Uploads** | JSON Web Token 9.0.3, Multer 2.3.0, Cloudinary SDK 2.11.0 |
| **Email** | Brevo HTTPS API through native Node.js `fetch` |
| **Tooling & Tests** | ESLint 10, Nodemon, Node.js built-in test runner |
| **Deployment** | Client configured for Vercel; API documented for Render |

Package versions above come from the committed lockfiles. The MongoDB server version is not pinned.

## Architecture

```text
React SPA (Vercel) ── HTTPS ──▶ Express API (Render) ──▶ MongoDB
                                     │
                                     ├─ Cloudinary (artwork and receipts)
                                     └─ Brevo (quotes and payment instructions)
```

Customer order creation is public. Customer lookup and receipt submission require an `X-Order-Access-Token`; the private link carries the token in its URL fragment, which the client captures and removes from the address bar. Admin requests use a Bearer JWT. The API validates order details and upload contents before persistence and enforces the production lifecycle.

<details>
<summary><strong>Project structure</strong></summary>

```text
GrandPrint-Website/
├── client/
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── pages/Customer/       # Landing, order form, confirmation, payment
│   │   ├── pages/Admin/          # Login, dashboard, order editor
│   │   ├── adminApi.js           # Authenticated order management requests
│   │   ├── orderValidation.js    # Shared customer/editor field validation
│   │   ├── paymentAccess.js      # Private-link token capture and session storage
│   │   ├── ThemeToggle.jsx       # Light/dark preference
│   │   └── App.jsx               # Routes and client admin guard
│   ├── .env.example
│   ├── vite.config.js            # Dev port and build-time API URL validation
│   └── vercel.json               # SPA rewrites
├── server/
│   ├── config/                  # Startup validation, MongoDB, Cloudinary, portal URL
│   ├── controllers/             # Order creation, lifecycle, email and admin CRUD
│   ├── middleware/              # Auth, upload validation, optional IP limiters
│   ├── models/                  # Mongoose Order schema and indexes
│   ├── routes/                  # Orders, customers, admin login
│   ├── utils/                   # Validation, email delivery, private access, API errors
│   ├── tests/                   # Mocked admin order API regression tests
│   ├── .env.example
│   └── server.js                 # Connect MongoDB, then start the API
└── docs/admin-order-crud-testing.md
```

</details>

## API Overview

| Mount | Purpose | Access |
|---|---|---|
| `/api/admin/login` | Shared-password admin login | Public |
| `/api/orders` | Create an order; list active orders or `?archived=true` | Public create / Admin list |
| `/api/orders/lookup/:orderId` | Retrieve a customer's quote and status | Private order token |
| `/api/customers/pay/:orderId` | Submit a downpayment receipt | Private order token |
| `/api/orders/:id` | Edit order details (`PUT`); permanently delete an archived order (`DELETE`) | Admin |
| `/api/orders/:id/archive`, `/api/orders/:id/restore` | Archive or restore an order | Admin |
| `/api/orders/:id/approve`, `/api/orders/:id/status` | Set the quote or advance production/payment status | Admin |
| `/api/orders/:id/access-link`, `/api/orders/:id/access-link/rotate` | Copy or rotate a private payment link | Admin |
| `/api/orders/:id/approval-email/resend` | Resend the current quote while awaiting downpayment | Admin |
| `/` | MongoDB-aware readiness check | Public |

Admin `:id` parameters use the database `_id`, not the public `GP-…` order number. See the [admin order verification guide](docs/admin-order-crud-testing.md) for route methods and detailed checks.

## Getting Started

### Prerequisites

- **Node.js 22.13+ within 22.x, or 24+**, with npm. The current Vite/ESLint combination also supports Node.js 20.19+ within 20.x. Neither package declares an `engines` field.
- A reachable **MongoDB** database and credentials permitted to create the order collection/indexes.
- **Cloudinary** credentials for startup and file storage.
- **Brevo** access and a verified sender to exercise approval emails.

### 1. Clone and install

Repository links match this checkout's configured Git remote. Anonymous checks returned HTTP 404 during this review; access may be restricted or the repository may have moved. Confirm access and the URL if cloning fails.

```bash
git clone https://github.com/antoniopilla/GrandPrint-Website.git
cd GrandPrint-Website

cd server
npm ci
cd ../client
npm ci
cd ..
```

All following paths are relative to the repository root, which contains `client/` and `server/`. There is no root `package.json`.

### 2. Configure environment

Copy the templates only if those environment files do not already exist:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

In PowerShell, use `Copy-Item server/.env.example server/.env` and `Copy-Item client/.env.example client/.env`.

Set the server's admin password, JWT secret, and Cloudinary credentials. Set `MONGO_URI` to a local URI such as `mongodb://127.0.0.1:27017/printingPOS` or your Atlas connection string: the example leaves it empty, and an explicitly empty value fails validation. The local fallback applies only when the variable is omitted. The Mongoose order model defines the collection fields and indexes.

Configure Brevo, payment accounts, and the contact URL to test approval emails. Missing email settings fail that email attempt without blocking order approval or server startup. See [Environment Variables](#environment-variables).

### 3. Run the API

In the first terminal, from the repository root:

```bash
cd server
npm run dev
```

The API connects to MongoDB before listening at `http://localhost:5000` by default. `npm start` runs without Nodemon.

### 4. Run the client

In a second terminal, from the repository root:

```bash
cd client
npm run dev
```

Open the address printed by Vite; its configured development port is **3000**. Local development may leave `VITE_API_URL` blank to use `http://localhost:5000`. Builds and preview require an explicit API URL.

## Environment Variables

Annotated templates live in [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example). Keep real values private. `VITE_` variables become public client configuration and must not contain secrets.

**Client** (`client/.env`)

| Variable | Requirement | Purpose |
|---|---|---|
| `VITE_API_URL` | Required for builds, preview, and production; optional in local development | Absolute HTTP(S) backend base URL. Credentials, queries, and fragments are rejected; whitespace and trailing slashes are normalized. |

**Server** (`server/.env`)

| Variable | Requirement | Purpose |
|---|---|---|
| `PORT` | Optional | Decimal TCP port, 1–65535; defaults to `5000`. Render supplies its service port. |
| `NODE_ENV` | Set to `production` on deployment | Enables production configuration requirements. |
| `MONGO_URI` | Required in production; optional locally only when omitted | MongoDB connection string. An empty supplied value is invalid. |
| `CLIENT_URL` | Required in production | Comma-separated allowed HTTP(S) frontend origins, with no credentials, path, query, fragment, or empty entries. Blank locally permits all origins. |
| `CUSTOMER_PORTAL_URL` | Required in production | Canonical frontend base for payment links; HTTPS required in production. Defaults locally to `http://localhost:3000`. |
| `ADMIN_PASSWORD` / `JWT_SECRET` | Required at startup | Shared admin password and JWT signing secret. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Required at startup | Upload storage and asset cleanup. |
| `EMAIL_USER` / `BREVO_API_KEY` | Required for approval emails | Brevo-verified sender and ordinary API key. Email uses HTTPS, not SMTP. |
| `BUSINESS_NAME` | Optional | Sender/email branding; defaults to `GrandPrint`. |
| `GCASH_NAME` / `GCASH_NUMBER` | Required for approval emails | GCash payment instructions. |
| `BPI_NAME` / `BPI_ACCOUNT` | Required for approval emails | BPI payment instructions. |
| `FB_PAGE` | Required for approval emails | Valid HTTPS business contact URL. |
| `ORDER_ACCESS_RATE_LIMIT_ENABLED` | Optional; off by default | Only `true` enables per-IP customer lookup and payment-upload limiters. |
| `ADMIN_LOGIN_RATE_LIMIT_ENABLED` | Optional; off by default | Only `true` enables the per-IP admin login limiter. |

## Deployment

- **Frontend (Vercel):** use root directory `client`, Vite framework, install command `npm ci`, build command `npm run build`, and output directory `dist`. Set `VITE_API_URL` before building. [`client/vercel.json`](client/vercel.json) rewrites direct client routes to `index.html`.
- **Backend (Render):** use a Node web service with root directory `server`, build command `npm ci`, start command `npm start`, and health check path `/`. Select a compatible Node.js runtime and provide production, startup, and email settings from the table above.
- **Origin and link configuration:** `CLIENT_URL` must allow the deployed frontend origin; `CUSTOMER_PORTAL_URL` must point to its HTTPS base. Both public and admin clients use the same API.
- **Coordinated updates:** deploy the client before the server for the existing approval-email/resend changes; the client handles an unavailable resend route until the API is updated.
- **Optional limiters:** leave the IP limiter flags disabled until proxy/client-IP handling is confirmed. Counts are held in process memory, reset on restart, and are not shared across instances.

These settings describe the repository configuration and deployment procedure; live hosting settings and production service behavior have not been confirmed during this documentation update.

## Order Lifecycle & Usage

```text
Pending Approval
     ↓  admin approves and sets price; email attempt starts
Awaiting Downpayment
     ├─ customer uploads receipt → Payment Submitted → admin verifies ─┐
     └─ admin confirms a verified Messenger payment ───────────────────┤
                                                                      ↓
Printing → Completed → Fully Paid
```

1. **Customer:** submit an order, keep its private link, and wait for the quote email. Pay the instructed 50% downpayment through GCash or BPI and upload the receipt through that link, or send it through Messenger. Pay the remaining balance when the order is complete.
2. **Admin:** sign in at `/admin/login`, review Pending Approval, and choose **Approve & Set Price**. In On-Going, verify the uploaded or Messenger receipt before starting printing. Mark the order complete, then confirm final payment in Completed.
3. **Corrections:** open **Edit** on an active order. After approval, only contact details and notes remain editable. Changing the email does not resend the quote; while awaiting downpayment, the notice offers a manual resend. Later statuses require direct customer contact.
4. **Retention:** archive an order to remove it from the active workspace and customer payment access. Restore it to resume access, or choose **Delete forever** in Archived for permanent removal. Review any file cleanup warning.

Approval email acceptance is not confirmation of inbox delivery. Sends use a 10-second provider timeout and a 60-second attempt lease; an unfinished or uncertain attempt becomes Unknown. There are no automatic retries. Resending requires an awaiting-downpayment order with a valid recipient and positive price; Accepted or Unknown attempts require duplicate-send confirmation. Resends reuse the current link, and an active send blocks another send and link rotation.

## Available Scripts

| Directory | Command | Runs |
|---|---|---|
| `client/` | `npm run dev` | Vite development server, configured port `3000` |
| `client/` | `npm run build` | Production bundle in `client/dist` (requires `VITE_API_URL`) |
| `client/` | `npm run preview` | Local preview of the built bundle (requires `VITE_API_URL`) |
| `client/` | `npm run lint` | ESLint over the client |
| `server/` | `npm run dev` | API with Nodemon |
| `server/` | `npm start` | API with Node.js |
| Repository root | `node --test server/tests/order-admin.test.js` | Admin order API regression suite with mocked database and uploads |

Neither package defines an `npm test` script. The direct backend test command and client lint passed during this documentation update (89 tests/subtests). Live database, Cloudinary cleanup, and email-delivery checks are described in the [verification guide](docs/admin-order-crud-testing.md).

## Known Limitations

- Payments and receipt verification are manual; the system does not charge accounts or confirm transactions with a bank/payment API.
- The admin uses one shared password. Signing out removes the client token; no server-side JWT revocation endpoint is included.
- Both artwork and receipt uploads are limited to **10,000,000 bytes**. PNG, JPG/JPEG, and PSD headers have a 25-megapixel precheck; PDF, AI, and EPS have no equivalent pixel-dimension precheck.
- Uploads are buffered in memory. Per-request limits do not cap aggregate memory across concurrent uploads.
- Database deletion can succeed while Cloudinary cleanup fails; the response/UI reports a warning, and failed cleanup needs follow-up. Asset removal and email delivery still require live-service verification.
- Dashboard updates use polling, and order lists are not paginated. The existing automated suite covers admin API behavior with mocked storage, not a full production workflow.

## License

No license file is included. Contact the maintainer for reuse terms.

## Contact

Built and maintained by **[@antoniopilla](https://github.com/antoniopilla)** · [Repository](https://github.com/antoniopilla/GrandPrint-Website)

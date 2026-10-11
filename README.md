# GrandPrint

A full-stack order and payment receipt management system for large-format printing businesses.

## Overview

GrandPrint lets customers request Tarpaulin, Sintra Board, and Sticker orders with dimensions, quantities, and optional artwork. Administrators review orders, set prices, verify payment receipts, and manage production through final payment. Customers receive a private payment link after approval; payments and receipt verification are handled manually.

## Features

**Customer side**

- Order form with artwork upload and validated customer details, dimensions, and quantities.
- Private payment links showing the approved quote and downpayment information.
- Payment receipt upload, with a clear fallback for invalid or outdated links.
- Artwork formats: PDF, PNG, JPG/JPEG, PSD, AI, and EPS; receipt formats: PDF, PNG, and JPG/JPEG.

**Admin side**

- JWT-protected dashboard for order review, pricing, and lifecycle management.
- Artwork and receipt viewing, with manual receipt verification before printing.
- Messenger payment confirmation with an explicit confirmation prompt.
- Background approval emails, email status tracking, and manual resend while awaiting downpayment.
- Copy payment link reuses the current token; Rotate payment link invalidates the previous link and is blocked during an active email send.

## Order lifecycle

Pending Approval → Awaiting Downpayment → Payment Submitted → Printing → Completed → Fully Paid.

Admin actions approve and price orders, verify uploaded receipts, mark completion, and confirm final payment; the customer receipt upload enters Payment Submitted. For a receipt verified on Messenger, the admin can move Awaiting Downpayment directly to Printing. Other transitions are blocked.

## Tech stack

Versions below match the installed packages and committed lockfiles.

| Component | Technology |
| --- | --- |
| Client | React / React DOM 18.3.1, Vite 6.4.3, React Router DOM 6.30.3, Axios 1.13.6 |
| Server | Express 4.22.1, Mongoose 8.23.0 for MongoDB, JSON Web Token 9.0.3 |
| Uploads | Multer 2.3.0, Cloudinary SDK 2.11.0 |
| Email | Brevo HTTP API through native Node.js fetch; no email SDK |
| Deployment | Vercel for the client, Render for the server |

The MongoDB server version is not pinned by this repository.

## Project structure

- `client/` — React application, Vite configuration, and client environment example.
- `server/` — Express API, MongoDB models, upload handling, email integration, and server environment example.

## Getting started

### Prerequisites

- Node.js 22.13 or later within the 22.x series, or Node.js 24 or later, with npm. The client tooling also supports Node.js 20.19 or later within 20.x; Node.js 18 is insufficient for the current ESLint tooling.
- A reachable MongoDB database, locally or through MongoDB Atlas.
- A Cloudinary account for uploads; Brevo access and a verified sender for approval emails.

Both package manifests omit an engines declaration. The installed dependency engine ranges were checked with Node.js 22.14.0 and npm 10.9.2.

Use separate terminals for the server and client. Each set of commands starts from the repository root; do not install dependencies at the root.

### Server

On a fresh checkout, install the locked dependencies and copy the environment example (PowerShell):

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

If an environment file already exists, keep it and configure it privately. Fill in the startup settings in the table below, including MONGO_URI: the copied example leaves it empty, and an explicitly empty value fails validation. A local database fallback exists only when MONGO_URI is omitted. Configure the email settings to exercise approval emails; missing email settings record a failed email attempt without preventing approval or server startup.

Then, from `server/`, run:

```powershell
npm run dev
```

The server connects to MongoDB before listening. `npm start` runs the server without the development watcher.

### Client

In the second terminal, from the repository root:

```powershell
cd client
npm ci
Copy-Item .env.example .env
```

Keep any existing environment file. Configure VITE_API_URL privately if needed; it may be omitted for local development using the server's default port. It is required for builds and preview.

From `client/`, run:

```powershell
npm run dev
```

Open the local address printed by Vite. The configured development port is 3000.

Other available client scripts are `npm run build`, `npm run preview`, and `npm run lint`. There is no test script in either package.

Not verified: a fresh dependency installation or full startup against your MongoDB, Cloudinary, and Brevo accounts. Commands were checked against package scripts, matching lockfiles, and the standard npm and PowerShell commands. The current lint baseline has three existing errors.

## Environment variables

Use `server/.env.example` and `client/.env.example` as the templates. Keep actual values private; do not commit environment files. VITE-prefixed variables become public client configuration, so they must not contain secrets.

### Server

| Name | Required or optional | Purpose |
| --- | --- | --- |
| PORT | Optional | Listening port; must be valid when supplied. Render supplies the service port. |
| NODE_ENV | Required for production deployment; optional locally | Selects runtime mode and enables production configuration checks. |
| MONGO_URI | Required in production; optional locally if omitted | MongoDB connection string; an empty supplied value is invalid. |
| CLIENT_URL | Required in production; optional locally | Allowed client origins for CORS, separated by commas; entries are trimmed, trailing slashes removed, and validated as pure HTTP(S) origins. |
| CUSTOMER_PORTAL_URL | Required in production; optional locally | Canonical payment-link base; HTTPS required in production, with trailing slashes normalized. |
| ADMIN_PASSWORD | Required at startup | Shared admin login password. |
| JWT_SECRET | Required at startup | Signs and verifies admin access tokens. |
| CLOUDINARY_CLOUD_NAME | Required at startup | Cloudinary account identifier for uploads. |
| CLOUDINARY_API_KEY | Required at startup | Cloudinary API authentication. |
| CLOUDINARY_API_SECRET | Required at startup | Cloudinary API authentication secret. |
| EMAIL_USER | Required for approval emails | Sender address, verified with Brevo. |
| BREVO_API_KEY | Required for approval emails | Authenticates Brevo email requests. |
| BUSINESS_NAME | Optional | Business branding in approval emails. |
| GCASH_NAME | Required for approval emails | Account name included in payment instructions. |
| GCASH_NUMBER | Required for approval emails | Account identifier included in payment instructions. |
| BPI_NAME | Required for approval emails | Account name included in payment instructions. |
| BPI_ACCOUNT | Required for approval emails | Account identifier included in payment instructions. |
| FB_PAGE | Required for approval emails | HTTPS business contact destination in approval emails. |
| ORDER_ACCESS_RATE_LIMIT_ENABLED | Optional; disabled by default | Controls the per-IP private-link lookup and receipt-upload limiters. |
| ADMIN_LOGIN_RATE_LIMIT_ENABLED | Optional; disabled by default | Controls the per-IP admin login limiter. |

### Client

| Name | Required or optional | Purpose |
| --- | --- | --- |
| VITE_API_URL | Required for build, preview, and production; optional for local development | Absolute HTTP(S) backend base URL without credentials, a query, or a fragment. |

## Deployment

Deploy the client first, then the server.

- **Vercel:** root directory `client`, Vite framework, install command `npm ci`, build command `npm run build`, output directory `dist`. Configure VITE_API_URL before building. The existing rewrite configuration supports direct navigation to client routes.
- **Render:** Node web service with root directory `server`, build command `npm ci`, start command `npm start`, and health check path `/`. Use a compatible Node.js runtime, configure NODE_ENV for production, and supply all server settings marked required for production, startup, or approval emails above. The health endpoint reports readiness only while MongoDB is connected.
- Ensure CLIENT_URL permits the frontend origin and CUSTOMER_PORTAL_URL points to its HTTPS base. Leave both IP rate-limit flags disabled until proxy settings are confirmed and enabling them is explicitly approved.

Not verified: live hosting settings, deployed runtime versions, and end-to-end production behavior.

## Security notes

- Customer order lookup and receipt uploads require a private token; an order ID alone does not grant access. Treat payment links as credentials and keep them private.
- Admin APIs require a signed JWT from the shared-password login; tokens expire after 12 hours.
- Uploads validate extensions, MIME types, file signatures, and multipart request limits before Cloudinary storage.
- Both artwork and receipts are limited to 10 MB (10,000,000 bytes). PNG, JPG/JPEG, and PSD headers are checked against a 25-megapixel limit. PDF, AI, and EPS do not have an equivalent pixel-dimension precheck.
- IP rate limits exist but are disabled by default until proxy settings are confirmed. They use per-process memory, reset on restart, and do not share counts across instances.

## Known limitations

- Approval emails have no automatic retries; resends require an admin action while awaiting downpayment and a valid stored email and price.
- Accepted by the email provider is not confirmation of inbox delivery; interrupted or timed-out attempts may have an unknown outcome.
- Uploads are buffered in memory. Per-request limits exist, but aggregate memory across concurrent uploads is not bounded.
- Payment collection and receipt verification are manual; there is no payment gateway integration.

**Contributing:** Discuss proposed changes in an issue and submit a focused pull request.

**License:** To be decided.

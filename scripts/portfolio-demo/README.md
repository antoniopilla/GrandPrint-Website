# GrandPrint local screenshot demo

Opt-in screenshot setup for the actual product UI. It never imports `server/server.js`, never loads environment files, and never runs the normal Vite configuration. No product feature or case-study narrative is replaced.

## Fixed targets

- API: `http://127.0.0.1:5212`
- Client: `http://127.0.0.1:3212`
- MongoDB: `127.0.0.1:27027`, database `grandprint_portfolio_demo`, without credentials
- Local received-email viewer: `http://127.0.0.1:5212/portfolio-demo/mail`
- Generated artwork, receipt, uploaded files, received messages, and ownership marker: ignored `.portfolio-demo/`

Requires Node 22, the existing `client/node_modules` and `server/node_modules`, and a separately prepared MongoDB process on the fixed port. Never use another MongoDB instance or database. The launcher rejects target overrides and does not inherit application/service configuration into child processes. Production entrypoints and source remain unchanged.

## Inspect before running

From the product root:

```powershell
node scripts/portfolio-demo/cli.cjs inspect
node scripts/portfolio-demo/cli.cjs test
```

The test command does not connect to MongoDB, start the product, send email, or call external services. It exercises the real email renderer with an in-memory local receiver and resolves installed Vite under a sentinel that rejects environment-file reads before opening them. Review the target output and verify the separate empty local MongoDB runtime before continuing.

After that verification, seed once and start each service in its own terminal:

```powershell
node scripts/portfolio-demo/cli.cjs seed --confirm-local
node scripts/portfolio-demo/cli.cjs api --confirm-local
node scripts/portfolio-demo/cli.cjs client --confirm-local
```

Seeding only inserts missing fixture IDs. It never drops a database, deletes records, or resets orders that have been changed through the UI. Unknown database collections, unowned contents, and non-test recipient data stop setup. Existing generated files are reused only if they match; differing files stop setup. Storage children reject junctions/symlinks and redirected paths before writes. Assets are served through a generated-name/extension allowlist with lstat/realpath checks for each requested file; unexpected or linked entries also block subsequent upload writes. Upload cleanup retains local files. Every launcher installs a process-wide outbound TCP guard before importing app dependencies; only its reviewed loopback ports are allowed, covering clients using HTTP, HTTPS, SMTP, or raw sockets as well as fetch.

The admin login is a deliberately non-production fixture: password `portfolio-demo-only`; there is no username field. Customers use the public order form, not a customer sign-in. Seeded customer names are Sample Customer A through F, emails end in `@example.test`, and the dummy phone is `09000000000`.

Fixture assets are `.portfolio-demo/assets/sample-artwork.png` and `.portfolio-demo/assets/sample-payment-receipt.png`, visibly labeled as synthetic. Active orders cover Pending Approval, Awaiting Downpayment, Payment Submitted, Printing, and Completed. Use the admin app's Copy payment link for a valid local private link; never paste its token into screenshots or public documentation.

The real approval renderer is used. Its outbound provider call is intercepted before any external request and delivered by HTTP to the local mailbox receiver. The mail viewer shows messages actually received locally, not a standalone HTML preview. Approval remains labeled accepted by the real order workflow after local receipt. The original HTTPS-only social-link validator uses an inert loopback contact link; no external contact destination or real payout details are configured.

Vite uses `configFile: false`, `envDir: false`, and `envFile: false`, with a resolved-config assertion that environment loading remains disabled. It removes external font imports, replaces social destinations/phone placeholders only in its in-memory demo transform, and sends a local-only Content Security Policy. Outside this launcher, none of those transforms or service adapters apply.

Check `/portfolio-demo/health` on the local API before capture. It must report local uploads, local HTTP email capture, the fixed database/port, and no environment files loaded. Stop both launchers with Ctrl+C when finished. Do not delete local runtime files automatically, publish the demo services, or change product hosting settings.

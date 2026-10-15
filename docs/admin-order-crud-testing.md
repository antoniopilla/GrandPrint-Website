# Admin order CRUD verification

Use a development database, Cloudinary account, and test inboxes. Start the server and client using the existing README instructions, then sign in to `/admin`. Use disposable orders because permanent deletion cannot be undone. Keep the browser Network panel and server logs open. Cloudinary checks below require the real service; mocked regression tests do not establish that live assets were deleted.

## API routes

All new routes require the existing admin Bearer token:

| Method | Path | Purpose |
| --- | --- | --- |
| PUT | `/api/orders/:id` | Partial order details update; multipart form data with optional `designFile` |
| PUT | `/api/orders/:id/archive` | Archive an active order |
| PUT | `/api/orders/:id/restore` | Restore an archived order |
| DELETE | `/api/orders/:id` | Permanently delete an archived order and clean up its uploads |

`GET /api/orders` returns active orders. `GET /api/orders?archived=true` returns archived orders. Customer lookup and payment submission treat archived orders as not found.

For direct API checks, copy an authenticated request from the browser Network panel, change its method/path/form data, and replay it against the development server. Use the database `_id` for `:id`, not the public `GP-…` order number. Avoid sharing the copied token or private customer payment link.

## Manual checks

1. **Create and read.** Submit a valid customer order with a small PNG or PDF. Confirm the Active/Pending Approval list displays its details and uploaded design, with the newest order first. Save its `_id`, public order number, private payment link, and original Cloudinary URL/public ID. Invalid required details should still prevent customer creation.
2. **Text edits and partial updates.** Open Edit, change the name, contact number, notes, and email, then save. Check the card and a page refresh show the saved values. Directly submit only `notes` to confirm omitted fields are preserved, then an empty notes string to clear notes. Try empty name, invalid email, dimensions `0`/`101`, pieces `1.5`/`10001`, and notes over 5,000 characters. The UI or API must reject invalid values without changing the order; API validation is HTTP 400.
3. **Pending quote edits.** While Pending Approval, change product type, width, height, and pieces. Select a replacement design, inspect its preview, then save. Check the new design displays after refresh, the new Cloudinary asset exists, and the original asset is deleted. Cancel a second edit and verify nothing changes.
4. **Bad replacements.** Try a file over 10,000,000 bytes and a disallowed type such as `.exe` or `.txt`. Repeat through the API to bypass browser checks; also try a `.png` whose contents are not PNG and an image over 25 megapixels. Expect HTTP 400, no Cloudinary upload, and the existing details/design unchanged.
5. **Approved quote lock.** Approve the order with a price. For each of Awaiting Downpayment, Payment Submitted, Printing, Completed, and Fully Paid (use separate disposable orders or the normal lifecycle), confirm product, width, height, pieces, and replacement input are disabled and the lock explanation/current design are visible. Directly send five separate edits: a different product type, width, height, pieces, and a valid replacement file. Each must return HTTP 409, `code: "QUOTE_LOCKED"`, and the blocked field name(s). Verify the server/Cloudinary activity shows **no upload**, the quote/design stay unchanged, and an allowed text change bundled into a blocked request is also rejected.
6. **Unchanged full form on approved orders.** Save an approved order with all eight details fields, keeping pricing values unchanged. Also submit equivalent numeric strings such as `"2.0"` for stored `2`. These must succeed without a file or status change. Change name, valid contact number, and notes on an approved order and verify each persists. No price/status/approval-email mutation should occur.
7. **Email change while awaiting payment.** Change email on an Awaiting Downpayment order. A notice must identify the old address and offer Resend approval email. Verify no email is sent automatically. Click resend, confirm the existing duplicate warning when applicable, and check the email goes to the new address. During an in-progress send, a second resend must remain blocked by the existing handling.
8. **Email change at other statuses.** Change email on a Payment Submitted, Printing, Completed, or Fully Paid order. Check the notice explains that the quote/payment link went to the old address and direct customer contact is needed; it must have no resend button. On Pending Approval, an email edit must show no email-change notice. For any status, whitespace-only or case-only email differences must not create the hint.
9. **Protect server-owned fields.** Directly edit with `orderId`, `accessToken`, `status`, `price`, `paymentProof`, `approvalEmail`, `createdAt`, or `archivedAt` in the body (individually to stay within multipart field limits), and try an update operator key. The server must ignore or reject them and preserve every protected value. A permitted text field alongside an ignored field may still update. All new routes must reject malformed ObjectIds with HTTP 400, return HTTP 404 for missing orders with valid IDs, and require admin authentication.
10. **Archive and customer safety.** Archive an active order. It must disappear from Active and appear only under Archived; only Restore and Delete forever should be offered. Repeating archive returns HTTP 409. A direct edit of the archived order returns HTTP 409 and uploads nothing. Its authenticated customer lookup (`GET /api/orders/lookup/:orderId`) and payment submission (`PATCH /api/customers/pay/:orderId`) must return HTTP 404 even with its correct private access token.
11. **Restore.** Restore the archived order. It returns to its correct Active status tab with all details/files preserved, and the customer link works again. Repeating restore on an active order returns HTTP 409.
12. **Delete gate and confirmation.** Directly DELETE an active order: expect HTTP 409 and `code: "NOT_ARCHIVED"`, with the record and files intact. Archive it, select Delete forever, and cancel the confirmation to check nothing changes. Select it again and confirm that the dialog explicitly mentions permanent deletion, uploaded files, and that it cannot be undone.
13. **Permanent deletion and cleanup.** Use an archived order that has both a design and payment proof. Confirm deletion. It must disappear from Archived, remain absent after refresh, and both Cloudinary public IDs must be gone. A repeat DELETE returns HTTP 404. If a controlled Cloudinary cleanup failure is simulated, the database deletion must still succeed, the response must include `cleanupWarning`, the UI must show the warning, and the server must log the failure.
14. **Write/upload races and failure recovery.** In a development debugger, pause a Pending Approval replacement after upload and before its conditional database update; approve or archive the order, then resume. The update must fail (QUOTE_LOCKED when approved; archived conflict when archived), the new upload must be cleaned up, and the original design must survive. Simulate a rejected database write after upload and confirm new-upload cleanup. Simulate old-asset cleanup failure after a successful replacement: the edited order/new design must remain saved and the response/UI must include a cleanup warning. Concurrent archive/restore/delete requests must respect their atomic archived-state conditions.
15. **Responsive/accessibility checks.** At phone width and desktop width, test light/dark themes, long names/notes/filenames, edit scrolling, file preview, Save/Cancel/loading/error states, keyboard focus trapping, Escape/Cancel, and the destructive confirmation. No horizontal scrolling or inaccessible action buttons should appear. Refresh or switch views while requests run and confirm stale responses do not insert orders into the wrong view.

## Automated checks

Run the backend regression suite with `node --test server/tests/order-admin.test.js` from the repository root. It uses a local HTTP harness with mocked persistence and upload services; it must not contact the live database, send email, or upload/delete real files. Run `npm run lint` and `npm run build` from `client/` with the existing build environment configured.

Verified for this change: all 89 backend tests/subtests, full client lint, and the production build pass. Headless browser checks with mocked API responses also pass for pending and approved edits, file previews/rejections/clearing, status-dependent email hints and duplicate resend confirmation, quote-conflict refresh, archive/restore/delete, delayed-response races, mobile light/dark layouts, and keyboard focus. Actual Cloudinary deletion and email delivery remain live-service checks in the manual steps above.

## Changed files

| File | Change |
| --- | --- |
| `server/models/Order.js` | Adds the nullable, indexed archive timestamp. |
| `server/utils/orderValidation.js` | Supports partial edits using the same field whitelist, coercion, and validation as creation. |
| `server/controllers/orderController.js` | Adds CRUD handlers, active/archive filtering, quote locks, atomic state checks, replacement rollback, and cleanup warnings. |
| `server/routes/orderRoutes.js` | Registers four admin-only routes and reuses the existing design upload middleware/limits. |
| `server/config/cloudinary.js` | Recovers upload metadata from stored Cloudinary URLs for asset deletion. |
| `server/middleware/orderAccess.js` | Excludes archived orders from both customer access paths. |
| `server/tests/order-admin.test.js` | Adds HTTP regression coverage with real routing/auth/multipart validation and mocked storage services. |
| `client/src/adminApi.js` | Centralizes list, edit, archive, restore, and permanent-delete calls. |
| `client/src/apiErrors.js` | Adds public quote-lock and archive conflict messages. |
| `client/src/orderValidation.js` | Shares the existing customer detail validation rules with the editor. |
| `client/src/uploadLimits.js` | Adds accepted design formats and client replacement-file validation. |
| `client/src/pages/Admin/Dashboard.jsx` | Adds Active/Archived views, CRUD actions, email-change hints, feedback, and request-race handling. |
| `client/src/pages/Admin/OrderEditor.jsx` | Adds the responsive editor, approval locks, replacement previews, and save/error states. |
| `client/src/pages/Customer/OrderForm.jsx` | Imports the extracted validation rules without changing customer form behavior. |
| `client/src/ThemeToggle.jsx` | Removes an unused catch variable and documents storage failure handling so lint passes; theme behavior is unchanged. |
| `docs/admin-order-crud-testing.md` | Documents the new endpoints, every changed file, and the complete manual acceptance checklist. |

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminApi } from "../../adminApi";
import { getApiErrorMessage } from "../../apiErrors";
import { getApprovalEmailInfo, isValidApprovalEmail } from "../../approvalEmail";
import ThemeToggle from "../../ThemeToggle";
import { useIsMobile } from "../../useMediaQuery";
import { TriangleAlert, RefreshCw, Inbox, Printer, CircleCheck, Check } from "lucide-react";

const TABS = [
  { key: "pending",   label: "Pending Approval",   dot: "var(--orange)",  statuses: ["Pending Approval"] },
  { key: "ongoing",   label: "On-Going",            dot: "var(--blue)",    statuses: ["Awaiting Downpayment", "Payment Submitted", "Printing"] },
  { key: "completed", label: "Completed",           dot: "var(--green)",   statuses: ["Completed", "Fully Paid"] },
];

const STATUS = {
  "Pending Approval":     { label: "Pending",          color: "var(--orange)",  bg: "var(--orange-light)" },
  "Awaiting Downpayment": { label: "Awaiting Payment", color: "var(--blue)",    bg: "var(--blue-light)" },
  "Payment Submitted":    { label: "Verify Payment",   color: "var(--orange)", bg: "var(--orange-light)" },
  "Printing":             { label: "Printing",          color: "var(--purple)",  bg: "var(--purple-light)" },
  "Completed":            { label: "Completed",         color: "var(--green)",   bg: "var(--green-light)" },
  "Fully Paid":           { label: "Fully Paid",        color: "var(--text3)",   bg: "var(--bg3)" },
};

export default function AdminDashboard() {
  const nav = useNavigate();
  const adminApi = useMemo(() => createAdminApi(() => nav("/admin/login", { replace: true })), [nav]);
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false);
  const [listError, setListError] = useState("");
  const [modal, setModal] = useState(null); // order to approve
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [approving, setApproving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // orderId being updated
  const [linkLoading, setLinkLoading] = useState(null);
  const [linkNotice, setLinkNotice] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [emailLoading, setEmailLoading] = useState(null);
  const [emailNotice, setEmailNotice] = useState("");
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);
  const modalRef = useRef(null);
  const priceRef = useRef(null);
  const approvalTriggerRef = useRef(null);
  const refreshButtonRef = useRef(null);
  const isModalOpen = Boolean(modal);

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await adminApi.get("/api/orders");
      if (!Array.isArray(res.data)) throw new Error("Invalid orders response");
      setOrders(res.data);
      setHasLoadedOrders(true);
      setListError("");
    } catch (err) {
      if (err.response?.status === 401) return;
      setListError("Unable to load orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminApi]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 20000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  useEffect(() => {
    if (!isModalOpen) return;
    const dialog = modalRef.current;
    const trigger = approvalTriggerRef.current;
    const refreshButton = refreshButtonRef.current;
    const background = [sidebarRef.current, mainRef.current].filter(Boolean);
    const previousInert = background.map(element => element.inert);
    background.forEach(element => {
      if ("inert" in element) element.inert = true;
    });
    const focusableElements = () => Array.from(dialog.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const focusInside = () => {
      const target = !priceRef.current?.disabled ? priceRef.current : focusableElements()[0];
      (target || dialog).focus();
    };
    const handleKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        setModal(null);
      } else if (event.key === "Tab") {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const handleFocusIn = event => {
      if (!dialog.contains(event.target)) focusInside();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    focusInside();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      background.forEach((element, index) => {
        if ("inert" in element) element.inert = previousInert[index];
      });
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      else if (refreshButton?.isConnected) refreshButton.focus();
    };
  }, [isModalOpen]);

  const logout = () => {
    sessionStorage.removeItem("adminToken");
    nav("/admin/login", { replace: true });
  };

  const changeStatus = async (id, status) => {
    setActionLoading(id);
    try {
      await adminApi.put(`/api/orders/${id}/status`, { status });
      await fetchOrders();
    } catch (err) {
      if (err.response?.status === 401) return;
      if (err.response?.status === 409) await fetchOrders();
      alert(getApiErrorMessage(err, "Failed to update status. Try again."));
    } finally {
      setActionLoading(null);
    }
  };

  const doApprove = async () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      setPriceError("Enter a valid price.");
      priceRef.current?.focus();
      return;
    }
    const approvalOrderId = modal._id;
    setApproving(true);
    try {
      await adminApi.put(`/api/orders/${approvalOrderId}/approve`, { price: p });
      await fetchOrders();
      setModal(current => current?._id === approvalOrderId ? null : current);
    } catch (err) {
      if (err.response?.status === 401) return;
      if (err.response?.status === 409) await fetchOrders();
      alert(getApiErrorMessage(err, "Approval failed. Please try again."));
    } finally {
      setApproving(false);
    }
  };

  const copyPaymentLink = async (id, rotate = false) => {
    if (rotate && !window.confirm("Rotate this payment link? The previous link will stop working.")) return;
    setLinkLoading(id);
    setLinkNotice("");
    setManualLink("");
    try {
      const res = await adminApi.post(`/api/orders/${id}/access-link${rotate ? "/rotate" : ""}`, {});
      if (typeof res.data.paymentLink !== "string") throw new Error("Payment link unavailable");
      try {
        await navigator.clipboard.writeText(res.data.paymentLink);
        setLinkNotice(rotate ? "Link rotated and copied. The previous link is invalid." : "Payment link copied. Keep it private.");
      } catch {
        setManualLink(res.data.paymentLink);
        setLinkNotice(rotate ? "Link rotated. Copy the private link below; the previous link is invalid." : "Copy the private payment link below.");
      }
    } catch (err) {
      if (err.response?.status === 401) return;
      if (err.response?.status === 404) {
        setLinkNotice("Payment links are not available yet. Try again after the server update.");
      } else {
        setLinkNotice("Unable to get a payment link. Please try again.");
      }
    } finally {
      setLinkLoading(null);
    }
  };

  const resendApprovalEmail = async (order) => {
    if (!isValidApprovalEmail(order.email)) {
      setEmailNotice("Cannot resend: this order has a missing or invalid email address.");
      return;
    }
    const emailInfo = getApprovalEmailInfo(order);
    if (emailInfo?.isSending || emailLoading === order._id) {
      setEmailNotice("An approval email is already being sent. Please wait and refresh.");
      return;
    }
    const confirmDuplicate = Boolean(emailInfo?.requiresConfirmation);
    if (confirmDuplicate && !window.confirm("This approval email may already have been accepted by the email provider. Sending it again could create a duplicate email. Resend anyway?")) return;
    setEmailLoading(order._id);
    setEmailNotice("");
    try {
      await adminApi.post(`/api/orders/${order._id}/approval-email/resend`, { confirmDuplicate });
      setEmailNotice("Approval email send started. Refresh to check its status.");
      await fetchOrders();
    } catch (err) {
      if (err.response?.status === 401) return;
      if (err.response?.status === 409) await fetchOrders();
      setEmailNotice(err.response?.status === 404
        ? "Email resend is not available yet. Try again after the server update."
        : getApiErrorMessage(err, "Unable to resend the approval email. Please try again."));
    } finally {
      setEmailLoading(null);
    }
  };

  const currentTab = TABS.find(t => t.key === tab);
  const shown = orders.filter(o => currentTab.statuses.includes(o.status));
  const counts = Object.fromEntries(TABS.map(t => [t.key, orders.filter(o => t.statuses.includes(o.status)).length]));
  const totalPending = counts.pending || 0;

  return (
    <div style={{ ...s.root, ...(isMobile ? s.rootMobile : {}) }}>
      {/* ── Sidebar ── */}
      <aside ref={sidebarRef} style={{ ...s.sidebar, ...(isMobile ? s.sidebarMobile : {}) }}>
        <div style={{ ...s.sideHead, ...(isMobile ? s.sideHeadMobile : {}) }}>
          <div>
            <p style={s.sideEye}>Admin Panel</p>
            <p style={s.sideName}>GrandPrint</p>
          </div>
          {isMobile && (
            <button style={s.logoutBtnTop} onClick={logout}>Sign Out</button>
          )}
        </div>

        <nav style={{ ...s.nav, ...(isMobile ? s.navMobile : {}) }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...s.navBtn, ...(isMobile ? s.navBtnMobile : {}), ...(tab === t.key ? s.navBtnOn : {}) }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, background: t.dot, borderRadius: "50%", flexShrink: 0 }} />
                {t.label}
              </span>
              {counts[t.key] > 0 && (
                <span style={{ ...s.badge, background: tab === t.key ? "rgba(255,255,255,0.2)" : "var(--bg3)", color: tab === t.key ? "#fff" : "var(--text2)" }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </nav>

        {!isMobile && (
          <div style={s.sideBottom}>
            {totalPending > 0 && (
              <div style={s.alertBox}>
                <span style={{ fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><TriangleAlert size={14} /> {totalPending} pending</span>
                <span style={{ fontSize: 12, color: "var(--ink-warning)", opacity: 0.8 }}>Needs your approval</span>
              </div>
            )}
            <button style={s.logoutBtn} onClick={logout}>Sign Out</button>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main ref={mainRef} style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.header}>
          <div>
            <h1 style={{ ...s.pageTitle, ...(isMobile ? s.pageTitleMobile : {}) }}>{currentTab.label}</h1>
            {hasLoadedOrders && <p style={s.pageSub}>{shown.length} order{shown.length !== 1 ? "s" : ""}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <button ref={refreshButtonRef} style={s.refreshBtn} onClick={fetchOrders} disabled={refreshing} title="Refresh orders">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {linkNotice && (
          <div role="status" style={{ marginBottom: 16, color: "var(--text2)" }}>
            <p>{linkNotice}</p>
            {manualLink && (
              <input aria-label="Private payment link" readOnly value={manualLink} onFocus={e => e.target.select()} style={{ width: "100%", marginTop: 8 }} />
            )}
          </div>
        )}

        {emailNotice && (
          <p role="status" style={{ marginBottom: 16, color: "var(--text2)" }}>{emailNotice}</p>
        )}

        {listError && (
          <div role="alert" style={s.listError}>
            <p>{listError}</p>
            <button style={s.refreshBtn} onClick={fetchOrders} disabled={refreshing}>Retry</button>
          </div>
        )}

        {loading ? (
          <div style={s.empty}>Loading…</div>
        ) : !hasLoadedOrders ? null : shown.length === 0 ? (listError ? null : (
          <div style={s.empty}>
            <span style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--text3)" }}>
              {tab === "pending" ? <Inbox size={40} strokeWidth={1.5} /> : tab === "ongoing" ? <Printer size={40} strokeWidth={1.5} /> : <CircleCheck size={40} strokeWidth={1.5} />}
            </span>
            No orders here right now.
          </div>
        )) : (
          <div style={s.list}>
            {shown.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                actionLoading={actionLoading === order._id}
                onApprove={event => {
                  approvalTriggerRef.current = event.currentTarget;
                  setModal(order);
                  setPrice("");
                  setPriceError("");
                }}
                onStatusChange={changeStatus}
                onPaymentLink={copyPaymentLink}
                linkLoading={linkLoading === order._id}
                onResendEmail={resendApprovalEmail}
                emailLoading={emailLoading === order._id}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Approve Modal ── */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="approval-dialog-title" aria-describedby="approval-dialog-description" tabIndex={-1} style={{ ...s.modal, ...(isMobile ? s.modalMobile : {}) }} className="au" onClick={e => e.stopPropagation()}>
            <h2 id="approval-dialog-title" style={s.modalTitle}>Approve & Set Price</h2>
            <p id="approval-dialog-description" style={s.modalSub}>
              After approval, we’ll try to email the quote and payment instructions to <strong>{modal.email}</strong>. Check the email status in On-Going.
            </p>

            <div style={s.modalMeta}>
              <span style={{ fontWeight: 600 }}>{modal.productType}</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span>{modal.width}' × {modal.height}'</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span>{modal.pieces} pcs</span>
            </div>

            {/* Price input */}
            <label htmlFor="approval-price" style={s.priceLabel}>Price (₱)</label>
            <div style={s.priceBox}>
              <span style={s.peso}>₱</span>
              <input
                ref={priceRef}
                id="approval-price"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={price}
                onChange={e => {
                  setPrice(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));
                  setPriceError("");
                }}
                onBlur={() => {
                  if (!Number.isFinite(Number(price)) || Number(price) <= 0) setPriceError("Enter a valid price.");
                }}
                aria-invalid={Boolean(priceError)}
                aria-describedby={priceError ? "approval-price-error" : undefined}
                style={s.priceInput}
              />
            </div>
            {priceError && <p id="approval-price-error" role="alert" style={s.priceError}>{priceError}</p>}

            {/* Breakdown */}
            {Number(price) > 0 && (
              <div style={s.breakdown}>
                {[
                  ["Downpayment now (50%)", Number(price) * 0.5],
                  ["Balance on completion (50%)", Number(price) * 0.5],
                  ["Total", Number(price)],
                ].map(([label, val], i) => (
                  <div key={i} style={{ ...s.bRow, ...(i === 2 ? s.bRowTotal : {}) }}>
                    <span>{label}</span>
                    <span>₱{val.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button
                style={{ ...s.approveBtn, opacity: !Number.isFinite(Number(price)) || Number(price) <= 0 || approving ? 0.5 : 1 }}
                onClick={doApprove}
                disabled={!Number.isFinite(Number(price)) || Number(price) <= 0 || approving}
              >
                {approving ? "Approving…" : (<><Check size={16} /> Approve &amp; Email Client</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, onApprove, onStatusChange, actionLoading, onPaymentLink, linkLoading, onResendEmail, emailLoading }) {
  const sc = STATUS[order.status] || {};
  const date = new Date(order.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  const emailInfo = getApprovalEmailInfo(order);
  const invalidEmail = !isValidApprovalEmail(order.email);

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div style={s.customerDetails}>
          <p style={s.cardName}>{order.customerName}</p>
          <p style={s.cardEmail}>{order.email} · {order.contactNumber}</p>
        </div>
        <span style={{ ...s.statusPill, background: sc.bg, color: sc.color }}>{sc.label}</span>
      </div>

      {emailInfo && (
        <p style={{ marginBottom: 14, fontSize: 12, color: "var(--text2)" }}>
          Approval email: <span style={{ ...s.statusPill, background: "var(--bg3)", color: "var(--text2)", whiteSpace: "normal", display: "inline-block" }}>{emailInfo.label}</span>
        </p>
      )}
      {order.status === "Awaiting Downpayment" && invalidEmail && (
        <p style={{ marginBottom: 14, fontSize: 12, color: "var(--orange)" }}>
          Cannot resend: this order has a missing or invalid email address.
        </p>
      )}

      <div style={s.cardGrid}>
        {[
          ["Product", order.productType],
          ["Size", `${order.width}' × ${order.height}'`],
          ["Pieces", `${order.pieces} pcs`],
          ["Date", date],
          ...(order.price ? [["Price", `₱${Number(order.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`]] : []),
        ].map(([l, v]) => (
          <div key={l} style={{ minWidth: 0 }}>
            <p style={s.metaL}>{l}</p>
            <p style={{ ...s.metaV, fontWeight: l === "Price" ? 700 : 500 }}>{v}</p>
          </div>
        ))}
      </div>

      {order.notes && (
        <div style={s.notes}>
          <span style={s.notesLabel}>Notes</span>
          <p style={s.notesText}>{order.notes}</p>
        </div>
      )}

      <div style={s.cardFoot}>
        <span style={s.orderIdBadge}>{order.orderId}</span>
        <div style={s.actions}>
          {order.designFile && (
            <a
              href={order.designFile}
              target="_blank"
              rel="noopener noreferrer"
              style={s.fileLink}
            >
              View / Download Artwork
            </a>
          )}
          <ActionBtn color="var(--text2)" bg="var(--bg3)" onClick={() => onPaymentLink(order._id)} loading={linkLoading}>
            Copy payment link
          </ActionBtn>
          <ActionBtn color="var(--text2)" bg="var(--bg3)" onClick={() => onPaymentLink(order._id, true)} loading={linkLoading}>
            Rotate link
          </ActionBtn>
          {order.status === "Pending Approval" && (
            <ActionBtn color="var(--orange)" bg="var(--orange-light)" onClick={onApprove} loading={actionLoading}>
              Approve & Set Price →
            </ActionBtn>
          )}
          {order.status === "Awaiting Downpayment" && (
            <>
              <ActionBtn color="var(--text2)" bg="var(--bg3)" onClick={() => onResendEmail(order)} loading={emailLoading} disabled={invalidEmail || emailInfo?.isSending}>
                Resend approval email
              </ActionBtn>
              <ActionBtn color="var(--blue)" bg="var(--blue-light)" onClick={() => {
                if (window.confirm("Confirm you have seen and verified the receipt on Messenger?")) {
                  onStatusChange(order._id, "Printing");
                }
              }} loading={actionLoading}>
                Confirm Payment (Messenger) → Start Printing
              </ActionBtn>
            </>
          )}
          {order.status === "Payment Submitted" && (
            <>
              {order.paymentProof && (
                <a
                  href={order.paymentProof}
                  target="_blank"
                  rel="noreferrer"
                  style={s.fileLink}
                >
                  View Receipt
                </a>
              )}
              <ActionBtn color="var(--orange)" bg="var(--orange-light)" onClick={() => onStatusChange(order._id, "Printing")} loading={actionLoading}>
                Verify Payment → Start Printing
              </ActionBtn>
            </>
          )}
          {order.status === "Printing" && (
            <ActionBtn color="var(--purple)" bg="var(--purple-light)" onClick={() => onStatusChange(order._id, "Completed")} loading={actionLoading}>
              Mark as Completed
            </ActionBtn>
          )}
          {order.status === "Completed" && (
            <ActionBtn color="var(--green)" bg="var(--green-light)" onClick={() => onStatusChange(order._id, "Fully Paid")} loading={actionLoading}>
              Confirm Final Payment <Check size={14} />
            </ActionBtn>
          )}
          {order.status === "Fully Paid" && (
            <span style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>Order complete</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, color, bg, onClick, loading, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{ background: bg, color, border: "none", borderRadius: "var(--r-sm)", padding: "9px 16px", fontSize: 13, fontWeight: 600, fontFamily: "var(--font)", opacity: loading || disabled ? 0.6 : 1, transition: "opacity .15s", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere", flexWrap: "wrap" }}
    >
      {loading ? "…" : children}
    </button>
  );
}

const s = {
  root: { display: "flex", minWidth: 0, minHeight: "100vh", background: "var(--bg2)", fontFamily: "var(--font)" },
  sidebar: { width: 230, background: "var(--ink)", display: "flex", flexDirection: "column", padding: "28px 16px", position: "sticky", top: 0, height: "100vh", flexShrink: 0 },
  sideHead: { marginBottom: 32, padding: "0 8px" },
  sideEye: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  sideName: { fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" },
  nav: { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  navBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", textAlign: "left", width: "100%", transition: "all .15s", cursor: "pointer" },
  navBtnOn: { background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 600 },
  badge: { borderRadius: 980, padding: "2px 8px", fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center" },
  sideBottom: { display: "flex", flexDirection: "column", gap: 8 },
  alertBox: { background: "rgba(255,159,10,0.15)", border: "1px solid rgba(255,159,10,0.3)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: 13, color: "var(--ink-warning)", display: "flex", flexDirection: "column", gap: 2 },
  logoutBtn: { background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "var(--r-sm)", padding: "10px", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", width: "100%", cursor: "pointer", fontFamily: "var(--font)" },
  main: { flex: 1, minWidth: 0, padding: "40px 40px 60px", overflow: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 },
  pageTitle: { fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 2 },
  pageSub: { fontSize: 13, color: "var(--text2)" },
  refreshBtn: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 980, padding: "8px 16px", fontSize: 13, fontWeight: 500, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)", display: "inline-flex", alignItems: "center", gap: 6 },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  listError: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: 16, marginBottom: 16, color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  card: { background: "var(--bg)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)", padding: "24px 28px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 },
  customerDetails: { minWidth: 0, flex: "1 1 150px" },
  cardName: { fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 3, overflowWrap: "anywhere" },
  cardEmail: { fontSize: 13, color: "var(--text2)", overflowWrap: "anywhere" },
  statusPill: { borderRadius: 980, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "normal", maxWidth: "100%", overflowWrap: "anywhere" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 14, padding: "16px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 14 },
  metaL: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 4 },
  metaV: { fontSize: 14, color: "var(--text)", overflowWrap: "anywhere" },
  notes: { background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 13px", marginBottom: 14 },
  notesLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text3)", display: "block", marginBottom: 4 },
  notesText: { fontSize: 13, color: "var(--text2)", lineHeight: 1.5, overflowWrap: "anywhere" },
  cardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  orderIdBadge: { fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", maxWidth: "100%", overflowWrap: "anywhere" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0, maxWidth: "100%" },
  fileLink: { fontSize: 13, fontWeight: 600, color: "var(--text2)", alignSelf: "center", maxWidth: "100%", overflowWrap: "anywhere" },
  empty: { background: "var(--bg)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)", padding: "80px 40px", textAlign: "center", color: "var(--text3)", fontSize: 15 },
  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "36px", width: "100%", minWidth: 0, maxWidth: 420, maxHeight: "calc(100dvh - 40px)", overflowY: "auto" },
  modalTitle: { fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 },
  modalSub: { fontSize: 14, color: "var(--text2)", lineHeight: 1.65, marginBottom: 18, overflowWrap: "anywhere" },
  modalMeta: { display: "flex", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--text2)", background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 20, flexWrap: "wrap" },
  priceBox: { display: "flex", alignItems: "center", background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "4px 16px", marginBottom: 12 },
  priceLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text2)", marginBottom: 6 },
  priceError: { fontSize: 13, color: "var(--orange)", marginBottom: 12 },
  peso: { fontSize: 20, fontWeight: 700, color: "var(--text2)", marginRight: 4 },
  priceInput: { flex: 1, minWidth: 0, background: "transparent", border: "none", fontSize: 30, fontWeight: 800, fontFamily: "var(--font)", color: "var(--text)", padding: "12px 0", letterSpacing: "-0.02em", width: "100%" },
  breakdown: { background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 8 },
  bRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)", flexWrap: "wrap", gap: 8, overflowWrap: "anywhere" },
  bRowTotal: { borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4, fontSize: 15, fontWeight: 700, color: "var(--text)" },
  modalBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  cancelBtn: { flex: 1, background: "var(--bg2)", border: "none", borderRadius: 980, padding: "12px", fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)" },
  approveBtn: { flex: 2, background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", transition: "opacity .15s", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },

  // ── Responsive (mobile ≤640px): sidebar becomes a top bar ──
  rootMobile: { flexDirection: "column" },
  sidebarMobile: { width: "100%", height: "auto", position: "static", flexDirection: "column", padding: "14px 16px 12px", gap: 12 },
  sideHeadMobile: { marginBottom: 0, padding: 0, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  logoutBtnTop: { background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "var(--r-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", cursor: "pointer", fontFamily: "var(--font)", whiteSpace: "nowrap", flexShrink: 0 },
  navMobile: { flexDirection: "row", flex: "none", gap: 8, overflowX: "auto", paddingBottom: 2 },
  navBtnMobile: { flex: "none", width: "auto", whiteSpace: "nowrap", gap: 8, padding: "8px 12px" },
  mainMobile: { padding: "20px 16px 40px" },
  pageTitleMobile: { fontSize: 22 },
  modalMobile: { padding: 20 },
};

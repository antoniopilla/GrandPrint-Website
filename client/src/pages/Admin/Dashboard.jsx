import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";

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

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
});

export default function AdminDashboard() {
  const nav = useNavigate();
  const [tab, setTab] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // order to approve
  const [price, setPrice] = useState("");
  const [approving, setApproving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // orderId being updated

  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/orders`, authHeaders());
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        sessionStorage.removeItem("adminToken");
        nav("/admin/login", { replace: true });
        return;
      }
      console.error("Failed to fetch orders:", err.message);
    } finally {
      setLoading(false);
    }
  }, [nav]);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 20000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  const logout = () => {
    sessionStorage.removeItem("adminToken");
    nav("/admin/login", { replace: true });
  };

  const changeStatus = async (id, status) => {
    setActionLoading(id);
    try {
      await axios.put(`${API}/api/orders/${id}/status`, { status }, authHeaders());
      await fetchOrders();
    } catch (err) {
      alert("Failed to update status. Try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const doApprove = async () => {
    const p = Number(price);
    if (!p || p <= 0) return alert("Enter a valid price.");
    setApproving(true);
    try {
      await axios.put(`${API}/api/orders/${modal._id}/approve`, { price: p }, authHeaders());
      setModal(null);
      setPrice("");
      await fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || "Approval failed. Check server logs.");
    } finally {
      setApproving(false);
    }
  };

  const currentTab = TABS.find(t => t.key === tab);
  const shown = orders.filter(o => currentTab.statuses.includes(o.status));
  const counts = Object.fromEntries(TABS.map(t => [t.key, orders.filter(o => t.statuses.includes(o.status)).length]));
  const totalPending = counts.pending || 0;

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sideHead}>
          <p style={s.sideEye}>Admin Panel</p>
          <p style={s.sideName}>GrandPrint</p>
        </div>

        <nav style={s.nav}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...s.navBtn, ...(tab === t.key ? s.navBtnOn : {}) }}
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

        <div style={s.sideBottom}>
          {totalPending > 0 && (
            <div style={s.alertBox}>
              <span style={{ fontWeight: 700 }}>⚠ {totalPending} pending</span>
              <span style={{ fontSize: 12, color: "var(--orange)", opacity: 0.8 }}>Needs your approval</span>
            </div>
          )}
          <button style={s.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>{currentTab.label}</h1>
            <p style={s.pageSub}>{shown.length} order{shown.length !== 1 ? "s" : ""}</p>
          </div>
          <button style={s.refreshBtn} onClick={fetchOrders} title="Refresh orders">
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div style={s.empty}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={s.empty}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>
              {tab === "pending" ? "🎉" : tab === "ongoing" ? "🖨️" : "✅"}
            </span>
            No orders here right now.
          </div>
        ) : (
          <div style={s.list}>
            {shown.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                actionLoading={actionLoading === order._id}
                onApprove={() => { setModal(order); setPrice(""); }}
                onStatusChange={changeStatus}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Approve Modal ── */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modal} className="au" onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Approve & Set Price</h2>
            <p style={s.modalSub}>
              An email with the quote and payment instructions will be sent automatically to <strong>{modal.email}</strong>.
            </p>

            <div style={s.modalMeta}>
              <span style={{ fontWeight: 600 }}>{modal.productType}</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span>{modal.width}' × {modal.height}'</span>
              <span style={{ color: "var(--text3)" }}>·</span>
              <span>{modal.pieces} pcs</span>
            </div>

            {/* Price input */}
            <div style={s.priceBox}>
              <span style={s.peso}>₱</span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                style={s.priceInput}
                autoFocus
              />
            </div>

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
                style={{ ...s.approveBtn, opacity: !price || approving ? 0.5 : 1 }}
                onClick={doApprove}
                disabled={!price || approving}
              >
                {approving ? "Sending…" : "✓ Approve & Email Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, onApprove, onStatusChange, actionLoading }) {
  const sc = STATUS[order.status] || {};
  const date = new Date(order.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div>
          <p style={s.cardName}>{order.customerName}</p>
          <p style={s.cardEmail}>{order.email} · {order.contactNumber}</p>
        </div>
        <span style={{ ...s.statusPill, background: sc.bg, color: sc.color }}>{sc.label}</span>
      </div>

      <div style={s.cardGrid}>
        {[
          ["Product", order.productType],
          ["Size", `${order.width}' × ${order.height}'`],
          ["Pieces", `${order.pieces} pcs`],
          ["Date", date],
          ...(order.price ? [["Price", `₱${Number(order.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`]] : []),
        ].map(([l, v]) => (
          <div key={l}>
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
          {order.status === "Pending Approval" && (
            <ActionBtn color="var(--orange)" bg="var(--orange-light)" onClick={onApprove} loading={actionLoading}>
              Approve & Set Price →
            </ActionBtn>
          )}
          {order.status === "Awaiting Downpayment" && (
            <ActionBtn color="var(--blue)" bg="var(--blue-light)" onClick={() => onStatusChange(order._id, "Printing")} loading={actionLoading}>
              Confirm Payment → Start Printing
            </ActionBtn>
          )}
          {order.status === "Payment Submitted" && (
            <>
              {order.paymentProof && (
                <a
                  href={order.paymentProof}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)", alignSelf: "center" }}
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
              Confirm Final Payment ✓
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

function ActionBtn({ children, color, bg, onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{ background: bg, color, border: "none", borderRadius: "var(--r-sm)", padding: "9px 16px", fontSize: 13, fontWeight: 600, fontFamily: "var(--font)", opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}
    >
      {loading ? "…" : children}
    </button>
  );
}

const s = {
  root: { display: "flex", minHeight: "100vh", background: "var(--bg2)", fontFamily: "var(--font)" },
  sidebar: { width: 230, background: "var(--text)", display: "flex", flexDirection: "column", padding: "28px 16px", position: "sticky", top: 0, height: "100vh", flexShrink: 0 },
  sideHead: { marginBottom: 32, padding: "0 8px" },
  sideEye: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 },
  sideName: { fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" },
  nav: { display: "flex", flexDirection: "column", gap: 3, flex: 1 },
  navBtn: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", textAlign: "left", width: "100%", transition: "all .15s", cursor: "pointer" },
  navBtnOn: { background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 600 },
  badge: { borderRadius: 980, padding: "2px 8px", fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: "center" },
  sideBottom: { display: "flex", flexDirection: "column", gap: 8 },
  alertBox: { background: "rgba(255,159,10,0.15)", border: "1px solid rgba(255,159,10,0.3)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: 13, color: "var(--orange)", display: "flex", flexDirection: "column", gap: 2 },
  logoutBtn: { background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "var(--r-sm)", padding: "10px", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", width: "100%", cursor: "pointer", fontFamily: "var(--font)" },
  main: { flex: 1, padding: "40px 40px 60px", overflow: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  pageTitle: { fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 2 },
  pageSub: { fontSize: 13, color: "var(--text2)" },
  refreshBtn: { background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 980, padding: "8px 16px", fontSize: 13, fontWeight: 500, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)" },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  card: { background: "var(--bg)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)", padding: "24px 28px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  cardName: { fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 3 },
  cardEmail: { fontSize: 13, color: "var(--text2)" },
  statusPill: { borderRadius: 980, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", whiteSpace: "nowrap" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 14, padding: "16px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 14 },
  metaL: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 4 },
  metaV: { fontSize: 14, color: "var(--text)" },
  notes: { background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 13px", marginBottom: 14 },
  notesLabel: { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text3)", display: "block", marginBottom: 4 },
  notesText: { fontSize: 13, color: "var(--text2)", lineHeight: 1.5 },
  cardFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  orderIdBadge: { fontSize: 11, fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  empty: { background: "var(--bg)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)", padding: "80px 40px", textAlign: "center", color: "var(--text3)", fontSize: 15 },
  // Modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "36px", width: "100%", maxWidth: 420 },
  modalTitle: { fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 },
  modalSub: { fontSize: 14, color: "var(--text2)", lineHeight: 1.65, marginBottom: 18 },
  modalMeta: { display: "flex", gap: 8, fontSize: 13, fontWeight: 500, color: "var(--text2)", background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "10px 14px", marginBottom: 20, flexWrap: "wrap" },
  priceBox: { display: "flex", alignItems: "center", background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "4px 16px", marginBottom: 12 },
  peso: { fontSize: 20, fontWeight: 700, color: "var(--text2)", marginRight: 4 },
  priceInput: { flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 30, fontWeight: 800, fontFamily: "var(--font)", color: "var(--text)", padding: "12px 0", letterSpacing: "-0.02em", width: "100%" },
  breakdown: { background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 8 },
  bRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)" },
  bRowTotal: { borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4, fontSize: 15, fontWeight: 700, color: "var(--text)" },
  modalBtns: { display: "flex", gap: 10 },
  cancelBtn: { flex: 1, background: "var(--bg2)", border: "none", borderRadius: 980, padding: "12px", fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font)" },
  approveBtn: { flex: 2, background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", transition: "opacity .15s" },
};
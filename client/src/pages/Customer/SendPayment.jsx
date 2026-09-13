import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import ThemeToggle from "../../ThemeToggle";
import { Check } from "lucide-react";

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function SendPayment() {
  const nav = useNavigate();
  const { orderId: paramOrderId } = useParams();

  const [orderId, setOrderId] = useState(paramOrderId || "");
  const [file, setFile] = useState(null);
  const [order, setOrder] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const fetchOrder = useCallback(async (id) => {
    const lookupId = (id ?? orderId).trim();
    if (!lookupId) return;
    setLooking(true);
    setNotFound(false);
    setSubmitError("");
    try {
      const res = await axios.get(`${API}/api/orders/lookup/${lookupId}`);
      setOrder(res.data);
    } catch (err) {
      setOrder(null);
      setNotFound(true);
    } finally {
      setLooking(false);
    }
  }, [orderId]);

  // Auto-look up when arriving via /pay/:orderId
  useEffect(() => {
    if (paramOrderId) fetchOrder(paramOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramOrderId]);

  const submitPayment = async () => {
    if (!file) return alert("Please upload your payment receipt first.");
    setSubmitting(true);
    setSubmitError("");
    const formData = new FormData();
    formData.append("paymentProof", file);

    try {
      await axios.patch(`${API}/api/customers/pay/${order.orderId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err.response?.data?.message || "Failed to submit payment. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const dp = order?.price ? Number(order.price) * 0.5 : 0;

  return (
    <div style={s.root}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <span style={s.brand} onClick={() => nav("/")}>GrandPrint</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={s.homeLink} onClick={() => nav("/")}>Home</button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div style={s.wrap}>
        <div style={s.card} className="au">
          {submitted ? (
            <div style={s.doneBox}>
              <div style={s.check}><Check size={30} strokeWidth={3} /></div>
              <h1 style={s.title}>Payment Submitted!</h1>
              <p style={s.sub}>
                Thanks! We've received your receipt for order{" "}
                <strong>{order.orderId}</strong> and will verify it shortly.
                You'll move into production once it's confirmed.
              </p>
              <button style={s.primaryBtn} onClick={() => nav("/")}>Back to Home</button>
            </div>
          ) : (
            <>
              <p style={s.eyebrow}>Send Payment</p>
              <h1 style={s.title}>Submit your downpayment receipt</h1>
              <p style={s.sub}>
                Enter your Order ID to pull up your order, then upload a
                screenshot of your GCash or BPI payment.
              </p>

              {/* Lookup */}
              <div style={s.lookupRow}>
                <input
                  style={s.input}
                  placeholder="e.g. GP-123456"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value.toUpperCase().replace(/\s/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && fetchOrder()}
                />
                <button
                  style={{ ...s.checkBtn, opacity: looking || !orderId.trim() ? 0.5 : 1 }}
                  onClick={() => fetchOrder()}
                  disabled={looking || !orderId.trim()}
                >
                  {looking ? "Checking…" : "Check Order"}
                </button>
              </div>

              {notFound && (
                <p style={s.errorNote}>Order not found. Please double-check your Order ID.</p>
              )}

              {order && (
                <div style={s.orderBox}>
                  <div style={s.orderHead}>
                    <div>
                      <p style={s.orderName}>{order.customerName}</p>
                      <p style={s.orderMeta}>
                        {order.productType}
                        {order.width && order.height ? ` · ${order.width}' × ${order.height}'` : ""}
                        {order.pieces ? ` · ${order.pieces} pcs` : ""}
                      </p>
                    </div>
                    <span style={s.orderIdBadge}>{order.orderId}</span>
                  </div>

                  {order.price ? (
                    <div style={s.breakdown}>
                      <div style={s.bRow}>
                        <span>Total</span>
                        <span>{peso(order.price)}</span>
                      </div>
                      <div style={{ ...s.bRow, ...s.bRowHi }}>
                        <span>Downpayment due now (50%)</span>
                        <span>{peso(dp)}</span>
                      </div>
                    </div>
                  ) : null}

                  {order.status === "Awaiting Downpayment" ? (
                    <div style={s.payArea}>
                      <label style={s.fileLabel}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setFile(e.target.files[0])}
                          style={{ display: "none" }}
                        />
                        <span style={s.fileBtn}>
                          {file ? (<><Check size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{file.name}</>) : "Choose receipt image"}
                        </span>
                      </label>

                      <button
                        style={{ ...s.primaryBtn, opacity: submitting || !file ? 0.5 : 1 }}
                        onClick={submitPayment}
                        disabled={submitting || !file}
                      >
                        {submitting ? "Submitting…" : "Submit Payment"}
                      </button>
                      {submitError && <p style={s.errorNote}>{submitError}</p>}
                    </div>
                  ) : (
                    <div style={s.statusNote}>
                      This order isn't awaiting a downpayment right now (status:{" "}
                      <strong>{order.status}</strong>).
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg2)", display: "flex", flexDirection: "column" },
  nav: { borderBottom: "1px solid var(--border)", background: "var(--nav-bg)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 },
  navInner: { maxWidth: 1000, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" },
  brand: { fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em", cursor: "pointer" },
  homeLink: { background: "none", border: "none", fontSize: 14, fontWeight: 500, color: "var(--text2)", padding: "6px 12px", borderRadius: 8 },
  wrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px" },
  card: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "clamp(28px,6vw,44px) clamp(22px,5vw,40px)", width: "100%", maxWidth: 480 },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, marginBottom: 10 },
  sub: { fontSize: 15, color: "var(--text2)", lineHeight: 1.65, marginBottom: 28 },
  lookupRow: { display: "flex", gap: 10 },
  input: { flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "13px 16px", fontSize: 15, color: "var(--text)", outline: "none" },
  checkBtn: { background: "var(--ink)", color: "var(--ink-text)", border: "none", borderRadius: "var(--r-sm)", padding: "0 20px", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" },
  errorNote: { color: "var(--red)", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  orderBox: { marginTop: 24, background: "var(--bg2)", borderRadius: "var(--r)", padding: "22px" },
  orderHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  orderName: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 3 },
  orderMeta: { fontSize: 13, color: "var(--text2)" },
  orderIdBadge: { fontSize: 11, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.06em", whiteSpace: "nowrap" },
  breakdown: { background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 },
  bRow: { display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--text2)" },
  bRowHi: { borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2, fontWeight: 700, color: "var(--text)" },
  payArea: { display: "flex", flexDirection: "column", gap: 12 },
  fileLabel: { display: "block" },
  fileBtn: { display: "block", background: "var(--bg)", border: "1px dashed var(--border)", borderRadius: "var(--r-sm)", padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "var(--text2)", textAlign: "center", wordBreak: "break-all" },
  primaryBtn: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "14px", fontSize: 15, fontWeight: 600, width: "100%", transition: "opacity .15s" },
  statusNote: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6, background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "14px 16px" },
  doneBox: { textAlign: "center" },
  check: { width: 60, height: 60, background: "var(--green)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", fontWeight: 700, margin: "0 auto 24px" },
};

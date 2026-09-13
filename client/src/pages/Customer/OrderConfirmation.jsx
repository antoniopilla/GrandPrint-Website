import { useNavigate, useLocation } from "react-router-dom";
import ThemeToggle from "../../ThemeToggle";
import { Check, Mail } from "lucide-react";

export default function OrderConfirmation() {
  const nav = useNavigate();
  const { state } = useLocation();
  const order = state?.order;

  if (!order) { nav("/"); return null; }

  return (
    <div style={s.root}>
      <ThemeToggle floating />
      <div style={s.card} className="au">
        <div style={s.check}><Check size={30} strokeWidth={3} /></div>
        <h1 style={s.title}>Order Submitted!</h1>
        <p style={s.sub}>
          Thank you, <strong>{order.customerName}</strong>. We've received your order and will review it shortly.
        </p>

        <div style={s.idBox}>
          <span style={s.idLabel}>Your Order ID</span>
          <span style={s.id}>{order.orderId}</span>
          <span style={s.idNote}>Keep this for reference</span>
        </div>

        <div style={s.timeline}>
          <p style={s.timelineTitle}>What happens next</p>
          {NEXT.map((n, i) => (
            <div key={i} style={s.timelineRow}>
              <div style={s.dot} />
              <div>
                <p style={s.nHead}>{n.head}</p>
                <p style={s.nBody}>{n.body}</p>
              </div>
            </div>
          ))}
        </div>

        <p style={s.emailNote}>
          <Mail size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Price quote will be sent to <strong>{order.email}</strong>
        </p>

        <button style={s.btn} onClick={() => nav("/")}>Back to Home</button>
        <button style={s.payLink} onClick={() => nav(`/pay/${order.orderId}`)}>
          Already received your quote? Submit payment →
        </button>
      </div>
    </div>
  );
}

const NEXT = [
  { head: "Order Review", body: "Our team checks your order details and prepares a quote." },
  { head: "Email Quote", body: "You'll receive an email with the total price and payment options." },
  { head: "Send Downpayment", body: "Pay 50% via GCash or BPI and send receipt to our Facebook page." },
  { head: "We Print", body: "Production begins immediately after downpayment is confirmed." },
  { head: "Pickup & Final Payment", body: "Pay the remaining 50% when your order is ready." },
];

const s = {
  root: { minHeight: "100vh", background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" },
  card: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "clamp(32px,7vw,48px) clamp(24px,5vw,40px)", width: "100%", maxWidth: 480, textAlign: "center" },
  check: { width: 60, height: 60, background: "var(--green)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", fontWeight: 700, margin: "0 auto 24px" },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 10 },
  sub: { fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 28 },
  idBox: { background: "var(--bg2)", borderRadius: "var(--r)", padding: "20px", marginBottom: 28, display: "flex", flexDirection: "column", gap: 4 },
  idLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text3)" },
  id: { fontSize: 26, fontWeight: 800, letterSpacing: "0.04em", color: "var(--blue)" },
  idNote: { fontSize: 12, color: "var(--text3)" },
  timeline: { textAlign: "left", marginBottom: 20 },
  timelineTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 14 },
  timelineRow: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  dot: { width: 8, height: 8, background: "var(--blue)", borderRadius: "50%", marginTop: 6, flexShrink: 0 },
  nHead: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  nBody: { fontSize: 13, color: "var(--text2)", lineHeight: 1.5 },
  emailNote: { fontSize: 13, background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "12px 16px", marginBottom: 24, color: "var(--text2)", lineHeight: 1.6 },
  btn: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "13px 32px", fontSize: 15, fontWeight: 600 },
  payLink: { display: "block", margin: "16px auto 0", background: "none", border: "none", color: "var(--text2)", fontSize: 14, fontWeight: 500 },
};
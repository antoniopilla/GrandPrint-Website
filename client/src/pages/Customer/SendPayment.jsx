import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import { getApiErrorMessage } from "../../apiErrors";
import ThemeToggle from "../../ThemeToggle";
import { Check, Upload } from "lucide-react";
import { capturePaymentToken, forgetPaymentToken } from "../../paymentAccess";
import { MAX_UPLOAD_BYTES, FILE_SIZE_MESSAGE, MESSENGER_URL as CONTACT_URL, getUploadErrorMessage } from "../../uploadLimits";

const INVALID_LINK = "This payment link is invalid or outdated. Please contact GrandPrint";

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function SendPayment() {
  const nav = useNavigate();
  const { orderId: paramOrderId } = useParams();
  const location = useLocation();

  const [accessToken, setAccessToken] = useState("");
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);
  const [order, setOrder] = useState(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    setOrder(null);
    setFile(null);
    setSubmitted(false);
    setInvalidLink(false);
    setLookupError("");
    setSubmitError("");
    const { token, hasFragmentToken } = capturePaymentToken(paramOrderId, location.hash);
    if (hasFragmentToken) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    setAccessToken(token);
    if (!paramOrderId || !token) {
      setInvalidLink(true);
      setLooking(false);
      return () => { active = false; };
    }

    setLooking(true);
    axios.get(`${API}/api/orders/lookup/${encodeURIComponent(paramOrderId)}`, {
      headers: { "X-Order-Access-Token": token },
    }).then((res) => {
      if (active) setOrder(res.data);
    }).catch((err) => {
      if (!active) return;
      if (err.response?.status === 404 || err.response?.status === 401 || err.response?.status === 403) {
        forgetPaymentToken(paramOrderId);
        setAccessToken("");
        setInvalidLink(true);
      } else {
        setLookupError("Unable to load your payment link. Please try again later.");
      }
    }).finally(() => {
      if (active) setLooking(false);
    });
    return () => { active = false; };
  }, [paramOrderId, location.hash]);

  const rejectOversizeFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setSubmitError(FILE_SIZE_MESSAGE);
  };

  const pickFile = (e) => {
    setSubmitError("");
    const pickedFile = e.target.files[0] || null;
    if (pickedFile?.size > MAX_UPLOAD_BYTES) {
      e.target.value = "";
      rejectOversizeFile();
      return;
    }
    setFile(pickedFile);
  };

  const submitPayment = async () => {
    if (!order || !accessToken || looking) return;
    if (!file) return alert("Please upload your payment receipt first.");
    if (file.size > MAX_UPLOAD_BYTES) {
      rejectOversizeFile();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const formData = new FormData();
    formData.append("paymentProof", file);

    try {
      await axios.patch(`${API}/api/customers/pay/${encodeURIComponent(order.orderId)}`, formData, {
        headers: { "Content-Type": "multipart/form-data", "X-Order-Access-Token": accessToken },
      });
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 401 || err.response?.status === 403) {
        forgetPaymentToken(order.orderId);
        setAccessToken("");
        setOrder(null);
        setFile(null);
        setInvalidLink(true);
      } else {
        setSubmitError(getUploadErrorMessage(err, getApiErrorMessage(err, "Failed to submit payment. Please try again.")));
      }
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
                Open the private payment link from your quote email, then upload a
                screenshot of your GCash or BPI payment.
              </p>

              {looking && <p style={s.statusNote}>Checking payment link…</p>}
              {invalidLink && (
                <div style={s.statusNote}>
                  <p>{INVALID_LINK}</p>
                  <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" style={s.contactLink}>
                    Chat with GrandPrint on Messenger
                  </a>
                </div>
              )}
              {lookupError && <p style={s.errorNote}>{lookupError}</p>}

              {order && (
                <div style={s.orderBox}>
                  <div style={s.orderHead}>
                    <div>
                      <p style={s.orderName}>Order details</p>
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
                          ref={fileInput}
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={pickFile}
                          style={{ display: "none" }}
                        />
                        <span style={s.fileBtn}>
                          {file ? (<><Check size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{file.name}</>) : (<><Upload size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />Upload receipt</>)}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text3)" }}>JPG/JPEG, PNG, PDF — max 10 MB</span>
                      </label>

                      <button
                        style={{ ...s.primaryBtn, opacity: submitting || looking || !file ? 0.5 : 1 }}
                        onClick={submitPayment}
                        disabled={submitting || looking || !file}
                      >
                        {submitting ? "Submitting…" : "Submit Payment"}
                      </button>
                      {submitError && (
                        <div role="alert" style={s.errorNote}>
                          <p>{submitError}</p>
                          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" style={s.contactLink}>
                            Chat with GrandPrint on Messenger
                          </a>
                        </div>
                      )}
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
  contactLink: { display: "inline-block", marginTop: 12, color: "var(--blue)", fontWeight: 600 },
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
  fileLabel: { display: "block", cursor: "pointer" },
  fileBtn: { display: "block", background: "var(--bg)", border: "1px dashed var(--border)", borderRadius: "var(--r-sm)", padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "var(--text2)", textAlign: "center", wordBreak: "break-all", cursor: "pointer" },
  primaryBtn: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "14px", fontSize: 15, fontWeight: 600, width: "100%", transition: "opacity .15s" },
  statusNote: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6, background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "14px 16px" },
  doneBox: { textAlign: "center" },
  check: { width: 60, height: 60, background: "var(--green)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", fontWeight: 700, margin: "0 auto 24px" },
};

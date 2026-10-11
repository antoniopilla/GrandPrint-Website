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

  const [retryVersion, setRetryVersion] = useState(0);
  const contextKey = JSON.stringify([paramOrderId || "", location.hash, retryVersion]);
  const [lookup, setLookup] = useState(null);
  const [selection, setSelection] = useState(null);
  const fileInput = useRef(null);
  const lookupSequence = useRef(0);
  const submission = useRef(null);
  const [submitAttempt, setSubmitAttempt] = useState(null);
  const [receiptError, setReceiptError] = useState(null);
  const context = lookup?.key === contextKey ? lookup : null;
  const order = context?.order || null;
  const accessToken = context?.token || "";
  const file = selection?.key === contextKey ? selection.file : null;
  const looking = !context || context.status === "loading";
  const invalidLink = context?.status === "invalid";
  const lookupError = context?.error || "";
  const submitting = submitAttempt?.key === contextKey;
  const submitError = receiptError?.key === contextKey ? receiptError.message : "";
  const submitted = context?.submitted || false;

  useEffect(() => {
    let active = true;
    const sequence = ++lookupSequence.current;
    submission.current = null;
    setSelection(null);
    if (fileInput.current) fileInput.current.value = "";
    setSubmitAttempt(null);
    setReceiptError(null);
    const { token, hasFragmentToken } = capturePaymentToken(paramOrderId, location.hash);
    if (hasFragmentToken) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    const cleanup = () => {
      active = false;
      if (lookupSequence.current === sequence) lookupSequence.current += 1;
    };
    if (!paramOrderId || !token) {
      setLookup({ key: contextKey, status: "invalid" });
      return cleanup;
    }

    setLookup({ key: contextKey, status: "loading", token });
    axios.get(`${API}/api/orders/lookup/${encodeURIComponent(paramOrderId)}`, {
      headers: { "X-Order-Access-Token": token },
    }).then((res) => {
      if (!active || lookupSequence.current !== sequence) return;
      if (res.data?.orderId !== paramOrderId) {
        setLookup({ key: contextKey, status: "error", token, error: "Unable to load your payment link. Please try again later." });
        return;
      }
      setLookup({ key: contextKey, status: "ready", token, order: res.data });
    }).catch((err) => {
      if (!active || lookupSequence.current !== sequence) return;
      if (err.response?.status === 404 || err.response?.status === 401 || err.response?.status === 403) {
        forgetPaymentToken(paramOrderId);
        setLookup({ key: contextKey, status: "invalid" });
      } else {
        setLookup({ key: contextKey, status: "error", token, error: "Unable to load your payment link. Please try again later." });
      }
    });
    return cleanup;
  }, [paramOrderId, location.hash, contextKey]);

  const rejectOversizeFile = () => {
    setSelection(null);
    if (fileInput.current) fileInput.current.value = "";
    setReceiptError({ key: contextKey, message: FILE_SIZE_MESSAGE });
  };

  const pickFile = (e) => {
    if (!order || !accessToken || looking || submitting || order.status !== "Awaiting Downpayment") {
      e.target.value = "";
      return;
    }
    setReceiptError(null);
    const pickedFile = e.target.files[0] || null;
    if (pickedFile?.size > MAX_UPLOAD_BYTES) {
      e.target.value = "";
      rejectOversizeFile();
      return;
    }
    setSelection({ key: contextKey, file: pickedFile });
  };

  const submitPayment = async () => {
    if (!order || order.orderId !== paramOrderId || order.status !== "Awaiting Downpayment" || !accessToken || looking || submission.current?.key === contextKey) return;
    if (!file) {
      setReceiptError({ key: contextKey, message: "Please upload your payment receipt first." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      rejectOversizeFile();
      return;
    }
    const attempt = { key: contextKey, sequence: lookupSequence.current };
    submission.current = attempt;
    setSubmitAttempt(attempt);
    setReceiptError(null);
    const isCurrentAttempt = () => submission.current === attempt && lookupSequence.current === attempt.sequence;
    const formData = new FormData();
    formData.append("paymentProof", file);

    try {
      await axios.patch(`${API}/api/customers/pay/${encodeURIComponent(order.orderId)}`, formData, {
        headers: { "Content-Type": "multipart/form-data", "X-Order-Access-Token": accessToken },
      });
      if (!isCurrentAttempt()) return;
      setLookup((current) => current?.key === contextKey ? { ...current, submitted: true } : current);
    } catch (err) {
      if (!isCurrentAttempt()) return;
      if (err.response?.status === 404 || err.response?.status === 401 || err.response?.status === 403) {
        forgetPaymentToken(order.orderId);
        setLookup({ key: contextKey, status: "invalid" });
        setSelection(null);
        if (fileInput.current) fileInput.current.value = "";
      } else {
        setReceiptError({ key: contextKey, message: getUploadErrorMessage(err, getApiErrorMessage(err, "Failed to submit payment. Please try again.")) });
      }
    } finally {
      if (isCurrentAttempt()) {
        submission.current = null;
        setSubmitAttempt(null);
      }
    }
  };

  const dp = order?.price ? Number(order.price) * 0.5 : 0;

  return (
    <div style={s.root}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <button type="button" style={s.brand} onClick={() => nav("/")}>GrandPrint</button>
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

              {looking && <p role="status" style={s.statusNote}>Checking payment link…</p>}
              {invalidLink && (
                <div style={s.statusNote}>
                  <p>{INVALID_LINK}</p>
                  <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" style={s.contactLink}>
                    Chat with GrandPrint on Messenger
                  </a>
                </div>
              )}
              {lookupError && (
                <div style={s.errorNote}>
                  <p role="alert">{lookupError}</p>
                  <button type="button" style={s.retryBtn} onClick={() => setRetryVersion((version) => version + 1)}>Retry</button>
                </div>
              )}

              {order && (
                <div style={s.orderBox}>
                  <div style={s.orderHead}>
                    <div style={{ minWidth: 0 }}>
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
                      <div style={s.fileLabel}>
                        <label htmlFor="payment-receipt" className="sr-only">Payment receipt</label>
                        <input
                          id="payment-receipt"
                          ref={fileInput}
                          type="file"
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={pickFile}
                          disabled={submitting || looking}
                          aria-describedby={`receipt-hint${submitError ? " receipt-error" : ""}`}
                          aria-invalid={!!submitError}
                          hidden
                        />
                        <button
                          type="button"
                          style={s.fileBtn}
                          onClick={() => fileInput.current?.click()}
                          disabled={submitting || looking}
                          aria-label={file ? `Change receipt: ${file.name}` : "Upload receipt"}
                          aria-describedby={`receipt-hint${submitError ? " receipt-error" : ""}`}
                        >
                          {file ? (<><Check aria-hidden="true" size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{file.name}</>) : (<><Upload aria-hidden="true" size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />Upload receipt</>)}
                        </button>
                        <span id="receipt-hint" style={{ fontSize: 12, color: "var(--text3)" }}>JPG/JPEG, PNG, PDF — max 10 MB</span>
                      </div>

                      <button
                        style={{ ...s.primaryBtn, opacity: submitting || looking || !file ? 0.5 : 1 }}
                        onClick={submitPayment}
                        disabled={submitting || looking || !file}
                      >
                        {submitting ? "Submitting…" : "Submit Payment"}
                      </button>
                      {submitError && (
                        <div id="receipt-error" role="alert" style={s.errorNote}>
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
  root: { minHeight: "100vh", minWidth: 0, background: "var(--bg2)", display: "flex", flexDirection: "column" },
  nav: { borderBottom: "1px solid var(--border)", background: "var(--nav-bg)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 },
  navInner: { maxWidth: 1000, minWidth: 0, margin: "0 auto", padding: "0 clamp(12px,5vw,32px)", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" },
  brand: { background: "none", border: "none", padding: 0, color: "var(--text)", fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em", cursor: "pointer" },
  homeLink: { background: "none", border: "none", fontSize: 14, fontWeight: 500, color: "var(--text2)", padding: "6px 12px", borderRadius: 8 },
  wrap: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 20px" },
  card: { minWidth: 0, overflowWrap: "anywhere", background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "clamp(28px,6vw,44px) clamp(22px,5vw,40px)", width: "100%", maxWidth: 480 },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.15, marginBottom: 10 },
  sub: { fontSize: 15, color: "var(--text2)", lineHeight: 1.65, marginBottom: 28 },
  contactLink: { display: "inline-block", marginTop: 12, color: "var(--blue)", fontWeight: 600 },
  errorNote: { color: "var(--red)", fontSize: 13, marginTop: 12, lineHeight: 1.5 },
  orderBox: { minWidth: 0, marginTop: 24, background: "var(--bg2)", borderRadius: "var(--r)", padding: "clamp(14px,4vw,22px)" },
  orderHead: { minWidth: 0, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  orderName: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 3 },
  orderMeta: { fontSize: 13, color: "var(--text2)" },
  orderIdBadge: { minWidth: 0, overflowWrap: "anywhere", fontSize: 11, fontWeight: 700, color: "var(--blue)", letterSpacing: "0.06em" },
  breakdown: { background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 },
  bRow: { minWidth: 0, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", fontSize: 14, color: "var(--text2)" },
  bRowHi: { borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2, fontWeight: 700, color: "var(--text)" },
  payArea: { display: "flex", flexDirection: "column", gap: 12 },
  fileLabel: { display: "block", cursor: "pointer" },
  fileBtn: { display: "block", width: "100%", minWidth: 0, background: "var(--bg)", border: "1px dashed var(--border)", borderRadius: "var(--r-sm)", padding: "14px 16px", fontSize: 14, fontWeight: 500, color: "var(--text2)", textAlign: "center", overflowWrap: "anywhere", cursor: "pointer" },
  retryBtn: { background: "var(--bg)", color: "var(--blue)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "8px 16px", marginTop: 10, fontSize: 14, fontWeight: 600 },
  primaryBtn: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "14px", fontSize: 15, fontWeight: 600, width: "100%", transition: "opacity .15s" },
  statusNote: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6, background: "var(--bg)", borderRadius: "var(--r-sm)", padding: "14px 16px" },
  doneBox: { textAlign: "center" },
  check: { width: 60, height: 60, background: "var(--green)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: "#fff", fontWeight: 700, margin: "0 auto 24px" },
};

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import ThemeToggle from "../../ThemeToggle";

const STEPS = ["Your Details", "Order Info", "Review & Submit"];

// ── Validators ──────────────────────────────────────────────────────────────
const validate = {
  customerName: (v) => {
    if (!v.trim()) return "Full name is required.";
    if (v.trim().length < 2) return "Name must be at least 2 characters.";
    if (/^\d+$/.test(v.trim())) return "Name cannot be only numbers.";
    return null;
  },
  email: (v) => {
    if (!v.trim()) return "Email address is required.";
    // RFC 5322-lite: local@domain.tld
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()))
      return "Enter a valid email address (e.g. you@email.com).";
    return null;
  },
  contactNumber: (v) => {
    if (!v.trim()) return "Contact number is required.";
    // Accept 09XXXXXXXXX or +639XXXXXXXXX
    const digits = v.replace(/[\s\-]/g, "");
    if (!/^(\+63|0)(9\d{9})$/.test(digits))
      return "Enter a valid PH mobile number (e.g. 09171234567).";
    return null;
  },
};

// ── Live input formatters (restrict/normalize as the user types) ──────────────
// Title Case: strictly one uppercase letter per word, everything else lowercase.
const formatName = (v) =>
  v
    .replace(/[^\p{L}\s'.-]/gu, "")               // letters, spaces, apostrophe, period, hyphen only
    .replace(/\s{2,}/g, " ")                       // collapse repeated spaces
    .toLowerCase()
    .replace(/(^|[\s'.-])\p{L}/gu, (m) => m.toUpperCase());

// Phone: digits only, with an optional leading "+"; capped at +63XXXXXXXXXX length.
const formatPhone = (v) =>
  v.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 13);

const onlyDigits = (v) => v.replace(/\D/g, "");
// Decimal: digits and a single dot (for dimensions in feet).
const formatDecimal = (v) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const FORMATTERS = {
  customerName: formatName,
  contactNumber: formatPhone,
  pieces: onlyDigits,
  width: formatDecimal,
  height: formatDecimal,
};

export default function OrderForm() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    customerName: "", email: "", contactNumber: "",
    productType: "", width: "", height: "", pieces: "", notes: "",
  });

  const set = (e) => {
    const { name, value } = e.target;
    const fmt = FORMATTERS[name];
    setForm(f => ({ ...f, [name]: fmt ? fmt(value) : value }));
  };
  const touch = (name) => setTouched(t => ({ ...t, [name]: true }));

  // Per-field errors (only shown after blur/touch)
  const errors = {
    customerName: validate.customerName(form.customerName),
    email: validate.email(form.email),
    contactNumber: validate.contactNumber(form.contactNumber),
  };

  const step0Valid =
    !errors.customerName && !errors.email && !errors.contactNumber;
  const step1OK =
    form.productType &&
    Number(form.width) > 0 &&
    Number(form.height) > 0 &&
    Number(form.pieces) > 0 &&
    file;

  // Touch all step-0 fields to show errors on attempted Continue
  const attemptStep0 = () => {
    setTouched({ customerName: true, email: true, contactNumber: true });
    if (step0Valid) setStep(s => s + 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("designFile", file);
      const res = await axios.post(`${API}/api/orders`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      nav("/order/done", { state: { order: res.data } });
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={s.root}>
      {/* Nav */}
      <nav style={s.nav}>
        <button style={s.back} onClick={() => step === 0 ? nav("/") : setStep(s => s - 1)}>
          ← {step === 0 ? "Home" : "Back"}
        </button>
        <span style={s.navTitle}>New Order</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={s.navStep}>{step + 1} / {STEPS.length}</span>
          <ThemeToggle />
        </div>
      </nav>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Card */}
      <div style={s.wrap}>
        <div style={s.card} className="au" key={step}>
          {/* Step labels */}
          <div style={s.stepLabels}>
            {STEPS.map((label, i) => (
              <span key={label} style={{
                ...s.stepLabel,
                color: i === step ? "var(--text)" : "var(--text3)",
                fontWeight: i === step ? 700 : 400,
              }}>
                {i < step ? "✓ " : ""}{label}
              </span>
            ))}
          </div>

          {/* ── STEP 0: Details ── */}
          {step === 0 && (
            <div>
              <h2 style={s.title}>Your Details</h2>
              <p style={s.subtitle}>We'll use this info to contact you about your order.</p>
              <div style={s.fields}>
                <Field
                  label="Full Name"
                  name="customerName"
                  value={form.customerName}
                  onChange={set}
                  onBlur={() => touch("customerName")}
                  placeholder="e.g. Juan dela Cruz"
                  error={touched.customerName ? errors.customerName : null}
                />
                <Field
                  label="Email Address"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={set}
                  onBlur={() => touch("email")}
                  placeholder="you@email.com"
                  error={touched.email ? errors.email : null}
                />
                <Field
                  label="Contact Number"
                  name="contactNumber"
                  type="tel"
                  inputMode="tel"
                  value={form.contactNumber}
                  onChange={set}
                  onBlur={() => touch("contactNumber")}
                  placeholder="09171234567"
                  error={touched.contactNumber ? errors.contactNumber : null}
                />
              </div>
            </div>
          )}

          {/* ── STEP 1: Order Info ── */}
          {step === 1 && (
            <div>
              <h2 style={s.title}>Order Info</h2>
              <p style={s.subtitle}>Tell us what you need and upload your design.</p>
              <div style={s.fields}>
                {/* Product picker */}
                <div style={s.fieldWrap}>
                  <label style={s.label}>Product Type</label>
                  <div style={s.productGrid}>
                    {["Tarpaulin", "Sintra Board", "Sticker"].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, productType: p }))}
                        style={{
                          ...s.productBtn,
                          ...(form.productType === p ? s.productBtnOn : {}),
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dimensions */}
                <div style={s.fieldWrap}>
                  <label style={s.label}>Dimensions <span style={{ color: "var(--text3)", fontWeight: 400 }}>(in feet)</span></label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input name="width" type="text" inputMode="decimal" placeholder="Width" value={form.width} onChange={set} style={s.input} />
                    <span style={{ color: "var(--text3)", fontSize: 18, flexShrink: 0 }}>×</span>
                    <input name="height" type="text" inputMode="decimal" placeholder="Height" value={form.height} onChange={set} style={s.input} />
                  </div>
                </div>

                <Field label="Number of Pieces" name="pieces" type="text" inputMode="numeric" value={form.pieces} onChange={set} placeholder="1" />

                {/* File upload */}
                <div style={s.fieldWrap}>
                  <label style={s.label}>Design File</label>
                  <label style={{ ...s.uploadBox, ...(file ? s.uploadBoxDone : {}) }}>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf,.ai,.psd,.svg,.eps" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
                    {file ? (
                      <>
                        <span style={{ fontSize: 24 }}>✓</span>
                        <span style={{ fontWeight: 600, color: "var(--blue)", fontSize: 14 }}>{file.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text3)" }}>Click to change</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 24, color: "var(--text3)" }}>↑</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Click to upload design</span>
                        <span style={{ fontSize: 12, color: "var(--text3)" }}>JPG, PNG, PDF, AI, PSD — max 20MB</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Notes */}
                <div style={s.fieldWrap}>
                  <label style={s.label}>Notes <span style={{ color: "var(--text3)", fontWeight: 400 }}>(optional)</span></label>
                  <textarea name="notes" value={form.notes} onChange={set} placeholder="Special instructions, color preferences, finishing details..." rows={3} style={{ ...s.input, resize: "vertical", lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Review ── */}
          {step === 2 && (
            <div>
              <h2 style={s.title}>Review Your Order</h2>
              <p style={s.subtitle}>Confirm your details before submitting.</p>

              <div style={s.reviewBox}>
                <Section label="Contact">
                  <Row l="Name" v={form.customerName} />
                  <Row l="Email" v={form.email} />
                  <Row l="Phone" v={form.contactNumber} />
                </Section>
                <div style={s.divider} />
                <Section label="Print Order">
                  <Row l="Product" v={form.productType} />
                  <Row l="Size" v={`${form.width} ft × ${form.height} ft`} />
                  <Row l="Pieces" v={`${form.pieces} pcs`} />
                  {form.notes && <Row l="Notes" v={form.notes} />}
                  {file && <Row l="Design" v={file.name} />}
                </Section>
              </div>

              <div style={s.notice}>
                <span>💡</span>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text2)" }}>
                  Once submitted, our team will review your order and email you a price quote. A <strong>50% downpayment</strong> is needed to start production.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={s.btnRow}>
            {step < 2 ? (
              <button
                style={{
                  ...s.btnPrimary,
                  opacity: (step === 1 && !step1OK) ? 0.45 : 1,
                }}
                onClick={step === 0 ? attemptStep0 : () => setStep(s => s + 1)}
                disabled={step === 1 && !step1OK}
              >
                Continue →
              </button>
            ) : (
              <button
                style={{ ...s.btnPrimary, opacity: submitting ? 0.6 : 1 }}
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : "Submit Order"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, onBlur, placeholder, min, error, inputMode }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        min={min}
        style={{
          ...s.input,
          borderColor: error ? "var(--red)" : "transparent",
        }}
      />
      {error && (
        <span style={s.errorMsg}>⚠ {error}</span>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ l, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ fontSize: 14, color: "var(--text2)" }}>{l}</span>
      <span style={{ fontSize: 14, fontWeight: 500, textAlign: "right", wordBreak: "break-word", maxWidth: "60%" }}>{v}</span>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg2)", display: "flex", flexDirection: "column" },
  nav: { background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" },
  back: { background: "none", border: "none", fontSize: 14, fontWeight: 500, color: "var(--blue)", padding: "6px 0" },
  navTitle: { fontWeight: 700, fontSize: 15 },
  navStep: { fontSize: 13, color: "var(--text3)", fontWeight: 500 },
  progressBar: { height: 3, background: "var(--bg3)" },
  progressFill: { height: "100%", background: "var(--blue)", transition: "width 0.35s ease", borderRadius: 2 },
  wrap: { flex: 1, display: "flex", justifyContent: "center", padding: "40px 20px 60px" },
  card: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "clamp(24px,5vw,40px) clamp(22px,5vw,40px) clamp(24px,5vw,32px)", width: "100%", maxWidth: 520 },
  stepLabels: { display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap" },
  stepLabel: { fontSize: 12, transition: "all 0.2s" },
  title: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "var(--text2)", marginBottom: 28, lineHeight: 1.5 },
  fields: { display: "flex", flexDirection: "column", gap: 18 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 13, fontWeight: 600 },
  input: { background: "var(--bg2)", border: "1.5px solid transparent", borderRadius: "var(--r-sm)", padding: "12px 14px", fontSize: 15, color: "var(--text)", outline: "none", width: "100%", transition: "border-color .15s" },
  errorMsg: { fontSize: 12, color: "var(--red)", fontWeight: 500, marginTop: 2 },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 },
  productBtn: { background: "var(--bg2)", border: "1.5px solid transparent", borderRadius: "var(--r-sm)", padding: "11px 8px", fontSize: 13, fontWeight: 500, color: "var(--text2)", transition: "all .15s" },
  productBtnOn: { background: "var(--blue-light)", border: "1.5px solid var(--blue)", color: "var(--blue)", fontWeight: 700 },
  uploadBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "28px", background: "var(--bg2)", border: "2px dashed var(--border)", borderRadius: "var(--r)", cursor: "pointer", textAlign: "center" },
  uploadBoxDone: { background: "var(--blue-light)", border: "2px dashed var(--blue)" },
  reviewBox: { background: "var(--bg2)", borderRadius: "var(--r)", padding: "22px", marginBottom: 20 },
  divider: { height: 1, background: "var(--border)", margin: "16px 0" },
  notice: { display: "flex", gap: 10, alignItems: "flex-start", background: "var(--orange-light)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 28 },
  btnRow: { marginTop: 24, display: "flex", justifyContent: "flex-end" },
  btnPrimary: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "13px 28px", fontSize: 15, fontWeight: 600, transition: "all .15s" },
};

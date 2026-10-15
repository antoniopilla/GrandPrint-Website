import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../apiErrors";
import { PRODUCT_TYPES, validateOrderFields } from "../../orderValidation";
import { DESIGN_FILE_ACCEPT, getUploadErrorMessage, validateDesignFile } from "../../uploadLimits";
import { useIsMobile } from "../../useMediaQuery";

const QUOTE_FIELDS = ["productType", "width", "height", "pieces"];

export default function OrderEditor({ order, dialogRef, busyRef, onClose, onSave, onQuoteLocked }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(() => Object.fromEntries(
    Object.keys(validateOrderFields).map(name => [name, String(order[name] ?? "")])
  ));
  const [touched, setTouched] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [quoteConflict, setQuoteConflict] = useState(false);
  const formRef = useRef(null);
  const fileRef = useRef(null);
  const quoteLocked = order.status !== "Pending Approval" || quoteConflict;
  const errors = Object.fromEntries(Object.entries(validateOrderFields).map(([name, validate]) => [name, validate(form[name])]));

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    setServerErrors(current => ({ ...current, [name]: undefined }));
  };

  const pickFile = (event) => {
    const picked = event.target.files?.[0] || null;
    const message = validateDesignFile(picked);
    setFileError(message);
    setFile(message ? null : picked);
    if (message) event.target.value = "";
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || busyRef.current) return;
    setTouched(Object.fromEntries(Object.keys(validateOrderFields).map(name => [name, true])));
    const firstInvalid = Object.keys(errors).find(name => errors[name]);
    if (firstInvalid) {
      formRef.current?.elements.namedItem(firstInvalid)?.focus();
      return;
    }
    const uploadError = validateDesignFile(file);
    if (uploadError || fileError) {
      setFileError(uploadError || fileError);
      fileRef.current?.focus();
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([name, value]) => data.append(name, value.trim()));
    if (file && !quoteLocked) data.append("designFile", file);
    setSaving(true);
    busyRef.current = true;
    setError("");
    setServerErrors({});
    try {
      await onSave(order, data);
    } catch (err) {
      if (err.response?.status === 401) return;
      setError(getUploadErrorMessage(err, getApiErrorMessage(err, "Unable to save the order. Please try again.")));
      const fieldErrors = err.response?.data?.errors;
      if (fieldErrors && typeof fieldErrors === "object" && !Array.isArray(fieldErrors)) {
        setServerErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([name, message]) =>
          Object.prototype.hasOwnProperty.call(validateOrderFields, name) && typeof message === "string"
        )));
      }
      if (err.response?.status === 409 && err.response?.data?.code === "QUOTE_LOCKED") {
        setQuoteConflict(true);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        const latest = await onQuoteLocked(order._id);
        if (latest) setForm(current => ({ ...current, ...Object.fromEntries(QUOTE_FIELDS.map(name => [name, String(latest[name] ?? "")])) }));
      }
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const field = (name, label, options = {}) => {
    const message = serverErrors[name] || (touched[name] ? errors[name] : null);
    const disabled = saving || (quoteLocked && QUOTE_FIELDS.includes(name));
    const common = {
      id: `edit-${name}`, name, value: form[name], onChange: changeField,
      onBlur: () => setTouched(current => ({ ...current, [name]: true })), disabled,
      "aria-invalid": Boolean(message), "aria-describedby": message ? `edit-${name}-error` : undefined,
      style: { ...s.input, ...(disabled ? s.disabled : {}), ...(message ? { borderColor: "var(--red)" } : {}) },
    };
    return (
      <div style={s.field}>
        <label htmlFor={common.id} style={s.label}>{label}</label>
        {name === "productType" ? (
          <select {...common}>
            <option value="">Choose a product</option>
            {PRODUCT_TYPES.map(product => <option key={product} value={product}>{product}</option>)}
          </select>
        ) : name === "notes" ? (
          <textarea {...common} rows={4} style={{ ...common.style, resize: "vertical" }} />
        ) : <input {...common} type="text" {...options} />}
        {message && <p id={`edit-${name}-error`} style={s.fieldError}>{message}</p>}
      </div>
    );
  };

  return (
    <div style={s.overlay} onClick={() => { if (!busyRef.current) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title" aria-describedby="edit-dialog-description" tabIndex={-1} style={{ ...s.modal, padding: isMobile ? 20 : 32 }} onClick={event => event.stopPropagation()}>
        <h2 id="edit-dialog-title" style={s.title}>Edit Order</h2>
        <p id="edit-dialog-description" style={s.description}>{order.orderId} · {order.status}</p>
        <form ref={formRef} onSubmit={save} noValidate>
          <div style={s.fields}>
            {field("customerName", "Full Name", { autoComplete: "name" })}
            {field("email", "Email Address", { inputMode: "email", autoComplete: "email" })}
            {field("contactNumber", "Contact Number", { inputMode: "tel", autoComplete: "tel" })}
            {quoteLocked && (
              <p id="edit-quote-lock" style={s.notice}>The product, size, quantity, and design file are locked after approval because the customer has already been quoted.</p>
            )}
            {field("productType", "Product Type")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {field("width", "Width (feet)", { inputMode: "decimal" })}
              {field("height", "Height (feet)", { inputMode: "decimal" })}
            </div>
            {field("pieces", "Number of Pieces", { inputMode: "numeric" })}
            <div style={s.field}>
              <span style={s.label}>Current Design File</span>
              {order.designFile ? <a href={order.designFile} target="_blank" rel="noopener noreferrer" style={s.link}>View / Download Current Artwork</a> : <span style={s.hint}>No design file attached.</span>}
              <label htmlFor="edit-designFile" style={{ ...s.label, marginTop: 8 }}>Replace File <span style={s.hint}>(optional)</span></label>
              <input ref={fileRef} id="edit-designFile" name="designFile" type="file" accept={DESIGN_FILE_ACCEPT} disabled={saving || quoteLocked} onChange={pickFile} aria-invalid={Boolean(fileError)} aria-describedby={`edit-file-hint${fileError ? " edit-file-error" : ""}${quoteLocked ? " edit-quote-lock" : ""}`} style={{ ...s.fileInput, ...((saving || quoteLocked) ? s.disabled : {}) }} />
              <span id="edit-file-hint" style={s.hint}>PDF, PNG, JPG/JPEG, PSD, AI, EPS — max 10 MB. Leave empty to keep the current file.</span>
              {fileError && (
                <>
                  <p id="edit-file-error" role="alert" style={s.fieldError}>{fileError}</p>
                  <button type="button" disabled={saving} style={{ ...s.removeBtn, alignSelf: "flex-start" }} onClick={() => { setFile(null); setFileError(""); if (fileRef.current) fileRef.current.value = ""; }}>Keep current file and clear replacement</button>
                </>
              )}
              {file && preview && (
                <div style={s.preview}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>Replacement: {file.name}</p>
                  {/\.(png|jpe?g)$/i.test(file.name) && <img src={preview} alt="Replacement design preview" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8 }} />}
                  <a href={preview} target="_blank" rel="noopener noreferrer" style={s.link}>Preview replacement file</a>
                  <button type="button" disabled={saving} style={s.removeBtn} onClick={() => { setFile(null); setFileError(""); if (fileRef.current) fileRef.current.value = ""; }}>Remove replacement</button>
                </div>
              )}
            </div>
            {field("notes", "Notes (optional)")}
          </div>
          {error && <p role="alert" style={{ ...s.fieldError, marginTop: 16 }}>{error}</p>}
          <div style={s.buttons}>
            <button type="button" style={s.cancel} disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...s.save, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "var(--bg)", color: "var(--text)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", width: "100%", minWidth: 0, maxWidth: 560, maxHeight: "calc(100dvh - 40px)", overflowY: "auto" },
  title: { fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 },
  description: { color: "var(--text2)", fontSize: 13, marginBottom: 24, overflowWrap: "anywhere" },
  fields: { display: "flex", flexDirection: "column", gap: 18 },
  field: { display: "flex", flexDirection: "column", gap: 7, minWidth: 0 },
  label: { fontSize: 13, fontWeight: 600 },
  input: { background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: "var(--r-sm)", padding: "11px 12px", fontSize: 15, color: "var(--text)", width: "100%", minWidth: 0, fontFamily: "var(--font)" },
  disabled: { opacity: 0.6, cursor: "not-allowed" },
  hint: { fontSize: 12, color: "var(--text3)", lineHeight: 1.6, fontWeight: 400 },
  fieldError: { fontSize: 13, color: "var(--red)", lineHeight: 1.6, overflowWrap: "anywhere" },
  notice: { background: "var(--orange-light)", color: "var(--text2)", borderRadius: "var(--r-sm)", padding: "12px 14px", fontSize: 13, lineHeight: 1.6 },
  link: { color: "var(--blue)", fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" },
  fileInput: { color: "var(--text2)", fontSize: 13, maxWidth: "100%", width: "100%", minWidth: 0 },
  preview: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, background: "var(--bg2)", padding: 12, borderRadius: "var(--r-sm)" },
  removeBtn: { background: "none", border: "none", color: "var(--text2)", fontSize: 12, textDecoration: "underline", padding: 0 },
  buttons: { display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" },
  cancel: { flex: 1, background: "var(--bg2)", border: "none", borderRadius: 980, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "var(--text2)", fontFamily: "var(--font)" },
  save: { flex: 2, background: "var(--blue-button)", color: "#fff", border: "none", borderRadius: 980, padding: "12px 16px", fontSize: 14, fontWeight: 600, fontFamily: "var(--font)" },
};

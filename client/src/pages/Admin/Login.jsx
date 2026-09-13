import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "../../config";
import ThemeToggle from "../../ThemeToggle";
import { Lock } from "lucide-react";

export default function AdminLogin() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!pw.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/admin/login`, { password: pw });
      if (res.data.success) {
        sessionStorage.setItem("adminToken", res.data.token);
        nav("/admin", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <ThemeToggle floating />
      <div style={s.card} className="au">
        <div style={s.iconWrap}><Lock size={30} strokeWidth={1.75} /></div>
        <h1 style={s.title}>Admin Login</h1>
        <p style={s.sub}>Enter the admin password to manage orders.</p>

        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ ...s.input, borderColor: error ? "var(--red)" : "transparent" }}
          autoFocus
        />
        {error && <p style={s.error}>{error}</p>}

        <button
          style={{ ...s.btn, opacity: !pw || loading ? 0.5 : 1 }}
          onClick={login}
          disabled={!pw || loading}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <button style={s.back} onClick={() => nav("/")}>← Back to Home</button>
      </div>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { background: "var(--bg)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "clamp(32px,7vw,48px) clamp(26px,5vw,40px)", width: "100%", maxWidth: 380, textAlign: "center" },
  iconWrap: { fontSize: 36, marginBottom: 20, display: "block" },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 8 },
  sub: { fontSize: 14, color: "var(--text2)", marginBottom: 28, lineHeight: 1.5 },
  input: { background: "var(--bg2)", border: "1.5px solid transparent", borderRadius: "var(--r-sm)", padding: "13px 16px", fontSize: 16, color: "var(--text)", outline: "none", width: "100%", textAlign: "center", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--font)", transition: "border-color .15s" },
  error: { color: "var(--red)", fontSize: 13, marginBottom: 12 },
  btn: { background: "var(--blue)", color: "#fff", border: "none", borderRadius: 980, padding: "13px 0", fontSize: 15, fontWeight: 600, width: "100%", marginBottom: 14, transition: "opacity .15s", fontFamily: "var(--font)" },
  back: { background: "none", border: "none", color: "var(--text3)", fontSize: 14, fontWeight: 500, fontFamily: "var(--font)" },
};
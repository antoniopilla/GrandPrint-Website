import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../ThemeToggle";
import { Image, Frame, Sticker, MessageCircle } from "lucide-react";

export default function Home() {
  const nav = useNavigate();

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <span style={s.brand}>GrandPrint</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
            <button style={s.adminLink} onClick={() => nav("/pay")}>
              Pay Order
            </button>
            <button style={s.adminLink} onClick={() => nav("/admin/login")}>
              Admin
            </button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroInner}>
          <p style={s.eyebrow} className="au">Large Format Printing</p>
          <h1 style={s.h1} className="au">
            Prints that demand<br />attention.
          </h1>
          <p style={s.sub} className="au">
            Tarpaulins, sintra boards & stickers — made to order,
            crafted for impact.
          </p>
          <div style={s.ctas} className="au">
            <Btn primary onClick={() => nav("/order")}>Place an Order</Btn>
            <Btn onClick={() => nav("/admin/login")}>Admin Login</Btn>
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={s.services}>
        <div style={s.servicesGrid}>
          {SERVICES.map((svc, i) => (
            <div
              key={svc.name}
              className="au"
              style={{ ...s.card, animationDelay: `${0.05 + i * 0.08}s` }}
            >
              <div style={s.cardIcon}><svc.Icon size={30} strokeWidth={1.75} /></div>
              <h3 style={s.cardTitle}>{svc.name}</h3>
              <p style={s.cardDesc}>{svc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={s.howSection}>
        <div style={s.howInner}>
          <p style={s.sectionEye}>How It Works</p>
          <h2 style={s.sectionTitle}>Simple. Fast. Reliable.</h2>
          <div style={s.steps}>
            {STEPS.map((step, i) => (
              <div key={i} style={s.step}>
                <div style={s.stepNum}>{i + 1}</div>
                <div>
                  <p style={s.stepHead}>{step.head}</p>
                  <p style={s.stepBody}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={s.banner}>
        <div style={s.bannerInner}>
          <h2 style={s.bannerTitle}>Ready to print?</h2>
          <p style={s.bannerSub}>It only takes a few minutes to place your order.</p>
          <Btn primary large onClick={() => nav("/order")}>Get Started →</Btn>
        </div>
      </section>

      {/* Footer */}
      <footer style={s.footer}>
        <p>© {new Date().getFullYear()} GrandPrint · All rights reserved</p>
      </footer>

      {/* Floating chat button — stays visible while scrolling */}
      <a
        href="https://www.messenger.com/t/61551691632716"
        target="_blank"
        rel="noopener noreferrer"
        style={s.fab}
        title="Chat on Messenger"
        aria-label="Chat on Messenger"
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.background = "var(--blue-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "var(--blue)"; }}
      >
        <MessageCircle size={20} /> Chat with us
      </a>
    </div>
  );
}

function Btn({ children, primary, large, onClick }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", maxWidth: "100%", minWidth: 0, overflowWrap: "anywhere",
    border: "none", borderRadius: 980, fontWeight: 600, cursor: "pointer",
    transition: "all 0.18s", fontFamily: "var(--font)",
    padding: large ? "16px 40px" : "13px 28px",
    fontSize: large ? 17 : 15,
  };
  const variant = primary
    ? { background: "var(--blue)", color: "#fff" }
    : { background: "var(--bg3)", color: "var(--text)" };

  return (
    <button
      style={{ ...base, ...variant }}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.03)";
        if (primary) e.currentTarget.style.background = "var(--blue-hover)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
        if (primary) e.currentTarget.style.background = "var(--blue)";
      }}
    >
      {children}
    </button>
  );
}

const SERVICES = [
  { Icon: Image, name: "Tarpaulin", desc: "Weather-resistant large-format prints for events, storefronts, and banners." },
  { Icon: Frame, name: "Sintra Board", desc: "Rigid PVC boards for signage, directories, and indoor/outdoor displays." },
  { Icon: Sticker, name: "Stickers", desc: "Custom cut stickers for branding, packaging, promotions, and more." },
];

const STEPS = [
  { head: "Place your order", body: "Fill out a short form with your details and upload your design file." },
  { head: "We review & quote", body: "Our team reviews your order and sends a price quote directly to your email." },
  { head: "Send 50% downpayment", body: "Pay via GCash or BPI, then send your receipt to our Facebook page." },
  { head: "We print & deliver", body: "Production begins immediately. Pay the remaining 50% upon completion." },
];

const s = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" },
  nav: { borderBottom: "1px solid var(--border)", background: "var(--nav-bg)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 },
  navInner: { maxWidth: 1000, margin: "0 auto", padding: "8px clamp(16px,5vw,32px)", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, minWidth: 0 },
  brand: { fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" },
  adminLink: { background: "none", border: "none", fontSize: 14, fontWeight: 500, color: "var(--text2)", padding: "6px 12px", borderRadius: 8, transition: "color .15s" },
  hero: { padding: "clamp(56px,11vw,100px) clamp(20px,5vw,32px) clamp(56px,9vw,80px)", textAlign: "center" },
  heroInner: { maxWidth: 680, margin: "0 auto" },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", marginBottom: 20, animationDelay: "0s" },
  h1: { fontSize: "clamp(40px,6vw,68px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05, marginBottom: 20, animationDelay: "0.06s" },
  sub: { fontSize: 19, color: "var(--text2)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 36px", animationDelay: "0.12s" },
  ctas: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.18s" },
  services: { background: "var(--bg2)", padding: "clamp(44px,8vw,60px) clamp(20px,5vw,32px)" },
  servicesGrid: { maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 16, minWidth: 0 },
  card: { background: "var(--bg)", borderRadius: "var(--r-lg)", padding: "32px 28px", boxShadow: "var(--shadow)" },
  cardIcon: { marginBottom: 16, color: "var(--blue)" },
  cardTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" },
  cardDesc: { fontSize: 14, color: "var(--text2)", lineHeight: 1.65 },
  howSection: { padding: "clamp(56px,10vw,80px) clamp(20px,5vw,32px)" },
  howInner: { maxWidth: 600, margin: "0 auto" },
  sectionEye: { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--blue)", marginBottom: 12 },
  sectionTitle: { fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 40 },
  steps: { display: "flex", flexDirection: "column", gap: 28 },
  step: { display: "flex", gap: 18, alignItems: "flex-start" },
  stepNum: { width: 32, height: 32, background: "var(--bg2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0, color: "var(--text2)" },
  stepHead: { fontWeight: 600, fontSize: 16, marginBottom: 4 },
  stepBody: { fontSize: 14, color: "var(--text2)", lineHeight: 1.6 },
  banner: { background: "var(--ink)", padding: "clamp(56px,10vw,80px) clamp(20px,5vw,32px)", textAlign: "center" },
  bannerInner: { maxWidth: 500, margin: "0 auto" },
  bannerTitle: { fontSize: "clamp(28px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", marginBottom: 12 },
  bannerSub: { fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 32 },
  fab: { position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "inline-flex", alignItems: "center", gap: 10, background: "var(--blue)", color: "#fff", borderRadius: 980, padding: "14px 22px", fontSize: 15, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,0.25)", textDecoration: "none", fontFamily: "var(--font)", transition: "all 0.18s", cursor: "pointer" },
  footer: { padding: "24px clamp(20px,5vw,32px)", textAlign: "center", fontSize: 13, color: "var(--text3)", borderTop: "1px solid var(--border)" },
};

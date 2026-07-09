import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { DICT, LOCALES } from "./i18n.js";

// ---- Config editável ----
const SITE_URL = "https://imovelemdolar.com.br";
const CTA_URL = "https://wa.me/14079227481"; // Time de Vendas
const APK_PATH = "/app/imovel-em-dolar-calc.apk";

// Taxas pré-fixadas por programa (Freddie Mac PMMS 02/07/2026 — mesma base do Zillow)
const PROGRAMS = [
  { id: "y30", years: 30, rate: 6.43 },
  { id: "y20", years: 20, rate: 6.25 },
  { id: "y15", years: 15, rate: 5.79 },
  { id: "y10", years: 10, rate: 5.65 },
  { id: "fha", years: 30, rate: 6.0 },
  { id: "va", years: 30, rate: 5.95 },
];

const PMI_ANNUAL_PCT = 0.5; // % a.a. sobre o valor financiado, quando entrada < 20%

const isAppMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true ||
  document.referrer.startsWith("android-app://") ||
  new URLSearchParams(location.search).has("app");

const num = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
};

const FLAGS = {
  pt: <svg viewBox="0 0 20 14" className="flag-svg"><rect width="20" height="14" fill="#009C3B"/><path d="M10 1.5 18 7l-8 5.5L2 7z" fill="#FFDF00"/><circle cx="10" cy="7" r="2.6" fill="#002776"/></svg>,
  en: <svg viewBox="0 0 20 14" className="flag-svg"><rect width="20" height="14" fill="#B22234"/><g fill="#fff"><rect y="2" width="20" height="1.6"/><rect y="5.2" width="20" height="1.6"/><rect y="8.4" width="20" height="1.6"/><rect y="11.6" width="20" height="1.6"/></g><rect width="9" height="7.6" fill="#3C3B6E"/></svg>,
  es: <svg viewBox="0 0 20 14" className="flag-svg"><rect width="20" height="14" fill="#AA151B"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/></svg>,
};

function useLang() {
  const auto = (navigator.language || "pt").slice(0, 2);
  const initial = localStorage.getItem("lang") || (DICT[auto] ? auto : "pt");
  const [lang, setLang] = useState(initial);
  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = LOCALES[lang];
  }, [lang]);
  return [lang, setLang];
}

const fmtUSD = (lang, v, digits = 0) =>
  new Intl.NumberFormat(LOCALES[lang], {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v);

// ---- Matemática do financiamento ----
function computeLoan({ price, dpPct, rate, years, taxPct, insMo, hoaMo, pmiOn }) {
  const down = (price * dpPct) / 100;
  const loan = Math.max(price - down, 0);
  const r = rate / 100 / 12;
  const n = years * 12;
  const pi = loan > 0 && n > 0 ? (r > 0 ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan / n) : 0;
  const tax = (price * taxPct) / 100 / 12;
  const pmi = pmiOn && dpPct < 20 ? (loan * PMI_ANNUAL_PCT) / 100 / 12 : 0;
  const total = pi + tax + insMo + hoaMo + pmi;

  // amortização agregada por ano
  const schedule = [];
  let bal = loan;
  let totalInterest = 0;
  for (let y = 1; y <= years && bal > 0.01; y++) {
    let pr = 0, it = 0;
    for (let m = 0; m < 12 && bal > 0.01; m++) {
      const i = bal * r;
      const p = Math.min(pi - i, bal);
      it += i; pr += p; bal -= p;
    }
    totalInterest += it;
    schedule.push({ year: y, principal: pr, interest: it, balance: Math.max(bal, 0) });
  }
  return { down, loan, pi, tax, pmi, insMo, hoaMo, total, schedule, totalInterest };
}

// ---- Donut SVG puro ----
function Donut({ parts, centerTop, centerBottom }) {
  const R = 80, C = 2 * Math.PI * R;
  const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
  let off = 0;
  return (
    <svg viewBox="0 0 200 200" className="donut" role="img">
      <circle cx="100" cy="100" r={R} fill="none" stroke="#DCEFFC" strokeWidth="26" />
      {parts.filter((p) => p.value > 0).map((p, i) => {
        const len = (p.value / sum) * C;
        const el = (
          <circle key={i} cx="100" cy="100" r={R} fill="none" stroke={p.color} strokeWidth="26"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
            transform="rotate(-90 100 100)" strokeLinecap="butt" />
        );
        off += len;
        return el;
      })}
      <text x="100" y="94" textAnchor="middle" className="donut-big">{centerTop}</text>
      <text x="100" y="118" textAnchor="middle" className="donut-small">{centerBottom}</text>
    </svg>
  );
}

// ---- Campo com prefixo/sufixo ----
function Field({ label, prefix, suffix, value, onChange, step, hint, money }) {
  // money: input texto com separador de milhar no padrão americano (350,000)
  const display = money
    ? (value === "" || value === null ? "" : Math.round(num(value)).toLocaleString("en-US"))
    : value;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-box">
        {prefix && <span className="fix">{prefix}</span>}
        <input inputMode="decimal" type={money ? "text" : "number"} step={step || "any"} value={display}
          onChange={(e) => onChange(money ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)} />
        {suffix && <span className="fix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ---- Tela de login/cadastro (modo app) ----
function AuthScreen({ t, onDone }) {
  const [mode, setMode] = useState("register");
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!f.email || f.password.length < 6 || (mode === "register" && (!f.name || !f.whatsapp))) {
      setErr(t.required); return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || "auth");
      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.name || f.name);
      onDone();
    } catch {
      setErr(t.authError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <img src="/img/logo.png" alt="Imóvel em Dólar" className="auth-logo" />
      <h1 className="auth-title">{t.authTitle}</h1>
      <p className="auth-sub">{t.authSubtitle}</p>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" && (
          <>
            <input placeholder={t.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input placeholder={t.whatsapp} inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
          </>
        )}
        <input placeholder={t.email} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input placeholder={t.password} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p className="auth-err">{err}</p>}
        <button className="btn-cta" disabled={busy} type="submit">
          {mode === "register" ? t.register : t.login}
        </button>
      </form>
      <button className="auth-switch" onClick={() => setMode(mode === "register" ? "login" : "register")}>
        {mode === "register" ? t.haveAccount : t.noAccount}
      </button>
    </div>
  );
}

function App() {
  const [lang, setLang] = useLang();
  const t = DICT[lang];
  const $ = (v, d) => fmtUSD(lang, v, d);

  // gate de login só no modo app instalado
  const [authed, setAuthed] = useState(!isAppMode() || !!localStorage.getItem("token"));

  // estado da calculadora (padrões podem ser salvos na engrenagem → localStorage)
  const saved = JSON.parse(localStorage.getItem("defaults") || "{}");
  const [price, setPrice] = useState(saved.price ?? 350000);
  const [dpPct, setDpPct] = useState(saved.dpPct ?? 20);
  const [programId, setProgramId] = useState(saved.programId ?? "y30");
  const program = PROGRAMS.find((p) => p.id === programId);
  const [rate, setRate] = useState(saved.rate ?? program.rate);
  const [taxMode, setTaxMode] = useState(saved.taxMode ?? "pct"); // pct = % a.a. · usd = US$/ano
  const [taxVal, setTaxVal] = useState(saved.taxVal ?? 1.1);
  const [insMo, setInsMo] = useState(saved.insMo ?? 125);
  const [hoaMo, setHoaMo] = useState(saved.hoaMo ?? 0);
  const [gearOpen, setGearOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const pmiOn = true; // PMI automático quando entrada < 20% (regra dos EUA)

  // modo escuro
  const [dark, setDark] = useState(localStorage.getItem("dark") === "1");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark", dark ? "1" : "0");
  }, [dark]);

  const saveDefaults = () => {
    localStorage.setItem("defaults", JSON.stringify({ price: num(price), dpPct: num(dpPct), programId, rate: num(rate), taxMode, taxVal: num(taxVal), insMo: num(insMo), hoaMo: num(hoaMo) }));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };
  const resetDefaults = () => { localStorage.removeItem("defaults"); location.reload(); };

  const pickProgram = (id) => {
    setProgramId(id);
    setRate(PROGRAMS.find((p) => p.id === id).rate);
  };

  const taxPctEff = taxMode === "pct" ? num(taxVal) : (num(price) > 0 ? (num(taxVal) / num(price)) * 100 : 0);
  const out = useMemo(
    () => computeLoan({ price: num(price), dpPct: num(dpPct), rate: num(rate), years: program.years, taxPct: taxPctEff, insMo: num(insMo), hoaMo: num(hoaMo), pmiOn }),
    [price, dpPct, rate, program.years, taxPctEff, insMo, hoaMo, pmiOn]
  );

  // instalação PWA
  const [installEvt, setInstallEvt] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (!authed) return <AuthScreen t={t} onDone={() => setAuthed(true)} />;

  const parts = [
    { label: t.principalInterest, value: out.pi, color: "#3232CA" },
    { label: t.taxes, value: out.tax, color: "#FF9D00" },
    { label: t.insurance, value: out.insMo, color: "#1F9D6B" },
    { label: t.pmiShort, value: out.pmi, color: "#D9534F" },
    { label: t.hoaShort, value: out.hoaMo, color: "#5A5A85" },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <img src={dark ? "/img/logo-branco.png" : "/img/logo.png"} alt="Imóvel em Dólar" className="logo" />
        <div className="topbar-right">
          <span className="flag">{FLAGS[lang]}</span>
          <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Idioma">
            <option value="pt">PT</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
          <button className="iconbtn" onClick={() => setDark(!dark)} aria-label="Modo escuro">{dark ? "☀️" : "🌙"}</button>
          <span className="gear-wrap">
            <button className="iconbtn" onClick={() => setGearOpen(!gearOpen)} aria-label={t.settings}>⚙️</button>
            {gearOpen && (
              <>
                <div className="backdrop" onClick={() => setGearOpen(false)} />
                <div className="gear-pop">
                  <p className="gear-title">{t.settings}</p>
                  <p className="gear-hint">{t.defaultsHint}</p>
                  <button className="gear-item" onClick={saveDefaults}>💾 {t.saveDefaults}</button>
                  <button className="gear-item" onClick={resetDefaults}>↩️ {t.resetDefaults}</button>
                  {savedMsg && <p className="saved-ok">✓ {t.savedOk}</p>}
                  {!isAppMode() && (
                    <>
                      <hr className="sep" />
                      <p className="gear-title">{t.install}</p>
                      {installEvt && (
                        <button className="gear-item" onClick={() => { installEvt.prompt(); setInstallEvt(null); }}>
                          📲 {t.installBtn}
                        </button>
                      )}
                      <a className="gear-item" href={APK_PATH} download>🤖 {t.apkBtn}</a>
                      <p className="gear-hint">{t.iosHint}</p>
                    </>
                  )}
                </div>
              </>
            )}
          </span>
          {isAppMode() && (
            <button className="linklike" onClick={() => { localStorage.removeItem("token"); setAuthed(false); }}>
              {t.logout}
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div>
          <h1 className="headline">{t.title}</h1>
          <p className="subhead">{t.subtitle}</p>
        </div>
      </section>

      <main className="grid">
        <section className="card inputs">
          <Field label={t.homePrice} prefix="$" money value={price} onChange={setPrice} />
          <div className="row2">
            <Field label={`${t.downPayment} ($)`} prefix="$" money
              value={Math.round((num(price) * num(dpPct)) / 100)}
              onChange={(v) => setDpPct(num(price) > 0 ? (num(v) / num(price)) * 100 : 0)} />
            <Field label={`${t.downPayment} (%)`} suffix="%" step="1"
              value={Math.round(num(dpPct) * 100) / 100}
              onChange={setDpPct} />
          </div>
          <label className="field">
            <span className="field-label">{t.loanProgram}</span>
            <span className="field-box">
              <select value={programId} onChange={(e) => pickProgram(e.target.value)}>
                {PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t.programs[p.id]} — {(p.id === programId ? num(rate) : p.rate).toFixed(2)}%
                  </option>
                ))}
              </select>
            </span>
          </label>
          <Field label={t.interestRate} suffix="%" step="0.01" value={rate} onChange={setRate} hint={t.rateSource} />

          <details className="advanced" open>
            <summary>{t.advanced}</summary>
            <div className="taxmode">
              <span className="field-label">{t.propertyTax}</span>
              <div className="seg">
                <button type="button" className={taxMode === "pct" ? "on" : ""} onClick={() => { if (taxMode !== "pct") { setTaxVal(taxPctEff.toFixed(2)); setTaxMode("pct"); } }}>%</button>
                <button type="button" className={taxMode === "usd" ? "on" : ""} onClick={() => { if (taxMode !== "usd") { setTaxVal(Math.round((num(price) * num(taxVal)) / 100)); setTaxMode("usd"); } }}>US$</button>
              </div>
            </div>
            {taxMode === "pct"
              ? <Field label={t.propertyTaxPct} suffix="%" step="0.05" value={taxVal} onChange={setTaxVal} />
              : <Field label={t.propertyTaxUsd} prefix="$" money value={taxVal} onChange={setTaxVal} />}
            <div className="row2">
              <Field label={t.homeInsurance} prefix="$" money value={insMo} onChange={setInsMo} />
              <Field label={t.hoa} prefix="$" money value={hoaMo} onChange={setHoaMo} />
            </div>
            <details className="pmi-info">
              <summary>{t.pmiWhatIs}</summary>
              <p>{t.pmiExplain}</p>
            </details>
          </details>
        </section>

        <section className="card result">
          <p className="result-label">{t.monthlyPayment}</p>
          <p className="result-value">{$(out.total)}<span className="permo">{t.perMonth}</span></p>
          <Donut parts={parts} centerTop={$(out.total)} centerBottom={t.perMonth} />
          <ul className="legend">
            {parts.filter((p) => p.value > 0).map((p, i) => (
              <li key={i}>
                <span className="dot" style={{ background: p.color }} />
                <span>{p.label}</span>
                <strong>{$(p.value)}</strong>
              </li>
            ))}
          </ul>
          <div className="totals">
            <div><span>{t.loanAmount}</span><strong>{$(out.loan)}</strong></div>
            <div><span>{t.totalInterest}</span><strong>{$(out.totalInterest)}</strong></div>
          </div>
          <details className="amort">
            <summary>{t.amortization}</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>{t.year}</th><th>{t.principalCol}</th><th>{t.interestCol}</th><th>{t.balance}</th></tr>
                </thead>
                <tbody>
                  {out.schedule.map((r) => (
                    <tr key={r.year}>
                      <td>{r.year}</td><td>{$(r.principal)}</td><td>{$(r.interest)}</td><td>{$(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </main>

      <section className="cta">
        <h2>{t.ctaTitle}</h2>
        <a className="btn-cta" href={CTA_URL} target="_blank" rel="noreferrer">{t.ctaBtn}</a>
      </section>

      <footer className="foot">
        <p>{t.disclaimer}</p>
        <p>© Imóvel em Dólar · <a href={SITE_URL}>imovelemdolar.com.br</a></p>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

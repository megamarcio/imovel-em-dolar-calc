// API mínima de auth/leads + servidor estático. SQLite nativo do Node (node:sqlite), sem deps nativas.
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || "./data";
const SECRET = process.env.AUTH_SECRET || "iedcalc-dev-secret";
const ADMIN_KEY = process.env.ADMIN_KEY || "";

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "calc.db"));
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  lang TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`);

const hash = (pw, salt) => scryptSync(pw, salt, 32).toString("hex");
const sign = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
};

// rate limit simples em memória (10 tentativas/10min por IP)
const attempts = new Map();
const limited = (ip) => {
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, t: now };
  if (now - rec.t > 10 * 60 * 1000) { rec.n = 0; rec.t = now; }
  rec.n++;
  attempts.set(ip, rec);
  return rec.n > 10;
};

const app = express();
app.use(express.json({ limit: "10kb" }));

app.post("/api/register", (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: "too_many" });
  const { name, email, whatsapp, password, lang } = req.body || {};
  if (!name || !email || !/.+@.+\..+/.test(email) || !password || password.length < 6)
    return res.status(400).json({ error: "invalid" });
  const salt = randomBytes(16).toString("hex");
  try {
    db.prepare("INSERT INTO users (name,email,whatsapp,salt,pass_hash,lang) VALUES (?,?,?,?,?,?)")
      .run(String(name).slice(0, 120), String(email).toLowerCase().slice(0, 160), String(whatsapp || "").slice(0, 40), salt, hash(password, salt), String(lang || "pt").slice(0, 5));
  } catch {
    return res.status(409).json({ error: "email_exists" });
  }
  res.json({ token: sign({ email, ts: Date.now() }), name });
});

app.post("/api/login", (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: "too_many" });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "invalid" });
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (!u) return res.status(401).json({ error: "auth" });
  const a = Buffer.from(hash(password, u.salt), "hex");
  const b = Buffer.from(u.pass_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: "auth" });
  res.json({ token: sign({ email: u.email, ts: Date.now() }), name: u.name });
});

// exportação de leads pro Marcio: GET /api/leads?key=ADMIN_KEY
app.get("/api/leads", (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: "forbidden" });
  res.json(db.prepare("SELECT id,name,email,whatsapp,lang,created_at FROM users ORDER BY id DESC").all());
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// estático + fallback SPA
const dist = path.resolve("dist");
app.use(
  express.static(dist, {
    index: "index.html",
    setHeaders(res, file) {
      // sw.js/app.js/styles/index sempre frescos; imagens e ícones podem cachear
      if (/\.(png|jpe?g|webp|woff2?)$/.test(file)) res.setHeader("Cache-Control", "public, max-age=86400");
      else res.setHeader("Cache-Control", "no-cache");
    },
  })
);
app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, () => console.log(`iedcalc on :${PORT} (data: ${DATA_DIR})`));

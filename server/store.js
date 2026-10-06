// =============================================================
//  ที่เก็บข้อมูลบัญชีและตัวละคร
//  - มีตั้งค่า Firebase ใน Render → ใช้ Firebase Auth + Firestore (ของจริง)
//  - ไม่มี → "โหมดทดสอบ" เก็บในหน่วยความจำ (ปิดเซิร์ฟเวอร์แล้วหาย) ใช้ทดสอบในเครื่องเท่านั้น
// =============================================================
const D = require("./data");

const LOGIN_DOMAIN = "novice-online.game"; // ID "sayan" → อีเมลภายใน sayan@novice-online.game
const DEFAULT_SLOTS = 3;                    // ช่องตัวละครเริ่มต้น (ขยายได้ในอนาคตด้วยไอเทม)
const ID_RE = /^[a-z0-9_]{4,16}$/;
const NAME_RE = /^[A-Za-z0-9_฀-๿]{2,14}$/;

class StoreError extends Error {}
const fail = (msg) => { throw new StoreError(msg); };

function validName(name) {
  const n = String(name || "").trim();
  if (!NAME_RE.test(n)) fail("ชื่อตัวละครต้องยาว 2–14 ตัว ใช้ได้แค่ไทย อังกฤษ ตัวเลข และ _ (ไม่มีเว้นวรรค)");
  return n;
}
const nameKey = (n) => n.toLowerCase();

function newCharData(uid, name, look) {
  const stats = D.playerStats(1);
  return {
    uid, name, nameKey: nameKey(name), look: D.sanitizeLook(look), job: "villager", stats: D.baseStats(),
    level: 1, exp: 0, hp: stats.maxHp, sp: stats.maxSp, x: null, y: null,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}
const publicChar = (id, c) => ({
  id, name: c.name, look: c.look, job: c.job, jobName: D.JOB_NAME[c.job] || c.job, level: c.level,
});

// ---------------- คีย์ Service Account ----------------
// อ่านได้ 2 ทาง: Secret File ของ Render (/etc/secrets/firebase-key.json — แนะนำ) หรือ env FIREBASE_SERVICE_ACCOUNT
const SECRET_FILE = "/etc/secrets/firebase-key.json";
function rawServiceAccount() {
  const fs = require("fs");
  if (fs.existsSync(SECRET_FILE)) return { raw: fs.readFileSync(SECRET_FILE, "utf8"), from: "Secret File firebase-key.json" };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return { raw: process.env.FIREBASE_SERVICE_ACCOUNT, from: "env FIREBASE_SERVICE_ACCOUNT" };
  // ตั้งชื่อค่าผิด → หาจากทุกค่าที่หน้าตาเหมือนไฟล์คีย์ Service Account
  for (const [k, v] of Object.entries(process.env))
    if (typeof v === "string" && v.includes("private_key") && v.includes("client_email")) return { raw: v, from: `env ${k}` };
  return null;
}
function readApiKey() {
  let k = process.env.FIREBASE_API_KEY || "";
  const m = k.match(/AIza[0-9A-Za-z_\-]{20,}/); // วางมาทั้งโค้ด/มีเครื่องหมายคำพูด → ดึงเฉพาะตัวคีย์
  if (m) return m[0];
  for (const v of Object.values(process.env)) { const mm = typeof v === "string" && v.match(/^\s*["']?(AIza[0-9A-Za-z_\-]{20,})/); if (mm) return mm[1]; }
  return "";
}
// รายงานสถานะ (เฉพาะชื่อค่า ไม่มีเนื้อหาคีย์) — ใช้ตรวจการตั้งค่าจากหน้า /api/config
function diag() {
  const raw = rawServiceAccount();
  return { keyFrom: raw ? raw.from : null, apiKey: !!readApiKey(),
    firebaseEnvNames: Object.keys(process.env).filter((k) => /fire/i.test(k)) };
}
function readServiceAccount() {
  const { raw, from } = rawServiceAccount();
  let text = raw.trim().replace(/^\uFEFF/, "");
  if (/^['"]/.test(text) && text.endsWith(text[0])) text = text.slice(1, -1); // วางมาพร้อมเครื่องหมายคำพูดครอบ
  const tries = [text, () => Buffer.from(text, "base64").toString("utf8")];
  for (const t of tries) {
    try {
      const sa = JSON.parse(typeof t === "function" ? t() : t);
      if (sa && sa.private_key && sa.client_email && sa.project_id) return sa;
    } catch {}
  }
  // บอกลักษณะค่าที่ได้ (ไม่พิมพ์เนื้อหาคีย์) เพื่อช่วยหาสาเหตุ
  throw new Error(`คีย์ Service Account จาก ${from} อ่านไม่ได้ (ยาว ${text.length} ตัว, ขึ้นต้นด้วย "${text.slice(0, 1)}", ` +
    `ลงท้ายด้วย "${text.slice(-1)}") — ต้องเป็นเนื้อหาไฟล์ .json ทั้งไฟล์ ตั้งแต่ { ถึง }`);
}

// ---------------- Firebase ----------------
function firebaseStore() {
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore } = require("firebase-admin/firestore");
  const sa = readServiceAccount();
  if (!readApiKey()) throw new Error("ไม่พบ FIREBASE_API_KEY (ต้องเป็นค่าที่ขึ้นต้นด้วย AIza)");
  projectId = sa.project_id;
  initializeApp({ credential: cert(sa) });
  const auth = getAuth(), db = getFirestore();
  const accounts = db.collection("accounts"), chars = db.collection("characters"), names = db.collection("names");

  return {
    mode: "firebase",
    async verify(token) {
      const t = await auth.verifyIdToken(String(token || ""));
      const [local, domain] = String(t.email || "").split("@");
      if (domain !== LOGIN_DOMAIN || !ID_RE.test(local)) fail("บัญชีนี้ใช้กับเกมไม่ได้");
      const ref = accounts.doc(t.uid);
      const snap = await ref.get();
      if (!snap.exists) await ref.set({ loginId: local, slots: DEFAULT_SLOTS, createdAt: Date.now() });
      return { uid: t.uid, loginId: local, slots: snap.exists ? snap.get("slots") || DEFAULT_SLOTS : DEFAULT_SLOTS };
    },
    async list(uid) {
      const q = await chars.where("uid", "==", uid).get();
      return q.docs.map((d) => publicChar(d.id, d.data())).sort((a, b) => a.id.localeCompare(b.id));
    },
    async create(user, name, look) {
      name = validName(name);
      return db.runTransaction(async (tx) => {
        const nref = names.doc(nameKey(name));
        const [nsnap, owned] = await Promise.all([tx.get(nref), tx.get(chars.where("uid", "==", user.uid))]);
        if (nsnap.exists) fail("ชื่อนี้มีคนใช้แล้ว");
        if (owned.size >= user.slots) fail(`สร้างตัวละครได้สูงสุด ${user.slots} ตัว`);
        const cref = chars.doc();
        const data = newCharData(user.uid, name, look);
        tx.set(cref, data);
        tx.set(nref, { charId: cref.id, uid: user.uid });
        return publicChar(cref.id, data);
      });
    },
    async remove(uid, charId) {
      await db.runTransaction(async (tx) => {
        const cref = chars.doc(String(charId));
        const snap = await tx.get(cref);
        if (!snap.exists || snap.get("uid") !== uid) fail("ไม่พบตัวละคร");
        tx.delete(cref);
        tx.delete(names.doc(snap.get("nameKey")));
      });
    },
    async load(uid, charId) {
      const snap = await chars.doc(String(charId || "x")).get();
      if (!snap.exists || snap.get("uid") !== uid) fail("ไม่พบตัวละคร");
      return { id: snap.id, ...snap.data() };
    },
    async save(charId, data) {
      await chars.doc(charId).update({ ...data, updatedAt: Date.now() });
    },
  };
}

// ---------------- โหมดทดสอบ (ไม่มี Firebase) ----------------
function memoryStore() {
  const accounts = new Map(), chars = new Map(), names = new Map();
  let seq = 0;
  return {
    mode: "dev",
    async verify(token) {
      // token รูปแบบ "dev:<id>" — ใช้ทดสอบในเครื่องเท่านั้น
      const id = String(token || "").replace(/^dev:/, "").toLowerCase();
      if (!String(token).startsWith("dev:") || !ID_RE.test(id)) fail("ID ไม่ถูกต้อง");
      const uid = "dev_" + id;
      if (!accounts.has(uid)) accounts.set(uid, { loginId: id, slots: DEFAULT_SLOTS });
      return { uid, loginId: id, slots: accounts.get(uid).slots };
    },
    async list(uid) {
      return [...chars].filter(([, c]) => c.uid === uid).map(([id, c]) => publicChar(id, c));
    },
    async create(user, name, look) {
      name = validName(name);
      if (names.has(nameKey(name))) fail("ชื่อนี้มีคนใช้แล้ว");
      if ((await this.list(user.uid)).length >= user.slots) fail(`สร้างตัวละครได้สูงสุด ${user.slots} ตัว`);
      const id = "c" + String(++seq).padStart(6, "0");
      const data = newCharData(user.uid, name, look);
      chars.set(id, data);
      names.set(data.nameKey, id);
      return publicChar(id, data);
    },
    async remove(uid, charId) {
      const c = chars.get(charId);
      if (!c || c.uid !== uid) fail("ไม่พบตัวละคร");
      chars.delete(charId);
      names.delete(c.nameKey);
    },
    async load(uid, charId) {
      const c = chars.get(charId);
      if (!c || c.uid !== uid) fail("ไม่พบตัวละคร");
      return { id: charId, ...c };
    },
    async save(charId, data) {
      const c = chars.get(charId);
      if (c) Object.assign(c, data, { updatedAt: Date.now() });
    },
  };
}

let store, projectId = null, configError = null;
if (rawServiceAccount()) {
  try {
    store = firebaseStore();
    console.log("🔐 Using Firebase (accounts are saved)");
  } catch (e) {
    // ตั้งค่าผิด → ไม่ให้เซิร์ฟเวอร์ล่มทั้งตัว เปิดเกมในโหมดทดสอบไปก่อน และบอกสาเหตุใน log
    configError = e.message;
    console.error("❌ Firebase setup error: " + e.message);
    store = memoryStore();
    console.warn("⚠️  Falling back to DEV MODE until the Firebase settings are fixed");
  }
} else {
  store = memoryStore();
  console.warn("⚠️  No Firebase key found — DEV MODE: data is kept in memory only");
}

function webConfig() {
  if (store.mode !== "firebase") return { mode: "dev", domain: LOGIN_DOMAIN, configError: !!configError, diag: diag() };
  // ค่าที่หน้าเว็บต้องใช้ล็อกอิน — ใช้แค่ API key + ชื่อโปรเจกต์ (ไม่ใช่ความลับ)
  return { mode: "firebase", domain: LOGIN_DOMAIN, firebase: {
    apiKey: readApiKey(), authDomain: `${projectId}.firebaseapp.com`, projectId } };
}

module.exports = { store, webConfig, StoreError, LOGIN_DOMAIN };

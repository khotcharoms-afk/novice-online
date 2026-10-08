// =============================================================
//  เซิร์ฟเวอร์เกม — Colyseus + Express
//  - เสิร์ฟหน้าเว็บเกม (/public)
//  - API บัญชี/ตัวละคร (/api/...) ต้องแนบตั๋วล็อกอินมาทุกครั้ง
//  - ห้อง "world" = โลกเกม
// =============================================================
const http = require("http");
const path = require("path");
const express = require("express");
const { Server } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");
const { store, webConfig, StoreError } = require("./store");
const { WorldRoom } = require("./WorldRoom");

const NODE_MODULES = path.join(__dirname, "..", "node_modules");
const PORT = Number(process.env.PORT) || 2567;

const app = express();
app.use(require("compression")()); // บีบอัด (gzip) ไฟล์ js/json/html ให้เล็กลง โหลดเร็วขึ้น
app.use(express.json({ limit: "10kb" }));
// แคช: ภาพ/เสียง (assets) ใช้ของในเครื่องได้เลยแล้วเช็กเวอร์ชันใหม่เบื้องหลัง · โค้ด (js/css/html) เช็กทุกครั้ง (อัปเดตเกมแล้วเห็นทันที)
app.use("/assets", express.static(path.join(__dirname, "..", "public", "assets"), {
  setHeaders: (res, file) => res.setHeader("Cache-Control", /manifest\.json$/.test(file) ? "no-cache" : "public, max-age=600, stale-while-revalidate=604800"),
}));
app.use(express.static(path.join(__dirname, "..", "public"), { setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") }));

// ไลบรารีฝั่งเบราว์เซอร์
const lib = { "colyseus.js": "colyseus.js/dist/colyseus.js", "phaser.min.js": "phaser/dist/phaser.min.js",
  "firebase-app.js": "firebase/firebase-app-compat.js", "firebase-auth.js": "firebase/firebase-auth-compat.js" };
for (const [name, file] of Object.entries(lib))
  app.get("/lib/" + name, (_req, res) => res.sendFile(path.join(NODE_MODULES, file), { maxAge: "7d" }));

app.get("/credits", (_req, res) =>
  res.type("text/plain; charset=utf-8").sendFile(path.join(__dirname, "..", "CREDITS.md"))
);
app.get("/health", (_req, res) => res.send("ok"));
// เวอร์ชันของเซิร์ฟเวอร์ (เปลี่ยนทุกครั้งที่ deploy) — หน้าเกมใช้เช็กว่าต้องโหลดโค้ดใหม่ไหมหลังเชื่อมต่อกลับ
app.get("/api/version", (_req, res) => res.set("Cache-Control", "no-store").json({ v: WorldRoom.BUILD }));
app.get("/api/world", (_req, res) => res.json(WorldRoom.worldInfo()));
app.get("/api/status", (_req, res) => res.json({ closed: WorldRoom.maintInfo().closed }));

// ---------------- API บัญชี & ตัวละคร ----------------
app.get("/api/config", (_req, res) => res.json(webConfig()));

const api = (fn) => async (req, res) => {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
    const user = await store.verify(token);
    res.json(await fn(user, req));
  } catch (e) {
    if (!(e instanceof StoreError)) console.error(e);
    res.status(e instanceof StoreError ? 400 : 401).json({ error: e instanceof StoreError ? e.message : "กรุณาล็อกอินใหม่" });
  }
};
const admin = require("./admin");
app.get("/api/chars", api(async (user) => ({ loginId: user.loginId, slots: user.slots, admin: admin.adminOk(user), chars: await store.list(user.uid) })));
admin.mount(app, api);
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "admin.html")));
app.post("/api/chars", api(async (user, req) => ({ char: await store.create(user, req.body.name, req.body.look) })));
app.delete("/api/chars/:id", api(async (user, req) => {
  if (WorldRoom.isOnline(req.params.id)) throw new StoreError("ตัวละครนี้กำลังออนไลน์อยู่ ออกจากเกมก่อนแล้วค่อยลบ");
  await store.remove(user.uid, req.params.id);
  return { ok: true };
}));

const gameServer = new Server({
  // ปิดการตัดด้วย WebSocket ping ของ Colyseus: บน Render สัญญาณ pong ไม่กลับมาถึงเซิร์ฟเวอร์ → ผู้เล่นถูกตัดทุก ~20 วิ
  // ใช้ heartbeat ระดับเกมแทน (ข้อความ "hb" จาก client ทุก 5 วิ · ไม่ได้ยินเกิน 90 วิ ค่อยตัด — ดู WorldRoom)
  transport: new WebSocketTransport({ server: http.createServer(app), pingInterval: 0 }),
});
gameServer.define("world", WorldRoom).filterBy(["mapId"]); // 1 ห้องต่อ 1 แผนที่

gameServer.listen(PORT).then(() => {
  console.log(`🎮 Game server running on http://localhost:${PORT}`);
});

// =============================================================
//  เมนูแอดมิน (API) — ใช้ได้เฉพาะ ID ที่อยู่ใน ADMIN_IDS (ตั้งใน Render)
//  แก้ตัวละครได้ทั้งตอนออนไลน์ (มีผลในเกมทันที) และออฟไลน์ (แก้ในฐานข้อมูล)
// =============================================================
const { store, StoreError, isAdmin } = require("./store");
const { WorldRoom } = require("./WorldRoom");
const D = require("./data");
const I = require("./items");
const Bag = require("./inventory");

const fail = (m) => { throw new StoreError(m); };
const startedAt = Date.now();
const logs = []; // บันทึกการกระทำของแอดมินล่าสุด (ในหน่วยความจำ + Firestore adminLogs)

const adminOk = (user) => isAdmin(user.loginId) || (store.mode === "dev" && user.loginId === "admin");

// ---------- คำสั่งแก้ตัวละคร (ทำกับข้อมูลรูปแบบที่บันทึก) ----------
const withBag = (c, fn) => { const b = Bag.loadBag(c); const r = fn(b); Object.assign(c, Bag.saveBag(b)); return r; };
const ACTIONS = {
  gold(c, a) {
    const n = Math.trunc(Number(a.n) || 0);
    if (!n) fail("ใส่จำนวน gold");
    return withBag(c, (b) => { b.gold = Math.max(0, Math.min(999999999, b.gold + n)); return `${n > 0 ? "เพิ่ม" : "ลด"} gold ${Math.abs(n).toLocaleString()} (เหลือ ${b.gold.toLocaleString()})`; });
  },
  item(c, a) {
    const it = I.ITEMS[a.id];
    const n = Math.max(1, Math.min(999, Math.floor(Number(a.n) || 1)));
    if (!it) fail("ไม่มีไอเทมนี้");
    return withBag(c, (b) => {
      let left = n, tag = "";
      if (it.type === "equip") {
        // อุปกรณ์: เลือกระดับได้ (r = 0–4, "rand" = สุ่มแบบดรอป) + ตีบวก
        left = 0;
        for (let i = 0; i < n; i++) {
          const g = I.makeGear(a.id, a.r === "rand" || a.r === undefined ? undefined : Number(a.r));
          g.up = Math.max(0, Math.min(I.MAX_REFINE, Math.floor(Number(a.up) || 0)));
          if (Bag.addItem(b, a.id, 1, g)) left++;
          else if (n === 1) tag = ` [${I.RARITY[g.r].name}${g.up ? " +" + g.up : ""}]`;
        }
      } else left = Bag.addItem(b, a.id, n);
      if (left === n) fail("กระเป๋าเต็ม");
      return `ให้ ${it.name}${tag} ×${n - left}` + (left ? ` (กระเป๋าเต็ม ใส่ไม่ลง ${left})` : "");
    });
  },
  removeItem(c, a) {
    return withBag(c, (b) => {
      const idx = Math.floor(Number(a.idx)), s = b.inv[idx];
      if (!s) fail("ช่องนี้ว่าง");
      const n = Math.max(1, Math.min(s.n, Math.floor(Number(a.n) || s.n)));
      Bag.removeAt(b, idx, n);
      return `ลบ ${I.ITEMS[s.id].name} ×${n}`;
    });
  },
  level(c, a) {
    const lv = Math.max(1, Math.min(D.MAX_LEVEL, Math.floor(Number(a.lv) || 1)));
    c.level = lv; c.exp = 0;
    const st = c.stats || D.baseStats();
    if (D.spentPoints(st) > D.totalPoints(lv)) c.stats = D.baseStats(); // ลดเลเวลจนแต้มไม่พอ → คืนแต้มทั้งหมด
    return `ตั้งเลเวลเป็น ${lv}`;
  },
  resetStats(c) { c.stats = D.baseStats(); return "รีเซ็ตสเตตัส (คืนแต้มทั้งหมด)"; },
  town(c) { c.x = null; c.y = null; return "ส่งกลับเมือง"; },
  heal(c) { c.heal = true; return "ฟื้น HP/SP เต็ม"; },
};

async function editChar(charId, action, args) {
  const fn = ACTIONS[action];
  if (!fn) fail("ไม่รู้จักคำสั่ง");
  let msg = "";
  const live = await WorldRoom.editLive(charId, (data) => (msg = fn(data, args || {})));
  if (live) return { msg, online: true };
  if (action === "heal") fail("ตัวละครออฟไลน์อยู่ (ฟื้นเลือดตอนเข้าเกมอยู่แล้ว)");
  const c = await store.loadAny(charId);
  msg = fn(c, args || {});
  const keep = ["level", "exp", "stats", "inv", "equip", "gold", "pet", "x", "y"];
  await store.save(charId, Object.fromEntries(keep.filter((k) => k in c).map((k) => [k, c[k] === undefined ? null : c[k]])));
  return { msg, online: false };
}

function mount(app, api) {
  const admin = (fn) => api(async (user, req) => {
    if (!adminOk(user)) fail("บัญชีนี้ไม่ใช่แอดมิน");
    return fn(user, req);
  });
  const audit = (user, what) => {
    const e = { at: Date.now(), by: user.loginId, what };
    logs.unshift(e); logs.length = Math.min(logs.length, 200);
    console.log(`[admin] ${user.loginId}: ${what}`);
    store.log(e);
  };

  app.get("/api/admin/me", api(async (user) => ({ loginId: user.loginId, admin: adminOk(user), mode: store.mode,
    hasAdminIds: !!process.env.ADMIN_IDS })));
  app.get("/api/admin/overview", admin(async () => ({
    mode: store.mode, uptime: Date.now() - startedAt, memMB: Math.round(process.memoryUsage().rss / 1048576),
    world: WorldRoom.worldStats(), online: WorldRoom.onlineList(),
  })));
  app.get("/api/admin/items", admin(async () => ({
    items: Object.entries(I.ITEMS).map(([id, it]) => ({ id, name: it.name, type: it.type, lv: it.lv || 0 })),
    rarity: I.RARITY.map((r) => ({ name: r.name, color: r.color })),
    online: WorldRoom.onlineList().map((o) => o.charId),
  })));
  app.get("/api/admin/accounts", admin(async (_u, req) => ({ accounts: await store.findAccounts(req.query.q) })));
  app.get("/api/admin/account/:uid", admin(async (_u, req) => {
    const acc = await store.account(req.params.uid);
    const live = new Map(WorldRoom.onlineList().map((o) => [o.charId, o]));
    acc.chars.forEach((c) => { const o = live.get(c.id); c.online = !!o; if (o) { c.level = o.level; c.gold = o.gold; } });
    return acc;
  }));
  app.post("/api/admin/account/:uid", admin(async (user, req) => {
    const uid = req.params.uid, b = req.body || {};
    const acc = await store.account(uid);
    if (b.password !== undefined) {
      await store.setPassword(uid, b.password);
      audit(user, `เปลี่ยนรหัสผ่านของ ${acc.loginId}`);
      return { msg: "เปลี่ยนรหัสผ่านแล้ว" };
    }
    const patch = {};
    if (b.slots !== undefined) patch.slots = Number(b.slots);
    if (b.banned !== undefined) patch.banned = !!b.banned;
    if (patch.banned && adminOk({ loginId: acc.loginId })) fail("ระงับบัญชีแอดมินไม่ได้");
    await store.updateAccount(uid, patch);
    if (patch.banned) WorldRoom.kickUid(uid, "บัญชีนี้ถูกระงับการใช้งาน");
    const what = patch.banned !== undefined ? (patch.banned ? "ระงับบัญชี" : "ยกเลิกระงับบัญชี") : `ตั้งช่องตัวละคร = ${patch.slots}`;
    audit(user, `${what} ${acc.loginId}`);
    return { msg: what + "แล้ว" };
  }));
  app.post("/api/admin/char/:id", admin(async (user, req) => {
    const b = req.body || {};
    if (b.action === "kick") {
      if (!WorldRoom.kick(req.params.id)) fail("ตัวละครนี้ไม่ได้ออนไลน์");
      audit(user, `เตะ ${b.name || req.params.id} ออกจากเกม`);
      return { msg: "นำออกจากเกมแล้ว" };
    }
    const r = await editChar(req.params.id, String(b.action), b);
    audit(user, `${b.name || req.params.id}: ${r.msg}${r.online ? "" : " (ออฟไลน์)"}`);
    return r;
  }));
  app.post("/api/admin/announce", admin(async (user, req) => {
    const text = String((req.body && req.body.text) || "").trim().slice(0, 200);
    if (!text) fail("พิมพ์ข้อความก่อน");
    WorldRoom.announce(text);
    audit(user, `ประกาศ: ${text}`);
    return { msg: "ประกาศแล้ว" };
  }));
  app.get("/api/admin/logs", admin(async () => ({ logs })));
}

module.exports = { mount, adminOk };

// =============================================================
//  เมนูแอดมิน (API) — ใช้ได้เฉพาะ ID ที่อยู่ใน ADMIN_IDS (ตั้งใน Render)
//  แก้ตัวละครได้ทั้งตอนออนไลน์ (มีผลในเกมทันที) และออฟไลน์ (แก้ในฐานข้อมูล)
// =============================================================
const { store, StoreError, isAdmin } = require("./store");
const { WorldRoom } = require("./WorldRoom");
const D = require("./data");
const I = require("./items");
const Bag = require("./inventory");
const W = require("./maps");

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
          if (a.s && typeof a.s === "object") g.s = I.cleanSpecial(a.s);
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
  // แก้อุปกรณ์ที่มีอยู่: where = "inv" (idx) หรือ "eq" (slot) · r = ระดับใหม่ · up = ตีบวก · reroll = สุ่มค่าพิเศษใหม่
  editGear(c, a) {
    return withBag(c, (b) => {
      const g = a.where === "eq" ? b.equip[String(a.slot)] : b.inv[Math.floor(Number(a.idx))];
      if (!g || !Bag.isGearId(g.id)) fail("ไม่พบอุปกรณ์ชิ้นนี้");
      const it = I.ITEMS[g.id], changes = [];
      if (a.r !== undefined && a.r !== "" && Number(a.r) !== g.r) {
        const ng = I.makeGear(g.id, Number(a.r));
        g.r = ng.r; g.x = ng.x; g.s = ng.s; changes.push(`ระดับ${I.RARITY[g.r].name}`);
      } else if (a.reroll) { g.x = I.makeGear(g.id, g.r).x; changes.push("สุ่มค่าพิเศษใหม่"); }
      if (a.up !== undefined && a.up !== "") {
        const up = Math.max(0, Math.min(I.MAX_REFINE, Math.floor(Number(a.up) || 0)));
        if (up && !I.canRefine(it)) fail("ไอเทมนี้ตีบวกไม่ได้");
        if (up !== (g.up || 0)) { g.up = up; changes.push(`ตีบวก +${up}`); }
      }
      if (a.s && typeof a.s === "object") {
        const ns = I.cleanSpecial(a.s);
        if (JSON.stringify(ns) !== JSON.stringify(g.s || {})) { g.s = ns; changes.push("สเตตัสแฝง " + (Object.entries(ns).map(([k, v]) => `${I.SPECIAL[k].name} +${v}%`).join(", ") || "(ไม่มี)")); }
      }
      if (!changes.length) fail("ไม่มีอะไรเปลี่ยน");
      return `แก้ ${it.name}: ${changes.join(", ")}`;
    });
  },
  removeEquip(c, a) {
    return withBag(c, (b) => {
      const g = b.equip[String(a.slot)];
      if (!g) fail("ช่องนี้ว่าง");
      delete b.equip[String(a.slot)];
      return `ลบ ${I.ITEMS[g.id].name} ที่สวมอยู่`;
    });
  },
  pet(c, a) {
    return withBag(c, (b) => {
      if (!a.id) { if (!b.pet) fail("ไม่มีสัตว์เลี้ยงออกมา"); const old = b.pet; b.pet = null; return `ลบสัตว์เลี้ยง ${I.ITEMS[old].name}`; }
      if (!I.ITEMS[a.id] || I.ITEMS[a.id].type !== "pet") fail("ไม่ใช่สัตว์เลี้ยง");
      b.pet = a.id;
      return `ให้สัตว์เลี้ยง ${I.ITEMS[a.id].name} (ออกมาทันที)`;
    });
  },
  resetStats(c) { c.stats = D.baseStats(); return "รีเซ็ตสเตตัส (คืนแต้มทั้งหมด)"; },
  resetSkills(c) { c.skills = D.innateSkills(); return "รีเซ็ตสกิล (คืนแต้มสกิลทั้งหมด)"; },
  job(c, a) {
    if (!D.JOBS[a.job]) fail("ไม่รู้จักอาชีพ");
    c.job = a.job; c.quest = null; c.stats = D.baseStats();
    return `เปลี่ยนอาชีพเป็น${D.JOBS[a.job].name} (คืนแต้มสเตตัสทั้งหมด)`;
  },
  town(c) { c.x = null; c.y = null; c.map = require("./maps").START_MAP; return "ส่งกลับเมือง"; },
  heal(c) { c.heal = true; return "ฟื้น HP/SP เต็ม"; },
  warp(c, a) {
    const W = require("./maps");
    if (!W.MAPS[a.map]) fail("ไม่รู้จักแผนที่");
    c.map = a.map; c.x = null; c.y = null; c.warpTo = a.map;
    return `ส่งไป ${W.MAPS[a.map].name}`;
  },
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
  const keep = ["level", "exp", "stats", "inv", "equip", "gold", "pet", "x", "y", "map", "job", "quest", "skills"];
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
    items: Object.entries(I.ITEMS).map(([id, it]) => ({ id, name: it.name, type: it.type, lv: it.lv || 0, slot: it.slot || null,
      wt: it.wt || null, ac: it.ac || null, set: it.set || null, bonus: it.bonus || null, desc: it.desc || "", price: it.price || 0,
      shop: I.SHOP.includes(id), special: it.special || null, refineFx: it.refineFx || null, sets: I.setsOf(id).map((k) => I.ITEM_SETS[k].name), jobs: it.type === "equip" ? require("./inventory").jobsFor(it) : [] })),
    special: I.SPECIAL,
    jobs: Object.fromEntries(Object.entries(D.JOBS).map(([k, j]) => [k, { name: j.name, color: j.color }])),
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
  // ข้อมูลเกมทั้งหมด (อ่านอย่างเดียว) สำหรับแท็บ "ข้อมูลเกม"
  app.get("/api/admin/gamedata", admin(async () => {
    const items = Object.fromEntries(Object.entries(I.ITEMS).map(([id, it]) => [id, { ...it,
      sellPrice: I.sellPrice(id), refinable: I.canRefine(it),
      refine10: I.canRefine(it) ? I.refineBonus(it, 10) : null }]));
    const refine = I.REFINE.slice(1).map((r, i) => ({ to: i + 1, rate: r.rate, mats: r.mats,
      goldLv1: I.refineGold({ lv: 1 }, i + 1), goldLv10: I.refineGold({ lv: 10 }, i + 1), goldLv20: I.refineGold({ lv: 20 }, i + 1) }));
    return { items, rarity: I.RARITY, refine, safeRefine: I.SAFE_REFINE, shop: I.SHOP, drops: I.DROPS,
      monsters: Object.fromEntries(Object.entries(D.MONSTERS).map(([k, m]) => [k, { ...m, ...D.monsterStats(m.level) }])) };
  }));
  // ปิดปรับปรุง: { minutes, msg } = เริ่มนับถอยหลัง · { cancel: true } = ยกเลิก · { open: true } = เปิดให้เข้าเกมอีกครั้ง
  app.get("/api/admin/maintenance", admin(async () => { const i = WorldRoom.maintInfo(); return { ...i, note: i.msg }; }));
  app.post("/api/admin/maintenance", admin(async (user, req) => {
    const b = req.body || {};
    if (b.cancel || b.open) {
      WorldRoom.cancelMaint();
      audit(user, b.open ? "เปิดเซิร์ฟให้เข้าเกมอีกครั้ง" : "ยกเลิกการปิดปรับปรุง");
      const info = WorldRoom.maintInfo();
      return { ...info, note: info.msg, msg: b.open ? "เปิดให้เข้าเกมแล้ว" : "ยกเลิกแล้ว" };
    }
    const minutes = Math.max(0.5, Math.min(120, Number(b.minutes) || 5));
    const msg = String(b.msg || "").trim().slice(0, 120);
    WorldRoom.startMaint(minutes, msg);
    audit(user, `ตั้งเวลาปิดปรับปรุงใน ${minutes} นาที${msg ? ": " + msg : ""}`);
    const info = WorldRoom.maintInfo();
    return { ...info, note: info.msg, msg: `เริ่มนับถอยหลัง ${minutes} นาที` };
  }));
  // World Boss: ดูสถานะ / เรียก / ลบ
  app.get("/api/admin/worldboss", admin(async () => ({
    bosses: Object.fromEntries(Object.entries(D.WORLD_BOSSES).map(([k, b]) => [k, { name: b.name, level: b.level }])),
    maps: Object.fromEntries(Object.entries(W.MAPS).filter(([, m]) => m.type !== "town").map(([k, m]) => [k, m.name + (m.lv ? ` (Lv.${m.lv[0]}–${m.lv[1]})` : "")])),
    status: WorldRoom.bossStatus(),
  })));
  app.post("/api/admin/worldboss", admin(async (user, req) => {
    const b = req.body || {};
    let r;
    try { r = b.action === "remove" ? WorldRoom.removeWorldBoss() : WorldRoom.spawnWorldBoss(String(b.boss), String(b.map)); }
    catch (e) { fail(e.message); }
    audit(user, `World Boss: ${r.msg}`);
    return r;
  }));
  app.get("/api/admin/logs", admin(async () => ({ logs })));
}

module.exports = { mount, adminOk };

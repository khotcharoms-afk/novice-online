// =============================================================
//  ห้องโลกเกม — เซิร์ฟเวอร์เป็นตัวตัดสินทุกอย่าง (เดิน / ตี / ดาเมจ / EXP)
//  ผู้เล่นส่งมาแค่ "อยากทำอะไร" เช่น เดินไปตรงนี้ / ตีตัวนี้ / ใช้สกิลนี้
// =============================================================
const { Room, ServerError } = require("colyseus");
const { store, StoreError, isAdmin } = require("./store");
const { Schema, MapSchema, defineTypes } = require("@colyseus/schema");
const { generateMap, isWalkable } = require("./map");
const W = require("./maps");
// แผนที่สร้างจาก seed เดิมทุกครั้ง → เก็บไว้ใช้ซ้ำ
const mapCache = {};
const getMap = (id) => mapCache[id] || (mapCache[id] = generateMap(id));
const { NavGrid } = require("./path");
const D = require("./data");
const I = require("./items");
const Bag = require("./inventory");
const SP = require("./spirits");
const CG = require("./classgear");

const SPEED = 170;           // ความเร็วเดินผู้เล่น (px/วินาที)
const TICK_MS = 50;          // อัปเดตโลก 20 ครั้ง/วินาที
const BODY = 9;              // ครึ่งความกว้างเท้า (เช็คชน)
const MELEE_RANGE = 44;      // ระยะตีใกล้
const MOB_ATK_MS = 1500;
const MOB_RANGE = 40;
const AGGRO_RADIUS = 150;
// โซนอันตราย (แผนที่ Lv.60+ ที่ตั้ง danger): มอนเพิ่ม ×1.5 · ทุกตัวดุ มองเห็นไกลขึ้น · โดนตี/เจอเป้าแล้วเรียกพวกรอบ ๆ มารุม
const DANGER = { count: 1.5, aggro: 200, call: 140, callMax: 2 };
const LEASH = 420;
const ELITE_CHANCE = 0.04;      // โอกาสมอนเกิดเป็นชั้นยอด
const MINI_RESPAWN_MS = [8 * 60000, 12 * 60000]; // มินิบอสเกิดใหม่ 8–12 นาทีหลังตาย           // มอนไล่ไกลเกินนี้จะกลับบ้าน
const RESPAWN_PLAYER_MS = 4000;      // ตายแล้วต้องรออย่างน้อยเท่านี้ก่อนกดเกิด
const RESPAWN_AUTO_MS = 30000;       // ไม่กดเลือก → เกิดที่คริสตัลใกล้สุดเอง
const RESPAWN_SAFE_MS = 3000;        // เกิดที่คริสตัลแล้วมอนตีไม่เข้าชั่วครู่
const CRYSTAL_SAFE = 160;            // เขตปลอดภัยรอบคริสตัล (5 ช่อง): มอนเข้าไม่ได้ · ข้างในโจมตีไม่ได้/โดนตีไม่ได้
const WHOLE_MAP = 9999;              // ค่าพิเศษ = ตีได้ทั้งแมพ
const AUTO_RADII = [160, 360, 560, WHOLE_MAP]; // ขอบเขต AUTO: 5 / 11 / 17 ช่อง รอบจุดที่เปิด AUTO หรือทั้งแมพ
const AUTO_POTION_PCT = 35;    // ค่าเริ่มต้น: กินยาเมื่อ HP ต่ำกว่า 35%
const AUTO_POTION_CD = 1200;   // AUTO กินยาได้ทุก 1.2 วินาที

// ---------- ข้อมูลที่ซิงก์ไปให้ผู้เล่นทุกคน ----------
class Player extends Schema {}
defineTypes(Player, {
  name: "string", look: "string", job: "string", jobName: "string",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean", auto: "boolean", autoState: "string", autoX: "number", autoY: "number", autoR: "uint16",
  level: "uint16", exp: "uint32", expNext: "uint32",
  hp: "uint32", maxHp: "uint32", sp: "uint32", maxSp: "uint32",
  str: "uint16", agi: "uint16", vit: "uint16", int: "uint16", dex: "uint16", statPoints: "uint16",
  gear: "string", // ของที่สวมแล้วเห็นบนตัว (คั่นด้วย ,)
  glow: "string", // แสงตีบวก +7 ขึ้นไป เช่น "weapon:10,armor:7"
  skillPts: "uint16", // แต้มสกิลที่ยังไม่ได้ใช้
  stealth: "boolean", // ล่องหนอยู่ (นักฆ่าเงา) — คนอื่นเห็นจาง ๆ
});
class Drop extends Schema {}
defineTypes(Drop, { item: "string", n: "uint16", x: "number", y: "number", r: "uint8" }); // r = ระดับความหายาก (อุปกรณ์)
class Monster extends Schema {}
defineTypes(Monster, {
  kind: "string", name: "string", level: "uint16", sprite: "string", tint: "uint32", scale: "number",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean",
  hp: "uint32", maxHp: "uint32", boss: "boolean",
  rank: "uint8", // 0 = ปกติ · 1 = ชั้นยอด (สุ่มเกิด) · 2 = มินิบอสประจำแผนที่
});
// สัตว์เลี้ยง (key = sessionId ของเจ้าของ) — บินได้ จึงไม่ชนสิ่งกีดขวาง
class Pet extends Schema {}
defineTypes(Pet, { kind: "string", x: "number", y: "number", dir: "string", moving: "boolean" });
// ภูติ (key = sessionId ของเจ้าของ) · r = ระดับสี · lv = เลเวลภูติ
class Spirit extends Schema {}
defineTypes(Spirit, { kind: "string", x: "number", y: "number", r: "uint8", lv: "uint8", st: "uint8" }); // st = ร่าง (0–4)
class WorldState extends Schema {
  constructor() { super(); this.players = new MapSchema(); this.monsters = new MapSchema(); this.drops = new MapSchema(); this.pets = new MapSchema(); this.spirits = new MapSchema(); }
}
defineTypes(WorldState, { players: { map: Player }, monsters: { map: Monster }, drops: { map: Drop }, pets: { map: Pet }, spirits: { map: Spirit } });
const PET_PICK = 12;          // สัตว์เลี้ยงบินถึงของในระยะนี้ = เก็บ
const PET_FOLLOW = 30;        // ระยะห่างตอนบินตามเจ้าของ
const DROP_OWNER_MS = 10000;  // เจ้าของมีสิทธิ์เก็บก่อน 10 วิ
const DROP_LIFE_MS = 60000;   // ของบนพื้นหายใน 60 วิ
const PICK_RANGE = 28;
const NPC_RANGE = 110;        // ต้องยืนใกล้ NPC แค่ไหนถึงซื้อขายได้

const now = () => Date.now();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
const rand = (a, b) => a + Math.random() * (b - a);

const SAVE_EVERY_MS = 60000;
const online = new Map(); // charId -> { room, sessionId } (ตัวละครที่ออนไลน์อยู่)
const rooms = new Set();  // ห้องโลกเกมที่เปิดอยู่
// ---------- ปาร์ตี้ (ข้ามแผนที่ได้ · หลุด/ออกเกม = ยังอยู่ในปาร์ตี้ 10 นาที · บันทึกติดตัวละคร → รอดตอนเซิร์ฟเวอร์รีสตาร์ท) ----------
const PARTY_MAX = 6;
const PARTY_RANGE = 900;          // สมาชิกที่อยู่แผนที่เดียวกันในระยะนี้จากมอน = ได้ EXP แบ่ง
const PARTY_GRACE_MS = Number(process.env.PARTY_GRACE_MIN || 10) * 60000; // หลุดเกินเวลานี้ = ถูกนำออกจากปาร์ตี้
const PARTY_LEAD_MS = 60000;      // หัวหน้าหลุดเกิน 1 นาที → ส่งต่อให้สมาชิกที่ออนไลน์
const parties = new Map();        // partyId -> { id, leader, members: [charId], names: {cid: ชื่อ}, off: {cid: เวลาที่หลุด}, quit: {cid: true} }
const partyOf = new Map();        // charId -> partyId
const invites = new Map();        // charId ผู้ถูกชวน -> { from: charId, until }
let shuttingDown = 0;             // เวลาที่เซิร์ฟเวอร์จะปิด (กำลังนับถอยหลังอัปเดต)
const newPartyId = () => "pt" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const who = (cid) => { const o = online.get(cid); const p = o && o.room.state.players.get(o.sessionId); return p ? { o, p } : null; };
const clientOf = (cid) => { const o = online.get(cid); return o && o.room.clients.find((c) => c.sessionId === o.sessionId); };
const partyName = (pt, cid) => { const w = who(cid); if (w) pt.names[cid] = w.p.name; return pt.names[cid] || "สมาชิก"; };
const partyTell = (pt, text, skip) => { for (const x of pt.members) if (x !== skip) { const c = clientOf(x); if (c) c.send("system", text); } };
function partySend(party) {
  if (!party) return;
  const t = Date.now();
  const members = party.members.map((cid) => {
    const w = who(cid);
    if (w) party.names[cid] = w.p.name;
    return w ? { cid, name: w.p.name, level: w.p.level, job: w.p.jobName, hp: w.p.hp, maxHp: w.p.maxHp, sp: w.p.sp, maxSp: w.p.maxSp, map: w.o.room.def.name, mapId: w.o.room.mapId, sid: w.o.sessionId, dead: w.p.dead }
      : { cid, name: party.names[cid] || "?", offline: true, quit: !!party.quit[cid], left: party.off[cid] ? Math.max(0, PARTY_GRACE_MS - (t - party.off[cid])) : PARTY_GRACE_MS };
  });
  for (const cid of party.members) { const cl = clientOf(cid); if (cl) cl.send("party", { id: party.id, leader: party.leader, me: cid, members }); }
}
function partyRemove(cid, reason) {
  const pid = partyOf.get(cid), party = pid && parties.get(pid);
  partyOf.delete(cid);
  if (!party) return;
  const nm = partyName(party, cid);
  party.members = party.members.filter((x) => x !== cid);
  delete party.off[cid]; delete party.quit[cid];
  const cl = clientOf(cid); if (cl) cl.send("party", null);
  if (party.members.length <= 1) { // เหลือคนเดียว = ยุบปาร์ตี้
    for (const x of party.members) { partyOf.delete(x); const c2 = clientOf(x); if (c2) { c2.send("party", null); c2.send("system", `👥 ${nm} ${reason || "ออกจากปาร์ตี้"} — ปาร์ตี้ถูกยุบแล้ว`); } }
    parties.delete(pid); return;
  }
  if (party.leader === cid) party.leader = party.members.find((x) => who(x)) || party.members[0];
  partyTell(party, `👥 ${nm} ${reason || "ออกจากปาร์ตี้"}`);
  partySend(party);
}
// ผู้เล่นออกเกม/หลุด (ไม่ใช่ย้ายแผนที่) → ยังอยู่ในปาร์ตี้ รอกลับมา
function partyDrop(cid) {
  const pt = parties.get(partyOf.get(cid));
  if (!pt) return;
  pt.off[cid] = pt.off[cid] || Date.now(); pt.quit[cid] = true;
  if (!shuttingDown) partyTell(pt, `👥 ${partyName(pt, cid)} ออกจากเกม — ยังอยู่ในปาร์ตี้ (รอกลับมา ${Math.round(PARTY_GRACE_MS / 60000)} นาที)`, cid);
  partySend(pt);
}
// ผู้เล่นเข้าเกม (หรือย้ายแผนที่เสร็จ) → กลับเข้าปาร์ตี้เดิม · หลังเซิร์ฟเวอร์รีสตาร์ท สร้างปาร์ตี้ขึ้นใหม่จากข้อมูลที่บันทึกไว้ในตัวละคร
function partyBack(cid, saved) {
  let pt = parties.get(partyOf.get(cid));
  if (!pt && saved && saved.id && Array.isArray(saved.members) && saved.members.includes(cid) && Date.now() - (saved.t || 0) < PARTY_GRACE_MS) {
    const ex = parties.get(saved.id);
    if (ex) pt = ex.members.includes(cid) ? ex : null; // ปาร์ตี้ยังอยู่ แต่ถูกเอาออกไปแล้ว = ไม่กลับ
    else {
      const mem = saved.members.filter((m, i, a) => typeof m === "string" && a.indexOf(m) === i && (m === cid || !partyOf.has(m))).slice(0, PARTY_MAX);
      if (mem.length > 1) {
        const t = Date.now();
        pt = { id: saved.id, leader: mem.includes(saved.leader) ? saved.leader : cid, members: mem, names: { ...(saved.names || {}) }, off: {}, quit: {} };
        for (const m of mem) if (m !== cid) { pt.off[m] = t; pt.quit[m] = true; }
        parties.set(pt.id, pt);
        for (const m of mem) partyOf.set(m, pt.id);
      }
    }
    if (pt) partyOf.set(cid, pt.id);
  }
  if (!pt) return;
  const back = pt.quit[cid];
  delete pt.off[cid]; delete pt.quit[cid];
  if (back) partyTell(pt, `👥 ${partyName(pt, cid)} กลับเข้าเกมแล้ว`, cid);
  partySend(pt);
}
// ข้อมูลปาร์ตี้ที่บันทึกติดตัวละคร
function partySnap(cid) {
  const pt = parties.get(partyOf.get(cid));
  if (!pt) return null;
  for (const m of pt.members) partyName(pt, m);
  return { id: pt.id, leader: pt.leader, members: [...pt.members], names: { ...pt.names }, t: Date.now() };
}
setInterval(() => {
  const t = Date.now();
  for (const pt of [...parties.values()]) {
    for (const cid of [...pt.members]) {
      if (online.has(cid)) continue;
      if (!pt.off[cid]) { pt.off[cid] = t; continue; } // ย้ายแผนที่ค้าง/หลุดเงียบ ๆ ก็นับเวลาเหมือนกัน
      if (t - pt.off[cid] > PARTY_GRACE_MS) partyRemove(cid, "หลุดจากเกมนานเกินไป — ถูกนำออกจากปาร์ตี้");
    }
    if (!parties.has(pt.id)) continue;
    if (pt.off[pt.leader] && t - pt.off[pt.leader] > PARTY_LEAD_MS) {
      const nl = pt.members.find((x) => online.has(x));
      if (nl) { pt.leader = nl; partyTell(pt, `👑 ${partyName(pt, nl)} เป็นหัวหน้าปาร์ตี้แทน (หัวหน้าเดิมออฟไลน์)`); }
    }
    partySend(pt);
  }
}, 1000).unref();
// คริสตัลจุดเกิดของแต่ละแผนที่ (คำนวณครั้งเดียว ใช้ได้แม้ห้องของแผนที่นั้นยังไม่เปิด — สำหรับวาป)
const crystalCache = {};
function mapCrystals(mapId) {
  if (crystalCache[mapId]) return crystalCache[mapId];
  const out = [];
  if (W.MAPS[mapId] && W.MAPS[mapId].type !== "town") {
    const map = getMap(mapId), T = map.tile, MW = map.width, MH = map.height;
    const stand = (x, y) => isWalkable(map, x - 9, y - 8) && isWalkable(map, x + 9, y - 8) && isWalkable(map, x - 9, y + 2) && isWalkable(map, x + 9, y + 2);
    const reach = new Uint8Array(MW * MH), st = [[Math.floor(map.spawn.x / T), Math.floor(map.spawn.y / T)]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= MW || y >= MH || reach[y * MW + x] || !stand(x * T + T / 2, y * T + T / 2)) continue;
      reach[y * MW + x] = 1; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const cx = (MW / 2) * T, cy = (MH / 2) * T;
    let best = null;
    for (let rr = 0; rr < 12 && !best; rr++)
      for (let dy = -rr; dy <= rr && !best; dy++)
        for (let dx = -rr; dx <= rr && !best; dx++) {
          const x = Math.floor(cx / T + dx) * T + T / 2, y = Math.floor(cy / T + dy) * T + T / 2;
          if (stand(x, y) && stand(x, y + T) && reach[Math.floor(y / T) * MW + Math.floor(x / T)]) best = { x, y };
        }
    if (best) out.push(best);
  }
  return (crystalCache[mapId] = out);
}
// วาปด้วย "ตั๋ว" (ย้ายแผนที่โดยไม่ต้องรอบันทึก/โหลดจากฐานข้อมูล) · บันทึกของแต่ละตัวละครเรียงคิวกัน (ไม่ให้ข้อมูลเก่าเขียนทับใหม่)
const warpTickets = new Map();   // ticket -> { uid, charId, user, char, until }
const saveChain = new Map();     // charId -> Promise ของการบันทึกล่าสุด
// คลังเก็บของ: โหลดครั้งเดียวต่อบัญชีแล้วเก็บในหน่วยความจำ (หลายตัวละครในบัญชีเดียวเห็นคลังเดียวกัน) · บันทึกหลังเปลี่ยน 2 วิ
const storages = new Map();      // uid -> { st, timer }
async function getStorage(uid) {
  let e = storages.get(uid);
  if (!e) { e = { p: store.loadStorage(uid).then((raw) => (e.st = Bag.loadStorage(raw))) }; storages.set(uid, e); }
  if (!e.st) await e.p;
  return e.st;
}
function storageDirty(uid) {
  const e = storages.get(uid);
  if (!e || e.timer) return;
  e.timer = setTimeout(() => { e.timer = null; store.saveStorage(uid, Bag.saveStorage(e.st)).catch((err) => console.error("storage save", uid, err.message)); }, 2000);
}
const TRADE_RANGE = 320;         // ต้องยืนใกล้กันไม่เกิน 10 ช่อง
const TRADE_SLOTS = 8;
const pendingBoss = new Map(); // mapId -> bossKey (สั่งเรียกบอสตอนแผนที่ยังไม่มีคน → เกิดเมื่อมีคนเข้า)
// ตารางเกิด World Boss อัตโนมัติ: key -> { next: เวลาเกิดครั้งถัดไป, alive, since, map, warned }
const BOSS_LIFE_MS = 60 * 60000;   // เกิดแล้วไม่มีใครปราบภายใน 60 นาที → หายไป
const BOSS_WARN_MS = 5 * 60000;    // ประกาศเตือนล่วงหน้า 5 นาที
const bossSched = {};
const randMin = ([a, b]) => (a + Math.random() * (b - a)) * 60000;
for (const [k, B] of Object.entries(D.WORLD_BOSSES)) bossSched[k] = { next: Date.now() + randMin([10, 25]), alive: false, since: 0, map: null, warned: false };
// ปิดปรับปรุง: แอดมินตั้งเวลานับถอยหลัง → ครบเวลา = บันทึกทุกคน + ให้ออกจากเกม + ปิดไม่ให้เข้า (จนแอดมินเปิดหรือเซิร์ฟรีสตาร์ท)
const maint = { endAt: 0, msg: "", closed: false, timer: null };
// สถิติการหลุด (ไว้ดูสาเหตุ "เด้งบ่อย" ในหน้าแอดมิน/ล็อก Render)
const netStats = { drops: [], lagMax: 0, lagAt: 0, lagSpikes: [] };
{
  let last = performance.now();
  setInterval(() => {
    const t = performance.now(), lag = t - last - 1000; last = t;
    if (lag > netStats.lagMax || Date.now() - netStats.lagAt > 3600000) { netStats.lagMax = Math.max(0, Math.round(lag)); netStats.lagAt = Date.now(); }
    if (lag > 1000) { netStats.lagSpikes.push(Date.now()); console.warn(`[lag] เซิร์ฟเวอร์ค้าง ${Math.round(lag)} ms`); }
    const h = Date.now() - 3600000;
    while (netStats.drops.length && netStats.drops[0].t < h) netStats.drops.shift();
    while (netStats.lagSpikes.length && netStats.lagSpikes[0] < h) netStats.lagSpikes.shift();
  }, 1000).unref();
}
// อีเวนต์ EXP (แอดมินเปิด): คูณ EXP จากมอนทุกคนในเซิร์ฟ · บันทึกในฐานข้อมูล อยู่รอดตอนรีสตาร์ท
const expEvent = { mult: 1, endAt: 0, timer: null };
const expMult = () => (expEvent.mult > 1 && (!expEvent.endAt || expEvent.endAt > Date.now()) ? expEvent.mult : 1);
const adminLogin = (u) => isAdmin(u.loginId) || (store.mode === "dev" && u.loginId === "admin");

// ข้อมูลโลกสำหรับหน้าต่างแผนที่โลก: แต่ละแผนที่มีมอนอะไร ดรอปอะไร บริการอะไร
let worldCache = null;
const SKILLS_CLIENT = D.skillsForClient();
// ใครใส่อะไรได้: WEAR[itemId][job] = ข้อความเหตุผลที่ใส่ไม่ได้ (null = ใส่ได้) — ส่งให้ client ใช้แสดงในการ์ดไอเทม
const WEAR = Object.fromEntries(Object.entries(I.ITEMS).filter(([, it]) => it.type === "equip")
  .map(([id, it]) => [id, Object.fromEntries(Object.keys(D.JOBS).map((j) => [j, Bag.wearError(j, it)]))]));
function worldInfo() {
  if (worldCache) return worldCache;
  worldCache = { name: W.WORLD_NAME, maps: Object.entries(W.MAPS).map(([id, m]) => ({
    id, name: m.name, type: m.type, lv: m.lv, desc: m.desc, danger: !!m.danger, world: m.world, season: m.season,
    exits: Object.values(m.exits),
    mobs: [...new Set(m.spawns.map(([k]) => k))].map((k) => ({ kind: k, name: D.MONSTERS[k].name, level: D.MONSTERS[k].level,
      aggressive: D.MONSTERS[k].aggressive, drops: (I.DROPS[k] || []).map(([id]) => id) })),
    services: m.type === "town" ? ["ร้านยา (มิเรล)", "ร้านอาวุธ (การ์เร็ธ)", "ร้านชุดเกราะ (บรอนแดน)", "ของจิปาถะ · คริสตัล · สัตว์เลี้ยง (ทอบบี้)", "ตีบวก + รวมคริสตัล (ดัวร์กัน)", "เปลี่ยนอาชีพ (อัลดริค)"] : [],
  })) };
  return worldCache;
}

class WorldRoom extends Room {
  static isOnline(charId) { return online.has(String(charId)); }
  static worldInfo() { return worldInfo(); }

  // ตรวจตั๋วล็อกอิน + ความเป็นเจ้าของตัวละคร ก่อนให้เข้าห้อง
  async onAuth(client, options) {
    try {
      // ย้ายแผนที่ด้วยตั๋ว: ใช้ข้อมูลจากห้องเดิมในหน่วยความจำเลย (เร็วกว่าอ่านฐานข้อมูล)
      const tk = options && options.ticket && warpTickets.get(String(options.ticket));
      let user, char;
      if (tk && tk.until > Date.now() && tk.charId === options.charId) {
        warpTickets.delete(String(options.ticket));
        user = tk.user; char = tk.char;
      } else {
        user = await store.verify(options && options.token);
        if (maint.closed && !adminLogin(user)) throw new StoreError("เซิร์ฟเวอร์ปิดปรับปรุงชั่วคราว ลองใหม่อีกสักครู่");
        if (saveChain.has(options && options.charId)) await saveChain.get(options.charId); // รอบันทึกล่าสุดให้เสร็จก่อนอ่าน
        char = await store.load(user.uid, options && options.charId);
      }
      const live = online.get(char.id);
      if (live) { const lp = live.room.state.players.get(live.sessionId); if (lp) char = { ...char, ...live.room.toData(lp) }; }
      // ตัวละครอยู่แผนที่อื่น → บอก client ให้เข้าห้องที่ถูก
      const charMap = W.MAPS[char.map] ? char.map : W.START_MAP;
      if (charMap !== this.mapId) throw new StoreError("MAP:" + charMap);
      if (live) {
        // ตัวละครนี้ออนไลน์อยู่ในอีกหน้าต่าง → ใช้ข้อมูลล่าสุดจากในเกม แล้วเตะหน้าต่างเก่าออก
        const old = live.room.clients.find((c) => c.sessionId === live.sessionId);
        const lp = live.room.state.players.get(live.sessionId);
        if (old && lp && lp.warp) old.leave(4005); // ย้ายแผนที่ — ปิดห้องเก่าเงียบ ๆ
        else if (old) { old.send("system", "ตัวละครนี้ถูกเข้าเกมจากที่อื่น"); old.leave(4001); }
      }
      return { user, char };
    } catch (e) {
      if (!(e instanceof StoreError)) console.error("auth failed:", e.message);
      throw new ServerError(401, e instanceof StoreError ? e.message : "กรุณาล็อกอินใหม่");
    }
  }

  onCreate(options) {
    this.maxClients = 100;
    rooms.add(this);
    this.mapId = W.MAPS[options && options.mapId] ? options.mapId : W.START_MAP;
    this.def = W.MAPS[this.mapId];
    this.map = getMap(this.mapId);
    const cx = (this.map.width / 2) * this.map.tile, cy = (this.map.height / 2) * this.map.tile;
    this.npcs = this.def.type !== "town" ? [] : [
      { id: "shop_weapon", name: "การ์เร็ธ · ร้านอาวุธ", sprite: "npc_weapon", x: cx - 256, y: cy - 110 },
      { id: "merchant", name: "ทอบบี้ · ของจิปาถะ", sprite: "npc_merchant", x: cx - 128, y: cy - 110 },
      { id: "shop_armor", name: "บรอนแดน · ร้านชุดเกราะ", sprite: "npc_armor", x: cx + 256, y: cy + 110 },
      { id: "shop_potion", name: "มิเรล · ร้านยา", sprite: "npc_potion", x: cx - 256, y: cy + 110 },
      { id: "smith", name: "ดัวร์กัน · ช่างตีบวก", sprite: "npc_smith", x: cx + 128, y: cy - 110 },
      { id: "jobmaster", name: "อัลดริค · ครูฝึกอาชีพ", sprite: "npc_jobmaster", x: cx, y: cy - 150 },
      { id: "spiritkeeper", name: "ลูน่า · ผู้ผนึกภูติ", sprite: "npc_spiritkeeper", x: cx + 128, y: cy + 150 },
      { id: "storage", name: "แมกนัส · คลังเก็บของ", sprite: "npc_storage", x: cx - 128, y: cy + 150 },
      { id: "reclass", name: "เซเลส · ผู้หลอมชะตา", sprite: "npc_reclass", x: cx + 256, y: cy - 110 },
    ];
    this.clock.setInterval(() => this.broadcast("online", online.size), 5000);
    this.drSeq = 0;
    this.dr = new Map(); // ข้อมูลภายในของของบนพื้น: owner, until, expire
    const T = this.map.tile;
    this.nav = new NavGrid(this.map.width, this.map.height, T, (tx, ty) => this.canStand(tx * T + T / 2, ty * T + T / 2));
    // ช่องที่เดินไปถึงได้จากจุดเกิด (มอนจะไม่เกิดในที่ปิดตาย)
    {
      const MW = this.map.width, MH = this.map.height, ok = (tx, ty) => this.canStand(tx * T + T / 2, ty * T + T / 2);
      this.reach = new Uint8Array(MW * MH);
      const st = [[Math.floor(this.map.spawn.x / T), Math.floor(this.map.spawn.y / T)]];
      while (st.length) {
        const [x, y] = st.pop();
        if (x < 0 || y < 0 || x >= MW || y >= MH || this.reach[y * MW + x] || !ok(x, y)) continue;
        this.reach[y * MW + x] = 1;
        st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    this.setState(new WorldState());
    this.pr = new Map(); // ข้อมูลภายในของผู้เล่น (ไม่ส่งให้ client)
    this.mr = new Map(); // ข้อมูลภายในของมอนสเตอร์
    this.mobSeq = 0;
    // คริสตัลจุดเกิด (แผนที่ล่ามอน): 1 อันกลางแผนที่ · มีเขตปลอดภัยรอบ ๆ
    this.crystals = mapCrystals(this.mapId);
    this.spawnMonsters();
    this.mapKinds = new Set(this.def.spawns.map(([k]) => k));
    this.spawnMini();
    if (pendingBoss.has(this.mapId)) { const k = pendingBoss.get(this.mapId); pendingBoss.delete(this.mapId); this.spawnBoss(k); }

    this.onMessage("getMap", (client, m) => {
      const me = this.state.players.get(client.sessionId);
      if (me) this.clock.setTimeout(() => {
        this.sendDerived(me); this.sendInv(client.sessionId);
        if (maint.endAt || maint.closed) client.send("maint", WorldRoom.maintInfo());
        if (shuttingDown > Date.now()) client.send("restartSoon", { left: shuttingDown - Date.now() });
        if (expMult() > 1) client.send("expEvent", WorldRoom.expEventInfo());
      }, 50);
      sendMap(client, m && m.lite);
    });
    // lite = client มีข้อมูลเกม (ไอเทม/สกิล/อาชีพ…) จากแผนที่ก่อนแล้ว → ส่งแค่ข้อมูลของแผนที่นี้ (เล็กลง ~70%)
    const mapOnly = () => ({ ...this.map, lite: true, npcs: this.npcs, crystals: this.crystals, online: online.size,
      mapMobs: [...new Set(this.def.spawns.map(([k]) => k))],
      portals: this.map.portals.map((pt) => ({ ...pt, toName: W.MAPS[pt.to].name, toLv: W.MAPS[pt.to].lv })), world: worldInfo() });
    const sendMap = (client, lite) => lite ? client.send("map", mapOnly()) :
      client.send("map", { ...this.map, skills: SKILLS_CLIENT, jobSkills: D.JOB_SKILLS, skillTree: D.SKILL_TREE,
        statInfo: D.STAT_INFO, special: I.SPECIAL, specialMinRarity: I.SPECIAL_MIN_RARITY, itemSets: I.ITEM_SETS, statKeys: D.STAT_KEYS, statMax: D.STAT_MAX,
        statCostStep: D.STAT_COST_STEP, items: I.ITEMS, stoneFuse: I.STONE_FUSE, rarity: I.RARITY, maxRefine: I.MAX_REFINE, safeRefine: I.SAFE_REFINE, shop: I.SHOP, shops: I.SHOPS, equipSlots: I.EQUIP_SLOTS, slotName: I.SLOT_NAME, invSize: I.INVENTORY_SIZE,
        npcs: this.npcs, crystals: this.crystals, online: online.size,
        jobs: D.JOBS, jobQuests: D.JOB_QUESTS, job2Quests: D.JOB2_QUESTS, job2Level: D.JOB2_LEVEL, miniBosses: Object.fromEntries(Object.entries(D.MINI_BOSSES).map(([k, v]) => [k, { name: v.name, level: v.level }])), weaponTypes: D.WEAPON_TYPES, armorName: D.ARMOR_NAME, buffs: D.BUFFS,
        spirits: SP.SPIRITS, spiritQuests: SP.SPIRIT_QUESTS, spiritStages: SP.STAGE_NAME, spiritBreak: SP.BREAK, spiritUpgrade: SP.UPGRADE, spiritMaxLv: SP.SPIRIT_MAX_LV, spiritRarMul: SP.RAR_MUL,
        jobChangeLevel: D.JOB_CHANGE_LEVEL, jobFreeLv: D.JOB_FREE_LV, wear: WEAR,
        mapMobs: [...new Set(this.def.spawns.map(([k]) => k))],
        portals: this.map.portals.map((pt) => ({ ...pt, toName: W.MAPS[pt.to].name, toLv: W.MAPS[pt.to].lv })),
        world: worldInfo(),
        mobs: Object.fromEntries(Object.entries(D.MONSTERS).map(([k, m]) => [k, { name: m.name, level: m.level, sprite: m.sprite, aggressive: m.aggressive }])) });

    this.onMessage("moveTo", (client, m) => {
      const r = this.alive(client); if (!r || !m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      r.moveTarget = { x: m.x, y: m.y }; r.dx = r.dy = 0; r.target = null; r.pending = null; r.pick = null;
      this.setAuto(client.sessionId, false);
    });
    this.onMessage("dir", (client, m) => {
      const r = this.alive(client); if (!r || !m) return;
      r.dx = Math.sign(Number(m.dx) || 0); r.dy = Math.sign(Number(m.dy) || 0);
      if (r.dx || r.dy) { r.moveTarget = null; r.target = null; r.pending = null; r.pick = null; this.setAuto(client.sessionId, false); }
    });
    this.onMessage("auto", (client, on) => { if (this.alive(client)) this.setAuto(client.sessionId, !!on); });
    // ตั้งค่า AUTO: ขอบเขต + ชนิดมอนที่จะตี (ว่าง = ตีทุกชนิดที่เลเวลไม่เกินเรา +2)
    // ---------- ไอเทม ----------
    this.onMessage("equip", (client, m) => this.withBag(client, m, (p, b) => Bag.equipFrom(b, Number(m.idx), p.level, m.slot, p.job)));
    this.onMessage("unequip", (client, m) => this.withBag(client, m, (p, b) => Bag.unequip(b, String(m.slot))));
    this.onMessage("moveItem", (client, m) => this.withBag(client, m, (p, b) => Bag.moveSlot(b, Number(m.from), Number(m.to))));
    this.onMessage("useItem", (client, m) => this.withBag(client, m, (p, b) => this.useItem(client.sessionId, p, b, Number(m.idx))));
    this.onMessage("buy", (client, m) => this.withBag(client, m, (p, b) => this.buy(p, b, String(m.id), Number(m.n) || 1, m.npc)));
    this.onMessage("buyMany", (client, m) => this.withBag(client, m, (p, b) => this.buyMany(client, p, b, m.items, m.npc)));
    this.onMessage("sellMany", (client, m) => this.withBag(client, m, (p, b) => this.sellMany(client, p, b, m.items)));
    this.onMessage("sell", (client, m) => this.withBag(client, m, (p, b) => this.sell(p, b, Number(m.idx), Number(m.n) || 1)));
    this.onMessage("refine", (client, m) => this.withBag(client, m, (p, b) => this.refine(client, p, b, m)));
    this.onMessage("fuseStone", (client, m) => this.withBag(client, m, (p, b) => {
      if (!this.nearNpc(p, "smith")) return "เดินเข้าใกล้ช่างตีบวกก่อน";
      const to = String(m.to), f = I.STONE_FUSE[to];
      if (!f) return;
      const times = Math.max(1, Math.min(99, Math.floor(Number(m.times) || 1)));
      const can = Math.min(times, Math.floor(Bag.countOf(b, f.from) / f.n), Math.floor(b.gold / f.gold));
      if (can < 1) return Bag.countOf(b, f.from) < f.n ? `ต้องมี ${I.ITEMS[f.from].name} ${f.n} ก้อน` : "gold ไม่พอ";
      if (!Bag.canFit(b, to, can) && !Bag.canFit(b, to, 1)) return "กระเป๋าเต็ม";
      let need = can * f.n;
      for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) {
        const s = b.inv[i];
        if (s && s.id === f.from) { const k = Math.min(need, s.n); Bag.removeAt(b, i, k); need -= k; }
      }
      b.gold -= can * f.gold;
      Bag.addItem(b, to, can);
      client.send("toast", `รวมคริสตัลสำเร็จ: ได้ ${I.ITEMS[to].name} ×${can}`);
      this.saveSoon(client.sessionId);
    }));
    // ทิ้งไอเทม (ทำลาย) — ของที่ไม่อยากได้/ขายไม่ได้
    this.onMessage("discard", (client, m) => this.withBag(client, m, (p, b) => {
      const idx = Math.floor(Number(m.idx)), s = b.inv[idx];
      if (!s) return;
      const n = Math.max(1, Math.min(s.n, Math.floor(Number(m.n) || s.n)));
      Bag.removeAt(b, idx, n);
      client.send("toast", `ทิ้ง ${I.ITEMS[s.id].name} ×${n} แล้ว`);
      if (Bag.isGearId(s.id) && (s.r >= 2 || s.up > 0)) this.saveSoon(client.sessionId);
    }));
    this.onMessage("sortBag", (client, m) => this.withBag(client, m || {}, (p, b) => Bag.sortBag(b)));
    this.onMessage("petOff", (client) => this.withBag(client, {}, (p, b) => Bag.recallPet(b)));
    this.onMessage("respawn", (client, m) => {
      const p = this.state.players.get(client.sessionId), r = this.pr.get(client.sessionId);
      if (!p || !r || !p.dead) return;
      r.respawnPick = m && m.where === "town" ? "town" : "crystal";
    });
    this.onMessage("partyInvite", (client, m) => this.partyInvite(client, m || {}));
    this.onMessage("partyAnswer", (client, m) => this.partyAnswer(client, m || {}));
    this.onMessage("partyLeave", (client) => { const r = this.pr.get(client.sessionId); if (r) partyRemove(r.charId); });
    this.onMessage("partyKick", (client, m) => {
      const r = this.pr.get(client.sessionId), pt = r && parties.get(partyOf.get(r.charId));
      if (!pt || pt.leader !== r.charId || !m || m.cid === r.charId || !pt.members.includes(m.cid)) return;
      const c = clientOf(m.cid); if (c) c.send("system", "คุณถูกเชิญออกจากปาร์ตี้");
      partyRemove(m.cid, "ถูกเชิญออกจากปาร์ตี้");
    });
    // ---------- คลังเก็บของ ----------
    this.onMessage("storageOpen", (client) => this.storageAct(client, "open", {}));
    this.onMessage("storagePut", (client, m) => this.storageAct(client, "put", m || {}));
    this.onMessage("storageTake", (client, m) => this.storageAct(client, "take", m || {}));
    this.onMessage("storageGold", (client, m) => this.storageAct(client, "gold", m || {}));
    this.onMessage("storageSort", (client) => this.storageAct(client, "sort", {}));
    // ---------- เทรด ----------
    this.onMessage("tradeRequest", (client, m) => this.tradeRequest(client, m || {}));
    this.onMessage("tradeAnswer", (client, m) => this.tradeAnswer(client, m || {}));
    this.onMessage("tradeOffer", (client, m) => this.tradeOffer(client, m || {}));
    this.onMessage("tradeLock", (client) => this.tradeStep(client, "lock"));
    this.onMessage("tradeConfirm", (client) => this.tradeStep(client, "confirm"));
    this.onMessage("tradeCancel", (client) => this.tradeClose(client.sessionId, "ยกเลิกการแลกเปลี่ยน"));
    this.onMessage("teleport", (client, m) => this.teleport(client, String((m && m.map) || "")));
    this.onMessage("bossBoard", (client) => client.send("bossBoard", { at: Date.now(), list: WorldRoom.bossBoard() }));
    this.onMessage("spiritOff", (client) => this.withBag(client, {}, (p, b) => Bag.recallSpirit(b)));
    this.onMessage("spiritQuest", (client, m) => this.withBag(client, m || {}, (p, b) => this.spiritQuest(client, p, b, m || {})));
    this.onMessage("spiritUp", (client, m) => this.withBag(client, m || {}, (p, b) => this.spiritUp(client, p, b, m || {})));
    this.onMessage("spiritBreak", (client, m) => this.withBag(client, m || {}, (p, b) => this.spiritBreak(client, p, b)));
    this.onMessage("pickup", (client, m) => {
      const r = this.alive(client);
      if (!r || !m || !this.state.drops.get(String(m.id))) return;
      r.pick = String(m.id); r.target = null; r.moveTarget = null; r.pending = null; r.dx = r.dy = 0;
    });
    this.onMessage("addStat", (client, m) => m && this.addStat(client.sessionId, String(m.stat), m.n));
    this.onMessage("recommendStats", (client) => this.recommendStats(client.sessionId));
    this.onMessage("autoCfg", (client, c) => {
      const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
      if (!r || !c) return;
      const radius = AUTO_RADII.includes(Number(c.radius)) ? Number(c.radius) : WHOLE_MAP;
      const kinds = Array.isArray(c.kinds) ? c.kinds.filter((k) => D.MONSTERS[k]).slice(0, 10) : [];
      const pct = Math.round(Number(c.potionPct) / 5) * 5;
      const pk = c.pick && typeof c.pick === "object" ? c.pick : {};
      const pick = { equip: Number.isInteger(pk.equip) && pk.equip >= -1 && pk.equip <= 4 ? pk.equip : 0, use: pk.use !== false, stone: pk.stone !== false, mat: pk.mat !== false };
      const isPot = (id, f) => id === "auto" || (I.ITEMS[id] && I.ITEMS[id].type === "use" && I.ITEMS[id].heal && I.ITEMS[id].heal[f]);
      const spPct = Math.round(Number(c.spPct) / 5) * 5;
      r.autoCfg = { radius, kinds, pick, loot: c.loot !== false, potion: c.potion !== false,
        potionPct: pct >= 10 && pct <= 90 ? pct : AUTO_POTION_PCT,
        hpPot: isPot(String(c.hpPot || "auto"), "hp") ? String(c.hpPot || "auto") : "auto",   // ยาแดงที่จะใช้ ("auto" = เลือกขวดที่พอดีให้)
        spOn: !!c.spOn, spPot: isPot(String(c.spPot || "auto"), "sp") ? String(c.spPot || "auto") : "auto", spPct: spPct >= 10 && spPct <= 90 ? spPct : 30,
        skillOff: Array.isArray(c.skillOff) ? c.skillOff.filter((k) => D.SKILLS[k]).slice(0, 30) : [] }; // สกิลที่ไม่ให้ AUTO ใช้
      p.autoR = radius;
    });
    this.onMessage("attack", (client, m) => {
      const r = this.alive(client); if (!r || !m) return;
      const mob = this.state.monsters.get(String(m.id));
      if (!mob || mob.dead) return;
      r.target = String(m.id); r.moveTarget = null; r.dx = r.dy = 0; r.pick = null;
    });
    this.onMessage("skill", (client, m) => this.useSkill(client, m));
    // ---------- เปลี่ยนอาชีพ ----------
    this.onMessage("jobQuest", (client, m) => this.jobQuest(client, m || {}));
    this.onMessage("rebirth", (client, m) => this.rebirth(client, m || {}));
    this.onMessage("learnSkill", (client, m) => m && this.learnSkill(client, String(m.skill)));
    this.onMessage("chat", (client, text) => {
      const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
      if (!r || !p || typeof text !== "string") return;
      if (now() - r.lastChat < 700) return;
      r.lastChat = now();
      let clean = text.trim().slice(0, 100);
      // /p ข้อความ = แชทปาร์ตี้ · /invite ชื่อ = ชวนเข้าปาร์ตี้
      if (/^\/p\s/i.test(clean)) {
        const pt = parties.get(partyOf.get(r.charId)), msg = clean.replace(/^\/p\s+/i, "");
        if (!pt) return client.send("system", "คุณยังไม่มีปาร์ตี้");
        if (msg) for (const cid of pt.members) { const c = clientOf(cid); if (c) c.send("chat", { id: client.sessionId, name: p.name, text: msg, party: true }); }
        return;
      }
      if (/^\/invite\s/i.test(clean)) return this.partyInvite(client, { name: clean.replace(/^\/invite\s+/i, "") });
      // แชทถึงทุกแผนที่
      if (clean) rooms.forEach((rm) => rm.broadcast("chat", { id: client.sessionId, name: p.name, text: clean, map: this.def.name }));
    });

    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);
    this.clock.setInterval(() => { this.regen(); this.sweepDrops(); }, 1000);
    this.clock.setInterval(() => this.state.players.forEach((_p, id) => this.save(id)), SAVE_EVERY_MS);
  }

  // ================= บันทึกตัวละคร =================
  toData(p) {
    const dead = p.dead || p.hp <= 0;
    // ตายอยู่ (ออกเกมระหว่างรอฟื้น) → บันทึกเป็นที่เมือง
    const deadOut = dead && !p.warp && this.mapId !== W.START_MAP;
    const spot = p.warp || (deadOut ? getMap(W.START_MAP).spawn : dead ? this.townSpawn() : p);
    const map = p.warp ? p.warp.map : deadOut ? W.START_MAP : this.mapId;
    return { level: p.level, exp: p.exp, hp: dead ? p.maxHp : p.hp, sp: p.sp, map,
      x: Math.round(spot.x), y: Math.round(spot.y), look: p.look, job: p.job, quest: p.quest || null, skills: { ...(p.skills || {}) },
      stats: Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k]])), ...Bag.saveBag(p.bag) };
  }
  save(pid) {
    const p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || !r.charId) return Promise.resolve();
    const data = { ...this.toData(p), party: partySnap(r.charId) }, prev = saveChain.get(r.charId) || Promise.resolve();
    const next = prev.then(() => store.save(r.charId, data)).catch((e) => console.error("save failed", r.charId, e.message));
    saveChain.set(r.charId, next);
    next.then(() => { if (saveChain.get(r.charId) === next) saveChain.delete(r.charId); });
    return next;
  }
  // บันทึกเร็ว ๆ หลังเหตุการณ์สำคัญ (ได้ของหายาก ตีบวก ซื้อของแพง) — รวมหลายครั้งในเวลาใกล้กันเป็นครั้งเดียว
  saveSoon(pid) {
    const r = this.pr.get(pid);
    if (!r || r.saveTimer) return;
    r.saveTimer = this.clock.setTimeout(() => { r.saveTimer = null; this.save(pid); }, 1500);
  }
  onDispose() { rooms.delete(this); }
  // เซิร์ฟเวอร์กำลังปิด (เช่น Render อัปเดตเวอร์ชันใหม่) → แจ้งผู้เล่น · บันทึก · ตัดการเชื่อมต่อด้วยรหัส 4004
  // นับถอยหลังก่อน (ค่าเริ่มต้น 20 วิ — Render รอปิดได้ 30 วิ · ตั้ง SHUTDOWN_COUNTDOWN ได้ แต่ต้องน้อยกว่า Shutdown Delay ของ Render)
  async onBeforeShutdown() {
    const sec = Math.max(0, Number(process.env.SHUTDOWN_COUNTDOWN ?? 20));
    if (!shuttingDown) shuttingDown = Date.now() + sec * 1000;
    await Promise.all([...this.state.players.keys()].map((id) => this.save(id))); // บันทึกไว้ก่อนเผื่อโดนปิดกลางทาง
    if (this.clients.length && shuttingDown > Date.now()) {
      this.broadcast("restartSoon", { left: shuttingDown - Date.now() });
      await new Promise((ok) => setTimeout(ok, Math.max(0, shuttingDown - Date.now())));
    }
    this.broadcast("restart", {});
    await Promise.all([...this.state.players.keys()].map((id) => this.save(id)));
    this.disconnect(4004);
  }

  // ================= ผู้เล่นเข้า/ออก =================
  onJoin(client, options, auth) {
    const c = auth.char;
    const p = new Player();
    p.name = c.name;
    p.look = D.sanitizeLook(c.look);
    p.job = D.JOB_NAME[c.job] ? c.job : "villager"; p.jobName = D.JOB_NAME[p.job];
    p.quest = c.quest && (D.JOB_QUESTS[c.quest.job] || D.JOB2_QUESTS[c.quest.job]) ? { job: c.quest.job, kills: Math.max(0, c.quest.kills | 0) } : null;
    p.dir = "down"; p.moving = false; p.dead = false; p.auto = false; p.autoState = "";
    p.autoX = 0; p.autoY = 0; p.autoR = WHOLE_MAP;
    this.applyCharData(p, c);
    // ของที่อาชีพนี้ใส่ไม่ได้ (เช่นชาวบ้านที่ใส่เกราะ Lv20+ ไว้ก่อนมีระบบล็อก) → ถอดเข้ากระเป๋า
    const stripped = Bag.stripInvalid(p.bag, p.job);
    if (stripped.length) { p.gear = Bag.gearString(p.bag); this.applyStats(p, true); this.clock.setTimeout(() => client.send("system", `ถอดอุปกรณ์ที่${p.jobName}ใส่ไม่ได้เข้ากระเป๋า: ${stripped.join(", ")}`), 1500); }
    if (Number.isFinite(c.hp)) p.hp = Math.max(1, Math.min(p.maxHp, c.hp));
    if (Number.isFinite(c.sp)) p.sp = Math.max(0, Math.min(p.maxSp, c.sp));
    const s = c.map && Number.isFinite(c.x) && this.canStand(c.x, c.y) ? { x: c.x, y: c.y } : this.townSpawn();
    p.x = s.x; p.y = s.y;
    p.sid = client.sessionId; // (ใช้ภายในเซิร์ฟเวอร์ ไม่ซิงก์)
    this.state.players.set(client.sessionId, p);
    online.set(c.id, { room: this, sessionId: client.sessionId });
    this.pr.set(client.sessionId, {
      charId: c.id, uid: auth.user.uid, loginId: auth.user.loginId, admin: adminLogin(auth.user), auth,
      moveTarget: null, dx: 0, dy: 0, target: null, pending: null, anchor: null,
      autoCfg: { radius: WHOLE_MAP, kinds: [] },
      atkReady: 0, cds: {}, lastHurt: 0, deadUntil: 0, lastChat: 0, pick: null, useReady: 0, buffs: {}, combo: 0,
    });
    this.syncPet(client.sessionId);
    this.syncSpirit(client.sessionId);
    this.sendInv(client.sessionId);
    client.send("quest", p.quest);
    this.clock.setTimeout(() => partyBack(c.id, c.party), 800);
    this.sendSkills(client.sessionId);
    if (!(options && options.warp)) this.broadcast("system", `${p.name} เข้าสู่เกม`); // ย้ายแผนที่ไม่ต้องประกาศ
    this.state.monsters.forEach((m) => { if (m.boss && !m.dead) client.send("system", `⚠️ World Boss ${m.name} อยู่ในแผนที่นี้! (${Math.floor(m.x / this.map.tile)}, ${Math.floor(m.y / this.map.tile)})`); });
  }

  // ใส่ข้อมูลที่บันทึกไว้ (เลเวล สเตตัส กระเป๋า) ลงตัวละครในเกม — ใช้ตอนเข้าเกม และตอนแอดมินแก้ข้อมูล
  applyCharData(p, c) {
    p.level = Math.max(1, Math.min(D.MAX_LEVEL, c.level || 1));
    p.expNext = D.expToNext(p.level);
    p.exp = Math.min(c.exp || 0, Math.max(0, p.expNext - 1));
    // สเตตัส: โหลดค่าที่บันทึกไว้ (ตัวละครเก่าที่ยังไม่มี = เริ่มที่ 1 ทุกค่า) แล้วคืนแต้มที่เหลือตามเลเวล
    const st = D.baseStats();
    for (const k of D.STAT_KEYS) {
      const v = Number(c.stats && c.stats[k]);
      if (Number.isInteger(v) && v >= 1 && v <= D.STAT_MAX) st[k] = v;
    }
    if (D.spentPoints(st) > D.totalPoints(p.level)) Object.assign(st, D.baseStats()); // ข้อมูลผิดปกติ → คืนแต้มทั้งหมด
    for (const k of D.STAT_KEYS) p[k] = st[k];
    p.statPoints = D.totalPoints(p.level) - D.spentPoints(st);
    p.bag = Bag.loadBag(c);
    p.gear = Bag.gearString(p.bag);
    p.skills = D.sanitizeSkills(c.skills, p.job, p.level);
    this.syncSkillPts(p);
    this.applyStats(p, true);
  }
  syncSkillPts(p) { p.skillPts = Math.max(0, D.skillPointsAt(p.level, p.job) - D.skillSpent(p.skills)); }
  sendSkills(pid) {
    const p = this.state.players.get(pid), cl = this.clients.find((c) => c.sessionId === pid);
    if (p && cl) cl.send("skills", { skills: p.skills, points: p.skillPts });
  }
  learnSkill(client, key) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const err = D.learnError(p.job, p.skills, key, p.skillPts);
    if (err) return client.send("toast", err);
    p.skills[key] = (p.skills[key] || 0) + 1;
    this.syncSkillPts(p);
    this.applyStats(p, false);
    this.sendSkills(client.sessionId);
    this.saveSoon(client.sessionId);
  }

  // ================= แอดมิน =================
  // ตัวละครที่ออนไลน์อยู่ทั้งหมด (ทุกห้อง)
  static onlineList() {
    const out = [];
    online.forEach(({ room, sessionId }, charId) => {
      const p = room.state.players.get(sessionId), r = room.pr.get(sessionId);
      if (p && r) out.push({ charId, uid: r.uid, loginId: r.loginId, name: p.name, level: p.level, jobName: p.jobName, map: room.def.name,
        hp: p.hp, maxHp: p.maxHp, gold: p.bag ? p.bag.gold : 0, auto: p.auto, dead: p.dead,
        tx: Math.floor(p.x / room.map.tile), ty: Math.floor(p.y / room.map.tile) });
    });
    return out.sort((a, b) => b.level - a.level);
  }
  static worldStats() {
    let monsters = 0, alive = 0, drops = 0, pets = 0;
    rooms.forEach((rm) => { rm.state.monsters.forEach((m) => { monsters++; if (!m.dead) alive++; }); drops += rm.state.drops.size; pets += rm.state.pets.size; });
    return { players: online.size, monsters, alive, drops, pets, rooms: rooms.size };
  }
  // แก้ข้อมูลตัวละครที่ออนไลน์อยู่: fn ได้ข้อมูลรูปแบบเดียวกับที่บันทึก แก้แล้วใส่กลับเข้าเกมทันที
  // คืน true ถ้าออนไลน์ (แก้ในเกมแล้ว) / false ถ้าออฟไลน์
  static async editLive(charId, fn) {
    const o = online.get(String(charId));
    if (!o) return false;
    const { room, sessionId } = o;
    const p = room.state.players.get(sessionId);
    if (!p) return false;
    const data = room.toData(p);
    const msg = fn(data);
    if (data.job && data.job !== p.job && D.JOBS[data.job]) {
      p.job = data.job; p.jobName = D.JOBS[data.job].name; p.quest = null;
      Bag.stripInvalid(p.bag, p.job); Object.assign(data, Bag.saveBag(p.bag));
      const cl = room.clients.find((c) => c.sessionId === sessionId);
      if (cl) { cl.send("quest", null); cl.send("jobChanged", { job: p.job, reward: null, stripped: [] }); }
    }
    if (JSON.stringify(data.quest || null) !== JSON.stringify(p.quest || null)) {
      p.quest = data.quest || null;
      const cl = room.clients.find((c) => c.sessionId === sessionId);
      if (cl) cl.send("quest", p.quest);
    }
    room.applyCharData(p, data);
    room.sendSkills(sessionId);
    p.gear = Bag.gearString(p.bag);
    if (!data.heal && Number.isFinite(data.hp)) { p.hp = Math.max(1, Math.min(p.maxHp, data.hp)); p.sp = Math.max(0, Math.min(p.maxSp, data.sp)); }
    if (data.warpTo) {
      const to = data.warpTo; delete data.warpTo;
      const client = room.clients.find((c) => c.sessionId === sessionId);
      if (client && msg) client.send("system", "[แอดมิน] " + msg);
      if (to !== room.mapId) { room.warpPlayer(sessionId, to, null); return true; }
      data.x = null; // แผนที่เดิม → ไปจุดเกิดของแผนที่
    }
    if (data.x == null) {
      if (room.mapId !== W.START_MAP) { room.warpPlayer(sessionId, W.START_MAP, null); return true; }
      const s = room.townSpawn(); p.x = s.x; p.y = s.y; const r = room.pr.get(sessionId); if (r) { r.nav = null; r.moveTarget = null; r.target = null; r.pick = null; }
    }
    if (data.heal) { p.dead = false; p.hp = p.maxHp; p.sp = p.maxSp; }
    room.syncPet(sessionId);
    room.sendInv(sessionId);
    const client = room.clients.find((c) => c.sessionId === sessionId);
    if (client && msg) client.send("system", "[แอดมิน] " + msg);
    await room.save(sessionId);
    return true;
  }
  static kick(charId, reason) {
    const o = online.get(String(charId));
    const client = o && o.room.clients.find((c) => c.sessionId === o.sessionId);
    if (!client) return false;
    client.send("system", reason || "ถูกแอดมินนำออกจากเกม");
    client.leave(4002);
    return true;
  }
  static kickUid(uid, reason) {
    online.forEach((o, charId) => { const r = o.room.pr.get(o.sessionId); if (r && r.uid === uid) WorldRoom.kick(charId, reason); });
  }
  static netInfo() {
    return { drops1h: netStats.drops.length, recentDrops: netStats.drops.slice(-8).reverse(), lagMax: netStats.lagMax, lagSpikes1h: netStats.lagSpikes.length };
  }
  // ---------- อีเวนต์ EXP ----------
  static expEventInfo() {
    const m = expMult();
    return { active: m > 1, mult: m, left: m > 1 && expEvent.endAt ? Math.max(0, expEvent.endAt - Date.now()) : 0, endless: m > 1 && !expEvent.endAt };
  }
  // mult 1 = ปิด · minutes 0 = ไม่จำกัดเวลา (จนกว่าแอดมินจะปิด)
  static setExpEvent(mult, minutes, { quiet = false, endAt = null } = {}) {
    clearTimeout(expEvent.timer); expEvent.timer = null;
    const was = expMult();
    expEvent.mult = mult > 1 ? mult : 1;
    expEvent.endAt = expEvent.mult > 1 ? (endAt != null ? endAt : minutes > 0 ? Date.now() + minutes * 60000 : 0) : 0;
    if (expEvent.mult > 1 && expEvent.endAt && expEvent.endAt <= Date.now()) { expEvent.mult = 1; expEvent.endAt = 0; }
    if (expEvent.endAt) expEvent.timer = setTimeout(() => WorldRoom.setExpEvent(1, 0), Math.min(2 ** 31 - 1, expEvent.endAt - Date.now()));
    if (!endAt) store.setConfig("expEvent", { mult: expEvent.mult, endAt: expEvent.endAt }).catch((e) => console.error("save expEvent", e.message));
    const info = WorldRoom.expEventInfo();
    rooms.forEach((rm) => rm.broadcast("expEvent", info));
    if (quiet) return info;
    if (info.active) WorldRoom.announce(`🎉 อีเวนต์ EXP x${info.mult} เริ่มแล้ว!${info.endless ? "" : ` (${Math.round(info.left / 60000)} นาที)`} ล่ามอนกันเลย`);
    else if (was > 1) WorldRoom.announce(`อีเวนต์ EXP x${was} จบแล้ว ขอบคุณที่ร่วมสนุก`);
    return info;
  }
  // ---------- ปิดปรับปรุง ----------
  static maintInfo() {
    return { active: maint.endAt > 0, left: Math.max(0, maint.endAt - Date.now()), msg: maint.msg, closed: maint.closed };
  }
  static startMaint(minutes, msg) {
    clearTimeout(maint.timer);
    maint.endAt = Date.now() + minutes * 60000; maint.msg = msg || ""; maint.closed = false;
    rooms.forEach((rm) => rm.broadcast("maint", WorldRoom.maintInfo()));
    maint.timer = setTimeout(() => WorldRoom.closeForMaint(), minutes * 60000);
  }
  static cancelMaint() {
    clearTimeout(maint.timer);
    maint.endAt = 0; maint.msg = ""; maint.closed = false;
    rooms.forEach((rm) => rm.broadcast("maint", WorldRoom.maintInfo()));
  }
  static async closeForMaint() {
    maint.endAt = 0; maint.closed = true;
    for (const rm of rooms) {
      rm.broadcast("maint", { ...WorldRoom.maintInfo(), now: true });
      await Promise.all([...rm.state.players.keys()].map((id) => rm.save(id)));
      // แอดมินอยู่ต่อได้ คนอื่นออก
      rm.clients.forEach((c) => { const r = rm.pr.get(c.sessionId); if (!(r && r.admin)) c.leave(4003); });
    }
  }
  // ---------- World Boss (แอดมิน) ----------
  static spawnWorldBoss(key, mapId) {
    if (!D.WORLD_BOSSES[key]) throw new Error("ไม่มีบอสนี้");
    if (WorldRoom.bossExists(key)) throw new Error(`${D.WORLD_BOSSES[key].name} อยู่ในเกมแล้ว`);
    if (!W.MAPS[mapId] || W.MAPS[mapId].type === "town") throw new Error("เลือกแผนที่ล่ามอน (ไม่ใช่ในเมือง)");
    const rm = [...rooms].find((x) => x.mapId === mapId);
    if (pendingBoss.has(mapId) || (rm && rm.bossAlive())) throw new Error("แผนที่นี้มีบอสอยู่แล้ว");
    Object.assign(bossSched[key], { alive: true, since: Date.now(), map: mapId, warned: false });
    if (rm) { rm.spawnBoss(key); return { msg: `เรียก ${D.WORLD_BOSSES[key].name} ที่ ${W.MAPS[mapId].name} แล้ว` }; }
    pendingBoss.set(mapId, key);
    WorldRoom.announce(`⚠️ World Boss ${D.WORLD_BOSSES[key].name} กำลังจะปรากฏที่ ${W.MAPS[mapId].name}!`);
    return { msg: `ตอนนี้ยังไม่มีคนใน ${W.MAPS[mapId].name} — บอสจะเกิดทันทีที่มีคนเข้าแผนที่` };
  }
  static removeWorldBoss(only) {
    let n = 0;
    pendingBoss.forEach((k, mapId) => { if (!only || k === only) { pendingBoss.delete(mapId); n++; } });
    rooms.forEach((rm) => { n += rm.removeBosses(only); });
    for (const k of Object.keys(bossSched)) if ((!only || k === only) && bossSched[k].alive) WorldRoom.bossGone(k);
    return { msg: n ? `ลบบอส ${n} ตัวแล้ว` : "ไม่มีบอสอยู่" };
  }
  static bossExists(key) {
    if ([...pendingBoss.values()].includes(key)) return true;
    let a = false;
    rooms.forEach((rm) => rm.mr.forEach((r, id) => { const m = rm.state.monsters.get(id); if (r.boss && r.bossKey === key && m && !m.dead) a = true; }));
    return a;
  }
  // บอสถูกปราบ/หายไป → ตั้งเวลาเกิดครั้งถัดไป
  static bossGone(key) {
    const s = bossSched[key];
    if (s) Object.assign(s, { alive: false, next: Date.now() + randMin(D.WORLD_BOSSES[key].every || [60, 90]), map: null, warned: false });
  }
  // ทุก 15 วินาที: เตือนล่วงหน้า → เกิด → ไม่มีใครปราบนาน 60 นาทีก็หายไป
  static bossTick() {
    const t = Date.now();
    for (const [key, s] of Object.entries(bossSched)) {
      const B = D.WORLD_BOSSES[key];
      if (s.alive) {
        if (!WorldRoom.bossExists(key)) { WorldRoom.bossGone(key); continue; }
        if (t - s.since > BOSS_LIFE_MS) { WorldRoom.removeWorldBoss(key); WorldRoom.announce(`🌫️ World Boss ${B.name} หายไปแล้ว... (ไม่มีใครปราบได้ทันเวลา)`); }
        continue;
      }
      if (!s.map) { const free = (B.maps || ["orcamp"]).filter((mp) => !pendingBoss.has(mp) && ![...rooms].some((rm) => rm.mapId === mp && rm.bossAlive())); s.map = free[Math.floor(Math.random() * free.length)] || null; }
      if (!s.map) continue;
      if (!s.warned && t >= s.next - BOSS_WARN_MS) { s.warned = true; WorldRoom.announce(`⏳ World Boss ${B.name} Lv.${B.level} จะปรากฏที่ ${W.MAPS[s.map].name} ในอีก ${Math.max(1, Math.round((s.next - t) / 60000))} นาที!`); }
      if (t >= s.next) { try { WorldRoom.spawnWorldBoss(key, s.map); } catch (e) { s.map = null; s.next = t + 60000; } }
    }
  }
  static bossStatus() {
    const out = [];
    rooms.forEach((rm) => rm.state.monsters.forEach((m, id) => { const r = rm.mr.get(id); if (r && r.boss && !m.dead) out.push({ map: rm.def.name, name: m.name, hp: m.hp, maxHp: m.maxHp }); }));
    pendingBoss.forEach((k, mapId) => out.push({ map: W.MAPS[mapId].name, name: D.WORLD_BOSSES[k].name, pending: true }));
    for (const [k, s] of Object.entries(bossSched)) if (!s.alive) out.push({ name: D.WORLD_BOSSES[k].name, next: Math.max(0, s.next - Date.now()), map: s.map ? W.MAPS[s.map].name : null });
    return out;
  }
  // ================= คลังเก็บของ (NPC แมกนัส ในเมือง) =================
  async storageAct(client, act, m) {
    const pid = client.sessionId, p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || !p.bag) return;
    if (!this.nearNpc(p, "storage")) return client.send("toast", "เดินเข้าใกล้แมกนัส (คลังเก็บของ) ก่อน");
    if (this.trades && this.trades.has(pid)) return client.send("toast", "กำลังแลกเปลี่ยนอยู่");
    const st = await getStorage(r.uid);
    const b = p.bag;
    let err = null, changed = act !== "open";
    if (act === "put") {
      const s = b.inv[Number(m.idx)];
      err = Bag.moveBetween(b, Number(m.idx), st, Number(m.n));
    } else if (act === "take") err = Bag.moveBetween(st, Number(m.idx), b, Number(m.n));
    else if (act === "gold") {
      const n = Math.trunc(Number(m.n) || 0);
      if (n > 0) { if (b.gold < n) err = "gold ไม่พอ"; else { b.gold -= n; st.gold += n; } }
      else if (n < 0) { if (st.gold < -n) err = "gold ในคลังไม่พอ"; else { st.gold += n; b.gold -= n; } }
    } else if (act === "sort") Bag.sortBag(st);
    if (err) { client.send("toast", err); changed = false; }
    if (changed) { storageDirty(r.uid); this.saveSoon(pid); this.sendInv(pid); }
    const deco = (g) => (g && Bag.isGearId(g.id) ? { ...g, st: I.gearStats(g), sp: I.gearSpecial(g) } : g && Bag.isSpiritId(g.id) ? { ...g, si: SP.info(g) } : g);
    client.send("storage", { inv: Bag.saveStorage(st).inv.map(deco), gold: st.gold, size: Bag.STORAGE_SIZE, open: act === "open" });
  }

  // ================= เทรด (แลกเปลี่ยนของกับผู้เล่นในแผนที่เดียวกัน) =================
  // ขอแลก → อีกฝ่ายตอบรับ → ต่างคนใส่ของ/เงิน → ล็อกทั้งคู่ → ยืนยันทั้งคู่ → แลกพร้อมกัน (แก้ของ = ปลดล็อกทั้งคู่)
  tradeRequest(client, m) {
    const pid = client.sessionId, p = this.state.players.get(pid), t = this.state.players.get(String(m.sid));
    this.trades = this.trades || new Map(); this.tradeReq = this.tradeReq || new Map();
    if (!p || !t || p.dead || t.dead || String(m.sid) === pid) return;
    if (this.trades.has(pid)) return client.send("toast", "คุณกำลังแลกเปลี่ยนอยู่");
    if (this.trades.has(String(m.sid))) return client.send("toast", `${t.name} กำลังแลกเปลี่ยนกับคนอื่นอยู่`);
    if (dist(p, t) > TRADE_RANGE) return client.send("toast", "ต้องยืนใกล้กันก่อน (ไม่เกิน 10 ช่อง)");
    this.tradeReq.set(String(m.sid), { from: pid, until: now() + 30000 });
    const tc = this.clients.find((c) => c.sessionId === String(m.sid));
    if (tc) tc.send("tradeRequest", { from: pid, name: p.name, level: p.level });
    client.send("toast", `ส่งคำขอแลกเปลี่ยนให้ ${t.name} แล้ว`);
  }
  tradeAnswer(client, m) {
    const pid = client.sessionId; this.trades = this.trades || new Map(); this.tradeReq = this.tradeReq || new Map();
    const req = this.tradeReq.get(pid); this.tradeReq.delete(pid);
    const fc = req && this.clients.find((c) => c.sessionId === req.from);
    const p = this.state.players.get(pid), f = req && this.state.players.get(req.from);
    if (!req || req.from !== m.from || now() > req.until || !p || !f) return client.send("toast", "คำขอหมดอายุแล้ว");
    if (!m.accept) { if (fc) fc.send("toast", `${p.name} ปฏิเสธการแลกเปลี่ยน`); return; }
    if (this.trades.has(pid) || this.trades.has(req.from)) return client.send("toast", "อีกฝ่ายกำลังแลกเปลี่ยนอยู่");
    if (dist(p, f) > TRADE_RANGE) return client.send("toast", "อยู่ไกลกันเกินไป");
    const T = { a: req.from, b: pid, offer: { [req.from]: { items: [], gold: 0 }, [pid]: { items: [], gold: 0 } }, lock: {}, ok: {} };
    this.trades.set(req.from, T); this.trades.set(pid, T);
    this.tradeSend(T);
  }
  tradePartner(T, pid) { return T.a === pid ? T.b : T.a; }
  tradeSend(T) {
    const view = (sid) => { // ของที่เสนอ (พร้อมรายละเอียดให้อีกฝ่ายดู)
      const p = this.state.players.get(sid), o = T.offer[sid];
      return { name: p ? p.name : "?", gold: o.gold, lock: !!T.lock[sid], ok: !!T.ok[sid],
        items: o.items.map(({ idx, n }) => { const s = p && p.bag.inv[idx]; if (!s) return null; const g = Bag.plainSlot(s);
          return { idx, n, ...(Bag.isGearId(s.id) ? { ...g, st: I.gearStats(s), sp: I.gearSpecial(s) } : Bag.isSpiritId(s.id) ? { ...g, si: SP.info(s) } : { id: s.id }), n }; }).filter(Boolean) };
    };
    for (const sid of [T.a, T.b]) {
      const cl = this.clients.find((c) => c.sessionId === sid);
      if (cl) cl.send("trade", { me: view(sid), them: view(this.tradePartner(T, sid)) });
    }
  }
  tradeOffer(client, m) {
    const pid = client.sessionId, T = this.trades && this.trades.get(pid), p = this.state.players.get(pid);
    if (!T || !p) return;
    if (T.lock[pid]) return client.send("toast", "ปลดล็อกก่อนถึงจะแก้ของได้");
    const seen = new Set(), items = [];
    for (const x of Array.isArray(m.items) ? m.items.slice(0, TRADE_SLOTS) : []) {
      const idx = Math.floor(Number(x && x.idx)), s = p.bag.inv[idx];
      if (!s || seen.has(idx)) continue;
      seen.add(idx); items.push({ idx, n: Math.max(1, Math.min(s.n, Math.floor(Number(x.n)) || s.n)), snap: JSON.stringify({ ...Bag.plainSlot(s), n: 0 }) });
    }
    T.offer[pid] = { items, gold: Math.max(0, Math.min(p.bag.gold, Math.floor(Number(m.gold) || 0))) };
    T.lock = {}; T.ok = {}; // แก้ของ → ต้องล็อก/ยืนยันใหม่ทั้งคู่
    this.tradeSend(T);
  }
  tradeStep(client, step) {
    const pid = client.sessionId, T = this.trades && this.trades.get(pid);
    if (!T) return;
    const a = this.state.players.get(T.a), b = this.state.players.get(T.b);
    if (!a || !b || a.dead || b.dead || dist(a, b) > TRADE_RANGE) return this.tradeClose(pid, "อยู่ไกลกันเกินไป — ยกเลิกการแลกเปลี่ยน");
    if (step === "lock") { T.lock[pid] = !T.lock[pid]; if (!T.lock[pid]) T.ok = {}; return this.tradeSend(T); }
    if (!T.lock[T.a] || !T.lock[T.b]) return client.send("toast", "ต้องล็อกทั้งสองฝ่ายก่อน");
    T.ok[pid] = true;
    if (!T.ok[T.a] || !T.ok[T.b]) return this.tradeSend(T);
    // แลกจริง: ทดลองบนสำเนาก่อน (ของยังอยู่ครบ + กระเป๋ามีที่) แล้วค่อยใช้ผล
    const sim = (p) => ({ inv: p.bag.inv.map((s) => (s ? { ...s } : null)), gold: p.bag.gold });
    const A = sim(a), B = sim(b), err = (msg) => { T.lock = {}; T.ok = {}; this.tradeSend(T); [T.a, T.b].forEach((sid) => { const c = this.clients.find((x) => x.sessionId === sid); if (c) c.send("toast", msg); }); };
    const take = (S, P, offer) => { // เอาของออกจากสำเนาของผู้ให้ → คืนรายการของที่ย้าย
      const out = [];
      for (const { idx, n, snap } of offer.items) {
        const s = S.inv[idx]; if (!s || s.n < n || JSON.stringify({ ...Bag.plainSlot(P.bag.inv[idx]), n: 0 }) !== snap) return null; // ของในช่องถูกสลับ/เปลี่ยน
        out.push(Bag.maxStack(s.id) === 1 ? { ...P.bag.inv[idx] } : { id: s.id, n });
        if (Bag.maxStack(s.id) === 1) S.inv[idx] = null; else Bag.removeAt(S, idx, n);
      }
      if (S.gold < offer.gold) return null;
      S.gold -= offer.gold;
      return out;
    };
    const fromA = take(A, a, T.offer[T.a]), fromB = take(B, b, T.offer[T.b]);
    if (!fromA || !fromB) return err("ของที่เสนอมีการเปลี่ยนแปลง — ตรวจสอบแล้วยืนยันใหม่");
    const give = (S, list) => list.every((x) => Bag.maxStack(x.id) === 1 ? (() => { const f = S.inv.findIndex((y) => !y); if (f < 0) return false; S.inv[f] = Bag.normSlot({ ...x, n: 1 }); return true; })() : Bag.addItem(S, x.id, x.n) === 0);
    if (!give(A, fromB)) return err(`กระเป๋าของ ${a.name} เต็ม`);
    if (!give(B, fromA)) return err(`กระเป๋าของ ${b.name} เต็ม`);
    A.gold += T.offer[T.b].gold; B.gold += T.offer[T.a].gold;
    a.bag.inv = A.inv; a.bag.gold = A.gold; b.bag.inv = B.inv; b.bag.gold = B.gold;
    const desc = (list, gold) => [...list.map((x) => `${I.ITEMS[x.id].name}${x.n > 1 ? " ×" + x.n : ""}`), gold ? `${gold.toLocaleString()} gold` : ""].filter(Boolean).join(", ") || "-";
    console.log(`[trade] ${a.name} → ${b.name}: ${desc(fromA, T.offer[T.a].gold)} | ${b.name} → ${a.name}: ${desc(fromB, T.offer[T.b].gold)}`);
    this.trades.delete(T.a); this.trades.delete(T.b);
    for (const sid of [T.a, T.b]) {
      const c = this.clients.find((x) => x.sessionId === sid);
      if (c) { c.send("tradeClosed", { done: true }); c.send("toast", "✅ แลกเปลี่ยนสำเร็จ"); }
      this.sendInv(sid); this.save(sid);
    }
  }
  tradeClose(pid, reason) {
    const T = this.trades && this.trades.get(pid);
    if (!T) return;
    this.trades.delete(T.a); this.trades.delete(T.b);
    for (const sid of [T.a, T.b]) { const c = this.clients.find((x) => x.sessionId === sid); if (c) c.send("tradeClosed", { reason }); }
  }

  // ================= วาปไปคริสตัล / กลับเมือง (จากหน้าแผนที่โลก) =================
  // ค่าวาป ≈ รายได้จากการฟาร์ม ~1 นาทีที่เลเวลของแผนที่นั้น (ดู tools/economy.js) · กลับเมืองฟรี
  static teleportCost(mapId) { const M = W.MAPS[mapId]; return !M || M.type === "town" ? 0 : Math.max(100, Math.round((Math.pow(M.lv ? M.lv[0] : 1, 1.55) * 22) / 50) * 50); }
  teleport(client, mapId) {
    const pid = client.sessionId, p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || p.dead || p.warp) return;
    const M = W.MAPS[mapId];
    if (!M) return;
    if (now() - (r.lastHurt || 0) < 5000) return client.send("toast", "กำลังต่อสู้อยู่ — รอให้ปลอดภัย 5 วินาทีก่อนวาป");
    const cost = WorldRoom.teleportCost(mapId);
    if (p.bag.gold < cost) return client.send("toast", `gold ไม่พอ (ค่าวาป ${cost.toLocaleString()})`);
    let pos = null;
    if (M.type !== "town") {
      const c = mapCrystals(mapId)[0];
      if (!c) return client.send("toast", "แผนที่นี้ไม่มีคริสตัล");
      pos = { x: c.x, y: c.y + 46 };
    }
    p.bag.gold -= cost;
    if (cost) this.sendInv(pid);
    this.broadcast("spawnFx", { id: pid, x: p.x, y: p.y });
    if (mapId === this.mapId) { // แผนที่เดิม: ย้ายตำแหน่งเลย
      const to = pos || this.townSpawn();
      p.x = to.x; p.y = to.y; r.nav = null; r.moveTarget = null; r.target = null; r.pick = null; p.moving = false;
      this.broadcast("spawnFx", { id: pid, x: p.x, y: p.y });
      return;
    }
    this.warpPlayer(pid, mapId, pos || getMap(mapId).spawn);
  }

  // ================= ปาร์ตี้ =================
  // ชวน: m.sid (คลิกที่ตัวละครในแผนที่เดียวกัน) หรือ m.name (/invite ชื่อ · ข้ามแผนที่ได้)
  partyInvite(client, m) {
    const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
    if (!r || !p) return;
    let tcid = null;
    if (m.sid) { const tr = this.pr.get(String(m.sid)); tcid = tr && tr.charId; }
    else if (m.name) online.forEach((o, cid) => { const tp = o.room.state.players.get(o.sessionId); if (tp && tp.name === String(m.name).trim()) tcid = cid; });
    if (!tcid) return client.send("toast", "ไม่พบผู้เล่นนี้ (ต้องออนไลน์อยู่)");
    if (tcid === r.charId) return;
    if (partyOf.has(tcid)) return client.send("toast", "ผู้เล่นนี้มีปาร์ตี้อยู่แล้ว");
    const pt = parties.get(partyOf.get(r.charId));
    if (pt && pt.members.length >= PARTY_MAX) return client.send("toast", `ปาร์ตี้เต็มแล้ว (${PARTY_MAX} คน)`);
    if (pt && pt.leader !== r.charId) return client.send("toast", "หัวหน้าปาร์ตี้เท่านั้นที่ชวนคนเพิ่มได้");
    invites.set(tcid, { from: r.charId, until: Date.now() + 30000 });
    const tc = clientOf(tcid), tw = who(tcid);
    if (tc) tc.send("partyInvite", { from: r.charId, name: p.name, level: p.level });
    client.send("toast", `ส่งคำเชิญเข้าปาร์ตี้ให้ ${tw ? tw.p.name : ""} แล้ว`);
  }
  partyAnswer(client, m) {
    const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
    if (!r || !p) return;
    const inv = invites.get(r.charId);
    invites.delete(r.charId);
    if (!inv || inv.from !== m.from || Date.now() > inv.until) return client.send("toast", "คำเชิญหมดอายุแล้ว");
    const fc = clientOf(inv.from);
    if (!m.accept) { if (fc) fc.send("toast", `${p.name} ปฏิเสธคำเชิญ`); return; }
    if (partyOf.has(r.charId)) return client.send("toast", "คุณมีปาร์ตี้อยู่แล้ว");
    if (!online.has(inv.from)) return client.send("toast", "ผู้ชวนออกจากเกมไปแล้ว");
    let pt = parties.get(partyOf.get(inv.from));
    if (!pt) { pt = { id: newPartyId(), leader: inv.from, members: [inv.from], names: {}, off: {}, quit: {} }; parties.set(pt.id, pt); partyOf.set(inv.from, pt.id); }
    if (pt.members.length >= PARTY_MAX) return client.send("toast", "ปาร์ตี้เต็มแล้ว");
    pt.members.push(r.charId); partyOf.set(r.charId, pt.id);
    for (const cid of pt.members) { const c = clientOf(cid); if (c) c.send("system", `👥 ${p.name} เข้าร่วมปาร์ตี้`); }
    partySend(pt);
  }
  // ย้ายแผนที่: ส่งข้อมูลปาร์ตี้ให้ทันที (ห้องใหม่)
  partyRefresh(cid) { const pt = parties.get(partyOf.get(cid)); if (pt) partySend(pt); }

  // บอร์ด World Boss สำหรับผู้เล่น: สถานะทุกตัว (อยู่ที่ไหน เลือดเท่าไร / จะเกิดอีกกี่นาที ที่แมพไหน)
  static bossBoard() {
    const t = Date.now();
    return Object.entries(D.WORLD_BOSSES).map(([key, B]) => {
      const s = bossSched[key], o = { key, name: B.name, level: B.level, sprite: B.sprite, maps: (B.maps || []).map((m) => W.MAPS[m].name),
        skills: [...(B.skills || []).map((s) => s.name), ...(B.slam ? ["ทุบพื้น"] : []), ...(B.summon ? ["เรียกลูกน้อง"] : []), ...(B.enrage ? ["คลั่ง"] : [])] };
      if (s.alive) {
        o.state = "alive"; o.endsIn = Math.max(0, BOSS_LIFE_MS - (t - s.since)); o.map = s.map && W.MAPS[s.map] ? W.MAPS[s.map].name : null;
        rooms.forEach((rm) => rm.mr.forEach((r, id) => { const m = rm.state.monsters.get(id); if (r.boss && r.bossKey === key && m && !m.dead) { o.map = rm.def.name; o.hp = m.hp; o.maxHp = m.maxHp; o.tx = Math.floor(m.x / rm.map.tile); o.ty = Math.floor(m.y / rm.map.tile); } }));
        if (o.hp === undefined) o.state = "waiting"; // สั่งเกิดแล้ว รอมีคนเข้าแผนที่
      } else { o.state = "next"; o.next = Math.max(0, s.next - t); o.map = s.map ? W.MAPS[s.map].name : null; }
      return o;
    });
  }
  static announce(text) { rooms.forEach((rm) => rm.broadcast("announce", text)); }

  onLeave(client, consented) {
    const p = this.state.players.get(client.sessionId), r = this.pr.get(client.sessionId);
    if (p && !p.warp && !consented && !shuttingDown) { // หลุดเอง (ไม่ได้กดออก/ย้ายแผนที่)
      netStats.drops.push({ t: Date.now(), name: p.name });
      console.log(`[drop] ${p.name} หลุดการเชื่อมต่อ (${this.mapId})`);
    }
    if (r && r.charId) {
      this.save(client.sessionId);
      const o = online.get(r.charId);
      if (o && o.room === this && o.sessionId === client.sessionId) online.delete(r.charId);
    }
    if (p && !p.warp && !shuttingDown) this.broadcast("system", `${p.name} ออกจากเกม`);
    if (p && !p.warp && r && r.charId) { invites.delete(r.charId); partyDrop(r.charId); }
    this.state.players.delete(client.sessionId);
    this.state.pets.delete(client.sessionId);
    this.state.spirits.delete(client.sessionId);
    this.tradeClose(client.sessionId, "อีกฝ่ายออกจากแผนที่");
    this.pr.delete(client.sessionId);
    this.mr.forEach((r) => { if (r.target === client.sessionId) r.target = null; r.dmgBy.delete(client.sessionId); });
  }

  alive(client) {
    const p = this.state.players.get(client.sessionId);
    return p && !p.dead ? this.pr.get(client.sessionId) : null;
  }

  applyStats(p, refill) {
    const bag = p.bag || Bag.emptyBag();
    const gl = Bag.glowString(bag); if (p.glow !== gl) p.glow = gl;
    const gb = Bag.gearBonus(bag, p.job);
    const eff = Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k] + (gb[k] || 0)]));
    const wt = Bag.weaponType(bag);
    p.wt = wt && !Bag.wearError(p.job, I.ITEMS[bag.equip.weapon.id]) ? wt : null;
    const s = D.playerStats(p.level, eff, p.job, p.wt);
    s.atk += gb.atk; s.def += gb.def; s.maxHp += gb.maxHp; s.maxSp += gb.maxSp;
    // สกิลติดตัว
    const pb = D.passiveBonus(p.skills || {}, p.job, p.wt);
    s.atk += pb.atk; s.def += pb.def; s.crit = Math.min(0.6, s.crit + pb.crit); s.hitBonus += pb.hit; s.range += pb.range;
    // สเตตัสแฝงจากอุปกรณ์ (%)
    const sx = Bag.gearSpecial(bag, p.job), X = (k) => (sx[k] || 0) / 100;
    // คุณสมบัติชนิดอาวุธ
    for (const [k, v] of Object.entries((D.WEAPON_TYPES[p.wt || "fist"] || {}).trait || {})) sx[k] = Math.min((I.SPECIAL[k] && I.SPECIAL[k].cap) || 999, (sx[k] || 0) + v);
    s.maxHp = Math.round(s.maxHp * (1 + pb.hpPct / 100 + X("hpPct"))); s.maxSp = Math.round(s.maxSp * (1 + pb.spPct / 100 + X("spPct")));
    s.atk = Math.round(s.atk * (1 + X("atkPct") + (pb.atkPct || 0) / 100)); s.crit = Math.min(0.6, s.crit + X("critPct"));
    s.flee = Math.min(0.6, s.flee + X("flee")); s.atkDelay = Math.round(s.atkDelay / (1 + X("aspd")));
    p.pb = pb; p.sx = sx;
    p.gearBonus = gb;
    const dHp = s.maxHp - (p.maxHp || 0), dSp = s.maxSp - (p.maxSp || 0);
    p.maxHp = s.maxHp; p.maxSp = s.maxSp;
    if (refill) { p.hp = p.maxHp; p.sp = p.maxSp; }
    else { // ลงแต้ม VIT/INT แล้ว HP/SP ปัจจุบันเพิ่มตามด้วย
      p.hp = Math.max(1, Math.min(p.maxHp, p.hp + Math.max(0, dHp)));
      p.sp = Math.max(0, Math.min(p.maxSp, p.sp + Math.max(0, dSp)));
    }
    // ค่าเหล่านี้ใช้ในเซิร์ฟเวอร์เท่านั้น (ไม่ได้ประกาศใน schema จึงไม่ถูกส่งไป client)
    p.atk = s.atk; p.def = s.def; p.atkDelay = s.atkDelay; p.flee = s.flee;
    p.hitBonus = s.hitBonus; p.crit = s.crit; p.healBonus = s.healBonus; p.range = s.range;
    this.sendDerived(p);
  }
  // ส่งค่าที่คำนวณแล้ว (ATK DEF ความเร็วตี ฯลฯ) ให้เจ้าของตัวละครดูในหน้าสเตตัส
  sendDerived(p) {
    let id = null;
    this.state.players.forEach((pp, sid) => { if (pp === p) id = sid; });
    const client = id && this.clients.find((c) => c.sessionId === id);
    if (client) client.send("derived", { atk: p.atk, def: Math.round(p.def * 10) / 10, defPct: Math.round(D.defReduce(p.def, p.level) * 100), atkDelay: p.atkDelay,
      flee: p.flee, hitBonus: p.hitBonus, crit: p.crit, healBonus: p.healBonus, bonus: p.gearBonus || {},
      range: p.range, wt: p.wt, atkType: (D.WEAPON_TYPES[p.wt || "fist"] || {}).stat, special: p.sx || {}, sets: Bag.activeSets(p.bag || Bag.emptyBag(), p.job) });
  }

  // ================= ลงแต้มสเตตัส =================
  addStat(pid, stat, n) {
    const p = this.state.players.get(pid);
    if (!p || !D.STAT_KEYS.includes(stat)) return;
    n = Math.max(1, Math.min(99, Math.floor(Number(n) || 1)));
    let added = 0;
    // เพิ่มทีละหน่วย (ค่าแต้มต่อหน่วยแพงขึ้นตามค่าปัจจุบัน)
    while (added < n && p[stat] < D.STAT_MAX && D.statCost(p[stat]) <= p.statPoints) {
      p.statPoints -= D.statCost(p[stat]); p[stat]++; added++;
    }
    if (added) this.applyStats(p, false);
  }
  recommendStats(pid) {
    const p = this.state.players.get(pid);
    if (!p || p.statPoints <= 0) return;
    const st = Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k]]));
    p.statPoints = D.allocate(st, p.statPoints, (D.JOBS[p.job] || D.JOBS.villager).rec);
    for (const k of D.STAT_KEYS) p[k] = st[k];
    this.applyStats(p, false);
  }

  // ================= มอนสเตอร์ =================
  spawnMonsters() {
    for (const [kind, count0] of this.def.spawns) {
      const def = D.MONSTERS[kind];
      const count = this.def.danger && !process.env.DANGER_OFF ? Math.ceil(count0 * DANGER.count) : count0;
      for (let i = 0; i < count; i++) {
        const id = "m" + this.mobSeq++;
        const m = new Monster();
        m.kind = kind; m.name = def.name; m.level = def.level;
        m.sprite = def.sprite || kind; m.tint = def.tint || 0xffffff; m.scale = def.scale || 1;
        this.state.monsters.set(id, m);
        this.mr.set(id, { def, stats: D.monsterStats(def.level), home: null, target: null,
          wander: null, nextWander: 0, atkReady: 0, respawnAt: 0, dmgBy: new Map() });
        this.respawnMob(id);
      }
    }
  }

  // มินิบอสประจำแผนที่ (ตัวแรงที่สุดของแมพในร่างใหญ่ + ชื่อเฉพาะ) — เกิดใหม่ 8–12 นาทีหลังตาย
  spawnMini() {
    const MB = D.MINI_BOSSES[this.mapId];
    if (!MB) return;
    const baseDef = D.MONSTERS[MB.base], def = { ...baseDef, ...MB, name: MB.name, aggressive: true };
    const id = "mini" + this.mobSeq++, m = new Monster();
    m.kind = MB.base; m.name = MB.name; m.level = MB.level || baseDef.level + 3;
    m.sprite = baseDef.sprite || MB.base; m.tint = MB.tint || baseDef.tint || 0xffffff; m.scale = MB.scale || 1.7; m.rank = 2;
    const st = D.monsterStats(m.level);
    const stats = { maxHp: st.maxHp * 10, atk: Math.round(st.atk * 1.5), def: Math.round(st.def * 1.3), exp: st.exp * 15 };
    this.state.monsters.set(id, m);
    this.mr.set(id, { def, stats, base: stats, mini: true, rank: 2, home: null, target: null, wander: null, nextWander: 0, atkReady: 0, respawnAt: 0, dmgBy: new Map() });
    this.respawnMob(id);
  }

  respawnMob(id) {
    const m = this.state.monsters.get(id), r = this.mr.get(id);
    // จุดเกิดคงที่ของมอนแต่ละตัว → มอนเกิดใหม่ที่เดิม ความหนาแน่นในแต่ละโซนไม่เปลี่ยน
    if (!r.spawn) r.spawn = this.mobSpot();
    m.x = r.spawn.x; m.y = r.spawn.y; m.dir = "down"; m.moving = false; m.dead = false;
    // ชั้นยอด: สุ่มเกิด 4% (เฉพาะมอนปกติ) — ตัวใหญ่ เรืองแสง แรงขึ้น EXP/ของดีขึ้น
    if (!r.mini) {
      r.base = r.base || r.stats;
      const elite = Math.random() < ELITE_CHANCE;
      r.rank = elite ? 1 : 0; m.rank = r.rank;
      r.stats = elite ? { maxHp: r.base.maxHp * 4, atk: Math.round(r.base.atk * 1.4), def: Math.round(r.base.def * 1.2), exp: r.base.exp * 4 } : r.base;
      m.scale = (r.def.scale || 1) * (elite ? 1.3 : 1);
      m.name = elite ? `★${r.def.name}` : r.def.name;
    }
    m.maxHp = r.stats.maxHp; m.hp = m.maxHp;
    r.home = { ...r.spawn }; r.target = null; r.wander = null; r.returning = false; r.dmgBy.clear();
    r.cast = null; r.dash = null; r.fled = false; r.fleeUntil = 0;
    if (r.mini && r.announced) this.broadcast("system", `⚠️ ${m.name} ปรากฏตัวในแผนที่นี้อีกครั้ง! (${Math.floor(m.x / this.map.tile)}, ${Math.floor(m.y / this.map.tile)})`);
    if (r.mini) r.announced = true;
  }

  // จุดเกิดมอน: ที่เดินได้ ห่างทางเข้า/จุดเกิดผู้เล่นอย่างน้อย 9 ช่อง และไปถึงได้จากจุดเกิด
  mobSpot() {
    const { tile, width: MW, height: MH } = this.map;
    const safe = [this.map.spawn, ...this.map.portals];
    for (let i = 0; i < 800; i++) {
      const tx = 3 + Math.floor(Math.random() * (MW - 6)), ty = 3 + Math.floor(Math.random() * (MH - 6));
      const x = tx * tile + tile / 2, y = ty * tile + tile - 4;
      if (!this.canStand(x, y) || safe.some((q) => dist(q, { x, y }) < tile * 9)) continue;
      if ((this.crystals || []).some((c) => dist(c, { x, y }) < CRYSTAL_SAFE + tile * 4)) continue;
      if (!this.reach || this.reach[ty * MW + tx]) return { x, y };
    }
    return this.townSpawn();
  }

  // ================= ทุก tick =================
  update(dt) {
    const t = now();
    this.state.players.forEach((p, id) => this.updatePlayer(p, this.pr.get(id), id, dt, t));
    this.state.monsters.forEach((m, id) => this.updateMob(m, this.mr.get(id), id, dt, t));
    this.state.pets.forEach((pet, id) => this.updatePet(pet, id, dt, t));
    this.state.spirits.forEach((sp, id) => this.updateSpirit(sp, id, dt, t));
    this.state.players.forEach((p, id) => { const r = this.pr.get(id); if (r && r.summon) this.updateSummon(id, p, r, t); });
  }

  // ================= ภูติ =================
  syncSpirit(pid) {
    const p = this.state.players.get(pid), s = p && p.bag && p.bag.spirit;
    let sp = this.state.spirits.get(pid);
    if (!s) { if (sp) this.state.spirits.delete(pid); return; }
    if (!sp) {
      sp = new Spirit();
      sp.x = p.x + 22; sp.y = p.y - 4;
      this.state.spirits.set(pid, sp);
      const r = this.pr.get(pid); if (r) r.spReady = now() + 1500;
    }
    if (sp.kind !== s.id) sp.kind = s.id;
    if (sp.r !== s.r) sp.r = s.r;
    if (sp.lv !== s.lv) sp.lv = s.lv;
    if (sp.st !== (s.st | 0)) sp.st = s.st | 0;
  }
  updateSpirit(sp, pid, dt, t) {
    const p = this.state.players.get(pid), r = this.pr.get(pid), s = p && p.bag && p.bag.spirit;
    if (!p || !r || !s) return;
    const S = SP.SPIRITS[s.id];
    // ลอยตามเจ้าของ (ฝั่งตรงข้ามกับสัตว์เลี้ยง: เยื้องไปด้านหน้า-ขวา)
    const side = { down: [1, 0], up: [-1, 0], left: [0, -1], right: [0, 1] }[p.dir] || [1, 0];
    const fx = p.x + side[0] * 26, fy = p.y + side[1] * 14 - 6;
    const d = Math.hypot(fx - sp.x, fy - sp.y);
    if (d > 600) { sp.x = fx; sp.y = fy; }
    else if (d > 4) { const step = Math.min(d, ((d > 80 ? SPEED * 1.8 : SPEED * 1.1) * dt) / 1000); sp.x += ((fx - sp.x) / d) * step; sp.y += ((fy - sp.y) / d) * step; }
    if (p.dead || t < (r.spReady || 0)) return;
    const k = S.skill, P = SP.power(s);
    if (S.role === "heal") {
      const P = SP.healPower(s);
      const hpLow = p.hp < (p.maxHp * k.below) / 100, spLow = k.spPct && p.sp < (p.maxSp * k.below) / 100;
      const hurt = hpLow || spLow || (k.cleanse && r.poison);
      if (!hurt) return;
      r.spReady = t + SP.cooldown(s);
      const amt = Math.min(p.maxHp - p.hp, Math.round((p.maxHp * k.healPct * P) / 100));
      if (amt > 0) { p.hp += amt; this.broadcast("heal", { id: pid, amount: amt }); }
      if (k.spPct) {
        const sp = Math.min(p.maxSp - p.sp, Math.max(1, Math.round((p.maxSp * k.spPct * P) / 100)));
        if (sp > 0) { p.sp += sp; const cl = this.clients.find((c) => c.sessionId === pid); if (cl) cl.send("spHeal", sp); }
      }
      if (k.cleanse) r.poison = null;
      this.broadcast("spiritFx", { id: pid, kind: s.id, heal: true });
      return;
    }
    // ภูติสายโจมตี: ตีเป้าหมายที่เรากำลังสู้ หรือมอนที่กำลังตีเราอยู่ (ไม่ไปหาเรื่องมอนเอง)
    const okMob = (mid) => { const m = this.state.monsters.get(mid); return m && !m.dead && dist(p, m) <= k.range; };
    let tgt = r.target && okMob(r.target) ? r.target : null;
    if (!tgt) {
      let bd = Infinity;
      this.mr.forEach((mr, mid) => {
        if (mr.target !== pid || !okMob(mid)) return;
        const dd = dist(p, this.state.monsters.get(mid));
        if (dd < bd) { bd = dd; tgt = mid; }
      });
    }
    if (!tgt) return;
    r.spReady = t + SP.cooldown(s);
    const tgts = [tgt];
    if (k.chain) {
      const m0 = this.state.monsters.get(tgt);
      const near = this.mobsNear(m0.x, m0.y, 160).filter((mid) => mid !== tgt)
        .sort((a, b) => dist(m0, this.state.monsters.get(a)) - dist(m0, this.state.monsters.get(b)));
      tgts.push(...near.slice(0, k.chain - 1));
    }
    this.broadcast("spiritFx", { id: pid, kind: s.id, fx: k.fx, tgts });
    const m0 = this.state.monsters.get(tgt), delay = Math.min(450, 60 + Math.hypot(m0.x - sp.x, m0.y - sp.y) * 1.4);
    this.clock.setTimeout(() => {
      if (p.dead || !this.state.players.get(pid)) return;
      tgts.forEach((mid, i) => {
        const res = this.hitMob(pid, p, mid, k.mult * P * (i ? 0.8 : 1), { spirit: true, slow: k.slow });
        if (k.drain && res && !res.miss && p.hp < p.maxHp) {
          const hl = Math.min(p.maxHp - p.hp, Math.round((res.dmg * k.drain) / 100));
          if (hl > 0) { p.hp += hl; if (hl >= 5) this.broadcast("heal", { id: pid, amount: hl }); }
        }
      });
    }, k.chain ? 120 : delay);
  }
  // ภูติได้ EXP ตามเรา (เลเวลภูติไม่เกินเลเวลเรา)
  spiritExp(pid, p, amount) {
    const s = p.bag && p.bag.spirit;
    if (!s || s.lv >= SP.SPIRIT_MAX_LV) return;
    s.ex += Math.max(1, Math.round(amount * SP.EXP_SHARE));
    let up = false;
    while (s.lv < SP.capOf(s.st) && s.lv < p.level && s.ex >= SP.expNeed(s.lv)) { s.ex -= SP.expNeed(s.lv); s.lv++; up = true; }
    if (s.lv >= SP.SPIRIT_MAX_LV) s.ex = 0;
    else s.ex = Math.min(s.ex, SP.expNeed(s.lv) - 1);
    if (up) {
      this.syncSpirit(pid);
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl) cl.send("toast", `✨ ${SP.SPIRITS[s.id].name} เลเวลอัปเป็น Lv.${s.lv}!`);
      this.broadcast("spiritFx", { id: pid, kind: s.id, lvup: true });
      this.sendInv(pid);
    }
  }
  // เควสภูติ (คุยกับลูน่า): m.act = start | cancel | finish · m.id = ภูติ
  spiritQuest(client, p, b, m) {
    if (!this.nearNpc(p, "spiritkeeper")) return "เดินเข้าใกล้ลูน่า (ผู้ผนึกภูติ) ก่อน";
    const act = String(m.act || "");
    const id = String(m.id || ""), Q = SP.SPIRIT_QUESTS[id], S = SP.SPIRITS[id];
    if (!Q) return;
    b.spq = b.spq || {};
    if (act === "cancel") { delete b.spq[id]; return; }
    const owned = (b.spirit && b.spirit.id === id) || b.inv.some((x) => x && x.id === id);
    if (act === "start") {
      if (p.level < S.lv) return `ต้องเลเวล ${S.lv} ขึ้นไป`;
      if (owned) return "คุณมีภูติตัวนี้อยู่แล้ว";
      if (id in b.spq) return "รับเควสนี้อยู่แล้ว";
      b.spq[id] = 0;
      client.send("toast", `รับเควส ${S.name} แล้ว`);
      return;
    }
    if (act !== "finish" || !(id in b.spq)) return;
    if (b.spq[id] < Q.kill[1]) return `ยังปราบ${D.MONSTERS[Q.kill[0]].name}ไม่ครบ (${b.spq[id]}/${Q.kill[1]})`;
    if (Bag.countOf(b, Q.item[0]) < Q.item[1]) return `${I.ITEMS[Q.item[0]].name} ยังไม่ครบ (${Bag.countOf(b, Q.item[0])}/${Q.item[1]})`;
    if (!b.inv.some((x) => !x)) return "กระเป๋าเต็ม — เว้นที่ว่างไว้รับภูติก่อน";
    let need = Q.item[1];
    for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) {
      const x = b.inv[i];
      if (x && x.id === Q.item[0]) { const k = Math.min(need, x.n); Bag.removeAt(b, i, k); need -= k; }
    }
    delete b.spq[id];
    const spirit = { id, r: SP.QUEST_RARITY, lv: 1, st: 0, ex: 0 };
    if (!b.spirit) b.spirit = SP.norm(spirit); else Bag.addItem(b, id, 1, spirit);
    client.send("spiritGot", { id });
    rooms.forEach((rm) => rm.broadcast("system", `✨ ${p.name} ได้รับ${S.name}!`));
    this.saveSoon(client.sessionId);
  }
  // ข้ามขีดจำกัด: ภูติที่เรียกอยู่เลเวลเต็มเพดานแล้ว → ใช้ของ + gold → พัฒนาร่างใหม่ (เพดานเลเวล +10)
  spiritBreak(client, p, b) {
    if (!this.nearNpc(p, "spiritkeeper")) return "เดินเข้าใกล้ลูน่า (ผู้ผนึกภูติ) ก่อน";
    const s = b.spirit;
    if (!s) return "เรียกภูติออกมาก่อน (ภูติที่จะพัฒนาต้องอยู่ในช่องภูติ)";
    const Bk = SP.BREAK[s.st | 0];
    if (!Bk) return "ภูติตัวนี้อยู่ในร่างสมบูรณ์แล้ว";
    if (s.lv < SP.capOf(s.st)) return `ภูติต้องถึง Lv.${SP.capOf(s.st)} ก่อน (ตอนนี้ Lv.${s.lv})`;
    for (const [id, n] of Bk.items) if (Bag.countOf(b, id) < n) return `${I.ITEMS[id].name} ไม่พอ (${Bag.countOf(b, id)}/${n})`;
    if (b.gold < Bk.gold) return `gold ไม่พอ (ต้องใช้ ${Bk.gold.toLocaleString()})`;
    for (const [id, n] of Bk.items) {
      let need = n;
      for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) { const x = b.inv[i]; if (x && x.id === id) { const k = Math.min(need, x.n); Bag.removeAt(b, i, k); need -= k; } }
    }
    b.gold -= Bk.gold;
    s.st = (s.st | 0) + 1;
    this.syncSpirit(client.sessionId);
    client.send("spiritEvolved", { id: s.id, st: s.st, name: SP.STAGE_NAME[s.st] });
    this.broadcast("spiritFx", { id: client.sessionId, kind: s.id, evolve: true });
    rooms.forEach((rm) => rm.broadcast("system", `🌟 ${SP.SPIRITS[s.id].name} ของ ${p.name} พัฒนาเป็น${SP.STAGE_NAME[s.st]}!`));
    this.saveSoon(client.sessionId);
  }
  // อัประดับสีภูติที่เรียกอยู่ (ใช้ผลึกวิญญาณ + gold · สำเร็จแน่นอน)
  spiritUp(client, p, b) {
    if (!this.nearNpc(p, "spiritkeeper")) return "เดินเข้าใกล้ลูน่า (ผู้ผนึกภูติ) ก่อน";
    const s = b.spirit;
    if (!s) return "เรียกภูติออกมาก่อน (ภูติที่จะอัปต้องอยู่ในช่องภูติ)";
    const U = SP.UPGRADE[s.r];
    if (!U) return "ภูติตัวนี้ระดับสูงสุดแล้ว";
    const have = Bag.countOf(b, "spirit_shard");
    if (have < U.shards) return `ผลึกวิญญาณไม่พอ (${have}/${U.shards})`;
    if (b.gold < U.gold) return `gold ไม่พอ (ต้องใช้ ${U.gold.toLocaleString()})`;
    let need = U.shards;
    for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) {
      const x = b.inv[i];
      if (x && x.id === "spirit_shard") { const k = Math.min(need, x.n); Bag.removeAt(b, i, k); need -= k; }
    }
    b.gold -= U.gold;
    s.r++;
    this.syncSpirit(client.sessionId);
    client.send("spiritUpOk", { id: s.id, r: s.r });
    this.broadcast("spiritFx", { id: client.sessionId, kind: s.id, lvup: true });
    if (s.r >= 3) rooms.forEach((rm) => rm.broadcast("system", `✨ ${p.name} อัป${SP.SPIRITS[s.id].name}เป็นระดับ${I.RARITY[s.r].name}!`));
    this.saveSoon(client.sessionId);
  }

  // ================= สัตว์เลี้ยง =================
  // สร้าง/ลบ/เปลี่ยนตัวสัตว์เลี้ยงบนแผนที่ให้ตรงกับที่เรียกไว้ในกระเป๋า
  syncPet(pid) {
    const p = this.state.players.get(pid);
    const kind = p && p.bag && p.bag.pet;
    let pet = this.state.pets.get(pid);
    if (!kind) { if (pet) this.state.pets.delete(pid); return; }
    if (!pet) {
      pet = new Pet();
      pet.x = p.x - 20; pet.y = p.y - 6; pet.dir = "down"; pet.moving = false;
      this.state.pets.set(pid, pet);
    }
    if (pet.kind !== kind) pet.kind = kind;
  }
  updatePet(pet, pid, dt, t) {
    const p = this.state.players.get(pid), r = this.pr.get(pid);
    const info = I.ITEMS[pet.kind] && I.ITEMS[pet.kind].pet;
    if (!p || !r || !info) return;
    const flyTo = (x, y, speed) => {
      const dx = x - pet.x, dy = y - pet.y, d = Math.hypot(dx, dy);
      const step = (speed * dt) / 1000;
      if (d <= step) { pet.x = x; pet.y = y; }
      else { pet.x += (dx / d) * step; pet.y += (dy / d) * step; }
      pet.dir = dirOf(dx, dy); pet.moving = true;
      return d;
    };
    // หาของที่ดรอปรอบตัวเจ้าของ (เฉพาะของที่เจ้าของมีสิทธิ์เก็บ และกระเป๋ายังมีที่)
    if (!p.dead) {
      if (r.petPick) {
        const d = this.state.drops.get(r.petPick);
        if (!d || !this.canPick(pid, r.petPick) || dist(p, d) > info.range + 96) r.petPick = null;
      }
      if (!r.petPick && t >= (r.petNext || 0)) {
        let best = null, bd = Infinity;
        this.state.drops.forEach((d, did) => {
          if (dist(p, d) > info.range || !this.canPick(pid, did) || !Bag.canFit(p.bag, d.item, 1) || !this.wantLoot(r, d)) return;
          const dd = dist(pet, d);
          if (dd < bd) { bd = dd; best = did; }
        });
        r.petPick = best;
        if (!best) r.petNext = t + 300;
      }
      if (r.petPick) {
        const d = this.state.drops.get(r.petPick);
        if (flyTo(d.x, d.y - 4, info.speed) <= PET_PICK) {
          this.tryPickup(pid, p, r.petPick);
          r.petPick = null; r.petNext = t + 250;
        }
        return;
      }
    }
    // บินตามเจ้าของ (อยู่ข้างหลังเยื้อง ๆ)
    const back = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }[p.dir] || [0, -1];
    const fx = p.x + back[0] * PET_FOLLOW + (back[1] ? 18 : 0), fy = p.y + back[1] * PET_FOLLOW * 0.6 - 4;
    const d = Math.hypot(fx - pet.x, fy - pet.y);
    if (d > 700) { pet.x = fx; pet.y = fy; pet.moving = false; return; }
    if (d > 8) flyTo(fx, fy, d > 120 ? info.speed * 1.4 : Math.max(SPEED, info.speed * 0.8));
    else { pet.moving = false; if (!p.moving) pet.dir = p.dir; }
  }

  updatePlayer(p, r, id, dt, t) {
    if (!r) return;
    if (p.dead) {
      // นอกเมือง: รอผู้เล่นเลือก (คริสตัลใกล้สุด / กลับเมือง) · ไม่เลือกภายใน 30 วิ → คริสตัลใกล้สุด
      if (this.mapId !== W.START_MAP && !p.warp) {
        if (t >= r.deadUntil && (r.respawnPick || t >= r.deadUntil - RESPAWN_PLAYER_MS + RESPAWN_AUTO_MS)) this.respawnAt(id, p, r, r.respawnPick || "crystal");
        return;
      }
      if (t >= r.deadUntil) {
        if (p.warp) return;
        const s = this.townSpawn();
        p.x = s.x; p.y = s.y; p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, Math.floor(p.maxSp / 2));
        p.dir = "down";
      }
      return;
    }
    if (p.warp) return; // กำลังย้ายแผนที่
    this.checkPortals(id, p);
    const step = (SPEED * this.mods(r).speed * (1 + ((p.sx && p.sx.moveSpd) || 0) / 100) * dt) / 1000;
    if (p.auto) this.autoThink(id, p, r);

    // เดินไปเก็บของบนพื้น
    if (r.pick && !r.target) {
      const d = this.state.drops.get(r.pick);
      if (!d) { r.pick = null; r.nav = null; }
      else if (dist(p, d) <= PICK_RANGE) { this.tryPickup(id, p, r.pick); r.pick = null; r.nav = null; p.moving = false; }
      else if (!this.navTo(p, r, d, step, t)) { r.pick = null; r.nav = null; p.moving = false; }
      return;
    }

    // มีเป้าหมาย: เดินเข้าไปจนถึงระยะ แล้วตี
    if (r.target) {
      const mob = this.state.monsters.get(r.target);
      if (!mob || mob.dead) { r.target = null; r.pending = null; p.moving = false; return; }
      const range = r.pending ? D.SKILLS[r.pending].range || MELEE_RANGE : p.range || MELEE_RANGE;
      const d = dist(p, mob);
      if (d > range) {
        // เดินอ้อมสิ่งกีดขวางไปหามอน — ถ้าไม่มีทางไปถึงนานเกิน 1.2 วิ → เลิกไล่ตัวนี้ (AUTO ข้ามตัวนี้ไปสักพัก)
        if (!this.navTo(p, r, mob, step, t)) {
          r.stuckMs = (r.stuckMs || 0) + dt;
          if (r.stuckMs > 1200) {
            r.ignore = r.ignore || {}; r.ignore[r.target] = t + 8000;
            r.target = null; r.pending = null; r.stuckMs = 0; p.moving = false;
          }
        } else r.stuckMs = 0;
        return;
      }
      r.stuckMs = 0; r.nav = null;
      p.moving = false;
      p.dir = dirOf(mob.x - p.x, mob.y - p.y);
      if (r.pending) { const sk = r.pending; r.pending = null; this.castSkill(id, p, r, sk, r.target); return; }
      if (t >= r.atkReady) {
        r.atkReady = t + Math.round(p.atkDelay * this.mods(r).aspd);
        r.lastAct = t;
        const fx = p.wt && D.WEAPON_TYPES[p.wt].fx;
        this.broadcast("atk", { id, dir: p.dir, fx, tgt: r.target });
        if (fx) { // ยิงไกล: ดาเมจเข้าเมื่อกระสุนถึงเป้า
          const tid = r.target;
          // ดาเมจเข้าเมื่อกระสุนถึงเป้า: ธนูปล่อยที่ 380ms · เวทปล่อยที่ 170ms (ตรงกับท่าบน client)
          const release = fx === "arrow" ? 380 : 170;
          this.clock.setTimeout(() => { if (!p.dead) this.hitMob(id, p, tid, 1); }, release + Math.min(450, 60 + d * 1.4));
        } else {
          const res = this.hitMob(id, p, r.target, 1);
          if (D.baseJob(p.job) === "slayer" && res && !res.miss) r.combo = Math.min(5, (r.combo || 0) + 1);
        }
      }
      return;
    }

    // ปุ่มทิศทาง = เดินตรง ๆ (ไม่ใช้ระบบนำทาง)
    if (r.dx || r.dy) { r.nav = null; this.move(p, r.dx, r.dy, step); return; }
    // คลิกเดิน = หาทางอ้อมสิ่งกีดขวาง
    if (r.moveTarget) {
      if (dist(p, r.moveTarget) < step) {
        if (this.canStand(r.moveTarget.x, r.moveTarget.y)) { p.x = r.moveTarget.x; p.y = r.moveTarget.y; }
        r.moveTarget = null; r.nav = null; p.moving = false;
      } else if (!this.navTo(p, r, r.moveTarget, step, t)) { r.moveTarget = null; r.nav = null; p.moving = false; }
      return;
    }
    p.moving = false;
  }

  // ---------- เดินตามเส้นทาง ----------
  // เห็นเป้าหมายตรง ๆ → เดินตรง; มีของขวาง → ใช้ A* หาทางอ้อม (คำนวณใหม่เมื่อเป้าหมายขยับ)
  // คืนค่า false เมื่อไปไม่ได้
  navTo(e, r, goal, step, t) {
    if (this.lineClear(e, goal)) { r.nav = null; return this.stepToward(e, goal, step); }
    let nav = r.nav;
    const stale = !nav || !nav.path || !nav.path.length || (dist(nav.goal, goal) > 24 && t - nav.at > 500);
    if (stale) {
      const path = this.nav.find(e, goal);
      nav = r.nav = { path, goal: { x: goal.x, y: goal.y }, at: t };
      if (!path || !path.length) return false;
    }
    // ข้ามจุดที่มองเห็นได้ตรง ๆ (เส้นทางจะได้ไม่หักเป็นมุมฉาก)
    while (nav.path.length > 1 && this.lineClear(e, nav.path[1])) nav.path.shift();
    const wp = nav.path[0];
    if (dist(e, wp) <= step) {
      e.x = wp.x; e.y = wp.y; e.moving = true;
      nav.path.shift();
      return true;
    }
    if (!this.stepToward(e, wp, step)) { r.nav = null; return false; }
    return true;
  }

  // เส้นตรงจาก a ไป b เดินผ่านได้ตลอดทางไหม
  lineClear(a, b) {
    const d = dist(a, b), n = Math.ceil(d / 6);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (!this.canStand(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k)) return false;
    }
    return true;
  }

  stepToward(e, to, step) {
    const d = dist(e, to);
    if (!(d > 0.5)) return false;
    return this.move(e, (to.x - e.x) / d, (to.y - e.y) / d, step);
  }

  move(e, vx, vy, step) {
    const len = Math.hypot(vx, vy);
    vx = (vx / len) * step; vy = (vy / len) * step;
    const ox = e.x, oy = e.y;
    if (this.canStand(e.x + vx, e.y)) e.x += vx;
    if (this.canStand(e.x, e.y + vy)) e.y += vy;
    const moved = e.x !== ox || e.y !== oy;
    e.moving = moved;
    if (moved) e.dir = dirOf(vx, vy);
    return moved;
  }

  inSafe(pt) { return this.crystals.length > 0 && this.crystals.some((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < CRYSTAL_SAFE); }
  // มอนเดินเข้าเขตคริสตัลไม่ได้ (ก้าวที่ทำให้เข้าไป = ยกเลิก)
  updateMob(m, r, id, dt, t) {
    const ox = m.x, oy = m.y;
    this.updateMobInner(m, r, id, dt, t);
    if ((m.x !== ox || m.y !== oy) && this.inSafe(m) && !this.inSafe({ x: ox, y: oy })) {
      m.x = ox; m.y = oy; m.moving = false; r.nav = null; r.wander = null;
      if (r.target) { const p = this.state.players.get(r.target); if (p && this.inSafe(p)) { r.target = null; r.returning = true; } }
    }
  }
  // โซนอันตราย: มอนที่ว่างอยู่รอบ ๆ เข้ามารุมเป้าเดียวกัน (สูงสุด callMax ตัว)
  callPack(m, pid) {
    if (!this.def.danger || process.env.DANGER_OFF) return;
    let n = 0;
    for (const [mid, mr] of this.mr) {
      if (n >= DANGER.callMax) break;
      const o = this.state.monsters.get(mid);
      if (!o || o === m || o.dead || mr.target || mr.boss || mr.returning) continue;
      if (dist(o, m) <= DANGER.call) { mr.target = pid; mr.returning = false; n++; }
    }
  }
  updateMobInner(m, r, id, dt, t) {
    if (r.boss) return this.updateBoss(m, r, id, dt, t);
    if (m.dead) { if (t >= r.respawnAt) this.respawnMob(id); return; }
    if (r.stunUntil > t) { m.moving = false; return; } // มึนงง
    const step = (r.def.speed * (r.slowUntil > t ? 0.5 : 1) * dt) / 1000;

    // มอนดุ: มองหาผู้เล่นใกล้ ๆ
    const danger = this.def.danger && !process.env.DANGER_OFF;
    if (!r.target && (r.def.aggressive || danger) && !r.returning) {
      let best = null, bd = danger ? DANGER.aggro : AGGRO_RADIUS;
      this.state.players.forEach((p, pid) => { if (!p.dead && !p.stealth && !this.inSafe(p)) { const d = dist(m, p); if (d < bd) { bd = d; best = pid; } } });
      if (best) { r.target = best; this.callPack(m, best); }
    }

    if (r.target) {
      const p = this.state.players.get(r.target);
      if (!p || p.dead || p.stealth || dist(m, r.home) > LEASH * (r.mini ? 1.6 : 1) || this.inSafe(p)) { r.target = null; r.returning = true; r.dash = null; }
      else {
        const B = r.def, d = dist(m, p);
        // หนี: เลือดต่ำ → วิ่งหนี 3 วิ (ครั้งเดียวต่อชีวิต) แล้วกลับมาสู้
        if (B.flee && !r.fled && m.hp < m.maxHp * B.flee) { r.fled = true; r.fleeUntil = t + 3000; this.broadcast("mobFx", { id, kind: "flee" }); }
        if (t < r.fleeUntil) { this.stepToward(m, { x: m.x * 2 - p.x, y: m.y * 2 - p.y }, step * 1.3); return; }
        // พุ่งชน: ตั้งท่า (มีเส้นเตือน) แล้วพุ่งไปจุดที่ผู้เล่นยืน
        if (r.dash) {
          if (t < r.dash.at) { m.moving = false; return; }
          const dsh = r.dash, sp = (620 * dt) / 1000;
          const moved = this.stepToward(m, { x: dsh.tx, y: dsh.ty }, sp);
          if (!dsh.hit) this.state.players.forEach((pp, pid) => {
            if (!dsh.hit && !pp.dead && dist(m, pp) < 34) { dsh.hit = true; this.hitPlayer(id, m, r, pid, B.charge.mult || 1.8); }
          });
          if (!moved || t > dsh.at + 450 || Math.hypot(m.x - dsh.tx, m.y - dsh.ty) < 6) { r.dash = null; r.atkReady = t + 700; }
          return;
        }
        if (B.charge && t >= (r.nextCharge || 0) && d > 70 && d < 280) {
          r.nextCharge = t + B.charge.every;
          const ux = (p.x - m.x) / d, uy = (p.y - m.y) / d, L = Math.min(300, d + 40);
          r.dash = { at: t + 650, tx: m.x + ux * L, ty: m.y + uy * L };
          m.moving = false; m.dir = dirOf(ux, uy);
          this.broadcast("mobCharge", { id, x: m.x, y: m.y, tx: r.dash.tx, ty: r.dash.ty, ms: 650 });
          return;
        }
        // ฮีลพวกเดียวกันที่บาดเจ็บรอบตัว (รวมตัวเอง)
        if (B.healer && t >= (r.nextHeal || 0)) {
          let healed = 0;
          this.state.monsters.forEach((mm, mid) => {
            if (mm.dead || mm.hp >= mm.maxHp * 0.75 || dist(mm, m) > B.healer.r) return;
            const amt = Math.round(mm.maxHp * B.healer.pct / 100);
            mm.hp = Math.min(mm.maxHp, mm.hp + amt); healed++;
            this.broadcast("heal", { id: mid, amount: amt });
          });
          if (healed) { r.nextHeal = t + B.healer.every; this.broadcast("mobFx", { id, kind: "heal" }); m.moving = false; return; }
          r.nextHeal = t + 1500;
        }
        const RG = B.ranged, range = RG ? RG.range : MOB_RANGE + ((m.scale || 1) - 1) * 24;
        if (d > range) { if (!this.navTo(m, r, p, step * 1.25, t)) { r.target = null; r.returning = true; } }
        else {
          m.moving = false; m.dir = dirOf(p.x - m.x, p.y - m.y);
          if (t >= r.atkReady) {
            if (RG) { // ยิงจากระยะไกล: ลูกพิษ/เวท/ไฟ/น้ำแข็ง/หิน — ดาเมจตอนกระสุนถึง
              r.atkReady = t + (RG.every || 1800);
              const tgt = r.target;
              this.broadcast("atk", { id, dir: m.dir, mob: true, fx: RG.fx, tgt });
              this.clock.setTimeout(() => { if (!m.dead) this.hitPlayer(id, m, r, tgt); }, 200 + Math.min(450, 60 + d * 1.4));
            } else {
              r.atkReady = t + MOB_ATK_MS;
              this.broadcast("atk", { id, dir: m.dir, mob: true });
              this.hitPlayer(id, m, r, r.target);
            }
          }
        }
        return;
      }
    }

    if (r.returning) {
      if (dist(m, r.home) < 8) { r.returning = false; m.hp = m.maxHp; m.moving = false; r.dmgBy.clear(); }
      else if (!this.navTo(m, r, r.home, step * 1.5, t)) { m.x = r.home.x; m.y = r.home.y; r.nav = null; }
      return;
    }

    // เดินเล่นรอบ ๆ บ้าน
    if (!r.wander && t >= r.nextWander) {
      const a = Math.random() * Math.PI * 2, rr = rand(20, 96);
      r.wander = { x: r.home.x + Math.cos(a) * rr, y: r.home.y + Math.sin(a) * rr };
    }
    if (r.wander) {
      if (dist(m, r.wander) < 4 || !this.stepToward(m, r.wander, step * 0.5)) {
        r.wander = null; m.moving = false; r.nextWander = t + rand(2000, 6000);
      }
    }
  }

  // ================= World Boss =================
  // ห้องที่มีบอสอยู่จะไม่ถูกปิดแม้ไม่มีคน (ตายแล้วกลับเมือง บอสยังอยู่) · บอสหมดแล้วค่อยปิดได้ตามปกติ
  bossCleanup() {
    if (this.bossAlive()) return;
    this.autoDispose = true;
    if (!this.clients.length) this.clock.setTimeout(() => { if (!this.clients.length && !this.bossAlive()) this.disconnect(); }, 1000);
  }
  bossAlive() { let a = false; this.mr.forEach((r, id) => { const m = this.state.monsters.get(id); if (r.boss && m && !m.dead) a = true; }); return a; }
  removeBosses(only) {
    let n = 0;
    if (only && ![...this.mr.values()].some((r) => r.boss && r.bossKey === only)) return 0;
    [...this.mr.entries()].forEach(([id, r]) => { if (r.boss || r.minion) { if (r.boss) n++; this.state.monsters.delete(id); this.mr.delete(id); } });
    this.bossCleanup();
    return n;
  }
  spawnBoss(key) {
    const B = D.WORLD_BOSSES[key], base = D.monsterStats(B.level);
    const id = "boss" + this.mobSeq++;
    const m = new Monster();
    m.kind = "boss_" + key; m.name = B.name; m.level = B.level; m.sprite = B.sprite; m.tint = B.tint; m.scale = B.scale; m.boss = true;
    const spot = this.mobSpot();
    m.x = spot.x; m.y = spot.y; m.dir = "down"; m.moving = false; m.dead = false;
    const stats = { maxHp: base.maxHp * B.hpMul, atk: Math.round(base.atk * B.atkMul), def: Math.round(base.def * B.defMul), exp: base.exp * B.expMul };
    m.maxHp = stats.maxHp; m.hp = m.maxHp;
    this.state.monsters.set(id, m);
    this.mr.set(id, { def: B, stats, boss: B, temp: true, home: { ...spot }, target: null, wander: null, nextWander: 0, atkReady: 0, respawnAt: Infinity,
      dmgBy: new Map(), nextSlam: now() + 5000, cast: null, summoned: 0, enraged: false, idleSince: now(), bossKey: key,
      skCd: Object.fromEntries((B.skills || []).map((s, i) => [s.key, now() + 4000 + i * 3500])), sk: null, nextAny: 0 });
    this.autoDispose = false;
    const tx = Math.floor(spot.x / this.map.tile), ty = Math.floor(spot.y / this.map.tile);
    WorldRoom.announce(`⚠️ World Boss ${B.name} Lv.${B.level} ปรากฏตัวที่ ${this.def.name} (${tx}, ${ty})! รวมพลังกันไปปราบ`);
  }
  updateBoss(m, r, id, dt, t) {
    if (m.dead) return;
    const B = r.boss;
    // หาเป้าหมาย: คนที่ใกล้ที่สุดในรัศมีกว้าง
    let p = r.target && this.state.players.get(r.target);
    if (!p || p.dead || p.stealth || dist(m, p) > 600 || this.inSafe(p)) {
      r.target = null; p = null;
      let bd = 420;
      this.state.players.forEach((pp, pid) => { if (!pp.dead && !pp.stealth && !this.inSafe(pp)) { const d = dist(m, pp); if (d < bd) { bd = d; r.target = pid; p = pp; } } });
    }
    // สกิลเฉพาะตัวที่กำลังร่าย: ลงดาเมจทีละพื้นที่ตามเวลา
    if (r.sk) { m.moving = false; this.bossSkillTick(m, r, id, t); return; }
    // ทุบพื้น: เตือนเป็นวงก่อน แล้วค่อยลงดาเมจทุกคนในวง
    if (r.cast) {
      m.moving = false;
      if (t >= r.cast.at) {
        const c = r.cast; r.cast = null;
        this.broadcast("bossSlam", { id, x: c.x, y: c.y, r: B.slam.r });
        this.state.players.forEach((pp, pid) => { if (!pp.dead && Math.hypot(pp.x - c.x, pp.y - c.y) <= B.slam.r) this.hitPlayer(id, m, r, pid, B.slam.mult); });
        r.atkReady = t + 600;
      }
      return;
    }
    if (!p) { // ไม่มีใครอยู่ใกล้: ฟื้นเลือดช้า ๆ แล้วเดินวนแถวบ้าน
      m.moving = false;
      if (t - r.idleSince > 15000 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * 0.002 * dt / 1000));
      return;
    }
    r.idleSince = t;
    // เลือดลดถึงเกณฑ์ → เรียกลูกน้อง / คลั่ง
    const frac = m.hp / m.maxHp;
    if (B.summon && r.summoned < B.summon.at.length && frac <= B.summon.at[r.summoned]) { r.summoned++; this.bossSummon(m, B); }
    if (B.enrage && !r.enraged && frac <= B.enrage) {
      r.enraged = true; r.stats.atk = Math.round(r.stats.atk * 1.3);
      this.broadcast("system", `🔥 ${m.name} คลั่ง! พลังโจมตีและความเร็วเพิ่มขึ้น`);
      this.broadcast("bossRage", { id });
    }
    const d = dist(m, p);
    if (B.skills && t >= r.nextAny) {
      const sk = B.skills.find((s) => t >= r.skCd[s.key] && d <= s.range);
      if (sk) { this.bossSkillStart(m, r, id, sk, p, t); return; }
    }
    if (B.slam && t >= r.nextSlam && d < B.slam.r + 60) {
      r.nextSlam = t + B.slam.every * (r.enraged ? 0.7 : 1);
      r.cast = { at: t + B.slam.cast, x: m.x, y: m.y };
      m.moving = false;
      this.broadcast("bossCast", { id, x: m.x, y: m.y, r: B.slam.r, ms: B.slam.cast });
      return;
    }
    const step = (B.speed * (r.enraged ? 1.3 : 1) * dt) / 1000;
    if (d > B.range) { if (!this.navTo(m, r, p, step, t)) this.stepToward(m, p, step); return; }
    m.moving = false; m.dir = dirOf(p.x - m.x, p.y - m.y);
    if (t >= r.atkReady) {
      r.atkReady = t + MOB_ATK_MS * (r.enraged ? 0.65 : 1);
      this.broadcast("atk", { id, dir: m.dir, mob: true });
      this.hitPlayer(id, m, r, r.target);
    }
  }
  // ---------- สกิลเฉพาะตัวของ World Boss ----------
  // พื้นที่: c = วงกลม {x,y,r} · ring = วงแหวน {x,y,r0,r} · rect = แนวยาว {x1,y1,x2,y2,w} · cone = กรวย {x,y,a,arc,r} · at = เวลาที่ลงดาเมจ
  bossSkillStart(m, r, id, sk, p, t) {
    const rage = r.enraged ? 0.75 : 1;
    r.skCd[sk.key] = t + sk.every * rage;
    const players = [...this.state.players.entries()].filter(([, pp]) => !pp.dead && !this.inSafe(pp) && dist(m, pp) <= sk.range + 200);
    const shapes = [];
    const ang = Math.atan2(p.y - m.y, p.x - m.x);
    m.dir = dirOf(p.x - m.x, p.y - m.y);
    switch (sk.key) {
      case "bullrush": { // แนวพุ่งจากบอสผ่านเป้าหมาย
        let len = sk.len;
        while (len > 60 && !this.canStand(m.x + Math.cos(ang) * len, m.y + Math.sin(ang) * len)) len -= 20;
        shapes.push({ t: "rect", x1: m.x, y1: m.y, x2: m.x + Math.cos(ang) * len, y2: m.y + Math.sin(ang) * len, w: sk.w, at: sk.cast });
        break;
      }
      case "bloodroar": case "wingstorm": shapes.push({ t: "c", x: m.x, y: m.y, r: sk.r, at: sk.cast }); break;
      case "soulnova": shapes.push({ t: "ring", x: m.x, y: m.y, r0: sk.r0, r: sk.r, at: sk.cast }); break;
      case "breath": shapes.push({ t: "cone", x: m.x, y: m.y, a: ang, arc: sk.arc, r: sk.r, at: sk.cast }); break;
      case "deathmark": { // ตราใต้เท้าผู้เล่น 1–2 คน
        const tg = players.sort(() => Math.random() - 0.5).slice(0, players.length >= 4 ? 2 : 1);
        for (const [, pp] of tg) shapes.push({ t: "c", x: pp.x, y: pp.y, r: sk.r, at: sk.cast });
        break;
      }
      case "frostrain": case "meteor": { // ตกใส่ทุกคน + จุดสุ่มรอบบอส · ทยอยลงทีละลูก
        const pts = players.map(([, pp]) => ({ x: pp.x + (Math.random() - 0.5) * 30, y: pp.y + (Math.random() - 0.5) * 30 }));
        while (pts.length < sk.n) { const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * (sk.range - 80); pts.push({ x: m.x + Math.cos(a) * rr, y: m.y + Math.sin(a) * rr }); }
        pts.slice(0, sk.n + 2).forEach((q, i) => shapes.push({ t: "c", x: q.x, y: q.y, r: sk.r, at: sk.cast + i * 160 }));
        break;
      }
    }
    if (!shapes.length) return;
    r.sk = { key: sk.key, def: sk, t0: t, shapes };
    this.broadcast("bossSkill", { id, key: sk.key, name: sk.name, shapes });
  }
  inShape(q, s) {
    const dx = q.x - (s.x ?? s.x1), dy = q.y - (s.y ?? s.y1);
    if (s.t === "c") return dx * dx + dy * dy <= s.r * s.r;
    if (s.t === "ring") { const d = Math.hypot(dx, dy); return d >= s.r0 && d <= s.r; }
    if (s.t === "cone") { const d = Math.hypot(dx, dy); if (d > s.r) return false; let da = Math.atan2(dy, dx) - s.a; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) <= s.arc / 2 || d < 30; }
    if (s.t === "rect") { const lx = s.x2 - s.x1, ly = s.y2 - s.y1, L2 = lx * lx + ly * ly || 1; const u = Math.max(0, Math.min(1, (dx * lx + dy * ly) / L2)); return Math.hypot(dx - u * lx, dy - u * ly) <= s.w / 2; }
    return false;
  }
  bossSkillTick(m, r, id, t) {
    const S = r.sk, sk = S.def;
    for (const s of S.shapes) {
      if (s.done || t < S.t0 + s.at) continue;
      s.done = true;
      if (sk.key === "bullrush") { m.x = s.x2; m.y = s.y2; } // พุ่งไปปลายแนว
      let hits = 0;
      this.state.players.forEach((pp, pid) => {
        if (pp.dead || this.inSafe(pp) || !this.inShape(pp, s)) return;
        hits++;
        this.hitPlayer(id, m, r, pid, sk.mult);
        if (pp.dead) return;
        const pr = this.pr.get(pid);
        if (sk.debuff) this.addBuff(pid, sk.debuff);
        if (sk.dot && pr && !this.mods(pr).immune) pr.poison = { until: now() + sk.dot.ms, dmg: Math.max(1, Math.round(r.stats.atk * sk.dot.pct / 100)) };
        if (sk.knock) { // ผลักออกจากบอส
          const a = Math.atan2(pp.y - m.y, pp.x - m.x);
          for (let k = sk.knock; k > 0; k -= 15) { const nx = pp.x + Math.cos(a) * k, ny = pp.y + Math.sin(a) * k; if (this.canStand(nx, ny)) { pp.x = nx; pp.y = ny; break; } }
          if (pr) { pr.nav = null; pr.moveTarget = null; }
        }
      });
      if (sk.heal && hits) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * sk.heal * hits));
      this.broadcast("bossSkillHit", { id, key: sk.key, s, hits });
    }
    if (S.shapes.every((s) => s.done)) { r.sk = null; r.nextAny = t + 1800; r.atkReady = t + 700; }
  }
  bossSummon(m, B) {
    const def = D.MONSTERS[B.summon.kind];
    for (let i = 0; i < B.summon.n; i++) {
      const id = "m" + this.mobSeq++, mm = new Monster();
      mm.kind = B.summon.kind; mm.name = def.name; mm.level = def.level;
      mm.sprite = def.sprite || B.summon.kind; mm.tint = def.tint || 0xffffff; mm.scale = def.scale || 1;
      const a = (i / B.summon.n) * Math.PI * 2;
      let x = m.x + Math.cos(a) * 60, y = m.y + Math.sin(a) * 40;
      if (!this.canStand(x, y)) { x = m.x; y = m.y; }
      mm.x = x; mm.y = y; mm.dir = "down"; mm.moving = false; mm.dead = false;
      const stats = D.monsterStats(def.level);
      mm.maxHp = stats.maxHp; mm.hp = mm.maxHp;
      this.state.monsters.set(id, mm);
      this.mr.set(id, { def, stats, temp: true, minion: true, home: { x, y }, target: null, wander: null, nextWander: 0, atkReady: 0, respawnAt: Infinity, dmgBy: new Map() });
    }
    this.broadcast("system", `📣 ${m.name} เรียกลูกน้องออกมา ${B.summon.n} ตัว!`);
  }
  bossLoot(m, r, mvp, total) {
    const B = r.boss, L = B.loot, mp = mvp && this.state.players.get(mvp);
    const at = (i, n) => { const a = (i / n) * Math.PI * 2; return [m.x + Math.cos(a) * 46, m.y + Math.sin(a) * 30]; };
    const pool = [...(L.pool || [])].sort(() => Math.random() - 0.5);
    const N = L.gear + L.items.length;
    for (let i = 0; i < L.gear; i++) {
      // ชิ้นแรก = รางวัล MVP: มหากาพย์ขึ้นไปแน่นอน · ชิ้นอื่นสุ่ม ดี–ตำนาน
      const x = Math.random(), rar = i === 0 ? (x < 0.2 ? 4 : 3) : (x < 0.04 ? 4 : x < 0.25 ? 3 : 2); // ชิ้นแรกม่วงขึ้นไปแน่นอน · ที่เหลือน้ำเงินขึ้นไป
      const [dx, dy] = at(i, N);
      // บอส Lv.50+: อุปกรณ์ประจำอาชีพขั้น 2 (L.cls = ขั้นที่ดรอป) · ชิ้น MVP เป็นของอาชีพ MVP 60%
      let id;
      if (L.cls) { const lv = L.cls[Math.floor(Math.random() * L.cls.length)]; id = CG.pickClassItem(lv, i === 0 ? mp && mp.job : null); }
      else id = pool[i % pool.length];
      this.spawnDrop(id, 1, dx, dy, i === 0 ? mvp : null, I.makeGear(id, rar));
    }
    if (L.set && L.set.length) { // ชิ้นชุดพิเศษของบอส 1 ชิ้นแน่นอน
      const id = L.set[Math.floor(Math.random() * L.set.length)], x = Math.random();
      this.spawnDrop(id, 1, m.x, m.y + 36, null, I.makeGear(id, x < 0.05 ? 4 : x < 0.3 ? 3 : 2));
      WorldRoom.announce(`✨ ${m.name} ดรอป ${I.ITEMS[id].name}!`);
    }
    L.items.forEach(([id, lo, hi], k) => { const [dx, dy] = at(L.gear + k, N); this.spawnDrop(id, lo + Math.floor(Math.random() * (hi - lo + 1)), dx, dy, null, null); });
    const rank = [...r.dmgBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([pid, dmg], i) => { const pp = this.state.players.get(pid); return `${i + 1}. ${pp ? pp.name : "?"} ${Math.round((dmg * 100) / total)}%`; });
    WorldRoom.announce(`🏆 ${m.name} ถูกปราบแล้ว! MVP: ${mp ? mp.name : "-"} · ${rank.join(" · ")}`);
  }

  // ================= การต่อสู้ =================
  // a = ผู้ตี {atk, lv, crit?, hitBonus?}, d = ผู้โดน {def, lv, flee?}
  calcDamage(a, d, mult) {
    const missChance = Math.min(0.4, 0.05 + Math.max(0, d.lv - a.lv) * 0.03);
    if (Math.random() < Math.max(0, missChance - (a.hitBonus || 0))) return { dmg: 0, miss: true };
    if (d.flee && Math.random() < d.flee) return { dmg: 0, miss: true };
    const crit = Math.random() < (a.crit ?? 0.05);
    let dmg = a.atk * rand(0.9, 1.1) * mult * (1 - D.defReduce(d.def * (1 - (a.ignoreDef || 0)), a.lv || 1));
    if (crit) dmg *= 1.5 + (a.critDmg || 0);
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  // ตัวคูณจากบัฟที่ยังไม่หมดเวลา
  mods(r) {
    // นอกจากตัวคูณพื้นฐาน: crit/critDmg (บวก) · lifesteal (%) · reflect/mshield/poison/regen (สัดส่วน) · stealth/immune (มี/ไม่มี)
    const o = { atk: 1, def: 1, taken: 1, aspd: 1, speed: 1, flee: 0, crit: 0, critDmg: 0, lifesteal: 0, reflect: 0, mshield: 0, poison: 0, regen: 0, stealth: false, immune: false };
    if (!r || !r.buffs) return o;
    const t = now();
    for (const [k, bf] of Object.entries(r.buffs)) {
      if (bf.until <= t) { delete r.buffs[k]; continue; }
      const b = { ...D.BUFFS[k], ...(bf.v || {}) };
      for (const f of ["atk", "def", "aspd", "speed"]) if (b[f]) o[f] *= b[f];
      if (b.taken !== undefined) o.taken *= b.taken;
      if (b.flee) o.flee += b.flee;
      for (const f of ["crit", "critDmg", "lifesteal", "reflect", "mshield", "poison", "regen"]) if (b[f]) o[f] += b[f];
      if (b.stealth) o.stealth = true;
      if (b.immune) o.immune = true;
    }
    return o;
  }
  // v = ค่าบัฟตามเลเวลสกิล (atk/def/taken/aspd/speed/flee/ms)
  addBuff(pid, key, v) {
    const r = this.pr.get(pid), b = D.BUFFS[key];
    if (!r || !b) return;
    const ms = (v && v.ms) || b.ms;
    r.buffs[key] = { until: now() + ms, v: v || null };
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("buff", { key, ms });
  }
  // opts: undead = ตัวคูณเพิ่มกับอันเดด · stun/slow = มิลลิวินาที
  hitMob(pid, p, mid, mult, opts = {}) {
    const m = this.state.monsters.get(mid), r = this.mr.get(mid), pr = this.pr.get(pid);
    if (!m || m.dead) return null;
    if (this.inSafe(p)) { // ในเขตคริสตัลโจมตีไม่ได้ (กันยืนยิงจากที่ปลอดภัย)
      if (pr && !opts.spirit && now() > (pr.safeToast || 0)) { pr.safeToast = now() + 3000; const cl = this.clients.find((c) => c.sessionId === pid); if (cl) cl.send("toast", "💎 ในเขตคริสตัลโจมตีไม่ได้ — ออกไปนอกวงก่อน"); }
      if (pr && pr.target === mid) pr.target = null;
      return null;
    }
    const sx = p.sx || {}, md = this.mods(pr), t0 = now();
    if (D.UNDEAD.includes(m.kind)) { if (opts.undead) mult *= opts.undead; if (sx.undeadDmg) mult *= 1 + sx.undeadDmg / 100; }
    if (r.doomUntil > t0) mult *= 1 + r.doomPct;                 // สาปเสื่อม: มอนโดนแรงขึ้น
    let forceCrit = !!opts.crit;
    if (md.stealth && !opts.spirit) { forceCrit = true; if (opts.stealthMul) mult *= opts.stealthMul; this.breakStealth(pid); } // โจมตีจากเงา
    const res = this.calcDamage({ atk: p.atk * md.atk, lv: p.level, crit: forceCrit ? 1 : Math.min(0.9, p.crit + md.crit), hitBonus: p.hitBonus + (forceCrit ? 1 : 0),
      critDmg: (sx.critDmg || 0) / 100 + md.critDmg, ignoreDef: Math.min(1, (sx.ignoreDef || 0) / 100 + (opts.ignore || 0)) },
      { def: r.stats.def, lv: m.level }, mult);
    this.broadcast("hit", { tgt: mid, mob: true, src: pid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss, ...(opts.spirit ? { sp: 1 } : {}) });
    if (res.miss) return res;
    m.hp = Math.max(0, m.hp - res.dmg);
    r.dmgBy.set(pid, (r.dmgBy.get(pid) || 0) + res.dmg);
    // ดูดเลือด (ดาเมจจากภูติไม่นับ) · สกิลดูดเลือด (drain) · บัฟโลหิตเดือด
    const ls = (opts.spirit ? 0 : (sx.lifesteal || 0) + md.lifesteal) / 100 + (opts.drain || 0);
    if (ls > 0 && !p.dead && p.hp < p.maxHp) {
      const hl = Math.min(p.maxHp - p.hp, Math.floor(res.dmg * ls));
      if (hl > 0) { p.hp += hl; if (hl >= 5) this.broadcast("heal", { id: pid, amount: hl }); }
    }
    // อาบยาพิษ: ทุกการโจมตีใส่พิษ (ไม่ซ้อน — ต่อเวลา)
    if (md.poison && !opts.spirit && !opts.dot) { r.dots = r.dots || {}; r.dots[pid] = { dmg: Math.max(1, Math.round(p.atk * md.poison)), until: t0 + 5000 }; }
    if (!r.target) { r.target = pid; r.returning = false; this.callPack(m, pid); }
    if (opts.stun) r.stunUntil = now() + opts.stun;
    if (opts.slow) r.slowUntil = now() + opts.slow;
    if (m.hp <= 0) this.killMob(mid, m, r);
    return res;
  }
  // มอนที่ยังไม่ตายในรัศมี rad รอบจุด (x,y)
  mobsNear(x, y, rad) {
    const out = [];
    this.state.monsters.forEach((m, mid) => { if (!m.dead && Math.hypot(m.x - x, m.y - y) <= rad) out.push(mid); });
    return out;
  }

  killMob(mid, m, r) {
    m.dead = true; m.moving = false;
    r.respawnAt = r.temp ? Infinity : r.mini ? now() + rand(...MINI_RESPAWN_MS) : now() + D.MONSTER_RESPAWN_MS;
    if (r.mini) this.broadcast("system", `🏆 ${m.name} ถูกปราบแล้ว! (จะกลับมาอีกในอีกประมาณ 10 นาที)`);
    // บอส/ลูกน้องบอส: ไม่เกิดใหม่ ลบออกจากแผนที่หลังเล่นท่าตาย
    if (r.temp) this.clock.setTimeout(() => { this.state.monsters.delete(mid); this.mr.delete(mid); if (r.boss) this.bossCleanup(); }, r.boss ? 15000 : 2500);
    if (r.boss) WorldRoom.bossGone(r.bossKey);
    r.target = null;
    // แบ่ง EXP ตามสัดส่วนดาเมจที่ทำ
    const total = [...r.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    // EXP: คนที่ไม่มีปาร์ตี้ได้ตามสัดส่วนดาเมจ · ปาร์ตี้ = รวม EXP ของทั้งปาร์ตี้แล้วแบ่งเท่ากันให้สมาชิกที่อยู่ใกล้ (+10% ต่อสมาชิกที่เพิ่ม)
    const credit = new Set(r.dmgBy.keys()), pool = new Map();
    r.dmgBy.forEach((dmg, pid) => {
      const share = Math.max(1, Math.round((r.stats.exp * dmg) / total)), rr = this.pr.get(pid), ptId = rr && partyOf.get(rr.charId);
      if (!ptId) return this.gainExp(pid, share);
      pool.set(ptId, (pool.get(ptId) || 0) + share);
    });
    pool.forEach((sum, ptId) => {
      const pt = parties.get(ptId);
      if (!pt) return;
      const near = pt.members.map((cid) => online.get(cid)).filter((o) => o && o.room === this)
        .map((o) => o.sessionId).filter((sid) => { const pp = this.state.players.get(sid); return pp && !pp.dead && (r.dmgBy.has(sid) || dist(pp, m) <= PARTY_RANGE); });
      if (!near.length) return;
      const each = Math.max(1, Math.round((sum * (1 + 0.1 * (near.length - 1))) / near.length));
      near.forEach((sid) => { credit.add(sid); this.gainExp(sid, each); });
    });
    // เควสเปลี่ยนอาชีพ: นับตัวที่ฆ่า (ทุกคนที่ช่วยตี + เพื่อนปาร์ตี้ที่อยู่ใกล้)
    credit.forEach((pid) => {
      const pp = this.state.players.get(pid), q = pp && pp.quest, Q = q && D.JOB_QUESTS[q.job], Q2 = q && D.JOB2_QUESTS[q.job];
      if (Q2 && r.rank === 2 && this.mapId === Q2.mini && q.kills < 1) { // บททดสอบขั้น 2: ปราบมินิบอส
        q.kills = 1;
        const cl = this.clients.find((c) => c.sessionId === pid);
        if (cl) { cl.send("quest", q); cl.send("toast", `บททดสอบ: ปราบ${m.name}สำเร็จ!`); }
        return;
      }
      if (!Q || Q.kill[0] !== m.kind || q.kills >= Q.kill[1]) return;
      q.kills++;
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl) { cl.send("quest", q); cl.send("toast", `เควส: ${m.name} ${q.kills}/${Q.kill[1]}`); }
    });
    // เควสภูติ: นับตัวที่ฆ่า
    credit.forEach((pid) => {
      const pp = this.state.players.get(pid), q = pp && pp.bag && pp.bag.spq;
      if (!q) return;
      let changed = false;
      for (const [sid, kills] of Object.entries(q)) {
        const Q = SP.SPIRIT_QUESTS[sid];
        if (!Q || Q.kill[0] !== m.kind || kills >= Q.kill[1]) continue;
        q[sid] = kills + 1; changed = true;
        const cl = this.clients.find((c) => c.sessionId === pid);
        if (cl) cl.send("toast", `เควส${SP.SPIRITS[sid].name}: ${m.name} ${q[sid]}/${Q.kill[1]}`);
      }
      const cl = changed && this.clients.find((c) => c.sessionId === pid);
      if (cl) cl.send("spq", q);
    });
    // เงินแบ่งตามดาเมจ, ของดรอปตกพื้น (คนที่ทำดาเมจมากสุดมีสิทธิ์เก็บก่อน)
    const gold = I.goldDrop(m.level) * (r.boss ? r.boss.goldMul : 1) * (r.rank === 2 ? 8 : r.rank === 1 ? 3 : 1);
    let top = null, topDmg = -1;
    r.dmgBy.forEach((dmg, pid) => {
      if (dmg > topDmg) { topDmg = dmg; top = pid; }
      const pp = this.state.players.get(pid), g = Math.max(1, Math.round((gold * dmg) / total));
      if (pp && pp.bag) { pp.bag.gold += g; this.sendInv(pid, { goldGain: g, at: { x: m.x, y: m.y } }); }
    });
    const tp = top && this.state.players.get(top), rankMul = r.rank === 2 ? 6 : r.rank === 1 ? 3 : 1;
    const dropMul = (1 + ((tp && tp.sx && tp.sx.dropPct) || 0) / 100) * rankMul;
    // ชั้นยอด/มินิบอส: ของดีขึ้น (อุปกรณ์ระดับขั้นต่ำสูงขึ้น)
    // ระดับของอุปกรณ์ที่ดรอป: มอนธรรมดา = สูงสุดสีน้ำเงิน (หายาก) · ชั้นยอด = ดีขึ้นไป · มินิบอส = น้ำเงินขึ้นไป (ม่วง/ทองมีโอกาส)
    const gearOf = (id) => {
      const roll = I.rollRarity();
      if (r.rank !== 2 && I.ITEMS[id] && I.ITEMS[id].cls) { // อุปกรณ์ประจำอาชีพขั้น 2 จากมอนธรรมดา/ชั้นยอด: เขียว 70% · น้ำเงิน 25% · ม่วง 5% (ไม่มีสีธรรมดา)
        const x = Math.random(), cr = x < 0.05 ? 3 : x < 0.3 ? 2 : 1;
        return I.makeGear(id, r.rank === 1 ? Math.max(cr, roll) : cr);
      }
      const rar = r.rank === 2 ? (Math.random() < 0.03 ? 4 : Math.random() < 0.18 ? 3 : 2) : r.rank === 1 ? Math.max(1, roll) : Math.min(2, roll);
      return I.makeGear(id, rar);
    };
    const table = I.DROPS[m.kind] || [];
    const myCls = tp && CG.CLASSES[tp.job] ? tp.job : null;
    for (const [id0, chance, lo, hi] of table) {
      if (!(Math.random() < chance * dropMul)) continue;
      let id = id0;
      // ชุดอาชีพ: 1/3 ถูกสลับเป็นของอาชีพคนที่ตีมากสุด → รวมแล้ว ~40% เป็นของอาชีพตัวเอง
      if (myCls && I.ITEMS[id].cls && I.ITEMS[id].cls !== myCls && Math.random() < 1 / 3) id = id.replace(`_${I.ITEMS[id].cls}_`, `_${myCls}_`);
      this.spawnDrop(id, lo + Math.floor(Math.random() * (hi - lo + 1)), m.x, m.y, top, gearOf(id));
    }
    // ผลึกวิญญาณ (อัประดับภูติ): มอนธรรมดา Lv.10+ 0.5% · ชั้นยอด 20% · มินิบอส 2–4 · World Boss 8–12
    {
      const sh = r.boss ? 8 + Math.floor(Math.random() * 5) : r.rank === 2 ? 2 + Math.floor(Math.random() * 3)
        : r.rank === 1 ? (Math.random() < 0.2 ? 1 : 0) : m.level >= 10 && Math.random() < 0.005 * (1 + ((tp && tp.sx && tp.sx.dropPct) || 0) / 100) ? 1 : 0;
      if (sh) this.spawnDrop("spirit_shard", sh, m.x - 10, m.y + 4, r.boss ? null : top, null);
    }
    if (r.rank === 2) { // มินิบอส: อุปกรณ์ 1 ชิ้นแน่นอน · Lv.45+ = อุปกรณ์ประจำอาชีพขั้น 2 (มักเป็นของอาชีพคนที่ตีมากสุด)
      if (m.level >= 45) {
        const id = CG.pickClassItem(CG.classTierOf(m.level), tp && tp.job);
        this.spawnDrop(id, 1, m.x + 10, m.y + 6, top, gearOf(id));
      } else {
        const eq = table.filter(([id]) => I.ITEMS[id].type === "equip");
        if (eq.length) { const id = eq[Math.floor(Math.random() * eq.length)][0]; this.spawnDrop(id, 1, m.x + 10, m.y + 6, top, gearOf(id)); }
      }
    }
    if (r.boss) {
      this.bossLoot(m, r, top, total);
      // บอสตาย → ลูกน้องหายไปด้วย
      this.clock.setTimeout(() => [...this.mr.entries()].forEach(([id, mr]) => { if (mr.minion) { this.state.monsters.delete(id); this.mr.delete(id); } }), 3000);
    }
    r.dmgBy.clear();
    this.pr.forEach((pr) => { if (pr.target === mid) { pr.target = null; pr.pending = null; } });
  }

  hitPlayer(mid, m, r, pid, mult = 1) {
    const p = this.state.players.get(pid), pr = this.pr.get(pid);
    if (!p || p.dead || !pr) return;
    if (pr.safeUntil && now() < pr.safeUntil) return; // เพิ่งเกิดที่คริสตัล
    if (this.inSafe(p)) return;                        // อยู่ในเขตคริสตัล
    const md = this.mods(pr);
    if (r.weakUntil > now()) mult *= 1 - r.weakPct;               // คำสาปอ่อนแรง: มอนตีเบาลง
    const res = this.calcDamage({ atk: r.stats.atk, lv: m.level }, { def: p.def * md.def, lv: p.level, flee: mult > 1 ? 0 : p.flee + md.flee }, mult);
    if (!res.miss && md.taken === 0) { this.broadcast("hit", { tgt: pid, src: mid, dmg: 0, miss: true }); return; } // เกราะศรัทธา
    if (!res.miss && md.taken !== 1) res.dmg = Math.max(1, Math.round(res.dmg * md.taken));
    if (!res.miss && md.reflect && !m.dead) { // เกราะหนาม: สะท้อนดาเมจ
      const rd = Math.max(1, Math.round(res.dmg * md.reflect));
      m.hp = Math.max(0, m.hp - rd); r.dmgBy.set(pid, (r.dmgBy.get(pid) || 0) + rd);
      this.broadcast("hit", { tgt: mid, mob: true, src: pid, dmg: rd });
      if (m.hp <= 0) { this.killMob(mid, m, r); }
    }
    if (!res.miss && md.mshield && p.sp > 0) { // โล่มานา: ดาเมจส่วนหนึ่งไปหัก SP
      const toSp = Math.min(p.sp, Math.round(res.dmg * md.mshield));
      p.sp -= toSp; res.dmg = Math.max(0, res.dmg - toSp);
    }
    if (!res.miss && p.sx && p.sx.dmgReduce) res.dmg = Math.max(1, Math.round(res.dmg * (1 - p.sx.dmgReduce / 100)));
    this.broadcast("hit", { tgt: pid, src: mid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return;
    p.hp = Math.max(0, p.hp - res.dmg);
    pr.lastHurt = now();
    const PZ = r.def && r.def.poison;
    if (PZ && p.hp > 0 && !pr.poison && !md.immune) {
      pr.poison = { until: now() + PZ.ms, dmg: Math.max(1, Math.round(r.stats.atk * PZ.pct / 100)) };
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl) cl.send("toast", `☠ ติดพิษจาก${m.name}!`);
    }
    if (p.hp <= 0) {
      const wasAuto = p.auto;
      p.dead = true; p.moving = false; p.auto = false; p.autoState = "";
      pr.target = null; pr.pending = null; pr.moveTarget = null; pr.dx = pr.dy = 0; pr.buffs = {}; pr.combo = 0;
      pr.deadUntil = now() + RESPAWN_PLAYER_MS; pr.respawnPick = null; pr.autoWas = wasAuto;
      const cl0 = this.clients.find((c) => c.sessionId === pid);
      if (cl0 && this.mapId !== W.START_MAP) cl0.send("died", { wait: RESPAWN_PLAYER_MS, auto: RESPAWN_AUTO_MS, crystals: this.crystals.length });
      this.mr.forEach((mr) => { if (mr.target === pid) { mr.target = null; mr.returning = true; } });
      const loss = Math.min(p.exp, Math.floor(p.expNext * 0.01));
      p.exp -= loss;
      this.broadcast("system", `${p.name} ถูก${m.name}ล้ม`);
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl && loss > 0) cl.send("system", `เสีย EXP ${loss} (1%)`);
    }
  }

  gainExp(pid, amount) {
    const p = this.state.players.get(pid);
    if (!p || p.level >= D.MAX_LEVEL) return;
    amount = Math.round(amount * expMult());
    if (p.sx && p.sx.expPct) amount = Math.round(amount * (1 + p.sx.expPct / 100));
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("exp", amount);
    this.spiritExp(pid, p, amount);
    p.exp += amount;
    let leveled = false;
    while (p.expNext > 0 && p.exp >= p.expNext) {
      p.exp -= p.expNext;
      p.level += 1;
      p.statPoints += D.pointsAtLevel(p.level);
      p.expNext = D.expToNext(p.level);
      leveled = true;
      this.syncSkillPts(p);
    }
    if (p.level >= D.MAX_LEVEL) p.exp = 0;
    if (leveled) {
      this.applyStats(p, true);
      this.sendSkills(pid);
      this.broadcast("lvup", { id: pid, level: p.level });
      this.save(pid);
      this.broadcast("system", `${p.name} เลเวลอัปเป็น Lv.${p.level}!`);
      if (p.level === D.JOB_CHANGE_LEVEL && client)
        client.send("system", `ถึงเลเวล ${D.JOB_CHANGE_LEVEL} แล้ว! ไปคุยกับอัลดริค (ครูฝึกอาชีพ) กลางเมืองอรุณรุ่งเพื่อเปลี่ยนอาชีพ`);
    }
  }

  // ================= ไอเทม =================
  // เรียกฟังก์ชันจัดการกระเป๋า → ถ้าคืนข้อความ = แจ้งผู้เล่น; จากนั้นคำนวณค่าพลัง/ภาพใหม่ แล้วส่งกระเป๋ากลับ
  withBag(client, m, fn) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.bag || !m) return;
    const err = fn(p, p.bag);
    if (typeof err === "string") client.send("toast", err);
    const gear = Bag.gearString(p.bag);
    if (gear !== p.gear) p.gear = gear;
    this.syncPet(client.sessionId);
    this.syncSpirit(client.sessionId);
    this.applyStats(p, false);
    this.sendInv(client.sessionId);
  }
  sendInv(pid, extra) {
    const p = this.state.players.get(pid), client = this.clients.find((c) => c.sessionId === pid);
    if (!p || !p.bag || !client) return;
    // แนบค่าที่คำนวณแล้วให้อุปกรณ์แต่ละชิ้น: st = ค่าพลังรวม, nx = ข้อมูลตีบวกขั้นถัดไป, sell = ราคาขาย
    const deco = (g) => {
      if (g && Bag.isSpiritId(g.id)) return { ...g, si: SP.info(g) };
      if (!g || !Bag.isGearId(g.id)) return g;
      const it = I.ITEMS[g.id], to = (g.up || 0) + 1, out = { ...g, st: I.gearStats(g), sp: I.gearSpecial(g), sell: I.sellPrice(g.id, g) };
      if (I.canRefine(it) && to <= I.MAX_REFINE)
        out.nx = { to, gold: I.refineGold(it, to), rate: I.REFINE[to].rate, mats: I.REFINE[to].mats, add: I.refineBonus(it, 1) };
      return out;
    };
    const data = Bag.saveBag(p.bag);
    data.inv = data.inv.map(deco);
    if (data.spirit) data.spirit = deco(data.spirit);
    data.equip = Object.fromEntries(Object.entries(data.equip).map(([k, g]) => [k, deco(g)]));
    client.send("inv", { ...data, ...(extra || {}) });
  }
  useItem(pid, p, b, idx) {
    const s = b.inv[idx], it = s && I.ITEMS[s.id], r = this.pr.get(pid);
    if (!it) return;
    if (it.type === "equip") return Bag.equipFrom(b, idx, p.level, undefined, p.job);
    if (it.type === "pet") return Bag.summonPet(b, idx, p.level);
    if (it.type === "spirit") return Bag.summonSpirit(b, idx, p.level);
    if (it.type !== "use") return "ใช้ไอเทมนี้ไม่ได้";
    if (p.dead) return;
    if (r && now() < r.useReady) return;
    if (it.heal.hp && p.hp >= p.maxHp && !it.heal.sp) return "HP เต็มแล้ว";
    if (it.heal.sp && p.sp >= p.maxSp && !it.heal.hp) return "SP เต็มแล้ว";
    Bag.removeAt(b, idx, 1);
    if (r) r.useReady = now() + 400;
    if (it.heal.hp) { const a = Math.min(it.heal.hp, p.maxHp - p.hp); p.hp += a; this.broadcast("heal", { id: pid, amount: a }); }
    if (it.heal.sp) { const a = Math.min(it.heal.sp, p.maxSp - p.sp); p.sp += a; this.broadcast("heal", { id: pid, amount: a, sp: true }); }
  }
  // ตีบวก: m = { idx } (ของในกระเป๋า) หรือ { slot } (ของที่สวมอยู่)
  refine(client, p, b, m) {
    if (!this.nearNpc(p, "smith")) return "เดินเข้าใกล้ช่างตีบวกก่อน";
    const g = m.slot ? b.equip[String(m.slot)] : b.inv[Number(m.idx)];
    const it = g && I.ITEMS[g.id];
    if (!I.canRefine(it)) return "ไอเทมนี้ตีบวกไม่ได้";
    const to = (g.up || 0) + 1;
    if (to > I.MAX_REFINE) return `ตีบวกสูงสุดแล้ว (+${I.MAX_REFINE})`;
    const rule = I.REFINE[to], cost = I.refineGold(it, to);
    if (b.gold < cost) return "gold ไม่พอ";
    for (const [mid, n] of rule.mats) if (Bag.countOf(b, mid) < n) return `วัตถุดิบไม่พอ: ต้องใช้ ${I.ITEMS[mid].name} ×${n}`;
    // จ่าย gold + วัตถุดิบ (เสียทุกครั้งไม่ว่าสำเร็จหรือไม่)
    b.gold -= cost;
    for (const [mid, n] of rule.mats) {
      let need = n;
      for (let i = 0; i < b.inv.length && need > 0; i++) {
        const s = b.inv[i];
        if (s && s.id === mid) { const k = Math.min(need, s.n); Bag.removeAt(b, i, k); need -= k; }
      }
    }
    const ok = Math.random() < rule.rate;
    const before = g.up || 0;
    if (ok) g.up = to;
    else if (before > I.SAFE_REFINE) g.up = before - 1;
    client.send("refined", { ok, up: g.up, before, id: g.id, r: g.r || 0 });
    this.saveSoon(client.sessionId);
    if (ok && to >= 7) this.broadcast("system", `🔨 ${p.name} ตีบวก ${it.name} +${to} สำเร็จ!`);
  }
  nearNpc(p, id) {
    const n = this.npcs.find((x) => x.id === id);
    return n && dist(p, n) <= NPC_RANGE;
  }
  // ร้านที่ยืนอยู่ใกล้ (ระบุ npc มา = ต้องเป็นร้านนั้น) → คืน id ร้าน หรือ null
  nearShop(p, npc) {
    const ids = npc && I.SHOPS[npc] ? [npc] : Object.keys(I.SHOPS);
    return ids.find((id) => this.nearNpc(p, id)) || null;
  }
  buy(p, b, id, n, npc) {
    const shop = this.nearShop(p, npc);
    if (!shop) return "เดินเข้าใกล้ร้านค้าก่อน";
    const it = I.ITEMS[id];
    n = Math.max(1, Math.min(99, Math.floor(n)));
    if (!it || !I.SHOPS[shop].items.includes(id)) return "ร้านนี้ไม่มีของนี้";
    const cost = it.price * n;
    if (b.gold < cost) return "gold ไม่พอ";
    if (!Bag.canFit(b, id, n)) return "กระเป๋าเต็ม";
    b.gold -= cost;
    Bag.addItem(b, id, n);
    if (cost >= 500) this.saveSoon(p.sid);
  }
  // ซื้อหลายอย่างพร้อมกัน (ตะกร้าซื้อ): items = [{ id, n }] — ทำทั้งหมดหรือไม่ทำเลย
  buyMany(client, p, b, items, npc) {
    const shop = this.nearShop(p, npc);
    if (!shop) return "เดินเข้าใกล้ร้านค้าก่อน";
    if (!Array.isArray(items) || !items.length) return;
    const list = items.slice(0, 40).map((x) => ({ id: String(x.id), n: Math.max(1, Math.min(999, Math.floor(Number(x.n) || 1))) }));
    let cost = 0;
    for (const x of list) {
      if (!I.ITEMS[x.id] || !I.SHOPS[shop].items.includes(x.id)) return `${I.SHOPS[shop].title}ไม่มี ${I.ITEMS[x.id] ? I.ITEMS[x.id].name : "ของนี้"}`;
      cost += I.ITEMS[x.id].price * x.n;
    }
    if (b.gold < cost) return `gold ไม่พอ (ต้องใช้ ${cost.toLocaleString()})`;
    // ลองใส่ในกระเป๋าจำลองก่อน ถ้าไม่พอ = ไม่ซื้อเลย
    const test = { inv: b.inv.map((s) => (s ? { ...s } : null)), equip: {}, gold: 0 };
    for (const x of list) if (Bag.addItem(test, x.id, x.n) > 0) return "กระเป๋าไม่พอใส่ของทั้งหมด";
    b.gold -= cost;
    for (const x of list) Bag.addItem(b, x.id, x.n);
    client.send("toast", `ซื้อ ${list.length} รายการ · จ่าย ${cost.toLocaleString()} gold`);
    client.send("bought", { cost });
    if (cost >= 500) this.saveSoon(client.sessionId);
  }
  // ขายหลายอย่างพร้อมกัน (ตะกร้าขาย): items = [{ idx, id, n }] — ตรวจว่าช่องยังเป็นของเดิม
  sellMany(client, p, b, items) {
    if (!this.nearShop(p)) return "เดินเข้าใกล้ร้านค้าก่อน";
    if (!Array.isArray(items) || !items.length) return;
    const seen = new Set();
    const list = [];
    for (const x of items.slice(0, 60)) {
      const idx = Math.floor(Number(x.idx)), s = b.inv[idx];
      if (seen.has(idx) || !s || s.id !== String(x.id)) return "ของในกระเป๋าเปลี่ยนไป ลองใหม่อีกครั้ง";
      seen.add(idx);
      list.push({ idx, n: Math.max(1, Math.min(s.n, Math.floor(Number(x.n) || s.n))), price: I.sellPrice(s.id, s) });
    }
    let total = 0;
    for (const x of list) { Bag.removeAt(b, x.idx, x.n); total += x.price * x.n; }
    b.gold += total;
    client.send("toast", `ขาย ${list.length} รายการ · ได้ ${total.toLocaleString()} gold`);
    client.send("sold", { total });
    this.saveSoon(client.sessionId);
  }
  sell(p, b, idx, n) {
    if (!this.nearShop(p)) return "เดินเข้าใกล้ร้านค้าก่อน";
    const s = b.inv[idx];
    if (!s) return;
    n = Math.max(1, Math.min(s.n, Math.floor(n)));
    const price = I.sellPrice(s.id, s);
    Bag.removeAt(b, idx, n);
    b.gold += price * n;
    if (price * n >= 500) this.saveSoon(p.sid);
  }
  spawnDrop(item, n, x, y, owner, gear) {
    const id = "d" + this.drSeq++;
    const d = new Drop();
    d.item = item; d.n = n; d.r = gear ? gear.r : 0;
    const a = Math.random() * Math.PI * 2, rr = 8 + Math.random() * 18;
    d.x = x + Math.cos(a) * rr; d.y = y + Math.sin(a) * rr;
    if (!this.canStand(d.x, d.y)) { d.x = x; d.y = y; }
    this.state.drops.set(id, d);
    this.dr.set(id, { owner, until: now() + DROP_OWNER_MS, expire: now() + DROP_LIFE_MS, gear: gear || null });
    // ของระดับมหากาพย์ขึ้นไป → ประกาศให้ทุกคนรู้
    if (gear && gear.r >= 3) {
      const who = this.state.players.get(owner);
      this.broadcast("system", `✨ ${who ? who.name : "มีคน"}ได้รับ ${I.ITEMS[item].name} ระดับ${I.RARITY[gear.r].name}!`);
    }
  }
  // ตัวกรองการเก็บของ (AUTO เดินไปเก็บ + สัตว์เลี้ยงเก็บ) · คลิกเก็บเองได้ทุกชิ้นเสมอ
  wantLoot(r, d) {
    const pk = (r.autoCfg && r.autoCfg.pick) || {}, it = I.ITEMS[d.item];
    if (!it) return false;
    if (it.type === "equip") return (pk.equip ?? 0) >= 0 && (d.r || 0) >= (pk.equip ?? 0);
    if (it.type === "use") return pk.use !== false;
    if (/^stone_/.test(d.item)) return pk.stone !== false;
    if (it.type === "material") return pk.mat !== false;
    return true;
  }
  canPick(pid, did) {
    const info = this.dr.get(did);
    return info && (!info.owner || info.owner === pid || now() >= info.until || !this.state.players.get(info.owner));
  }
  tryPickup(pid, p, did) {
    const d = this.state.drops.get(did);
    if (!d) return true;
    const client = this.clients.find((c) => c.sessionId === pid);
    if (!this.canPick(pid, did)) {
      const left = Math.ceil((this.dr.get(did).until - now()) / 1000);
      if (client) client.send("toast", `ของคนอื่น — เก็บได้ในอีก ${left} วิ`);
      return true;
    }
    const left = Bag.addItem(p.bag, d.item, d.n, this.dr.get(did).gear);
    if (left === d.n) { if (client) client.send("toast", "กระเป๋าเต็ม"); return true; }
    if (client) client.send("loot", { item: d.item, n: d.n - left, r: d.r });
    if (d.r >= 2) this.saveSoon(pid);
    if (left > 0) d.n = left; else { this.state.drops.delete(did); this.dr.delete(did); }
    this.sendInv(pid);
    return true;
  }
  sweepDrops() {
    const t = now();
    this.dr.forEach((info, id) => { if (t >= info.expire) { this.state.drops.delete(id); this.dr.delete(id); } });
  }

  // ================= ระบบ AUTO =================
  setAuto(pid, on) {
    const p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || p.auto === on) return;
    p.auto = on;
    p.autoState = on ? "wait" : "";
    r.anchor = on ? { x: p.x, y: p.y } : null;
    if (on) { p.autoX = p.x; p.autoY = p.y; }
    r.resting = false; r.ignore = {};
    if (on) { r.moveTarget = null; r.dx = r.dy = 0; }
  }

  autoThink(pid, p, r) {
    const t = now();
    const off = r.autoCfg.skillOff || [];
    const skills = (D.JOB_SKILLS[p.job] || []).filter((k) => (p.skills || {})[k] > 0 && !off.includes(k));
    const healKey = [...skills].reverse().find((k) => D.SKILLS[k].auto === "heal");
    const healSk = healKey && D.skillAt(healKey, p.skills[healKey]);
    const reserve = healSk ? healSk.sp : 0;
    // ฮีลตัวเองเมื่อเลือดต่ำ: สกิลก่อน ไม่พร้อม → กินยา
    if (healSk && p.hp < p.maxHp * 0.45 && p.sp >= healSk.sp && t >= (r.cds[healKey] || 0))
      return this.castSkill(pid, p, r, healKey, null);
    // AUTO กินยาเมื่อ HP ต่ำกว่า % ที่ตั้งไว้ · คูลดาวน์ 10 วินาที (เฉพาะ AUTO กดให้)
    const potPct = (r.autoCfg.potionPct || AUTO_POTION_PCT) / 100;
    // เลือกยา: ระบุชนิดไว้ = ใช้ชนิดนั้นก่อน (หมดแล้วค่อยใช้ชนิดอื่น) · auto = ขวดที่ฟื้นได้ใกล้กับที่หายไปที่สุด (ไม่เปลืองขวดใหญ่)
    const drink = (field, miss, prefer) => {
      const pots = [...new Set(p.bag.inv.filter((s) => s && I.ITEMS[s.id].type === "use" && I.ITEMS[s.id].heal && I.ITEMS[s.id].heal[field]).map((s) => s.id))]
        .map((id) => [id, I.ITEMS[id].heal[field]]);
      if (!pots.length) return false;
      const fit = pots.filter(([, h]) => h <= miss * 1.2).sort((a, b) => b[1] - a[1]);
      let order = [...fit, ...pots.filter((x) => !fit.includes(x)).sort((a, b) => a[1] - b[1])].map(([id]) => id);
      if (prefer !== "auto" && order.includes(prefer)) order = [prefer, ...order.filter((x) => x !== prefer)];
      this.useItem(pid, p, p.bag, Bag.indexOf(p.bag, order[0])); this.sendInv(pid); r.autoPotionReady = t + AUTO_POTION_CD;
      return true;
    };
    if (t >= r.useReady && t >= (r.autoPotionReady || 0)) {
      if (p.hp < p.maxHp * potPct && r.autoCfg.potion !== false) drink("hp", p.maxHp - p.hp, r.autoCfg.hpPot || "auto");
      else if (r.autoCfg.spOn && p.sp < p.maxSp * (r.autoCfg.spPct || 30) / 100) drink("sp", p.maxSp - p.sp, r.autoCfg.spPot || "auto");
    }
    // เก็บของที่ดรอปใกล้ ๆ ก่อนหามอนตัวต่อไป
    let underAttack = false;
    this.mr.forEach((mr) => { if (mr.target === pid) underAttack = true; });
    // (ถ้ามีสัตว์เลี้ยงออกมา ให้สัตว์เลี้ยงเก็บแทน เราไม่ต้องเดินไปเอง)
    if (!r.target && !r.pick && !underAttack && r.autoCfg.loot !== false && !p.bag.pet) {
      let best = null, bd = 260;
      this.state.drops.forEach((d, did) => {
        if (!this.canPick(pid, did) || !Bag.canFit(p.bag, d.item, 1) || !this.wantLoot(r, d)) return;
        const dd = dist(p, d);
        if (dd < bd) { bd = dd; best = did; }
      });
      if (best) { r.pick = best; p.autoState = "loot"; return; }
    }
    // หาเป้าหมายใหม่ (ใกล้สุดก่อน):
    //  1) มอนที่กำลังตีเราอยู่ — ป้องกันตัวเสมอ
    //  2) มอนในขอบเขต AUTO ตามชนิดที่เลือกไว้ (ไม่ได้เลือก = เลเวลไม่เกินเรา +2) ที่ไม่ได้สู้กับคนอื่นอยู่
    // เลือดน้อยและยังฮีลไม่ได้ → พักรอเลือดฟื้นก่อนค่อยหามอนตัวต่อไป
    if (!r.target) {
      const healReady = !!healSk && t >= (r.cds[healKey] || 0) && p.sp >= healSk.sp;
      if (p.hp < p.maxHp * 0.4 && !healReady) r.resting = true;
      if (r.resting && (p.hp >= p.maxHp * 0.7 || healReady)) r.resting = false;
    }
    if (!r.target) {
      let best = null, bd = Infinity, attacker = false;
      this.state.monsters.forEach((m, mid) => {
        if (m.dead) return;
        const mr = this.mr.get(mid);
        const onMe = mr.target === pid;
        if (attacker && !onMe) return;
        if (!onMe) {
          if (r.resting) return;
          if (r.ignore && r.ignore[mid] > now()) return;
          // มอนอยู่ในวง หรือ "จุดเกิด" ของมอนอยู่ใกล้ขอบวง (มอนที่เกิดใหม่ตรงขอบวงจะถูกนับด้วย)
          const R = r.autoCfg.radius;
          if (dist(m, r.anchor) > R + 48 && dist(mr.home, r.anchor) > R + 96) return;
          // เลือกชนิดไว้ = ตีเฉพาะชนิดนั้น (นับเฉพาะชนิดที่มีในแมพนี้) · ไม่ได้เลือก = ตีทุกตัว
          const picked = r.autoCfg.kinds.filter((k) => this.mapKinds.has(k));
          if (picked.length && !picked.includes(m.kind)) return;
          if (mr.target && mr.target !== pid) return;
        }
        const d = dist(m, p);
        if ((onMe && !attacker) || d < bd) { bd = d; best = mid; attacker = attacker || onMe; }
      });
      if (best) { r.target = best; r.moveTarget = null; p.autoState = "fight"; }
      else {
        p.autoState = r.resting ? "rest" : "wait";
        // ไม่มีมอน → กลับจุดเดิมรอ (โหมดทั้งแมพ: ยืนรออยู่ที่เดิม)
        if (r.autoCfg.radius !== WHOLE_MAP && dist(p, r.anchor) > 40) r.moveTarget = { ...r.anchor };
      }
      return;
    }
    // ใช้สกิลของอาชีพเมื่อพร้อม (เหลือ SP ไว้ฮีลเสมอ): บัฟก่อน แล้วสกิลโจมตี (สกิลท้ายแถบ = แรงกว่า ใช้ก่อน)
    const mob = this.state.monsters.get(r.target);
    if (!mob || mob.dead || r.pending) return;
    const d = dist(p, mob);
    if (d > Math.max(p.range || MELEE_RANGE, 64) + 40) return; // ยังเดินไปไม่ถึง
    let mobsOnMe = 0;
    this.mr.forEach((mr, mid) => { const mm = this.state.monsters.get(mid); if (mr.target === pid && mm && !mm.dead) mobsOnMe++; });
    for (const k of [...skills].reverse()) {
      const sk = D.skillAt(k, p.skills[k]);
      if (t < (r.cds[k] || 0) || p.sp < sk.sp + (k === healKey ? 0 : reserve)) continue;
      if (sk.auto === "buff" || (sk.auto === "def" && p.hp < p.maxHp * 0.6) || (sk.auto === "pull" && mobsOnMe < 2 && this.mobsNear(p.x, p.y, sk.area).length >= 2)) {
        return this.castSkill(pid, p, r, k, null);
      }
      if (sk.auto === "dmg" && d <= (sk.range || MELEE_RANGE)) return this.castSkill(pid, p, r, k, r.target);
    }
  }

  // ================= สกิล =================
  useSkill(client, m) {
    const pid = client.sessionId, r = this.alive(client), p = this.state.players.get(pid);
    if (!r || !m) return;
    const key = String(m.skill);
    const L = (p.skills || {})[key] || 0;
    if (!D.SKILLS[key] || !(D.JOB_SKILLS[p.job] || []).includes(key)) return;
    if (!L) return client.send("toast", `ยังไม่ได้เรียน ${D.SKILLS[key].name} (เปิดหน้าต่างสกิล ปุ่ม K)`);
    const sk = D.skillAt(key, L);
    if (now() < (r.cds[key] || 0)) return client.send("toast", `${sk.name} ยังไม่พร้อม`);
    if (p.sp < sk.sp) return client.send("toast", "SP ไม่พอ");
    if (sk.target !== "mob") return this.castSkill(pid, p, r, key, null);
    const tid = m.target ? String(m.target) : r.target;
    const mob = tid && this.state.monsters.get(tid);
    if (!mob || mob.dead) return client.send("toast", "เลือกมอนสเตอร์เป้าหมายก่อน");
    // ไกลเกินระยะ → เดินเข้าไปก่อนแล้วใช้อัตโนมัติ
    r.target = tid; r.moveTarget = null; r.dx = r.dy = 0;
    if (dist(p, mob) > (sk.range || MELEE_RANGE)) { r.pending = key; return; }
    this.castSkill(pid, p, r, key, tid);
  }

  castSkill(pid, p, r, key, tid) {
    const L = (p.skills || {})[key] || 0;
    if (!L) return;
    const sk = D.skillAt(key, L), bv = sk.bv ? sk.bv(L) : null;
    if (p.sp < sk.sp || now() < (r.cds[key] || 0)) return;
    if (sk.hpCost && p.hp <= p.maxHp * sk.hpCost + 1) return;
    const mob = tid && this.state.monsters.get(tid);
    if (sk.target === "mob" && (!mob || mob.dead)) return;
    if (sk.target === "mob" && this.inSafe(p)) return;
    p.sp -= sk.sp;
    if (sk.hpCost) p.hp = Math.max(1, p.hp - Math.round(p.maxHp * sk.hpCost));
    const cd = Math.round(sk.cooldown * (1 - ((p.sx && p.sx.cdr) || 0) / 100));
    r.cds[key] = now() + cd;
    r.lastAct = now();
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("cd", { skill: key, until: cd });
    if (mob) p.dir = dirOf(mob.x - p.x, mob.y - p.y);
    const fx = { id: pid, skill: key, dir: p.dir, fx: sk.fx || null, wt: p.wt };
    if (mob) { fx.tgt = tid; fx.x = mob.x; fx.y = mob.y; }
    if (sk.area) fx.r = sk.area;
    const heal = (who, amt) => {
      amt = Math.round(amt * (1 + ((p.sx && p.sx.healPct) || 0) / 100));
      amt = Math.min(amt, who.maxHp - who.hp);
      who.hp += amt;
      this.state.players.forEach((pp, sid) => { if (pp === who) this.broadcast("heal", { id: sid, amount: amt }); });
    };
    if (sk.kind) { this.castSkill2(pid, p, r, key, sk, bv, L, mob, tid, fx, heal); r.atkReady = Math.max(r.atkReady, now() + Math.round(p.atkDelay * 0.6)); return; }
    switch (key) {
      case "firstaid":
        this.broadcast("cast", fx);
        heal(p, Math.max(5, Math.round(p.maxHp * sk.heal + p.int * 2)));
        break;
      case "heal": { // เพื่อน (หรือตัวเอง) ที่เลือดน้อยสุดในระยะ
        let best = p, bp = p.hp / p.maxHp;
        this.state.players.forEach((pp) => { if (!pp.dead && dist(pp, p) <= sk.range && pp.hp / pp.maxHp < bp) { best = pp; bp = pp.hp / pp.maxHp; } });
        this.state.players.forEach((pp, sid) => { if (pp === best) { fx.tgtPlayer = sid; fx.x = pp.x; fx.y = pp.y; } });
        this.broadcast("cast", fx);
        heal(best, Math.round((best.maxHp * sk.heal + (p.healBonus || 0) + p.level * 2) * (1 + ((p.pb && p.pb.healPct) || 0))));
        break;
      }
      case "doublehit":
        this.broadcast("skillfx", fx);
        this.hitMob(pid, p, tid, sk.mult);
        this.clock.setTimeout(() => { if (!p.dead) this.hitMob(pid, p, tid, sk.mult); }, 180);
        break;
      case "doubleshot":
        this.broadcast("skillfx", fx);
        this.clock.setTimeout(() => { if (!p.dead) this.hitMob(pid, p, tid, sk.mult); }, 560);
        this.clock.setTimeout(() => { if (!p.dead) this.broadcast("skillfx", fx); }, 560);
        this.clock.setTimeout(() => { if (!p.dead) this.hitMob(pid, p, tid, sk.mult); }, 1120);
        break;
      case "execute": {
        const combo = r.combo || 0; r.combo = 0;
        let mult = sk.mult * (1 + 0.15 * combo);
        if (mob.hp < mob.maxHp * 0.3) mult *= 1.5;
        fx.combo = combo;
        this.broadcast("skillfx", fx);
        this.hitMob(pid, p, tid, mult);
        break;
      }
      case "provoke":
        this.broadcast("cast", fx);
        for (const mid of this.mobsNear(p.x, p.y, sk.area)) { const mr = this.mr.get(mid); mr.target = pid; mr.returning = false; }
        this.addBuff(pid, sk.buff, bv);
        break;
      case "bless":
        this.broadcast("cast", fx);
        this.state.players.forEach((pp, sid) => { if (!pp.dead && dist(pp, p) <= sk.area) this.addBuff(sid, sk.buff, bv); });
        break;
      case "meteor": {
        this.broadcast("skillfx", fx);
        const cx = mob.x, cy = mob.y;
        this.clock.setTimeout(() => { if (!p.dead) for (const mid of this.mobsNear(cx, cy, sk.area)) this.hitMob(pid, p, mid, sk.mult); }, sk.delay);
        break;
      }
      default:
        if (sk.target === "self") { this.broadcast("cast", fx); if (sk.buff) this.addBuff(pid, sk.buff, bv); break; }
        this.broadcast("skillfx", fx);
        if (sk.area && !sk.splash) { // วงกว้างรอบเป้าหมาย
          const cx = mob.x, cy = mob.y;
          for (const mid of this.mobsNear(cx, cy, sk.area)) this.hitMob(pid, p, mid, sk.mult, { slow: sk.slow });
        } else {
          const res = this.hitMob(pid, p, tid, sk.mult, { undead: sk.undead, stun: sk.stun, slow: sk.slow });
          if (sk.splash && res && !res.miss) for (const mid of this.mobsNear(mob.x, mob.y, sk.area)) if (mid !== tid) this.hitMob(pid, p, mid, sk.mult * sk.splash);
        }
    }
    r.atkReady = Math.max(r.atkReady, now() + Math.round(p.atkDelay * 0.6));
  }

  // ================= สกิลอาชีพขั้น 2 (กลไกตาม kind ใน server/jobs2.js) =================
  breakStealth(pid) {
    const r = this.pr.get(pid), p = this.state.players.get(pid);
    if (r && r.buffs && r.buffs.stealth) { delete r.buffs.stealth; if (p) p.stealth = false; const c = this.clients.find((x) => x.sessionId === pid); if (c) c.send("buff", { key: "stealth", ms: 0 }); }
  }
  // ย้ายผู้เล่นไปจุดที่ยืนได้ใกล้ (x,y) ที่สุดตามแนวจาก p
  moveAlong(p, x, y) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
    for (let k = 1; k >= 0; k -= 0.1) { const nx = p.x + dx * k, ny = p.y + dy * k; if (this.canStand(nx, ny) && this.lineClear(p, { x: nx, y: ny })) { p.x = nx; p.y = ny; return true; } }
    return false;
  }
  castSkill2(pid, p, r, key, sk, bv, L, mob, tid, fx, heal) {
    const T = () => !p.dead && this.state.players.get(pid);
    const opts = { undead: sk.undead, stun: sk.stun, slow: sk.slow, crit: sk.crit, ignore: sk.ignore, drain: sk.drain, stealthMul: sk.stealthMul };
    const allies = (rad) => { const out = []; this.state.players.forEach((pp, sid) => { if (!pp.dead && dist(pp, p) <= rad) out.push(sid); }); return out; };
    const repeat = (n, every, fn) => { for (let i = 0; i < n; i++) this.clock.setTimeout(() => { if (T()) fn(i); }, i * every); };
    switch (sk.kind) {
      case "hit": {
        this.broadcast("skillfx", fx);
        repeat(sk.hits || 1, sk.every || 0, () => {
          const res = this.hitMob(pid, p, tid, sk.mult, opts);
          if (sk.splash && res && !res.miss && mob) for (const mid of this.mobsNear(mob.x, mob.y, sk.area)) if (mid !== tid) this.hitMob(pid, p, mid, sk.mult * sk.splash);
          if (sk.selfHeal && res && !res.miss) heal(p, Math.round(p.maxHp * sk.selfHeal));
          if (sk.spGain && res && !res.miss) p.sp = Math.min(p.maxSp, p.sp + sk.spGain);
        });
        break;
      }
      case "aoeTarget": {
        const cx = mob.x, cy = mob.y;
        this.broadcast("skillfx", fx);
        this.clock.setTimeout(() => repeat(sk.hits || 1, sk.every || 0, () => {
          if (sk.pull) this.mobsNear(cx, cy, sk.area).forEach((mid) => { const m = this.state.monsters.get(mid), mr = this.mr.get(mid); if (!m || mr.boss) return; const nx = m.x + (cx - m.x) * 0.45, ny = m.y + (cy - m.y) * 0.45; if (this.canStand(nx, ny)) { m.x = nx; m.y = ny; } });
          for (const mid of this.mobsNear(cx, cy, sk.area)) this.hitMob(pid, p, mid, sk.mult, opts);
          if (sk.hits > 1) this.broadcast("skillfx", { ...fx, again: true });
        }), sk.delay || 0);
        break;
      }
      case "aoeSelf":
        this.broadcast("skillfx", { ...fx, x: p.x, y: p.y, self: true });
        repeat(sk.hits || 1, sk.every || 0, () => { for (const mid of this.mobsNear(p.x, p.y, sk.area)) this.hitMob(pid, p, mid, sk.mult, opts); });
        break;
      case "chain": {
        const tgts = [tid], n = sk.chain + Math.floor(L / 4);
        let cur = mob;
        while (tgts.length < n) {
          let best = null, bd = 170;
          this.state.monsters.forEach((m, mid) => { if (m.dead || tgts.includes(mid)) return; const d = dist(m, cur); if (d < bd) { bd = d; best = mid; } });
          if (!best) break;
          tgts.push(best); cur = this.state.monsters.get(best);
        }
        fx.tgts = tgts;
        this.broadcast("skillfx", fx);
        tgts.forEach((mid, i) => this.clock.setTimeout(() => { if (T()) this.hitMob(pid, p, mid, sk.mult * (i ? 0.85 : 1), opts); }, 120 + i * 80));
        break;
      }
      case "leap": case "dash": {
        const a = Math.atan2(mob.y - p.y, mob.x - p.x), off = sk.kind === "dash" ? 40 : -26;
        this.moveAlong(p, mob.x + Math.cos(a) * off, mob.y + Math.sin(a) * off);
        r.moveTarget = null; r.nav = null; r.target = tid;
        fx.x = mob.x; fx.y = mob.y;
        this.broadcast("skillfx", fx);
        this.clock.setTimeout(() => { if (T()) for (const mid of this.mobsNear(mob.x, mob.y, sk.area)) this.hitMob(pid, p, mid, sk.mult, opts); }, 150);
        break;
      }
      case "blink": {
        const tgt = r.target && this.state.monsters.get(r.target);
        const dirV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir] || [0, 1];
        // มีมอนไล่อยู่ → วาร์ปหนีออกจากมอน · ไม่มี → วาร์ปไปทางที่หัน
        const away = tgt ? Math.atan2(p.y - tgt.y, p.x - tgt.x) : Math.atan2(dirV[1], dirV[0]);
        fx.x = p.x; fx.y = p.y;
        this.moveAlong(p, p.x + Math.cos(away) * sk.dist, p.y + Math.sin(away) * sk.dist);
        r.moveTarget = null; r.nav = null; r.target = null;
        this.mr.forEach((mr) => { if (mr.target === pid) { mr.target = null; mr.returning = true; } });
        this.broadcast("cast", fx);
        break;
      }
      case "buff":
        this.broadcast("cast", fx);
        this.addBuff(pid, sk.buff, bv);
        if (sk.buff === "stealth") { p.stealth = true; this.mr.forEach((mr) => { if (mr.target === pid) { mr.target = null; mr.returning = true; } }); r.target = null; }
        break;
      case "partyBuff":
        this.broadcast("cast", fx);
        for (const sid of allies(sk.area)) { this.addBuff(sid, sk.buff, bv); if (bv && bv.immune) { const rr = this.pr.get(sid); if (rr) rr.poison = null; } }
        break;
      case "taunt":
        this.broadcast("cast", fx);
        for (const mid of this.mobsNear(p.x, p.y, sk.area)) { const mr = this.mr.get(mid); if (mr.boss) continue; mr.target = pid; mr.returning = false; mr.stunUntil = now() + sk.stun; }
        break;
      case "debuff": {
        const c = sk.target === "mob" ? mob : p, dv = sk.dv(L);
        this.broadcast(sk.target === "mob" ? "skillfx" : "cast", fx);
        for (const mid of this.mobsNear(c.x, c.y, sk.area)) {
          const mr = this.mr.get(mid);
          if (sk.debuff === "weak") { mr.weakUntil = now() + dv.ms; mr.weakPct = dv.pct; }
          else { mr.doomUntil = now() + dv.ms; mr.doomPct = dv.pct; }
          if (!mr.target) { mr.target = pid; mr.returning = false; }
        }
        break;
      }
      case "summon":
        this.broadcast("cast", fx);
        r.summon = { ...sk.summon, mult: sk.mult, until: now() + sk.summon.ms, next: now() + 600 };
        this.broadcast("summon", { id: pid, kind: sk.summon.kind, ms: sk.summon.ms });
        break;
      case "massHeal":
        this.broadcast("cast", fx);
        for (const sid of allies(sk.area)) { const pp = this.state.players.get(sid); heal(pp, Math.round(pp.maxHp * sk.heal + p.int * 3)); }
        break;
      case "revive": {
        let best = null, bd = sk.area + 1;
        this.state.players.forEach((pp, sid) => { if (pp.dead && sid !== pid && !pp.warp) { const d = dist(pp, p); if (d < bd) { bd = d; best = sid; } } });
        if (!best) { p.sp += sk.sp; r.cds[key] = 0; const c = this.clients.find((x) => x.sessionId === pid); if (c) { c.send("toast", "ไม่มีใครล้มอยู่ใกล้ ๆ"); c.send("cd", { skill: key, until: 0 }); } return; }
        const pp = this.state.players.get(best), rr = this.pr.get(best);
        pp.dead = false; pp.hp = Math.max(1, Math.round(pp.maxHp * sk.heal)); rr.respawnPick = null; rr.safeUntil = now() + 2000;
        const c = this.clients.find((x) => x.sessionId === best); if (c) { c.send("respawned", { where: "revive" }); c.send("toast", `✨ ${p.name} ชุบชีวิตคุณ!`); }
        fx.tgtPlayer = best; fx.x = pp.x; fx.y = pp.y;
        this.broadcast("cast", fx);
        this.broadcast("spawnFx", { id: best, x: pp.x, y: pp.y });
        break;
      }
    }
  }
  // ตัวช่วยที่อัญเชิญ (เหยี่ยว / ภูตไฟ): ตีเป้าที่เราสู้อยู่ หรือมอนที่ตีเราอยู่
  updateSummon(pid, p, r, t) {
    const S = r.summon;
    if (!S) return;
    if (t > S.until || p.dead) { r.summon = null; return; }
    if (t < S.next) return;
    const okMob = (mid) => { const m = this.state.monsters.get(mid); return m && !m.dead && dist(p, m) <= S.range; };
    let tgt = r.target && okMob(r.target) ? r.target : null;
    if (!tgt) this.mr.forEach((mr, mid) => { if (!tgt && mr.target === pid && okMob(mid)) tgt = mid; });
    if (!tgt) return;
    S.next = t + S.every;
    this.broadcast("summonFx", { id: pid, kind: S.kind, tgt });
    const m0 = this.state.monsters.get(tgt);
    this.clock.setTimeout(() => {
      if (p.dead) return;
      this.hitMob(pid, p, tgt, S.mult, { spirit: true });
      if (S.splash && m0) for (const mid of this.mobsNear(m0.x, m0.y, S.splash)) if (mid !== tgt) this.hitMob(pid, p, mid, S.mult * 0.5, { spirit: true });
    }, 260);
  }

  // ================= เปลี่ยนอาชีพ =================
  // m.act: "start" (รับเควส m.job) · "cancel" · "finish" (ส่งเควส → เปลี่ยนอาชีพ)
  jobQuest(client, m) {
    const pid = client.sessionId, p = this.state.players.get(pid);
    if (!p || p.dead) return;
    if (!this.nearNpc(p, "jobmaster")) return client.send("toast", "เดินเข้าใกล้ครูฝึกอาชีพก่อน");
    const act = String(m.act || "");
    if (act === "cancel") { p.quest = null; client.send("quest", null); this.saveSoon(pid); return; }
    if (p.job !== "villager") return this.jobQuest2(client, p, act, m);
    if (p.level < D.JOB_CHANGE_LEVEL) return client.send("toast", `ต้องเลเวล ${D.JOB_CHANGE_LEVEL} ขึ้นไป`);
    if (act === "start") {
      const job = String(m.job);
      if (!D.JOB_QUESTS[job]) return;
      p.quest = { job, kills: 0 };
      client.send("quest", p.quest);
      client.send("toast", `รับบททดสอบ${D.JOBS[job].name}แล้ว`);
      this.saveSoon(pid);
      return;
    }
    if (act !== "finish" || !p.quest) return;
    const Q = D.JOB_QUESTS[p.quest.job], b = p.bag;
    if (p.quest.kills < Q.kill[1]) return client.send("toast", `ยังปราบ${D.MONSTERS[Q.kill[0]].name}ไม่ครบ (${p.quest.kills}/${Q.kill[1]})`);
    if (Bag.countOf(b, Q.item[0]) < Q.item[1]) return client.send("toast", `${I.ITEMS[Q.item[0]].name} ยังไม่ครบ (${Bag.countOf(b, Q.item[0])}/${Q.item[1]})`);
    if (!b.inv.some((x) => !x)) return client.send("toast", "กระเป๋าเต็ม — เว้นที่ว่างไว้รับอาวุธประจำอาชีพก่อน");
    // หักของ
    let need = Q.item[1];
    for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) {
      const s = b.inv[i];
      if (s && s.id === Q.item[0]) { const k = Math.min(need, s.n); Bag.removeAt(b, i, k); need -= k; }
    }
    const job = p.quest.job;
    p.job = job; p.jobName = D.JOBS[job].name; p.quest = null;
    // คืนแต้มสเตตัสทั้งหมด (รีเซ็ตฟรี 1 ครั้งตอนเปลี่ยนอาชีพ)
    const st = D.baseStats();
    for (const k of D.STAT_KEYS) p[k] = st[k];
    p.statPoints = D.totalPoints(p.level);
    p.skills = D.sanitizeSkills(p.skills, job, p.level); this.syncSkillPts(p);
    const stripped = Bag.stripInvalid(b, job);
    Bag.addItem(b, Q.reward, 1, I.makeGear(Q.reward, 0));
    p.gear = Bag.gearString(b);
    const r = this.pr.get(pid); r.cds = {}; r.buffs = {}; r.combo = 0;
    this.setAuto(pid, false);
    this.applyStats(p, true);
    this.sendInv(pid);
    client.send("quest", null);
    client.send("jobChanged", { job, reward: Q.reward, stripped });
    this.sendSkills(pid);
    this.broadcast("lvup", { id: pid, level: p.level, job: true });
    rooms.forEach((rm) => rm.broadcast("system", `🎉 ${p.name} เปลี่ยนอาชีพเป็น${p.jobName}แล้ว!`));
    this.save(pid);
  }

  // ================= เซเลส · ผู้หลอมชะตา: รีสเตตัส / รีคลาส (ครั้งละ 1M gold) =================
  // act "stat" = คืนแต้มสเตตัสทั้งหมด · act "class" = เปลี่ยนเป็นอาชีพอื่นขั้นเดียวกัน (คืนแต้มสเตตัส + แต้มสกิลทั้งหมด)
  rebirth(client, m) {
    const pid = client.sessionId, p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || p.dead) return;
    if (!this.nearNpc(p, "reclass")) return client.send("toast", "เดินเข้าใกล้เซเลส (ผู้หลอมชะตา) ก่อน");
    const b = p.bag, cost = D.REBIRTH_COST;
    if (b.gold < cost) return client.send("toast", `gold ไม่พอ (ต้องใช้ ${cost.toLocaleString()})`);
    const st = D.baseStats();
    if (m.act === "stat") {
      if (D.spentPoints(Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k]]))) === 0) return client.send("toast", "ยังไม่ได้ลงแต้มสเตตัสเลย");
      b.gold -= cost;
      for (const k of D.STAT_KEYS) p[k] = st[k];
      p.statPoints = D.totalPoints(p.level);
      this.applyStats(p, true);
      this.sendInv(pid);
      client.send("rebirthDone", { act: "stat" });
      client.send("toast", "✨ คืนแต้มสเตตัสทั้งหมดแล้ว — ลงใหม่ได้เลย");
      this.save(pid);
      return;
    }
    if (m.act !== "class") return;
    const job = String(m.job || ""), J = D.JOBS[job], cur = D.JOBS[p.job];
    if (!J || job === p.job) return;
    if (p.job === "villager" || job === "villager") return client.send("toast", "Novice ต้องเปลี่ยนอาชีพที่อัลดริค (ครูฝึกอาชีพ)");
    if ((J.tier || 1) !== (cur.tier || 1)) return client.send("toast", `เปลี่ยนได้เฉพาะอาชีพขั้นเดียวกัน (ขั้น ${cur.tier || 1})`);
    b.gold -= cost;
    p.job = job; p.jobName = J.name; p.quest = null;
    for (const k of D.STAT_KEYS) p[k] = st[k];
    p.statPoints = D.totalPoints(p.level);
    p.skills = D.innateSkills(); this.syncSkillPts(p);
    const stripped = Bag.stripInvalid(b, job);
    p.gear = Bag.gearString(b);
    r.cds = {}; r.buffs = {}; r.combo = 0; r.summon = null;
    this.setAuto(pid, false);
    this.applyStats(p, true);
    this.sendInv(pid);
    client.send("quest", null);
    client.send("jobChanged", { job, stripped, reclass: true });
    this.sendSkills(pid);
    client.send("rebirthDone", { act: "class", job });
    this.broadcast("lvup", { id: pid, level: p.level, job: true });
    rooms.forEach((rm) => rm.broadcast("system", `🔮 ${p.name} หลอมชะตาใหม่เป็น ${p.jobName}!`));
    this.save(pid);
  }

  // อาชีพขั้น 2: อาชีพขั้น 1 ที่ Lv.50 ขึ้นไป เลือกได้ 2 ทาง · ปราบมินิบอส + นำของมา + ค่าพิธี
  jobQuest2(client, p, act, m) {
    const pid = client.sessionId, J = D.JOBS[p.job];
    if (J.tier === 2) return client.send("toast", `คุณเป็น${p.jobName}แล้ว (อาชีพขั้นสุดท้าย)`);
    if (p.level < D.JOB2_LEVEL) return client.send("toast", `ต้องเลเวล ${D.JOB2_LEVEL} ขึ้นไป`);
    if (act === "start") {
      const job = String(m.job), Q = D.JOB2_QUESTS[job];
      if (!Q || D.JOBS[job].base !== p.job) return;
      p.quest = { job, kills: 0 };
      client.send("quest", p.quest);
      client.send("toast", `รับบททดสอบ${D.JOBS[job].name}แล้ว`);
      this.saveSoon(pid);
      return;
    }
    if (act !== "finish" || !p.quest || !D.JOB2_QUESTS[p.quest.job]) return;
    const Q = D.JOB2_QUESTS[p.quest.job], b = p.bag;
    if (p.quest.kills < 1) return client.send("toast", `ยังไม่ได้ปราบ${D.MINI_BOSSES[Q.mini].name}`);
    if (Bag.countOf(b, Q.item[0]) < Q.item[1]) return client.send("toast", `${I.ITEMS[Q.item[0]].name} ยังไม่ครบ (${Bag.countOf(b, Q.item[0])}/${Q.item[1]})`);
    if (b.gold < Q.gold) return client.send("toast", `gold ไม่พอ (ค่าพิธี ${Q.gold.toLocaleString()})`);
    let need = Q.item[1];
    for (let i = b.inv.length - 1; i >= 0 && need > 0; i--) { const s = b.inv[i]; if (s && s.id === Q.item[0]) { const k = Math.min(need, s.n); Bag.removeAt(b, i, k); need -= k; } }
    b.gold -= Q.gold;
    const job = p.quest.job;
    p.job = job; p.jobName = D.JOBS[job].name; p.quest = null;
    const st = D.baseStats();
    for (const k of D.STAT_KEYS) p[k] = st[k];
    p.statPoints = D.totalPoints(p.level);
    p.skills = D.sanitizeSkills(p.skills, job, p.level); this.syncSkillPts(p); // สกิลขั้น 1 ยังอยู่ครบ
    const r = this.pr.get(pid); r.cds = {}; r.buffs = {}; r.combo = 0;
    p.gear = Bag.gearString(b);
    this.setAuto(pid, false);
    this.applyStats(p, true);
    this.sendInv(pid);
    client.send("quest", null);
    client.send("jobChanged", { job, stripped: [] });
    this.sendSkills(pid);
    this.broadcast("lvup", { id: pid, level: p.level, job: true });
    rooms.forEach((rm) => rm.broadcast("system", `🌟 ${p.name} เลื่อนขั้นเป็น${p.jobName}แล้ว!`));
    this.save(pid);
  }

  // เกิดใหม่หลังตาย: where = "crystal" (คริสตัลใกล้จุดตายที่สุด · HP/SP 50%) หรือ "town" (กลับเมือง · HP เต็ม)
  respawnAt(id, p, r, where) {
    r.respawnPick = null;
    const cl = this.clients.find((c) => c.sessionId === id);
    if (where === "crystal" && this.crystals.length) {
      const c = this.crystals.reduce((a, b) => (dist(p, a) <= dist(p, b) ? a : b));
      p.x = c.x; p.y = this.canStand(c.x, c.y + 46) ? c.y + 46 : this.canStand(c.x, c.y + 26) ? c.y + 26 : c.y; p.dir = "down"; p.dead = false; r.poison = null;
      p.hp = Math.max(1, Math.floor(p.maxHp * 0.5)); p.sp = Math.max(p.sp, Math.floor(p.maxSp * 0.5));
      r.safeUntil = now() + RESPAWN_SAFE_MS; r.nav = null; r.moveTarget = null; r.target = null; r.pick = null;
      if (cl) cl.send("respawned", { where: "crystal", x: c.x, y: c.y });
      this.broadcast("spawnFx", { id, x: p.x, y: p.y });
      if (r.autoWas) { this.setAuto(id, true); r.autoWas = false; }
      return;
    }
    p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, Math.floor(p.maxSp / 2));
    if (cl) cl.send("respawned", { where: "town" });
    this.warpPlayer(id, W.START_MAP, null);
  }

  regen() {
    const t = now();
    // พิษบนมอน (อาบยาพิษ)
    this.mr.forEach((r, mid) => {
      if (!r.dots) return;
      const m = this.state.monsters.get(mid);
      for (const [pid, d] of Object.entries(r.dots)) {
        if (!m || m.dead || d.until < t) { delete r.dots[pid]; continue; }
        const dmg = Math.min(m.hp, d.dmg);
        m.hp -= dmg; r.dmgBy.set(pid, (r.dmgBy.get(pid) || 0) + dmg);
        this.broadcast("hit", { tgt: mid, mob: true, src: pid, dmg, poison: true });
        if (m.hp <= 0) { this.killMob(mid, m, r); break; }
      }
    });
    this.state.players.forEach((p, id) => {
      const r = this.pr.get(id);
      if (!r || p.dead) return;
      const md = this.mods(r);
      if (md.regen && p.hp < p.maxHp) { const a = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * md.regen)); p.hp += a; if (a >= 5) this.broadcast("heal", { id, amount: a }); }
      if (p.stealth !== md.stealth) p.stealth = md.stealth;
      // คลั่งเลือด (ติดตัว): HP ต่ำกว่า 50% → บัฟ
      const fz = (p.skills || {}).frenzy;
      if (fz && p.hp < p.maxHp * 0.5) r.buffs.frenzy = { until: t + 1500, v: D.SKILLS.frenzy.frenzy(fz) };
      // พิษจากมอน: เสียเลือดทุกวินาที (ไม่ทำให้ตาย)
      if (r.poison) {
        if (t > r.poison.until) r.poison = null;
        else if (p.hp > 1) { const d = Math.min(p.hp - 1, r.poison.dmg); p.hp -= d; r.lastHurt = t; this.broadcast("hit", { tgt: id, dmg: d, poison: true }); }
      }
      if (t - r.lastHurt > 6000 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.03 * (1 + ((p.sx && p.sx.hpRegen) || 0) / 100)));
      // SP ฟื้นช้าลงตอนสู้: กำลังสู้ (โดนตีหรือตี/ใช้สกิลใน 6 วิ) 0.6%/วิ · พักอยู่ 1.5%/วิ (+INT เล็กน้อย)
      if (p.sp < p.maxSp) {
        const fighting = t - r.lastHurt < 6000 || t - (r.lastAct || 0) < 6000;
        const rate = ((fighting ? 0.006 : 0.015) + p.int * 0.00005) * (1 + ((p.pb && p.pb.spRegen) || 0) + ((p.sx && p.sx.spRegen) || 0) / 100);
        r.spAcc = (r.spAcc || 0) + p.maxSp * rate;
        const add = Math.floor(r.spAcc);
        if (add > 0) { r.spAcc -= add; p.sp = Math.min(p.maxSp, p.sp + add); }
      }
    });
  }

  // ================= ช่วยเหลือ =================
  canStand(x, y) {
    return (
      isWalkable(this.map, x - BODY, y - 8) && isWalkable(this.map, x + BODY, y - 8) &&
      isWalkable(this.map, x - BODY, y + 2) && isWalkable(this.map, x + BODY, y + 2)
    );
  }

  // จุดเกิดของแผนที่นี้ (เมือง = กลางลาน · ทุ่ง = หน้าทางไปเมือง) สุ่มรอบ ๆ เล็กน้อย
  townSpawn() {
    const { tile } = this.map, sp = this.map.spawn;
    for (let i = 0; i < 200; i++) {
      const x = sp.x + rand(-0.5, 0.5) * tile * (this.def.type === "town" ? 8 : 4), y = sp.y + rand(-0.5, 0.5) * tile * 3;
      if (this.canStand(x, y)) return { x, y };
    }
    return { ...sp };
  }

  // ================= วาร์ปข้ามแผนที่ =================
  // บันทึกตำแหน่งปลายทาง แล้วบอก client ให้ย้ายไปห้องของแผนที่นั้น
  async warpPlayer(pid, toMap, pos) {
    const p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || p.warp || !W.MAPS[toMap]) return;
    const target = getMap(toMap);
    if (!pos) { const back = target.portals.find((pt) => pt.to === this.mapId); pos = back && toMap !== W.START_MAP ? { x: back.x, y: back.y } : target.spawn; }
    p.warp = { map: toMap, x: pos.x, y: pos.y };
    this.setAuto(pid, false);
    r.moveTarget = null; r.target = null; r.pick = null; r.nav = null; p.moving = false;
    this.save(pid); // บันทึกเบื้องหลัง (ไม่ต้องรอ)
    const ticket = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const a = r.auth || {};
    warpTickets.set(ticket, { charId: r.charId, user: a.user, char: { ...(a.char || {}), id: r.charId, name: p.name, ...this.toData(p) }, until: Date.now() + 60000 });
    for (const [k, v] of warpTickets) if (v.until < Date.now()) warpTickets.delete(k);
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("warp", { map: toMap, name: W.MAPS[toMap].name, ticket });
  }
  checkPortals(pid, p) {
    if (p.warp || p.dead) return;
    for (const pt of this.map.portals) {
      const b = pt.box;
      if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) {
        const back = getMap(pt.to).portals.find((q) => q.to === this.mapId);
        return this.warpPlayer(pid, pt.to, back ? { x: back.x, y: back.y } : null);
      }
    }
  }
}

module.exports = { WorldRoom };
// ตัวจับเวลา World Boss (ทำงานตลอด แม้ไม่มีห้องเปิดอยู่)
setInterval(() => { try { WorldRoom.bossTick(); } catch (e) { console.error("bossTick", e.message); } }, 15000).unref();
// เตรียมแผนที่ + คริสตัลทุกแผนที่ไว้ล่วงหน้า (เข้าแผนที่ครั้งแรกจะไม่ต้องรอสร้าง)
setTimeout(() => { for (const id of Object.keys(W.MAPS)) { try { getMap(id); mapCrystals(id); } catch (e) { console.error("prewarm", id, e.message); } } }, 500).unref();
// โหลดอีเวนต์ EXP ที่ค้างอยู่ (เผื่อเซิร์ฟเวอร์รีสตาร์ทระหว่างอีเวนต์)
store.getConfig && store.getConfig("expEvent").then((e) => { if (e && e.mult > 1 && (!e.endAt || e.endAt > Date.now())) WorldRoom.setExpEvent(e.mult, 0, { quiet: true, endAt: e.endAt || 0 }); }).catch(() => {});

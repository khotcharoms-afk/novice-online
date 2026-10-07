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

const SPEED = 170;           // ความเร็วเดินผู้เล่น (px/วินาที)
const TICK_MS = 50;          // อัปเดตโลก 20 ครั้ง/วินาที
const BODY = 9;              // ครึ่งความกว้างเท้า (เช็คชน)
const MELEE_RANGE = 44;      // ระยะตีใกล้
const MOB_ATK_MS = 1500;
const MOB_RANGE = 40;
const AGGRO_RADIUS = 150;
const LEASH = 420;           // มอนไล่ไกลเกินนี้จะกลับบ้าน
const RESPAWN_PLAYER_MS = 4000;
const WHOLE_MAP = 9999;              // ค่าพิเศษ = ตีได้ทั้งแมพ
const AUTO_RADII = [160, 360, 560, WHOLE_MAP]; // ขอบเขต AUTO: 5 / 11 / 17 ช่อง รอบจุดที่เปิด AUTO หรือทั้งแมพ
const AUTO_POTION_PCT = 35;    // ค่าเริ่มต้น: กินยาเมื่อ HP ต่ำกว่า 35%
const AUTO_POTION_CD = 10000;  // AUTO กินยาได้ทุก 10 วินาที

// ---------- ข้อมูลที่ซิงก์ไปให้ผู้เล่นทุกคน ----------
class Player extends Schema {}
defineTypes(Player, {
  name: "string", look: "string", job: "string", jobName: "string",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean", auto: "boolean", autoState: "string", autoX: "number", autoY: "number", autoR: "uint16",
  level: "uint16", exp: "uint32", expNext: "uint32",
  hp: "uint32", maxHp: "uint32", sp: "uint32", maxSp: "uint32",
  str: "uint16", agi: "uint16", vit: "uint16", int: "uint16", dex: "uint16", statPoints: "uint16",
  gear: "string", // ของที่สวมแล้วเห็นบนตัว (คั่นด้วย ,)
  skillPts: "uint16", // แต้มสกิลที่ยังไม่ได้ใช้
});
class Drop extends Schema {}
defineTypes(Drop, { item: "string", n: "uint16", x: "number", y: "number", r: "uint8" }); // r = ระดับความหายาก (อุปกรณ์)
class Monster extends Schema {}
defineTypes(Monster, {
  kind: "string", name: "string", level: "uint16", sprite: "string", tint: "uint32", scale: "number",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean",
  hp: "uint32", maxHp: "uint32",
});
// สัตว์เลี้ยง (key = sessionId ของเจ้าของ) — บินได้ จึงไม่ชนสิ่งกีดขวาง
class Pet extends Schema {}
defineTypes(Pet, { kind: "string", x: "number", y: "number", dir: "string", moving: "boolean" });
class WorldState extends Schema {
  constructor() { super(); this.players = new MapSchema(); this.monsters = new MapSchema(); this.drops = new MapSchema(); this.pets = new MapSchema(); }
}
defineTypes(WorldState, { players: { map: Player }, monsters: { map: Monster }, drops: { map: Drop }, pets: { map: Pet } });
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
// ปิดปรับปรุง: แอดมินตั้งเวลานับถอยหลัง → ครบเวลา = บันทึกทุกคน + ให้ออกจากเกม + ปิดไม่ให้เข้า (จนแอดมินเปิดหรือเซิร์ฟรีสตาร์ท)
const maint = { endAt: 0, msg: "", closed: false, timer: null };
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
    id, name: m.name, type: m.type, lv: m.lv, desc: m.desc, world: m.world, season: m.season,
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
      const user = await store.verify(options && options.token);
      if (maint.closed && !adminLogin(user)) throw new StoreError("เซิร์ฟเวอร์ปิดปรับปรุงชั่วคราว ลองใหม่อีกสักครู่");
      let char = await store.load(user.uid, options && options.charId);
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
    this.spawnMonsters();

    this.onMessage("getMap", (client) => {
      const me = this.state.players.get(client.sessionId);
      if (me) this.clock.setTimeout(() => {
        this.sendDerived(me); this.sendInv(client.sessionId);
        if (maint.endAt || maint.closed) client.send("maint", WorldRoom.maintInfo());
      }, 50);
      sendMap(client);
    });
    const sendMap = (client) =>
      client.send("map", { ...this.map, skills: SKILLS_CLIENT, jobSkills: D.JOB_SKILLS, skillTree: D.SKILL_TREE,
        statInfo: D.STAT_INFO, statKeys: D.STAT_KEYS, statMax: D.STAT_MAX,
        statCostStep: D.STAT_COST_STEP, items: I.ITEMS, stoneFuse: I.STONE_FUSE, rarity: I.RARITY, maxRefine: I.MAX_REFINE, safeRefine: I.SAFE_REFINE, shop: I.SHOP, shops: I.SHOPS, equipSlots: I.EQUIP_SLOTS, slotName: I.SLOT_NAME, invSize: I.INVENTORY_SIZE,
        npcs: this.npcs, online: online.size,
        jobs: D.JOBS, jobQuests: D.JOB_QUESTS, weaponTypes: D.WEAPON_TYPES, armorName: D.ARMOR_NAME, buffs: D.BUFFS,
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
      const radius = AUTO_RADII.includes(Number(c.radius)) ? Number(c.radius) : AUTO_RADII[1];
      const kinds = Array.isArray(c.kinds) ? c.kinds.filter((k) => D.MONSTERS[k]).slice(0, 10) : [];
      const pct = Math.round(Number(c.potionPct) / 5) * 5;
      r.autoCfg = { radius, kinds, loot: c.loot !== false, potion: c.potion !== false,
        potionPct: pct >= 10 && pct <= 90 ? pct : AUTO_POTION_PCT };
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
    this.onMessage("learnSkill", (client, m) => m && this.learnSkill(client, String(m.skill)));
    this.onMessage("chat", (client, text) => {
      const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
      if (!r || !p || typeof text !== "string") return;
      if (now() - r.lastChat < 700) return;
      r.lastChat = now();
      const clean = text.trim().slice(0, 100);
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
    return store.save(r.charId, this.toData(p)).catch((e) => console.error("save failed", r.charId, e.message));
  }
  // บันทึกเร็ว ๆ หลังเหตุการณ์สำคัญ (ได้ของหายาก ตีบวก ซื้อของแพง) — รวมหลายครั้งในเวลาใกล้กันเป็นครั้งเดียว
  saveSoon(pid) {
    const r = this.pr.get(pid);
    if (!r || r.saveTimer) return;
    r.saveTimer = this.clock.setTimeout(() => { r.saveTimer = null; this.save(pid); }, 1500);
  }
  onDispose() { rooms.delete(this); }
  // เซิร์ฟเวอร์กำลังปิด (เช่น Render อัปเดตเวอร์ชันใหม่) → แจ้งผู้เล่น · บันทึก · ตัดการเชื่อมต่อด้วยรหัส 4004
  async onBeforeShutdown() {
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
    p.quest = c.quest && D.JOB_QUESTS[c.quest.job] ? { job: c.quest.job, kills: Math.max(0, c.quest.kills | 0) } : null;
    p.dir = "down"; p.moving = false; p.dead = false; p.auto = false; p.autoState = "";
    p.autoX = 0; p.autoY = 0; p.autoR = AUTO_RADII[1];
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
      charId: c.id, uid: auth.user.uid, loginId: auth.user.loginId, admin: adminLogin(auth.user),
      moveTarget: null, dx: 0, dy: 0, target: null, pending: null, anchor: null,
      autoCfg: { radius: AUTO_RADII[1], kinds: [] },
      atkReady: 0, cds: {}, lastHurt: 0, deadUntil: 0, lastChat: 0, pick: null, useReady: 0, buffs: {}, combo: 0,
    });
    this.syncPet(client.sessionId);
    this.sendInv(client.sessionId);
    client.send("quest", p.quest);
    this.sendSkills(client.sessionId);
    if (!(options && options.warp)) this.broadcast("system", `${p.name} เข้าสู่เกม`); // ย้ายแผนที่ไม่ต้องประกาศ
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
  syncSkillPts(p) { p.skillPts = Math.max(0, D.skillPointsAt(p.level) - D.skillSpent(p.skills)); }
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
    room.applyCharData(p, data);
    p.gear = Bag.gearString(p.bag);
    if (!data.heal && Number.isFinite(data.hp)) { p.hp = Math.max(1, Math.min(p.maxHp, data.hp)); p.sp = Math.max(0, Math.min(p.maxSp, data.sp)); }
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
  static announce(text) { rooms.forEach((rm) => rm.broadcast("announce", text)); }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId), r = this.pr.get(client.sessionId);
    if (r && r.charId) {
      this.save(client.sessionId);
      const o = online.get(r.charId);
      if (o && o.room === this && o.sessionId === client.sessionId) online.delete(r.charId);
    }
    if (p && !p.warp) this.broadcast("system", `${p.name} ออกจากเกม`);
    this.state.players.delete(client.sessionId);
    this.state.pets.delete(client.sessionId);
    this.pr.delete(client.sessionId);
    this.mr.forEach((r) => { if (r.target === client.sessionId) r.target = null; r.dmgBy.delete(client.sessionId); });
  }

  alive(client) {
    const p = this.state.players.get(client.sessionId);
    return p && !p.dead ? this.pr.get(client.sessionId) : null;
  }

  applyStats(p, refill) {
    const bag = p.bag || Bag.emptyBag();
    const gb = Bag.gearBonus(bag, p.job);
    const eff = Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k] + (gb[k] || 0)]));
    const wt = Bag.weaponType(bag);
    p.wt = wt && !Bag.wearError(p.job, I.ITEMS[bag.equip.weapon.id]) ? wt : null;
    const s = D.playerStats(p.level, eff, p.job, p.wt);
    s.atk += gb.atk; s.def += gb.def; s.maxHp += gb.maxHp; s.maxSp += gb.maxSp;
    // สกิลติดตัว
    const pb = D.passiveBonus(p.skills || {}, p.job, p.wt);
    s.atk += pb.atk; s.def += pb.def; s.crit = Math.min(0.6, s.crit + pb.crit); s.hitBonus += pb.hit; s.range += pb.range;
    s.maxHp = Math.round(s.maxHp * (1 + pb.hpPct / 100)); s.maxSp = Math.round(s.maxSp * (1 + pb.spPct / 100));
    p.pb = pb;
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
    if (client) client.send("derived", { atk: p.atk, def: Math.round(p.def * 10) / 10, atkDelay: p.atkDelay,
      flee: p.flee, hitBonus: p.hitBonus, crit: p.crit, healBonus: p.healBonus, bonus: p.gearBonus || {},
      range: p.range, wt: p.wt, atkType: (D.WEAPON_TYPES[p.wt || "fist"] || {}).stat });
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
    for (const [kind, count] of this.def.spawns) {
      const def = D.MONSTERS[kind];
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

  respawnMob(id) {
    const m = this.state.monsters.get(id), r = this.mr.get(id);
    // จุดเกิดคงที่ของมอนแต่ละตัว → มอนเกิดใหม่ที่เดิม ความหนาแน่นในแต่ละโซนไม่เปลี่ยน
    if (!r.spawn) r.spawn = this.mobSpot();
    m.x = r.spawn.x; m.y = r.spawn.y; m.dir = "down"; m.moving = false; m.dead = false;
    m.maxHp = r.stats.maxHp; m.hp = m.maxHp;
    r.home = { ...r.spawn }; r.target = null; r.wander = null; r.returning = false; r.dmgBy.clear();
  }

  // จุดเกิดมอน: ที่เดินได้ ห่างทางเข้า/จุดเกิดผู้เล่นอย่างน้อย 9 ช่อง และไปถึงได้จากจุดเกิด
  mobSpot() {
    const { tile, width: MW, height: MH } = this.map;
    const safe = [this.map.spawn, ...this.map.portals];
    for (let i = 0; i < 800; i++) {
      const tx = 3 + Math.floor(Math.random() * (MW - 6)), ty = 3 + Math.floor(Math.random() * (MH - 6));
      const x = tx * tile + tile / 2, y = ty * tile + tile - 4;
      if (!this.canStand(x, y) || safe.some((q) => dist(q, { x, y }) < tile * 9)) continue;
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
          if (dist(p, d) > info.range || !this.canPick(pid, did) || !Bag.canFit(p.bag, d.item, 1)) return;
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
      if (t >= r.deadUntil) {
        // ตายนอกเมือง → ฟื้นที่เมือง (เหมือนกลับจุดเซฟ)
        if (this.mapId !== W.START_MAP && !p.warp) {
          p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, Math.floor(p.maxSp / 2));
          this.warpPlayer(id, W.START_MAP, null);
          return;
        }
        if (p.warp) return;
        const s = this.townSpawn();
        p.x = s.x; p.y = s.y; p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, Math.floor(p.maxSp / 2));
        p.dir = "down";
      }
      return;
    }
    if (p.warp) return; // กำลังย้ายแผนที่
    this.checkPortals(id, p);
    const step = (SPEED * this.mods(r).speed * dt) / 1000;
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
          if (p.job === "slayer" && res && !res.miss) r.combo = Math.min(5, (r.combo || 0) + 1);
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

  updateMob(m, r, id, dt, t) {
    if (m.dead) { if (t >= r.respawnAt) this.respawnMob(id); return; }
    if (r.stunUntil > t) { m.moving = false; return; } // มึนงง
    const step = (r.def.speed * (r.slowUntil > t ? 0.5 : 1) * dt) / 1000;

    // มอนดุ: มองหาผู้เล่นใกล้ ๆ
    if (!r.target && r.def.aggressive && !r.returning) {
      let best = null, bd = AGGRO_RADIUS;
      this.state.players.forEach((p, pid) => { if (!p.dead) { const d = dist(m, p); if (d < bd) { bd = d; best = pid; } } });
      if (best) r.target = best;
    }

    if (r.target) {
      const p = this.state.players.get(r.target);
      if (!p || p.dead || dist(m, r.home) > LEASH) { r.target = null; r.returning = true; }
      else {
        const d = dist(m, p);
        if (d > MOB_RANGE) { if (!this.navTo(m, r, p, step * 1.25, t)) { r.target = null; r.returning = true; } }
        else {
          m.moving = false; m.dir = dirOf(p.x - m.x, p.y - m.y);
          if (t >= r.atkReady) {
            r.atkReady = t + MOB_ATK_MS;
            this.broadcast("atk", { id, dir: m.dir, mob: true });
            this.hitPlayer(id, m, r, r.target);
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

  // ================= การต่อสู้ =================
  // a = ผู้ตี {atk, lv, crit?, hitBonus?}, d = ผู้โดน {def, lv, flee?}
  calcDamage(a, d, mult) {
    const missChance = Math.min(0.4, 0.05 + Math.max(0, d.lv - a.lv) * 0.03);
    if (Math.random() < Math.max(0, missChance - (a.hitBonus || 0))) return { dmg: 0, miss: true };
    if (d.flee && Math.random() < d.flee) return { dmg: 0, miss: true };
    const crit = Math.random() < (a.crit ?? 0.05);
    let dmg = a.atk * rand(0.9, 1.1) * mult - d.def * 0.5;
    if (crit) dmg *= 1.5;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  // ตัวคูณจากบัฟที่ยังไม่หมดเวลา
  mods(r) {
    const o = { atk: 1, def: 1, taken: 1, aspd: 1, speed: 1, flee: 0 };
    if (!r || !r.buffs) return o;
    const t = now();
    for (const [k, bf] of Object.entries(r.buffs)) {
      if (bf.until <= t) { delete r.buffs[k]; continue; }
      const b = { ...D.BUFFS[k], ...(bf.v || {}) };
      for (const f of ["atk", "def", "taken", "aspd", "speed"]) if (b[f]) o[f] *= b[f];
      if (b.flee) o.flee += b.flee;
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
    if (opts.undead && D.UNDEAD.includes(m.kind)) mult *= opts.undead;
    const res = this.calcDamage({ atk: p.atk * this.mods(pr).atk, lv: p.level, crit: p.crit, hitBonus: p.hitBonus },
      { def: r.stats.def, lv: m.level }, mult);
    this.broadcast("hit", { tgt: mid, mob: true, src: pid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return res;
    m.hp = Math.max(0, m.hp - res.dmg);
    r.dmgBy.set(pid, (r.dmgBy.get(pid) || 0) + res.dmg);
    if (!r.target) { r.target = pid; r.returning = false; }
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
    r.respawnAt = now() + D.MONSTER_RESPAWN_MS;
    r.target = null;
    // แบ่ง EXP ตามสัดส่วนดาเมจที่ทำ
    const total = [...r.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    r.dmgBy.forEach((dmg, pid) => this.gainExp(pid, Math.max(1, Math.round((r.stats.exp * dmg) / total))));
    // เควสเปลี่ยนอาชีพ: นับตัวที่ฆ่า (ทุกคนที่ช่วยตี)
    r.dmgBy.forEach((_d, pid) => {
      const pp = this.state.players.get(pid), q = pp && pp.quest, Q = q && D.JOB_QUESTS[q.job];
      if (!Q || Q.kill[0] !== m.kind || q.kills >= Q.kill[1]) return;
      q.kills++;
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl) { cl.send("quest", q); cl.send("toast", `เควส: ${m.name} ${q.kills}/${Q.kill[1]}`); }
    });
    // เงินแบ่งตามดาเมจ, ของดรอปตกพื้น (คนที่ทำดาเมจมากสุดมีสิทธิ์เก็บก่อน)
    const gold = I.goldDrop(m.level);
    let top = null, topDmg = -1;
    r.dmgBy.forEach((dmg, pid) => {
      if (dmg > topDmg) { topDmg = dmg; top = pid; }
      const pp = this.state.players.get(pid), g = Math.max(1, Math.round((gold * dmg) / total));
      if (pp && pp.bag) { pp.bag.gold += g; this.sendInv(pid, { goldGain: g, at: { x: m.x, y: m.y } }); }
    });
    for (const [id, chance, lo, hi] of I.DROPS[m.kind] || [])
      if (Math.random() < chance) this.spawnDrop(id, lo + Math.floor(Math.random() * (hi - lo + 1)), m.x, m.y, top, I.makeGear(id));
    r.dmgBy.clear();
    this.pr.forEach((pr) => { if (pr.target === mid) { pr.target = null; pr.pending = null; } });
  }

  hitPlayer(mid, m, r, pid) {
    const p = this.state.players.get(pid), pr = this.pr.get(pid);
    if (!p || p.dead || !pr) return;
    const md = this.mods(pr);
    const res = this.calcDamage({ atk: r.stats.atk, lv: m.level }, { def: p.def * md.def, lv: p.level, flee: p.flee + md.flee }, 1);
    if (!res.miss && md.taken !== 1) res.dmg = Math.max(1, Math.round(res.dmg * md.taken));
    this.broadcast("hit", { tgt: pid, src: mid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return;
    p.hp = Math.max(0, p.hp - res.dmg);
    pr.lastHurt = now();
    if (p.hp <= 0) {
      p.dead = true; p.moving = false; p.auto = false; p.autoState = "";
      pr.target = null; pr.pending = null; pr.moveTarget = null; pr.dx = pr.dy = 0; pr.buffs = {}; pr.combo = 0;
      pr.deadUntil = now() + RESPAWN_PLAYER_MS;
      this.mr.forEach((mr) => { if (mr.target === pid) { mr.target = null; mr.returning = true; } });
      const loss = Math.min(p.exp, Math.floor(p.expNext * 0.01));
      p.exp -= loss;
      this.broadcast("system", `${p.name} ถูก${m.name}ล้ม — จะฟื้นที่ลานกลางเมือง`);
      const cl = this.clients.find((c) => c.sessionId === pid);
      if (cl && loss > 0) cl.send("system", `เสีย EXP ${loss} (1%)`);
    }
  }

  gainExp(pid, amount) {
    const p = this.state.players.get(pid);
    if (!p || p.level >= D.MAX_LEVEL) return;
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("exp", amount);
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
    this.applyStats(p, false);
    this.sendInv(client.sessionId);
  }
  sendInv(pid, extra) {
    const p = this.state.players.get(pid), client = this.clients.find((c) => c.sessionId === pid);
    if (!p || !p.bag || !client) return;
    // แนบค่าที่คำนวณแล้วให้อุปกรณ์แต่ละชิ้น: st = ค่าพลังรวม, nx = ข้อมูลตีบวกขั้นถัดไป, sell = ราคาขาย
    const deco = (g) => {
      if (!g || !Bag.isGearId(g.id)) return g;
      const it = I.ITEMS[g.id], to = (g.up || 0) + 1, out = { ...g, st: I.gearStats(g), sell: I.sellPrice(g.id, g) };
      if (I.canRefine(it) && to <= I.MAX_REFINE)
        out.nx = { to, gold: I.refineGold(it, to), rate: I.REFINE[to].rate, mats: I.REFINE[to].mats, add: I.refineBonus(it, 1) };
      return out;
    };
    const data = Bag.saveBag(p.bag);
    data.inv = data.inv.map(deco);
    data.equip = Object.fromEntries(Object.entries(data.equip).map(([k, g]) => [k, deco(g)]));
    client.send("inv", { ...data, ...(extra || {}) });
  }
  useItem(pid, p, b, idx) {
    const s = b.inv[idx], it = s && I.ITEMS[s.id], r = this.pr.get(pid);
    if (!it) return;
    if (it.type === "equip") return Bag.equipFrom(b, idx, p.level, undefined, p.job);
    if (it.type === "pet") return Bag.summonPet(b, idx, p.level);
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
    const skills = (D.JOB_SKILLS[p.job] || []).filter((k) => (p.skills || {})[k] > 0);
    const healKey = [...skills].reverse().find((k) => D.SKILLS[k].auto === "heal");
    const healSk = healKey && D.skillAt(healKey, p.skills[healKey]);
    const reserve = healSk ? healSk.sp : 0;
    // ฮีลตัวเองเมื่อเลือดต่ำ: สกิลก่อน ไม่พร้อม → กินยา
    if (healSk && p.hp < p.maxHp * 0.45 && p.sp >= healSk.sp && t >= (r.cds[healKey] || 0))
      return this.castSkill(pid, p, r, healKey, null);
    // AUTO กินยาเมื่อ HP ต่ำกว่า % ที่ตั้งไว้ · คูลดาวน์ 10 วินาที (เฉพาะ AUTO กดให้)
    const potPct = (r.autoCfg.potionPct || AUTO_POTION_PCT) / 100;
    if (p.hp < p.maxHp * potPct && r.autoCfg.potion !== false && t >= r.useReady && t >= (r.autoPotionReady || 0)) {
      const miss = p.maxHp - p.hp;
      const order = miss > 120 ? ["potion_m", "potion_s"] : ["potion_s", "potion_m"];
      for (const id of order) {
        const idx = Bag.indexOf(p.bag, id);
        if (idx >= 0) { this.useItem(pid, p, p.bag, idx); this.sendInv(pid); r.autoPotionReady = t + AUTO_POTION_CD; break; }
      }
    }
    // เก็บของที่ดรอปใกล้ ๆ ก่อนหามอนตัวต่อไป
    let underAttack = false;
    this.mr.forEach((mr) => { if (mr.target === pid) underAttack = true; });
    // (ถ้ามีสัตว์เลี้ยงออกมา ให้สัตว์เลี้ยงเก็บแทน เราไม่ต้องเดินไปเอง)
    if (!r.target && !r.pick && !underAttack && r.autoCfg.loot !== false && !p.bag.pet) {
      let best = null, bd = 260;
      this.state.drops.forEach((d, did) => {
        if (!this.canPick(pid, did) || !Bag.canFit(p.bag, d.item, 1)) return;
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
          const picked = r.autoCfg.kinds;
          if (picked.length ? !picked.includes(m.kind) : m.level > p.level + 2) return;
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
    const mob = tid && this.state.monsters.get(tid);
    if (sk.target === "mob" && (!mob || mob.dead)) return;
    p.sp -= sk.sp;
    r.cds[key] = now() + sk.cooldown;
    r.lastAct = now();
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("cd", { skill: key, until: sk.cooldown });
    if (mob) p.dir = dirOf(mob.x - p.x, mob.y - p.y);
    const fx = { id: pid, skill: key, dir: p.dir, fx: sk.fx || null, wt: p.wt };
    if (mob) { fx.tgt = tid; fx.x = mob.x; fx.y = mob.y; }
    if (sk.area) fx.r = sk.area;
    const heal = (who, amt) => {
      amt = Math.min(amt, who.maxHp - who.hp);
      who.hp += amt;
      this.state.players.forEach((pp, sid) => { if (pp === who) this.broadcast("heal", { id: sid, amount: amt }); });
    };
    switch (key) {
      case "firstaid":
        this.broadcast("cast", fx);
        heal(p, Math.max(20, Math.round(p.maxHp * sk.heal) + (p.healBonus || 0)));
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

  // ================= เปลี่ยนอาชีพ =================
  // m.act: "start" (รับเควส m.job) · "cancel" · "finish" (ส่งเควส → เปลี่ยนอาชีพ)
  jobQuest(client, m) {
    const pid = client.sessionId, p = this.state.players.get(pid);
    if (!p || p.dead) return;
    if (!this.nearNpc(p, "jobmaster")) return client.send("toast", "เดินเข้าใกล้ครูฝึกอาชีพก่อน");
    const act = String(m.act || "");
    if (p.job !== "villager") return client.send("toast", `คุณเป็น${p.jobName}แล้ว`);
    if (act === "cancel") { p.quest = null; client.send("quest", null); this.saveSoon(pid); return; }
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

  regen() {
    const t = now();
    this.state.players.forEach((p, id) => {
      const r = this.pr.get(id);
      if (!r || p.dead) return;
      if (t - r.lastHurt > 6000 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.03));
      // SP ฟื้นช้าลงตอนสู้: กำลังสู้ (โดนตีหรือตี/ใช้สกิลใน 6 วิ) 0.6%/วิ · พักอยู่ 1.5%/วิ (+INT เล็กน้อย)
      if (p.sp < p.maxSp) {
        const fighting = t - r.lastHurt < 6000 || t - (r.lastAct || 0) < 6000;
        const rate = ((fighting ? 0.006 : 0.015) + p.int * 0.00005) * (1 + ((p.pb && p.pb.spRegen) || 0));
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
    await this.save(pid);
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("warp", { map: toMap, name: W.MAPS[toMap].name });
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

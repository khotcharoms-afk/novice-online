// =============================================================
//  ห้องโลกเกม — เซิร์ฟเวอร์เป็นตัวตัดสินทุกอย่าง (เดิน / ตี / ดาเมจ / EXP)
//  ผู้เล่นส่งมาแค่ "อยากทำอะไร" เช่น เดินไปตรงนี้ / ตีตัวนี้ / ใช้สกิลนี้
// =============================================================
const { Room, ServerError } = require("colyseus");
const { store, StoreError } = require("./store");
const { Schema, MapSchema, defineTypes } = require("@colyseus/schema");
const { generateMap, isWalkable } = require("./map");
const { NavGrid } = require("./path");
const D = require("./data");

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

// ---------- ข้อมูลที่ซิงก์ไปให้ผู้เล่นทุกคน ----------
class Player extends Schema {}
defineTypes(Player, {
  name: "string", look: "string", job: "string", jobName: "string",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean", auto: "boolean", autoState: "string", autoX: "number", autoY: "number", autoR: "uint16",
  level: "uint16", exp: "uint32", expNext: "uint32",
  hp: "uint32", maxHp: "uint32", sp: "uint32", maxSp: "uint32",
  str: "uint16", agi: "uint16", vit: "uint16", int: "uint16", dex: "uint16", statPoints: "uint16",
});
class Monster extends Schema {}
defineTypes(Monster, {
  kind: "string", name: "string", level: "uint16",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean",
  hp: "uint32", maxHp: "uint32",
});
class WorldState extends Schema {
  constructor() { super(); this.players = new MapSchema(); this.monsters = new MapSchema(); }
}
defineTypes(WorldState, { players: { map: Player }, monsters: { map: Monster } });

const now = () => Date.now();
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dirOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
const rand = (a, b) => a + Math.random() * (b - a);

const SAVE_EVERY_MS = 60000;
const online = new Map(); // charId -> { room, sessionId } (ตัวละครที่ออนไลน์อยู่)

class WorldRoom extends Room {
  static isOnline(charId) { return online.has(String(charId)); }

  // ตรวจตั๋วล็อกอิน + ความเป็นเจ้าของตัวละคร ก่อนให้เข้าห้อง
  async onAuth(client, options) {
    try {
      const user = await store.verify(options && options.token);
      let char = await store.load(user.uid, options && options.charId);
      const live = online.get(char.id);
      if (live) {
        // ตัวละครนี้ออนไลน์อยู่ในอีกหน้าต่าง → ใช้ข้อมูลล่าสุดจากในเกม แล้วเตะหน้าต่างเก่าออก
        const lp = live.room.state.players.get(live.sessionId);
        if (lp) char = { ...char, ...live.room.toData(lp) };
        const old = live.room.clients.find((c) => c.sessionId === live.sessionId);
        if (old) { old.send("system", "ตัวละครนี้ถูกเข้าเกมจากที่อื่น"); old.leave(4001); }
      }
      return { user, char };
    } catch (e) {
      if (!(e instanceof StoreError)) console.error("auth failed:", e.message);
      throw new ServerError(401, e instanceof StoreError ? e.message : "กรุณาล็อกอินใหม่");
    }
  }

  onCreate() {
    this.maxClients = 100;
    this.map = generateMap();
    const T = this.map.tile;
    this.nav = new NavGrid(this.map.width, this.map.height, T, (tx, ty) => this.canStand(tx * T + T / 2, ty * T + T / 2));
    this.setState(new WorldState());
    this.pr = new Map(); // ข้อมูลภายในของผู้เล่น (ไม่ส่งให้ client)
    this.mr = new Map(); // ข้อมูลภายในของมอนสเตอร์
    this.mobSeq = 0;
    this.spawnMonsters();

    this.onMessage("getMap", (client) => {
      const me = this.state.players.get(client.sessionId);
      if (me) this.clock.setTimeout(() => this.sendDerived(me), 50);
      sendMap(client);
    });
    const sendMap = (client) =>
      client.send("map", { ...this.map, skills: D.SKILLS, jobSkills: D.JOB_SKILLS,
        statInfo: D.STAT_INFO, statKeys: D.STAT_KEYS, statMax: D.STAT_MAX,
        mobs: Object.fromEntries(Object.entries(D.MONSTERS).map(([k, m]) => [k, { name: m.name, level: m.level }])) });

    this.onMessage("moveTo", (client, m) => {
      const r = this.alive(client); if (!r || !m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      r.moveTarget = { x: m.x, y: m.y }; r.dx = r.dy = 0; r.target = null; r.pending = null;
      this.setAuto(client.sessionId, false);
    });
    this.onMessage("dir", (client, m) => {
      const r = this.alive(client); if (!r || !m) return;
      r.dx = Math.sign(Number(m.dx) || 0); r.dy = Math.sign(Number(m.dy) || 0);
      if (r.dx || r.dy) { r.moveTarget = null; r.target = null; r.pending = null; this.setAuto(client.sessionId, false); }
    });
    this.onMessage("auto", (client, on) => { if (this.alive(client)) this.setAuto(client.sessionId, !!on); });
    // ตั้งค่า AUTO: ขอบเขต + ชนิดมอนที่จะตี (ว่าง = ตีทุกชนิดที่เลเวลไม่เกินเรา +2)
    this.onMessage("addStat", (client, m) => m && this.addStat(client.sessionId, String(m.stat), m.n));
    this.onMessage("recommendStats", (client) => this.recommendStats(client.sessionId));
    this.onMessage("autoCfg", (client, c) => {
      const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
      if (!r || !c) return;
      const radius = AUTO_RADII.includes(Number(c.radius)) ? Number(c.radius) : AUTO_RADII[1];
      const kinds = Array.isArray(c.kinds) ? c.kinds.filter((k) => D.MONSTERS[k]).slice(0, 10) : [];
      r.autoCfg = { radius, kinds };
      p.autoR = radius;
    });
    this.onMessage("attack", (client, m) => {
      const r = this.alive(client); if (!r || !m) return;
      const mob = this.state.monsters.get(String(m.id));
      if (!mob || mob.dead) return;
      r.target = String(m.id); r.moveTarget = null; r.dx = r.dy = 0;
    });
    this.onMessage("skill", (client, m) => this.useSkill(client, m));
    this.onMessage("chat", (client, text) => {
      const r = this.pr.get(client.sessionId), p = this.state.players.get(client.sessionId);
      if (!r || !p || typeof text !== "string") return;
      if (now() - r.lastChat < 700) return;
      r.lastChat = now();
      const clean = text.trim().slice(0, 100);
      if (clean) this.broadcast("chat", { id: client.sessionId, name: p.name, text: clean });
    });

    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);
    this.clock.setInterval(() => this.regen(), 1000);
    this.clock.setInterval(() => this.state.players.forEach((_p, id) => this.save(id)), SAVE_EVERY_MS);
  }

  // ================= บันทึกตัวละคร =================
  toData(p) {
    const dead = p.dead || p.hp <= 0;
    const spot = dead ? this.townSpawn() : p;
    return { level: p.level, exp: p.exp, hp: dead ? p.maxHp : p.hp, sp: p.sp,
      x: Math.round(spot.x), y: Math.round(spot.y), look: p.look, job: p.job,
      stats: Object.fromEntries(D.STAT_KEYS.map((k) => [k, p[k]])) };
  }
  save(pid) {
    const p = this.state.players.get(pid), r = this.pr.get(pid);
    if (!p || !r || !r.charId) return Promise.resolve();
    return store.save(r.charId, this.toData(p)).catch((e) => console.error("save failed", r.charId, e.message));
  }
  async onBeforeShutdown() {
    await Promise.all([...this.state.players.keys()].map((id) => this.save(id)));
    this.disconnect();
  }

  // ================= ผู้เล่นเข้า/ออก =================
  onJoin(client, options, auth) {
    const c = auth.char;
    const p = new Player();
    p.name = c.name;
    p.look = D.sanitizeLook(c.look);
    p.job = D.JOB_NAME[c.job] ? c.job : "villager"; p.jobName = D.JOB_NAME[p.job];
    p.dir = "down"; p.moving = false; p.dead = false; p.auto = false; p.autoState = "";
    p.autoX = 0; p.autoY = 0; p.autoR = AUTO_RADII[1];
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
    this.applyStats(p, true);
    if (Number.isFinite(c.hp)) p.hp = Math.max(1, Math.min(p.maxHp, c.hp));
    if (Number.isFinite(c.sp)) p.sp = Math.max(0, Math.min(p.maxSp, c.sp));
    const s = Number.isFinite(c.x) && this.canStand(c.x, c.y) ? { x: c.x, y: c.y } : this.townSpawn();
    p.x = s.x; p.y = s.y;
    this.state.players.set(client.sessionId, p);
    online.set(c.id, { room: this, sessionId: client.sessionId });
    this.pr.set(client.sessionId, {
      charId: c.id, uid: auth.user.uid,
      moveTarget: null, dx: 0, dy: 0, target: null, pending: null, anchor: null,
      autoCfg: { radius: AUTO_RADII[1], kinds: [] },
      atkReady: 0, cds: {}, lastHurt: 0, deadUntil: 0, lastChat: 0,
    });
    this.broadcast("system", `${p.name} เข้าสู่เกม`);
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId), r = this.pr.get(client.sessionId);
    if (r && r.charId) {
      this.save(client.sessionId);
      const o = online.get(r.charId);
      if (o && o.room === this && o.sessionId === client.sessionId) online.delete(r.charId);
    }
    if (p) this.broadcast("system", `${p.name} ออกจากเกม`);
    this.state.players.delete(client.sessionId);
    this.pr.delete(client.sessionId);
    this.mr.forEach((r) => { if (r.target === client.sessionId) r.target = null; r.dmgBy.delete(client.sessionId); });
  }

  alive(client) {
    const p = this.state.players.get(client.sessionId);
    return p && !p.dead ? this.pr.get(client.sessionId) : null;
  }

  applyStats(p, refill) {
    const s = D.playerStats(p.level, p);
    const dHp = s.maxHp - (p.maxHp || 0), dSp = s.maxSp - (p.maxSp || 0);
    p.maxHp = s.maxHp; p.maxSp = s.maxSp;
    if (refill) { p.hp = p.maxHp; p.sp = p.maxSp; }
    else { // ลงแต้ม VIT/INT แล้ว HP/SP ปัจจุบันเพิ่มตามด้วย
      p.hp = Math.max(1, Math.min(p.maxHp, p.hp + Math.max(0, dHp)));
      p.sp = Math.max(0, Math.min(p.maxSp, p.sp + Math.max(0, dSp)));
    }
    // ค่าเหล่านี้ใช้ในเซิร์ฟเวอร์เท่านั้น (ไม่ได้ประกาศใน schema จึงไม่ถูกส่งไป client)
    p.atk = s.atk; p.def = s.def; p.atkDelay = s.atkDelay; p.flee = s.flee;
    p.hitBonus = s.hitBonus; p.crit = s.crit; p.healBonus = s.healBonus;
    this.sendDerived(p);
  }
  // ส่งค่าที่คำนวณแล้ว (ATK DEF ความเร็วตี ฯลฯ) ให้เจ้าของตัวละครดูในหน้าสเตตัส
  sendDerived(p) {
    let id = null;
    this.state.players.forEach((pp, sid) => { if (pp === p) id = sid; });
    const client = id && this.clients.find((c) => c.sessionId === id);
    if (client) client.send("derived", { atk: p.atk, def: Math.round(p.def * 10) / 10, atkDelay: p.atkDelay,
      flee: p.flee, hitBonus: p.hitBonus, crit: p.crit, healBonus: p.healBonus });
  }

  // ================= ลงแต้มสเตตัส =================
  addStat(pid, stat, n) {
    const p = this.state.players.get(pid);
    if (!p || !D.STAT_KEYS.includes(stat)) return;
    n = Math.max(1, Math.min(Number(n) || 1, p.statPoints, D.STAT_MAX - p[stat]));
    if (!(n > 0)) return;
    p[stat] += n; p.statPoints -= n;
    this.applyStats(p, false);
  }
  recommendStats(pid) {
    const p = this.state.players.get(pid);
    if (!p || p.statPoints <= 0) return;
    const pts = p.statPoints;
    const keys = D.STAT_KEYS.filter((k) => D.RECOMMEND[k] > 0);
    for (const k of keys) {
      const n = Math.floor(pts * D.RECOMMEND[k]);
      const add = Math.min(n, D.STAT_MAX - p[k], p.statPoints);
      p[k] += add; p.statPoints -= add;
    }
    // เศษที่เหลือ → ตามลำดับความสำคัญ
    for (const k of keys.sort((a, b) => D.RECOMMEND[b] - D.RECOMMEND[a]))
      while (p.statPoints > 0 && p[k] < D.STAT_MAX) { p[k]++; p.statPoints--; }
    this.applyStats(p, false);
  }

  // ================= มอนสเตอร์ =================
  spawnMonsters() {
    for (const kind in D.MONSTERS) {
      const def = D.MONSTERS[kind];
      for (let i = 0; i < def.count; i++) {
        const id = "m" + this.mobSeq++;
        const m = new Monster();
        m.kind = kind; m.name = def.name; m.level = def.level;
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
    if (!r.spawn) r.spawn = this.ringSpot(r.def.ring);
    m.x = r.spawn.x; m.y = r.spawn.y; m.dir = "down"; m.moving = false; m.dead = false;
    m.maxHp = r.stats.maxHp; m.hp = m.maxHp;
    r.home = { ...r.spawn }; r.target = null; r.wander = null; r.returning = false; r.dmgBy.clear();
  }

  ringSpot([lo, hi]) {
    const { tile, width: W, height: H } = this.map;
    for (let i = 0; i < 500; i++) {
      const tx = Math.floor(Math.random() * W), ty = Math.floor(Math.random() * H);
      const d = Math.max(Math.abs(tx - W / 2) / (W / 2), Math.abs(ty - H / 2) / (H / 2));
      const x = tx * tile + tile / 2, y = ty * tile + tile - 4;
      if (d >= lo && d <= hi && this.canStand(x, y)) return { x, y };
    }
    return this.townSpawn();
  }

  // ================= ทุก tick =================
  update(dt) {
    const t = now();
    this.state.players.forEach((p, id) => this.updatePlayer(p, this.pr.get(id), id, dt, t));
    this.state.monsters.forEach((m, id) => this.updateMob(m, this.mr.get(id), id, dt, t));
  }

  updatePlayer(p, r, id, dt, t) {
    if (!r) return;
    if (p.dead) {
      if (t >= r.deadUntil) {
        const s = this.townSpawn();
        p.x = s.x; p.y = s.y; p.dead = false; p.hp = p.maxHp; p.sp = Math.max(p.sp, Math.floor(p.maxSp / 2));
        p.dir = "down";
      }
      return;
    }
    const step = (SPEED * dt) / 1000;
    if (p.auto) this.autoThink(id, p, r);

    // มีเป้าหมาย: เดินเข้าไปจนถึงระยะ แล้วตี
    if (r.target) {
      const mob = this.state.monsters.get(r.target);
      if (!mob || mob.dead) { r.target = null; r.pending = null; p.moving = false; return; }
      const range = r.pending ? D.SKILLS[r.pending].range || MELEE_RANGE : MELEE_RANGE;
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
        r.atkReady = t + p.atkDelay;
        this.broadcast("atk", { id, dir: p.dir });
        this.hitMob(id, p, r.target, 1);
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
    const step = (r.def.speed * dt) / 1000;

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

  hitMob(pid, p, mid, mult) {
    const m = this.state.monsters.get(mid), r = this.mr.get(mid);
    if (!m || m.dead) return;
    const res = this.calcDamage({ atk: p.atk, lv: p.level, crit: p.crit, hitBonus: p.hitBonus },
      { def: r.stats.def, lv: m.level }, mult);
    this.broadcast("hit", { tgt: mid, mob: true, src: pid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return;
    m.hp = Math.max(0, m.hp - res.dmg);
    r.dmgBy.set(pid, (r.dmgBy.get(pid) || 0) + res.dmg);
    if (!r.target) { r.target = pid; r.returning = false; }
    if (m.hp <= 0) this.killMob(mid, m, r);
  }

  killMob(mid, m, r) {
    m.dead = true; m.moving = false;
    r.respawnAt = now() + D.MONSTER_RESPAWN_MS;
    r.target = null;
    // แบ่ง EXP ตามสัดส่วนดาเมจที่ทำ
    const total = [...r.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    r.dmgBy.forEach((dmg, pid) => this.gainExp(pid, Math.max(1, Math.round((r.stats.exp * dmg) / total))));
    r.dmgBy.clear();
    this.pr.forEach((pr) => { if (pr.target === mid) { pr.target = null; pr.pending = null; } });
  }

  hitPlayer(mid, m, r, pid) {
    const p = this.state.players.get(pid), pr = this.pr.get(pid);
    if (!p || p.dead || !pr) return;
    const res = this.calcDamage({ atk: r.stats.atk, lv: m.level }, { def: p.def, lv: p.level, flee: p.flee }, 1);
    this.broadcast("hit", { tgt: pid, src: mid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return;
    p.hp = Math.max(0, p.hp - res.dmg);
    pr.lastHurt = now();
    if (p.hp <= 0) {
      p.dead = true; p.moving = false; p.auto = false; p.autoState = "";
      pr.target = null; pr.pending = null; pr.moveTarget = null; pr.dx = pr.dy = 0;
      pr.deadUntil = now() + RESPAWN_PLAYER_MS;
      this.mr.forEach((mr) => { if (mr.target === pid) { mr.target = null; mr.returning = true; } });
      this.broadcast("system", `${p.name} ถูก${m.name}ล้ม — จะฟื้นที่ลานกลางเมือง`);
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
      p.statPoints += D.POINTS_PER_LEVEL;
      p.expNext = D.expToNext(p.level);
      leveled = true;
    }
    if (p.level >= D.MAX_LEVEL) p.exp = 0;
    if (leveled) {
      this.applyStats(p, true);
      this.broadcast("lvup", { id: pid, level: p.level });
      this.save(pid);
      this.broadcast("system", `${p.name} เลเวลอัปเป็น Lv.${p.level}!`);
      if (p.level === D.JOB_CHANGE_LEVEL && client)
        client.send("system", `ถึงเลเวล ${D.JOB_CHANGE_LEVEL} แล้ว! เควสเปลี่ยนอาชีพจะเปิดในอัปเดตถัดไป`);
    }
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
    // ฮีลตัวเองเมื่อเลือดต่ำ
    if (p.hp < p.maxHp * 0.45 && p.sp >= D.SKILLS.firstaid.sp && t >= (r.cds.firstaid || 0))
      return this.castSkill(pid, p, r, "firstaid", null);
    // หาเป้าหมายใหม่ (ใกล้สุดก่อน):
    //  1) มอนที่กำลังตีเราอยู่ — ป้องกันตัวเสมอ
    //  2) มอนในขอบเขต AUTO ตามชนิดที่เลือกไว้ (ไม่ได้เลือก = เลเวลไม่เกินเรา +2) ที่ไม่ได้สู้กับคนอื่นอยู่
    // เลือดน้อยและยังฮีลไม่ได้ → พักรอเลือดฟื้นก่อนค่อยหามอนตัวต่อไป
    if (!r.target) {
      const healReady = t >= (r.cds.firstaid || 0) && p.sp >= D.SKILLS.firstaid.sp;
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
    // ใช้ฟันซ้ำเมื่อพร้อม (เหลือ SP ไว้ฮีลเสมอ)
    const mob = this.state.monsters.get(r.target);
    const dh = D.SKILLS.doublehit;
    if (mob && !mob.dead && !r.pending && t >= (r.cds.doublehit || 0) &&
        p.sp >= dh.sp + D.SKILLS.firstaid.sp && dist(p, mob) <= dh.range)
      this.castSkill(pid, p, r, "doublehit", r.target);
  }

  // ================= สกิล =================
  useSkill(client, m) {
    const pid = client.sessionId, r = this.alive(client), p = this.state.players.get(pid);
    if (!r || !m) return;
    const key = String(m.skill);
    const sk = D.SKILLS[key];
    if (!sk || !(D.JOB_SKILLS[p.job] || []).includes(key)) return;
    if (now() < (r.cds[key] || 0)) return client.send("toast", `${sk.name} ยังไม่พร้อม`);
    if (p.sp < sk.sp) return client.send("toast", "SP ไม่พอ");
    if (sk.target === "self") return this.castSkill(pid, p, r, key, null);
    const tid = m.target ? String(m.target) : r.target;
    const mob = tid && this.state.monsters.get(tid);
    if (!mob || mob.dead) return client.send("toast", "เลือกมอนสเตอร์เป้าหมายก่อน");
    // ไกลเกินระยะ → เดินเข้าไปก่อนแล้วใช้อัตโนมัติ
    r.target = tid; r.moveTarget = null; r.dx = r.dy = 0;
    if (dist(p, mob) > (sk.range || MELEE_RANGE)) { r.pending = key; return; }
    this.castSkill(pid, p, r, key, tid);
  }

  castSkill(pid, p, r, key, tid) {
    const sk = D.SKILLS[key];
    if (p.sp < sk.sp || now() < (r.cds[key] || 0)) return;
    p.sp -= sk.sp;
    r.cds[key] = now() + sk.cooldown;
    const client = this.clients.find((c) => c.sessionId === pid);
    if (client) client.send("cd", { skill: key, until: sk.cooldown });
    if (key === "firstaid") {
      const amt = Math.max(20, Math.round(p.maxHp * 0.25) + (p.healBonus || 0));
      p.hp = Math.min(p.maxHp, p.hp + amt);
      this.broadcast("cast", { id: pid, skill: key });
      this.broadcast("heal", { id: pid, amount: amt });
    } else if (key === "doublehit") {
      this.broadcast("skillfx", { id: pid, skill: key, dir: p.dir });
      this.hitMob(pid, p, tid, 0.95);
      this.clock.setTimeout(() => { if (!p.dead) this.hitMob(pid, p, tid, 0.95); }, 180);
      r.atkReady = now() + p.atkDelay;
    }
  }

  regen() {
    const t = now();
    this.state.players.forEach((p, id) => {
      const r = this.pr.get(id);
      if (!r || p.dead) return;
      if (t - r.lastHurt > 6000 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.03));
      if (p.sp < p.maxSp) p.sp = Math.min(p.maxSp, p.sp + Math.max(1, Math.round(p.maxSp * 0.03)));
    });
  }

  // ================= ช่วยเหลือ =================
  canStand(x, y) {
    return (
      isWalkable(this.map, x - BODY, y - 8) && isWalkable(this.map, x + BODY, y - 8) &&
      isWalkable(this.map, x - BODY, y + 2) && isWalkable(this.map, x + BODY, y + 2)
    );
  }

  townSpawn() {
    const { tile, width, height } = this.map;
    const cx = (width / 2) * tile, cy = (height / 2) * tile;
    for (let i = 0; i < 200; i++) {
      const x = cx + rand(-0.5, 0.5) * tile * 8, y = cy + rand(-0.5, 0.5) * tile * 6;
      if (this.canStand(x, y)) return { x, y };
    }
    return { x: cx, y: cy };
  }
}

module.exports = { WorldRoom };

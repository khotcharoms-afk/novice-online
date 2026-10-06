// =============================================================
//  ห้องโลกเกม — เซิร์ฟเวอร์เป็นตัวตัดสินทุกอย่าง (เดิน / ตี / ดาเมจ / EXP)
//  ผู้เล่นส่งมาแค่ "อยากทำอะไร" เช่น เดินไปตรงนี้ / ตีตัวนี้ / ใช้สกิลนี้
// =============================================================
const { Room } = require("colyseus");
const { Schema, MapSchema, defineTypes } = require("@colyseus/schema");
const { generateMap, isWalkable } = require("./map");
const D = require("./data");

const SPEED = 170;           // ความเร็วเดินผู้เล่น (px/วินาที)
const TICK_MS = 50;          // อัปเดตโลก 20 ครั้ง/วินาที
const BODY = 9;              // ครึ่งความกว้างเท้า (เช็คชน)
const MELEE_RANGE = 44;      // ระยะตีใกล้
const PLAYER_ATK_MS = 800;   // ตีทุก ๆ 0.8 วินาที
const MOB_ATK_MS = 1500;
const MOB_RANGE = 40;
const AGGRO_RADIUS = 150;
const LEASH = 420;           // มอนไล่ไกลเกินนี้จะกลับบ้าน
const RESPAWN_PLAYER_MS = 4000;

// ---------- ข้อมูลที่ซิงก์ไปให้ผู้เล่นทุกคน ----------
class Player extends Schema {}
defineTypes(Player, {
  name: "string", look: "string", job: "string", jobName: "string",
  x: "number", y: "number", dir: "string", moving: "boolean", dead: "boolean",
  level: "uint16", exp: "uint32", expNext: "uint32",
  hp: "uint32", maxHp: "uint32", sp: "uint32", maxSp: "uint32",
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

class WorldRoom extends Room {
  onCreate() {
    this.maxClients = 100;
    this.map = generateMap();
    this.setState(new WorldState());
    this.pr = new Map(); // ข้อมูลภายในของผู้เล่น (ไม่ส่งให้ client)
    this.mr = new Map(); // ข้อมูลภายในของมอนสเตอร์
    this.mobSeq = 0;
    this.spawnMonsters();

    this.onMessage("getMap", (client) =>
      client.send("map", { ...this.map, skills: D.SKILLS, jobSkills: D.JOB_SKILLS })
    );

    this.onMessage("moveTo", (client, m) => {
      const r = this.alive(client); if (!r || !m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      r.moveTarget = { x: m.x, y: m.y }; r.dx = r.dy = 0; r.target = null; r.pending = null;
    });
    this.onMessage("dir", (client, m) => {
      const r = this.alive(client); if (!r || !m) return;
      r.dx = Math.sign(Number(m.dx) || 0); r.dy = Math.sign(Number(m.dy) || 0);
      if (r.dx || r.dy) { r.moveTarget = null; r.target = null; r.pending = null; }
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
  }

  // ================= ผู้เล่นเข้า/ออก =================
  onJoin(client, options) {
    const p = new Player();
    p.name = sanitizeName(options && options.name) || "ชาวบ้าน" + Math.floor(Math.random() * 1000);
    p.look = D.sanitizeLook(options && options.look);
    p.job = "villager"; p.jobName = D.JOB_NAME.villager;
    p.dir = "down"; p.moving = false; p.dead = false;
    p.level = 1; p.exp = 0; p.expNext = D.expToNext(1);
    this.applyStats(p, true);
    const s = this.townSpawn(); p.x = s.x; p.y = s.y;
    this.state.players.set(client.sessionId, p);
    this.pr.set(client.sessionId, {
      moveTarget: null, dx: 0, dy: 0, target: null, pending: null,
      atkReady: 0, cds: {}, lastHurt: 0, deadUntil: 0, lastChat: 0,
    });
    this.broadcast("system", `${p.name} เข้าสู่เกม`);
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
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
    const s = D.playerStats(p.level);
    p.maxHp = s.maxHp; p.maxSp = s.maxSp;
    if (refill) { p.hp = p.maxHp; p.sp = p.maxSp; }
    p.atk = s.atk; p.def = s.def; // ไม่ซิงก์ (ไม่ได้ประกาศใน schema)
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
    const spot = this.ringSpot(r.def.ring);
    m.x = spot.x; m.y = spot.y; m.dir = "down"; m.moving = false; m.dead = false;
    m.maxHp = r.stats.maxHp; m.hp = m.maxHp;
    r.home = { ...spot }; r.target = null; r.wander = null; r.dmgBy.clear();
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

    // มีเป้าหมาย: เดินเข้าไปจนถึงระยะ แล้วตี
    if (r.target) {
      const mob = this.state.monsters.get(r.target);
      if (!mob || mob.dead) { r.target = null; r.pending = null; p.moving = false; return; }
      const range = r.pending ? D.SKILLS[r.pending].range || MELEE_RANGE : MELEE_RANGE;
      const d = dist(p, mob);
      if (d > range) { this.stepToward(p, mob, step); return; }
      p.moving = false;
      p.dir = dirOf(mob.x - p.x, mob.y - p.y);
      if (r.pending) { const sk = r.pending; r.pending = null; this.castSkill(id, p, r, sk, r.target); return; }
      if (t >= r.atkReady) {
        r.atkReady = t + PLAYER_ATK_MS;
        this.broadcast("atk", { id, dir: p.dir });
        this.hitMob(id, p, r.target, 1);
      }
      return;
    }

    let vx = 0, vy = 0;
    if (r.dx || r.dy) { vx = r.dx; vy = r.dy; }
    else if (r.moveTarget) {
      const d = dist(p, r.moveTarget);
      if (d < step) {
        if (this.canStand(r.moveTarget.x, r.moveTarget.y)) { p.x = r.moveTarget.x; p.y = r.moveTarget.y; }
        r.moveTarget = null;
      } else { vx = (r.moveTarget.x - p.x) / d; vy = (r.moveTarget.y - p.y) / d; }
    }
    if (!vx && !vy) { p.moving = false; return; }
    const moved = this.move(p, vx, vy, step);
    if (!moved) r.moveTarget = null;
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
        if (d > MOB_RANGE) { this.stepToward(m, p, step * 1.25); }
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
      else if (!this.stepToward(m, r.home, step * 1.5)) { m.x = r.home.x; m.y = r.home.y; }
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
  calcDamage(atk, atkLv, def, defLv, mult) {
    const missChance = Math.min(0.4, 0.05 + Math.max(0, defLv - atkLv) * 0.03);
    if (Math.random() < missChance) return { dmg: 0, miss: true };
    const crit = Math.random() < 0.05;
    let dmg = atk * rand(0.9, 1.1) * mult - def * 0.5;
    if (crit) dmg *= 1.5;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  }

  hitMob(pid, p, mid, mult) {
    const m = this.state.monsters.get(mid), r = this.mr.get(mid);
    if (!m || m.dead) return;
    const res = this.calcDamage(p.atk, p.level, r.stats.def, m.level, mult);
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
    const res = this.calcDamage(r.stats.atk, m.level, p.def, p.level, 1);
    this.broadcast("hit", { tgt: pid, src: mid, dmg: res.dmg, crit: !!res.crit, miss: !!res.miss });
    if (res.miss) return;
    p.hp = Math.max(0, p.hp - res.dmg);
    pr.lastHurt = now();
    if (p.hp <= 0) {
      p.dead = true; p.moving = false;
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
      p.expNext = D.expToNext(p.level);
      leveled = true;
    }
    if (p.level >= D.MAX_LEVEL) p.exp = 0;
    if (leveled) {
      this.applyStats(p, true);
      this.broadcast("lvup", { id: pid, level: p.level });
      this.broadcast("system", `${p.name} เลเวลอัปเป็น Lv.${p.level}!`);
      if (p.level === D.JOB_CHANGE_LEVEL && client)
        client.send("system", `ถึงเลเวล ${D.JOB_CHANGE_LEVEL} แล้ว! เควสเปลี่ยนอาชีพจะเปิดในอัปเดตถัดไป`);
    }
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
      const amt = Math.max(20, Math.round(p.maxHp * 0.25));
      p.hp = Math.min(p.maxHp, p.hp + amt);
      this.broadcast("cast", { id: pid, skill: key });
      this.broadcast("heal", { id: pid, amount: amt });
    } else if (key === "doublehit") {
      this.broadcast("skillfx", { id: pid, skill: key, dir: p.dir });
      this.hitMob(pid, p, tid, 0.95);
      this.clock.setTimeout(() => { if (!p.dead) this.hitMob(pid, p, tid, 0.95); }, 180);
      r.atkReady = now() + PLAYER_ATK_MS;
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

function sanitizeName(name) {
  if (typeof name !== "string") return "";
  return name.replace(/[<>]/g, "").trim().slice(0, 14);
}

module.exports = { WorldRoom };

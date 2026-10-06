// =============================================================
//  ห้องโลกเกม (1 ห้อง = 1 แผนที่)
//  ผู้เล่นส่งแค่ "อยากเดินไปไหน" → เซิร์ฟเวอร์คำนวณตำแหน่งจริงเอง
// =============================================================
const { Room } = require("colyseus");
const { Schema, MapSchema, defineTypes } = require("@colyseus/schema");
const { generateMap, isWalkable } = require("./map");

const SPEED = 170;        // พิกเซล/วินาที
const TICK_MS = 50;       // อัปเดตโลก 20 ครั้ง/วินาที
const BODY = 9;           // ครึ่งความกว้างเท้าตัวละคร (ใช้เช็คชน)
const LOOKS = ["novice", "swordsman", "ranger", "mage", "acolyte", "archer"];
const JOB_NAME = { novice: "Novice", swordsman: "Swordsman", ranger: "Thief", mage: "Mage", acolyte: "Acolyte", archer: "Archer" };

// ---------- ข้อมูลที่ซิงก์ไปให้ผู้เล่นทุกคนอัตโนมัติ ----------
class Player extends Schema {
  constructor() {
    super();
    this.name = "";
    this.x = 0;
    this.y = 0;
    this.look = "novice"; // ชุดตัวละคร
    this.job = "Novice";
    this.dir = "down";    // ทิศที่หันอยู่
    this.moving = false;
    this.level = 1;
    this.jobLevel = 1;
    this.hp = 40; this.maxHp = 40;
    this.sp = 11; this.maxSp = 11;
  }
}
defineTypes(Player, {
  name: "string", x: "number", y: "number",
  look: "string", job: "string", dir: "string", moving: "boolean",
  level: "uint16", jobLevel: "uint16",
  hp: "uint32", maxHp: "uint32", sp: "uint32", maxSp: "uint32",
});

class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(WorldState, { players: { map: Player } });

// ---------- ห้อง ----------
class WorldRoom extends Room {
  onCreate() {
    this.maxClients = 100;
    this.map = generateMap();
    this.setState(new WorldState());
    this.input = new Map(); // sessionId -> { target, dx, dy, lastChat }

    this.onMessage("getMap", (client) => client.send("map", this.map));

    // คลิกเดิน (แบบ RO)
    this.onMessage("moveTo", (client, msg) => {
      const inp = this.input.get(client.sessionId);
      if (!inp || !msg || !Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
      inp.target = { x: msg.x, y: msg.y };
      inp.dx = 0; inp.dy = 0;
    });

    // เดินด้วยคีย์บอร์ด (-1, 0, 1)
    this.onMessage("dir", (client, msg) => {
      const inp = this.input.get(client.sessionId);
      if (!inp || !msg) return;
      inp.dx = Math.sign(Number(msg.dx) || 0);
      inp.dy = Math.sign(Number(msg.dy) || 0);
      if (inp.dx || inp.dy) inp.target = null;
    });

    // แชท
    this.onMessage("chat", (client, text) => {
      const inp = this.input.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!inp || !p || typeof text !== "string") return;
      const now = Date.now();
      if (now - inp.lastChat < 700) return; // กันสแปม
      inp.lastChat = now;
      const clean = text.trim().slice(0, 100);
      if (clean) this.broadcast("chat", { id: client.sessionId, name: p.name, text: clean });
    });

    this.setSimulationInterval((dt) => this.update(dt), TICK_MS);
  }

  onJoin(client, options) {
    const p = new Player();
    p.name = sanitizeName(options && options.name) || "Novice" + Math.floor(Math.random() * 1000);
    p.look = LOOKS.includes(options && options.look) ? options.look : "novice";
    p.job = JOB_NAME[p.look];
    const spawn = this.randomSpawn();
    p.x = spawn.x; p.y = spawn.y;
    this.state.players.set(client.sessionId, p);
    this.input.set(client.sessionId, { target: null, dx: 0, dy: 0, lastChat: 0 });
    this.broadcast("system", `${p.name} เข้าสู่เกม`);
    console.log(`+ ${p.name} (${this.clients.length} online)`);
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId);
    if (p) this.broadcast("system", `${p.name} ออกจากเกม`);
    this.state.players.delete(client.sessionId);
    this.input.delete(client.sessionId);
  }

  update(dt) {
    const step = (SPEED * dt) / 1000;
    this.state.players.forEach((p, id) => {
      const inp = this.input.get(id);
      if (!inp) return;
      let vx = 0, vy = 0;

      if (inp.dx || inp.dy) {
        vx = inp.dx; vy = inp.dy;
      } else if (inp.target) {
        const ddx = inp.target.x - p.x, ddy = inp.target.y - p.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist < step) {
          if (this.canStand(inp.target.x, inp.target.y)) { p.x = inp.target.x; p.y = inp.target.y; }
          inp.target = null;
        } else { vx = ddx / dist; vy = ddy / dist; }
      }

      if (!vx && !vy) { p.moving = false; return; }

      const len = Math.hypot(vx, vy);
      vx = (vx / len) * step; vy = (vy / len) * step;

      // เลื่อนทีละแกน → ชนแล้วไถลไปตามกำแพงได้
      const ox = p.x, oy = p.y;
      if (this.canStand(p.x + vx, p.y)) p.x += vx;
      if (this.canStand(p.x, p.y + vy)) p.y += vy;

      const moved = p.x !== ox || p.y !== oy;
      if (!moved && inp.target) inp.target = null; // ติดสิ่งกีดขวาง → หยุด
      p.moving = moved;
      if (moved) p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? "right" : "left") : (vy > 0 ? "down" : "up");
    });
  }

  canStand(x, y) {
    return (
      isWalkable(this.map, x - BODY, y - 8) && isWalkable(this.map, x + BODY, y - 8) &&
      isWalkable(this.map, x - BODY, y + 2) && isWalkable(this.map, x + BODY, y + 2)
    );
  }

  randomSpawn() {
    const { tile, width, height } = this.map;
    const cx = (width / 2) * tile, cy = (height / 2) * tile;
    for (let i = 0; i < 200; i++) {
      const x = cx + (Math.random() - 0.5) * tile * 8;
      const y = cy + (Math.random() - 0.5) * tile * 6;
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

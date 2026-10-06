// =============================================================
//  สร้างแผนที่ "ทุ่งหญ้าเริ่มต้น" (seed เดิม = แผนที่เดิมทุกครั้ง)
//  ground: 0 = หญ้า, 1 = ดิน/ถนน, 2 = น้ำ
//  objects: ต้นไม้ หิน พุ่มไม้ ดอกไม้ (k = ชื่อภาพใน objects.json)
// =============================================================
const TILE = 32;

function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ชนิดสิ่งของ: block = ช่องที่เดินผ่านไม่ได้ (นับจากช่องฐาน)
const KINDS = {
  oak1: [[0, 0]], oak2: [[0, 0]], oak3: [[0, 0]],
  doak1: [[0, 0]], doak2: [[0, 0]], doak3: [[0, 0]],
  pine1: [[0, 0]], pine2: [[0, 0]], pine3: [[0, 0]], dead: [[0, 0]],
  rock_big: [[0, 0], [-1, 0]], brock_big: [[0, 0], [-1, 0]],
  rock_tall: [[0, 0]], rock_round: [[0, 0]], brock_round: [[0, 0]],
  rock_flat: [[0, 0]], brock_flat: [[0, 0]], rock_pair: [[0, 0]],
  bush1: [[0, 0]], bush2: [[0, 0]], bush3: [[0, 0]], bush4: [[0, 0]],
  cypress1: [[0, 0]], cypress2: [[0, 0]],
};
const TREES = ["oak1", "oak2", "oak3", "doak1", "doak2", "doak3", "pine1", "pine2", "pine3"];
const ROCKS = ["rock_big", "brock_big", "rock_tall", "rock_round", "brock_round", "rock_flat", "brock_flat", "rock_pair"];
const BUSHES = ["bush1", "bush2", "bush3", "bush4", "cypress1", "cypress2"];
const DECO = ["tuft1", "tuft2", "tuft3", "flower1", "flower2", "flower3", "flower4", "flower5", "flower6", "fern", "fern_big", "rock_s1", "rock_s2"];
const TINY = ["wf1", "wf2", "wf3", "wf4", "wf5"];

// สร้างแผนที่ตามข้อมูลใน maps.js (seed เดิม = แผนที่เดิมทุกครั้ง)
// คืนค่า portals: ทางออกที่ขอบ (trigger = ช่องที่เดินเข้าไปแล้ววาร์ป, arrive = จุดเกิดเมื่อเข้ามาจากขอบนั้น)
function generateMap(id = "town") {
  const { MAPS } = require("./maps");
  const def = MAPS[id] || MAPS.town;
  const st = def.style || {};
  const MAP_W = def.w, MAP_H = def.h;
  const rand = rng(def.seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const ground = new Array(MAP_W * MAP_H).fill(0);
  const blocked = new Array(MAP_W * MAP_H).fill(0);
  const reserved = new Array(MAP_W * MAP_H).fill(0); // ห้ามวางสิ่งกีดขวาง
  const objects = [];
  const idx = (x, y) => y * MAP_W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const fillRect = (arr, x0, y0, w, h, v) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inside(x, y)) arr[idx(x, y)] = v;
  };
  const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
  const area = (MAP_W * MAP_H) / (80 * 60); // เทียบกับแผนที่ขนาดเดิม

  // ---- ทางออก + ถนนจากทางออกเข้าหากลางแผนที่ ----
  const road = st.town ? 3 : 2;
  const portals = [];
  for (const [edge, to] of Object.entries(def.exits)) {
    let tx, ty, ax, ay;
    if (edge === "N") { tx = cx; ty = 0; ax = cx; ay = 5; }
    if (edge === "S") { tx = cx; ty = MAP_H - 1; ax = cx; ay = MAP_H - 6; }
    if (edge === "W") { tx = 0; ty = cy; ax = 5; ay = cy; }
    if (edge === "E") { tx = MAP_W - 1; ty = cy; ax = MAP_W - 6; ay = cy; }
    // ถนนตรงจากขอบเข้ากลาง
    if (edge === "N" || edge === "S") fillRect(ground, cx - 1, Math.min(ty, cy), road, Math.abs(cy - ty) + 1, 1);
    else fillRect(ground, Math.min(tx, cx), cy - 1, Math.abs(cx - tx) + 1, road, 1);
    portals.push({ edge, to, tx, ty, x: ax * TILE + TILE / 2, y: ay * TILE + TILE / 2,
      // กล่องเหยียบวาร์ป (พิกเซล) — 2 ช่องติดขอบ กว้าง 3 ช่อง
      box: edge === "N" || edge === "S"
        ? { x0: (cx - 1) * TILE, x1: (cx + 2) * TILE, y0: (edge === "N" ? 0 : MAP_H - 2) * TILE, y1: (edge === "N" ? 2 : MAP_H) * TILE }
        : { x0: (edge === "W" ? 0 : MAP_W - 2) * TILE, x1: (edge === "W" ? 2 : MAP_W) * TILE, y0: (cy - 1) * TILE, y1: (cy + 2) * TILE } });
  }
  if (st.town) {
    fillRect(ground, cx - 10, cy - 7, 21, 15, 1); // ลานกลางเมือง
  } else {
    fillRect(ground, cx - 3, cy - 2, 7, 5, 1);
    // ทางแยกสุ่ม
    for (let i = 0; i < 2 + Math.floor(area * 2); i++) {
      const horiz = rand() < 0.5, len = 8 + Math.floor(rand() * 14);
      const x0 = 6 + Math.floor(rand() * (MAP_W - 12 - (horiz ? len : 0))), y0 = 6 + Math.floor(rand() * (MAP_H - 12 - (horiz ? 0 : len)));
      if (horiz) fillRect(ground, x0, y0, len, 2, 1); else fillRect(ground, x0, y0, 2, len, 1);
    }
    for (let i = 0; i < (st.dirt || 0); i++) { // พื้นดินเป็นหย่อม ๆ (แผนที่แห้งแล้ง)
      const w = 3 + Math.floor(rand() * 6), h = 3 + Math.floor(rand() * 5);
      fillRect(ground, 4 + Math.floor(rand() * (MAP_W - 12)), 4 + Math.floor(rand() * (MAP_H - 12)), w, h, 1);
    }
  }
  for (let i = 0; i < ground.length; i++) if (ground[i] === 1) reserved[i] = 1;
  fillRect(reserved, cx - (st.town ? 12 : 5), cy - (st.town ? 9 : 4), st.town ? 25 : 11, st.town ? 19 : 9, 1);
  for (const p of portals) fillRect(reserved, Math.floor(p.x / TILE) - 3, Math.floor(p.y / TILE) - 3, 7, 7, 1);

  // ---- บ่อน้ำ ----
  let ponds = 0;
  const pondMax = st.ponds ?? (st.town ? 2 : 5);
  for (let tries = 0; tries < 400 && ponds < pondMax; tries++) {
    const w = 4 + Math.floor(rand() * 5), h = 3 + Math.floor(rand() * 4);
    const x0 = 5 + Math.floor(rand() * (MAP_W - w - 10));
    const y0 = 5 + Math.floor(rand() * (MAP_H - h - 10));
    let ok = true;
    for (let y = y0 - 2; y < y0 + h + 2 && ok; y++)
      for (let x = x0 - 2; x < x0 + w + 2 && ok; x++)
        if (!inside(x, y) || reserved[idx(x, y)] || ground[idx(x, y)] !== 0) ok = false;
    if (!ok) continue;
    fillRect(ground, x0, y0, w, h, 2);
    fillRect(blocked, x0, y0, w, h, 1);
    fillRect(reserved, x0 - 1, y0 - 1, w + 2, h + 2, 1);
    ponds++;
  }

  // วางสิ่งของ (ช่องฐาน tx,ty) ถ้าว่าง
  const place = (k, tx, ty, jitter = 6) => {
    const cells = KINDS[k] || [];
    for (const [dx, dy] of cells) {
      const x = tx + dx, y = ty + dy;
      if (!inside(x, y) || blocked[idx(x, y)] || reserved[idx(x, y)] || ground[idx(x, y)] !== 0) return false;
    }
    for (const [dx, dy] of cells) blocked[idx(tx + dx, ty + dy)] = 1;
    objects.push({
      k,
      x: Math.round(tx * TILE + TILE / 2 + (rand() - 0.5) * jitter),
      y: Math.round(ty * TILE + TILE - 4 + (rand() - 0.5) * (cells.length ? 2 : jitter)),
      b: cells.length ? 1 : 0,
    });
    return true;
  };

  // ---- ป่ารอบขอบแผนที่ (หนา 3 แถว) — เว้นช่องทางออก ----
  const gap = (x, y) => portals.some((p) => (p.edge === "N" || p.edge === "S") ? Math.abs(x - cx) <= 1 && Math.abs(y - p.ty) <= 3
    : Math.abs(y - cy) <= 1 && Math.abs(x - p.tx) <= 3);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge >= 3 || gap(x, y)) continue;
      if (edge === 0 || (x + y * 2) % 2 === 0 || rand() < 0.5) place(pick(TREES), x, y, 10);
      blocked[idx(x, y)] = 1; // ขอบเดินออกไม่ได้
    }

  // ---- กลุ่มป่าในแผนที่ ----
  const clusters = Math.round((st.forest ?? (st.town ? 10 : 55)) * area);
  for (let c = 0; c < clusters; c++) {
    const gx = 4 + Math.floor(rand() * (MAP_W - 8)), gy = 4 + Math.floor(rand() * (MAP_H - 8));
    const n = 5 + Math.floor(rand() * 9);
    const r = rand(), pines = st.pines ?? 0.4;
    const family = r < pines ? ["pine1", "pine2", "pine3"] : rand() < 0.5 ? ["oak1", "oak2", "oak3"] : ["doak1", "doak2", "doak3"];
    for (let i = 0; i < n; i++)
      place(pick(family), gx + Math.floor(rand() * 7) - 3, gy + Math.floor(rand() * 5) - 2, 12);
  }
  for (let i = 0; i < (st.dead ?? 4); i++) place("dead", 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)));

  // ---- หิน & พุ่มไม้ ----
  for (let i = 0; i < Math.round((st.rocks ?? 40) * area); i++) place(pick(ROCKS), 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)));
  for (let i = 0; i < Math.round((st.bushes ?? 60) * area); i++) place(pick(BUSHES), 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)), 8);

  // ---- ของตกแต่ง (เดินทับได้) ----
  const decoAt = (k, x, y) => objects.push({ k, x: Math.round(x), y: Math.round(y), b: 0 });
  for (let i = 0; i < 260 * area; i++) {
    const tx = 3 + Math.floor(rand() * (MAP_W - 6)), ty = 3 + Math.floor(rand() * (MAP_H - 6));
    if (ground[idx(tx, ty)] !== 0 || blocked[idx(tx, ty)]) continue;
    decoAt(pick(DECO), tx * TILE + rand() * TILE, ty * TILE + 8 + rand() * 24);
  }
  for (let i = 0; i < 700 * area; i++) {
    const tx = 3 + Math.floor(rand() * (MAP_W - 6)), ty = 3 + Math.floor(rand() * (MAP_H - 6));
    if (ground[idx(tx, ty)] !== 0) continue;
    decoAt(pick(TINY), tx * TILE + rand() * TILE, ty * TILE + rand() * TILE);
  }
  // กกริมน้ำ
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++)
      if (ground[idx(x, y)] === 0 && ground[idx(x, y - 1)] === 2 && rand() < 0.35)
        decoAt(rand() < 0.5 ? "reed1" : "reed2", x * TILE + 8 + rand() * 16, y * TILE + 14);

  // ---- ตกแต่งเมือง: น้ำพุกลางลาน + ต้นไซเปรสรอบลาน + แปลงดอกไม้ ----
  if (st.town) {
    fillRect(ground, cx - 2, cy - 1, 5, 3, 2);
    fillRect(blocked, cx - 2, cy - 1, 5, 3, 1);
    const deco = (k, tx, ty, block) => {
      objects.push({ k, x: tx * TILE + TILE / 2, y: ty * TILE + TILE - 4, b: block ? 1 : 0 });
      if (block) blocked[idx(tx, ty)] = 1;
    };
    for (const [dx, dy] of [[-9, -6], [9, -6], [-9, 6], [9, 6], [-5, -6], [5, -6], [-5, 6], [5, 6]]) deco(dx % 2 ? "cypress1" : "cypress2", cx + dx, cy + dy, true);
    for (let i = -3; i <= 3; i++) {
      decoAt(pick(["flower1", "flower2", "flower3", "flower4"]), (cx + i) * TILE + 16, (cy - 2) * TILE + 30);
      decoAt(pick(["flower1", "flower2", "flower5", "flower6"]), (cx + i) * TILE + 16, (cy + 3) * TILE + 6);
    }
    for (const [dx, dy] of [[-3, -1], [3, -1], [-3, 1], [3, 1]]) decoAt(pick(["bush1", "bush2"]), (cx + dx) * TILE + 16, (cy + dy) * TILE + 30);
  }

  objects.sort((a, b) => a.y - b.y);
  // จุดเกิด: เมือง = กลางลาน · ทุ่ง = หน้าทางออกที่ไปเมือง (หรือทางออกแรก)
  const home = portals.find((p) => p.to === "town") || portals[0];
  const spawn = st.town || !home ? { x: cx * TILE + TILE / 2, y: (cy + 4) * TILE + 16 } : { x: home.x, y: home.y };
  return { id, tile: TILE, width: MAP_W, height: MAP_H, ground, blocked, objects, portals, spawn,
    name: def.name, season: def.season, type: def.type, lv: def.lv };
}

function isWalkable(map, px, py) {
  const tx = Math.floor(px / map.tile);
  const ty = Math.floor(py / map.tile);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return !map.blocked[ty * map.width + tx];
}

module.exports = { generateMap, isWalkable, TILE };

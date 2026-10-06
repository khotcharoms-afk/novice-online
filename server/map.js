// =============================================================
//  สร้างแผนที่ "ทุ่งหญ้าเริ่มต้น" (seed เดิม = แผนที่เดิมทุกครั้ง)
//  ground: 0 = หญ้า, 1 = ดิน/ถนน, 2 = น้ำ
//  objects: ต้นไม้ หิน พุ่มไม้ ดอกไม้ (k = ชื่อภาพใน objects.json)
// =============================================================
const TILE = 32;
const MAP_W = 80;
const MAP_H = 60;

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

function generateMap(seed = 20261006) {
  const rand = rng(seed);
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

  // ---- ถนนดินรูปกากบาท + ลานกลาง ----
  const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
  fillRect(ground, 3, cy - 1, MAP_W - 6, 3, 1);
  fillRect(ground, cx - 1, 3, 3, MAP_H - 6, 1);
  fillRect(ground, cx - 6, cy - 4, 13, 9, 1);
  // ทางแยกเล็ก ๆ
  fillRect(ground, 12, 12, 2, cy - 12, 1);
  fillRect(ground, 12, 12, 16, 2, 1);
  fillRect(ground, MAP_W - 20, cy + 1, 2, 16, 1);
  fillRect(ground, MAP_W - 34, cy + 16, 16, 2, 1);
  for (let i = 0; i < ground.length; i++) if (ground[i] === 1) reserved[i] = 1;
  fillRect(reserved, cx - 8, cy - 6, 17, 13, 1); // ลานกลางโล่ง ๆ

  // ---- บ่อน้ำ (สี่เหลี่ยม ≥ 3x3 ห่างถนน) ----
  let ponds = 0;
  for (let tries = 0; tries < 300 && ponds < 6; tries++) {
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

  // ---- ป่ารอบขอบแผนที่ (หนา 3 แถว) ----
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge >= 3) continue;
      if (edge === 0 || (x + y * 2) % 2 === 0 || rand() < 0.5) place(pick(TREES), x, y, 10);
      blocked[idx(x, y)] = 1; // ขอบเดินออกไม่ได้
    }

  // ---- กลุ่มป่าในแผนที่ ----
  for (let c = 0; c < 55; c++) {
    const gx = 4 + Math.floor(rand() * (MAP_W - 8)), gy = 4 + Math.floor(rand() * (MAP_H - 8));
    const n = 5 + Math.floor(rand() * 9);
    const family = rand() < 0.4 ? ["pine1", "pine2", "pine3"] : rand() < 0.5 ? ["oak1", "oak2", "oak3"] : ["doak1", "doak2", "doak3"];
    for (let i = 0; i < n; i++)
      place(pick(family), gx + Math.floor(rand() * 7) - 3, gy + Math.floor(rand() * 5) - 2, 12);
  }
  for (let i = 0; i < 4; i++) place("dead", 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)));

  // ---- หิน & พุ่มไม้ ----
  for (let i = 0; i < 40; i++) place(pick(ROCKS), 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)));
  for (let i = 0; i < 60; i++) place(pick(BUSHES), 4 + Math.floor(rand() * (MAP_W - 8)), 4 + Math.floor(rand() * (MAP_H - 8)), 8);

  // ---- ของตกแต่ง (เดินทับได้) ----
  const decoAt = (k, x, y) => objects.push({ k, x: Math.round(x), y: Math.round(y), b: 0 });
  for (let i = 0; i < 260; i++) {
    const tx = 3 + Math.floor(rand() * (MAP_W - 6)), ty = 3 + Math.floor(rand() * (MAP_H - 6));
    if (ground[idx(tx, ty)] !== 0 || blocked[idx(tx, ty)]) continue;
    decoAt(pick(DECO), tx * TILE + rand() * TILE, ty * TILE + 8 + rand() * 24);
  }
  for (let i = 0; i < 700; i++) {
    const tx = 3 + Math.floor(rand() * (MAP_W - 6)), ty = 3 + Math.floor(rand() * (MAP_H - 6));
    if (ground[idx(tx, ty)] !== 0) continue;
    decoAt(pick(TINY), tx * TILE + rand() * TILE, ty * TILE + rand() * TILE);
  }
  // กกริมน้ำ
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++)
      if (ground[idx(x, y)] === 0 && ground[idx(x, y - 1)] === 2 && rand() < 0.35)
        decoAt(rand() < 0.5 ? "reed1" : "reed2", x * TILE + 8 + rand() * 16, y * TILE + 14);

  objects.sort((a, b) => a.y - b.y);
  return { tile: TILE, width: MAP_W, height: MAP_H, ground, blocked, objects, name: "ทุ่งหญ้าเริ่มต้น" };
}

function isWalkable(map, px, py) {
  const tx = Math.floor(px / map.tile);
  const ty = Math.floor(py / map.tile);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return !map.blocked[ty * map.width + tx];
}

module.exports = { generateMap, isWalkable, TILE };

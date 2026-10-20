// =============================================================
//  รอยแยกมิติ (ดันฝูงมอน แบบ PoE) — แผนที่ส่วนตัว/ปาร์ตี้ · มอนอ่อน ๆ ทะลักเข้ามาเป็นฝูงไม่หยุด
//  ฆ่าจนเกจรอยแยกเต็ม → ผู้คุมรอยแยกปรากฏ → ปราบได้ = ของดรอประเบิด + gold
//  เข้าที่ลูน่าในเมือง (แท็บ "รอยแยกมิติ") · จ่ายเป็น gold · ตายในรอยแยกเกิดใหม่กลางลานได้ 3 ครั้ง
// =============================================================
// ระดับรอยแยก = ฝูงมอนของทุ่งนั้น (เลเวลมอน = สูงสุดของทุ่ง + 2) · คำนวณตอนใช้ครั้งแรก (maps.js โหลดไฟล์นี้)
const FROM = ["maple", "bones", "orcamp", "snow", "frost", "swamp", "ruins", "cursed", "lava", "desert", "dragon", "abyss"];
let _tiers = null;
function tiers() {
  if (_tiers) return _tiers;
  const W = require("./maps");
  const T = FROM.map((id) => {
    const M = W.MAPS[id];
    return { id, name: M.name, season: M.season, req: M.lv[0], lv: Math.round((M.lv[0] + M.lv[1]) / 2) + 2, kinds: M.spawns.map(([k]) => k) };
  });
  // เกินเลเวล 99: ใช้ฝูงของห้วงอเวจีที่แข็งขึ้น
  const ab = T[T.length - 1];
  T.push({ ...ab, id: "abyss2", name: "ห้วงอเวจี (ลึก)", req: 100, lv: 106 }, { ...ab, id: "abyss3", name: "ห้วงอเวจี (ก้นบึ้ง)", req: 110, lv: 116 });
  T.forEach((t, i) => { t.i = i; t.price = Math.round((t.lv * 120) / 100) * 100; t.gold = t.lv * 500; });
  return (_tiers = T);
}

const TIME_MS = 6 * 60000;      // เวลาทั้งรอบ
const PARTY_MAX = 6;
const NEED = (size) => 220 + 50 * (size - 1);        // ฆ่ากี่ตัวเกจถึงเต็ม
const ALIVE_CAP = (size) => Math.min(90, 40 + 10 * (size - 1)); // มอนบนจอพร้อมกันสูงสุด
const PACK = [7, 13];            // ขนาดฝูง
const LIVES = 3;                 // เกิดใหม่ในรอยแยกได้กี่ครั้ง
const ATTACKERS = 6;             // มอนฝูงที่ตีผู้เล่นคนเดียวกันได้พร้อมกัน (ที่เหลือรอล้อมวงอยู่รอบ ๆ)
// มอนฝูง: ตัวบาง ตีเบา (มาเยอะ) · หัวหน้าฝูง: อึดกว่า
const MOB = { hp: 0.2, atk: 0.18, exp: 0.32, gold: 0.3, drop: 0.3, atkMs: 2000, speed: 1.15 };
const LEADER = { hp: 1.6, atk: 0.45, exp: 1.6, scale: 1.25 };
const BOSS = { hp: 7, hpPer: 3, atk: 0.9, exp: 25, scale: 2.1, loot: 5 };

const SEASONS = ["autumn", "summer", "winter", "swamp", "ruins", "shadow", "lava", "desert"];
const mapId = (season) => `rf_${season}`;
const isRiftMap = (id) => /^rf_/.test(String(id));

// แผนที่รอยแยก (เพิ่มเข้า maps.js) — ลานกว้าง สิ่งกีดขวางน้อย ให้ฝูงมอนวิ่งเข้ามาได้รอบทิศ
function maps() {
  return Object.fromEntries(SEASONS.map((s, i) => [mapId(s), {
    name: "รอยแยกมิติ", type: "dungeon", horde: true, lv: null, season: s, w: 50, h: 40, seed: 7100 + i * 37,
    desc: "รอยแยกที่ฝูงมอนทะลักออกมาไม่หยุด", exits: {}, spawns: [],
    style: { ponds: 1, forest: 6, dead: 4, rocks: 8, bushes: 6, dirt: 10 },
  }]));
}

module.exports = { tiers, TIME_MS, PARTY_MAX, NEED, ALIVE_CAP, PACK, LIVES, ATTACKERS, MOB, LEADER, BOSS, mapId, isRiftMap, maps };

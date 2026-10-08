// =============================================================
//  ดันเจี้ยนภูติ — แผนที่ส่วนตัว/ปาร์ตี้ แยกตามธาตุภูติ 6 ธาตุ × 4 ระดับความยาก
//  เข้าทางลูน่า (ผู้ผนึกภูติ) ในเมือง · ใช้ตั๋วดันเจี้ยนภูติ · ล้างมอน 3 ระลอก แล้วปราบผู้พิทักษ์ธาตุ ภายใน 10 นาที
//  รางวัล = แก่นธาตุ (ใช้ข้ามขีดจำกัดภูติธาตุเดียวกัน) + ผลึกวิญญาณ (อัประดับสี) + gold
// =============================================================

// ธาตุ: spirit = ภูติที่ใช้แก่นธาตุนี้ · mobs = มอนในดัน · boss = ร่างของผู้พิทักษ์ · season = ชุดภาพพื้น
const ELEMENTS = {
  fire:    { name: "เพลิง", spirit: "sp_ember", color: "#ff7a30", season: "lava", seed: 4101, tint: null,
    mobs: ["wisp_fire", "slime_lava", "salamander", "firedemon"], boss: { base: "golem_magma", name: "ผู้พิทักษ์เปลวเพลิง", tint: 0xffb070 } },
  water:   { name: "ธารา", spirit: "sp_spring", color: "#4ab8ff", season: "swamp", seed: 4202, tint: 0x9fd8ff,
    mobs: ["slime_green", "lizard", "spider_bog", "plant_bog"], boss: { base: "plant_bog", name: "ราชินีบัวธารา", tint: 0x8fd0ff } },
  ice:     { name: "หิมะ", spirit: "sp_frost", color: "#9fe8ff", season: "winter", seed: 4303, tint: null,
    mobs: ["slime_ice", "snowwolf", "wisp_frost", "snowwraith"], boss: { base: "frostgiant", name: "ผู้พิทักษ์ธารน้ำแข็ง", tint: 0xd8f6ff } },
  thunder: { name: "อัสนี", spirit: "sp_thunder", color: "#ffe14a", season: "ruins", seed: 4404, tint: 0xfff0a0,
    mobs: ["golem_stone", "gargoyle", "eye_float", "bat_drake"], boss: { base: "golem_stone", name: "โกเลมอัสนี", tint: 0xffe860 } },
  light:   { name: "แสง", spirit: "sp_lumi", color: "#fff3b0", season: "spring", seed: 4505, tint: 0xfff6d0,
    mobs: ["shroom_glow", "dryad", "sandspirit", "ghost_white"], boss: { base: "dryad", name: "เทพธิดาแห่งแสง", tint: 0xfff2b0 } },
  shadow:  { name: "เงา", spirit: "sp_shadow", color: "#a060ff", season: "shadow", seed: 4606, tint: null,
    mobs: ["bat_vampire", "ghost_dark", "shadowwolf", "eye_abyss"], boss: { base: "shadowdemon", name: "จ้าวแห่งเงามืด", tint: 0xd0a0ff } },
};
const SPIRIT_EL = Object.fromEntries(Object.entries(ELEMENTS).map(([el, E]) => [E.spirit, el]));

// ระดับความยาก: req = เลเวลผู้เล่นขั้นต่ำ · lv = เลเวลมอน · tickets = ตั๋วที่ใช้ต่อคน
// reward: core/pure = [ต่ำสุด, สูงสุด] ต่อคน · shard = ผลึกวิญญาณ · gold
const DIFFS = [
  { name: "ขั้นต้น", req: 10, lv: 10, tickets: 1, core: [4, 6], pure: [0, 0], shard: [1, 1], gold: 3000 },
  { name: "ขั้นกลาง", req: 25, lv: 26, tickets: 1, core: [7, 10], pure: [0, 0], shard: [2, 2], gold: 9000 },
  { name: "ขั้นสูง", req: 40, lv: 42, tickets: 2, core: [5, 7], pure: [2, 3], shard: [3, 4], gold: 25000 },
  { name: "ขั้นจ้าว", req: 60, lv: 62, tickets: 2, core: [6, 8], pure: [4, 6], shard: [5, 6], gold: 60000 },
];
const WAVES = 3;
const TIME_MS = 10 * 60000;          // เวลาทั้งดัน
const PARTY_MAX = 6;
const TICKET = "sd_ticket", TICKET_PRICE = 3000;
const coreId = (el) => `core_${el}`, pureId = (el) => `pure_${el}`;
const mapId = (el) => `sd_${el}`;
const isDungeonMap = (id) => /^sd_/.test(String(id));

// ไอเทม (เพิ่มเข้า items.js)
function items() {
  const out = {
    [TICKET]: { name: "ตั๋วดันเจี้ยนภูติ", type: "material", price: TICKET_PRICE, sell: 300, frame: "#6fb6ff",
      desc: "ใช้เข้าดันเจี้ยนภูติที่ลูน่า (ผู้ผนึกภูติ) · ขั้นต้น/กลาง ใช้ 1 ใบ · ขั้นสูง/จ้าว ใช้ 2 ใบ · ซื้อได้จากลูน่า หรือดรอปจากมอน Lv.10 ขึ้นไป" },
  };
  for (const [el, E] of Object.entries(ELEMENTS)) {
    out[coreId(el)] = { name: `แก่นธาตุ${E.name}`, type: "material", sell: 150, frame: E.color,
      desc: `ใช้ข้ามขีดจำกัดภูติธาตุ${E.name} (ร่างเติบโต–จ้าว) · ได้จากดันเจี้ยนภูติธาตุ${E.name}` };
    out[pureId(el)] = { name: `แก่น${E.name}บริสุทธิ์`, type: "material", sell: 600, frame: "#c38bff",
      desc: `ใช้ข้ามขีดจำกัดภูติธาตุ${E.name} ขั้นสูง (ร่างจ้าว–สมบูรณ์) · ได้จากดันเจี้ยนภูติธาตุ${E.name} ขั้นสูง/ขั้นจ้าว` };
  }
  return out;
}

// ของที่ใช้ข้ามขีดจำกัดภูติ (ตามธาตุของภูติ) · index = ร่างปัจจุบัน
function breakFor(spiritId) {
  const el = SPIRIT_EL[spiritId] || "fire", c = coreId(el), p = pureId(el);
  return [
    { items: [[c, 10]], gold: 3000 },                                         // Lv.10 → ร่างเติบโต
    { items: [[c, 25], ["spirit_shard", 3]], gold: 15000 },                   // Lv.20 → ร่างตื่นรู้
    { items: [[c, 20], [p, 8], ["spirit_shard", 8]], gold: 50000 },           // Lv.30 → ร่างจ้าว
    { items: [[p, 20], ["spirit_shard", 15]], gold: 150000 },                 // Lv.40 → ร่างสมบูรณ์
  ];
}

// แผนที่ดัน (เพิ่มเข้า maps.js) — ลานเล็ก ไม่มีทางออก จุดเกิดกลางแผนที่
function maps() {
  return Object.fromEntries(Object.entries(ELEMENTS).map(([el, E]) => [mapId(el), {
    name: `ดันเจี้ยนภูติ · ธาตุ${E.name}`, type: "dungeon", lv: null, season: E.season, w: 36, h: 28, seed: E.seed,
    desc: `ดันเจี้ยนของภูติธาตุ${E.name}`, exits: {}, spawns: [], el,
    style: { ponds: 2, forest: 10, dead: 6, rocks: 14, bushes: 10, dirt: 6 },
  }]));
}

module.exports = { ELEMENTS, SPIRIT_EL, DIFFS, WAVES, TIME_MS, PARTY_MAX, TICKET, TICKET_PRICE, coreId, pureId, mapId, isDungeonMap, items, breakFor, maps };

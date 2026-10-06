// =============================================================
//  ไอเทมทั้งหมดในเกม — ปรับค่าพลัง ราคา อัตราดรอป ได้ที่ไฟล์นี้
// =============================================================

// ช่องอุปกรณ์ 10 ช่อง (ซ้าย 5 / ขวา 5 ในหน้าต่างตัวละคร)
const EQUIP_SLOTS = ["head", "face", "armor", "gloves", "acc1", "weapon", "offhand", "cape", "shoes", "acc2"];
const SLOT_NAME = {
  head: "หมวก", face: "หน้า", armor: "เสื้อ/เกราะ", gloves: "ถุงมือ", acc1: "เครื่องประดับ",
  weapon: "อาวุธ", offhand: "มือรอง", cape: "ผ้าคลุม", shoes: "รองเท้า", acc2: "เครื่องประดับ",
};
const INVENTORY_SIZE = 40;
const MAX_STACK = 99;

// type: equip | use | material
// slot: ช่องที่ใส่ได้ ("acc" = ใส่ได้ทั้ง acc1/acc2)
// bonus: ค่าที่เพิ่มเมื่อสวม — atk, def, str, agi, vit, int, dex, maxHp, maxSp
// visual: ภาพบนตัวละคร (มี = เห็นตอนสวม), sexed = ภาพแยกชาย/หญิง, back = มีชั้นหลังตัว
// price: ราคาซื้อที่ร้าน (ขายคืน = ครึ่งหนึ่ง) · sell: ราคาขายของดรอป
const ITEMS = {
  // ---------- อาวุธ ----------
  mace:     { name: "กระบองเหล็ก", type: "equip", slot: "weapon", lv: 1, bonus: { atk: 8 }, price: 60, visual: true, back: true },
  dagger:   { name: "มีดสั้นนักเดินทาง", type: "equip", slot: "weapon", lv: 4, bonus: { atk: 12, agi: 1 }, price: 240, visual: true, back: true },
  sword:    { name: "ดาบเหล็ก", type: "equip", slot: "weapon", lv: 8, bonus: { atk: 22 }, price: 950, visual: true, back: true },
  waraxe:   { name: "ขวานศึกออร์ค", type: "equip", slot: "weapon", lv: 16, bonus: { atk: 38, str: 3 }, price: 4200, visual: true, back: true },
  // ---------- มือรอง ----------
  kite:     { name: "โล่เหล็ก", type: "equip", slot: "offhand", lv: 5, bonus: { def: 6 }, price: 420, visual: true, sexed: true },
  // ---------- หมวก / หน้า ----------
  bandana:  { name: "ผ้าโพกหัวแดง", type: "equip", slot: "head", lv: 1, bonus: { def: 1, agi: 1 }, price: 90, visual: true },
  hood:     { name: "ฮู้ดผ้าเดินทาง", type: "equip", slot: "head", lv: 3, bonus: { def: 2, maxHp: 15 }, price: 160, visual: true },
  nasal:    { name: "หมวกเหล็กนักรบ", type: "equip", slot: "head", lv: 10, bonus: { def: 6, vit: 1 }, price: 1300, visual: true },
  glasses:  { name: "แว่นกลมนักปราชญ์", type: "equip", slot: "face", lv: 5, bonus: { dex: 2, int: 1 }, price: 700, visual: true },
  // ---------- เสื้อ / เกราะ ----------
  leather:  { name: "เสื้อหนัง", type: "equip", slot: "armor", lv: 1, bonus: { def: 5 }, price: 150, visual: true, sexed: true },
  chain:    { name: "เสื้อเกราะโซ่", type: "equip", slot: "armor", lv: 8, bonus: { def: 12 }, price: 1150, visual: true, sexed: true },
  plate:    { name: "เกราะเหล็ก", type: "equip", slot: "armor", lv: 15, bonus: { def: 22, vit: 2 }, price: 3800, visual: true, sexed: true },
  // ---------- ถุงมือ / ผ้าคลุม / รองเท้า ----------
  gloves:   { name: "ถุงมือหนัง", type: "equip", slot: "gloves", lv: 2, bonus: { def: 1, dex: 1 }, price: 120, visual: true, sexed: true },
  cape:     { name: "ผ้าคลุมเดินทาง", type: "equip", slot: "cape", lv: 4, bonus: { def: 2, agi: 1 }, price: 280, visual: true, sexed: true, back: true },
  boots:    { name: "รองเท้าบูทหนัง", type: "equip", slot: "shoes", lv: 2, bonus: { def: 2 }, price: 140, visual: true, sexed: true },
  // ---------- เครื่องประดับ (ไม่มีภาพบนตัว) ----------
  ring_copper:   { name: "แหวนทองแดง", type: "equip", slot: "acc", lv: 1, bonus: { str: 1 }, price: 220 },
  fang_necklace: { name: "สร้อยเขี้ยวหมาป่า", type: "equip", slot: "acc", lv: 5, bonus: { agi: 2, dex: 1 }, price: 900 },
  boar_charm:    { name: "เครื่องรางงาหมูป่า", type: "equip", slot: "acc", lv: 9, bonus: { vit: 3 }, price: 1500 },
  // ---------- ของใช้ ----------
  potion_s:  { name: "ยาแดงขวดเล็ก", type: "use", heal: { hp: 45 }, price: 12, desc: "ฟื้น HP 45" },
  potion_m:  { name: "ยาแดง", type: "use", heal: { hp: 150 }, price: 40, desc: "ฟื้น HP 150" },
  potion_sp: { name: "ยาฟ้า", type: "use", heal: { sp: 30 }, price: 35, desc: "ฟื้น SP 30" },
  // ---------- สัตว์เลี้ยง (เรียกออกมาแล้วช่วยเก็บของที่ดรอปรอบตัว) ----------
  // pet.range = ระยะเก็บของรอบตัวเรา (px, 32 = 1 ช่อง) · pet.speed = ความเร็วบิน (px/วินาที, คนเดิน 170)
  pet_sparrow:  { name: "นกกระจอกน้อย", type: "pet", lv: 1, price: 300, pet: { range: 160, speed: 210 }, desc: "เก็บของที่ดรอปรอบตัวในระยะ 5 ช่อง" },
  pet_canary:   { name: "นกขมิ้นน้อย", type: "pet", lv: 6, price: 1500, pet: { range: 256, speed: 250 }, desc: "เก็บของที่ดรอปรอบตัวในระยะ 8 ช่อง บินเร็วขึ้น" },
  pet_bluebird: { name: "นกฟ้าน้อย", type: "pet", lv: 12, price: 4000, pet: { range: 384, speed: 300 }, desc: "เก็บของที่ดรอปรอบตัวในระยะ 12 ช่อง บินเร็วมาก" },
  // ---------- คริสตัลตีบวก (ใช้ที่ลุงเหล็กกล้า) · frame = สีกรอบในกระเป๋า ----------
  stone_1: { name: "คริสตัลตีบวกขั้นต้น", type: "material", price: 30, frame: "#cfd3dd", desc: "ใช้ตีบวก +1 ถึง +4" },
  stone_2: { name: "คริสตัลตีบวกขั้นกลาง", type: "material", sell: 60, frame: "#6fb6ff", desc: "ใช้ตีบวก +5 ถึง +7" },
  stone_3: { name: "คริสตัลตีบวกขั้นสูง", type: "material", sell: 200, frame: "#c38bff", desc: "ใช้ตีบวก +8 ถึง +10" },
  // ---------- ของดรอป (ขายที่ร้าน) ----------
  goblin_ear: { name: "หูก็อบลิน", type: "material", sell: 4 },
  wolf_fang:  { name: "เขี้ยวหมาป่า", type: "material", sell: 10 },
  boar_tusk:  { name: "งาหมูป่า", type: "material", sell: 18 },
  old_bone:   { name: "กระดูกเก่า", type: "material", sell: 26 },
  orc_scrap:  { name: "เศษเกราะออร์ค", type: "material", sell: 40 },
};

// ของที่ร้านค้าขาย (เรียงตามที่แสดง)
const SHOP = ["potion_s", "potion_m", "potion_sp", "mace", "dagger", "kite", "bandana", "hood", "leather", "chain",
  "gloves", "cape", "boots", "ring_copper", "stone_1", "pet_sparrow", "pet_canary", "pet_bluebird"];

// ของดรอปจากมอน: [itemId, โอกาส 0–1, จำนวนต่ำสุด, สูงสุด]
const DROPS = {
  goblin:   [["goblin_ear", 0.6, 1, 2], ["stone_1", 0.08, 1, 1], ["potion_s", 0.08, 1, 1], ["bandana", 0.015, 1, 1], ["gloves", 0.01, 1, 1]],
  wolf:     [["wolf_fang", 0.55, 1, 2], ["stone_1", 0.12, 1, 2], ["stone_2", 0.02, 1, 1], ["potion_s", 0.1, 1, 2], ["fang_necklace", 0.02, 1, 1], ["dagger", 0.01, 1, 1]],
  boar:     [["boar_tusk", 0.55, 1, 1], ["stone_1", 0.1, 1, 2], ["stone_2", 0.05, 1, 1], ["potion_m", 0.06, 1, 1], ["boar_charm", 0.02, 1, 1], ["nasal", 0.01, 1, 1]],
  skeleton: [["old_bone", 0.55, 1, 2], ["stone_2", 0.07, 1, 1], ["stone_3", 0.015, 1, 1], ["potion_m", 0.08, 1, 1], ["glasses", 0.02, 1, 1], ["plate", 0.008, 1, 1]],
  orc:      [["orc_scrap", 0.55, 1, 2], ["stone_2", 0.08, 1, 2], ["stone_3", 0.03, 1, 1], ["potion_m", 0.1, 1, 2], ["waraxe", 0.01, 1, 1], ["plate", 0.01, 1, 1]],
};
// เงินที่ได้ต่อการฆ่า 1 ตัว (แบ่งตามดาเมจเหมือน EXP)
const goldDrop = (mobLv) => Math.round(mobLv * 2.5 + Math.random() * mobLv * 2);

// =============================================================
//  ระดับความหายาก (เฉพาะอุปกรณ์) — ของจากร้าน = ธรรมดาเสมอ, ของดรอปสุ่มระดับ
//  mult = คูณค่าพลังพื้นฐานของไอเทม · extras = จำนวนค่าพิเศษสุ่ม · weight = โอกาสดรอป (ส่วนต่อ 1000)
// =============================================================
const RARITY = [
  { name: "ธรรมดา", color: "#cfd3dd", mult: 1, extras: 0, weight: 716, sell: 1 },
  { name: "ดี", color: "#7dff9a", mult: 1.1, extras: 1, weight: 200, sell: 1.5 },
  { name: "หายาก", color: "#6fb6ff", mult: 1.25, extras: 2, weight: 70, sell: 2.5 },
  { name: "มหากาพย์", color: "#c38bff", mult: 1.45, extras: 3, weight: 12, sell: 4 },
  { name: "ตำนาน", color: "#ffc145", mult: 1.7, extras: 4, weight: 2, sell: 7 },
];
function rollRarity() {
  let x = Math.random() * RARITY.reduce((t, r) => t + r.weight, 0);
  for (let i = 0; i < RARITY.length; i++) { x -= RARITY[i].weight; if (x < 0) return i; }
  return 0;
}
// ค่าพิเศษสุ่ม: ค่าที่ได้ขึ้นกับเลเวลของไอเทม
const EXTRA_POOL = {
  str: (lv) => 1 + rnd(0, Math.floor(lv / 6)), agi: (lv) => 1 + rnd(0, Math.floor(lv / 6)), vit: (lv) => 1 + rnd(0, Math.floor(lv / 6)),
  int: (lv) => 1 + rnd(0, Math.floor(lv / 6)), dex: (lv) => 1 + rnd(0, Math.floor(lv / 6)),
  maxHp: (lv) => 10 + rnd(0, lv * 3), maxSp: (lv) => 5 + rnd(0, lv), atk: (lv) => 2 + rnd(0, Math.ceil(lv / 3)), def: (lv) => 1 + rnd(0, Math.ceil(lv / 4)),
};
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// สร้างไอเทมอุปกรณ์ 1 ชิ้น (r = ระดับ, up = ตีบวก, x = ค่าพิเศษ)
function makeGear(id, r) {
  const it = ITEMS[id];
  if (!it || it.type !== "equip") return null;
  if (r === undefined) r = rollRarity();
  r = Math.max(0, Math.min(RARITY.length - 1, r | 0));
  const x = {};
  const keys = Object.keys(EXTRA_POOL).sort(() => Math.random() - 0.5).slice(0, RARITY[r].extras);
  for (const k of keys) x[k] = EXTRA_POOL[k](it.lv || 1);
  return { id, n: 1, r, up: 0, x };
}

// =============================================================
//  ตีบวก (+1 ถึง +10) ที่ NPC ช่างตีบวก — ใช้ได้กับอาวุธ/ของที่มีค่าป้องกัน
//  rate = โอกาสสำเร็จ · mats = คริสตัลตีบวกที่ใช้ (ขั้นสูงขึ้น = คริสตัลขั้นสูงขึ้น + ใช้จำนวนมากขึ้น)
//  ล้มเหลวตั้งแต่ +5 ขึ้นไป ระดับลด 1 (ของไม่แตก)
// =============================================================
const MAX_REFINE = 10;
const REFINE = [null,
  { rate: 1.0, mats: [["stone_1", 1]] },
  { rate: 1.0, mats: [["stone_1", 2]] },
  { rate: 1.0, mats: [["stone_1", 3]] },
  { rate: 0.9, mats: [["stone_1", 5]] },
  { rate: 0.75, mats: [["stone_2", 2]] },
  { rate: 0.6, mats: [["stone_2", 3]] },
  { rate: 0.45, mats: [["stone_2", 5]] },
  { rate: 0.35, mats: [["stone_3", 2]] },
  { rate: 0.25, mats: [["stone_3", 3]] },
  { rate: 0.15, mats: [["stone_3", 5]] },
];
const SAFE_REFINE = 4;
// รวมคริสตัล: ขั้นต่ำกว่า 5 ก้อน + gold → ขั้นสูงกว่า 1 ก้อน
const STONE_FUSE = { stone_2: { from: "stone_1", n: 5, gold: 100 }, stone_3: { from: "stone_2", n: 5, gold: 500 } }; // ตีถึง +4 ไม่มีวันลดระดับ
const canRefine = (it) => !!(it && it.type === "equip" && it.bonus && (it.bonus.atk || it.bonus.def));
const refineGold = (it, to) => Math.round(((40 + (it.lv || 1) * 15) * Math.pow(to, 1.6)) / 10) * 10;
// ค่าที่ได้จากการตีบวก: อาวุธ +ATK, ของป้องกัน +DEF ต่อระดับ
function refineBonus(it, up) {
  if (!up || !canRefine(it)) return {};
  if (it.bonus.atk) return { atk: up * (1 + Math.floor((it.lv || 1) / 5)) };
  return { def: up * (1 + Math.floor((it.lv || 1) / 10)) };
}
// ค่าพลังรวมของไอเทม 1 ชิ้น (พื้นฐาน × ระดับ + ตีบวก + ค่าพิเศษ)
function gearStats(g) {
  const it = ITEMS[g && g.id];
  if (!it) return {};
  const mult = (RARITY[g.r || 0] || RARITY[0]).mult, out = {};
  for (const [k, v] of Object.entries(it.bonus || {})) out[k] = Math.round(v * mult);
  for (const [k, v] of Object.entries(refineBonus(it, g.up || 0))) out[k] = (out[k] || 0) + v;
  for (const [k, v] of Object.entries(g.x || {})) out[k] = (out[k] || 0) + v;
  return out;
}

const sellPrice = (id, g) => {
  const it = ITEMS[id];
  if (!it) return 0;
  const base = it.sell ?? Math.floor((it.price || 0) / 2);
  return Math.floor(base * ((g && RARITY[g.r || 0]) || RARITY[0]).sell);
};
const fitsSlot = (it, slot) => it && it.type === "equip" && (it.slot === slot || (it.slot === "acc" && (slot === "acc1" || slot === "acc2")));

module.exports = { STONE_FUSE, RARITY, rollRarity, makeGear, MAX_REFINE, REFINE, SAFE_REFINE, canRefine, refineGold, refineBonus, gearStats, EQUIP_SLOTS, SLOT_NAME, INVENTORY_SIZE, MAX_STACK, ITEMS, SHOP, DROPS, goldDrop, sellPrice, fitsSlot };

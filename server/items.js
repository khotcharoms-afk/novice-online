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
  // ---------- ของดรอป (ขายที่ร้าน) ----------
  goblin_ear: { name: "หูก็อบลิน", type: "material", sell: 4 },
  wolf_fang:  { name: "เขี้ยวหมาป่า", type: "material", sell: 10 },
  boar_tusk:  { name: "งาหมูป่า", type: "material", sell: 18 },
  old_bone:   { name: "กระดูกเก่า", type: "material", sell: 26 },
  orc_scrap:  { name: "เศษเกราะออร์ค", type: "material", sell: 40 },
};

// ของที่ร้านค้าขาย (เรียงตามที่แสดง)
const SHOP = ["potion_s", "potion_m", "potion_sp", "mace", "dagger", "kite", "bandana", "hood", "leather", "chain",
  "gloves", "cape", "boots", "ring_copper", "pet_sparrow", "pet_canary", "pet_bluebird"];

// ของดรอปจากมอน: [itemId, โอกาส 0–1, จำนวนต่ำสุด, สูงสุด]
const DROPS = {
  goblin:   [["goblin_ear", 0.6, 1, 2], ["potion_s", 0.08, 1, 1], ["bandana", 0.015, 1, 1], ["gloves", 0.01, 1, 1]],
  wolf:     [["wolf_fang", 0.55, 1, 2], ["potion_s", 0.1, 1, 2], ["fang_necklace", 0.02, 1, 1], ["dagger", 0.01, 1, 1]],
  boar:     [["boar_tusk", 0.55, 1, 1], ["potion_m", 0.06, 1, 1], ["boar_charm", 0.02, 1, 1], ["nasal", 0.01, 1, 1]],
  skeleton: [["old_bone", 0.55, 1, 2], ["potion_m", 0.08, 1, 1], ["glasses", 0.02, 1, 1], ["plate", 0.008, 1, 1]],
  orc:      [["orc_scrap", 0.55, 1, 2], ["potion_m", 0.1, 1, 2], ["waraxe", 0.01, 1, 1], ["plate", 0.01, 1, 1]],
};
// เงินที่ได้ต่อการฆ่า 1 ตัว (แบ่งตามดาเมจเหมือน EXP)
const goldDrop = (mobLv) => Math.round(mobLv * 2.5 + Math.random() * mobLv * 2);

const sellPrice = (id) => { const it = ITEMS[id]; return it ? (it.sell ?? Math.floor((it.price || 0) / 2)) : 0; };
const fitsSlot = (it, slot) => it && it.type === "equip" && (it.slot === slot || (it.slot === "acc" && (slot === "acc1" || slot === "acc2")));

module.exports = { EQUIP_SLOTS, SLOT_NAME, INVENTORY_SIZE, MAX_STACK, ITEMS, SHOP, DROPS, goldDrop, sellPrice, fitsSlot };

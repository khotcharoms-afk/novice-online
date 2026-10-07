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
  mace:     { wt: "mace", name: "กระบองเหล็ก", type: "equip", slot: "weapon", lv: 1, bonus: { atk: 8 }, price: 60, visual: true, back: true },
  dagger:   { wt: "dagger", name: "มีดสั้นนักเดินทาง", type: "equip", slot: "weapon", lv: 4, bonus: { atk: 12, agi: 1 }, price: 240, visual: true, back: true },
  sword:    { wt: "sword", name: "ดาบเหล็ก", type: "equip", slot: "weapon", lv: 8, bonus: { atk: 22 }, price: 950, visual: true, back: true },
  waraxe:   { wt: "axe", name: "ขวานศึกออร์ค", type: "equip", slot: "weapon", lv: 16, bonus: { atk: 38, str: 3 }, price: 4200, visual: true, back: true },
  // ---------- มือรอง ----------
  kite:     { wt: "shield", name: "โล่เหล็ก", type: "equip", slot: "offhand", lv: 5, bonus: { def: 6 }, price: 420, visual: true, sexed: true },
  // ---------- หมวก / หน้า ----------
  bandana:  { ac: "light", name: "ผ้าโพกหัวแดง", type: "equip", slot: "head", lv: 1, bonus: { def: 1, agi: 1 }, price: 90, visual: true },
  hood:     { ac: "light", name: "ฮู้ดผ้าเดินทาง", set: "leather", type: "equip", slot: "head", lv: 3, bonus: { def: 2, maxHp: 15 }, price: 160, visual: true },
  nasal:    { ac: "heavy", name: "หมวกเหล็กนักรบ", type: "equip", slot: "head", lv: 10, bonus: { def: 6, vit: 1 }, price: 1300, visual: true },
  glasses:  { name: "แว่นกลมนักปราชญ์", type: "equip", slot: "face", lv: 5, bonus: { dex: 2, int: 1 }, price: 700, visual: true },
  // ---------- เสื้อ / เกราะ ----------
  leather:  { ac: "light", name: "เสื้อหนัง", set: "leather", type: "equip", slot: "armor", lv: 1, bonus: { def: 5 }, price: 150, visual: true, sexed: true },
  chain:    { ac: "heavy", name: "เสื้อเกราะโซ่", set: "chain", type: "equip", slot: "armor", lv: 8, bonus: { def: 12 }, price: 1150, visual: true, sexed: true },
  plate:    { ac: "heavy", name: "เกราะเหล็ก", set: "plate", type: "equip", slot: "armor", lv: 15, bonus: { def: 22, vit: 2 }, price: 3800, visual: true, sexed: true },
  // ---------- ถุงมือ / ผ้าคลุม / รองเท้า ----------
  gloves:   { ac: "light", name: "ถุงมือหนัง", set: "leather", type: "equip", slot: "gloves", lv: 2, bonus: { def: 1, dex: 1 }, price: 120, visual: true, sexed: true },
  cape:     { name: "ผ้าคลุมเดินทาง", type: "equip", slot: "cape", lv: 4, bonus: { def: 2, agi: 1 }, price: 280, visual: true, sexed: true, back: true },
  boots:    { ac: "light", name: "รองเท้าบูทหนัง", set: "leather", type: "equip", slot: "shoes", lv: 2, bonus: { def: 2 }, price: 140, visual: true, sexed: true },
  // ---------- ชุดโซ่ (Lv8) — ร้านขาย ----------
  mailcoif:   { ac: "heavy", name: "หมวกโซ่", type: "equip", slot: "head", lv: 8, bonus: { def: 4, maxHp: 20 }, price: 900, visual: true, set: "chain" },
  bracers:    { ac: "heavy", name: "สนับแขนเหล็ก", type: "equip", slot: "gloves", lv: 8, bonus: { def: 3, str: 1 }, price: 850, visual: true, sexed: true, set: "chain" },
  ironboots:  { ac: "heavy", name: "รองเท้าบูทเสริมเหล็ก", type: "equip", slot: "shoes", lv: 8, bonus: { def: 4 }, price: 900, visual: true, sexed: true, set: "chain" },
  // ---------- ชุดเกราะเหล็ก (Lv15) — ดรอปเท่านั้น ----------
  greathelm:  { ac: "heavy", name: "หมวกเกราะเหล็ก", type: "equip", slot: "head", lv: 15, bonus: { def: 9, vit: 1 }, price: 3600, visual: true, sexed: true, set: "plate" },
  gauntlets:  { ac: "heavy", name: "ถุงมือเกราะเหล็ก", type: "equip", slot: "gloves", lv: 15, bonus: { def: 6, str: 2 }, price: 3200, visual: true, sexed: true, set: "plate" },
  plateboots: { ac: "heavy", name: "รองเท้าเกราะเหล็ก", type: "equip", slot: "shoes", lv: 15, bonus: { def: 7, agi: 1 }, price: 3200, visual: true, sexed: true, set: "plate" },
  // ---------- ชุดเกราะทองคำ (Lv25) — ดรอปหายากจากมอนเลเวลสูง ----------
  goldhelm:   { ac: "heavy", name: "หมวกเกราะทองคำ", type: "equip", slot: "head", lv: 25, bonus: { def: 14, vit: 2, maxHp: 60 }, price: 9000, visual: true, sexed: true, set: "gold" },
  goldplate:  { ac: "heavy", name: "เกราะทองคำ", type: "equip", slot: "armor", lv: 25, bonus: { def: 34, vit: 3 }, price: 14000, visual: true, sexed: true, set: "gold" },
  goldgaunt:  { ac: "heavy", name: "ถุงมือเกราะทองคำ", type: "equip", slot: "gloves", lv: 25, bonus: { def: 9, str: 3 }, price: 8000, visual: true, sexed: true, set: "gold" },
  goldboots:  { ac: "heavy", name: "รองเท้าเกราะทองคำ", type: "equip", slot: "shoes", lv: 25, bonus: { def: 10, agi: 2 }, price: 8000, visual: true, sexed: true, set: "gold" },
  // =============== อุปกรณ์อาชีพ (Phase 6) — Lv20 ขายที่ร้าน · Lv30 ดรอปเท่านั้น ===============
  // ---------- ผู้พิทักษ์: ดาบมือเดียว + โล่ ----------
  saber:          { wt: "sword", name: "ดาบอัศวิน", type: "equip", slot: "weapon", lv: 20, bonus: { atk: 50, vit: 2 }, price: 7000, visual: true, back: true },
  moonblade:      { wt: "sword", name: "ดาบแสงจันทร์", type: "equip", slot: "weapon", lv: 30, bonus: { atk: 78, vit: 3, def: 4 }, price: 18000, visual: true, back: true },
  shield_knight:  { wt: "shield", name: "โล่อัศวิน", type: "equip", slot: "offhand", lv: 20, bonus: { def: 12, vit: 1, maxHp: 40 }, price: 6000, visual: true, sexed: true },
  shield_spartan: { wt: "shield", name: "โล่สัมฤทธิ์สปาร์ตัน", type: "equip", slot: "offhand", lv: 30, bonus: { def: 19, vit: 2, maxHp: 80 }, price: 15000, visual: true },
  // ---------- นักดาบใหญ่: อาวุธสองมือ ----------
  greatsword:     { wt: "greatsword", name: "ดาบใหญ่", type: "equip", slot: "weapon", lv: 20, bonus: { atk: 62, str: 2 }, price: 7500, visual: true, back: true },
  titanaxe:       { wt: "axe", name: "ขวานยักษ์โลหิต", type: "equip", slot: "weapon", lv: 30, bonus: { atk: 96, str: 4 }, price: 19000, visual: true, back: true },
  // ---------- นักล่า: ธนู ----------
  bow_hunter:     { wt: "bow", name: "ธนูพราน", type: "equip", slot: "weapon", lv: 20, bonus: { atk: 46, dex: 3 }, price: 7000, visual: true, back: true },
  bow_shadow:     { wt: "bow", name: "ธนูโค้งเงา", type: "equip", slot: "weapon", lv: 30, bonus: { atk: 72, dex: 5, agi: 2 }, price: 18000, visual: true, back: true },
  // ---------- นักเวทย์: คทา ----------
  staff_oak:      { wt: "staff", name: "คทาไม้โอ๊ค", type: "equip", slot: "weapon", lv: 20, bonus: { atk: 44, int: 3, maxSp: 30 }, price: 7000, visual: true, back: true },
  staff_crystal:  { wt: "staff", name: "คทาคริสตัลม่วง", type: "equip", slot: "weapon", lv: 30, bonus: { atk: 70, int: 6, maxSp: 60 }, price: 18000, visual: true, back: true },
  // ---------- หมอ: คัมภีร์ลอย ----------
  book_light:     { wt: "book", name: "คัมภีร์แสง", type: "equip", slot: "weapon", lv: 20, bonus: { atk: 34, int: 3, maxSp: 40 }, price: 7000, visual: true, back: true },
  book_holy:      { wt: "book", name: "คัมภีร์ศักดิ์สิทธิ์", type: "equip", slot: "weapon", lv: 30, bonus: { atk: 54, int: 6, vit: 2, maxSp: 70 }, price: 18000, visual: true, back: true },
  // ---------- เกราะเบา: ชุดนักพราน (Lv20) / ชุดพรานเงา (Lv30) ----------
  ranger_cap:     { ac: "light", set: "ranger", name: "หมวกพราน", type: "equip", slot: "head", lv: 20, bonus: { def: 6, dex: 2 }, price: 3800, visual: true },
  ranger_vest:    { ac: "light", set: "ranger", name: "เสื้อหนังพราน", type: "equip", slot: "armor", lv: 20, bonus: { def: 18, agi: 2 }, price: 6200, visual: true, sexed: true },
  ranger_gloves:  { ac: "light", set: "ranger", name: "ถุงมือพราน", type: "equip", slot: "gloves", lv: 20, bonus: { def: 4, dex: 2 }, price: 3400, visual: true, sexed: true },
  ranger_boots:   { ac: "light", set: "ranger", name: "รองเท้าพราน", type: "equip", slot: "shoes", lv: 20, bonus: { def: 5, agi: 2 }, price: 3400, visual: true, sexed: true },
  shadow_hood:    { ac: "light", set: "shadow", name: "ฮู้ดพรานเงา", type: "equip", slot: "head", lv: 30, bonus: { def: 10, dex: 3, agi: 1 }, price: 9000, visual: true },
  shadow_vest:    { ac: "light", set: "shadow", name: "เสื้อหนังพรานเงา", type: "equip", slot: "armor", lv: 30, bonus: { def: 28, agi: 3, dex: 2 }, price: 14000, visual: true, sexed: true },
  shadow_gloves:  { ac: "light", set: "shadow", name: "ถุงมือพรานเงา", type: "equip", slot: "gloves", lv: 30, bonus: { def: 7, dex: 3 }, price: 8000, visual: true, sexed: true },
  shadow_boots:   { ac: "light", set: "shadow", name: "รองเท้าพรานเงา", type: "equip", slot: "shoes", lv: 30, bonus: { def: 8, agi: 3 }, price: 8000, visual: true, sexed: true },
  // ---------- ชุดผ้า: นักเวท / นักบวช (Lv20) · จอมเวท / นักบุญ (Lv30) ----------
  mage_hat:       { ac: "cloth", set: "mage", name: "หมวกนักเวท", type: "equip", slot: "head", lv: 20, bonus: { def: 4, int: 2, maxSp: 20 }, price: 3800, visual: true },
  mage_robe:      { ac: "cloth", set: "mage", name: "ชุดคลุมนักเวท", type: "equip", slot: "armor", lv: 20, bonus: { def: 12, int: 3, maxSp: 30 }, price: 6200, visual: true, sexed: true },
  mage_gloves:    { ac: "cloth", set: "mage", name: "ถุงมือนักเวท", type: "equip", slot: "gloves", lv: 20, bonus: { def: 3, int: 2 }, price: 3400, visual: true, sexed: true },
  mage_shoes:     { ac: "cloth", set: "mage", name: "รองเท้านักเวท", type: "equip", slot: "shoes", lv: 20, bonus: { def: 3, dex: 2 }, price: 3400, visual: true, sexed: true },
  priest_hood:    { ac: "cloth", set: "priest", name: "ฮู้ดนักบวช", type: "equip", slot: "head", lv: 20, bonus: { def: 5, int: 2, vit: 1 }, price: 3800, visual: true },
  priest_robe:    { ac: "cloth", set: "priest", name: "ชุดคลุมนักบวช", type: "equip", slot: "armor", lv: 20, bonus: { def: 14, int: 2, vit: 2 }, price: 6200, visual: true, sexed: true },
  priest_gloves:  { ac: "cloth", set: "priest", name: "ถุงมือนักบวช", type: "equip", slot: "gloves", lv: 20, bonus: { def: 3, int: 1, maxSp: 15 }, price: 3400, visual: true, sexed: true },
  priest_shoes:   { ac: "cloth", set: "priest", name: "รองเท้านักบวช", type: "equip", slot: "shoes", lv: 20, bonus: { def: 4, maxHp: 30 }, price: 3400, visual: true, sexed: true },
  arch_hat:       { ac: "cloth", set: "arch", name: "หมวกจอมเวท", type: "equip", slot: "head", lv: 30, bonus: { def: 7, int: 4, maxSp: 40 }, price: 9000, visual: true },
  arch_robe:      { ac: "cloth", set: "arch", name: "ชุดคลุมจอมเวท", type: "equip", slot: "armor", lv: 30, bonus: { def: 20, int: 5, maxSp: 60 }, price: 14000, visual: true, sexed: true },
  arch_gloves:    { ac: "cloth", set: "arch", name: "ถุงมือจอมเวท", type: "equip", slot: "gloves", lv: 30, bonus: { def: 5, int: 3 }, price: 8000, visual: true, sexed: true },
  arch_shoes:     { ac: "cloth", set: "arch", name: "รองเท้าจอมเวท", type: "equip", slot: "shoes", lv: 30, bonus: { def: 5, dex: 3 }, price: 8000, visual: true, sexed: true },
  saint_crown:    { ac: "cloth", set: "saint", name: "มงกุฎนักบุญ", type: "equip", slot: "head", lv: 30, bonus: { def: 8, int: 3, vit: 2 }, price: 9000, visual: true },
  saint_robe:     { ac: "cloth", set: "saint", name: "ชุดคลุมนักบุญ", type: "equip", slot: "armor", lv: 30, bonus: { def: 22, int: 4, vit: 3 }, price: 14000, visual: true, sexed: true },
  saint_gloves:   { ac: "cloth", set: "saint", name: "ถุงมือนักบุญ", type: "equip", slot: "gloves", lv: 30, bonus: { def: 5, int: 2, maxSp: 30 }, price: 8000, visual: true, sexed: true },
  saint_shoes:    { ac: "cloth", set: "saint", name: "รองเท้านักบุญ", type: "equip", slot: "shoes", lv: 30, bonus: { def: 6, maxHp: 60 }, price: 8000, visual: true, sexed: true },
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
  rabbit_tail: { name: "หางกระต่ายปุย", type: "material", sell: 6 },
  rat_tail:    { name: "หางหนูยักษ์", type: "material", sell: 8 },
  wool:        { name: "ขนแกะ", type: "material", sell: 12 },
  lizard_scale:{ name: "เกล็ดกิ้งก่า", type: "material", sell: 20 },
  pumpkin:     { name: "ฟักทองเรืองแสง", type: "material", sell: 24 },
  rotten_cloth:{ name: "ผ้าเปื่อย", type: "material", sell: 30 },
  bat_wing:    { name: "ปีกค้างคาว", type: "material", sell: 45 },
  troll_hide:  { name: "หนังโทรลล์", type: "material", sell: 55 },
  bull_horn:   { name: "เขามิโนทอร์", type: "material", sell: 70 },
  frost_hide:  { name: "หนังโทรลล์หิมะ", type: "material", sell: 85 },
  goblin_ear: { name: "หูก็อบลิน", type: "material", sell: 4 },
  wolf_fang:  { name: "เขี้ยวหมาป่า", type: "material", sell: 10 },
  boar_tusk:  { name: "งาหมูป่า", type: "material", sell: 18 },
  old_bone:   { name: "กระดูกเก่า", type: "material", sell: 26 },
  orc_scrap:  { name: "เศษเกราะออร์ค", type: "material", sell: 40 },
};

// ร้านค้าในเมือง: แต่ละ NPC ขายของคนละหมวด (ทุกร้านรับซื้อของคืนได้)
const SHOPS = {
  shop_potion: { name: "ป้าบัวขาว", title: "ร้านยา", items: ["potion_s", "potion_m", "potion_sp"] },
  shop_weapon: { name: "พี่ศรเพชร", title: "ร้านอาวุธ", items: ["mace", "dagger", "saber", "greatsword", "bow_hunter", "staff_oak", "book_light", "kite", "shield_knight"] },
  shop_armor: { name: "ลุงหนักแน่น", title: "ร้านชุดเกราะ", items: ["bandana", "hood", "leather", "gloves", "boots", "cape", "chain", "mailcoif", "bracers", "ironboots",
    "ranger_cap", "ranger_vest", "ranger_gloves", "ranger_boots", "mage_hat", "mage_robe", "mage_gloves", "mage_shoes",
    "priest_hood", "priest_robe", "priest_gloves", "priest_shoes"] },
  merchant: { name: "ลุงสมปอง", title: "ร้านของจิปาถะ", items: ["ring_copper", "stone_1", "pet_sparrow", "pet_canary", "pet_bluebird"] },
};
// รายการของทุกร้านรวมกัน (ใช้ตรวจของที่ขายในร้าน / ราคาของ)
const SHOP = [...new Set(Object.values(SHOPS).flatMap((x) => x.items))];

// ของดรอปจากมอน: [itemId, โอกาส 0–1, จำนวนต่ำสุด, สูงสุด]
const DROPS = {
  goblin:   [["goblin_ear", 0.6, 1, 2], ["stone_1", 0.08, 1, 1], ["potion_s", 0.08, 1, 1], ["bandana", 0.015, 1, 1], ["gloves", 0.01, 1, 1]],
  wolf:     [["wolf_fang", 0.55, 1, 2], ["stone_1", 0.12, 1, 2], ["stone_2", 0.02, 1, 1], ["potion_s", 0.1, 1, 2], ["fang_necklace", 0.02, 1, 1], ["dagger", 0.01, 1, 1]],
  boar:     [["boar_tusk", 0.55, 1, 1], ["stone_1", 0.1, 1, 2], ["stone_2", 0.05, 1, 1], ["potion_m", 0.06, 1, 1], ["boar_charm", 0.02, 1, 1], ["nasal", 0.01, 1, 1]],
  skeleton: [["old_bone", 0.55, 1, 2], ["stone_2", 0.07, 1, 1], ["stone_3", 0.015, 1, 1], ["potion_m", 0.08, 1, 1], ["glasses", 0.02, 1, 1], ["plate", 0.008, 1, 1], ["mailcoif", 0.01, 1, 1]],
  orc:      [["orc_scrap", 0.55, 1, 2], ["stone_2", 0.08, 1, 2], ["stone_3", 0.03, 1, 1], ["potion_m", 0.1, 1, 2], ["waraxe", 0.01, 1, 1], ["plate", 0.01, 1, 1], ["ironboots", 0.012, 1, 1]],
  rabbit:      [["rabbit_tail", 0.6, 1, 1], ["potion_s", 0.08, 1, 1], ["stone_1", 0.06, 1, 1], ["boots", 0.012, 1, 1]],
  rat:         [["rat_tail", 0.6, 1, 2], ["stone_1", 0.08, 1, 1], ["gloves", 0.012, 1, 1], ["potion_s", 0.08, 1, 1]],
  sheep:       [["wool", 0.65, 1, 2], ["stone_1", 0.1, 1, 1], ["hood", 0.015, 1, 1], ["leather", 0.012, 1, 1]],
  lizard:      [["lizard_scale", 0.6, 1, 2], ["stone_1", 0.14, 1, 2], ["stone_2", 0.02, 1, 1], ["kite", 0.015, 1, 1], ["dagger", 0.012, 1, 1], ["bracers", 0.012, 1, 1]],
  jack:        [["pumpkin", 0.55, 1, 1], ["stone_1", 0.14, 1, 2], ["stone_2", 0.03, 1, 1], ["cape", 0.02, 1, 1], ["potion_m", 0.08, 1, 1], ["ironboots", 0.012, 1, 1]],
  zombie:      [["rotten_cloth", 0.6, 1, 2], ["stone_2", 0.06, 1, 1], ["chain", 0.012, 1, 1], ["potion_m", 0.1, 1, 1], ["mailcoif", 0.015, 1, 1]],
  vampire:     [["bat_wing", 0.55, 1, 2], ["stone_2", 0.09, 1, 1], ["stone_3", 0.02, 1, 1], ["fang_necklace", 0.03, 1, 1], ["glasses", 0.02, 1, 1], ["plateboots", 0.012, 1, 1], ["book_holy", 0.004, 1, 1], ["saint_gloves", 0.008, 1, 1], ["arch_gloves", 0.008, 1, 1]],
  troll:       [["troll_hide", 0.6, 1, 2], ["stone_2", 0.1, 1, 2], ["stone_3", 0.025, 1, 1], ["boar_charm", 0.02, 1, 1], ["nasal", 0.015, 1, 1], ["gauntlets", 0.015, 1, 1], ["shadow_boots", 0.008, 1, 1], ["arch_shoes", 0.008, 1, 1]],
  minotaur:    [["bull_horn", 0.55, 1, 2], ["stone_2", 0.12, 1, 2], ["stone_3", 0.04, 1, 1], ["waraxe", 0.025, 1, 1], ["plate", 0.015, 1, 1], ["gauntlets", 0.015, 1, 1], ["goldgaunt", 0.006, 1, 1], ["titanaxe", 0.006, 1, 1], ["shield_spartan", 0.006, 1, 1], ["shadow_vest", 0.005, 1, 1]],
  snowtroll:   [["frost_hide", 0.6, 1, 2], ["stone_3", 0.05, 1, 1], ["plate", 0.02, 1, 1], ["boar_charm", 0.025, 1, 1], ["goldplate", 0.004, 1, 1], ["goldhelm", 0.006, 1, 1], ["arch_robe", 0.005, 1, 1], ["saint_robe", 0.005, 1, 1], ["titanaxe", 0.005, 1, 1]],
  wolfpup:     [["wolf_fang", 0.4, 1, 1], ["stone_1", 0.08, 1, 1], ["potion_s", 0.08, 1, 1]],
  goblinchief: [["goblin_ear", 0.7, 1, 3], ["stone_1", 0.14, 1, 2], ["bandana", 0.02, 1, 1], ["ring_copper", 0.015, 1, 1], ["potion_s", 0.1, 1, 2]],
  redwolf:     [["wolf_fang", 0.6, 1, 2], ["stone_1", 0.12, 1, 2], ["stone_2", 0.03, 1, 1], ["fang_necklace", 0.025, 1, 1], ["cape", 0.015, 1, 1], ["bracers", 0.01, 1, 1]],
  skelwarrior: [["old_bone", 0.6, 1, 2], ["stone_2", 0.08, 1, 1], ["nasal", 0.015, 1, 1], ["plate", 0.01, 1, 1], ["potion_m", 0.1, 1, 1], ["greathelm", 0.012, 1, 1], ["staff_crystal", 0.003, 1, 1]],
  shadowwolf:  [["wolf_fang", 0.6, 2, 3], ["stone_2", 0.09, 1, 1], ["fang_necklace", 0.03, 1, 1], ["boots", 0.02, 1, 1], ["bow_shadow", 0.005, 1, 1], ["shadow_hood", 0.008, 1, 1], ["shadow_gloves", 0.008, 1, 1]],
  orcchief:    [["orc_scrap", 0.7, 2, 3], ["stone_2", 0.1, 1, 2], ["stone_3", 0.03, 1, 1], ["waraxe", 0.02, 1, 1], ["plate", 0.015, 1, 1], ["plateboots", 0.015, 1, 1], ["greathelm", 0.01, 1, 1], ["goldboots", 0.004, 1, 1], ["moonblade", 0.005, 1, 1], ["shield_spartan", 0.005, 1, 1]],
  snowwolf:    [["wolf_fang", 0.6, 2, 3], ["stone_2", 0.1, 1, 2], ["stone_3", 0.035, 1, 1], ["fang_necklace", 0.03, 1, 1], ["bow_shadow", 0.006, 1, 1], ["shadow_vest", 0.006, 1, 1], ["shadow_boots", 0.008, 1, 1]],
  frostskel:   [["old_bone", 0.6, 2, 3], ["stone_3", 0.045, 1, 1], ["glasses", 0.02, 1, 1], ["potion_m", 0.12, 1, 2], ["goldhelm", 0.005, 1, 1], ["staff_crystal", 0.005, 1, 1], ["arch_hat", 0.008, 1, 1], ["saint_crown", 0.008, 1, 1]],
  snoworc:     [["orc_scrap", 0.65, 2, 3], ["stone_3", 0.055, 1, 1], ["waraxe", 0.02, 1, 1], ["boar_charm", 0.02, 1, 1], ["goldboots", 0.006, 1, 1], ["moonblade", 0.006, 1, 1], ["saint_shoes", 0.008, 1, 1], ["book_holy", 0.005, 1, 1]],
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

module.exports = { SHOPS, STONE_FUSE, RARITY, rollRarity, makeGear, MAX_REFINE, REFINE, SAFE_REFINE, canRefine, refineGold, refineBonus, gearStats, EQUIP_SLOTS, SLOT_NAME, INVENTORY_SIZE, MAX_STACK, ITEMS, SHOP, DROPS, goldDrop, sellPrice, fitsSlot };

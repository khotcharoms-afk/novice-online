// =============================================================
//  ข้อมูลเกม — ปรับตัวเลขสมดุลเกมได้ที่ไฟล์นี้ไฟล์เดียว
// =============================================================

// ---------- หน้าตาตัวละคร (ต้องตรงกับไฟล์ใน public/assets/look) ----------
const APPEARANCE = {
  sex: ["m", "f"],
  skin: ["light", "olive", "bronze", "brown"],
  hair: { m: ["plain", "spiked", "messy1", "parted"], f: ["ponytail", "long", "pixie", "bunches"] },
  hairColor: ["black", "dark_brown", "chestnut", "blonde", "redhead", "platinum"],
};

// look = "เพศ|สีผิว|ทรงผม|สีผม" เช่น "m|light|spiked|blonde"
function sanitizeLook(look) {
  const [sex, skin, hair, color] = String(look || "").split("|");
  const s = APPEARANCE.sex.includes(sex) ? sex : "m";
  return [
    s,
    APPEARANCE.skin.includes(skin) ? skin : "light",
    APPEARANCE.hair[s].includes(hair) ? hair : APPEARANCE.hair[s][0],
    APPEARANCE.hairColor.includes(color) ? color : "chestnut",
  ].join("|");
}

// ---------- เลเวล & ค่าสถานะ ----------
const MAX_LEVEL = 99;
const JOB_CHANGE_LEVEL = 20;
const expToNext = (lv) => (lv >= MAX_LEVEL ? 0 : Math.round(30 * Math.pow(lv, 2.2)));

// ---------- สเตตัส ----------
// ทุกค่าเริ่มที่ 1
// แต้มที่ได้ต่อเลเวล = 3 + floor(เลเวล/5) (เลเวลสูงได้มากขึ้น) · รวมที่ Lv99 = 1,249 แต้ม
// ค่าใช้แต้มเพิ่มตามค่าปัจจุบัน: 1–10 ใช้ 1 แต้ม/หน่วย, 11–20 ใช้ 2, … 91–98 ใช้ 10 → อัป 1 ค่าถึง 99 ใช้ 530 แต้ม
// ⇒ Lv99 อัปได้ประมาณ 99 / 80 / 60 / 45 / 30 — ไม่มีทางได้ 99 ทุกค่า
const STAT_KEYS = ["str", "agi", "vit", "int", "dex"];
const STAT_INFO = {
  str: { name: "STR", th: "พลัง", desc: "พลังโจมตีระยะใกล้" },
  agi: { name: "AGI", th: "ว่องไว", desc: "ตีเร็วขึ้น, หลบการโจมตี" },
  vit: { name: "VIT", th: "อึด", desc: "HP สูงสุด, ป้องกัน" },
  int: { name: "INT", th: "ปัญญา", desc: "SP สูงสุด, พลังเวท (คทา/คัมภีร์), พลังฮีล" },
  dex: { name: "DEX", th: "แม่นยำ", desc: "ตีโดนแม่น, คริติคอล, พลังธนู" },
};
const START_POINTS = 5;
const STAT_MAX = 99;
const STAT_COST_STEP = 10;
const pointsAtLevel = (lv) => 3 + Math.floor(lv / 5);                       // แต้มที่ได้ตอนขึ้นเลเวล lv
const statCost = (x) => 1 + Math.floor((x - 1) / STAT_COST_STEP);           // แต้มที่ใช้เพื่อเพิ่มจาก x เป็น x+1
const costTo = (v) => { let t = 0; for (let x = 1; x < v; x++) t += statCost(x); return t; };
const totalPoints = (lv) => { let t = START_POINTS; for (let l = 2; l <= lv; l++) t += pointsAtLevel(l); return t; };
const baseStats = () => ({ str: 1, agi: 1, vit: 1, int: 1, dex: 1 });
const spentPoints = (st) => STAT_KEYS.reduce((n, k) => n + costTo(st[k]), 0);
// ลงแต้มตามสัดส่วน (ใช้กับปุ่มแนะนำ และตารางจำลองสมดุล): เลือกค่าที่ "ลงไปแล้ว/น้ำหนัก" น้อยสุดทีละหน่วย
function allocate(st, points, split) {
  const keys = Object.keys(split).filter((k) => split[k] > 0);
  const used = Object.fromEntries(keys.map((k) => [k, 0]));
  for (;;) {
    let best = null, bv = Infinity;
    for (const k of keys) {
      const c = statCost(st[k]);
      if (st[k] >= STAT_MAX || c > points) continue;
      const v = (used[k] + c) / split[k];
      if (v < bv) { bv = v; best = k; }
    }
    if (!best) break;
    const c = statCost(st[best]);
    st[best]++; used[best] += c; points -= c;
  }
  return points;
}

// ค่าที่คำนวณจากเลเวล + สเตตัส (สูตรที่ผ่านการจำลองสมดุลแล้ว — ดู docs/balance.md)
// job = อาชีพ (ตัวคูณ HP/SP/DEF) · wt = ชนิดอาวุธที่ถือ (กำหนดค่าหลักของพลังโจมตี และความเร็วตี)
const playerStats = (lv, st = baseStats(), job = "villager", wt = null) => {
  const J = JOBS[job] || JOBS.villager, Wt = (wt && WEAPON_TYPES[wt]) || WEAPON_TYPES.fist;
  const main = Wt.stat === "dex" ? st.dex * 2 + st.str * 0.5 : Wt.stat === "int" ? st.int * 2 + st.dex * 0.3
    : Wt.stat === "agi" ? st.agi * 1.8 + st.dex * 0.6 + st.str * 0.4 : st.str * 2 + st.dex * 0.5;
  return {
    maxHp: Math.round((50 + (lv - 1) * 14 + st.vit * 6) * J.hp),
    maxSp: Math.round((15 + (lv - 1) * 2 + st.int * 3) * J.sp),
    atk: Math.round((8 + lv * 2 + main) * (J.atk || 1)),
    def: (lv * 1.2 + st.vit * 0.6) * J.def,
    atkDelay: Math.round((800 / (1 + st.agi * 0.012)) * Wt.delay), // มิลลิวินาทีต่อการตี 1 ครั้ง
    flee: Math.min(0.35, st.agi * 0.0035),            // โอกาสหลบ
    hitBonus: st.dex * 0.005,                          // ลดโอกาสตีพลาด
    crit: Math.min(0.4, 0.05 + st.dex * 0.003),        // โอกาสคริติคอล
    healBonus: Math.round(st.int * (job === "healer" ? 4 : 2)), // ฮีลเพิ่ม
    range: Wt.range,                                   // ระยะโจมตีปกติ (px)
  };
};

// ---------- มอนสเตอร์ ----------
// ring = ระยะจากกลางแผนที่ (0 = กลาง, 1 = ขอบ) — ยิ่งไกลยิ่งแรง
// sprite = ภาพที่ใช้ (assets/mobs/<sprite>.png) · tint = ย้อมสี (0xRRGGBB) · scale = ขนาด · จุดเกิดอยู่ใน maps.js
const MONSTERS = {
  goblin:      { name: "ก็อบลินป่า",          level: 2,  sprite: "goblin",   speed: 70,  aggressive: false },
  rabbit:      { name: "กระต่ายป่า",          level: 3,  sprite: "rabbit",   speed: 90,  aggressive: false },
  rat:         { name: "หนูยักษ์",            level: 5,  sprite: "rat",      speed: 85,  aggressive: false },
  sheep:       { name: "แกะเขาโค้ง",          level: 7,  sprite: "sheep",    speed: 70,  aggressive: false },
  lizard:      { name: "มนุษย์กิ้งก่า",          level: 11, sprite: "lizard",   speed: 85,  aggressive: true },
  jack:        { name: "หุ่นไล่กาฟักทอง",       level: 12, sprite: "jack",     speed: 70,  aggressive: true },
  zombie:      { name: "ผีดิบ",               level: 16, sprite: "zombie",   speed: 60,  aggressive: true },
  vampire:     { name: "แวมไพร์",             level: 21, sprite: "vampire",  speed: 95,  aggressive: true },
  troll:       { name: "โทรลล์",              level: 24, sprite: "troll",    speed: 75,  aggressive: true,  scale: 1.12 },
  minotaur:    { name: "มิโนทอร์",             level: 27, sprite: "minotaur", speed: 90,  aggressive: true,  scale: 1.18 },
  snowtroll:   { name: "โทรลล์หิมะ",           level: 32, sprite: "snowtroll", speed: 75, aggressive: true,  scale: 1.15 },
  wolfpup:     { name: "ลูกหมาป่า",          level: 4,  sprite: "wolf",     speed: 85,  aggressive: false, tint: 0xd8c8b0, scale: 0.85 },
  wolf:        { name: "หมาป่าเร่ร่อน",       level: 6,  sprite: "wolf",     speed: 95,  aggressive: false },
  goblinchief: { name: "ก็อบลินหัวหน้า",       level: 8,  sprite: "goblin",   speed: 75,  aggressive: true,  tint: 0xff9a80, scale: 1.12 },
  boar:        { name: "หมูป่าคลั่ง",          level: 10, sprite: "boar",     speed: 80,  aggressive: true },
  redwolf:     { name: "หมาป่าแดง",          level: 13, sprite: "wolf",     speed: 100, aggressive: true,  tint: 0xff8a5a },
  skeleton:    { name: "โครงกระดูกเฝ้าป่า",    level: 14, sprite: "skeleton", speed: 75,  aggressive: true },
  orc:         { name: "ออร์คนักรบ",           level: 18, sprite: "orc",      speed: 85,  aggressive: true },
  skelwarrior: { name: "โครงกระดูกนักรบ",     level: 20, sprite: "skeleton", speed: 80,  aggressive: true,  tint: 0xffd890, scale: 1.1 },
  shadowwolf:  { name: "หมาป่าเงา",          level: 22, sprite: "wolf",     speed: 105, aggressive: true,  tint: 0x8a70c8 },
  orcchief:    { name: "หัวหน้าออร์ค",         level: 25, sprite: "orc",      speed: 85,  aggressive: true,  tint: 0xff7070, scale: 1.18 },
  snowwolf:    { name: "หมาป่าหิมะ",          level: 28, sprite: "wolf",     speed: 105, aggressive: true,  tint: 0xe8f4ff, scale: 1.05 },
  frostskel:   { name: "โครงกระดูกน้ำแข็ง",    level: 30, sprite: "skeleton", speed: 80,  aggressive: true,  tint: 0x90e0ff },
  snoworc:     { name: "ออร์คหิมะ",           level: 33, sprite: "orc",      speed: 85,  aggressive: true,  tint: 0xc8e8ff, scale: 1.15 },
  // ---------- โซนเลเวลสูง ----------
  frostgiant:   { name: "ยักษ์น้ำแข็ง",          level: 36, sprite: "frostgiant",   speed: 75,  aggressive: true,  scale: 1.2 },
  snowwraith:   { name: "ภูตหิมะ",              level: 38, sprite: "snowwraith",   speed: 95,  aggressive: true },
  icewolfman:   { name: "มนุษย์หมาป่าน้ำแข็ง",   level: 40, sprite: "icewolfman",   speed: 105, aggressive: true,  scale: 1.05 },
  frostcyclops: { name: "ไซคลอปส์หิมะ",         level: 43, sprite: "frostcyclops", speed: 75,  aggressive: true,  scale: 1.25 },
  bogzombie:    { name: "ผีดิบหนองน้ำ",          level: 44, sprite: "bogzombie",    speed: 65,  aggressive: true },
  venomlizard:  { name: "มนุษย์กิ้งก่าพิษ",       level: 46, sprite: "venomlizard",  speed: 95,  aggressive: true,  scale: 1.05 },
  bogboar:      { name: "หมูป่าบึงมรณะ",         level: 48, sprite: "bogboar",      speed: 85,  aggressive: true,  scale: 1.12 },
  swampwitch:   { name: "แม่มดบึง",             level: 51, sprite: "swampwitch",   speed: 80,  aggressive: true },
  skelknight:   { name: "อัศวินโครงกระดูก",      level: 52, sprite: "skelknight",   speed: 80,  aggressive: true,  scale: 1.08 },
  frankenstein: { name: "มนุษย์ปะติดปะต่อ",      level: 54, sprite: "frankenstein", speed: 70,  aggressive: true,  scale: 1.18 },
  gargoyle:     { name: "การ์กอยล์",             level: 56, sprite: "gargoyle",     speed: 100, aggressive: true,  scale: 1.1 },
  lich:         { name: "ลิช",                  level: 59, sprite: "lich",         speed: 75,  aggressive: true,  scale: 1.1 },
  cursedwolf:   { name: "หมาป่าคำสาป",          level: 60, sprite: "cursedwolf",   speed: 110, aggressive: true,  scale: 1.08 },
  wartotaur:    { name: "วอร์ทอร์",              level: 62, sprite: "wartotaur",    speed: 85,  aggressive: true,  scale: 1.2 },
  dryad:        { name: "นางไม้ต้องสาป",         level: 64, sprite: "dryad",        speed: 90,  aggressive: true },
  vamplord:     { name: "ลอร์ดแวมไพร์",          level: 67, sprite: "vamplord",     speed: 100, aggressive: true,  scale: 1.12 },
  salamander:   { name: "ซาลาแมนเดอร์",          level: 68, sprite: "salamander",   speed: 95,  aggressive: true,  scale: 1.05 },
  flameorc:     { name: "ออร์คเพลิง",            level: 70, sprite: "flameorc",     speed: 85,  aggressive: true,  scale: 1.15 },
  firedemon:    { name: "ปีศาจเพลิง",            level: 72, sprite: "firedemon",    speed: 100, aggressive: true,  scale: 1.12 },
  lavataur:     { name: "มิโนทอร์ลาวา",          level: 75, sprite: "lavataur",     speed: 90,  aggressive: true,  scale: 1.25 },
  mummy:        { name: "มัมมี่",                level: 76, sprite: "mummy",        speed: 70,  aggressive: true },
  sandrat:      { name: "หนูยักษ์ทะเลทราย",       level: 78, sprite: "sandrat",      speed: 105, aggressive: true,  scale: 1.05 },
  sandspirit:   { name: "ภูตทราย",              level: 80, sprite: "sandspirit",   speed: 90,  aggressive: true },
  sandwarlord:  { name: "ขุนศึกทะเลทราย",        level: 83, sprite: "sandwarlord",  speed: 85,  aggressive: true,  scale: 1.22 },
  draconian:    { name: "ดราโคเนียน",            level: 84, sprite: "draconian",    speed: 95,  aggressive: true,  scale: 1.1 },
  wyvern:       { name: "ไวเวิร์น",              level: 86, sprite: "wyvern",       speed: 110, aggressive: true,  scale: 1.12 },
  dragonknight: { name: "อัศวินมังกร",           level: 89, sprite: "dragonknight", speed: 90,  aggressive: true,  scale: 1.15 },
  volcanogiant: { name: "ยักษ์ภูเขาไฟ",          level: 91, sprite: "volcanogiant", speed: 75,  aggressive: true,  scale: 1.3 },
  deathknight:  { name: "อัศวินมรณะ",            level: 92, sprite: "deathknight",  speed: 90,  aggressive: true,  scale: 1.15 },
  shadowdemon:  { name: "ปีศาจเงา",              level: 94, sprite: "shadowdemon",  speed: 105, aggressive: true,  scale: 1.12 },
  darkcyclops:  { name: "ไซคลอปส์ทมิฬ",          level: 96, sprite: "darkcyclops",  speed: 80,  aggressive: true,  scale: 1.3 },
  abysslord:    { name: "จอมมารแห่งห้วงลึก",      level: 98, sprite: "abysslord",    speed: 95,  aggressive: true,  scale: 1.3 },
};
// ---------- มอนรูปร่างไม่ใช่คน (ภาพวาดด้วยโค้ด tools/mobs/creatures.py) ----------
// mat = วัตถุดิบที่ดรอป · borrow = ยืมรายการอุปกรณ์ที่ดรอปจากมอนตัวนี้ (แผนที่เดียวกัน)
Object.assign(MONSTERS, {
  slime_green:  { name: "สไลม์เขียว",           level: 3,  sprite: "slime_green",  speed: 55,  aggressive: false, mat: ["slime_gel", "เจลสไลม์"], borrow: "rabbit" },
  shroom_red:   { name: "เห็ดพิษเดินได้",        level: 9,  sprite: "shroom_red",   speed: 55,  aggressive: true,  mat: ["red_spore", "สปอร์เห็ดพิษ"], borrow: "lizard", poison: { pct: 12, ms: 5000 } },
  bat_brown:    { name: "ค้างคาวผลไม้",          level: 12, sprite: "bat_brown",    speed: 115, aggressive: true,  mat: ["bat_fang", "เขี้ยวค้างคาว"], borrow: "redwolf", flee: 0.2 },
  ghost_white:  { name: "วิญญาณเร่ร่อน",         level: 17, sprite: "ghost_white",  speed: 80,  aggressive: true,  mat: ["ectoplasm", "เอ็กโทพลาสซึม"], borrow: "skeleton", ranged: { range: 160, fx: "ice", every: 2000 } },
  golem_stone:  { name: "โกเลมหิน",             level: 26, sprite: "golem_stone",  speed: 55,  aggressive: true,  scale: 1.1, mat: ["golem_core", "แกนโกเลม"], borrow: "troll", charge: { every: 8000, mult: 2 } },
  slime_ice:    { name: "สไลม์น้ำแข็ง",          level: 30, sprite: "slime_ice",    speed: 60,  aggressive: true,  mat: ["ice_gel", "เจลน้ำแข็ง"], borrow: "frostskel" },
  wisp_frost:   { name: "ภูตน้ำแข็ง",            level: 41, sprite: "wisp_frost",   speed: 95,  aggressive: true,  mat: ["frost_essence", "แก่นน้ำแข็ง"], ranged: { range: 180, fx: "ice", every: 1800 } },
  slime_poison: { name: "สไลม์พิษ",              level: 44, sprite: "slime_poison", speed: 60,  aggressive: true,  mat: ["venom_gel", "เจลพิษ"], poison: { pct: 14, ms: 6000 } },
  spider_bog:   { name: "แมงมุมบึง",             level: 47, sprite: "spider_bog",   speed: 105, aggressive: true,  mat: ["bog_silk", "ใยแมงมุมบึง"], poison: { pct: 12, ms: 6000 }, charge: { every: 8000, mult: 1.5 } },
  plant_bog:    { name: "ดอกไม้กินคน",           level: 50, sprite: "plant_bog",    speed: 30,  aggressive: true,  scale: 1.1, mat: ["maneater_petal", "กลีบดอกกินคน"], ranged: { range: 170, fx: "poison", every: 1900 } },
  eye_float:    { name: "ดวงตาลอยได้",           level: 55, sprite: "eye_float",    speed: 75,  aggressive: true,  mat: ["floating_eye", "ลูกตาลอยได้"], ranged: { range: 190, fx: "magic", every: 1800 } },
  ghost_dark:   { name: "วิญญาณอัศวิน",          level: 57, sprite: "ghost_dark",   speed: 85,  aggressive: true,  mat: ["dark_ecto", "วิญญาณมืด"], ranged: { range: 170, fx: "dark", every: 1800 } },
  bat_vampire:  { name: "ค้างคาวแวมไพร์",         level: 61, sprite: "bat_vampire",  speed: 120, aggressive: true,  mat: ["vamp_fang", "เขี้ยวค้างคาวแวมไพร์"], charge: { every: 6000, mult: 1.6 } },
  shroom_glow:  { name: "เห็ดเรืองแสง",          level: 63, sprite: "shroom_glow",  speed: 55,  aggressive: true,  mat: ["glow_spore", "สปอร์เรืองแสง"], healer: { every: 6000, pct: 18, r: 200 }, ranged: { range: 150, fx: "magic", every: 2100 } },
  plant_cursed: { name: "ดอกไม้ต้องสาป",         level: 65, sprite: "plant_cursed", speed: 30,  aggressive: true,  scale: 1.15, mat: ["cursed_petal", "กลีบต้องสาป"], ranged: { range: 180, fx: "poison", every: 1800 }, poison: { pct: 10, ms: 5000 } },
  wisp_fire:    { name: "ภูตเพลิง",              level: 69, sprite: "wisp_fire",    speed: 100, aggressive: true,  mat: ["fire_essence", "แก่นเพลิง"], ranged: { range: 180, fx: "fire", every: 1700 } },
  slime_lava:   { name: "สไลม์ลาวา",             level: 71, sprite: "slime_lava",   speed: 60,  aggressive: true,  mat: ["lava_gel", "เจลลาวา"], poison: { pct: 14, ms: 5000 } },
  golem_magma:  { name: "โกเลมแมกมา",            level: 74, sprite: "golem_magma",  speed: 55,  aggressive: true,  scale: 1.15, mat: ["magma_core", "แกนแมกมา"], charge: { every: 7000, mult: 2.1 } },
  spider_sand:  { name: "แมงมุมทราย",            level: 79, sprite: "spider_sand",  speed: 110, aggressive: true,  mat: ["sand_silk", "ใยแมงมุมทราย"], poison: { pct: 12, ms: 6000 }, charge: { every: 7000, mult: 1.6 } },
  golem_sand:   { name: "โกเลมทราย",             level: 81, sprite: "golem_sand",   speed: 55,  aggressive: true,  scale: 1.15, mat: ["sand_core", "แกนโกเลมทราย"], charge: { every: 7000, mult: 2 } },
  bat_drake:    { name: "ค้างคาวมังกร",          level: 87, sprite: "bat_drake",    speed: 120, aggressive: true,  scale: 1.05, mat: ["drake_wing", "ปีกค้างคาวมังกร"], ranged: { range: 170, fx: "fire", every: 1900 } },
  eye_abyss:    { name: "ดวงตาอเวจี",            level: 93, sprite: "eye_abyss",    speed: 75,  aggressive: true,  scale: 1.1, mat: ["abyss_eye", "ลูกตาอเวจี"], ranged: { range: 200, fx: "dark", every: 1700 } },
  ghost_abyss:  { name: "วิญญาณอเวจี",           level: 95, sprite: "ghost_abyss",  speed: 90,  aggressive: true,  scale: 1.1, mat: ["abyss_ecto", "วิญญาณอเวจี"], ranged: { range: 180, fx: "dark", every: 1700 }, flee: 0.1 },
  slime_abyss:  { name: "สไลม์อเวจี",            level: 97, sprite: "slime_abyss",  speed: 65,  aggressive: true,  scale: 1.1, mat: ["abyss_gel", "เจลอเวจี"], poison: { pct: 14, ms: 6000 } },
});

// ---------- พฤติกรรมพิเศษของมอน ----------
// ranged = ยิงจากระยะไกล {range, fx, every} · charge = พุ่งชน (มีเส้นเตือน) {every, mult}
// poison = ติดพิษ {pct ของ ATK ต่อวินาที, ms} · healer = ฮีลพวกเดียวกัน {every, pct, r} · flee = หนีเมื่อเลือดต่ำกว่า (สัดส่วน)
const BEHAVIOR = {
  goblin: { flee: 0.25 }, rabbit: { flee: 0.35 }, sheep: { flee: 0.3 }, wolfpup: { flee: 0.3 },
  rat: { poison: { pct: 15, ms: 5000 } }, zombie: { poison: { pct: 12, ms: 6000 } },
  boar: { charge: { every: 7000, mult: 1.8 } }, wolf: { charge: { every: 9000, mult: 1.5 } }, redwolf: { charge: { every: 8000, mult: 1.6 } },
  lizard: { ranged: { range: 150, fx: "poison", every: 1900 } }, jack: { ranged: { range: 160, fx: "fire", every: 2000 } },
  vampire: { ranged: { range: 150, fx: "dark", every: 1800 }, flee: 0.15 }, frostskel: { ranged: { range: 170, fx: "ice", every: 1900 } },
  minotaur: { charge: { every: 6500, mult: 2 } }, orcchief: { charge: { every: 8000, mult: 1.8 } }, troll: { charge: { every: 9000, mult: 1.7 } },
  frostgiant: { charge: { every: 8000, mult: 1.8 } }, snowwraith: { ranged: { range: 170, fx: "ice", every: 1800 } },
  frostcyclops: { ranged: { range: 180, fx: "rock", every: 2200 } },
  bogzombie: { poison: { pct: 12, ms: 6000 } }, venomlizard: { poison: { pct: 15, ms: 6000 }, charge: { every: 9000, mult: 1.5 } },
  bogboar: { charge: { every: 6500, mult: 1.9 } }, swampwitch: { ranged: { range: 170, fx: "poison", every: 1900 }, healer: { every: 7000, pct: 18, r: 200 } },
  skelknight: { charge: { every: 9000, mult: 1.6 } }, gargoyle: { charge: { every: 7000, mult: 1.7 } },
  lich: { ranged: { range: 180, fx: "dark", every: 1800 }, healer: { every: 8000, pct: 15, r: 200 } },
  cursedwolf: { charge: { every: 6000, mult: 1.6 }, flee: 0.12 }, wartotaur: { charge: { every: 6500, mult: 2 } },
  dryad: { ranged: { range: 170, fx: "poison", every: 1900 }, healer: { every: 6000, pct: 20, r: 220 } },
  vamplord: { ranged: { range: 160, fx: "dark", every: 1700 }, flee: 0.15 },
  salamander: { ranged: { range: 160, fx: "fire", every: 1800 }, poison: { pct: 10, ms: 5000 } }, flameorc: { charge: { every: 8000, mult: 1.8 } },
  firedemon: { ranged: { range: 180, fx: "fire", every: 1700 } }, lavataur: { charge: { every: 6000, mult: 2.1 } },
  mummy: { poison: { pct: 12, ms: 7000 } }, sandrat: { flee: 0.2, poison: { pct: 10, ms: 5000 } },
  sandspirit: { ranged: { range: 180, fx: "magic", every: 1700 }, healer: { every: 7000, pct: 15, r: 200 } },
  sandwarlord: { charge: { every: 7000, mult: 2 } }, draconian: { ranged: { range: 180, fx: "fire", every: 1800 } },
  wyvern: { charge: { every: 6000, mult: 1.8 }, poison: { pct: 10, ms: 6000 } }, dragonknight: { charge: { every: 7000, mult: 2 } },
  volcanogiant: { ranged: { range: 190, fx: "rock", every: 2300 } }, deathknight: { charge: { every: 7000, mult: 2 } },
  shadowdemon: { ranged: { range: 190, fx: "dark", every: 1700 } }, darkcyclops: { ranged: { range: 190, fx: "rock", every: 2100 }, charge: { every: 9000, mult: 2 } },
  abysslord: { charge: { every: 6000, mult: 2.2 }, ranged: { range: 170, fx: "dark", every: 2000 } },
};
for (const [k, b] of Object.entries(BEHAVIOR)) if (MONSTERS[k]) Object.assign(MONSTERS[k], b);

// ---------- มินิบอสประจำแผนที่ (เกิดใหม่ 8–12 นาทีหลังตาย) ----------
const MINI_BOSSES = {
  meadow: { base: "goblin", name: "ราชาก็อบลินหัวโต", level: 8, tint: 0xff9a80, scale: 1.8, charge: { every: 7000, mult: 1.6 }, flee: 0 },
  pine:   { base: "lizard", name: "จอมเวทกิ้งก่าบึง", level: 15, tint: 0xa0ff90, scale: 1.7 },
  maple:  { base: "jack", name: "ราชาฟักทองคลั่ง", level: 21, tint: 0xffb060, scale: 1.8 },
  bones:  { base: "vampire", name: "เคานต์แวมไพร์", level: 25, tint: 0xff8090, scale: 1.6, flee: 0 },
  orcamp: { base: "orcchief", name: "แม่ทัพออร์คเลือดเหล็ก", level: 30, tint: 0xff6060, scale: 1.8 },
  snow:   { base: "snowtroll", name: "ราชาโทรลล์น้ำแข็ง", level: 37, tint: 0xc0f0ff, scale: 1.8, charge: { every: 7000, mult: 2 } },
  frost:  { base: "frostcyclops", name: "ไซคลอปส์ภูผาหิมะ", level: 47, scale: 1.7, charge: { every: 8000, mult: 2 } },
  swamp:  { base: "swampwitch", name: "แม่มดหนองมรณะ", level: 55, tint: 0xc0ffa0, scale: 1.7 },
  ruins:  { base: "lich", name: "อาร์ชลิชผู้ถูกสาป", level: 63, tint: 0xd8a0ff, scale: 1.7 },
  cursed: { base: "vamplord", name: "ราชันแวมไพร์โลหิต", level: 71, tint: 0xff8080, scale: 1.6, flee: 0 },
  lava:   { base: "lavataur", name: "มิโนทอร์ภูเขาไฟ", level: 79, scale: 1.7 },
  desert: { base: "mummy", name: "ฟาโรห์ผู้ตื่นคืน", level: 87, tint: 0xffe090, scale: 1.8, ranged: { range: 180, fx: "magic", every: 1900 } },
  dragon: { base: "dragonknight", name: "ขุนพลมังกรเพลิง", level: 95, tint: 0xffc080, scale: 1.7, ranged: { range: 170, fx: "fire", every: 2000 } },
  abyss:  { base: "abysslord", name: "เจ้าแห่งห้วงอเวจี", level: 99, tint: 0xd090ff, scale: 1.6 },
};
const monsterStats = (lv) => ({
  maxHp: 30 + lv * 20 + Math.round(0.5 * lv * lv),
  atk: 3 + Math.round(lv * 3.2),
  def: lv,
  exp: Math.round(6 * Math.pow(lv, 1.5)),
});
const MONSTER_RESPAWN_MS = 8000;

// ---------- World Boss ----------
// เรียกจากหน้า admin (ไม่เกิดใหม่เอง) · ค่าพลัง = มอนเลเวลเดียวกัน × ตัวคูณ
// slam = ทุบพื้นเป็นวง (เตือนก่อน cast ms) · summon = เรียกลูกน้องเมื่อเลือดต่ำกว่า at · enrage = คลั่งเมื่อเลือดต่ำกว่า
const WORLD_BOSSES = {
  bloodking: {
    name: "ราชันโลหิตมิโนทอร์", level: 32, sprite: "minotaur", tint: 0xff5a4a, scale: 2.1, speed: 80, aggressive: true,
    hpMul: 30, atkMul: 1.5, defMul: 1.6, expMul: 40, goldMul: 25, range: 70,
    slam: { every: 9000, cast: 1300, r: 140, mult: 2.2 },
    summon: { at: [0.6, 0.3], kind: "orcchief", n: 3 },
    enrage: 0.3,
    // set = ชุดพิเศษของบอส: ดรอปแน่นอน 1 ชิ้นต่อการปราบ (สุ่มชิ้น ระดับน้ำเงินขึ้นไป · ใครก็เก็บได้)
    loot: { gear: 4, set: ["azure_helm", "azure_plate", "azure_gaunt", "azure_boots", "azure_cape", "azure_blade"], pool: ["goldhelm", "goldplate", "goldgaunt", "goldboots", "cape_shadow", "shades_hawk", "moonblade", "shield_spartan", "war_horn",
      "quiver_wind", "orb_star", "relic_holy", "judgehammer", "shadow_kris", "titanaxe", "bow_shadow", "staff_crystal", "book_holy",
      "shadow_vest", "arch_robe", "saint_robe", "cape_royal", "ring_dragon", "amulet_frost", "necklace_wind", "talisman_titan"],
      items: [["stone_3", 3, 5], ["potion_m", 5, 8]] },
  },
};

// ---------- อาชีพ ----------
// armor = ประเภทเกราะที่ใส่ได้ (ของ Lv ต่ำกว่า 20 ใส่ได้ทุกอาชีพ) · weapons = ชนิดอาวุธที่ใช้ได้ · shield = ใช้โล่ได้
// offhand = ชนิดมือรองประจำอาชีพ (โล่/ตรา/กระบอกธนู/ลูกแก้ว/เครื่องราง) · atk/hp/sp/def = ตัวคูณค่าพลัง · rec = สัดส่วนลงแต้มแนะนำ
const JOBS = {
  villager: { name: "ชาวบ้าน", en: "Villager", color: "#cfd3dd", offhand: null, atk: 1, armor: null, weapons: null, shield: true, hp: 1, sp: 1, def: 1,
    rec: { str: 0.4, vit: 0.3, agi: 0.2, dex: 0.1, int: 0 }, role: "เริ่มต้น", desc: "ทุกคนเริ่มจากชาวบ้าน ถึง Lv.20 แล้วไปหาครูฝึกอาชีพที่เมืองเพื่อเปลี่ยนอาชีพ" },
  guardian: { name: "ผู้พิทักษ์", en: "Guardian", color: "#6fb6ff", offhand: "shield", atk: 0.9, armor: ["heavy"], weapons: ["sword", "mace"], shield: true, hp: 1.35, sp: 0.9, def: 1.2,
    rec: { vit: 0.4, str: 0.3, dex: 0.15, agi: 0.15, int: 0 }, role: "แทงก์ · ป้องกัน",
    desc: "ถือดาบกับโล่ ยืนหน้าสุดของปาร์ตี้ ดึงความสนใจมอนมาที่ตัวเองและรับดาเมจแทนเพื่อน" },
  slayer: { name: "นักดาบใหญ่", en: "Slayer", color: "#ff7a6b", offhand: "emblem", atk: 1.1, armor: ["heavy"], weapons: ["greatsword", "axe"], shield: false, hp: 1.2, sp: 0.9, def: 1,
    rec: { str: 0.45, agi: 0.25, vit: 0.2, dex: 0.1, int: 0 }, role: "ตีแรงระยะใกล้ · คอมโบ",
    desc: "ใช้ดาบใหญ่หรือขวานสองมือ ตีปกติสะสมคอมโบแล้วปิดท้ายด้วยท่าปลิดชีพ ฟันกวาดโดนหลายตัว" },
  hunter: { name: "นักล่า", en: "Hunter", color: "#7dff9a", offhand: "quiver", atk: 1, armor: ["light"], weapons: ["bow", "dagger"], shield: false, hp: 1, sp: 1, def: 1,
    rec: { dex: 0.45, agi: 0.3, vit: 0.15, str: 0.1, int: 0 }, role: "ยิงไกล · คล่องตัว",
    desc: "ยิงธนูจากระยะไกล เคลื่อนที่เร็ว พลังโจมตีมาจาก DEX" },
  mage: { name: "นักเวทย์", en: "Mage", color: "#c38bff", offhand: "orb", atk: 1, armor: ["cloth"], weapons: ["staff"], shield: false, hp: 0.85, sp: 1.5, def: 0.9,
    rec: { int: 0.5, dex: 0.25, vit: 0.2, agi: 0.05, str: 0 }, role: "เวทโจมตีหมู่",
    desc: "ใช้คทา ร่ายเวทโจมตีระยะไกล เวทวงกว้างเก็บมอนทีละหลายตัว พลังมาจาก INT" },
  healer: { name: "หมอ", en: "Healer", color: "#ffe28a", offhand: "relic", atk: 0.75, armor: ["cloth"], weapons: ["book", "mace"], shield: false, hp: 0.95, sp: 1.4, def: 1,
    rec: { int: 0.45, vit: 0.3, dex: 0.15, agi: 0.1, str: 0 }, role: "ฮีล · บัฟ",
    desc: "ใช้คัมภีร์ลอยข้างตัว ฮีลเพื่อน ให้พรเพิ่มพลังทั้งปาร์ตี้ แสงพิพากษาแรงพิเศษกับอันเดด" },
};
const JOB_NAME = Object.fromEntries(Object.entries(JOBS).map(([k, j]) => [k, j.name]));
const RECOMMEND = JOBS.villager.rec;
const ARMOR_NAME = { heavy: "เกราะหนัก", light: "เกราะเบา", cloth: "ชุดผ้า" };
const JOB_FREE_LV = 20; // อุปกรณ์ป้องกันที่ Lv ต่ำกว่านี้ ใส่ได้ทุกอาชีพ
// ชนิดอาวุธ: stat = ค่าหลักของพลังโจมตี · range = ระยะตี · delay = ตัวคูณเวลาต่อการตี · twoHand = ใส่โล่ไม่ได้ · fx = ภาพตอนตี
// trait = คุณสมบัติประจำชนิดอาวุธ (สเตตัส % แบบเดียวกับสเตตัสแฝง) — เลือกอาวุธต่างชนิด = เล่นคนละแบบ
const WEAPON_TYPES = {
  fist:       { name: "มือเปล่า", stat: "str", range: 44, delay: 1 },
  sword:      { name: "ดาบ", stat: "str", range: 44, delay: 1, trait: { critPct: 3, flee: 2 }, style: "สมดุล ตีแม่น หลบดี" },
  mace:       { name: "กระบอง/ค้อน", stat: "str", range: 44, delay: 1.1, trait: { ignoreDef: 30, undeadDmg: 10 }, style: "เจาะเกราะ แรงกับอันเดด ตีช้ากว่าดาบ" },
  dagger:     { name: "มีดสั้น", stat: "agi", range: 44, delay: 0.8, trait: { critPct: 10, critDmg: 10 }, style: "ใช้ AGI · ตีเร็วมาก คริบ่อย" },
  greatsword: { name: "ดาบใหญ่", stat: "str", range: 50, delay: 1.15, twoHand: true, trait: { critPct: 5, critDmg: 15 }, style: "คริแรง" },
  axe:        { name: "ขวาน", stat: "str", range: 48, delay: 1.25, twoHand: true, trait: { atkPct: 12, ignoreDef: 10 }, style: "ตีหนักแต่ช้า" },
  bow:        { name: "ธนู", stat: "dex", range: 190, delay: 1.05, twoHand: true, fx: "arrow", trait: { critPct: 3 }, style: "ยิงไกล" },
  staff:      { name: "คทา", stat: "int", range: 170, delay: 1.3, twoHand: true, fx: "magic", trait: { spPct: 10 }, style: "เวทแรง SP เยอะ" },
  book:       { name: "คัมภีร์", stat: "int", range: 150, delay: 1.25, fx: "holy", trait: { healPct: 10 }, style: "ฮีลแรงขึ้น" },
};
const UNDEAD = ["ghost_white", "ghost_dark", "ghost_abyss", "skeleton", "zombie", "vampire", "skelwarrior", "frostskel", "snowwraith", "bogzombie", "skelknight", "lich", "vamplord", "mummy", "deathknight"];

// ---------- สกิล ----------
// ได้แต้มสกิล 1 แต้มทุกครั้งที่เลเวลอัป · กด + ในหน้าต่างสกิลเพื่ออัปทีละขั้น
// max = เลเวลสูงสุดของสกิล · innate = เลเวลที่ได้ฟรีตั้งแต่เริ่ม · req = [สกิลที่ต้องมีก่อน, เลเวล]
// passive = สกิลติดตัว (ไม่ต้องกดใช้) · ค่าที่เป็น [a, b] = a + b × เลเวลสกิล
// target: "self" = ใช้กับตัวเอง, "mob" = ต้องมีเป้าหมายมอนสเตอร์, "ally" = ฮีลเพื่อน (เลือดน้อยสุดในระยะ รวมตัวเอง)
// mult = ตัวคูณดาเมจ · area = รัศมีวงกว้าง · buff = บัฟที่ได้ (ค่าใน bv) · fx = ภาพเอฟเฟกต์ · auto = AUTO ใช้แบบไหน
// icon = ไอคอนไอเทมที่ใช้เป็นรูปสกิล · color = สีพื้นไอคอน
const SKILLS = {
  // ===== ชาวบ้าน =====
  basic:      { name: "ทักษะพื้นฐาน", passive: true, max: 5, icon: "skill_basic", color: "#8a6a3a",
    desc: (L) => `ATK +${2 * L} · DEF +${L} · HP/SP สูงสุด +${L}%`, pas: (L) => ({ atk: 2 * L, def: L, hpPct: L, spPct: L }) },
  firstaid:   { name: "ปฐมพยาบาล", max: 5, innate: 1, sp: [10, 0], cooldown: 20000, target: "self", auto: "heal", icon: "skill_firstaid", color: "#2f8a4a",
    heal: [0.04, 0.02], desc: (L) => `ปฐมพยาบาลตัวเอง ฟื้น HP ${Math.round((0.04 + 0.02 * L) * 100)}% (+INT×2) · คูลดาวน์ 20 วิ`, fx: { type: "heal", color: 0x7dffa8 } },
  doublehit:  { name: "ฟันซ้ำ", max: 5, sp: [5, 0], cooldown: 5000, target: "mob", range: 60, auto: "dmg", icon: "skill_doublehit", color: "#7a4a2a",
    mult: [0.8, 0.05], desc: (L) => `ตี 2 ครั้งติด ครั้งละ ${Math.round((0.8 + 0.05 * L) * 100)}%` },
  // ===== ผู้พิทักษ์ =====
  swordmastery: { name: "ชำนาญดาบ", passive: true, max: 10, icon: "skill_swordmastery", color: "#3a5a9a",
    desc: (L) => `ATK +${3 * L} เมื่อถือดาบหรือกระบอง`, pas: (L, wt) => (wt === "sword" || wt === "mace" ? { atk: 3 * L } : {}) },
  ironbody:   { name: "กายเหล็ก", passive: true, max: 10, icon: "skill_ironbody", color: "#5a6a7a",
    desc: (L) => `HP สูงสุด +${2 * L}% · DEF +${L}`, pas: (L) => ({ hpPct: 2 * L, def: L }) },
  shieldbash: { name: "กระแทกโล่", max: 10, sp: [6, 0.5], cooldown: 6000, target: "mob", range: 56, auto: "dmg", icon: "skill_shieldbash", color: "#4a6ab0",
    mult: [1.2, 0.08], stun: [1000, 100], desc: (L) => `ดาเมจ ${Math.round((1.2 + 0.08 * L) * 100)}% + มึนงง ${(1 + 0.1 * L).toFixed(1)} วิ`, fx: { type: "hit", color: 0xffffff } },
  provoke:    { name: "ท้าทาย", max: 5, req: ["shieldbash", 3], sp: [10, 0], cooldown: 12000, target: "self", area: [100, 20], buff: "provoke", auto: "pull", icon: "skill_provoke", color: "#a04040",
    bv: (L) => ({ def: 1.1 + 0.05 * L }), desc: (L) => `ดึงมอนรอบตัว ${Math.round((100 + 20 * L) / 32)} ช่อง มาตีเรา + DEF +${10 + 5 * L}% 8 วิ`, fx: { type: "ring", color: 0xff6b6b } },
  shieldwall: { name: "กำแพงโล่", max: 5, req: ["ironbody", 5], sp: [15, 0], cooldown: 25000, target: "self", buff: "shieldwall", auto: "def", icon: "skill_shieldwall", color: "#2a5a9a",
    bv: (L) => ({ taken: 0.8 - 0.07 * L, ms: 6000 + 1000 * L }), desc: (L) => `ลดดาเมจที่ได้รับ ${Math.round((0.2 + 0.07 * L) * 100)}% นาน ${6 + L} วิ`, fx: { type: "ring", color: 0x6fb6ff } },
  // ===== นักดาบใหญ่ =====
  gsmastery:  { name: "ชำนาญอาวุธสองมือ", passive: true, max: 10, icon: "skill_gsmastery", color: "#8a3a2a",
    desc: (L) => `ATK +${3 * L} เมื่อถือดาบใหญ่หรือขวาน`, pas: (L, wt) => (wt === "greatsword" || wt === "axe" ? { atk: 3 * L } : {}) },
  cleave:     { name: "ฟันกวาด", max: 10, sp: [8, 0.5], cooldown: 6000, target: "mob", range: 60, auto: "dmg", icon: "skill_cleave", color: "#b05a2a",
    mult: [0.9, 0.06], area: [64, 4], desc: (L) => `ดาเมจ ${Math.round((0.9 + 0.06 * L) * 100)}% ทุกตัวรอบเป้าหมาย ${((64 + 4 * L) / 32).toFixed(1)} ช่อง`, fx: { type: "aoe", color: 0xff9a5a } },
  fury:       { name: "โทสะ", max: 5, req: ["gsmastery", 5], sp: [15, 0], cooldown: 30000, target: "self", buff: "fury", auto: "buff", icon: "skill_fury", color: "#c02a2a",
    bv: (L) => ({ atk: 1.1 + 0.05 * L, aspd: 0.95 - 0.04 * L }), desc: (L) => `ATK +${10 + 5 * L}% · ตีเร็วขึ้น ${5 + 4 * L}% นาน 10 วิ`, fx: { type: "ring", color: 0xff4040 } },
  execute:    { name: "ปลิดชีพ", max: 10, req: ["cleave", 5], sp: [10, 0.5], cooldown: 8000, target: "mob", range: 60, auto: "dmg", icon: "skill_execute", color: "#902020",
    mult: [1.5, 0.1], desc: (L) => `ดาเมจ ${Math.round((1.5 + 0.1 * L) * 100)}% · คอมโบจากการตีปกติ +15%/ขั้น (สูงสุด 5) · เป้าเลือดต่ำกว่า 30% แรงขึ้น 50%`, fx: { type: "hit", color: 0xff5050 } },
  bloodlust:  { name: "เลือดนักรบ", passive: true, max: 5, req: ["execute", 5], icon: "skill_bloodlust", color: "#701818",
    desc: (L) => `โอกาสคริติคอล +${3 * L}%`, pas: (L) => ({ crit: 0.03 * L }) },
  // ===== นักล่า =====
  bowmastery: { name: "ชำนาญธนู", passive: true, max: 10, icon: "skill_bowmastery", color: "#3a7a3a",
    desc: (L) => `ATK +${3 * L} เมื่อถือธนู`, pas: (L, wt) => (wt === "bow" ? { atk: 3 * L } : {}) },
  doubleshot: { name: "ยิงสองดอก", max: 10, sp: [5, 0.3], cooldown: 4000, target: "mob", range: 200, auto: "dmg", icon: "skill_doubleshot", color: "#4a8a3a",
    mult: [0.7, 0.04], desc: (L) => `ยิง 2 ดอกติด ดอกละ ${Math.round((0.7 + 0.04 * L) * 100)}%`, fx: { type: "proj", proj: "arrow" } },
  hawkeye:    { name: "สายตาเหยี่ยว", passive: true, max: 5, req: ["bowmastery", 3], icon: "skill_hawkeye", color: "#5a7a2a",
    desc: (L) => `ระยะยิง +${(L * 8 / 32).toFixed(2)} ช่อง · ตีโดนแม่นขึ้น ${L}%`, pas: (L, wt) => ({ hit: 0.01 * L, ...(wt === "bow" ? { range: 8 * L } : {}) }) },
  arrowrain:  { name: "ฝนธนู", max: 10, req: ["doubleshot", 5], sp: [12, 0.5], cooldown: 10000, target: "mob", range: 220, auto: "dmg", icon: "skill_arrowrain", color: "#6a9a3a",
    mult: [0.8, 0.06], area: [80, 4], desc: (L) => `ดาเมจ ${Math.round((0.8 + 0.06 * L) * 100)}% ทุกตัวในวง ${((80 + 4 * L) / 32).toFixed(1)} ช่องรอบเป้าหมาย`, fx: { type: "aoe", color: 0xc8f0a0 } },
  swiftstep:  { name: "ฝีเท้าลม", max: 5, req: ["hawkeye", 3], sp: [10, 0], cooldown: 25000, target: "self", buff: "swift", icon: "skill_swiftstep", color: "#2a9a6a",
    bv: (L) => ({ speed: 1.1 + 0.06 * L, flee: 0.03 * L }), desc: (L) => `เดินเร็วขึ้น ${10 + 6 * L}% · หลบ +${3 * L}% นาน 10 วิ`, fx: { type: "ring", color: 0x7dff9a } },
  // ===== นักเวทย์ =====
  staffmastery: { name: "ชำนาญคทา", passive: true, max: 10, icon: "skill_staffmastery", color: "#5a3a8a",
    desc: (L) => `พลังเวท +${3 * L} เมื่อถือคทา`, pas: (L, wt) => (wt === "staff" ? { atk: 3 * L } : {}) },
  meditation: { name: "สมาธิ", passive: true, max: 10, icon: "skill_meditation", color: "#3a4a9a",
    desc: (L) => `SP สูงสุด +${3 * L}% · SP ฟื้นเร็วขึ้น ${5 * L}%`, pas: (L) => ({ spPct: 3 * L, spRegen: 0.05 * L }) },
  firebolt:   { name: "ลูกไฟ", max: 10, sp: [6, 0.4], cooldown: 3000, target: "mob", range: 200, auto: "dmg", icon: "skill_firebolt", color: "#c0501a",
    mult: [1.3, 0.08], splash: 0.5, area: [48, 0], desc: (L) => `เวท ${Math.round((1.3 + 0.08 * L) * 100)}% + ไฟกระเด็นรอบ ๆ 50%`, fx: { type: "proj", proj: "fire" } },
  frostnova:  { name: "วงน้ำแข็ง", max: 10, req: ["firebolt", 3], sp: [14, 0.5], cooldown: 10000, target: "mob", range: 200, auto: "dmg", icon: "skill_frostnova", color: "#2a7ab0",
    mult: [0.9, 0.06], area: [90, 4], slow: [2000, 200], desc: (L) => `เวท ${Math.round((0.9 + 0.06 * L) * 100)}% ทุกตัวในวง ${((90 + 4 * L) / 32).toFixed(1)} ช่อง + ช้าลง ${(2 + 0.2 * L).toFixed(1)} วิ`, fx: { type: "aoe", color: 0x9fe3ff } },
  meteor:     { name: "อุกกาบาต", max: 10, req: ["frostnova", 5], sp: [26, 1], cooldown: 20000, target: "mob", range: 220, auto: "dmg", icon: "skill_meteor", color: "#b03a1a",
    mult: [1.8, 0.12], area: [110, 4], delay: 800, desc: (L) => `หลัง 0.8 วิ เวท ${Math.round((1.8 + 0.12 * L) * 100)}% ทุกตัวในวง ${((110 + 4 * L) / 32).toFixed(1)} ช่อง`, fx: { type: "meteor", color: 0xff7a30 } },
  // ===== หมอ =====
  faith:      { name: "ศรัทธา", passive: true, max: 10, icon: "skill_faith", color: "#a08a3a",
    desc: (L) => `ฮีลแรงขึ้น ${4 * L}% · SP สูงสุด +${2 * L}%`, pas: (L) => ({ healPct: 0.04 * L, spPct: 2 * L }) },
  heal:       { name: "แสงรักษา", max: 10, sp: [8, 0.4], cooldown: 4000, target: "ally", range: 220, auto: "heal", icon: "skill_heal", color: "#c0a030",
    heal: [0.12, 0.02], desc: (L) => `ฮีลตัวเองหรือเพื่อนที่เลือดน้อยสุดในระยะ 7 ช่อง: ${Math.round((0.12 + 0.02 * L) * 100)}% ของ HP + INT×4`, fx: { type: "heal", color: 0xfff1a0 } },
  holylight:  { name: "แสงพิพากษา", max: 10, sp: [7, 0.3], cooldown: 3500, target: "mob", range: 200, auto: "dmg", icon: "skill_holylight", color: "#d0b040",
    mult: [1.2, 0.08], undead: 1.6, desc: (L) => `เวท ${Math.round((1.2 + 0.08 * L) * 100)}% · อันเดดแรงขึ้น 60%`, fx: { type: "proj", proj: "holy" } },
  bless:      { name: "พรแห่งแสง", max: 5, req: ["heal", 5], sp: [20, 0], cooldown: 45000, target: "self", area: [220, 0], buff: "bless", auto: "buff", icon: "skill_bless", color: "#e0c050",
    bv: (L) => ({ atk: 1.05 + 0.03 * L, def: 1.05 + 0.03 * L, ms: 30000 + 10000 * L }), desc: (L) => `ทุกคนรอบตัว 7 ช่อง ATK/DEF +${5 + 3 * L}% นาน ${30 + 10 * L} วิ`, fx: { type: "ring", color: 0xffe28a } },
};
// ค่าของสกิลที่เลเวล L (แปลง [a, b] → ตัวเลข)
const lvVal = (v, L) => (Array.isArray(v) ? v[0] + v[1] * L : v);
function skillAt(key, L) {
  const sk = SKILLS[key];
  if (!sk) return null;
  L = Math.max(1, Math.min(sk.max, L || 1));
  const o = { ...sk, lv: L };
  for (const f of ["sp", "mult", "area", "stun", "slow", "heal"]) if (sk[f] !== undefined) o[f] = lvVal(sk[f], L);
  if (o.sp !== undefined) o.sp = Math.round(o.sp);
  return o;
}
// บัฟ: atk/def = ตัวคูณ · taken = ตัวคูณดาเมจที่ได้รับ · aspd = ตัวคูณเวลาต่อการตี · speed = ความเร็วเดิน · flee = หลบเพิ่ม
// (ค่าจริงขึ้นกับเลเวลสกิล ดู bv ของสกิล — ค่าในนี้ใช้เมื่อไม่มีเลเวล)
const BUFFS = {
  provoke: { name: "ท้าทาย", ms: 8000, def: 1.3 },
  shieldwall: { name: "กำแพงโล่", ms: 8000, taken: 0.5 },
  fury: { name: "โทสะ", ms: 10000, atk: 1.3, aspd: 0.8 },
  swift: { name: "ฝีเท้าลม", ms: 10000, speed: 1.4, flee: 0.15 },
  bless: { name: "พรแห่งแสง", ms: 60000, atk: 1.15, def: 1.15 },
};
// ต้นไม้สกิล: แต่ละแท็บ = รายการแถว (I, II, III) ของสกิล
const SKILL_TREE = {
  villager: [["basic", "firstaid"]],
  guardian: [["swordmastery", "ironbody", "shieldbash"], ["doublehit", "provoke", "shieldwall"]],
  slayer: [["gsmastery", "doublehit", "cleave"], ["fury", "execute"], ["bloodlust"]],
  hunter: [["bowmastery", "doubleshot"], ["hawkeye", "arrowrain"], ["swiftstep"]],
  mage: [["staffmastery", "meditation", "firebolt"], ["frostnova"], ["meteor"]],
  healer: [["faith", "heal", "holylight"], ["bless"]],
};
const treeKeys = (job) => [...SKILL_TREE.villager.flat(), ...(job !== "villager" && SKILL_TREE[job] ? SKILL_TREE[job].flat() : [])];
// สกิลที่กดใช้ได้ (ตามลำดับช่องในแถบสกิล) — เฉพาะที่เรียนแล้ว
const JOB_SKILLS = Object.fromEntries(Object.keys(SKILL_TREE).map((j) => [j, treeKeys(j).filter((k) => !SKILLS[k].passive)]));
const skillPointsAt = (lv) => Math.max(0, lv - 1); // ได้ 1 แต้มต่อเลเวล
const innateSkills = () => Object.fromEntries(Object.entries(SKILLS).filter(([, s]) => s.innate).map(([k, s]) => [k, s.innate]));
const skillSpent = (sk) => Object.entries(sk || {}).reduce((t, [k, L]) => t + Math.max(0, L - ((SKILLS[k] && SKILLS[k].innate) || 0)), 0);
// เรียนสกิลนี้ขั้นถัดไปได้ไหม → คืนข้อความเหตุผล (null = ได้)
function learnError(job, sk, key, points) {
  const S = SKILLS[key];
  if (!S || !treeKeys(job).includes(key)) return "อาชีพนี้เรียนสกิลนี้ไม่ได้";
  const L = sk[key] || 0;
  if (L >= S.max) return "สกิลนี้เลเวลสูงสุดแล้ว";
  if (S.req && (sk[S.req[0]] || 0) < S.req[1]) return `ต้องมี ${SKILLS[S.req[0]].name} Lv.${S.req[1]} ก่อน`;
  if (points < 1) return "แต้มสกิลไม่พอ";
  return null;
}
// โหลดสกิลที่บันทึกไว้ (ตัดสกิลที่อาชีพนี้ไม่มี · ข้อมูลผิดปกติ = คืนแต้มทั้งหมด)
function sanitizeSkills(raw, job, lv) {
  const out = innateSkills();
  for (const k of treeKeys(job)) {
    const v = Math.floor(Number(raw && raw[k]) || 0);
    if (k === "doublehit" && v <= 1) continue; // ฟันซ้ำ Lv1 เดิมเคยได้ฟรีตอนเป็นชาวบ้าน → ไม่นับ
    if (v > 0) out[k] = Math.max(out[k] || 0, Math.min(SKILLS[k].max, v));
  }
  return skillSpent(out) > skillPointsAt(lv) ? innateSkills() : out;
}
// ข้อมูลสกิลสำหรับ client (ฟังก์ชันส่งผ่านเครือข่ายไม่ได้ → คำนวณคำอธิบาย/SP ทุกเลเวลไว้ให้)
const skillsForClient = () => Object.fromEntries(Object.entries(SKILLS).map(([k, s]) => {
  const o = { name: s.name, passive: !!s.passive, max: s.max, innate: s.innate || 0, req: s.req || null, icon: s.icon, color: s.color,
    target: s.target || null, cooldown: s.cooldown || 0, range: s.range || 0, fx: s.fx || null, descs: [], sps: [] };
  for (let L = 1; L <= s.max; L++) { o.descs.push(s.desc(L)); if (s.sp) o.sps.push(Math.round(lvVal(s.sp, L))); }
  o.desc = o.descs[0]; o.sp = o.sps[0] || 0;
  return [k, o];
}));
// ผลของสกิลติดตัวทั้งหมด
function passiveBonus(sk, job, wt) {
  const out = { atk: 0, def: 0, hpPct: 0, spPct: 0, crit: 0, hit: 0, range: 0, healPct: 0, spRegen: 0 };
  for (const k of treeKeys(job)) {
    const S = SKILLS[k], L = sk[k] || 0;
    if (!S.passive || !L) continue;
    for (const [f, v] of Object.entries(S.pas(L, wt))) out[f] = (out[f] || 0) + v;
  }
  return out;
}

// ---------- เควสเปลี่ยนอาชีพ (คุยกับครูฝึกอาชีพในเมือง) ----------
// kill = [มอน, จำนวน] · item = [ของที่ต้องนำมา, จำนวน] · reward = อาวุธประจำอาชีพที่ได้เมื่อผ่าน
const JOB_QUESTS = {
  guardian: { kill: ["orc", 15], item: ["orc_scrap", 10], reward: "saber", where: "ค่ายออร์ค",
    story: "ผู้พิทักษ์ต้องยืนหยัดต่อหน้าศัตรูที่แข็งแกร่ง จงไปที่ค่ายออร์ค ปราบออร์คนักรบ แล้วนำเศษเกราะของพวกมันกลับมาเป็นหลักฐาน" },
  slayer: { kill: ["skeleton", 20], item: ["old_bone", 10], reward: "greatsword", where: "เนินกระดูก",
    story: "ดาบใหญ่ต้องฟาดไม่ยั้ง จงไปเนินกระดูก ฟาดโครงกระดูกให้แหลก แล้วนำกระดูกเก่ากลับมา" },
  hunter: { kill: ["redwolf", 20], item: ["wolf_fang", 15], reward: "bow_hunter", where: "ป่าใบไม้แดง",
    story: "นักล่าที่ดีต้องตามรอยเหยื่อได้ จงล่าหมาป่าแดงในป่าใบไม้แดง แล้วนำเขี้ยวหมาป่ามาให้ข้าดู" },
  mage: { kill: ["jack", 20], item: ["pumpkin", 10], reward: "staff_oak", where: "ป่าใบไม้แดง",
    story: "ฟักทองเรืองแสงในตัวหุ่นไล่กาเต็มไปด้วยพลังเวท จงปราบหุ่นไล่กาฟักทองแล้วนำฟักทองเรืองแสงมาให้ข้า" },
  healer: { kill: ["zombie", 15], item: ["rotten_cloth", 10], reward: "book_light", where: "ป่าใบไม้แดง / เนินกระดูก",
    story: "แสงแห่งการรักษาเผาผลาญความตาย จงไปชำระผีดิบที่เร่ร่อน แล้วนำผ้าเปื่อยของพวกมันมาเผาทำพิธี" },
};

module.exports = { WORLD_BOSSES, MINI_BOSSES,
  APPEARANCE, sanitizeLook, MAX_LEVEL, JOB_CHANGE_LEVEL, expToNext, playerStats,
  STAT_KEYS, STAT_INFO, START_POINTS, STAT_MAX, STAT_COST_STEP, pointsAtLevel, statCost, costTo, allocate, totalPoints, baseStats, spentPoints, RECOMMEND,
  MONSTERS, monsterStats, MONSTER_RESPAWN_MS, SKILLS, JOB_SKILLS, JOB_NAME,
  JOBS, ARMOR_NAME, JOB_FREE_LV, WEAPON_TYPES, UNDEAD, BUFFS, JOB_QUESTS,
  SKILL_TREE, sanitizeSkills, skillsForClient, skillAt, treeKeys, skillPointsAt, innateSkills, skillSpent, learnError, passiveBonus,
};

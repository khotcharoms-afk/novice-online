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
  int: { name: "INT", th: "ปัญญา", desc: "SP สูงสุด, พลังฮีล (พลังเวทเมื่อมีอาชีพ)" },
  dex: { name: "DEX", th: "แม่นยำ", desc: "ตีโดนแม่น, คริติคอล, พลังโจมตีเล็กน้อย" },
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
// ลงแต้มแนะนำสำหรับชาวบ้าน (สัดส่วน)
const RECOMMEND = { str: 0.4, vit: 0.3, agi: 0.2, dex: 0.1, int: 0 };

// ค่าที่คำนวณจากเลเวล + สเตตัส (สูตรที่ผ่านการจำลองสมดุลแล้ว — ดู docs/balance.md)
const playerStats = (lv, st = baseStats()) => ({
  maxHp: 50 + (lv - 1) * 14 + st.vit * 6,
  maxSp: 15 + (lv - 1) * 2 + st.int * 3,
  atk: Math.round(8 + lv * 2 + st.str * 2 + st.dex * 0.5),
  def: lv * 1.2 + st.vit * 0.6,
  atkDelay: Math.round(800 / (1 + st.agi * 0.012)), // มิลลิวินาทีต่อการตี 1 ครั้ง
  flee: Math.min(0.35, st.agi * 0.0035),            // โอกาสหลบ
  hitBonus: st.dex * 0.005,                          // ลดโอกาสตีพลาด
  crit: Math.min(0.4, 0.05 + st.dex * 0.003),        // โอกาสคริติคอล
  healBonus: st.int * 2,                             // ฮีลเพิ่ม
});

// ---------- มอนสเตอร์ ----------
// ring = ระยะจากกลางแผนที่ (0 = กลาง, 1 = ขอบ) — ยิ่งไกลยิ่งแรง
const MONSTERS = {
  goblin:   { name: "ก็อบลินป่า",       level: 2,  count: 16, ring: [0.14, 0.36], speed: 70,  aggressive: false },
  wolf:     { name: "หมาป่าเร่ร่อน",    level: 6,  count: 14, ring: [0.32, 0.55], speed: 95,  aggressive: false },
  boar:     { name: "หมูป่าคลั่ง",       level: 10, count: 12, ring: [0.50, 0.70], speed: 80,  aggressive: true },
  skeleton: { name: "โครงกระดูกเฝ้าป่า", level: 14, count: 10, ring: [0.64, 0.84], speed: 75,  aggressive: true },
  orc:      { name: "ออร์คนักรบ",        level: 18, count: 8,  ring: [0.78, 0.94], speed: 85,  aggressive: true },
};
const monsterStats = (lv) => ({
  maxHp: 30 + lv * 20 + Math.round(0.5 * lv * lv),
  atk: 3 + Math.round(lv * 3.2),
  def: lv,
  exp: Math.round(6 * Math.pow(lv, 1.5)),
});
const MONSTER_RESPAWN_MS = 8000;

// ---------- สกิล ----------
// target: "self" = ใช้กับตัวเอง, "mob" = ต้องมีเป้าหมายมอนสเตอร์
const SKILLS = {
  firstaid:  { name: "ปฐมพยาบาล", desc: "ฟื้น HP 25% (+INT×2)", sp: 8, cooldown: 12000, target: "self" },
  doublehit: { name: "ฟันซ้ำ", desc: "ตี 2 ครั้งติด", sp: 5, cooldown: 5000, target: "mob", range: 60 },
};
// สกิลของแต่ละอาชีพ (ตามลำดับช่อง 1–9)
const JOB_SKILLS = { villager: ["firstaid", "doublehit"] };
const JOB_NAME = { villager: "ชาวบ้าน" };

module.exports = {
  APPEARANCE, sanitizeLook, MAX_LEVEL, JOB_CHANGE_LEVEL, expToNext, playerStats,
  STAT_KEYS, STAT_INFO, START_POINTS, STAT_MAX, STAT_COST_STEP, pointsAtLevel, statCost, costTo, allocate, totalPoints, baseStats, spentPoints, RECOMMEND,
  MONSTERS, monsterStats, MONSTER_RESPAWN_MS, SKILLS, JOB_SKILLS, JOB_NAME,
};

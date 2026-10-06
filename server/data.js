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
const playerStats = (lv) => ({
  maxHp: 50 + (lv - 1) * 18,
  maxSp: 15 + (lv - 1) * 3,
  atk: 10 + lv * 4,
  def: lv * 1.5,
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
  maxHp: 30 + lv * 22,
  atk: 3 + Math.round(lv * 3.2),
  def: lv,
  exp: Math.round(6 * Math.pow(lv, 1.5)),
});
const MONSTER_RESPAWN_MS = 12000;

// ---------- สกิล ----------
// target: "self" = ใช้กับตัวเอง, "mob" = ต้องมีเป้าหมายมอนสเตอร์
const SKILLS = {
  firstaid:  { name: "ปฐมพยาบาล", desc: "ฟื้น HP 25%", sp: 8, cooldown: 12000, target: "self" },
  doublehit: { name: "ฟันซ้ำ", desc: "ตี 2 ครั้งติด", sp: 5, cooldown: 5000, target: "mob", range: 60 },
};
// สกิลของแต่ละอาชีพ (ตามลำดับช่อง 1–9)
const JOB_SKILLS = { villager: ["firstaid", "doublehit"] };
const JOB_NAME = { villager: "ชาวบ้าน" };

module.exports = {
  APPEARANCE, sanitizeLook, MAX_LEVEL, JOB_CHANGE_LEVEL, expToNext, playerStats,
  MONSTERS, monsterStats, MONSTER_RESPAWN_MS, SKILLS, JOB_SKILLS, JOB_NAME,
};

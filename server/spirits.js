// =============================================================
//  ภูติ (Spirit) — ผู้ช่วยลอยตามตัว ใส่ได้ 1 ตัว · ได้จากเควสของลูน่า (ผู้ผนึกภูติ) ในเมือง
//  ภูติแต่ละตัวในกระเป๋า = { id, n: 1, r: ระดับสี, lv: เลเวลภูติ, ex: EXP }
//  เก่งขึ้น 2 ทาง: เลเวล (ได้ EXP ตามเราตอนตีมอน) + ระดับสี (อัปที่ลูน่าด้วยผลึกวิญญาณ)
// =============================================================
const SPIRIT_MAX_LV = 50;
const RAR_MUL = [1, 1.12, 1.3, 1.55, 1.9];      // ธรรมดา → ตำนาน
const EXP_SHARE = 0.25;                         // ภูติได้ EXP 25% ของที่เราได้

// role: dmg = โจมตี · heal = รักษา
// skill: every = คูลดาวน์ (ms) · mult = ตัวคูณดาเมจจากพลังโจมตีของเรา · range = ระยะหาเป้า (px รอบตัวเรา)
const SPIRITS = {
  sp_ember: { name: "ภูติเปลวไฟ อิกนิส", role: "dmg", color: "#ff8a3a", lv: 12,
    skill: { name: "ลูกไฟ", every: 3000, mult: 0.6, range: 260, fx: "fire" },
    desc: "ยิงลูกไฟใส่ศัตรูที่เรากำลังสู้อยู่" },
  sp_spring: { name: "ภูติธารา อควอรา", role: "heal", color: "#5fd0ff", lv: 15,
    skill: { name: "สายธารชุบชีวิต", every: 7000, healPct: 6, below: 80 },
    desc: "ฟื้นฟู HP ให้เราเมื่อ HP ต่ำกว่า 80%" },
  sp_frost: { name: "ภูติหิมะ ฟรอสตี้", role: "dmg", color: "#9fe3ff", lv: 30,
    skill: { name: "หอกน้ำแข็ง", every: 4000, mult: 0.75, range: 260, fx: "ice", slow: 1800 },
    desc: "ยิงหอกน้ำแข็ง ทำดาเมจและทำให้ศัตรูช้าลง" },
  sp_thunder: { name: "ภูติอัสนี โวลท์", role: "dmg", color: "#ffe14a", lv: 40,
    skill: { name: "สายฟ้าลูกโซ่", every: 5000, mult: 0.55, range: 280, fx: "bolt", chain: 3 },
    desc: "ปล่อยสายฟ้ากระโดดใส่ศัตรูรอบตัวสูงสุด 3 ตัว" },
  sp_lumi: { name: "ภูติแสง ลูมิน่า", role: "heal", color: "#fff1a0", lv: 55,
    skill: { name: "พรแห่งแสง", every: 8000, healPct: 8, spPct: 5, below: 85, cleanse: true },
    desc: "ฟื้นฟู HP และ SP ให้เรา และล้างพิษออก" },
  sp_shadow: { name: "ภูติเงา นอกซ์", role: "dmg", color: "#b06aff", lv: 65,
    skill: { name: "เขี้ยวเงา", every: 3500, mult: 0.8, range: 240, fx: "dark", drain: 30 },
    desc: "กัดศัตรูด้วยเงามืด และดูดดาเมจส่วนหนึ่งกลับมาเป็น HP ของเรา" },
};

// เควสรับภูติ (คุยกับลูน่า) — kill = [มอน, จำนวน] · item = [ของ, จำนวน]
const SPIRIT_QUESTS = {
  sp_ember: { kill: ["jack", 25], item: ["pumpkin", 15], where: "ป่าใบไม้แดง",
    story: "ภูติเปลวไฟชอบความอบอุ่นของฟักทองเรืองแสง ไปปราบหุ่นไล่กาฟักทองแล้วนำฟักทองมาเป็นเครื่องเซ่น อิกนิสจะยอมออกมาหาเจ้า" },
  sp_spring: { kill: ["lizard", 25], item: ["lizard_scale", 15], where: "ป่าสนเขียวขจี",
    story: "กิ้งก่ากำลังทำให้ลำธารในป่าสนขุ่นมัว ช่วยปราบพวกมันแล้วนำเกล็ดมาให้ข้า อควอราจะตอบแทนด้วยสายน้ำแห่งการรักษา" },
  sp_frost: { kill: ["slime_ice", 30], item: ["ice_gel", 20], where: "หุบเขาหิมะ",
    story: "ฟรอสตี้ถูกขังอยู่ในเจลน้ำแข็งของสไลม์ ปราบสไลม์น้ำแข็งแล้วนำเจลมาให้ข้าละลายผนึก" },
  sp_thunder: { kill: ["wisp_frost", 30], item: ["frost_essence", 20], where: "ยอดเขาน้ำแข็ง",
    story: "โวลท์ซ่อนตัวอยู่ในพายุบนยอดเขา ผีไฟน้ำแข็งแย่งพลังของมันไป จงนำแก่นน้ำแข็งกลับมาคืนให้มัน" },
  sp_lumi: { kill: ["ghost_dark", 30], item: ["dark_ecto", 20], where: "ซากปราสาทร้าง",
    story: "แสงของลูมิน่าถูกวิญญาณมืดในซากปราสาทกลืนไป ชำระพวกมันแล้วนำคราบวิญญาณมาให้ข้าทำพิธี" },
  sp_shadow: { kill: ["vamplord", 25], item: ["vamp_blood", 15], where: "ป่าต้องสาป",
    story: "นอกซ์คือเงาที่หลุดออกมาจากเจ้าแวมไพร์ จงล้มลอร์ดแวมไพร์แล้วนำโลหิตของพวกมันมา ข้าจะผนึกเงานั้นให้เป็นของเจ้า" },
};

// อัประดับสี: ใช้ผลึกวิญญาณ + gold (สำเร็จ 100%) · index = ระดับปัจจุบัน
const UPGRADE = [
  { shards: 5, gold: 5000 },     // ธรรมดา → ดี
  { shards: 15, gold: 25000 },   // ดี → หายาก
  { shards: 40, gold: 100000 },  // หายาก → มหากาพย์
  { shards: 100, gold: 400000 }, // มหากาพย์ → ตำนาน
];
const QUEST_RARITY = 1; // ได้จากเควส = ระดับดี (เขียว)

const expNeed = (lv) => Math.round(80 * Math.pow(lv, 1.9));
// พลังรวมของภูติ (ใช้คูณดาเมจ/ฮีล): ระดับสี × เลเวล
const power = (s) => RAR_MUL[Math.max(0, Math.min(4, s.r | 0))] * (1 + ((s.lv || 1) - 1) * 0.015);

function norm(o) {
  if (!o || !SPIRITS[o.id]) return null;
  const lv = Math.max(1, Math.min(SPIRIT_MAX_LV, o.lv | 0 || 1));
  return { id: o.id, n: 1, r: Math.max(0, Math.min(4, o.r | 0)), lv, ex: lv >= SPIRIT_MAX_LV ? 0 : Math.max(0, Math.min(expNeed(lv) - 1, o.ex | 0)) };
}
// ค่าที่ใช้แสดงในการ์ด
function info(s) {
  const S = SPIRITS[s.id], k = S.skill, P = power(s), out = { power: Math.round(P * 100), need: s.lv >= SPIRIT_MAX_LV ? 0 : expNeed(s.lv) };
  if (k.mult) out.dmg = Math.round(k.mult * P * 100);
  if (k.healPct) out.heal = +(k.healPct * P).toFixed(1);
  if (k.spPct) out.sp = +(k.spPct * P).toFixed(1);
  if (k.drain) out.drain = k.drain;
  out.up = UPGRADE[s.r] || null;
  return out;
}

module.exports = { SPIRITS, SPIRIT_QUESTS, SPIRIT_MAX_LV, RAR_MUL, EXP_SHARE, UPGRADE, QUEST_RARITY, expNeed, power, norm, info };

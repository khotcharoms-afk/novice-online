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
  sp_ember: { name: "ภูติเปลวไฟ อิกนิส", role: "dmg", color: "#ff8a3a", lv: 5,
    skill: { name: "ลูกไฟ", every: 3000, mult: 0.6, range: 260, fx: "fire" },
    desc: "ยิงลูกไฟใส่ศัตรูที่เรากำลังสู้อยู่" },
  sp_spring: { name: "ภูติธารา อควอรา", role: "heal", color: "#5fd0ff", lv: 5,
    skill: { name: "สายธารชุบชีวิต", every: 7000, healPct: 5, spPct: 3, below: 60 },
    desc: "ฟื้นฟู HP และ SP ให้เราเมื่อ HP หรือ SP ต่ำกว่า 80%" },
  sp_frost: { name: "ภูติหิมะ ฟรอสตี้", role: "dmg", color: "#9fe3ff", lv: 5,
    skill: { name: "หอกน้ำแข็ง", every: 4000, mult: 0.75, range: 260, fx: "ice", slow: 1800 },
    desc: "ยิงหอกน้ำแข็ง ทำดาเมจและทำให้ศัตรูช้าลง" },
  sp_thunder: { name: "ภูติอัสนี โวลท์", role: "dmg", color: "#ffe14a", lv: 5,
    skill: { name: "สายฟ้าลูกโซ่", every: 5000, mult: 0.55, range: 280, fx: "bolt", chain: 3 },
    desc: "ปล่อยสายฟ้ากระโดดใส่ศัตรูรอบตัวสูงสุด 3 ตัว" },
  sp_lumi: { name: "ภูติแสง ลูมิน่า", role: "heal", color: "#fff1a0", lv: 5,
    skill: { name: "พรแห่งแสง", every: 8000, healPct: 6, spPct: 3.5, below: 60, cleanse: true },
    desc: "ฟื้นฟู HP และ SP ให้เราเมื่อ HP หรือ SP ต่ำกว่า 85% และล้างพิษออก" },
  sp_shadow: { name: "ภูติเงา นอกซ์", role: "dmg", color: "#b06aff", lv: 5,
    skill: { name: "เขี้ยวเงา", every: 3500, mult: 0.8, range: 240, fx: "dark", drain: 30 },
    desc: "กัดศัตรูด้วยเงามืด และดูดดาเมจส่วนหนึ่งกลับมาเป็น HP ของเรา" },
};

// เควสรับภูติ (คุยกับลูน่า) — รับได้ตั้งแต่ Lv.5 ทุกตัว และทำพร้อมกันได้หลายเควส
// kill = [มอน, จำนวน] · item = [ของ, จำนวน]
const SPIRIT_QUESTS = {
  sp_ember: { kill: ["shroom_red", 20], item: ["red_spore", 10], where: "ป่าสนเขียวขจี",
    story: "สปอร์ของเห็ดแดงอุ่นเหมือนถ่านไฟ ไปปราบเห็ดแดงแล้วนำสปอร์มาเป็นเครื่องเซ่น อิกนิสจะยอมออกมาหาเจ้า" },
  sp_spring: { kill: ["slime_green", 20], item: ["slime_gel", 10], where: "ทุ่งหญ้าต้นกล้า",
    story: "สไลม์เขียวดูดน้ำในลำธารจนแห้ง ช่วยปราบพวกมันแล้วนำเจลมาให้ข้า อควอราจะตอบแทนด้วยสายน้ำแห่งการรักษา" },
  sp_frost: { kill: ["rabbit", 20], item: ["rabbit_tail", 10], where: "ทุ่งหญ้าต้นกล้า",
    story: "ฟรอสตี้ชอบขนนุ่ม ๆ สีขาวเหมือนหิมะ ไปหาหางกระต่ายมาให้ข้าทำรังให้มัน" },
  sp_thunder: { kill: ["wolf", 20], item: ["wolf_fang", 10], where: "ป่าสนเขียวขจี",
    story: "โวลท์ชอบความว่องไวของหมาป่า จงพิสูจน์ความเร็วของเจ้าด้วยการล่าหมาป่าแล้วนำเขี้ยวมาให้ข้า" },
  sp_lumi: { kill: ["sheep", 20], item: ["wool", 10], where: "ป่าสนเขียวขจี",
    story: "แสงของลูมิน่าอ่อนแรง มันต้องการขนแกะนุ่ม ๆ มาห่อตัวพักฟื้น ไปนำขนแกะมาให้ข้า" },
  sp_shadow: { kill: ["rat", 20], item: ["rat_tail", 10], where: "ทุ่งหญ้าต้นกล้า",
    story: "นอกซ์คือเงาที่ซ่อนอยู่ในรูหนู จงไล่หนูออกมาแล้วนำหางของพวกมันมา ข้าจะผนึกเงานั้นให้เป็นของเจ้า" },
};

// ข้ามขีดจำกัด (ทุก 10 เลเวล) → พัฒนาร่าง · index = ร่างปัจจุบัน (0 = ร่างแรก) · ต้องเลเวลภูติเต็มเพดานก่อน
const STAGE_NAME = ["ร่างแรกเกิด", "ร่างเติบโต", "ร่างตื่นรู้", "ร่างจ้าว", "ร่างสมบูรณ์"];
const BREAK = [
  { items: [["wolf_fang", 10], ["slime_gel", 10]], gold: 3000 },                            // Lv.10 → ร่างเติบโต
  { items: [["old_bone", 15], ["bat_wing", 10]], gold: 15000 },                             // Lv.20 → ร่างตื่นรู้
  { items: [["troll_hide", 15], ["ice_gel", 15]], gold: 50000 },                            // Lv.30 → ร่างจ้าว
  { items: [["frost_essence", 20], ["wraith_veil", 15], ["spirit_shard", 10]], gold: 150000 }, // Lv.40 → ร่างสมบูรณ์
];
const STAGE_POWER = 0.1;  // แต่ละร่างแรงขึ้น 10%
const STAGE_CD = 0.06;    // และใช้สกิลถี่ขึ้น 6%
const capOf = (st) => Math.min(SPIRIT_MAX_LV, ((st | 0) + 1) * 10);

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
const power = (s) => RAR_MUL[Math.max(0, Math.min(4, s.r | 0))] * (1 + ((s.lv || 1) - 1) * 0.015) * (1 + (s.st | 0) * STAGE_POWER);
// ภูติสายฮีล: โตช้ากว่าสายโจมตี (ได้แค่ 35% ของพลังที่เพิ่ม) — ช่วยประคอง ไม่ใช่แทนหมอ
const healPower = (s) => 1 + (power(s) - 1) * 0.35;
const cooldown = (s) => Math.round(SPIRITS[s.id].skill.every * (1 - (s.st | 0) * STAGE_CD));

function norm(o) {
  if (!o || !SPIRITS[o.id]) return null;
  const lv0 = Math.max(1, Math.min(SPIRIT_MAX_LV, o.lv | 0 || 1));
  // ร่าง: ข้อมูลเก่าที่ยังไม่มี st แต่เลเวลเกินเพดาน → ให้ร่างตามเลเวล
  const st = Math.max(0, Math.min(4, o.st === undefined ? Math.floor((lv0 - 1) / 10) : o.st | 0));
  const lv = Math.min(lv0, capOf(st));
  return { id: o.id, n: 1, r: Math.max(0, Math.min(4, o.r | 0)), lv, st, ex: lv >= SPIRIT_MAX_LV ? 0 : Math.max(0, Math.min(expNeed(lv) - 1, o.ex | 0)) };
}
// ค่าที่ใช้แสดงในการ์ด
function info(s) {
  const S = SPIRITS[s.id], k = S.skill, P = power(s), cap = capOf(s.st);
  const out = { power: Math.round(P * 100), need: s.lv >= SPIRIT_MAX_LV ? 0 : expNeed(s.lv), cap, cd: cooldown(s), stage: STAGE_NAME[s.st | 0] };
  if (k.mult) out.dmg = Math.round(k.mult * P * 100);
  if (k.healPct) out.heal = +(k.healPct * healPower(s)).toFixed(1);
  if (k.spPct) out.sp = +(k.spPct * healPower(s)).toFixed(1);
  if (k.below) out.below = k.below;
  if (k.drain) out.drain = k.drain;
  out.up = UPGRADE[s.r] || null;
  out.brk = (s.st | 0) < 4 ? BREAK[s.st | 0] : null;   // ของที่ต้องใช้ข้ามขีดจำกัดครั้งถัดไป
  out.capped = s.lv >= cap && (s.st | 0) < 4;          // เลเวลเต็มเพดาน รอข้ามขีดจำกัด
  return out;
}

module.exports = { healPower, SPIRITS, SPIRIT_QUESTS, SPIRIT_MAX_LV, RAR_MUL, EXP_SHARE, UPGRADE, QUEST_RARITY, STAGE_NAME, BREAK, STAGE_POWER, STAGE_CD, capOf, cooldown, expNeed, power, norm, info };

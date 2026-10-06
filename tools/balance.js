// =============================================================
//  จำลองสมดุลเกม (สำหรับแอดมิน)  —  รัน:  npm run balance
//  ใช้สูตรจริงจาก server/data.js → แก้ตัวเลขในเกมแล้วรันใหม่ ข้อมูลจะตรงกันเสมอ
//  ผลลัพธ์: docs/balance.md (อ่านง่าย) และ docs/balance.csv (เปิดใน Excel/Sheets)
// =============================================================
const fs = require("fs");
const path = require("path");
const D = require("../server/data");

const MAX_LV = D.JOB_CHANGE_LEVEL;
const WALK_SEC = 3;        // เวลาเดินหามอนตัวต่อไปโดยประมาณ
const REGEN = 0.03;        // ฟื้น HP 3%/วิ ตอนไม่ได้สู้ (ตรงกับ WorldRoom.regen)
const REGEN_DELAY = 6;     // ต้องไม่โดนตี 6 วิ ถึงเริ่มฟื้น
const MOB_ATK_SEC = 1.5;

// มอนที่เหมาะกับเลเวล = ตัวที่เลเวลสูงสุดที่ไม่เกินเลเวลผู้เล่น +2 (ตรงกับกฎ AUTO)
const mobs = Object.entries(D.MONSTERS).map(([k, m]) => ({ key: k, ...m })).sort((a, b) => a.level - b.level);
const zoneMob = (lv) => mobs.filter((m) => m.level <= lv + 2).pop() || mobs[0];

const BUILDS = {
  "แนะนำ (ปุ่มในเกม)": D.RECOMMEND,
  "สมดุล": { str: 0.2, agi: 0.2, vit: 0.2, int: 0.2, dex: 0.2 },
  "STR ล้วน": { str: 1 },
  "STR+AGI": { str: 0.5, agi: 0.5 },
  "STR+VIT": { str: 0.5, vit: 0.5 },
  "AGI ล้วน": { agi: 1 },
  "VIT ล้วน": { vit: 1 },
  "DEX ล้วน": { dex: 1 },
};
function statsFor(split, lv) {
  const st = D.baseStats(), pts = D.totalPoints(lv);
  for (const [k, f] of Object.entries(split)) st[k] = Math.min(D.STAT_MAX, st[k] + Math.round(pts * f));
  return st;
}
function sim(lv, st, m) {
  const P = D.playerStats(lv, st), M = D.monsterStats(m.level);
  const miss = Math.min(0.4, 0.05 + Math.max(0, m.level - lv) * 0.03);
  const hit = 1 - Math.max(0, miss - P.hitBonus);
  const dps = Math.max(1, P.atk - M.def * 0.5) * (1 + P.crit * 0.5) * hit / (P.atkDelay / 1000);
  const ttk = M.maxHp / dps;
  const mMiss = Math.min(0.4, 0.05 + Math.max(0, lv - m.level) * 0.03);
  const mdps = Math.max(1, M.atk - P.def * 0.5) * (1 - mMiss) * (1 - P.flee) / MOB_ATK_SEC;
  const ttd = P.maxHp / mdps;
  const lost = mdps * ttk;
  const rest = lost > 0 ? (lost / (REGEN * P.maxHp)) * Math.min(1, lost / (0.5 * P.maxHp)) + (lost > 0.5 * P.maxHp ? REGEN_DELAY : 0) : 0;
  return { P, ttk, ttd, perKill: ttk + WALK_SEC + rest, killsPerLife: ttd / ttk };
}

const rows = [], summary = [];
for (const [name, split] of Object.entries(BUILDS)) {
  let secs = 0;
  const list = [];
  for (let lv = 1; lv <= MAX_LV; lv++) {
    const st = statsFor(split, lv), m = zoneMob(lv), r = sim(lv, st, m);
    if (lv < MAX_LV) secs += (D.expToNext(lv) / D.monsterStats(m.level).exp) * r.perKill;
    const row = { build: name, lv, ...st, mob: `${m.name} Lv.${m.level}`, hp: r.P.maxHp, sp: r.P.maxSp, atk: r.P.atk,
      def: +r.P.def.toFixed(1), atkDelay: r.P.atkDelay, flee: +(r.P.flee * 100).toFixed(1), crit: +(r.P.crit * 100).toFixed(1),
      ttk: +r.ttk.toFixed(2), ttd: +r.ttd.toFixed(1), killsPerLife: +r.killsPerLife.toFixed(1), minutesSoFar: Math.round(secs / 60) };
    rows.push(row); list.push(row);
  }
  const last = list[list.length - 1];
  summary.push({ name, minutes: last.minutesSoFar, ttk1: list[0].ttk, ttk20: last.ttk, kpl: last.killsPerLife, hp: last.hp, atk: last.atk });
}

// ---------- CSV ----------
const cols = ["build", "lv", "str", "agi", "vit", "int", "dex", "mob", "hp", "sp", "atk", "def", "atkDelay", "flee", "crit", "ttk", "ttd", "killsPerLife", "minutesSoFar"];
const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => `"${r[c]}"`).join(","))).join("\n");
const outDir = path.join(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "balance.csv"), "﻿" + csv);

// ---------- Markdown ----------
const md = [];
md.push("# รายงานสมดุลสเตตัส (สำหรับแอดมิน)", "");
md.push(`สร้างจาก \`npm run balance\` เมื่อ ${new Date().toISOString().slice(0, 10)} — ใช้สูตรจริงใน \`server/data.js\``, "");
md.push("สมมติฐาน: ตีมอนที่เลเวลไม่เกินเรา +2 · เดินหามอน 3 วิ/ตัว · พักเลือดเมื่อเสีย HP เกินครึ่ง · ยังไม่รวมสกิล ไอเทม และอาชีพ", "");
md.push("## สรุปทุกสาย", "", "| สาย | ถึง Lv.20 (นาที) | ฆ่า 1 ตัว Lv.1 (วิ) | ฆ่า 1 ตัว Lv.20 (วิ) | ฆ่าได้ต่อ 1 ชีวิต Lv.20 | HP Lv.20 | ATK Lv.20 |", "| --- | --- | --- | --- | --- | --- | --- |");
for (const s of summary.sort((a, b) => a.minutes - b.minutes)) md.push(`| ${s.name} | ${s.minutes} | ${s.ttk1} | ${s.ttk20} | ${s.kpl} | ${s.hp} | ${s.atk} |`);
md.push("", "เกณฑ์ที่ตั้งไว้: ถึง Lv.20 ประมาณ 60–120 นาทีสำหรับสายที่ลงแต้มสมเหตุสมผล · ไม่มีสายไหนฆ่าได้เกิน ~12 ตัวต่อชีวิต", "");
for (const name of Object.keys(BUILDS)) {
  md.push(`## ${name}`, "", "| Lv | STR | AGI | VIT | INT | DEX | มอน | HP | ATK | DEF | ตีทุก (ms) | หลบ % | คริ % | ฆ่า 1 ตัว (วิ) | อยู่รอด (วิ) | ฆ่าได้/ชีวิต | เวลาสะสม (นาที) |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows.filter((x) => x.build === name))
    md.push(`| ${r.lv} | ${r.str} | ${r.agi} | ${r.vit} | ${r.int} | ${r.dex} | ${r.mob} | ${r.hp} | ${r.atk} | ${r.def} | ${r.atkDelay} | ${r.flee} | ${r.crit} | ${r.ttk} | ${r.ttd} | ${r.killsPerLife} | ${r.minutesSoFar} |`);
  md.push("");
}
fs.writeFileSync(path.join(outDir, "balance.md"), md.join("\n"));
console.log("สรุป (นาทีถึง Lv.20):");
for (const s of summary) console.log(`  ${s.name.padEnd(18)} ${String(s.minutes).padStart(4)} นาที · ฆ่า/ชีวิต @Lv20 ${s.kpl}`);
console.log("→ docs/balance.md, docs/balance.csv");

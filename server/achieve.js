// =============================================================
//  ระบบสะสม (ทาง A เฟส 2): สมุดบันทึกมอนสเตอร์ + ความสำเร็จ (achievement) + ฉายา
//  · นับที่เซิร์ฟเวอร์ (WorldRoom เรียก kill / add / set / visit)
//  · สมุดมอน: ฆ่าครบ 30 / 200 / 1000 ตัว = ★1–3 · ★ ให้เหรียญกิจกรรม · ★2 ดรอปมอนนั้น +10% · ★3 ดาเมจใส่มอนนั้น +5%
//  · ความสำเร็จ: ปลดล็อกแล้วได้รางวัลทันที (gold / เหรียญกิจกรรม / ฉายา) — ฉายาเป็นของอวด ไม่มีค่าพลัง
//  เพิ่มความสำเร็จใหม่ได้ที่ ACH (ไม่ต้องแตะโค้ดส่วนอื่น)
// =============================================================
const D = require("./data");

const STAR = [30, 200, 1000];                 // ฆ่าครบกี่ตัวได้ ★1/★2/★3
const STAR_AP = [3, 8, 20];                   // เหรียญกิจกรรมตอนได้ดาว
const STAR2_DROP = 0.1, STAR3_DMG = 0.05;     // โบนัสถาวรของดาว 2 / 3

// stat: kills ฆ่ามอนรวม · elite ชั้นยอด · mini มินิบอส · boss World Boss · found มอนที่เคยฆ่าในสมุด · star3 มอน ★3
//       maps ทุ่งที่เคยไป · daily ภารกิจรายวันที่รับรางวัล · dailyAll วันที่ทำครบ · rift / sd เคลียร์รอยแยก/ดันภูติ · level เลเวล
// rw: { gold, ap } · title = ฉายาที่ปลดล็อก
const ACH = [
  { id: "kill100", name: "ล่าครั้งแรก", stat: "kills", need: 100, rw: { gold: 2000, ap: 5 } },
  { id: "kill1k", name: "นักล่า", stat: "kills", need: 1000, rw: { gold: 10000, ap: 15 }, title: "นักล่า" },
  { id: "kill10k", name: "นักล่ามืออาชีพ", stat: "kills", need: 10000, rw: { gold: 60000, ap: 40 }, title: "นักล่ามืออาชีพ" },
  { id: "kill50k", name: "ราชันแห่งการล่า", stat: "kills", need: 50000, rw: { gold: 250000, ap: 100 }, title: "ราชันแห่งการล่า" },
  { id: "elite10", name: "ไม่กลัวตัวใหญ่", stat: "elite", need: 10, rw: { gold: 5000, ap: 10 } },
  { id: "elite200", name: "นักล้มยักษ์", stat: "elite", need: 200, rw: { gold: 40000, ap: 30 }, title: "นักล้มยักษ์" },
  { id: "mini1", name: "ท้าชนหัวหน้า", stat: "mini", need: 1, rw: { gold: 5000, ap: 10 } },
  { id: "mini30", name: "ปราบหัวหน้าเผ่า", stat: "mini", need: 30, rw: { gold: 50000, ap: 40 }, title: "ผู้ปราบหัวหน้า" },
  { id: "boss1", name: "ร่วมล้มบอสโลก", stat: "boss", need: 1, rw: { gold: 20000, ap: 20 } },
  { id: "boss20", name: "ผู้พิชิตบอส", stat: "boss", need: 20, rw: { gold: 150000, ap: 80 }, title: "ผู้พิชิตบอส" },
  { id: "found10", name: "เปิดสมุดบันทึก", stat: "found", need: 10, rw: { gold: 3000, ap: 10 } },
  { id: "found40", name: "นักชีววิทยา", stat: "found", need: 40, rw: { gold: 30000, ap: 30 }, title: "นักชีววิทยา" },
  { id: "foundAll", name: "สารานุกรมมีชีวิต", stat: "found", need: "all", rw: { gold: 200000, ap: 100 }, title: "สารานุกรมมีชีวิต" },
  { id: "star3x5", name: "ผู้เชี่ยวชาญ", stat: "star3", need: 5, rw: { gold: 50000, ap: 40 }, title: "ผู้เชี่ยวชาญ" },
  { id: "maps5", name: "ออกเดินทาง", stat: "maps", need: 5, rw: { gold: 3000, ap: 5 } },
  { id: "mapsAll", name: "นักสำรวจ", stat: "maps", need: "all", rw: { gold: 50000, ap: 40 }, title: "นักสำรวจ" },
  { id: "daily10", name: "ขยันทุกวัน", stat: "daily", need: 10, rw: { gold: 5000, ap: 10 } },
  { id: "daily120", name: "ไม่เคยขาด", stat: "dailyAll", need: 30, rw: { gold: 80000, ap: 60 }, title: "ผู้ไม่เคยขาด" },
  { id: "rift1", name: "ก้าวเข้ารอยแยก", stat: "rift", need: 1, rw: { gold: 5000, ap: 10 } },
  { id: "rift30", name: "ผู้ปิดรอยแยก", stat: "rift", need: 30, rw: { gold: 80000, ap: 50 }, title: "ผู้ปิดรอยแยก" },
  { id: "sd1", name: "ลองดันภูติ", stat: "sd", need: 1, rw: { gold: 3000, ap: 5 } },
  { id: "sd30", name: "สหายภูติ", stat: "sd", need: 30, rw: { gold: 60000, ap: 40 }, title: "สหายภูติ" },
  { id: "lv30", name: "เลเวล 30", stat: "level", need: 30, rw: { gold: 5000, ap: 10 } },
  { id: "lv60", name: "เลเวล 60", stat: "level", need: 60, rw: { gold: 20000, ap: 20 } },
  { id: "lv90", name: "เลเวล 90", stat: "level", need: 90, rw: { gold: 60000, ap: 40 }, title: "ผู้มากประสบการณ์" },
  { id: "lvMax", name: "สุดทางเลเวล", stat: "level", need: "max", rw: { gold: 200000, ap: 100 }, title: "ตำนานมีชีวิต" },
];

const MOBS = () => Object.keys(D.MONSTERS);
function fieldIds() { const W = require("./maps"); return Object.entries(W.MAPS).filter(([, m]) => m.type === "field").map(([id]) => id); }
function needOf(a) {
  if (a.need === "all") return a.stat === "found" ? MOBS().length : fieldIds().length;
  if (a.need === "max") return D.MAX_LEVEL;
  return a.need;
}
const starOf = (n) => (n >= STAR[2] ? 3 : n >= STAR[1] ? 2 : n >= STAR[0] ? 1 : 0);

function sanitize(a) {
  a = a && typeof a === "object" ? a : {};
  const st = {};
  for (const [k, v] of Object.entries(a.st || {})) st[k] = Math.max(0, Math.floor(Number(v) || 0));
  const codex = {};
  for (const [k, v] of Object.entries(a.codex || {})) if (D.MONSTERS[k]) codex[k] = Math.max(0, Math.floor(Number(v) || 0));
  const fields = new Set(fieldIds());
  return { st, codex, maps: [...new Set((a.maps || []).filter((m) => fields.has(m)))], done: [...new Set((a.done || []).filter((id) => ACH.some((x) => x.id === id)))], title: typeof a.title === "string" ? a.title : "" };
}
function ensure(p) { if (!p.ach) p.ach = sanitize(null); return p.ach; }

// ค่าปัจจุบันของ stat (บางตัวคำนวณจากข้อมูลอื่น)
function statOf(p, k) {
  const A = ensure(p);
  if (k === "found") return Object.values(A.codex).filter((n) => n > 0).length;
  if (k === "star3") return Object.values(A.codex).filter((n) => n >= STAR[2]).length;
  if (k === "maps") return A.maps.length;
  if (k === "level") return p.level;
  return A.st[k] || 0;
}

// ตรวจความสำเร็จที่เพิ่งปลดล็อก → คืนรายการ (ผู้เรียกเป็นคนให้รางวัล)
function check(p) {
  const A = ensure(p), got = [];
  for (const a of ACH) {
    if (A.done.includes(a.id)) continue;
    if (statOf(p, a.stat) >= needOf(a)) { A.done.push(a.id); got.push(a); }
  }
  return got;
}

// ฆ่ามอน → คืน { star: ดาวใหม่ (ถ้าเพิ่งได้), got: ความสำเร็จใหม่ }
function kill(p, mob) {
  const A = ensure(p);
  A.st.kills = (A.st.kills || 0) + 1;
  if (mob.boss) A.st.boss = (A.st.boss || 0) + 1;
  else if (mob.rank === 2) A.st.mini = (A.st.mini || 0) + 1;
  else if (mob.rank === 1) A.st.elite = (A.st.elite || 0) + 1;
  let star = 0;
  if (D.MONSTERS[mob.kind]) {
    const before = starOf(A.codex[mob.kind] || 0);
    A.codex[mob.kind] = (A.codex[mob.kind] || 0) + 1;
    const after = starOf(A.codex[mob.kind]);
    if (after > before) star = after;
  }
  return { star, first: D.MONSTERS[mob.kind] && A.codex[mob.kind] === 1, got: check(p) };
}
function add(p, k, n = 1) { const A = ensure(p); A.st[k] = (A.st[k] || 0) + n; return check(p); }
function visit(p, mapId) {
  const A = ensure(p);
  if (!fieldIds().includes(mapId) || A.maps.includes(mapId)) return [];
  A.maps.push(mapId);
  return check(p);
}

// โบนัสถาวรจากสมุดมอน
const dmgMul = (p, kind) => (p.ach && (p.ach.codex[kind] || 0) >= STAR[2] ? 1 + STAR3_DMG : 1);
const dropMul = (p, kind) => (p.ach && (p.ach.codex[kind] || 0) >= STAR[1] ? 1 + STAR2_DROP : 1);

// ข้อมูลส่งให้หน้าจอ
function view(p, mobInfo) {
  const A = ensure(p);
  return {
    star: STAR, starAp: STAR_AP, star2Drop: STAR2_DROP, star3Dmg: STAR3_DMG,
    codex: A.codex, maps: A.maps, title: A.title, mobInfo,
    ach: ACH.map((a) => ({ id: a.id, name: a.name, stat: a.stat, need: needOf(a), have: Math.min(needOf(a), statOf(p, a.stat)), done: A.done.includes(a.id), rw: a.rw, title: a.title || null })),
  };
}
const titles = (p) => ACH.filter((a) => a.title && ensure(p).done.includes(a.id)).map((a) => a.title);

module.exports = { ACH, STAR, STAR_AP, starOf, sanitize, ensure, kill, add, visit, check, dmgMul, dropMul, view, titles };

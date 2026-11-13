// =============================================================
//  ภารกิจรายวัน + เหรียญกิจกรรม (ทาง A เฟส 1)
//  · รีเซ็ตทุกเที่ยงคืนเวลาไทย · สุ่ม 4 ข้อตามเลเวลตอนรับ · ทำครบทุกข้อได้โบนัส
//  · นับคืบหน้าที่เซิร์ฟเวอร์เท่านั้น (WorldRoom เรียก event()) · รางวัล = EXP + gold + เหรียญกิจกรรม (ap)
//  · เหรียญกิจกรรมสะสมข้ามวัน เอาไปแลกของที่ร้าน SHOP
//  แก้/เพิ่มชนิดภารกิจได้ที่ KINDS · แก้ของในร้านได้ที่ SHOP (ไม่ต้องแตะโค้ดส่วนอื่น)
// =============================================================
const D = require("./data");

const N_MISSIONS = 4;
const AP_EACH = 10, AP_BONUS = 20;
const TZ_MS = 7 * 3600e3; // เวลาไทย UTC+7
const dayKey = (t = Date.now()) => new Date(t + TZ_MS).toISOString().slice(0, 10);
const msToReset = (t = Date.now()) => { const d = new Date(t + TZ_MS); return (24 * 3600e3) - ((d.getUTCHours() * 60 + d.getUTCMinutes()) * 60e3 + d.getUTCSeconds() * 1e3 + d.getUTCMilliseconds()); };
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ทุ่ง (แผนที่ฟาร์ม) ที่เหมาะกับเลเวล: ช่วงเลเวลครอบเรา หรือใกล้ที่สุดที่ต่ำกว่า
function fieldsFor(lv) {
  const W = require("./maps");
  const F = Object.entries(W.MAPS).filter(([, m]) => m.type === "field" && m.lv && m.spawns && m.spawns.length);
  let ok = F.filter(([, m]) => m.lv[0] <= lv && m.lv[1] >= lv - 6);
  if (!ok.length) ok = F.filter(([, m]) => m.lv[0] <= lv).sort((a, b) => b[1].lv[0] - a[1].lv[0]).slice(0, 1);
  if (!ok.length) ok = F.sort((a, b) => a[1].lv[0] - b[1].lv[0]).slice(0, 1);
  return ok;
}

// ชนิดภารกิจ: make(lv) → { kind, need, target?, text } · ข้อแรกเป็น hunt เสมอ อีก 3 ข้อสุ่มจากที่เหลือ
const KINDS = {
  hunt: (lv) => {
    const [mapId, M] = pick(fieldsFor(lv)), kind = pick(M.spawns)[0], mon = D.MONSTERS[kind];
    const need = ri(25, 40);
    return { kind: "hunt", target: kind, map: mapId, need, text: `ล่า${mon.name} ${need} ตัว`, where: M.name };
  },
  slay: (lv) => { const need = ri(12, 18) * 5; return { kind: "slay", need, text: `ปราบมอนเลเวล ${Math.max(1, lv - 8)}+ ให้ได้ ${need} ตัว` }; },
  elite: (lv) => (lv < 8 ? null : { kind: "elite", need: 3, text: "ปราบมอนชั้นยอดหรือมินิบอส 3 ตัว" }),
  skill: () => { const need = ri(6, 10) * 5; return { kind: "skill", need, text: `ใช้สกิล ${need} ครั้ง` }; },
  loot: () => { const need = ri(3, 5) * 5; return { kind: "loot", need, text: `เก็บวัตถุดิบจากมอน ${need} ชิ้น` }; },
  visit: (lv) => {
    const [mapId, M] = pick(fieldsFor(lv));
    return { kind: "visit", target: mapId, need: 1, text: `ไปเยือน${M.name}` };
  },
  clear: (lv) => (lv < 10 ? null : { kind: "clear", need: 1, text: "เคลียร์ดันเจี้ยนภูติหรือรอยแยกมิติ 1 รอบ" }),
};

// รางวัลต่อข้อ (คิดจากเลเวลตอนสุ่ม)
function rewardFor(lv) {
  const need = D.expToNext(lv) || D.expToNext(D.MAX_LEVEL - 1);
  return { exp: Math.round(need * (lv < 30 ? 0.12 : lv < 70 ? 0.08 : 0.06)), gold: lv * 150, ap: AP_EACH };
}
function bonusFor(lv) {
  const need = D.expToNext(lv) || D.expToNext(D.MAX_LEVEL - 1);
  return { exp: Math.round(need * (lv < 30 ? 0.2 : lv < 70 ? 0.14 : 0.1)), gold: lv * 400, ap: AP_BONUS };
}

function generate(lv, prevAp = 0) {
  const list = [KINDS.hunt(lv)];
  const rest = Object.keys(KINDS).filter((k) => k !== "hunt").sort(() => Math.random() - 0.5);
  for (const k of rest) {
    if (list.length >= N_MISSIONS) break;
    const m = KINDS[k](lv);
    if (m) list.push(m);
  }
  const rw = rewardFor(lv);
  return { day: dayKey(), lv, list: list.map((m) => ({ ...m, have: 0, claimed: false, rw })), bonus: false, bonusRw: bonusFor(lv), ap: prevAp };
}

// โหลดจากข้อมูลตัวละคร (กันข้อมูลเสีย)
function sanitize(d) {
  if (!d || typeof d !== "object") return null;
  const ap = Math.max(0, Math.floor(Number(d.ap) || 0));
  if (!Array.isArray(d.list)) return { day: "", lv: 1, list: [], bonus: false, ap };
  return { day: String(d.day || ""), lv: d.lv | 0, list: d.list.slice(0, N_MISSIONS).map((m) => ({ kind: String(m.kind), target: m.target || undefined, map: m.map || undefined, where: m.where || undefined,
    need: Math.max(1, m.need | 0), have: Math.max(0, m.have | 0), claimed: !!m.claimed, text: String(m.text || ""), rw: m.rw || rewardFor(d.lv | 0 || 1) })),
    bonus: !!d.bonus, bonusRw: d.bonusRw || bonusFor(d.lv | 0 || 1), ap };
}

// วันใหม่ → สุ่มใหม่ (เก็บเหรียญไว้) · คืน true ถ้าเพิ่งสุ่ม
function ensure(p) {
  if (!p.daily || p.daily.day !== dayKey()) { p.daily = generate(p.level, p.daily ? p.daily.ap : 0); return true; }
  return false;
}

// เหตุการณ์จากเกม → เพิ่มความคืบหน้า · คืนรายการข้อที่เพิ่งครบ
// ev: { kind: "kill", mob:{kind,level,rank} } | { kind: "skill" } | { kind: "loot", n } | { kind: "visit", map } | { kind: "clear" }
function event(p, ev) {
  ensure(p);
  const done = [];
  for (const m of p.daily.list) {
    if (m.have >= m.need) continue;
    let add = 0;
    if (ev.kind === "kill") {
      const mob = ev.mob;
      if (m.kind === "hunt" && mob.kind === m.target) add = 1;
      else if (m.kind === "slay" && mob.level >= Math.max(1, p.daily.lv - 8)) add = 1;
      else if (m.kind === "elite" && mob.rank >= 1) add = 1;
    } else if (ev.kind === m.kind) {
      if (m.kind === "visit") add = ev.map === m.target ? 1 : 0;
      else add = ev.n || 1;
    }
    if (!add) continue;
    m.have = Math.min(m.need, m.have + add);
    if (m.have >= m.need) done.push(m);
  }
  return done;
}

// ร้านเหรียญกิจกรรม: id, n = จำนวนที่ได้, cost = เหรียญ
const SHOP = [
  { k: "pot", id: "potion_l", n: 10, cost: 15 },
  { k: "potsp", id: "potion_sp_l", n: 10, cost: 15 },
  { k: "ticket", id: "sd_ticket", n: 1, cost: 20 },
  { k: "stone2", id: "stone_2", n: 1, cost: 25 },
  { k: "shard", id: "spirit_shard", n: 2, cost: 30 },
  { k: "stone3", id: "stone_3", n: 1, cost: 60 },
  { k: "canary", id: "pet_canary", n: 1, cost: 120 },
];

// ข้อมูลส่งให้หน้าจอ
function view(p) {
  ensure(p);
  const d = p.daily;
  return { day: d.day, resetIn: msToReset(), ap: d.ap, bonus: d.bonus, bonusRw: d.bonusRw,
    list: d.list.map((m, i) => ({ i, kind: m.kind, text: m.text, where: m.where, need: m.need, have: m.have, claimed: m.claimed, rw: m.rw })) };
}

module.exports = { dayKey, msToReset, generate, sanitize, ensure, event, view, SHOP, N_MISSIONS };

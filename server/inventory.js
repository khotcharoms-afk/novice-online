// =============================================================
//  กระเป๋า + ของสวมใส่ (ข้อมูลภายในของผู้เล่น ไม่ส่งให้คนอื่นเห็น)
//  inv  = อาเรย์ 100 ช่อง แต่ละช่อง {id, n} หรือ null
//  equip = { head: "nasal", weapon: "sword", ... }
// =============================================================
const I = require("./items");
const D = require("./data");
const SP = require("./spirits");
const isSpiritId = (id) => I.ITEMS[id] && I.ITEMS[id].type === "spirit";

const STARTER = { inv: [{ id: "mace", n: 1 }, { id: "potion_s", n: 5 }], gold: 50 };

const isGearId = (id) => I.ITEMS[id] && I.ITEMS[id].type === "equip";
// อุปกรณ์ 1 ชิ้น = { id, r: ระดับความหายาก, up: ตีบวก, x: ค่าพิเศษ } (ข้อมูลเก่าที่เป็นแค่ชื่อ → ระดับธรรมดา +0)
function normGear(o) {
  if (!o) return null;
  if (typeof o === "string") o = { id: o };
  if (!isGearId(o.id)) return null;
  const x = {};
  for (const [k, v] of Object.entries(o.x || {})) if (Number.isFinite(v)) x[k] = Math.round(v);
  return { id: o.id, r: Math.max(0, Math.min(I.RARITY.length - 1, o.r | 0)), up: Math.max(0, Math.min(I.MAX_REFINE, o.up | 0)), x, s: I.cleanSpecial(o.s) };
}
const gearSlot = (g) => ({ ...g, n: 1 });
const plain = (g) => ({ id: g.id, r: g.r, up: g.up, x: { ...g.x }, s: { ...(g.s || {}) } });
function emptyBag() { return { inv: new Array(I.INVENTORY_SIZE).fill(null), equip: {}, gold: 0, pet: null, spirit: null }; }

// โหลดจากฐานข้อมูล — ตัดไอเทมที่ไม่รู้จักทิ้ง; ตัวละครเก่าที่ยังไม่มีกระเป๋าได้ของเริ่มต้น
function loadBag(c) {
  const bag = emptyBag();
  if (!Array.isArray(c.inv)) {
    STARTER.inv.forEach((s, i) => (bag.inv[i] = { ...s }));
    bag.gold = STARTER.gold;
    return bag;
  }
  c.inv.slice(0, I.INVENTORY_SIZE).forEach((s, i) => {
    if (!s || !I.ITEMS[s.id] || !Number.isInteger(s.n) || s.n <= 0) return;
    bag.inv[i] = isGearId(s.id) ? gearSlot(normGear(s)) : isSpiritId(s.id) ? SP.norm(s) : { id: s.id, n: Math.min(s.n, maxStack(s.id)) };
  });
  for (const slot of I.EQUIP_SLOTS) {
    const g = normGear(c.equip && c.equip[slot]);
    if (g && I.fitsSlot(I.ITEMS[g.id], slot)) bag.equip[slot] = g;
  }
  // ข้อมูลเก่า: เครื่องประดับ acc1/acc2 → ย้ายเข้าช่องตามประเภท (ช่องซ้ำ → คืนเข้ากระเป๋า)
  for (const old of ["acc1", "acc2"]) {
    const g = normGear(c.equip && c.equip[old]);
    if (!g || !I.ITEMS[g.id]) continue;
    const slot = I.ITEMS[g.id].slot;
    if (!bag.equip[slot]) bag.equip[slot] = g;
    else { const free = bag.inv.findIndex((x) => !x); if (free >= 0) bag.inv[free] = gearSlot(g); }
  }
  bag.gold = Math.max(0, Math.floor(Number(c.gold) || 0));
  if (c.pet && I.ITEMS[c.pet] && I.ITEMS[c.pet].type === "pet") bag.pet = c.pet;
  bag.spirit = SP.norm(c.spirit);
  // เควสภูติที่รับอยู่ (ทำพร้อมกันได้หลายเควส): { sp_ember: จำนวนที่ปราบแล้ว, ... } · ข้อมูลเก่า {id, kills} แปลงให้
  bag.spq = {};
  if (c.spq && c.spq.id) { if (SP.SPIRIT_QUESTS[c.spq.id]) bag.spq[c.spq.id] = Math.max(0, c.spq.kills | 0); }
  else if (c.spq && typeof c.spq === "object") for (const [k, v] of Object.entries(c.spq)) if (SP.SPIRIT_QUESTS[k]) bag.spq[k] = Math.max(0, v | 0);
  return bag;
}
const saveBag = (b) => ({
  inv: b.inv.map((s) => (!s ? null : isGearId(s.id) ? gearSlot(plain(s)) : isSpiritId(s.id) ? SP.norm(s) : { id: s.id, n: s.n })),
  equip: Object.fromEntries(Object.entries(b.equip).map(([k, g]) => [k, plain(g)])), gold: b.gold, pet: b.pet || null, spirit: b.spirit ? SP.norm(b.spirit) : null, spq: { ...(b.spq || {}) } });

// ช่องของ 1 ช่อง (ใช้กับคลัง/เทรด): ทำให้ถูกรูปแบบ / แปลงเป็นข้อมูลบันทึก
function normSlot(s) {
  if (!s || !I.ITEMS[s.id] || !Number.isInteger(s.n) || s.n <= 0) return null;
  return isGearId(s.id) ? gearSlot(normGear(s)) : isSpiritId(s.id) ? SP.norm(s) : { id: s.id, n: Math.min(s.n, maxStack(s.id)) };
}
const plainSlot = (s) => (!s ? null : isGearId(s.id) ? gearSlot(plain(s)) : isSpiritId(s.id) ? SP.norm(s) : { id: s.id, n: s.n });
// ---------- คลังเก็บของ (ใช้ร่วมกันทุกตัวละครในไอดีเดียวกัน) ----------
const STORAGE_SIZE = 150;
function loadStorage(raw) {
  const st = { inv: new Array(STORAGE_SIZE).fill(null), gold: 0 };
  if (raw && Array.isArray(raw.inv)) raw.inv.slice(0, STORAGE_SIZE).forEach((s, i) => (st.inv[i] = normSlot(s)));
  st.gold = Math.max(0, Math.floor(Number(raw && raw.gold) || 0));
  return st;
}
const saveStorage = (st) => ({ inv: st.inv.map(plainSlot), gold: st.gold });
// ย้ายของจากช่อง idx ของ from → to (ทั้งคู่เป็น {inv:[]}) จำนวน n · คืนข้อความผิดพลาด หรือ null
function moveBetween(from, idx, to, n) {
  const s = from.inv[idx];
  if (!s) return "ช่องนี้ว่าง";
  n = Math.max(1, Math.min(s.n, Math.floor(n) || s.n));
  const single = maxStack(s.id) === 1;
  if (single ? !to.inv.some((x) => !x) : !canFit(to, s.id, n)) return "ที่ว่างไม่พอ";
  if (single) { const free = to.inv.findIndex((x) => !x); to.inv[free] = normSlot({ ...s, n: 1 }); from.inv[idx] = null; return null; }
  addItem(to, s.id, n);
  removeAt(from, idx, n);
  return null;
}
const maxStack = (id) => (I.ITEMS[id] && (I.ITEMS[id].type === "equip" || I.ITEMS[id].type === "pet" || I.ITEMS[id].type === "spirit") ? 1 : I.MAX_STACK);

// ใส่ของเข้ากระเป๋า → คืนจำนวนที่ใส่ไม่ลง (กระเป๋าเต็ม)
// gear = ข้อมูลอุปกรณ์ (ระดับ/ตีบวก) ถ้าไม่ใส่ = ระดับธรรมดา
function addItem(b, id, n, gear) {
  if (!I.ITEMS[id]) return n;
  if (isGearId(id)) {
    for (let i = 0; i < b.inv.length && n > 0; i++)
      if (!b.inv[i]) { b.inv[i] = gearSlot(normGear(gear || { id })); n--; gear = null; }
    return n;
  }
  if (isSpiritId(id)) { // ภูติ: gear = ข้อมูลภูติ {r, lv, ex}
    for (let i = 0; i < b.inv.length && n > 0; i++)
      if (!b.inv[i]) { b.inv[i] = SP.norm({ ...(gear || {}), id }); n--; gear = null; }
    return n;
  }
  const cap = maxStack(id);
  for (const s of b.inv) if (n > 0 && s && s.id === id && s.n < cap) { const k = Math.min(n, cap - s.n); s.n += k; n -= k; }
  for (let i = 0; i < b.inv.length && n > 0; i++) if (!b.inv[i]) { const k = Math.min(n, cap); b.inv[i] = { id, n: k }; n -= k; }
  return n;
}
function canFit(b, id, n) {
  const cap = maxStack(id);
  let room = 0;
  for (const s of b.inv) room += !s ? cap : s.id === id ? cap - s.n : 0;
  return room >= n;
}
function removeAt(b, idx, n = 1) {
  const s = b.inv[idx];
  if (!s || s.n < n) return false;
  s.n -= n;
  if (s.n <= 0) b.inv[idx] = null;
  return true;
}
const countOf = (b, id) => b.inv.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0);
const indexOf = (b, id) => b.inv.findIndex((s) => s && s.id === id);

// ค่าพลังรวมจากของที่สวม
// ของที่สวมและอาชีพนี้ใส่ได้จริง (ของที่ใส่ไม่ได้ไม่นับค่าพลัง/เซ็ต)
const activeGear = (b, job) => Object.values(b.equip).filter((g) => !(job && wearError(job, I.ITEMS[g.id])));
function gearBonus(b, job) {
  const sum = { atk: 0, def: 0, str: 0, agi: 0, vit: 0, int: 0, dex: 0, maxHp: 0, maxSp: 0 };
  const gear = activeGear(b, job);
  const add = (o) => { for (const k in o) sum[k] = (sum[k] || 0) + o[k]; };
  for (const g of gear) { add(I.gearStats(g)); add(I.refineFxOf(g).b); }
  add(I.setBonus(gear.map((g) => g.id)).b);
  return sum;
}
const activeSets = (b, job) => I.setBonus(activeGear(b, job).map((g) => g.id)).active;
// สเตตัสแฝงรวมจากของที่สวม (ของที่อาชีพนี้ใส่ไม่ได้ไม่นับ) · มีเพดานบางค่า
function gearSpecial(b, job) {
  const sum = {}, gear = activeGear(b, job);
  const add = (o) => { for (const [k, v] of Object.entries(o)) sum[k] = (sum[k] || 0) + v; };
  for (const g of gear) { add(I.gearSpecial(g)); add(I.refineFxOf(g).sp); }
  add(I.setBonus(gear.map((g) => g.id)).sp);
  for (const k in sum) if (I.SPECIAL[k].cap) sum[k] = Math.min(I.SPECIAL[k].cap, sum[k]);
  return sum;
}
// รายการของที่ต้องวาดบนตัวละคร (ตามลำดับชั้นภาพ) → ส่งให้ทุกคนเห็น
const DRAW_ORDER = ["shoes", "armor", "gloves", "cape", "face", "head", "weapon", "offhand"];
// รูปแบบ "ช่อง:ไอเทม" เช่น "armor:chain,head:nasal,weapon:sword"
const idOf = (g) => (typeof g === "string" ? g : g && g.id);
const gearString = (b) => DRAW_ORDER.filter((s) => I.ITEMS[idOf(b.equip[s])] && I.ITEMS[idOf(b.equip[s])].visual)
  .map((s) => `${s}:${idOf(b.equip[s])}`).join(",");

// แสงตีบวก: เฉพาะอาวุธหลัก/มือรองที่ตีบวก +7 ขึ้นไป → "weapon:10,offhand:7" (ชุดไม่เรืองแสง)
const glowString = (b) => ["weapon", "offhand"]
  .filter((s) => b.equip[s] && typeof b.equip[s] === "object" && (b.equip[s].up || 0) >= 7 && I.ITEMS[idOf(b.equip[s])] && I.ITEMS[idOf(b.equip[s])].visual)
  .map((s) => `${s}:${b.equip[s].up}`).join(",");

// อาชีพนี้ใส่ไอเทมนี้ได้ไหม → คืนข้อความเหตุผลถ้าใส่ไม่ได้ (null = ใส่ได้)
//  อาวุธ/โล่: ล็อกตามอาชีพ (ชาวบ้านใช้ได้ทุกชนิดที่ Lv ต่ำกว่า 20)
//  เกราะ (หนัก/เบา/ผ้า): ของ Lv ต่ำกว่า 20 ใส่ได้ทุกอาชีพ · Lv20 ขึ้นไปต้องตรงประเภทของอาชีพ
//  ผ้าคลุม/หน้า/เครื่องประดับ: ใส่ได้ทุกอาชีพ
// ของ Lv.50+ ที่ล็อกอาชีพ (อาวุธ/ชุด/มือรอง) → ต้องเป็นอาชีพขั้น 2 · ของประดับไม่ล็อก
const job2Locked = (it) => it && it.type === "equip" && (it.lv || 1) >= D.JOB2_LEVEL && !!(it.wt || it.ac || it.ot);
function wearError(job, it) {
  const err = lineWearError(job, it);
  if (err || !job2Locked(it)) return err;
  if ((D.JOBS[job] || {}).tier === 2) return null;
  return `ต้องเลื่อนขั้นเป็น${jobsFor(it).map((j) => D.JOBS[j].name).join("/")}ก่อน (อาชีพขั้น 2 · Lv.${D.JOB2_LEVEL})`;
}
// กฎตามสายอาชีพ (ไม่สนขั้น)
function lineWearError(job, it) {
  const J = D.JOBS[job] || D.JOBS.villager;
  if (!it || it.type !== "equip") return "ใส่ไอเทมนี้ไม่ได้";
  const lv = it.lv || 1;
  if (it.ot) { // มือรองประจำอาชีพ
    if (J.offhand !== it.ot) return `ใช้ได้เฉพาะ${Object.values(D.JOBS).filter((x) => x.offhand === it.ot).map((x) => x.name).join("/")}`;
    return null;
  }
  if (it.wt === "shield") {
    if (!J.shield) return `${J.name}ใช้โล่ไม่ได้`;
    if (job === "villager" && lv >= D.JOB_FREE_LV) return `ต้องเป็นผู้พิทักษ์`;
    return null;
  }
  if (it.wt) {
    if (job === "villager") return lv >= D.JOB_FREE_LV ? `ต้องเป็น${lineJobs(it).map((j) => D.JOBS[j].name).join("/")}` : null;
    if (!J.weapons.includes(it.wt)) return `${J.name}ใช้${D.WEAPON_TYPES[it.wt].name}ไม่ได้`;
    return null;
  }
  if (it.ac && lv >= D.JOB_FREE_LV && !(J.armor || []).includes(it.ac))
    return job === "villager" ? `ต้องเป็น${lineJobs(it).map((j) => D.JOBS[j].name).join("/")}` : `${J.name}ใส่${D.ARMOR_NAME[it.ac]}ไม่ได้`;
  return null;
}
// อาชีพที่ใช้ไอเทมนี้ได้ (ไม่นับชาวบ้าน) — ใช้แสดงในการ์ดไอเทม
// Lv.50+ ที่ล็อกอาชีพ → แสดงอาชีพขั้น 2 · ต่ำกว่านั้น → อาชีพขั้น 1 (ขั้น 2 ใส่ได้ตามสายเดิม)
const lineJobs = (it) => Object.keys(D.JOBS).filter((j) => j !== "villager" && !D.JOBS[j].tier && !lineWearError(j, it));
function jobsFor(it) {
  const t2 = job2Locked(it);
  return Object.keys(D.JOBS).filter((j) => j !== "villager" && (t2 ? D.JOBS[j].tier === 2 : !D.JOBS[j].tier) && !lineWearError(j, it));
}
const weaponType = (b) => { const g = b.equip.weapon; const it = g && I.ITEMS[g.id]; return (it && it.wt) || null; };

// สวมของจากช่องกระเป๋า idx (ของที่ใส่อยู่เดิมสลับกลับเข้ากระเป๋าช่องเดิม)
function equipFrom(b, idx, level, want, job = "villager") {
  const s = b.inv[idx];
  const it = s && I.ITEMS[s.id];
  if (!it || it.type !== "equip") return "ใส่ไอเทมนี้ไม่ได้";
  if (level < (it.lv || 1)) return `ต้องเลเวล ${it.lv} ขึ้นไป`;
  const err = wearError(job, it);
  if (err) return err;
  let slot = it.slot;
  // อาวุธสองมือกับโล่ใช้พร้อมกันไม่ได้
  if (it.wt === "shield") {
    const w = weaponType(b);
    if (w && D.WEAPON_TYPES[w].twoHand) return `${D.WEAPON_TYPES[w].name}เป็นอาวุธสองมือ ใส่โล่ไม่ได้`;
  }
  const offIsShield = b.equip.offhand && I.ITEMS[b.equip.offhand.id] && I.ITEMS[b.equip.offhand.id].wt === "shield";
  if (it.wt && D.WEAPON_TYPES[it.wt] && D.WEAPON_TYPES[it.wt].twoHand && offIsShield) {
    const free = b.inv.findIndex((x, i) => !x && i !== idx);
    if (free < 0 && b.equip.weapon) return "กระเป๋าเต็ม (ต้องถอดโล่ก่อน)";
    if (free >= 0) { b.inv[free] = gearSlot(b.equip.offhand); delete b.equip.offhand; }
    else { const off = b.equip.offhand; delete b.equip.offhand; b.equip.weapon = plain(normGear(s)); b.inv[idx] = gearSlot(off); return null; }
  }
  const old = b.equip[slot];
  b.equip[slot] = plain(normGear(s));
  b.inv[idx] = old ? gearSlot(old) : null;
  return null;
}
// ถอดของที่อาชีพนี้ใส่ไม่ได้เข้ากระเป๋า (หลังเปลี่ยนอาชีพ) → คืนรายการชื่อของที่ถอด
function stripInvalid(b, job) {
  const out = [];
  for (const slot of Object.keys(b.equip)) {
    const g = b.equip[slot], it = I.ITEMS[g.id];
    if (!wearError(job, it)) continue;
    const free = b.inv.findIndex((x) => !x);
    if (free < 0) continue; // กระเป๋าเต็ม — ยังใส่ไว้ แต่ค่าพลังไม่นับ
    b.inv[free] = gearSlot(g); delete b.equip[slot]; out.push(it.name);
  }
  return out;
}
function unequip(b, slot) {
  const g = b.equip[slot];
  if (!g) return null;
  const free = b.inv.findIndex((x) => !x);
  if (free < 0) return "กระเป๋าเต็ม";
  b.inv[free] = gearSlot(g);
  delete b.equip[slot];
  return null;
}
// เรียกสัตว์เลี้ยงจากช่องกระเป๋า idx (ตัวเดิมที่ออกมาอยู่สลับกลับเข้ากระเป๋า)
function summonPet(b, idx, level) {
  const s = b.inv[idx], it = s && I.ITEMS[s.id];
  if (!it || it.type !== "pet") return "ไม่ใช่สัตว์เลี้ยง";
  if (level < (it.lv || 1)) return `ต้องเลเวล ${it.lv} ขึ้นไป`;
  const old = b.pet;
  b.pet = s.id;
  b.inv[idx] = old ? { id: old, n: 1 } : null;
  return null;
}
function recallPet(b) {
  if (!b.pet) return null;
  const free = b.inv.findIndex((x) => !x);
  if (free < 0) return "กระเป๋าเต็ม";
  b.inv[free] = { id: b.pet, n: 1 };
  b.pet = null;
  return null;
}
// เรียกภูติจากช่องกระเป๋า idx (ตัวเดิมสลับกลับเข้ากระเป๋า)
function summonSpirit(b, idx, level) {
  const s = b.inv[idx];
  if (!s || !isSpiritId(s.id)) return "ไม่ใช่ภูติ";
  const old = b.spirit;
  b.spirit = SP.norm(s);
  b.inv[idx] = old ? SP.norm(old) : null;
  return null;
}
function recallSpirit(b) {
  if (!b.spirit) return null;
  const free = b.inv.findIndex((x) => !x);
  if (free < 0) return "กระเป๋าเต็ม";
  b.inv[free] = SP.norm(b.spirit);
  b.spirit = null;
  return null;
}
// เรียงกระเป๋า: อุปกรณ์ (ตามช่อง → ระดับ → ตีบวก → เลเวล) · ของใช้ · สัตว์เลี้ยง · คริสตัล · วัตถุดิบ
// รวมกองของชนิดเดียวกันที่แยกกันอยู่ให้เป็นกองเดียวด้วย
const SORT_SLOT = ["weapon", "offhand", "head", "face", "armor", "gloves", "cape", "shoes", "neck", "ring", "ear"];
const SORT_TYPE = { equip: 0, use: 1, pet: 2, spirit: 2, material: 4 };
function sortBag(b) {
  const items = b.inv.filter(Boolean);
  // รวมกอง
  const merged = [], pile = new Map();
  for (const s of items) {
    if (isGearId(s.id) || maxStack(s.id) === 1) { merged.push({ ...s }); continue; }
    pile.set(s.id, (pile.get(s.id) || 0) + s.n);
  }
  for (const [id, total] of pile) {
    let left = total;
    while (left > 0) { const k = Math.min(left, maxStack(id)); merged.push({ id, n: k }); left -= k; }
  }
  const key = (s) => {
    const it = I.ITEMS[s.id];
    const type = /^stone_/.test(s.id) ? 3 : SORT_TYPE[it.type] ?? 5;
    const slot = it.type === "equip" ? SORT_SLOT.indexOf(it.slot) : 0;
    return [type, slot, -(s.r || 0), -(s.lv || 0), -(s.up || 0), -(it.lv || 0), it.price || it.sell || 0, s.id, -s.n];
  };
  merged.sort((a, c) => {
    const ka = key(a), kc = key(c);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kc[i]) return ka[i] < kc[i] ? -1 : 1;
    return 0;
  });
  b.inv = new Array(b.inv.length).fill(null);
  merged.slice(0, b.inv.length).forEach((s, i) => (b.inv[i] = s));
}
function moveSlot(b, from, to) {
  if (from === to || !b.inv[from] || to < 0 || to >= b.inv.length) return;
  const a = b.inv[from], c = b.inv[to];
  if (c && c.id === a.id && c.n < maxStack(a.id)) { // รวมกอง
    const k = Math.min(a.n, maxStack(a.id) - c.n);
    c.n += k; a.n -= k;
    if (a.n <= 0) b.inv[from] = null;
    return;
  }
  b.inv[from] = c; b.inv[to] = a;
}

module.exports = { normSlot, plainSlot, STORAGE_SIZE, loadStorage, saveStorage, moveBetween, sortBag, normGear, isGearId, emptyBag, loadBag, saveBag, addItem, canFit, removeAt, countOf, indexOf, gearBonus, gearString, glowString,
  equipFrom, unequip, moveSlot, summonPet, recallPet, summonSpirit, recallSpirit, isSpiritId, maxStack, STARTER, wearError, jobsFor, weaponType, stripInvalid, gearSpecial, activeSets };

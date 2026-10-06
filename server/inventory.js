// =============================================================
//  กระเป๋า + ของสวมใส่ (ข้อมูลภายในของผู้เล่น ไม่ส่งให้คนอื่นเห็น)
//  inv  = อาเรย์ 40 ช่อง แต่ละช่อง {id, n} หรือ null
//  equip = { head: "nasal", weapon: "sword", ... }
// =============================================================
const I = require("./items");

const STARTER = { inv: [{ id: "mace", n: 1 }, { id: "potion_s", n: 5 }], gold: 50 };

function emptyBag() { return { inv: new Array(I.INVENTORY_SIZE).fill(null), equip: {}, gold: 0 }; }

// โหลดจากฐานข้อมูล — ตัดไอเทมที่ไม่รู้จักทิ้ง; ตัวละครเก่าที่ยังไม่มีกระเป๋าได้ของเริ่มต้น
function loadBag(c) {
  const bag = emptyBag();
  if (!Array.isArray(c.inv)) {
    STARTER.inv.forEach((s, i) => (bag.inv[i] = { ...s }));
    bag.gold = STARTER.gold;
    return bag;
  }
  c.inv.slice(0, I.INVENTORY_SIZE).forEach((s, i) => {
    if (s && I.ITEMS[s.id] && Number.isInteger(s.n) && s.n > 0) bag.inv[i] = { id: s.id, n: Math.min(s.n, maxStack(s.id)) };
  });
  for (const slot of I.EQUIP_SLOTS) {
    const id = c.equip && c.equip[slot];
    if (id && I.fitsSlot(I.ITEMS[id], slot)) bag.equip[slot] = id;
  }
  bag.gold = Math.max(0, Math.floor(Number(c.gold) || 0));
  return bag;
}
const saveBag = (b) => ({ inv: b.inv.map((s) => (s ? { id: s.id, n: s.n } : null)), equip: { ...b.equip }, gold: b.gold });

const maxStack = (id) => (I.ITEMS[id] && I.ITEMS[id].type === "equip" ? 1 : I.MAX_STACK);

// ใส่ของเข้ากระเป๋า → คืนจำนวนที่ใส่ไม่ลง (กระเป๋าเต็ม)
function addItem(b, id, n) {
  if (!I.ITEMS[id]) return n;
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
function gearBonus(b) {
  const sum = { atk: 0, def: 0, str: 0, agi: 0, vit: 0, int: 0, dex: 0, maxHp: 0, maxSp: 0 };
  for (const id of Object.values(b.equip)) {
    const bonus = (I.ITEMS[id] && I.ITEMS[id].bonus) || {};
    for (const k in bonus) sum[k] = (sum[k] || 0) + bonus[k];
  }
  return sum;
}
// รายการของที่ต้องวาดบนตัวละคร (ตามลำดับชั้นภาพ) → ส่งให้ทุกคนเห็น
const DRAW_ORDER = ["shoes", "armor", "gloves", "cape", "face", "head", "weapon", "offhand"];
// รูปแบบ "ช่อง:ไอเทม" เช่น "armor:chain,head:nasal,weapon:sword"
const gearString = (b) => DRAW_ORDER.filter((s) => b.equip[s] && I.ITEMS[b.equip[s]].visual).map((s) => `${s}:${b.equip[s]}`).join(",");

// สวมของจากช่องกระเป๋า idx (ของที่ใส่อยู่เดิมสลับกลับเข้ากระเป๋าช่องเดิม)
function equipFrom(b, idx, level, want) {
  const s = b.inv[idx];
  const it = s && I.ITEMS[s.id];
  if (!it || it.type !== "equip") return "ใส่ไอเทมนี้ไม่ได้";
  if (level < (it.lv || 1)) return `ต้องเลเวล ${it.lv} ขึ้นไป`;
  let slot = it.slot;
  if (slot === "acc") slot = want === "acc1" || want === "acc2" ? want : !b.equip.acc1 ? "acc1" : !b.equip.acc2 ? "acc2" : "acc1";
  const old = b.equip[slot];
  b.equip[slot] = s.id;
  b.inv[idx] = old ? { id: old, n: 1 } : null;
  return null;
}
function unequip(b, slot) {
  const id = b.equip[slot];
  if (!id) return null;
  const free = b.inv.findIndex((x) => !x);
  if (free < 0) return "กระเป๋าเต็ม";
  b.inv[free] = { id, n: 1 };
  delete b.equip[slot];
  return null;
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

module.exports = { emptyBag, loadBag, saveBag, addItem, canFit, removeAt, countOf, indexOf, gearBonus, gearString,
  equipFrom, unequip, moveSlot, maxStack, STARTER };

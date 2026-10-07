// =============================================================
//  อุปกรณ์เลเวลสูง Lv.40–90 (สร้างอัตโนมัติจากตารางนี้)
//  แต่ละขั้น = ธีมสี + ชื่อ · ทุกขั้นมี อาวุธ 8 แบบ · มือรอง 5 แบบ · เกราะหนัก/เบา/ผ้า (ชุดละ 4 ชิ้น) · เครื่องประดับ 3 แบบ
//  ภาพ: tools/gear/build_tiers.py (ย้อมสีจากภาพต้นแบบ base + เส้นเรืองแสง) → public/assets/equip/<id>*.png
//  ค่าพลัง = ค่าของต้นแบบ Lv.30 × (lv/30)^0.92 · ดรอปจากมอนโซนเลเวลใกล้กัน (ดู tierDrops)
// =============================================================
const TIERS = [
  { lv: 40, key: "glacial", name: "ธารน้ำแข็ง", color: "#8fe3ff", glow: 1 },
  { lv: 50, key: "ancient", name: "ราชันโบราณ", color: "#7dffc8", glow: 1 },
  { lv: 60, key: "nightshade", name: "ราตรีต้องสาป", color: "#c38bff", glow: 1 },
  { lv: 70, key: "infernal", name: "เพลิงนรก", color: "#ff8a3a", glow: 2, aura: "#ff8a3a" },
  { lv: 80, key: "dragon", name: "เกล็ดมังกร", color: "#ffd36b", glow: 2, aura: "#ffd36b" },
  { lv: 90, key: "abyss", name: "อเวจี", color: "#ff5ad8", glow: 2, aura: "#c86bff" },
];
// ชิ้นอุปกรณ์: name = คำนำหน้าชื่อ · base = ภาพต้นแบบ (สลับตามขั้นคู่/คี่) · ค่าพลังที่ Lv.30
const PIECES = {
  sword:     { name: "ดาบ", slot: "weapon", wt: "sword", base: ["shp_rapier", "shp_arming", "saber", "shp_glowred", "shp_rapier", "moonblade"], b: { atk: 78, vit: 3, def: 4 }, sp: { lifesteal: 3 }, fx: { 7: { sp: { lifesteal: 2 } }, 9: { sp: { atkPct: 5 } } } },
  greatsword:{ name: "ดาบใหญ่", slot: "weapon", wt: "greatsword", base: ["greatsword", "shp_halberd", "greatsword", "shp_halberd", "greatsword", "shp_halberd"], b: { atk: 92, str: 4 }, sp: { critDmg: 15 }, fx: { 7: { sp: { critPct: 3 } }, 9: { sp: { critDmg: 15 } } } },
  axe:       { name: "ขวานศึก", slot: "weapon", wt: "axe", base: ["battleaxe", "shp_scythe", "titanaxe", "shp_scythe", "battleaxe", "shp_scythe"], b: { atk: 98, str: 4 }, sp: { atkPct: 5 }, fx: { 7: { sp: { atkPct: 4 } }, 9: { sp: { ignoreDef: 10 } } } },
  mace:      { name: "ค้อน", slot: "weapon", wt: "mace", base: ["shp_flail", "warhammer", "shp_flail", "judgehammer", "shp_flail", "judgehammer"], b: { atk: 72, str: 3, int: 3 }, sp: { undeadDmg: 15 }, fx: { 7: { sp: { ignoreDef: 8 } }, 9: { sp: { undeadDmg: 15 } } } },
  bow:       { name: "ธนู", slot: "weapon", wt: "bow", base: ["bow_hunter", "shp_greatbow", "bow_shadow", "shp_greatbow", "bow_shadow", "shp_greatbow"], b: { atk: 74, dex: 5, agi: 2 }, sp: { aspd: 6 }, fx: { 7: { sp: { aspd: 5 } }, 9: { sp: { critPct: 5 } } } },
  dagger:    { name: "กริช", slot: "weapon", wt: "dagger", base: ["assassin_dagger", "shadow_kris"], b: { atk: 66, agi: 5, dex: 3 }, sp: { critPct: 5 }, fx: { 7: { sp: { critDmg: 10 } }, 9: { sp: { lifesteal: 3 } } } },
  staff:     { name: "คทา", slot: "weapon", wt: "staff", base: ["shp_staff_gnarled", "shp_staff_diamond", "staff_crystal", "shp_staff_loop", "shp_staff_s", "shp_staff_diamond"], b: { atk: 70, int: 6, maxSp: 50 }, sp: { cdr: 5 }, fx: { 7: { sp: { cdr: 4 } }, 9: { sp: { atkPct: 6, spRegen: 20 } } } },
  book:      { name: "คัมภีร์", slot: "weapon", wt: "book", base: ["book_light", "book_holy"], b: { atk: 56, int: 5, vit: 2, maxSp: 60 }, sp: { healPct: 10 }, fx: { 7: { sp: { healPct: 8 } }, 9: { sp: { cdr: 5, undeadDmg: 20 } } } },
  shield:    { name: "โล่", slot: "offhand", wt: "shield", base: ["shp_shield_kite", "shield_knight", "shp_shield_engrailed", "shield_spartan", "shp_shield_kite", "shp_shield_engrailed"], b: { def: 19, vit: 3, maxHp: 80 }, sp: { dmgReduce: 4 }, fx: { 7: { sp: { dmgReduce: 3 } }, 9: { b: { maxHp: 150 } } } },
  emblem:    { name: "ตราศึก", slot: "offhand", ot: "emblem", base: ["war_emblem", "war_horn"], b: { str: 5, atk: 15 }, sp: { atkPct: 4, critDmg: 10 } },
  quiver:    { name: "กระบอกธนู", slot: "offhand", ot: "quiver", base: ["quiver_leather", "quiver_wind"], b: { dex: 5, agi: 2, atk: 14 }, sp: { aspd: 5, critPct: 2 } },
  orb:       { name: "ลูกแก้ว", slot: "offhand", ot: "orb", base: ["orb_mana", "orb_star"], b: { int: 5, maxSp: 60, atk: 12 }, sp: { cdr: 4 } },
  relic:     { name: "เครื่องราง", slot: "offhand", ot: "relic", base: ["relic_light", "relic_holy"], b: { int: 4, vit: 3, maxHp: 80 }, sp: { healPct: 8, dmgReduce: 2 } },
  helm:      { name: "หมวกเกราะ", slot: "head", ac: "heavy", set: "heavy", base: ["shp_helm_bascinet", "shp_helm_armet", "shp_helm_sugarloaf", "shp_helm_horned", "shp_helm_maximus", "shp_helm_xeon"], b: { def: 16, vit: 2, maxHp: 70 } },
  plate:     { name: "เกราะ", slot: "armor", ac: "heavy", set: "heavy", base: ["shp_plate_pauldron", "shp_legion_cuirass", "shp_plate_bauldron", "shp_plate_mantal", "shp_legion_epaulet", "shp_plate_full"], b: { def: 38, vit: 3 }, sp: { dmgReduce: 3 } },
  gaunt:     { name: "ถุงมือเกราะ", slot: "gloves", ac: "heavy", set: "heavy", base: ["gauntlets", "goldgaunt"], b: { def: 10, str: 3 } },
  greaves:   { name: "รองเท้าเกราะ", slot: "shoes", ac: "heavy", set: "heavy", base: ["plateboots", "goldboots"], b: { def: 11, agi: 2 } },
  hood:      { name: "ฮู้ด", slot: "head", ac: "light", set: "light", base: ["shp_hat_cavalier", "ranger_cap", "shp_hat_tricorne", "shadow_hood", "shp_hat_bicorne", "shp_hood_sack"], b: { def: 10, dex: 3, agi: 1 } },
  vest:      { name: "เสื้อเกราะหนัง", slot: "armor", ac: "light", set: "light", base: ["shp_leather_epaulet", "ranger_vest", "shp_leather_mantal", "shadow_vest", "shp_chain_pauldron", "shadow_vest"], b: { def: 28, agi: 3, dex: 2 }, sp: { flee: 3 } },
  lgloves:   { name: "ถุงมือ", slot: "gloves", ac: "light", set: "light", base: ["ranger_gloves", "shadow_gloves"], b: { def: 7, dex: 3 } },
  lboots:    { name: "รองเท้า", slot: "shoes", ac: "light", set: "light", base: ["ranger_boots", "shadow_boots"], b: { def: 8, agi: 3 } },
  hat:       { name: "หมวก", slot: "head", ac: "cloth", set: "cloth", base: ["shp_hat_celestial", "mage_hat", "shp_hat_moon", "arch_hat", "shp_hat_large", "shp_hat_crown"], b: { def: 7, int: 4, maxSp: 40 } },
  robe:      { name: "ชุดคลุม", slot: "armor", ac: "cloth", set: "cloth", base: ["priest_robe", "arch_robe"], b: { def: 21, int: 5, vit: 2, maxSp: 60 }, sp: { spPct: 6 } },
  cgloves:   { name: "ถุงมือเวท", slot: "gloves", ac: "cloth", set: "cloth", base: ["mage_gloves", "saint_gloves"], b: { def: 5, int: 3, maxSp: 20 } },
  shoes:     { name: "รองเท้าเวท", slot: "shoes", ac: "cloth", set: "cloth", base: ["mage_shoes", "arch_shoes"], b: { def: 5, dex: 3, maxHp: 30 } },
  ring:      { name: "แหวน", slot: "ring", base: ["ring_ruby", "ring_dragon"], b: { str: 6, dex: 3, atk: 18 }, sp: { critDmg: 12 } },
  amulet:    { name: "จี้", slot: "neck", base: ["amulet_sage", "amulet_frost"], b: { int: 7, maxSp: 80 }, sp: { cdr: 4 } },
  talisman:  { name: "ต่างหู", slot: "ear", base: ["earring_ruby", "earring_star"], b: { vit: 6, def: 10, maxHp: 150 }, sp: { dmgReduce: 4 } },
};
// โบนัสเซ็ต (ค่าที่ขั้น Lv.40 · ขั้นสูงขึ้นคูณตามสัดส่วนเลเวล)
const SET_KINDS = {
  heavy: { name: "ชุดเกราะ", job: "ผู้พิทักษ์ / นักดาบใหญ่", pieces: [["helm"], ["plate"], ["gaunt"], ["greaves"], ["sword", "greatsword", "axe", "mace"], ["shield", "emblem"]],
    tiers: { 2: { b: { def: 10, maxHp: 140 } }, 4: { b: { str: 4, vit: 4 }, sp: { dmgReduce: 4, hpRegen: 20 } }, 5: { b: { atk: 40 }, sp: { atkPct: 8, critDmg: 15 } }, 6: { b: { maxHp: 200 }, sp: { dmgReduce: 3, critDmg: 15 } } } },
  light: { name: "ชุดพราน", job: "นักล่า", pieces: [["hood"], ["vest"], ["lgloves"], ["lboots"], ["bow", "dagger"], ["quiver"]],
    tiers: { 2: { b: { dex: 4, agi: 3 } }, 4: { sp: { flee: 4, critPct: 4 } }, 5: { b: { atk: 36 }, sp: { aspd: 8, critDmg: 15 } }, 6: { sp: { critDmg: 12, moveSpd: 4 } } } },
  cloth: { name: "ชุดคลุม", job: "นักเวทย์ / หมอ", pieces: [["hat"], ["robe"], ["cgloves"], ["shoes"], ["staff", "book"], ["orb", "relic"]],
    tiers: { 2: { b: { int: 4, maxSp: 60 } }, 4: { sp: { spRegen: 20, cdr: 4, healPct: 6 } }, 5: { b: { atk: 34 }, sp: { atkPct: 8, healPct: 8 } }, 6: { sp: { cdr: 3, healPct: 5, dmgReduce: 2 } } } },
};
// ภาพต้นแบบทรงใหม่ (tools/gear/shapes.py) — ไม่ใช่ไอเทม จึงเก็บแฟล็กไว้ที่นี่
const SHAPES = {"shp_rapier": {"visual": true, "back": true}, "shp_glowred": {"visual": true, "back": true}, "shp_arming": {"visual": true, "back": true}, "shp_halberd": {"visual": true, "back": true}, "shp_scythe": {"visual": true, "back": true}, "shp_flail": {"visual": true, "back": true}, "shp_greatbow": {"visual": true, "back": true}, "shp_staff_gnarled": {"visual": true, "back": true}, "shp_staff_diamond": {"visual": true, "back": true}, "shp_staff_loop": {"visual": true, "back": true}, "shp_staff_s": {"visual": true, "back": true}, "shp_shield_kite": {"visual": true, "sexed": true}, "shp_shield_engrailed": {"visual": true, "sexed": true, "back": true}, "shp_helm_bascinet": {"visual": true}, "shp_helm_armet": {"visual": true}, "shp_helm_sugarloaf": {"visual": true, "sexed": true}, "shp_helm_horned": {"visual": true}, "shp_helm_maximus": {"visual": true}, "shp_helm_xeon": {"visual": true}, "shp_hat_cavalier": {"visual": true}, "shp_hat_tricorne": {"visual": true}, "shp_hat_bicorne": {"visual": true}, "shp_hood_sack": {"visual": true}, "shp_hat_celestial": {"visual": true}, "shp_hat_moon": {"visual": true}, "shp_hat_large": {"visual": true}, "shp_hat_crown": {"visual": true}, "shp_plate_pauldron": {"visual": true, "sexed": true}, "shp_legion_cuirass": {"visual": true, "sexed": true}, "shp_plate_bauldron": {"visual": true, "sexed": true}, "shp_plate_mantal": {"visual": true, "sexed": true}, "shp_legion_epaulet": {"visual": true, "sexed": true}, "shp_plate_full": {"visual": true, "sexed": true}, "shp_leather_epaulet": {"visual": true, "sexed": true}, "shp_leather_mantal": {"visual": true, "sexed": true}, "shp_chain_pauldron": {"visual": true, "sexed": true}};
// ชื่อเรียกตามทรง (แทนคำนำหน้าชื่อของชิ้น)
const SHAPE_NAME = { shp_rapier: "เรเปียร์", shp_arming: "ดาบอัศวิน", shp_glowred: "ดาบเพลิงเรือง", shp_halberd: "ง้าว", shp_scythe: "เคียว",
  shp_flail: "ลูกตุ้มเหล็ก", shp_greatbow: "ธนูยาว", shp_staff_gnarled: "คทาไม้บิด", shp_staff_diamond: "คทาเพชร", shp_staff_loop: "คทาวงแหวน",
  shp_staff_s: "คทางู", shp_shield_kite: "โล่ว่าว", shp_shield_engrailed: "โล่ตราประจำตระกูล", shp_helm_horned: "หมวกเขาสัตว์", shp_helm_maximus: "หมวกปีกนกอินทรี",
  shp_helm_xeon: "หมวกเขาปีศาจ", shp_helm_sugarloaf: "หมวกเกราะทรงกรวย", shp_legion_cuirass: "เกราะทหารโรมัน", shp_legion_epaulet: "เกราะขุนพล", shp_plate_full: "เกราะเต็มตัว",
  shp_hat_cavalier: "หมวกขนนก", shp_hat_tricorne: "หมวกสามมุม", shp_hat_bicorne: "หมวกสองมุม", shp_hood_sack: "ผ้าคลุมหัว", shp_hat_celestial: "หมวกดวงดาว",
  shp_hat_moon: "หมวกจันทรา", shp_hat_large: "หมวกปีกกว้าง", shp_hat_crown: "มงกุฎ" };
const PRICE_AT = (lv, slot) => Math.round((slot === "weapon" ? 900 : slot === "armor" ? 700 : 450) * lv * (lv / 30));

const scale = (v, lv, k = 0.92) => Math.max(1, Math.round(v * Math.pow(lv / 30, k)));
const scaleObj = (o, lv, k) => Object.fromEntries(Object.entries(o).map(([s, v]) => [s, scale(v, lv, k)]));
const spScale = (o, lv) => Object.fromEntries(Object.entries(o).map(([s, v]) => [s, Math.max(1, Math.round(v * (1 + (lv - 30) / 60)))]));

const tid = (t, piece) => `t${t.lv}_${piece}`;
function build(ITEMS) {
  const items = {}, sets = {};
  TIERS.forEach((t, ti) => {
    for (const [pk, P] of Object.entries(PIECES)) {
      const base = P.base.length === TIERS.length ? P.base[ti] : P.base[ti % 2], B = ITEMS[base] || SHAPES[base] || {};
      const it = { name: `${SHAPE_NAME[base] || P.name}${t.name}`, type: "equip", slot: P.slot, lv: t.lv, tier: t.key, glowColor: t.color,
        bonus: scaleObj(P.b, t.lv), price: PRICE_AT(t.lv, P.slot), base };
      if (P.wt) it.wt = P.wt;
      if (P.ot) it.ot = P.ot;
      if (P.ac) { it.ac = P.ac; it.set = `${t.key}_${P.set}`; }
      if (P.sp) it.special = spScale(P.sp, t.lv);
      if (P.fx) it.refineFx = Object.fromEntries(Object.entries(P.fx).map(([lvl, fx]) => [lvl, { ...(fx.sp ? { sp: spScale(fx.sp, t.lv) } : {}), ...(fx.b ? { b: scaleObj(fx.b, t.lv) } : {}) }]));
      if (B.visual) it.visual = true;
      if (B.sexed) it.sexed = true;
      if (B.back) it.back = true;
      if (t.aura && P.slot === "weapon") it.aura = t.aura;
      if (P.slot === "weapon" && t.lv >= 70) it.desc = `อาวุธระดับ${t.name} — มีออร่าเรืองแสงรอบตัวตอนถือ`;
      items[tid(t, pk)] = it;
    }
    // เซ็ตของขั้นนี้
    const f = t.lv / 40;
    for (const [sk, S] of Object.entries(SET_KINDS)) {
      sets[`${t.key}_${sk}`] = {
        name: `${S.name}${t.name}`, job: S.job,
        pieces: S.pieces.map((grp) => grp.map((pk) => tid(t, pk))),
        tiers: Object.fromEntries(Object.entries(S.tiers).map(([n, v]) => [n, {
          ...(v.b ? { b: Object.fromEntries(Object.entries(v.b).map(([k, x]) => [k, Math.round(x * f)])) } : {}),
          ...(v.sp ? { sp: Object.fromEntries(Object.entries(v.sp).map(([k, x]) => [k, Math.round(x * (1 + (t.lv - 40) / 100))])) } : {}),
        }])),
      };
    }
  });
  // ชิ้นอาวุธ/มือรองเป็นส่วนหนึ่งของเซ็ต (ใช้ setsOf ที่ค้นจาก pieces) — ไม่ต้องตั้ง it.set
  return { items, sets };
}
// มอนเลเวล lv ดรอปอุปกรณ์ขั้นไหน
const tierOf = (lv) => Math.min(90, Math.max(40, Math.floor((lv + 4) / 10) * 10));
function tierDrops(mobLv, chance = 0.0012) {
  const t = TIERS.find((x) => x.lv === tierOf(mobLv));
  return Object.keys(PIECES).map((pk) => [tid(t, pk), chance, 1, 1]);
}
module.exports = { TIERS, PIECES, SET_KINDS, build, tierDrops, tierOf };

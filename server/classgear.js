// =============================================================
//  อุปกรณ์ประจำอาชีพขั้น 2 (แทนอุปกรณ์รวม Lv.50–90 เดิม)
//  10 อาชีพ × 3 ขั้น (Lv.50 / 70 / 90) × 7 ชิ้น (หัว เกราะ ถุงมือ รองเท้า ผ้าคลุม อาวุธ มือรอง)
//  ใส่ได้เฉพาะอาชีพนั้น (it.cls) · ได้จากมินิบอส Lv.45+ และ World Boss (ดู pickClassItem)
//  ภาพ: tools/gear/build_class.py (ย้อมสีภาพต้นแบบตามธีมอาชีพ + เส้นเรืองแสง) → public/assets/equip/<id>*.png
// =============================================================
const { PIECES } = require("./tiers");

const CLASS_TIERS = [50, 70, 90];
// ชิ้นของแต่ละเกราะ (ใช้ค่าพลังต้นแบบจาก tiers.js)
const ARMOR = {
  heavy: { head: "helm", armor: "plate", gloves: "gaunt", shoes: "greaves" },
  light: { head: "hood", armor: "vest", gloves: "lgloves", shoes: "lboots" },
  cloth: { head: "hat", armor: "robe", gloves: "cgloves", shoes: "shoes" },
};
const PIECE_NAME = { head: "หมวก", armor: "เกราะ", gloves: "ถุงมือ", shoes: "รองเท้า", cape: "ผ้าคลุม", weapon: "อาวุธ", offhand: "มือรอง" };
const CLOTH_NAME = { head: "หมวก", armor: "ชุดคลุม", gloves: "ถุงมือ", shoes: "รองเท้า" };
const LIGHT_NAME = { head: "ฮู้ด", armor: "เสื้อเกราะ", gloves: "ถุงมือ", shoes: "รองเท้า" };
const WEAPON_NAME = { sword: "ดาบ", greatsword: "มหาดาบ", axe: "ขวานศึก", mace: "ค้อน", bow: "ธนู", dagger: "กริช", staff: "คทา", book: "คัมภีร์" };
const OFF_NAME = { shield: "โล่", emblem: "ตราศึก", quiver: "กระบอกธนู", orb: "ลูกแก้ว", relic: "เครื่องราง" };
// ผ้าคลุม: ค่าพลังที่ Lv.30 (ใช้สูตรเดียวกับชิ้นอื่น)
const CAPE = { b: { def: 8, maxHp: 60 } };

// ธีมสี (hex): main = เงา→สว่าง 5 จุด · accent = ส่วนตกแต่ง 3 จุด · glow = สีเรืองแสง
// tiers = ชื่อขั้น 50/70/90 · base = ภาพต้นแบบต่อชิ้นต่อขั้น · stat = ค่าพิเศษประจำอาชีพที่ใส่ในผ้าคลุม
const CLASSES = {
  paladin: {
    armor: "heavy", wt: "sword", off: "shield", tiers: ["รุ่งอรุณ", "สุริยเทพ", "เทวสวรรค์"],
    main: ["#1c1a14", "#6b5a2a", "#c9a85a", "#f4e3a8", "#ffffff"], accent: ["#10306a", "#3a8aff", "#c8e4ff"], glow: "#ffe9a0",
    base: { head: ["greathelm", "shp_helm_armet", "shp_helm_maximus"], armor: ["plate", "shp_plate_full", "shp_legion_epaulet"], gloves: ["gauntlets", "goldgaunt", "goldgaunt"],
      shoes: ["plateboots", "goldboots", "goldboots"], cape: ["cape_white", "cape_royal", "cape_royal"], weapon: ["shp_arming", "saber", "moonblade"], offhand: ["shield_knight", "shp_shield_kite", "shp_shield_engrailed"] },
    stat: { vit: 3, def: 4 },
    set: { 2: { b: { def: 10, maxHp: 150 } }, 4: { sp: { dmgReduce: 4, hpRegen: 20 } }, 6: { sp: { undeadDmg: 20, hpPct: 5 } }, 7: { b: { vit: 5 }, sp: { dmgReduce: 4, healPct: 10 } } },
  },
  darkknight: {
    armor: "heavy", wt: "sword", off: "shield", tiers: ["ทมิฬ", "โลหิตราตรี", "ราชันมาร"],
    main: ["#0a0610", "#2a1640", "#5a3a8a", "#a888d8", "#efe4ff"], accent: ["#5a0010", "#e0203a", "#ffb0b8"], glow: "#a05aff",
    base: { head: ["shp_helm_xeon", "shp_helm_horned", "shp_helm_xeon"], armor: ["shp_plate_mantal", "shp_plate_bauldron", "shp_plate_full"], gloves: ["gauntlets", "goldgaunt", "goldgaunt"],
      shoes: ["plateboots", "goldboots", "goldboots"], cape: ["cape_shadow", "cape_red", "cape_shadow"], weapon: ["shp_rapier", "shp_glowred", "shp_glowred"], offhand: ["shield_spartan", "shp_shield_engrailed", "shp_shield_kite"] },
    stat: { str: 3, maxHp: 40 },
    set: { 2: { b: { atk: 20, maxHp: 100 } }, 4: { sp: { lifesteal: 3, hpPct: 4 } }, 6: { sp: { atkPct: 6, ignoreDef: 8 } }, 7: { b: { str: 5 }, sp: { lifesteal: 3, dmgReduce: 3 } } },
  },
  berserker: {
    armor: "heavy", wt: "axe", off: "emblem", tiers: ["คลั่งเลือด", "ปีศาจศึก", "เทพสงคราม"],
    main: ["#140404", "#4a1010", "#9a2a1a", "#e07050", "#ffe0c8"], accent: ["#3a2a10", "#d0a040", "#fff0b0"], glow: "#ff4a3a",
    base: { head: ["shp_helm_horned", "shp_helm_sugarloaf", "shp_helm_horned"], armor: ["shp_legion_epaulet", "shp_plate_pauldron", "shp_legion_epaulet"], gloves: ["gauntlets", "goldgaunt", "goldgaunt"],
      shoes: ["plateboots", "goldboots", "goldboots"], cape: ["cape_red", "cape_red", "cape_royal"], weapon: ["battleaxe", "shp_scythe", "titanaxe"], offhand: ["war_horn", "war_emblem", "war_horn"] },
    stat: { str: 3, agi: 2 },
    set: { 2: { b: { atk: 25, str: 3 } }, 4: { sp: { aspd: 6, critDmg: 12 } }, 6: { sp: { atkPct: 8, lifesteal: 2 } }, 7: { sp: { critDmg: 20, atkPct: 5 } } },
  },
  blademaster: {
    armor: "heavy", wt: "greatsword", off: "emblem", tiers: ["คมวายุ", "จันทร์เสี้ยว", "ดาบเทพ"],
    main: ["#0a141c", "#224a64", "#5a9ac0", "#bfe8ff", "#ffffff"], accent: ["#202a40", "#c0c8e0", "#ffffff"], glow: "#9fe3ff",
    base: { head: ["shp_helm_bascinet", "shp_helm_maximus", "shp_helm_armet"], armor: ["shp_legion_cuirass", "shp_plate_bauldron", "shp_plate_pauldron"], gloves: ["gauntlets", "goldgaunt", "goldgaunt"],
      shoes: ["plateboots", "goldboots", "goldboots"], cape: ["cape_blue", "cape_white", "cape_blue"], weapon: ["greatsword", "shp_halberd", "greatsword"], offhand: ["war_emblem", "war_horn", "war_emblem"] },
    stat: { dex: 3, str: 2 },
    set: { 2: { b: { atk: 22, dex: 3 } }, 4: { sp: { critPct: 4, critDmg: 10 } }, 6: { sp: { ignoreDef: 10, critPct: 3 } }, 7: { sp: { critDmg: 25, aspd: 5 } } },
  },
  sniper: {
    armor: "light", wt: "bow", off: "quiver", tiers: ["เหยี่ยวเขียว", "พายุลม", "เนตรสวรรค์"],
    main: ["#04140e", "#14463a", "#2e9a7a", "#90f0c8", "#f0fff8"], accent: ["#3a2a10", "#e0b050", "#fff4c0"], glow: "#7dffd0",
    base: { head: ["shp_hat_cavalier", "ranger_cap", "shp_hat_tricorne"], armor: ["shp_leather_epaulet", "ranger_vest", "shp_leather_mantal"], gloves: ["ranger_gloves", "ranger_gloves", "shadow_gloves"],
      shoes: ["ranger_boots", "ranger_boots", "shadow_boots"], cape: ["cape_green", "cape_green", "cape_royal"], weapon: ["bow_hunter", "shp_greatbow", "shp_greatbow"], offhand: ["quiver_leather", "quiver_wind", "quiver_wind"] },
    stat: { dex: 3, agi: 2 },
    set: { 2: { b: { dex: 4, atk: 18 } }, 4: { sp: { aspd: 6, critPct: 3 } }, 6: { sp: { ignoreDef: 10, atkPct: 6 } }, 7: { sp: { critDmg: 18, moveSpd: 4 } } },
  },
  assassin: {
    armor: "light", wt: "dagger", off: "quiver", tiers: ["เงามืด", "พิษราตรี", "ไร้เงา"],
    main: ["#06040c", "#1e1430", "#4a3070", "#9a78d0", "#e8dcff"], accent: ["#0a3a10", "#50e070", "#d0ffd8"], glow: "#b06aff",
    base: { head: ["shadow_hood", "shp_hood_sack", "shadow_hood"], armor: ["shadow_vest", "shp_chain_pauldron", "shadow_vest"], gloves: ["shadow_gloves", "shadow_gloves", "shadow_gloves"],
      shoes: ["shadow_boots", "shadow_boots", "shadow_boots"], cape: ["cape_shadow", "cape_shadow", "cape_shadow"], weapon: ["assassin_dagger", "shadow_kris", "shadow_kris"], offhand: ["quiver_wind", "quiver_leather", "quiver_wind"] },
    stat: { agi: 3, dex: 2 },
    set: { 2: { b: { agi: 4, atk: 18 } }, 4: { sp: { flee: 5, critPct: 4 } }, 6: { sp: { critDmg: 18, lifesteal: 2 } }, 7: { sp: { atkPct: 8, moveSpd: 5 } } },
  },
  archmage: {
    armor: "cloth", wt: "staff", off: "orb", tiers: ["ดาราจักร", "อสนี", "มหาเวท"],
    main: ["#060a1c", "#18286a", "#3a5ac8", "#98b8ff", "#f0f4ff"], accent: ["#3a2a00", "#ffd040", "#fff8c0"], glow: "#6f9bff",
    base: { head: ["shp_hat_celestial", "arch_hat", "shp_hat_large"], armor: ["arch_robe", "mage_robe", "arch_robe"], gloves: ["arch_gloves", "mage_gloves", "arch_gloves"],
      shoes: ["arch_shoes", "mage_shoes", "arch_shoes"], cape: ["cape_blue", "cape_royal", "cape_blue"], weapon: ["shp_staff_diamond", "staff_crystal", "shp_staff_loop"], offhand: ["orb_mana", "orb_star", "orb_star"] },
    stat: { int: 3, maxSp: 40 },
    set: { 2: { b: { int: 5, maxSp: 80 } }, 4: { sp: { cdr: 5, spRegen: 20 } }, 6: { sp: { atkPct: 8, spPct: 6 } }, 7: { sp: { cdr: 5, atkPct: 6 } } },
  },
  summoner: {
    armor: "cloth", wt: "staff", off: "orb", tiers: ["ภูตไฟ", "ม่านวิญญาณ", "จ้าวภูต"],
    main: ["#140610", "#4a1436", "#a03a78", "#f098c8", "#fff0f8"], accent: ["#401000", "#ff8a30", "#ffe0a0"], glow: "#ff7ab0",
    base: { head: ["shp_hat_moon", "shp_hat_large", "shp_hat_moon"], armor: ["mage_robe", "arch_robe", "mage_robe"], gloves: ["mage_gloves", "arch_gloves", "mage_gloves"],
      shoes: ["mage_shoes", "arch_shoes", "mage_shoes"], cape: ["cape_red", "cape_royal", "cape_red"], weapon: ["shp_staff_gnarled", "shp_staff_s", "shp_staff_s"], offhand: ["orb_star", "orb_mana", "orb_star"] },
    stat: { int: 3, maxHp: 40 },
    set: { 2: { b: { int: 4, maxHp: 100 } }, 4: { sp: { cdr: 4, lifesteal: 2 } }, 6: { sp: { atkPct: 8, hpPct: 4 } }, 7: { sp: { cdr: 5, spRegen: 25 } } },
  },
  saint: {
    armor: "cloth", wt: "book", off: "relic", tiers: ["แสงศรัทธา", "เทวทูต", "นักบุญสวรรค์"],
    main: ["#1a1810", "#6a6040", "#c8c098", "#fffbe0", "#ffffff"], accent: ["#4a3000", "#ffcc40", "#fff6c0"], glow: "#fff7c0",
    base: { head: ["saint_crown", "shp_hat_crown", "shp_hat_crown"], armor: ["saint_robe", "priest_robe", "saint_robe"], gloves: ["saint_gloves", "priest_gloves", "saint_gloves"],
      shoes: ["saint_shoes", "priest_shoes", "saint_shoes"], cape: ["cape_white", "cape_white", "cape_royal"], weapon: ["book_light", "book_holy", "book_holy"], offhand: ["relic_light", "relic_holy", "relic_holy"] },
    stat: { int: 2, vit: 2, maxSp: 30 },
    set: { 2: { b: { int: 4, maxSp: 80 } }, 4: { sp: { healPct: 10, spRegen: 20 } }, 6: { sp: { healPct: 10, cdr: 4 } }, 7: { sp: { dmgReduce: 4, healPct: 12 } } },
  },
  battlepriest: {
    armor: "cloth", wt: "mace", off: "relic", tiers: ["ศึกศรัทธา", "ค้อนสวรรค์", "เทพพิทักษ์"],
    main: ["#160c02", "#5a3410", "#b8762a", "#f8c878", "#fff4dc"], accent: ["#2a0a00", "#ff5a20", "#ffd0a0"], glow: "#ffb84a",
    base: { head: ["priest_hood", "nasal", "shp_helm_maximus"], armor: ["priest_robe", "saint_robe", "priest_robe"], gloves: ["priest_gloves", "saint_gloves", "priest_gloves"],
      shoes: ["priest_shoes", "saint_shoes", "priest_shoes"], cape: ["cape_knight", "cape_red", "cape_knight"], weapon: ["warhammer", "judgehammer", "shp_flail"], offhand: ["relic_holy", "relic_light", "relic_holy"] },
    stat: { str: 2, vit: 3 },
    set: { 2: { b: { str: 3, vit: 3 } }, 4: { sp: { undeadDmg: 15, hpRegen: 20 } }, 6: { sp: { atkPct: 6, healPct: 8 } }, 7: { b: { atk: 20 }, sp: { dmgReduce: 4, aspd: 4 } } },
  },
};
const SLOTS = ["head", "armor", "gloves", "shoes", "cape", "weapon", "offhand"];
const PRICE_AT = (lv, slot) => Math.round((slot === "weapon" ? 900 : slot === "armor" ? 700 : 450) * lv * (lv / 30));
const CLASS_MUL = 1.06; // ของประจำอาชีพแรงกว่าของรวมเดิมนิดหน่อย
const scale = (v, lv, k = 0.92) => Math.max(1, Math.round(v * Math.pow(lv / 30, k) * CLASS_MUL));
const scaleObj = (o, lv) => Object.fromEntries(Object.entries(o).map(([s, v]) => [s, scale(v, lv)]));
const spScale = (o, lv) => Object.fromEntries(Object.entries(o).map(([s, v]) => [s, Math.max(1, Math.round(v * (1 + (lv - 30) / 60)))]));
const cid = (lv, job, slot) => `c${lv}_${job}_${slot}`;

// SHAPE_FLAGS = ธงภาพของภาพต้นแบบ (visual/sexed/back) จาก items.js + tiers.js
function build(ITEMS, SHAPE_FLAGS, JOBS) {
  const items = {}, sets = {};
  for (const [job, C] of Object.entries(CLASSES)) {
    const jname = JOBS[job].name;
    CLASS_TIERS.forEach((lv, ti) => {
      const tname = C.tiers[ti];
      for (const slot of SLOTS) {
        const base = C.base[slot][ti], B = ITEMS[base] || SHAPE_FLAGS[base] || {};
        let P, nm;
        if (slot === "weapon") { P = PIECES[C.wt]; nm = WEAPON_NAME[C.wt]; }
        else if (slot === "offhand") { P = PIECES[C.off]; nm = OFF_NAME[C.off]; }
        else if (slot === "cape") { P = { ...CAPE, b: { ...CAPE.b, ...C.stat } }; nm = "ผ้าคลุม"; }
        else { P = PIECES[ARMOR[C.armor][slot]]; nm = (C.armor === "cloth" ? CLOTH_NAME : C.armor === "light" ? LIGHT_NAME : PIECE_NAME)[slot]; }
        const it = { name: `${nm}${tname}`, type: "equip", slot: slot === "cape" ? "cape" : P.slot || slot, lv, cls: job, tier: `${job}${lv}`, glowColor: C.glow,
          bonus: scaleObj(P.b, lv), price: PRICE_AT(lv, slot), base, set: `cls_${job}${lv}`, desc: `อุปกรณ์ประจำ${jname} ขั้น ${ti + 1}` };
        if (slot === "weapon") it.wt = C.wt;
        if (slot === "offhand") { if (P.wt) it.wt = P.wt; if (P.ot) it.ot = P.ot; }
        if (slot !== "weapon" && slot !== "offhand" && slot !== "cape") it.ac = C.armor;
        if (P.sp) it.special = spScale(P.sp, lv);
        if (P.fx) it.refineFx = Object.fromEntries(Object.entries(P.fx).map(([k, fx]) => [k, { ...(fx.sp ? { sp: spScale(fx.sp, lv) } : {}), ...(fx.b ? { b: scaleObj(fx.b, lv) } : {}) }]));
        if (B.visual) it.visual = true;
        if (B.sexed) it.sexed = true;
        if (B.back) it.back = true;
        if (slot === "weapon") {
          if (["sword", "greatsword", "axe", "mace", "dagger"].includes(C.wt)) it.slashFx = C.glow;
          if (lv >= 70) { it.aura = C.glow; it.desc += " — มีออร่าเรืองแสงรอบตัวตอนถือ"; }
        }
        items[cid(lv, job, slot)] = it;
      }
      const f = lv / 50;
      sets[`cls_${job}${lv}`] = {
        name: `ชุด${tname} · ${jname}`, job: jname, pieces: SLOTS.map((s) => [cid(lv, job, s)]),
        tiers: Object.fromEntries(Object.entries(C.set).map(([n, v]) => [n, {
          ...(v.b ? { b: Object.fromEntries(Object.entries(v.b).map(([k, x]) => [k, Math.round(x * f)])) } : {}),
          ...(v.sp ? { sp: Object.fromEntries(Object.entries(v.sp).map(([k, x]) => [k, Math.round(x * (1 + (lv - 50) / 100))])) } : {}),
        }])),
      };
    });
  }
  return { items, sets };
}

// ขั้นอุปกรณ์ที่มอนเลเวลนี้ดรอป (มินิบอส/World Boss)
const classTierOf = (lv) => (lv >= 85 ? 90 : lv >= 65 ? 70 : 50);
// สุ่มชิ้นอุปกรณ์ประจำอาชีพ: prefer = อาชีพของคนที่ทำดาเมจสูงสุด (ขั้น 2) → ได้ของอาชีพตัวเอง 60%
function pickClassItem(lv, prefer) {
  const jobs = Object.keys(CLASSES);
  const job = prefer && CLASSES[prefer] && Math.random() < 0.6 ? prefer : jobs[Math.floor(Math.random() * jobs.length)];
  return cid(lv, job, SLOTS[Math.floor(Math.random() * SLOTS.length)]);
}
module.exports = { CLASSES, CLASS_TIERS, SLOTS, build, classTierOf, pickClassItem, cid };

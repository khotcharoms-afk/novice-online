// =============================================================
//  อาชีพขั้น 2 (Lv.50) — อาชีพขั้น 1 แต่ละอาชีพเลือกได้ 2 ทาง
//  base = อาชีพขั้น 1 ที่ต้องเป็นก่อน · ใส่อาวุธ/ชุดได้เหมือนอาชีพเดิม · ค่าพลังสูงขึ้น ~15–20% · สกิลใหม่ 4 สกิล (สกิลเดิมยังอยู่)
//  kind ของสกิล (กลไกใน WorldRoom.castSkill2):
//   hit = ตีเป้าเดียว (hits ครั้ง) · aoeTarget = วงรอบเป้า · aoeSelf = วงรอบตัว · chain = กระโดดหลายตัว
//   leap = กระโดดไปหาเป้าแล้วฟาดเป็นวง · dash = พุ่งผ่านเป้า · blink = วาร์ปสั้นไปทางเป้า
//   buff = บัฟตัวเอง · partyBuff = บัฟทุกคนรอบตัว · debuff = สาปมอนในวง · summon = เรียกตัวช่วยตีชั่วคราว
//   massHeal = ฮีลทุกคนรอบตัว · revive = ชุบชีวิตคนที่ตายใกล้ ๆ
// =============================================================
const JOB2_LEVEL = 50;

const JOBS2 = {
  paladin: { base: "guardian", name: "อัศวินศักดิ์สิทธิ์", en: "Paladin", color: "#ffe9a0", hp: 1.55, sp: 1.05, atk: 1.0, def: 1.4,
    role: "แทงก์ · ปกป้องทีม", desc: "อัศวินผู้ได้รับพรแห่งแสง ปกป้องเพื่อนด้วยออร่า ดึงมอนทั้งฝูงมาที่ตัว และอยู่รอดได้ในยามคับขัน" },
  darkknight: { base: "guardian", name: "อัศวินทมิฬ", en: "Dark Knight", color: "#a05aff", hp: 1.5, sp: 0.95, atk: 1.12, def: 1.3,
    role: "แทงก์สายบุก · ดูดเลือด", desc: "แลกเลือดตัวเองเป็นพลังทำลาย ดูดเลือดศัตรูกลับมา สะท้อนดาเมจ และสาปให้มอนรอบตัวอ่อนแรง" },
  berserker: { base: "slayer", name: "เบอร์เซิร์กเกอร์", en: "Berserker", color: "#ff4a3a", hp: 1.38, sp: 0.95, atk: 1.28, def: 1.1,
    role: "ยิ่งเลือดน้อยยิ่งแรง", desc: "นักรบคลั่งที่หมุนดาบใส่ศัตรูทั้งฝูง กระโดดเข้าหาเป้า และดูดเลือดจากการฟัน" },
  blademaster: { base: "slayer", name: "จอมดาบ", en: "Blademaster", color: "#9fe3ff", hp: 1.3, sp: 1.0, atk: 1.3, def: 1.05,
    role: "คริติคอล · ดาเมจเป้าเดียว", desc: "ฝึกดาบจนถึงขีดสุด ชักดาบฟันคริติคอลแน่นอน ฟันรัวพันใบ และพุ่งทะลุศัตรู" },
  sniper: { base: "hunter", name: "สไนเปอร์", en: "Sniper", color: "#7dffd0", hp: 1.12, sp: 1.1, atk: 1.2, def: 1.08,
    role: "ยิงไกล · เจาะเกราะ", desc: "มือธนูระยะไกลที่ยิงทะลุเกราะ วางกับดัก และมีเหยี่ยวคู่ใจช่วยโจมตี" },
  assassin: { base: "hunter", name: "นักฆ่าเงา", en: "Assassin", color: "#b06aff", hp: 1.15, sp: 1.05, atk: 1.22, def: 1.05,
    role: "ลอบโจมตี · พิษ (เหมาะกับมีดสั้น)", desc: "ซ่อนตัวในเงา แทงลอบแรงมาก อาบยาพิษให้ทุกการโจมตี และขว้างใบมีดรอบตัว" },
  archmage: { base: "mage", name: "จอมเวท", en: "Archmage", color: "#6f9bff", hp: 0.98, sp: 1.8, atk: 1.2, def: 1.0,
    role: "เวทหมู่ · คุมฝูงมอน", desc: "ผู้เชี่ยวชาญเวทธาตุ เรียกพายุหิมะ สายฟ้าฟาดเป็นลูกโซ่ ใช้มานาเป็นโล่ และวาร์ปหลบ" },
  summoner: { base: "mage", name: "นักอัญเชิญ", en: "Summoner", color: "#ff7ab0", hp: 1.0, sp: 1.75, atk: 1.15, def: 1.0,
    role: "อัญเชิญ · คำสาป", desc: "อัญเชิญภูตไฟมาช่วยรบ สาปศัตรูให้อ่อนแอ ดูดวิญญาณมาเป็นพลังชีวิต และเปิดหลุมดำดูดมอนเข้าหากัน" },
  saint: { base: "healer", name: "นักบุญ", en: "Saint", color: "#fff7c0", hp: 1.1, sp: 1.65, atk: 0.85, def: 1.12,
    role: "ฮีลทั้งทีม · ชุบชีวิต", desc: "ผู้ศักดิ์สิทธิ์ที่ฮีลทั้งปาร์ตี้พร้อมกัน ชุบชีวิตเพื่อนที่ล้ม และคุ้มครองจากพิษ" },
  battlepriest: { base: "healer", name: "นักบวชสงคราม", en: "Battle Priest", color: "#ffb84a", hp: 1.25, sp: 1.35, atk: 1.05, def: 1.2,
    role: "ตีระยะใกล้ · บัฟทีม (เหมาะกับกระบอง)", desc: "นักบวชที่ลงสนามเอง ชกด้วยหมัดศักดิ์สิทธิ์ ทุบค้อนสวรรค์ และเร่งพลังทั้งปาร์ตี้" },
};

const pct = (a, b, L) => Math.round((a + b * L) * 100);
const SKILLS2 = {
  // ===== อัศวินศักดิ์สิทธิ์ =====
  guardaura: { name: "ออร่าคุ้มกัน", max: 5, sp: [20, 2], cooldown: 40000, target: "self", kind: "partyBuff", area: [220, 0], buff: "guardaura", auto: "buff", icon: "skill_guardaura", color: "#e0c060",
    bv: (L) => ({ taken: 0.9 - 0.02 * L, ms: 20000 + 2000 * L }), desc: (L) => `ทุกคนรอบตัว 7 ช่อง โดนดาเมจลดลง ${10 + 2 * L}% นาน ${20 + 2 * L} วิ`, fx: { type: "ring", color: 0xffe9a0 } },
  holysword: { name: "ดาบแสง", max: 10, sp: [10, 0.6], cooldown: 6000, target: "mob", range: 60, kind: "hit", auto: "dmg", icon: "skill_holysword", color: "#f0d050",
    mult: [1.6, 0.1], undead: 1.8, area: [60, 0], splash: 0.5, desc: (L) => `ดาเมจ ${pct(1.6, 0.1, L)}% + แสงกระเด็นรอบเป้า 50% · อันเดดแรงขึ้น 80%`, fx: { type: "hit", color: 0xfff1a0 } },
  divineshield: { name: "เกราะศรัทธา", max: 5, sp: [25, 0], cooldown: 60000, target: "self", kind: "buff", buff: "divine", auto: "def", icon: "skill_divineshield", color: "#fff1a0",
    bv: (L) => ({ taken: 0, ms: 2000 + 400 * L }), desc: (L) => `ไม่รับดาเมจเลยนาน ${(2 + 0.4 * L).toFixed(1)} วิ`, fx: { type: "ring", color: 0xffffff } },
  masstaunt: { name: "ท้าทายหมู่", max: 5, sp: [16, 1], cooldown: 15000, target: "self", kind: "taunt", area: [160, 20], stun: [800, 100], auto: "pull", icon: "skill_masstaunt", color: "#d06040",
    desc: (L) => `ดึงมอนรอบตัว ${Math.round((160 + 20 * L) / 32)} ช่องมาตีเรา + มึนงง ${(0.8 + 0.1 * L).toFixed(1)} วิ`, fx: { type: "ring", color: 0xff8a6b } },
  // ===== อัศวินทมิฬ =====
  bloodblade: { name: "ดาบโลหิต", max: 10, sp: [0, 0], hpCost: 0.05, cooldown: 6000, target: "mob", range: 60, kind: "hit", auto: "dmg", icon: "skill_bloodblade", color: "#a02040",
    mult: [1.8, 0.12], drain: 0.2, desc: (L) => `ใช้ HP 5% แทน SP · ดาเมจ ${pct(1.8, 0.12, L)}% · ดูดเลือด 20% ของดาเมจ`, fx: { type: "hit", color: 0xff3060 } },
  thornarmor: { name: "เกราะหนาม", max: 5, sp: [15, 1], cooldown: 30000, target: "self", kind: "buff", buff: "thorn", auto: "def", icon: "skill_thornarmor", color: "#7a3aa0",
    bv: (L) => ({ reflect: 0.2 + 0.04 * L, ms: 12000 }), desc: (L) => `สะท้อนดาเมจที่ได้รับ ${20 + 4 * L}% กลับไปที่มอน นาน 12 วิ`, fx: { type: "ring", color: 0xa05aff } },
  weakencurse: { name: "คำสาปอ่อนแรง", max: 10, sp: [14, 0.6], cooldown: 14000, target: "self", kind: "debuff", area: [130, 4], debuff: "weak", auto: "buff", icon: "skill_weakencurse", color: "#503070",
    dv: (L) => ({ pct: 0.15 + 0.02 * L, ms: 10000 }), desc: (L) => `มอนรอบตัว ${((130 + 4 * L) / 32).toFixed(1)} ช่อง ตีเบาลง ${15 + 2 * L}% นาน 10 วิ`, fx: { type: "ring", color: 0x7a3aa0 } },
  darkwill: { name: "ใจทมิฬ", passive: true, max: 5, icon: "skill_darkwill", color: "#402060",
    desc: (L) => `HP สูงสุด +${3 * L}% · ATK +${2 * L}%`, pas: (L) => ({ hpPct: 3 * L, atkPct: 2 * L }) },
  // ===== เบอร์เซิร์กเกอร์ =====
  whirlwind: { name: "พายุดาบ", max: 10, sp: [14, 0.8], cooldown: 9000, target: "self", kind: "aoeSelf", area: [90, 4], hits: 3, every: 250, auto: "dmg", icon: "skill_whirlwind", color: "#c03a2a",
    mult: [0.55, 0.04], desc: (L) => `หมุนตัวฟัน 3 รอบ รอบละ ${pct(0.55, 0.04, L)}% ทุกตัวรอบตัว ${((90 + 4 * L) / 32).toFixed(1)} ช่อง`, fx: { type: "spin", color: 0xff6a4a } },
  leapstrike: { name: "กระโดดฟาด", max: 10, sp: [12, 0.6], cooldown: 10000, target: "mob", range: 220, kind: "leap", area: [80, 0], stun: [800, 0], auto: "dmg", icon: "skill_leapstrike", color: "#a04020",
    mult: [1.3, 0.1], desc: (L) => `กระโดดไปหาเป้า (ไกล 7 ช่อง) ฟาดลงพื้น ${pct(1.3, 0.1, L)}% ทุกตัวรอบจุดลง + มึนงง 0.8 วิ`, fx: { type: "aoe", color: 0xff8a4a } },
  bloodboil: { name: "โลหิตเดือด", max: 5, sp: [18, 0], cooldown: 35000, target: "self", kind: "buff", buff: "bloodboil", auto: "buff", icon: "skill_bloodboil", color: "#d02020",
    bv: (L) => ({ lifesteal: 10 + 2 * L, ms: 12000 }), desc: (L) => `ดูดเลือด ${10 + 2 * L}% ของดาเมจที่ทำ นาน 12 วิ`, fx: { type: "ring", color: 0xff2a2a } },
  frenzy: { name: "คลั่งเลือด", passive: true, max: 5, icon: "skill_frenzy", color: "#801010",
    desc: (L) => `HP ต่ำกว่า 50%: ATK +${5 + 3 * L}% · ตีเร็วขึ้น ${2 * L}%`, pas: () => ({}), frenzy: (L) => ({ atk: 1.05 + 0.03 * L, aspd: 1 - 0.02 * L }) },
  // ===== จอมดาบ =====
  iaido: { name: "ชักดาบพริบตา", max: 10, sp: [14, 0.8], cooldown: 12000, target: "mob", range: 64, kind: "hit", crit: true, auto: "dmg", icon: "skill_iaido", color: "#60c0ff",
    mult: [2.2, 0.15], desc: (L) => `ฟันคริติคอลแน่นอน ${pct(2.2, 0.15, L)}%`, fx: { type: "hit", color: 0x9fe3ff } },
  thousandcuts: { name: "ฟันพันใบ", max: 10, sp: [12, 0.6], cooldown: 8000, target: "mob", range: 60, kind: "hit", hits: 5, every: 110, auto: "dmg", icon: "skill_thousandcuts", color: "#4a8ac0",
    mult: [0.4, 0.03], desc: (L) => `ฟันรัว 5 ครั้ง ครั้งละ ${pct(0.4, 0.03, L)}%`, fx: { type: "hit", color: 0xc0e8ff } },
  bladefocus: { name: "สมาธิดาบ", max: 5, sp: [16, 0], cooldown: 30000, target: "self", kind: "buff", buff: "bladefocus", auto: "buff", icon: "skill_bladefocus", color: "#80d0ff",
    bv: (L) => ({ crit: 0.1 + 0.02 * L, critDmg: 0.1 + 0.04 * L, ms: 12000 }), desc: (L) => `โอกาสคริ +${10 + 2 * L}% · ดาเมจคริ +${10 + 4 * L}% นาน 12 วิ`, fx: { type: "ring", color: 0x9fe3ff } },
  shadowslash: { name: "เงาดาบ", max: 10, sp: [12, 0.6], cooldown: 9000, target: "mob", range: 200, kind: "dash", area: [70, 0], auto: "dmg", icon: "skill_shadowslash", color: "#305080",
    mult: [1.2, 0.08], desc: (L) => `พุ่งทะลุเป้า (ไกล 6 ช่อง) ฟันทุกตัวรอบเป้า ${pct(1.2, 0.08, L)}%`, fx: { type: "aoe", color: 0x6ab0ff } },
  // ===== สไนเปอร์ =====
  piercing: { name: "ยิงเจาะเกราะ", max: 10, sp: [10, 0.6], cooldown: 6000, target: "mob", range: 260, kind: "hit", ignore: 1, auto: "dmg", icon: "skill_piercing", color: "#40c0a0",
    mult: [1.8, 0.12], desc: (L) => `ยิงทะลุเกราะ (ไม่สนป้องกัน) ${pct(1.8, 0.12, L)}% · ระยะ 8 ช่อง`, fx: { type: "proj", proj: "arrow" } },
  stuntrap: { name: "กับดักมึนงง", max: 10, sp: [12, 0.5], cooldown: 14000, target: "mob", range: 220, kind: "aoeTarget", delay: 600, area: [80, 0], stun: [1500, 100], auto: "dmg", icon: "skill_stuntrap", color: "#a0a040",
    mult: [0.6, 0.04], desc: (L) => `วางกับดักที่เป้า ระเบิดหลัง 0.6 วิ ${pct(0.6, 0.04, L)}% + มึนงง ${(1.5 + 0.1 * L).toFixed(1)} วิ ทุกตัวในวง`, fx: { type: "aoe", color: 0xe0e080 } },
  hawk: { name: "เรียกเหยี่ยว", max: 10, sp: [20, 1], cooldown: 30000, target: "self", kind: "summon", summon: { kind: "hawk", ms: 20000, every: 1200, range: 260 }, auto: "buff", icon: "skill_hawk", color: "#a07040",
    mult: [0.5, 0.04], desc: (L) => `เหยี่ยวบินโฉบศัตรูที่เราสู้อยู่ทุก 1.2 วิ ครั้งละ ${pct(0.5, 0.04, L)}% นาน 20 วิ`, fx: { type: "ring", color: 0xd0a060 } },
  thunderarrow: { name: "ลูกศรสายฟ้า", max: 10, sp: [14, 0.6], cooldown: 8000, target: "mob", range: 230, kind: "chain", chain: 3, auto: "dmg", icon: "skill_thunderarrow", color: "#e0e040",
    mult: [1.0, 0.07], desc: (L) => `สายฟ้ากระโดด ${3 + Math.floor(L / 4)} ตัว ตัวละ ${pct(1.0, 0.07, L)}%`, fx: { type: "chain", color: 0xfff27a } },
  // ===== นักฆ่าเงา =====
  backstab: { name: "แทงลอบ", max: 10, sp: [12, 0.6], cooldown: 7000, target: "mob", range: 64, kind: "hit", stealthMul: 1.5, auto: "dmg", icon: "skill_backstab", color: "#6a3a9a",
    mult: [2.0, 0.15], desc: (L) => `แทง ${pct(2.0, 0.15, L)}% · ถ้าล่องหนอยู่ แรงขึ้นอีก 50%`, fx: { type: "hit", color: 0xb06aff } },
  stealth: { name: "ล่องหน", max: 5, sp: [16, 0], cooldown: 25000, target: "self", kind: "buff", buff: "stealth", auto: "def", icon: "skill_stealth", color: "#30304a",
    bv: (L) => ({ stealth: 1, ms: 5000 + 1000 * L }), desc: (L) => `หายตัว ${5 + L} วิ มอนเลิกไล่และมองไม่เห็น · ตีครั้งถัดไปคริติคอลแน่นอน (โจมตีแล้วหายล่องหน)`, fx: { type: "ring", color: 0x404060 } },
  poisonblade: { name: "อาบยาพิษ", max: 5, sp: [14, 0], cooldown: 30000, target: "self", kind: "buff", buff: "poisonblade", auto: "buff", icon: "skill_poisonblade", color: "#40a040",
    bv: (L) => ({ poison: 0.15 + 0.03 * L, ms: 15000 }), desc: (L) => `15 วิ: ทุกการโจมตีใส่พิษ ดาเมจ ${15 + 3 * L}% ของ ATK ต่อวิ นาน 5 วิ`, fx: { type: "ring", color: 0x7dff6a } },
  bladefan: { name: "ใบมีดพายุ", max: 10, sp: [12, 0.6], cooldown: 8000, target: "self", kind: "aoeSelf", area: [110, 4], auto: "dmg", icon: "skill_bladefan", color: "#8050b0",
    mult: [0.9, 0.07], desc: (L) => `ขว้างใบมีดรอบตัว ${((110 + 4 * L) / 32).toFixed(1)} ช่อง ${pct(0.9, 0.07, L)}%`, fx: { type: "spin", color: 0xc08aff } },
  // ===== จอมเวท =====
  blizzard: { name: "พายุหิมะ", ground: true, max: 10, sp: [24, 1], cooldown: 14000, target: "mob", range: 220, kind: "aoeTarget", area: [120, 4], hits: 4, every: 500, slow: [2000, 0], auto: "dmg", icon: "skill_blizzard", color: "#80c0ff",
    mult: [0.45, 0.03], desc: (L) => `พายุหิมะ 4 ระลอก ระลอกละ ${pct(0.45, 0.03, L)}% ทุกตัวในวง ${((120 + 4 * L) / 32).toFixed(1)} ช่อง + ช้าลง`, fx: { type: "aoe", color: 0xcfeaff } },
  lightning: { name: "สายฟ้าฟาด", max: 10, sp: [16, 0.8], cooldown: 7000, target: "mob", range: 220, kind: "chain", chain: 4, auto: "dmg", icon: "skill_lightning", color: "#f0e060",
    mult: [1.3, 0.09], desc: (L) => `สายฟ้ากระโดด ${4 + Math.floor(L / 4)} ตัว ตัวละ ${pct(1.3, 0.09, L)}%`, fx: { type: "chain", color: 0xfff27a } },
  manashield: { name: "โล่มานา", max: 5, sp: [20, 0], cooldown: 40000, target: "self", kind: "buff", buff: "manashield", auto: "def", icon: "skill_manashield", color: "#4060c0",
    bv: (L) => ({ mshield: 0.4 + 0.06 * L, ms: 20000 }), desc: (L) => `20 วิ: ดาเมจที่ได้รับ ${40 + 6 * L}% ไปหักจาก SP แทน HP`, fx: { type: "ring", color: 0x6f9bff } },
  blink: { name: "วาร์ปสั้น", max: 5, sp: [10, 0], cooldown: 14000 - 0, target: "self", kind: "blink", dist: [128, 16], icon: "skill_blink", color: "#a0c0ff",
    desc: (L) => `วาร์ปไปข้างหน้า ${((128 + 16 * L) / 32).toFixed(1)} ช่อง (หนีมอน) · มอนเลิกไล่`, fx: { type: "ring", color: 0xbfd8ff } },
  // ===== นักอัญเชิญ =====
  summonfire: { name: "อัญเชิญภูตไฟ", max: 10, sp: [24, 1], cooldown: 35000, target: "self", kind: "summon", summon: { kind: "fire", ms: 25000, every: 1500, range: 260, splash: 50 }, auto: "buff", icon: "skill_summonfire", color: "#ff7040",
    mult: [0.6, 0.05], desc: (L) => `ภูตไฟยิงศัตรูทุก 1.5 วิ ${pct(0.6, 0.05, L)}% + ไฟกระเด็น นาน 25 วิ`, fx: { type: "ring", color: 0xff8a3a } },
  doomcurse: { name: "สาปเสื่อม", max: 10, sp: [16, 0.6], cooldown: 18000, target: "mob", range: 220, kind: "debuff", area: [100, 4], debuff: "doom", auto: "dmg", icon: "skill_doomcurse", color: "#a03080",
    dv: (L) => ({ pct: 0.15 + 0.02 * L, ms: 12000 }), desc: (L) => `มอนในวงรอบเป้า โดนดาเมจแรงขึ้น ${15 + 2 * L}% นาน 12 วิ`, fx: { type: "aoe", color: 0xff7ab0 } },
  souldrain: { name: "ดูดวิญญาณ", max: 10, sp: [10, 0.5], cooldown: 6000, target: "mob", range: 220, kind: "hit", drain: 0.3, spGain: 5, auto: "dmg", icon: "skill_souldrain", color: "#c050a0",
    mult: [1.4, 0.1], desc: (L) => `เวท ${pct(1.4, 0.1, L)}% · ดูดเป็น HP 30% ของดาเมจ + SP 5`, fx: { type: "proj", proj: "dark" } },
  blackhole: { name: "หลุมดำ", ground: true, max: 10, sp: [28, 1.2], cooldown: 20000, target: "mob", range: 220, kind: "aoeTarget", area: [140, 4], hits: 3, every: 500, pull: true, auto: "dmg", icon: "skill_blackhole", color: "#301040",
    mult: [0.5, 0.04], desc: (L) => `เปิดหลุมดำ ดูดมอนในวง ${((140 + 4 * L) / 32).toFixed(1)} ช่องเข้าหากลาง 3 ระลอก ระลอกละ ${pct(0.5, 0.04, L)}%`, fx: { type: "aoe", color: 0x8a40c0 } },
  // ===== นักบุญ =====
  massheal: { name: "ฮีลหมู่", max: 10, sp: [24, 1.2], cooldown: 12000, target: "self", kind: "massHeal", area: [230, 0], heal: [0.15, 0.015], auto: "heal", icon: "skill_massheal", color: "#ffe080",
    desc: (L) => `ฮีลทุกคนรอบตัว 7 ช่อง ${pct(0.15, 0.015, L)}% ของ HP + INT×3`, fx: { type: "ring", color: 0xfff1a0 } },
  resurrect: { name: "ชุบชีวิต", max: 5, sp: [40, 0], cooldown: 60000, target: "self", kind: "revive", area: [230, 0], heal: [0.3, 0.05], icon: "skill_resurrect", color: "#ffffff",
    desc: (L) => `ชุบชีวิตคนที่ล้มใกล้ที่สุดในระยะ 7 ช่อง ฟื้นด้วย HP ${30 + 5 * L}%`, fx: { type: "ring", color: 0xffffff } },
  sanctuary: { name: "ภูมิคุ้มกัน", max: 5, sp: [22, 0], cooldown: 40000, target: "self", kind: "partyBuff", area: [230, 0], buff: "sanctuary", auto: "buff", icon: "skill_sanctuary", color: "#a0ffd0",
    bv: (L) => ({ taken: 0.95 - 0.01 * L, immune: 1, ms: 15000 }), desc: (L) => `ทุกคนรอบตัว: ล้างพิษ กันพิษ และโดนดาเมจลดลง ${5 + L}% นาน 15 วิ`, fx: { type: "ring", color: 0xa0ffd0 } },
  judgment: { name: "ค้อนพิพากษา", max: 10, sp: [16, 0.8], cooldown: 9000, target: "mob", range: 220, kind: "aoeTarget", area: [90, 0], undead: 1.6, auto: "dmg", icon: "skill_judgment", color: "#f0c040",
    mult: [1.3, 0.09], desc: (L) => `ค้อนแสงฟาดลงที่เป้า ${pct(1.3, 0.09, L)}% ทุกตัวในวง · อันเดดแรงขึ้น 60%`, fx: { type: "meteor", color: 0xffe28a } },
  // ===== นักบวชสงคราม =====
  holyfist: { name: "หมัดศักดิ์สิทธิ์", max: 10, sp: [10, 0.5], cooldown: 6000, target: "mob", range: 60, kind: "hit", hits: 3, every: 150, selfHeal: 0.02, auto: "dmg", icon: "skill_holyfist", color: "#ffa040",
    mult: [0.6, 0.05], desc: (L) => `ชก 3 หมัด หมัดละ ${pct(0.6, 0.05, L)}% · ทุกหมัดฟื้น HP ตัวเอง 2%`, fx: { type: "hit", color: 0xffd080 } },
  heavenhammer: { name: "ค้อนสวรรค์", max: 10, sp: [14, 0.6], cooldown: 12000, target: "mob", range: 64, kind: "aoeTarget", area: [90, 0], stun: [1000, 100], auto: "dmg", icon: "skill_heavenhammer", color: "#e0a030",
    mult: [1.2, 0.08], desc: (L) => `ทุบพื้น ${pct(1.2, 0.08, L)}% ทุกตัวรอบเป้า + มึนงง ${(1 + 0.1 * L).toFixed(1)} วิ`, fx: { type: "aoe", color: 0xffc860 } },
  hasteaura: { name: "ออร่าเร่ง", max: 5, sp: [20, 0], cooldown: 45000, target: "self", kind: "partyBuff", area: [230, 0], buff: "haste", auto: "buff", icon: "skill_hasteaura", color: "#ffd060",
    bv: (L) => ({ aspd: 0.9 - 0.015 * L, speed: 1.1, ms: 20000 }), desc: (L) => `ทุกคนรอบตัว ตีเร็วขึ้น ${10 + 1.5 * L}% · เดินเร็วขึ้น 10% นาน 20 วิ`, fx: { type: "ring", color: 0xffd060 } },
  regenaura: { name: "ฟื้นฟูต่อเนื่อง", max: 5, sp: [20, 0], cooldown: 40000, target: "self", kind: "partyBuff", area: [230, 0], buff: "regen", auto: "buff", icon: "skill_regenaura", color: "#80ff90",
    bv: (L) => ({ regen: 0.02 + 0.003 * L, ms: 15000 }), desc: (L) => `ทุกคนรอบตัว ฟื้น HP ${(2 + 0.3 * L).toFixed(1)}% ทุกวินาที นาน 15 วิ`, fx: { type: "ring", color: 0x80ff90 } },
};
// บัฟ/ดีบัฟใหม่ (ค่าจริงมาจาก bv/dv ของสกิล)
const BUFFS2 = {
  guardaura: { name: "ออร่าคุ้มกัน", ms: 20000 }, divine: { name: "เกราะศรัทธา", ms: 3000 }, thorn: { name: "เกราะหนาม", ms: 12000 },
  bloodboil: { name: "โลหิตเดือด", ms: 12000 }, bladefocus: { name: "สมาธิดาบ", ms: 12000 }, stealth: { name: "ล่องหน", ms: 6000 },
  poisonblade: { name: "อาบยาพิษ", ms: 15000 }, manashield: { name: "โล่มานา", ms: 20000 }, sanctuary: { name: "ภูมิคุ้มกัน", ms: 15000 },
  haste: { name: "ออร่าเร่ง", ms: 20000 }, regen: { name: "ฟื้นฟูต่อเนื่อง", ms: 15000 }, frenzy: { name: "คลั่งเลือด", ms: 1500 },
};
const TREE2 = {
  paladin: [["holysword", "masstaunt"], ["guardaura", "divineshield"]],
  darkknight: [["bloodblade", "darkwill"], ["thornarmor", "weakencurse"]],
  berserker: [["whirlwind", "frenzy"], ["leapstrike", "bloodboil"]],
  blademaster: [["iaido", "thousandcuts"], ["bladefocus", "shadowslash"]],
  sniper: [["piercing", "hawk"], ["stuntrap", "thunderarrow"]],
  assassin: [["backstab", "stealth"], ["poisonblade", "bladefan"]],
  archmage: [["lightning", "manashield"], ["blizzard", "blink"]],
  summoner: [["souldrain", "summonfire"], ["doomcurse", "blackhole"]],
  saint: [["massheal", "judgment"], ["sanctuary", "resurrect"]],
  battlepriest: [["holyfist", "hasteaura"], ["heavenhammer", "regenaura"]],
};
// สกิลแถว II ต้องมีสกิลแถว I ของต้นเดียวกัน Lv.3 ก่อน
for (const rows of Object.values(TREE2)) rows[1].forEach((k, i) => { SKILLS2[k].req = [rows[0][i], 3]; });

// บททดสอบอาชีพขั้น 2 (คุยกับอัลดริค): mini = ปราบมินิบอสของแผนที่นี้ · item = ของที่ต้องนำมา · gold = ค่าพิธี
const JOB2_QUESTS = {
  paladin: { mini: "frost", item: ["wraith_veil", 20], gold: 30000, where: "ยอดเขาน้ำแข็ง",
    story: "แสงศักดิ์สิทธิ์ต้องพิสูจน์ด้วยการปกป้อง จงปราบไซคลอปส์ภูผาหิมะ แล้วนำผ้าคลุมภูตหิมะมาชำระล้างในพิธี" },
  darkknight: { mini: "swamp", item: ["witch_herb", 20], gold: 30000, where: "บึงพิษมรณะ",
    story: "พลังแห่งความมืดต้องได้มาจากผู้ที่ครอบครองมัน จงล้มแม่มดหนองมรณะ แล้วนำสมุนไพรแม่มดมาให้ข้าปรุงพันธสัญญา" },
  berserker: { mini: "frost", item: ["giant_fur", 20], gold: 30000, where: "ยอดเขาน้ำแข็ง",
    story: "ความคลั่งต้องหลอมด้วยการต่อสู้กับสิ่งที่ใหญ่กว่า จงล้มไซคลอปส์ภูผาหิมะ แล้วนำขนยักษ์มาทำผ้าพันแผลนักรบ" },
  blademaster: { mini: "swamp", item: ["venom_scale", 20], gold: 30000, where: "บึงพิษมรณะ",
    story: "ดาบที่คมที่สุดต้องฟันได้แม้เกล็ดที่แข็งที่สุด จงปราบแม่มดหนองมรณะ และนำเกล็ดพิษมาเป็นหลักฐาน" },
  sniper: { mini: "frost", item: ["ice_fang", 20], gold: 30000, where: "ยอดเขาน้ำแข็ง",
    story: "สายตาของสไนเปอร์ต้องคมกว่าพายุหิมะ จงล้มไซคลอปส์ภูผาหิมะ แล้วนำเขี้ยวหมาป่าน้ำแข็งมาทำหัวลูกศร" },
  assassin: { mini: "swamp", item: ["venom_gel", 20], gold: 30000, where: "บึงพิษมรณะ",
    story: "นักฆ่าต้องรู้จักพิษดีกว่าใคร จงลอบสังหารแม่มดหนองมรณะ แล้วนำเจลพิษมาให้ข้ากลั่นเป็นยาพิษ" },
  archmage: { mini: "frost", item: ["frost_essence", 20], gold: 30000, where: "ยอดเขาน้ำแข็ง",
    story: "เวทแห่งธาตุต้องควบคุมได้แม้ในพายุ จงปราบไซคลอปส์ภูผาหิมะ แล้วนำแก่นน้ำแข็งมาหลอมเป็นคทาแห่งพายุ" },
  summoner: { mini: "swamp", item: ["maneater_petal", 20], gold: 30000, where: "บึงพิษมรณะ",
    story: "การอัญเชิญต้องใช้สื่อจากสิ่งมีชีวิตที่กินวิญญาณ จงล้มแม่มดหนองมรณะ แล้วนำกลีบดอกกินคนมาวาดวงอัญเชิญ" },
  saint: { mini: "frost", item: ["cyclops_eye", 15], gold: 30000, where: "ยอดเขาน้ำแข็ง",
    story: "นักบุญต้องมองเห็นแสงแม้ในความมืดมิด จงปราบไซคลอปส์ภูผาหิมะ แล้วนำดวงตาของมันมาทำพิธีเปิดดวงตาแห่งแสง" },
  battlepriest: { mini: "swamp", item: ["bog_tusk", 20], gold: 30000, where: "บึงพิษมรณะ",
    story: "นักบวชที่ลงสนามต้องแข็งแกร่งดั่งงาหมูป่า จงทุบแม่มดหนองมรณะ แล้วนำงาหมูบึงมาทำประคำศึก" },
};

module.exports = { JOB2_LEVEL, JOBS2, SKILLS2, BUFFS2, TREE2, JOB2_QUESTS };

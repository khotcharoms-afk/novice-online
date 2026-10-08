// =============================================================
//  โลกของเกม: รายชื่อแผนที่ / ช่วงเลเวล / มอนสเตอร์ / ทางเชื่อม
//  เพิ่มแผนที่ใหม่ = เพิ่มรายการในนี้ (+ ทางเชื่อมจากแผนที่ข้างเคียง)
//  exits: ทางออกที่ขอบแผนที่ { N/S/E/W: แผนที่ปลายทาง } (ปลายทางต้องมีทางออกกลับที่ขอบตรงข้าม)
//  world: ตำแหน่งบนแผนที่โลก (เปอร์เซ็นต์)  · season: ชุดภาพ spring/summer/autumn/winter
// =============================================================
const WORLD_NAME = "แดนอรุณ";

const MAPS = {
  town: {
    name: "เมืองอรุณรุ่ง", type: "town", lv: null, season: "summer", w: 48, h: 36, seed: 101,
    desc: "เมืองหลวงที่ปลอดภัย · ร้านค้า ช่างตีบวก และจุดเริ่มต้นการเดินทาง",
    world: { x: 50, y: 58 }, exits: { N: "bones", S: "meadow", W: "pine", E: "maple" },
    spawns: [], style: { town: true },
  },
  meadow: {
    name: "ทุ่งหญ้าต้นกล้า", type: "field", lv: [1, 6], season: "spring", w: 64, h: 48, seed: 202,
    desc: "ทุ่งหญ้าเขียวสดทางใต้ของเมือง มีก็อบลิน กระต่ายป่า และหนูยักษ์ เหมาะกับมือใหม่",
    world: { x: 50, y: 85 }, exits: { N: "town" },
    spawns: [["goblin", 13], ["rabbit", 10], ["rat", 8], ["slime_green", 9]], style: { ponds: 6, forest: 30, rocks: 25, bushes: 50 },
  },
  pine: {
    name: "ป่าสนเขียวขจี", type: "field", lv: [5, 12], season: "summer", w: 70, h: 52, seed: 303,
    desc: "ป่าสนทึบทางตะวันตก หมาป่าและแกะเขาโค้งหากิน มนุษย์กิ้งก่าซุ่มอยู่ริมบึง",
    world: { x: 29, y: 58 }, exits: { E: "town", N: "swamp", W: "cursed" },
    spawns: [["wolf", 10], ["sheep", 8], ["goblinchief", 7], ["lizard", 6], ["shroom_red", 7]], style: { ponds: 4, forest: 70, pines: 0.7, rocks: 35, bushes: 40 },
  },
  maple: {
    name: "ป่าใบไม้แดง", type: "field", lv: [10, 18], season: "autumn", w: 70, h: 52, seed: 404,
    desc: "ป่าฤดูใบไม้ร่วงทางตะวันออก หุ่นไล่กาฟักทองเดินได้และหมาป่าแดงชุกชุม",
    world: { x: 71, y: 58 }, exits: { W: "town", N: "orcamp" },
    spawns: [["boar", 8], ["jack", 9], ["redwolf", 8], ["zombie", 5], ["bat_brown", 7]], style: { ponds: 5, forest: 55, rocks: 30, bushes: 45 },
  },
  bones: {
    name: "เนินกระดูก", type: "field", lv: [14, 22], season: "summer", w: 66, h: 50, seed: 505,
    desc: "เนินดินแห้งแล้งทางเหนือ ผีดิบ โครงกระดูก และแวมไพร์ออกล่า",
    world: { x: 50, y: 36 }, exits: { S: "town", N: "snow", E: "orcamp" },
    spawns: [["skeleton", 10], ["zombie", 8], ["skelwarrior", 6], ["vampire", 5], ["ghost_white", 7]], style: { ponds: 1, forest: 18, dead: 30, rocks: 60, bushes: 15, dirt: 14 },
  },
  orcamp: {
    name: "ค่ายออร์ค", type: "field", lv: [18, 28], season: "summer", w: 66, h: 50, seed: 606,
    desc: "ค่ายทหารของออร์ค มีโทรลล์ หัวหน้าออร์ค และมิโนทอร์เฝ้าอยู่",
    world: { x: 71, y: 36 }, exits: { S: "maple", W: "bones", E: "desert" },
    spawns: [["orc", 11], ["shadowwolf", 7], ["troll", 7], ["orcchief", 5], ["minotaur", 4], ["golem_stone", 5]], style: { ponds: 2, forest: 25, dead: 12, rocks: 45, bushes: 20, dirt: 18 },
  },
  snow: {
    name: "หุบเขาหิมะ", type: "field", lv: [26, 35], season: "winter", w: 70, h: 52, seed: 707,
    desc: "หุบเขาหนาวเหน็บทางเหนือสุด โทรลล์หิมะและมอนแข็งแกร่งที่สุดในตอนนี้",
    world: { x: 50, y: 14 }, exits: { S: "bones", W: "frost" },
    spawns: [["snowwolf", 9], ["frostskel", 9], ["snowtroll", 7], ["snoworc", 5], ["slime_ice", 6]], style: { ponds: 5, forest: 45, pines: 0.6, rocks: 40, bushes: 25 },
  },
  // ================= โซนเลเวลสูง (Phase 7) =================
  frost: {
    name: "ยอดเขาน้ำแข็ง", type: "field", lv: [34, 44], season: "winter", w: 70, h: 52, seed: 808,
    desc: "ยอดเขาที่หิมะไม่เคยละลาย ยักษ์น้ำแข็งและภูตหิมะเฝ้าทางขึ้น",
    world: { x: 29, y: 14 }, exits: { E: "snow", S: "swamp" },
    spawns: [["frostgiant", 8], ["snowwraith", 9], ["icewolfman", 8], ["frostcyclops", 5], ["wisp_frost", 7]], style: { ponds: 4, forest: 40, pines: 0.8, rocks: 55, bushes: 15 },
  },
  swamp: {
    name: "บึงพิษมรณะ", type: "field", lv: [42, 52], season: "swamp", w: 70, h: 52, seed: 909,
    desc: "บึงน้ำเน่าเหนือป่าสน ผีดิบหนองน้ำลุกขึ้นจากโคลน แม่มดบึงซ่อนตัวในหมอก",
    world: { x: 29, y: 36 }, exits: { N: "frost", S: "pine", W: "ruins" },
    spawns: [["bogzombie", 6], ["venomlizard", 9], ["bogboar", 8], ["swampwitch", 5], ["slime_poison", 5], ["spider_bog", 5], ["plant_bog", 4]], style: { ponds: 12, forest: 45, dead: 20, rocks: 20, bushes: 40 },
  },
  ruins: {
    name: "ซากปราสาทร้าง", type: "field", lv: [50, 60], season: "ruins", w: 66, h: 50, seed: 1010,
    desc: "ซากปราสาทโบราณที่อัศวินโครงกระดูกยังเฝ้าอยู่ ลิชร่ายเวทในเงามืด",
    world: { x: 9, y: 36 }, exits: { E: "swamp", S: "cursed" },
    spawns: [["skelknight", 7], ["frankenstein", 9], ["gargoyle", 8], ["lich", 5], ["eye_float", 5], ["ghost_dark", 5]], style: { ponds: 1, forest: 15, dead: 35, rocks: 70, bushes: 10, dirt: 22 },
  },
  cursed: { danger: true, // โซนอันตราย Lv.60+: มอน ×1.5 · ทุกตัวดุ · เรียกพวกมารุม
    name: "ป่าต้องสาป", type: "field", lv: [58, 68], season: "shadow", w: 70, h: 52, seed: 1111,
    desc: "ป่าที่แสงส่องไม่ถึง วอร์ทอร์และหมาป่าคำสาปล่าเหยื่อ ลอร์ดแวมไพร์ปกครองที่นี่",
    world: { x: 9, y: 58 }, exits: { N: "ruins", E: "pine", S: "lava" },
    spawns: [["cursedwolf", 6], ["wartotaur", 9], ["dryad", 8], ["vamplord", 5], ["bat_vampire", 5], ["shroom_glow", 4], ["plant_cursed", 4]], style: { ponds: 4, forest: 75, dead: 25, rocks: 25, bushes: 35 },
  },
  lava: { danger: true, // โซนอันตราย Lv.60+: มอน ×1.5 · ทุกตัวดุ · เรียกพวกมารุม
    name: "ทุ่งลาวา", type: "field", lv: [66, 76], season: "lava", w: 70, h: 52, seed: 1212,
    desc: "ทุ่งหินไหม้ที่ลาวาไหลเป็นทาง ปีศาจเพลิงและซาลาแมนเดอร์อาศัยอยู่",
    world: { x: 9, y: 85 }, exits: { N: "cursed" },
    spawns: [["salamander", 6], ["flameorc", 9], ["firedemon", 8], ["lavataur", 5], ["wisp_fire", 5], ["slime_lava", 5], ["golem_magma", 4]], style: { ponds: 9, forest: 12, dead: 30, rocks: 65, bushes: 8, dirt: 16 },
  },
  desert: { danger: true, // โซนอันตราย Lv.60+: มอน ×1.5 · ทุกตัวดุ · เรียกพวกมารุม
    name: "ทะเลทรายแดง", type: "field", lv: [74, 84], season: "desert", w: 70, h: 52, seed: 1313,
    desc: "ผืนทรายร้อนระอุทางตะวันออกของค่ายออร์ค มัมมี่ตื่นจากสุสานใต้ทราย",
    world: { x: 91, y: 36 }, exits: { W: "orcamp", N: "dragon" },
    spawns: [["mummy", 7], ["sandrat", 9], ["sandspirit", 8], ["sandwarlord", 5], ["spider_sand", 6], ["golem_sand", 5]], style: { ponds: 2, forest: 10, dead: 20, rocks: 45, bushes: 10, dirt: 20 },
  },
  dragon: { danger: true, // โซนอันตราย Lv.60+: มอน ×1.5 · ทุกตัวดุ · เรียกพวกมารุม
    name: "ยอดเขามังกร", type: "field", lv: [82, 92], season: "lava", w: 70, h: 52, seed: 1414,
    desc: "ภูเขาไฟที่เผ่ามังกรยึดครอง ดราโคเนียนและอัศวินมังกรคุ้มกันรัง",
    world: { x: 91, y: 14 }, exits: { S: "desert", W: "abyss" },
    spawns: [["draconian", 8], ["wyvern", 9], ["dragonknight", 7], ["volcanogiant", 6], ["bat_drake", 7]], style: { ponds: 6, forest: 8, dead: 25, rocks: 75, bushes: 5, dirt: 14 },
  },
  abyss: { danger: true, // โซนอันตราย Lv.60+: มอน ×1.5 · ทุกตัวดุ · เรียกพวกมารุม
    name: "ห้วงอเวจี", type: "field", lv: [90, 99], season: "shadow", w: 72, h: 54, seed: 1515,
    desc: "รอยแยกสู่ความมืดที่ปลายสุดของโลก ที่พำนักของจอมมารแห่งห้วงลึก",
    world: { x: 71, y: 14 }, exits: { E: "dragon" },
    spawns: [["deathknight", 6], ["shadowdemon", 9], ["darkcyclops", 7], ["abysslord", 4], ["eye_abyss", 5], ["ghost_abyss", 5], ["slime_abyss", 4]], style: { ponds: 3, forest: 20, dead: 40, rocks: 55, bushes: 10, dirt: 18 },
  },
};
// ดันเจี้ยนภูติ (แผนที่ส่วนตัว ไม่มีทางเชื่อม · ดู server/sdungeon.js)
Object.assign(MAPS, require("./sdungeon").maps());
const START_MAP = "town";
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

// ตรวจความถูกต้องของทางเชื่อม (ตอนเปิดเซิร์ฟเวอร์)
for (const [id, m] of Object.entries(MAPS))
  for (const [edge, to] of Object.entries(m.exits)) {
    const back = MAPS[to] && MAPS[to].exits[OPPOSITE[edge]];
    if (back !== id) throw new Error(`ทางเชื่อมแผนที่ผิด: ${id} ${edge} → ${to} แต่ ${to} ${OPPOSITE[edge]} → ${back}`);
  }

module.exports = { WORLD_NAME, MAPS, START_MAP, OPPOSITE };

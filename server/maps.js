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
    world: { x: 50, y: 55 }, exits: { N: "bones", S: "meadow", W: "pine", E: "maple" },
    spawns: [], style: { town: true },
  },
  meadow: {
    name: "ทุ่งหญ้าต้นกล้า", type: "field", lv: [1, 6], season: "spring", w: 64, h: 48, seed: 202,
    desc: "ทุ่งหญ้าเขียวสดทางใต้ของเมือง เหมาะกับนักผจญภัยมือใหม่",
    world: { x: 50, y: 82 }, exits: { N: "town" },
    spawns: [["goblin", 20], ["wolfpup", 8]], style: { ponds: 6, forest: 30, rocks: 25, bushes: 50 },
  },
  pine: {
    name: "ป่าสนเขียวขจี", type: "field", lv: [5, 12], season: "summer", w: 70, h: 52, seed: 303,
    desc: "ป่าสนทึบทางตะวันตก มีหมาป่าและก็อบลินหัวหน้าคุมพื้นที่",
    world: { x: 20, y: 55 }, exits: { E: "town" },
    spawns: [["wolf", 14], ["goblinchief", 8], ["boar", 5]], style: { ponds: 4, forest: 70, pines: 0.7, rocks: 35, bushes: 40 },
  },
  maple: {
    name: "ป่าใบไม้แดง", type: "field", lv: [10, 18], season: "autumn", w: 70, h: 52, seed: 404,
    desc: "ป่าฤดูใบไม้ร่วงทางตะวันออก หมูป่าคลั่งและหมาป่าแดงชุกชุม",
    world: { x: 79, y: 57 }, exits: { W: "town", N: "orcamp" },
    spawns: [["boar", 12], ["redwolf", 10], ["skeleton", 5]], style: { ponds: 5, forest: 55, rocks: 30, bushes: 45 },
  },
  bones: {
    name: "เนินกระดูก", type: "field", lv: [14, 22], season: "summer", w: 66, h: 50, seed: 505,
    desc: "เนินดินแห้งแล้งทางเหนือ ซากกระดูกเดินได้และออร์คลาดตระเวน",
    world: { x: 50, y: 31 }, exits: { S: "town", N: "snow", E: "orcamp" },
    spawns: [["skeleton", 14], ["orc", 7], ["skelwarrior", 6]], style: { ponds: 1, forest: 18, dead: 30, rocks: 60, bushes: 15, dirt: 14 },
  },
  orcamp: {
    name: "ค่ายออร์ค", type: "field", lv: [18, 28], season: "summer", w: 66, h: 50, seed: 606,
    desc: "ค่ายทหารของออร์ค มีหัวหน้าออร์คและหมาป่าเงาเฝ้าอยู่",
    world: { x: 80, y: 29 }, exits: { S: "maple", W: "bones" },
    spawns: [["orc", 14], ["shadowwolf", 8], ["orcchief", 6]], style: { ponds: 2, forest: 25, dead: 12, rocks: 45, bushes: 20, dirt: 18 },
  },
  snow: {
    name: "หุบเขาหิมะ", type: "field", lv: [26, 35], season: "winter", w: 70, h: 52, seed: 707,
    desc: "หุบเขาหนาวเหน็บทางเหนือสุด มอนแข็งแกร่งที่สุดในตอนนี้",
    world: { x: 50, y: 8 }, exits: { S: "bones" },
    spawns: [["snowwolf", 12], ["frostskel", 10], ["snoworc", 6]], style: { ponds: 5, forest: 45, pines: 0.6, rocks: 40, bushes: 25 },
  },
};
const START_MAP = "town";
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

// ตรวจความถูกต้องของทางเชื่อม (ตอนเปิดเซิร์ฟเวอร์)
for (const [id, m] of Object.entries(MAPS))
  for (const [edge, to] of Object.entries(m.exits)) {
    const back = MAPS[to] && MAPS[to].exits[OPPOSITE[edge]];
    if (back !== id) throw new Error(`ทางเชื่อมแผนที่ผิด: ${id} ${edge} → ${to} แต่ ${to} ${OPPOSITE[edge]} → ${back}`);
  }

module.exports = { WORLD_NAME, MAPS, START_MAP, OPPOSITE };

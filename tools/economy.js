// รายได้ต่อนาทีโดยประมาณ (gold ที่ดรอป + ขายของดรอป) เทียบกับราคาของในเกม
const D = require("../server/data"), I = require("../server/items");
const KILL_SEC = 4; // ตีมอนพอดีเลเวล ~3 วิ + เดินหา ~1 วิ (ใส่ของทั่วไป หลังปรับสมดุล)
const mobs = Object.entries(D.MONSTERS).map(([k, m]) => ({ k, ...m }));
console.log("lv  gold/kill  ขายของ/kill  รวม/นาที   รวม/ชม.");
for (const lv of [5, 10, 20, 30, 40, 50, 60, 70, 80, 90]) {
  const near = mobs.filter((m) => Math.abs(m.level - lv) <= 3);
  if (!near.length) continue;
  let g = 0, s = 0;
  for (const m of near) {
    g += m.level * 1.0 + m.level * 0.8 * 0.5;
    for (const [id, ch, lo, hi] of I.DROPS[m.k] || []) {
      const it = I.ITEMS[id]; if (!it) continue;
      const n = (lo + hi) / 2, price = it.type === "equip" ? I.sellPrice(id, { r: 1 }) : I.sellPrice(id);
      s += Math.min(1, ch) * n * price;
    }
  }
  g /= near.length; s /= near.length;
  const perMin = (g + s) * 60 / KILL_SEC;
  console.log(`${String(lv).padStart(2)}  ${g.toFixed(0).padStart(8)}  ${s.toFixed(0).padStart(10)}  ${Math.round(perMin).toLocaleString().padStart(9)}  ${Math.round(perMin * 60).toLocaleString().padStart(10)}`);
}

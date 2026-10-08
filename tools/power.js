// จำลองความแรงตัวละครเทียบมอนเลเวลเดียวกัน: ไม่ใส่ของ / ของทั่วไป / ของครบ (ใช้สูตรจริงของเซิร์ฟเวอร์)
// รัน: node tools/power.js [job]
const D = require("../server/data"), I = require("../server/items"), Bag = require("../server/inventory");
const { WorldRoom } = require("../server/WorldRoom");
let job = process.argv[2] && process.argv[2] !== "boss" ? process.argv[2] : "slayer";
const fake = { sendDerived() {}, state: { players: new Map() } };
function buildFor(j, lv, mode) { const o = job; job = j; try { return build(lv, mode); } finally { job = o; } }
function build(lv, mode) {
  const p = { level: lv, job, skills: {}, hp: 1, sp: 1 };
  const st = D.baseStats(); D.allocate(st, D.totalPoints(lv), D.JOBS[job].rec || D.RECOMMEND);
  Object.assign(p, st);
  // สกิลติดตัวเต็ม (passive) ตามแต้มที่มี
  p.skills = D.sanitizeSkills(Object.fromEntries(D.treeKeys(job).filter((k) => D.SKILLS[k].passive).map((k) => [k, 10])), job, lv);
  const b = Bag.emptyBag();
  if (mode !== "naked") {
    const r = mode === "full" ? 3 : 2, up = mode === "full" ? 7 : 4;
    for (const slot of I.EQUIP_SLOTS) {
      const cands = Object.entries(I.ITEMS).filter(([id, it]) => it.type === "equip" && I.fitsSlot(it, slot) && (it.lv || 1) <= lv && !Bag.wearError(job, it)
        && (slot !== "offhand" || !(b.equip.weapon && D.WEAPON_TYPES[I.ITEMS[b.equip.weapon.id].wt || ""]?.twoHand)));
      if (!cands.length) continue;
      cands.sort((a, c) => (c[1].lv || 0) - (a[1].lv || 0) || (c[1].price || 0) - (a[1].price || 0));
      const g = I.makeGear(cands[0][0], r); g.up = I.canRefine(I.ITEMS[g.id]) ? up : 0;
      b.equip[slot] = g;
    }
  }
  p.bag = b;
  WorldRoom.prototype.applyStats.call(fake, p, true);
  return p;
}
const avgDmg = (atk, crit, critDmg, def, ignore = 0, lv = 1) => Math.max(1, atk * (1 - D.defReduce(def * (1 - ignore), lv))) * (1 + crit * (0.5 + critDmg));
if (process.argv[2] !== "boss") {
console.log(`job=${job}`);
console.log("lv  mode    atk   def   hp     aspd  crit  | mobHP  hits2kill  ttk(s) | mobHit  hitsToDie  mob-ttk(s)");
for (const lv of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
  const M = D.monsterStats(lv);
  for (const mode of ["naked", "normal", "full"]) {
    const p = build(lv, mode), sx = p.sx || {};
    const hit = avgDmg(p.atk, p.crit, (sx.critDmg || 0) / 100, M.def, (sx.ignoreDef || 0) / 100, lv);
    const ttk = Math.ceil(M.maxHp / hit) * p.atkDelay / 1000;
    const taken = Math.max(1, M.atk * (1 - D.defReduce(p.def, lv))) * (1 - (sx.dmgReduce || 0) / 100) * (1 - p.flee);
    const hitsToDie = p.maxHp / taken;
    console.log(`${String(lv).padStart(2)}  ${mode.padEnd(6)} ${String(p.atk).padStart(5)} ${String(Math.round(p.def)).padStart(5)} ${String(p.maxHp).padStart(6)} ${String(p.atkDelay).padStart(5)} ${(p.crit * 100).toFixed(0).padStart(4)}% | ${String(M.maxHp).padStart(6)} ${String(Math.ceil(M.maxHp / hit)).padStart(6)} ${ttk.toFixed(1).padStart(8)} | ${String(Math.round(taken)).padStart(6)} ${hitsToDie.toFixed(0).padStart(8)} ${(hitsToDie * 1.5).toFixed(0).padStart(9)}`);
  }
}
}
if (process.argv[3]) {
  const lv = +process.argv[3], p = build(lv, process.argv[4] || "normal");
  for (const [s, g] of Object.entries(p.bag.equip)) console.log(s.padEnd(8), g.id.padEnd(22), "r" + g.r, "+" + g.up, JSON.stringify(I.gearStats(g)), JSON.stringify(I.gearSpecial(g)));
  console.log("sets", JSON.stringify(Bag.activeSets(p.bag, job)), "gearBonus", JSON.stringify(p.gearBonus), "sx", JSON.stringify(p.sx));
}
// World Boss: เวลาที่ใช้ปราบ (1/3/5 คน ใส่ของทั่วไป) และบอสตีคนใส่ของทั่วไป/ครบ แรงแค่ไหน
if (process.argv[2] === "boss") {
  for (const [k, B] of Object.entries(D.WORLD_BOSSES)) {
    const base = D.monsterStats(B.level), hp = base.maxHp * B.hpMul, atk = base.atk * B.atkMul, def = base.def * B.defMul;
    const lv = B.level + 3;
    const line = [`${B.name} Lv.${B.level}  HP ${hp.toLocaleString()}  ATK ${Math.round(atk)}`];
    for (const mode of ["normal", "full"]) {
      const jobs = ["slayer", "guardian", "hunter", "mage", "healer"];
      let dps = 0, taken = 0, hpP = 0;
      for (const j of jobs) {
        const save = process.argv[2]; 
        const p = (function () { const old = job; return buildFor(j, lv, mode); })();
        const sx = p.sx || {};
        dps += avgDmg(p.atk, p.crit, (sx.critDmg || 0) / 100, def, (sx.ignoreDef || 0) / 100, lv) / (p.atkDelay / 1000);
        if (j === "slayer") { taken = atk * (1 - D.defReduce(p.def, B.level)) * (1 - (sx.dmgReduce || 0) / 100); hpP = p.maxHp; }
      }
      dps /= 5;
      line.push(`  [${mode}] 1 คน ${(hp / dps / 60).toFixed(1)} นาที · 3 คน ${(hp / dps / 3 / 60).toFixed(1)} · 5 คน ${(hp / dps / 5 / 60).toFixed(1)} นาที | บอสตีนักดาบ ${Math.round(taken)}/ที (ทุบพื้น ${B.slam ? Math.round(taken * B.slam.mult) : '-'}) HP ${hpP} → ยืนได้ ~${Math.round(hpP / taken * 1.5)} วิ`);
    }
    console.log(line.join("\n"));
  }
}

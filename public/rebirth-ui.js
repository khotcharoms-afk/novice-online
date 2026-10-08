// =============================================================
//  เซเลส · ผู้หลอมชะตา: รีสเตตัส / รีคลาส (ครั้งละ 1,000,000 gold)
//  รีคลาส = เปลี่ยนเป็นอาชีพอื่นขั้นเดียวกัน · คืนแต้มสเตตัส + แต้มสกิลทั้งหมด · อุปกรณ์ที่ใส่ไม่ได้ถอดเข้ากระเป๋า
//  (ใช้ตัวแปร room, gameData, INV, $ จาก game.js / items-ui.js)
// =============================================================
const REBIRTH_COST = 1000000;
let rbSel = null;
function openRebirth() {
  closeShop(); closeSmith();
  rbSel = null;
  $("rebirthPanel").hidden = false;
  renderRebirth();
}
function closeRebirth() { const p = $("rebirthPanel"); if (p) p.hidden = true; }
function renderRebirth() {
  const panel = $("rebirthPanel");
  if (!panel || panel.hidden || !gameData) return;
  const me = myPlayer();
  if (!me) return;
  const J = gameData.jobs, gold = INV.gold || 0, rich = gold >= REBIRTH_COST;
  $("rbGold").textContent = gold.toLocaleString();
  $("rbGold").style.color = rich ? "" : "#ff7a6b";
  const stats = ["str", "agi", "vit", "int", "dex"].map((k) => `<span>${k.toUpperCase()} <b>${me[k]}</b></span>`).join("");
  const spent = ["str", "agi", "vit", "int", "dex"].some((k) => me[k] > 1);
  let cls;
  if (me.job === "villager") cls = `<p class="ap-note">Novice ยังไม่มีอาชีพ — ไปเปลี่ยนอาชีพที่อัลดริค (ครูฝึกอาชีพ) ก่อน</p>`;
  else {
    const tier = J[me.job].tier || 1;
    const list = Object.keys(J).filter((k) => k !== "villager" && (J[k].tier || 1) === tier);
    cls = `<p class="ap-note">เลือกอาชีพ${tier === 2 ? "ขั้น 2" : "ขั้น 1"}ที่ต้องการ · แต้มสเตตัสและแต้มสกิลคืนให้ลงใหม่ทั้งหมด · อุปกรณ์ที่อาชีพใหม่ใส่ไม่ได้จะถอดเข้ากระเป๋า</p>
      <div class="rb-jobs">${list.map((k) => `<button type="button" class="rb-job${k === me.job ? " cur" : ""}${k === rbSel ? " sel" : ""}" data-j="${k}" style="--jc:${J[k].color}" ${k === me.job ? "disabled" : ""}>
        <b>${J[k].name}</b><small>${k === me.job ? "อาชีพปัจจุบัน" : J[k].role}</small></button>`).join("")}</div>
      <button type="button" class="btn-gold" id="rbClass" ${rbSel && rich ? "" : "disabled"}>${rbSel ? `🔮 เปลี่ยนเป็น ${J[rbSel].name} · 1,000,000 gold` : "เลือกอาชีพก่อน"}</button>`;
  }
  $("rbBody").innerHTML = `
    <div class="rb-sec"><h4>♻️ รีสเตตัส</h4><p class="ap-note">คืนแต้มสเตตัสทั้งหมดให้ลงใหม่ (อาชีพและสกิลเหมือนเดิม)</p>
      <div class="rb-stats">${stats}</div>
      <button type="button" class="btn-gold" id="rbStat" ${rich && spent ? "" : "disabled"}>♻️ รีสเตตัส · 1,000,000 gold</button></div>
    <div class="rb-sec"><h4>🔮 รีคลาส</h4>${cls}</div>
    ${rich ? "" : `<p class="need">gold ไม่พอ — ต้องมี 1,000,000</p>`}`;
  $("rbBody").querySelectorAll(".rb-job:not(.cur)").forEach((b) => (b.onclick = () => { rbSel = b.dataset.j; renderRebirth(); }));
  $("rbStat").onclick = async () => {
    if (await askConfirm(`รีสเตตัส?<br><small>จ่าย 1,000,000 gold · คืนแต้มสเตตัสทั้งหมดให้ลงใหม่</small>`, { okText: "รีสเตตัส" })) room.send("rebirth", { act: "stat" });
  };
  if ($("rbClass")) $("rbClass").onclick = async () => {
    if (!rbSel) return;
    if (await askConfirm(`เปลี่ยนอาชีพเป็น <b>${J[rbSel].name}</b>?<br><small>จ่าย 1,000,000 gold · แต้มสเตตัสและแต้มสกิลคืนทั้งหมด · สกิลเดิมหายต้องลงใหม่ · อุปกรณ์ที่ใส่ไม่ได้ถอดเข้ากระเป๋า</small>`, { okText: "เปลี่ยนอาชีพ", danger: true })) room.send("rebirth", { act: "class", job: rbSel });
  };
}
function onRebirthDone(d) {
  rbSel = null;
  setTimeout(() => { renderRebirth(); if (typeof renderStats === "function") renderStats(); if (d.act === "stat") toggleStats && toggleStats(true); }, 300);
}
(() => {
  if ($("rbClose")) $("rbClose").onclick = closeRebirth;
  // เดินออกห่าง → ปิด · กระเป๋าเปลี่ยน → อัปเดตเงิน
  setInterval(() => {
    const p = $("rebirthPanel");
    if (!p || p.hidden || !gameData) return;
    const me = myPlayer(), n = gameData.npcs.find((x) => x.id === "reclass");
    if (me && n && Math.hypot(me.x - n.x, me.y - n.y) > 200) return closeRebirth();
    const key = me && [INV.gold, me.job, me.str, me.agi, me.vit, me.int, me.dex].join("|"); // เปลี่ยนจริงค่อยวาดใหม่ (ไม่ให้ปุ่มหายตอนกำลังกด)
    if (key !== p._key) { p._key = key; renderRebirth(); }
  }, 1000);
})();

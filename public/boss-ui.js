// =============================================================
//  บอร์ด World Boss (ปุ่ม 👑 บอส ใต้มินิแมพ / ปุ่ม O): บอสตัวไหนอยู่ที่ไหน · จะเกิดอีกกี่นาที แมพไหน
//  (ใช้ตัวแปร room, $ จาก game.js)
// =============================================================
let bossData = null, bossAt = 0, bossPoll = null, bossTick = null;
const bossImgs = {};

function toggleBoss(force) {
  const p = $("bossPanel");
  if (!p) return;
  const open = force ?? p.hidden;
  p.hidden = !open;
  clearInterval(bossPoll); clearInterval(bossTick);
  if (!open) return;
  room && room.send("bossBoard");
  bossPoll = setInterval(() => { if ($("bossPanel").hidden) return clearInterval(bossPoll); room && room.send("bossBoard"); }, 10000);
  bossTick = setInterval(() => { if ($("bossPanel").hidden) return clearInterval(bossTick); renderBoss(); }, 1000);
}
function onBossBoard(d) { bossData = d.list; bossAt = performance.now(); renderBoss(); }

const fmtLeft = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h} ชม. ${m} นาที` : m ? `${m} นาที ${String(ss).padStart(2, "0")} วิ` : `${ss} วิ`;
};

function renderBoss() {
  const el = $("bossList");
  if (!el || $("bossPanel").hidden) return;
  if (!bossData) { el.innerHTML = `<div class="job-note">กำลังโหลด…</div>`; return; }
  const gone = performance.now() - bossAt;
  el.innerHTML = bossData.map((b) => {
    let cls = "", state;
    if (b.state === "alive") {
      cls = "alive";
      const pct = b.maxHp ? Math.round((b.hp * 100) / b.maxHp) : 100;
      state = `<span>🔥 ปรากฏแล้ว!</span><b>${b.map}</b><small>(${b.tx}, ${b.ty}) · หายไปในอีก ${fmtLeft(b.endsIn - gone)}</small><div class="boss-hp"><i style="width:${pct}%"></i></div><small>HP ${pct}%</small>`;
    } else if (b.state === "waiting") {
      cls = "alive";
      state = `<span>⏳ กำลังจะปรากฏ</span><b>${b.map}</b><small>เข้าแผนที่เพื่อเรียกบอสออกมา</small>`;
    } else {
      const left = b.next - gone;
      if (left < 5 * 60000) cls = "soon";
      state = `<span>${left <= 0 ? "กำลังเกิด…" : "เกิดในอีก"}</span><b>${left <= 0 ? "เร็ว ๆ นี้" : fmtLeft(left)}</b><small>${b.map ? `ที่ ${b.map}` : "สุ่มแมพ"}</small>`;
    }
    return `<div class="boss-row ${cls}"><canvas width="64" height="64" data-sprite="${b.sprite}"></canvas>
      <div><h5>${b.name} <small>Lv.${b.level}</small></h5><div class="bmeta">เกิดที่: ${b.maps.join(" / ")}</div></div>
      <div class="bstate">${state}</div></div>`;
  }).join("");
  el.querySelectorAll("canvas").forEach((cv) => drawBossIcon(cv, cv.dataset.sprite));
}
function drawBossIcon(cv, sprite) {
  let img = bossImgs[sprite];
  if (!img) { img = bossImgs[sprite] = new Image(); img.src = `/assets/mobs/${sprite}.png`; img.onload = () => renderBoss(); }
  if (!img.complete || !img.naturalWidth) return;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  ctx.drawImage(img, 0, 2 * 64, 64, 64, 0, 0, 64, 64); // ท่ายืนหันหน้า
}

(() => {
  const b = $("bossBtn"), c = $("bossClose");
  if (b) b.onclick = () => toggleBoss();
  if (c) c.onclick = () => toggleBoss(false);
  document.addEventListener("keydown", (e) => {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "o" || e.key === "O") toggleBoss();
    if (e.key === "Escape") toggleBoss(false);
  });
})();

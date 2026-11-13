// =============================================================
//  ภารกิจรายวัน (ปุ่ม "ภารกิจ" ใต้ชื่อตัวละคร / ปุ่ม J) · ร้านเหรียญกิจกรรม
//  ข้อมูลทั้งหมดมาจากเซิร์ฟเวอร์ (server/daily.js) — หน้าจอแค่แสดงและส่งคำขอรับ/แลก
//  (ใช้ตัวแปร room, $, esc, ICON, itemOf จาก game.js / items-ui.js)
// =============================================================
let DAILY = null, dailyAt = 0, dailyTab = "list", dailyTick = null;
const DAILY_ICON = { hunt: "⚔️", slay: "💀", elite: "👑", skill: "✨", loot: "🧺", visit: "🧭", clear: "🌀" };

function onDaily(d) {
  DAILY = d; dailyAt = performance.now();
  const ready = d.list.filter((m) => m.have >= m.need && !m.claimed).length + (d.list.every((m) => m.claimed) && !d.bonus ? 1 : 0);
  const b = $("dailyBadge");
  if (b) { b.hidden = !ready; b.textContent = ready; }
  renderDaily();
}

function toggleDaily(force) {
  const p = $("dailyPanel");
  if (!p) return;
  const open = force ?? p.hidden;
  p.hidden = !open;
  clearInterval(dailyTick);
  if (!open) return;
  room && room.send("dailyGet");
  renderDaily();
  dailyTick = setInterval(() => { if ($("dailyPanel").hidden) return clearInterval(dailyTick); const el = $("dyReset"); if (el && DAILY) el.textContent = dailyLeft(); }, 1000);
}

function dailyLeft() {
  const s = Math.max(0, Math.round((DAILY.resetIn - (performance.now() - dailyAt)) / 1000));
  return `${Math.floor(s / 3600)} ชม. ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} นาที`;
}

function renderDaily() {
  const body = $("dailyBody");
  if (!body || $("dailyPanel").hidden) return;
  if (!DAILY) { body.innerHTML = `<div class="job-note">กำลังโหลด…</div>`; return; }
  const d = DAILY, rw = (r) => `<span class="dy-rw">${r.exp ? `<i>EXP</i>${r.exp.toLocaleString()}` : ""}<i>💰</i>${(r.gold || 0).toLocaleString()}<i>🪙</i>${r.ap}</span>`;
  $("dyAp").textContent = d.ap.toLocaleString();
  document.querySelectorAll("#dailyPanel .dy-tab").forEach((b) => b.classList.toggle("sel", b.dataset.t === dailyTab));
  if (dailyTab === "shop") {
    body.innerHTML = `<p class="ap-note">แลกของด้วยเหรียญกิจกรรม 🪙 — ได้จากภารกิจรายวัน (ข้อละ 10 · ครบทุกข้อ +20) · เหรียญสะสมข้ามวันได้</p>
      <div class="dy-shop">${(d.shop || []).map((s) => { const it = itemOf(s.id) || { name: s.id }; const ok = d.ap >= s.cost;
        return `<div class="dy-item"><img src="${ICON(s.id)}" alt=""><div><b>${esc(it.name)}</b> ×${s.n}<small>${esc((it.desc || "").slice(0, 60))}</small></div>
          <button type="button" class="btn-gold sm" data-k="${s.k}" ${ok ? "" : "disabled"}>🪙 ${s.cost}</button></div>`; }).join("")}</div>`;
    body.querySelectorAll("button[data-k]").forEach((b) => (b.onclick = () => room.send("dailyBuy", { k: b.dataset.k })));
    return;
  }
  const all = d.list.every((m) => m.claimed);
  body.innerHTML = `<div class="dy-list">${d.list.map((m) => {
      const done = m.have >= m.need, pct = Math.round((m.have / m.need) * 100);
      return `<div class="dy-row${m.claimed ? " claimed" : done ? " done" : ""}">
        <span class="dy-ic">${DAILY_ICON[m.kind] || "📜"}</span>
        <div class="dy-main"><b>${esc(m.text)}</b>${m.where ? `<small>ที่ ${esc(m.where)}</small>` : ""}
          <div class="dy-bar"><i style="width:${pct}%"></i><span>${m.have}/${m.need}</span></div>${rw(m.rw)}</div>
        ${m.claimed ? `<span class="dy-ok">✔ รับแล้ว</span>` : `<button type="button" class="btn-gold sm" data-i="${m.i}" ${done ? "" : "disabled"}>รับรางวัล</button>`}
      </div>`; }).join("")}</div>
    <div class="dy-bonus${d.bonus ? " claimed" : ""}"><div><b>🎁 โบนัสทำครบทุกข้อ</b>${rw(d.bonusRw)}</div>
      ${d.bonus ? `<span class="dy-ok">✔ รับแล้ว</span>` : `<button type="button" class="btn-gold sm" id="dyBonus" ${all ? "" : "disabled"}>รับโบนัส</button>`}</div>
    <p class="ap-note">ภารกิจใหม่ในอีก <b id="dyReset">${dailyLeft()}</b> (เที่ยงคืนเวลาไทย) · ความคืบหน้านับที่เซิร์ฟเวอร์ · ปาร์ตี้ช่วยกันฆ่าก็นับ</p>`;
  body.querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => room.send("dailyClaim", { i: Number(b.dataset.i) })));
  const bb = $("dyBonus"); if (bb) bb.onclick = () => room.send("dailyClaim", { bonus: true });
}

(() => {
  const b = $("dailyBtn"), c = $("dailyClose");
  if (b) b.onclick = () => toggleDaily();
  if (c) c.onclick = () => toggleDaily(false);
  document.querySelectorAll("#dailyPanel .dy-tab").forEach((t) => (t.onclick = () => { dailyTab = t.dataset.t; renderDaily(); }));
  document.addEventListener("keydown", (e) => {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "j" || e.key === "J") toggleDaily();
    if (e.key === "Escape") toggleDaily(false);
  });
})();

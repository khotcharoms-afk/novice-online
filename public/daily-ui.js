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
  room && room.send("achGet");
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
  if (dailyTab === "codex") return renderCodex(body);
  if (dailyTab === "ach") return renderAch(body);
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
  document.querySelectorAll("#dailyPanel .dy-tab").forEach((t) => (t.onclick = () => { dailyTab = t.dataset.t; if (t.dataset.t === "codex" || t.dataset.t === "ach") room && room.send("achGet"); renderDaily(); }));
  document.addEventListener("keydown", (e) => {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === "j" || e.key === "J") toggleDaily();
    if (e.key === "Escape") toggleDaily(false);
  });
})();

// =============================================================
//  สมุดมอนสเตอร์ + ความสำเร็จ + ฉายา (ข้อมูลจาก server/achieve.js)
// =============================================================
let ACH = null, codexSel = null, codexFilter = "all";
function onAch(d) { ACH = d; renderDaily(); }
const mobFace = (sprite, dark) => `<span class="cx-face${dark ? " dark" : ""}" style="background-image:url('/assets/mobs/${sprite}.png')"></span>`;

function renderCodex(body) {
  if (!ACH || !gameData) { body.innerHTML = `<div class="job-note">กำลังโหลด…</div>`; return; }
  const S = ACH.star, mobs = Object.entries(gameData.mobs).sort((a, b) => a[1].level - b[1].level);
  const stars = (n) => { const k = n >= S[2] ? 3 : n >= S[1] ? 2 : n >= S[0] ? 1 : 0; return `<span class="cx-st">${"★".repeat(k)}<i>${"★".repeat(3 - k)}</i></span>`; };
  const found = mobs.filter(([k]) => ACH.codex[k] > 0).length;
  const list = mobs.filter(([k]) => codexFilter === "all" || (codexFilter === "found" ? ACH.codex[k] > 0 : !ACH.codex[k]));
  const sel = codexSel && gameData.mobs[codexSel] ? codexSel : null;
  let detail = "";
  if (sel) {
    const M = gameData.mobs[sel], n = ACH.codex[sel] || 0, I = ACH.mobInfo[sel] || { where: [], drops: [], eq: 0 };
    const next = S.find((x) => x > n);
    detail = `<div class="cx-detail">${mobFace(M.sprite, !n)}<div>
      <b>${n ? esc(M.name) : "???"}</b> <small>Lv.${M.level}</small> ${stars(n)}
      <div class="cx-line">ฆ่าแล้ว <b>${n.toLocaleString()}</b> ตัว${next ? ` · อีก ${(next - n).toLocaleString()} ตัวถึง ★ถัดไป` : " · ครบ ★3 แล้ว"}</div>
      <div class="cx-line">พบที่: ${I.where.length ? I.where.map(esc).join(", ") : "ดันเจี้ยน/อีเวนต์"}</div>
      ${n ? `<div class="cx-drops">${I.drops.map(([id, ch]) => `<span title="${esc((itemOf(id) || {}).name || id)}"><img src="${ICON(id)}" alt="">${ch}%</span>`).join("")}${I.eq ? `<span class="muted">+ อุปกรณ์ ${I.eq} แบบ</span>` : ""}</div>` : `<div class="cx-line muted">ฆ่าตัวแรกเพื่อเปิดดูของดรอป</div>`}
      <div class="cx-line muted">★1 ${S[0]} ตัว (เหรียญ ${ACH.starAp[0]}) · ★2 ${S[1]} ตัว (ดรอป +${Math.round(ACH.star2Drop * 100)}%) · ★3 ${S[2]} ตัว (ดาเมจ +${Math.round(ACH.star3Dmg * 100)}%)</div>
    </div></div>`;
  }
  body.innerHTML = `${detail}<div class="cx-top"><span>บันทึกแล้ว <b>${found}</b>/${mobs.length}</span>
      <span class="cx-fl">${[["all", "ทั้งหมด"], ["found", "เจอแล้ว"], ["miss", "ยังไม่เจอ"]].map(([k, t]) => `<button type="button" data-f="${k}" class="${codexFilter === k ? "sel" : ""}">${t}</button>`).join("")}</span></div>
    <div class="cx-grid">${list.map(([k, M]) => { const n = ACH.codex[k] || 0;
      return `<button type="button" class="cx-card${k === sel ? " sel" : ""}" data-k="${k}">${mobFace(M.sprite, !n)}<small>${n ? esc(M.name) : "???"}</small>${stars(n)}</button>`; }).join("")}</div>`;
  body.querySelectorAll(".cx-card").forEach((b) => (b.onclick = () => { codexSel = b.dataset.k; renderDaily(); body.scrollTop = 0; }));
  body.querySelectorAll(".cx-fl button").forEach((b) => (b.onclick = () => { codexFilter = b.dataset.f; renderDaily(); }));
}

function renderAch(body) {
  if (!ACH) { body.innerHTML = `<div class="job-note">กำลังโหลด…</div>`; return; }
  const done = ACH.ach.filter((a) => a.done).length;
  const titles = ACH.titles || [];
  body.innerHTML = `<div class="ach-title"><b>ฉายา</b> <small>(แสดงเหนือชื่อตัวละคร · ไม่มีผลต่อค่าพลัง)</small>
      <div class="ach-tl"><button type="button" data-t="" class="${!ACH.title ? "sel" : ""}">ไม่แสดง</button>${titles.map((t) => `<button type="button" data-t="${esc(t)}" class="${ACH.title === t ? "sel" : ""}">「${esc(t)}」</button>`).join("")}
      ${titles.length ? "" : `<small class="muted">ยังไม่มีฉายา — ปลดล็อกจากความสำเร็จที่มีป้าย 🎖</small>`}</div></div>
    <div class="cx-top"><span>สำเร็จแล้ว <b>${done}</b>/${ACH.ach.length}</span></div>
    <div class="ach-list">${[...ACH.ach].sort((a, b) => (a.done - b.done) || (b.have / b.need - a.have / a.need)).map((a) => `
      <div class="ach-row${a.done ? " done" : ""}"><span class="ach-ic">${a.done ? "🏆" : "🔒"}</span>
        <div><b>${esc(a.name)}</b>${a.title ? ` <span class="ach-tag">🎖 「${esc(a.title)}」</span>` : ""}
          <div class="dy-bar"><i style="width:${Math.round((a.have / a.need) * 100)}%"></i><span>${a.have.toLocaleString()}/${a.need.toLocaleString()}</span></div>
          <span class="dy-rw"><i>💰</i>${(a.rw.gold || 0).toLocaleString()}<i>🪙</i>${a.rw.ap || 0}</span></div></div>`).join("")}</div>`;
  body.querySelectorAll(".ach-tl button").forEach((b) => (b.onclick = () => room.send("setTitle", { title: b.dataset.t })));
}

// ปลดล็อกความสำเร็จ: ป้ายกลางจอบน
function onAchDone(d) {
  const el = document.createElement("div");
  el.className = "ach-pop";
  el.innerHTML = `<span>🏆</span><div><small>ปลดล็อกความสำเร็จ</small><b>${esc(d.name)}</b>${d.title ? `<small>ได้ฉายา「${esc(d.title)}」</small>` : ""}</div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("out"), 3600);
  setTimeout(() => el.remove(), 4300);
  if (!$("dailyPanel").hidden) room && room.send("achGet");
}

// =============================================================
//  ภูติ: หน้าต่างลูน่า (ผู้ผนึกภูติ) · เควสรับภูติ · อัประดับสี · ตัวติดตามเควสภูติ
//  (ใช้ตัวแปร room, gameData, INV, $ จาก game.js / items-ui.js)
// =============================================================
let spSel = null;
const SP_ORDER = ["sp_ember", "sp_spring", "sp_frost", "sp_thunder", "sp_lumi", "sp_shadow"];
const spOwned = (id) => (INV.spirit && INV.spirit.id === id) || (INV.inv || []).some((x) => x && x.id === id);

function openSpirit() {
  closeShop(); closeSmith(); closeJob();
  spSel = (INV.spq && INV.spq.id) || spSel || SP_ORDER[0];
  $("spiritPanel").hidden = false;
  renderSpirit();
}
function closeSpirit() { const p = $("spiritPanel"); if (p) p.hidden = true; }

function renderSpirit() {
  const panel = $("spiritPanel");
  if (!panel || panel.hidden || !gameData || !gameData.spirits) return;
  const me = myPlayer();
  if (!me) return;
  const S = gameData.spirits, Q = gameData.spiritQuests, spq = INV.spq;
  $("spiritTabs").innerHTML = SP_ORDER.map((id) => {
    const cls = ["sp-tab", id === spSel && "sel", spOwned(id) && "own", spq && spq.id === id && "active", me.level < S[id].lv && "lock"].filter(Boolean).join(" ");
    return `<button type="button" class="${cls}" data-id="${id}" style="--sc:${S[id].color}"><img src="${ICON(id)}" alt="">${S[id].name.split(" ")[0]}<br><small>Lv.${S[id].lv}</small></button>`;
  }).join("");
  $("spiritTabs").querySelectorAll("button").forEach((b) => (b.onclick = () => { spSel = b.dataset.id; renderSpirit(); }));

  const s = S[spSel], q = Q[spSel], k = s.skill, mul = gameData.spiritRarMul[1];
  const mob = gameData.mobs[q.kill[0]], item = itemOf(q.item[0]);
  const eff = [];
  if (k.mult) eff.push(`ดาเมจ ${Math.round(k.mult * mul * 100)}% ของพลังโจมตีเรา${k.chain ? ` · กระโดดได้ ${k.chain} ตัว` : ""}${k.slow ? ` · ทำให้ช้า ${k.slow / 1000} วิ` : ""}${k.drain ? ` · ดูดเป็น HP ${k.drain}%` : ""}`);
  if (k.healPct) eff.push(`ฟื้น HP ${(k.healPct * mul).toFixed(1)}%${k.spPct ? ` + SP ${(k.spPct * mul).toFixed(1)}%` : ""} เมื่อ HP ต่ำกว่า ${k.below}%${k.cleanse ? " · ล้างพิษ" : ""}`);
  const active = spq && spq.id === spSel, kills = active ? spq.kills : 0, have = countItem(q.item[0]);
  const row = (icon, txt, cur, need) => `<div class="qrow${active && cur >= need ? " ok" : ""}">${icon}<span>${txt}</span><b>${active ? `${Math.min(cur, need)}/${need}` : need}</b></div>`;
  let btns;
  if (spOwned(spSel)) btns = `<div class="job-done">✔ คุณมีภูติตัวนี้แล้ว</div>`;
  else if (me.level < s.lv) btns = `<div class="need">ต้องเลเวล ${s.lv} ขึ้นไป (ตอนนี้ Lv.${me.level})</div>`;
  else if (!spq) btns = `<button type="button" class="btn-gold" id="spStart">รับเควส${s.name}</button>`;
  else if (!active) btns = `<div class="job-note">กำลังทำเควส${S[spq.id].name}อยู่ — ส่งหรือยกเลิกก่อน</div>`;
  else {
    const done = kills >= q.kill[1] && have >= q.item[1];
    btns = `<button type="button" class="btn-gold" id="spFinish" ${done ? "" : "disabled"}>${done ? `ส่งเควส → รับ${s.name}` : "ยังทำไม่ครบ"}</button>
      <button type="button" class="btn-ghost danger" id="spCancel">ยกเลิกเควส</button>`;
  }
  $("spiritBody").innerHTML = `<div class="job-left"><img class="sp-big" src="${ICON(spSel)}" alt="" style="--sc:${s.color}">
      <div class="job-name" style="color:${s.color}">${s.name}<small>${s.role === "heal" ? "สายรักษา" : "สายโจมตี"}</small></div></div>
    <div class="job-info"><p>${s.desc}</p>
      <div class="sp-skill"><b>${k.name}</b> <small>ทุก ${k.every / 1000} วิ</small><br>${eff.join("<br>")} <small>(ค่าตอนได้รับ: ระดับดี Lv.1)</small></div>
      <div class="job-tags"><span>เลเวลสูงสุด ${gameData.spiritMaxLv}</span><span>ยิ่งเลเวลสูง/ระดับสีสูง ยิ่งแรง</span></div>
      <h4>เควส</h4><p class="story">“${q.story}”</p>
      ${row(`<i class="qi">⚔</i>`, `ปราบ${mob.name} (Lv.${mob.level}) · ${q.where}`, kills, q.kill[1])}
      ${row(`<img src="${ICON(q.item[0])}" alt="">`, `นำ${item.name}มา (มีอยู่ ${have})`, have, q.item[1])}
      <div class="qrow reward"><img src="${ICON(spSel)}" alt=""><span>รางวัล: ${s.name} (ระดับดี)</span></div>
      <div class="job-acts">${btns}</div></div>`;
  const go = (act) => room.send("spiritQuest", { act, id: spSel });
  if ($("spStart")) $("spStart").onclick = () => go("start");
  if ($("spFinish")) $("spFinish").onclick = () => go("finish");
  if ($("spCancel")) $("spCancel").onclick = async () => { if (await askConfirm("ยกเลิกเควสภูตินี้? (จำนวนที่ปราบไว้จะหายไป)", { okText: "ยกเลิก", danger: true })) go("cancel"); };

  // อัประดับสีภูติที่เรียกอยู่
  const cur = INV.spirit, up = $("spiritUp");
  if (!cur) { up.innerHTML = `<b>อัประดับภูติ</b><div class="job-note">เรียกภูติออกมาก่อน (ภูติที่อยู่ในช่องภูติจะอัปได้ที่นี่)</div>`; return; }
  const R = gameData.rarity, U = gameData.spiritUpgrade[cur.r], ci = itemOf(cur.id);
  if (!U) { up.innerHTML = `<b>อัประดับภูติ</b><div class="row"><img src="${ICON(cur.id)}" alt=""><span>${ci.name} <b style="color:${R[cur.r].color}">ระดับ${R[cur.r].name}</b> — ระดับสูงสุดแล้ว ✨</span></div>`; return; }
  const shards = countItem("spirit_shard"), ok = shards >= U.shards && INV.gold >= U.gold;
  const m0 = gameData.spiritRarMul[cur.r], m1 = gameData.spiritRarMul[cur.r + 1];
  up.innerHTML = `<b>อัประดับภูติ</b> <small class="muted">(สำเร็จแน่นอน · เลเวลภูติคงเดิม)</small>
    <div class="row"><img src="${ICON(cur.id)}" alt=""><span>${ci.name} Lv.${cur.lv}</span>
      <b style="color:${R[cur.r].color}">${R[cur.r].name}</b><span class="arrow">→</span><b style="color:${R[cur.r + 1].color}">${R[cur.r + 1].name}</b>
      <small>พลัง ×${m0} → ×${m1}</small></div>
    <div class="row"><img src="${ICON("spirit_shard")}" alt=""><span class="${shards >= U.shards ? "ok" : "need"}">ผลึกวิญญาณ ${shards}/${U.shards}</span>
      <span class="${INV.gold >= U.gold ? "" : "need"}">${U.gold.toLocaleString()} gold</span>
      <button type="button" class="btn-gold" id="spUp" ${ok ? "" : "disabled"}>อัประดับ</button></div>`;
  if ($("spUp")) $("spUp").onclick = async () => {
    if (await askConfirm(`อัป<b>${ci.name}</b> เป็นระดับ<b style="color:${R[cur.r + 1].color}">${R[cur.r + 1].name}</b>?<br><small>ใช้ผลึกวิญญาณ ${U.shards} ชิ้น + ${U.gold.toLocaleString()} gold</small>`, { okText: "อัประดับ" })) room.send("spiritUp", {});
  };
}

// ตัวติดตามเควสภูติ (มุมซ้าย ใต้เควสอาชีพ)
function renderSpiritTrack() {
  const el = $("spiritTrack");
  if (!el || !gameData || !gameData.spiritQuests) return;
  const q = INV.spq;
  if (!q) { el.hidden = true; return; }
  const Q = gameData.spiritQuests[q.id], S = gameData.spirits[q.id], have = countItem(Q.item[0]);
  const ok = (a, b) => (a >= b ? ' class="ok"' : "");
  el.hidden = false;
  el.innerHTML = `<b style="color:${S.color}">เควส${S.name}</b>
    <div${ok(q.kills, Q.kill[1])}>${gameData.mobs[Q.kill[0]].name} ${Math.min(q.kills, Q.kill[1])}/${Q.kill[1]}</div>
    <div${ok(have, Q.item[1])}>${itemOf(Q.item[0]).name} ${Math.min(have, Q.item[1])}/${Q.item[1]}</div>
    ${q.kills >= Q.kill[1] && have >= Q.item[1] ? `<div class="ok">✔ กลับไปหาลูน่าที่เมือง</div>` : ""}`;
}

(() => {
  const c = $("spiritClose");
  if (c) c.onclick = closeSpirit;
})();

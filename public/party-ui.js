// =============================================================
//  ปาร์ตี้: คลิกชื่อ/ตัวผู้เล่นอื่น → เมนูชวนเข้าปาร์ตี้ · กล่องสมาชิก (HP/SP) มุมซ้าย · /p แชทปาร์ตี้ · /invite ชื่อ
//  (ใช้ตัวแปร room, scene, $ จาก game.js / items-ui.js)
// =============================================================
let PARTY = null;
const partyNames = () => new Set(PARTY ? PARTY.members.map((m) => m.name) : []);

function onParty(d) {
  PARTY = d;
  renderParty();
  // สีชื่อเพื่อนในปาร์ตี้บนแผนที่ = เขียว
  if (scene && scene.views && scene.sys && scene.sys.isActive()) scene.views.forEach((v) => {
    if (!v.isMob && !v.isMe && v.label && v.label.scene && v.label.active) v.label.setColor(partyNames().has(v.e.name) ? "#7dff9a" : "#ffffff");
  });
}
function renderParty() {
  const el = $("partyBox");
  if (!el) return;
  if (!PARTY) { el.hidden = true; return; }
  const lead = PARTY.leader === PARTY.me, here = scene && scene.map && scene.map.name;
  el.hidden = false;
  el.innerHTML = `<div class="pt-head"><span>👥 ปาร์ตี้ (${PARTY.members.length}/6)</span><button type="button" id="ptLeave">ออก</button></div>` +
    PARTY.members.map((m) => {
      if (m.offline) return `<div class="pt-mem away"><div class="nm"><b>…</b><small>กำลังย้ายแผนที่</small></div></div>`;
      const hp = m.maxHp ? Math.round((m.hp * 100) / m.maxHp) : 0, sp = m.maxSp ? Math.round((m.sp * 100) / m.maxSp) : 0;
      const away = m.map !== here;
      return `<div class="pt-mem${m.cid === PARTY.me ? " me" : ""}${away ? " away" : ""}${m.dead ? " dead" : ""}">
        <div class="nm"><b>${m.cid === PARTY.leader ? "👑 " : ""}${esc(m.name)}</b><small>Lv.${m.level}${away ? " · " + esc(m.map) : ""}${lead && m.cid !== PARTY.me ? ` <button type="button" class="kick" data-cid="${m.cid}" title="เชิญออก">✕</button>` : ""}</small></div>
        <div class="pt-bar"><i style="width:${hp}%"></i></div><div class="pt-bar sp"><i style="width:${sp}%"></i></div></div>`;
    }).join("");
  $("ptLeave").onclick = async () => { if (await askConfirm("ออกจากปาร์ตี้?", { okText: "ออก", danger: true })) room.send("partyLeave"); };
  el.querySelectorAll(".kick").forEach((b) => (b.onclick = async () => {
    const m = PARTY.members.find((x) => x.cid === b.dataset.cid);
    if (await askConfirm(`เชิญ ${esc(m ? m.name : "")} ออกจากปาร์ตี้?`, { okText: "เชิญออก", danger: true })) room.send("partyKick", { cid: b.dataset.cid });
  }));
}
async function onPartyInvite(d) {
  const ok = await askConfirm(`👥 <b>${esc(d.name)}</b> (Lv.${d.level}) ชวนคุณเข้าปาร์ตี้<br><small>ในปาร์ตี้ EXP จากมอนจะแบ่งเท่ากันให้เพื่อนที่อยู่ใกล้ และได้โบนัส +10% ต่อสมาชิกที่เพิ่ม</small>`, { okText: "เข้าร่วม" });
  room.send("partyAnswer", { from: d.from, accept: !!ok });
}

// เมนูเมื่อคลิกผู้เล่นอื่น
function showPlayerMenu(sid, x, y) {
  const v = scene.views.get(sid), el = $("playerMenu");
  if (!v || !el) return;
  const inParty = PARTY && PARTY.members.some((m) => m.sid === sid);
  el.innerHTML = `<b>${esc(v.e.name)} <small>Lv.${v.e.level}</small></b>` +
    (inParty ? `<button type="button" class="btn-ghost" disabled>อยู่ในปาร์ตี้เดียวกัน</button>` : `<button type="button" class="btn-gold" id="pmInvite">👥 ชวนเข้าปาร์ตี้</button>`) +
    `<button type="button" class="btn-ghost" id="pmClose">ปิด</button>`;
  el.hidden = false;
  el.style.left = Math.min(window.innerWidth - 170, x + 8) + "px";
  el.style.top = Math.min(window.innerHeight - 120, y + 8) + "px";
  if ($("pmInvite")) $("pmInvite").onclick = () => { room.send("partyInvite", { sid }); el.hidden = true; };
  $("pmClose").onclick = () => (el.hidden = true);
}
document.addEventListener("pointerdown", (e) => { const el = $("playerMenu"); if (el && !el.hidden && !el.contains(e.target)) el.hidden = true; }, true);

// =============================================================
//  ดันเจี้ยนภูติ: แท็บในหน้าต่างลูน่า (เลือกธาตุ/ระดับ · ซื้อตั๋ว · เปิดดัน) · คำเชิญเพื่อนในปาร์ตี้
//  แถบสถานะในดัน (ระลอก/มอนที่เหลือ/เวลา) · หน้าต่างรางวัลตอนเคลียร์
//  (ใช้ตัวแปร room, gameData, INV, $ จาก game.js / items-ui.js / spirit-ui.js)
// =============================================================
let spMode = "spirit";            // แท็บในหน้าต่างลูน่า: spirit | dungeon
let dgEl = null, dgDiff = 0;      // ธาตุ/ระดับที่เลือก
const DG_ORDER = ["fire", "water", "ice", "thunder", "light", "shadow"];

// ปุ่มสลับแท็บด้านบนหน้าต่างลูน่า
function renderSpiritMode() {
  let bar = $("spModeBar");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "spModeBar"; bar.className = "sp-mode";
    $("spiritTabs").before(bar);
  }
  bar.innerHTML = `<button type="button" data-m="spirit" class="${spMode === "spirit" ? "sel" : ""}">✨ ภูติ · เควส · พัฒนา</button>
    <button type="button" data-m="dungeon" class="${spMode === "dungeon" ? "sel" : ""}">🌀 ดันเจี้ยนภูติ</button>`;
  bar.querySelectorAll("button").forEach((b) => (b.onclick = () => { spMode = b.dataset.m; renderSpirit(); }));
  const dg = spMode === "dungeon";
  $("spiritBody").classList.toggle("dg-mode", dg);
  $("spiritTabs").hidden = dg; $("spiritUp").hidden = dg;
  const note = $("spiritPanel").querySelector(".ap-note"); if (note) note.hidden = dg;
  return dg;
}

function renderDungeon() {
  const G = gameData && gameData.dungeon, me = myPlayer();
  if (!G || !me) return;
  const E = G.elements;
  if (!dgEl) dgEl = (INV.spirit && DG_ORDER.find((k) => E[k].spirit === INV.spirit.id)) || "fire";
  const tickets = countItem(G.ticket), Df = G.diffs[dgDiff], el = E[dgEl];
  const inParty = typeof PARTY !== "undefined" && PARTY && PARTY.members.length > 1, lead = !inParty || PARTY.leader === PARTY.me;
  const cards = DG_ORDER.map((k) => {
    const x = E[k], mine = INV.spirit && INV.spirit.id === x.spirit;
    return `<button type="button" class="dg-el${k === dgEl ? " sel" : ""}" data-el="${k}" style="--sc:${x.color}">
      <img src="${ICON(x.spirit)}" alt=""><b>ธาตุ${x.name}</b><small>${mine ? "★ ภูติของคุณ" : `${itemOf(x.core).name}`}</small></button>`;
  }).join("");
  const diffs = G.diffs.map((d, i) => {
    const lock = me.level < d.req;
    return `<button type="button" class="dg-diff${i === dgDiff ? " sel" : ""}${lock ? " lock" : ""}" data-d="${i}">
      <b>${d.name}</b><small>Lv.${d.req}+ · มอน Lv.${d.lv}</small><small>ตั๋ว ${d.tickets} ใบ</small></button>`;
  }).join("");
  const rw = (id, [a, b]) => (b > 0 ? `<span><img src="${ICON(id)}" alt="">${itemOf(id).name} ${a === b ? a : `${a}–${b}`}</span>` : "");
  const err = me.level < Df.req ? `ต้อง Lv.${Df.req} ขึ้นไป` : tickets < Df.tickets ? `ตั๋วไม่พอ (มี ${tickets}/${Df.tickets})` : !lead ? "หัวหน้าปาร์ตี้เป็นคนเปิดดัน" : "";
  $("spiritBody").innerHTML = `<div class="dg-wrap">
    <p class="dg-intro">ล้างมอน ${G.waves} ระลอก แล้วปราบผู้พิทักษ์ธาตุภายใน ${G.timeMin} นาที · ได้<b>แก่นธาตุ</b>ไว้ข้ามขีดจำกัดภูติธาตุเดียวกัน และผลึกวิญญาณไว้อัประดับสี
      ${inParty ? "· <b>หัวหน้าปาร์ตี้</b>เปิดดันแล้ว เพื่อนในปาร์ตี้ที่ออนไลน์และเลเวลถึงจะถูกพาเข้าดันด้วยทันที (หัวหน้าจ่ายตั๋วคนเดียว)" : "· ไปคนเดียวหรือชวนเพื่อนเข้าปาร์ตี้ก่อนก็ได้ (สูงสุด 6 คน)"}</p>
    <h4>เลือกธาตุ</h4><div class="dg-els">${cards}</div>
    <h4>ระดับความยาก</h4><div class="dg-diffs">${diffs}</div>
    <div class="dg-sum" style="--sc:${el.color}">
      <div><b>ธาตุ${el.name} · ${Df.name}</b> <small>บอส: ${el.boss}</small></div>
      <div class="dg-rw">รางวัลเมื่อเคลียร์ (ต่อคน): ${rw(el.core, Df.core)}${rw(el.pure, Df.pure)}${rw("spirit_shard", Df.shard)}<span><img src="/assets/icons/gold.png" alt="">${Df.gold.toLocaleString()} gold</span></div>
      <div class="dg-rw"><small>มอนในดันดรอปแก่นธาตุ${Df.pure[1] ? " / แก่นบริสุทธิ์" : ""} และผลึกวิญญาณเพิ่มด้วย</small></div>
    </div>
    <div class="dg-acts">
      <span class="dg-tk"><img src="${ICON(G.ticket)}" alt="">ตั๋วดันเจี้ยนภูติ <b>${tickets}</b></span>
      <button type="button" class="btn-ghost sm" id="dgBuy1">ซื้อ 1 ใบ (${G.ticketPrice.toLocaleString()})</button>
      <button type="button" class="btn-ghost sm" id="dgBuy5">ซื้อ 5 ใบ (${(G.ticketPrice * 5).toLocaleString()})</button>
      <button type="button" class="btn-gold" id="dgGo" ${err ? "disabled" : ""}>🌀 เข้าดันเจี้ยน</button>
      ${err ? `<small class="need">${err}</small>` : ""}
    </div></div>`;
  $("spiritBody").querySelectorAll(".dg-el").forEach((b) => (b.onclick = () => { dgEl = b.dataset.el; renderSpirit(); }));
  $("spiritBody").querySelectorAll(".dg-diff").forEach((b) => (b.onclick = () => { dgDiff = Number(b.dataset.d); renderSpirit(); }));
  $("dgBuy1").onclick = () => room.send("dungeonBuy", { n: 1 });
  $("dgBuy5").onclick = () => room.send("dungeonBuy", { n: 5 });
  $("dgGo").onclick = async () => {
    if (await askConfirm(`เข้า<b>ดันเจี้ยนภูติธาตุ${el.name} · ${Df.name}</b>?<br><small>ใช้ตั๋ว ${Df.tickets} ใบ${inParty ? " · เพื่อนในปาร์ตี้จะถูกพาเข้าดันด้วย" : ""}</small>`, { okText: "เข้าดัน" })) {
      room.send("dungeonStart", { el: dgEl, diff: dgDiff });
      closeSpirit();
    }
  };
}

// เพื่อนในปาร์ตี้เปิดดัน
async function onDungeonInvite(d) {
  const ok = await askConfirm(`🌀 <b>${esc(d.from)}</b> เปิด<b>${esc(d.name)}</b><br><small>ตามเข้าไปไหม? ใช้ตั๋ว ${d.tickets} ใบ · ต้อง Lv.${d.req}+</small>`, { okText: "เข้าดัน" });
  if (ok) room.send("dungeonJoin", { inst: d.inst });
}

// ---------- แถบสถานะในดัน ----------
function onDungeonState(s) {
  let el = $("dgHud");
  if (!el) { el = document.createElement("div"); el.id = "dgHud"; el.className = "frame"; document.body.appendChild(el); }
  el.hidden = false;
  const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const step = s.phase === "prep" ? `เริ่มใน ${Math.ceil(s.next / 1000)} วิ…`
    : s.phase === "wave" ? `ระลอก ${s.wave}/${s.waves} · เหลือ <b>${s.left}</b> ตัว`
    : s.phase === "break" ? (s.wave < s.waves ? `ระลอกถัดไปใน ${Math.ceil(s.next / 1000)} วิ` : `ผู้พิทักษ์กำลังมา…`)
    : s.phase === "boss" ? `⚠️ ${esc(s.boss)}`
    : s.phase === "clear" ? `🏆 เคลียร์แล้ว · กลับเมืองใน ${Math.ceil(s.next / 1000)} วิ`
    : s.phase === "fail" ? `❌ ล้มเหลว` : "รอผู้เล่น…";
  el.style.setProperty("--sc", s.color || "#9fc2ff");
  el.innerHTML = `<div class="dg-h"><b>🌀 ${esc(s.name)}</b><span class="dg-time${s.timeLeft < 60000 ? " urgent" : ""}">⏱ ${mmss(s.timeLeft)}</span></div>
    <div class="dg-step">${step}</div><button type="button" class="btn-ghost sm" id="dgLeave">ออกจากดัน</button>`;
  $("dgLeave").onclick = async () => { if (await askConfirm("ออกจากดันเจี้ยนกลับเมือง?<br><small>ตั๋วที่ใช้ไปแล้วไม่คืน</small>", { okText: "ออก", danger: true })) room.send("dungeonLeave"); };
}
function hideDungeonHud() { const el = $("dgHud"); if (el) el.hidden = true; }

// ---------- รางวัลตอนเคลียร์ ----------
function onDungeonClear(d) {
  const list = d.items.map(([id, n]) => `<div class="dg-get"><img src="${ICON(id)}" alt=""><span>${itemOf(id).name}</span><b>×${n}</b></div>`).join("")
    + `<div class="dg-get"><img src="/assets/icons/gold.png" alt=""><span>gold</span><b>+${d.gold.toLocaleString()}</b></div>`;
  askConfirm(`<div class="dg-clear"><h3>🏆 เคลียร์ดันเจี้ยนภูติ!</h3><small>${esc(d.name)} · ของเข้ากระเป๋าแล้ว</small>${list}</div>`, { okText: "เยี่ยม!", noCancel: true });
}

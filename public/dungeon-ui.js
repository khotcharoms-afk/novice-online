// =============================================================
//  ดันเจี้ยนภูติ: แท็บในหน้าต่างลูน่า (เลือกธาตุ/ระดับ · ซื้อตั๋ว · เปิดดัน) · คำเชิญเพื่อนในปาร์ตี้
//  แถบสถานะในดัน (ระลอก/มอนที่เหลือ/เวลา) · หน้าต่างรางวัลตอนเคลียร์
//  (ใช้ตัวแปร room, gameData, INV, $ จาก game.js / items-ui.js / spirit-ui.js)
// =============================================================
let spMode = "spirit";            // แท็บในหน้าต่างลูน่า: spirit | dungeon | rift
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
    <button type="button" data-m="dungeon" class="${spMode === "dungeon" ? "sel" : ""}">🌀 ดันเจี้ยนภูติ</button>
    <button type="button" data-m="rift" class="${spMode === "rift" ? "sel" : ""}">🔥 รอยแยกมิติ</button>`;
  bar.querySelectorAll("button").forEach((b) => (b.onclick = () => { spMode = b.dataset.m; renderSpirit(); }));
  const dg = spMode !== "spirit";
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
  if (s.rift) return riftHud(el, s);
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
  if (d.rift) { askConfirm(`<div class="dg-clear"><h3>🔥 ปิดรอยแยกสำเร็จ!</h3><small>${esc(d.name)} · ฆ่าไป ${d.kills} ตัว</small><div class="dg-get"><img src="/assets/icons/gold.png" alt=""><span>gold</span><b>+${d.gold.toLocaleString()}</b></div><small>ของดรอปจากผู้คุมอยู่บนพื้น รีบเก็บก่อนกลับเมือง!</small></div>`, { okText: "ลุยต่อ!", noCancel: true }); return; }
  const list = d.items.map(([id, n]) => `<div class="dg-get"><img src="${ICON(id)}" alt=""><span>${itemOf(id).name}</span><b>×${n}</b></div>`).join("")
    + `<div class="dg-get"><img src="/assets/icons/gold.png" alt=""><span>gold</span><b>+${d.gold.toLocaleString()}</b></div>`;
  askConfirm(`<div class="dg-clear"><h3>🏆 เคลียร์ดันเจี้ยนภูติ!</h3><small>${esc(d.name)} · ของเข้ากระเป๋าแล้ว</small>${list}</div>`, { okText: "เยี่ยม!", noCancel: true });
}

// =============================================================
//  รอยแยกมิติ (ดันฝูงมอน)
// =============================================================
let rfTier = null;
function renderRift() {
  const G = gameData && gameData.rift, me = myPlayer();
  if (!G || !me) return;
  if (rfTier == null) { const ok = G.tiers.filter((t) => me.level >= t.req); rfTier = ok.length ? ok[ok.length - 1].i : 0; }
  const T = G.tiers[rfTier];
  const inParty = typeof PARTY !== "undefined" && PARTY && PARTY.members.length > 1, lead = !inParty || PARTY.leader === PARTY.me;
  const size = inParty ? PARTY.members.length : 1, need = G.need + G.needPer * (size - 1);
  const gold = (INV && INV.gold) || 0;
  const list = G.tiers.map((t) => {
    const lock = me.level < t.req;
    return `<button type="button" class="dg-diff rf-tier${t.i === rfTier ? " sel" : ""}${lock ? " lock" : ""}" data-t="${t.i}">
      <b>${esc(t.name)}</b><small>Lv.${t.req}+ · มอน Lv.${t.lv}</small><small>${t.price.toLocaleString()} gold</small></button>`;
  }).join("");
  const err = me.level < T.req ? `ต้อง Lv.${T.req} ขึ้นไป` : gold < T.price ? "gold ไม่พอ" : !lead ? "หัวหน้าปาร์ตี้เป็นคนเปิด" : "";
  $("spiritBody").innerHTML = `<div class="dg-wrap rf-wrap">
    <p class="dg-intro">🔥 <b>ฝูงมอนทะลักออกมาไม่หยุด!</b> กวาดด้วยสกิลวงกว้างให้ได้ <b>${need}</b> ตัว เกจรอยแยกเต็มแล้ว<b>ผู้คุมรอยแยก</b>จะปรากฏ ปราบได้ = ของดรอประเบิด + gold
      · เวลา ${G.timeMin} นาที · ตายแล้วเกิดใหม่ในรอยแยกได้ ${G.lives} ครั้ง
      ${inParty ? "· <b>หัวหน้าปาร์ตี้</b>จ่ายคนเดียว เพื่อนที่ออนไลน์และเลเวลถึงถูกพาเข้าด้วย (มอนเยอะขึ้นตามจำนวนคน)" : ""}</p>
    <h4>เลือกระดับ (ฝูงมอนจากแผนที่)</h4><div class="dg-diffs rf-tiers">${list}</div>
    <div class="dg-sum" style="--sc:#ff6a3d">
      <div><b>${esc(T.name)}</b> <small>มอน Lv.${T.lv} · ${T.mobs.map(esc).join(", ")}</small></div>
      <div class="dg-rw">รางวัลเมื่อปิดรอยแยก (ต่อคน): <span><img src="/assets/icons/gold.png" alt="">${T.gold.toLocaleString()} gold</span> + ของดรอปจากผู้คุม ×5 + ของจากฝูงมอน</div>
    </div>
    <div class="dg-acts">
      <span class="dg-tk"><img src="/assets/icons/gold.png" alt="">ค่าเปิด <b>${T.price.toLocaleString()}</b></span>
      <button type="button" class="btn-gold" id="rfGo" ${err ? "disabled" : ""}>🔥 เปิดรอยแยก</button>
      ${err ? `<small class="need">${err}</small>` : ""}
    </div></div>`;
  $("spiritBody").querySelectorAll(".rf-tier").forEach((b) => (b.onclick = () => { rfTier = Number(b.dataset.t); renderSpirit(); }));
  $("rfGo").onclick = async () => {
    if (await askConfirm(`เปิด<b>รอยแยกมิติ · ${esc(T.name)}</b>?<br><small>ใช้ ${T.price.toLocaleString()} gold${inParty ? " · เพื่อนในปาร์ตี้จะถูกพาเข้าด้วย" : ""}</small>`, { okText: "เปิดรอยแยก" })) {
      room.send("riftStart", { tier: rfTier });
      closeSpirit();
    }
  };
}

function riftHud(el, s) {
  const mmss = (ms) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  const pct = Math.min(100, Math.round(((s.kills || 0) / (s.need || 1)) * 100));
  const step = s.phase === "prep" ? `รอยแยกจะเปิดใน ${Math.ceil(s.next / 1000)} วิ…`
    : s.phase === "wave" ? `ฆ่า <b>${s.kills}</b>/${s.need} · บนลาน ${s.left} ตัว`
    : s.phase === "boss" ? `⚠️ <b>ผู้คุมรอยแยก</b> ปรากฏตัว!`
    : s.phase === "clear" ? `🏆 ปิดรอยแยกแล้ว · กลับเมืองใน ${Math.ceil(s.next / 1000)} วิ`
    : s.phase === "fail" ? "❌ ล้มเหลว" : "รอผู้เล่น…";
  el.style.setProperty("--sc", s.color);
  el.innerHTML = `<div class="dg-h"><b>🔥 ${esc(s.name)}</b><span class="dg-time${s.timeLeft < 60000 ? " urgent" : ""}">⏱ ${mmss(s.timeLeft)}</span></div>
    <div class="rf-bar"><i style="width:${s.phase === "boss" || s.phase === "clear" ? 100 : pct}%"></i></div>
    <div class="dg-step">${step}</div><button type="button" class="btn-ghost sm" id="dgLeave">ออกจากรอยแยก</button>`;
  $("dgLeave").onclick = async () => { if (await askConfirm("ออกจากรอยแยกกลับเมือง?<br><small>ค่าเปิดไม่คืน</small>", { okText: "ออก", danger: true })) room.send("dungeonLeave"); };
}

// ฝูงใหม่ทะลักออกมา: วงรอยแยกสีส้มแดงหมุนแล้วหายไป
function riftFx(sc, d) {
  const wv = sc.cameras.main.worldView;
  if (d.x < wv.x - 300 || d.x > wv.right + 300 || d.y < wv.y - 300 || d.y > wv.bottom + 300) return;
  const ring = sc.add.ellipse(d.x, d.y, 30, 14, 0xff5a2a, 0.35).setStrokeStyle(3, 0xffa04a, 0.95).setDepth(-8000).setBlendMode(Phaser.BlendModes.ADD);
  const core = sc.add.ellipse(d.x, d.y, 16, 8, 0x2a0010, 0.85).setDepth(-7999);
  sc.tweens.add({ targets: ring, scaleX: 5, scaleY: 5, duration: 450, ease: "Back.easeOut" });
  sc.tweens.add({ targets: core, scaleX: 6, scaleY: 6, duration: 450, ease: "Back.easeOut" });
  sc.tweens.add({ targets: [ring, core], alpha: 0, delay: 900, duration: 700, onComplete: () => { ring.destroy(); core.destroy(); } });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, p = sc.add.image(d.x, d.y, "amb_glow").setTint(0xff7a3a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(d.y + 1);
    sc.tweens.add({ targets: p, x: d.x + Math.cos(a) * 80, y: d.y + Math.sin(a) * 40 - 20, alpha: 0, scale: 0.15, duration: 700, ease: "Quad.easeOut", onComplete: () => p.destroy() });
  }
}

// =============================================================
//  คลังเก็บของ (NPC แมกนัส) + เทรดระหว่างผู้เล่น
//  ระหว่างเปิดคลัง/เทรด: ดับเบิลคลิกของในกระเป๋า = ฝากเข้าคลัง / ใส่ในการแลก
//  (ใช้ตัวแปร room, INV, gameData, $ จาก game.js / items-ui.js)
// =============================================================
let STORE = null;        // { inv, gold, size }
let TRADE = null;        // { me, them } จากเซิร์ฟเวอร์
let tradeDraft = null;   // ของที่เราเลือกจะเสนอ { items: [{idx,n}], gold }

const storageOpen = () => $("storagePanel") && !$("storagePanel").hidden;
const tradeOpen = () => $("tradePanel") && !$("tradePanel").hidden;

// ช่องของแบบเดียวกับกระเป๋า
function slotHtml(s) {
  return s ? `<img src="${ICON(s.id)}" alt=""${refineGlow(s)}>${s.up ? `<span class="up">+${s.up}</span>` : ""}<span class="n">${s.n > 1 ? s.n : ""}</span>` : "";
}
async function askQty(s, verb) {
  if (!s || s.n <= 1) return 1;
  return await askConfirm(`${verb} <b>${esc(gearName(s))}</b> กี่ชิ้น?`, { okText: verb, max: s.n });
}

// ---------- คลัง ----------
function openStorage() {
  closeShop(); closeSmith();
  room.send("storageOpen");
}
function closeStorage() { const p = $("storagePanel"); if (p) p.hidden = true; }
function onStorage(d) {
  STORE = d;
  if (d.open) { $("storagePanel").hidden = false; toggleInv(true); }
  renderStorage();
}
function renderStorage() {
  if (!STORE || !storageOpen()) return;
  const grid = $("stGrid");
  if (grid.children.length !== STORE.size) {
    grid.innerHTML = "";
    for (let i = 0; i < STORE.size; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "inv-slot";
      b.onclick = (e) => { const s = STORE.inv[i]; if (s) openCard(s, { where: "storage", idx: i }, e); };
      b.ondblclick = () => storageTake(i);
      b.addEventListener("pointerenter", () => { const s = STORE.inv[i]; if (s && $("itemCard").hidden) showTip(gearName(s)); });
      b.addEventListener("pointerleave", hideTip);
      grid.appendChild(b);
    }
  }
  let used = 0;
  [...grid.children].forEach((b, i) => { const s = STORE.inv[i]; if (s) used++; b.innerHTML = slotHtml(s); applyFrame(b, s); });
  $("stCount").textContent = `${used}/${STORE.size}`;
  $("stGold").textContent = STORE.gold.toLocaleString();
}
async function storagePut(idx) { const s = INV.inv[idx]; const n = await askQty(s, "ฝาก"); if (n) room.send("storagePut", { idx, n }); }
async function storageTake(idx) { const s = STORE && STORE.inv[idx]; const n = await askQty(s, "ถอน"); if (n) room.send("storageTake", { idx, n }); }

// ---------- เทรด ----------
async function onTradeRequest(d) {
  const ok = await askConfirm(`🤝 <b>${esc(d.name)}</b> (Lv.${d.level}) ขอแลกเปลี่ยนของกับคุณ`, { okText: "แลกเปลี่ยน" });
  room.send("tradeAnswer", { from: d.from, accept: !!ok });
}
function onTrade(d) {
  const first = !TRADE;
  TRADE = d;
  if (first) { tradeDraft = { items: [], gold: 0 }; closeShop(); closeSmith(); closeStorage(); toggleInv(true); $("tradePanel").hidden = false; }
  renderTrade();
}
function onTradeClosed(d) {
  TRADE = null; tradeDraft = null;
  const p = $("tradePanel"); if (p) p.hidden = true;
  if (d && d.reason) toast(d.reason);
}
function sendOffer() { room.send("tradeOffer", tradeDraft); }
async function tradeAdd(idx) {
  if (!TRADE || TRADE.me.lock) return toast("ปลดล็อกก่อนถึงจะแก้ของได้");
  const s = INV.inv[idx];
  if (!s) return;
  if (tradeDraft.items.some((x) => x.idx === idx)) return;
  if (tradeDraft.items.length >= 8) return toast("ใส่ได้สูงสุด 8 ช่อง");
  const n = await askQty(s, "ใส่");
  if (!n) return;
  tradeDraft.items.push({ idx, n });
  sendOffer();
}
function renderTrade() {
  if (!TRADE || !tradeOpen()) return;
  const side = (o, mine) => {
    const cells = [];
    for (let i = 0; i < 8; i++) {
      const s = o.items[i];
      cells.push(`<button type="button" class="inv-slot${s ? " rr" : ""}" data-i="${i}" ${s ? `style="--rc:${(rarOf(s) || {}).color || "transparent"}"` : ""}>${slotHtml(s)}</button>`);
    }
    return `<div class="tr-side${o.lock ? " locked" : ""}${o.ok ? " ok" : ""}"><div class="tr-name">${esc(o.name)} ${o.ok ? "✅ ยืนยันแล้ว" : o.lock ? "🔒 ล็อกแล้ว" : ""}</div>
      <div class="tr-grid">${cells.join("")}</div>
      <div class="tr-gold"><img src="/assets/icons/gold.png" alt=""> ${mine && !o.lock ? `<input type="number" id="trGold" min="0" max="${INV.gold}" value="${o.gold}">` : `<b>${o.gold.toLocaleString()}</b>`} gold</div></div>`;
  };
  const me = TRADE.me, them = TRADE.them, both = me.lock && them.lock;
  $("trBody").innerHTML = side(me, true) + `<div class="tr-mid">⇄</div>` + side(them, false);
  $("trHint").textContent = me.ok ? "รออีกฝ่ายยืนยัน…" : both ? "ทั้งคู่ล็อกแล้ว — ตรวจของให้ดีแล้วกดยืนยัน" : me.lock ? "รออีกฝ่ายล็อก…" : "ดับเบิลคลิกของในกระเป๋าเพื่อใส่ · คลิกช่องของเราเพื่อเอาออก · ใส่ครบแล้วกดล็อก";
  $("trLock").textContent = me.lock ? "🔓 ปลดล็อก" : "🔒 ล็อก";
  $("trLock").disabled = me.ok;
  $("trOk").disabled = !both || me.ok;
  $("trBody").querySelectorAll(".tr-side")[0].querySelectorAll(".inv-slot").forEach((b, i) => (b.onclick = (e) => {
    const s = me.items[i]; if (!s) return;
    if (me.lock) return openCard(s, { where: "trade" }, e);
    tradeDraft.items = tradeDraft.items.filter((x) => x.idx !== s.idx); sendOffer();
  }));
  $("trBody").querySelectorAll(".tr-side")[1].querySelectorAll(".inv-slot").forEach((b, i) => (b.onclick = (e) => { const s = them.items[i]; if (s) openCard(s, { where: "trade" }, e); }));
  const g = $("trGold");
  if (g) g.onchange = () => { tradeDraft.gold = Math.max(0, Math.min(INV.gold, Math.floor(Number(g.value) || 0))); sendOffer(); };
}

(() => {
  if ($("stClose")) $("stClose").onclick = closeStorage;
  if ($("stSort")) $("stSort").onclick = () => room.send("storageSort");
  if ($("stPut")) $("stPut").onclick = () => { const n = Math.floor(Number($("stAmt").value) || 0); if (n > 0) room.send("storageGold", { n }); };
  if ($("stTake")) $("stTake").onclick = () => { const n = Math.floor(Number($("stAmt").value) || 0); if (n > 0) room.send("storageGold", { n: -n }); };
  if ($("trLock")) $("trLock").onclick = () => (TRADE ? room.send("tradeLock") : onTradeClosed({ reason: "การแลกเปลี่ยนจบไปแล้ว" }));
  if ($("trOk")) $("trOk").onclick = async () => { if (await askConfirm("ยืนยันการแลกเปลี่ยน?<br><small>ตรวจของและจำนวนเงินของทั้งสองฝ่ายให้แน่ใจ</small>", { okText: "ยืนยัน" })) room.send("tradeConfirm"); };
  // ยกเลิก/ปิด: ปิดหน้าต่างทันทีฝั่งเรา (แม้อีกฝ่ายหลุดไปแล้วและเซิร์ฟเวอร์ไม่ตอบ) แล้วค่อยบอกเซิร์ฟเวอร์
  const cancel = () => { try { room.send("tradeCancel"); } catch {} onTradeClosed(null); };
  if ($("trCancel")) $("trCancel").onclick = cancel;
  if ($("trClose")) $("trClose").onclick = cancel;
})();

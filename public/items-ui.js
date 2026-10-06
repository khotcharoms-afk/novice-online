// =============================================================
//  หน้าต่างไอเทม: กระเป๋า, อุปกรณ์ (ในหน้าตัวละคร), ช่องไอเทมลัด, ร้านค้า
//  (ใช้ตัวแปร room, scene, gameData, $ จาก game.js)
// =============================================================
let INV = { inv: [], equip: {}, gold: 0 };
let shopTab = "buy";
const ICON = (id) => `/assets/icons/${id}.png`;
const BAR_KEYS = ["q", "e", "r", "f", "z", "x", "v", "b"];
const DOLL_L = ["head", "face", "armor", "gloves", "acc1"];
const DOLL_R = ["weapon", "offhand", "cape", "shoes", "acc2"];
const TYPE_NAME = { equip: "อุปกรณ์", use: "ของใช้", material: "ของดรอป", pet: "สัตว์เลี้ยง" };
const BONUS_NAME = { atk: "พลังโจมตี", def: "ป้องกัน", str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", maxHp: "HP สูงสุด", maxSp: "SP สูงสุด" };
const itemOf = (id) => gameData && gameData.items[id];
const myPlayer = () => room && room.state.players.get(room.sessionId);

// ---------- รับข้อมูลกระเป๋าจากเซิร์ฟเวอร์ ----------
function onInv(v) {
  INV = { inv: v.inv, equip: v.equip, gold: v.gold, pet: v.pet || null };
  renderInv(); renderPaperDoll(); renderShop(); renderItemBar();
  hideCard();
}

// ---------- ลากวาง ----------
let dragData = null;
function makeDraggable(el, data) {
  el.draggable = true;
  el.addEventListener("dragstart", (e) => { dragData = data; e.dataTransfer.setData("text/plain", JSON.stringify(data)); hideCard(); });
  el.addEventListener("dragend", () => (dragData = null));
}
function makeDrop(el, accept, onDrop) {
  el.addEventListener("dragover", (e) => { if (dragData && accept(dragData)) { e.preventDefault(); el.classList.add("over"); } });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => { e.preventDefault(); el.classList.remove("over"); if (dragData && accept(dragData)) onDrop(dragData); });
}

// ---------- กระเป๋า ----------
function renderInv() {
  const grid = $("invGrid");
  if (!grid || !gameData) return;
  const size = gameData.invSize || 40;
  if (grid.children.length !== size) {
    grid.innerHTML = "";
    for (let i = 0; i < size; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "inv-slot"; b.dataset.idx = i;
      b.onclick = (e) => { const s = INV.inv[i]; if (s) openCard(s.id, { where: "inv", idx: i }, e); };
      b.ondblclick = () => quickUse(i);
      makeDraggable(b, { from: "inv", idx: i });
      makeDrop(b, (d) => d.from === "inv" || d.from === "eq", (d) => {
        if (d.from === "inv") room.send("moveItem", { from: d.idx, to: i });
        else room.send("unequip", { slot: d.slot });
      });
      b.addEventListener("pointerenter", () => { const s = INV.inv[i]; if (s && $("itemCard").hidden) showTip(itemOf(s.id)?.name || s.id); });
      b.addEventListener("pointerleave", hideTip);
      grid.appendChild(b);
    }
  }
  let used = 0;
  [...grid.children].forEach((b, i) => {
    const s = INV.inv[i];
    b.draggable = !!s;
    if (s) used++;
    b.innerHTML = s ? `<img src="${ICON(s.id)}" alt=""><span class="n">${s.n > 1 ? s.n : ""}</span>` : "";
    b.setAttribute("aria-label", s ? `${itemOf(s.id)?.name || s.id} ×${s.n}` : "ช่องว่าง");
  });
  $("goldTxt").textContent = INV.gold.toLocaleString();
  $("invCount").textContent = `${used}/${size}`;
}
function quickUse(idx) {
  const s = INV.inv[idx];
  if (!s) return;
  const it = itemOf(s.id);
  if (!$("shopPanel").hidden && shopTab === "sell") return room.send("sell", { idx, n: s.n });
  if (it && it.type === "equip") room.send("equip", { idx });
  else if (it && it.type === "pet") room.send("useItem", { idx });
  else if (it && it.type === "use") room.send("useItem", { idx });
}
function toggleInv(force) {
  const p = $("invPanel"), open = force ?? p.hidden;
  p.hidden = !open;
  if (open) renderInv();
  else hideCard();
}

// ---------- อุปกรณ์ (ในหน้าตัวละคร) ----------
function renderPaperDoll() {
  if (!gameData || !$("dollL")) return;
  const build = (col, slots) => {
    col.innerHTML = "";
    for (const slot of slots) {
      const id = INV.equip[slot], it = itemOf(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "eq-slot" + (id ? " filled" : "");
      b.innerHTML = id ? `<img src="${ICON(id)}" alt=""><span>${it ? it.name : id}</span>` : `<span>${gameData.slotName[slot]}</span>`;
      b.onclick = (e) => { if (id) openCard(id, { where: "eq", slot }, e); };
      b.ondblclick = () => id && room.send("unequip", { slot });
      if (id) makeDraggable(b, { from: "eq", slot });
      makeDrop(b, (d) => d.from === "inv" && fits(INV.inv[d.idx], slot), (d) => room.send("equip", { idx: d.idx, slot }));
      col.appendChild(b);
    }
  };
  build($("dollL"), DOLL_L);
  build($("dollR"), DOLL_R);
  // ช่องสัตว์เลี้ยง (ใต้รูปตัวละคร)
  const pb = $("dollPet");
  if (pb) {
    const id = INV.pet, it = itemOf(id);
    pb.innerHTML = "";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "eq-slot" + (id ? " filled" : "");
    b.innerHTML = id ? `<img src="${ICON(id)}" alt=""><span>${it ? it.name : id}</span>` : `<span>สัตว์เลี้ยง</span>`;
    b.title = id ? "สัตว์เลี้ยงกำลังช่วยเก็บของ" : "ซื้อสัตว์เลี้ยงที่ร้านลุงสมปอง แล้วดับเบิลคลิกเพื่อเรียกออกมา";
    b.onclick = (e) => { if (id) openCard(id, { where: "pet" }, e); };
    b.ondblclick = () => id && room.send("petOff");
    makeDrop(b, (d) => d.from === "inv" && itemOf(INV.inv[d.idx]?.id)?.type === "pet", (d) => room.send("useItem", { idx: d.idx }));
    pb.appendChild(b);
  }
  drawDoll();
}
function fits(s, slot) {
  const it = s && itemOf(s.id);
  return it && it.type === "equip" && (it.slot === slot || (it.slot === "acc" && (slot === "acc1" || slot === "acc2")));
}
function drawDoll() {
  const v = scene && scene.views && scene.views.get(room.sessionId);
  const cv = $("dollCanvas");
  if (!v || !cv) return;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  ctx.drawImage(scene.textures.get(v.key).getSourceImage(), 0, 2 * 64, 64, 64, 0, 0, 64, 64);
}

// ---------- การ์ดรายละเอียดไอเทม ----------
function openCard(id, ctx, ev) {
  const it = itemOf(id), card = $("itemCard"), me = myPlayer();
  if (!it) return;
  hideTip();
  const lines = [];
  for (const [k, v] of Object.entries(it.bonus || {})) lines.push(`<li>${BONUS_NAME[k] || k} +${v}</li>`);
  if (it.pet) lines.push(`<li>ระยะเก็บของ ${Math.round(it.pet.range / 32)} ช่อง</li>`, `<li>ความเร็วบิน ${Math.round(it.pet.speed / 1.7)}%</li>`);
  const slotTxt = it.type === "equip" ? ` · ${it.slot === "acc" ? "เครื่องประดับ" : gameData.slotName[it.slot]}` : "";
  const need = it.lv && me && me.level < it.lv ? `<div class="need">ต้องเลเวล ${it.lv}</div>` : it.lv ? `<div class="meta">เลเวล ${it.lv} ขึ้นไป</div>` : "";
  const sell = it.sell ?? Math.floor((it.price || 0) / 2);
  const acts = [];
  if (ctx.where === "inv") {
    if (it.type === "equip") acts.push(`<button class="btn-gold" data-a="equip">สวม</button>`);
    if (it.type === "use") acts.push(`<button class="btn-gold" data-a="use">ใช้</button>`, `<button class="btn-ghost" data-a="bar">ใส่ช่องลัด</button>`);
    if (it.type === "pet") acts.push(`<button class="btn-gold" data-a="use">เรียกออกมา</button>`);
    if (!$("shopPanel").hidden) acts.push(`<button class="btn-ghost" data-a="sell">ขาย (${sell * INV.inv[ctx.idx].n} g)</button>`);
  } else if (ctx.where === "eq") acts.push(`<button class="btn-ghost" data-a="unequip">ถอด</button>`);
  else if (ctx.where === "pet") acts.push(`<button class="btn-ghost" data-a="petOff">เก็บกลับเข้ากระเป๋า</button>`);
  card.innerHTML = `<h4>${it.name}</h4><div class="meta">${TYPE_NAME[it.type] || ""}${slotTxt}</div>${need}` +
    (lines.length ? `<ul>${lines.join("")}</ul>` : "") + (it.desc ? `<div>${it.desc}</div>` : "") +
    `<div class="meta">ขายได้ ${sell} gold</div><div class="acts">${acts.join("")}</div>`;
  card.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    const a = b.dataset.a;
    if (a === "equip") room.send("equip", { idx: ctx.idx });
    if (a === "use") room.send("useItem", { idx: ctx.idx });
    if (a === "unequip") room.send("unequip", { slot: ctx.slot });
    if (a === "sell") room.send("sell", { idx: ctx.idx, n: INV.inv[ctx.idx].n });
    if (a === "bar") assignBar(id);
    if (a === "petOff") room.send("petOff");
    hideCard();
  }));
  card.hidden = false;
  const r = card.getBoundingClientRect();
  const x = Math.min(window.innerWidth - r.width - 8, Math.max(8, ev.clientX + 12));
  const y = Math.min(window.innerHeight - r.height - 8, Math.max(8, ev.clientY - 10));
  card.style.left = x + "px"; card.style.top = y + "px";
}
function hideCard() { const c = $("itemCard"); if (c) c.hidden = true; }
document.addEventListener("pointerdown", (e) => {
  const c = $("itemCard");
  if (c && !c.hidden && !c.contains(e.target) && !e.target.closest(".inv-slot,.eq-slot")) hideCard();
});

// ---------- ทิปเล็ก ๆ ตามเมาส์ ----------
let mouse = { x: 0, y: 0 };
document.addEventListener("pointermove", (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  const t = $("tip");
  if (t && !t.hidden) { t.style.left = mouse.x + 14 + "px"; t.style.top = mouse.y + 14 + "px"; }
});
function showTip(text) { const t = $("tip"); if (!t) return; t.textContent = text; t.hidden = false; t.style.left = mouse.x + 14 + "px"; t.style.top = mouse.y + 14 + "px"; }
function hideTip() { const t = $("tip"); if (t) t.hidden = true; }

// ---------- ช่องไอเทมลัด (Q E R F Z X V B) ----------
const barStoreKey = () => "pn_bar_" + (myPlayer()?.name || "");
const getBar = () => { try { return JSON.parse(localStorage.getItem(barStoreKey()) || "[]"); } catch { return []; } };
const setBar = (b) => { try { localStorage.setItem(barStoreKey(), JSON.stringify(b)); } catch {} renderItemBar(); };
function assignBar(id, at) {
  const bar = getBar();
  let i = at ?? bar.findIndex((x) => !x);
  if (i < 0 || i === undefined) i = 0;
  for (let k = 0; k < 8; k++) if (bar[k] === id) bar[k] = null;
  bar[i] = id;
  setBar(bar);
}
function useBar(i) {
  const id = getBar()[i];
  if (!id) return;
  const idx = INV.inv.findIndex((s) => s && s.id === id);
  if (idx >= 0) room.send("useItem", { idx });
  else toast(`${itemOf(id)?.name || id} หมดแล้ว`);
}
function renderItemBar() {
  const bar = $("itemBar");
  if (!bar || !gameData) return;
  const ids = getBar();
  if (bar.children.length !== 8 || !bar.dataset.ready) {
    bar.innerHTML = ""; bar.dataset.ready = "1";
    for (let i = 0; i < 8; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      s.title = `ช่องไอเทม (${BAR_KEYS[i].toUpperCase()}) — ลากยาจากกระเป๋ามาวาง · คลิกขวาเพื่อเอาออก`;
      s.onclick = () => useBar(i);
      s.oncontextmenu = (e) => { e.preventDefault(); const b = getBar(); b[i] = null; setBar(b); };
      makeDrop(s, (d) => d.from === "inv" && itemOf(INV.inv[d.idx]?.id)?.type === "use", (d) => assignBar(INV.inv[d.idx].id, i));
      bar.appendChild(s);
    }
  }
  [...bar.children].forEach((s, i) => {
    const id = ids[i];
    const n = id ? INV.inv.reduce((t, x) => t + (x && x.id === id ? x.n : 0), 0) : 0;
    s.classList.toggle("empty-stock", !!id && n === 0);
    s.innerHTML = `<span class="k">${BAR_KEYS[i].toUpperCase()}</span>` + (id ? `<img src="${ICON(id)}" alt=""><span class="n">${n}</span>` : "");
  });
}

// ---------- ร้านค้า ----------
function openShop() { $("shopPanel").hidden = false; shopTab = "buy"; setShopTab(); toggleInv(true); }
function closeShop() { $("shopPanel").hidden = true; hideCard(); }
function setShopTab() {
  document.querySelectorAll("[data-shop]").forEach((t) => t.classList.toggle("active", t.dataset.shop === shopTab));
  $("sellJunk").hidden = shopTab !== "sell";
  renderShop();
}
function renderShop() {
  if ($("shopPanel").hidden || !gameData) return;
  $("shopGold").textContent = INV.gold.toLocaleString();
  const list = $("shopList");
  list.innerHTML = "";
  if (shopTab === "buy") {
    for (const id of gameData.shop) {
      const it = itemOf(id);
      const row = document.createElement("div");
      row.className = "shop-row";
      const sub = it.desc || Object.entries(it.bonus || {}).map(([k, v]) => `${BONUS_NAME[k]} +${v}`).join(", ");
      row.innerHTML = `<img src="${ICON(id)}" alt=""><div>${it.name}<small>${sub}${it.lv > 1 ? ` · Lv.${it.lv}` : ""}</small></div>` +
        `<span class="price">${it.price} g</span><span>` +
        `<button class="btn-gold" data-n="1" ${INV.gold < it.price ? "disabled" : ""}>ซื้อ</button>` +
        (it.type === "use" ? ` <button class="btn-ghost" data-n="10" ${INV.gold < it.price * 10 ? "disabled" : ""}>×10</button>` : "") + `</span>`;
      row.querySelectorAll("button").forEach((b) => (b.onclick = () => room.send("buy", { id, n: Number(b.dataset.n) })));
      list.appendChild(row);
    }
  } else {
    INV.inv.forEach((s, idx) => {
      if (!s) return;
      const it = itemOf(s.id);
      const each = it.sell ?? Math.floor((it.price || 0) / 2);
      const row = document.createElement("div");
      row.className = "shop-row";
      row.innerHTML = `<img src="${ICON(s.id)}" alt=""><div>${it.name}${s.n > 1 ? " ×" + s.n : ""}<small>${TYPE_NAME[it.type]}</small></div>` +
        `<span class="price">${each * s.n} g</span><span><button class="btn-ghost">ขาย</button></span>`;
      row.querySelector("button").onclick = () => room.send("sell", { idx, n: s.n });
      list.appendChild(row);
    });
    if (!list.children.length) list.innerHTML = `<p class="ap-note">กระเป๋าว่าง</p>`;
  }
}

// ---------- ผูกปุ่ม (เรียกหลังโหลดแผนที่) ----------
function setupItemsUI() {
  $("invBtn").onclick = () => toggleInv();
  $("invClose").onclick = () => toggleInv(false);
  $("shopClose").onclick = closeShop;
  document.querySelectorAll("[data-shop]").forEach((t) => (t.onclick = () => { shopTab = t.dataset.shop; setShopTab(); }));
  $("sellJunk").onclick = () => {
    // ขายของดรอปทั้งหมด (เรียงจากช่องท้ายสุด เพื่อไม่ให้ลำดับช่องเลื่อน)
    INV.inv.map((s, i) => [s, i]).filter(([s]) => s && itemOf(s.id)?.type === "material").reverse()
      .forEach(([s, i]) => room.send("sell", { idx: i, n: s.n }));
  };
  $("apLoot").checked = autoCfg.loot !== false;
  $("apPotion").checked = autoCfg.potion !== false;
  $("apLoot").onchange = (e) => { autoCfg.loot = e.target.checked; sendAutoCfg(); };
  $("apPotion").onchange = (e) => { autoCfg.potion = e.target.checked; $("apPct").disabled = !e.target.checked; sendAutoCfg(); };
  $("apPct").value = autoCfg.potionPct;
  $("apPct").disabled = autoCfg.potion === false;
  $("apPctTxt").textContent = autoCfg.potionPct + "%";
  $("apPct").oninput = (e) => { $("apPctTxt").textContent = e.target.value + "%"; };
  $("apPct").onchange = (e) => { autoCfg.potionPct = Number(e.target.value); sendAutoCfg(); };
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === $("chatInput") || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "i") toggleInv();
    const bi = BAR_KEYS.indexOf(k);
    if (bi >= 0) useBar(bi);
    if (k === "escape") { hideCard(); closeShop(); toggleInv(false); }
  });
  // เดินออกห่างร้าน → ปิดร้าน
  setInterval(() => {
    if ($("shopPanel").hidden || !gameData) return;
    const me = myPlayer(), n = gameData.npcs.find((x) => x.id === "merchant");
    if (me && n && Math.hypot(me.x - n.x, me.y - n.y) > 200) closeShop();
  }, 500);
  renderInv(); renderPaperDoll(); renderItemBar();
}

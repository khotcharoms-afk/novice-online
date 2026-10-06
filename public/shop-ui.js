// =============================================================
//  ร้านค้า (ซื้อ / ขาย แบบตะกร้า) — ใช้ตัวแปร INV, gameData, room, itemOf ฯลฯ จาก items-ui.js
// =============================================================
let shopTab = "buy", shopCat = "all";
const buyCart = new Map();  // id -> จำนวน
const sellCart = new Map(); // ช่องกระเป๋า idx -> { id, n }

const ARMOR_SLOTS = ["head", "face", "armor", "gloves", "cape", "shoes", "offhand"];
const isCrystal = (id) => /^stone_/.test(id);
const SHOP_CATS = [
  ["all", "ทั้งหมด", () => true],
  ["weapon", "อาวุธ", (it) => it.type === "equip" && it.slot === "weapon"],
  ["armor", "ชุดเกราะ", (it) => it.type === "equip" && ARMOR_SLOTS.includes(it.slot)],
  ["acc", "เครื่องประดับ", (it) => it.type === "equip" && it.slot === "acc"],
  ["use", "ใช้ได้", (it) => it.type === "use"],
  ["pet", "สัตว์เลี้ยง", (it) => it.type === "pet"],
  ["crystal", "คริสตัลตีบวก", (it, id) => isCrystal(id)],
  ["mat", "วัตถุดิบ", (it, id) => it.type === "material" && !isCrystal(id)],
];
const catOk = (cat, id) => { const c = SHOP_CATS.find((x) => x[0] === cat); const it = itemOf(id); return !!(c && it && c[2](it, id)); };
const priceOf = (s) => s.sell ?? itemOf(s.id).sell ?? Math.floor((itemOf(s.id).price || 0) / 2);
const g = (n) => `${Number(n).toLocaleString()} gold`;

function openShop() { $("shopPanel").hidden = false; shopTab = "buy"; shopCat = "all"; renderShop(); }
function closeShop() { $("shopPanel").hidden = true; hideCard(); }

// รายการที่แสดงในแท็บปัจจุบัน
function shopEntries() {
  if (shopTab === "buy") return gameData.shop.map((id) => ({ id, it: itemOf(id) }));
  const out = [];
  INV.inv.forEach((s, idx) => {
    if (!s) return;
    const inCart = (sellCart.get(idx) || {}).n || 0;
    out.push({ id: s.id, it: itemOf(s.id), s, idx, left: s.n - inCart });
  });
  return out;
}

function renderShop() {
  if (!$("shopPanel") || $("shopPanel").hidden || !gameData) return;
  pruneSellCart();
  $("shopGold").textContent = INV.gold.toLocaleString();
  document.querySelectorAll(".shop-mode").forEach((b) => b.classList.toggle("active", b.dataset.shop === shopTab));
  const all = shopEntries();
  // หมวดหมู่ + จำนวน
  $("shopCats").innerHTML = SHOP_CATS.map(([k, name]) => {
    const n = all.filter((e) => catOk(k, e.id)).length;
    return `<button type="button" class="cat${k === shopCat ? " active" : ""}${n ? "" : " empty"}" data-cat="${k}">${name} <span>${n}</span></button>`;
  }).join("");
  $("shopCats").querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => { shopCat = b.dataset.cat; renderShop(); }));
  // ปุ่มใส่วัตถุดิบทั้งหมด (เฉพาะแท็บขาย)
  const mats = shopTab === "sell" ? all.filter((e) => catOk("mat", e.id) && e.left > 0) : [];
  const bulk = $("shopBulk");
  bulk.hidden = !mats.length;
  if (mats.length) {
    bulk.textContent = `ใส่วัตถุดิบทั้งหมดลงตะกร้า (${mats.length} รายการ · ${g(mats.reduce((t, e) => t + priceOf(e.s) * e.left, 0))})`;
    bulk.onclick = () => { mats.forEach((e) => addSell(e.idx, e.left, true)); renderShop(); };
  }
  // รายการสินค้า
  const list = $("shopList");
  const rows = all.filter((e) => catOk(shopCat, e.id));
  list.innerHTML = rows.length ? "" : `<p class="shop-empty">${shopTab === "buy" ? "ไม่มีสินค้าในหมวดนี้" : "ไม่มีของในหมวดนี้"}</p>`;
  for (const e of rows) list.appendChild(shopTab === "buy" ? buyRow(e) : sellRow(e));
  renderCart();
}

function rowShell(id, frameSrc) {
  const row = document.createElement("div");
  row.className = "shop-row";
  const ic = document.createElement("span");
  ic.className = "ic";
  ic.innerHTML = `<img src="${ICON(id)}" alt="">`;
  applyFrame(ic, frameSrc);
  row.appendChild(ic);
  return row;
}
function buyRow({ id, it }) {
  const row = rowShell(id, { id });
  const sub = it.desc || Object.entries(it.bonus || {}).map(([k, v]) => `${BONUS_NAME[k] || k} +${v}`).join(", ");
  const me = myPlayer(), lvBad = it.lv > 1 && me && me.level < it.lv;
  const stack = it.type === "use" || it.type === "material";
  row.insertAdjacentHTML("beforeend", `<div class="nm"><b>${it.name}</b><small>${sub}${it.lv > 1 ? ` · <span class="${lvBad ? "bad" : ""}">Lv.${it.lv}</span>` : ""}</small></div>
    <span class="price">${g(it.price)}</span>
    <span class="btns">${stack ? `<button type="button" class="btn-gold sm" data-n="10">×10</button>` : ""}<button type="button" class="btn-gold sm plus" data-n="1" aria-label="ใส่ตะกร้า">+</button></span>`);
  row.querySelectorAll("button").forEach((b) => (b.onclick = () => { buyCart.set(id, Math.min(999, (buyCart.get(id) || 0) + Number(b.dataset.n))); renderShop(); }));
  row.querySelector(".nm").onclick = (ev) => openCard({ id }, { where: "shop" }, ev);
  return row;
}
function sellRow({ id, it, s, idx, left }) {
  const row = rowShell(id, s);
  const r = rarOf(s);
  const badge = (r && s.r > 0 ? `<em class="tag" style="--rc:${r.color}">${r.name}</em>` : "") + (s.up ? `<em class="tag up">+${s.up}</em>` : "");
  row.insertAdjacentHTML("beforeend", `<div class="nm"><b>${nameHtml(s)}</b><small>มี ${left}${left !== s.n ? ` (ในตะกร้า ${s.n - left})` : ""} ${badge}</small></div>
    <span class="price">${g(priceOf(s))}</span>
    <span class="btns">${left > 1 ? `<button type="button" class="btn-gold sm" data-n="${left}">ทั้งหมด</button>` : ""}<button type="button" class="btn-gold sm plus" data-n="1" ${left > 0 ? "" : "disabled"} aria-label="ใส่ตะกร้า">+</button></span>`);
  row.querySelectorAll("button").forEach((b) => (b.onclick = () => addSell(idx, Number(b.dataset.n))));
  row.querySelector(".nm").onclick = (ev) => openCard(s, { where: "shop" }, ev);
  if (left <= 0) row.classList.add("done");
  return row;
}

// ใส่ของจากกระเป๋าลงตะกร้าขาย
function addSell(idx, n, quiet) {
  const s = INV.inv[idx];
  if (!s) return;
  if ($("shopPanel").hidden) return;
  shopTab = "sell";
  const cur = sellCart.get(idx);
  const have = cur && cur.id === s.id ? cur.n : 0;
  sellCart.set(idx, { id: s.id, n: Math.min(s.n, have + n) });
  if (!quiet) renderShop();
}
// ของในกระเป๋าเปลี่ยน (ขาย/ใช้/ย้าย) → ตัดของในตะกร้าที่ไม่ตรงออก
function pruneSellCart() {
  for (const [idx, c] of sellCart) {
    const s = INV.inv[idx];
    if (!s || s.id !== c.id) sellCart.delete(idx);
    else if (c.n > s.n) c.n = s.n;
  }
}

function renderCart() {
  const buying = shopTab === "buy";
  $("cartTitle").textContent = buying ? "ตะกร้าซื้อ" : "ตะกร้าขาย";
  $("cartTotalLbl").textContent = buying ? "ต้องจ่าย" : "ได้รับ";
  const items = buying
    ? [...buyCart].map(([id, n]) => ({ key: id, s: { id }, n, each: itemOf(id).price }))
    : [...sellCart].map(([idx, c]) => ({ key: idx, s: INV.inv[idx], n: c.n, each: priceOf(INV.inv[idx]) }));
  const total = items.reduce((t, x) => t + x.each * x.n, 0);
  $("cartCount").textContent = `${items.length} รายการ`;
  $("cartClear").hidden = !items.length;
  $("cartList").innerHTML = items.length ? "" : `<p class="shop-empty">กด + ที่ไอเทมเพื่อใส่ตะกร้า</p>`;
  for (const x of items) {
    const row = document.createElement("div");
    row.className = "cart-row";
    const max = buying ? 999 : x.s.n;
    row.innerHTML = `<img src="${ICON(x.s.id)}" alt=""><div class="nm">${buying ? itemOf(x.s.id).name : nameHtml(x.s)}<small>${g(x.each * x.n)}</small></div>
      <span class="qty"><button type="button" data-d="-1" aria-label="ลด">−</button><b>${x.n}</b><button type="button" data-d="1" ${x.n >= max ? "disabled" : ""} aria-label="เพิ่ม">+</button></span>
      <button type="button" class="rm" aria-label="เอาออก">✕</button>`;
    const set = (n) => {
      if (buying) { if (n <= 0) buyCart.delete(x.key); else buyCart.set(x.key, Math.min(max, n)); }
      else if (n <= 0) sellCart.delete(x.key); else sellCart.set(x.key, { id: x.s.id, n: Math.min(max, n) });
      renderShop();
    };
    row.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => set(x.n + Number(b.dataset.d))));
    row.querySelector(".rm").onclick = () => set(0);
    $("cartList").appendChild(row);
  }
  const short = buying && total > INV.gold;
  $("cartTotal").textContent = g(total);
  $("cartTotal").classList.toggle("bad", short);
  const go = $("cartGo");
  go.textContent = short ? "gold ไม่พอ" : buying ? "ตรวจสอบและซื้อ" : "ตรวจสอบและขาย";
  go.disabled = !items.length || short;
  go.onclick = () => checkout(buying, items, total);
}

async function checkout(buying, items, total) {
  const lines = items.map((x) => `<li>${buying ? itemOf(x.s.id).name : nameHtml(x.s)} ×${x.n} <span class="muted">${g(x.each * x.n)}</span></li>`).join("");
  const rare = buying ? [] : items.filter((x) => precious(x.s));
  const warn = rare.length ? `<p class="bad">มีของมีค่า ${rare.length} ชิ้น (ระดับหายากขึ้นไป/ตีบวกแล้ว) — ขายแล้วซื้อคืนไม่ได้</p>` : "";
  const ok = await askConfirm(`<b>${buying ? "ยืนยันการซื้อ" : "ยืนยันการขาย"}</b><ul class="cb-list">${lines}</ul>${warn}
    <div class="cb-total">${buying ? "จ่าย" : "ได้รับ"} <b>${g(total)}</b></div>`, { okText: buying ? "ซื้อ" : "ขาย", danger: rare.length > 0 });
  if (!ok) return;
  if (buying) room.send("buyMany", { items: items.map((x) => ({ id: x.key, n: x.n })) });
  else room.send("sellMany", { items: items.map((x) => ({ idx: x.key, id: x.s.id, n: x.n })) });
}

function setupShop() {
  $("shopClose").onclick = closeShop;
  document.querySelectorAll(".shop-mode").forEach((b) => (b.onclick = () => { shopTab = b.dataset.shop; shopCat = "all"; renderShop(); }));
  $("cartClear").onclick = () => { (shopTab === "buy" ? buyCart : sellCart).clear(); renderShop(); };
  room.onMessage("sold", () => { sellCart.clear(); renderShop(); });
  room.onMessage("bought", () => { buyCart.clear(); renderShop(); });
}

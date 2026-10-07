const JOBS_ADMIN = { villager: "ชาวบ้าน", guardian: "ผู้พิทักษ์", slayer: "นักดาบใหญ่", hunter: "นักล่า", mage: "นักเวทย์", healer: "หมอ" };
// =============================================================
//  เมนูแอดมิน — ใช้ได้เฉพาะ ID ที่ตั้งไว้ใน ADMIN_IDS บน Render
// =============================================================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();
const when = (t) => (t ? new Date(t).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-");
let cfg = null, fbAuth = null, ITEMS = [], ITEM_BY = {}, RAR = [], curUid = null, ovTimer = null;
const gName = (g) => { const it = ITEM_BY[g.id] || {}; return (g.up ? `+${g.up} ` : "") + (it.name || g.id); };
const gCol = (g) => (ITEM_BY[g.id] || {}).type === "equip" && g.r > 0 && RAR[g.r] ? RAR[g.r].color : "";

// ---------- เชื่อมเซิร์ฟเวอร์ ----------
async function token() {
  if (cfg.mode === "dev") return "dev:" + (sessionStorage.getItem("pn_dev_id") || "");
  return fbAuth.currentUser ? fbAuth.currentUser.getIdToken() : "";
}
async function api(method, path, body) {
  const res = await fetch(path, { method, body: body && JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer " + (await token()) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}
function toast(msg, bad) {
  const t = $("toast");
  t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600);
}
async function run(fn, okMsg) {
  try { const r = await fn(); toast((r && r.msg) || okMsg || "เรียบร้อย"); return r; }
  catch (e) { toast(e.message, true); }
}

// ---------- ล็อกอิน ----------
const FB_ERR = { "auth/invalid-credential": "ID หรือรหัสผ่านไม่ถูกต้อง", "auth/wrong-password": "ID หรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "ID หรือรหัสผ่านไม่ถูกต้อง", "auth/invalid-login-credentials": "ID หรือรหัสผ่านไม่ถูกต้อง",
  "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป รอสักครู่", "auth/user-disabled": "บัญชีนี้ถูกระงับ" };
function showLogin(msg) {
  $("app").hidden = true; $("login").hidden = false; $("logout").hidden = true; $("who").textContent = "";
  $("lerr").textContent = msg || "";
  $("lnote").textContent = cfg && cfg.mode === "dev" ? "โหมดทดสอบ: ใช้ ID \"admin\" (รหัสผ่านอะไรก็ได้) หรือ ID ที่อยู่ใน ADMIN_IDS" : "";
  clearInterval(ovTimer);
}
async function checkAdmin() {
  try {
    const me = await api("GET", "/api/admin/me");
    if (!me.admin) {
      return showLogin(me.hasAdminIds ? `ID "${me.loginId}" ไม่ใช่แอดมิน` :
        `ยังไม่ได้ตั้งแอดมิน — ใส่ค่า ADMIN_IDS = ${me.loginId} ใน Render (Environment) แล้วรอ deploy`);
    }
    $("login").hidden = true; $("app").hidden = false; $("logout").hidden = false;
    $("who").textContent = `แอดมิน: ${me.loginId}` + (me.mode === "dev" ? " · โหมดทดสอบ" : "");
    const it = await api("GET", "/api/admin/items");
    ITEMS = it.items; ITEM_BY = Object.fromEntries(ITEMS.map((i) => [i.id, i])); RAR = it.rarity || [];
    openTab("ov");
  } catch (e) { showLogin(e.message); }
}
$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("lid").value.trim().toLowerCase(), pw = $("lpw").value;
  $("lerr").textContent = ""; $("lbtn").disabled = true;
  try {
    if (cfg.mode === "dev") { sessionStorage.setItem("pn_dev_id", id); await checkAdmin(); }
    else await fbAuth.signInWithEmailAndPassword(`${id}@${cfg.domain}`, pw);
  } catch (err) { $("lerr").textContent = FB_ERR[err.code] || err.message; }
  finally { $("lbtn").disabled = false; }
});
$("logout").onclick = async () => {
  if (cfg.mode === "dev") { sessionStorage.removeItem("pn_dev_id"); showLogin(); }
  else await fbAuth.signOut();
};

// ---------- แท็บ ----------
function openTab(t) {
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  ["ov", "pl", "an", "lg", "gd"].forEach((k) => ($("tab-" + k).hidden = k !== t));
  clearInterval(ovTimer);
  if (t === "ov") { loadOverview(); ovTimer = setInterval(loadOverview, 5000); }
  if (t === "pl" && !$("accList").children.length) search();
  if (t === "lg") loadLogs();
  clearInterval(mtTimer);
  if (t === "an") { loadMaint(); mtTimer = setInterval(renderMaint, 500); }
  if (t === "gd") loadGameData();
}
document.querySelectorAll("nav.tabs button").forEach((b) => (b.onclick = () => openTab(b.dataset.tab)));

// ---------- ภาพรวม ----------
async function loadOverview() {
  let d;
  try { d = await api("GET", "/api/admin/overview"); } catch (e) { return toast(e.message, true); }
  const up = Math.floor(d.uptime / 60000);
  const cards = [["ออนไลน์", d.world.players], ["มอนที่มีชีวิต", `${d.world.alive}/${d.world.monsters}`], ["ของบนพื้น", d.world.drops],
    ["สัตว์เลี้ยงที่ออกมา", d.world.pets], ["เปิดเซิร์ฟมา", up >= 60 ? `${Math.floor(up / 60)} ชม. ${up % 60} น.` : `${up} นาที`],
    ["RAM", d.memMB + " MB"], ["ฐานข้อมูล", d.mode === "firebase" ? "Firebase" : "ทดสอบ"]];
  $("stats").innerHTML = cards.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${esc(v)}</b></div>`).join("");
  $("ovTime").textContent = "· อัปเดต " + new Date().toLocaleTimeString("th-TH");
  const rows = d.online.map((o) => `<tr>
    <td>${esc(o.name)} ${o.auto ? '<span class="pill">AUTO</span>' : ""} ${o.dead ? '<span class="pill ban">ตาย</span>' : ""}</td>
    <td>${esc(o.loginId)}</td><td class="num">${o.level}</td><td class="hide-sm">${esc(o.jobName)}</td>
    <td class="num">${fmt(o.hp)}/${fmt(o.maxHp)}</td><td class="num">${fmt(o.gold)}</td><td class="hide-sm">${esc(o.map || "")} (${o.tx}, ${o.ty})</td>
    <td class="row" style="justify-content:flex-end">
      <button class="btn" data-acc="${esc(o.uid)}">จัดการ</button>
      <button class="btn" data-town="${esc(o.charId)}" data-name="${esc(o.name)}">ส่งกลับเมือง</button>
      <button class="btn danger" data-kick="${esc(o.charId)}" data-name="${esc(o.name)}">เตะออก</button></td></tr>`);
  $("onlineRows").innerHTML = rows.join("") || `<tr><td colspan="8" class="empty">ยังไม่มีใครออนไลน์</td></tr>`;
}
$("onlineRows").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.acc) { openTab("pl"); openAccount(b.dataset.acc); }
  if (b.dataset.town) { await run(() => api("POST", "/api/admin/char/" + b.dataset.town, { action: "town", name: b.dataset.name })); loadOverview(); }
  if (b.dataset.kick && confirm(`เตะ ${b.dataset.name} ออกจากเกม?`)) {
    await run(() => api("POST", "/api/admin/char/" + b.dataset.kick, { action: "kick", name: b.dataset.name })); setTimeout(loadOverview, 400);
  }
});

// ---------- ค้นหาบัญชี ----------
async function search() {
  try {
    const { accounts } = await api("GET", "/api/admin/accounts?q=" + encodeURIComponent($("q").value.trim()));
    $("accList").innerHTML = accounts.map((a) => `<button class="acc-item${a.uid === curUid ? " sel" : ""}" data-uid="${esc(a.uid)}">
      <b>${esc(a.loginId)}</b> ${a.banned ? '<span class="pill ban">ระงับ</span>' : ""}
      <span class="muted" style="margin-left:auto">สมัคร ${when(a.createdAt)}</span></button>`).join("")
      || `<div class="empty">ไม่พบบัญชี</div>`;
  } catch (e) { toast(e.message, true); }
}
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); search(); });
$("accList").addEventListener("click", (e) => { const b = e.target.closest("[data-uid]"); if (b) openAccount(b.dataset.uid); });

async function openAccount(uid) {
  curUid = uid;
  document.querySelectorAll(".acc-item").forEach((b) => b.classList.toggle("sel", b.dataset.uid === uid));
  let a;
  try { a = await api("GET", "/api/admin/account/" + encodeURIComponent(uid)); } catch (e) { return toast(e.message, true); }
  const itemOpts = ITEMS.map((i) => `<option value="${i.id}">${esc(i.name)}${i.lv ? " (Lv" + i.lv + ")" : ""}</option>`).join("");
  CHARS = Object.fromEntries(a.chars.map((c) => [c.id, c]));
  const petOpts = ITEMS.filter((i) => i.type === "pet").map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
  const chars = a.chars.map((c) => {
    const st = c.stats ? Object.entries(c.stats).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "สเตตัสเริ่มต้น";
    const inv = (c.inv || []).map((s, i) => s ? `<button title="${esc(gName(s))}${gCol(s) ? " [" + RAR[s.r].name + "]" : ""} ×${s.n} — คลิกเพื่อแก้/ลบ" data-ed="inv" data-i="${i}" data-char="${c.id}"
      ${gCol(s) ? `style="border-color:${gCol(s)}"` : ""}>
      <img src="/assets/icons/${esc(s.id)}.png" alt="">${s.up ? `<span class="upb">+${s.up}</span>` : ""}<span class="n">${s.n > 1 ? s.n : ""}</span></button>` : "").join("");
    const eq = Object.entries(c.equip || {}).map(([sl, g0]) => { const g = typeof g0 === "string" ? { id: g0 } : g0;
      return `<button title="${esc(SLOT_TH[sl] || sl)}: ${esc(gName(g))}${gCol(g) ? " [" + RAR[g.r].name + "]" : ""} — คลิกเพื่อแก้/ลบ" data-ed="eq" data-i="${sl}" data-char="${c.id}"
        ${gCol(g) ? `style="border-color:${gCol(g)}"` : ""}><img src="/assets/icons/${esc(g.id)}.png" alt="">${g.up ? `<span class="upb">+${g.up}</span>` : ""}</button>`; }).join("");
    return `<div class="char" data-id="${c.id}" data-name="${esc(c.name)}">
      <h3>${esc(c.name)} <span class="pill">${esc(c.jobName)} Lv.${c.level}</span>
        ${c.online ? '<span class="pill on">ออนไลน์</span>' : '<span class="pill">ออฟไลน์</span>'}</h3>
      <div class="meta">gold ${fmt(c.gold)} · ${st} · บันทึกล่าสุด ${when(c.updatedAt)}</div>
      <div class="acts">
        <div class="row"><label>gold</label><input type="number" data-f="gold" value="1000" style="width:120px">
          <button class="btn" data-a="gold+">เพิ่ม</button><button class="btn" data-a="gold-">ลด</button></div>
        <div class="row"><label>ให้ไอเทม</label><select data-f="item" style="max-width:220px">${itemOpts}</select>
          <input type="number" data-f="n" value="1" min="1" max="999" style="width:70px"><button class="btn" data-a="item">ให้</button></div>
        <div class="row"><label>(อุปกรณ์)</label><select data-f="r"><option value="0">ระดับ: ธรรมดา</option>${RAR.slice(1).map((r, i) => `<option value="${i + 1}" style="color:${r.color}">ระดับ: ${r.name}</option>`).join("")}<option value="rand">ระดับ: สุ่มแบบดรอป</option></select>
          <label style="min-width:auto">ตีบวก +</label><input type="number" data-f="up" value="0" min="0" max="10" style="width:60px"></div>
        <div class="row"><label>เลเวล</label><input type="number" data-f="lv" value="${c.level}" min="1" max="99" style="width:80px">
          <button class="btn" data-a="level">ตั้งเลเวล</button><button class="btn" data-a="resetStats">รีเซ็ตสเตตัส</button></div>
        <div class="row"><label>อาชีพ</label><select data-f="job">${Object.entries(JOBS_ADMIN).map(([k, n]) => `<option value="${k}" ${c.job === k ? "selected" : ""}>${n}</option>`).join("")}</select>
          <button class="btn" data-a="job">เปลี่ยนอาชีพ</button></div>
        <div class="row"><label>อื่น ๆ</label><button class="btn" data-a="town">ส่งกลับเมือง</button>
          <button class="btn" data-a="heal" ${c.online ? "" : "disabled"}>ฟื้นเลือดเต็ม</button>
          <button class="btn danger" data-a="kick" ${c.online ? "" : "disabled"}>เตะออกจากเกม</button></div>
      </div>
      <div class="muted" style="margin-top:10px">ของที่สวมอยู่ (คลิกเพื่อแก้ระดับ/ตีบวก/ลบ):</div>
      <div class="inv">${eq || '<span class="muted" style="grid-column:1/-1">ไม่ได้สวมอะไร</span>'}</div>
      <div class="row" style="margin-top:8px"><span class="muted" style="min-width:76px">สัตว์เลี้ยง</span>
        ${c.pet ? `<img src="/assets/icons/${esc(c.pet)}.png" alt="" width="24" height="24" style="image-rendering:pixelated"><b>${esc((ITEM_BY[c.pet] || {}).name || c.pet)}</b>
          <button class="btn danger" data-a="petRemove">ลบสัตว์เลี้ยง</button>` : '<span class="muted">ไม่มี</span>'}
        <select data-f="pet">${petOpts}</select><button class="btn" data-a="petSet">${c.pet ? "เปลี่ยนเป็นตัวนี้" : "ให้สัตว์เลี้ยง"}</button></div>
      <div class="muted" style="margin-top:8px">กระเป๋า (คลิกไอเทมเพื่อแก้/ลบ):</div>
      <div class="inv">${inv || '<span class="muted" style="grid-column:1/-1">ว่าง</span>'}</div>
    </div>`;
  }).join("");
  $("accDetail").innerHTML = `<div class="card">
      <h2>บัญชี ${esc(a.loginId)} ${a.banned ? '<span class="pill ban">ถูกระงับ</span>' : ""}</h2>
      <div class="muted" style="margin-bottom:10px">สมัครเมื่อ ${when(a.createdAt)} · ตัวละคร ${a.chars.length}/${a.slots}</div>
      <div class="row"><span style="min-width:110px">ช่องตัวละคร</span>
        <button class="btn" data-slots="${a.slots - 1}" ${a.slots <= 1 ? "disabled" : ""}>−</button><b>${a.slots}</b>
        <button class="btn" data-slots="${a.slots + 1}" ${a.slots >= 12 ? "disabled" : ""}>+</button></div>
      <div class="row"><span style="min-width:110px">ตั้งรหัสผ่านใหม่</span>
        <input type="text" id="newPw" placeholder="อย่างน้อย 6 ตัว" autocomplete="off" style="width:180px">
        <button class="btn" id="setPw">เปลี่ยนรหัส</button></div>
      <div class="row"><span style="min-width:110px">สถานะ</span>
        ${a.banned ? '<button class="btn" data-ban="0">ยกเลิกการระงับ</button>' : '<button class="btn danger" data-ban="1">ระงับบัญชี (แบน)</button>'}</div>
    </div>
    <div class="chars">${chars || '<div class="card empty">บัญชีนี้ยังไม่มีตัวละคร</div>'}</div>`;
  const d = $("accDetail");
  d.querySelectorAll("[data-slots]").forEach((b) => (b.onclick = async () => {
    await run(() => api("POST", "/api/admin/account/" + uid, { slots: Number(b.dataset.slots) })); openAccount(uid);
  }));
  d.querySelector("#setPw").onclick = async () => {
    const pw = $("newPw").value;
    if (pw.length < 6) return toast("รหัสผ่านต้องมีอย่างน้อย 6 ตัว", true);
    if (!confirm(`เปลี่ยนรหัสผ่านของ ${a.loginId} เป็น "${pw}" ?\nอย่าลืมแจ้งรหัสใหม่ให้เจ้าของบัญชี`)) return;
    await run(() => api("POST", "/api/admin/account/" + uid, { password: pw }));
    $("newPw").value = "";
  };
  d.querySelectorAll("[data-ban]").forEach((b) => (b.onclick = async () => {
    const ban = b.dataset.ban === "1";
    if (ban && !confirm(`ระงับบัญชี ${a.loginId}? ผู้เล่นจะถูกเตะออกและล็อกอินไม่ได้`)) return;
    await run(() => api("POST", "/api/admin/account/" + uid, { banned: ban })); openAccount(uid); search();
  }));
  d.querySelectorAll(".char").forEach((box) => {
    const id = box.dataset.id, name = box.dataset.name, f = (k) => box.querySelector(`[data-f="${k}"]`).value;
    box.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
      const a2 = b.dataset.a;
      let body = { action: a2, name };
      if (a2 === "gold+" || a2 === "gold-") body = { action: "gold", name, n: (a2 === "gold-" ? -1 : 1) * Math.abs(Number(f("gold")) || 0) };
      if (a2 === "item") body = { action: "item", name, id: f("item"), n: Number(f("n")), r: f("r"), up: Number(f("up")) };
      if (a2 === "level") body = { action: "level", name, lv: Number(f("lv")) };
      if (a2 === "job") { if (!confirm(`เปลี่ยนอาชีพของ ${name}? (แต้มสเตตัสจะถูกคืนทั้งหมด)`)) return; body = { action: "job", name, job: f("job") }; }
      if (a2 === "petSet") body = { action: "pet", name, id: f("pet") };
      if (a2 === "petRemove") { if (!confirm(`ลบสัตว์เลี้ยงของ ${name}?`)) return; body = { action: "pet", name, id: null }; }
      if (a2 === "resetStats" && !confirm(`รีเซ็ตสเตตัสของ ${name}? (คืนแต้มทั้งหมดให้ลงใหม่)`)) return;
      if (a2 === "kick" && !confirm(`เตะ ${name} ออกจากเกม?`)) return;
      await run(() => api("POST", "/api/admin/char/" + id, body));
      setTimeout(() => openAccount(uid), a2 === "kick" ? 500 : 0);
    }));
  });
  d.querySelectorAll("[data-ed]").forEach((b) => (b.onclick = () => openGearEditor(b.dataset.char, b.dataset.ed, b.dataset.i)));
}

// ---------- หน้าต่างแก้ไอเทม (ระดับ / ตีบวก / ค่าพิเศษ / ลบ) ----------
let CHARS = {};
const SLOT_TH = { head: "หมวก", face: "หน้า", armor: "เสื้อ/เกราะ", gloves: "ถุงมือ", acc1: "เครื่องประดับ 1", weapon: "อาวุธ",
  offhand: "มือรอง", cape: "ผ้าคลุม", shoes: "รองเท้า", acc2: "เครื่องประดับ 2" };
const STAT_TH = { atk: "ATK", def: "DEF", str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", maxHp: "HP", maxSp: "SP" };
function openGearEditor(charId, where, key) {
  const c = CHARS[charId];
  const g0 = where === "eq" ? c.equip[key] : c.inv[Number(key)];
  if (!g0) return;
  const g = typeof g0 === "string" ? { id: g0, r: 0, up: 0, x: {} } : g0;
  const it = ITEM_BY[g.id] || {}, gear = it.type === "equip", dlg = $("gearDlg");
  const extras = Object.entries(g.x || {}).map(([k, v]) => `${STAT_TH[k] || k} +${v}`).join(" · ") || "ไม่มี";
  dlg.innerHTML = `<form method="dialog">
    <h2 style="color:${gCol(g) || "var(--gold)"}"><img src="/assets/icons/${esc(g.id)}.png" alt="" width="28" height="28" style="image-rendering:pixelated;vertical-align:middle"> ${esc(gName(g))}</h2>
    <p class="muted">${esc(c.name)} · ${where === "eq" ? "สวมอยู่ช่อง" + (SLOT_TH[key] || key) : "กระเป๋าช่องที่ " + (Number(key) + 1)}${g.n > 1 ? " · จำนวน " + g.n : ""}</p>
    ${gear ? `<p class="muted">ค่าพิเศษตอนนี้: <span style="color:#9fd0ff">${esc(extras)}</span></p>
      <div class="row"><label style="min-width:90px">ระดับ</label><select id="gdR">${RAR.map((r, i) => `<option value="${i}" ${i === (g.r || 0) ? "selected" : ""} style="color:${r.color}">${r.name}</option>`).join("")}</select>
        <span class="muted">เปลี่ยนระดับ = สุ่มค่าพิเศษใหม่ตามจำนวนของระดับนั้น</span></div>
      <div class="row"><label style="min-width:90px">ตีบวก</label><input type="number" id="gdUp" min="0" max="10" value="${g.up || 0}" style="width:70px"></div>
      <div class="row"><label style="min-width:90px"></label><label><input type="checkbox" id="gdReroll"> สุ่มค่าพิเศษใหม่ (ระดับเดิม)</label></div>
      <div class="row" style="margin-top:12px"><button class="btn gold" type="button" id="gdSave">บันทึก</button>` :
      `<div class="row">${g.n > 1 ? `<label>ลบจำนวน</label><input type="number" id="gdN" min="1" max="${g.n}" value="${g.n}" style="width:80px">` : ""}`}
      <button class="btn danger" type="button" id="gdDel">${where === "eq" ? "ลบของที่สวม" : "ลบออกจากกระเป๋า"}</button>
      <button class="btn" value="close" style="margin-left:auto">ปิด</button></div>
  </form>`;
  const post = async (body) => { const r = await run(() => api("POST", "/api/admin/char/" + charId, { name: c.name, ...body })); if (r) { dlg.close(); openAccount(curUid); } };
  const save = $("gdSave");
  if (save) save.onclick = () => {
    const r = $("gdR").value, up = $("gdUp").value;
    post({ action: "editGear", where, idx: Number(key), slot: key, r: Number(r) === (g.r || 0) ? "" : Number(r), up: Number(up), reroll: $("gdReroll").checked });
  };
  $("gdDel").onclick = () => {
    if (!confirm(`ลบ ${gName(g)} ของ ${c.name}?`)) return;
    if (where === "eq") post({ action: "removeEquip", slot: key });
    else post({ action: "removeItem", idx: Number(key), n: $("gdN") ? Number($("gdN").value) : 1 });
  };
  dlg.showModal();
}

// ---------- ข้อมูลเกม (อ่านอย่างเดียว) ----------
let GD = null;
const TYPE_TH = { equip: "อุปกรณ์", use: "ของใช้", material: "ของดรอป", pet: "สัตว์เลี้ยง" };
async function loadGameData() {
  if (!GD) { try { GD = await api("GET", "/api/admin/gamedata"); } catch (e) { return toast(e.message, true); } }
  const pct = (x) => (x * 100).toFixed(x < 0.01 ? 1 : 0) + "%";
  const totalW = GD.rarity.reduce((t, r) => t + r.weight, 0);
  const bonus = (b) => Object.entries(b || {}).map(([k, v]) => `${STAT_TH[k] || k} +${v}`).join(", ");
  const dropFrom = {};
  for (const [mk, list] of Object.entries(GD.drops)) for (const [id, ch] of list) (dropFrom[id] = dropFrom[id] || []).push(`${GD.monsters[mk].name} ${pct(ch)}`);
  const itemRows = (type) => Object.entries(GD.items).filter(([, it]) => it.type === type).map(([id, it]) => `<tr>
      <td><img src="/assets/icons/${id}.png" alt="" width="22" height="22" style="image-rendering:pixelated;vertical-align:middle"> ${esc(it.name)}</td>
      <td>${type === "equip" ? esc(SLOT_TH[it.slot] || (it.slot === "acc" ? "เครื่องประดับ" : it.slot)) : esc(it.desc || "")}</td>
      <td class="num">${it.lv || "-"}</td><td>${esc(bonus(it.bonus) || (it.heal ? [it.heal.hp && `ฟื้น HP ${it.heal.hp}`, it.heal.sp && `ฟื้น SP ${it.heal.sp}`].filter(Boolean).join(", ") : ""))}</td>
      <td>${it.refine10 ? esc(bonus(it.refine10)) : "-"}</td>
      <td class="num">${it.price ? fmt(it.price) : "-"}${GD.shop.includes(id) ? "" : (it.price ? " <span class='muted'>(ไม่ขาย)</span>" : "")}</td>
      <td class="num">${fmt(it.sellPrice)}</td><td class="muted">${esc((dropFrom[id] || []).join(", ") || "-")}</td></tr>`).join("");
  const head = `<thead><tr><th>ชื่อ</th><th>ช่อง/รายละเอียด</th><th class="num">Lv</th><th>ค่าพลัง</th><th>ตีบวก +10 ได้</th><th class="num">ราคาร้าน</th><th class="num">ขายได้</th><th>ดรอปจาก</th></tr></thead>`;
  $("gdBody").innerHTML = `
    <div class="card"><h2>ระดับความหายาก (อุปกรณ์ที่ดรอป)</h2><div class="tbl-wrap"><table>
      <thead><tr><th>ระดับ</th><th class="num">โอกาส</th><th class="num">คูณค่าพลัง</th><th class="num">ค่าพิเศษ</th><th class="num">คูณราคาขาย</th></tr></thead>
      <tbody>${GD.rarity.map((r) => `<tr><td style="color:${r.color}">${r.name}</td><td class="num">${pct(r.weight / totalW)}</td><td class="num">×${r.mult}</td><td class="num">${r.extras}</td><td class="num">×${r.sell}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h2>ตีบวก</h2><p class="muted">ถึง +${GD.safeRefine} ไม่มีวันลดระดับ · ตั้งแต่ +${GD.safeRefine + 1} ล้มเหลวลด 1 ระดับ · ค่า gold ขึ้นกับเลเวลไอเทม</p><div class="tbl-wrap"><table>
      <thead><tr><th>ตีไปที่</th><th class="num">สำเร็จ</th><th>วัตถุดิบ</th><th class="num">gold (ไอเทม Lv1)</th><th class="num">(Lv10)</th><th class="num">(Lv20)</th></tr></thead>
      <tbody>${GD.refine.map((r) => `<tr><td>+${r.to}</td><td class="num">${pct(r.rate)}</td><td>${r.mats.map(([id, n]) => esc(GD.items[id].name) + " ×" + n).join(", ")}</td>
        <td class="num">${fmt(r.goldLv1)}</td><td class="num">${fmt(r.goldLv10)}</td><td class="num">${fmt(r.goldLv20)}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h2>อุปกรณ์</h2><div class="tbl-wrap"><table>${head}<tbody>${itemRows("equip")}</tbody></table></div></div>
    <div class="card"><h2>ของใช้ · สัตว์เลี้ยง · ของดรอป</h2><div class="tbl-wrap"><table>${head}<tbody>${itemRows("use")}${itemRows("pet")}${itemRows("material")}</tbody></table></div></div>
    <div class="card"><h2>มอนสเตอร์</h2><div class="tbl-wrap"><table>
      <thead><tr><th>ชื่อ</th><th class="num">Lv</th><th class="num">HP</th><th class="num">ATK</th><th class="num">DEF</th><th class="num">EXP</th><th class="num">จำนวน</th><th>ดรอป</th></tr></thead>
      <tbody>${Object.entries(GD.monsters).map(([k, m]) => `<tr><td>${esc(m.name)}${m.aggressive ? ' <span class="pill ban">ดุ</span>' : ""}</td><td class="num">${m.level}</td>
        <td class="num">${fmt(m.maxHp)}</td><td class="num">${m.atk}</td><td class="num">${m.def}</td><td class="num">${m.exp}</td><td class="num">${m.count}</td>
        <td class="muted">${(GD.drops[k] || []).map(([id, ch]) => esc(GD.items[id].name) + " " + pct(ch)).join(", ")}</td></tr>`).join("")}</tbody></table></div></div>
    <p class="muted">แก้ตัวเลขเหล่านี้ได้ที่ไฟล์ server/items.js (ไอเทม/ดรอป/ตีบวก) และ server/data.js (มอนสเตอร์) แล้ว push ขึ้น GitHub</p>`;
}

// ---------- ปิดปรับปรุง ----------
let MT = null, mtTimer = null;
async function loadMaint() { try { MT = await api("GET", "/api/admin/maintenance"); MT.at = Date.now(); renderMaint(); } catch (e) { toast(e.message, true); } }
function renderMaint() {
  if (!MT) return;
  const left = Math.max(0, MT.left - (Date.now() - MT.at)), s = Math.ceil(left / 1000);
  $("mtState").innerHTML = MT.closed ? '<b style="color:var(--bad)">สถานะ: ปิดปรับปรุงอยู่ (ผู้เล่นเข้าเกมไม่ได้)</b>'
    : MT.active ? `<b style="color:var(--gold)">สถานะ: จะปิดในอีก ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b>${MT.note ? " · " + esc(MT.note) : ""}`
    : "สถานะ: เปิดปกติ";
  $("mtCancel").hidden = !MT.active || MT.closed;
  $("mtOpen").hidden = !MT.closed;
  if (MT.active && !MT.closed && left <= 0) setTimeout(loadMaint, 1500);
}
$("mtStart").onclick = async () => {
  const minutes = Number($("mtMin").value);
  if (!confirm(`เริ่มนับถอยหลังปิดปรับปรุง ${minutes} นาที?`)) return;
  const r = await run(() => api("POST", "/api/admin/maintenance", { minutes, msg: $("mtMsg").value }));
  if (r) { MT = { ...r, at: Date.now() }; renderMaint(); }
};
$("mtCancel").onclick = async () => { const r = await run(() => api("POST", "/api/admin/maintenance", { cancel: true })); if (r) { MT = { ...r, at: Date.now() }; renderMaint(); } };
$("mtOpen").onclick = async () => { const r = await run(() => api("POST", "/api/admin/maintenance", { open: true })); if (r) { MT = { ...r, at: Date.now() }; renderMaint(); } };

// ---------- ประกาศ / บันทึก ----------
$("annSend").onclick = async () => {
  const text = $("annText").value.trim();
  if (!text) return toast("พิมพ์ข้อความก่อน", true);
  if (await run(() => api("POST", "/api/admin/announce", { text }))) $("annText").value = "";
};
async function loadLogs() {
  try {
    const { logs } = await api("GET", "/api/admin/logs");
    $("logs").innerHTML = logs.map((l) => `<li><span class="muted">${when(l.at)} · ${esc(l.by)}</span> — ${esc(l.what)}</li>`).join("")
      || `<li class="empty">ยังไม่มีบันทึก</li>`;
  } catch (e) { toast(e.message, true); }
}
$("lgReload").onclick = loadLogs;

// ---------- เริ่ม ----------
(async () => {
  try { cfg = await (await fetch("/api/config")).json(); }
  catch { return showLogin("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ถ้าเพิ่งเปิดเว็บ รอ 1 นาทีแล้วรีเฟรช)"); }
  if (cfg.mode === "dev") return sessionStorage.getItem("pn_dev_id") ? checkAdmin() : showLogin();
  firebase.initializeApp(cfg.firebase);
  fbAuth = firebase.auth();
  fbAuth.onAuthStateChanged((u) => (u ? checkAdmin() : showLogin()));
})();

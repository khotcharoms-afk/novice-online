// =============================================================
//  เมนูแอดมิน — ใช้ได้เฉพาะ ID ที่ตั้งไว้ใน ADMIN_IDS บน Render
// =============================================================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();
const when = (t) => (t ? new Date(t).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-");
let cfg = null, fbAuth = null, ITEMS = [], ITEM_BY = {}, curUid = null, ovTimer = null;

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
    ITEMS = it.items; ITEM_BY = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
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
  ["ov", "pl", "an", "lg"].forEach((k) => ($("tab-" + k).hidden = k !== t));
  clearInterval(ovTimer);
  if (t === "ov") { loadOverview(); ovTimer = setInterval(loadOverview, 5000); }
  if (t === "pl" && !$("accList").children.length) search();
  if (t === "lg") loadLogs();
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
    <td class="num">${fmt(o.hp)}/${fmt(o.maxHp)}</td><td class="num">${fmt(o.gold)}</td><td class="hide-sm">${o.tx}, ${o.ty}</td>
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
  const chars = a.chars.map((c) => {
    const st = c.stats ? Object.entries(c.stats).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "สเตตัสเริ่มต้น";
    const inv = (c.inv || []).map((s, i) => s ? `<button title="${esc((ITEM_BY[s.id] || {}).name || s.id)} ×${s.n} — คลิกเพื่อลบ" data-rm="${i}" data-char="${c.id}" data-cname="${esc(c.name)}">
      <img src="/assets/icons/${esc(s.id)}.png" alt=""><span class="n">${s.n > 1 ? s.n : ""}</span></button>` : "").join("");
    const eq = Object.entries(c.equip || {}).map(([sl, id]) => `<span>${esc((ITEM_BY[id] || {}).name || id)}</span>`).join(", ");
    return `<div class="char" data-id="${c.id}" data-name="${esc(c.name)}">
      <h3>${esc(c.name)} <span class="pill">${esc(c.jobName)} Lv.${c.level}</span>
        ${c.online ? '<span class="pill on">ออนไลน์</span>' : '<span class="pill">ออฟไลน์</span>'}</h3>
      <div class="meta">gold ${fmt(c.gold)} · ${st} · บันทึกล่าสุด ${when(c.updatedAt)}</div>
      <div class="acts">
        <div class="row"><label>gold</label><input type="number" data-f="gold" value="1000" style="width:120px">
          <button class="btn" data-a="gold+">เพิ่ม</button><button class="btn" data-a="gold-">ลด</button></div>
        <div class="row"><label>ให้ไอเทม</label><select data-f="item" style="max-width:220px">${itemOpts}</select>
          <input type="number" data-f="n" value="1" min="1" max="999" style="width:70px"><button class="btn" data-a="item">ให้</button></div>
        <div class="row"><label>เลเวล</label><input type="number" data-f="lv" value="${c.level}" min="1" max="99" style="width:80px">
          <button class="btn" data-a="level">ตั้งเลเวล</button><button class="btn" data-a="resetStats">รีเซ็ตสเตตัส</button></div>
        <div class="row"><label>อื่น ๆ</label><button class="btn" data-a="town">ส่งกลับเมือง</button>
          <button class="btn" data-a="heal" ${c.online ? "" : "disabled"}>ฟื้นเลือดเต็ม</button>
          <button class="btn danger" data-a="kick" ${c.online ? "" : "disabled"}>เตะออกจากเกม</button></div>
      </div>
      ${eq ? `<div class="eqline">สวมอยู่: ${eq}${c.pet ? ` · สัตว์เลี้ยง: <span>${esc((ITEM_BY[c.pet] || {}).name || c.pet)}</span>` : ""}</div>` : ""}
      <div class="muted" style="margin-top:8px">กระเป๋า (คลิกไอเทมเพื่อลบ):</div>
      <div class="inv">${inv || '<span class="muted">ว่าง</span>'}</div>
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
      if (a2 === "item") body = { action: "item", name, id: f("item"), n: Number(f("n")) };
      if (a2 === "level") body = { action: "level", name, lv: Number(f("lv")) };
      if (a2 === "resetStats" && !confirm(`รีเซ็ตสเตตัสของ ${name}? (คืนแต้มทั้งหมดให้ลงใหม่)`)) return;
      if (a2 === "kick" && !confirm(`เตะ ${name} ออกจากเกม?`)) return;
      await run(() => api("POST", "/api/admin/char/" + id, body));
      setTimeout(() => openAccount(uid), a2 === "kick" ? 500 : 0);
    }));
  });
  d.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
    if (!confirm(`ลบไอเทมนี้ออกจากกระเป๋าของ ${b.dataset.cname}?\n(${b.title.split(" — ")[0]})`)) return;
    await run(() => api("POST", "/api/admin/char/" + b.dataset.char, { action: "removeItem", name: b.dataset.cname, idx: Number(b.dataset.rm) }));
    openAccount(uid);
  }));
}

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

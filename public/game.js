// =============================================================
//  ฝั่งผู้เล่น — Phaser 3 + Colyseus  (Phase 2: ต่อสู้ / มอนสเตอร์ / EXP / สกิล)
// =============================================================
const $ = (id) => document.getElementById(id);
// เคอร์เซอร์เมาส์ของเกม (พิกเซลอาร์ต 32px · ตัวเลข = จุดคลิก)
const CUR = {
  arrow: "url(/assets/cursors/arrow.png) 2 2, auto",
  hand: "url(/assets/cursors/hand.png) 12 2, pointer",
  sword: "url(/assets/cursors/sword.png) 2 2, crosshair",
  talk: "url(/assets/cursors/talk.png) 2 2, pointer",
};
// กันการลากคลุม/ลากรูปติดเมาส์ (ยกเว้นช่องพิมพ์)
document.addEventListener("selectstart", (e) => { if (!e.target.closest || !e.target.closest("input, textarea")) e.preventDefault(); });
document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });
const isTyping = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement && document.activeElement.tagName) || "");
const SERVER_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const T = 32;
const COLS = 9; // เฟรมต่อแถวในไฟล์ภาพตัวละคร
// แถวในไฟล์ภาพ: เดิน 0–3, ฟัน 4–7, ล้ม 8, ร่ายเวท 9–12 (ทิศ ขึ้น/ซ้าย/ลง/ขวา)
const DIR_ROW = { up: 0, left: 1, down: 2, right: 3 };
const SHOOT_RELEASE_MS = 380; // ธนูปล่อยลูกศรที่เฟรมที่ 7 ของท่ายิง (ต้องตรงกับฝั่งเซิร์ฟเวอร์)
const CAST_RELEASE_MS = 170;  // คทา/คัมภีร์ปล่อยลูกเวทตอนชี้สุด
const ZOOMS = [1, 1.25, 1.5, 2];

const LOOK_OPTS = {
  sex: [["m", "ชาย"], ["f", "หญิง"]],
  skin: [["light", "#f4cfa8"], ["olive", "#d9a877"], ["bronze", "#b07a4f"], ["brown", "#7d4e33"]],
  hair: {
    m: [["plain", "เรียบ"], ["spiked", "ตั้งชี้"], ["messy1", "ยุ่ง"], ["parted", "แสก"]],
    f: [["ponytail", "หางม้า"], ["long", "ยาว"], ["pixie", "สั้น"], ["bunches", "แกละ"]],
  },
  color: [["black", "#262626"], ["dark_brown", "#4a2f1f"], ["chestnut", "#8a4b25"], ["blonde", "#e7c76a"],
    ["redhead", "#b53a22"], ["platinum", "#e9e6dc"]],
};
const MOB_KINDS = ["goblin", "wolf", "boar", "skeleton", "orc"];

let room = null;
let MANIFEST = { equip: [], icons: [] };
let scene = null;
let gameData = null; // ข้อมูลแผนที่ + สกิล จากเซิร์ฟเวอร์
let WORLD = null, CUR_MAP = null, leavingForWarp = false, gameClient = null, myChar = null, phaserGame = null; // ข้อมูลโลก (ทุกแผนที่) / แผนที่ปัจจุบัน

// =============================================================
//  ล็อกอินด้วย ID (ใช้ Firebase Auth — ID ถูกแปลงเป็นอีเมลภายใน id@โดเมนเกม)
// =============================================================
const ID_RE = /^[a-z0-9_]{4,16}$/;
let cfg = null, fbAuth = null, authMode = "login", account = null;

const showScreen = (id) => ["scrAuth", "scrSelect", "scrCreate"].forEach((s) => ($(s).hidden = s !== id));
const setErr = (id, msg) => { $(id).textContent = msg || ""; };

async function getToken() {
  if (cfg.mode === "dev") return "dev:" + sessionStorage.getItem("pn_dev_id");
  return fbAuth.currentUser.getIdToken();
}
async function api(method, path, body) {
  const res = await fetch(path, {
    method, body: body && JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer " + (await getToken()) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  return data;
}
const FB_ERR = {
  "auth/invalid-credential": "ID หรือรหัสผ่านไม่ถูกต้อง", "auth/wrong-password": "ID หรือรหัสผ่านไม่ถูกต้อง",
  "auth/user-not-found": "ID หรือรหัสผ่านไม่ถูกต้อง", "auth/invalid-login-credentials": "ID หรือรหัสผ่านไม่ถูกต้อง",
  "auth/email-already-in-use": "ID นี้มีคนใช้แล้ว", "auth/weak-password": "รหัสผ่านต้องมีอย่างน้อย 6 ตัว",
  "auth/too-many-requests": "ลองผิดหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
  "auth/network-request-failed": "เชื่อมต่ออินเทอร์เน็ตไม่ได้",
};

async function initAuth() {
  try {
    cfg = await (await fetch("/api/config")).json();
    MANIFEST = await (await fetch("/assets/manifest.json")).json();
  }
  catch { setErr("authErr", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ถ้าเพิ่งเปิดเว็บ รอประมาณ 1 นาทีแล้วรีเฟรช)"); return; }
  $("idInput").value = storeGet("pn_id") || "";
  if (cfg.mode === "dev") {
    $("devNote").hidden = false;
    if (cfg.configError) $("devNote").textContent = "โหมดทดสอบ: ตั้งค่า Firebase ใน Render ไม่ถูกต้อง (ดูสาเหตุใน Logs) — ข้อมูลยังไม่ถูกบันทึก";
    if (sessionStorage.getItem("pn_dev_id")) return openSelect();
    return showScreen("scrAuth");
  }
  firebase.initializeApp(cfg.firebase);
  fbAuth = firebase.auth();
  fbAuth.onAuthStateChanged((u) => (u ? openSelect() : showScreen("scrAuth")));
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("pw2Field").hidden = !signup;
  $("authBtn").textContent = signup ? "สมัครสมาชิก" : "เข้าสู่ระบบ";
  $("authSub").textContent = signup ? "สร้าง ID ใหม่" : "ล็อกอินด้วย ID ของคุณ";
  $("switchText").textContent = signup ? "มี ID แล้ว?" : "ยังไม่มี ID?";
  $("switchBtn").textContent = signup ? "เข้าสู่ระบบ" : "สมัครสมาชิก";
  $("pwInput").autocomplete = signup ? "new-password" : "current-password";
  setErr("authErr");
}
$("switchBtn").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login");

$("scrAuth").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("idInput").value.trim().toLowerCase(), pw = $("pwInput").value;
  if (!ID_RE.test(id)) return setErr("authErr", "ID ต้องยาว 4–16 ตัว ใช้ได้แค่ a–z, 0–9 และ _");
  if (pw.length < 6) return setErr("authErr", "รหัสผ่านต้องมีอย่างน้อย 6 ตัว");
  if (authMode === "signup" && pw !== $("pw2Input").value) return setErr("authErr", "ยืนยันรหัสผ่านไม่ตรงกัน");
  $("authBtn").disabled = true;
  setErr("authErr");
  try {
    storeSet("pn_id", id);
    if (cfg.mode === "dev") { sessionStorage.setItem("pn_dev_id", id); await openSelect(); return; }
    const email = `${id}@${cfg.domain}`;
    if (authMode === "signup") await fbAuth.createUserWithEmailAndPassword(email, pw);
    else await fbAuth.signInWithEmailAndPassword(email, pw);
    // onAuthStateChanged จะพาไปหน้าเลือกตัวละครเอง
  } catch (err) {
    setErr("authErr", FB_ERR[err.code] || err.message);
  } finally {
    $("authBtn").disabled = false;
  }
});

$("logoutBtn").onclick = async () => {
  if (cfg.mode === "dev") { sessionStorage.removeItem("pn_dev_id"); showScreen("scrAuth"); return; }
  await fbAuth.signOut();
};

// =============================================================
//  หน้าเลือกตัวละคร (3 ช่อง)
// =============================================================
const imgCache = {};
const loadImg = (path) => {
  if (!imgCache[path]) { const i = new Image(); i.src = `/assets/${path}.png`; imgCache[path] = i; }
  return imgCache[path];
};
// ชั้นภาพตัวละคร: ชั้นหลังตัว (ผ้าคลุม/อาวุธ) → ตัว → ชุด → ของสวม → ผม → หมวก/อาวุธ/โล่
const AFTER_HAIR = new Set(["head", "weapon", "offhand"]);
const layersFor = (lk, job = "villager", gear = "") => {
  const [sex, skin, hair, color] = lk.split("|");
  const has = (k) => MANIFEST.equip.includes(k) || (MANIFEST.equipLazy || []).includes(k);
  const pick = (base) => (has(`${base}_${sex}`) ? `equip/${base}_${sex}` : has(base) ? `equip/${base}` : null);
  const items = gear ? gear.split(",").map((x) => x.split(":")) : [];
  const back = items.map(([, id]) => pick(`${id}_back`)).filter(Boolean);
  const pre = items.filter(([s]) => !AFTER_HAIR.has(s)).map(([, id]) => pick(id)).filter(Boolean);
  const post = items.filter(([s]) => AFTER_HAIR.has(s)).map(([, id]) => pick(id)).filter(Boolean);
  return [...back, `look/base_${sex}_${skin}`, `look/outfit_${job}_${sex}`, ...pre, `look/hair_${hair}_${color}`, ...post];
};
// วาดตัวละครลง canvas (frame 0 = ยืน, 1–8 = เดิน; row 0–3 = ขึ้น/ซ้าย/ลง/ขวา)
function drawLook(cv, lk, job, frame, row, gear) {
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  for (const l of layersFor(lk, job, gear || cv.dataset.gear || "")) {
    const img = loadImg(l);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, frame * 64, row * 64, 64, 64, 0, 0, 64, 64);
  }
}
let animFrame = 0;
const animTimer = setInterval(() => {
  animFrame = (animFrame + 1) % 8;
  document.querySelectorAll("#slots canvas").forEach((cv) => drawLook(cv, cv.dataset.look, cv.dataset.job, 1 + animFrame, 2));
  if (!$("scrCreate").hidden) drawPreview();
}, 110);

async function openSelect() {
  showScreen("scrSelect");
  setErr("selectErr");
  $("slots").innerHTML = `<p class="sub">กำลังโหลด…</p>`;
  try {
    account = await api("GET", "/api/chars");
  } catch (e) {
    setErr("selectErr", e.message);
    $("slots").innerHTML = "";
    return;
  }
  $("acctId").textContent = account.loginId;
  $("adminLink").hidden = !account.admin;
  // กลับเข้าเกมอัตโนมัติ (หลังย้ายแผนที่ / เซิร์ฟเวอร์อัปเดต)
  const auto = sessionStorage.getItem("pn_auto");
  if (auto) {
    sessionStorage.removeItem("pn_auto");
    const c = account.chars.find((x) => x.id === auto);
    if (c) { showTravel(c.map); return enterGame(c, document.createElement("button")); }
  }
  const box = $("slots");
  box.innerHTML = "";
  for (let i = 0; i < account.slots; i++) {
    const c = account.chars[i];
    if (!c) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot-card empty";
      b.innerHTML = `<span><b>+</b>สร้างตัวละคร</span>`;
      b.onclick = openCreate;
      box.appendChild(b);
      continue;
    }
    const card = document.createElement("div");
    card.className = "slot-card";
    card.innerHTML = `<canvas width="64" height="64"></canvas><div class="cn"></div>
      <div class="cj">${esc(c.jobName)} · Lv.${c.level}</div>
      <button type="button" class="btn-gold play">เล่น</button><button type="button" class="link del">ลบ</button>`;
    card.querySelector(".cn").textContent = c.name;
    const cv = card.querySelector("canvas");
    cv.dataset.look = c.look; cv.dataset.job = c.job; cv.dataset.gear = c.gear || "";
    drawLook(cv, c.look, c.job, 0, 2);
    card.querySelector(".play").onclick = (e) => enterGame(c, e.target);
    card.querySelector(".del").onclick = () => deleteChar(c);
    box.appendChild(card);
  }
}

async function deleteChar(c) {
  const typed = prompt(`ลบ "${c.name}" ถาวร กู้คืนไม่ได้\nพิมพ์ชื่อตัวละครเพื่อยืนยัน`);
  if (typed === null) return;
  if (typed.trim() !== c.name) return setErr("selectErr", "ชื่อไม่ตรง ยกเลิกการลบ");
  try { await api("DELETE", "/api/chars/" + encodeURIComponent(c.id)); openSelect(); }
  catch (e) { setErr("selectErr", e.message); }
}

// =============================================================
//  หน้าสร้างตัวละคร
// =============================================================
const saved = (storeGet("pn_look2") || "m|light|spiked|chestnut").split("|");
const look = { sex: saved[0], skin: saved[1], hair: saved[2], color: saved[3] };
let previewDir = 0;
const lookStr = () => [look.sex, look.skin, look.hair, look.color].join("|");

function chipGroup(el, items, key, swatch) {
  el.innerHTML = "";
  el.setAttribute("role", "radiogroup");
  items.forEach(([val, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = swatch ? "chip swatch" : "chip";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(look[key] === val));
    if (swatch) { b.style.background = label; b.setAttribute("aria-label", val); } else b.textContent = label;
    b.onclick = () => {
      look[key] = val;
      if (key === "sex") { look.hair = LOOK_OPTS.hair[val][0][0]; buildCreator(); return; }
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      drawPreview();
    };
    el.appendChild(b);
  });
}
function buildCreator() {
  if (!LOOK_OPTS.hair[look.sex].some(([v]) => v === look.hair)) look.hair = LOOK_OPTS.hair[look.sex][0][0];
  chipGroup($("optSex"), LOOK_OPTS.sex, "sex");
  chipGroup($("optSkin"), LOOK_OPTS.skin, "skin", true);
  chipGroup($("optHair"), LOOK_OPTS.hair[look.sex], "hair");
  chipGroup($("optColor"), LOOK_OPTS.color, "color", true);
  drawPreview();
}
function drawPreview() {
  const cv = $("previewCanvas");
  if (cv) drawLook(cv, lookStr(), "villager", 1 + animFrame, [2, 1, 0, 3][previewDir]);
}
$("turnBtn").onclick = () => { previewDir = (previewDir + 1) % 4; drawPreview(); };
function openCreate() {
  showScreen("scrCreate");
  setErr("createErr");
  $("nameInput").value = "";
  buildCreator();
  $("nameInput").focus();
}
$("backBtn").onclick = openSelect;
$("nameInput").addEventListener("keydown", (e) => e.key === "Enter" && $("createBtn").click());
$("createBtn").onclick = async () => {
  const name = $("nameInput").value.trim();
  if (!name) return setErr("createErr", "ใส่ชื่อตัวละครก่อน");
  $("createBtn").disabled = true;
  try {
    await api("POST", "/api/chars", { name, look: lookStr() });
    storeSet("pn_look2", lookStr());
    openSelect();
  } catch (e) { setErr("createErr", e.message); }
  finally { $("createBtn").disabled = false; }
};

// =============================================================
//  เข้าเกม
// =============================================================
// เข้าห้องของแผนที่ที่ตัวละครอยู่ (ถ้าเซิร์ฟเวอร์บอกว่าอยู่แผนที่อื่น → เข้าห้องนั้นแทน)
async function joinMap(client, c, mapId, tries = 0, warp = false) {
  try { const r = await client.joinOrCreate("world", { token: await getToken(), charId: c.id, mapId, warp }); r.mapId = mapId; return r; }
  catch (e) {
    const m = /MAP:(\w+)/.exec(e.message || "");
    if (m && tries < 2) return joinMap(client, c, m[1], tries + 1, warp);
    throw e;
  }
}
async function enterGame(c, btn) {
  btn.disabled = true;
  setErr("selectErr");
  try {
    MANIFEST = await (await fetch("/assets/manifest.json")).json();
    if (!WORLD) WORLD = await (await fetch("/api/world")).json();
    gameClient = new Colyseus.Client(SERVER_URL);
    myChar = c;
    room = await joinMap(gameClient, c, c.map || "town");
    bindRoom(room);
    myCharId = c.id;
    clearInterval(animTimer);
    restoreChat();
    $("login").remove();
    $("hud").hidden = false;
    $("exitBtn").onclick = async () => { await room.leave(); location.reload(); };
    startGame();
  } catch (err) {
    console.error(err);
    setErr("selectErr", err.message || "เข้าเกมไม่ได้ ลองใหม่อีกครั้ง");
    btn.disabled = false;
    const t = $("travel"); if (t) t.classList.remove("show");
  }
}
// ผูกข้อความจากห้อง (เรียกทุกครั้งที่เข้าห้องใหม่ — ตอนเข้าเกมและตอนย้ายแผนที่)
function bindRoom(room) {
    room.onMessage("warp", (w) => travelTo(myChar, w));
    room.onMessage("sold", () => { sellCart.clear(); renderShop(); });
    room.onMessage("bought", () => { buyCart.clear(); renderShop(); });
    room.onMessage("online", (n) => { $("online").textContent = n; });
    room.onMessage("system", (text) => addChat("system", esc(text)));
    room.onMessage("maint", (info) => onMaint(info));
    room.onMessage("restart", () => addChat("system", "🔄 เซิร์ฟเวอร์กำลังอัปเดตเวอร์ชันใหม่ — บันทึกตัวละครแล้ว จะเชื่อมต่อใหม่อัตโนมัติ"));
    room.onMessage("announce", (text) => { addChat("system", "📢 ประกาศ: " + esc(text)); showAnnounce(text); });
    room.onMessage("chat", ({ id, name, text }) => {
      addChat("chat", `<span class="cname">${esc(name)}:</span> ${esc(text)}`);
      saveChat();
      const v = scene && scene.views.get(id);
      if (v) scene.showBubble(v, text);
    });
    room.onMessage("toast", toast);
    room.onMessage("quest", (q) => onQuest(q));
    room.onMessage("jobChanged", (d) => onJobChanged(d));
    room.onMessage("buff", (b) => onBuff(b));
    room.onMessage("skills", (d) => onSkills(d));
    room.onMessage("bossCast", (c) => scene && scene.bossCast(c));
    room.onMessage("mobCharge", (c) => scene && scene.mobCharge(c));
    room.onMessage("mobFx", (c) => scene && scene.mobFx(c));
    room.onMessage("bossSlam", (c) => scene && scene.bossSlam(c));
    room.onMessage("bossRage", (c) => scene && scene.bossRage(c));
    room.onLeave((code) => {
      if (code === 4001) addChat("system", "ตัวละครนี้ถูกเข้าเกมจากหน้าต่างอื่น — การเชื่อมต่อนี้ถูกปิดแล้ว");
      else if (code === 4002) addChat("system", "ถูกแอดมินนำออกจากเกม — รีเฟรชหน้าเพื่อเข้าใหม่");
      else if (code === 4003) showDownScreen("maint");
      else if (code === 4005 || leavingForWarp) return;
      else if (code !== 1000) showDownScreen(code === 4004 ? "restart" : "lost");
    });
}

initAuth();

// =============================================================
//  ฉากเกม
// =============================================================
class WorldScene extends Phaser.Scene {
  constructor() { super("world"); }

  preload() {
    const season = (WORLD && WORLD.maps.find((m) => m.id === room.mapId) || {}).season || "summer";
    this.tKey = "terrain_" + season; this.oKey = "obj_" + season;
    this.load.on("progress", (v) => setTravelProgress(35 + v * 45, "โหลดภาพแผนที่…"));
    this.load.image(this.tKey, `/assets/terrain_${season}.png`);
    this.load.atlas(this.oKey, `/assets/objects_${season}.png`, `/assets/objects_${season}.json`);
    const paths = new Set();
    for (const [sex] of LOOK_OPTS.sex) {
      for (const [skin] of LOOK_OPTS.skin) paths.add(`look/base_${sex}_${skin}`);
      for (const j of ["villager", "guardian", "slayer", "hunter", "mage", "healer"]) paths.add(`look/outfit_${j}_${sex}`);
      for (const [h] of LOOK_OPTS.hair[sex]) for (const [c] of LOOK_OPTS.color) paths.add(`look/hair_${h}_${c}`);
    }
    paths.forEach((p) => this.load.image(p, `/assets/${p}.png`));
    (MANIFEST.mobs || MOB_KINDS).forEach((k) => this.load.image("mobsrc_" + k, `/assets/mobs/${k}.png`));
    MANIFEST.equip.forEach((k) => this.load.image("equip/" + k, `/assets/equip/${k}.png`));
    // ท่าฟันของอาวุธประชิด (เฟรมใหญ่กว่าตัวละคร เลยแยกเป็นภาพซ้อนตอนฟัน)
    for (const [id, f] of Object.entries(MANIFEST.atk || {})) {
      this.load.spritesheet("atk_" + id, `/assets/equip/${id}_atk.png`, { frameWidth: f, frameHeight: f });
      this.load.spritesheet("atkb_" + id, `/assets/equip/${id}_atkb.png`, { frameWidth: f, frameHeight: f });
    }
    MANIFEST.icons.forEach((k) => this.load.image("icon/" + k, `/assets/icons/${k}.png`));
    (MANIFEST.pets || []).forEach((k) => this.load.spritesheet("pet/" + k, `/assets/pets/${k}.png`, { frameWidth: 32, frameHeight: 32 }));
    this.load.image("npcsrc_merchant", "/assets/npc_merchant.png");
    this.load.image("npcsrc_smith", "/assets/npc_smith.png");
    this.load.image("npcsrc_jobmaster", "/assets/npc_jobmaster.png");
    for (const k of ["potion", "weapon", "armor"]) this.load.image("npcsrc_" + k, `/assets/npc_${k}.png`);
  }

  create() {
    for (const id of Object.keys(MANIFEST.atk || {})) for (const k of ["atk_", "atkb_"]) for (const dir in DIR_ROW) {
      const key = `${k}${id}:${dir}`;
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(k + id, { start: DIR_ROW[dir] * 6, end: DIR_ROW[dir] * 6 + 5 }), frameRate: 16 });
    }
    scene = this;
    this.input.setDefaultCursor(CUR.arrow);
    this.views = new Map();      // id -> ตัวละคร/มอนสเตอร์บนจอ
    this.trees = [];
    this.lastDir = { dx: 0, dy: 0 };
    this.myTarget = null;
    this.cdEnd = {};
    this.zoomIdx = window.innerWidth >= 1000 ? 2 : 1;
    const cam = this.cameras.main;
    cam.setZoom(ZOOMS[this.zoomIdx]).setBackgroundColor("#22401f").setRoundPixels(true);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";

    (MANIFEST.mobs || MOB_KINDS).forEach((k) => this.buildSheet("mob_" + k, ["mobsrc_" + k]));
    this.targetRing = this.add.ellipse(0, 0, 34, 14).setStrokeStyle(2, 0xff5a5a, 0.9).setDepth(-9000).setVisible(false);

    setTravelProgress(82, "รับข้อมูลแผนที่…");
    room.onMessage("map", (data) => {
      setTravelProgress(90, "สร้างแผนที่…");
      gameData = data; this.buildMap(data); buildSkillBar(); sendAutoCfg();
      setTravelProgress(100, "พร้อมแล้ว");
      setTimeout(() => { const t = $("travel"); if (t) t.classList.remove("show"); }, 350);
      setTimeout(continueTravel, 600); // เดินทางอัตโนมัติไปแผนที่ปลายทางต่อ
      $("apClose").onclick = () => toggleAutoPanel(false);
      if (!window._statsUI) { window._statsUI = 1; setupStats(); } else renderStats();
      if (!window._itemsUI) { window._itemsUI = 1; setupItemsUI(); setupWorldUI(); } else renderItemBar();
    });
    // วงขอบเขต AUTO บนพื้น
    this.autoRing = this.add.ellipse(0, 0, 10, 10, 0xffd36b, 0.08).setStrokeStyle(3, 0xffd36b, 0.85)
      .setDepth(-9500).setVisible(false);
    room.send("getMap");

    const $s = Colyseus.getStateCallbacks(room);
    $s(room.state).players.onAdd((p, id) => {
      const v = this.createView(p, id, false);
      $s(p).onChange(() => this.syncView(v, p));
      if (id === room.sessionId) {
        this.cameras.main.startFollow(v.root, true, 0.15, 0.15);
        drawAvatar(v.key);
        updateStatus(p);
      }
      this.updateOnline();
    });
    $s(room.state).players.onRemove((_p, id) => this.removeView(id));
    $s(room.state).monsters.onAdd((m, id) => {
      const v = this.createView(m, id, true);
      $s(m).onChange(() => this.syncView(v, m));
    });
    $s(room.state).monsters.onRemove((_m, id) => this.removeView(id));
    // สัตว์เลี้ยง
    this.petViews = new Map();
    $s(room.state).pets.onAdd((pet, id) => {
      const pv = { tx: pet.x, ty: pet.y, dir: pet.dir, moving: false, kind: pet.kind, seed: Math.random() * 1000 };
      pv.sh = this.add.ellipse(pet.x, pet.y, 16, 6, 0x000000, 0.25);
      pv.sp = this.add.sprite(pet.x, pet.y - 22, "pet/" + pet.kind, 0).setOrigin(0.5, 1);
      pv.sp.x = pv.sh.x = pet.x;
      this.petViews.set(id, pv);
      $s(pet).onChange(() => {
        pv.tx = pet.x; pv.ty = pet.y; pv.dir = pet.dir; pv.moving = pet.moving;
        if (pet.kind !== pv.kind) { pv.kind = pet.kind; pv.sp.setTexture("pet/" + pet.kind, 0); }
      });
    });
    $s(room.state).pets.onRemove((_p, id) => {
      const pv = this.petViews.get(id);
      if (pv) { pv.sp.destroy(); pv.sh.destroy(); this.petViews.delete(id); }
    });
    this.dropViews = new Map();
    $s(room.state).drops.onAdd((d, id) => this.addDrop(d, id));
    $s(room.state).drops.onRemove((_d, id) => {
      const o = this.dropViews.get(id);
      if (o) { const g = o.getData("glow"); if (g) g.destroy(); o.destroy(); }
      this.dropViews.delete(id);
    });
    room.onMessage("inv", (v) => {
      onInv(v);
      const me = this.views.get(room.sessionId);
      if (v.goldGain && v.at) this.floatText(v.at.x, v.at.y - 40, `+${v.goldGain} gold`, "#ffd36b", 12, 1000);
    });
    room.onMessage("loot", ({ item, n, r }) => {
      const me = this.views.get(room.sessionId), it = gameData && gameData.items[item];
      const col = it && it.type === "equip" && r > 0 ? gameData.rarity[r].color : "#9fe3ff";
      if (me && it) this.floatText(me.root.x, me.root.y - 88, `+${it.name}${n > 1 ? " ×" + n : ""}`, col, 12, 1100);
    });

    // ---------- เหตุการณ์ต่อสู้ ----------
    room.onMessage("atk", ({ id, dir, fx, tgt, mob }) => {
      if (mob && fx) { // มอนยิงจากระยะไกล
        this.playOnce(id, "cast", dir, 440);
        this.time.delayedCall(200, () => this.projectile(id, tgt, fx));
        return;
      }
      // ธนู: น้าวสายแล้วปล่อยลูกศรตอนเฟรมปล่อย · คทา/คัมภีร์: ชี้ไปข้างหน้าแล้วยิงลูกเวท
      if (fx === "arrow") { this.playOnce(id, "aim", dir, 560); this.time.delayedCall(SHOOT_RELEASE_MS, () => this.projectile(id, tgt, "arrow")); }
      else if (fx) { this.playOnce(id, this.hasAnim(id, "thrust") ? "thrust" : "cast", dir, 440); this.time.delayedCall(CAST_RELEASE_MS, () => this.projectile(id, tgt, fx)); }
      else this.playOnce(id, "slash", dir, 380);
    });
    room.onMessage("skillfx", (f) => this.skillFx(f, false));
    room.onMessage("cast", (f) => this.skillFx(f, true));
    room.onMessage("hit", (h) => this.onHit(h));
    room.onMessage("heal", ({ id, amount }) => {
      const v = this.views.get(id);
      if (v) this.floatText(v.root.x, v.root.y - 72, "+" + amount, "#7dff9a", 15);
    });
    room.onMessage("exp", (n) => {
      const v = this.views.get(room.sessionId);
      if (v) this.floatText(v.root.x, v.root.y - 88, `+${n} EXP`, "#c9a6ff", 12, 1100);
    });
    room.onMessage("lvup", ({ id, job }) => this.levelUpFx(id, job));
    room.onMessage("cd", ({ skill, until }) => { this.cdEnd[skill] = performance.now() + until; });
    room.onMessage("refined", (res) => onRefined(res));
    room.onMessage("derived", (d) => { derived = d; renderStats(); });

    // ---------- คลิก ----------
    this.input.on("pointerdown", (p, over) => {
      if (document.activeElement === $("chatInput")) $("chatInput").blur();
      const drop = over.find((o) => o.getData && o.getData("dropId"));
      if (drop) { this.myTarget = null; room.send("pickup", { id: drop.getData("dropId") }); return; }
      const npc = over.find((o) => o.getData && o.getData("npcId"));
      if (npc) {
        const n = npc.getData("npc");
        this.myTarget = null; this.pendingNpc = n;
        room.send("moveTo", { x: n.x, y: n.y + 40 });
        return;
      }
      let hit = over.find((o) => o.getData && o.getData("mobId"));
      // จอสัมผัส: นิ้วใหญ่กว่าเมาส์ → แตะใกล้ ๆ มอน (ไม่เกิน ~1 ช่อง) ก็นับว่าเลือกมอนตัวนั้น
      if (!hit && p.wasTouch) {
        let bd = 34 / this.cameras.main.zoom + 14;
        this.views.forEach((v) => {
          if (!v.isMob || v.dead) return;
          const d = Math.hypot(v.root.x - p.worldX, v.root.y - 26 - p.worldY);
          if (d < bd) { bd = d; hit = v.sprite; }
        });
      }
      if (hit) {
        this.myTarget = hit.getData("mobId");
        room.send("attack", { id: this.myTarget });
        return;
      }
      this.myTarget = null;
      stopTravel();
      room.send("moveTo", { x: p.worldX, y: p.worldY });
      this.clickMarker(p.worldX, p.worldY);
    });
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT", false);
    $("zoomIn").onclick = () => this.setZoomIdx(this.zoomIdx + 1);
    $("zoomOut").onclick = () => this.setZoomIdx(this.zoomIdx - 1);
    if (!window._onceUI) { window._onceUI = 1; setupChat(this); setupHotkeys(); }
    this.time.addEvent({ delay: 100, loop: true, callback: renderCooldowns });
  }

  setZoomIdx(i) {
    this.zoomIdx = Phaser.Math.Clamp(i, 0, ZOOMS.length - 1);
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";
  }

  // ---------- ประกอบภาพตัวละครจากหลายชั้น (ตัว + ชุด + ผม) ----------
  // tint = ย้อมสีมอน (อบสีลงภาพเลย — ใช้ได้ทั้งโหมด WebGL และ Canvas)
  // อุปกรณ์เลเวลสูง (equipLazy) ไม่โหลดล่วงหน้า → โหลดตอนมีคนใส่ แล้วประกอบภาพตัวละครใหม่
  lazySheet(key, layers) {
    const miss = layers.filter((k) => !this.textures.exists(k));
    if (!miss.length) return this.buildSheet(key, layers);
    this.lazyLoad(miss.map((k) => [k, `/assets/${k}.png`]));
    return this.buildSheet(`${key}~${miss.length}`, layers.filter((k) => this.textures.exists(k)));
  }
  prefetchAtk(gear) { // โหลดภาพท่าฟันของอาวุธเลเวลสูงไว้ก่อนฟันครั้งแรก
    const m = /(?:^|,)weapon:([^,]+)/.exec(gear || ""), wid = m && m[1], lz = wid && (MANIFEST.atkLazy || {})[wid];
    if (lz) this.lazyLoad([["atk_" + wid, `/assets/equip/${wid}_atk.png`], ["atkb_" + wid, `/assets/equip/${wid}_atkb.png`]], lz);
  }
  lazyLoad(list, sheet) {
    this.lazyPending = this.lazyPending || new Set();
    let added = 0;
    for (const [k, url] of list) {
      if (this.lazyPending.has(k) || this.textures.exists(k)) continue;
      this.lazyPending.add(k); added++;
      if (sheet) this.load.spritesheet(k, url, { frameWidth: sheet, frameHeight: sheet }); else this.load.image(k, url);
    }
    if (!added) return;
    if (!this.lazyHooked) {
      this.lazyHooked = true;
      this.load.on("complete", () => {
        this.lazyPending.clear();
        // สร้างท่าฟันของอาวุธที่เพิ่งโหลด แล้วประกอบภาพตัวละครที่ใส่ของนั้นใหม่
        for (const [id] of Object.entries(MANIFEST.atkLazy || {})) for (const kk of ["atk_", "atkb_"]) if (this.textures.exists(kk + id))
          for (const dir in DIR_ROW) { const key = `${kk}${id}:${dir}`; if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(kk + id, { start: DIR_ROW[dir] * 6, end: DIR_ROW[dir] * 6 + 5 }), frameRate: 16 }); }
        if (this.views) this.views.forEach((v) => { if (!v.isMob && v.key && v.key.includes("~")) { v.gear = null; this.syncView(v, v.e); } });
      });
    }
    this.load.start();
  }

  buildSheet(key, layerKeys, tint) {
    if (this.textures.exists(key)) return key;
    // ภาพผู้เล่นสูง 21 แถว (มีท่ายิงธนู/แทงคทา) · มอน/NPC 13 แถว
    const H = Math.max(832, ...layerKeys.map((k) => this.textures.get(k).getSourceImage().height || 0));
    const tex = this.textures.createCanvas(key, 576, H);
    const ctx = tex.getContext();
    for (const k of layerKeys) ctx.drawImage(this.textures.get(k).getSourceImage(), 0, 0);
    if (tint && tint !== 0xffffff) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "#" + tint.toString(16).padStart(6, "0");
      ctx.fillRect(0, 0, 576, H);
      ctx.globalCompositeOperation = "destination-in";
      for (const k of layerKeys) ctx.drawImage(this.textures.get(k).getSourceImage(), 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
    for (let i = 0; i < COLS * (H / 64); i++) tex.add(i, 0, (i % COLS) * 64, Math.floor(i / COLS) * 64, 64, 64);
    tex.refresh();
    const seq = (row, from, to) => { const f = []; for (let c = from; c <= to; c++) f.push({ key, frame: row * COLS + c }); return f; };
    for (const dir in DIR_ROW) {
      const d = DIR_ROW[dir];
      this.anims.create({ key: `${key}:walk:${dir}`, frames: seq(d, 1, 8), frameRate: 12, repeat: -1 });
      this.anims.create({ key: `${key}:slash:${dir}`, frames: seq(4 + d, 0, 5), frameRate: 16 });
      this.anims.create({ key: `${key}:cast:${dir}`, frames: seq(9 + d, 0, 6), frameRate: 14 });
      if (H >= 1344) {
        this.anims.create({ key: `${key}:shoot:${dir}`, frames: seq(13 + d, 0, 8), frameRate: 16 });  // น้าวธนูยิง
        this.anims.create({ key: `${key}:thrust:${dir}`, frames: seq(17 + d, 0, 7), frameRate: 18 }); // ชี้คทา/คัมภีร์
        this.anims.create({ key: `${key}:aim:${dir}`, frames: seq(13 + d, 0, 8), frameRate: 16 });
      } else this.anims.create({ key: `${key}:aim:${dir}`, frames: seq(d, 0, 0), frameRate: 10 });
    }
    this.anims.create({ key: `${key}:die`, frames: seq(8, 0, 5), frameRate: 10 });
    return key;
  }

  // ---------- แผนที่ ----------
  buildMap(map) {
    this.map = map;
    const { width: W, height: H, ground, objects } = map;
    const tex = this.textures.get(this.tKey);
    const full = (c, r) => { const n = `t${c}_${r}`; if (!tex.has(n)) tex.add(n, 0, c * T, r * T, T, T); return n; };
    const quad = (c, r, qx, qy) => {
      const n = `q${c}_${r}_${qx}${qy}`;
      if (!tex.has(n)) tex.add(n, 0, c * T + qx * 16, r * T + qy * 16, 16, 16);
      return n;
    };
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ground[y * W + x]);
    const grassy = (x, y) => at(x, y) !== 1;
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const GRASS = [[3, 2], [4, 2], [5, 2], [3, 1], [4, 1], [5, 1], [1, 1]];
    const DIRT = [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]];

    const rt = this.add.renderTexture(0, 0, W * T, H * T).setOrigin(0).setDepth(-1e6);
    rt.beginDraw();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = at(x, y), px = x * T, py = y * T, h = hash(x, y);
        const dirt = DIRT[h % DIRT.length];
        if (v === 1) { rt.batchDrawFrame(this.tKey, full(dirt[0], dirt[1]), px, py); continue; }
        if (v === 2) {
          const c = at(x - 1, y) !== 2 ? 0 : at(x + 1, y) !== 2 ? 2 : 1;
          const r = at(x, y - 1) !== 2 ? 10 : at(x, y + 1) !== 2 ? 12 : 11;
          rt.batchDrawFrame(this.tKey, full(c, r), px, py);
          continue;
        }
        const g = GRASS[h % 11 < 9 ? h % 3 : 3 + (h % 4)];
        const n = grassy(x, y - 1), s = grassy(x, y + 1), w = grassy(x - 1, y), e = grassy(x + 1, y);
        const all = n && s && w && e && grassy(x - 1, y - 1) && grassy(x + 1, y - 1) && grassy(x - 1, y + 1) && grassy(x + 1, y + 1);
        if (all) { rt.batchDrawFrame(this.tKey, full(g[0], g[1]), px, py); continue; }
        rt.batchDrawFrame(this.tKey, full(dirt[0], dirt[1]), px, py);
        for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
          const hn = qx ? e : w, vn = qy ? s : n;
          const dn = grassy(x + (qx ? 1 : -1), y + (qy ? 1 : -1));
          let c, r;
          if (hn && vn) {
            if (dn) { c = g[0]; r = g[1]; } else { c = qx ? 0 : 1; r = 6 + (qy ? 0 : 1); }
          } else { c = hn ? 1 : qx ? 2 : 0; r = vn ? 1 : qy ? 2 : 0; }
          rt.batchDrawFrame(this.tKey, quad(c, r, qx, qy), px + qx * 16, py + qy * 16);
        }
      }
    }
    const flat = /^(wf|flower)/;
    for (const o of objects) {
      if (!flat.test(o.k)) continue;
      const f = this.textures.getFrame(this.oKey, o.k);
      rt.batchDrawFrame(this.oKey, o.k, o.x - (f.width >> 1), o.y - f.height);
    }
    rt.endDraw();

    for (const o of objects) {
      if (flat.test(o.k)) continue;
      const img = this.add.image(o.x, o.y, this.oKey, o.k).setOrigin(0.5, 1).setDepth(o.y);
      if (o.b && /oak|pine|dead/.test(o.k)) {
        this.add.image(o.x + 4, o.y - 2, this.oKey, "shadow").setAlpha(0.28).setScale(1.1, 0.8).setDepth(-1e5);
        this.trees.push(img);
      }
    }
    this.cameras.main.setBounds(0, 0, W * T, H * T);
    this.buildNpcs(map.npcs || []);
    this.buildPortals(map.portals || []);
    $("mapName").textContent = map.name + (map.lv ? ` Lv.${map.lv[0]}–${map.lv[1]}` : " · ปลอดภัย");
    if (map.online) $("online").textContent = map.online;
    buildMinimap(map);
  }

  // ทางออกไปแผนที่อื่น: วงเวทเรืองแสง + ป้ายชื่อปลายทาง
  buildPortals(list) {
    for (const p of list) {
      const x = (p.box.x0 + p.box.x1) / 2, y = (p.box.y0 + p.box.y1) / 2;
      const ring = this.add.ellipse(x, y, 92, 40, 0x7fd1ff, 0.18).setStrokeStyle(3, 0x9fe3ff, 0.9).setDepth(-9000);
      const inner = this.add.ellipse(x, y, 56, 22, 0xffffff, 0.12).setDepth(-8999);
      this.tweens.add({ targets: [ring, inner], alpha: { from: 1, to: 0.45 }, duration: 900, yoyo: true, repeat: -1 });
      const lv = p.toLv ? ` Lv.${p.toLv[0]}–${p.toLv[1]}` : " (เมือง)";
      const ly = p.edge === "N" ? y + 44 : y - 30;
      this.add.text(x, ly, `${{ N: "▲", S: "▼", W: "◀", E: "▶" }[p.edge]} ${p.toName}${lv}`, {
        fontFamily: "Mitr, sans-serif", fontSize: "12px", color: "#bfeaff", stroke: "#0d1124", strokeThickness: 4, resolution: 2,
      }).setOrigin(0.5, 0.5).setDepth(1e5);
    }
  }

  // ---------- ตัวละคร / มอนสเตอร์ ----------
  createView(e, id, isMob) {
    const isMe = id === room.sessionId;
    const mobSprite = e.sprite || e.kind;
    const key = isMob ? (e.tint && e.tint !== 0xffffff ? this.buildSheet(`mob_${mobSprite}_${e.tint}`, ["mobsrc_" + mobSprite], e.tint) : "mob_" + mobSprite) : this.lazySheet(`pl_${e.job}_${e.look}_${e.gear || ""}`, layersFor(e.look, e.job, e.gear));
    if (!isMob) this.prefetchAtk(e.gear);
    const root = this.add.container(e.x, e.y);
    const shadow = this.add.ellipse(0, -1, 26, 9, 0x000000, 0.28);
    const sprite = this.add.sprite(0, 0, key, DIR_ROW[e.dir || "down"] * COLS).setOrigin(0.5, 0.97);
    const label = this.add.text(0, -58, "", {
      fontFamily: "Mitr, sans-serif", fontSize: "11px", color: "#ffffff",
      stroke: "#0d1124", strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1);
    const bars = this.add.graphics();
    // ภาพอาวุธตอนฟัน: หลังตัว (wbg) และหน้าตัว (wfg) — จุดกึ่งกลางตรงกับกลางเฟรมตัวละคร
    const wbg = this.add.sprite(0, -30, "__DEFAULT").setVisible(false);
    const wfg = this.add.sprite(0, -30, "__DEFAULT").setVisible(false);
    root.add([shadow, wbg, sprite, wfg, bars, label]);
    if (isMob && e.scale && e.scale !== 1) { sprite.setScale(e.scale); shadow.setScale(e.scale); label.y = -58 * e.scale; }
    if (isMob) {
      sprite.setInteractive({ hitArea: new Phaser.Geom.Rectangle(18, 12, 28, 50), hitAreaCallback: Phaser.Geom.Rectangle.Contains, cursor: CUR.sword });
      sprite.setData("mobId", id);
      sprite.on("pointerover", () => { v.hover = true; });
      sprite.on("pointerout", () => { v.hover = false; });
    }
    const v = { id, isMob, isMe, key, root, sprite, label, bars, wbg, wfg, bubble: null, e, gear: e.gear || "", job: e.job,
      tx: e.x, ty: e.y, dir: e.dir || "down", moving: false, dead: false, deadShown: false, busyUntil: 0 };
    this.views.set(id, v);
    this.syncView(v, e);
    return v;
  }

  syncView(v, e) {
    v.tx = e.x; v.ty = e.y; v.moving = e.moving; v.dir = e.dir || v.dir;
    if (v.dead !== e.dead) {
      v.dead = e.dead;
      if (!v.dead) { v.deadShown = false; v.root.setAlpha(1); if (v.isMob) v.sprite.setInteractive(); }
      else {
        if (v.isMob) { v.sprite.disableInteractive(); if (this.myTarget === v.id) this.myTarget = null; }
        if (v.isMe) { $("deathMsg").hidden = false; stopTravel(); }
      }
      if (v.isMe && !v.dead) $("deathMsg").hidden = true;
    }
    const lv = e.level;
    if (v.isMob) {
      const me = room.state.players.get(room.sessionId);
      const diff = me ? lv - me.level : 0;
      v.label.setColor(diff >= 6 ? "#ff6b6b" : diff >= 3 ? "#ffb86b" : diff <= -6 ? "#9aa0b4" : "#ffffff");
      v.label.setText(`${e.name}  Lv.${lv}`);
      this.syncRank(v, e);
      if (e.boss) v.label.setColor("#ffb84a").setText(`👑 ${e.name}  Lv.${lv}`).setY(-58 * (e.scale || 1) + 4);
    } else {
      if ((e.gear || "") !== v.gear || e.job !== v.job) { // เปลี่ยนอุปกรณ์/อาชีพ → ประกอบภาพตัวละครใหม่
        v.gear = e.gear || ""; v.job = e.job;
        v.key = this.lazySheet(`pl_${e.job}_${e.look}_${v.gear}`, layersFor(e.look, e.job, v.gear));
        this.prefetchAtk(v.gear);
        v.glowStr = null;
        v.sprite.setTexture(v.key, DIR_ROW[v.dir] * COLS);
        if (v.isMe) { drawAvatar(v.key); if (typeof renderPaperDoll === "function") renderPaperDoll(); }
      }
      if ((e.glow || "") !== v.glowStr) this.buildGlow(v, e);
      v.label.setColor(v.isMe ? "#ffd36b" : "#ffffff");
      if (v.isMe && e.job !== v.lastJob) { v.lastJob = e.job; if (gameData) { buildSkillBar(); if (typeof renderQuestTrack === "function") renderQuestTrack(); } }
      v.label.setText(`${e.name}  Lv.${lv}`);
      if (v.isMe) {
        updateStatus(e);
        if (v.auto !== e.auto && e.auto) toast("เปิด AUTO — ตีมอนรอบ ๆ จุดนี้");
        v.auto = e.auto;
        renderAuto(e.auto, e.autoState);
      }
    }
    this.drawBars(v);
  }

  drawBars(v) {
    const e = v.e, g = v.bars, w = 30;
    g.clear();
    if (v.dead) return;
    if (v.isMob) {
      if (e.hp >= e.maxHp && this.myTarget !== v.id) return;
      g.fillStyle(0x0d1124, 0.9).fillRect(-w / 2 - 1, 3, w + 2, 5);
      g.fillStyle(0xe0464e).fillRect(-w / 2, 4, (w * e.hp) / e.maxHp, 3);
      return;
    }
    if (!v.isMe) return;
    g.fillStyle(0x0d1124, 0.9).fillRect(-w / 2 - 1, 3, w + 2, 8);
    g.fillStyle(0x5fd47a).fillRect(-w / 2, 4, (w * e.hp) / e.maxHp, 3);
    g.fillStyle(0x4a8fe0).fillRect(-w / 2, 8, (w * e.sp) / e.maxSp, 2);
  }

  removeView(id) {
    const v = this.views.get(id);
    if (v) v.root.destroy();
    this.views.delete(id);
    this.updateOnline();
  }

  hasAnim(id, kind) { const v = this.views.get(id); return !!(v && this.anims.exists(`${v.key}:${kind}:down`)); }
  playOnce(id, kind, dir, ms, repeat = 0) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    v.dir = dir || v.dir;
    v.busyUntil = this.time.now + ms;
    v.sprite.play({ key: `${v.key}:${kind}:${v.dir}`, repeat });
    this.weaponSwing(v, kind === "slash", repeat);
  }

  // อาวุธประชิดตอนฟัน (ภาพในตัวละครไม่มีอาวุธในท่าฟัน เพราะภาพท่าฟันใหญ่กว่ากรอบ 64 px)
  weaponSwing(v, on, repeat = 0) {
    if (v.isMob || !v.wfg) return;
    const m = /(?:^|,)weapon:([^,]+)/.exec(v.gear || ""), wid = m && m[1];
    const lz = (MANIFEST.atkLazy || {})[wid];
    if (on && lz && !this.anims.exists(`atk_${wid}:down`)) { // อาวุธเลเวลสูง: โหลดภาพท่าฟันครั้งแรกที่ใช้
      this.lazyLoad([["atk_" + wid, `/assets/equip/${wid}_atk.png`], ["atkb_" + wid, `/assets/equip/${wid}_atkb.png`]], lz);
      on = false;
    }
    if (!on || !wid || !((MANIFEST.atk || {})[wid] || lz)) { v.wfg.setVisible(false); v.wbg.setVisible(false); return; }
    for (const [spr, k] of [[v.wfg, "atk_"], [v.wbg, "atkb_"]]) {
      spr.setVisible(true).play({ key: `${k}${wid}:${v.dir}`, repeat });
      spr.once("animationcomplete", () => spr.setVisible(false));
    }
  }

  // ---------- ของบนพื้น / NPC ----------
  addDrop(d, id) {
    const key = "icon/" + d.item;
    const img = this.add.image(d.x, d.y, this.textures.exists(key) ? key : "icon/gold").setScale(0.75).setDepth(d.y - 20);
    img.setInteractive({ cursor: CUR.hand });
    img.setData("dropId", id);
    const it = gameData && gameData.items[d.item];
    // อุปกรณ์ระดับดีขึ้นไป → มีแสงสีตามระดับใต้ไอเทม
    const rar = it && it.type === "equip" && gameData.rarity && gameData.rarity[d.r || 0];
    if (rar && d.r > 0) {
      const col = Phaser.Display.Color.HexStringToColor(rar.color).color;
      const glow = this.add.ellipse(d.x, d.y + 2, 30, 12, col, 0.35).setStrokeStyle(1.5, col, 0.9).setDepth(d.y - 21);
      this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });
      img.setData("glow", glow);
    }
    img.on("pointerover", () => showTip(`${it ? it.name : d.item}${rar && d.r > 0 ? ` [${rar.name}]` : ""}${d.n > 1 ? " ×" + d.n : ""}`));
    img.on("pointerout", hideTip);
    this.tweens.add({ targets: img, y: { from: d.y - 18, to: d.y }, duration: 380, ease: "Bounce.easeOut" });
    this.dropViews.set(id, img);
  }
  buildNpcs(list) {
    for (const n of list) {
      const key = this.buildSheet("npc_" + n.id, [n.sprite.replace(/^npc_/, "npcsrc_")]);
      const sp = this.add.sprite(n.x, n.y, key, DIR_ROW.down * COLS).setOrigin(0.5, 0.97).setDepth(n.y);
      sp.setInteractive({ hitArea: new Phaser.Geom.Rectangle(18, 8, 28, 56), hitAreaCallback: Phaser.Geom.Rectangle.Contains, cursor: CUR.talk });
      sp.setData("npcId", n.id); sp.setData("npc", n);
      this.add.ellipse(n.x, n.y - 1, 26, 9, 0x000000, 0.28).setDepth(n.y - 1);
      this.add.text(n.x, n.y - 58, n.name, { fontFamily: "Mitr, sans-serif", fontSize: "11px", color: "#9fe3ff",
        stroke: "#0d1124", strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1).setDepth(n.y);
    }
  }

  // ---------- เอฟเฟกต์ ----------
  onHit({ tgt, src, dmg, crit, miss, poison }) {
    const v = this.views.get(tgt);
    if (!v) return;
    if (poison) { // พิษ: ตัวเลขเขียวเล็ก ๆ เฉพาะคนที่โดน
      if (tgt === room.sessionId) { this.floatText(v.root.x + Phaser.Math.Between(-8, 8), v.root.y - 64, String(dmg), "#7dff6a", 12, 700); v.sprite.setTint(0x9dff8a); this.time.delayedCall(200, () => v.sprite.clearTint()); }
      return;
    }
    const mine = src === room.sessionId, onMe = tgt === room.sessionId;
    if (!mine && !onMe && !v.isMob) return;
    const x = v.root.x + Phaser.Math.Between(-10, 10), y = v.root.y - 72;
    if (miss) { this.floatText(x, y, "MISS", "#c7cbe0", 12); return; }
    const color = onMe ? "#ff5a5a" : crit ? "#ffb03a" : mine ? "#ffffff" : "#c7cbe0";
    this.floatText(x, y, crit ? dmg + "!" : String(dmg), color, crit ? 20 : mine || onMe ? 16 : 12);
    if (!v.dead) {
      v.sprite.setTintFill(0xffffff);
      this.time.delayedCall(70, () => v.sprite.clearTint());
    }
  }

  floatText(x, y, text, color, size, dur = 800) {
    const t = this.add.text(x, y, text, {
      fontFamily: "Mitr, sans-serif", fontSize: size + "px", fontStyle: "bold", color,
      stroke: "#0d1124", strokeThickness: 4, resolution: 2,
    }).setOrigin(0.5).setDepth(1e6);
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: dur, ease: "Cubic.easeOut",
      onComplete: () => t.destroy() });
  }

  sparkle(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const s = this.add.circle(x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-10, 18), 2, color).setDepth(1e6);
      this.tweens.add({ targets: s, y: s.y - Phaser.Math.Between(18, 34), alpha: 0, duration: 700, delay: i * 30,
        onComplete: () => s.destroy() });
    }
  }

  // กระสุน: ลูกธนู / ลูกเวท / แสง จากผู้ใช้ไปหาเป้าหมาย (เวลาเท่ากับที่เซิร์ฟเวอร์รอก่อนคิดดาเมจ)
  projectile(id, tgt, kind, toXY) {
    const a = this.views.get(id), b = tgt && this.views.get(tgt);
    if (!a || (!b && !toXY)) return;
    const x0 = a.root.x, y0 = a.root.y - 30;
    const x1 = b ? b.root.x : toXY.x, y1 = (b ? b.root.y : toXY.y) - 26;
    const d = Math.hypot(x1 - x0, y1 - y0), ms = Math.min(450, 60 + d * 1.4);
    const COL = { magic: 0xc38bff, fire: 0xff8a3a, holy: 0xfff1a0, poison: 0x7dff6a, ice: 0x9fe3ff, dark: 0x9a4ae0, rock: 0xa08060 };
    let o;
    if (kind === "arrow") {
      o = this.add.container(x0, y0, [this.add.rectangle(0, 0, 14, 2, 0x8a5a2b), this.add.triangle(8, 0, 0, -3, 0, 3, 5, 0, 0xe8e8f0), this.add.rectangle(-7, 0, 3, 4, 0xffffff)]);
      o.rotation = Math.atan2(y1 - y0, x1 - x0);
    } else if (kind === "rock") { // หินขว้าง: หมุนไปตามทาง
      o = this.add.container(x0, y0, [this.add.circle(0, 0, 6, 0x6e5a44), this.add.circle(-2, -2, 3, 0xa08a6e)]);
      this.tweens.add({ targets: o, angle: 720, duration: ms });
    } else {
      const c = COL[kind] || 0xffffff;
      o = this.add.container(x0, y0, [this.add.circle(0, 0, kind === "fire" ? 7 : 6, c, 0.35), this.add.circle(0, 0, kind === "fire" ? 4 : 3, 0xffffff, 0.95)]);
      this.tweens.add({ targets: o.list[0], scale: { from: 0.8, to: 1.3 }, duration: 120, yoyo: true, repeat: -1 });
    }
    o.setDepth(1e6 - 1);
    this.tweens.add({ targets: o, x: x1, y: y1, duration: ms, onComplete: () => {
      o.destroy();
      if (kind !== "arrow") this.burst(x1, y1, COL[kind] || 0xffffff, 18);
    } });
  }
  // วงระเบิดสั้น ๆ
  // ---------- แสงตีบวก (+7 ขึ้นไป) ----------
  // +7 จางสุด → +10 แรงสุด · +10 = ตัวเรืองแสง + วงแสงที่พื้น + ประกายลอย · สี = สีธีมของไอเทม (ของทั่วไปไล่ฟ้า → ม่วง → ทอง)
  buildGlow(v, e) {
    v.glowStr = e.glow || "";
    for (const g of v.glows || []) { this.tweens.killTweensOf(g); g.destroy(); }
    v.glows = [];
    if (v.groundGlow) { this.tweens.killTweensOf(v.groundGlow); v.groundGlow.destroy(); v.groundGlow = null; }
    const webgl = this.game.renderer.type === Phaser.WEBGL;
    if (webgl) { if (v.bodyGlow) { this.tweens.killTweensOf(v.bodyGlow); v.bodyGlow = null; } v.sprite.preFX && v.sprite.preFX.clear(); for (const w of [v.wfg, v.wbg]) w.preFX && w.preFX.clear(); }
    v.r10 = null;
    if (!v.glowStr) return;
    if (!gameData) { v.glowStr = null; return; } // ยังไม่ได้ข้อมูลไอเทม → ลองใหม่รอบหน้า
    const sex = String(e.look || "m").split("|")[0];
    const gearMap = Object.fromEntries((v.gear || "").split(",").filter(Boolean).map((x) => x.split(":")));
    const DEF = { 7: "#7fe0ff", 8: "#4f8fff", 9: "#b45cff", 10: "#ff5a28" };
    let top = 0, topCol = null, retry = false;
    for (const [slot, upS] of v.glowStr.split(",").map((x) => x.split(":"))) {
      const up = Number(upS), id = gearMap[slot], it = id && gameData.items[id];
      if (!it) continue;
      const hex = it.glowColor || DEF[Math.min(10, up)], col = Phaser.Display.Color.HexStringToColor(hex).color;
      if (up > top) { top = up; topCol = hex; }
      const str = { 7: 2.5, 8: 3.5, 9: 5, 10: 8 }[Math.min(10, up)];
      for (const [suf, behind] of [["", false], ["_back", true]]) {
        const key = this.textures.exists(`equip/${id}${suf}_${sex}`) ? `equip/${id}${suf}_${sex}` : `equip/${id}${suf}`;
        if (!this.textures.exists(key)) { if (!suf && (MANIFEST.equipLazy || []).some((k) => key.endsWith(k))) retry = true; continue; }
        this.ensureFrames(key);
        const g = this.add.sprite(0, 0, key, v.sprite.frame.name).setOrigin(0.5, 0.97);
        v.root.addAt(g, v.root.getIndex(v.sprite) + (behind ? 0 : 1));
        if (webgl && g.preFX) {
          const fx = g.preFX.addGlow(col, str, 0, true, 0.1, 16);
          this.tweens.add({ targets: fx, outerStrength: { from: str * 0.55, to: str * 1.15 }, duration: up >= 10 ? 650 : 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        } else {
          g.setTintFill(col).setBlendMode(Phaser.BlendModes.ADD).setScale(1.04);
          this.tweens.add({ targets: g, alpha: { from: 0.15 + up * 0.02, to: 0.35 + up * 0.04 }, duration: 800, yoyo: true, repeat: -1 });
        }
        v.glows.push(g);
      }
      if (slot === "weapon" && webgl) for (const w of [v.wfg, v.wbg]) if (w.preFX) w.preFX.addGlow(col, str, 0, false, 0.1, 14); // ท่าฟันก็เรืองแสง
    }
    if (retry) v.glowStr = null; // ภาพอุปกรณ์ยังโหลดไม่เสร็จ → สร้างใหม่ตอนโหลดเสร็จ
    if (top >= 10) { // +10: วงแสงใต้เท้า + ประกายลอย (ตัว/ชุดไม่เรืองแสง)
      v.r10 = topCol;
      const col = Phaser.Display.Color.HexStringToColor(topCol).color;
      v.groundGlow = this.add.ellipse(0, -1, 46, 16, col, 0.35).setBlendMode(Phaser.BlendModes.ADD);
      v.root.addAt(v.groundGlow, 0);
      this.tweens.add({ targets: v.groundGlow, scaleX: { from: 0.85, to: 1.15 }, scaleY: { from: 0.85, to: 1.15 }, alpha: { from: 0.2, to: 0.5 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }
  ensureFrames(key) { // ภาพชิ้นอุปกรณ์ → แบ่งเฟรม 64px แบบเดียวกับภาพตัวละคร
    const tex = this.textures.get(key);
    if (tex.has(0)) return;
    const img = tex.getSourceImage(), rows = Math.floor(img.height / 64);
    for (let i = 0; i < COLS * rows; i++) tex.add(i, 0, (i % COLS) * 64, Math.floor(i / COLS) * 64, 64, 64);
  }

  // ออร่าอาวุธเลเวลสูง: ประกายแสงลอยขึ้นรอบตัวคนที่ถืออยู่
  weaponAura(v, time) {
    if (!gameData || time < (v.auraNext || 0)) return;
    const m = /(?:^|,)weapon:([^,]+)/.exec(v.gear || ""), it = m && gameData.items[m[1]];
    const hex = v.r10 || (it && it.aura);
    if (!hex) return;
    v.auraNext = time + (v.r10 ? 90 : 140) + Math.random() * 120;
    const col = Phaser.Display.Color.HexStringToColor(hex).color;
    const x = v.root.x + (Math.random() - 0.5) * 30, y = v.root.y - 6 - Math.random() * 40;
    const sz = 1 + Math.random() * 1.6;
    const p = this.add.circle(x, y, sz, col, 0.95).setDepth(v.root.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.add.circle(x, y, sz * 2.6, col, 0.25).setDepth(v.root.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: [p, g], y: y - 18 - Math.random() * 14, alpha: 0, duration: 700 + Math.random() * 300, onComplete: () => { p.destroy(); g.destroy(); } });
  }

  // ชั้นยอด (rank 1) = ตัวใหญ่ขึ้น + เรืองแสงทอง · มินิบอส (rank 2) = ใหญ่มาก + เรืองแสงแดง + มงกุฎ
  syncRank(v, e) {
    const sc = e.scale || 1;
    if (v.scaleNow !== sc) { v.scaleNow = sc; v.sprite.setScale(sc); v.root.list[0].setScale(sc); v.label.y = -58 * sc; }
    if (e.rank === 1) v.label.setColor("#ffc04a");
    if (e.rank === 2) v.label.setColor("#ff6a5a").setText(`👑 ${e.name}  Lv.${e.level}`);
    if (v.rankNow === (e.rank || 0)) return;
    v.rankNow = e.rank || 0;
    if (this.game.renderer.type !== Phaser.WEBGL || !v.sprite.preFX) return;
    if (v.rankFx) { this.tweens.killTweensOf(v.rankFx); v.sprite.preFX.remove(v.rankFx); v.rankFx = null; }
    if (v.rankNow) {
      v.rankFx = v.sprite.preFX.addGlow(v.rankNow === 2 ? 0xff4a3a : 0xffc04a, 2, 0, false, 0.1, 10);
      this.tweens.add({ targets: v.rankFx, outerStrength: { from: 1, to: v.rankNow === 2 ? 4 : 3 }, duration: 800, yoyo: true, repeat: -1 });
    }
  }

  // ---------- พฤติกรรมมอน ----------
  mobCharge({ id, x, y, tx, ty, ms }) { // เส้นเตือนก่อนพุ่งชน
    const ang = Math.atan2(ty - y, tx - x), len = Math.hypot(tx - x, ty - y);
    const r = this.add.rectangle(x, y - 6, len, 26, 0xff3a2a, 0.22).setOrigin(0, 0.5).setRotation(ang).setDepth(-7000).setStrokeStyle(2, 0xff5a4a, 0.8);
    const fill = this.add.rectangle(x, y - 6, len, 26, 0xff3a2a, 0.35).setOrigin(0, 0.5).setRotation(ang).setDepth(-6999).setScale(0, 1);
    this.tweens.add({ targets: fill, scaleX: 1, duration: ms });
    this.time.delayedCall(ms + 250, () => { r.destroy(); fill.destroy(); });
    const v = this.views.get(id);
    if (v) { v.sprite.setTint(0xff8a7a); this.time.delayedCall(ms, () => v.sprite.clearTint()); }
  }
  mobFx({ id, kind }) {
    const v = this.views.get(id);
    if (!v) return;
    if (kind === "heal") {
      this.playOnce(id, "cast", v.dir, 500);
      const ring = this.add.circle(v.root.x, v.root.y - 4, 20, 0x7dff9a, 0.25).setStrokeStyle(2, 0x9dffb0, 0.9).setDepth(v.root.depth - 1);
      this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
    } else if (kind === "flee") this.floatText(v.root.x, v.root.y - 70, "!!", "#ffe08a", 16, 700);
  }

  // ---------- World Boss ----------
  bossCast({ id, x, y, r, ms }) {
    const ring = this.add.circle(x, y, r, 0xff2a2a, 0.12).setStrokeStyle(3, 0xff4a4a, 0.95).setDepth(-8000);
    const fill = this.add.circle(x, y, r, 0xff3a2a, 0.32).setDepth(-7999).setScale(0.05);
    this.tweens.add({ targets: fill, scale: 1, duration: ms, ease: "Linear" });
    this.tweens.add({ targets: ring, alpha: { from: 1, to: 0.55 }, duration: 160, yoyo: true, repeat: -1 });
    (this.bossRings = this.bossRings || new Map()).set(id, [ring, fill]);
    const v = this.views.get(id);
    if (v) this.tweens.add({ targets: v.sprite, y: -14, duration: ms * 0.85, ease: "Quad.easeOut", yoyo: false }); // ยกตัวเตรียมทุบ
    this.time.delayedCall(ms + 400, () => { ring.destroy(); fill.destroy(); });
  }
  bossSlam({ id, x, y, r }) {
    const v = this.views.get(id);
    if (v) { this.tweens.killTweensOf(v.sprite); this.tweens.add({ targets: v.sprite, y: 0, duration: 90, ease: "Quad.easeIn" }); }
    const rs = this.bossRings && this.bossRings.get(id);
    if (rs) { rs.forEach((o) => o.destroy()); this.bossRings.delete(id); }
    const w = this.add.circle(x, y, r, 0xffd0a0, 0.45).setDepth(-7990).setScale(0.3);
    this.tweens.add({ targets: w, scale: 1.08, alpha: 0, duration: 380, ease: "Quad.easeOut", onComplete: () => w.destroy() });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.burst(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, 0xc8a070, 20); }
    const me = this.views.get(room.sessionId);
    if (me && Math.hypot(me.root.x - x, me.root.y - y) < r * 2.5) this.cameras.main.shake(260, 0.012);
  }
  bossRage({ id }) {
    const v = this.views.get(id);
    if (!v) return;
    this.tweens.add({ targets: v.sprite, scale: (v.e.scale || 1) * 1.12, duration: 160, yoyo: true, repeat: 2 });
    this.cameras.main.flash(200, 120, 0, 0);
  }
  updateBossBar() {
    let b = null;
    this.views.forEach((v) => { if (v.isMob && v.e.boss && !v.dead) b = v; });
    const el = $("bossBar");
    if (!b) { if (el) el.hidden = true; return; }
    if (!el) return;
    el.hidden = false;
    const pct = Math.max(0, (b.e.hp * 100) / b.e.maxHp);
    // ทิศ + ระยะจากตัวเราไปหาบอส
    const me = this.views.get(room.sessionId);
    let where = "";
    if (me) {
      const dx = b.root.x - me.root.x, dy = b.root.y - me.root.y, tiles = Math.round(Math.hypot(dx, dy) / T);
      const ar = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"][((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
      where = tiles > 6 ? `  ·  ${ar} ${tiles} ช่อง` : "  ·  อยู่ตรงนี้!";
    }
    $("bossName").textContent = `👑 ${b.e.name}  Lv.${b.e.level}${where}`;
    $("bossHpTxt").textContent = `${b.e.hp.toLocaleString()} / ${b.e.maxHp.toLocaleString()} (${pct.toFixed(1)}%)`;
    $("bossFill").style.width = pct + "%";
  }

  burst(x, y, color, r = 30) {
    const c = this.add.circle(x, y, r, color, 0.45).setDepth(1e6 - 2).setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, alpha: 0, duration: 320, onComplete: () => c.destroy() });
  }
  // วงเวทบนพื้น (รัศมีเท่าระยะสกิลจริง)
  groundAoe(x, y, r, color, ms = 520) {
    const g = this.add.ellipse(x, y, r * 2, r * 2 * 0.62, color, 0.28).setStrokeStyle(3, color, 0.95).setDepth(-8500).setScale(0.2);
    this.tweens.add({ targets: g, scale: 1, duration: 180, ease: "Back.easeOut" });
    this.tweens.add({ targets: g, alpha: 0, delay: ms - 220, duration: 220, onComplete: () => g.destroy() });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.9;
      const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr * 0.62;
      const s = this.add.circle(sx, sy, 2.5, color).setDepth(1e6 - 3);
      this.tweens.add({ targets: s, y: sy - 26, alpha: 0, duration: 520, delay: i * 18, onComplete: () => s.destroy() });
    }
  }
  // เอฟเฟกต์สกิล (self = สกิลใช้กับตัวเอง/ร่ายเวท)
  skillFx(f, self) {
    const v = this.views.get(f.id);
    if (!v) return;
    const fx = f.fx || {};
    const wt = f.wt;
    if (self || fx.type === "proj" || fx.type === "aoe" || fx.type === "meteor") {
      if (wt === "bow") this.playOnce(f.id, "aim", f.dir, 560); else this.playOnce(f.id, "cast", f.dir || v.dir, 520);
    } else this.playOnce(f.id, "slash", f.dir, 620, f.skill === "doublehit" ? 1 : 0);
    const tv = f.tgt && this.views.get(f.tgt);
    const S = gameData && gameData.skills[f.skill];
    if (S && (f.id === room.sessionId || (tv && f.id !== room.sessionId))) this.floatText(v.root.x, v.root.y - 92, S.name, "#9fe3ff", 11, 700);
    switch (fx.type) {
      case "heal": {
        const hv = (f.tgtPlayer && this.views.get(f.tgtPlayer)) || v;
        this.sparkle(hv.root.x, hv.root.y - 20, fx.color);
        if (hv !== v) this.burst(hv.root.x, hv.root.y - 24, fx.color, 24);
        break;
      }
      case "ring": {
        const ring = this.add.ellipse(v.root.x, v.root.y - 2, 24, 10).setStrokeStyle(3, fx.color).setDepth(-8000);
        const k = (f.r || 70) / 12;
        this.tweens.add({ targets: ring, scaleX: k, scaleY: k, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
        this.sparkle(v.root.x, v.root.y - 24, fx.color);
        break;
      }
      case "hit":
        if (tv) { this.burst(tv.root.x, tv.root.y - 26, fx.color, 22); this.cameras.main.shake(90, 0.003); }
        if (f.combo && f.id === room.sessionId) this.floatText(v.root.x, v.root.y - 104, `คอมโบ ×${f.combo}`, "#ff9a5a", 13, 900);
        break;
      case "proj":
        this.time.delayedCall(wt === "bow" ? SHOOT_RELEASE_MS : 0, () => this.projectile(f.id, f.tgt, fx.proj, { x: f.x, y: f.y }));
        break;
      case "aoe":
        this.groundAoe(f.x, f.y, f.r || 80, fx.color);
        if (wt === "bow") for (let i = 0; i < 7; i++) this.time.delayedCall(i * 40, () => this.projectile(f.id, null, "arrow", { x: f.x + Phaser.Math.Between(-f.r / 2, f.r / 2), y: f.y + Phaser.Math.Between(-f.r / 3, f.r / 3) }));
        break;
      case "meteor": {
        const m = this.add.circle(f.x - 60, f.y - 260, 14, fx.color).setDepth(1e6);
        const glow = this.add.circle(f.x - 60, f.y - 260, 24, 0xffd36b, 0.4).setDepth(1e6);
        const mark = this.add.ellipse(f.x, f.y, f.r * 2, f.r * 1.24, fx.color, 0.12).setStrokeStyle(2, fx.color, 0.7).setDepth(-8500);
        this.tweens.add({ targets: [m, glow], x: f.x, y: f.y - 10, duration: 780, ease: "Quad.easeIn", onComplete: () => {
          m.destroy(); glow.destroy(); mark.destroy();
          this.groundAoe(f.x, f.y, f.r, fx.color, 600); this.burst(f.x, f.y - 10, 0xffd36b, 50);
          this.cameras.main.shake(160, 0.006);
        } });
        break;
      }
    }
  }

  levelUpFx(id, job) {
    const v = this.views.get(id);
    if (!v) return;
    if (job) {
      const ring = this.add.ellipse(v.root.x, v.root.y - 2, 20, 8).setStrokeStyle(4, 0xffffff).setDepth(-8000);
      this.tweens.add({ targets: ring, scaleX: 5, scaleY: 5, alpha: 0, duration: 1300, onComplete: () => ring.destroy() });
      this.sparkle(v.root.x, v.root.y - 24, 0xffffff); this.sparkle(v.root.x, v.root.y - 30, 0xc38bff);
      this.floatText(v.root.x, v.root.y - 100, "เปลี่ยนอาชีพ!", "#ffffff", 18, 2000);
      return;
    }
    const ring = this.add.ellipse(v.root.x, v.root.y - 2, 20, 8).setStrokeStyle(3, 0xffd36b).setDepth(-8000);
    this.tweens.add({ targets: ring, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
    this.sparkle(v.root.x, v.root.y - 24, 0xffd36b);
    this.floatText(v.root.x, v.root.y - 100, "LEVEL UP!", "#ffd36b", 18, 1600);
  }

  showBubble(view, text) {
    if (view.bubble) view.bubble.destroy();
    const t = this.add.text(0, -74, text.length > 40 ? text.slice(0, 40) + "…" : text, {
      fontFamily: "Mitr, sans-serif", fontSize: "11px", color: "#1b1f33", backgroundColor: "#fdfaf0",
      padding: { x: 6, y: 3 }, wordWrap: { width: 150 }, resolution: 2,
    }).setOrigin(0.5, 1);
    view.root.add(t);
    view.bubble = t;
    this.time.delayedCall(4500, () => { if (view.bubble === t) { t.destroy(); view.bubble = null; } });
  }

  clickMarker(x, y) {
    const m = this.add.ellipse(x, y, 22, 11).setStrokeStyle(2, 0xffd36b).setDepth(-1e4);
    this.tweens.add({ targets: m, scale: 0.2, alpha: 0, duration: 500, onComplete: () => m.destroy() });
  }

  updateOnline() {}

  // ---------- ทุกเฟรม ----------
  updatePets(time) {
    const ROW = { down: 0, left: 1, right: 2, up: 3 };
    this.petViews.forEach((pv) => {
      const k = Math.min(1, 0.25);
      let x = pv.sh.x, y = pv.sh.y;
      if (Math.abs(pv.tx - x) > 300 || Math.abs(pv.ty - y) > 300) { x = pv.tx; y = pv.ty; }
      else { x += (pv.tx - x) * k; y += (pv.ty - y) * k; }
      const bob = Math.sin((time + pv.seed) / 220) * 3;
      pv.sh.setPosition(x, y).setDepth(y - 1);
      pv.sp.setPosition(x, y - 14 + bob).setDepth(y + 2);
      const flap = Math.floor((time + pv.seed) / (pv.moving ? 90 : 200)) % 2;
      pv.sp.setFrame((ROW[pv.dir] ?? 0) * 2 + flap);
    });
  }
  update(time, dt) {
    if (this.petViews) this.updatePets(time);
    this.updateBossBar();
    const k = Math.min(1, (dt / 1000) * 14);
    this.views.forEach((v) => {
      const r = v.root;
      if (Math.abs(v.tx - r.x) > 200 || Math.abs(v.ty - r.y) > 200) { r.x = v.tx; r.y = v.ty; }
      else { r.x += (v.tx - r.x) * k; r.y += (v.ty - r.y) * k; }
      r.setDepth(v.dead ? r.y - 40 : r.y);
      // ชื่อมอนแสดงเฉพาะตอนชี้เมาส์ / เป็นเป้าหมาย / โดนตี (จอจะได้ไม่รก)
      if (v.isMob) v.label.setVisible(!v.dead && (v.e.boss || v.e.rank || v.hover || this.myTarget === v.id || v.e.hp < v.e.maxHp));
      if (v.dead) {
        if (!v.deadShown) { v.deadShown = true; v.sprite.play(`${v.key}:die`); this.tweens.add({ targets: r, alpha: 0.75, duration: 400 }); }
        return;
      }
      if (!v.isMob && gameData && (v.e.glow || "") !== v.glowStr && !(this.lazyPending && this.lazyPending.size) && time >= (v.glowRetry || 0)) { v.glowRetry = time + 500; this.buildGlow(v, v.e); }
      if (!v.isMob) { this.weaponAura(v, time); if (v.glows && v.glows.length) for (const g of v.glows) if (g.frame.name !== v.sprite.frame.name && g.texture.has(v.sprite.frame.name)) g.setFrame(v.sprite.frame.name); }
      if (time < v.busyUntil) return;
      if (v.wfg && v.wfg.visible) this.weaponSwing(v, false);
      if (v.moving) v.sprite.play(`${v.key}:walk:${v.dir}`, true);
      else { v.sprite.stop(); v.sprite.setFrame(DIR_ROW[v.dir] * COLS); }
    });

    // วงขอบเขต AUTO
    const meP = room.state.players.get(room.sessionId);
    // เปิด AUTO อยู่ → วงที่จุดเปิด AUTO; ยังไม่เปิดแต่เปิดหน้าตั้งค่าอยู่ → วงตัวอย่างรอบตัวเรา
    let ring = null;
    if (meP && meP.auto && meP.autoR < WHOLE_MAP) ring = { x: meP.autoX, y: meP.autoY, r: meP.autoR };
    else if (meP && !meP.auto && !$("autoPanel").hidden && autoCfg.radius < WHOLE_MAP) {
      const mv = this.views.get(room.sessionId);
      if (mv) ring = { x: mv.root.x, y: mv.root.y, r: autoCfg.radius };
    }
    this.autoRing.setVisible(!!ring);
    if (ring) {
      this.autoRing.setPosition(ring.x, ring.y);
      if (this.autoRing.width !== ring.r * 2) this.autoRing.setSize(ring.r * 2, ring.r * 2 * 0.9);
    }

    // เดินถึง NPC แล้วเปิดหน้าต่าง
    if (this.pendingNpc) {
      const mv = this.views.get(room.sessionId);
      if (mv && Math.hypot(mv.root.x - this.pendingNpc.x, mv.root.y - this.pendingNpc.y) < 100) {
        if (this.pendingNpc.id === "smith") openSmith(); else if (this.pendingNpc.id === "jobmaster") openJob(); else openShop(this.pendingNpc.id);
        this.pendingNpc = null;
      }
    }

    // วงแดงใต้เป้าหมาย
    const tv = this.myTarget && this.views.get(this.myTarget);
    this.targetRing.setVisible(!!tv);
    if (tv) this.targetRing.setPosition(tv.root.x, tv.root.y - 1);

    const me = this.views.get(room.sessionId);
    if (me) {
      const mx = me.root.x, my = me.root.y;
      for (const tr of this.trees) {
        const behind = my < tr.y && my > tr.y - tr.height + 10 && Math.abs(mx - tr.x) < tr.width / 2;
        tr.setAlpha(behind ? 0.55 : 1);
      }
      $("pos").textContent = `${Math.floor(me.tx / T)}, ${Math.floor(me.ty / T)}`;
    }

    if (!isTyping()) {
      const K = this.keys;
      const dx = (K.D.isDown || K.RIGHT.isDown ? 1 : 0) - (K.A.isDown || K.LEFT.isDown ? 1 : 0);
      const dy = (K.S.isDown || K.DOWN.isDown ? 1 : 0) - (K.W.isDown || K.UP.isDown ? 1 : 0);
      if (dx !== this.lastDir.dx || dy !== this.lastDir.dy) {
        this.lastDir = { dx, dy };
        if (dx || dy) { this.myTarget = null; stopTravel(); }
        room.send("dir", { dx, dy });
      }
    }
  }
}

function startGame() {
  phaserGame = new Phaser.Game({
    type: location.search.includes("canvas") ? Phaser.CANVAS : Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0d1124",
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: WorldScene,
  });
}
// มือถือหมุนจอ / แถบที่อยู่เบราว์เซอร์ยุบ-ขยาย → ปรับขนาดเกมให้ตรงจอทุกครั้ง (ไม่งั้นจุดที่แตะจะเพี้ยน)
function syncGameSize() {
  if (!phaserGame || !phaserGame.scale) return;
  const w = window.innerWidth, h = window.innerHeight, sc = phaserGame.scale;
  if (sc.width !== w || sc.height !== h) sc.resize(w, h);
  sc.updateBounds();
}
["resize", "orientationchange", "scroll"].forEach((ev) => window.addEventListener(ev, () => { syncGameSize(); setTimeout(syncGameSize, 300); }));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => setTimeout(syncGameSize, 50));
  window.visualViewport.addEventListener("scroll", () => setTimeout(syncGameSize, 50));
}
// iPhone (Safari): หน้าเว็บอาจถูกเลื่อนค้างไว้ (เช่นหลังคีย์บอร์ดแชทปิด) ทำให้จุดแตะเยื้องขึ้นบน
// → เลื่อนหน้ากลับบนสุด และอัปเดตตำแหน่งจอเกมก่อนทุกครั้งที่แตะ
function unshiftPage() {
  if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  if (document.scrollingElement && document.scrollingElement.scrollTop) document.scrollingElement.scrollTop = 0;
}
const beforeTouch = () => { unshiftPage(); if (phaserGame && phaserGame.scale) phaserGame.scale.updateBounds(); };
window.addEventListener("touchstart", beforeTouch, { capture: true, passive: true });
window.addEventListener("pointerdown", beforeTouch, { capture: true, passive: true });
document.addEventListener("focusout", () => setTimeout(() => { unshiftPage(); syncGameSize(); }, 100));
setInterval(syncGameSize, 1000);

// =============================================================
//  HUD
// =============================================================
function updateStatus(p) {
  $("stName").textContent = p.name;
  $("stJob").textContent = p.jobName;
  $("stLv").textContent = p.level;
  $("hpFill").style.width = (100 * p.hp) / p.maxHp + "%";
  $("spFill").style.width = (100 * p.sp) / p.maxSp + "%";
  $("hpTxt").textContent = `${p.hp}/${p.maxHp}`;
  $("spTxt").textContent = `${p.sp}/${p.maxSp}`;
  renderStats();
  const pct = p.expNext ? (100 * p.exp) / p.expNext : 100;
  $("expFill").style.width = pct + "%";
  $("expTxt").textContent = pct.toFixed(1) + "%";
}

function drawAvatar(key) {
  const src = scene.textures.get(key).getSourceImage();
  const ctx = $("avatar").getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 48, 48);
  ctx.drawImage(src, 16, 2 * 64 + 6, 32, 32, 0, 0, 48, 48);
}

// ---------- แถบสกิล ----------
// สกิลที่กดใช้ได้ = สกิลของอาชีพที่เรียนแล้ว (เลเวล 1 ขึ้นไป)
function mySkills() {
  const me = room.state.players.get(room.sessionId);
  const all = (gameData && me && gameData.jobSkills[me.job]) || [];
  return all.filter((k) => typeof skLv !== "function" || skLv(k) > 0);
}
function buildSkillBar() {
  const bar = $("skillBar");
  bar.innerHTML = "";
  const list = mySkills();
  for (let i = 0; i < 9; i++) {
    const key = list[i];
    const s = key && gameData.skills[key];
    const el = document.createElement(s ? "button" : "div");
    el.className = s ? "slot skill" : "slot";
    el.dataset.skill = key || "";
    const L = s ? skLv(key) : 0, sp = s ? s.sps[Math.max(0, L - 1)] || s.sp : 0;
    el.innerHTML = `<small>${i + 1}</small>` + (s ? `<img class="sb-ic" src="/assets/icons/${s.icon}.png" alt="" style="--sc:${s.color}"><b>${s.name}</b><em class="cost">${sp}</em>` : "");
    if (s) { el.title = `${s.name} Lv.${L} — ${s.descs[L - 1]} (SP ${sp})`; el.onclick = () => castSkill(key, el); }
    bar.appendChild(el);
  }
  const auto = document.createElement("button");
  auto.id = "autoBtn";
  auto.className = "auto-btn";
  auto.setAttribute("aria-pressed", "false");
  auto.title = "ตีมอนอัตโนมัติรอบ ๆ จุดที่ยืนอยู่ (คลิกเดินเองเพื่อหยุด)";
  auto.innerHTML = `AUTO<small>ปิด</small>`;
  auto.onclick = () => {
    stopTravel();
    const me = room.state.players.get(room.sessionId);
    room.send("auto", !(me && me.auto));
  };
  bar.appendChild(auto);
  const gear = document.createElement("button");
  gear.className = "gear-btn";
  gear.title = "ตั้งค่า AUTO";
  gear.setAttribute("aria-label", "ตั้งค่า AUTO");
  gear.setAttribute("aria-expanded", "false");
  gear.textContent = "⚙";
  gear.onclick = () => toggleAutoPanel();
  bar.appendChild(gear);
  buildAutoPanel();
  const me = room.state.players.get(room.sessionId);
  if (me) renderAuto(me.auto, me.autoState);
}
const AUTO_STATE = { fight: "กำลังตี", rest: "พักเลือด", wait: "หามอน", loot: "เก็บของ" };
function renderAuto(on, state) {
  const b = $("autoBtn");
  if (!b) return;
  b.setAttribute("aria-pressed", String(!!on));
  b.querySelector("small").textContent = on ? AUTO_STATE[state] || "เปิด" : "ปิด";
}
function castSkill(key, el) {
  if (!key) return;
  room.send("skill", { skill: key, target: scene.myTarget });
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
}
function setupHotkeys() {
  window.addEventListener("keydown", (e) => {
    if (isTyping()) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) {
      const key = mySkills()[n - 1];
      castSkill(key, document.querySelectorAll("#skillBar .slot")[n - 1]);
    }
  });
}
function renderCooldowns() {
  const t = performance.now();
  document.querySelectorAll("#skillBar .slot.skill").forEach((el) => {
    const left = (scene.cdEnd[el.dataset.skill] || 0) - t;
    let cd = el.querySelector(".cd");
    if (left > 0) {
      if (!cd) { cd = document.createElement("span"); cd.className = "cd"; el.appendChild(cd); }
      cd.textContent = Math.ceil(left / 1000);
    } else if (cd) cd.remove();
  });
}

// ---------- หน้าสเตตัส ----------
let derived = null;
function setupStats() {
  $("statBtn").onclick = () => toggleStats();
  $("spClose").onclick = () => toggleStats(false);
  $("spRecommend").onclick = () => room.send("recommendStats");
  window.addEventListener("keydown", (e) => {
    if (isTyping()) return;
    if (e.key === "c" || e.key === "C") toggleStats();
  });
  const box = $("spStats");
  box.innerHTML = "";
  for (const k of gameData.statKeys) {
    const info = gameData.statInfo[k];
    const row = document.createElement("div");
    row.className = "sp-row";
    row.title = info.desc;
    row.innerHTML = `<b>${info.name}</b><span>${info.th} · ${info.desc}</span><em data-v="${k}">1</em><i class="cost" data-c="${k}" title="แต้มที่ใช้ต่อ 1 หน่วย">1</i>` +
      `<button type="button" data-k="${k}" data-n="1" aria-label="เพิ่ม ${info.name} 1 แต้ม">+</button>` +
      `<button type="button" data-k="${k}" data-n="5" aria-label="เพิ่ม ${info.name} 5 แต้ม">+5</button>`;
    row.querySelectorAll("button").forEach((b) => (b.onclick = () => room.send("addStat", { stat: b.dataset.k, n: Number(b.dataset.n) })));
    box.appendChild(row);
  }
  renderStats();
}
function toggleStats(force) {
  const p = $("statPanel"), open = force ?? p.hidden;
  p.hidden = !open;
  if (open) renderStats();
}
function renderStats() {
  const me = room && room.state.players.get(room.sessionId);
  if (!me || !gameData || !gameData.statKeys) return;
  const pts = me.statPoints || 0;
  $("statBadge").hidden = pts <= 0;
  $("statBadge").textContent = pts;
  if ($("statPanel").hidden) return;
  $("spPoints").textContent = pts;
  for (const k of gameData.statKeys) {
    const v = $("spStats").querySelector(`[data-v="${k}"]`);
    const gb = (derived && derived.bonus && derived.bonus[k]) || 0;
    if (v) v.innerHTML = me[k] + (gb ? ` <span class="bonus">+${gb}</span>` : "");
    // ค่าแต้มต่อหน่วย: 1–10 = 1, 11–20 = 2, … (ค่ายิ่งสูงยิ่งแพง)
    const cost = 1 + Math.floor((me[k] - 1) / (gameData.statCostStep || 10));
    const c = $("spStats").querySelector(`[data-c="${k}"]`);
    if (c) { c.textContent = me[k] >= gameData.statMax ? "MAX" : `ใช้ ${cost}`; c.classList.toggle("bad", cost > pts && me[k] < gameData.statMax); }
    $("spStats").querySelectorAll(`button[data-k="${k}"]`).forEach((b) => (b.disabled = cost > pts || me[k] >= gameData.statMax));
  }
  $("spRecommend").disabled = pts <= 0;
  if (!derived) return;
  const pc = (x) => (x * 100).toFixed(1) + "%";
  const plus = (k) => (derived.bonus && derived.bonus[k] ? ` <span class="bonus">(+${derived.bonus[k]})</span>` : "");
  const rows = [
    [`พลังโจมตี${derived.atkType && derived.atkType !== "str" ? ` (${derived.atkType.toUpperCase()})` : ""}`, derived.atk + plus("atk")], ["ป้องกัน", derived.def + plus("def")],
    ["HP สูงสุด", me.maxHp + plus("maxHp")], ["SP สูงสุด", me.maxSp + plus("maxSp")],
    ["ตีทุก", (derived.atkDelay / 1000).toFixed(2) + " วิ"], ["หลบ", pc(derived.flee)],
    ["คริติคอล", pc(derived.crit)], ["แม่นยำ", "+" + pc(derived.hitBonus)],
    ["ฮีลเพิ่ม", "+" + derived.healBonus],
  ];
  const SX = (gameData && gameData.special) || {};
  const sxRows = Object.entries(derived.special || {}).map(([k, v]) => `<div class="sx">${(SX[k] || {}).name || k} <b>+${v}%</b></div>`).join("");
  $("spDerived").innerHTML = rows.map(([l, v]) => `<div>${l} <b>${v}</b></div>`).join("") +
    (sxRows ? `<div class="sx-head">สเตตัสพิเศษ (อุปกรณ์ + ชนิดอาวุธ)</div>${sxRows}` : "") +
    ((derived.sets || []).length ? `<div class="sx-head set">เซ็ตที่ใส่อยู่</div>` + derived.sets.map((a) =>
      `<div class="sx set">${(gameData.itemSets[a.set] || {}).name || a.set} <b>${a.count}/${a.total}</b></div>`).join("") : "");
}

// ---------- ตั้งค่า AUTO ----------
const WHOLE_MAP = 9999;
const RADII = [[160, "5 ช่อง"], [360, "11 ช่อง"], [560, "17 ช่อง"], [WHOLE_MAP, "ทั้งแมพ"]];
// ค่าเริ่มต้น: ตีมอนทุกชนิดทั้งแมพ · มอนที่เลือกจำแยกตามแผนที่ (เปลี่ยนแมพแล้วไม่ค้างชนิดของแมพเก่า)
const autoCfg = (() => {
  const def = { radius: WHOLE_MAP, byMap: {}, loot: true, potion: true, potionPct: 35, pick: { equip: 0, use: true, stone: true, mat: true }, v: 2 };
  try {
    const c = JSON.parse(storeGet("pn_auto") || "{}");
    if (c.v !== 2) return { ...def, loot: c.loot !== false, potion: c.potion !== false, potionPct: c.potionPct || 35 };
    return { ...def, ...c, byMap: c.byMap || {} };
  } catch { return def; }
})();
const autoKinds = () => autoCfg.byMap[room && room.mapId] || [];
function sendAutoCfg() { storeSet("pn_auto", JSON.stringify(autoCfg)); room.send("autoCfg", { ...autoCfg, kinds: autoKinds() }); }
function toggleAutoPanel(force) {
  const p = $("autoPanel"), open = force ?? p.hidden;
  p.hidden = !open;
  const g = document.querySelector(".gear-btn");
  if (g) g.setAttribute("aria-expanded", String(open));
  if (open) buildAutoPanel();
}
function buildAutoPanel() {
  const rad = $("apRadius");
  rad.innerHTML = "";
  RADII.forEach(([r, label]) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = label;
    b.setAttribute("aria-checked", String(autoCfg.radius === r));
    b.onclick = () => { autoCfg.radius = r; sendAutoCfg(); buildAutoPanel(); };
    rad.appendChild(b);
  });
  const kinds = $("apKinds");
  kinds.innerHTML = "";
  const me = room.state.players.get(room.sessionId);
  const here = gameData.mapMobs || Object.keys(gameData.mobs);
  if (!here.length) kinds.innerHTML = `<p class="ap-note">แผนที่นี้ไม่มีมอนสเตอร์ (เมืองปลอดภัย)</p>`;
  Object.entries(gameData.mobs).filter(([k]) => here.includes(k)).forEach(([k, m]) => {
    const diff = me ? m.level - me.level : 0;
    const color = diff >= 6 ? "#ff6b6b" : diff >= 3 ? "#ffb86b" : diff <= -6 ? "#9aa0b4" : "#ecebe4";
    const lab = document.createElement("label");
    lab.innerHTML = `<input type="checkbox" ${autoKinds().includes(k) ? "checked" : ""}> ${m.name}<span class="lv" style="color:${color}">Lv.${m.level}</span>`;
    lab.querySelector("input").onchange = (e) => {
      const cur = autoKinds();
      autoCfg.byMap[room.mapId] = e.target.checked ? [...new Set([...cur, k])] : cur.filter((x) => x !== k);
      sendAutoCfg();
      buildAutoPanel();
    };
    kinds.appendChild(lab);
  });
}

let toastTimer = null;
// ---------- นับถอยหลังปิดปรับปรุง ----------
let maintEnd = 0, maintMsg = "", maintTick = null, maintSaid = {};
function onMaint(info) {
  if (info.now) return; // ครบเวลาแล้ว — รอโดนตัดการเชื่อมต่อ (รหัส 4003)
  if (!info.active) {
    if (maintEnd) { addChat("system", "✅ ยกเลิกการปิดปรับปรุงแล้ว เล่นต่อได้ตามปกติ"); showAnnounce("ยกเลิกการปิดปรับปรุงแล้ว"); }
    maintEnd = 0; clearInterval(maintTick); const b = $("maintBar"); if (b) b.hidden = true;
    return;
  }
  const first = !maintEnd;
  maintEnd = Date.now() + info.left; maintMsg = info.msg || ""; maintSaid = {};
  for (const t of [300, 60, 30, 10]) if (Math.ceil(info.left / 1000) <= t + 2) maintSaid[t] = true; // ไม่เตือนซ้ำกับข้อความแรก
  const mins = Math.ceil(info.left / 60000);
  addChat("system", `🔧 เซิร์ฟเวอร์จะปิดปรับปรุงในอีก ${mins} นาที${maintMsg ? " — " + esc(maintMsg) : ""} (ระบบจะบันทึกตัวละครให้อัตโนมัติ)`);
  if (first) showAnnounce(`เซิร์ฟเวอร์จะปิดปรับปรุงในอีก ${mins} นาที`);
  clearInterval(maintTick);
  maintTick = setInterval(renderMaint, 250);
  renderMaint();
}
function renderMaint() {
  let b = $("maintBar");
  if (!b) { b = document.createElement("div"); b.id = "maintBar"; b.setAttribute("role", "timer"); document.body.appendChild(b); }
  const left = Math.max(0, maintEnd - Date.now()), sec = Math.ceil(left / 1000);
  const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, "0");
  b.hidden = false;
  b.classList.toggle("urgent", sec <= 30);
  b.innerHTML = `🔧 ปิดปรับปรุงในอีก <b>${mm}:${ss}</b>${maintMsg ? ` · ${esc(maintMsg)}` : ""}`;
  // เตือนในแชทเมื่อเหลือ 5 นาที / 1 นาที / 30 วิ / 10 วิ
  for (const t of [300, 60, 30, 10]) if (sec <= t && !maintSaid[t]) {
    maintSaid[t] = true;
    if (sec > t - 3) addChat("system", `🔧 ปิดปรับปรุงในอีก ${t >= 60 ? t / 60 + " นาที" : t + " วินาที"}`);
  }
  if (left <= 0) clearInterval(maintTick);
}
// ---------- หน้าจอตอนเซิร์ฟเวอร์หลุด / ปิดปรับปรุง / อัปเดต ----------
let myCharId = null;
const autoReenter = () => { try { if (myCharId) sessionStorage.setItem("pn_auto", myCharId); saveChat(); } catch {} };
function showDownScreen(kind) {
  clearInterval(maintTick);
  const b = $("maintBar"); if (b) b.hidden = true;
  let o = $("downScreen");
  if (!o) { o = document.createElement("div"); o.id = "downScreen"; document.body.appendChild(o); }
  const TXT = {
    maint: ["🔧 ปิดปรับปรุงเซิร์ฟเวอร์", "บันทึกตัวละครเรียบร้อยแล้ว · เกมจะกลับมาเร็ว ๆ นี้ หน้านี้จะเข้าเกมใหม่ให้อัตโนมัติเมื่อเปิดแล้ว"],
    restart: ["🔄 กำลังอัปเดตเกม", "บันทึกตัวละครเรียบร้อยแล้ว · กำลังเชื่อมต่อใหม่อัตโนมัติ…"],
    lost: ["📡 หลุดการเชื่อมต่อ", "กำลังลองเชื่อมต่อใหม่อัตโนมัติ…"],
  }[kind];
  o.innerHTML = `<div class="frame"><h3>${TXT[0]}</h3><p>${TXT[1]}</p><p class="dots"><span></span><span></span><span></span></p>
    <button type="button" class="btn-gold" id="downRetry">เข้าใหม่ตอนนี้</button></div>`;
  $("downRetry").onclick = () => { autoReenter(); location.reload(); };
  // รอจนเซิร์ฟเวอร์ตอบ แล้วโหลดหน้าใหม่ (ปิดปรับปรุง = เช็คว่าเปิดให้เข้าแล้วหรือยัง)
  const check = async () => {
    try {
      const ok = (await fetch("/health", { cache: "no-store" })).ok;
      if (ok && kind !== "maint") { autoReenter(); return location.reload(); }
      if (ok && kind === "maint") { const m = await (await fetch("/api/status", { cache: "no-store" })).json(); if (!m.closed) { autoReenter(); return location.reload(); } }
    } catch {}
    setTimeout(check, kind === "maint" ? 15000 : 3000);
  };
  setTimeout(check, kind === "restart" ? 2500 : 4000);
}
// ---------- ย้ายแผนที่ ----------
// เซิร์ฟเวอร์บันทึกตำแหน่งใหม่แล้ว → ออกจากห้องนี้ แล้วโหลดหน้าใหม่ให้เข้าแผนที่ปลายทางอัตโนมัติ
// ย้ายแผนที่ในหน้าเดิม: ออกจากห้องเก่า → เข้าห้องแผนที่ใหม่ → เริ่มฉากใหม่ (ไม่ต้องโหลดหน้า)
async function travelTo(c, w) {
  if (leavingForWarp) return;
  leavingForWarp = true;
  showTravel(w.map, w.name);
  hideCard(); hideTip();
  try { await room.leave(true); } catch {}
  setTravelProgress(20, "เชื่อมต่อแผนที่ใหม่…");
  for (let i = 0; i < 4; i++) {
    try {
      room = await joinMap(gameClient, c, w.map, 0, true);
      setTravelProgress(35, "โหลดภาพแผนที่…");
      bindRoom(room);
      leavingForWarp = false;
      scene.scene.restart();
      return;
    } catch (e) {
      console.warn("warp join failed", e);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  // ไม่สำเร็จ → โหลดหน้าใหม่แล้วเข้าเกมอัตโนมัติ
  try { sessionStorage.setItem("pn_auto", c.id); } catch {}
  saveChat();
  location.reload();
}
function showTravel(mapId, name) {
  let o = $("travel");
  if (!o) { o = document.createElement("div"); o.id = "travel"; document.body.appendChild(o); }
  const m = WORLD && WORLD.maps.find((x) => x.id === mapId);
  const nm = name || (m && m.name) || "";
  o.innerHTML = `<div><small>กำลังเดินทางไป</small><b>${esc(nm)}</b>${m && m.lv ? `<span>Lv.${m.lv[0]}–${m.lv[1]}</span>` : ""}
    <div class="tv-bar"><i id="tvFill"></i></div><div class="tv-pct"><em id="tvStep">เตรียมตัว…</em><b id="tvPct">0%</b></div></div>`;
  o.classList.add("show");
  travelPct = 0;
  setTravelProgress(5, "ออกจากแผนที่เดิม…");
}
// แถบความคืบหน้าตอนย้ายแผนที่ (ค่าไม่ถอยหลัง)
let travelPct = 0;
function setTravelProgress(pct, step) {
  const o = $("travel");
  if (!o || !o.classList.contains("show")) return;
  travelPct = Math.max(travelPct, Math.min(100, Math.round(pct)));
  const f = $("tvFill"), t = $("tvPct"), st = $("tvStep");
  if (f) f.style.width = travelPct + "%";
  if (t) t.textContent = travelPct + "%";
  if (st && step) st.textContent = step;
}
// เก็บแชทไว้ข้ามการโหลดหน้า
function saveChat() { try { sessionStorage.setItem("pn_chat", $("chatLog").innerHTML.slice(-20000)); } catch {} }
function restoreChat() { try { const h = sessionStorage.getItem("pn_chat"); if (h) $("chatLog").innerHTML = h; } catch {} }

// ป้ายประกาศจากแอดมิน (กลางบนจอ 8 วินาที)
function showAnnounce(text) {
  let el = $("announce");
  if (!el) { el = document.createElement("div"); el.id = "announce"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = "📢 " + text;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(showAnnounce.t);
  showAnnounce.t = setTimeout(() => el.classList.remove("show"), 8000);
}
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
}

// ---------- มินิแมพ ----------
let miniBase = null;
function buildMinimap(map) {
  const cv = $("miniCanvas"), sx = cv.width / map.width, sy = cv.height / map.height;
  miniBase = document.createElement("canvas");
  miniBase.width = cv.width; miniBase.height = cv.height;
  const ctx = miniBase.getContext("2d");
  const COL = { spring: ["#6bb04a", "#b98d5b", "#2f86a6"], summer: ["#5b9a3f", "#b98d5b", "#2f86a6"],
    autumn: ["#b89a3c", "#a07850", "#2f86a6"], winter: ["#dfeef5", "#a9c7d8", "#4f8fb0"],
    swamp: ["#4f5a34", "#5e4a32", "#25463f"], ruins: ["#7d8070", "#8e8676", "#4f6e80"], desert: ["#d9b47a", "#c07a4a", "#2f9fa0"], lava: ["#4a3a36", "#5a2a20", "#ff7a1a"], shadow: ["#4a3e5a", "#5a5068", "#2a1f3a"] }[map.season] || ["#5b9a3f", "#b98d5b", "#2f86a6"];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = COL[map.ground[y * map.width + x]];
      ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
    }
  for (const o of map.objects) {
    if (!o.b) continue;
    ctx.fillStyle = /oak|pine|dead/.test(o.k) ? (map.season === "autumn" ? "#9a4a1c" : map.season === "winter" ? "#6c8c9a" : "#24502a") : /rock/.test(o.k) ? "#9a9a9a" : "#3c7a33";
    ctx.fillRect((o.x / T) * sx - 1, (o.y / T) * sy - 2, 3, 3);
  }
  for (const p of map.portals || []) {
    const x = ((p.box.x0 + p.box.x1) / 2 / T) * sx, y = ((p.box.y0 + p.box.y1) / 2 / T) * sy;
    ctx.fillStyle = "#9fe3ff"; ctx.strokeStyle = "#0d1124"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
  }
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect();
    scene.myTarget = null;
    room.send("moveTo", {
      x: ((e.clientX - r.left) / r.width) * map.width * T,
      y: ((e.clientY - r.top) / r.height) * map.height * T,
    });
  };
  if (!window._miniTimer) window._miniTimer = setInterval(drawMinimap, 100);
}
function drawMinimap() {
  if (!scene || !scene.map) return;
  const cv = $("miniCanvas"), ctx = cv.getContext("2d"), m = scene.map;
  const sx = cv.width / (m.width * T), sy = cv.height / (m.height * T);
  ctx.drawImage(miniBase, 0, 0);
  const cam = scene.cameras.main.worldView;
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x * sx + 0.5, cam.y * sy + 0.5, cam.width * sx, cam.height * sy);
  scene.views.forEach((v) => {
    if (v.dead) return;
    ctx.fillStyle = v.isMe ? "#ffd36b" : v.isMob ? "#ff5a5a" : "#ffffff";
    ctx.beginPath();
    ctx.arc(v.root.x * sx, v.root.y * sy, v.isMe ? 3 : v.isMob ? 1.4 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // มินิบอส: จุดส้มขอบทอง
  scene.views.forEach((v) => {
    if (!v.isMob || v.e.rank !== 2 || v.dead) return;
    ctx.fillStyle = "#ff6a3a"; ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(v.root.x * sx, v.root.y * sy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  // World Boss: หัวกะโหลกในวงแดงกะพริบ (วาดทับทุกอย่าง จะได้เห็นชัด)
  scene.views.forEach((v) => {
    if (!v.isMob || !v.e.boss || v.dead) return;
    const x = v.root.x * sx, y = v.root.y * sy, k = (Date.now() % 1000) / 1000;
    ctx.strokeStyle = `rgba(255,70,50,${1 - k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 7 + k * 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#b81f1f"; ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = "10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
    ctx.fillText("☠", x, y + 0.5);
  });
}

// ---------- แชท ----------
function setupChat(sc) {
  const input = $("chatInput");
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
  input.addEventListener("focus", () => {
    scene.lastDir = { dx: 0, dy: 0 };
    room.send("dir", { dx: 0, dy: 0 });
  });
  input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") input.blur(); });
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) room.send("chat", text);
    input.value = "";
    input.blur();
  });
  // ปุ่มย่อ/ขยายแชท (จอมือถือเริ่มแบบย่อ จะได้ไม่บังเกม)
  const tg = document.createElement("button");
  tg.type = "button"; tg.id = "chatToggle"; tg.className = "chat-toggle";
  const setCollapsed = (on) => { $("chat").classList.toggle("collapsed", on); tg.textContent = on ? "▲" : "▼"; tg.title = on ? "ขยายแชท" : "ย่อแชท"; };
  tg.onclick = () => setCollapsed(!$("chat").classList.contains("collapsed"));
  document.querySelector("#chat .tabs").appendChild(tg);
  setCollapsed(window.matchMedia("(max-height: 540px), (max-width: 640px)").matches);
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      if ($("chat").classList.contains("collapsed")) setCollapsed(false);
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      $("chatLog").dataset.tab = t.dataset.tab;
      $("chatLog").scrollTop = $("chatLog").scrollHeight;
    })
  );
}

function addChat(type, html) {
  const log = $("chatLog");
  const line = document.createElement("div");
  line.className = "line " + type;
  line.innerHTML = type === "system" ? `<span class="sys">${html}</span>` : html;
  log.appendChild(line);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

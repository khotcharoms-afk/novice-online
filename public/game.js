// =============================================================
//  ฝั่งผู้เล่น — Phaser 3 + Colyseus
//  แผนที่ทำจาก tileset LPC, ตัวละคร LPC เดิน 4 ทิศ, HUD แบบเกม MMO
// =============================================================
const $ = (id) => document.getElementById(id);
const SERVER_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const T = 32; // ขนาดช่องแผนที่ (px)

const LOOKS = [
  { id: "novice", label: "Novice" },
  { id: "swordsman", label: "Swordsman" },
  { id: "ranger", label: "Thief" },
  { id: "mage", label: "Mage" },
  { id: "acolyte", label: "Acolyte" },
  { id: "archer", label: "Archer" },
];
const DIR_ROW = { up: 0, left: 1, down: 2, right: 3 };
const ZOOMS = [1, 1.25, 1.5, 2];

let room = null;
let scene = null;
let chosenLook = storeGet("pn_look") || "novice";

// =============================================================
//  หน้าเข้าเกม: เลือกตัวละคร
// =============================================================
const lookImgs = {};
let pickerFrame = 0;
function buildPicker() {
  const wrap = $("lookPicker");
  LOOKS.forEach((l) => {
    const b = document.createElement("button");
    b.className = "look";
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(l.id === chosenLook));
    b.innerHTML = `<canvas width="40" height="56"></canvas><span>${l.label}</span>`;
    b.onclick = () => {
      chosenLook = l.id;
      wrap.querySelectorAll(".look").forEach((x) => x.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
    };
    wrap.appendChild(b);
    const img = new Image();
    img.src = `/assets/char_${l.id}.png`;
    img.onload = () => drawPicker();
    lookImgs[l.id] = { img, canvas: b.querySelector("canvas") };
  });
  setInterval(() => { pickerFrame = (pickerFrame + 1) % 8; drawPicker(); }, 110);
}
function drawPicker() {
  for (const id in lookImgs) {
    const { img, canvas } = lookImgs[id];
    if (!img.complete) continue;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 40, 56);
    const col = id === chosenLook ? 1 + pickerFrame : 0; // ตัวที่เลือกจะเดินอยู่กับที่
    ctx.drawImage(img, col * 64 + 12, 2 * 64 + 8, 40, 56, 0, 0, 40, 56); // ครอปเฉพาะตัว
  }
}
buildPicker();

$("nameInput").value = storeGet("pn_name") || "";
$("nameInput").addEventListener("keydown", (e) => e.key === "Enter" && join());
$("playBtn").addEventListener("click", join);

async function join() {
  const name = $("nameInput").value.trim();
  if (!name) { $("loginErr").textContent = "ใส่ชื่อตัวละครก่อนเข้าเกม"; $("nameInput").focus(); return; }
  $("playBtn").disabled = true;
  $("loginErr").textContent = "";
  try {
    const client = new Colyseus.Client(SERVER_URL);
    room = await client.joinOrCreate("world", { name, look: chosenLook });
    storeSet("pn_name", name);
    storeSet("pn_look", chosenLook);
    room.onMessage("system", (text) => addChat("system", esc(text)));
    room.onMessage("chat", ({ id, name, text }) => {
      addChat("chat", `<span class="cname">${esc(name)}:</span> ${esc(text)}`);
      const v = scene && scene.views.get(id);
      if (v) scene.showBubble(v, text);
    });
    room.onLeave(() => addChat("system", "หลุดการเชื่อมต่อ — รีเฟรชหน้าเพื่อเข้าใหม่"));
    $("login").remove();
    $("hud").hidden = false;
    buildSlots();
    startGame();
  } catch (err) {
    console.error(err);
    $("loginErr").textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองกดเข้าเกมอีกครั้ง";
    $("playBtn").disabled = false;
  }
}

// =============================================================
//  ฉากเกม
// =============================================================
class WorldScene extends Phaser.Scene {
  constructor() { super("world"); }

  preload() {
    this.load.image("terrain", "/assets/terrain.png");
    this.load.atlas("obj", "/assets/objects.png", "/assets/objects.json");
    LOOKS.forEach((l) =>
      this.load.spritesheet("char_" + l.id, `/assets/char_${l.id}.png`, { frameWidth: 64, frameHeight: 64 })
    );
  }

  create() {
    scene = this;
    this.views = new Map();
    this.trees = [];
    this.lastDir = { dx: 0, dy: 0 };
    this.zoomIdx = window.innerWidth >= 1000 ? 2 : 1;
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]).setBackgroundColor("#22401f");
    this.cameras.main.setRoundPixels(true);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";

    // แอนิเมชันเดิน 4 ทิศ ของทุกชุด
    LOOKS.forEach(({ id }) => {
      for (const dir in DIR_ROW) {
        const r = DIR_ROW[dir] * 9;
        this.anims.create({
          key: `walk_${id}_${dir}`,
          frames: this.anims.generateFrameNumbers("char_" + id, { start: r + 1, end: r + 8 }),
          frameRate: 12, repeat: -1,
        });
      }
    });

    room.onMessage("map", (map) => this.buildMap(map));
    room.send("getMap");

    const $s = Colyseus.getStateCallbacks(room);
    $s(room.state).players.onAdd((player, id) => {
      const view = this.createPlayerView(player, id);
      this.views.set(id, view);
      $s(player).onChange(() => {
        view.tx = player.x; view.ty = player.y;
        view.moving = player.moving; view.dir = player.dir;
        if (id === room.sessionId) updateStatus(player);
      });
      if (id === room.sessionId) {
        this.cameras.main.startFollow(view.root, true, 0.15, 0.15);
        updateStatus(player);
        drawAvatar(this, player.look);
      }
      this.updateOnline();
    });
    $s(room.state).players.onRemove((_p, id) => {
      const v = this.views.get(id);
      if (v) v.root.destroy();
      this.views.delete(id);
      this.updateOnline();
    });

    this.input.on("pointerdown", (p) => {
      if (document.activeElement === $("chatInput")) $("chatInput").blur();
      room.send("moveTo", { x: p.worldX, y: p.worldY });
      this.clickMarker(p.worldX, p.worldY);
    });
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT", false);

    $("zoomIn").onclick = () => this.setZoomIdx(this.zoomIdx + 1);
    $("zoomOut").onclick = () => this.setZoomIdx(this.zoomIdx - 1);
    setupChat(this);
  }

  setZoomIdx(i) {
    this.zoomIdx = Phaser.Math.Clamp(i, 0, ZOOMS.length - 1);
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";
  }

  // ---------- สร้างแผนที่จาก tileset ----------
  // ใช้เทคนิคแบ่งช่องเป็น 4 ส่วน (16px) เพื่อให้ขอบหญ้าโค้งต่อกันเนียน
  buildMap(map) {
    this.map = map;
    const { width: W, height: H, ground, objects } = map;
    const tex = this.textures.get("terrain");
    const full = (c, r) => { const n = `t${c}_${r}`; if (!tex.has(n)) tex.add(n, 0, c * T, r * T, T, T); return n; };
    const quad = (c, r, qx, qy) => {
      const n = `q${c}_${r}_${qx}${qy}`;
      if (!tex.has(n)) tex.add(n, 0, c * T + qx * 16, r * T + qy * 16, 16, 16);
      return n;
    };
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ground[y * W + x]);
    const grassy = (x, y) => at(x, y) !== 1; // น้ำนับเป็นหญ้า เพราะบ่อมีตลิ่งหญ้าในตัว
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const GRASS = [[3, 2], [4, 2], [5, 2], [3, 1], [4, 1], [5, 1], [1, 1]];
    const DIRT = [[3, 3], [4, 3], [5, 3], [3, 4], [4, 4], [5, 4]];

    const rt = this.add.renderTexture(0, 0, W * T, H * T).setOrigin(0).setDepth(-1e6);
    rt.beginDraw();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = at(x, y), px = x * T, py = y * T, h = hash(x, y);
        const dirt = DIRT[h % DIRT.length];
        if (v === 1) { rt.batchDrawFrame("terrain", full(dirt[0], dirt[1]), px, py); continue; }
        if (v === 2) {
          const c = at(x - 1, y) !== 2 ? 0 : at(x + 1, y) !== 2 ? 2 : 1;
          const r = at(x, y - 1) !== 2 ? 10 : at(x, y + 1) !== 2 ? 12 : 11;
          rt.batchDrawFrame("terrain", full(c, r), px, py);
          continue;
        }
        const g = GRASS[h % 11 < 9 ? h % 3 : 3 + (h % 4)];
        const n = grassy(x, y - 1), s = grassy(x, y + 1), w = grassy(x - 1, y), e = grassy(x + 1, y);
        const all = n && s && w && e && grassy(x - 1, y - 1) && grassy(x + 1, y - 1) && grassy(x - 1, y + 1) && grassy(x + 1, y + 1);
        if (all) { rt.batchDrawFrame("terrain", full(g[0], g[1]), px, py); continue; }
        rt.batchDrawFrame("terrain", full(dirt[0], dirt[1]), px, py);
        for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
          const hn = qx ? e : w, vn = qy ? s : n;
          const dn = grassy(x + (qx ? 1 : -1), y + (qy ? 1 : -1));
          let c, r;
          if (hn && vn) {
            if (dn) { c = g[0]; r = g[1]; } else { c = qx ? 0 : 1; r = 6 + (qy ? 0 : 1); }
          } else { c = hn ? 1 : qx ? 2 : 0; r = vn ? 1 : qy ? 2 : 0; }
          rt.batchDrawFrame("terrain", quad(c, r, qx, qy), px + qx * 16, py + qy * 16);
        }
      }
    }
    // ของชิ้นเล็กแปะลงพื้นเลย (ดอกไม้)
    const flat = /^(wf|flower)/;
    for (const o of objects) {
      if (!flat.test(o.k)) continue;
      const f = this.textures.getFrame("obj", o.k);
      rt.batchDrawFrame("obj", o.k, o.x - (f.width >> 1), o.y - f.height);
    }
    rt.endDraw();

    // ของที่มีความสูง → เป็น sprite เรียงความลึกตามแกน Y
    for (const o of objects) {
      if (flat.test(o.k)) continue;
      const img = this.add.image(o.x, o.y, "obj", o.k).setOrigin(0.5, 1).setDepth(o.y);
      if (o.b && /oak|pine|dead/.test(o.k)) {
        this.add.image(o.x + 4, o.y - 2, "obj", "shadow").setAlpha(0.28).setScale(1.1, 0.8).setDepth(-1e5);
        this.trees.push(img);
      }
    }

    this.cameras.main.setBounds(0, 0, W * T, H * T);
    $("mapName").textContent = map.name;
    buildMinimap(map);
  }

  // ---------- ตัวละคร ----------
  createPlayerView(player, id) {
    const isMe = id === room.sessionId;
    const root = this.add.container(player.x, player.y);
    const shadow = this.add.ellipse(0, -1, 26, 9, 0x000000, 0.28);
    const sprite = this.add.sprite(0, 0, "char_" + player.look, DIR_ROW[player.dir] * 9).setOrigin(0.5, 0.97);
    const label = this.add.text(0, -58, `${player.name}  Lv.${player.level}`, {
      fontFamily: "Mitr, sans-serif", fontSize: "11px", color: isMe ? "#ffd36b" : "#ffffff",
      stroke: "#0d1124", strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1);
    root.add([shadow, sprite, label]);
    let bars = null;
    if (isMe) { bars = this.add.graphics(); root.add(bars); }
    const view = { root, sprite, label, bars, bubble: null, look: player.look,
      tx: player.x, ty: player.y, dir: player.dir, moving: false, player };
    this.drawBars(view);
    return view;
  }

  drawBars(view) {
    if (!view.bars) return;
    const p = view.player, g = view.bars, w = 30;
    g.clear();
    g.fillStyle(0x0d1124, 0.9).fillRect(-w / 2 - 1, 3, w + 2, 8);
    g.fillStyle(0x5fd47a).fillRect(-w / 2, 4, (w * p.hp) / p.maxHp, 3);
    g.fillStyle(0x4a8fe0).fillRect(-w / 2, 8, (w * p.sp) / p.maxSp, 2);
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

  updateOnline() { $("online").textContent = this.views.size; }

  // ---------- ทุกเฟรม ----------
  update(_t, dt) {
    const k = Math.min(1, (dt / 1000) * 14);
    this.views.forEach((v) => {
      const r = v.root;
      if (Math.abs(v.tx - r.x) > 200 || Math.abs(v.ty - r.y) > 200) { r.x = v.tx; r.y = v.ty; }
      else { r.x += (v.tx - r.x) * k; r.y += (v.ty - r.y) * k; }
      r.setDepth(r.y);
      if (v.moving) v.sprite.play(`walk_${v.look}_${v.dir}`, true);
      else { v.sprite.stop(); v.sprite.setFrame(DIR_ROW[v.dir] * 9); }
    });

    // ต้นไม้ที่บังตัวเราจะจางลง
    const me = this.views.get(room.sessionId);
    if (me) {
      const mx = me.root.x, my = me.root.y;
      for (const tr of this.trees) {
        const behind = my < tr.y && my > tr.y - tr.height + 10 && Math.abs(mx - tr.x) < tr.width / 2;
        tr.setAlpha(behind ? 0.55 : 1);
      }
      $("pos").textContent = `${Math.floor(me.tx / T)}, ${Math.floor(me.ty / T)}`;
    }

    if (document.activeElement !== $("chatInput")) {
      const K = this.keys;
      const dx = (K.D.isDown || K.RIGHT.isDown ? 1 : 0) - (K.A.isDown || K.LEFT.isDown ? 1 : 0);
      const dy = (K.S.isDown || K.DOWN.isDown ? 1 : 0) - (K.W.isDown || K.UP.isDown ? 1 : 0);
      if (dx !== this.lastDir.dx || dy !== this.lastDir.dy) {
        this.lastDir = { dx, dy };
        room.send("dir", { dx, dy });
      }
    }
  }
}

function startGame() {
  new Phaser.Game({
    type: location.search.includes("canvas") ? Phaser.CANVAS : Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0d1124",
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: WorldScene,
  });
}

// =============================================================
//  HUD
// =============================================================
function updateStatus(p) {
  $("stName").textContent = p.name;
  $("stJob").textContent = p.job;
  $("stBase").textContent = p.level;
  $("stJobLv").textContent = p.jobLevel;
  $("hpFill").style.width = (100 * p.hp) / p.maxHp + "%";
  $("spFill").style.width = (100 * p.sp) / p.maxSp + "%";
  $("hpTxt").textContent = `${p.hp}/${p.maxHp}`;
  $("spTxt").textContent = `${p.sp}/${p.maxSp}`;
  const v = scene && scene.views.get(room.sessionId);
  if (v) { v.label.setText(`${p.name}  Lv.${p.level}`); scene.drawBars(v); }
}

function drawAvatar(sc, look) {
  const src = sc.textures.get("char_" + look).getSourceImage();
  const ctx = $("avatar").getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 16, 2 * 64 + 6, 32, 32, 0, 0, 48, 48); // ครอปเฉพาะหัว (หันหน้าลง)
}

function buildSlots() {
  const items = $("itemBar"), skills = $("skillBar");
  for (let i = 0; i < 8; i++) items.insertAdjacentHTML("beforeend", `<div class="slot"></div>`);
  for (let i = 1; i <= 9; i++) skills.insertAdjacentHTML("beforeend", `<div class="slot"><small>${i}</small></div>`);
}

// ---------- มินิแมพ ----------
let miniBase = null;
function buildMinimap(map) {
  const cv = $("miniCanvas"), sx = cv.width / map.width, sy = cv.height / map.height;
  miniBase = document.createElement("canvas");
  miniBase.width = cv.width; miniBase.height = cv.height;
  const ctx = miniBase.getContext("2d");
  const COL = ["#5b9a3f", "#b98d5b", "#2f86a6"];
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = COL[map.ground[y * map.width + x]];
      ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
    }
  for (const o of map.objects) {
    if (!o.b) continue;
    ctx.fillStyle = /oak|pine|dead/.test(o.k) ? "#24502a" : /rock/.test(o.k) ? "#9a9a9a" : "#3c7a33";
    ctx.fillRect((o.x / T) * sx - 1, (o.y / T) * sy - 2, 3, 3);
  }
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect();
    const wx = ((e.clientX - r.left) / r.width) * map.width * T;
    const wy = ((e.clientY - r.top) / r.height) * map.height * T;
    room.send("moveTo", { x: wx, y: wy });
  };
  setInterval(drawMinimap, 150);
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
  scene.views.forEach((v, id) => {
    const me = id === room.sessionId;
    ctx.fillStyle = me ? "#ffd36b" : "#ffffff";
    ctx.beginPath();
    ctx.arc(v.root.x * sx, v.root.y * sy, me ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---------- แชท ----------
function setupChat(sc) {
  const input = $("chatInput");
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
  input.addEventListener("focus", () => {
    sc.lastDir = { dx: 0, dy: 0 };
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
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
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

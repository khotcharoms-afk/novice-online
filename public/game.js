// =============================================================
//  ฝั่งผู้เล่น — Phaser 3 + Colyseus  (Phase 2: ต่อสู้ / มอนสเตอร์ / EXP / สกิล)
// =============================================================
const $ = (id) => document.getElementById(id);
const SERVER_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
const T = 32;
const COLS = 9; // เฟรมต่อแถวในไฟล์ภาพตัวละคร
// แถวในไฟล์ภาพ: เดิน 0–3, ฟัน 4–7, ล้ม 8, ร่ายเวท 9–12 (ทิศ ขึ้น/ซ้าย/ลง/ขวา)
const DIR_ROW = { up: 0, left: 1, down: 2, right: 3 };
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
let scene = null;
let gameData = null; // ข้อมูลแผนที่ + สกิล จากเซิร์ฟเวอร์

// =============================================================
//  หน้าสร้างตัวละคร
// =============================================================
const saved = (storeGet("pn_look2") || "m|light|spiked|chestnut").split("|");
const look = { sex: saved[0], skin: saved[1], hair: saved[2], color: saved[3] };
let previewDir = 0, previewFrame = 0;
const imgCache = {};
const loadImg = (path) => {
  if (!imgCache[path]) { const i = new Image(); i.src = `/assets/${path}.png`; i.onload = drawPreview; imgCache[path] = i; }
  return imgCache[path];
};
const lookStr = () => [look.sex, look.skin, look.hair, look.color].join("|");
const layersFor = (lk, job = "villager") => {
  const [sex, skin, hair, color] = lk.split("|");
  return [`look/base_${sex}_${skin}`, `look/outfit_${job}_${sex}`, `look/hair_${hair}_${color}`];
};

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
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  const row = [2, 1, 0, 3][previewDir]; // ลง ซ้าย ขึ้น ขวา
  for (const l of layersFor(lookStr())) {
    const img = loadImg(l);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, (1 + previewFrame) * 64, row * 64, 64, 64, 0, 0, 64, 64);
  }
}
buildCreator();
const previewTimer = setInterval(() => { previewFrame = (previewFrame + 1) % 8; drawPreview(); }, 110);
$("turnBtn").onclick = () => { previewDir = (previewDir + 1) % 4; drawPreview(); };

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
    room = await client.joinOrCreate("world", { name, look: lookStr() });
    storeSet("pn_name", name);
    storeSet("pn_look2", lookStr());
    room.onMessage("system", (text) => addChat("system", esc(text)));
    room.onMessage("chat", ({ id, name, text }) => {
      addChat("chat", `<span class="cname">${esc(name)}:</span> ${esc(text)}`);
      const v = scene && scene.views.get(id);
      if (v) scene.showBubble(v, text);
    });
    room.onMessage("toast", toast);
    room.onLeave(() => addChat("system", "หลุดการเชื่อมต่อ — รีเฟรชหน้าเพื่อเข้าใหม่"));
    clearInterval(previewTimer);
    $("login").remove();
    $("hud").hidden = false;
    startGame();
  } catch (err) {
    console.error(err);
    $("loginErr").textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ถ้าเพิ่งเปิดเว็บ รอประมาณ 1 นาทีแล้วกดใหม่)";
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
    const paths = new Set();
    for (const [sex] of LOOK_OPTS.sex) {
      for (const [skin] of LOOK_OPTS.skin) paths.add(`look/base_${sex}_${skin}`);
      paths.add(`look/outfit_villager_${sex}`);
      for (const [h] of LOOK_OPTS.hair[sex]) for (const [c] of LOOK_OPTS.color) paths.add(`look/hair_${h}_${c}`);
    }
    paths.forEach((p) => this.load.image(p, `/assets/${p}.png`));
    MOB_KINDS.forEach((k) => this.load.image("mobsrc_" + k, `/assets/mobs/${k}.png`));
  }

  create() {
    scene = this;
    this.views = new Map();      // id -> ตัวละคร/มอนสเตอร์บนจอ
    this.trees = [];
    this.lastDir = { dx: 0, dy: 0 };
    this.myTarget = null;
    this.cdEnd = {};
    this.zoomIdx = window.innerWidth >= 1000 ? 2 : 1;
    const cam = this.cameras.main;
    cam.setZoom(ZOOMS[this.zoomIdx]).setBackgroundColor("#22401f").setRoundPixels(true);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";

    MOB_KINDS.forEach((k) => this.buildSheet("mob_" + k, ["mobsrc_" + k]));
    this.targetRing = this.add.ellipse(0, 0, 34, 14).setStrokeStyle(2, 0xff5a5a, 0.9).setDepth(-9000).setVisible(false);

    room.onMessage("map", (data) => { gameData = data; this.buildMap(data); buildSkillBar(); });
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

    // ---------- เหตุการณ์ต่อสู้ ----------
    room.onMessage("atk", ({ id, dir }) => this.playOnce(id, "slash", dir, 380));
    room.onMessage("skillfx", ({ id, dir }) => this.playOnce(id, "slash", dir, 620, 1));
    room.onMessage("cast", ({ id }) => {
      const v = this.views.get(id);
      if (!v) return;
      this.playOnce(id, "cast", v.dir, 520);
      this.sparkle(v.root.x, v.root.y - 20, 0x7dffa8);
    });
    room.onMessage("hit", (h) => this.onHit(h));
    room.onMessage("heal", ({ id, amount }) => {
      const v = this.views.get(id);
      if (v) this.floatText(v.root.x, v.root.y - 72, "+" + amount, "#7dff9a", 15);
    });
    room.onMessage("exp", (n) => {
      const v = this.views.get(room.sessionId);
      if (v) this.floatText(v.root.x, v.root.y - 88, `+${n} EXP`, "#c9a6ff", 12, 1100);
    });
    room.onMessage("lvup", ({ id }) => this.levelUpFx(id));
    room.onMessage("cd", ({ skill, until }) => { this.cdEnd[skill] = performance.now() + until; });

    // ---------- คลิก ----------
    this.input.on("pointerdown", (p, over) => {
      if (document.activeElement === $("chatInput")) $("chatInput").blur();
      const hit = over.find((o) => o.getData && o.getData("mobId"));
      if (hit) {
        this.myTarget = hit.getData("mobId");
        room.send("attack", { id: this.myTarget });
        return;
      }
      this.myTarget = null;
      room.send("moveTo", { x: p.worldX, y: p.worldY });
      this.clickMarker(p.worldX, p.worldY);
    });
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT", false);
    $("zoomIn").onclick = () => this.setZoomIdx(this.zoomIdx + 1);
    $("zoomOut").onclick = () => this.setZoomIdx(this.zoomIdx - 1);
    setupChat(this);
    setupHotkeys();
    this.time.addEvent({ delay: 100, loop: true, callback: renderCooldowns });
  }

  setZoomIdx(i) {
    this.zoomIdx = Phaser.Math.Clamp(i, 0, ZOOMS.length - 1);
    this.cameras.main.setZoom(ZOOMS[this.zoomIdx]);
    $("zoomTxt").textContent = ZOOMS[this.zoomIdx] * 100 + "%";
  }

  // ---------- ประกอบภาพตัวละครจากหลายชั้น (ตัว + ชุด + ผม) ----------
  buildSheet(key, layerKeys) {
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, 576, 832);
    const ctx = tex.getContext();
    for (const k of layerKeys) ctx.drawImage(this.textures.get(k).getSourceImage(), 0, 0);
    for (let i = 0; i < COLS * 13; i++) tex.add(i, 0, (i % COLS) * 64, Math.floor(i / COLS) * 64, 64, 64);
    tex.refresh();
    const seq = (row, from, to) => { const f = []; for (let c = from; c <= to; c++) f.push({ key, frame: row * COLS + c }); return f; };
    for (const dir in DIR_ROW) {
      const d = DIR_ROW[dir];
      this.anims.create({ key: `${key}:walk:${dir}`, frames: seq(d, 1, 8), frameRate: 12, repeat: -1 });
      this.anims.create({ key: `${key}:slash:${dir}`, frames: seq(4 + d, 0, 5), frameRate: 16 });
      this.anims.create({ key: `${key}:cast:${dir}`, frames: seq(9 + d, 0, 6), frameRate: 14 });
    }
    this.anims.create({ key: `${key}:die`, frames: seq(8, 0, 5), frameRate: 10 });
    return key;
  }

  // ---------- แผนที่ ----------
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
    const flat = /^(wf|flower)/;
    for (const o of objects) {
      if (!flat.test(o.k)) continue;
      const f = this.textures.getFrame("obj", o.k);
      rt.batchDrawFrame("obj", o.k, o.x - (f.width >> 1), o.y - f.height);
    }
    rt.endDraw();

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

  // ---------- ตัวละคร / มอนสเตอร์ ----------
  createView(e, id, isMob) {
    const isMe = id === room.sessionId;
    const key = isMob ? "mob_" + e.kind : this.buildSheet(`pl_${e.job}_${e.look}`, layersFor(e.look, e.job));
    const root = this.add.container(e.x, e.y);
    const shadow = this.add.ellipse(0, -1, 26, 9, 0x000000, 0.28);
    const sprite = this.add.sprite(0, 0, key, DIR_ROW[e.dir || "down"] * COLS).setOrigin(0.5, 0.97);
    const label = this.add.text(0, -58, "", {
      fontFamily: "Mitr, sans-serif", fontSize: "11px", color: "#ffffff",
      stroke: "#0d1124", strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 1);
    const bars = this.add.graphics();
    root.add([shadow, sprite, bars, label]);
    if (isMob) {
      sprite.setInteractive({ hitArea: new Phaser.Geom.Rectangle(18, 12, 28, 50), hitAreaCallback: Phaser.Geom.Rectangle.Contains, cursor: "pointer" });
      sprite.setData("mobId", id);
      sprite.on("pointerover", () => { v.hover = true; });
      sprite.on("pointerout", () => { v.hover = false; });
    }
    const v = { id, isMob, isMe, key, root, sprite, label, bars, bubble: null, e,
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
        if (v.isMe) $("deathMsg").hidden = false;
      }
      if (v.isMe && !v.dead) $("deathMsg").hidden = true;
    }
    const lv = e.level;
    if (v.isMob) {
      const me = room.state.players.get(room.sessionId);
      const diff = me ? lv - me.level : 0;
      v.label.setColor(diff >= 6 ? "#ff6b6b" : diff >= 3 ? "#ffb86b" : diff <= -6 ? "#9aa0b4" : "#ffffff");
      v.label.setText(`${e.name}  Lv.${lv}`);
    } else {
      v.label.setColor(v.isMe ? "#ffd36b" : "#ffffff");
      v.label.setText(`${e.name}  Lv.${lv}`);
      if (v.isMe) updateStatus(e);
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

  playOnce(id, kind, dir, ms, repeat = 0) {
    const v = this.views.get(id);
    if (!v || v.dead) return;
    v.dir = dir || v.dir;
    v.busyUntil = this.time.now + ms;
    v.sprite.play({ key: `${v.key}:${kind}:${v.dir}`, repeat });
  }

  // ---------- เอฟเฟกต์ ----------
  onHit({ tgt, src, dmg, crit, miss }) {
    const v = this.views.get(tgt);
    if (!v) return;
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

  levelUpFx(id) {
    const v = this.views.get(id);
    if (!v) return;
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

  updateOnline() { $("online").textContent = room.state.players.size; }

  // ---------- ทุกเฟรม ----------
  update(time, dt) {
    const k = Math.min(1, (dt / 1000) * 14);
    this.views.forEach((v) => {
      const r = v.root;
      if (Math.abs(v.tx - r.x) > 200 || Math.abs(v.ty - r.y) > 200) { r.x = v.tx; r.y = v.ty; }
      else { r.x += (v.tx - r.x) * k; r.y += (v.ty - r.y) * k; }
      r.setDepth(v.dead ? r.y - 40 : r.y);
      // ชื่อมอนแสดงเฉพาะตอนชี้เมาส์ / เป็นเป้าหมาย / โดนตี (จอจะได้ไม่รก)
      if (v.isMob) v.label.setVisible(!v.dead && (v.hover || this.myTarget === v.id || v.e.hp < v.e.maxHp));
      if (v.dead) {
        if (!v.deadShown) { v.deadShown = true; v.sprite.play(`${v.key}:die`); this.tweens.add({ targets: r, alpha: 0.75, duration: 400 }); }
        return;
      }
      if (time < v.busyUntil) return;
      if (v.moving) v.sprite.play(`${v.key}:walk:${v.dir}`, true);
      else { v.sprite.stop(); v.sprite.setFrame(DIR_ROW[v.dir] * COLS); }
    });

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

    if (document.activeElement !== $("chatInput")) {
      const K = this.keys;
      const dx = (K.D.isDown || K.RIGHT.isDown ? 1 : 0) - (K.A.isDown || K.LEFT.isDown ? 1 : 0);
      const dy = (K.S.isDown || K.DOWN.isDown ? 1 : 0) - (K.W.isDown || K.UP.isDown ? 1 : 0);
      if (dx !== this.lastDir.dx || dy !== this.lastDir.dy) {
        this.lastDir = { dx, dy };
        if (dx || dy) this.myTarget = null;
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
  $("stJob").textContent = p.jobName;
  $("stLv").textContent = p.level;
  $("hpFill").style.width = (100 * p.hp) / p.maxHp + "%";
  $("spFill").style.width = (100 * p.sp) / p.maxSp + "%";
  $("hpTxt").textContent = `${p.hp}/${p.maxHp}`;
  $("spTxt").textContent = `${p.sp}/${p.maxSp}`;
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
function mySkills() {
  const me = room.state.players.get(room.sessionId);
  return (gameData && me && gameData.jobSkills[me.job]) || [];
}
function buildSkillBar() {
  const bar = $("skillBar"), items = $("itemBar");
  bar.innerHTML = ""; items.innerHTML = "";
  const list = mySkills();
  for (let i = 0; i < 9; i++) {
    const key = list[i];
    const s = key && gameData.skills[key];
    const el = document.createElement(s ? "button" : "div");
    el.className = s ? "slot skill" : "slot";
    el.dataset.skill = key || "";
    el.innerHTML = `<small>${i + 1}</small>` + (s ? `<b>${s.name}</b><em class="cost">${s.sp}</em>` : "");
    if (s) { el.title = `${s.name} — ${s.desc} (SP ${s.sp})`; el.onclick = () => castSkill(key, el); }
    bar.appendChild(el);
  }
  for (let i = 0; i < 8; i++) items.insertAdjacentHTML("beforeend", `<div class="slot"></div>`);
}
function castSkill(key, el) {
  if (!key) return;
  room.send("skill", { skill: key, target: scene.myTarget });
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
}
function setupHotkeys() {
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === $("chatInput")) return;
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

let toastTimer = null;
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
    scene.myTarget = null;
    room.send("moveTo", {
      x: ((e.clientX - r.left) / r.width) * map.width * T,
      y: ((e.clientY - r.top) / r.height) * map.height * T,
    });
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
  scene.views.forEach((v) => {
    if (v.dead) return;
    ctx.fillStyle = v.isMe ? "#ffd36b" : v.isMob ? "#ff5a5a" : "#ffffff";
    ctx.beginPath();
    ctx.arc(v.root.x * sx, v.root.y * sy, v.isMe ? 3 : v.isMob ? 1.4 : 2.2, 0, Math.PI * 2);
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

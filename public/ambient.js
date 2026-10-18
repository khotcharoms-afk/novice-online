// =============================================================
//  ฉากมีชีวิต: ต้นไม้/หญ้า/ดอกไม้ไหวตามลม · หิ่งห้อย/กลีบดอกไม้/ใบไม้ร่วง/หิมะ/ประกายไฟ ตามฤดูของแผนที่
//  เงาเมฆลอยผ่าน · ประกายบนผิวน้ำ · ตัวละคร/มอนหายใจตอนยืนนิ่ง
//  ปิด/เปิดได้ที่ปุ่ม 🍃 ใต้มินิแมพ (เก็บใน pn_ambient)
// =============================================================
let AMB_ON = (() => { try { return localStorage.getItem("pn_ambient") !== "0"; } catch { return true; } })();
const AMB_LOW = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); // มือถือ: อนุภาคน้อยลง

// ---------- พื้นผิวที่สร้างเอง (ไม่ต้องโหลดไฟล์) ----------
function ambTextures(sc) {
  const T = sc.textures;
  const mk = (key, w, h, draw) => {
    if (T.exists(key)) return;
    const c = T.createCanvas(key, w, h), g = c.getContext();
    draw(g, w, h); c.refresh();
  };
  // จุดเรืองแสงนุ่ม ๆ (หิ่งห้อย/ประกายไฟ/ละออง)
  mk("amb_glow", 32, 32, (g) => {
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.85)");
    r.addColorStop(0.55, "rgba(255,255,255,0.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  });
  // กลีบดอกไม้
  mk("amb_petal", 10, 7, (g) => {
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(5, 3.5, 4.6, 2.8, 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.ellipse(6, 4.2, 2.4, 1.2, 0.3, 0, Math.PI * 2); g.fill();
  });
  // ใบไม้
  mk("amb_leaf", 12, 8, (g) => {
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(1, 4); g.quadraticCurveTo(6, -1, 11, 4); g.quadraticCurveTo(6, 9, 1, 4); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 4); g.lineTo(10, 4); g.stroke();
  });
  // เกล็ดหิมะ/เม็ดทราย
  mk("amb_flake", 8, 8, (g) => {
    const r = g.createRadialGradient(4, 4, 0, 4, 4, 4);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.6, "rgba(255,255,255,0.8)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 8, 8);
  });
  // เงาเมฆ (ก้อนนุ่ม ๆ หลายวงซ้อน)
  mk("amb_cloud", 320, 200, (g) => {
    const blobs = [[110, 100, 90], [190, 90, 80], [160, 125, 85], [240, 115, 60], [80, 120, 60]];
    for (const [x, y, rr] of blobs) {
      const r = g.createRadialGradient(x, y, 0, x, y, rr);
      r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(0.6, "rgba(0,0,0,0.3)"); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, 320, 200);
    }
  });
  // ประกายบนน้ำ (กากบาทเล็ก)
  mk("amb_glint", 11, 11, (g) => {
    g.fillStyle = "#fff"; g.fillRect(5, 1, 1, 9); g.fillRect(1, 5, 9, 1);
    g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(4, 4, 3, 3);
  });
}

// ---------- อนุภาคตามฤดู ----------
// แต่ละชุด: รายการ emitter · n = จำนวนต่อวินาทีบนจอขนาดปกติ (ปรับตามพื้นที่จอ)
const AMB_SETS = {
  firefly: (tint) => ({ tex: "amb_glow", n: 6, add: true, cfg: {
    lifespan: { min: 4000, max: 7000 }, speedX: { min: -14, max: 14 }, speedY: { min: -16, max: 6 },
    scale: { min: 0.32, max: 0.55 }, tint,
    alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * (0.55 + 0.45 * Math.sin(t * 26 + p.life)) },
  } }),
  petal: (tint) => ({ tex: "amb_petal", n: 4, cfg: {
    lifespan: { min: 6000, max: 9000 }, speedX: { min: 18, max: 42 }, speedY: { min: 14, max: 30 },
    scaleY: { min: 1.1, max: 1.6 }, rotate: { start: 0, end: 540 }, tint,
    alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 6, (1 - t) * 4) * 0.9 },
    scaleX: { onEmit: () => 1, onUpdate: (p, k, t) => Math.cos(t * 16 + p.life) * 1.4 },
  } }),
  leaf: (tint) => ({ tex: "amb_leaf", n: 4, cfg: {
    lifespan: { min: 6000, max: 9500 }, speedX: { min: 14, max: 40 }, speedY: { min: 22, max: 40 },
    scaleY: { min: 1.2, max: 1.7 }, rotate: { start: 0, end: 720 }, tint,
    alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 6, (1 - t) * 4) },
    scaleX: { onEmit: () => 1, onUpdate: (p, k, t) => Math.cos(t * 12 + p.life) * 1.5 },
  } }),
  snow: () => ({ tex: "amb_flake", n: 12, cfg: {
    lifespan: { min: 6000, max: 10000 }, speedX: { min: 4, max: 24 }, speedY: { min: 26, max: 52 },
    scale: { min: 0.8, max: 1.7 }, alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 5, (1 - t) * 4) * 0.85 },
  } }),
  ember: () => ({ tex: "amb_glow", n: 10, add: true, cfg: {
    lifespan: { min: 2500, max: 5000 }, speedX: { min: -12, max: 18 }, speedY: { min: -60, max: -26 },
    scale: { start: 0.4, end: 0.08 }, tint: [0xff8a2a, 0xffb040, 0xff5a1a, 0xffd070],
    alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 8) * (1 - t) * (0.7 + 0.3 * Math.sin(t * 30 + p.life)) },
  } }),
  ash: () => ({ tex: "amb_flake", n: 3, cfg: {
    lifespan: { min: 6000, max: 9000 }, speedX: { min: 10, max: 30 }, speedY: { min: 10, max: 26 },
    scale: { min: 0.4, max: 0.8 }, tint: 0x6a5a5a, alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 5, (1 - t) * 4) * 0.6 },
  } }),
  mote: (tint, up = -10) => ({ tex: "amb_glow", n: 3, add: true, cfg: {
    lifespan: { min: 4000, max: 7000 }, speedX: { min: -8, max: 8 }, speedY: { min: up - 8, max: up + 4 },
    scale: { min: 0.26, max: 0.45 }, tint,
    alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.sin(t * Math.PI) * 0.7 },
  } }),
  dust: (tint) => ({ tex: "amb_flake", n: 9, cfg: {
    lifespan: { min: 3000, max: 5000 }, speedX: { min: 60, max: 120 }, speedY: { min: -6, max: 10 },
    scale: { min: 0.4, max: 1 }, tint, alpha: { onEmit: () => 0, onUpdate: (p, k, t) => Math.min(1, t * 5, (1 - t) * 3) * 0.55 },
  } }),
};
const AMB_SEASON = {
  spring: [["firefly", [0xeaff80, 0xc8ff6a, 0xfff6a0]], ["petal", [0xffc6dc, 0xffe4ef, 0xffffff, 0xffb0cc]]],
  summer: [["firefly", [0xf4ff9a, 0xd8ff7a]], ["leaf", [0x7fc24a, 0x9fd85a, 0x5aa83a], 0.35]],
  autumn: [["leaf", [0xe0782a, 0xc94a24, 0xf0a83a, 0xb8642a, 0xe8c050], 1.6], ["firefly", [0xffd27a], 0.5]],
  winter: [["snow"], ["mote", [0xcff4ff], 0.5]],
  swamp: [["mote", [0x9cff6a, 0x6aff9a, 0xc8ff4a], 1.4], ["firefly", [0xb0ff6a], 0.6]],
  ruins: [["dust", [0xe8dcc0, 0xd0c4a8], 0.25], ["mote", [0xfff0c0], 0.8]],
  shadow: [["mote", [0xb070ff, 0x8a4aff, 0xe0a0ff], 1.6]],
  lava: [["ember"], ["ash"]],
  desert: [["dust", [0xf0c890, 0xe0a870, 0xffd8a0]]],
};

// ---------- ติดตั้งตอนสร้างแผนที่ ----------
function setupAmbient(sc, map) {
  ambTextures(sc);
  const season = String(sc.tKey || "").replace("terrain_", "") || "summer";
  const cam = sc.cameras.main;
  const A = sc.amb = { sway: [], emitters: [], clouds: [], water: [], zone: new Phaser.Geom.Rectangle(0, 0, 10, 10), nextGlint: 0, season };
  // ย้ายแผนที่ (ฉากเริ่มใหม่) → ทิ้งของเก่า
  sc.events.once("shutdown", () => { if (sc.amb === A) sc.amb = null; });

  // ต้นไม้/พุ่มไม้/หญ้า/ดอกไม้ที่เป็นภาพแยก → ไหวตามลม
  sc.children.list.forEach((o) => {
    if (o.type !== "Image" || o.texture.key !== sc.oKey) return;
    const k = o.frame.name;
    const amp = /^(oak|doak|dead)/.test(k) ? 0.014 : /^(pine|cypress)/.test(k) ? 0.01 : /^bush/.test(k) ? 0.03
      : /^(tuft|reed)/.test(k) ? 0.09 : /^fern/.test(k) ? 0.05 : /^flower/.test(k) ? 0.11 : 0;
    if (amp) A.sway.push({ o, amp, ph: (o.x * 0.37 + o.y * 0.11) % 6.28 });
  });

  // หญ้าตกแต่งเพิ่มบนพื้นหญ้า (ไหวตามลม) — ทำให้พื้นดูหนาแน่นมีชีวิต
  const { width: W, height: H, ground } = map;
  const hasTuft = sc.textures.get(sc.oKey).has("tuft1");
  const busy = new Set((map.objects || []).map((o) => `${Math.floor(o.x / T)},${Math.floor(o.y / T)}`));
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const v = ground[y * W + x];
    if (v === 2) { A.water.push(x, y); continue; }
    if (!hasTuft || v !== 0 || busy.has(`${x},${y}`)) continue;
    const h = ((x * 92837111) ^ (y * 689287499)) >>> 0;
    if (h % 13) continue;
    const ox = x * T + 6 + (h % 20), oy = y * T + 12 + ((h >> 5) % 18);
    const img = sc.add.image(ox, oy, sc.oKey, "tuft" + (1 + (h % 3))).setOrigin(0.5, 1).setDepth(oy).setScale(0.62 + ((h >> 9) % 4) * 0.06);
    if ((h >> 3) & 1) img.setFlipX(true);
    A.sway.push({ o: img, amp: 0.1, ph: (ox * 0.37 + oy * 0.11) % 6.28 });
  }

  // อนุภาคตามฤดู
  const set = AMB_SEASON[season] || AMB_SEASON.summer;
  for (const [name, tint, mul = 1] of set) {
    const S = AMB_SETS[name](tint);
    const em = sc.add.particles(0, 0, S.tex, {
      ...S.cfg, emitting: false,
      emitZone: { type: "random", source: A.zone },
      blendMode: S.add ? "ADD" : "NORMAL",
    }).setDepth(9e5);
    em.ambRate = S.n * mul * (AMB_LOW ? 0.5 : 1);
    em.ambAcc = 0;
    A.emitters.push(em);
  }
  // ใส่อนุภาคเริ่มต้นให้เต็มจอเลย ไม่ต้องรอ
  A.prewarm = true;

  // เงาเมฆลอยผ่าน (ไม่มีในดันเจี้ยน/แผนที่มืด)
  if (!/shadow|lava/.test(season)) {
    const n = Math.max(3, Math.round((W * H) / 900));
    for (let i = 0; i < n; i++) {
      const c = sc.add.image(Math.random() * W * T, Math.random() * H * T, "amb_cloud")
        .setDepth(-5e4).setAlpha(season === "winter" ? 0.1 : 0.26).setScale(2.2 + Math.random() * 1.6, 1.6 + Math.random() * 1.2);
      c.vx = 9 + Math.random() * 7; c.vy = 2 + Math.random() * 3;
      A.clouds.push(c);
    }
  }
  ambApply(sc);
}

// เปิด/ปิด
function ambApply(sc) {
  const A = sc && sc.amb;
  if (!A) return;
  for (const e of A.emitters) { e.setVisible(AMB_ON); if (!AMB_ON) e.killAll(); }
  for (const c of A.clouds) c.setVisible(AMB_ON);
  if (!AMB_ON) for (const s of A.sway) s.o.setRotation(0);
  A.prewarm = AMB_ON;
}
function toggleAmbient() {
  AMB_ON = !AMB_ON;
  try { localStorage.setItem("pn_ambient", AMB_ON ? "1" : "0"); } catch {}
  ambBtnSync();
  if (typeof scene !== "undefined" && scene) {
    ambApply(scene);
    if (!AMB_ON && scene.views) scene.views.forEach((v) => ambBreath(v, 0, false));
  }
}
function ambBtnSync() {
  const b = document.getElementById("ambBtn");
  if (b) { b.classList.toggle("off", !AMB_ON); b.title = AMB_ON ? "ฉากเคลื่อนไหว: เปิด (กดเพื่อปิด ถ้าเครื่องกระตุก)" : "ฉากเคลื่อนไหว: ปิด (กดเพื่อเปิด)"; }
}
(() => { const b = document.getElementById("ambBtn"); if (b) { b.onclick = toggleAmbient; ambBtnSync(); } })();

// ---------- ทุกเฟรม ----------
function updateAmbient(sc, time, dt) {
  const A = sc.amb;
  if (!A || !AMB_ON) return;
  if (A.emitters.length && !A.emitters[0].anims) { sc.amb = null; return; } // ของจากฉากเก่า
  const cam = sc.cameras.main, wv = cam.worldView;
  const t = time / 1000, s = Math.min(0.1, dt / 1000);
  const m = 120, x0 = wv.x - m, x1 = wv.right + m, y0 = wv.y - 40, y1 = wv.bottom + 260;

  // ลม: คลื่นที่เคลื่อนผ่านแผนที่ + ลมกระโชกเป็นช่วง ๆ
  const gust = Math.pow(Math.max(0, Math.sin(t * 0.33)), 4) * 0.9;
  for (const w of A.sway) {
    const o = w.o;
    if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
    const wave = Math.sin(t * 1.25 - o.x * 0.006 + w.ph * 0.25) * 0.55 + Math.sin(t * 2.7 + w.ph) * 0.22;
    o.setRotation(w.amp * (0.3 + wave + gust * (0.6 + 0.4 * Math.sin(t * 6 + w.ph))));
  }

  // พื้นที่ปล่อยอนุภาค = จอที่มองเห็น (กว้างขึ้นด้านบน/ซ้ายให้ของที่ลอยเข้าจอ)
  A.zone.setTo(wv.x - 60, wv.y - 60, wv.width + 120, wv.height + 120);
  const area = (wv.width * wv.height) / (1280 * 720);
  for (const e of A.emitters) {
    if (A.prewarm) { const n = Math.round(e.ambRate * area * 5); for (let i = 0; i < n; i++) e.emitParticle(1); continue; }
    e.ambAcc += e.ambRate * area * s;
    if (e.ambAcc >= 1) { const n = Math.floor(e.ambAcc); e.ambAcc -= n; e.emitParticle(n); }
  }
  A.prewarm = false;

  // เมฆลอย
  const MW = sc.map.width * T, MH = sc.map.height * T;
  for (const c of A.clouds) {
    c.x += c.vx * s; c.y += c.vy * s;
    if (c.x - 400 > MW) { c.x = -400; c.y = Math.random() * MH; }
    if (c.y - 300 > MH) { c.y = -300; }
  }

  // ประกายบนน้ำ
  if (A.water.length && time > A.nextGlint) {
    A.nextGlint = time + (AMB_LOW ? 260 : 140);
    for (let tries = 0; tries < 6; tries++) {
      const i = (Math.random() * (A.water.length / 2)) | 0, wx = A.water[i * 2] * T + Math.random() * T, wy = A.water[i * 2 + 1] * T + Math.random() * T;
      if (wx < wv.x || wx > wv.right || wy < wv.y || wy > wv.bottom) continue;
      const g = sc.add.image(wx, wy, "amb_glint").setDepth(-4e4).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.9);
      sc.tweens.add({ targets: g, scale: 0.6 + Math.random() * 0.5, alpha: 0, duration: 700 + Math.random() * 500, ease: "Sine.easeOut", onComplete: () => g.destroy() });
      break;
    }
  }
}

// ตัวละคร/มอนยืนนิ่ง: หายใจเบา ๆ (ยืด-หดแนวตั้งนิดหน่อย)
function ambBreath(v, time, idle) {
  const sp = v.sprite;
  if (!sp || !sp.scene || sp.scene.tweens.isTweening(sp)) return;
  const base = v.scaleNow || (v.e && v.e.scale) || 1;
  if (!idle || !AMB_ON) { if (v.breathing) { v.breathing = false; sp.setScale(base); } return; }
  v.breathing = true;
  if (v.bph == null) v.bph = Math.random() * 6.28;
  const k = Math.sin(time / (v.isMob ? 380 : 520) + v.bph);
  sp.setScale(base * (1 - k * 0.012), base * (1 + k * 0.028));
}

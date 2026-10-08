// =============================================================
//  เอฟเฟกต์สกิลอาชีพขั้น 2 (40 สกิล) — ท่าทาง + แสงสี เฉพาะของแต่ละสกิล
//  game.js → skillFx(f) เรียก SKILL2_FX[f.skill](sc, f, v, tv) ถ้ามี
//  f: { id ผู้ใช้, skill, dir, tgt, x, y (เป้า/จุด), r (รัศมี), tgts (ลูกโซ่), again (ครั้งถัดไปของสกิลหลายจังหวะ) }
//  v = view ผู้ใช้ · tv = view เป้าหมาย (มอน)
// =============================================================
const FX2 = {
  TOP: 1e6 - 1, GROUND: -7990,
  add(sc, o, depth) { return o.setDepth(depth ?? FX2.TOP); },
  // แสงวงพุ่งออก (บนพื้น = ellipse แบน)
  shock(sc, x, y, r, color, ms = 420, width = 4, ground = true) {
    // วาดใหม่ทุกเฟรม (เส้นหนาคงที่ ไม่บวมตามการขยาย)
    const g = sc.add.graphics().setDepth(ground ? FX2.GROUND : FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0.1 }, sy = ground ? 0.6 : 1;
    sc.tweens.add({ targets: st, k: 1, duration: ms, ease: "Quad.easeOut", onUpdate: () => {
      const a = 1 - st.k * st.k, rr = r * st.k;
      g.clear();
      g.lineStyle(width * 2.2, color, 0.25 * a); g.strokeEllipse(x, y, rr * 2, rr * 2 * sy);
      g.lineStyle(width, color, 0.95 * a); g.strokeEllipse(x, y, rr * 2, rr * 2 * sy);
    }, onComplete: () => g.destroy() });
    return g;
  },
  // วงเต็มสีจาง ๆ บนพื้น
  disc(sc, x, y, r, color, ms = 600, alpha = 0.3) {
    const e = sc.add.ellipse(x, y, r * 2, r * 1.24, color, alpha).setDepth(FX2.GROUND).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
    sc.tweens.add({ targets: e, scale: 1, duration: ms * 0.35, ease: "Back.easeOut" });
    sc.tweens.add({ targets: e, alpha: 0, delay: ms * 0.5, duration: ms * 0.5, onComplete: () => e.destroy() });
    return e;
  },
  // อนุภาค: n เม็ด กระจายรัศมี spread ลอยขึ้น rise
  sparks(sc, x, y, color, n = 10, spread = 30, rise = 20, ms = 500, size = 2.5) {
    for (let i = 0; i < n; i++) {
      const p = sc.add.circle(x, y, size * (0.6 + Math.random() * 0.8), Array.isArray(color) ? color[i % color.length] : color, 1).setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
      const a = Math.random() * Math.PI * 2, d = spread * (0.3 + Math.random() * 0.7);
      sc.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 - rise * (0.5 + Math.random()), alpha: 0, scale: 0.2, duration: ms * (0.7 + Math.random() * 0.6), onComplete: () => p.destroy() });
    }
  },
  // อนุภาคไหลเข้าหาจุด (ดูด/รวมพลัง)
  converge(sc, x, y, color, n = 12, r = 50, ms = 450) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const p = sc.add.circle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2.2, color, 1).setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: p, x, y, alpha: 0.2, duration: ms, delay: i * 12, ease: "Quad.easeIn", onComplete: () => p.destroy() });
    }
  },
  // รอยฟันเป็นเส้นตรงเรืองแสง (มุม ang, ยาว len) — ขยายจากกลางแล้วหาย
  cut(sc, x, y, ang, len, color, ms = 260, w = 4) {
    const g = sc.add.graphics().setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0 };
    const dx = Math.cos(ang), dy = Math.sin(ang);
    sc.tweens.add({ targets: st, k: 1, duration: ms, onUpdate: () => {
      const k = st.k, L = len * Math.min(1, k * 2.2) / 2, a = 1 - Math.max(0, k - 0.45) / 0.55;
      g.clear();
      g.lineStyle(w * 2.4, color, 0.35 * a); g.lineBetween(x - dx * L, y - dy * L, x + dx * L, y + dy * L);
      g.lineStyle(w, 0xffffff, a); g.lineBetween(x - dx * L, y - dy * L, x + dx * L, y + dy * L);
    }, onComplete: () => g.destroy() });
  },
  // เสี้ยวพระจันทร์ (ฟันเป็นโค้ง) รอบจุด x,y รัศมี r จากมุม a0 ถึง a1
  crescent(sc, x, y, r, a0, a1, color, ms = 300, w = 7) {
    const g = sc.add.graphics().setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0 };
    sc.tweens.add({ targets: st, k: 1, duration: ms, onUpdate: () => {
      const k = st.k, end = a0 + (a1 - a0) * Math.min(1, k * 1.8), a = 1 - Math.max(0, k - 0.5) / 0.5;
      g.clear();
      g.lineStyle(w * 2, color, 0.3 * a); g.beginPath(); g.arc(x, y, r, a0, end, a1 < a0); g.strokePath();
      g.lineStyle(w, color, 0.9 * a); g.beginPath(); g.arc(x, y, r, a0, end, a1 < a0); g.strokePath();
      g.lineStyle(2, 0xffffff, a); g.beginPath(); g.arc(x, y, r + w * 0.3, a0, end, a1 < a0); g.strokePath();
    }, onComplete: () => g.destroy() });
  },
  // ลำแสงตกจากฟ้า
  pillar(sc, x, y, color, w = 26, h = 260, ms = 520) {
    const outer = sc.add.rectangle(x, y - h / 2, w, h, color, 0.35).setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
    const core = sc.add.rectangle(x, y - h / 2, w * 0.35, h, 0xffffff, 0.9).setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD);
    [outer, core].forEach((o) => { o.scaleX = 0.1; sc.tweens.add({ targets: o, scaleX: 1, duration: 90, yoyo: false }); sc.tweens.add({ targets: o, alpha: 0, scaleX: 1.6, delay: ms * 0.4, duration: ms * 0.6, onComplete: () => o.destroy() }); });
    FX2.disc(sc, x, y, w * 1.6, color, ms);
  },
  // ฟองป้องกันรอบตัว
  bubble(sc, v, color, ms = 1500, r = 26) {
    const b = sc.add.ellipse(0, -24, r * 2, r * 2.3, color, 0.14).setStrokeStyle(2, color, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    v.root.add(b);
    b.setScale(0.3);
    sc.tweens.add({ targets: b, scale: 1, duration: 200, ease: "Back.easeOut" });
    sc.tweens.add({ targets: b, alpha: 0.55, duration: 300, yoyo: true, repeat: Math.max(0, Math.floor(ms / 600) - 1) });
    sc.time.delayedCall(ms, () => sc.tweens.add({ targets: b, alpha: 0, scale: 1.3, duration: 250, onComplete: () => b.destroy() }));
  },
  // วงเวทหมุนบนพื้น (ดาว n แฉก)
  sigil(sc, x, y, r, color, ms = 900, points = 5) {
    const g = sc.add.graphics().setDepth(FX2.GROUND + 1).setBlendMode(Phaser.BlendModes.ADD);
    const st = { k: 0, rot: 0, a: 1 };
    const P = (ang, rr) => ({ x: x + Math.cos(ang) * rr * st.k, y: y + Math.sin(ang) * rr * st.k * 0.6 }); // วาดแบนบนพื้น (หมุนในระนาบพื้น)
    const draw = () => {
      g.clear();
      const ring = (rr, w) => { const p = []; for (let i = 0; i < 40; i++) p.push(P((i / 40) * Math.PI * 2, rr)); g.lineStyle(w, color, 0.95 * st.a); g.strokePoints(p, true); };
      ring(r, 2); ring(r * 0.82, 1.5);
      const star = []; for (let i = 0; i < points; i++) star.push(P(st.rot - Math.PI / 2 + (i * 2 * Math.PI * 2) / points, r * 0.82));
      g.lineStyle(1.5, color, 0.9 * st.a); g.strokePoints(star, true);
      g.fillStyle(color, 0.9 * st.a);
      for (let i = 0; i < 12; i++) { const q = P(-st.rot + (i / 12) * Math.PI * 2, r * 0.91); g.fillCircle(q.x, q.y, 1.6); }
    };
    sc.tweens.add({ targets: st, k: 1, duration: 220, ease: "Back.easeOut" });
    sc.tweens.add({ targets: st, rot: 2, duration: ms, onUpdate: draw });
    sc.tweens.add({ targets: st, a: 0, delay: ms * 0.65, duration: ms * 0.35, onComplete: () => g.destroy() });
    draw();
    return g;
  },
  // เงาซ้อน (afterimage) ของตัวละคร
  ghost(sc, v, x, y, tint, ms = 320) {
    if (!v.sprite || !v.sprite.texture) return;
    const s = sc.add.sprite(x, y + (v.sprite.y || 0), v.sprite.texture.key, v.sprite.frame.name).setOrigin(v.sprite.originX, v.sprite.originY)
      .setScale(v.sprite.scaleX * (v.root.scaleX || 1), v.sprite.scaleY * (v.root.scaleY || 1)).setTint(tint).setAlpha(0.6).setDepth(v.root.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: s, alpha: 0, duration: ms, onComplete: () => s.destroy() });
  },
  // ลูกกระสุน/ของบินจาก a → b (โค้งได้)
  fly(sc, from, to, make, ms, arc = 0, onDone) {
    const o = make();
    o.setPosition(from.x, from.y).setDepth(FX2.TOP);
    const st = { k: 0 };
    sc.tweens.add({ targets: st, k: 1, duration: ms, ease: "Sine.easeIn", onUpdate: () => {
      const k = st.k; o.x = from.x + (to.x - from.x) * k; o.y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * arc;
      if (o.rotation !== undefined && o._spin) o.rotation += o._spin;
    }, onComplete: () => { o.destroy(); if (onDone) onDone(); } });
  },
  // พันธมิตร (ผู้เล่น) ในรัศมีรอบตัวผู้ใช้
  allies(sc, v, r) { const out = []; sc.views.forEach((w) => { if (!w.isMob && !w.dead && Math.hypot(w.root.x - v.root.x, w.root.y - v.root.y) <= (r || 200)) out.push(w); }); return out; },
  mobsIn(sc, x, y, r) { const out = []; sc.views.forEach((w) => { if (w.isMob && !w.dead && Math.hypot(w.root.x - x, w.root.y - y) <= r) out.push(w); }); return out; },
  // ตัวกระโดด (ยก sprite ขึ้นแล้วลง) — root ยังอยู่ที่เดิม
  hop(sc, v, h = 40, ms = 300) {
    if (!v.sprite) return;
    const y0 = v.sprite.y;
    sc.tweens.add({ targets: v.sprite, y: y0 - h, duration: ms / 2, ease: "Quad.easeOut", yoyo: true, onComplete: () => (v.sprite.y = y0) });
  },
  angTo(v, tv) { return tv ? Math.atan2(tv.root.y - v.root.y, tv.root.x - v.root.x) : { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[v.dir] || 0; },
  dirOf(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"); },
  shake(sc, f, ms, k) { if (f.id === room.sessionId || (sc.views.get(room.sessionId) && Math.hypot(sc.views.get(room.sessionId).root.x - (f.x ?? 0), sc.views.get(room.sessionId).root.y - (f.y ?? 0)) < 300)) sc.cameras.main.shake(ms, k); },
};
const T2 = (tv) => (tv ? { x: tv.root.x, y: tv.root.y - 26 } : null);
const ME2 = (v, dy = 26) => ({ x: v.root.x, y: v.root.y - dy });

const SKILL2_FX = {
  // ================= Paladin =================
  holysword(sc, f, v, tv) { // ฟันดาบแล้วลำแสงศักดิ์สิทธิ์ตกลงกลางเป้า + ไม้กางเขนแสง
    sc.playOnce(f.id, "slash", f.dir, 520);
    if (!tv) return;
    const t = T2(tv);
    sc.time.delayedCall(120, () => {
      FX2.crescent(sc, t.x, t.y, 26, -2.4, 0.6, 0xffe9a0, 260);
      FX2.pillar(sc, tv.root.x, tv.root.y, 0xffe08a, 30, 300, 560);
      FX2.cut(sc, t.x, t.y - 4, -Math.PI / 2, 46, 0xfff4c0, 360, 3); FX2.cut(sc, t.x, t.y - 10, 0, 28, 0xfff4c0, 360, 3);
      FX2.shock(sc, tv.root.x, tv.root.y, (f.r || 60) + 10, 0xffe08a, 420);
      FX2.sparks(sc, t.x, t.y, [0xffffff, 0xffe08a], 14, 34, 30);
      FX2.shake(sc, f, 100, 0.004);
    });
  },
  masstaunt(sc, f, v) { // ทุบโล่ คลื่นแดงสองชั้น มอนรอบตัวขึ้น "!"
    sc.playOnce(f.id, "slash", "down", 420);
    const r = f.r || 200;
    sc.time.delayedCall(140, () => {
      FX2.shock(sc, v.root.x, v.root.y, r, 0xff5a3a, 520, 6); sc.time.delayedCall(140, () => FX2.shock(sc, v.root.x, v.root.y, r * 0.8, 0xffb04a, 460, 4));
      FX2.sparks(sc, v.root.x, v.root.y - 20, 0xffc080, 10, 30, 10, 350);
      FX2.mobsIn(sc, v.root.x, v.root.y, r).forEach((m) => sc.floatText(m.root.x, m.root.y - 60 * (m.e.scale || 1), "!", "#ff5a3a", 20, 900));
      FX2.shake(sc, f, 140, 0.005);
    });
  },
  guardaura(sc, f, v) { // โดมแสงทองครอบเพื่อนรอบตัว + โล่ลอยขึ้นบนหัวทุกคน
    sc.playOnce(f.id, "cast", f.dir, 600);
    FX2.sigil(sc, v.root.x, v.root.y, Math.min(120, f.r || 120), 0xffe9a0, 1100, 6);
    FX2.allies(sc, v, f.r).forEach((a, i) => sc.time.delayedCall(i * 60, () => {
      FX2.bubble(sc, a, 0xffe08a, 900, 24);
      sc.floatText(a.root.x, a.root.y - 70, "🛡", "#ffe08a", 16, 900);
    }));
  },
  divineshield(sc, f, v) { // ฟองแสงขาวทองหนาครอบตัว (อมตะชั่วครู่)
    sc.playOnce(f.id, "cast", f.dir, 500);
    FX2.converge(sc, v.root.x, v.root.y - 24, 0xffffff, 16, 60, 300);
    sc.time.delayedCall(280, () => { FX2.bubble(sc, v, 0xfff4c0, 2400, 30); FX2.pillar(sc, v.root.x, v.root.y, 0xffffff, 40, 200, 420); });
  },
  // ================= Dark Knight =================
  bloodblade(sc, f, v, tv) { // เสี้ยวโลหิตใหญ่ + หยดเลือดไหลกลับเข้าตัว
    sc.playOnce(f.id, "slash", f.dir, 520);
    if (!tv) return;
    const t = T2(tv), a = FX2.angTo(v, tv);
    sc.time.delayedCall(90, () => {
      FX2.crescent(sc, t.x - Math.cos(a) * 10, t.y - Math.sin(a) * 10, 34, a - 2.2, a + 1.0, 0xc01030, 280, 9);
      FX2.sparks(sc, t.x, t.y, [0xff2040, 0x900010], 14, 30, -10, 500);
      for (let i = 0; i < 7; i++) sc.time.delayedCall(160 + i * 40, () => FX2.fly(sc, { x: t.x + (Math.random() - 0.5) * 16, y: t.y }, ME2(v), () => sc.add.circle(0, 0, 2.6, 0xff3050, 1).setBlendMode(Phaser.BlendModes.ADD), 320, 20));
      FX2.shake(sc, f, 90, 0.004);
    });
  },
  thornarmor(sc, f, v) { // หนามม่วงงอกรอบตัว
    sc.playOnce(f.id, "cast", f.dir, 500);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, x = Math.cos(a) * 22, y = -20 + Math.sin(a) * 14;
      const sp = sc.add.triangle(v.root.x + x, v.root.y + y, 0, 6, 4, -12, 8, 6, 0xa060ff, 0.95).setStrokeStyle(1, 0xe0c0ff).setRotation(a + Math.PI / 2).setScale(0.1).setDepth(v.root.depth + (y > -20 ? 1 : -1));
      sc.tweens.add({ targets: sp, scale: 1.1, duration: 160, delay: i * 25, ease: "Back.easeOut" });
      sc.tweens.add({ targets: sp, alpha: 0, scale: 0.6, delay: 900, duration: 300, onComplete: () => sp.destroy() });
    }
    FX2.shock(sc, v.root.x, v.root.y, 40, 0xa060ff, 400);
  },
  weakencurse(sc, f, v) { // หมอกม่วงดำแผ่ออก หัวกะโหลกลอยเหนือมอน
    sc.playOnce(f.id, "cast", f.dir, 600);
    const r = f.r || 140;
    FX2.sigil(sc, v.root.x, v.root.y, Math.min(r, 130), 0x7a3aff, 900, 5);
    FX2.disc(sc, v.root.x, v.root.y, r, 0x3a1060, 900, 0.45);
    FX2.mobsIn(sc, v.root.x, v.root.y, r).forEach((m, i) => sc.time.delayedCall(100 + i * 40, () => {
      sc.floatText(m.root.x, m.root.y - 56 * (m.e.scale || 1), "💀", "#c890ff", 14, 900);
      FX2.sparks(sc, m.root.x, m.root.y - 20, 0x7a3aff, 6, 18, 30, 600);
    }));
  },
  // ================= Berserker =================
  whirlwind(sc, f, v) { // หมุนตัว 3 รอบ เสี้ยวแดงรอบตัว + ฝุ่นลม
    const dirs = ["down", "left", "up", "right"], r = f.r || 90;
    for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 250, () => {
      for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 55, () => { if (v.sprite) { v.dir = dirs[k]; sc.playOnce(f.id, "slash", dirs[k], 70); } });
      const a0 = Math.random() * Math.PI * 2;
      FX2.crescent(sc, v.root.x, v.root.y - 18, r * 0.55, a0, a0 + Math.PI * 1.8, 0xff4a3a, 240, 8);
      FX2.shock(sc, v.root.x, v.root.y, r, 0xff8a6a, 300, 3);
      FX2.sparks(sc, v.root.x, v.root.y - 4, 0xc8a070, 8, r * 0.8, 6, 400, 2);
      FX2.mobsIn(sc, v.root.x, v.root.y, r).forEach((m) => FX2.cut(sc, m.root.x, m.root.y - 24, Math.random() * Math.PI, 30, 0xff6a5a, 180, 3));
    });
    FX2.shake(sc, f, 300, 0.004);
  },
  leapstrike(sc, f, v, tv) { // กระโดดสูง → ทุบลงกลางวง (หลุมแตก + เศษหิน)
    sc.playOnce(f.id, "slash", f.dir, 520);
    FX2.ghost(sc, v, v.root.x, v.root.y, 0xff6a3a, 400);
    FX2.hop(sc, v, 56, 300);
    const x = f.x ?? v.root.x, y = f.y ?? v.root.y;
    sc.time.delayedCall(220, () => {
      FX2.shock(sc, x, y, (f.r || 80) + 10, 0xff8a4a, 420, 7);
      FX2.disc(sc, x, y, (f.r || 80) * 0.7, 0x5a2a10, 700, 0.5);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; FX2.fly(sc, { x, y: y - 6 }, { x: x + Math.cos(a) * 50, y: y + Math.sin(a) * 30 }, () => sc.add.rectangle(0, 0, 4, 3, 0x8a6a4a), 380, 26); }
      FX2.sparks(sc, x, y - 10, 0xffb070, 10, 40, 20);
      FX2.shake(sc, f, 220, 0.01);
    });
  },
  bloodboil(sc, f, v) { // เลือดเดือด: เปลวแดงพลุ่งขึ้นจากตัว
    sc.playOnce(f.id, "cast", f.dir, 500);
    FX2.pillar(sc, v.root.x, v.root.y, 0xff2a2a, 34, 110, 600);
    for (let i = 0; i < 14; i++) sc.time.delayedCall(i * 35, () => FX2.sparks(sc, v.root.x + (Math.random() - 0.5) * 24, v.root.y - 6, [0xff3a2a, 0xff9a3a], 1, 6, 60, 600, 3.5));
    sc.floatText(v.root.x, v.root.y - 80, "RAGE!", "#ff4a3a", 14, 800);
  },
  // ================= Blademaster =================
  iaido(sc, f, v, tv) { // ชักดาบเร็วแสง: เงาซ้อน → เส้นฟันขาวฟ้ายาวผ่านเป้า → ประกาย
    if (!tv) return;
    const t = T2(tv), a = FX2.angTo(v, tv);
    FX2.converge(sc, v.root.x, v.root.y - 24, 0x9fe3ff, 10, 30, 160);
    sc.time.delayedCall(140, () => {
      sc.playOnce(f.id, "slash", f.dir, 320);
      FX2.ghost(sc, v, v.root.x, v.root.y, 0x9fe3ff, 300);
      FX2.cut(sc, t.x, t.y, a + 0.25, 110, 0x9fe3ff, 380, 5);
      sc.time.delayedCall(60, () => { FX2.sparks(sc, t.x, t.y, [0xffffff, 0x9fe3ff], 16, 40, 10, 420); FX2.shock(sc, tv.root.x, tv.root.y, 50, 0x9fe3ff, 300); });
      if (f.id === room.sessionId) sc.cameras.main.flash(80, 160, 220, 255);
      FX2.shake(sc, f, 120, 0.006);
    });
  },
  thousandcuts(sc, f, v, tv) { // ฟันรัว 5 ครั้ง เส้นฟันมุมสุ่มรอบเป้า
    if (!tv) return;
    for (let i = 0; i < 5; i++) sc.time.delayedCall(i * 110, () => {
      sc.playOnce(f.id, "slash", f.dir, 110);
      const t = T2(tv);
      FX2.cut(sc, t.x + (Math.random() - 0.5) * 12, t.y + (Math.random() - 0.5) * 12, Math.random() * Math.PI, 40 + Math.random() * 16, i % 2 ? 0xc0e8ff : 0x9fe3ff, 220, 3);
      FX2.sparks(sc, t.x, t.y, 0xffffff, 4, 20, 6, 260, 2);
    });
    sc.time.delayedCall(600, () => { if (tv.root) { FX2.cut(sc, tv.root.x, tv.root.y - 26, -0.6, 70, 0xffffff, 300, 5); FX2.shake(sc, f, 120, 0.006); } });
  },
  bladefocus(sc, f, v) { // สมาธิดาบ: แสงฟ้าไหลเข้าตัว + ตาเป็นประกาย
    sc.playOnce(f.id, "cast", f.dir, 600);
    FX2.converge(sc, v.root.x, v.root.y - 26, 0x9fe3ff, 20, 70, 500);
    sc.time.delayedCall(450, () => { FX2.shock(sc, v.root.x, v.root.y - 26, 40, 0xc0f0ff, 300, 2, false); FX2.sparks(sc, v.root.x + 4, v.root.y - 46, 0xffffff, 6, 8, 4, 300, 2); });
  },
  shadowslash(sc, f, v, tv) { // พุ่งทะลุ: เงาซ้อนตลอดทาง + เส้นฟันขวางเป้า
    const x0 = v.root.x, y0 = v.root.y, x1 = f.x ?? x0, y1 = f.y ?? y0, a = Math.atan2(y1 - y0, x1 - x0);
    sc.playOnce(f.id, "slash", f.dir, 420);
    for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 22, () => FX2.ghost(sc, v, x0 + (x1 - x0) * (i / 5) * 1.2, y0 + (y1 - y0) * (i / 5) * 1.2, 0x6a5aff, 280));
    sc.time.delayedCall(120, () => {
      FX2.cut(sc, x1, y1 - 24, a, 90, 0x8a7aff, 360, 5);
      FX2.cut(sc, x1, y1 - 24, a + Math.PI / 2, 40, 0xc0b8ff, 300, 3);
      FX2.sparks(sc, x1, y1 - 24, 0x8a7aff, 12, 40, 10, 400);
      FX2.shake(sc, f, 120, 0.006);
    });
  },
  // ================= Sniper =================
  piercing(sc, f, v, tv) { // ยิงธนูเจาะเกราะ: ลูกศรใหญ่หมุนสว่าง + แนวทะลุเลยเป้าไป
    sc.playOnce(f.id, "shoot", f.dir, 560);
    if (!tv) return;
    sc.time.delayedCall(SHOOT_RELEASE_MS, () => {
      const a = ME2(v, 30), b = T2(tv), ang = Math.atan2(b.y - a.y, b.x - a.x);
      FX2.fly(sc, a, b, () => { const c = sc.add.container(0, 0, [sc.add.rectangle(0, 0, 26, 3, 0x7dffd0).setBlendMode(Phaser.BlendModes.ADD), sc.add.triangle(14, 0, 0, -4, 7, 0, 0, 4, 0xffffff)]); c.rotation = ang; return c; }, 160, 0, () => {
        FX2.cut(sc, b.x + Math.cos(ang) * 40, b.y + Math.sin(ang) * 40, ang, 120, 0x7dffd0, 320, 3);
        FX2.shock(sc, b.x, b.y, 30, 0x7dffd0, 260, 3, false);
        FX2.sparks(sc, b.x, b.y, [0xffffff, 0x7dffd0], 10, 26, 6, 360);
      });
    });
  },
  stuntrap(sc, f, v) { // โยนกับดักโค้ง → ฟันกับดักงับ + ดาวมึนหมุน
    sc.playOnce(f.id, "cast", f.dir, 420);
    const to = { x: f.x, y: f.y };
    FX2.fly(sc, ME2(v, 20), to, () => { const o = sc.add.rectangle(0, 0, 10, 6, 0x9a9aa0).setStrokeStyle(1, 0x3a3a40); o._spin = 0.4; return o; }, 420, 60, () => {
      const g = sc.add.graphics({ x: to.x, y: to.y }).setDepth(FX2.GROUND + 2);
      g.lineStyle(2, 0xd0d0d8, 1);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.lineBetween(Math.cos(a) * 8, Math.sin(a) * 5, Math.cos(a) * 14, Math.sin(a) * 9); }
      g.strokeEllipse(0, 0, 28, 18);
      sc.tweens.add({ targets: g, scale: 0.7, duration: 90, yoyo: true, onComplete: () => sc.tweens.add({ targets: g, alpha: 0, delay: 600, duration: 300, onComplete: () => g.destroy() }) });
      FX2.shock(sc, to.x, to.y, f.r || 80, 0xffe080, 380, 3);
      FX2.mobsIn(sc, to.x, to.y, f.r || 80).forEach((m) => { for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 80, () => sc.floatText(m.root.x + (i - 1) * 10, m.root.y - 52 * (m.e.scale || 1), "★", "#ffe080", 12, 900)); });
    });
  },
  hawk(sc, f, v) { // เรียกเหยี่ยว: ยกมือ + ขนนกร่วง
    sc.playOnce(f.id, "cast", "up", 500);
    for (let i = 0; i < 8; i++) { const p = sc.add.ellipse(v.root.x + (Math.random() - 0.5) * 60, v.root.y - 90 - Math.random() * 30, 4, 9, 0xb07a40).setDepth(FX2.TOP).setRotation(Math.random() * 3); sc.tweens.add({ targets: p, y: p.y + 70, rotation: p.rotation + 3, alpha: 0, duration: 1100, delay: i * 60, onComplete: () => p.destroy() }); }
    sc.floatText(v.root.x, v.root.y - 86, "🦅", "#ffd08a", 16, 900);
  },
  thunderarrow(sc, f, v, tv) { // ยิงลูกศรสายฟ้า → ฟ้าผ่าเป้าแรก → กระโดดเป็นลูกโซ่
    sc.playOnce(f.id, "shoot", f.dir, 560);
    if (!tv) return;
    sc.time.delayedCall(SHOOT_RELEASE_MS, () => {
      const a = ME2(v, 30), b = T2(tv), ang = Math.atan2(b.y - a.y, b.x - a.x);
      FX2.fly(sc, a, b, () => { const c = sc.add.container(0, 0, [sc.add.rectangle(0, 0, 22, 3, 0xfff06a).setBlendMode(Phaser.BlendModes.ADD), sc.add.circle(10, 0, 4, 0xffffff)]); c.rotation = ang; return c; }, 150, 0, () => {
        sc.lightning({ x: b.x, y: b.y - 140 }, b, 0xfff06a);
        let prev = b;
        (f.tgts || []).slice(1).forEach((t, i) => { const w = sc.views.get(t); if (!w) return; const to = T2(w), p0 = prev; sc.time.delayedCall(80 + i * 80, () => { sc.lightning(p0, to, 0xfff06a); FX2.sparks(sc, to.x, to.y, 0xfff6b0, 6, 18, 6, 300, 2); }); prev = to; });
        FX2.shake(sc, f, 120, 0.005);
      });
    });
  },
  // ================= Assassin =================
  backstab(sc, f, v, tv) { // หายวับไปโผล่หลังเป้า แทงไขว้ X สีม่วง
    if (!tv) return;
    const t = T2(tv);
    FX2.ghost(sc, v, v.root.x, v.root.y, 0xb06aff, 260);
    FX2.sparks(sc, v.root.x, v.root.y - 20, 0x6a4a8a, 10, 20, 10, 350, 3);
    sc.playOnce(f.id, "slash", f.dir, 420);
    sc.time.delayedCall(110, () => {
      FX2.cut(sc, t.x, t.y, Math.PI / 4, 44, 0xd090ff, 280, 4);
      sc.time.delayedCall(70, () => FX2.cut(sc, t.x, t.y, -Math.PI / 4, 44, 0xff4a6a, 280, 4));
      FX2.sparks(sc, t.x, t.y, [0xff3a5a, 0xd090ff], 14, 30, 4, 420);
      FX2.shake(sc, f, 120, 0.006);
    });
  },
  stealth(sc, f, v) { // ระเบิดควันแล้วหายตัว
    sc.playOnce(f.id, "cast", f.dir, 400);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 26;
      const p = sc.add.circle(v.root.x, v.root.y - 18, 6 + Math.random() * 6, i % 3 ? 0x4a405a : 0x6a5a8a, 0.75).setDepth(FX2.TOP);
      sc.tweens.add({ targets: p, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.6 - 12, scale: 2.2, alpha: 0, duration: 700, onComplete: () => p.destroy() });
    }
  },
  poisonblade(sc, f, v) { // อาบพิษ: ฟองพิษเขียวเดือดรอบมือ
    sc.playOnce(f.id, "cast", f.dir, 500);
    for (let i = 0; i < 12; i++) sc.time.delayedCall(i * 50, () => {
      const p = sc.add.circle(v.root.x + (Math.random() - 0.5) * 22, v.root.y - 18 + (Math.random() - 0.5) * 10, 2 + Math.random() * 2.5, 0x7dff6a, 0.9).setStrokeStyle(1, 0x2a8a2a).setDepth(FX2.TOP);
      sc.tweens.add({ targets: p, y: p.y - 26, alpha: 0, duration: 600, onComplete: () => p.destroy() });
    });
    FX2.shock(sc, v.root.x, v.root.y, 36, 0x7dff6a, 400, 2);
  },
  bladefan(sc, f, v) { // ขว้างใบมีด 12 เล่มกระจายรอบตัว
    sc.playOnce(f.id, "slash", f.dir, 400);
    const r = f.r || 110;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      FX2.fly(sc, ME2(v, 20), { x: v.root.x + Math.cos(a) * r, y: v.root.y - 20 + Math.sin(a) * r * 0.65 }, () => { const d = sc.add.container(0, 0, [sc.add.rectangle(0, 0, 12, 2.5, 0xe8e0ff), sc.add.triangle(7, 0, 0, -2.5, 4, 0, 0, 2.5, 0xffffff)]); d.rotation = a; return d; }, 260, 0, () => FX2.sparks(sc, v.root.x + Math.cos(a) * r, v.root.y - 20 + Math.sin(a) * r * 0.65, 0xc8a0ff, 2, 8, 2, 200, 1.6));
    }
    FX2.shock(sc, v.root.x, v.root.y, r, 0xb06aff, 380, 2);
  },
  // ================= Archmage =================
  lightning(sc, f, v, tv) { // ยกคทาเรียกฟ้าผ่าเป้าแรก แล้วกระโดดเป็นลูกโซ่ (เส้นหนา)
    sc.playOnce(f.id, "thrust", f.dir, 520);
    if (!tv) return;
    FX2.sparks(sc, v.root.x, v.root.y - 44, 0xfff06a, 8, 14, 10, 260, 2);
    sc.time.delayedCall(140, () => {
      const b = T2(tv);
      sc.lightning({ x: b.x + 10, y: b.y - 200 }, b, 0xfff06a); sc.lightning({ x: b.x - 10, y: b.y - 200 }, b, 0xffffff);
      FX2.shock(sc, tv.root.x, tv.root.y, 40, 0xfff06a, 300, 3);
      let prev = b;
      (f.tgts || []).slice(1).forEach((t, i) => { const w = sc.views.get(t); if (!w) return; const to = T2(w), p0 = prev; sc.time.delayedCall(80 + i * 80, () => { sc.lightning(p0, to, 0xfff06a); FX2.sparks(sc, to.x, to.y, 0xffffff, 6, 18, 6, 300, 2); }); prev = to; });
      if (f.id === room.sessionId) sc.cameras.main.flash(60, 255, 250, 200);
      FX2.shake(sc, f, 120, 0.005);
    });
  },
  manashield(sc, f, v) { // โล่มานา: ฟองฟ้าหกเหลี่ยม
    sc.playOnce(f.id, "cast", f.dir, 500);
    FX2.converge(sc, v.root.x, v.root.y - 24, 0x6f9bff, 14, 50, 300);
    sc.time.delayedCall(260, () => {
      FX2.bubble(sc, v, 0x6f9bff, 2000, 28);
      const g = sc.add.graphics(); v.root.add(g); g.lineStyle(1.5, 0xb0c8ff, 0.9);
      const hex = (cx, cy, r) => { const p = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } g.strokePoints(p, true); };
      [[0, -24], [-12, -32], [12, -32], [-12, -16], [12, -16], [0, -40], [0, -8]].forEach(([x, y]) => hex(x, y, 7));
      g.setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({ targets: g, alpha: 0, delay: 700, duration: 500, onComplete: () => g.destroy() });
    });
  },
  blizzard(sc, f, v) { // พายุหิมะ: วงน้ำแข็งบนพื้น + หอก/เกล็ดหิมะตกทุกจังหวะ
    const r = f.r || 120;
    if (!f.again) { sc.playOnce(f.id, "thrust", f.dir, 600); FX2.disc(sc, f.x, f.y, r, 0x9fd8ff, 2300, 0.28); FX2.sigil(sc, f.x, f.y, r * 0.8, 0xc8f0ff, 2200, 6); }
    for (let i = 0; i < 8; i++) sc.time.delayedCall(i * 45, () => {
      const x = f.x + (Math.random() - 0.5) * r * 1.6, y = f.y + (Math.random() - 0.5) * r * 0.9;
      FX2.fly(sc, { x: x + 40, y: y - 150 }, { x, y }, () => sc.add.triangle(0, 0, -3, -12, 3, -12, 0, 10, 0xd8f4ff).setStrokeStyle(1, 0xffffff).setRotation(-0.26), 260, 0, () => FX2.sparks(sc, x, y, 0xeaf8ff, 4, 14, 4, 260, 2));
    });
    for (let i = 0; i < 10; i++) { const p = sc.add.circle(f.x + (Math.random() - 0.5) * r * 2, f.y - 60 - Math.random() * 40, 1.6, 0xffffff, 0.9).setDepth(FX2.TOP); sc.tweens.add({ targets: p, x: p.x - 40, y: p.y + 60, alpha: 0, duration: 700, onComplete: () => p.destroy() }); }
  },
  blink(sc, f, v) { // วาร์ป: ประกายฟ้าที่จุดเดิม → โผล่ใหม่พร้อมวง
    const x0 = f.x ?? v.root.x, y0 = f.y ?? v.root.y;
    FX2.ghost(sc, v, x0, y0, 0x9fc8ff, 300);
    FX2.sparks(sc, x0, y0 - 20, [0xc0d8ff, 0xffffff], 14, 20, 30, 400, 2);
    FX2.shock(sc, x0, y0, 34, 0x9fc8ff, 300, 3);
    sc.time.delayedCall(180, () => { FX2.shock(sc, v.root.x, v.root.y, 40, 0xc0d8ff, 320, 3); FX2.converge(sc, v.root.x, v.root.y - 22, 0xffffff, 10, 30, 200); });
  },
  // ================= Summoner =================
  summonfire(sc, f, v) { // วงเวทไฟบนพื้น + เปลวพุ่ง → ภูตไฟปรากฏ
    sc.playOnce(f.id, "cast", f.dir, 700);
    FX2.sigil(sc, v.root.x - 26, v.root.y, 34, 0xff7a3a, 1000, 5);
    sc.time.delayedCall(250, () => { FX2.pillar(sc, v.root.x - 26, v.root.y, 0xff7a3a, 24, 100, 500); FX2.sparks(sc, v.root.x - 26, v.root.y - 30, [0xff9a3a, 0xffe08a], 12, 20, 30, 500); });
  },
  doomcurse(sc, f, v) { // วงคำสาปม่วงหมุนใต้กลุ่มมอน + ตาปีศาจกะพริบ
    sc.playOnce(f.id, "thrust", f.dir, 600);
    const r = f.r || 110;
    FX2.sigil(sc, f.x, f.y, r * 0.9, 0xff70b0, 1300, 7);
    FX2.disc(sc, f.x, f.y, r, 0x5a1040, 1300, 0.35);
    FX2.mobsIn(sc, f.x, f.y, r).forEach((m, i) => sc.time.delayedCall(150 + i * 50, () => { sc.floatText(m.root.x, m.root.y - 56 * (m.e.scale || 1), "👁", "#ff70b0", 13, 1000); FX2.sparks(sc, m.root.x, m.root.y - 20, 0xff70b0, 5, 16, 20, 500); }));
  },
  souldrain(sc, f, v, tv) { // ลูกพลังมืด → กระชากวิญญาณเขียวไหลกลับเข้าตัว
    sc.playOnce(f.id, "thrust", f.dir, 520);
    if (!tv) return;
    sc.time.delayedCall(100, () => FX2.fly(sc, ME2(v, 34), T2(tv), () => { const c = sc.add.container(0, 0, [sc.add.circle(0, 0, 9, 0x6a2a9a, 0.6), sc.add.circle(0, 0, 4, 0xe0b0ff, 1)]); c.list[0].setBlendMode(Phaser.BlendModes.ADD); return c; }, 260, 10, () => {
      const b = T2(tv);
      FX2.shock(sc, b.x, b.y + 26, 34, 0xb06aff, 300, 3);
      for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 60, () => FX2.fly(sc, { x: b.x + (Math.random() - 0.5) * 20, y: b.y }, ME2(v), () => sc.add.circle(0, 0, 3.2, 0x7dffb0, 0.95).setBlendMode(Phaser.BlendModes.ADD), 380, 30));
      sc.time.delayedCall(700, () => FX2.sparks(sc, v.root.x, v.root.y - 24, 0x7dffb0, 8, 20, 20, 400));
    }));
  },
  blackhole(sc, f, v) { // หลุมดำ: วงดำหมุนดูดอนุภาคเข้า (3 จังหวะ)
    const r = f.r || 140;
    if (!f.again) {
      sc.playOnce(f.id, "thrust", f.dir, 600);
      const core = sc.add.circle(f.x, f.y - 16, 4, 0x000000, 1).setStrokeStyle(3, 0xb06aff, 1).setDepth(FX2.TOP);
      const swirl = sc.add.graphics({ x: f.x, y: f.y - 16 }).setDepth(FX2.TOP - 1).setBlendMode(Phaser.BlendModes.ADD);
      for (let k = 0; k < 3; k++) { swirl.lineStyle(3 - k * 0.7, [0x8a4aff, 0xd090ff, 0xff70d0][k], 0.9); swirl.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 3 + k * 2.1, rr = 6 + i * 0.9; i ? swirl.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6) : swirl.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.6); } swirl.strokePath(); }
      sc.tweens.add({ targets: core, radius: 16, duration: 250, ease: "Back.easeOut" });
      sc.tweens.add({ targets: swirl, angle: -720, duration: 1600 });
      sc.time.delayedCall(1500, () => { sc.tweens.add({ targets: [core, swirl], alpha: 0, scale: 0.2, duration: 220, onComplete: () => { core.destroy(); swirl.destroy(); } }); FX2.shock(sc, f.x, f.y, r * 0.6, 0xd090ff, 300, 4); });
      FX2.disc(sc, f.x, f.y, r, 0x2a0a40, 1700, 0.45);
    }
    FX2.converge(sc, f.x, f.y - 16, 0xc890ff, 14, r * 0.8, 420);
    FX2.shake(sc, f, 100, 0.003);
  },
  // ================= Saint =================
  massheal(sc, f, v) { // วงแสงเขียวทองใหญ่ + ทุกคนมีลำแสงฮีลและบวกลอยขึ้น
    sc.playOnce(f.id, "cast", f.dir, 700);
    FX2.sigil(sc, v.root.x, v.root.y, Math.min(140, f.r || 140), 0xa0ffb0, 1000, 8);
    FX2.allies(sc, v, f.r).forEach((a, i) => sc.time.delayedCall(120 + i * 50, () => {
      FX2.pillar(sc, a.root.x, a.root.y, 0x9dffb0, 22, 90, 520);
      for (let k = 0; k < 4; k++) sc.time.delayedCall(k * 90, () => sc.floatText(a.root.x + (Math.random() - 0.5) * 24, a.root.y - 30, "+", "#9dffb0", 14, 700));
    }));
  },
  judgment(sc, f, v) { // พิพากษา: ดาบแสงยักษ์ปักลงจากฟ้า + วงกางเขน
    sc.playOnce(f.id, "thrust", f.dir, 600);
    const x = f.x, y = f.y, r = f.r || 90;
    FX2.sigil(sc, x, y, r, 0xffe08a, 900, 4);
    const sword = sc.add.container(x, y - 280, [
      sc.add.rectangle(0, 0, 10, 70, 0xfff4c0).setStrokeStyle(2, 0xffe08a),
      sc.add.rectangle(0, -38, 30, 6, 0xffd36b), sc.add.rectangle(0, -50, 6, 18, 0xffd36b), sc.add.triangle(0, 40, -5, 0, 5, 0, 0, 14, 0xffffff),
    ]).setDepth(FX2.TOP).setAlpha(0.95);
    sc.tweens.add({ targets: sword, y: y - 40, duration: 420, ease: "Quad.easeIn", onComplete: () => {
      FX2.pillar(sc, x, y, 0xfff0a0, 44, 260, 600);
      FX2.shock(sc, x, y, r + 20, 0xffe08a, 480, 6);
      FX2.sparks(sc, x, y - 20, [0xffffff, 0xffe08a], 22, r * 0.8, 30, 600);
      sc.tweens.add({ targets: sword, alpha: 0, duration: 500, delay: 200, onComplete: () => sword.destroy() });
      FX2.shake(sc, f, 200, 0.008);
    } });
  },
  sanctuary(sc, f, v) { // ดินแดนศักดิ์สิทธิ์: วงอักษรหมุนช้า + ขนนกขาวร่วง
    sc.playOnce(f.id, "cast", f.dir, 700);
    FX2.sigil(sc, v.root.x, v.root.y, Math.min(150, f.r || 150), 0xc0ffe0, 2200, 6);
    for (let i = 0; i < 12; i++) { const p = sc.add.ellipse(v.root.x + (Math.random() - 0.5) * 160, v.root.y - 120 - Math.random() * 40, 4, 9, 0xffffff, 0.9).setDepth(FX2.TOP); sc.tweens.add({ targets: p, y: p.y + 110, x: p.x + (Math.random() - 0.5) * 30, rotation: 2, alpha: 0, duration: 1500, delay: i * 80, onComplete: () => p.destroy() }); }
    FX2.allies(sc, v, f.r).forEach((a) => FX2.bubble(sc, a, 0xc0ffe0, 900, 22));
  },
  resurrect(sc, f, v) { // ชุบชีวิต: ลำแสงใหญ่บนเพื่อน + ปีกแสง
    sc.playOnce(f.id, "cast", f.dir, 800);
    const w = (f.tgtPlayer && sc.views.get(f.tgtPlayer)) || v, x = f.x ?? w.root.x, y = f.y ?? w.root.y;
    FX2.sigil(sc, x, y, 50, 0xffffff, 1300, 8);
    sc.time.delayedCall(200, () => {
      FX2.pillar(sc, x, y, 0xfff8d0, 50, 320, 900);
      for (const sg of [-1, 1]) { const wing = sc.add.ellipse(x + sg * 22, y - 40, 30, 50, 0xffffff, 0.6).setRotation(sg * 0.5).setDepth(FX2.TOP).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2); sc.tweens.add({ targets: wing, scale: 1, duration: 300, ease: "Back.easeOut" }); sc.tweens.add({ targets: wing, alpha: 0, y: wing.y - 30, delay: 600, duration: 500, onComplete: () => wing.destroy() }); }
      FX2.sparks(sc, x, y - 30, [0xffffff, 0xffe08a], 20, 40, 60, 900);
    });
  },
  // ================= Battle Priest =================
  holyfist(sc, f, v, tv) { // หมัดศักดิ์สิทธิ์ 3 ครั้ง: วงกำปั้นทองระเบิดตรงเป้า
    if (!tv) return;
    for (let i = 0; i < 3; i++) sc.time.delayedCall(i * 150, () => {
      sc.playOnce(f.id, "slash", f.dir, 150);
      const t = T2(tv);
      FX2.shock(sc, t.x, t.y, 24 + i * 8, 0xffd060, 220, 4, false);
      FX2.sparks(sc, t.x, t.y, [0xffffff, 0xffd060], 6, 20 + i * 6, 4, 260, 2);
      if (i === 2) { sc.floatText(t.x, t.y - 20, "✊", "#ffd060", 18, 500); FX2.shake(sc, f, 120, 0.006); }
    });
  },
  heavenhammer(sc, f, v, tv) { // ค้อนสวรรค์ยักษ์ทุบลงจากฟ้า → คลื่นทอง
    sc.playOnce(f.id, "slash", f.dir, 600);
    const x = f.x ?? (tv && tv.root.x), y = f.y ?? (tv && tv.root.y);
    if (x === undefined) return;
    const ham = sc.add.container(x + 30, y - 220, [
      sc.add.rectangle(0, 20, 6, 46, 0xc89a50).setStrokeStyle(1, 0x5a3a10),
      sc.add.rectangle(0, -6, 40, 22, 0xffd36b).setStrokeStyle(2, 0xffffff),
      sc.add.rectangle(0, -6, 10, 22, 0xfff4c0),
    ]).setDepth(FX2.TOP).setRotation(-0.6);
    sc.tweens.add({ targets: ham, x, y: y - 30, rotation: 0.2, duration: 360, ease: "Quad.easeIn", onComplete: () => {
      FX2.shock(sc, x, y, (f.r || 90) + 15, 0xffd060, 460, 7);
      FX2.disc(sc, x, y, (f.r || 90) * 0.7, 0xffe08a, 500, 0.4);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; FX2.cut(sc, x + Math.cos(a) * 30, y + Math.sin(a) * 18, a, 30, 0xfff4c0, 300, 3); }
      sc.tweens.add({ targets: ham, alpha: 0, duration: 300, delay: 150, onComplete: () => ham.destroy() });
      FX2.shake(sc, f, 220, 0.01);
    } });
  },
  hasteaura(sc, f, v) { // ออร่าเร่งความเร็ว: เส้นลมสีส้มพุ่งรอบเพื่อน
    sc.playOnce(f.id, "cast", f.dir, 600);
    FX2.shock(sc, v.root.x, v.root.y, f.r || 200, 0xffb84a, 520, 3);
    FX2.allies(sc, v, f.r).forEach((a) => {
      for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 50, () => { const y = a.root.y - 10 - Math.random() * 36; FX2.cut(sc, a.root.x + 14, y, 0, 26, 0xffd070, 220, 2); });
      sc.floatText(a.root.x, a.root.y - 72, "»", "#ffd070", 18, 700);
    });
  },
  regenaura(sc, f, v) { // ออร่าฟื้นฟู: ใบไม้/เครื่องหมายบวกเขียวลอยรอบเพื่อน
    sc.playOnce(f.id, "cast", f.dir, 600);
    FX2.sigil(sc, v.root.x, v.root.y, Math.min(120, f.r || 120), 0x80ff90, 1100, 5);
    FX2.allies(sc, v, f.r).forEach((a) => { for (let i = 0; i < 6; i++) sc.time.delayedCall(i * 90, () => { const p = sc.add.ellipse(a.root.x + (Math.random() - 0.5) * 30, a.root.y - 6, 5, 9, 0x80ff90, 0.9).setRotation(Math.random() * 2).setDepth(FX2.TOP); sc.tweens.add({ targets: p, y: p.y - 50, rotation: p.rotation + 2, alpha: 0, duration: 900, onComplete: () => p.destroy() }); }); });
  },
};

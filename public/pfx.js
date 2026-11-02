// =============================================================
//  เอฟเฟกต์พิกเซลจาก pixelfx (MIT © Patch, Hugo Duprez · github.com/patch-gg/pixelfx)
//  ภาพอยู่ที่ /assets/pfx/<ชื่อ>.png (สร้างด้วย tools/pfx/build.py) · โหลดเมื่อใช้ครั้งแรก
//  ใช้กับ: สกิลทุกอาชีพ · ตีโดน/คริ/มอนตาย · ของดรอป/เก็บของ/เลเวลอัป · สถานะผิดปกติ
// =============================================================
let PFX = null;                       // ข้อมูลเอฟเฟกต์ (pfx.json)
const PFX_MAX = 70;                   // จำนวนเอฟเฟกต์บนจอพร้อมกันสูงสุด
let pfxLive = 0;
fetch("/assets/pfx/pfx.json").then((r) => r.json()).then((j) => { PFX = j; }).catch(() => {});

const pfxReal = (sc) => (typeof scene !== "undefined" && scene) || sc;
const pfxOn = () => { try { return localStorage.getItem("pn_pfx") !== "0"; } catch { return true; } };

// โหลดภาพเอฟเฟกต์ (ครั้งแรก) แล้วเรียก cb
function pfxLoad(sc, name, cb) {
  const M = PFX && PFX[name], key = "pfx_" + name;
  if (!M) return;
  if (sc.textures.exists(key)) return cb(key, M);
  sc._pfxWait = sc._pfxWait || {};
  if (sc._pfxWait[name]) { sc._pfxWait[name].push(cb); return; }
  sc._pfxWait[name] = [cb];
  sc.load.spritesheet(key, `/assets/pfx/${name}.png`, { frameWidth: M.fw, frameHeight: M.fh });
  sc.load.once(`filecomplete-spritesheet-${key}`, () => {
    if (!sc.anims.exists(key)) sc.anims.create({ key, frames: sc.anims.generateFrameNumbers(key, { start: 0, end: M.n - 1 }), frameRate: M.fps, repeat: M.loop ? -1 : 0 });
    const list = sc._pfxWait[name] || []; delete sc._pfxWait[name];
    for (const f of list) { try { f(key, M); } catch (e) { console.warn("pfx", name, e); } }
  });
  if (!sc.load.isLoading()) sc.load.start();
}

// เล่นเอฟเฟกต์ที่จุด (x,y) = ตำแหน่งเท้า/พื้น
// o: scale · flip · depth · dur (ms สำหรับแบบวน) · follow (view ที่ให้ตาม) · dy · alpha · delay · speed · add (blend) · onDone
function pfxPlay(sc0, name, x, y, o = {}) {
  const sc = pfxReal(sc0);
  if (!sc || !PFX || !PFX[name] || !pfxOn()) return;
  if (o.delay) { sc.time.delayedCall(o.delay, () => pfxPlay(sc, name, x, y, { ...o, delay: 0 })); return; }
  const wv = sc.cameras.main.worldView, mg = 260;
  if (x < wv.x - mg || x > wv.right + mg || y < wv.y - mg || y > wv.bottom + mg) return;
  if (pfxLive >= PFX_MAX && !o.must) return;
  pfxLive++;
  pfxLoad(sc, name, (key, M) => {
    const s = (o.scale || 1) * PFX_SCALE;
    const sp = sc.add.sprite(x, y + (o.dy || 0), key, 0).setOrigin(M.px / M.fw, M.py / M.fh).setScale(s).setFlipX(!!o.flip);
    sp.setDepth(o.depth != null ? o.depth : 8e5 + y * 0.01); // เหนือต้นไม้/ตัวละคร (ไม่ให้ถูกบัง)
    if (o.alpha != null) sp.setAlpha(o.alpha);
    if (o.add) sp.setBlendMode(Phaser.BlendModes.ADD);
    if (o.angle) sp.setRotation(o.angle);
    sp.play({ key, frameRate: M.fps * (o.speed || 1) });
    let done = false;
    const end = () => { if (done) return; done = true; pfxLive--; if (o.onDone) o.onDone(); if (sp.scene) sc.tweens.add({ targets: sp, alpha: 0, duration: 200, onComplete: () => sp.destroy() }); };
    if (o.follow) {
      const v = o.follow, upd = () => { if (!sp.scene || done) return; if (!v.root || !v.root.scene) return end(); sp.setPosition(v.root.x, v.root.y + (o.dy || 0)).setDepth(v.root.depth + (o.front === false ? -1 : 2)); };
      sc.events.on("postupdate", upd); sp.once("destroy", () => sc.events.off("postupdate", upd));
    }
    sp.stopFx = end;
    if (M.loop) sc.time.delayedCall(o.dur || 1600, end);
    else sp.once("animationcomplete", end);
    sc.time.delayedCall(12000, end); // กันค้าง
    if (o.ref) o.ref(sp);
  });
}
const PFX_SCALE = 1.25; // ขนาดในโลกเกม (ตัวละครเรา ~1.25 เท่าของตัวละครใน pixelfx)

// ลูกกระสุน: เล่นภาพวนแล้วเคลื่อนจาก a → b แล้วระเบิดที่ปลายทาง
function pfxProj(sc0, name, a, b, ms, o = {}) {
  const sc = pfxReal(sc0);
  if (!sc || !PFX || !PFX[name] || !pfxOn()) return;
  pfxLoad(sc, name, (key, M) => {
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const sp = sc.add.sprite(a.x, a.y, key, 0).setOrigin(M.px / M.fw, M.py / M.fh).setScale((o.scale || 0.8) * PFX_SCALE).setRotation(ang).setDepth(1e6 - 5);
    sp.play(key);
    sc.tweens.add({ targets: sp, x: b.x, y: b.y, duration: ms, ease: "Sine.easeIn", onComplete: () => { sp.destroy(); if (o.hit) pfxPlay(sc, o.hit, b.x, b.y + 26, { scale: o.hitScale || 0.8, depth: 1e6 - 4 }); } });
  });
}

// ---------- สกิล → เอฟเฟกต์ ----------
// at: self (เท้าผู้ใช้) · tgt (เป้าหมาย) · pt (จุดที่เลือก/กลางวง) · tgts (ทุกเป้า) · heal (คนที่ได้รับฮีล)
// face: หันตามทิศเป้า (กลับซ้าย-ขวา) · fit: ขยายตามรัศมีสกิล · d: หน่วงเวลา (ms) · dur: เวลาของภาพแบบวน
const PFX_SKILL = {
  // ชาวบ้าน
  doublehit: [{ fx: "double_slash", at: "self", face: true }], stonethrow: [{ fx: "blunt_hit", at: "tgt", d: 260 }],
  spinswing: [{ fx: "spin_slash", at: "self", fit: true }], rally: [{ fx: "st_rage", at: "self", over: true, dur: 1800 }],
  firstaid: [{ fx: "heal", at: "self" }],
  // Guardian
  shieldbash: [{ fx: "shield_block", at: "self", face: true }, { fx: "blunt_hit", at: "tgt", d: 180 }],
  provoke: [{ fx: "exclaim", at: "self", over: true }], shieldwall: [{ fx: "divine_shield", at: "self", follow: true, dur: 2200 }],
  fortress: [{ fx: "divine_shield", at: "self", follow: true, dur: 2600, scale: 1.3 }], shieldslam: [{ fx: "ground_slam", at: "self", fit: true }],
  // Slayer
  cleave: [{ fx: "heavy_cleave", at: "self", face: true }], fury: [{ fx: "st_rage", at: "self", over: true, dur: 2200 }],
  execute: [{ fx: "crit_hit", at: "tgt", d: 200 }], deathblow: [{ fx: "scythe_reap", at: "self", face: true }, { fx: "crit_hit", at: "tgt", d: 450 }],
  earthsplitter: [{ fx: "earth_spike", at: "pt", fit: true, face: true }],
  // Hunter
  doubleshot: [{ fx: "hit_spark", at: "tgt", d: 380 }, { fx: "hit_spark", at: "tgt", d: 560 }], arrowrain: [{ fx: "dirt_explosion", at: "pt", fit: true, d: 300, scale: 0.7 }],
  swiftstep: [{ fx: "st_haste", at: "self", follow: true, dur: 2000 }], aimedshot: [{ fx: "crit_hit", at: "tgt", d: 420 }],
  multishot: [{ fx: "bullet_impact", at: "tgts", d: 380, scale: 0.8 }],
  // Mage
  firebolt: [{ fx: "fireball", proj: "tgt", hit: "small_explosion", hitScale: 0.45 }], frostnova: [{ fx: "frost_nova", at: "pt", fit: true }],
  meteor: [{ fx: "meteor", at: "pt", fit: true }], inferno: [{ fx: "flame_pillar", at: "pt", scale: 1.1 }, { fx: "fire_ring", at: "pt", fit: true, d: 200 }],
  glacier: [{ fx: "ice_spikes", at: "pt", fit: true, face: true }, { fx: "snowflake_burst", at: "pt", d: 500 }],
  // Healer
  heal: [{ fx: "heal", at: "heal" }], holylight: [{ fx: "smite", at: "tgt", scale: 0.8 }], bless: [{ fx: "blessing", at: "heal", follow: true, dur: 1800 }],
  renewal: [{ fx: "heal_aoe", at: "self", fit: true }], holysmite: [{ fx: "holy_pillar", at: "pt" }, { fx: "smite", at: "pt", d: 300 }],
  // Paladin
  guardaura: [{ fx: "sunburst", at: "self", dur: 1800, front: false }], holysword: [{ fx: "sword_slash", at: "self", face: true }, { fx: "smite", at: "tgt", scale: 0.7, d: 200 }],
  divineshield: [{ fx: "divine_shield", at: "self", follow: true, dur: 2600 }], masstaunt: [{ fx: "exclaim", at: "self", over: true }, { fx: "ground_slam", at: "self", fit: true }],
  holynova: [{ fx: "feather_burst", at: "self", fit: true }, { fx: "heal_aoe", at: "self", fit: true, d: 150 }], aegis: [{ fx: "divine_shield", at: "self", follow: true, dur: 2600, scale: 1.4 }],
  // Dark Knight
  bloodblade: [{ fx: "heavy_cleave", at: "self", face: true }, { fx: "life_steal", at: "self", face: true, d: 300 }], thornarmor: [{ fx: "thorns", at: "self", fit: true }],
  weakencurse: [{ fx: "curse", at: "tgt" }], soulreap: [{ fx: "dark_explosion", at: "pt", fit: true }], darkpact: [{ fx: "shadow_flames", at: "self", follow: true, dur: 2200 }],
  // Berserker
  whirlwind: [{ fx: "spin_slash", at: "self", fit: true }, { fx: "spin_slash", at: "self", fit: true, d: 300 }], leapstrike: [{ fx: "heavy_landing", at: "tgt", d: 300 }, { fx: "ground_slam", at: "tgt", d: 300, scale: 0.7 }],
  bloodboil: [{ fx: "st_rage", at: "self", over: true, dur: 2400 }], rampage: [{ fx: "crit_hit", at: "tgt", d: 200 }], warcry: [{ fx: "thunderclap", at: "self", fit: true }],
  // Blademaster
  iaido: [{ fx: "sword_slash", at: "self", face: true, scale: 1.2 }, { fx: "crit_hit", at: "tgt", d: 160, scale: 0.7 }], thousandcuts: [{ fx: "dagger_flurry", at: "tgt" }, { fx: "dagger_flurry", at: "tgt", d: 350 }],
  bladefocus: [{ fx: "spell_charge", at: "self", follow: true, dur: 1600 }], shadowslash: [{ fx: "double_slash", at: "tgt", face: true }],
  phantomblades: [{ fx: "spin_slash", at: "pt", fit: true }, { fx: "magic_missiles", at: "self", face: true }], skysplitter: [{ fx: "lightning_strike", at: "tgt", scale: 0.9 }, { fx: "heavy_cleave", at: "self", face: true, d: 300 }],
  // Sniper
  piercing: [{ fx: "bullet_impact", at: "tgt", d: 380 }], stuntrap: [{ fx: "zap_hit", at: "pt", scale: 1.2 }], thunderarrow: [{ fx: "zap_hit", at: "tgts", d: 380 }],
  arrowstorm: [{ fx: "dirt_explosion", at: "pt", fit: true, scale: 0.8, d: 300 }], deadeye: [{ fx: "spell_charge", at: "self", follow: true, dur: 1600 }],
  // Assassin
  backstab: [{ fx: "crit_hit", at: "tgt", d: 120 }], stealth: [{ fx: "blink_out", at: "self" }], poisonblade: [{ fx: "st_poisoned", at: "self", over: true, dur: 1800 }],
  bladefan: [{ fx: "dagger_flurry", at: "self", fit: true }], shadowstorm: [{ fx: "shadow_tendrils", at: "self", fit: true }], assassinate: [{ fx: "crit_hit", at: "tgt", scale: 1.2 }, { fx: "curse", at: "tgt", d: 200 }],
  // Archmage
  blizzard: [{ fx: "blizzard", at: "pt", dur: 3000, scale: 1.6 }, { fx: "frost_nova", at: "pt", fit: true, d: 400 }], lightning: [{ fx: "lightning_strike", at: "tgt", scale: 0.8 }, { fx: "zap_hit", at: "tgts", d: 120 }],
  manashield: [{ fx: "rune_circle", at: "self", follow: true, dur: 2200, front: false }], blink: [{ fx: "blink_in", at: "self" }],
  starfall: [{ fx: "star_fall", at: "pt", fit: true }], arcanesurge: [{ fx: "mana_burst", at: "self" }],
  // Summoner
  summonfire: [{ fx: "summon_rise", at: "self" }], doomcurse: [{ fx: "hex_sigil", at: "tgt" }], souldrain: [{ fx: "life_steal", at: "self", face: true }],
  blackhole: [{ fx: "black_hole", at: "pt", dur: 3200, fit: true }], netherstorm: [{ fx: "dark_explosion", at: "pt", fit: true }], soulharvest: [{ fx: "soul_rise", at: "self" }, { fx: "shadow_tendrils", at: "self", fit: true }],
  // Saint
  massheal: [{ fx: "heal_aoe", at: "self", fit: true }], resurrect: [{ fx: "resurrection", at: "heal" }], sanctuary: [{ fx: "sunburst", at: "self", dur: 2400, front: false, scale: 1.4 }],
  judgment: [{ fx: "smite", at: "pt", fit: true }], divinelight: [{ fx: "holy_pillar", at: "self" }, { fx: "heal_aoe", at: "self", fit: true, d: 300 }],
  heavenjudgment: [{ fx: "holy_pillar", at: "pt", scale: 1.3 }, { fx: "smite", at: "pt", fit: true, d: 350 }],
  // Battle Priest
  holyfist: [{ fx: "uppercut", at: "self", face: true }], heavenhammer: [{ fx: "hammer_smash", at: "pt", fit: true }], hasteaura: [{ fx: "st_haste", at: "self", follow: true, dur: 2200 }],
  regenaura: [{ fx: "healing_bloom", at: "self" }], titanfist: [{ fx: "ground_slam", at: "tgt", scale: 0.9 }, { fx: "uppercut", at: "self", face: true }], warhymn: [{ fx: "feather_burst", at: "self", fit: true }],
};

function pfxSkill(sc0, f, v) {
  const L = PFX_SKILL[f.skill];
  if (!L || !PFX || f.again) return;
  const sc = pfxReal(sc0);
  const tv = f.tgt && sc.views.get(f.tgt), hv = (f.tgtPlayer && sc.views.get(f.tgtPlayer)) || v;
  const pt = Number.isFinite(f.x) && Number.isFinite(f.y) ? { x: f.x, y: f.y } : tv ? { x: tv.root.x, y: tv.root.y } : { x: v.root.x, y: v.root.y };
  const aim = tv ? tv.root.x : pt.x;
  const left = aim < v.root.x - 2 || (aim === v.root.x && v.dir === "left");
  for (const s of L) {
    const M = PFX[s.fx];
    if (!M) continue;
    let scale = s.scale || 1;
    if (s.fit && f.r) scale = Math.max(0.6, Math.min(2.2, (f.r * 2.1) / (M.fw * PFX_SCALE))) * (s.scale || 1);
    const o = { scale, flip: s.face ? left : false, delay: s.d || 0, dur: s.dur, front: s.front };
    if (s.proj) {
      if (!tv) continue;
      const a = { x: v.root.x, y: v.root.y - 30 }, b = { x: tv.root.x, y: tv.root.y - 26 };
      sc.time.delayedCall(s.d || 120, () => pfxProj(sc, s.fx, a, b, Math.min(520, 120 + Math.hypot(b.x - a.x, b.y - a.y) * 1.2), { hit: s.hit, hitScale: s.hitScale }));
      continue;
    }
    const at = (view, p) => {
      if (s.follow && view) return pfxPlay(sc, s.fx, view.root.x, view.root.y, { ...o, follow: view });
      if (s.over && view) return pfxPlay(sc, s.fx, view.root.x, view.root.y, { ...o, follow: view, dy: -62 });
      pfxPlay(sc, s.fx, p.x, p.y, o);
    };
    if (s.at === "self") at(v, { x: v.root.x, y: v.root.y });
    else if (s.at === "heal") at(hv, { x: hv.root.x, y: hv.root.y });
    else if (s.at === "tgt") { if (tv) at(tv, { x: tv.root.x, y: tv.root.y }); }
    else if (s.at === "tgts") for (const id of f.tgts || (f.tgt ? [f.tgt] : [])) { const t = sc.views.get(id); if (t) pfxPlay(sc, s.fx, t.root.x, t.root.y, o); }
    else at(null, pt);
  }
}

// ---------- ตีโดน / คริ / มอนตาย ----------
function pfxHit(sc, v, crit, mine) {
  if (!v || !mine) return;
  if (crit) pfxPlay(sc, "crit_hit", v.root.x, v.root.y, { scale: 0.55, depth: v.root.depth + 3, flip: Math.random() < 0.5 });
  else if (Math.random() < 0.7) pfxPlay(sc, "hit_spark", v.root.x + (Math.random() - 0.5) * 10, v.root.y - 4, { scale: 0.5, depth: v.root.depth + 3, flip: Math.random() < 0.5 });
}
function pfxDeath(sc, v) {
  if (!v || !v.isMob) return;
  pfxPlay(sc, v.e && v.e.boss ? "dark_explosion" : "poof", v.root.x, v.root.y + 2, { scale: (v.e && v.e.scale) || 1, depth: v.root.depth + 2, delay: 350 });
}

// ---------- ของดรอป / เก็บของ / เลเวลอัป ----------
function pfxDrop(sc, img, rarity) {
  if (rarity < 3) return; // ม่วงขึ้นไป: ลำแสงตั้งอยู่จนกว่าจะมีคนเก็บ
  const col = rarity >= 4 ? 0xffd36b : 0xc890ff;
  pfxPlay(sc, "loot_beam", img.x, img.y + 4, { scale: 0.7, depth: img.depth - 1, dur: 120000, ref: (sp) => { sp.setTint(col); img.setData("beam", sp); } });
}
function pfxPickup(sc, v) { if (v) pfxPlay(sc, "collect_burst", v.root.x, v.root.y - 40, { scale: 0.6, depth: v.root.depth + 3 }); }
function pfxLevelUp(sc, v) { if (v) pfxPlay(sc, "level_up", v.root.x, v.root.y, { follow: v, must: true }); }

// ---------- สถานะผิดปกติ (วนบนหัว) ----------
const PFX_STATUS = { stun: "st_stunned", slow: "st_slowed", poison: "st_poisoned", burn: "st_burning", curse: "st_cursed", freeze: "st_frozen" };
function pfxStatus(sc0, d) {
  const sc = pfxReal(sc0), v = sc && sc.views && sc.views.get(d.id), name = PFX_STATUS[d.k];
  if (!v || !name || v.dead) return;
  v.pfxSt = v.pfxSt || {};
  const cur = v.pfxSt[d.k], until = performance.now() + (d.ms || 2000);
  if (cur && cur.sp && cur.sp.scene) { cur.until = until; return; }
  const ent = v.pfxSt[d.k] = { until };
  const top = -58 * ((v.e && v.e.scale) || 1) - 6;
  pfxPlay(sc, name, v.root.x, v.root.y, { follow: v, dy: top + (d.k === "slow" || d.k === "curse" ? 22 : 0), scale: 0.7, dur: 60000, ref: (sp) => {
    ent.sp = sp;
    const chk = sc.time.addEvent({ delay: 250, loop: true, callback: () => { if (!sp.scene || v.dead || performance.now() > ent.until) { chk.remove(); if (sp.stopFx) sp.stopFx(); delete v.pfxSt[d.k]; } } });
  } });
}


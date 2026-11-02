# สร้างภาพเอฟเฟกต์จาก pixelfx (MIT · github.com/patch-gg/pixelfx) → public/assets/pfx/
#   git clone https://github.com/patch-gg/pixelfx /path/pixelfx && (cd /path/pixelfx && npm i)
#   PIXELFX=/path/pixelfx python3 tools/pfx/build.py [ชื่อ ...]
# แต่ละเอฟเฟกต์: เรนเดอร์ไม่มีตัวละคร → ตัดขอบว่าง → ลดเฟรมเหลือ ~15 fps (ไม่เกิน MAXF เฟรม) → แผ่นภาพ grid + ข้อมูลใน pfx.json
import json, os, subprocess, sys, math, tempfile
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PFX = os.environ.get("PIXELFX") or sys.exit("ตั้ง PIXELFX=โฟลเดอร์ pixelfx")
OUT = os.path.join(ROOT, "public/assets/pfx")
MAXF = 40
# ชื่อในเกม: (id ใน pixelfx, ตัวเลือก)  · fps = เฟรมต่อวินาทีที่เก็บ · maxf = จำนวนเฟรมสูงสุด · loop = เล่นวน
FX = {
  # ---- โจมตี/ฟัน ----
  "sword_slash": ("melee/sword-slash", {}), "double_slash": ("melee/double-slash", {}), "spin_slash": ("melee/spin-slash", {}),
  "heavy_cleave": ("melee/heavy-cleave", {}), "scythe_reap": ("melee/scythe-reap", {}), "dagger_flurry": ("melee/dagger-flurry", {}),
  "hammer_smash": ("melee/hammer-smash", {}), "uppercut": ("melee/uppercut", {}), "thrust": ("melee/thrust", {}),
  # ---- โดนตี ----
  "hit_spark": ("impacts/hit-spark", {}), "blunt_hit": ("impacts/blunt-hit", {}), "crit_hit": ("impacts/crit-hit", {}),
  "ground_slam": ("impacts/ground-slam", {}), "heavy_landing": ("impacts/heavy-landing", {}), "shield_block": ("impacts/shield-block", {}),
  "bullet_impact": ("impacts/bullet-impact", {}),
  # ---- ไฟ/น้ำแข็ง/สายฟ้า ----
  "fireball": ("fire/fireball", {"loop": True}), "meteor": ("fire/meteor", {"maxf": 48}), "flame_pillar": ("fire/flame-pillar", {"maxf": 44}),
  "fire_ring": ("fire/fire-ring", {}), "small_explosion": ("explosions/plasma-explosion", {"opts": {"palette": ["#2a0c06", "#5c1608", "#9c2a0a", "#d8540e", "#f89a1c", "#ffd25a", "#fff2b8", "#ffffff"]}}),
  "frost_nova": ("ice/frost-nova", {}), "ice_spikes": ("ice/ice-spikes", {}), "ice_lance": ("ice/ice-lance", {"loop": True}),
  "blizzard": ("ice/blizzard-vortex", {"loop": True}), "snowflake_burst": ("ice/snowflake-burst", {}),
  "zap_hit": ("lightning/zap-hit", {}), "lightning_strike": ("lightning/lightning-strike", {}), "thunderclap": ("lightning/thunderclap", {}),
  # ---- เวท/ศักดิ์สิทธิ์/มืด ----
  "mana_burst": ("arcane/mana-burst", {}), "star_fall": ("arcane/star-fall", {}), "blink_in": ("arcane/blink-in", {}), "blink_out": ("arcane/blink-out", {}),
  "spell_charge": ("arcane/spell-charge", {"loop": True}), "rune_circle": ("arcane/rune-circle", {"loop": True}), "magic_missiles": ("arcane/arcane-missiles", {}),
  "heal": ("holy/heal", {}), "heal_aoe": ("holy/heal-aoe", {}), "holy_pillar": ("holy/holy-pillar", {}), "smite": ("holy/smite", {}),
  "divine_shield": ("holy/divine-shield", {"loop": True}), "blessing": ("holy/blessing", {"loop": True}), "feather_burst": ("holy/feather-burst", {}),
  "resurrection": ("holy/resurrection", {"maxf": 44}), "sunburst": ("holy/sunburst", {"loop": True}),
  "black_hole": ("shadow/black-hole", {"loop": True}), "curse": ("shadow/curse", {}), "dark_explosion": ("shadow/dark-explosion", {"maxf": 44}),
  "hex_sigil": ("shadow/hex-sigil", {}), "life_steal": ("shadow/life-steal", {}), "shadow_flames": ("shadow/shadow-flames", {"loop": True}),
  "shadow_tendrils": ("shadow/shadow-tendrils", {}),
  # ---- ธรรมชาติ ----
  "earth_spike": ("nature/earth-spike", {}), "thorns": ("nature/thorns", {}), "healing_bloom": ("nature/healing-bloom", {}), "boulder": ("nature/boulder", {}),
  "dirt_explosion": ("explosions/dirt-explosion", {}),
  # ---- เกิด/ตาย ----
  "poof": ("spawn/poof", {}), "soul_rise": ("spawn/soul-rise", {}), "summon_rise": ("spawn/summon-rise", {"maxf": 44}),
  # ---- สถานะ (วนบนหัว) ----
  "st_poisoned": ("status/poisoned", {"loop": True}), "st_stunned": ("status/stunned", {"loop": True}), "st_slowed": ("status/slowed", {"loop": True}),
  "st_burning": ("status/burning", {"loop": True}), "st_rage": ("status/rage", {"loop": True}), "st_haste": ("status/haste", {"loop": True}),
  "st_cursed": ("status/cursed", {"loop": True}), "st_frozen": ("status/frozen", {"loop": True}),
  # ---- ของ/UI ----
  "level_up": ("ui/level-up", {}), "collect_burst": ("pickups/collect-burst", {}), "coin_collect": ("ui/coin-collect", {}),
  "loot_beam": ("pickups/loot-beam", {"loop": True}), "exclaim": ("ui/exclamation", {}),
}

def build(name, fid, o):
    with tempfile.TemporaryDirectory() as tmp:
        cmd = ["node", "tools/render.mjs", fid, "--sheet", "--no-actor", "--out", tmp]
        if o.get("opts"): cmd += ["--opts", json.dumps(o["opts"])]
        subprocess.run(cmd, cwd=PFX, check=True, capture_output=True)
        base = os.path.join(tmp, fid, fid.split("/")[1])
        meta = json.load(open(base + ".json"))
        im = Image.open(base + ".png").convert("RGBA")
    P = meta["meta"]["pixelfx"]
    fw, fh = P["frameSize"]; n = P["frames"]; cols = P["columns"]; fps = P["fps"]
    frames = [im.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh)) for i in range(n)]
    maxf = o.get("maxf", MAXF)
    step = max(2, math.ceil(n / maxf)) if n > 12 else 1
    keep = frames[::step]
    # ตัดขอบว่าง (รวมทุกเฟรม)
    box = None
    for f in keep:
        b = f.getbbox()
        if b: box = b if not box else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = box or (0, 0, 1, 1)
    keep = [f.crop(box) for f in keep]
    w, h = box[2] - box[0], box[3] - box[1]
    c = max(1, min(len(keep), 2048 // w))
    rows = math.ceil(len(keep) / c)
    sheet = Image.new("RGBA", (c * w, rows * h))
    for i, f in enumerate(keep): sheet.paste(f, ((i % c) * w, (i // c) * h))
    # ลดเป็น 256 สี (เล็กลง ~5 เท่า ภาพแทบไม่ต่าง)
    sheet.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT, name + ".png"), optimize=True)
    px, py = P["pivot"]
    return {"fw": w, "fh": h, "n": len(keep), "fps": round(fps / step, 2), "px": px - box[0], "py": py - box[1], "loop": bool(o.get("loop") or P["loop"]), "src": fid}

os.makedirs(OUT, exist_ok=True)
man_path = os.path.join(OUT, "pfx.json")
man = json.load(open(man_path)) if os.path.exists(man_path) else {}
for name in (sys.argv[1:] or FX):
    fid, o = FX[name]
    man[name] = build(name, fid, o)
    print(name, man[name]["fw"], "x", man[name]["fh"], man[name]["n"], "frames", flush=True)
json.dump(man, open(man_path, "w"), indent=0, separators=(",", ":"))

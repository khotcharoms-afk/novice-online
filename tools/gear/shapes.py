"""ภาพต้นแบบ "ทรงใหม่" สำหรับอุปกรณ์เลเวลสูง (ยังไม่ย้อมสี) จากชิ้นส่วน LPC
ผลลัพธ์: public/assets/equip/shp_<name>[_m|_f|_back|_atk|_atkb].png (21 แถว) + icons/shp_<name>.png + tools/gear/shapes.json
แล้ว build_tiers.py จะย้อมสีตามธีมของแต่ละขั้นอีกที
usage: python3 tools/gear/shapes.py [name ...]"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "job-art"))
import lpc
from PIL import Image
R = lpc.ROOT + "/"
A = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
SHOOT_PICK = [0, 2, 3, 4, 5, 6, 8, 9, 11]
lpc.ROWS.update({"shoot": (13, 4, 9), "thrust": (17, 4, 8)})
ANIMS = ("walk", "slash", "hurt", "spellcast", "shoot", "thrust")

def blank(): return Image.new("RGBA", (576, 1344), (0, 0, 0, 0))

def find(base, anim, color=None):
    """หาไฟล์ท่า anim ใต้ base: base/anim.png · base/anim/color.png · base/anim/<ไฟล์แรก>"""
    d = R + base
    cands = ([f"{d}/{anim}/{color}.png"] if color else []) + [f"{d}/{anim}.png"]
    for c in cands:
        if os.path.isfile(c): return c
    if os.path.isdir(f"{d}/{anim}"):
        fs = sorted(f for f in os.listdir(f"{d}/{anim}") if f.endswith(".png"))
        if fs: return f"{d}/{anim}/{fs[0]}"
    return None

def sheet(base, color=None, anims=ANIMS, alias=None):
    """ประกอบทุกท่าเป็นแผ่นเดียว 21 แถว · alias = {ท่าเรา: ท่า LPC} เมื่อชื่อไม่ตรง"""
    s = blank()
    for a in anims:
        src = (alias or {}).get(a, a)
        p = find(base, src, color)
        if not p: continue
        im = Image.open(p)
        fs = 128 if im.height in (512, 128) and im.width in (1152, 1664, 768, 832) else 192 if im.height in (768, 192) else 64
        lpc.put(s, p, a, pick=SHOOT_PICK if a == "shoot" else None, fs=fs)
    return s

def layers(*imgs):
    out = blank()
    for im in imgs:
        if im is not None: out.alpha_composite(im)
    return out

def icon_from(img, row=2, col=0, pad=2):
    """ไอคอน 32px: ตัดเฟรมหันหน้าจากภาพ แล้วย่อให้พอดี"""
    fr = img.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64))
    bb = fr.getbbox()
    if not bb: return Image.new("RGBA", (32, 32))
    fr = fr.crop(bb)
    sc = min((32 - pad * 2) / fr.width, (32 - pad * 2) / fr.height, 2)
    fr = fr.resize((max(1, round(fr.width * sc)), max(1, round(fr.height * sc))), Image.NEAREST)
    out = Image.new("RGBA", (32, 32)); out.alpha_composite(fr, ((32 - fr.width) // 2, (32 - fr.height) // 2))
    return out

SEX = {"m": ("male", "male"), "f": ("female", "thin")}   # (torso, แขน/ขา/ไหล่)
OUT = {}   # name -> {suffix: Image}
META = {}  # name -> {visual, sexed, back, atk, icon}

def save(name, files, meta, icon_src=None, icon_rc=(2, 0)):
    OUT[name] = files; META[name] = meta
    for suf, im in files.items(): im.save(f"{A}/equip/shp_{name}{suf}.png")
    src = icon_src or files.get("") or files.get("_m")
    icon_from(src, *icon_rc).save(f"{A}/icons/shp_{name}.png")

def copy_atk(name, fg, bg):
    for path, suf in ((fg, "_atk"), (bg, "_atkb")):
        Image.open(R + path).convert("RGBA").save(f"{A}/equip/shp_{name}{suf}.png")
    return Image.open(R + fg).width // 6

# ======================= อาวุธ =======================
def weapons():
    W = "weapon/"
    # เรเปียร์ (ดาบเรียว)
    fg = sheet(W + "sword/rapier", anims=("walk", "hurt")); bg = sheet(W + "sword/rapier/universal_behind", anims=("walk",))
    save("rapier", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("rapier", W + "sword/rapier/attack_slash/rapier.png", W + "sword/rapier/attack_slash/behind/rapier.png")})
    # ดาบเรืองแสงแดง
    fg = sheet(W + "sword/glowsword", "red", ("walk", "hurt")); bg = sheet(W + "sword/glowsword/universal_behind", "red", ("walk", "hurt"))
    save("glowred", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("glowred", W + "sword/glowsword/attack_slash/red.png", W + "sword/glowsword/attack_slash/behind/red.png")})
    # ดาบอัศวิน (arming) ทอง
    fg = sheet(W + "sword/arming/universal/fg", "gold", ("walk", "hurt")); bg = sheet(W + "sword/arming/universal/bg", "gold", ("walk", "hurt"))
    save("arming", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("arming", W + "sword/arming/attack_slash/fg/gold.png", W + "sword/arming/attack_slash/bg/gold.png")})
    # ง้าว
    fg = sheet(W + "polearm/halberd", anims=("walk", "hurt")); bg = sheet(W + "polearm/halberd/behind", anims=("walk", "hurt"))
    save("halberd", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("halberd", W + "polearm/halberd/attack_slash/halberd.png", W + "polearm/halberd/attack_slash/behind/halberd.png")})
    # เคียว
    fg = sheet(W + "polearm/scythe", anims=("walk", "hurt")); bg = sheet(W + "polearm/scythe/universal_behind", anims=("walk", "hurt"))
    save("scythe", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("scythe", W + "polearm/scythe/attack_slash/scythe.png", W + "polearm/scythe/attack_slash/behind/scythe.png")})
    # ลูกตุ้มเหล็ก
    fg = sheet(W + "blunt/flail", anims=("walk", "hurt")); bg = sheet(W + "blunt/flail/behind", anims=("walk", "hurt"))
    save("flail", {"": fg, "_back": bg}, {"visual": True, "back": True, "atk": copy_atk("flail", W + "blunt/flail/attack_slash/flail.png", W + "blunt/flail/attack_slash/behind/flail.png")})
    # ธนูยาว
    fg, bg = blank(), blank()
    b = W + "ranged/bow/great"
    lpc.put(fg, find(b + "/walk/foreground", "", None) or R + b + "/walk/foreground.png", "walk", fs=128) if os.path.isfile(R + b + "/walk/foreground.png") else None
    if os.path.isfile(R + b + "/walk/background.png"): lpc.put(bg, R + b + "/walk/background.png", "walk", fs=128)
    for part, img in (("foreground", fg), ("background", bg)):
        for a in ("hurt", "shoot"):
            p = find(b + f"/universal/{part}", a) or find(b + "/universal", a)
            if p: lpc.put(img, p, a, pick=SHOOT_PICK if a == "shoot" else None)
    save("greatbow", {"": fg, "_back": bg}, {"visual": True, "back": True}, icon_src=fg, icon_rc=(13, 3))
    # คทาแบบต่าง ๆ (ถือเดิน + ชี้คทาตอนร่าย)
    for nm in ("gnarled", "diamond", "loop", "s", "crystal"):
        base = W + f"magic/{nm}"
        fg = sheet(base + "/universal", anims=("walk", "hurt"), alias=None)
        bg = blank()
        for a in ("walk", "hurt"):
            for part, img in (("foreground", fg), ("background", bg)):
                p = R + base + f"/universal/{a}/{part}.png"
                if not os.path.isfile(p): p = find(base + f"/universal/{part}", a)
                if p and os.path.isfile(p): lpc.put(img, p, a)
        for part, img in (("foreground", fg), ("background", bg)):
            p = R + base + f"/thrust/{part}.png"
            if not os.path.isfile(p): p = find(base + f"/thrust/{part}", "thrust") or find(base + "/thrust", part)
            if p and os.path.isfile(p):
                lpc.put(img, p, "thrust", fs=Image.open(p).height // 4)
                lpc.put(img, p, "spellcast", pick=[0, 1, 2, 3, 4, 5, 6], fs=Image.open(p).height // 4)
        save("staff_" + nm, {"": fg, "_back": bg}, {"visual": True, "back": True}, icon_src=fg, icon_rc=(2, 0))
    # โล่
    for nm, base_m, base_f, back in (("kite", "shield/kite/male", "shield/kite/female", None),
                                     ("engrailed", "shield/two_engrailed/fg/male", "shield/two_engrailed/fg/female", "shield/two_engrailed/bg")):
        files = {"_m": sheet(base_m), "_f": sheet(base_f)}
        if back: files["_back"] = sheet(back)
        save("shield_" + nm, files, {"visual": True, "sexed": True, "back": bool(back)}, icon_src=files["_m"], icon_rc=(1, 0))

# ======================= หมวก =======================
def helm(nm, base, extra=(), color=None):
    """หมวกเกราะ + ชิ้นประดับ (หงอน ปีก เขา หน้ากาก) — เพศเดียวกัน"""
    def mk(sexdir):
        b = base if not os.path.isdir(R + base + "/" + sexdir) else base + "/" + sexdir
        if os.path.isdir(R + b + "/adult"): b += "/adult"
        parts = []
        bgs = []
        for e in extra:
            if os.path.isdir(R + e + "/bg"):
                bgs.append(sheet(e + "/bg" + ("/adult" if os.path.isdir(R + e + "/bg/adult") else "")))
                parts.append(sheet(e + "/fg" + ("/adult" if os.path.isdir(R + e + "/fg/adult") else "")))
            else:
                parts.append(sheet(e + ("/adult" if os.path.isdir(R + e + "/adult") else "")))
        return layers(*bgs, sheet(b, color), *parts)
    if os.path.isdir(R + base + "/male"):
        save(nm, {"_m": mk("male"), "_f": mk("female")}, {"visual": True, "sexed": True})
    else:
        save(nm, {"": mk("adult")}, {"visual": True})

def hats():
    H = "hat/"
    helm("helm_bascinet", H + "helmet/bascinet", [H + "visor/round", H + "accessory/plumage"])
    helm("helm_armet", H + "helmet/armet", [H + "accessory/crest"])
    helm("helm_sugarloaf", H + "helmet/sugarloaf", [H + "accessory/horns_downward"])
    helm("helm_horned", H + "helmet/horned", [H + "visor/slit"])
    helm("helm_maximus", H + "helmet/maximus", [H + "accessory/wings"])
    helm("helm_xeon", H + "helmet/xeon", [H + "accessory/horns_upward"])
    # หมวกสายพราน
    helm("hat_cavalier", H + "pirate/cavalier", [H + "pirate/cavalier/feather"])
    helm("hat_tricorne", H + "pirate/tricorne/basic")
    helm("hat_bicorne", H + "pirate/bicorne/athwart/captain")
    helm("hood_sack", H + "cloth/hood_sack")
    # หมวกสายเวท
    helm("hat_celestial", H + "magic/celestial", [H + "magic/celestial/trim"])
    helm("hat_moon", H + "magic/celestial_moon")
    helm("hat_large", H + "magic/large")
    helm("hat_crown", H + "formal/crown")

# ======================= เกราะ =======================
def armor():
    def plate(nm, torso, shoulders=()):
        files = {}
        for sx, (td, ad) in SEX.items():
            t = sheet(f"torso/armour/{torso}/{td}")
            sh = [sheet(f"shoulders/{s}/{ad if os.path.isdir(R + f'shoulders/{s}/{ad}') else ('male' if sx == 'm' else 'female')}") for s in shoulders]
            files["_" + sx] = layers(t, *sh)
        save(nm, files, {"visual": True, "sexed": True})
    plate("plate_pauldron", "plate", ["pauldrons"])
    plate("legion_cuirass", "legion", ["legion"])
    plate("plate_bauldron", "plate", ["bauldron"])
    plate("plate_mantal", "plate", ["mantal", "pauldrons"])
    plate("legion_epaulet", "legion", ["epaulets"])
    plate("plate_full", "plate", ["bauldron", "pauldrons"])
    plate("leather_epaulet", "leather", ["epaulets"])
    plate("leather_mantal", "leather", ["mantal"])
    plate("chain_pauldron", None or "leather", ["pauldrons"])

if __name__ == "__main__":
    want = set(sys.argv[1:])
    for fn in (weapons, hats, armor):
        if not want or fn.__name__ in want: fn()
    path = os.path.join(os.path.dirname(__file__), "shapes.json")
    old = json.load(open(path)) if os.path.exists(path) else {}
    old.update(META); json.dump(old, open(path, "w"), indent=1)
    print(len(META), "shapes")

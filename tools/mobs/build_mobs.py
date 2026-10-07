"""สร้างภาพมอนสเตอร์โซนเลเวลสูงจากชิ้นส่วน LPC (Universal LPC Spritesheet Character Generator)
รูปแบบผลลัพธ์ 576x832: แถว 0-3 เดิน(9) · 4-7 ฟัน(6) · 8 บาดเจ็บ/ตาย(6) · 9-12 ร่ายเวท(7)
usage: python3 tools/mobs/build_mobs.py [ชื่อมอน ...]   (ไม่ใส่ = สร้างทั้งหมด)"""
import os, sys, json, colorsys
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "job-art"))
import lpc
R = lpc.ROOT
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "mobs")
ANIMS = ("walk", "slash", "hurt", "spellcast")

def resolve(base, anim, color=None):
    d = os.path.join(R, base)
    for c in ([f"{anim}/{color}.png"] if color else []) + [f"{anim}.png"]:
        if os.path.isfile(os.path.join(d, c)): return os.path.join(d, c)
    sub = os.path.join(d, anim)
    if os.path.isdir(sub):
        fs = sorted(os.listdir(sub))
        if fs: return os.path.join(sub, fs[0])
    return None

def part(base, color=None, pal=None, hsv=None, anims=ANIMS):
    """pal = [(material, from, to)] recolor · hsv = (hue, sat, val)"""
    s = lpc.blank()
    for a in anims:
        p = resolve(base, a, color)
        if p: lpc.put(s, p, a)
        elif a == "spellcast":  # ชิ้นที่ไม่มีท่าร่ายเวท → ใช้ท่าเดินเฟรมแรกแทน (กันหายไปทั้งตัว)
            p = resolve(base, "walk", color)
            if p: lpc.put(s, p, "spellcast", pick=[0] * 7)
    if pal: lpc.recolor(s, pal)
    if hsv: lpc.tint_hsv(s, *hsv)
    return s

def detect(img, material="body"):
    """หาว่าชิ้นนี้ต้นฉบับใช้สีผิวชุดไหน (นับพิกเซลที่ตรงกับแต่ละชุดสี)"""
    from collections import Counter
    cnt = Counter(px[:3] for px in img.getdata() if px[3])
    best, bn = None, -1
    for name, cols in lpc.pal(material).items():
        n = sum(cnt.get(lpc.hx(c), 0) for c in cols)
        if n > bn: best, bn = name, n
    return best

def body(kind, skin):  # kind: male / muscular / female / skeleton / zombie
    return part(f"body/bodies/{kind}", pal=[("body", "light", skin)] if skin != "light" and kind not in ("skeleton", "zombie") else None)
def head(name, skin, sex="male"):
    d = f"head/heads/{name}/{sex}"
    if not os.path.isdir(os.path.join(R, d)): d = f"head/heads/{name}/adult"
    img = part(d)
    src = detect(img)
    if src != skin: lpc.recolor(img, [("body", src, skin)])
    return img
def metal(base, to):  # ชิ้นเกราะโลหะ (ต้นฉบับสี steel)
    return part(base, pal=[("metal", "steel", to)] if to != "steel" else None)

def build(recipe):
    sheet = lpc.blank()
    for l in recipe:
        if l is not None: sheet.alpha_composite(l)
    return sheet

# ---------- สูตรมอนสเตอร์ ----------
def M():
    mus = lambda skin: body("muscular", skin)
    pants = lambda c: part("legs/pants/muscular", color=c)
    pants_m = lambda c: part("legs/pants/male", color=c)
    plate = lambda to, sex="male": metal(f"torso/armour/plate/{sex}", to)
    plate_legs = lambda to, sex="male": metal(f"legs/armour/plate/{sex}", to)
    wings = lambda kind, c=None, **k: [part(f"body/wings/{kind}/adult/bg", color=c, **k), part(f"body/wings/{kind}/adult/fg", color=c, **k)]
    horns = lambda kind="curled", **k: part(f"head/horns/{kind}/adult", **k)
    tail = lambda kind, c=None, **k: [part(f"body/tail/{kind}/adult/bg", color=c, **k), part(f"body/tail/{kind}/adult/fg", color=c, **k)]
    robe = lambda c, sex="male": part("torso/clothes/robe/female", color=c)  # มีแต่ทรงหญิง (ใส่กับร่างอื่นก็พอได้)
    cyclops = lambda: part("eyes/cyclops/adult")
    cape = lambda c: [part("cape/solid/bg", color=c), part("cape/solid/fg", color=c)]
    hat = lambda kind, c=None: part(f"hat/magic/{kind}/base/adult", color=c)

    def L(*xs):  # รวมเลเยอร์ (รองรับ list ของ [bg, fg])
        bg, mid, fg = [], [], []
        for x in xs:
            if isinstance(x, list): bg.append(x[0]); fg.append(x[1])
            elif x is not None: mid.append(x)
        return bg + mid + fg

    return {
        # ยอดเขาน้ำแข็ง 34–44
        "frostgiant":  lambda: L(mus("fur_white"), pants("navy"), plate("silver"), head("troll", "fur_white")),
        "snowwraith":  lambda: L(wings("feathered", "platinum"), body("skeleton", "light"), robe("white"), head("skeleton", "light")),
        "icewolfman":  lambda: L(tail("wolf", "platinum"), mus("fur_white"), pants("bluegray"), head("wolf", "fur_white")),
        "frostcyclops":lambda: L(mus("blue"), pants("slate"), head("human", "blue", "male_plump"), cyclops()),
        # บึงพิษมรณะ 42–52
        "bogzombie":   lambda: L(body("zombie", "zombie_green"), pants_m("forest"), head("zombie", "zombie_green")),
        "venomlizard": lambda: L(tail("lizard", None, pal=None), mus("dark_green"), pants("maroon"), head("lizard", "dark_green")),
        "bogboar":     lambda: L(mus("olive"), pants("walnut"), metal("torso/armour/leather/male", "steel"), head("boarman", "olive")),
        "swampwitch":  lambda: L(body("female", "pale_green"), robe("forest_green", "female"), head("human", "pale_green", "female"), hat("wizard", "forest")),
        # ซากปราสาทร้าง 50–60
        "skelknight":  lambda: L(body("skeleton", "light"), plate_legs("iron"), plate("iron"), head("skeleton", "light")),
        "frankenstein":lambda: L(mus("pale_green"), pants("charcoal"), head("frankenstein", "pale_green")),
        "gargoyle":    lambda: L(wings("bat", "ash"), mus("taupe"), pants("gray"), head("orc", "taupe"), horns("backwards")),
        "lich":        lambda: L(body("skeleton", "light"), robe("purple"), head("skeleton", "light"), hat("wizard", "purple")),
        # ป่าต้องสาป 58–68
        "wartotaur":   lambda: L(mus("fur_black"), pants("maroon"), head("wartotaur", "fur_black")),
        "vamplord":    lambda: L(wings("bat", "black"), cape("maroon"), mus("light"), plate("bronze"), head("vampire", "light")),
        "cursedwolf":  lambda: L(tail("wolf", "black"), mus("fur_black"), pants("purple"), head("wolf", "fur_black")),
        "dryad":       lambda: L(wings("lunar", None), body("female", "bright_green"), robe("forest_green", "female"), head("human", "bright_green", "female")),
        # ทุ่งลาวา 66–76
        "firedemon":   lambda: L(wings("bat", "red"), tail("lizard", None), mus("bronze"), pants("black"), head("human", "bronze"), horns("curled")),
        "flameorc":    lambda: L(mus("amber"), plate_legs("copper"), plate("copper"), head("orc", "amber")),
        "lavataur":    lambda: L(mus("fur_copper"), pants("black"), metal("torso/armour/legion/male", "brass"), head("minotaur", "fur_copper")),
        "salamander":  lambda: L(tail("lizard", None), mus("amber"), pants("orange"), head("lizard", "amber")),
        # ทะเลทรายแดง 74–84
        "mummy":       lambda: L(body("zombie", "light"), robe("light_gray"), head("zombie", "light")),
        "sandrat":     lambda: L(tail("wolf", "sandy"), mus("fur_tan"), pants("tan"), head("rat", "fur_tan")),
        "sandspirit":  lambda: L(body("male", "bright_green"), robe("dark_brown"), head("alien", "bright_green")),
        "sandwarlord": lambda: L(cape("red"), mus("olive"), plate_legs("gold"), plate("gold"), head("orc", "olive")),
        # ยอดเขามังกร 82–92
        "draconian":   lambda: L(wings("lizard", None), tail("lizard", None), mus("green"), pants("forest"), head("lizard", "green"), horns("backwards")),
        "dragonknight":lambda: L(wings("lizard", None), mus("light"), plate_legs("gold"), plate("gold"), head("human", "light"), horns("curled")),
        "wyvern":      lambda: L(wings("bat", "navy"), tail("lizard", None), mus("blue"), pants("navy"), head("lizard", "blue")),
        "volcanogiant":lambda: L(mus("black"), pants("maroon"), metal("torso/armour/legion/male", "copper"), head("troll", "black")),
        # ห้วงอเวจี 90–99
        "deathknight": lambda: L(cape("black"), body("skeleton", "light"), plate_legs("iron"), plate("iron"), head("skeleton", "light"), horns("curled")),
        "shadowdemon": lambda: L(wings("feathered", "black"), mus("lavender"), pants("black"), head("human", "lavender"), horns("curled")),
        "darkcyclops": lambda: L(mus("lavender"), metal("torso/armour/legion/male", "iron"), pants("black"), head("human", "lavender", "male_plump"), cyclops()),
        "abysslord":   lambda: L(wings("bat", "black"), cape("purple"), mus("fur_black"), plate_legs("silver"), plate("silver"), head("wartotaur", "fur_black"), horns("curled")),
    }

# สีย้อมเพิ่มหลังประกอบ (ให้แต่ละตัวต่างกันชัดขึ้น)
POST = {"snowwraith": (0.0, 0.6, 1.08), "lich": (0.0, 1.1, 0.95), "shadowdemon": (0.0, 1.0, 0.8), "deathknight": (0.0, 0.7, 0.75),
        "salamander": (-0.03, 1.4, 1.0), "firedemon": (-0.02, 1.25, 1.0), "mummy": (0.0, 0.5, 1.05), "darkcyclops": (0.0, 1.2, 0.6), "volcanogiant": (-0.02, 1.5, 0.85)}

if __name__ == "__main__":
    recipes = M()
    want = sys.argv[1:] or list(recipes)
    for k in want:
        sheet = build(recipes[k]())
        if k in POST: lpc.tint_hsv(sheet, *POST[k])
        sheet.save(os.path.join(OUT, f"{k}.png"))
        print("ok", k)

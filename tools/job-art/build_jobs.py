# สร้างภาพอุปกรณ์อาชีพ (Phase 6) จาก LPC → public/assets/equip, look, icons
from lpc import *
from weap import out as WOUT
import math, json
EQ = OUR + "/equip"; LOOK = OUR + "/look"; ICO = OUR + "/icons"
cl = lambda t: [("cloth", "white", t)]
saved = {}
def save(name, img, folder=EQ):
    img.save(f"{folder}/{name}.png"); saved[name] = img
# ---------- weapons ----------
for k, v in WOUT.items():
    if k.startswith("staff_crystal"): continue
    save(k, v)
# คทาคริสตัล = คทาไม้ย้อมสี (ไม้เข้ม + อัญมณีม่วง)
def crystalize(img):
    import colorsys
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.25 and 0.45 < h < 0.75:   # อัญมณีฟ้า → ม่วงสว่าง
                h = 0.80; s = min(1, s * 1.1); v = min(1, v * 1.15)
            else:                               # ไม้ → ไม้มะฮอกกานีเข้ม
                h = (h - 0.02) % 1; s = min(1, s * 1.15); v = v * 0.7
            r, g, b = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return img
save("staff_crystal", crystalize(WOUT["staff_oak"].copy()))
save("staff_crystal_back", crystalize(WOUT["staff_oak_back"].copy()))
# ขวานยักษ์ = ขวานศึกย้อมแดงเข้ม
for suf in ("", "_back"):
    save("titanaxe" + suf, tint_hsv(Image.open(f"{EQ}/waraxe{suf}.png").convert("RGBA"), hue_shift=-0.05, sat=1.6, val=0.85))

# ---------- หนังสือลอย (วาดเอง) ----------
BOOKS = {"book_light": dict(cover=(236, 232, 214), dark=(150, 140, 110), trim=(232, 186, 64), gem=(120, 230, 255), page=(255, 250, 235)),
         "book_holy": dict(cover=(70, 60, 150), dark=(36, 28, 84), trim=(255, 210, 80), gem=(255, 120, 200), page=(255, 246, 220))}
def draw_book(c, glow=0):
    """หนังสือเปิด 14x11 px มองเฉียง"""
    im = Image.new("RGBA", (16, 14)); p = im.load()
    OUT = (28, 20, 30, 255)
    for x in range(1, 15):
        for y in range(3, 12):
            p[x, y] = c["cover"] + (255,)
    for x in range(2, 14):
        for y in range(2, 10):
            p[x, y] = c["page"] + (255,)
    for y in range(2, 11): p[7, y] = c["dark"] + (255,); p[8, y] = c["dark"] + (255,)
    for x in (3, 4, 5): p[x, 4] = (170, 160, 150, 255); p[x, 6] = (170, 160, 150, 255)
    for x in (10, 11, 12): p[x, 4] = (170, 160, 150, 255); p[x, 6] = (170, 160, 150, 255)
    for x in range(1, 15): p[x, 11] = c["trim"] + (255,)
    p[1, 3] = p[14, 3] = c["trim"] + (255,)
    p[7, 11] = p[8, 11] = c["gem"] + (255,)
    # ขอบดำ
    src = im.copy(); sp = src.load()
    for x in range(16):
        for y in range(14):
            if sp[x, y][3]: continue
            if any(0 <= x + dx < 16 and 0 <= y + dy < 14 and sp[x + dx, y + dy][3] for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                p[x, y] = OUT
    if glow:
        g = Image.new("RGBA", (16, 14), c["gem"] + (0,)); gp = g.load()
        for x in range(16):
            for y in range(14):
                d = math.hypot(x - 7.5, y - 6)
                gp[x, y] = c["gem"] + (int(max(0, 1 - d / 9) * 90 * glow),)
        g.alpha_composite(im); im = g
    return im
# ตำแหน่งหนังสือต่อทิศ (มุมซ้ายบนในเฟรม 64): up=หลังตัว, left/right/down=ข้างหน้า
BOOK_POS = {0: (36, 24, True), 1: (8, 26, False), 2: (40, 28, False), 3: (40, 26, False)}
def book_sheets(c):
    front, back = blank(), blank()
    for row in range(13):
        if row < 4: d, n, kind = row, 9, "walk"
        elif row < 8: d, n, kind = row - 4, 6, "slash"
        elif row == 8: d, n, kind = 2, 6, "hurt"
        else: d, n, kind = row - 9, 7, "cast"
        x0, y0, behind = BOOK_POS[d]
        for f in range(n):
            bob = round(math.sin((f / n) * math.pi * 2) * 1.5)
            y = y0 + bob; glow = 0
            if kind == "cast": y -= min(f, 3) * 2; glow = 1 if 2 <= f <= 5 else 0.4
            if kind == "hurt": y += f * 3
            img = draw_book(c, glow)
            (back if behind else front).alpha_composite(img, (f * 64 + x0, row * 64 + y))
    return front, back
for k, c in BOOKS.items():
    f, b = book_sheets(c); save(k, f); save(k + "_back", b)

# ---------- ชุดเกราะเบา / ผ้า ----------
def robe(sex, frock, femrobe):
    if sex == "f": return layer("torso/clothes/robe/female", sex, color=femrobe)
    s = layer("legs/skirts/plain/male", sex, maps=cl(frock)); s.alpha_composite(layer("torso/jacket/frock/male", sex, color=frock)); return s
def hat_wiz(sex, col, belt=None, buckle=None):
    s = layer("hat/magic/wizard/base/adult", sex, color=col)
    if belt: s.alpha_composite(layer("hat/magic/wizard/belt/adult", sex, color=belt))
    if buckle: s.alpha_composite(layer("hat/magic/wizard/buckle/adult", sex, color=buckle))
    return s
SETS = {}
for sex in ("m", "f"):
    fd = "female" if sex == "f" else "male"; td = "thin" if sex == "f" else "male"
    SETS[sex] = {
        # ชุดนักพราน Lv20
        "ranger_cap": layer("hat/cloth/leather_cap/adult", sex),
        "ranger_vest": layer(f"torso/armour/leather/{fd}", sex, maps=[("cloth", "leather", "forest")]),
        "ranger_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("leather")),
        "ranger_boots": layer(f"feet/boots/fold/{td}", sex, maps=cl("brown")),
        # ชุดพรานเงา Lv30
        "shadow_hood": layer("hat/cloth/hood/adult", sex, maps=cl("charcoal")),
        "shadow_vest": layer(f"torso/armour/leather/{fd}", sex, maps=[("cloth", "leather", "black")]),
        "shadow_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("black")),
        "shadow_boots": layer(f"feet/boots/rimmed/{td}", sex, maps=cl("black")),
        # ชุดนักเวท Lv20
        "mage_hat": hat_wiz(sex, "navy"),
        "mage_robe": robe(sex, "navy", "blue"),
        "mage_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("navy")),
        "mage_shoes": layer(f"feet/slippers/{td}", sex, maps=cl("navy")),
        # ชุดนักบวช Lv20
        "priest_hood": layer("hat/cloth/hood/adult", sex, maps=cl("white")),
        "priest_robe": robe(sex, "white", "white"),
        "priest_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("white")),
        "priest_shoes": layer(f"feet/slippers/{td}", sex, maps=cl("white")),
        # ชุดจอมเวท Lv30
        "arch_hat": hat_wiz(sex, "purple", belt="yellow", buckle="gold"),
        "arch_robe": robe(sex, "purple", "purple"),
        "arch_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("purple")),
        "arch_shoes": layer(f"feet/shoes/basic/{td}", sex, maps=cl("purple")),
        # ชุดนักบุญ Lv30
        "saint_crown": layer("hat/formal/tiara/adult", sex, color="gold") if find("hat/formal/tiara/adult", "walk", "gold") else layer("hat/formal/crown/adult", sex, color="gold"),
        "saint_robe": robe(sex, "white", "white"),
        "saint_gloves": layer(f"arms/hands/gloves/{td}", sex, maps=cl("yellow")),
        "saint_shoes": layer(f"feet/shoes/basic/{td}", sex, maps=cl("yellow")),
    }
    # นักบุญ: ขอบทองที่ชุดคลุม (ย้อมพิกเซลขอบล่าง/ขอบเงาเป็นทอง)
SEXLESS = ("ranger_cap", "shadow_hood", "mage_hat", "priest_hood", "arch_hat", "saint_crown")
for k in SETS["m"]:
    if k in SEXLESS: save(k, SETS["m"][k])
    else:
        for sex in ("m", "f"): save(f"{k}_{sex}", SETS[sex][k])

# ---------- ชุดพื้นฐานของแต่ละอาชีพ (look/outfit_<job>_<sex>) ----------
OUTFIT = {
    "guardian": ("longsleeve", "navy", "gray", ("shoes/basic", "black")),
    "slayer": ("sleeveless", "maroon", "leather", ("boots/fold", "brown")),
    "hunter": ("longsleeve", "forest", "brown", ("boots/fold", "leather")),
    "mage": ("longsleeve", "purple", "navy", ("slippers", "navy")),
    "healer": ("longsleeve", "white", "tan", ("slippers", "white")),
}
for job, (shirt, sc, pc, (feet, fc)) in OUTFIT.items():
    for sex in ("m", "f"):
        fd = "female" if sex == "f" else "male"; td = "thin" if sex == "f" else "male"
        s = layer(f"legs/pants/{td}", sex, maps=cl(pc))
        s.alpha_composite(layer(f"feet/{feet}/{td}", sex, maps=cl(fc)))
        if shirt == "sleeveless":
            s.alpha_composite(layer(f"torso/clothes/sleeveless/sleeveless/{fd if sex=='m' else 'female'}", sex, color=sc) if find(f"torso/clothes/sleeveless/sleeveless/{fd}", "walk", sc) else layer(f"torso/clothes/longsleeve/longsleeve/{fd}", sex, maps=cl(sc)))
        else:
            s.alpha_composite(layer(f"torso/clothes/longsleeve/longsleeve/{fd}", sex, maps=cl(sc)))
        save(f"outfit_{job}_{sex}", s, LOOK)

# ---------- NPC ครูฝึกอาชีพ ----------
npc = Image.open(f"{LOOK}/base_m_olive.png").convert("RGBA")
npc.alpha_composite(robe("m", "maroon", "red"))
npc.alpha_composite(Image.open(f"{LOOK}/hair_plain_platinum.png").convert("RGBA"))
npc.alpha_composite(hat_wiz("m", "maroon", belt="yellow", buckle="gold"))
npc.alpha_composite(saved["staff_crystal"])
bk = saved["staff_crystal_back"].copy(); bk.alpha_composite(npc); npc = bk
npc.save(f"{OUR}/npc_jobmaster.png")
print("saved", len(saved))
json.dump(sorted(saved), open("/tmp/claude-0/saved.json", "w"))

# ---------- ปรับแต่ง: ชุดนักบุญสีงาช้าง/ทอง, NPC ใส่เสื้อ ----------
for sex in ("m", "f"):
    im = Image.open(f"{EQ}/saint_robe_{sex}.png").convert("RGBA")
    import colorsys
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < 0.2 and v > 0.25:
                h, s = 0.13, 0.18 + (1 - v) * 0.9
            r, g, b = colorsys.hsv_to_rgb(h, min(1, s), v)
            px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    save(f"saint_robe_{sex}", im)
npc = saved["staff_crystal_back"].copy()
for l in [Image.open(f"{LOOK}/base_m_olive.png").convert("RGBA"), layer("torso/clothes/longsleeve/longsleeve/male", "m", maps=cl("tan")),
          robe("m", "maroon", "red"), Image.open(f"{LOOK}/hair_plain_platinum.png").convert("RGBA"), hat_wiz("m", "maroon", belt="yellow", buckle="gold"), saved["staff_crystal"]]:
    npc.alpha_composite(l)
npc.save(f"{OUR}/npc_jobmaster.png")

# ---------- ไอคอน 32x32 ----------
ICON_SRC = {}  # id -> (sheet names..., row, col)
def icon(id, layers, row, col, out=None):
    fr = Image.new("RGBA", (64, 64))
    for l in layers:
        fr.alpha_composite(Image.open(f"{EQ}/{l}.png").convert("RGBA").crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64)))
    bb = fr.getbbox()
    if not bb: print("empty icon", id); return
    fr = fr.crop(bb)
    w, h = fr.size; side = max(w, h)
    sq = Image.new("RGBA", (side, side)); sq.alpha_composite(fr, ((side - w) // 2, (side - h) // 2))
    k = 30 / side
    if k >= 2: n = int(k); sq = sq.resize((side * n, side * n), Image.NEAREST)
    elif k < 1: sq = sq.resize((30, 30), Image.NEAREST)
    o = Image.new("RGBA", (32, 32)); o.alpha_composite(sq, ((32 - sq.width) // 2, (32 - sq.height) // 2))
    o.save(f"{ICO}/{out or id}.png")
for w in ("saber", "moonblade", "greatsword", "titanaxe"): icon(w, [w + "_back", w], 1, 0)
for w in ("bow_hunter", "bow_shadow"): icon(w, [w + "_back", w], 1, 0)
for w in ("staff_oak", "staff_crystal"): icon(w, [w + "_back", w], 11, 0)
for w in ("book_light", "book_holy"): icon(w, [w], 2, 0)
icon("shield_knight", ["shield_knight_m"], 3, 0); icon("shield_spartan", ["shield_spartan"], 3, 0)
for h in SEXLESS: icon(h, [h], 2, 0)
for k in SETS["m"]:
    if k in SEXLESS: continue
    if k.endswith("gloves"): icon(k, [f"{k}_m"], 3, 0)
    elif k.endswith(("boots", "shoes")): icon(k, [f"{k}_m"], 3, 0)
    else: icon(k, [f"{k}_f" if "robe" in k else f"{k}_m"], 2, 0)
print("icons done")

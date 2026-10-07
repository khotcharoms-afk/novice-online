# ไอคอนเครื่องประดับใหม่ (วาดพิกเซล 16x16 → ขยาย 2 เท่า = 32x32)
from PIL import Image, ImageDraw
OUT = "/home/claude/novice-online/public/assets/icons/"
METAL = {"silver": [(90, 96, 112), (170, 176, 190), (235, 238, 245)], "gold": [(120, 80, 20), (210, 160, 50), (255, 230, 120)],
         "bronze": [(90, 55, 25), (170, 110, 55), (225, 170, 100)], "dark": [(40, 36, 50), (85, 80, 100), (140, 135, 160)],
         "ice": [(60, 110, 150), (140, 200, 235), (230, 250, 255)]}
GEM = {"red": [(110, 10, 20), (220, 40, 50), (255, 150, 150)], "blue": [(20, 40, 120), (60, 110, 230), (170, 210, 255)],
       "green": [(15, 80, 40), (50, 170, 90), (160, 240, 180)], "purple": [(60, 20, 100), (150, 70, 210), (220, 170, 255)],
       "white": [(150, 140, 110), (235, 230, 200), (255, 255, 255)], "cyan": [(10, 90, 110), (40, 190, 220), (190, 250, 255)],
       "orange": [(120, 50, 10), (235, 130, 40), (255, 210, 140)]}
OL = (22, 16, 26, 255)
def outline(im):
    src = im.copy(); s = src.load(); p = im.load(); W, H = im.size
    for x in range(W):
        for y in range(H):
            if s[x, y][3]: continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and s[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): p[x, y] = OL
    return im
def px(d, pts, c): [d.point(p, c + (255,)) for p in pts]
def ring(metal, gem):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im); m = METAL[metal]; g = GEM[gem]
    d.ellipse((3, 5, 12, 14), outline=m[1] + (255,), width=2)
    px(d, [(4, 8), (5, 6), (4, 9)], m[2]); px(d, [(11, 11), (10, 13), (11, 10)], m[0])
    d.rectangle((6, 2, 9, 5), fill=g[1] + (255,)); px(d, [(6, 2), (7, 2), (6, 3)], g[2]); px(d, [(9, 5), (8, 5), (9, 4)], g[0])
    px(d, [(5, 5), (10, 5)], m[1])
    return outline(im)
def necklace(metal, gem, shape="drop"):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im); m = METAL[metal]; g = GEM[gem]
    d.arc((1, -6, 14, 9), 20, 160, fill=m[1] + (255,), width=1)
    if shape == "drop":
        d.polygon([(7, 8), (10, 8), (11, 11), (8, 15), (6, 11)], fill=g[1] + (255,)); px(d, [(7, 9), (7, 10)], g[2]); px(d, [(9, 13), (10, 11)], g[0])
        px(d, [(8, 7), (7, 7)], m[2])
    elif shape == "feather":
        d.line([(8, 7), (8, 15)], fill=m[1] + (255,)); d.polygon([(8, 8), (11, 10), (10, 14), (8, 15)], fill=g[1] + (255,)); d.polygon([(8, 8), (5, 10), (6, 14), (8, 15)], fill=g[2] + (255,))
    return outline(im)
def amulet(metal, gem):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im); m = METAL[metal]; g = GEM[gem]
    d.line([(4, 0), (7, 5)], fill=(110, 80, 50, 255)); d.line([(11, 0), (8, 5)], fill=(110, 80, 50, 255))
    d.ellipse((3, 5, 12, 15), fill=m[1] + (255,)); d.ellipse((5, 7, 10, 13), fill=g[1] + (255,))
    px(d, [(6, 8), (6, 9), (7, 8)], g[2]); px(d, [(9, 12), (9, 11)], g[0]); px(d, [(4, 8), (4, 9)], m[2]); px(d, [(11, 12), (10, 14)], m[0])
    return outline(im)
def earring(metal, gem):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im); m = METAL[metal]; g = GEM[gem]
    for ox in (1, 8):
        d.ellipse((ox + 1, 2, ox + 5, 6), outline=m[1] + (255,)); d.ellipse((ox + 1, 7, ox + 5, 13), fill=g[1] + (255,))
        px(d, [(ox + 2, 8), (ox + 2, 9)], g[2]); px(d, [(ox + 4, 12)], g[0])
    return outline(im)
def talisman(metal, gem):
    im = Image.new("RGBA", (16, 16)); d = ImageDraw.Draw(im); m = METAL[metal]; g = GEM[gem]
    d.line([(7, 0), (7, 3)], fill=(110, 80, 50, 255))
    d.polygon([(3, 3), (12, 3), (12, 9), (7, 15), (3, 9)], fill=m[1] + (255,))
    d.polygon([(5, 5), (10, 5), (10, 9), (7, 12), (5, 9)], fill=g[1] + (255,)); px(d, [(5, 5), (6, 5), (5, 6)], g[2])
    px(d, [(3, 4), (3, 5), (4, 3)], m[2]); px(d, [(11, 9), (10, 11)], m[0])
    return outline(im)
ICONS = {
    "ring_silver": ring("silver", "red"), "earring_jade": earring("silver", "green"), "amulet_sage": amulet("bronze", "blue"),
    "ring_ruby": ring("gold", "red"), "ring_sapphire": ring("gold", "blue"), "necklace_hawk": necklace("bronze", "orange", "feather"),
    "amulet_guard": talisman("silver", "blue"), "pendant_holy": necklace("gold", "white"),
    "ring_dragon": ring("dark", "orange"), "amulet_frost": amulet("ice", "cyan"), "necklace_wind": necklace("silver", "green", "feather"), "talisman_titan": talisman("gold", "red"),
}
for k, im in ICONS.items(): im.resize((32, 32), Image.NEAREST).save(OUT + k + ".png")
prev = Image.new("RGBA", (len(ICONS) * 34, 34), (40, 40, 60, 255))
for i, k in enumerate(ICONS): prev.alpha_composite(Image.open(OUT + k + ".png"), (i * 34 + 1, 1))
prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save("/tmp/claude-0/accnew.png")

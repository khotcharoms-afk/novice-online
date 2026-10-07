"""ไอคอนต่างหูและชุดเครื่องประดับโลหิต (วาดใหม่)"""
import os
from PIL import Image, ImageDraw
I = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "icons")
OUT = (24, 14, 22, 255)
def canvas(): return Image.new("RGBA", (64, 64)), None
def done(im): return im.resize((32, 32), Image.LANCZOS)
def gem(d, x, y, r, col, hi=(255, 255, 255)):
    d.ellipse((x - r - 2, y - r - 2, x + r + 2, y + r + 2), fill=OUT); d.ellipse((x - r, y - r, x + r, y + r), fill=col + (255,))
    d.ellipse((x - r / 2 - 1, y - r / 2 - 1, x - r / 2 + 3, y - r / 2 + 3), fill=hi + (230,))
def drop(d, x, y, r, col):
    pts = [(x, y - r * 1.9), (x + r, y), (x, y + r), (x - r, y)]
    d.polygon([(px + (2 if px > x else -2 if px < x else 0), py + (2 if py > y else -2)) for px, py in pts], fill=OUT)
    d.ellipse((x - r - 2, y - r - 1, x + r + 2, y + r + 3), fill=OUT)
    d.polygon(pts, fill=col + (255,)); d.ellipse((x - r, y - r + 1, x + r, y + r + 1), fill=col + (255,))
    d.ellipse((x - r / 2, y - r / 3, x - r / 2 + 3, y - r / 3 + 3), fill=(255, 255, 255, 220))
def earring(metal, stone, kind="gem"):
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    for dx in (-13, 13):
        d.arc((22 + dx - 2, 8, 42 + dx - 2, 28), 200, 340, fill=OUT, width=6); d.arc((22 + dx - 2, 8, 42 + dx - 2, 28), 200, 340, fill=metal + (255,), width=3)
        d.line((32 + dx - 2, 24, 32 + dx - 2, 32), fill=OUT, width=5); d.line((32 + dx - 2, 24, 32 + dx - 2, 32), fill=metal + (255,), width=2)
        if kind == "drop": drop(d, 32 + dx - 2, 42, 7, stone)
        elif kind == "star":
            import math
            pts = [(32 + dx - 2 + math.cos(a) * (10 if i % 2 == 0 else 4.5), 42 + math.sin(a) * (10 if i % 2 == 0 else 4.5)) for i, a in enumerate([j * math.pi / 5 - math.pi / 2 for j in range(10)])]
            d.polygon([(x + (1 if x > 32 + dx else -1), y + 1) for x, y in pts], fill=OUT); d.polygon(pts, fill=stone + (255,))
        else: gem(d, 32 + dx - 2, 40, 7, stone)
    return done(im)
def ring(metal, stone):
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    d.ellipse((12, 22, 52, 58), fill=OUT); d.ellipse((16, 26, 48, 54), outline=metal + (255,), width=6); d.ellipse((22, 32, 42, 48), fill=(0, 0, 0, 0))
    gem(d, 32, 20, 9, stone); return done(im)
def necklace(metal, stone):
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    for x0 in (10, 54):   # สายสร้อยจากบ่าลงมาที่จี้
        d.line((x0, 6, 32, 40), fill=OUT, width=6)
    for x0 in (10, 54):
        d.line((x0, 6, 32, 40), fill=metal + (255,), width=3)
    # จี้ค้างคาว
    wing = [(32, 44), (14, 34), (20, 44), (16, 50), (26, 48), (32, 56), (38, 48), (48, 50), (44, 44), (50, 34)]
    d.polygon([(x, y + 2) for x, y in wing], fill=OUT); d.polygon(wing, fill=(70, 20, 30, 255))
    gem(d, 32, 46, 6, stone); return done(im)
ICONS = {
    "earring_copper": lambda: earring((200, 120, 70), (220, 140, 90)),
    "earring_pearl": lambda: earring((230, 230, 240), (245, 240, 230)),
    "earring_ruby": lambda: earring((230, 190, 80), (220, 30, 50)),
    "earring_star": lambda: earring((210, 220, 240), (255, 230, 90), "star"),
    "blood_ring": lambda: ring((60, 30, 40), (230, 20, 40)),
    "blood_necklace": lambda: necklace((150, 30, 40), (255, 40, 60)),
    "blood_earring": lambda: earring((60, 30, 40), (220, 20, 40), "drop"),
}
if __name__ == "__main__":
    for k, f in ICONS.items(): f().save(f"{I}/{k}.png")
    print(len(ICONS))

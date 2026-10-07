"""ภูติ 6 ตัว — วาดด้วยโค้ดเป็นพิกเซลอาร์ต 32x32 · 4 เฟรม (กระพือ/เปลวไหว) เรียงแนวนอน
ออก: public/assets/spirits/<id>.png (128x32) และไอคอน public/assets/icons/<id>.png (32x32)
usage: python3 tools/mobs/spirits.py [preview.png]"""
import os, sys, math, colorsys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, "public", "assets")
N = 32

def shade(base, k):
    """k: -1 (เงา) .. +1 (ไฮไลต์)"""
    h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in base])
    l = min(0.97, max(0.05, l + k * 0.22))
    return tuple(int(v * 255) for v in colorsys.hls_to_rgb(h, l, s))

class Canvas:
    def __init__(self):
        self.a = np.zeros((N, N, 4), np.uint8)
    def px(self, x, y, c, a=255):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < N and 0 <= y < N: self.a[y, x] = list(c[:3]) + [a]
    def blob(self, mask, base, light=(-0.6, -0.8)):
        """เติมรูปทรงจาก mask(x,y) พร้อมแรเงาแบบทรงกลม (แสงจากซ้ายบน)"""
        ys, xs = np.mgrid[0:N, 0:N]
        m = np.vectorize(mask)(xs + 0.5, ys + 0.5)
        if not m.any(): return m
        cy, cx = ys[m].mean(), xs[m].mean()
        ry = max(1, (ys[m].max() - ys[m].min()) / 2); rx = max(1, (xs[m].max() - xs[m].min()) / 2)
        for y, x in zip(*np.nonzero(m)):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            k = -(dx * light[0] + dy * light[1]) * 0.9
            k = 1 if k > 0.55 else 0.4 if k > 0.1 else -0.2 if k > -0.4 else -0.75
            self.a[y, x] = list(shade(base, k)) + [255]
        return m
    def outline(self, col=(24, 18, 36)):
        m = self.a[..., 3] > 0
        pad = np.pad(m, 1)
        ring = (pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2]) & ~m
        self.a[ring] = list(col) + [255]
    def glow(self, col, alpha=90):
        m = self.a[..., 3] > 0
        pad = np.pad(m, 1)
        ring = (pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2]) & ~m
        self.a[ring] = list(col) + [alpha]
    def img(self): return Image.fromarray(self.a)

def eyes(c, cx, cy, gap=3, col=(30, 20, 40), shine=(255, 255, 255), big=True):
    for sx in (-gap, gap):
        x = cx + sx
        c.px(x, cy, col); c.px(x, cy + 1, col)
        if big: c.px(x + (1 if sx > 0 else -1) * 0, cy - 1, col); c.px(x - 1 if sx < 0 else x + 1, cy, col); c.px(x - 1 if sx < 0 else x + 1, cy + 1, col)
        c.px(x - (0 if sx < 0 else 0), cy, shine)
def blush(c, cx, cy, gap=5, col=(255, 120, 150)):
    for sx in (-gap, gap): c.px(cx + sx, cy, col, 200)
def mouth(c, cx, cy, col=(60, 30, 40)): c.px(cx, cy, col)

def ellipse(cx, cy, rx, ry): return lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

# ---------- แต่ละตัว ----------
def ember(f):
    c = Canvas(); fl = [0, 1, 0, -1][f]
    def body(x, y):
        # หยดไฟกลับหัว: ล่างกลม บนแหลม + ปลายไฟ 3 แฉกไหว
        if ellipse(16, 20, 8, 7.5)(x, y): return True
        t = (20 - y) / 14
        if 0 <= t <= 1:
            w = 8 * (1 - t) ** 1.2
            off = math.sin(t * 6 + f * 1.6) * 1.5 * t
            if abs(x - 16 - off) <= w: return True
        for tx, h in ((10 + fl * 0.5, 9), (22 - fl * 0.5, 10)):
            if 0 <= (16 - y) <= h and abs(x - tx - (16 - y) * (0.25 if tx < 16 else -0.25)) <= max(0, 2.2 - (16 - y) * 0.25): return True
        return False
    c.blob(body, (255, 130, 40))
    c.blob(ellipse(16, 21, 4.5, 4), (255, 220, 120))   # แกนร้อน
    eyes(c, 16, 18, 3); blush(c, 16, 21, 5, (255, 90, 60)); mouth(c, 16, 21)
    c.outline((70, 20, 10)); c.glow((255, 160, 60), 110)
    for i in range(3):  # ประกายไฟ
        a = f * 0.9 + i * 2.1
        c.px(16 + math.cos(a) * 12, 10 + math.sin(a) * 4 - i * 2, (255, 230, 120), 220)
    return c.img()

def spring(f):
    c = Canvas(); b = [0, 1, 0, -1][f]
    def body(x, y):
        if ellipse(16, 20 - b * 0.3, 8.5, 8)(x, y): return True
        t = (19 - y) / 13
        return 0 <= t <= 1 and abs(x - 16) <= 8.3 * (1 - t) ** 1.4
    c.blob(body, (70, 170, 255))
    c.blob(ellipse(16, 23, 5, 3), (140, 220, 255))
    eyes(c, 16, 18, 3); blush(c, 16, 21); mouth(c, 16, 21, (30, 60, 120))
    for (x, y) in ((12, 14), (11, 16)): c.px(x, y, (240, 255, 255))  # ไฮไลต์น้ำ
    c.outline((15, 40, 90)); c.glow((120, 220, 255), 100)
    for i in range(3):  # ฟองอากาศลอย
        y = 28 - ((f * 3 + i * 9) % 26); x = 5 + i * 11 + (i == 1) * 6
        c.px(x, y, (190, 240, 255), 230); c.px(x + 1, y, (120, 200, 255), 160)
    return c.img()

def frost(f):
    c = Canvas()
    c.blob(ellipse(16, 19, 8, 7.5), (170, 225, 255))
    # มงกุฎน้ำแข็ง 3 แท่ง
    for tx, h in ((11, 6), (16, 9), (21, 6)):
        c.blob(lambda x, y, tx=tx, h=h: 12 - h <= y <= 13 and abs(x - tx) <= (y - (12 - h)) * 0.35 + 0.3, (220, 245, 255))
    eyes(c, 16, 19, 3, (20, 40, 90)); blush(c, 16, 22, 5, (150, 190, 255)); mouth(c, 16, 22, (40, 70, 130))
    c.outline((30, 60, 110)); c.glow((180, 240, 255), 110)
    # เกล็ดหิมะโคจร
    for i in range(2):
        a = f * (math.pi / 2) + i * math.pi
        x, y = 16 + math.cos(a) * 13, 19 + math.sin(a) * 5
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): c.px(x + dx, y + dy, (240, 252, 255), 230 if (dx, dy) == (0, 0) else 170)
    return c.img()

def thunder(f):
    c = Canvas()
    # ตัวกลมขอบหยักเป็นแฉก (เหมือนลูกบอลประจุไฟฟ้า) + เขาสายฟ้าแท่งเดียวกลางหัว
    def body(x, y):
        dx, dy = x - 16, y - 20
        a = math.atan2(dy, dx); r = math.hypot(dx, dy)
        return r <= 7 + 1.3 * (0.5 + 0.5 * math.cos(a * 8 + f * 0.8))
    c.blob(body, (255, 225, 60))
    bolt = [(17, 13), (14, 8), (17, 8), (14, 2)]
    for (x0, y0), (x1, y1) in zip(bolt, bolt[1:]):
        for t in np.linspace(0, 1, 14):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            c.px(x, y, (255, 250, 200)); c.px(x + 1, y, (240, 180, 30))
    c.blob(ellipse(16, 21, 4, 3), (255, 250, 200))
    eyes(c, 16, 19, 3, (60, 40, 0)); mouth(c, 16, 22, (120, 70, 0))
    c.outline((70, 50, 0)); c.glow((160, 220, 255), 140)
    for x, y in [[(5, 12), (27, 24)], [(6, 26), (26, 11)], [(4, 18), (28, 17)], [(8, 7), (24, 28)]][f]:
        c.px(x, y, (230, 245, 255)); c.px(x + 1, y + 1, (140, 200, 255), 200); c.px(x - 1, y + 1, (140, 200, 255), 200)
    return c.img()

def lumi(f):
    c = Canvas(); w = [0, 1, 2, 1][f]
    # ปีกนางฟ้า (ข้างหลัง)
    for sgn in (-1, 1):  # ปีกขนนก: ขอบล่างหยักเป็นขน 3 เส้น
        def wing(x, y, s=sgn):
            dx = (x - 16) * s
            if not (6 < dx < 15): return False
            top = 15 - w - (dx - 6) * 0.45
            bot = 21 - (dx - 6) * 0.25 - (1.4 if int(dx) % 3 == 0 else 0)
            return top <= y <= bot
        c.blob(wing, (250, 252, 240))
    c.blob(ellipse(16, 19, 7.5, 7.5), (255, 236, 150))
    eyes(c, 16, 19, 3, (90, 60, 20)); blush(c, 16, 22, 5, (255, 170, 140)); mouth(c, 16, 22, (120, 70, 30))
    c.outline((110, 80, 20))
    # วงแหวนรัศมี
    for t in np.linspace(0, 2 * math.pi, 40):
        c.px(16 + math.cos(t) * 5, 8 + math.sin(t) * 1.4, (255, 250, 170))
    c.glow((255, 245, 170), 120)
    return c.img()

def shadow(f):
    c = Canvas(); tl = [0, 1, 2, 1][f]
    def body(x, y):
        if ellipse(16, 17, 8, 7)(x, y): return True
        t = (y - 17) / 12   # หางควันส่ายลงล่าง
        if 0 <= t <= 1:
            off = math.sin(t * 4 + f * 1.5) * 3 * t
            return abs(x - 16 - off) <= 7.5 * (1 - t) ** 1.3
        return False
    c.blob(body, (110, 60, 170))
    for sgn in (-1, 1):  # เขา
        c.blob(lambda x, y, s=sgn: 5 <= y <= 11 and abs(x - (16 + s * 6) - (11 - y) * s * 0.45) <= (y - 5) * 0.3 + 0.2, (60, 30, 90))
    # ตาเรืองแสง
    for sx in (-3, 3):
        for dx in (0, 1 if sx > 0 else -1): c.px(16 + sx + dx, 17, (255, 120, 255))
        c.px(16 + sx, 16, (255, 220, 255))
    mouth(c, 16, 20, (40, 10, 60)); c.px(15, 21, (240, 240, 255)); c.px(17, 21, (240, 240, 255))  # เขี้ยว
    c.outline((25, 10, 40)); c.glow((180, 100, 255), 120)
    return c.img()

DRAW = {"sp_ember": ember, "sp_spring": spring, "sp_frost": frost, "sp_thunder": thunder, "sp_lumi": lumi, "sp_shadow": shadow}

if __name__ == "__main__":
    os.makedirs(f"{A}/spirits", exist_ok=True)
    prev = Image.new("RGBA", (4 * 36, len(DRAW) * 36), (34, 38, 60, 255))
    for j, (k, fn) in enumerate(DRAW.items()):
        sheet = Image.new("RGBA", (N * 4, N))
        for f in range(4):
            fr = fn(f); sheet.alpha_composite(fr, (f * N, 0)); prev.alpha_composite(fr, (f * 36 + 2, j * 36 + 2))
        sheet.save(f"{A}/spirits/{k}.png")
        fn(0).save(f"{A}/icons/{k}.png")
    if len(sys.argv) > 1: prev.resize((prev.width * 5, prev.height * 5), Image.NEAREST).save(sys.argv[1])

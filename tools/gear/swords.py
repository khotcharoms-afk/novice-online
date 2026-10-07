"""ดาบพิกเซลอาร์ตแบบใหม่ (ออกแบบเอง) — วาดด้วยโค้ดเป็นไอคอนเฉียง 32px
แต่ละเล่ม = ทรงใบ + กระบัง + ด้าม + ปุ่มท้าย + อัญมณี + ชุดสี
usage: python3 tools/gear/swords.py out.png  (แผ่นตัวอย่าง)"""
import sys, math
import numpy as np
from PIL import Image

N = 32
def ramp(c, n=4):
    """สีหลัก → ไล่ 4 ระดับ (เงา → ไฮไลต์)"""
    import colorsys
    h, l, s = colorsys.rgb_to_hls(*[x / 255 for x in c])
    out = []
    for dl in (-0.26, -0.1, 0.08, 0.26)[:n]:
        r, g, b = colorsys.hls_to_rgb(h, min(0.96, max(0.04, l + dl)), s)
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out

class Icon:
    """วาดในระบบพิกัดของดาบ: u = ตามแนวใบ (0 ปลาย → 1 ปุ่มท้าย) · v = ขวาง (-/+) แล้วหมุนเฉียง 45°"""
    def __init__(self):
        self.px = {}
    def put(self, x, y, col, z=0):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < N and 0 <= y < N and (x, y) not in self.px or (0 <= x < N and 0 <= y < N and self.px[(x, y)][1] <= z):
            self.px[(x, y)] = (col, z)
    def img(self, outline=(24, 16, 28)):
        im = np.zeros((N, N, 4), np.uint8)
        for (x, y), (c, _) in self.px.items(): im[y, x] = list(c) + [255]
        a = im[..., 3] > 0
        pad = np.pad(a, 1); ring = (pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2]) & ~a
        im[ring] = list(outline) + [255]
        return Image.fromarray(im)

def diag(t, w):
    """จุดบนแนวทแยง (ปลายขวาบน → ปุ่มท้ายซ้ายล่าง) t=0..1 ตามความยาว · w = เลื่อนขวาง"""
    x0, y0, x1, y1 = 27.5, 3.5, 5.5, 25.5
    x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
    return x + w * 0.7071, y + w * 0.7071

def sword(blade_shape="straight", blade=(200, 210, 225), edge=None, guard="cross", gcol=(220, 180, 70), grip=(110, 70, 45),
          gem=None, pommel="round", fuller=None, length=0.62, width=1.6, glow=None):
    I = Icon()
    B = ramp(blade); E = ramp(edge) if edge else None; G = ramp(gcol); H = ramp(grip)
    steps = 90
    for i in range(steps + 1):
        t = i / steps * length               # 0 = ปลาย → length = โคนใบ
        f = t / length                        # 0..1 ตามความยาวใบ
        if blade_shape == "straight": w = width * min(1, f * 6)
        elif blade_shape == "broad": w = (width + 1) * min(1, f * 4)
        elif blade_shape == "needle": w = max(0.6, width * 0.6 * min(1, f * 3))
        elif blade_shape == "curved": w = width * min(1, f * 5)
        elif blade_shape == "wavy": w = width * min(1, f * 5) + 0.5 * math.sin(f * math.pi * 6)
        elif blade_shape == "flame": w = width * min(1, f * 4) + 0.9 * abs(math.sin(f * math.pi * 4))
        elif blade_shape == "cleaver": w = (width + 1.6) * min(1, f * 2.2)
        else: w = width
        bend = 1.6 * math.sin(f * math.pi) if blade_shape == "curved" else 0
        for v in np.arange(-w, w + 0.01, 0.5):
            x, y = diag(t, v + bend)
            side = v / max(w, 0.01)
            k = 3 if side < -0.5 else 2 if side < 0.1 else 1 if side < 0.6 else 0
            col = (E[k] if (E and abs(side) > 0.55) else B[k])
            if fuller and abs(v) < 0.5 and 0.15 < f < 0.85: col = ramp(fuller)[1]
            I.put(x, y, col, 1)
    # กระบัง
    gt = length + 0.02
    gw = {"cross": 4.5, "wide": 6, "wing": 5.5, "disk": 2.6, "claw": 5, "none": 0}[guard]
    for v in np.arange(-gw, gw + 0.01, 0.5):
        for dt in (0, 0.025):
            curve = 0.05 * (abs(v) / max(gw, 1)) ** 2 * (1 if guard == "wing" else -1 if guard == "claw" else 0)
            x, y = diag(gt + dt - curve, v)
            I.put(x, y, G[2 if dt == 0 else 1], 2)
    if guard == "disk":
        for a in np.linspace(0, 2 * math.pi, 40):
            x, y = diag(gt + 0.012 + math.sin(a) * 0.06, math.cos(a) * 2.6); I.put(x, y, G[1], 2)
    # ด้าม
    for i in range(20):
        t = gt + 0.04 + i / 20 * 0.2
        for v in (-0.5, 0, 0.5):
            x, y = diag(t, v); I.put(x, y, H[2 if (i // 2) % 2 == 0 else 1], 1)
    # ปุ่มท้าย
    pt = gt + 0.27
    pr = {"round": 1.2, "big": 1.8, "spike": 1.0}[pommel]
    for a in np.linspace(0, 2 * math.pi, 30):
        for rr in np.arange(0, pr + 0.01, 0.5):
            x, y = diag(pt + math.sin(a) * rr / 22, math.cos(a) * rr); I.put(x, y, G[2], 2)
    # อัญมณีกลางกระบัง
    if gem:
        M = ramp(gem)
        for (dt, v, k) in ((0, 0, 2), (0.02, 0, 1), (0, 0.6, 1), (0.01, -0.5, 3)):
            x, y = diag(gt + dt, v); I.put(x, y, M[k], 3)
        x, y = diag(pt, 0); I.put(x, y, M[2], 3)
    im = I.img()
    if glow:   # แสงเรืองรอบดาบ
        a = np.array(im); m = a[..., 3] > 0
        pad = np.pad(m, 1); ring = (pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2]) & ~m
        a[ring] = list(glow) + [120]; im = Image.fromarray(a)
    return im

DESIGNS = {
    "steel":    dict(),
    "jade":     dict(blade=(120, 220, 170), edge=(220, 255, 235), gcol=(200, 160, 60), gem=(60, 200, 120), guard="wing"),
    "ruby":     dict(blade=(225, 230, 240), gcol=(240, 200, 80), gem=(220, 40, 60), guard="wide", pommel="big", fuller=(200, 60, 80)),
    "sapphire": dict(blade=(150, 190, 255), edge=(230, 245, 255), gcol=(170, 180, 200), gem=(50, 110, 240), guard="claw", blade_shape="needle", length=0.66),
    "flame":    dict(blade=(250, 140, 50), edge=(255, 230, 140), gcol=(120, 40, 30), gem=(255, 200, 60), guard="wing", blade_shape="flame", glow=(255, 150, 60)),
    "frost":    dict(blade=(190, 235, 255), edge=(255, 255, 255), gcol=(110, 170, 220), gem=(140, 230, 255), guard="disk", blade_shape="broad", glow=(150, 230, 255)),
    "shadow":   dict(blade=(80, 60, 110), edge=(200, 120, 255), gcol=(40, 30, 50), gem=(200, 60, 255), guard="claw", blade_shape="wavy", glow=(190, 100, 255)),
    "sakura":   dict(blade=(250, 200, 220), edge=(255, 240, 245), gcol=(230, 120, 160), gem=(255, 120, 180), guard="disk", blade_shape="curved", length=0.66),
    "gold":     dict(blade=(250, 210, 90), edge=(255, 250, 200), gcol=(230, 230, 240), gem=(60, 220, 200), guard="wide", pommel="big", glow=(255, 220, 120)),
    "bone":     dict(blade=(230, 220, 190), gcol=(140, 110, 80), grip=(70, 50, 40), guard="claw", blade_shape="cleaver", pommel="spike"),
    "emerald":  dict(blade=(200, 210, 220), edge=(240, 255, 240), gcol=(60, 140, 80), gem=(40, 230, 110), guard="cross", fuller=(60, 200, 110)),
    "blood":    dict(blade=(180, 30, 40), edge=(255, 120, 120), gcol=(30, 20, 25), gem=(255, 60, 60), guard="wing", blade_shape="wavy", glow=(255, 60, 60)),
}

if __name__ == "__main__":
    out = sys.argv[1]
    ks = list(DESIGNS)
    sheet = Image.new("RGBA", (6 * 40, 2 * 40), (34, 38, 60, 255))
    for i, k in enumerate(ks):
        sheet.alpha_composite(sword(**DESIGNS[k]), ((i % 6) * 40 + 4, (i // 6) * 40 + 4))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(out)

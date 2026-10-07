"""มอนสเตอร์รูปร่างไม่ใช่คน (สไลม์ ค้างคาว ผี เห็ด แมงมุม โกเลม ดวงตา ภูตไฟ ต้นไม้กินคน) — วาดด้วยโค้ดเป็นพิกเซลอาร์ต
รูปแบบ 576x832 เหมือนมอนอื่น: แถว 0-3 เดิน(9) · 4-7 โจมตี(6) · 8 ตาย(6) · 9-12 ร่ายเวท(7) · ทิศ ขึ้น/ซ้าย/ลง/ขวา
วิธีวาด: รูปทรงวงรี/หลายเหลี่ยม + แสงเงา 5 ระดับจากสีหลัก + เส้นขอบเข้ม
usage: python3 tools/mobs/creatures.py [ชื่อ ...]"""
import os, sys, math, colorsys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "mobs")
S = 64
LIGHT = np.array([-0.45, -0.62, 0.64]); LIGHT /= np.linalg.norm(LIGHT)
YY, XX = np.mgrid[0:S, 0:S].astype(float) + 0.5

def ramp(rgb):
    """สีหลัก → 5 ระดับ (เงาเข้ม เงา กลาง สว่าง ไฮไลต์)"""
    h, l, s = colorsys.rgb_to_hls(*[c / 255 for c in rgb])
    out = []
    for dl, ds, dh in ((-0.30, 0.05, 0.03), (-0.15, 0.03, 0.015), (0, 0, 0), (0.14, -0.05, -0.02), (0.30, -0.15, -0.04)):
        r, g, b = colorsys.hls_to_rgb((h + dh) % 1, max(0.03, min(0.97, l + dl)), max(0, min(1, s + ds)))
        out.append((int(r * 255), int(g * 255), int(b * 255)))
    return out

class Canvas:
    def __init__(self):
        self.rgb = np.zeros((S, S, 3)); self.a = np.zeros((S, S)); self.lineart = np.zeros((S, S), bool)
    def paint(self, mask, col, alpha=1.0, outline=True):
        if not mask.any(): return
        a = alpha
        self.rgb[mask] = self.rgb[mask] * (1 - a) * (self.a[mask, None] > 0) + np.array(col, float)[None] * a + \
            self.rgb[mask] * 0 * (self.a[mask, None] == 0)
        self.rgb[mask] = np.where(self.a[mask, None] > 0, self.rgb[mask], np.array(col, float)[None])
        self.a[mask] = np.maximum(self.a[mask], alpha)
    def ell(self, cx, cy, rx, ry, color, alpha=1.0, flat=None, rot=0.0):
        """วงรีแรเงา (flat = ใช้สีระดับเดียว 0–4)"""
        if rx <= 0.3 or ry <= 0.3: return
        dx, dy = XX - cx, YY - cy
        if rot:
            c, s_ = math.cos(rot), math.sin(rot); dx, dy = dx * c + dy * s_, -dx * s_ + dy * c
        nx, ny = dx / rx, dy / ry
        d = nx * nx + ny * ny
        m = d <= 1
        if not m.any(): return
        R = ramp(color) if not isinstance(color[0], tuple) else color
        if flat is not None:
            col = np.array(R[flat], float)
            self._put(m, np.broadcast_to(col, (S, S, 3)), alpha); return
        nz = np.sqrt(np.clip(1 - d, 0, 1))
        inten = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        idx = np.digitize(inten, [0.05, 0.38, 0.72, 0.93])
        cols = np.array(R, float)[idx]
        self._put(m, cols, alpha)
    def poly(self, pts, color, shade=2, alpha=1.0):
        from PIL import ImageDraw
        im = Image.new("L", (S, S), 0); ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=255)
        m = np.array(im) > 0
        R = ramp(color) if not isinstance(color[0], tuple) else color
        self._put(m, np.broadcast_to(np.array(R[shade], float), (S, S, 3)), alpha)
    def line(self, x0, y0, x1, y1, w, color, shade=1, alpha=1.0):
        from PIL import ImageDraw
        im = Image.new("L", (S, S), 0); ImageDraw.Draw(im).line([(x0, y0), (x1, y1)], fill=255, width=max(1, int(round(w))))
        m = np.array(im) > 0
        R = ramp(color) if not isinstance(color[0], tuple) else color
        self._put(m, np.broadcast_to(np.array(R[shade], float), (S, S, 3)), alpha)
    def dot(self, x, y, rgb, r=0.8, alpha=1.0):
        m = (XX - x) ** 2 + (YY - y) ** 2 <= r * r
        self._put(m, np.broadcast_to(np.array(rgb, float), (S, S, 3)), alpha)
    def _put(self, m, cols, alpha):
        old_a = self.a[m]
        self.rgb[m] = cols[m] * alpha + self.rgb[m] * (1 - alpha) * (old_a[:, None] > 0) + cols[m] * (1 - alpha) * (old_a[:, None] == 0)
        self.a[m] = np.maximum(old_a, alpha) if alpha < 1 else 1.0
    def image(self, outline=(22, 14, 26)):
        a = self.a > 0.01
        edge = np.zeros_like(a)
        edge[1:] |= a[:-1]; edge[:-1] |= a[1:]; edge[:, 1:] |= a[:, :-1]; edge[:, :-1] |= a[:, 1:]
        edge &= ~a
        out = np.zeros((S, S, 4), np.uint8)
        out[..., :3] = np.clip(self.rgb, 0, 255); out[..., 3] = (np.clip(self.a, 0, 1) * 255).astype(np.uint8)
        out[edge] = list(outline) + [230]
        return Image.fromarray(out, "RGBA")

DIRS = ["up", "left", "down", "right"]   # ลำดับแถวในภาพ
EYE_W, EYE_K = (250, 250, 250), (20, 12, 20)

def eyes(c, cx, cy, d, gap=5, r=2.2, iris=None, angry=False):
    """ตาคู่: ด้านหน้า = 2 ดวง · ด้านข้าง = 1 ดวงเอียงไปทางที่หัน · ด้านหลัง = ไม่มี"""
    if d == "up": return
    pos = [(cx - gap, cy), (cx + gap, cy)] if d == "down" else [(cx + (-gap - 2 if d == "left" else gap + 2), cy)]
    for x, y in pos:
        c.dot(x, y, EYE_W, r + 0.6)
        c.dot(x + (0 if d == "down" else (-0.8 if d == "left" else 0.8)), y + 0.3, iris or EYE_K, r * 0.75)
        c.dot(x - 0.8, y - 0.9, (255, 255, 255), 0.6)
        if angry: c.line(x - 2.5, y - r - 1.8 + (1 if x < cx else 0), x + 2.5, y - r - 1.8 + (0 if x < cx else 1), 1, (30, 20, 30), 0)

# ---------------- สไลม์ ----------------
def slime(c, d, kind, f, n, P):
    hop = abs(math.sin(f / n * math.pi * 2)) if kind == "walk" else 0
    sq = math.sin(f / n * math.pi * 2) * 0.12 if kind == "walk" else 0
    rx, ry, cy = 15 * (1 + sq * 0.6), 12 * (1 - sq), 50 - hop * 5
    ox = 0; oy = 0
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); rx *= 1 + t * 0.25; ry *= 1 - t * 0.15; oy = t * 6 * {"down": 1, "up": -1}.get(d, 0); ox = t * 8 * {"left": -1, "right": 1}.get(d, 0)
    if kind == "hurt": ry *= 1 - f / n * 0.75; rx *= 1 + f / n * 0.5; cy = 50 + f * 1.2
    if kind == "cast": rx *= 1 + math.sin(f / n * math.pi) * 0.15
    s = P.get("size", 1) * 1.2; rx *= s; ry *= s
    cx = 32 + ox; cy = cy + oy + (1 - s) * 6
    c.ell(cx, cy - ry + 12 * s, rx, ry, P["c"], alpha=P.get("alpha", 0.92))
    c.ell(cx - rx * 0.35, cy - ry * 1.15 + 12 * s, rx * 0.28, ry * 0.18, P["c"], flat=4, alpha=0.9)
    if P.get("core"): c.ell(cx, cy - ry * 0.6 + 12 * s, rx * 0.3, ry * 0.3, P["core"], alpha=0.85)
    if P.get("crown"):
        y0 = cy - ry * 2 + 12 * s
        c.poly([(cx - 7, y0 + 2), (cx - 7, y0 - 5), (cx - 3.5, y0 - 1), (cx, y0 - 7), (cx + 3.5, y0 - 1), (cx + 7, y0 - 5), (cx + 7, y0 + 2)], (240, 190, 50), 3)
    if kind != "hurt" or f < 3: eyes(c, cx, cy - ry * 0.75 + 12 * s, d, gap=5 * s, r=2 * s, angry=P.get("angry"))
    if kind == "cast" and f in (2, 3, 4): c.ell(cx, cy - ry * 2.2 + 12 * s, 4, 4, P.get("core") or P["c"], flat=4, alpha=0.7)

# ---------------- ค้างคาว ----------------
def bat(c, d, kind, f, n, P):
    flap = math.sin(f / max(1, n) * math.pi * 2 * (1 if kind != "walk" else 1)) if kind != "hurt" else -0.6
    bob = math.sin(f / max(1, n) * math.pi * 2) * 2
    cx, cy = 32, 30 + bob
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 8 * {"left": -1, "right": 1}.get(d, 0); cy += t * 8 * {"down": 1, "up": -1}.get(d, 0) + t * 6
    if kind == "hurt": cy += f * 4; flap = -0.8
    s = P.get("size", 1) * 1.35
    wy = flap * 9 * s
    side = d in ("left", "right")
    for sgn in ([-1, 1] if not side else [1 if d == "left" else -1]):
        if side: sgn = -sgn  # ปีกด้านไกลเห็นด้านหลัง
        span = (17 if not side else 13) * s
        tip = (cx + sgn * span, cy - 4 - wy)
        pts = [(cx + sgn * 3, cy - 3), tip, (cx + sgn * span * 0.85, cy + 4 - wy * 0.4), (cx + sgn * span * 0.55, cy + 1 - wy * 0.2),
               (cx + sgn * span * 0.4, cy + 6 - wy * 0.1), (cx + sgn * 3, cy + 3)]
        c.poly(pts, P["w"], 1)
        c.line(cx + sgn * 3, cy - 2, tip[0], tip[1], 1, P["w"], 0)
    c.ell(cx, cy, 6.5 * s, 7 * s, P["c"])
    ex = {"left": -1.5, "right": 1.5}.get(d, 0)
    for sgn in (-1, 1):
        c.poly([(cx + sgn * 2 + ex, cy - 5 * s), (cx + sgn * 5 + ex, cy - 12 * s), (cx + sgn * 5.5 + ex, cy - 4 * s)], P["c"], 1)
    if d != "up":
        for x in ([cx - 2.5, cx + 2.5] if d == "down" else [cx + ex * 2]):
            c.dot(x, cy - 1.5, P.get("eye", (255, 60, 60)), 1.3)
        c.dot(cx - 1 + ex, cy + 2.5, (255, 255, 255), 0.6); c.dot(cx + 1 + ex, cy + 2.5, (255, 255, 255), 0.6)
    if kind == "cast" and f in (2, 3, 4): c.ell(cx, cy - 16, 3.5, 3.5, P.get("eye", (255, 60, 60)), flat=4, alpha=0.75)

# ---------------- ผี ----------------
def ghost(c, d, kind, f, n, P):
    bob = math.sin(f / max(1, n) * math.pi * 2) * 2.5
    cx, cy = 32, 30 + bob
    alpha = P.get("alpha", 0.82)
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 9 * {"left": -1, "right": 1}.get(d, 0); cy += t * 7 * {"down": 1, "up": -1}.get(d, 0)
    if kind == "hurt": alpha *= 1 - f / n * 0.8; cy -= f * 2
    s = P.get("size", 1)
    wave = f / max(1, n) * math.pi * 2
    lean = {"left": 3, "right": -3}.get(d, 0)
    tail = [(cx - 11 * s, cy), (cx + 11 * s, cy)]
    pts = [(cx - 11 * s, cy)]
    for i in range(7):
        x = cx + (-11 + i * 22 / 6) * s
        pts.append((x + lean, cy + (16 + (3 if i % 2 else -1) * math.sin(wave + i)) * s))
    pts.append((cx + 11 * s, cy))
    c.poly(pts, P["c"], 2, alpha)
    c.ell(cx, cy, 11 * s, 12 * s, P["c"], alpha=alpha)
    for sgn in (-1, 1):  # แขน
        c.ell(cx + sgn * 12 * s, cy + 6 + math.sin(wave + sgn) * 2, 3.5 * s, 2.5 * s, P["c"], alpha=alpha)
    if d != "up":
        ex = {"left": -3, "right": 3}.get(d, 0)
        for x in ([cx - 4 * s, cx + 4 * s] if d == "down" else [cx + ex * s]):
            c.ell(x, cy - 1, 2.2 * s, 3.2 * s, P.get("eye", (20, 10, 30)), flat=0, alpha=0.95)
            c.dot(x, cy - 1, P.get("glow", (120, 240, 255)), 0.9)
        c.ell(cx + ex * s, cy + 6 * s, 2 * s, 2.6 * s, (20, 10, 30), flat=0, alpha=0.9)
    if kind == "cast" and f in (2, 3, 4, 5): c.ell(cx, cy - 18, 5, 5, P.get("glow", (120, 240, 255)), flat=3, alpha=0.6)

# ---------------- เห็ด ----------------
def mushroom(c, d, kind, f, n, P):
    step = math.sin(f / max(1, n) * math.pi * 2) if kind == "walk" else 0
    cx, base = 32 + step * 1.5, 56
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 6 * {"left": -1, "right": 1}.get(d, 0); base += t * 4 * {"down": 1, "up": -1}.get(d, 0)
    s = P.get("size", 1); squash = 0
    if kind == "hurt": squash = f / n
    capy = base - 22 * s * (1 - squash * 0.5) - abs(step) * 1.5
    for sgn in (-1, 1):  # เท้า
        c.ell(cx + sgn * 5 * s, base - 2 + (step * sgn * 1.5 if kind == "walk" else 0), 3.5 * s, 2.5 * s, P["stem"])
    c.ell(cx, base - 9 * s, 7.5 * s, 9 * s * (1 - squash * 0.5), P["stem"])
    if d != "up": eyes(c, cx, base - 10 * s, d, gap=3.2 * s, r=1.6 * s, angry=P.get("angry"))
    c.ell(cx, capy, 16 * s, 10 * s * (1 - squash * 0.3), P["c"])
    c.ell(cx, capy + 6 * s, 15 * s, 3 * s, P["c"], flat=0)
    for (dx, dy, r) in ((-7, -3, 2.6), (4, -6, 2.2), (8, 0, 1.8), (-1, 1, 1.6), (-10, 2, 1.4)):
        c.ell(cx + dx * s, capy + dy * s, r * s, r * s * 0.85, P.get("spot", (250, 245, 230)), flat=3)
    if kind == "cast" and f in (2, 3, 4, 5):
        for i in range(5): c.dot(cx + math.cos(i * 1.3 + f) * 13, capy - 6 - (f * 3 + i * 2) % 12, P.get("spore", (210, 255, 140)), 1.1, 0.85)

# ---------------- แมงมุม ----------------
def spider(c, d, kind, f, n, P):
    ph = f / max(1, n) * math.pi * 2
    cx, cy = 32, 44
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 8 * {"left": -1, "right": 1}.get(d, 0); cy += t * 6 * {"down": 1, "up": -1}.get(d, 0) - t * 3
    s = P.get("size", 1)
    if kind == "hurt": cy += f * 0.8
    side = d in ("left", "right"); fw = {"left": -1, "right": 1}.get(d, 0)
    for i in range(4):
        for sgn in (-1, 1):
            k = (i + (0 if sgn > 0 else 1)) % 2
            lift = math.sin(ph + i * 1.6 + (0 if sgn > 0 else math.pi)) * 2.5 if kind == "walk" else 0
            if kind == "hurt": lift = -f * 1.2
            if not side:
                kx = cx + sgn * (6 + i * 1.5) * s; ky = cy - 2 + i * 2.5
                ex, ey = cx + sgn * (17 + i * 1.2) * s, cy - 8 + i * 5 + lift
                fx_, fy = cx + sgn * (21 + i * 0.5) * s, cy + 2 + i * 3.5
            else:
                kx = cx + (i - 1.5) * 3 * s; ky = cy
                ex, ey = cx + (i - 1.5) * 7 * s + sgn, cy - 9 - lift
                fx_, fy = cx + (i - 1.5) * 9 * s, cy + 9
            c.line(kx, ky, ex, ey, 2, P["c"], 0); c.line(ex, ey, fx_, fy, 1.6, P["c"], 0)
    ab = (cx - fw * 8 * s, cy - 2) if side else (cx, cy - 6 * s if d == "down" else cy + 2 * s)
    hd = (cx + fw * 8 * s, cy + 1) if side else (cx, cy + 4 * s if d == "down" else cy - 7 * s)
    order = [("ab", ab), ("hd", hd)] if d != "up" else [("hd", hd), ("ab", ab)]
    for name, (x, y) in order:
        if name == "ab":
            c.ell(x, y, 11 * s, 9 * s, P["c"])
            c.ell(x, y - 1, 4 * s, 4 * s, P.get("mark", (220, 40, 40)), flat=2)
        else:
            c.ell(x, y, 6.5 * s, 5.5 * s, P["c"])
            if d != "up":
                for ex_, ey_ in ([(-2.5, -1), (2.5, -1), (-1, -2.6), (1, -2.6)] if d == "down" else [(fw * 3, -1), (fw * 1.5, -2.6)]):
                    c.dot(x + ex_ * s, y + ey_ * s, P.get("eye", (255, 60, 60)), 0.9)
                if d == "down":
                    c.line(x - 1.5, y + 3, x - 2, y + 6, 1, (240, 240, 230), 3); c.line(x + 1.5, y + 3, x + 2, y + 6, 1, (240, 240, 230), 3)
    if kind == "cast" and f in (2, 3, 4): c.ell(cx, cy - 18, 4, 4, (240, 240, 240), flat=4, alpha=0.6)

# ---------------- โกเลม ----------------
def golem(c, d, kind, f, n, P):
    ph = f / max(1, n) * math.pi * 2
    step = math.sin(ph) if kind == "walk" else 0
    cx, base = 32, 58
    s = P.get("size", 1)
    swing = 0
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); swing = t; base += t * 3 * {"down": 1, "up": -1}.get(d, 0)
    if kind == "hurt": base += f * 0.6
    fw = {"left": -1, "right": 1}.get(d, 0)
    for sgn in (-1, 1):  # ขา
        c.ell(cx + sgn * 6 * s, base - 5 - (max(0, step * sgn) * 3), 5 * s, 6 * s, P["c"])
    by = base - 20 * s - abs(step)
    c.ell(cx, by, 14 * s, 11 * s, P["c"])
    for (dx, dy, r) in ((-6, -3, 1.5), (5, 2, 1.2), (1, -6, 1.1)):  # รอยร้าวเรืองแสง
        c.dot(cx + dx * s, by + dy * s, P["core"], r, 0.9)
    for sgn in (-1, 1):  # แขนก้อนหิน
        arm_y = by + 4 + (step * sgn * 2 if kind == "walk" else 0) - (swing * 10 if (sgn == fw or (fw == 0 and sgn == 1)) else 0)
        ax = cx + sgn * 16 * s + (fw * swing * 6 if sgn == fw else 0)
        c.ell(ax, arm_y - 6, 5 * s, 5 * s, P["c"]); c.ell(ax, arm_y + 2, 6 * s, 6 * s, P["c"])
    hy = by - 13 * s
    c.ell(cx + fw * 2, hy, 7 * s, 6 * s, P["c"])
    if d != "up":
        for x in ([cx - 3 * s, cx + 3 * s] if d == "down" else [cx + fw * 4 * s]):
            c.ell(x, hy, 1.8 * s, 1.2 * s, P["core"], flat=4)
    if kind == "cast" and f in (2, 3, 4, 5): c.ell(cx, by, 15 * s, 12 * s, P["core"], flat=3, alpha=0.35)

# ---------------- ดวงตาลอย ----------------
def eye(c, d, kind, f, n, P):
    ph = f / max(1, n) * math.pi * 2
    cx, cy = 32, 30 + math.sin(ph) * 2
    s = P.get("size", 1)
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 7 * {"left": -1, "right": 1}.get(d, 0); cy += t * 7 * {"down": 1, "up": -1}.get(d, 0)
    if kind == "hurt": cy += f * 3
    for i in range(5):  # หนวดใต้ตา
        a = -0.9 + i * 0.45
        x0, y0 = cx + math.sin(a) * 9 * s, cy + 9 * s
        c.line(x0, y0, x0 + math.sin(ph + i) * 3, y0 + 12 * s, 2, P["t"], 1)
    c.ell(cx, cy, 13 * s, 12.5 * s, P["c"])
    if d == "up":
        for i in range(4): c.line(cx - 6 + i * 4, cy - 8, cx - 4 + i * 3, cy + 4, 1, (200, 60, 70), 1, 0.6)
    else:
        ix = cx + {"left": -5, "right": 5}.get(d, 0) * s; iy = cy + 1
        blink = kind == "hurt" and f >= 3
        if not blink:
            c.ell(ix, iy, 6 * s, 6 * s, P["iris"])
            c.ell(ix, iy, 2.6 * s, 3.4 * s, (12, 6, 14), flat=0)
            c.dot(ix - 2, iy - 2.5, (255, 255, 255), 1.1)
        c.ell(cx, cy - 10 * s, 12 * s, 4 * s, P["t"], flat=1)  # เปลือกตาบน
    if kind == "cast" and f in (2, 3, 4): c.ell(cx, cy, 15 * s, 15 * s, P["iris"], flat=4, alpha=0.3)

# ---------------- ภูตไฟ / ภูตน้ำแข็ง ----------------
def wisp(c, d, kind, f, n, P):
    rnd = np.random.RandomState(f * 7 + DIRS.index(d) * 13 + {"walk": 0, "slash": 1, "hurt": 2, "cast": 3}[kind] * 101)
    cx, cy = 32, 36 + math.sin(f / max(1, n) * math.pi * 2) * 2
    s = P.get("size", 1); a = 0.9
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 8 * {"left": -1, "right": 1}.get(d, 0); cy += t * 7 * {"down": 1, "up": -1}.get(d, 0); s *= 1 + t * 0.2
    if kind == "hurt": s *= 1 - f / n * 0.6; a *= 1 - f / n * 0.5
    R = ramp(P["c"])
    for layer, (sc, sh) in enumerate(((1.0, 1), (0.72, 2), (0.45, 3), (0.22, 4))):
        pts = []
        for i in range(12):
            ang = i / 12 * math.pi * 2
            rr = (10 + (6 if math.sin(ang) < -0.3 else 0) * (1 + rnd.rand() * 0.5)) * sc * s
            if math.sin(ang) < -0.5: rr += rnd.rand() * 6 * sc * s  # เปลวด้านบน
            pts.append((cx + math.cos(ang) * rr * 0.85, cy + math.sin(ang) * rr - (4 * sc * s if math.sin(ang) < 0 else 0)))
        c.poly(pts, R, sh, a)
    if d != "up":
        ex = {"left": -3, "right": 3}.get(d, 0)
        for x in ([cx - 3.5, cx + 3.5] if d == "down" else [cx + ex]):
            c.ell(x, cy + 1, 1.6, 2.4, (30, 14, 20), flat=0, alpha=0.9)
    for i in range(3): c.dot(cx + rnd.randn() * 8, cy - 14 - rnd.rand() * 8, R[4], 0.9, 0.8)

# ---------------- ต้นไม้กินคน ----------------
def plant(c, d, kind, f, n, P):
    ph = f / max(1, n) * math.pi * 2
    sway = math.sin(ph) * 2.5
    cx, base = 32, 58
    s = P.get("size", 1)
    open_ = 0.25
    if kind == "slash": open_ = [0.3, 0.7, 1.0, 0.2, 0.0, 0.2][f]; sway += {"left": -5, "right": 5}.get(d, 0) * math.sin(f / (n - 1) * math.pi)
    if kind == "hurt": sway = f * 1.5; open_ = 0.6
    if kind == "cast": open_ = 0.6
    for sgn in (-1, 1):  # ใบ
        c.poly([(cx, base - 4), (cx + sgn * 14 * s, base - 10 + math.sin(ph + sgn) * 2), (cx + sgn * 18 * s, base - 3), (cx + sgn * 6, base)], P["leaf"], 2)
        c.line(cx, base - 3, cx + sgn * 15 * s, base - 6, 1, P["leaf"], 1)
    hx, hy = cx + sway, base - 26 * s
    c.line(cx, base - 2, cx + sway * 0.5, base - 14 * s, 4, P["leaf"], 1)
    c.line(cx + sway * 0.5, base - 14 * s, hx, hy + 6, 4, P["leaf"], 1)
    fw = {"left": -1, "right": 1}.get(d, 0)
    if d in ("down", "up"):
        c.ell(hx, hy, 12 * s, 9 * s, P["c"])
        for i in range(6): c.ell(hx + math.cos(i) * 10 * s, hy + math.sin(i) * 7 * s, 2.2, 2.2, P.get("spot", (250, 240, 200)), flat=3)
        if d == "down":
            mh = 2 + open_ * 6
            c.ell(hx, hy + 2, 8 * s, mh, (70, 10, 20), flat=0)
            for i in range(5): c.poly([(hx - 7 + i * 3.5, hy + 2 - mh + 0.5), (hx - 5.5 + i * 3.5, hy + 2 - mh + 3.5), (hx - 4 + i * 3.5, hy + 2 - mh + 0.5)], (250, 250, 240), 3)
    else:
        jaw = open_ * 0.6
        for sgn, j in ((-1, jaw), (1, -jaw)):
            c.ell(hx + fw * 4 * math.cos(j), hy + sgn * 4 + fw * 4 * math.sin(j) * sgn, 10 * s, 5.5 * s, P["c"], rot=j * sgn * fw)
        for i in range(4): c.dot(hx + fw * (3 + i * 2.5), hy - 1 + (i % 2), (250, 250, 240), 0.9)
    if kind == "cast" and f in (2, 3, 4, 5):
        for i in range(4): c.dot(hx + math.cos(i * 1.6 + f) * 12, hy - 8 - (f * 2 + i * 3) % 10, P.get("spore", (220, 120, 255)), 1.2, 0.85)

BODIES = {"slime": slime, "bat": bat, "ghost": ghost, "mushroom": mushroom, "spider": spider, "golem": golem, "eye": eye, "wisp": wisp, "plant": plant}
# ชนิดมอน: body + สี
CREATURES = {
    "slime_green":  ("slime", dict(c=(90, 200, 90))),
    "slime_ice":    ("slime", dict(c=(130, 210, 245), core=(230, 250, 255))),
    "slime_poison": ("slime", dict(c=(150, 80, 200), angry=True)),
    "slime_lava":   ("slime", dict(c=(240, 90, 30), core=(255, 230, 120), alpha=0.97, angry=True)),
    "slime_abyss":  ("slime", dict(c=(80, 30, 110), core=(255, 80, 220), angry=True, size=1.15)),
    "bat_brown":    ("bat", dict(c=(110, 80, 70), w=(90, 60, 60), eye=(255, 210, 60))),
    "bat_vampire":  ("bat", dict(c=(60, 40, 70), w=(130, 30, 50), eye=(255, 50, 50), size=1.15)),
    "bat_drake":    ("bat", dict(c=(60, 120, 70), w=(200, 120, 40), eye=(255, 230, 80), size=1.25)),
    "ghost_white":  ("ghost", dict(c=(225, 235, 245))),
    "ghost_dark":   ("ghost", dict(c=(110, 80, 150), glow=(255, 90, 200), size=1.1)),
    "ghost_abyss":  ("ghost", dict(c=(60, 30, 80), glow=(255, 60, 160), size=1.2, alpha=0.88)),
    "shroom_red":   ("mushroom", dict(c=(210, 50, 40), stem=(235, 220, 190))),
    "shroom_glow":  ("mushroom", dict(c=(70, 160, 230), stem=(210, 230, 240), spot=(200, 255, 255), spore=(140, 240, 255), angry=True)),
    "spider_bog":   ("spider", dict(c=(70, 80, 50), mark=(200, 220, 60))),
    "spider_sand":  ("spider", dict(c=(190, 150, 90), mark=(160, 60, 30), size=1.1)),
    "golem_stone":  ("golem", dict(c=(140, 135, 130), core=(120, 220, 255))),
    "golem_magma":  ("golem", dict(c=(70, 50, 50), core=(255, 140, 30), size=1.1)),
    "golem_sand":   ("golem", dict(c=(200, 170, 110), core=(80, 230, 200), size=1.1)),
    "eye_float":    ("eye", dict(c=(235, 225, 215), iris=(60, 160, 90), t=(170, 90, 110))),
    "eye_abyss":    ("eye", dict(c=(70, 40, 80), iris=(255, 60, 200), t=(110, 40, 90), size=1.15)),
    "wisp_frost":   ("wisp", dict(c=(130, 210, 255))),
    "wisp_fire":    ("wisp", dict(c=(255, 120, 30))),
    "plant_bog":    ("plant", dict(c=(170, 40, 60), leaf=(60, 130, 50), spore=(220, 255, 120))),
    "plant_cursed": ("plant", dict(c=(110, 40, 140), leaf=(50, 80, 60), spot=(255, 120, 230), spore=(220, 120, 255))),
}
LAYOUT = [("walk", 0, 9), ("slash", 4, 6), ("hurt", 8, 6), ("cast", 9, 7)]

def build(name):
    body, P = CREATURES[name]
    fn = BODIES[body]
    sheet = Image.new("RGBA", (576, 832), (0, 0, 0, 0))
    for kind, r0, ncol in LAYOUT:
        dirs = DIRS if kind != "hurt" else ["down"]
        for di, d in enumerate(dirs):
            for f in range(ncol):
                c = Canvas()
                fn(c, d, kind, f if kind != "walk" else (f - 1 if f else 0), ncol - (1 if kind == "walk" else 0), P)
                sheet.alpha_composite(c.image(), (f * 64, (r0 + di) * 64))
    sheet.save(os.path.join(OUT, f"{name}.png"))

if __name__ == "__main__":
    for k in (sys.argv[1:] or list(CREATURES)):
        build(k); print("ok", k)

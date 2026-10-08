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
    """ค้างคาว: ปีกพังผืดกว้างมีกระดูกนิ้ว · หูแหลมใหญ่ · เขี้ยว · ตาเรืองแสง"""
    flap = math.sin(f / max(1, n) * math.pi * 2) if kind != "hurt" else -0.6
    bob = math.sin(f / max(1, n) * math.pi * 2) * 2
    cx, cy = 32, 32 + bob
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 8 * {"left": -1, "right": 1}.get(d, 0); cy += t * 8 * {"down": 1, "up": -1}.get(d, 0) + t * 5
    if kind == "hurt": cy += f * 4; flap = -0.9
    s = P.get("size", 1) * 1.5
    wy = flap * 10 * s
    side = d in ("left", "right")
    for sgn in ([-1, 1] if not side else [1 if d == "left" else -1]):
        if side: sgn = -sgn
        span = (19 if not side else 15) * s
        sh = (cx + sgn * 4, cy - 3)
        f1 = (cx + sgn * span, cy - 7 - wy)
        f2 = (cx + sgn * span * 0.82, cy + 2 - wy * 0.5)
        f3 = (cx + sgn * span * 0.5, cy + 5 - wy * 0.25)
        pts = [sh, f1, (cx + sgn * span * 0.93, cy - 1 - wy * 0.75), f2, (cx + sgn * span * 0.66, cy + 5 - wy * 0.35), f3, (cx + sgn * span * 0.32, cy + 8 - wy * 0.1), (cx + sgn * 4, cy + 5)]
        c.poly(pts, P["w"], 2)
        for q in (f1, f2, f3): c.line(sh[0], sh[1], q[0], q[1], 1, P["w"], 0)
        c.line(sh[0], sh[1], f1[0], f1[1], 1.6, P["c"], 0)
        c.dot(f1[0], f1[1], (230, 220, 210), 0.7)  # กรงเล็บปลายปีก
    c.ell(cx, cy + 1, 6.5 * s, 7.5 * s, P["c"])
    if d != "up": c.ell(cx, cy + 3, 3.6 * s, 5 * s, P.get("belly", P["c"]), flat=3)
    ex = {"left": -1.5, "right": 1.5}.get(d, 0)
    hy = cy - 6 * s
    c.ell(cx + ex, hy, 5 * s, 4.4 * s, P["c"])
    for sgn in (-1, 1):  # หูใหญ่แหลม
        c.poly([(cx + sgn * 2 + ex, hy - 2 * s), (cx + sgn * 6.5 + ex, hy - 10 * s), (cx + sgn * 5.5 + ex, hy - 1 * s)], P["c"], 1)
        c.poly([(cx + sgn * 3 + ex, hy - 2.5 * s), (cx + sgn * 5.8 + ex, hy - 8 * s), (cx + sgn * 5 + ex, hy - 2 * s)], P["w"], 3)
    if d != "up":
        for x in ([cx - 2.2 * s, cx + 2.2 * s] if d == "down" else [cx + ex * 2.2]):
            c.dot(x, hy - 0.5, P.get("eye", (255, 60, 60)), 1.4); c.dot(x, hy - 0.5, (255, 255, 230), 0.5)
        c.dot(cx - 1.2 + ex, hy + 3.4, (255, 255, 255), 0.7); c.dot(cx + 1.2 + ex, hy + 3.4, (255, 255, 255), 0.7)  # เขี้ยว
    if kind == "cast" and f in (2, 3, 4): c.ell(cx, cy - 20, 3.5, 3.5, P.get("eye", (255, 60, 60)), flat=4, alpha=0.75)

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
def rock(c, cx, cy, rx, ry, col, seed=0, alpha=1.0, flat=None):
    """ก้อนหินเหลี่ยม: ขอบเป็นหลายเหลี่ยมไม่สม่ำเสมอ + แรเงาตามแสงแบบก้อนนูน (ดูเป็นหินแกะ ไม่ใช่ลูกบอล)"""
    if rx <= 0.5 or ry <= 0.5: return
    from PIL import ImageDraw
    rnd = np.random.RandomState(seed)
    k = 7 + seed % 3
    pts = []
    for i in range(k):
        a = (i + rnd.rand() * 0.35) / k * math.pi * 2
        r = 0.86 + rnd.rand() * 0.18
        pts.append((cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r))
    im = Image.new("L", (S, S), 0); ImageDraw.Draw(im).polygon(pts, fill=255)
    m = np.array(im) > 0
    if not m.any(): return
    R = ramp(col) if not isinstance(col[0], tuple) else col
    # เส้นขอบเข้มรอบก้อน (แยกชิ้นหินให้เห็นชัด)
    e = m.copy(); e[1:] |= m[:-1]; e[:-1] |= m[1:]; e[:, 1:] |= m[:, :-1]; e[:, :-1] |= m[:, 1:]
    c._put(e & ~m, np.broadcast_to(np.array([v * 0.35 for v in R[0]], float), (S, S, 3)), alpha)
    if flat is not None:
        c._put(m, np.broadcast_to(np.array(R[flat], float), (S, S, 3)), alpha); return
    nx, ny = (XX - cx) / rx, (YY - cy) / ry
    # ระนาบเหลี่ยม: ปัดทิศ normal เป็นขั้น ๆ → เห็นหน้าตัดหิน
    ang = np.arctan2(ny, nx); ang = np.round(ang / (math.pi / 3)) * (math.pi / 3)
    rr = np.clip(np.sqrt(nx * nx + ny * ny), 0, 1)
    rr = np.where(rr < 0.45, 0.0, 0.75)
    nxq, nyq = np.cos(ang) * rr, np.sin(ang) * rr
    nz = np.sqrt(np.clip(1 - nxq * nxq - nyq * nyq, 0, 1))
    inten = nxq * LIGHT[0] + nyq * LIGHT[1] + nz * LIGHT[2]
    idx = np.digitize(inten, [0.05, 0.38, 0.72, 0.93])
    c._put(m, np.array(R, float)[idx], alpha)

def golem(c, d, kind, f, n, P):
    """โกเลม: ร่างหินเหลี่ยมหลังค่อม ไหล่ใหญ่ แขนยาวถึงพื้น กำปั้นหินโต หัวเล็กจมอยู่ระหว่างไหล่ แกนพลังเรืองแสงกลางอก"""
    ph = f / max(1, n) * math.pi * 2
    s = P.get("size", 1)
    col, core = P["c"], P["core"]
    cx, base = 32, 60
    step = math.sin(ph) if kind == "walk" else 0
    bob = abs(math.sin(ph)) * 1.5 if kind == "walk" else 0
    fw = {"left": -1, "right": 1}.get(d, 0)
    side = fw != 0
    lift = 0; slam = 0
    if kind == "slash":  # ยกกำปั้นสองข้างขึ้นเหนือหัว แล้วทุบลงพื้น
        t = f / (n - 1)
        lift = math.sin(min(1, t / 0.6) * math.pi / 2) if t < 0.6 else max(0, 1 - (t - 0.6) / 0.25)
        slam = 1 if t >= 0.8 else 0
    crumble = f / max(1, n - 1) if kind == "hurt" else 0
    glow = 1.0 + (0.6 if kind == "cast" and 2 <= f <= 5 else 0)
    by = base - 29 * s + bob   # กลางลำตัว
    def at(x, y, k=1.0):  # ตอนตาย: ชิ้นส่วนกระจาย/ร่วงลงพื้น
        if not crumble: return x, y
        return x + (x - cx) * crumble * 0.5 * k, y + crumble * (base - 4 - y) * 0.85
    # ขา
    for sgn in ((-1, 1) if not side else (fw, -fw)):
        lx = cx + sgn * (7 if not side else 3) * s + (step * sgn * 3 if side else 0)
        ly = base - 7 - max(0, step * sgn) * 3
        x, y = at(lx, ly); rock(c, x, y, 5 * s, 7.5 * s, col, seed=3 + (sgn > 0))
    # แขนด้านหลัง (ด้านข้าง) วาดก่อนลำตัว
    def arm(sgn, front):
        sx = cx + sgn * (17 if not side else 4) * s + (fw * 2 if side else 0)
        sy = by - 6 * s
        swing = -step * sgn * 3 if kind == "walk" else 0
        if lift:
            hx, hy = cx + sgn * 8 * s + fw * 6, by - 30 * s * lift
        else:
            hx, hy = sx + sgn * 2 * s + (fw * (8 if front else -2) if side else 0) + swing * (1 if side else 0), base - 10 + swing * (0 if side else 1)
            if slam: hx, hy = cx + fw * 14 + sgn * 6, base - 6
        mx, my = (sx + hx) / 2 + sgn * 2 * s, (sy + hy) / 2
        x, y = at(mx, my); rock(c, x, y, 4 * s, 6.5 * s, col, seed=11 + (sgn > 0))
        x, y = at(hx, hy, 1.4); rock(c, x, y, 6.5 * s, 6 * s, col, seed=21 + (sgn > 0))  # กำปั้น
        if slam and front:
            for i in range(5): c.dot(hx + (i - 2) * 4, base - 1 - (i % 2) * 2, (200, 190, 170), 1.3, 0.8)
    if side: arm(-fw, False)
    # ลำตัว (หลังค่อม) + ไหล่
    x, y = at(cx, by + 3); rock(c, x, y, (10 if not side else 8) * s, 8 * s, col, seed=4)   # เอว
    x, y = at(cx, by - 3); rock(c, x, y, (14 if not side else 10) * s, 10 * s, col, seed=5)  # อก
    if not side:
        for sgn in (-1, 1):
            x, y = at(cx + sgn * 15 * s, by - 9 * s); rock(c, x, y, 6.5 * s, 6 * s, col, seed=7 + (sgn > 0))
    else:
        x, y = at(cx - fw * 3, by - 10 * s); rock(c, x, y, 8 * s, 6 * s, col, seed=8)
    # มอส/คริสตัล/ลาวาบนไหล่
    if P.get("moss") and not crumble:
        for dx in ((-15, 15) if not side else (-fw * 4,)):
            c.ell(cx + dx * s, by - 14 * s, 4 * s, 1.8 * s, P["moss"], flat=2)
    # แกนพลังกลางอก + รอยร้าวเรืองแสง
    if d != "up" and crumble < 0.5:
        ccx = cx + fw * 4 * s; ccy = by - 1
        c.poly([(ccx, ccy - 4 * s), (ccx + 3 * s, ccy), (ccx, ccy + 4 * s), (ccx - 3 * s, ccy)], core, 4)
        c.ell(ccx, ccy, 5 * s * glow, 5 * s * glow, core, flat=3, alpha=0.35)
        for (a0, a1) in ((0.4, 1.0), (2.4, 2.9), (4.0, 4.6)):
            c.line(ccx + math.cos(a0) * 4, ccy + math.sin(a0) * 4, ccx + math.cos(a1) * 10 * s, ccy + math.sin(a1) * 8 * s, 1, core, 3, 0.85)
    elif d == "up" and not crumble:
        for (x0, y0, x1, y1) in ((-6, -6, -1, 2), (5, -3, 2, 6)):
            c.line(cx + x0 * s, by + y0 * s, cx + x1 * s, by + y1 * s, 1, core, 3, 0.7)
    # หัวเล็กจมระหว่างไหล่
    hx, hy = cx + fw * 6 * s, by - 16 * s + (2 if lift else 0)
    x, y = at(hx, hy); rock(c, x, y, 6 * s, 5.5 * s, col, seed=31)
    if d != "up" and crumble < 0.4:
        c.line(x - 5 * s, y - 2.5 * s, x + 5 * s, y - 2.5 * s, 1.5, col, 0)  # คิ้วหิน
        for ex in ([-2.5, 2.5] if not side else [fw * 2.5]):
            c.ell(x + ex * s, y, 1.6 * s, 1.0 * s, core, flat=4)
            c.ell(x + ex * s, y, 2.6 * s, 1.8 * s, core, flat=3, alpha=0.35)
    # แขนหน้า
    if side: arm(fw, True)
    else:
        for sgn in (-1, 1): arm(sgn, True)
    if kind == "cast" and 2 <= f <= 5:
        for i in range(6): c.dot(cx + math.cos(i + f) * 18 * s, by + math.sin(i * 1.7 + f) * 12, core, 1.2, 0.8)

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
    """ภูตไฟ/น้ำแข็ง: เปลวไฟรูปหยดน้ำกลับหัว ปลายลิ้นไฟพลิ้วขึ้นข้างบน แกนสว่างจ้า มีตาสองดวงในเปลว"""
    rnd = np.random.RandomState(f * 7 + DIRS.index(d) * 13 + {"walk": 0, "slash": 1, "hurt": 2, "cast": 3}[kind] * 101)
    ph = f / max(1, n) * math.pi * 2
    cx, cy = 32, 40 + math.sin(ph) * 2
    s = P.get("size", 1) * 1.15; a = 0.95
    if kind == "slash": t = math.sin(f / (n - 1) * math.pi); cx += t * 8 * {"left": -1, "right": 1}.get(d, 0); cy += t * 7 * {"down": 1, "up": -1}.get(d, 0); s *= 1 + t * 0.25
    if kind == "hurt": s *= 1 - f / n * 0.7; a *= 1 - f / n * 0.6
    if kind == "cast": s *= 1 + math.sin(f / (n - 1) * math.pi) * 0.2
    R = ramp(P["c"])
    lean = {"left": 3, "right": -3}.get(d, 0)
    for layer, (sc, sh) in enumerate(((1.0, 1), (0.76, 2), (0.52, 3), (0.3, 4))):
        Rr = 10 * sc * s
        pts = []
        for i in range(13):  # ครึ่งล่างกลม
            u = math.pi * i / 12
            pts.append((cx + math.cos(u) * Rr, cy + math.sin(u) * Rr * 0.9))
        # ครึ่งบน: ลิ้นไฟ 3 แฉกแหลม พลิ้วตามเฟรม
        tongues = [(-0.55, 1.1 + 0.3 * math.sin(ph + 1)), (0.0, 2.0 + 0.35 * math.sin(ph * 1.3)), (0.55, 1.2 + 0.3 * math.sin(ph + 2.4))]
        for i in range(25):
            xx = -1 + i / 12  # ต่อจากครึ่งล่าง (จบที่ซ้าย) ไล่ไปขวา
            h = 0.25 + sum(hh * math.exp(-((xx - x0) / 0.2) ** 2) for x0, hh in tongues)
            h *= 1 - xx * xx * 0.35
            bend = lean * h * 0.5 + math.sin(ph * 2 + h * 2) * h * 1.2
            pts.append((cx + xx * Rr + bend, cy - h * Rr))
        c.poly(pts, R, sh, a)
    if d != "up" and kind != "hurt":
        ex = {"left": -3, "right": 3}.get(d, 0)
        for x in ([cx - 3.5, cx + 3.5] if d == "down" else [cx + ex]):
            c.ell(x, cy + 1, 1.5, 2.4, (40, 14, 20), flat=0, alpha=0.9)
            c.dot(x, cy, (255, 255, 255), 0.5)
    for i in range(4): c.dot(cx + rnd.randn() * 7, cy - 18 - rnd.rand() * 10, R[4], 0.9, 0.8)

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


# ---------------- มังกร (ไวเวิร์น / มังกรอเวจี) ----------------
def dragon(c, d, kind, f, n, P):
    """มังกรยืนสองขา ปีกค้างคาวใหญ่ คอยาว หัวมีเขาโค้ง ตาเรืองแสง หางแหลม · โจมตี = ยื่นคอกัด · ร่ายเวท = ยืดตัวกางปีก พ่นไฟในปาก"""
    ph = f / max(1, n) * math.pi * 2
    s = P.get("size", 1)
    body, wingc, belly, eye, fire, horn = P["c"], P["w"], P["belly"], P["eye"], P["fire"], P.get("horn", (225, 215, 200))
    cx, base = 32, 61
    flap = math.sin(ph) * 3 if kind == "walk" else 0
    bob = math.sin(ph) * 1.2 if kind == "walk" else 0
    lunge = 0; jaw = 0.25; rear = 0; droop = 0
    if kind == "slash":
        t = math.sin(f / (n - 1) * math.pi); lunge = t; jaw = 0.25 + t * 0.9; flap = -t * 2
    if kind == "cast":
        t = math.sin(min(1, f / (n - 2)) * math.pi * 0.5); rear = t; flap = -6 * t; jaw = 0.3 + t * 0.8
    if kind == "hurt":
        droop = f / max(1, n - 1); bob = droop * 10; flap = droop * 8
    fw = {"left": -1, "right": 1}.get(d, 0)
    side = fw != 0
    by = base - 22 * s + bob - rear * 3
    def wing(sx, sy, tipx, tipy, backx, backy, shade=1):
        # กระดูกปีก 3 นิ้ว + พังผืดหยัก
        f1 = (tipx, tipy)
        f2 = (sx + (tipx - sx) * 0.75 + (backx - sx) * 0.35, sy + (tipy - sy) * 0.55 + (backy - sy) * 0.5)
        f3 = (sx + (backx - sx) * 0.8, sy + (backy - sy) * 0.75)
        mid = lambda a, b, k: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + k)
        pts = [(sx, sy), f1, mid(f1, f2, 4), f2, mid(f2, f3, 4), f3, (backx, backy)]
        c.poly(pts, wingc, shade)
        for q in (f1, f2, f3): c.line(sx, sy, q[0], q[1], 1.6, body, 0)
        c.dot(f1[0], f1[1], horn, 1.0)
    def head(hx, hy, look, jawk):
        """look: -1/1 = ด้านข้าง (ทิศที่หัน) · 0 = หันหน้า · 2 = หันหลัง"""
        if look == 2:
            c.ell(hx, hy, 6.5 * s, 5.5 * s, body)
            for sg in (-1, 1): c.poly([(hx + sg * 3, hy - 3), (hx + sg * 9, hy - 11), (hx + sg * 6, hy - 2)], horn, 2)
            return
        if look == 0:
            for sg in (-1, 1):  # เขาโค้งไปด้านหลัง
                c.poly([(hx + sg * 3, hy - 3), (hx + sg * 8, hy - 9), (hx + sg * 11, hy - 14), (hx + sg * 9, hy - 7), (hx + sg * 6, hy - 1)], horn, 2)
            c.ell(hx, hy, 7 * s, 5.5 * s, body)
            c.ell(hx, hy + 4.5 * s, 4.8 * s, 3.2 * s, body)                     # ปาก
            if jawk > 0.4:
                c.ell(hx, hy + 7 * s, 3.6 * s, 2.2 * s * jawk, (60, 10, 20), flat=0)
                for i in range(4): c.dot(hx - 2.4 + i * 1.6, hy + 5.6 * s, (250, 245, 230), 0.5)
                if kind == "cast": c.ell(hx, hy + 7 * s, 3 * s, 2 * s, fire, flat=4)
            for sg in (-1, 1):
                c.line(hx + sg * 1.5, hy - 1.2, hx + sg * 5, hy - 2.2, 1, (20, 10, 10), 0)          # คิ้วดุ
                c.ell(hx + sg * 3.2, hy, 1.7, 1.0, eye, flat=4); c.ell(hx + sg * 3.2, hy, 2.8, 1.8, eye, flat=3, alpha=0.35)
            c.dot(hx - 1.2, hy + 4.2 * s, (20, 8, 10), 0.5); c.dot(hx + 1.2, hy + 4.2 * s, (20, 8, 10), 0.5)
            return
        L = look
        c.poly([(hx - L * 2, hy - 3), (hx - L * 8, hy - 8), (hx - L * 12, hy - 7), (hx - L * 7, hy - 2)], horn, 2)  # เขาโค้งไปข้างหลัง
        c.ell(hx, hy, 6 * s, 4.6 * s, body)
        c.ell(hx + L * 6 * s, hy + 1.4, 5 * s, 2.6 * s, body)                 # จมูก/ปากบน
        c.ell(hx + L * 5 * s, hy + 3.2 + jawk * 3, 4.4 * s, 1.6 * s, body, flat=1)  # ขากรรไกรล่าง
        if jawk > 0.4:
            c.poly([(hx + L * 2, hy + 3), (hx + L * 10, hy + 3), (hx + L * 9, hy + 3 + jawk * 3)], (60, 10, 20), 0)
            for i in range(3): c.dot(hx + L * (4 + i * 2), hy + 3.4, (250, 245, 230), 0.5)
            if kind == "cast": c.ell(hx + L * 10, hy + 3.5, 3, 2.4, fire, flat=4)
        c.ell(hx + L * 1.5, hy - 1.2, 1.8, 1.0, eye, flat=4); c.ell(hx + L * 1.5, hy - 1.2, 2.8, 1.8, eye, flat=3, alpha=0.35)
        c.line(hx - L * 0.5, hy - 2.8, hx + L * 4, hy - 2, 1, (20, 10, 10), 0)
        c.dot(hx + L * 10, hy + 0.6, (20, 8, 10), 0.5)
    if not side:
        back = d == "up"
        # ปีกสองข้าง (หลังตัว)
        for sg in (-1, 1):
            wing(cx + sg * 6, by - 8, cx + sg * 31, by - 30 + flap + droop * 10, cx + sg * 9, by + 10, 1)
        # หาง
        if back:
            for i in range(6): c.ell(cx + math.sin(i * 0.6 + ph * 0.3) * 3, by + 12 + i * 2.2, (5 - i * 0.6) * s, 3 * s, body)
            c.poly([(cx - 3, base), (cx, base + 3), (cx + 3, base)], horn, 2)
        else:
            for i in range(6): c.ell(cx + 10 + i * 3, base - 4 - i * 0.6 + math.sin(i + ph) * 0.8, (4 - i * 0.45) * s, (3 - i * 0.3) * s, body)
            c.poly([(cx + 26, base - 9), (cx + 31, base - 8), (cx + 27, base - 4)], horn, 2)
        # ขา
        for sg in (-1, 1):
            st = math.sin(ph + (0 if sg > 0 else math.pi)) * 1.5 if kind == "walk" else 0
            c.ell(cx + sg * 8, base - 9 - max(0, st), 5.5 * s, 7 * s, body)
            c.ell(cx + sg * 9, base - 2.5, 4.5 * s, 2.5 * s, body, flat=1)
            for k in (-1, 0, 1): c.dot(cx + sg * 9 + k * 2.2, base - 0.6, horn, 0.6)
        # ลำตัว + ท้อง
        c.ell(cx, by + 4, 11 * s, 13 * s, body)
        if not back:
            c.ell(cx, by + 6, 6 * s, 10 * s, belly)
            for i in range(5): c.line(cx - 4.5, by - 1 + i * 3.4, cx + 4.5, by - 1 + i * 3.4, 1, belly, 1, 0.8)
            for sg in (-1, 1): c.ell(cx + sg * 9, by + 2 - lunge * 2, 2.6 * s, 4 * s, body)            # แขนเล็ก
        else:
            for i in range(6): c.poly([(cx - 2, by - 6 + i * 4), (cx, by - 10 + i * 4), (cx + 2, by - 6 + i * 4)], P.get("spike", horn), 3)
        # คอ + หัว
        hy = by - 16 * s - rear * 3 + lunge * 5
        c.ell(cx, by - 8, 5.5 * s, 7 * s, body)
        if not back: c.ell(cx, by - 7, 3 * s, 5.5 * s, belly)
        head(cx, hy, 2 if back else 0, jaw)
    else:
        L = fw
        # ปีกด้านไกล
        wing(cx - L * 2, by - 8, cx - L * 20, by - 34 + flap + droop * 10, cx - L * 15, by + 4, 0)
        # หาง (ด้านหลัง) + ขาหลัง
        for i in range(7): c.ell(cx - L * (10 + i * 3), base - 6 - math.sin(i * 0.5) * 3 + math.sin(i + ph) * 0.8, (4.5 - i * 0.5) * s, (3.2 - i * 0.3) * s, body)
        tx = cx - L * 31; c.poly([(tx + L * 2, base - 12), (tx - L * 4, base - 10), (tx + L * 1, base - 6)], horn, 2)
        st = math.sin(ph) * 2 if kind == "walk" else 0
        c.ell(cx - L * 5 + st * L, base - 9, 5.5 * s, 7 * s, body, flat=1)
        c.ell(cx - L * 4 + st * L, base - 2.5, 4.5 * s, 2.3 * s, body, flat=0)
        # ลำตัว
        c.ell(cx - L * 1, by + 5, 13 * s, 10.5 * s, body)
        c.ell(cx + L * 2, by + 9, 8 * s, 5.5 * s, belly)
        for i in range(5): c.poly([(cx - L * (9 - i * 3.5), by - 4 + i * 0.3), (cx - L * (7.5 - i * 3.5), by - 9 + i * 0.4), (cx - L * (6 - i * 3.5), by - 4 + i * 0.3)], P.get("spike", horn), 3)
        # ขาหน้า
        c.ell(cx + L * 6 - st * L, base - 9, 5 * s, 7 * s, body)
        c.ell(cx + L * 7 - st * L, base - 2.5, 4.5 * s, 2.3 * s, body, flat=1)
        for k in (0, 1, 2): c.dot(cx + L * (8.5 + k * 1.5) - st * L, base - 0.8, horn, 0.6)
        # คอโค้ง → หัว
        hx = cx + L * (12 + lunge * 8); hy = by - 16 * s - rear * 3 + lunge * 3
        for i in range(5):
            k = i / 4
            nx = cx + L * 6 + (hx - L * 3 - (cx + L * 6)) * k; ny = by - 2 + (hy + 3 - (by - 2)) * k - math.sin(k * math.pi) * 3
            c.ell(nx, ny, (5 - k * 1.2) * s, (5 - k * 1.2) * s, body)
            c.ell(nx + L * 1.5, ny + 1.5, (2.6 - k * 0.6) * s, (3 - k * 0.6) * s, belly, flat=2)
        head(hx, hy, L, jaw)
        # ปีกด้านใกล้ (พับครึ่ง ชี้ขึ้น)
        wing(cx + L * 1, by - 6, cx - L * 10, by - 36 + flap * 1.2 + droop * 10, cx - L * 12, by + 6, 2)
    if kind == "cast" and 2 <= f <= 5:
        for i in range(6): c.dot(cx + math.cos(i * 1.1 + f) * 22, by - 6 + math.sin(i * 1.7 + f) * 14, fire, 1.2, 0.85)

BODIES = {"slime": slime, "bat": bat, "ghost": ghost, "mushroom": mushroom, "spider": spider, "golem": golem, "eye": eye, "wisp": wisp, "plant": plant, "dragon": dragon}
# ชนิดมอน: body + สี
CREATURES = {
    "slime_green":  ("slime", dict(c=(90, 200, 90))),
    "slime_ice":    ("slime", dict(c=(130, 210, 245), core=(230, 250, 255))),
    "slime_poison": ("slime", dict(c=(150, 80, 200), angry=True)),
    "slime_lava":   ("slime", dict(c=(240, 90, 30), core=(255, 230, 120), alpha=0.97, angry=True)),
    "slime_abyss":  ("slime", dict(c=(80, 30, 110), core=(255, 80, 220), angry=True, size=1.15)),
    "bat_brown":    ("bat", dict(c=(104, 76, 66), w=(120, 84, 80), belly=(150, 118, 100), eye=(255, 210, 60))),
    "bat_vampire":  ("bat", dict(c=(52, 34, 62), w=(140, 36, 58), belly=(90, 60, 100), eye=(255, 50, 50), size=1.12)),
    "bat_drake":    ("bat", dict(c=(56, 116, 70), w=(206, 124, 44), belly=(200, 190, 120), eye=(255, 230, 80), size=1.2)),
    "ghost_white":  ("ghost", dict(c=(225, 235, 245))),
    "ghost_dark":   ("ghost", dict(c=(110, 80, 150), glow=(255, 90, 200), size=1.1)),
    "ghost_abyss":  ("ghost", dict(c=(60, 30, 80), glow=(255, 60, 160), size=1.2, alpha=0.88)),
    "shroom_red":   ("mushroom", dict(c=(210, 50, 40), stem=(235, 220, 190))),
    "shroom_glow":  ("mushroom", dict(c=(70, 160, 230), stem=(210, 230, 240), spot=(200, 255, 255), spore=(140, 240, 255), angry=True)),
    "spider_bog":   ("spider", dict(c=(70, 80, 50), mark=(200, 220, 60))),
    "spider_sand":  ("spider", dict(c=(190, 150, 90), mark=(160, 60, 30), size=1.1)),
    "golem_stone":  ("golem", dict(c=(128, 126, 122), core=(110, 220, 255), moss=(90, 140, 70))),
    "golem_magma":  ("golem", dict(c=(66, 50, 50), core=(255, 140, 30), size=1.08)),
    "golem_sand":   ("golem", dict(c=(196, 166, 108), core=(70, 230, 200), size=1.08)),
    "eye_float":    ("eye", dict(c=(235, 225, 215), iris=(60, 160, 90), t=(170, 90, 110))),
    "eye_abyss":    ("eye", dict(c=(70, 40, 80), iris=(255, 60, 200), t=(110, 40, 90), size=1.15)),
    "wisp_frost":   ("wisp", dict(c=(130, 210, 255))),
    "wisp_fire":    ("wisp", dict(c=(255, 120, 30))),
    "plant_bog":    ("plant", dict(c=(170, 40, 60), leaf=(60, 130, 50), spore=(220, 255, 120))),
    "wyvern":       ("dragon", dict(c=(60, 118, 84), w=(150, 80, 44), belly=(214, 196, 132), eye=(255, 220, 60), fire=(255, 150, 40), spike=(230, 210, 150))),
    "dragon_abyss": ("dragon", dict(c=(64, 36, 96), w=(78, 28, 104), belly=(150, 92, 172), eye=(255, 80, 220), fire=(255, 110, 230), horn=(225, 205, 235), spike=(255, 70, 200))),
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

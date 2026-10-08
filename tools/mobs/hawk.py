"""เหยี่ยวของ Sniper (สกิลเรียกเหยี่ยว) — มองด้านข้างหันขวา (เกมกลับด้านเองเมื่อบินไปซ้าย)
เฟรม 64x64: 0-3 กระพือปีก · 4 โฉบ (หุบปีกพุ่ง) · 5 กางกรงเล็บจิก
usage: python3 tools/mobs/hawk.py → public/assets/summons/hawk.png"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from creatures import Canvas, ramp
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "summons", "hawk.png")
BROWN, DARK, CREAM, BEAK, EYE = (128, 82, 44), (70, 44, 26), (236, 214, 172), (240, 190, 50), (255, 210, 40)

def wing(c, sx, sy, ang, L, col, shade, tuck=False):
    """ปีก: จากไหล่ (sx,sy) ไปยังมุม ang (เรเดียน, 0 = ชี้ไปข้างหลัง/ซ้าย) · ปลายขนเป็นนิ้ว 4 เส้น"""
    dx, dy = -math.cos(ang), math.sin(ang)          # ทิศแกนปีก
    px, py = -dy, dx                                  # ทิศตั้งฉาก (ความกว้างปีก)
    w = 9 if not tuck else 4
    tip = (sx + dx * L, sy + dy * L)
    pts = [(sx + px * 2, sy + py * 2), (sx + dx * L * 0.55 + px * (w * 0.7), sy + dy * L * 0.55 + py * (w * 0.7)), tip]
    # ขนปลายปีก (หยัก)
    for i in range(4):
        t = 0.95 - i * 0.12
        pts.append((sx + dx * L * t - px * (w * 0.5 + i * 0.9), sy + dy * L * t - py * (w * 0.5 + i * 0.9)))
        pts.append((sx + dx * L * (t - 0.06) - px * (w * 0.2 + i * 0.6), sy + dy * L * (t - 0.06) - py * (w * 0.2 + i * 0.6)))
    pts.append((sx - px * (w * 0.9), sy - py * (w * 0.9)))
    c.poly(pts, col, shade)
    # แถบขนสีเข้มปลายปีก + เส้นกระดูกปีก
    c.line(sx + dx * L * 0.62, sy + dy * L * 0.62, tip[0], tip[1], 2, DARK, 1)
    c.line(sx, sy, sx + dx * L * 0.6, sy + dy * L * 0.6, 1, col, 3)

def hawk(frame):
    c = Canvas()
    dive = frame == 4; grab = frame == 5
    flap = [-1.25, -0.55, 0.75, -0.05, 0, -0.9][frame]
    cx, cy = 30, 32 + (2 if frame == 2 else 0)
    rot = 0.35 if dive else 0
    def P(x, y):  # หมุนรอบลำตัว (ตอนโฉบหัวทิ่มลง)
        x, y = x - cx, y - cy
        return cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)
    # ปีกด้านไกล (เข้มกว่า)
    sx, sy = P(32, 29)
    if dive: wing(c, sx, sy, -0.15, 20, DARK, 1, tuck=True)
    else: wing(c, sx + 1, sy - 1, flap - 0.15, 23, DARK, 1)
    # หาง (พัด + แถบ)
    t0 = P(19, 31); t1 = P(7, 27); t2 = P(6, 36); t3 = P(19, 35)
    c.poly([t0, t1, t2, t3], BROWN, 2)
    a, b = P(10, 29), P(10, 35); c.line(a[0], a[1], b[0], b[1], 1, DARK, 0)
    # ลำตัว
    bx, by = P(29, 32)
    c.ell(bx, by, 12, 6.5, BROWN, rot=rot)
    ex, ey = P(32, 35); c.ell(ex, ey, 8, 3.5, CREAM, rot=rot)          # อก/ท้องสีครีม
    for i in range(3):  # ลายจุดบนอก
        x, y = P(29 + i * 3, 35 + (i % 2)); c.dot(x, y, (150, 110, 70), 0.7)
    # หัว + ปาก + ตา
    hx, hy = P(42, 27)
    c.ell(hx, hy, 5.5, 5, BROWN)
    fx, fy = P(44, 29); c.ell(fx, fy, 3, 2.4, CREAM, flat=3)
    b0, b1, b2, b3 = P(46, 26.5), P(50.5, 28), P(49, 31.5), P(46, 30)
    c.poly([b0, b1, b2, b3], BEAK, 3); c.dot(b2[0], b2[1] - 0.5, (60, 40, 20), 0.8)
    exx, eyy = P(44, 26); c.dot(exx, eyy, EYE, 1.3); c.dot(exx + 0.4, eyy, (20, 10, 10), 0.7)
    c.line(exx - 2, eyy - 1.6, exx + 2.5, eyy - 1.2, 1, DARK, 0)       # คิ้วดุ
    # กรงเล็บ
    if grab:
        for i in range(2):
            k0, k1 = P(31 + i * 4, 37), P(34 + i * 4, 44)
            c.line(k0[0], k0[1], k1[0], k1[1], 1.5, BEAK, 2)
            for j in (-1, 1): c.line(k1[0], k1[1], k1[0] + j * 2, k1[1] + 2, 1, (40, 30, 20), 0)
    else:
        k0, k1 = P(30, 37), P(27, 39); c.line(k0[0], k0[1], k1[0], k1[1], 1.5, BEAK, 2)
    # ปีกด้านใกล้
    sx, sy = P(30, 30)
    if dive: wing(c, sx, sy, -0.05, 21, BROWN, 2, tuck=True)
    else: wing(c, sx, sy, flap, 26, BROWN, 2)
    return c.image()

sheet = Image.new("RGBA", (64 * 6, 64))
for f in range(6): sheet.alpha_composite(hawk(f), (f * 64, 0))
sheet.save(OUT); print("ok", OUT)

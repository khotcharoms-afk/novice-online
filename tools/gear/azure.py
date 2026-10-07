"""ชุดอัศวินคราม (ดรอปจาก World Boss) — ย้อมชิ้นส่วน LPC ให้เป็นเหล็กเงินอมฟ้า ขอบทอง ผ้าน้ำเงิน ตามภาพคอนเซ็ปต์
ไอคอนตัดจากภาพคอนเซ็ปต์ที่ผู้ดูแลเกมส่งมา (ถ้ามีไฟล์) ไม่งั้นย่อจากภาพบนตัว
usage: python3 tools/gear/azure.py [concept.png]"""
import os, sys, json, subprocess
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, "public", "assets")
E = f"{A}/equip"

STEEL = {  # สีเหล็กเดิมของ LPC → เหล็กเงินอมฟ้า
    (29, 19, 30): (16, 18, 42), (31, 19, 25): (16, 18, 42),
    (46, 37, 51): (28, 48, 140), (40, 24, 32): (24, 40, 120),       # ชั้นใน/ผ้า → น้ำเงินเข้ม
    (77, 74, 93): (68, 82, 124), (114, 107, 126): (122, 138, 178), (134, 126, 127): (150, 164, 200),
    (149, 128, 128): (166, 178, 210), (196, 181, 159): (214, 222, 242), (229, 230, 199): (240, 245, 255),
}
GOLD = [(120, 74, 18), (196, 140, 40), (240, 196, 92), (255, 236, 160)]
OUT = (16, 18, 42)

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def steel(arr, trim=True, horns=False):
    a = arr.copy(); m = a[..., 3] > 0
    H, W = m.shape
    src = a[..., :3].copy()
    # สีเหล็ก → ตามตาราง · สีอื่น (หนัง/ทอง) → ทองตามความสว่าง
    flat = src.reshape(-1, 3); out = flat.copy()
    keys = {k: v for k, v in STEEL.items()}
    for i, c in enumerate(map(tuple, flat)):
        if c in keys: out[i] = keys[c]
        elif c == (255, 255, 255): out[i] = c
        elif c != (0, 0, 0):
            L = lum(c); g = GOLD[min(3, int(L / 64))]; out[i] = g
    a[..., :3] = out.reshape(H, W, 3)
    if trim:  # ขอบทอง: เนื้อเหล็กที่ติดเส้นตะเข็บด้านใน (เส้นขอบที่ไม่ติดพื้นโปร่ง)
        isout = m & np.all(a[..., :3] == OUT, -1)
        pad = np.pad(~m, 1)
        nearT = pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2] | pad[2:, 2:] | pad[:-2, :-2] | pad[2:, :-2] | pad[:-2, 2:]
        seam = isout & ~nearT
        ps = np.pad(seam, 1)
        adj = (ps[:-2, 1:-1] | ps[1:-1, :-2])  # อยู่ใต้/ขวาของตะเข็บ
        metal = m & ~isout & (a[..., 2] > a[..., 0] + 10) & (a[..., :3].sum(-1) > 250)
        sel = adj & metal
        L = a[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
        g = np.array(GOLD)[np.clip((L / 70).astype(int), 0, 3)]
        a[..., :3] = np.where(sel[..., None], g, a[..., :3])
    if horns:  # หมวก: เขาโค้งสีงาช้างสองข้าง (ตามภาพคอนเซ็ปต์) — หันหน้า/หลังเห็น 2 เขา · หันข้างเห็นเขาฝั่งหลัง
        HC = [(70, 40, 20), (200, 150, 100), (245, 215, 170), (255, 240, 215)]
        for row in range(H // 64):
            if row == 8: continue
            d = ["up", "left", "down", "right"][(row - 9) % 4 if row >= 9 else row % 4]
            for col in range(W // 64):
                fy, fx = row * 64, col * 64
                fr = m[fy:fy + 64, fx:fx + 64]
                ys, xs = np.nonzero(fr)
                if not len(ys): continue
                top, l, r = ys.min(), xs.min(), xs.max()
                sides = [-1, 1] if d in ("up", "down") else [1] if d == "left" else [-1]
                for sd in sides:
                    bx = (r - 1) if sd > 0 else (l + 1)
                    pts = []
                    for k in range(9):  # โค้งขึ้นและออกด้านนอก
                        t = k / 8
                        x = bx + sd * (1.5 * t + 2.2 * t * t); y = top + 6 - 10 * t
                        w = 1.6 * (1 - t) + 0.4
                        pts.append((x, y, w, t))
                    for x, y, w, t in pts:
                        for dx in np.arange(-w, w + 0.01, 0.5):
                            X, Y = fx + int(round(x + dx)), fy + int(round(y))
                            if 0 <= X - fx < 64 and 0 <= Y - fy < 64:
                                shade = 3 if dx < -w * 0.3 else 2 if dx < w * 0.4 else 1
                                a[Y, X] = list(HC[shade if t < 0.8 else 3]) + [255]
                # เส้นขอบเขา
                blk = a[fy:fy + 64, fx:fx + 64]
                mm = blk[..., 3] > 0
                p2 = np.pad(mm, 1); ring = (p2[2:, 1:-1] | p2[:-2, 1:-1] | p2[1:-1, 2:] | p2[1:-1, :-2]) & ~mm
                blk[ring] = list(OUT) + [255]
    if False:
        for fy in range(0, H, 64):
            for fx in range(0, W, 64):
                fr = m[fy:fy + 64, fx:fx + 64]
                ys = np.where(fr.any(1))[0]
                if not len(ys): continue
                top = ys[0]
                blk = a[fy + top:fy + top + 5, fx:fx + 64]
                mm = blk[..., 3] > 0
                notout = ~np.all(blk[..., :3] == OUT, -1)
                L = blk[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
                horn = np.array([(150, 110, 70), (220, 180, 120), (250, 226, 180), (255, 246, 220)])[np.clip((L / 64).astype(int), 0, 3)]
                blk[..., :3] = np.where((mm & notout)[..., None], horn, blk[..., :3])
    return a

def cape(arr):
    a = arr.copy().astype(int); m = a[..., 3] > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = m & (r > b + 20) & (g < r * 0.42)
    nr, nb = (b * 0.6).astype(int), np.minimum(255, (r * 1.45).astype(int) + 20)
    ng = np.minimum(255, (r * 0.55).astype(int))
    a[..., 0] = np.where(red, nr, r); a[..., 1] = np.where(red, ng, g); a[..., 2] = np.where(red, nb, b)
    return a.astype(np.uint8)

def blade(arr):
    a = arr.copy().astype(float); m = a[..., 3] > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    L = r * 0.299 + g * 0.587 + b * 0.114
    gray = m & (sat < 0.22)
    ramp = np.array([(14, 18, 50), (40, 70, 160), (90, 140, 235), (170, 210, 255), (240, 250, 255)], float)
    t = np.clip(L / 255 * 4, 0, 3.999); i = t.astype(int); f = (t - i)[..., None]
    col = ramp[i] * (1 - f) + ramp[np.minimum(i + 1, 4)] * f
    a[..., :3] = np.where(gray[..., None], col, a[..., :3])
    # สีน้ำตาล/ทองของด้าม → ทองสด
    warm = m & ~gray & (r > b + 30)
    gl = np.array(GOLD, float)[np.clip((L / 64).astype(int), 0, 3)]
    a[..., :3] = np.where(warm[..., None], gl, a[..., :3])
    out = a.astype(np.uint8)
    # แสงฟ้ารอบใบดาบ
    mm = out[..., 3] > 0
    p = np.pad(mm, 1); ring = (p[2:, 1:-1] | p[:-2, 1:-1] | p[1:-1, 2:] | p[1:-1, :-2]) & ~mm
    out[ring] = [90, 160, 255, 120]
    return out

def do(src, dst, fn, **kw):
    p = f"{E}/{src}.png"
    if not os.path.exists(p): return False
    Image.fromarray(fn(np.array(Image.open(p).convert("RGBA")), **kw)).save(f"{E}/{dst}.png"); return True

made = []
for sx in ("m", "f"):
    do(f"shp_plate_pauldron_{sx}", f"azure_plate_{sx}", steel); do(f"gauntlets_{sx}", f"azure_gaunt_{sx}", steel); do(f"plateboots_{sx}", f"azure_boots_{sx}", steel)
    made += [f"azure_plate_{sx}", f"azure_gaunt_{sx}", f"azure_boots_{sx}"]
do("shp_helm_horned", "azure_helm", steel, trim=False, horns=True); made.append("azure_helm")
do("cape_knight", "azure_cape", cape); do("cape_knight_back", "azure_cape_back", cape); made += ["azure_cape", "azure_cape_back"]
for suf in ("_held", "_heldb", "_atk", "_atkb"):
    do(f"greatsword{suf}", f"azure_blade{suf}", blade)
# ภาพถือ (ก่อนแบกหลัง) = ภาพ held · carry.py จะสร้างภาพแบกหลังให้
Image.open(f"{E}/azure_blade_held.png").save(f"{E}/azure_blade.png")
Image.open(f"{E}/azure_blade_heldb.png").save(f"{E}/azure_blade_back.png")
made += ["azure_blade", "azure_blade_back", "azure_blade_held", "azure_blade_heldb"]

# ---------- ไอคอน ----------
ICONS = {"azure_helm": (40, 418, 140, 530), "azure_plate": (150, 418, 275, 530), "azure_gaunt": (405, 425, 470, 530),
         "azure_boots": (480, 425, 560, 530), "azure_cape": (572, 418, 675, 530), "azure_blade": (728, 128, 820, 390)}
def cutout(im, box):
    c = np.array(im.crop(box).convert("RGB")).astype(int)
    bg = np.median(np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]]), 0)
    d = np.abs(c - bg).sum(-1)
    from scipy import ndimage
    fg = d > 40
    lab, n = ndimage.label(fg)
    if n > 1:
        sz = ndimage.sum(fg, lab, range(1, n + 1)); keep = [i + 1 for i, s in enumerate(sz) if s > 0.08 * sz.max()]
        fg = np.isin(lab, keep)
    fg = ndimage.binary_fill_holes(fg)
    rgba = np.dstack([c, fg * 255]).astype(np.uint8)
    o = Image.fromarray(rgba); return o.crop(o.getbbox())
def small(o, size=30):
    s = size / max(o.size)
    a = np.array(o).astype(float); al = a[..., 3:4] / 255
    pre = Image.fromarray(np.concatenate([a[..., :3] * al, a[..., 3:4]], 2).astype(np.uint8)).resize((max(1, round(o.width * s)), max(1, round(o.height * s))), Image.LANCZOS)
    b = np.array(pre).astype(float); B = b[..., 3:4] / 255
    rgb = np.where(B > 0, b[..., :3] / np.maximum(B, 1e-3), 0).clip(0, 255)
    res = np.concatenate([rgb, (B > 0.45) * 255.0], 2).astype(np.uint8)
    ic = Image.new("RGBA", (32, 32)); r = Image.fromarray(res); ic.alpha_composite(r, ((32 - r.width) // 2, (32 - r.height) // 2)); return ic
if len(sys.argv) > 1:
    src = Image.open(sys.argv[1])
    for k, box in ICONS.items():
        o = cutout(src, box)
        if k == "azure_blade": o = o.rotate(-45, resample=Image.NEAREST, expand=True); o = o.crop(o.getbbox())
        small(o).save(f"{A}/icons/{k}.png")

m = json.load(open(f"{A}/manifest.json"))
m["equipLazy"] = sorted(set(m.get("equipLazy", [])) | set(made))
m.setdefault("atkLazy", {})["azure_blade"] = 192
m["icons"] = sorted(set(m["icons"]) | set(ICONS))
json.dump(m, open(f"{A}/manifest.json", "w"), separators=(",", ":"))
print("ok", len(made))

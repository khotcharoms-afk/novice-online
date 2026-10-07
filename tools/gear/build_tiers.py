"""ภาพอุปกรณ์เลเวลสูง (server/tiers.js) — ย้อมสีภาพต้นแบบแบบ gradient map ตามธีมของแต่ละขั้น + เส้นเรืองแสง
usage: python3 tools/gear/build_tiers.py [tier_key ...]
ผลลัพธ์: public/assets/equip/<id>[_m|_f|_back|_atk|_atkb].png · icons/<id>.png · อัปเดต manifest (equipLazy/atkLazy/icons)"""
import os, sys, json, subprocess, colorsys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, "public", "assets")
ITEMS = json.loads(subprocess.check_output(["node", "-e", "const I=require('./server/items');console.log(JSON.stringify(Object.fromEntries(Object.entries(I.ITEMS).filter(([k])=>/^t\\d0_/.test(k)))))"], cwd=ROOT))

# ธีม: main = ไล่สีจากมืดไปสว่าง · accent = สีส่วนตกแต่ง/อัญมณี · glow = สีเรืองแสง
THEMES = {
    "glacial":    dict(main=[(10, 22, 44), (30, 80, 130), (90, 170, 220), (190, 238, 255), (255, 255, 255)], accent=[(0, 70, 110), (40, 200, 255), (220, 255, 255)], glow=(143, 227, 255)),
    "ancient":    dict(main=[(16, 24, 22), (52, 78, 72), (122, 160, 148), (200, 232, 214), (255, 250, 220)], accent=[(90, 60, 10), (230, 190, 70), (255, 245, 180)], glow=(125, 255, 200)),
    "nightshade": dict(main=[(10, 6, 20), (40, 26, 66), (92, 66, 140), (170, 130, 220), (240, 220, 255)], accent=[(40, 90, 30), (120, 230, 90), (220, 255, 190)], glow=(195, 139, 255)),
    "infernal":   dict(main=[(8, 2, 2), (34, 8, 8), (78, 18, 14), (200, 52, 18), (255, 205, 95)], accent=[(140, 20, 0), (255, 120, 20), (255, 245, 160)], glow=(255, 138, 58)),
    "dragon":     dict(main=[(36, 18, 4), (120, 70, 14), (214, 160, 50), (252, 222, 120), (255, 255, 230)], accent=[(6, 60, 34), (20, 180, 90), (170, 255, 190)], glow=(255, 211, 107)),
    "abyss":      dict(main=[(6, 2, 12), (30, 14, 46), (74, 40, 108), (170, 70, 200), (255, 170, 250)], accent=[(90, 0, 80), (255, 60, 210), (255, 220, 255)], glow=(255, 90, 216)),
}
SHP = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "shapes.json")))
GLOW = {"glacial": 1, "ancient": 1, "nightshade": 1, "infernal": 2, "dragon": 2, "abyss": 2}

def grad(stops, t):
    t = np.clip(t, 0, 1) * (len(stops) - 1)
    i = np.minimum(np.floor(t).astype(int), len(stops) - 2)
    f = (t - i)[..., None]
    S = np.array(stops, float)
    return S[i] * (1 - f) + S[i + 1] * f

def hsv(arr):
    rgb = arr[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    return h, s, v

def analyze(paths):
    """ช่วงความสว่าง + hue หลักของชิ้นต้นแบบ (รวมทุกไฟล์ของชิ้นนั้น)"""
    Ls, hs = [], []
    for p in paths:
        a = np.array(Image.open(p).convert("RGBA")).astype(float)
        m = a[..., 3] > 0
        L = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])[m]
        Ls.append(L)
        h, s, v = hsv(a)
        sel = m & (s > 0.25) & (v > 0.25)
        hs.append(h[sel])
    L = np.concatenate(Ls); H = np.concatenate(hs) if hs else np.array([])
    lo, hi = np.percentile(L, 3), np.percentile(L, 98)
    dom = None
    if H.size > 50:
        hist, edges = np.histogram(H, bins=24, range=(0, 1)); dom = (edges[hist.argmax()] + 1 / 48)
    return lo, max(hi, lo + 1), dom

def recolor(arr, theme, lo, hi, dom):
    a = arr.astype(float); m = a[..., 3] > 0
    L = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2])
    t = np.clip((L - lo) / (hi - lo), 0, 1)
    t = t * t * (3 - 2 * t) * 0.6 + t * 0.4  # เพิ่มคอนทราสต์ (เงาเข้ม ไฮไลต์สว่าง)
    h, s, v = hsv(a)
    out = a.copy()
    main = grad(theme["main"], t)
    # ส่วนตกแต่ง = สีสดที่ hue ต่างจากสีหลักของชิ้น (อัญมณี ขอบทอง ใบมีดเรืองแสง)
    if dom is None: acc = (s > 0.45) & (v > 0.35)
    else:
        dh = np.abs(((h - dom) + 0.5) % 1 - 0.5)
        acc = (s > 0.4) & (v > 0.3) & (dh > 0.09)
    accent = grad(theme["accent"], np.clip(t * 1.15, 0, 1))
    col = np.where(acc[..., None], accent, main)
    out[..., :3] = np.where(m[..., None], col, a[..., :3])
    return out.astype(np.uint8)

def glow(arr, color, rings, frame=None):
    a = arr.copy(); m = a[..., 3] > 0
    cur = m.copy()
    for i, alpha in enumerate([150, 70][:rings]):
        d = cur.copy()
        d[1:] |= cur[:-1]; d[:-1] |= cur[1:]; d[:, 1:] |= cur[:, :-1]; d[:, :-1] |= cur[:, 1:]
        if frame:  # ไม่ให้แสงข้ามขอบเฟรม
            H, W = m.shape
            for y in range(0, H, frame): d[y, :] &= cur[y, :] | (np.arange(W) < 0)
            for x in range(0, W, frame): d[:, x] &= cur[:, x]
        ring = d & ~cur
        a[ring] = list(color) + [alpha]
        cur = d
    return a

def files_of(base):
    out = []
    for suf in ("", "_m", "_f", "_back", "_atk", "_atkb"):
        p = f"{A}/equip/{base}{suf}.png"
        if os.path.exists(p): out.append((suf, p))
    return out

if __name__ == "__main__":
    want = set(sys.argv[1:])
    man = json.load(open(f"{A}/manifest.json"))
    lazy, atkl, icons = set(man.get("equipLazy", [])), dict(man.get("atkLazy", {})), set(man["icons"])
    cache = {}
    import glob
    for iid, it in ITEMS.items():
        if want and it["tier"] not in want: continue
        for f in glob.glob(f"{A}/equip/{iid}.png") + glob.glob(f"{A}/equip/{iid}_*.png"): os.remove(f)
        lazy -= {k for k in lazy if k == iid or k.startswith(iid + "_")}; atkl.pop(iid, None)
    for iid, it in ITEMS.items():
        tk = it["tier"]
        if want and tk not in want: continue
        th = THEMES[tk]; base = it["base"]; weaponish = it["slot"] in ("weapon", "offhand")
        fl = files_of(base)
        icon = f"{A}/icons/{base}.png"
        key = base
        if key not in cache: cache[key] = analyze([p for _, p in fl] + ([icon] if os.path.exists(icon) else []))
        lo, hi, dom = cache[key]
        for suf, p in fl:
            arr = np.array(Image.open(p).convert("RGBA"))
            out = recolor(arr, th, lo, hi, dom)
            if weaponish:
                fr = 64 if suf in ("", "_m", "_f", "_back") else (arr.shape[1] // 6)
                out = glow(out, th["glow"], GLOW[tk], frame=fr)
            Image.fromarray(out).save(f"{A}/equip/{iid}{suf}.png")
            if suf in ("_atk",): atkl[iid] = man["atk"].get(base) or SHP[base[4:]]["atk"]
            if suf in ("", "_m", "_f", "_back"): lazy.add(f"{iid}{suf}")
        if os.path.exists(icon):
            arr = np.array(Image.open(icon).convert("RGBA"))
            out = glow(recolor(arr, th, lo, hi, dom), th["glow"], 1)
            Image.fromarray(out).save(f"{A}/icons/{iid}.png"); icons.add(iid)
        print("ok", iid, base, len(fl))
    man["equipLazy"] = sorted(lazy); man["atkLazy"] = atkl; man["icons"] = sorted(icons)
    json.dump(man, open(f"{A}/manifest.json", "w"), separators=(",", ":"))

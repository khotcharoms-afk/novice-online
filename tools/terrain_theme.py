"""สร้างชุดภาพพื้น/สิ่งของธีมใหม่ จากชุดฤดูร้อน (summer) ด้วยการเปลี่ยนสีตามกลุ่มสี
usage: python3 tools/terrain_theme.py   → assets/terrain_<theme>.png + objects_<theme>.png/.json"""
import colorsys, json, os, shutil
from PIL import Image
A = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")

# แต่ละธีม: กลุ่มสี → (hue เป้าหมาย 0-1 หรือ None = คงเดิม, ตัวคูณ sat, ตัวคูณ val)
THEMES = {
    "swamp":  {"green": (0.19, 0.55, 0.62), "blue": (0.45, 0.75, 0.42), "brown": (0.08, 0.55, 0.55), "grey": (None, 0.6, 0.7)},
    "desert": {"green": (0.11, 0.55, 1.12), "blue": (0.48, 0.9, 1.0), "brown": (0.05, 1.15, 0.95), "grey": (0.08, 1.6, 1.05)},
    "lava":   {"green": (0.03, 0.35, 0.38), "blue": (0.06, 2.6, 1.6), "brown": (0.0, 0.9, 0.45), "grey": (0.0, 0.5, 0.45)},
    "ruins":  {"green": (0.2, 0.3, 0.72), "blue": (0.55, 0.45, 0.6), "brown": (0.09, 0.22, 0.78), "grey": (None, 0.8, 0.9)},
    "shadow": {"green": (0.76, 0.5, 0.5), "blue": (0.8, 0.8, 0.55), "brown": (0.72, 0.35, 0.5), "grey": (0.75, 1.5, 0.6)},
}

def group(h, s, v):
    if s < 0.18: return "grey"
    d = h * 360
    if 55 <= d < 175: return "green"
    if 175 <= d < 260: return "blue"
    if d < 55 or d >= 330: return "brown"
    return "grey"

def convert(src, dst, th):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    cache = {}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if not p[3]: continue
            if p in cache: px[x, y] = cache[p]; continue
            r, g, b, a = p
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            th_h, sm, vm = th[group(h, s, v)]
            if th_h is not None:
                # ย้าย hue แต่คงความต่างของ hue ภายในกลุ่มไว้นิดหน่อย
                h = (th_h + (h - round(h * 4) / 4) * 0.15) % 1
            s = min(1, s * sm); v = min(1, v * vm)
            if group(*colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)) == "blue" and th is THEMES["lava"]:
                s = min(1, max(s, 0.85)); v = min(1, max(v, 0.75))  # ลาวาเรืองแสง
            q = tuple(int(c * 255) for c in colorsys.hsv_to_rgb(h, s, v)) + (a,)
            cache[p] = q; px[x, y] = q
    im.save(dst)

for name, th in THEMES.items():
    convert(f"{A}/terrain_summer.png", f"{A}/terrain_{name}.png", th)
    convert(f"{A}/objects_summer.png", f"{A}/objects_{name}.png", th)
    j = json.load(open(f"{A}/objects_summer.json"))
    if "meta" in j and "image" in j["meta"]: j["meta"]["image"] = f"objects_{name}.png"
    json.dump(j, open(f"{A}/objects_{name}.json", "w"))
    print("ok", name)

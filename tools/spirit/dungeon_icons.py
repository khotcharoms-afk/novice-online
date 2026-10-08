"""ไอคอนของดันเจี้ยนภูติ: แก่นธาตุ (ย้อมสีจาก orb_mana) · แก่นบริสุทธิ์ (ลูกแก้ว + ประกาย + ขอบเรือง) · ตั๋วดันเจี้ยน (วาดเอง)
usage: python3 tools/spirit/dungeon_icons.py  → public/assets/icons/{core_*,pure_*,sd_ticket}.png + manifest icons"""
import json, os
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
IC = f"{ROOT}/public/assets/icons"
EL = {"fire": "#ff7a30", "water": "#4ab8ff", "ice": "#9fe8ff", "thunder": "#ffe14a", "light": "#fff3b0", "shadow": "#a060ff"}
hx = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)

def recolor(src, col):
    a = np.array(Image.open(src).convert("RGBA")).astype(float)
    rgb, al = a[..., :3], a[..., 3:]
    lum = (rgb @ [0.3, 0.59, 0.11]) / 255.0
    dark = col * 0.18; light = np.minimum(255, col * 0.55 + 255 * 0.55)
    # เงา→สีธาตุเข้ม · กลาง→สีธาตุ · สว่าง→เกือบขาว
    t = np.clip(lum * 1.35, 0, 1)[..., None]
    out = np.where(t < 0.5, dark + (col - dark) * (t / 0.5), col + (light - col) * ((t - 0.5) / 0.5))
    outline = (lum < 0.12)[..., None]  # เส้นขอบดำคงเดิม
    out = np.where(outline, rgb, out)
    return np.concatenate([np.clip(out, 0, 255), al], -1).astype(np.uint8)

def glow(arr, col, a=110):
    al = arr[..., 3] > 0
    g = np.zeros_like(al)
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
        g |= np.roll(np.roll(al, dy, 0), dx, 1)
    g &= ~al
    out = arr.copy()
    out[g, :3] = col.astype(np.uint8); out[g, 3] = a
    return out

man = json.load(open(f"{ROOT}/public/assets/manifest.json"))
icons = set(man["icons"])
for el, h in EL.items():
    c = hx(h)
    core = recolor(f"{IC}/orb_mana.png", c)
    Image.fromarray(core).save(f"{IC}/core_{el}.png"); icons.add(f"core_{el}")
    pure = recolor(f"{IC}/orb_mana.png", c)
    pure = glow(glow(pure, c, 200), c, 90)  # ขอบเรือง 2 ชั้น
    for (x, y) in [(25, 3), (25, 4), (25, 5), (25, 6), (25, 7), (23, 5), (24, 5), (26, 5), (27, 5), (5, 25), (5, 26), (4, 26), (6, 26), (5, 27)]:  # ประกายขาว
        pure[y, x] = [255, 255, 255, 255]
    Image.fromarray(pure).save(f"{IC}/pure_{el}.png"); icons.add(f"pure_{el}")

# ตั๋ว: กระดาษสีครีม ขอบทอง รอยฉีกครึ่ง วงวนสีม่วงกลางตั๋ว
t = np.zeros((32, 32, 4), np.uint8)
for y in range(8, 25):
    for x in range(3, 29):
        notch = (x in (3, 28)) and y in (15, 16, 17)
        if notch: continue
        edge = y in (8, 24) or x in (3, 28) or (x in (4, 27) and y in (14, 18))
        t[y, x] = (90, 62, 20, 255) if edge else (244, 226, 180, 255)
for y in range(10, 23, 2): t[y, 21] = (176, 140, 80, 255)  # เส้นปรุ
cx, cy = 12.5, 16
for y in range(9, 24):
    for x in range(5, 21):
        d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        if d < 5.6:
            ang = np.arctan2(y - cy, x - cx)
            s = (ang + d * 0.9) % (2 * np.pi)
            t[y, x] = (120, 70, 210, 255) if s < np.pi else (190, 150, 255, 255)
        elif d < 6.4: t[y, x] = (70, 40, 130, 255)
for x, y in [(24, 11), (25, 13), (24, 19), (25, 21)]: t[y, x] = (110, 80, 200, 255)
Image.fromarray(t).save(f"{IC}/sd_ticket.png"); icons.add("sd_ticket")
man["icons"] = sorted(icons)
json.dump(man, open(f"{ROOT}/public/assets/manifest.json", "w"), separators=(",", ":"))
print("ok")

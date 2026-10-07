# อาวุธทางเลือก (ย้อมสีจากของเดิม): ค้อน/มีดสั้น/ขวาน สำหรับ build ใหม่
from lpc import *
import json
EQ = OUR + "/equip"; ICO = OUR + "/icons"
import colorsys
def metal_tint(im, hue, sat, val):
    """ย้อมเฉพาะส่วนโลหะ (พิกเซลสีเทา) · ด้ามไม้คงเดิม"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s_, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s_ < 0.28:
                r2, g2, b2 = colorsys.hsv_to_rgb(hue, sat, min(1, v * val))
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im
NEW = {  # id: (ต้นแบบ, hue, sat, val) — ย้อมเฉพาะโลหะ
    "warhammer": ("mace", 0.12, 0.55, 1.05), "judgehammer": ("mace", 0.15, 0.15, 1.25), "priest_mace": ("mace", 0.11, 0.75, 1.15),
    "assassin_dagger": ("dagger", 0.0, 0.0, 0.5), "shadow_kris": ("dagger", 0.78, 0.6, 0.95), "battleaxe": ("waraxe", 0.58, 0.25, 1.05),
}
m = json.load(open(f"{OUR}/manifest.json"))
for nid, (src, h, sa, v) in NEW.items():
    for suf in ("", "_back", "_atk", "_atkb"):
        try: im = Image.open(f"{EQ}/{src}{suf}.png").convert("RGBA")
        except FileNotFoundError: continue
        metal_tint(im, h, sa, v).save(f"{EQ}/{nid}{suf}.png")
    metal_tint(Image.open(f"{ICO}/{src}.png").convert("RGBA"), h, sa, v).save(f"{ICO}/{nid}.png")
    if src in m.get("atk", {}): m["atk"][nid] = m["atk"][src]
import os
m["equip"] = sorted(f[:-4] for f in os.listdir(EQ) if f.endswith(".png") and not f.endswith(("_atk.png", "_atkb.png")))
m["icons"] = sorted(f[:-4] for f in os.listdir(ICO) if f.endswith(".png"))
json.dump(m, open(f"{OUR}/manifest.json", "w"), ensure_ascii=False)
im = Image.new("RGBA", (6 * 34, 34), (40, 40, 60, 255))
for i, k in enumerate(NEW): im.alpha_composite(Image.open(f"{ICO}/{k}.png").convert("RGBA"), (i * 34 + 1, 1))
im.resize((im.width * 3, 102), Image.NEAREST).save("/tmp/claude-0/alt.png")
print(m["atk"])

"""พรีวิวตัวละครใส่ชุดเต็ม: python3 tools/gear/preview.py out.png job sex "slot:id,slot:id" [...]"""
import sys, os, json
from PIL import Image
A = "public/assets"
man = json.load(open(f"{A}/manifest.json")); EQ = set(man["equip"]) | set(man.get("equipLazy", []))
AFTER = {"head", "weapon", "offhand"}
def layers(job, sex, gear):
    items = [g.split(":") for g in gear.split(",") if g]
    pick = lambda b: f"equip/{b}_{sex}" if f"{b}_{sex}" in EQ else (f"equip/{b}" if b in EQ else None)
    back = [pick(f"{i}_back") for _, i in items]
    pre = [pick(i) for s, i in items if s not in AFTER]
    post = [pick(i) for s, i in items if s in AFTER]
    hair = "hair_spiked_black" if sex == "m" else "hair_ponytail_black"
    return [x for x in back + [f"look/base_{sex}_light", f"look/outfit_{job}_{sex}"] + pre + [f"look/{hair}"] + post if x]
out = sys.argv[1]; specs = sys.argv[2:]
cells = []
for spec in specs:
    job, sex, gear = spec.split("/")
    im = Image.new("RGBA", (576, 1344))
    for l in layers(job, sex, gear): im.alpha_composite(Image.open(f"{A}/{l}.png").convert("RGBA").crop((0, 0, 576, 1344)))
    for (c, r) in [(0, 2), (2, 1), (0, 3), (0, 0)]:
        cells.append(im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)))
W = 4 * 64
sheet = Image.new("RGBA", (W * 2 * len(specs) // len(specs) * 1, 1), (0, 0, 0, 0))
cols = 4; rows = len(specs)
sheet = Image.new("RGBA", (cols * 64, rows * 64), (60, 90, 70, 255))
for i, c in enumerate(cells): sheet.alpha_composite(c, ((i % cols) * 64, (i // cols) * 64))
sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(out)

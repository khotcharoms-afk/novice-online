import sys
from PIL import Image
names, out = sys.argv[2:], sys.argv[1]
o = Image.new("RGBA", (64 * 4 * len(names), 64 * 2 * 2), (70, 100, 70, 255))
for i, n in enumerate(names):
    im = Image.open(f"public/assets/mobs/{n}.png").convert("RGBA")
    for j, (c, r) in enumerate([(0, 2), (0, 1), (2, 4 + 2), (4, 8)]):  # หน้า, ซ้าย, ฟัน, ตาย
        fr = im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64)).resize((128, 128), Image.NEAREST)
        o.alpha_composite(fr, (i * 256 + (j % 2) * 128, (j // 2) * 128))
o.save(out)

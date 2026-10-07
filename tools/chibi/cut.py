"""ตัดภาพ chibi 4 ทิศ (หน้า ซ้าย ขวา หลัง เรียงในแถวเดียว พื้นขาว) → spritesheet 4 เฟรม พื้นใส
usage: python3 cut.py src.png out.png [target_h=150]"""
import sys
from collections import deque
from PIL import Image
import numpy as np

src, out = sys.argv[1], sys.argv[2]
TH = int(sys.argv[3]) if len(sys.argv) > 3 else 150
im = np.array(Image.open(src).convert("RGB")).astype(int)
H, W, _ = im.shape
# พื้นหลัง = สีใกล้ขาวที่ต่อเนื่องจากขอบภาพ (ไฮไลต์ขาวในตัวละครจะไม่หาย)
near = (im.min(axis=2) > 228) & ((im.max(axis=2) - im.min(axis=2)) < 22)
bg = np.zeros((H, W), bool)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))
alpha = np.where(bg, 0, 255).astype(np.uint8)
# ขอบนุ่ม: พิกเซลติดพื้นหลังที่สว่าง → โปร่งครึ่ง
rgba = np.dstack([im.astype(np.uint8), alpha])
img = Image.fromarray(rgba, "RGBA")

# แยก 4 ตัวตามแถบคอลัมน์ที่ว่าง
colfill = (~bg).sum(axis=0) > 0
segs, inside = [], False
for x in range(W):
    if colfill[x] and not inside: s = x; inside = True
    elif not colfill[x] and inside:
        if x - s > 40: segs.append((s, x))
        inside = False
if inside: segs.append((s, W))
# รวมชิ้นที่ใกล้กันจนเหลือ 4
while len(segs) > 4:
    gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
    i = gaps.index(min(gaps)); segs[i:i + 2] = [(segs[i][0], segs[i + 1][1])]
assert len(segs) == 4, segs
frames = []
for x0, x1 in segs:
    m = ~bg[:, x0:x1]
    ys = np.where(m.any(axis=1))[0]; y0, y1 = ys[0], ys[-1] + 1
    # แกนกลางลำตัว = กึ่งกลางของหัว (30% บน) — ดาบที่ยื่นออกข้างไม่ทำให้ตัวเบี้ยว
    head = m[y0:y0 + int((y1 - y0) * 0.3)]
    hx = np.where(head.any(axis=0))[0]; cx = x0 + (hx[0] + hx[-1]) / 2
    frames.append((x0, x1, y0, y1, cx))
hmax = max(f[3] - f[2] for f in frames)
sc = TH / hmax
half = max(max(f[4] - f[0], f[1] - f[4]) for f in frames)
FW = int(np.ceil(half * sc)) * 2 + 4
FH = TH + 4
sheet = Image.new("RGBA", (FW * 4, FH), (0, 0, 0, 0))
for i, (x0, x1, y0, y1, cx) in enumerate(frames):
    c = img.crop((x0, y0, x1, y1))
    c = c.resize((max(1, round((x1 - x0) * sc)), max(1, round((y1 - y0) * sc))), Image.LANCZOS)
    px = i * FW + FW // 2 - round((cx - x0) * sc)
    py = FH - 2 - c.size[1]  # เท้าชิดล่าง
    sheet.alpha_composite(c, (px, py))
sheet.save(out)
print(out, sheet.size, "frame", FW, FH)

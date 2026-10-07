import numpy as np, glob, os, json, sys
from PIL import Image
ROOT = "/home/claude/lpc/gen/spritesheets"
OUR = "/home/claude/novice-online/public/assets"
def walk_of(path):
    im = Image.open(path).convert("RGBA")
    if im.size != (576, 256): return None
    return np.array(im)
cands = []
for f in glob.glob(ROOT + "/**/walk.png", recursive=True) + glob.glob(ROOT + "/**/walk/*.png", recursive=True):
    a = walk_of(f)
    if a is not None: cands.append((f, a[..., 3] > 0))
print("candidates", len(cands), file=sys.stderr)
targets = sorted(glob.glob(OUR + "/equip/*.png") + glob.glob(OUR + "/look/*.png"))
targets = [t for t in targets if not t.endswith(("_atk.png", "_atkb.png"))]
res = {}
for t in targets:
    a = np.array(Image.open(t).convert("RGBA"))[:256]
    m = a[..., 3] > 0
    if m.sum() == 0: res[os.path.relpath(t, OUR)] = None; continue
    best = (0, None)
    for f, cm in cands:
        inter = (m & cm).sum(); uni = (m | cm).sum()
        iou = inter / uni if uni else 0
        if iou > best[0]: best = (iou, f)
    res[os.path.relpath(t, OUR)] = [round(best[0], 3), os.path.relpath(best[1], ROOT) if best[1] else None]
    print(os.path.relpath(t, OUR), res[os.path.relpath(t, OUR)], file=sys.stderr)
json.dump(res, open("/tmp/claude-0/match.json", "w"), indent=1, ensure_ascii=False)

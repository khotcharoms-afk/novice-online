# เพิ่มท่า "ยิงธนู" (แถว 13–16) และ "แทง/ชี้คทา" (แถว 17–20) ให้ภาพตัวละคร/ชุด/ผม/อุปกรณ์ทุกชิ้น
# วิธี: หาภาพต้นฉบับ LPC ที่ตรงกับภาพเดิม (จากรูปร่างท่าเดิน) → เรียนรู้การย้อมสีจากท่าเดิน → ใช้กับท่ายิง/แทงของต้นฉบับ
import numpy as np, glob, os, json, sys
from PIL import Image
ROOT = "/home/claude/lpc/gen/spritesheets"; OUR = "/home/claude/novice-online/public/assets"
SHOOT_PICK = [0, 2, 3, 4, 5, 6, 8, 9, 11]   # 9 เฟรมจาก 13
THRUST_PICK = [0, 1, 2, 3, 4, 5, 6, 7]
match = json.load(open("/tmp/claude-0/match.json"))
cache = {}
def load(p):
    if p not in cache: cache[p] = np.array(Image.open(p).convert("RGBA"))
    return cache[p]
def sib(walk_path, anim):
    d, f = os.path.split(walk_path)
    if f == "walk.png": return os.path.join(d, anim + ".png")
    if os.path.basename(d) == "walk": return os.path.join(os.path.dirname(d), anim, f)
    return None
cands = None
def all_cands():
    global cands
    if cands is None:
        cands = []
        for f in glob.glob(ROOT + "/**/walk.png", recursive=True) + glob.glob(ROOT + "/**/walk/*.png", recursive=True):
            if "/weapon/" in f or "/shield/" in f: continue
            a = load(f)
            if a.shape[:2] == (256, 576): cands.append((f, a[..., 3] > 0))
    return cands
def greedy(m):
    rem = m.copy(); chosen = []
    for _ in range(6):
        best = (0, None, None)
        for f, cm in all_cands():
            gain = (cm & rem).sum() - 4 * (cm & ~m).sum()
            if gain > best[0]: best = (gain, f, cm)
        if best[0] < 30: break
        chosen.append(best[1]); rem &= ~best[2]
    return chosen
RANK = ["/body/", "/head/", "/eyes/", "/legs/", "/feet/socks", "/feet/", "/torso/", "/arms/", "/cape/", "/hair/", "/facial/", "/hat/"]
rank = lambda p: next((i for i, k in enumerate(RANK) if k in p), 5)
def recipe(rel, tgt):
    mm = match.get(rel)
    m = tgt[:256, :, 3] > 0
    if mm and mm[0] >= 0.95: return [os.path.join(ROOT, mm[1])]
    return sorted(greedy(m), key=rank)
def colormap(tgt, srcs):
    """เรียนรู้สี: สีต้นฉบับ → สีในภาพเรา (ดูจากพิกเซลที่ต้นฉบับชิ้นนั้นอยู่บนสุด)"""
    T = tgt[:256]
    top = np.full((256, 576), -1)
    for i, s in enumerate(srcs):
        top[load(s)[..., 3] > 0] = i
    maps = []
    for i, s in enumerate(srcs):
        S = load(s); mk = (top == i) & (T[..., 3] > 0)
        d = {}
        sc = S[mk][:, :3]; tc = T[mk][:, :3]
        for a, b in zip(map(tuple, sc), map(tuple, tc)):
            d.setdefault(a, {}); d[a][b] = d[a].get(b, 0) + 1
        maps.append({a: max(v, key=v.get) for a, v in d.items()})
    return maps
def apply(arr, cmap):
    out = arr.copy()
    if not cmap: return out
    keys = np.array(list(cmap.keys())); vals = np.array(list(cmap.values()))
    op = out[..., 3] > 0
    px = out[op][:, :3].astype(int)
    # สีที่ไม่เคยเห็น → ใช้สีที่ใกล้ที่สุด
    dist = ((px[:, None, :] - keys[None, :, :]) ** 2).sum(-1)
    out_rgb = vals[dist.argmin(1)]
    sub = out[op]; sub[:, :3] = out_rgb; out[op] = sub
    return out
def frames(arr, pick, nrows=4):
    o = np.zeros((nrows * 64, 576, 4), np.uint8)
    for r in range(nrows):
        for c, sc in enumerate(pick):
            if (sc + 1) * 64 <= arr.shape[1] and (r + 1) * 64 <= arr.shape[0]:
                o[r * 64:(r + 1) * 64, c * 64:(c + 1) * 64] = arr[r * 64:(r + 1) * 64, sc * 64:(sc + 1) * 64]
    return o
def comp(layers):
    im = Image.new("RGBA", (576, layers[0].shape[0]))
    for l in layers: im.alpha_composite(Image.fromarray(l))
    return np.array(im)
def extend(rel, extra_shoot=None, extra_thrust=None):
    path = os.path.join(OUR, rel)
    tgt = np.array(Image.open(path).convert("RGBA"))[:832]
    srcs = recipe(rel, tgt)
    maps = colormap(tgt, srcs)
    rows = {}
    for anim, pick in (("shoot", SHOOT_PICK), ("thrust", THRUST_PICK)):
        ls = []
        for s, cm in zip(srcs, maps):
            p = sib(s, anim)
            if p and os.path.exists(p): ls.append(apply(frames(load(p), pick), cm))
        rows[anim] = comp(ls) if ls else np.zeros((256, 576, 4), np.uint8)
    out = np.concatenate([tgt, rows["shoot"], rows["thrust"]], 0)
    Image.fromarray(out).save(path)
    return [os.path.relpath(s, ROOT) for s in srcs]
if __name__ == "__main__":
    done = {}
    for rel in sorted(match):
        if rel.startswith("equip/book_"): continue
        done[rel] = extend(rel)
        print(rel, done[rel], flush=True)
    json.dump(done, open("/tmp/claude-0/recipes.json", "w"), indent=1)

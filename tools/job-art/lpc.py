import os, glob
from PIL import Image
ROOT = "/home/claude/lpc/gen/spritesheets"
OUR = "/home/claude/novice-online/public/assets"
# our format: rows 0-3 walk(9), 4-7 slash(6), 8 hurt(6), 9-12 cast(7)
ROWS = {"walk": (0, 4, 9), "slash": (4, 4, 6), "hurt": (8, 1, 6), "spellcast": (9, 4, 7)}

def find(base, anim, color=None):
    """locate anim png under base dir: base/anim.png or base/anim/color.png"""
    cands = []
    if color: cands.append(f"{base}/{anim}/{color}.png")
    cands.append(f"{base}/{anim}.png")
    for c in cands:
        p = os.path.join(ROOT, c)
        if os.path.isfile(p): return p
    return None

def frames_of(path, fs=None):
    im = Image.open(path).convert("RGBA")
    if fs is None: fs = 128 if im.height in (512, 128) and im.height != 64 * 2 else 64
    return im, fs

def put(sheet, path, anim, pick=None, fs=None, rowmap=None, dy=0):
    """paste anim from path into sheet. pick = list of source frame idx for each dest col. fs = source frame size"""
    if not path: return
    im = Image.open(path).convert("RGBA")
    r0, nrows, ncols = ROWS[anim]
    if fs is None:
        fs = 64
        if im.height == nrows * 128 or (anim == "hurt" and im.height == 128): fs = 128
    srows = im.height // fs
    for r in range(nrows):
        sr = rowmap[r] if rowmap else (r if srows > 1 else 0)
        for c in range(ncols):
            sc = pick[c] if pick else c
            if (sc + 1) * fs > im.width: continue
            fr = im.crop((sc * fs, sr * fs, (sc + 1) * fs, (sr + 1) * fs))
            if fs != 64:
                o = (fs - 64) // 2
                fr = fr.crop((o, o + dy, o + 64, o + 64 + dy))
            sheet.alpha_composite(fr, (c * 64, (r0 + r) * 64))

def blank(): return Image.new("RGBA", (576, 832), (0, 0, 0, 0))

def std(base, color=None, anims=("walk", "slash", "hurt", "spellcast")):
    s = blank()
    for a in anims: put(s, find(base, a, color), a)
    return s

def preview(layers, out, scale=1, bg=(70, 100, 70, 255)):
    im = Image.new("RGBA", (576, 832), bg)
    for l in layers:
        if isinstance(l, str): l = Image.open(l if l.startswith("/") else f"{OUR}/{l}.png").convert("RGBA")
        im.alpha_composite(l)
    if scale != 1: im = im.resize((576 * scale, 832 * scale), Image.NEAREST)
    im.save(out)

import json
PAL = {}
def pal(material):
    if material not in PAL:
        PAL[material] = json.load(open(f"/home/claude/lpc/gen/palette_definitions/{material}/{material}_ulpc.json"))
    return PAL[material]
def hx(c): c = c.lstrip("#"); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def recolor(img, maps):
    """maps = list of (material, base, target)"""
    table = {}
    for mat, base, tgt in maps:
        src, dst = pal(mat)[base], pal(mat)[tgt]
        for a, b in zip(src, dst): table[hx(a)] = hx(b)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            for (sr, sg, sb), d in table.items():
                if abs(sr - r) <= 1 and abs(sg - g) <= 1 and abs(sb - b) <= 1:
                    px[x, y] = d + (a,); break
    return img

def tint_hsv(img, hue_shift=0.0, sat=1.0, val=1.0):
    import colorsys
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h = (h + hue_shift) % 1; s = min(1, s * sat); v = min(1, v * val)
            r, g, b = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return img

SEXDIR = {"m": "male", "f": "female"}
def layer(dirs, sex, color=None, maps=None, anims=("walk", "slash", "hurt", "spellcast")):
    d = dirs[sex] if isinstance(dirs, dict) else dirs
    s = std(d, color, anims)
    if maps: recolor(s, maps)
    return s

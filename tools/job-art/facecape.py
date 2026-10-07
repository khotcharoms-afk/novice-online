# ผ้าคลุมและของหน้าแบบใหม่ (ภาพ 21 แถว: เดิน/ฟัน/เจ็บ/ร่าย + ยิงธนู + แทง)
from lpc import *
import extend as E, numpy as np, os, json
EQ = OUR + "/equip"; ICO = OUR + "/icons"
cl = lambda t: [("cloth", "white", t)]
def full(base, color=None, maps=None):
    s = std(base, color)
    s = np.array(s)
    rows = []
    for anim, pick in (("shoot", E.SHOOT_PICK), ("thrust", E.THRUST_PICK)):
        p = find(base, anim, color)
        rows.append(E.frames(np.array(Image.open(p).convert("RGBA")), pick) if p else np.zeros((256, 576, 4), np.uint8))
    im = Image.fromarray(np.concatenate([s, *rows], 0)).copy()
    if maps: recolor(im, maps)
    return im
def over(a, b): a = a.copy(); a.alpha_composite(b); return a
OUT = {}
# ---------- ของหน้า ----------
OUT["eyepatch"] = full("facial/patches/eyepatch/left/adult")
OUT["mask_ninja"] = full("facial/masks/plain", "dark")
OUT["monocle_gold"] = full("facial/monocle/left/adult")
OUT["shades_hawk"] = full("facial/glasses/shades/adult")
OUT["round_sage"] = full("facial/glasses/round/adult")
# ---------- ผ้าคลุม (หน้าตัว fg + หลังตัว bg) ----------
def cape(kind, color, trim=None):
    fg = full(f"cape/{kind}/fg", maps=cl(color)); bg = full(f"cape/{kind}/bg", maps=cl(color))
    if trim: fg = over(fg, full("cape/trim", maps=[("cloth", "brown", trim)]))
    return fg, bg
for nid, args in {"cape_red": ("solid", "red"), "cape_blue": ("solid", "navy"), "cape_green": ("solid", "forest"), "cape_white": ("solid", "white"),
                  "cape_knight": ("solid", "maroon", "yellow"), "cape_shadow": ("tattered", "black"), "cape_royal": ("solid", "purple", "yellow")}.items():
    fg, bg = cape(*args)
    OUT[nid] = fg; OUT[nid + "_back"] = bg
for k, im in OUT.items(): im.save(f"{EQ}/{k}.png")
# ---------- ไอคอน ----------
def icon(id, layers, row, col):
    fr = Image.new("RGBA", (64, 64))
    for l in layers: fr.alpha_composite(l.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64)))
    bb = fr.getbbox(); fr = fr.crop(bb); w, h = fr.size; side = max(w, h)
    sq = Image.new("RGBA", (side, side)); sq.alpha_composite(fr, ((side - w) // 2, (side - h) // 2))
    n = max(1, 30 // side); sq = sq.resize((side * n, side * n), Image.NEAREST) if n > 1 else sq.resize((30, 30), Image.NEAREST)
    o = Image.new("RGBA", (32, 32)); o.alpha_composite(sq, ((32 - sq.width) // 2, (32 - sq.height) // 2)); o.save(f"{ICO}/{id}.png")
for k in ("eyepatch", "mask_ninja", "monocle_gold", "shades_hawk", "round_sage"): icon(k, [OUT[k]], 2, 0)
for k in ("cape_red", "cape_blue", "cape_green", "cape_white", "cape_knight", "cape_shadow", "cape_royal"): icon(k, [OUT[k + "_back"], OUT[k]], 0, 0)
prev = Image.new("RGBA", (12 * 34, 34), (40, 40, 60, 255))
for i, k in enumerate(["eyepatch", "mask_ninja", "monocle_gold", "shades_hawk", "round_sage", "cape_red", "cape_blue", "cape_green", "cape_white", "cape_knight", "cape_shadow", "cape_royal"]):
    prev.alpha_composite(Image.open(f"{ICO}/{k}.png"), (i * 34 + 1, 1))
prev.resize((prev.width * 3, 102), Image.NEAREST).save("/tmp/claude-0/fc_icons.png")
# ภาพตัวอย่างบนตัวละคร (หน้า/หลัง)
base = [Image.open(f"{OUR}/look/{n}.png").convert("RGBA") for n in ("base_m_light", "outfit_hunter_m", "hair_plain_black")]
pv = Image.new("RGBA", (12 * 64, 128), (70, 100, 70, 255))
for i, k in enumerate(["eyepatch", "mask_ninja", "monocle_gold", "shades_hawk", "round_sage", "cape_red", "cape_blue", "cape_green", "cape_white", "cape_knight", "cape_shadow", "cape_royal"]):
    ls = ([OUT[k + "_back"]] if k + "_back" in OUT else []) + base[:2] + ([OUT[k]] if k.startswith("cape") else []) + [base[2]] + ([] if k.startswith("cape") else [OUT[k]])
    for j, r in enumerate((2, 0)):
        fr = Image.new("RGBA", (64, 64))
        for l in ls: fr.alpha_composite(l.crop((0, r * 64, 64, r * 64 + 64)))
        pv.alpha_composite(fr, (i * 64, j * 64))
pv.resize((pv.width * 2, 256), Image.NEAREST).save("/tmp/claude-0/fc_prev.png")
print("ok")

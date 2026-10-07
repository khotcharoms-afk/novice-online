import extend as E, numpy as np, os, json
from PIL import Image
R = E.ROOT
done = {}
for rel in sorted(E.match):
    if rel.startswith("equip/book_") or "/bow_" in rel or "outfit_" in rel: continue
    done[rel] = E.extend(rel)
# ชุดพื้นฐานอาชีพ (รู้สูตรแน่นอน)
OUT = {"guardian": ("longsleeve", "shoes/basic"), "slayer": ("sleeveless", "boots/fold"), "hunter": ("longsleeve", "boots/fold"), "mage": ("longsleeve", "slippers"), "healer": ("longsleeve", "slippers")}
orig = E.recipe
for job, (shirt, feet) in OUT.items():
    for sex, td, fd in (("m", "male", "male"), ("f", "thin", "female")):
        torso = f"{R}/torso/clothes/{shirt}/{shirt}/{fd}/walk.png"
        if not os.path.exists(torso): torso = f"{R}/torso/clothes/sleeveless/sleeveless/{fd}/walk/maroon.png"
        srcs = [f"{R}/legs/pants/{td}/walk.png", f"{R}/feet/{feet}/{td}/walk.png", torso]
        E.recipe = lambda r, t, s=srcs: s
        done[f"look/outfit_{job}_{sex}.png"] = E.extend(f"look/outfit_{job}_{sex}.png")
E.recipe = orig
done["look/outfit_villager_m.png"] = E.extend("look/outfit_villager_m.png")
done["look/outfit_villager_f.png"] = E.extend("look/outfit_villager_f.png")
# ธนู: ท่ายิงจากต้นฉบับ
for nid, kind, col in (("bow_hunter", "normal", "medium"), ("bow_shadow", "recurve", "dark")):
    for suf, layer in (("", "foreground"), ("_back", "background")):
        path = f"{E.OUR}/equip/{nid}{suf}.png"
        tgt = np.array(Image.open(path).convert("RGBA"))[:832]
        sh = E.frames(E.load(f"{R}/weapon/ranged/bow/{kind}/universal/{layer}/shoot/{col}.png"), E.SHOOT_PICK)
        Image.fromarray(np.concatenate([tgt, sh, np.zeros((256, 576, 4), np.uint8)], 0)).save(path)
# หนังสือลอย: ท่ายิง = ลอยเหมือนตอนเดิน · ท่าแทง = เหมือนตอนร่าย (ยกขึ้นเรืองแสง)
for nid in ("book_light", "book_holy"):
    for suf in ("", "_back"):
        path = f"{E.OUR}/equip/{nid}{suf}.png"
        t = np.array(Image.open(path).convert("RGBA"))[:832]
        sh = t[0:256].copy()
        th = np.zeros((256, 576, 4), np.uint8)
        for r in range(4):
            for c in range(8):
                sc = min(c, 6)
                th[r * 64:(r + 1) * 64, c * 64:(c + 1) * 64] = t[(9 + r) * 64:(10 + r) * 64, sc * 64:(sc + 1) * 64]
        Image.fromarray(np.concatenate([t, sh, th], 0)).save(path)
json.dump(done, open("/tmp/claude-0/recipes.json", "w"), indent=1)
print("ok", len(done))

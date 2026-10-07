from lpc import *
def W128(base, color, anims=("walk","hurt")):
    s = blank()
    for a in anims:
        p = find(base, a, color)
        if p: put(s, p, a)  # auto-detect 128
    return s
def simple(path_by_anim):
    s = blank()
    for a, p in path_by_anim.items():
        if p: put(s, ROOT + "/" + p if not p.startswith("/") else p, a)
    return s
R = ROOT + "/"
out = {}
# swords (front + back)
for nid, d, col in [("saber", "weapon/sword/saber", "saber"), ("moonblade", "weapon/sword/glowsword", "blue"), ("greatsword", "weapon/sword/longsword", "longsword")]:
    out[nid] = std(d, col, ("walk", "hurt"))
    out[nid + "_back"] = std(d + "/universal_behind", col, ("walk", "hurt"))
# bows
for nid, kind, col in [("bow_hunter", "normal", "medium"), ("bow_shadow", "recurve", "dark")]:
    b = f"weapon/ranged/bow/{kind}"
    fg = blank(); bg = blank()
    put(fg, find(b + "/walk/foreground", "", col) or R + f"{b}/walk/foreground/{col}.png", "walk", fs=128)
    put(bg, R + f"{b}/walk/background/{col}.png", "walk", fs=128)
    put(fg, find(b + "/universal/foreground", "hurt", col), "hurt"); put(bg, find(b + "/universal/background", "hurt", col), "hurt")
    out[nid] = fg; out[nid + "_back"] = bg
# staffs
out["staff_oak"] = std("weapon/magic/simple/foreground", "simple", ("walk", "spellcast", "hurt"))
out["staff_oak_back"] = std("weapon/magic/simple/background", "simple", ("walk", "spellcast", "hurt"))
out["staff_crystal"] = std("weapon/magic/crystal/universal/foreground", "purple", ("walk", "hurt"))
out["staff_crystal_back"] = std("weapon/magic/crystal/universal/background", "purple", ("walk", "hurt"))
# shields
for sex, sd in (("m", "male"), ("f", "female")):
    out[f"shield_knight_{sex}"] = std(f"shield/crusader/fg/{sd}", "crusader", ("walk", "slash", "hurt", "spellcast"))
out["shield_knight_back"] = std("shield/crusader/bg", "crusader", ("walk", "slash", "hurt", "spellcast"))
out["shield_spartan"] = std("shield/spartan/fg", "spartan", ("walk", "slash", "hurt", "spellcast"))
out["shield_spartan_back"] = std("shield/spartan/bg", "spartan", ("walk", "slash", "hurt", "spellcast"))

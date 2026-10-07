from lpc import *
L = lambda n: Image.open(f"{OUR}/{n}.png").convert("RGBA")
def comp(layers, out):
    s = blank()
    for l in layers: s.alpha_composite(l if isinstance(l, Image.Image) else L(l))
    s.save(f"{OUR}/{out}.png"); return s
comp([L("look/base_f_light"), layer("legs/pants/thin", "f", maps=[("cloth","white","tan")]), layer("torso/clothes/robe/female", "f", color="forest_green"), "look/hair_bunches_chestnut"], "npc_potion")
comp(["equip/greatsword_back", "look/base_m_bronze", "look/outfit_slayer_m", "equip/bracers_m", "look/hair_messy1_black", "equip/greatsword"], "npc_weapon")
comp(["equip/shield_knight_back", "look/base_m_light", "look/outfit_guardian_m", "equip/plateboots_m", "equip/plate_m", "equip/gauntlets_m", "look/hair_plain_dark_brown", "equip/shield_knight_m"], "npc_armor")
im = Image.new("RGBA", (64 * 3, 64), (70, 100, 70, 255))
for i, n in enumerate(["npc_potion", "npc_weapon", "npc_armor"]): im.alpha_composite(L(n).crop((0, 128, 64, 192)), (i * 64, 0))
im.resize((576, 192), Image.NEAREST).save("/tmp/claude-0/npcs.png")

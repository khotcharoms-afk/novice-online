"""ไอคอนวัตถุดิบของมอนรูปร่างไม่ใช่คน"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from materials import orb, eye, flower, leaf, tinted, I
from PIL import Image, ImageDraw
def spore(col):
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    for x, y, r in ((24, 28, 11), (40, 24, 8), (38, 42, 10), (22, 44, 7)):
        d.ellipse((x - r - 2, y - r - 2, x + r + 2, y + r + 2), fill=(20, 14, 20, 255)); d.ellipse((x - r, y - r, x + r, y + r), fill=col + (255,))
        d.ellipse((x - r / 2 - 1, y - r / 2 - 1, x - r / 2 + 2, y - r / 2 + 2), fill=(255, 255, 255, 220))
    return im.resize((32, 32), Image.LANCZOS)
ICONS = {
    "slime_gel": lambda: orb((60, 160, 60), (190, 255, 170)), "ice_gel": lambda: orb((70, 150, 210), (220, 250, 255)),
    "venom_gel": lambda: orb((100, 40, 150), (220, 160, 255)), "lava_gel": lambda: orb((200, 60, 10), (255, 220, 110)),
    "abyss_gel": lambda: orb((50, 10, 70), (255, 90, 220)),
    "red_spore": lambda: spore((210, 60, 50)), "glow_spore": lambda: spore((90, 190, 240)),
    "bat_fang": lambda: tinted("wolf_fang", (0.05, 0.4, 1.1)), "vamp_fang": lambda: tinted("wolf_fang", (-0.05, 1.5, 0.8)),
    "drake_wing": lambda: tinted("bat_wing", (0.35, 1.3, 1.1)),
    "ectoplasm": lambda: orb((150, 190, 220), (240, 255, 255)), "dark_ecto": lambda: orb((80, 50, 120), (240, 120, 230)),
    "abyss_ecto": lambda: orb((40, 15, 60), (255, 70, 180)),
    "golem_core": lambda: orb((40, 110, 160), (160, 240, 255)), "magma_core": lambda: orb((140, 30, 0), (255, 170, 40)),
    "sand_core": lambda: orb((20, 120, 110), (120, 255, 220)),
    "frost_essence": lambda: orb((90, 170, 240), (255, 255, 255)), "fire_essence": lambda: orb((230, 90, 10), (255, 250, 170)),
    "bog_silk": lambda: tinted("wool", (0.2, 0.6, 0.9)), "sand_silk": lambda: tinted("wool", (0.05, 0.8, 1.0)),
    "maneater_petal": lambda: flower((210, 50, 70)), "cursed_petal": lambda: flower((140, 50, 180)),
    "floating_eye": lambda: eye((60, 170, 90)), "abyss_eye": lambda: eye((230, 50, 200)),
}
if __name__ == "__main__":
    for k, f in ICONS.items(): f().save(f"{I}/{k}.png")
    print(len(ICONS))

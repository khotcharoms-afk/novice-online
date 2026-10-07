"""ของดรอปโซนเลเวลสูง: ไอคอนย้อมสีจากไอคอนวัตถุดิบเดิม + ยาขวดใหญ่
usage: python3 tools/mobs/materials.py  → public/assets/icons/<id>.png และพิมพ์รายการไอเทมสำหรับ items.js"""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "job-art"))
import lpc
from PIL import Image
I = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "icons")
# id: (ชื่อ, ไอคอนต้นแบบ, (hue shift, sat, val), มอนที่ดรอป)
MATS = {
    "giant_fur":     ("ขนยักษ์น้ำแข็ง", "frost_hide", (0.05, 0.6, 1.15), "frostgiant"),
    "wraith_veil":   ("ผ้าคลุมภูตหิมะ", "rotten_cloth", (0.5, 0.3, 1.5), "snowwraith"),
    "ice_fang":      ("เขี้ยวหมาป่าน้ำแข็ง", "wolf_fang", (0.55, 0.6, 1.1), "icewolfman"),
    "cyclops_eye":   ("ดวงตาไซคลอปส์", "pumpkin", (0.5, 1.2, 1.0), "frostcyclops"),
    "bog_moss":      ("ตะไคร่บึงเน่า", "rotten_cloth", (0.25, 1.4, 0.7), "bogzombie"),
    "venom_scale":   ("เกล็ดพิษ", "lizard_scale", (0.45, 1.3, 0.9), "venomlizard"),
    "bog_tusk":      ("งาหมูบึง", "boar_tusk", (0.15, 1.0, 0.75), "bogboar"),
    "witch_herb":    ("สมุนไพรแม่มด", "pumpkin", (0.2, 1.0, 0.8), "swampwitch"),
    "knight_crest":  ("ตราอัศวินโบราณ", "orc_scrap", (0.0, 0.3, 1.2), "skelknight"),
    "stitch_flesh":  ("เศษเนื้อเย็บติด", "troll_hide", (0.2, 0.8, 0.9), "frankenstein"),
    "stone_wing":    ("ปีกหินการ์กอยล์", "bat_wing", (0.0, 0.1, 1.2), "gargoyle"),
    "lich_dust":     ("ผงวิญญาณลิช", "wool", (0.75, 2.5, 0.85), "lich"),
    "cursed_fang":   ("เขี้ยวต้องสาป", "wolf_fang", (0.75, 1.5, 0.8), "cursedwolf"),
    "war_horn_mat":  ("เขาวอร์ทอร์", "bull_horn", (0.0, 0.5, 0.6), "wartotaur"),
    "dryad_petal":   ("กลีบดอกต้องสาป", "pumpkin", (0.8, 1.1, 1.0), "dryad"),
    "vamp_blood":    ("เลือดแวมไพร์", "pumpkin", (-0.08, 1.4, 0.75), "vamplord"),
    "ember_scale":   ("เกล็ดถ่านแดง", "lizard_scale", (-0.25, 1.5, 1.05), "salamander"),
    "molten_scrap":  ("เศษเกราะหลอมเหลว", "orc_scrap", (0.05, 2.0, 1.1), "flameorc"),
    "demon_horn":    ("เขาปีศาจ", "bull_horn", (-0.05, 1.6, 0.9), "firedemon"),
    "lava_core":     ("แกนลาวา", "pumpkin", (0.0, 1.4, 1.1), "lavataur"),
    "mummy_wrap":    ("ผ้าพันมัมมี่", "rotten_cloth", (0.05, 0.6, 1.3), "mummy"),
    "sand_tail":     ("หางหนูทะเลทราย", "rat_tail", (0.05, 0.8, 1.2), "sandrat"),
    "spirit_sand":   ("ทรายวิญญาณ", "wool", (0.1, 2.5, 1.0), "sandspirit"),
    "warlord_seal":  ("ตราขุนศึก", "orc_scrap", (0.1, 1.8, 1.2), "sandwarlord"),
    "drake_scale":   ("เกล็ดมังกรน้อย", "lizard_scale", (0.0, 1.2, 1.1), "draconian"),
    "wyvern_wing":   ("ปีกไวเวิร์น", "bat_wing", (0.6, 1.4, 1.0), "wyvern"),
    "dragon_crest":  ("ตราอัศวินมังกร", "orc_scrap", (0.12, 1.8, 1.25), "dragonknight"),
    "magma_heart":   ("หัวใจแมกมา", "pumpkin", (-0.03, 1.6, 0.9), "volcanogiant"),
    "death_plate":   ("เศษเกราะมรณะ", "orc_scrap", (0.7, 0.6, 0.55), "deathknight"),
    "shadow_feather":("ขนนกเงา", "bat_wing", (0.7, 0.8, 0.55), "shadowdemon"),
    "dark_eye":      ("ดวงตาทมิฬ", "pumpkin", (0.75, 1.3, 0.6), "darkcyclops"),
    "abyss_shard":   ("เศษคริสตัลอเวจี", "stone_3", (0.05, 1.4, 0.8), "abysslord"),
}
POTIONS = {"potion_l": ("potion_m", (0.0, 1.0, 0.9)), "potion_xl": ("potion_m", (-0.04, 1.2, 0.7)), "potion_sp_l": ("potion_sp", (0.05, 1.2, 0.8))}

def tinted(src, hsv, scale_big=False):
    im = Image.open(f"{I}/{src}.png").convert("RGBA")
    return lpc.tint_hsv(im, *hsv)

if __name__ == "__main__":
    for k, (name, src, hsv, mob) in MATS.items(): tinted(src, hsv).save(f"{I}/{k}.png")
    for k, (src, hsv) in POTIONS.items(): tinted(src, hsv).save(f"{I}/{k}.png")
    json.dump({k: [v[0], v[3]] for k, v in MATS.items()}, open("/tmp/mats.json", "w"), ensure_ascii=False)
    print(len(MATS), "materials")

# ---------- ไอคอนวาดเอง (แทนตัวที่ย้อมจากฟักทองแล้วดูแปลก) ----------
from PIL import ImageDraw
def _canvas(): return Image.new("RGBA", (64, 64), (0, 0, 0, 0))
def _done(im): return im.resize((32, 32), Image.LANCZOS)
def orb(col, glow):
    im = _canvas(); d = ImageDraw.Draw(im)
    d.ellipse((10, 10, 54, 54), fill=(20, 12, 20, 255))
    for i in range(20):
        t = i / 20; c = tuple(int(col[k] * (1 - t) + glow[k] * t) for k in range(3)) + (255,)
        r = 21 - i; d.ellipse((32 - r - 2 + i // 3, 32 - r - 2 + i // 3, 32 + r - 2 + i // 3, 32 + r - 2 + i // 3), fill=c)
    d.ellipse((20, 18, 28, 26), fill=(255, 255, 255, 200))
    return _done(im)
def eye(iris):
    im = _canvas(); d = ImageDraw.Draw(im)
    d.ellipse((8, 8, 56, 56), fill=(25, 15, 20, 255)); d.ellipse((11, 11, 53, 53), fill=(238, 232, 225, 255))
    d.ellipse((20, 20, 44, 44), fill=iris + (255,)); d.ellipse((27, 27, 37, 37), fill=(10, 5, 10, 255))
    d.ellipse((24, 22, 29, 27), fill=(255, 255, 255, 230))
    for a, b in ((14, 30), (12, 38), (50, 34)): d.line((a, b, a + 6, b + 2), fill=(200, 60, 60, 255), width=2)
    return _done(im)
def leaf(col):
    im = _canvas(); d = ImageDraw.Draw(im)
    d.polygon([(12, 52), (20, 22), (44, 10), (52, 16), (44, 40), (18, 54)], fill=(15, 30, 10, 255))
    d.polygon([(15, 49), (22, 24), (43, 13), (49, 17), (42, 38), (19, 51)], fill=col + (255,))
    d.line((14, 52, 46, 16), fill=tuple(min(255, c + 60) for c in col) + (255,), width=2)
    return _done(im)
def flower(col):
    im = _canvas(); d = ImageDraw.Draw(im)
    import math
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2; x, y = 32 + math.cos(a) * 13, 32 + math.sin(a) * 13
        d.ellipse((x - 12, y - 12, x + 12, y + 12), fill=(30, 10, 25, 255))
    for k in range(5):
        a = k * 2 * math.pi / 5 - math.pi / 2; x, y = 32 + math.cos(a) * 13, 32 + math.sin(a) * 13
        d.ellipse((x - 10, y - 10, x + 10, y + 10), fill=col + (255,))
    d.ellipse((25, 25, 39, 39), fill=(250, 220, 90, 255))
    return _done(im)
DRAWN = {"cyclops_eye": lambda: eye((60, 130, 220)), "dark_eye": lambda: eye((150, 40, 200)),
         "lava_core": lambda: orb((200, 40, 10), (255, 220, 80)), "magma_heart": lambda: orb((120, 10, 10), (255, 120, 30)),
         "witch_herb": lambda: leaf((70, 140, 50)), "dryad_petal": lambda: flower((200, 80, 190)),
         "vamp_blood": lambda: lpc.tint_hsv(Image.open(f"{I}/potion_m.png").convert("RGBA"), -0.02, 1.3, 0.55)}
if __name__ == "__main__":
    for k, f in DRAWN.items(): f().save(f"{I}/{k}.png")

# ท่าฟันของอาวุธประชิด (เฟรมใหญ่ 128/192 px) → equip/<id>_atk.png (หน้าตัว) และ <id>_atkb.png (หลังตัว)
from lpc import *
import json
W = ROOT + "/weapon/"
SRC = {
    "mace": ("blunt/mace/attack_slash/mace.png", "blunt/mace/attack_slash/behind/mace.png"),
    "waraxe": ("blunt/waraxe/attack_slash/waraxe.png", "blunt/waraxe/attack_slash/behind/waraxe.png"),
    "sword": ("sword/arming/attack_slash/fg/iron.png", "sword/arming/attack_slash/bg/iron.png"),
    "saber": ("sword/saber/attack_slash/saber.png", "sword/saber/attack_slash/behind/saber.png"),
    "moonblade": ("sword/glowsword/attack_slash/blue.png", "sword/glowsword/attack_slash/behind/blue.png"),
    "greatsword": ("sword/longsword/attack_slash/longsword.png", "sword/longsword/attack_slash/behind/longsword.png"),
}
sizes = {}
for id, (fg, bg) in SRC.items():
    for path, suf in ((fg, "_atk"), (bg, "_atkb")):
        im = Image.open(W + path).convert("RGBA")
        im.save(f"{OUR}/equip/{id}{suf}.png")
    sizes[id] = Image.open(W + fg).width // 6
# ขวานยักษ์ = ขวานศึกย้อมสี (เหมือนตอนเดิน)
for suf in ("_atk", "_atkb"):
    tint_hsv(Image.open(f"{OUR}/equip/waraxe{suf}.png").convert("RGBA"), hue_shift=-0.05, sat=1.6, val=0.85).save(f"{OUR}/equip/titanaxe{suf}.png")
sizes["titanaxe"] = sizes["waraxe"]
# มีดสั้น: เฟรม 64 ปกติ → ใส่ในแถวฟันของภาพเดิมได้เลย
for path, out in (("sword/dagger/slash/dagger.png", "dagger"), ("sword/dagger/behind/slash/dagger.png", "dagger_back")):
    s = Image.open(f"{OUR}/equip/{out}.png").convert("RGBA")
    s.paste(Image.new("RGBA", (576, 256)), (0, 256))
    put(s, W + path, "slash")
    s.save(f"{OUR}/equip/{out}.png")
m = json.load(open(f"{OUR}/manifest.json")); m["atk"] = sizes
json.dump(m, open(f"{OUR}/manifest.json", "w"), ensure_ascii=False)
print(sizes)

# ไอคอนสกิล: ภาพสัญลักษณ์จาก game-icons.net (CC BY 3.0) → PNG สีขาวพื้นใส (สีพื้นวาดใน CSS ตามสีสกิล)
import cairosvg, io, re
from PIL import Image, ImageFilter
G = "/home/claude/gameicons/"; OUT = "/home/claude/novice-online/public/assets/icons/"
MAP = {
    "basic": "lorc/muscle-up", "firstaid": "delapouite/arm-bandage", "doublehit": "lorc/sword-clash",
    "swordmastery": "lorc/broadsword", "ironbody": "delapouite/heart-armor", "shieldbash": "delapouite/shield-bash",
    "provoke": "lorc/shouting", "shieldwall": "lorc/checked-shield",
    "gsmastery": "delapouite/axe-sword", "cleave": "lorc/sword-spin", "fury": "delapouite/enrage", "execute": "lorc/bloody-sword", "bloodlust": "lorc/bleeding-heart",
    "bowmastery": "delapouite/bow-arrow", "doubleshot": "lorc/double-shot", "hawkeye": "delapouite/hunter-eyes", "arrowrain": "lorc/arrow-cluster", "swiftstep": "lorc/sprint",
    "staffmastery": "lorc/wizard-staff", "meditation": "lorc/meditation", "firebolt": "lorc/fireball", "frostnova": "lorc/frozen-orb", "meteor": "lorc/meteor-impact",
    "faith": "lorc/prayer", "heal": "delapouite/healing", "holylight": "lorc/sunbeams", "bless": "lorc/angel-wings",
}
for k, src in MAP.items():
    svg = open(G + src + ".svg").read()
    svg = svg.replace('<path d="M0 0h512v512H0z"/>', "")          # เอาพื้นดำออก
    svg = re.sub(r'fill="#fff"', 'fill="#fff8e6"', svg)
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=56, output_height=56)
    g = Image.open(io.BytesIO(png)).convert("RGBA")
    # เงาดำรอบ ๆ ให้เห็นชัดบนพื้นสี
    sh = Image.new("RGBA", g.size, (0, 0, 0, 0)); sh.putalpha(g.getchannel("A").filter(ImageFilter.MaxFilter(3)).point(lambda a: min(255, a)))
    out = Image.new("RGBA", (64, 64)); out.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", g.size, (20, 12, 30)).split(), sh.getchannel("A"))), (5, 6))
    out.alpha_composite(g, (4, 4))
    out.save(f"{OUT}skill_{k}.png")
print(len(MAP))

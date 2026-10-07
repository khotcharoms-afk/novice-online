# ไอคอนสกิลอาชีพขั้น 2: ภาพจาก game-icons.net (CC BY 3.0) → PNG สีขาวพื้นใส แบบเดียวกับ skillicons.py
import cairosvg, io, re, sys
from PIL import Image, ImageFilter
G = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/gi/"; OUT = "/home/claude/novice-online/public/assets/icons/"
MAP = {
    "guardaura": "lorc/aura", "holysword": "delapouite/sword-brandish", "divineshield": "delapouite/cross-shield", "masstaunt": "delapouite/angry-eyes",
    "bloodblade": "lorc/sword-wound", "thornarmor": "lorc/thorn-helix", "weakencurse": "lorc/cursed-star", "darkwill": "lorc/cold-heart",
    "whirlwind": "lorc/tornado", "leapstrike": "delapouite/jump-across", "bloodboil": "lorc/bleeding-wound", "frenzy": "lorc/skull-crack",
    "iaido": "lorc/sword-slice", "thousandcuts": "lorc/blade-fall", "bladefocus": "lorc/focused-lightning", "shadowslash": "lorc/piercing-sword",
    "piercing": "lorc/heavy-arrow", "stuntrap": "lorc/trap-mask", "hawk": "lorc/hawk-emblem", "thunderarrow": "lorc/lightning-bow",
    "backstab": "lorc/backstab", "stealth": "lorc/cloak-dagger", "poisonblade": "lorc/poison-bottle", "bladefan": "lorc/spinning-blades",
    "blizzard": "lorc/snowing", "lightning": "lorc/lightning-arc", "manashield": "lorc/magic-shield", "blink": "lorc/teleport",
    "summonfire": "lorc/fire-silhouette", "doomcurse": "delapouite/devil-mask", "souldrain": "delapouite/soul", "blackhole": "lorc/vortex",
    "massheal": "delapouite/healing-shield", "resurrect": "lorc/angel-outfit", "sanctuary": "lorc/holy-symbol", "judgment": "lorc/hammer-drop",
    "holyfist": "lorc/fulguro-punch", "heavenhammer": "delapouite/thor-hammer", "hasteaura": "delapouite/speedometer", "regenaura": "sbed/regeneration",
}
if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "list":
    print(" ".join(f"{v}.svg" for v in MAP.values())); sys.exit()
for k, src in MAP.items():
    svg = open(G + src + ".svg").read()
    svg = svg.replace('<path d="M0 0h512v512H0z"/>', "")
    svg = re.sub(r'fill="#fff"', 'fill="#fff8e6"', svg)
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=56, output_height=56)
    g = Image.open(io.BytesIO(png)).convert("RGBA")
    sh = Image.new("RGBA", g.size, (0, 0, 0, 0)); sh.putalpha(g.getchannel("A").filter(ImageFilter.MaxFilter(3)))
    out = Image.new("RGBA", (64, 64)); out.alpha_composite(Image.merge("RGBA", (*Image.new("RGB", g.size, (20, 12, 30)).split(), sh.getchannel("A"))), (5, 6))
    out.alpha_composite(g, (4, 4))
    out.save(f"{OUT}skill_{k}.png")
print(len(MAP))

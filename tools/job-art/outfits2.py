# ชุดอาชีพขั้น 2: ย้อมชุดของอาชีพขั้น 1 ให้เป็นโทนสีของอาชีพใหม่ (ส่วนที่มีสี → เปลี่ยน hue · ความสว่างปรับตามธีม)
import json, subprocess, colorsys, os
import numpy as np
from PIL import Image
ROOT = "/home/claude/novice-online"; L = f"{ROOT}/public/assets/look"
JOBS = json.loads(subprocess.check_output(["node", "-e", "const D=require('./server/data');console.log(JSON.stringify(Object.fromEntries(Object.entries(D.JOBS).filter(([k,j])=>j.tier===2).map(([k,j])=>[k,{base:j.base,color:j.color}]))))"], cwd=ROOT, stderr=subprocess.DEVNULL))
# ความสว่าง/ความสดของแต่ละอาชีพ (ทมิฬ = มืด, นักบุญ = สว่าง)
TONE = {"darkknight": (0.62, 1.1), "assassin": (0.7, 0.9), "paladin": (1.12, 0.8), "saint": (1.18, 0.55), "summoner": (0.9, 1.0)}
def recolor(a, hexc, tone):
    rgb = a[..., :3] / 255.0; m = a[..., 3] > 0
    mx, mn = rgb.max(-1), rgb.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    th, _, ts = colorsys.rgb_to_hsv(*[int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    vk, sk = tone
    out = a.copy().astype(float)
    sel = m & (s > 0.18)
    for y, x in zip(*np.nonzero(sel)):
        r, g, b = rgb[y, x]; h, sv, v = colorsys.rgb_to_hsv(r, g, b)
        nr, ng, nb = colorsys.hsv_to_rgb(th, min(1, max(0.25, (sv * 0.5 + ts * 0.5) * sk)), min(1, v * vk))
        out[y, x, :3] = [nr * 255, ng * 255, nb * 255]
    # ส่วนสีเทา (โลหะ/ผ้าขาว) ปรับความสว่างตามธีมเล็กน้อย
    gray = m & ~sel
    out[gray, :3] = np.clip(out[gray, :3] * (1 + (vk - 1) * 0.6), 0, 255)
    return out.astype(np.uint8)
for job, j in JOBS.items():
    for sx in ("m", "f"):
        src = f"{L}/outfit_{j['base']}_{sx}.png"
        a = np.array(Image.open(src).convert("RGBA"))
        Image.fromarray(recolor(a, j["color"], TONE.get(job, (1.0, 1.0)))).save(f"{L}/outfit_{job}_{sx}.png")
    print(job)

"""ดาบใหญ่ (wt greatsword) แบกไว้บนหลังตอนเดิน/ยืน/ร่ายสกิล — ตอนฟันใช้ภาพท่าฟัน (_atk) เหมือนเดิม
แก้ไฟล์ equip/<id>.png และ <id>_back.png ของไอเทมนั้นโดยตรง (ทำซ้ำได้ เพราะเก็บภาพถือดาบต้นฉบับไว้ที่ <id>_held*.png)
usage: python3 tools/gear/carry.py [id ...]   (ไม่ใส่ = ทุกไอเทม wt greatsword ที่มีภาพ)"""
import os, sys, json, subprocess, math
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
A = os.path.join(ROOT, "public", "assets")
DIR_ROW = {"up": 0, "left": 1, "down": 2, "right": 3}

def body_bob():
    """ความสูงหัวของตัวละครแต่ละเฟรม (เทียบเฟรมยืน) → ดาบขยับตามจังหวะเดิน"""
    im = np.array(Image.open(f"{A}/look/base_m_light.png").convert("RGBA"))[..., 3] > 0
    bob = {}
    for row in list(range(0, 4)) + list(range(9, 13)):
        tops = []
        for c in range(9):
            fr = im[row * 64:(row + 1) * 64, c * 64:(c + 1) * 64]
            ys = np.where(fr.any(1))[0]
            tops.append(ys[0] if len(ys) else 0)
        bob[row] = [t - tops[0] for t in tops]
    return bob

def axis_info(img):
    """มุมของแกนยาว (องศา) และทิศที่ปลายกว้างอยู่ — ใช้หมุนครั้งเดียวจากภาพต้นฉบับ (ภาพพิกเซลไม่แตก)"""
    arr = np.array(img); m = arr[..., 3] >= 200
    ys, xs = np.nonzero(m)
    pts = np.stack([xs, ys], 1).astype(float); c = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - c, full_matrices=False)
    ax = vt[0]; proj = (pts - c) @ ax; L = proj.max() - proj.min()
    wide_hi = ((proj > proj.max() - L / 4).sum()) > ((proj < proj.min() + L / 4).sum())
    if not wide_hi: ax = -ax          # ax ชี้จากปลายแคบ → ปลายกว้าง
    return math.degrees(math.atan2(ax[1], ax[0])), L

def weapon_src(iid, front, back):
    best = None   # เฟรมเดินที่เห็นอาวุธเต็มที่สุด (ภาพบนตัวจริง สเกลเดียวกับตัวละคร)
    for row in range(4):
        for col in (0, 1, 4):
            fr = Image.alpha_composite(back.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64)), front.crop((col * 64, row * 64, col * 64 + 64, row * 64 + 64)))
            n = (np.array(fr)[..., 3] >= 200).sum()
            if not best or n > best[0]: best = (n, fr)
    arr = np.array(best[1]); arr[arr[..., 3] < 200] = 0
    im = Image.fromarray(arr); return im.crop(im.getbbox())

def add_grip(src, ang, L, gc=None):
    """เติมด้ามจับ + ปุ่มท้ายต่อจากกระบัง (ภาพถือดาบเดิมไม่มีด้าม เพราะมือบังไว้)"""
    pad = 12
    big = Image.new("RGBA", (src.width + pad * 2, src.height + pad * 2)); big.alpha_composite(src, (pad, pad))
    arr = np.array(big); m = arr[..., 3] >= 200
    ys, xs = np.nonzero(m)
    d = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])   # ชี้จากปลายแคบ → ปลายกว้าง (กระบัง)
    proj = np.stack([xs, ys], 1) @ d
    tip_i = proj.argmax()
    # จุดกระบังด้านนอกสุด: เฉลี่ยพิกเซลที่อยู่ปลายสุดฝั่งกว้าง
    sel = proj > proj.max() - 1.5
    gx, gy = xs[sel].mean(), ys[sel].mean()
    nrm = np.array([-d[1], d[0]])
    grip, gripd = (92, 58, 38), (58, 36, 24)
    pom = tuple(int(gc[i:i + 2], 16) for i in (1, 3, 5)) if gc else (210, 175, 80)
    for k in range(1, 8):                     # ด้ามยาว 7 px กว้าง 2 px ลายพัน
        for w, col in ((-0.5, grip if k % 2 else gripd), (0.5, gripd)):
            x, y = gx + d[0] * k + nrm[0] * w, gy + d[1] * k + nrm[1] * w
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < arr.shape[0] and 0 <= xi < arr.shape[1]: arr[yi, xi] = list(col) + [255]
    for w in (-1, 0, 1):                      # ปุ่มท้าย
        for k in (8, 9):
            x, y = gx + d[0] * k + nrm[0] * w * 0.8, gy + d[1] * k + nrm[1] * w * 0.8
            xi, yi = int(round(x)), int(round(y))
            if 0 <= yi < arr.shape[0] and 0 <= xi < arr.shape[1]: arr[yi, xi] = list(pom) + [255]
    out = Image.fromarray(arr); return out.crop(out.getbbox())

def render(src, ang, tilt):
    """หมุนครั้งเดียว: ปลายกว้าง (ด้าม/หัวง้าว) ชี้ขึ้น แล้วเอียง tilt องศา (บวก = ปลายบนเอนไปขวา)"""
    # ต้องการให้แกน (แคบ→กว้าง) ชี้ขึ้น = -90° แล้วเอียง tilt → มุมเป้าหมาย = -90 + tilt
    rot = src.rotate(-((-90 + tilt) - ang), resample=Image.NEAREST, expand=True)
    return rot.crop(rot.getbbox())

def place(sheet, w, row, col, x, y):
    sheet.alpha_composite(w, (col * 64 + int(round(x)), row * 64 + int(round(y))))

def carry(iid):
    held_f, held_b = f"{A}/equip/{iid}_held.png", f"{A}/equip/{iid}_heldb.png"
    src_f, src_b = f"{A}/equip/{iid}.png", f"{A}/equip/{iid}_back.png"
    if not os.path.exists(held_f):  # เก็บต้นฉบับไว้ครั้งแรก
        Image.open(src_f).save(held_f)
        if os.path.exists(src_b): Image.open(src_b).save(held_b)
    front = Image.open(held_f).convert("RGBA")
    back = Image.open(held_b).convert("RGBA") if os.path.exists(held_b) else Image.new("RGBA", front.size)
    src = weapon_src(iid, front, back)
    ang, L = axis_info(src)
    if L > 46: src = src.resize((max(1, round(src.width * 46 / L)), max(1, round(src.height * 46 / L))), Image.NEAREST); ang, L = axis_info(src)
    if ITEMS[iid].get("base", iid) == "greatsword" or iid == "greatsword":   # ดาบ (ไม่ใช่ง้าว) → เติมด้ามจับ
        src = add_grip(src, ang, L, ITEMS[iid].get("glowColor"))
        prev = ang; ang, L = axis_info(src)
        if math.cos(math.radians(ang - prev)) < 0: ang += 180   # คงทิศเดิม: ด้าม/กระบังชี้ขึ้น
    diag_dn, diag_mir = render(src, ang, 38), render(src, ang, -38)
    steep, steep_mir = render(src, ang, 22), render(src, ang, -22)
    gc = ITEMS[iid].get("glowColor")
    if gc:
        def glow1(W):
            arr = np.array(W); m = arr[..., 3] > 0
            pad = np.pad(m, 1); d = pad[2:, 1:-1] | pad[:-2, 1:-1] | pad[1:-1, 2:] | pad[1:-1, :-2]
            arr[d & ~m] = [int(gc[i:i + 2], 16) for i in (1, 3, 5)] + [140]; return Image.fromarray(arr)
        diag_dn, diag_mir, steep, steep_mir = map(glow1, (diag_dn, diag_mir, steep, steep_mir))
    W = src
    H = front.height
    nf, nb = Image.new("RGBA", (576, H)), Image.new("RGBA", (576, H))
    # แถวตาย (8) ใช้ภาพถือดาบเดิม
    nf.paste(front.crop((0, 8 * 64, 576, 9 * 64)), (0, 8 * 64)); nb.paste(back.crop((0, 8 * 64, 576, 9 * 64)), (0, 8 * 64))
    bob = BOB
    for row in list(range(0, 4)) + list(range(9, 13)):
        d = row % 4 if row < 4 else (row - 9) % 4
        dname = ["up", "left", "down", "right"][d]
        for col in range(9 if row < 4 else 7):
            dy = bob[row][col]
            if dname == "down":   # หันหน้า: ดาบอยู่หลังตัว เห็นด้ามเหนือไหล่ขวา (ซ้ายจอ) ปลายใบโผล่ล่างขวา
                img = diag_mir; place(nb, img, row, col, 11, 15 + dy)
            elif dname == "up":   # หันหลัง: เห็นดาบพาดหลังเต็ม ๆ
                img = diag_dn; place(nf, img, row, col, 52 - img.width, 17 + dy)
            elif dname == "left": # หันซ้าย: หลังอยู่ทางขวาจอ
                img = steep; place(nb, img, row, col, 36, 13 + dy)
            else:                 # หันขวา: หลังอยู่ทางซ้ายจอ
                img = steep_mir; place(nb, img, row, col, 28 - img.width, 13 + dy)
    nf.save(src_f); nb.save(src_b)
    return W.size

BOB = None
ITEMS = json.loads(subprocess.check_output(["node", "-e", "const I=require('./server/items');console.log(JSON.stringify(I.ITEMS))"], cwd=ROOT))
if __name__ == "__main__":
    BOB = body_bob()
    ids = sys.argv[1:]
    if not ids:
        items = json.loads(subprocess.check_output(["node", "-e", "const I=require('./server/items');console.log(JSON.stringify(Object.entries(I.ITEMS).filter(([k,i])=>i.wt==='greatsword'&&i.visual).map(([k])=>k)))"], cwd=ROOT))
        ids = [i for i in items if os.path.exists(f"{A}/equip/{i}.png")]
    for i in ids: print(i, carry(i))

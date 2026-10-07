"""ภาพอุปกรณ์ประจำอาชีพขั้น 2 (server/classgear.js) — ย้อมสีภาพต้นแบบตามธีมของอาชีพ · ขั้นสูงขึ้นสีเข้ม/สว่างขึ้น + แสงหนาขึ้น
usage: python3 tools/gear/build_class.py [job ...]
ผลลัพธ์: public/assets/equip/<id>[_m|_f|_back|_atk|_atkb].png · icons/<id>.png · อัปเดต manifest (equipLazy/atkLazy/icons)"""
import os, sys, json, subprocess, glob
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_tiers import recolor, glow, analyze, files_of, A, ROOT, SHP

data = json.loads(subprocess.check_output(["node", "-e", """
const I=require('./server/items'),CG=require('./server/classgear');
console.log(JSON.stringify({items:Object.fromEntries(Object.entries(I.ITEMS).filter(([k])=>/^c\\d0_/.test(k))),classes:CG.CLASSES}))"""], cwd=ROOT))
ITEMS, CLASSES = data["items"], data["classes"]

hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def mix(c, d, t): return tuple(round(a * (1 - t) + b * t) for a, b in zip(c, d))

def theme(job, lv):
    C = CLASSES[job]
    main = [hx(c) for c in C["main"]]; acc = [hx(c) for c in C["accent"]]
    if lv == 50:   # ขั้นแรก: สีหม่นลงนิด
        main = [mix(c, (sum(c) // 3,) * 3, 0.25) for c in main]
    elif lv == 90:  # ขั้นสุดท้าย: สว่างและสดขึ้น
        main = [main[0], mix(main[1], main[2], 0.25), mix(main[2], main[3], 0.25), main[3], main[4]]
        acc = [acc[0], mix(acc[1], (255, 255, 255), 0.15), acc[2]]
    return dict(main=main, accent=acc, glow=hx(C["glow"]))

if __name__ == "__main__":
    want = set(sys.argv[1:])
    man = json.load(open(f"{A}/manifest.json"))
    lazy, atkl, icons = set(man.get("equipLazy", [])), dict(man.get("atkLazy", {})), set(man["icons"])
    cache = {}
    for iid, it in ITEMS.items():
        job, lv = it["cls"], it["lv"]
        if want and job not in want: continue
        for f in glob.glob(f"{A}/equip/{iid}.png") + glob.glob(f"{A}/equip/{iid}_*.png"): os.remove(f)
        lazy -= {k for k in lazy if k == iid or k.startswith(iid + "_")}; atkl.pop(iid, None)
        th = theme(job, lv); base = it["base"]; weaponish = it["slot"] in ("weapon", "offhand")
        rings = 1 if lv == 50 else 2
        fl = files_of(base)
        icon = f"{A}/icons/{base}.png"
        if base not in cache: cache[base] = analyze([p for _, p in fl] + ([icon] if os.path.exists(icon) else []))
        lo, hi, dom = cache[base]
        for suf, p in fl:
            arr = np.array(Image.open(p).convert("RGBA"))
            out = recolor(arr, th, lo, hi, dom)
            if weaponish or (lv == 90 and it["slot"] in ("head", "cape")):
                fr = 64 if suf in ("", "_m", "_f", "_back") else (arr.shape[1] // 6)
                out = glow(out, th["glow"], rings if weaponish else 1, frame=fr)
            Image.fromarray(out).save(f"{A}/equip/{iid}{suf}.png")
            if suf == "_atk":
                a = man["atk"].get(base) or (SHP.get(base[4:], {}) or {}).get("atk") or man["atkLazy"].get(base)
                if a: atkl[iid] = a
            if suf in ("", "_m", "_f", "_back"): lazy.add(f"{iid}{suf}")
        if os.path.exists(icon):
            arr = np.array(Image.open(icon).convert("RGBA"))
            out = recolor(arr, th, lo, hi, dom)
            out = glow(out, th["glow"], 1)
            Image.fromarray(out).save(f"{A}/icons/{iid}.png"); icons.add(iid)
        else: print("!! no icon", iid, base)
        print("ok", iid, base, len(fl))
    man["equipLazy"] = sorted(lazy); man["atkLazy"] = atkl; man["icons"] = sorted(icons)
    json.dump(man, open(f"{A}/manifest.json", "w"), separators=(",", ":"))
    subprocess.check_call(["python3", os.path.join(ROOT, "tools", "gear", "carry.py")], cwd=ROOT)

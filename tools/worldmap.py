# สร้างภาพแผนที่โลก (assets/worldmap.png) จากชุดภาพ LPC ที่ใช้ในเกม — รันใหม่เมื่อเพิ่ม/ย้ายแผนที่
import json, math, random, os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageChops

# วิธีใช้: python3 tools/worldmap.py  (ต้องมี Pillow) — อ่านตำแหน่งแผนที่จาก server/maps.js
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'public', 'assets') + '/'
Z = json.loads(subprocess.check_output(['node', '-e', "const W=require('./server/maps');console.log(JSON.stringify(Object.entries(W.MAPS).map(([id,m])=>({id,season:m.season,type:m.type,world:m.world,exits:Object.values(m.exits),dead:(m.style||{}).dead||0}))))"], cwd=ROOT))
W, H = 1920, 1280          # วาดใหญ่แล้วย่อครึ่ง
random.seed(7)
T = 32

def tile(season, c, r):
    return Image.open(A + f'terrain_{season}.png').convert('RGBA').crop((c * T, r * T, c * T + T, r * T + T))

def texture(season, tiles):
    im = Image.new('RGBA', (W, H))
    ts = [tile(season, c, r) for c, r in tiles]
    for y in range(0, H, T):
        for x in range(0, W, T):
            im.paste(ts[(x * 7 + y * 13 + (x // T) * (y // T)) % len(ts)], (x, y))
    return im

GRASS = [(3, 2), (4, 2), (5, 2), (3, 1), (4, 1), (5, 1)]
zones = [dict(z, px=z['world']['x'] / 100 * W, py=z['world']['y'] / 100 * H) for z in Z]

# ---- noise สำหรับขอบโซนให้เป็นธรรมชาติ ----
def vnoise(scale, seed):
    rnd = random.Random(seed)
    gw, gh = W // scale + 2, H // scale + 2
    g = Image.new('L', (gw, gh))
    g.putdata([rnd.randint(0, 255) for _ in range(gw * gh)])
    return g.resize((W + scale * 2, H + scale * 2), Image.BICUBIC).crop((0, 0, W, H))
n1, n2 = vnoise(160, 1), vnoise(70, 2)

# ---- หาโซนที่ใกล้สุดของแต่ละพิกเซล (ทำทีละ 8px แล้วขยาย) ----
S = 8
gw, gh = W // S, H // S
owner = Image.new('L', (gw, gh))
land = Image.new('L', (gw, gh))
od, ld = [], []
n1s, n2s = n1.resize((gw, gh)), n2.resize((gw, gh))
for gy in range(gh):
    for gx in range(gw):
        x, y = gx * S + S / 2, gy * S + S / 2
        jx = (n1s.getpixel((gx, gy)) - 128) * 0.9 + (n2s.getpixel((gx, gy)) - 128) * 0.35
        jy = (n2s.getpixel((gx, gy)) - 128) * 0.9 - (n1s.getpixel((gx, gy)) - 128) * 0.3
        best, bd = 0, 1e9
        for i, z in enumerate(zones):
            d = math.hypot(x + jx - z['px'], (y + jy - z['py']) * 1.15)
            if d < bd: bd, best = d, i
        od.append(best)
        ld.append(255 if bd < 330 + (n1s.getpixel((gx, gy)) - 128) * 0.9 else 0)
owner.putdata(od); land.putdata(ld)
land = land.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(10)).point(lambda v: 255 if v > 128 else 0)
owner_small = owner
owner = owner.resize((W, H), Image.NEAREST)
smooth = lambda m: m.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(6)).point(lambda v: 255 if v > 127 else 0)

# ---- พื้น: หญ้าตามฤดูของแต่ละโซน ----
base = Image.new('RGBA', (W, H))
for season in sorted({z['season'] for z in zones}):
    tex = texture(season, GRASS)
    ids = [i for i, z in enumerate(zones) if z['season'] == season]
    m = smooth(owner_small.point(lambda v, ids=ids: 255 if v in ids else 0))
    base.paste(tex, (0, 0), m)
# พื้นดินแห้ง (เนินกระดูก / ค่ายออร์ค) เป็นหย่อม ๆ
dirt = texture('summer', [(3, 3), (4, 3), (5, 3), (3, 4), (4, 4), (5, 4)])
for i, z in enumerate(zones):
    if z['dead'] >= 12:
        m = smooth(owner_small.point(lambda v, i=i: 255 if v == i else 0))
        patch = ImageChops.multiply(m, n2.point(lambda v: 255 if v > 150 else 0))
        base.paste(dirt, (0, 0), patch)

# ---- ทะเลรอบแผ่นดิน ----
water = texture('summer', [(1, 11)])
sea = Image.new('RGBA', (W, H), (40, 110, 150, 255))
sea = Image.blend(sea, water, 0.65)
img = sea.copy()
img.paste(base, (0, 0), land)
# ชายหาด: ขอบแผ่นดิน
coast = land.filter(ImageFilter.MaxFilter(15))
beach = ImageChops.subtract(coast, land)
img.paste(Image.new('RGBA', (W, H), (225, 205, 150, 255)), (0, 0), beach)
img.paste(base, (0, 0), land)
shore = ImageChops.subtract(land.filter(ImageFilter.MaxFilter(25)), coast)
img.paste(Image.new('RGBA', (W, H), (120, 190, 210, 255)), (0, 0), shore.point(lambda v: v // 3))

# ---- ถนนเชื่อมโซน ----
d = ImageDraw.Draw(img)
done = set()
roads = []
for z in zones:
    for to in z['exits']:
        key = tuple(sorted((z['id'], to)))
        if key in done: continue
        done.add(key)
        b = next(q for q in zones if q['id'] == to)
        mx, my = (z['px'] + b['px']) / 2, (z['py'] + b['py']) / 2
        nx, ny = -(b['py'] - z['py']), (b['px'] - z['px'])
        L = math.hypot(nx, ny) or 1
        off = random.uniform(-0.12, 0.12) * L
        cx, cy = mx + nx / L * off, my + ny / L * off
        pts = [((1 - t) ** 2 * z['px'] + 2 * (1 - t) * t * cx + t * t * b['px'], (1 - t) ** 2 * z['py'] + 2 * (1 - t) * t * cy + t * t * b['py']) for t in [i / 40 for i in range(41)]]
        roads.append(pts)
for pts in roads: d.line(pts, fill=(92, 64, 38, 255), width=26, joint='curve')
for pts in roads: d.line(pts, fill=(176, 136, 88, 255), width=18, joint='curve')
for pts in roads:
    for i in range(0, len(pts) - 1, 3):
        d.line([pts[i], pts[i + 1]], fill=(196, 160, 110, 255), width=4)

def near_road(x, y, r):
    for pts in roads:
        for px, py in pts[::2]:
            if (px - x) ** 2 + (py - y) ** 2 < r * r: return True
    return False

# ---- ต้นไม้ / หิน ----
atlases = {}
def sprite(season, k):
    if season not in atlases:
        atlases[season] = (Image.open(A + f'objects_{season}.png').convert('RGBA'), json.load(open(A + f'objects_{season}.json'))['frames'])
    im, fr = atlases[season]
    f = fr[k]['frame']
    return im.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
items = []
landpx = land.load(); ownpx = owner.load()
for _ in range(2600):
    x, y = random.uniform(20, W - 20), random.uniform(40, H - 10)
    if landpx[int(x), int(y)] == 0: continue
    z = zones[ownpx[int(x), int(y)]]
    if math.hypot(x - z['px'], y - z['py']) < (150 if z['type'] == 'town' else 80): continue
    if near_road(x, y, 34): continue
    dens = {'pine': 1.0, 'maple': 0.9, 'snow': 0.85, 'meadow': 0.45, 'bones': 0.35, 'orcamp': 0.5, 'town': 0.35,
            'frost': 0.8, 'swamp': 0.85, 'ruins': 0.4, 'cursed': 1.0, 'lava': 0.4, 'desert': 0.25, 'dragon': 0.4, 'abyss': 0.5}.get(z['id'], 0.6)
    if random.random() > dens: continue
    if z['id'] in ('bones', 'orcamp', 'ruins', 'lava', 'desert', 'dragon', 'abyss') and random.random() < 0.6: k = random.choice(['dead', 'rock_big', 'rock_round', 'brock_big'])
    elif z['id'] in ('pine', 'snow', 'frost'): k = random.choice(['pine1', 'pine2', 'pine3', 'pine1', 'oak2'])
    else: k = random.choice(['oak1', 'oak2', 'oak3', 'doak1', 'doak2', 'pine1', 'bush1', 'bush2'])
    items.append((y, x, z['season'], k))
items.sort()
for y, x, season, k in items:
    sp = sprite(season, k)
    s = 0.62 if k.startswith(('oak', 'doak', 'pine', 'dead')) else 0.75
    sp = sp.resize((max(1, int(sp.width * s)), max(1, int(sp.height * s))), Image.LANCZOS)
    img.alpha_composite(sp, (int(x - sp.width / 2), int(y - sp.height)))

# ---- เมืองหลวง: ลาน + บ้านหลังคาแดง + กำแพง ----
town = next(z for z in zones if z['type'] == 'town')
tx, ty = town['px'], town['py']
d = ImageDraw.Draw(img)
d.ellipse((tx - 120, ty - 82, tx + 120, ty + 82), fill=(150, 150, 150, 255), outline=(90, 90, 96, 255), width=8)
d.ellipse((tx - 108, ty - 72, tx + 108, ty + 72), fill=(196, 170, 120, 255))
rnd = random.Random(3)
houses = []
for i in range(14):
    a = i / 14 * math.pi * 2 + rnd.uniform(-0.1, 0.1)
    houses.append((ty + math.sin(a) * 50, tx + math.cos(a) * 78))
houses.sort()
for hy, hx in houses:
    w, h = 26, 18
    d.rectangle((hx - w / 2, hy - h, hx + w / 2, hy), fill=(232, 220, 196, 255), outline=(80, 60, 50, 255), width=2)
    d.polygon([(hx - w / 2 - 4, hy - h), (hx, hy - h - 16), (hx + w / 2 + 4, hy - h)], fill=(186, 62, 52, 255), outline=(90, 30, 30, 255))
    d.rectangle((hx - 3, hy - 9, hx + 3, hy), fill=(110, 76, 50, 255))
# หอกลางเมือง
d.rectangle((tx - 14, ty - 46, tx + 14, ty + 4), fill=(210, 210, 216, 255), outline=(70, 70, 80, 255), width=3)
d.polygon([(tx - 20, ty - 46), (tx, ty - 78), (tx + 20, ty - 46)], fill=(70, 100, 180, 255), outline=(30, 40, 90, 255))
d.rectangle((tx - 5, ty - 14, tx + 5, ty + 4), fill=(90, 60, 40, 255))

# ---- ขอบกระดาษเข้ม ----
vign = Image.new('L', (W, H), 0)
ImageDraw.Draw(vign).rectangle((0, 0, W, H), outline=255, width=40)
vign = vign.filter(ImageFilter.GaussianBlur(40))
img = Image.composite(Image.new('RGBA', (W, H), (10, 14, 30, 255)), img, vign.point(lambda v: int(v * 0.55)))

out = img.resize((W // 2, H // 2), Image.LANCZOS).convert('RGB')
out.save(A + 'worldmap.jpg', quality=88)
print('ok', out.size)

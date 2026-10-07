from PIL import Image
ICO="/home/claude/novice-online/public/assets/icons"
def colorize(src, col, out):
    im=Image.open(f"{ICO}/{src}.png").convert("RGBA"); px=im.load()
    lum=[ (0.3*r+0.59*g+0.11*b) for r,g,b,a in im.getdata() if a]
    mx=max(lum) or 1
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if not a: continue
            l=(0.3*r+0.59*g+0.11*b)/mx
            k=0.35+l*0.95
            px[x,y]=tuple(min(255,int(c*k)) for c in col)+(a,)
    im.save(f"{ICO}/{out}.png")
C={"ranger":(150,100,55),"shadow":(70,70,82),"mage":(55,70,150),"priest":(235,235,228),"arch":(130,60,170),"saint":(235,190,70)}
for k,c in C.items():
    colorize("gloves",c,f"{k}_gloves")
    colorize("boots",c,f"{k}_{'boots' if k in ('ranger','shadow') else 'shoes'}")

from PIL import Image, ImageDraw
import math
S=4
bg=(249,247,243); terra=(201,102,68); border=(216,199,182)
def mark(size, transparent=False, scale=1.0, border_on=True, color=terra):
    W=size*S
    im=Image.new('RGBA',(W,W),(0,0,0,0)); d=ImageDraw.Draw(im)
    if not transparent:
        r=int(W*0.22)
        d.rounded_rectangle([0,0,W-1,W-1],r,fill=(*bg,255))
        if border_on:
            m=int(W*.03); d.rounded_rectangle([m,m,W-1-m,W-1-m],int(r*.9),outline=(*border,255),width=int(W*0.012))
    cx=cy=W/2; R=W*0.26*scale; t=W*0.095*scale
    start,end=50,300; n=5; gap=11
    seg=(end-start-gap*(n-1))/n
    for i in range(n):
        a0=start+i*(seg+gap); a1=a0+seg
        pts=[]
        for k in range(61):
            a=math.radians(a0+(a1-a0)*k/60); pts.append((cx+(R+t/2)*math.cos(a),cy+(R+t/2)*math.sin(a)))
        for k in range(60,-1,-1):
            a=math.radians(a0+(a1-a0)*k/60); pts.append((cx+(R-t/2)*math.cos(a),cy+(R-t/2)*math.sin(a)))
        d.polygon(pts,fill=(*color,255))
    a=math.radians(end+24); dr=t*0.55
    x=cx+R*math.cos(a); y=cy+R*math.sin(a)
    d.ellipse([x-dr,y-dr,x+dr,y+dr],fill=(*color,255))
    return im.resize((size,size),Image.LANCZOS)


def main():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    assets = root / "mobile" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    mark(1024).save(assets / "icon.png")
    mark(1024, transparent=True, scale=0.7, border_on=False).save(assets / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), (*bg, 255)).save(assets / "android-icon-background.png")
    mark(1024, transparent=True, scale=0.7, border_on=False, color=(255, 255, 255)).save(
        assets / "android-icon-monochrome.png"
    )
    mark(1024, transparent=True, scale=1.0, border_on=False).save(assets / "splash-icon.png")
    mark(256, transparent=True, scale=1.0, border_on=False).save(assets / "widget-mark.png")
    mark(48).save(assets / "favicon.png")

    graphic = Image.new("RGB", (1024, 500), bg)
    badge = mark(420, transparent=True, scale=1.0, border_on=False)
    graphic.paste(badge, (36, 40), badge)
    draw = ImageDraw.Draw(graphic)
    title = ImageFont()
    draw.text((500, 170), "Cluse", font=title[0], fill=(20, 20, 19))
    draw.text((504, 290), "5-hour and weekly limits,", font=title[1], fill=(107, 106, 100))
    draw.text((504, 336), "and when they reset", font=title[1], fill=(107, 106, 100))
    graphic.save(root / "docs" / "play" / "feature-graphic.png")


def ImageFont():
    from PIL import ImageFont as Fonts

    return (
        Fonts.truetype("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf", 92),
        Fonts.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 28),
    )


if __name__ == "__main__":
    main()

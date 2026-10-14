#!/usr/bin/env python3
"""Generate ALL original artwork for the shutterbug site.
Cut-out elements (dark-on-white or dark-on-transparent PNGs), boot sprite,
contact icons, and 9 placeholder film-still posters.
Everything is drawn from scratch - no external assets."""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = "/home/z/my-project/public/assets"
EL = os.path.join(OUT, "el")
WK = os.path.join(OUT, "works")
os.makedirs(EL, exist_ok=True)
os.makedirs(WK, exist_ok=True)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

# ================================================================ cut-outs
def starburst(name, size, points, seed, inner=0.42, spokes=True):
    """hand-drawn starburst sticker: alternating long/short rays"""
    S = size
    img = Image.new("RGB", (S, S), "white")
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    cx = cy = S / 2
    R = S * 0.46
    for layer, (frac, w) in enumerate([(1.0, max(3, S // 90)), (0.62, max(2, S // 130))]):
        pts = []
        for i in range(points * 2):
            a = math.pi * i / points + (0.13 * layer if layer else 0)
            r = R * frac * (1 if i % 2 == 0 else inner) * rnd.uniform(0.96, 1.04)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        d.polygon(pts, outline="black", width=w)
        if spokes:
            for i in range(0, points * 2, 2):
                a = math.pi * i / points
                x2, y2 = cx + math.cos(a) * R * frac * 0.92, cy + math.sin(a) * R * frac * 0.92
                d.line([cx, cy, x2, y2], fill="black", width=max(1, w // 3))
    for _ in range(10):
        a = rnd.uniform(0, 2 * math.pi); r = rnd.uniform(0.72, 0.95) * R
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        L = rnd.uniform(0.03, 0.07) * S
        d.line([x - L, y, x + L, y], fill="black", width=max(2, S // 220))
        d.line([x, y - L, x, y + L], fill="black", width=max(2, S // 220))
    img.save(os.path.join(EL, name))

def dice(name, S=900):
    img = Image.new("RGB", (S, S), "white")
    lay = Image.new("RGB", (S, S), "white")
    dl = ImageDraw.Draw(lay)
    m = S * 0.055
    dl.rounded_rectangle([m, m, S - m, S - m], radius=int(S * 0.16),
                         outline="black", width=int(S * 0.02))
    pr = S * 0.052
    for px, py in [(0.3,0.3),(0.7,0.3),(0.5,0.5),(0.3,0.7),(0.7,0.7)]:
        x, y = S*px, S*py
        dl.ellipse([x-pr, y-pr, x+pr, y+pr], outline="black", width=int(S*0.014))
    for a0, a1, rr in [(-30, 60, 0.62), (120, 200, 0.68)]:
        dl.arc([S/2-rr*S/2, S/2-rr*S/2, S/2+rr*S/2, S/2+rr*S/2], a0, a1,
               fill="black", width=int(S*0.012))
    lay = lay.rotate(-9, resample=Image.BICUBIC, fillcolor="white")
    img.paste(lay, (0, 0))
    img.save(os.path.join(EL, name))

def flower(name, S=1240):
    """line-art rosette on TRANSPARENT bg (dark artwork)"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2
    petals = 8
    R = S * 0.47
    w = int(S * 0.016)
    for i in range(petals):
        a = 2 * math.pi * i / petals
        for sign in (-1, 1):
            pts = []
            for t in range(41):
                u = t / 40
                r = R * u
                spread = math.sin(u * math.pi) * R * 0.30 * sign
                x = cx + math.cos(a) * r - math.sin(a) * spread
                y = cy + math.sin(a) * r + math.cos(a) * spread
                pts.append((x, y))
            d.line(pts, fill="black", width=w, joint="curve")
    d.ellipse([cx-R*0.30, cy-R*0.30, cx+R*0.30, cy+R*0.30], outline="black", width=w)
    d.ellipse([cx-R*0.10, cy-R*0.10, cx+R*0.10, cy+R*0.10], outline="black", width=w)
    img.save(os.path.join(EL, name))

def cd(name, S=900, seed=1):
    """compact disc, dark art on TRANSPARENT bg"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = S / 2
    R = S * 0.47
    w = int(S * 0.012)
    d.ellipse([cx-R, cy-R, cx+R, cy+R], outline="black", width=w)
    for frac in (0.86, 0.72, 0.58):
        r = R * frac
        d.ellipse([cx-r, cy-r, cx+r, cy+r], outline="black", width=max(2, w//2))
    r_hole = R * 0.22
    d.ellipse([cx-r_hole, cy-r_hole, cx+r_hole, cy+r_hole], outline="black", width=w)
    rnd = random.Random(seed)
    a0 = rnd.uniform(0, 360)
    d.arc([cx-R*0.94, cy-R*0.94, cx+R*0.94, cy+R*0.94], a0, a0+55, fill="black", width=int(w*1.8))
    d.arc([cx-R*0.80, cy-R*0.80, cx+R*0.80, cy+R*0.80], a0+8, a0+47, fill="black", width=max(2, w//2))
    img.save(os.path.join(EL, name))

def cards(name, W=1300, H=760):
    """three fanned business cards, dark art on WHITE"""
    img = Image.new("RGBA", (W, H), "white")
    cw, ch = W * 0.52, H * 0.60
    for i, (ang, ox, oy) in enumerate([(-14, 0.02, 0.16), (2, 0.24, 0.06), (17, 0.44, 0.0)]):
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        x = W * ox + W*0.02
        y = H * oy + H*0.06
        dl.rounded_rectangle([x, y, x+cw, y+ch], radius=int(cw*0.07),
                             outline="black", width=int(W*0.011), fill="white")
        tx, ty = x + cw*0.08, y + ch*0.16
        dl.text((tx, ty), "Y O U R   N A M E", font=font(BOLD, int(cw*0.085)), fill="black")
        dl.line([tx, ty + ch*0.30, tx + cw*0.5, ty + ch*0.30], fill="black", width=int(W*0.005))
        for k in range(3):
            ly = ty + ch*(0.42 + 0.13*k)
            dl.line([tx, ly, tx + cw*(0.62 - 0.12*k), ly], fill="black", width=int(W*0.004))
        gx, gy = x + cw*0.76, y + ch*0.72
        gs = cw*0.16
        dl.rounded_rectangle([gx, gy, gx+gs, gy+gs*0.72], radius=gs*0.15, outline="black", width=int(W*0.004))
        dl.ellipse([gx+gs*0.30, gy+gs*0.18, gx+gs*0.70, gy+gs*0.56], outline="black", width=int(W*0.004))
        lay = lay.rotate(ang, resample=Image.BICUBIC, expand=False)
        img = Image.alpha_composite(img, lay)
    img.convert("RGB").save(os.path.join(EL, name))

def mail_icon(name, S=420):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = S * 0.10
    w = int(S * 0.045)
    d.rounded_rectangle([m, m+S*0.12, S-m, S-m-S*0.02], radius=S*0.05, outline="black", width=w)
    d.line([m+w//2, m+S*0.16, S/2, S*0.55, S-m-w//2, m+S*0.16], fill="black",
           width=w, joint="curve")
    img.save(os.path.join(EL, name))

def cam_icon(name, S=420):
    """generic camera mark (placeholder social icon)"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w = int(S * 0.045)
    d.rounded_rectangle([S*0.08, S*0.26, S*0.92, S*0.86], radius=S*0.12, outline="black", width=w)
    d.rounded_rectangle([S*0.34, S*0.14, S*0.66, S*0.30], radius=S*0.05, outline="black", width=w)
    d.ellipse([S*0.34, S*0.42, S*0.66, S*0.72], outline="black", width=w)
    d.ellipse([S*0.44, S*0.50, S*0.56, S*0.62], outline="black", width=max(2, w//2))
    img.save(os.path.join(EL, name))

def boot_sprite(name, scale=6):
    """pixel-art camera sprite, drawn tiny then upscaled nearest for crunch"""
    rows = [
        "..................",
        "......########....",
        "....##........##..",
        "...#....####....#.",
        "...#...#....#...#.",
        "...#...#.##..#...#",
        "...#...#....#...#.",
        "...#....####....#.",
        "....##........##..",
        "......##....##....",
        "......########....",
        "...##...####...##.",
        "..##############..",
        "..##############..",
        "..................",
    ]
    w, h = len(rows[0]), len(rows)
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == "#":
                d.point((x, y), fill="black")
    img = img.resize((w*scale, h*scale), Image.NEAREST)
    img.save(os.path.join(EL, name))

# ================================================================ posters
def grain_vignette(img, seed, grain=16, vig=0.55):
    arr = np.asarray(img).astype(np.float32)
    rnd = np.random.default_rng(seed)
    arr += rnd.normal(0, grain, arr.shape[:2])[:, :, None]
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx / w - 0.5) * 2
    dy = (yy / h - 0.5) * 2
    v = 1 - vig * np.clip(dx*dx + dy*dy, 0, 1) ** 1.4
    arr *= v[:, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def poster(idx, title, sub, kind, year, vertical=False, featured=False):
    W, H = (720, 1280) if vertical else (1280, 720)
    rnd = random.Random(idx * 77 + 5)
    img = Image.new("L", (W, H), 20)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        val = 16 + 60 * (t ** 1.6) + (18 * math.sin(t * 6 + idx))
        d.line([(0, y), (W, y)], fill=int(max(8, val)))
    glow = Image.new("L", (W, H), 0)
    dg = ImageDraw.Draw(glow)
    for _ in range(rnd.randint(2, 4)):
        cx, cy = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.uniform(W*0.18, W*0.5)
        dg.ellipse([cx-r, cy-r*0.7, cx+r, cy+r*0.7], fill=rnd.randint(70, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(min(W, H) * 0.09))
    img = Image.fromarray(np.clip(np.asarray(img).astype(int) + np.asarray(glow)*0.9, 0, 255).astype(np.uint8))
    bar = Image.new("L", (W, H), 0)
    db = ImageDraw.Draw(bar)
    bx = rnd.uniform(-W*0.3, W*0.7)
    db.polygon([(bx, H), (bx + W*0.38, 0), (bx + W*0.52, 0), (bx + W*0.14, H)], fill=235)
    bar = bar.filter(ImageFilter.GaussianBlur(2))
    img = Image.fromarray(np.clip(np.asarray(img).astype(int) * 0.55 + np.asarray(bar) * 0.45, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(rnd.randint(3, 6)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = rnd.uniform(2, 6)
        d.ellipse([x-r, y-r, x+r, y+r], fill=255)
    img = img.convert("RGB")
    d = ImageDraw.Draw(img)
    m = min(W, H) * 0.055
    arm = min(W, H) * 0.045
    lw = max(3, min(W, H) // 180)
    for (x0, y0, dx, dy) in [(m, m, 1, 1), (W-m, m, -1, 1), (m, H-m, 1, -1), (W-m, H-m, -1, -1)]:
        d.line([x0, y0, x0 + dx*arm, y0], fill="white", width=lw)
        d.line([x0, y0, x0, y0 + dy*arm], fill="white", width=lw)
    f_mono = font(MONO_B, int(min(W, H) * 0.030))
    d.ellipse([m, m*0.9 - lw*3, m + lw*6, m*0.9 + lw*3], fill="white")
    d.text((m + min(W,H)*0.035, m*0.9), f"REC 00:0{idx%9}:{10+idx*7:02d}", font=f_mono, fill="white")
    d.text((W - m, H - m*1.15), f"{kind} - {year}", font=f_mono, fill="white", anchor="ra")
    f_idx = font(BOLD, int(min(W, H) * 0.30))
    d.text((W - m, m + min(W,H)*0.16), f"{idx+1:02d}", font=f_idx, fill=(72, 72, 72), anchor="ra")
    f_t = font(BOLD, int(min(W, H) * (0.085 if featured else 0.075)))
    f_s = font(MONO, int(min(W, H) * 0.026))
    tx = m * 1.2
    ty = H - min(W, H) * 0.24
    d.text((tx, ty), title.upper(), font=f_t, fill="white")
    d.line([tx, ty + min(W,H)*0.105, tx + min(W,H)*0.10, ty + min(W,H)*0.105], fill="white", width=lw)
    d.text((tx, ty + min(W,H)*0.125), sub, font=f_s, fill=(205, 205, 205))
    ht = img.convert("L").resize((W // 4, H // 4))
    ht = ht.resize((W, H), Image.NEAREST).convert("RGB")
    img = Image.blend(img, ht, 0.12)
    img = grain_vignette(img, idx * 13 + 1, grain=15 if featured else 18)
    img.save(os.path.join(WK, f"work{idx}.jpg"), quality=88)

WORKS = [
    ("Night Shift",    "a story about staying late",      "SHORT FILM", 2026, False, True),
    ("Soda City",      "bottles, buses, neon rain",       "REEL", 2026, False, False),
    ("Long Exposure",  "the city at 1/8 of a second",     "REEL", 2025, False, False),
    ("Paper Moon",     "a love letter to streetlight",    "REEL", 2026, False, False),
    ("Static",         "found footage from channel 0",    "REEL", 2025, False, False),
    ("Grandstand",     "matchday, from the cheap seats",  "REEL", 2025, True,  False),
    ("Monsoon Tape",   "rain season, three rolls",        "REEL", 2026, False, False),
    ("Low Fidelity",   "VHS dreams, to be continued",     "REEL", 2025, False, False),
    ("First Light",    "opening frames of the next one",  "SHORT FILM", 2026, False, False),
]

if __name__ == "__main__":
    starburst("star-a.png", 1000, 9,  seed=7)
    starburst("star-b.png", 1300, 12, seed=21)
    dice("dice.png")
    flower("flower.png")
    cd("cd-a.png", seed=3)
    cd("cd-b.png", seed=9)
    cards("cards.png")
    mail_icon("ic-mail.png")
    cam_icon("ic-cam.png")
    boot_sprite("swag.png")
    for i, (t, s, k, y, vert, feat) in enumerate(WORKS):
        poster(i, t, s, k, y, vertical=vert, featured=feat)
    print("images done:", sorted(os.listdir(EL)), "| posters:", len(os.listdir(WK)))

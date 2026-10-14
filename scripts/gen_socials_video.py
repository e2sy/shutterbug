#!/usr/bin/env python3
"""
gen_socials_video.py — the SOCIALS channel for the machine screen.

A ~23s B&W motion graphic loop in the site's own language: VT323 type,
starbursts, CDs, film grain, scanline sweeps, glitch slices, VCR chips.

One segment per social handle:
  youtube  @mayankforge
  github   github.com/e2sy
  telegram t.me/ExploitArc
  x        x.com/mayankbhaskarr
  discord  discord.gg/g4Qk9WRZB

Frames -> ffmpeg -> public/assets/reels/socials.mp4 (+ poster jpg)
"""

import math
import os
import random
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = "/home/z/my-project"
OUT_DIR = f"{ROOT}/scripts/_socials_frames"
MP4 = f"{ROOT}/public/assets/reels/socials.mp4"
POSTER = f"{ROOT}/public/assets/works/socials.jpg"
FONT = f"{ROOT}/scripts/vt323.ttf"

W, H = 960, 540
FPS = 30

random.seed(19)

# ------------------------------------------------------------------
# assets from the site itself — brand cohesion
# ------------------------------------------------------------------
def load_asset(name: str) -> Image.Image:
    img = Image.open(f"{ROOT}/public/assets/el/{name}").convert("L")
    return img

STAR = load_asset("star-a.png")
STAR2 = load_asset("star-b.png")
DICE = load_asset("dice.png")
CD = load_asset("cd-a.png")

def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT, size)

# ------------------------------------------------------------------
# film furniture
# ------------------------------------------------------------------
_noise_book: dict[int, np.ndarray] = {}

def grain(sigma: float) -> np.ndarray:
    key = int(sigma * 10)
    if key not in _noise_book:
        _noise_book[key] = np.random.normal(0, sigma, (H, W, 1)).astype(np.float32)
    n = _noise_book[key]
    return np.roll(n, random.randint(0, 60), axis=0)

def vignette() -> np.ndarray:
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W / 2, H / 2
    d = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2)
    v = np.clip(1.12 - 0.38 * d**2, 0, 1.4)
    return v[:, :, None].astype(np.float32)

VIG = vignette()

def scanlines(img: Image.Image, t: int) -> Image.Image:
    a = np.asarray(img).astype(np.float32)
    roll = 0.92 + 0.08 * np.sin((np.arange(H)[:, None] * 1.0 + t * 0.15) * math.pi / 2.0)
    a *= roll[:, :, None] if a.ndim == 3 else roll
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def finish(img: Image.Image, t: int) -> Image.Image:
    a = np.asarray(img).astype(np.float32)
    if a.ndim == 2:
        a = a[:, :, None]
    a = a * VIG + grain(5.5)
    out = Image.fromarray(np.clip(a[:, :, 0], 0, 255).astype(np.uint8))
    return scanlines(out, t)

def rot(img: Image.Image, deg: float, size: int | None = None) -> Image.Image:
    if size:
        img = img.resize((size, int(size * img.height / img.width)), Image.LANCZOS)
    return img.rotate(deg, resample=Image.BICUBIC, expand=True)

def paste_l(base: Image.Image, over: Image.Image, cx: float, cy: float, alpha: float = 1.0):
    """paste 'over' centred on (cx, cy) using itself as mask"""
    m = over.point(lambda p: int(min(255, p * alpha * 1.2)))
    base.paste(over, (int(cx - over.width / 2), int(cy - over.height / 2)), m)

def chip(d: ImageDraw.ImageDraw, text: str, x: int, y: int, size: int = 22, fill: int = 210):
    d.text((x, y), text, font=font(size), fill=fill)

def glitch_text(base: Image.Image, text: str, f: ImageFont.FreeTypeFont, cx: int, cy: int, amt: float):
    """draw text twice with horizontal slice offsets, then solid on top"""
    tmp = Image.new("L", (W, H), 0)
    td = ImageDraw.Draw(tmp)
    tw = td.textbbox((0, 0), text, font=f)
    ox, oy = cx - (tw[2] - tw[0]) / 2, cy - (tw[3] - tw[1]) / 2 - tw[1]
    td.text((ox, oy), text, font=f, fill=255)
    if amt > 0.01:
        arr = np.asarray(tmp)
        sliced = arr.copy()
        bands = 6
        bh = H // bands
        for i in range(bands):
            if random.random() < amt * 1.6:
                shift = random.randint(-int(26 * amt), int(26 * amt))
                sliced[i * bh:(i + 1) * bh] = np.roll(sliced[i * bh:(i + 1) * bh], shift, axis=1)
        base.paste(Image.fromarray(sliced), (0, 0), Image.fromarray(sliced))
    base.paste(tmp, (0, 0), tmp)

def progress_dots(d: ImageDraw.ImageDraw, current: float):
    """5 dots, bottom centre; current may be fractional"""
    n = 5
    gap = 46
    x0 = W / 2 - gap * (n - 1) / 2
    y = H - 44
    for i in range(n):
        fill = 0
        if current >= i + 1:
            fill = 255
        elif current > i:
            fill = int(255 * (current - i))
        r = 7 if abs(current - (i + 0.5)) < 0.5 or fill else 5
        d.ellipse([x0 + i * gap - r, y - r, x0 + i * gap + r, y + r], outline=220, width=2,
                  fill=fill)

# ------------------------------------------------------------------
# segment painters — each returns a frame for local time tl in [0,1)
# ------------------------------------------------------------------
SOCIALS = [
    {"plat": "YOUTUBE",   "handle": "@mayankforge",       "note": "build videos, documented free"},
    {"plat": "GITHUB",    "handle": "github.com/e2sy",    "note": "the code, in the open"},
    {"plat": "TELEGRAM",  "handle": "t.me/ExploitArc",    "note": "the arc, broadcast"},
    {"plat": "X",         "handle": "x.com/mayankbhaskarr", "note": "learning log, daily"},
    {"plat": "DISCORD",   "handle": "discord.gg/g4Qk9WRZB", "note": "the community table"},
]

def intro(t: int, tl: float) -> Image.Image:
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    # starburst spins up behind the wordmark
    sp = rot(STAR, tl * 220, int(300 + 260 * min(1, tl * 2.4)))
    paste_l(img, sp, W / 2, H / 2, 0.9 if tl > 0.12 else tl * 7)
    if tl > 0.10:
        glitch_text(img, "shutterbug.", font(92), W // 2, H // 2 - 10, amt=max(0, 0.8 - tl * 2))
    if tl > 0.45:
        a = min(1, (tl - 0.45) * 3)
        d.text((W / 2 - 150, H / 2 + 62), "SOCIALS CHANNEL", font=font(30), fill=int(210 * a))
    chip(d, "SNS · CH-00", 16, 14)
    chip(d, "PLAY ▶", W - 120, 14)
    progress_dots(d, 0)
    return img

def social_card(i: int, s: dict, t: int, tl: float) -> Image.Image:
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)

    # entrance: 0-0.18 slide + flash, hold: 0.18-0.82, exit: 0.82-1 glitch out
    if tl < 0.14:
        ease = 1 - (1 - tl / 0.14) ** 3
        dx = (1 - ease) * W * 0.9
        if tl < 0.05:
            img.paste(255, (0, 0, W, H))  # white flash frame
            return img
    elif tl > 0.86:
        ease = 1
        dx = -((tl - 0.86) / 0.14) ** 2 * 120
    else:
        ease = 1
        dx = 0

    # rotating set dressing — a star + a cd, every card, alternating sides
    left_side = (i % 2 == 0)
    sx = 150 if left_side else W - 150
    sp = rot(STAR if i % 2 == 0 else STAR2, (t * 0.9 + i * 70) % 360, 210)
    paste_l(img, sp, sx, 130 + 14 * math.sin(t * 0.05 + i), 0.85)
    cd = rot(CD, (t * 1.6 + i * 90) % 360, 190)
    paste_l(img, cd, W - sx, H - 120 + 10 * math.cos(t * 0.04 + i), 0.8)
    dc = rot(DICE, -(t * 0.7) % 360, 84)
    paste_l(img, dc, W / 2, 74 + 8 * math.sin(t * 0.06), 0.9)

    # platform tag + big handle + note
    f_plat = font(34)
    f_big = font(74)
    f_note = font(27)
    tag = f"[ {s['plat']} ]"
    glitch_text(img, tag, f_plat, W // 2 + int(dx), 168, amt=max(0, 0.9 - ease * 1.4))
    if tl > 0.10:
        glitch_text(img, s["handle"], f_big, W // 2 + int(dx), 262, amt=max(0, 0.7 - ease * 1.2))
    if tl > 0.30:
        d.text((W / 2 - int(dx * 0.4), 336), s["note"], font=f_note, fill=185, anchor="mm")

    # sweep line travelling across while holding
    if 0.18 < tl < 0.86:
        sweep = ((tl - 0.18) / 0.68) * (W + 240) - 120
        d.rectangle([sweep, 150, sweep + 3, 420], fill=90)

    chip(d, f"SNS · {i + 1:02d}/05", 16, 14)
    chip(d, s["plat"] + " ▶", W - 150, 14)
    progress_dots(d, i + min(1, tl * 2) - 0.5 if tl < 0.5 else i + 1)
    return img

def outro(t: int, tl: float) -> Image.Image:
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    sp = rot(STAR, tl * 160, int(260 + 80 * math.sin(t * 0.08)))
    paste_l(img, sp, W / 2, H / 2, 0.55)
    glitch_text(img, "find me everywhere", font(64), W // 2, H // 2 - 40, amt=max(0, 0.6 - tl * 1.6))
    if tl > 0.4:
        a = min(1, (tl - 0.4) * 2.5)
        d.text((W / 2, H / 2 + 52), "A = open · B = pause · dpad = flip", font=font(30),
               fill=int(205 * a), anchor="mm")
    chip(d, "SNS · EOF", 16, 14)
    progress_dots(d, 5)
    return img

# ------------------------------------------------------------------
# timeline
# ------------------------------------------------------------------
INTRO_F = 66            # ~2.2s
CARD_F = 110            # ~3.7s each
OUTRO_F = 66
TOTAL = INTRO_F + CARD_F * 5 + OUTRO_F

def frame(idx: int) -> Image.Image:
    t = idx / FPS
    if idx < INTRO_F:
        return intro(idx, idx / INTRO_F)
    idx2 = idx - INTRO_F
    ci = idx2 // CARD_F
    tl = (idx2 % CARD_F) / CARD_F
    if ci < 5:
        return social_card(ci, SOCIALS[ci], idx2, tl)
    return outro(idx2, (idx2 % CARD_F) / CARD_F)

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MP4), exist_ok=True)

    print(f"rendering {TOTAL} frames ...")
    for i in range(TOTAL):
        finish(frame(i), i).convert("RGB").save(f"{OUT_DIR}/f{i:04d}.png")
        if i % 90 == 0:
            print(f"  {i}/{TOTAL}")

    print("encoding mp4 ...")
    subprocess.run(
        ["ffmpeg", "-y", "-framerate", str(FPS), "-i", f"{OUT_DIR}/f%04d.png",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium",
         "-movflags", "+faststart", MP4],
        check=True, capture_output=True,
    )

    # poster = a nice hold frame from social #1
    src = f"{OUT_DIR}/f{INTRO_F + 60:04d}.png"
    Image.open(src).convert("RGB").save(POSTER, quality=88)

    mb = os.path.getsize(MP4) / 1e6
    print(f"done: {MP4} ({mb:.2f} MB, {TOTAL} frames, {TOTAL / FPS:.1f}s)")
    print(f"poster: {POSTER}")

if __name__ == "__main__":
    main()

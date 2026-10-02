#!/usr/bin/env python3
"""Draw Cluse icons. The mark is a segmented C, not the Claude logo."""

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets"
CREAM = (250, 249, 245, 255)
TERRACOTTA = (201, 100, 66, 255)
WHITE = (255, 255, 255, 255)
INK = (20, 20, 19, 255)
MUTED = (107, 106, 100, 255)
CLEAR = (0, 0, 0, 0)

FONT = {
    " ": ["00000"] * 7,
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "%": ["11001", "11010", "00100", "01000", "10110", "01110", "00000"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "a": ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
    "c": ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
    "e": ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
    "h": ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
    "k": ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
    "l": ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
    "n": ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
    "o": ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
    "r": ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
    "s": ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
    "u": ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
    "y": ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
}


def blank(w, h, color):
    return bytearray(color * (w * h))


def put(buf, w, h, x, y, color):
    if 0 <= x < w and 0 <= y < h:
        i = (y * w + x) * 4
        buf[i : i + 4] = bytes(color)


def fill_rect(buf, w, h, x0, y0, x1, y1, color):
    for y in range(y0, y1):
        for x in range(x0, x1):
            put(buf, w, h, x, y, color)


def disc(buf, w, h, cx, cy, radius, color):
    r2 = radius * radius
    x0 = max(0, int(cx - radius - 1))
    x1 = min(w, int(cx + radius + 2))
    y0 = max(0, int(cy - radius - 1))
    y1 = min(h, int(cy + radius + 2))
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2:
                put(buf, w, h, x, y, color)


def round_rect(buf, w, h, radius, color):
    for y in range(h):
        for x in range(w):
            dx = 0
            dy = 0
            if x < radius:
                dx = radius - x - 0.5
            elif x >= w - radius:
                dx = x + 0.5 - (w - radius)
            if y < radius:
                dy = radius - y - 0.5
            elif y >= h - radius:
                dy = y + 0.5 - (h - radius)
            if dx * dx + dy * dy <= radius * radius:
                put(buf, w, h, x, y, color)


def mark_geometry(segments=5):
    """Pillow angles: 0 is east, clockwise. The C opens on the right and ends upper-right."""
    start = 48
    end = 318
    gap = 26
    piece = (end - start - (segments - 1) * gap) / segments
    return start, end, gap, piece


def draw_mark(draw, cx, cy, radius, thickness, color, segments=5):
    start, _end, gap, piece = mark_geometry(segments)
    box = [cx - radius, cy - radius, cx + radius, cy + radius]
    cap = thickness / 2
    last = start
    for i in range(segments):
        a0 = start + i * (piece + gap)
        a1 = a0 + piece
        last = a1
        draw.arc(box, a0, a1, fill=color, width=int(round(thickness)))
        for angle in (a0, a1):
            point = _polar(cx, cy, radius, angle)
            draw.ellipse(_circle(point, cap), fill=color)
    # A gap past the upper-right cap, then one solid dot.
    dot_angle = last + 22
    dot = _polar(cx, cy, radius, dot_angle)
    draw.ellipse(_circle(dot, thickness * 0.34), fill=color)


def _polar(cx, cy, radius, degrees):
    rad = math.radians(degrees)
    return cx + radius * math.cos(rad), cy + radius * math.sin(rad)


def _circle(point, radius):
    x, y = point
    return [x - radius, y - radius, x + radius, y + radius]


def text(buf, w, h, x, y, message, color, scale=4):
    cursor = x
    for ch in message:
        glyph = FONT.get(ch, FONT[" "])
        for row, bits in enumerate(glyph):
            for col, bit in enumerate(bits):
                if bit == "1":
                    fill_rect(
                        buf,
                        w,
                        h,
                        cursor + col * scale,
                        y + row * scale,
                        cursor + col * scale + scale,
                        y + row * scale + scale,
                        color,
                    )
        cursor += 6 * scale


def write_png(path, w, h, buf):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(buf[y * w * 4 : (y + 1) * w * 4]) for y in range(h))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    from PIL import Image, ImageDraw

    ROOT.mkdir(parents=True, exist_ok=True)
    cream = (250, 249, 245, 255)
    warm = (214, 196, 180, 255)
    terracotta = (201, 100, 66, 255)

    icon = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    draw.rounded_rectangle([0, 0, 1023, 1023], radius=228, fill=cream)
    draw.rounded_rectangle([28, 28, 995, 995], radius=206, outline=warm, width=14)
    draw_mark(draw, 512, 512, 300, 74, terracotta)
    icon.save(ROOT / "icon.png")

    foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(foreground), 512, 512, 268, 66, terracotta)
    foreground.save(ROOT / "android-icon-foreground.png")
    foreground.save(ROOT / "splash-icon.png")

    Image.new("RGBA", (1024, 1024), cream).save(ROOT / "android-icon-background.png")

    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    draw_mark(ImageDraw.Draw(mono), 512, 512, 268, 66, (255, 255, 255, 255))
    mono.save(ROOT / "android-icon-monochrome.png")

    favicon = Image.new("RGBA", (192, 192), cream)
    draw_mark(ImageDraw.Draw(favicon), 96, 96, 62, 18, terracotta)
    favicon.resize((48, 48), Image.Resampling.LANCZOS).save(ROOT / "favicon.png")
    feature_graphic()


def feature_graphic():
    from PIL import Image, ImageDraw, ImageFont

    canvas = Image.new("RGB", (1024, 500), (250, 249, 245))
    mark_image = Image.open(ROOT / "android-icon-foreground.png").convert("RGBA")
    mark_image = mark_image.resize((420, 420), Image.Resampling.LANCZOS)
    canvas.paste(mark_image, (48, 40), mark_image)
    draw = ImageDraw.Draw(canvas)
    title = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf", 92)
    tag = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 28)
    draw.text((500, 170), "Cluse", font=title, fill=(20, 20, 19))
    draw.text((504, 290), "Session and weekly plan usage", font=tag, fill=(107, 106, 100))
    out = ROOT.parents[1] / "docs" / "play" / "feature-graphic.png"
    canvas.save(out)


if __name__ == "__main__":
    main()

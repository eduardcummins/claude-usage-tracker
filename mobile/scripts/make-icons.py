#!/usr/bin/env python3
"""Draw Cluse icons. The mark is an original gauge, not the Claude logo."""

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


def ring(buf, w, h, cx, cy, inner, outer, color, sweep=300):
    start = -math.pi / 2
    span = math.radians(sweep)
    for y in range(h):
        for x in range(w):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            dist = math.hypot(dx, dy)
            if inner <= dist <= outer:
                angle = (math.atan2(dy, dx) - start) % (math.pi * 2)
                if angle <= span:
                    put(buf, w, h, x, y, color)


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
    ROOT.mkdir(parents=True, exist_ok=True)
    icon = blank(1024, 1024, CREAM)
    ring(icon, 1024, 1024, 512, 512, 280, 390, TERRACOTTA)
    write_png(ROOT / "icon.png", 1024, 1024, icon)

    foreground = blank(1024, 1024, CLEAR)
    ring(foreground, 1024, 1024, 512, 512, 210, 300, TERRACOTTA)
    write_png(ROOT / "android-icon-foreground.png", 1024, 1024, foreground)
    write_png(ROOT / "splash-icon.png", 1024, 1024, foreground)

    background = blank(1024, 1024, CREAM)
    write_png(ROOT / "android-icon-background.png", 1024, 1024, background)

    mono = blank(1024, 1024, CLEAR)
    ring(mono, 1024, 1024, 512, 512, 210, 300, WHITE)
    write_png(ROOT / "android-icon-monochrome.png", 1024, 1024, mono)

    favicon = blank(48, 48, CREAM)
    ring(favicon, 48, 48, 24, 24, 12, 18, TERRACOTTA)
    write_png(ROOT / "favicon.png", 48, 48, favicon)

    preview = blank(800, 360, CREAM)
    text(preview, 800, 360, 36, 28, "Cluse", MUTED, 4)
    text(preview, 800, 360, 36, 120, "5-hour", INK, 5)
    text(preview, 800, 360, 36, 168, "resets in 3h", MUTED, 3)
    text(preview, 800, 360, 620, 116, "72%", TERRACOTTA, 6)
    text(preview, 800, 360, 36, 230, "Weekly", INK, 5)
    text(preview, 800, 360, 36, 278, "resets in 4d", MUTED, 3)
    text(preview, 800, 360, 620, 226, "18%", TERRACOTTA, 6)
    write_png(ROOT / "widget-preview.png", 800, 360, preview)


if __name__ == "__main__":
    main()

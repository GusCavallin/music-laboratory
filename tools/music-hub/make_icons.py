"""Draws the app icons (a white music note on blue): icon-192.png and icon-512.png. Standard library only.

    py -3 make_icons.py

Content stays inside the central 80% so the same files work as "maskable" icons (Android/Chrome crop them).
"""
import math, os, struct, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
BG, FG = (47, 111, 237), (255, 255, 255)


def in_poly(x, y, pts):
    inside = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def note(x, y):
    """True when the unit-square point (x, y) is inside the note."""
    ang = math.radians(-25)
    dx, dy = x - 0.40, y - 0.70
    u, v = dx * math.cos(ang) + dy * math.sin(ang), -dx * math.sin(ang) + dy * math.cos(ang)
    if (u / 0.16) ** 2 + (v / 0.115) ** 2 <= 1:  # head
        return True
    if 0.52 <= x <= 0.57 and 0.20 <= y <= 0.69:  # stem
        return True
    return in_poly(x, y, [(0.57, 0.20), (0.77, 0.37), (0.75, 0.48), (0.57, 0.34)])  # flag


def png(size):
    ss, rows = 3, []
    for py in range(size):
        row = bytearray([0])  # filter type 0
        for px in range(size):
            hits = sum(note((px + (i + .5) / ss) / size, (py + (j + .5) / ss) / size)
                       for i in range(ss) for j in range(ss))
            t = hits / (ss * ss)
            row += bytes(round(BG[c] + (FG[c] - BG[c]) * t) for c in range(3))
        rows.append(bytes(row))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    return (bytes([137, 80, 78, 71, 13, 10, 26, 10]) + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    for n in (192, 512):
        with open(os.path.join(HERE, f"icon-{n}.png"), "wb") as f:
            f.write(png(n))
        print("wrote icon-%d.png" % n)

"""Render the code-native Quittr mark without third-party dependencies."""
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def render(size, target):
    colors = [(20, 37, 30), (178, 235, 201), (224, 236, 208)]
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            samples = []
            for dy, dx in [(0.25, 0.25), (0.25, 0.75), (0.75, 0.25), (0.75, 0.75)]:
                px, py = (x + dx) * 512 / size, (y + dy) * 512 / size
                ring = abs(math.hypot(px - 249, py - 259) - 111) <= 18.5
                t = max(0, min(1, ((px - 288) + (py - 303)) / 136))
                tail = math.hypot(px - (288 + 68 * t), py - (303 + 68 * t)) <= 18.5
                star = abs(px - 371) + abs(py - 142) <= 36 and min(abs(px - 371), abs(py - 142)) <= 9
                samples.append(colors[2 if star else 1 if ring or tail else 0])
            row.extend(round(sum(c[i] for c in samples) / 4) for i in range(3))
        rows.append(bytes(row))
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(png)

for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    render(size, ROOT / 'public/icons' / name)
render(1024, ROOT / 'ios/Quittr/Assets.xcassets/AppIcon.appiconset/AppIcon.png')

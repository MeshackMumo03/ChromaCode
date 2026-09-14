#!/usr/bin/env python3
"""Overlays a labeled 50px grid on the given image(s) to help read off
precise pixel coordinates for text bounding boxes. Writes to
assets/images/_preview/grid_<name>.png
"""

from PIL import Image, ImageDraw
import os
import sys

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
PREVIEW_DIR = os.path.join(ASSETS_DIR, "_preview")


def add_grid(path, out_path, step=50):
    image = Image.open(path).convert("RGBA")
    draw = ImageDraw.Draw(image)
    w, h = image.size
    for x in range(0, w, step):
        draw.line([(x, 0), (x, h)], fill=(255, 0, 0, 160), width=1)
        if x % 100 == 0:
            draw.text((x + 2, 2), str(x), fill=(255, 0, 0, 255))
    for y in range(0, h, step):
        draw.line([(0, y), (w, y)], fill=(255, 0, 0, 160), width=1)
        if y % 100 == 0:
            draw.text((2, y + 2), str(y), fill=(255, 0, 0, 255))
    image.save(out_path)


if __name__ == "__main__":
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    names = sys.argv[1:] or [
        "icon.png", "favicon.png", "splash-icon.png",
        "android-icon-foreground.png", "android-icon-background.png",
        "android-icon-monochrome.png",
    ]
    for name in names:
        add_grid(os.path.join(ASSETS_DIR, name), os.path.join(PREVIEW_DIR, f"grid_{name}"))
        print(f"wrote grid_{name}")

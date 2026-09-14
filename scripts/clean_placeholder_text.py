#!/usr/bin/env python3
"""
Interim fix for the "CODE CHAT" / "Unlock Your Language" /
"Developed by [Developer Name]" placeholder text baked into the app's
icon/splash PNG assets.

For each affected image, this erases the specified text bounding box(es) by
pasting in a vertically-mirrored patch of the same size taken from directly
above the box (extending the existing gradient/art instead of leaving a
blank hole). Everything outside the specified boxes (the logo mark, the
background art) is left untouched.

Writes previews to assets/images/_preview/ without touching the originals,
so the result can be reviewed before being applied for real.
"""

from PIL import Image
import os

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "images")
PREVIEW_DIR = os.path.join(ASSETS_DIR, "_preview")

# Each entry: filename -> list of (box, source) where box is (x0, y0, x1, y1)
# and source is 'above'/'below'/'transparent'. Coordinates were read off a
# 50px grid overlay (scripts/grid_overlay.py) for each image at 1024x1024.
TARGETS = {
    "icon.png": [
        ((230, 660, 800, 820), "interp"),
    ],
    "favicon.png": [
        ((240, 702, 800, 805), "interp"),
    ],
    "android-icon-background.png": [
        ((300, 612, 870, 755), "interp"),
    ],
    "android-icon-foreground.png": [
        ((310, 600, 710, 700), "interp"),
    ],
    "android-icon-monochrome.png": [
        ((260, 565, 700, 680), "transparent"),
    ],
    "splash-icon.png": [
        ((360, 515, 910, 615), "interp"),  # small "CODE CHAT" inside the card
        ((350, 745, 970, 955), "interp"),  # large "CODE CHAT" / "Unlock Your Language"
        ((280, 950, 1024, 1023), "interp"), # "Developed by [Developer Name]"
    ],
}


def mirror_fill(image: Image.Image, box: tuple[int, int, int, int], source: str) -> None:
    x0, y0, x1, y1 = box
    width = x1 - x0
    height = y1 - y0

    if source == "transparent":
        clear = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        image.paste(clear, (x0, y0))
        return

    # "interp": synthesize each row in the box as a linear blend between the
    # row immediately above and the row immediately below, guaranteeing exact
    # color continuity at both boundaries (no seam, no hue mismatch from
    # copying a distant patch). Loses fine detail (e.g. ray streaks) inside
    # the box, but that's an acceptable trade-off for removing text cleanly.
    top_row = image.crop((x0, y0 - 1, x1, y0)).convert("RGB")
    bottom_row = image.crop((x0, y1, x1, y1 + 1)).convert("RGB")
    alpha = image.crop(box).getchannel("A")

    for i in range(height):
        t = i / max(1, height - 1)
        row = Image.blend(top_row, bottom_row, t)
        image.paste(row, (x0, y0 + i))

    # Preserve original alpha (in case the box straddles a transparent area).
    region = image.crop(box).convert("RGB")
    region.putalpha(alpha)
    image.paste(region, box)


def main():
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for filename, boxes in TARGETS.items():
        path = os.path.join(ASSETS_DIR, filename)
        if not os.path.exists(path):
            print(f"skip (not found): {filename}")
            continue

        image = Image.open(path).convert("RGBA")
        # Process top-to-bottom so lower boxes can source from already-cleaned
        # regions above them where relevant (e.g. splash-icon.png).
        for box, source in sorted(boxes, key=lambda b: b[0][1]):
            mirror_fill(image, box, source)

        out_path = os.path.join(PREVIEW_DIR, filename)
        image.save(out_path)
        print(f"wrote preview: {out_path}")


if __name__ == "__main__":
    main()

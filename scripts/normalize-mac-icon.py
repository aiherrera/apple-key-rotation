#!/usr/bin/env python3
"""
Build build/icon-1024.png from a wide or square master PNG.

- Letterboxing from non-square sources is removed with -trim (ImageMagick).
- The icon is fit *inside* 1024×1024 with transparent margins (never zoom-crops).
- An inset rounded-rectangle mask removes the flat gray mat + outer silver bezel
  that sit *inside* the bitmap bounds (cover-crop used to bake those into the corners).

Requires: Pillow, and `magick` (ImageMagick) on PATH for fuzz-trim.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def trim_source(src: Path, tmp_trimmed: Path) -> None:
    subprocess.run(
        [
            "magick",
            str(src),
            "-fuzz",
            "12%",
            "-trim",
            "+repage",
            str(tmp_trimmed),
        ],
        check=True,
    )


def contain_1024(tmp_trimmed: Path) -> Image.Image:
    im = Image.open(tmp_trimmed).convert("RGBA")
    im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    w, h = im.size
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    ox = (1024 - w) // 2
    oy = (1024 - h) // 2
    canvas.paste(im, (ox, oy))
    return canvas


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    a = im.split()[3]
    bb = a.getbbox()
    if not bb:
        raise SystemExit("No opaque pixels after contain step")
    return bb


def apply_inset_squircle(
    im: Image.Image,
    inset_px: int,
) -> Image.Image:
    """Keep only an inset rounded rect; drops outer mat + bezel ring."""
    x0, y0, x1, y1 = content_bbox(im)
    w = x1 - x0
    h = y1 - y0
    ix0 = x0 + inset_px
    iy0 = y0 + inset_px
    ix1 = x1 - inset_px
    iy1 = y1 - inset_px
    if ix1 <= ix0 or iy1 <= iy0:
        raise SystemExit("inset_px too large for this image")

    # Radius follows ~22% rule, shrunk with inset (never below 64 for 1024 canvas)
    r_outer = min(w, h) * 0.2237
    inset = float(inset_px)
    radius = max(64.0, r_outer - inset * 0.85)

    mask = Image.new("L", (1024, 1024), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((ix0, iy0, ix1, iy1), radius=radius, fill=255)

    r, g, b, a = im.split()
    a_new = ImageChops.multiply(a, mask)
    out = Image.merge("RGBA", (r, g, b, a_new))
    return strip_invisible_rgb(out)


def strip_invisible_rgb(im: Image.Image) -> Image.Image:
    """Avoid gray halos in .icns: RGB=0 when A=0."""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
    return im


def maximize_on_1024(im: Image.Image) -> Image.Image:
    """Trim opaque bounds and scale up to use the full 1024×1024 (transparent margin minimal)."""
    im = strip_invisible_rgb(im)
    bb = im.split()[3].getbbox()
    if not bb:
        raise SystemExit("No opaque pixels after masking")
    cropped = im.crop(bb)
    cw, ch = cropped.size
    scale = min(1024 / cw, 1024 / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    scaled = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    ox = (1024 - nw) // 2
    oy = (1024 - nh) // 2
    canvas.paste(scaled, (ox, oy))
    return strip_invisible_rgb(canvas)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "source",
        type=Path,
        nargs="?",
        default=Path("build/icon-1024.png"),
        help="Master PNG (wide or square). Default: build/icon-1024.png",
    )
    p.add_argument(
        "-o",
        "--out",
        type=Path,
        default=Path("build/icon-1024.png"),
        help="Output 1024 path (default: build/icon-1024.png)",
    )
    p.add_argument(
        "--inset",
        type=int,
        default=72,
        help="Pixels to shrink the mask on each side (removes mat + outer bezel). Default: 72",
    )
    args = p.parse_args()

    src = args.source.resolve()
    if not src.exists():
        print(f"Missing source: {src}", file=sys.stderr)
        sys.exit(1)

    tmp = Path("/tmp/akr-icon-trim.png")
    trim_source(src, tmp)
    im = contain_1024(tmp)
    im = apply_inset_squircle(im, args.inset)
    im = maximize_on_1024(im)

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()

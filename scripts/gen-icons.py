#!/usr/bin/env python3
"""Generate square PWA icons from the ContrataPJ brand icon.

Source: colored brand PNG (1400x1088, transparent). We pad it onto a square
#0a0a0c canvas (dark app theme), preserving aspect ratio, then downscale with
LANCZOS to each target size.

cairosvg is not available on this host, so we use the Pillow fallback per the
task guidance. The colored variant reads well on the dark background.
"""
from PIL import Image

BG = (10, 10, 12, 255)  # #0a0a0c
SRC = "/home/diego/segundo-cerebro/Empresas/Contrata PJ/Identidade Visual/Icon_ContrataPJ/Icon_ContrataPJ.png"
OUT = "/home/diego/contratapj-academy/public"


def square_canvas(src_img, target, content_ratio):
    """Place src_img centered on a square #0a0a0c canvas of size `target`.

    content_ratio = fraction of the canvas the icon's longest side occupies
    (the rest is padding / safe zone).
    """
    canvas = Image.new("RGBA", (target, target), BG)
    # scale source so its longest side == target * content_ratio
    max_side = int(target * content_ratio)
    w, h = src_img.size
    scale = max_side / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = src_img.resize((nw, nh), Image.LANCZOS)
    ox = (target - nw) // 2
    oy = (target - nh) // 2
    canvas.alpha_composite(resized, (ox, oy))
    return canvas


def main():
    src = Image.open(SRC).convert("RGBA")
    # crop to the actual content bounding box first
    bbox = src.getbbox()
    if bbox:
        src = src.crop(bbox)

    targets = [
        ("pwa-192x192.png", 192, 0.80, "RGBA"),
        ("pwa-512x512.png", 512, 0.80, "RGBA"),
        # maskable: ~20% safe-zone padding -> content occupies ~60%
        ("pwa-maskable-512x512.png", 512, 0.60, "RGBA"),
        ("apple-touch-icon.png", 180, 0.78, "RGB"),  # apple wants opaque
    ]
    for name, size, ratio, mode in targets:
        img = square_canvas(src, size, ratio)
        if mode == "RGB":
            img = img.convert("RGB")
        img.save(f"{OUT}/{name}")
        print(f"wrote {name} {img.size} {img.mode}")

    # favicon.ico (multi-size) from the colored icon on dark bg
    ico = square_canvas(src, 64, 0.80).convert("RGBA")
    ico.save(f"{OUT}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("wrote favicon.ico")


if __name__ == "__main__":
    main()

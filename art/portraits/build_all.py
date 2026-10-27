"""Render every faction portrait.

Each module in factions/ exposes PORTRAITS = {role: fn}, where fn() returns a 64x64 RGBA image
(transparent background). Roles: merchant, mechanic, pilot, commander.

  python3 build_all.py              all factions + contact sheet
  python3 build_all.py imperium     one faction (writes out/preview_imperium.png)
"""
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image, ImageDraw  # noqa: E402

from portraitlib import N, on_black, save_preview  # noqa: E402

FACTIONS = ["mantid", "bandits", "imperium", "church", "cerebrals", "syndicate"]
ROLES = ["merchant", "mechanic", "pilot", "commander"]
OUT = os.path.join(HERE, "out")


def render(faction):
    mod = importlib.import_module(f"factions.{faction}")
    imgs = {}
    for role in ROLES:
        img = mod.PORTRAITS[role]()
        assert img.size == (N, N), (faction, role, img.size)
        img.save(os.path.join(OUT, f"{faction}_{role}.png"))
        imgs[role] = img
    save_preview(imgs, os.path.join(OUT, f"preview_{faction}.png"), scale=5)
    return imgs


def contact_sheet(all_imgs, path, scale=3):
    pad, label = 4, 70
    w = label + len(ROLES) * (N + pad) + pad
    h = 14 + len(all_imgs) * (N + pad) + pad
    sheet = Image.new("RGBA", (w, h), (16, 6, 8, 255))
    d = ImageDraw.Draw(sheet)
    for c, role in enumerate(ROLES):
        d.text((label + pad + c * (N + pad), 2), role, fill=(255, 210, 70))
    for r, (faction, imgs) in enumerate(all_imgs.items()):
        y = 14 + pad + r * (N + pad)
        d.text((4, y + N // 2 - 5), faction, fill=(255, 241, 196))
        for c, role in enumerate(ROLES):
            sheet.alpha_composite(on_black(imgs[role]), (label + pad + c * (N + pad), y))
    sheet.resize((w * scale, h * scale), Image.NEAREST).save(path)


def main(args):
    os.makedirs(OUT, exist_ok=True)
    names = args or FACTIONS
    all_imgs = {f: render(f) for f in names}
    if not args:
        contact_sheet(all_imgs, os.path.join(OUT, "all_factions.png"))


if __name__ == "__main__":
    main(sys.argv[1:])

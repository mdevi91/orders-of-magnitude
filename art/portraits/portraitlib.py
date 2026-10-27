"""Shared engine for 64x64 retro-anime pixel portraits.

Draw with layered polygons (no antialiasing): every pixel belongs to one named layer with a z-order.
`outline()` then darkens each pixel that borders empty space or a layer behind it, which gives the
inked cel look. Shade inside a layer with `shade()`, and add crisp details (eyes, mouths, badges)
with `stamp()` after the outline pass.

Coordinates: x in [0, 64), y in [-OFF, 64). Rows above 0 are headroom for tall hats, crests or
domes; `image(shift)` crops starting at y = -shift, so shift > 0 moves the whole figure down.
"""
from PIL import Image, ImageDraw

N = 64
OFF = 12
YS = range(-OFF, N)

# light comes from the upper left: shade the right side, rim-light the left


def mirror(pts):
    """Mirror points across the vertical centre line (keeps polygon winding)."""
    return [(N - 1 - x, y) for x, y in reversed(pts)]


class _Shifted:
    """ImageDraw wrapper: callers use y in [-OFF, N), stored at y + OFF."""

    def __init__(self, draw):
        self.d = draw

    def _pts(self, pts):
        if pts and isinstance(pts[0], (int, float)):
            pts = list(zip(pts[::2], pts[1::2]))
        return [(x, y + OFF) for x, y in pts]

    def polygon(self, pts, **kw):
        self.d.polygon(self._pts(pts), **kw)

    def line(self, pts, **kw):
        self.d.line(self._pts(pts), **kw)

    def rectangle(self, box, **kw):
        x0, y0, x1, y1 = box
        self.d.rectangle([x0, y0 + OFF, x1, y1 + OFF], **kw)

    def ellipse(self, box, **kw):
        x0, y0, x1, y1 = box
        self.d.ellipse([x0, y0 + OFF, x1, y1 + OFF], **kw)

    def point(self, pts, **kw):
        self.d.point(self._pts(pts), **kw)


class _Mask:
    def __init__(self, img):
        self.img = img

    def get(self, x, y):
        return self.img.getpixel((x, y + OFF))


class _Rows:
    """Row list indexable by y in [-OFF, N)."""

    def __init__(self, fill):
        self.rows = [[fill] * N for _ in range(N + OFF)]

    def __getitem__(self, y):
        return self.rows[y + OFF]


def mask_of(draw_fn):
    """draw_fn(d) draws with fill=1 on d (polygon/line/rectangle/ellipse/point)."""
    m = Image.new("1", (N, N + OFF), 0)
    draw_fn(_Shifted(ImageDraw.Draw(m)))
    return _Mask(m)


class Canvas:
    """layers: {name: (z, outline_rgb or None)}; higher z draws on top."""

    def __init__(self, layers):
        self.layers = layers
        self.z = _Rows(0)
        self.layer = _Rows(None)
        self.col = _Rows(None)

    def fill(self, name, color, draw_fn):
        z, _ = self.layers[name]
        m = mask_of(draw_fn)
        for y in YS:
            for x in range(N):
                if m.get(x, y) and z >= self.z[y][x]:
                    self.z[y][x] = z
                    self.layer[y][x] = name
                    self.col[y][x] = color

    def poly(self, name, color, pts):
        self.fill(name, color, lambda d: d.polygon(pts, fill=1))

    def ellipse(self, name, color, box):
        self.fill(name, color, lambda d: d.ellipse(box, fill=1))

    def shade(self, layers, color, draw_fn, where=None):
        """Recolour pixels of the given layers inside the shape (no z change)."""
        m = mask_of(draw_fn)
        for y in YS:
            for x in range(N):
                if m.get(x, y) and self.layer[y][x] in layers and (where is None or where(x, y)):
                    self.col[y][x] = color

    def shade_below(self, layer, over, color, depth=2):
        """Cast shadow: pixels of `layer` within `depth` rows under a pixel of layer `over`."""
        hits = [(x, y) for y in YS for x in range(N)
                if self.layer[y][x] == layer
                and any(y - k >= -OFF and self.layer[y - k][x] == over for k in range(1, depth + 1))]
        for x, y in hits:
            self.col[y][x] = color

    def stamp(self, x0, y0, rows, pal):
        """Paint a char grid; '.' is transparent, every other char is looked up in pal."""
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != "." and 0 <= x0 + dx < N and -OFF <= y0 + dy < N:
                    self.col[y0 + dy][x0 + dx] = pal[ch]

    def px(self, x, y, color):
        if 0 <= x < N and -OFF <= y < N:
            self.col[y][x] = color

    def line(self, pts, color, layers=None):
        """1px line painted over everything (or only over the given layers)."""
        m = mask_of(lambda d: d.line(pts, fill=1))
        for y in YS:
            for x in range(N):
                if m.get(x, y) and (layers is None or self.layer[y][x] in layers):
                    self.col[y][x] = color

    def outline(self):
        out = []
        for y in YS:
            for x in range(N):
                name = self.layer[y][x]
                if name is None:
                    continue
                z, oc = self.layers[name]
                if oc is None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < N and -OFF <= ny < N and self.z[ny][nx] < z:
                        out.append((x, y, oc))
                        break
        for x, y, c in out:
            self.col[y][x] = c

    def image(self, shift=0):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for y in range(N):
            for x in range(N):
                c = self.col[y - shift][x]
                if c:
                    img.putpixel((x, y), tuple(c) + (255,))
        return img


# ---------- anime eye kit (humanoids) ----------
# 14 wide, 11 tall. '#' is the 8x8 iris slot. The iris is never mirrored, so both
# highlights sit on the same (upper-left) side.
EYE_FRAME_L = [
    "....KKKKKKKK..",
    "..KKKKKKKKKKKK",
    "KKK.########K.",
    "K...########..",
    "....########..",
    "....########..",
    "....########..",
    "....########..",
    "....########..",
    "....########..",
    "......KKKK....",
]
EYE_FRAME_R = [row[::-1] for row in EYE_FRAME_L]
IRIS = [
    "WeeeeeeW",
    "WwweeeeW",
    "WwwEEEEW",
    "WEEPPEEW",
    "WEEPPEEW",
    "WEEPPEwW",
    "WpEEEEpW",
    ".pppppp.",
]
EYE_W = 14


def eye(frame_rows, iris=IRIS):
    out = []
    for row in frame_rows:
        if "#" in row:
            i = row.index("#")
            row = row[:i] + iris[len(out) - 2] + row[i + 8:]
        out.append(row)
    return out


def iris_pal(dark, mid, light, outline=(22, 6, 10), white=(255, 248, 232), pupil=(30, 8, 8)):
    """Palette for the eye stamp chars: K lash, W white, e/E/p iris dark/mid/light, P pupil, w highlight."""
    return {"K": outline, "W": white, "e": dark, "E": mid, "p": light, "P": pupil, "w": (255, 255, 255)}


def eyes(cv, pal, y=26, inset=15, iris=IRIS, lid_drop=0):
    """Stamp both anime eyes. lid_drop rows of the top lash are removed (narrower, sterner eyes)."""
    fl, fr = EYE_FRAME_L, EYE_FRAME_R
    if lid_drop:
        fl = ["." * EYE_W] * lid_drop + fl[lid_drop:]
        fr = ["." * EYE_W] * lid_drop + fr[lid_drop:]
    cv.stamp(inset, y, eye(fl, iris), pal)
    cv.stamp(N - inset - EYE_W, y, eye(fr, iris), pal)


def on_black(img):
    bg = Image.new("RGBA", img.size, (0, 0, 0, 255))
    bg.alpha_composite(img)
    return bg


def save_preview(images, path, scale=4, cols=4, bg=(16, 6, 8)):
    """Grid of named 64x64 portraits on a dark background, scaled up crisp."""
    names = list(images)
    rows = (len(names) + cols - 1) // cols
    pad = 4
    sheet = Image.new("RGBA", (cols * (N + pad) + pad, rows * (N + pad) + pad), bg + (255,))
    for i, name in enumerate(names):
        sheet.alpha_composite(images[name], (pad + (i % cols) * (N + pad), pad + (i // cols) * (N + pad)))
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(path)

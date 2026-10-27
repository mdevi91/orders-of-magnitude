"""64x64 close-up retro-anime military officer, game hub palette.

Built from layered polygons (no antialiasing) + auto outline + cel shading,
with hand-drawn stamps for eyes, mouth and badge.
Frames (left to right): idle, talk_a, talk_b, blink.
Run: python3 -I gen_officer64.py <out_dir>
"""
import sys
from PIL import Image, ImageDraw

N = 64

C = {
    "K": (22, 6, 10),         # outline
    "kS": (130, 50, 45),      # skin outline
    "cap": (186, 40, 30),
    "capD": (120, 24, 22),
    "capL": (236, 86, 52),
    "brim": (26, 8, 10),
    "brimL": (96, 34, 34),
    "brimS": (170, 90, 80),   # visor gloss
    "band": (70, 16, 18),
    "Y": (255, 214, 70),      # gold
    "y": (220, 140, 30),      # gold shade
    "H": (60, 18, 30),        # hair
    "Hd": (36, 10, 18),       # hair dark
    "Hl": (130, 44, 56),      # hair shine
    "Hr": (236, 96, 44),      # hair rim light
    "S": (255, 222, 192),     # skin
    "s": (240, 164, 128),     # skin cel shadow
    "r": (204, 110, 92),      # skin deep shadow
    "B": (250, 140, 120),     # blush
    "U": (58, 18, 24),        # uniform
    "Ul": (104, 30, 32),      # uniform light
    "O": (232, 50, 30),       # rank tab
    "W": (255, 248, 232),     # eye white
    "e": (120, 34, 10),       # iris dark
    "E": (236, 124, 22),      # iris
    "P": (52, 10, 6),         # pupil
    "p": (255, 210, 96),      # iris light
    "w": (255, 255, 255),     # highlight
    "M": (180, 80, 76),       # mouth line
    "L": (206, 28, 48),       # lipstick
    "l": (255, 108, 118),     # lip shine
    "a": (110, 170, 230),     # sweat outline
    "b": (210, 240, 255),     # sweat
    "m": (84, 14, 22),        # mouth inside
    "t": (240, 112, 112),     # tongue
}

# layer z-order; higher draws on top. outline colour per layer.
LAYERS = {
    "hairback": (1, "K"),
    "neck":     (2, "kS"),
    "uniform":  (3, "K"),
    "collar":   (4, "K"),
    "face":     (5, "kS"),
    "locks":    (6, "K"),
    "bangs":    (7, "K"),
    "cap":      (8, "K"),
    "band":     (9, "K"),
    "brim":     (10, "K"),
}


def mirror(pts):
    return [(N - 1 - x, y) for x, y in reversed(pts)]


OFF = 8      # internal rows above y=0 (hat headroom)
SHIFT = 5    # final image starts at y=-SHIFT, i.e. she sits SHIFT px lower
YS = range(-OFF, N)


class Shifted:
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

    def point(self, pts, **kw):
        self.d.point(self._pts(pts), **kw)


class Mask:
    def __init__(self, img):
        self.img = img

    def getpixel(self, xy):
        x, y = xy
        return self.img.getpixel((x, y + OFF))


class Rows:
    """Row list indexable by y in [-OFF, N)."""

    def __init__(self, fill):
        self.rows = [[fill] * N for _ in range(N + OFF)]

    def __getitem__(self, y):
        return self.rows[y + OFF]


def mask_of(draw_fn):
    m = Image.new("1", (N, N + OFF), 0)
    draw_fn(Shifted(ImageDraw.Draw(m)))
    return Mask(m)


class Canvas:
    def __init__(self):
        self.z = Rows(0)
        self.layer = Rows(None)
        self.col = Rows(None)

    def fill(self, name, color, draw_fn):
        z, _ = LAYERS[name]
        m = mask_of(draw_fn)
        for y in YS:
            for x in range(N):
                if m.getpixel((x, y)) and z >= self.z[y][x]:
                    self.z[y][x] = z
                    self.layer[y][x] = name
                    self.col[y][x] = color

    def poly(self, name, color, pts):
        self.fill(name, color, lambda d: d.polygon(pts, fill=1))

    def shade(self, layers, color, draw_fn, where=None):
        """Recolour pixels of given layers inside the shape."""
        m = mask_of(draw_fn)
        for y in YS:
            for x in range(N):
                if m.getpixel((x, y)) and self.layer[y][x] in layers:
                    if where is None or where(x, y):
                        self.col[y][x] = color

    def stamp(self, x0, y0, rows, legend):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    self.col[y0 + dy][x0 + dx] = C[legend.get(ch, ch)]

    def outline(self):
        out = []
        for y in YS:
            for x in range(N):
                name = self.layer[y][x]
                if name is None:
                    continue
                z, oc = LAYERS[name]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < N and -OFF <= ny < N):
                        continue
                    if self.z[ny][nx] < z:
                        out.append((x, y, C[oc]))
                        break
        for x, y, c in out:
            self.col[y][x] = c

    def image(self):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for y in range(N):
            for x in range(N):
                c = self.col[y - SHIFT][x]
                if c:
                    img.putpixel((x, y), c + (255,))
        return img


# ---------- stamps ----------

# eye frame: '#' marks the 8x8 iris slot
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

# iris is shared by both eyes (never mirrored) so the light comes from one side
IRIS = {
    "normal": [
        "WeeeeeeW",
        "WwweeeeW",
        "WwwEEEEW",
        "WEEPPEEW",
        "WEEPPEEW",
        "WEEPPEwW",
        "WpEEEEpW",
        ".pppppp.",
    ],
    "alarmed": [
        "WWWWWWWW",
        "WWWWWWWW",
        "WWwEEeWW",
        "WWEPPEWW",
        "WWEPPEWW",
        "WWeEEeWW",
        "WWWWWWWW",
        ".WWWWWW.",
    ],
}
# determined: upper lid drops one row over the iris -> narrowed, focused eyes
IRIS["determined"] = ["KKKKKKKK"] + IRIS["normal"][1:]
IRIS["alarmed"] = IRIS["determined"]
LID_DROP = {"determined", "alarmed"}


def eye(frame_rows, iris):
    out = []
    for row in frame_rows:
        if "#" in row:
            i = row.index("#")
            ir = iris[len(out) - 2]
            row = row[:i] + ir + row[i + 8:]
        out.append(row)
    return out


EYE_CLOSED_L = [
    "..............",
    "..............",
    "..............",
    "..............",
    "..............",
    "KK............",
    ".KKKKKKKKKKKK.",
    "....KKKKKKK...",
    "..............",
    "..............",
    "..............",
]
EYE_CLOSED_R = [row[::-1] for row in EYE_CLOSED_L]

# 8 wide, red lipstick
MOUTHS = {
    "normal": {
        "idle":   ["..L..L..", ".LLLLLL.", "..LllL..", "........"],
        "talk_a": ["..L..L..", ".LLLLLL.", ".LmmmmL.", "..LllL.."],
        "talk_b": ["..L..L..", ".LLLLLL.", "LmmmmmmL", "LmmttmmL", ".LLllLL."],
    },
    "determined": {
        "idle":   ["........", ".LLLLLL.", "..LllL..", "........"],
        "talk_a": [".LLLLLL.", ".LwwwwL.", "..LllL..", "........"],
        "talk_b": [".LLLLLL.", "LwwwwwwL", "LmmmmmmL", ".LLllLL."],
    },
    "alarmed": {
        "idle":   ["LLLLLLLL", "LwwwwwwL", "LwwwwwwL", ".LLllLL."],
        "talk_a": ["LLLLLLLL", "LwwwwwwL", "LmmmmmmL", "LmmmmmmL", ".LLllLL."],
        "talk_b": ["LLLLLLLL", "LwwwwwwL", "LmmmmmmL", "LmmmmmmL", "LmmttmmL", ".LLllLL."],
    },
}

BROWS = {
    "normal":   (((18, 24), (25, 23)), ((38, 23), (45, 24))),
    "determined": (((18, 23), (25, 25)), ((38, 25), (45, 23))),
    "alarmed":  (((17, 21), (25, 25)), ((38, 25), (46, 21))),
}

SWEAT = [".a.", "aba", "aba", ".a."]

BADGE = [
    "......Y......",
    "YY...YyY...YY",
    ".YYYYyOyYYYY.",
    "..yyYYyYYyy..",
    "....yYYYy....",
    "......y......",
]

LEGEND = {}

EYE_W = 14
EYE_L_POS = (15, 26)
EYE_R_POS = (N - 15 - EYE_W, 26)


def build(frame, mood):
    cv = Canvas()

    # back hair, falls past shoulders
    cv.poly("hairback", C["H"], [(9, 8), (54, 8), (57, 24), (58, 40), (61, 56), (63, 63),
                                 (0, 63), (2, 56), (5, 40), (6, 24)])

    # neck + uniform
    cv.poly("neck", C["S"], [(26, 44), (37, 44), (37, 53), (26, 53)])
    cv.poly("uniform", C["U"], [(0, 57), (12, 53), (22, 54), (41, 54), (51, 53), (63, 57),
                                (63, 63), (0, 63)])
    cv.poly("collar", C["Ul"], [(21, 49), (42, 49), (44, 58), (19, 58)])

    # face: wide cheeks, pointed chin
    face = [(13, 14), (13, 33), (15, 41), (20, 47), (27, 53), (30, 55), (33, 55), (36, 53),
            (43, 47), (48, 41), (50, 33), (50, 14)]
    cv.poly("face", C["S"], face)

    # side locks framing the face
    lock = [(8, 12), (15, 12), (14, 26), (13, 38), (13, 48), (12, 58), (9, 63), (6, 58),
            (7, 44), (7, 26)]
    cv.poly("locks", C["H"], lock)
    cv.poly("locks", C["H"], mirror(lock))

    # bangs: sharp spikes
    tips = [(14, 27), (17, 21), (26, 24), (31, 31), (37, 24), (46, 21), (49, 27)]
    bangs = [(11, 12)]
    prev_x = 11
    for tx, ty in tips:
        bangs.append(((prev_x + tx) // 2 + 1, 19))
        bangs.append((tx, ty))
        prev_x = tx
    bangs += [(51, 18), (52, 12)]
    cv.poly("bangs", C["H"], bangs)

    # peaked cap: crown flares wider than the band, front raised (saddle shape)
    cv.poly("cap", C["cap"], [(12, 11), (4, 7), (1, 4), (5, 1), (16, -4), (47, -4), (58, 1),
                              (62, 4), (59, 7), (51, 11)])
    cv.poly("band", C["band"], [(12, 8), (51, 8), (51, 15), (12, 15)])
    # visor: glossy black, curves down toward the viewer
    cv.poly("brim", C["brim"], [(14, 14), (49, 14), (48, 17), (41, 20), (32, 21), (22, 20),
                                (15, 17)])

    # ---- shading ----
    hair = {"hairback", "locks", "bangs"}
    # back hair darker than front so the head reads in front
    cv.shade({"hairback"}, C["Hd"], lambda d: d.rectangle([0, 0, N, N], fill=1))
    # shine ring across bangs
    cv.shade(hair - {"hairback"}, C["Hl"], lambda d: d.line([(12, 21), (22, 19), (32, 20), (42, 19), (52, 21)], fill=1))
    # rim light on outer left edge of left lock
    cv.shade({"locks"}, C["Hr"], lambda d: d.line([(8, 20), (8, 44), (7, 56)], fill=1))
    cv.shade({"locks"}, C["Hl"], lambda d: d.line([(55, 20), (55, 44), (56, 56)], fill=1))
    # strand lines
    for a, b in [((16, 30), (13, 50)), ((47, 30), (50, 50)), ((12, 26), (10, 46)), ((51, 26), (53, 46))]:
        cv.shade({"locks"}, C["Hd"], lambda d, a=a, b=b: d.line([a, b], fill=1))
    # shadow under brim
    cv.shade(hair, C["Hd"], lambda d: d.polygon([(8, 15), (55, 15), (48, 21), (32, 23), (15, 21)], fill=1))

    # face cel shadow on the right, under bangs, under chin
    cv.shade({"face"}, C["s"], lambda d: d.polygon([(43, 14), (51, 14), (51, 36), (45, 46), (35, 55), (40, 47), (44, 38)], fill=1))
    bang_shadow = []
    for y in range(N):
        for x in range(N):
            if cv.layer[y][x] == "face" and any(
                0 <= y - k and cv.layer[y - k][x] == "bangs" for k in (1, 2)
            ):
                bang_shadow.append((x, y))
    for x, y in bang_shadow:
        cv.col[y][x] = C["s"]
    cv.shade({"neck"}, C["r"], lambda d: d.rectangle([0, 0, N, 50], fill=1))
    cv.shade({"neck"}, C["s"], lambda d: d.rectangle([33, 0, N, N], fill=1))

    # cap shading
    cv.shade({"cap"}, C["capL"], lambda d: d.polygon([(2, 4), (6, 1), (16, -3), (24, -3), (12, 4), (5, 7)], fill=1))
    cv.shade({"cap"}, C["capD"], lambda d: d.polygon([(44, -3), (58, 1), (62, 4), (53, 10), (42, 9)], fill=1))
    # gold piping where crown meets band, chin cord above the visor
    cv.shade({"band"}, C["Y"], lambda d: d.line([(12, 8), (51, 8)], fill=1))
    cv.shade({"band"}, C["Y"], lambda d: d.line([(14, 13), (49, 13)], fill=1))
    cv.shade({"band"}, C["y"], lambda d: d.line([(14, 12), (49, 12)], fill=1))
    cv.shade({"band"}, C["capD"], lambda d: d.rectangle([44, 9, 51, 11], fill=1))
    # visor gloss streak
    cv.shade({"brim"}, C["brimL"], lambda d: d.line([(17, 16), (24, 18), (30, 19)], fill=1))
    cv.shade({"brim"}, C["brimS"], lambda d: d.line([(19, 17), (23, 18)], fill=1))
    cv.shade({"brim"}, C["brimL"], lambda d: d.line([(16, 17), (22, 19), (32, 20), (41, 19), (47, 17)], fill=1))

    # collar details: gold trim, centre seam, rank tabs
    cv.shade({"collar"}, C["Y"], lambda d: d.line([(21, 50), (42, 50)], fill=1))
    cv.shade({"collar", "uniform"}, C["Y"], lambda d: d.line([(31, 51), (31, 63)], fill=1))
    cv.shade({"collar", "uniform"}, C["y"], lambda d: d.line([(32, 51), (32, 63)], fill=1))
    for x0 in (23, 37):
        cv.shade({"collar"}, C["O"], lambda d, x0=x0: d.rectangle([x0, 52, x0 + 3, 55], fill=1))
        cv.shade({"collar"}, C["Y"], lambda d, x0=x0: d.point([(x0 + 1, 53), (x0 + 2, 54)], fill=1))
    cv.shade({"uniform"}, C["Ul"], lambda d: d.line([(2, 58), (14, 55)], fill=1))
    cv.shade({"uniform"}, C["Ul"], lambda d: d.line([(49, 55), (61, 58)], fill=1))

    cv.outline()

    # ---- face details (after outline so they stay crisp) ----
    if frame == "blink":
        for (x0, y0), stamp in ((EYE_L_POS, EYE_CLOSED_L), (EYE_R_POS, EYE_CLOSED_R)):
            for dy in range(len(stamp)):
                for dx in range(EYE_W):
                    if cv.layer[y0 + dy][x0 + dx] == "face" and not (
                        cv.col[y0 + dy][x0 + dx] in (C["s"],) and dy < 1):
                        cv.col[y0 + dy][x0 + dx] = C["s"] if x0 + dx > 44 else C["S"]
            cv.stamp(x0, y0, stamp, LEGEND)
    else:
        frame_l, frame_r = EYE_FRAME_L, EYE_FRAME_R
        if mood in LID_DROP:
            # top lash row becomes skin so the lid sits lower
            frame_l = ["." * EYE_W] + frame_l[1:]
            frame_r = ["." * EYE_W] + frame_r[1:]
        cv.stamp(*EYE_L_POS, eye(frame_l, IRIS[mood]), LEGEND)
        cv.stamp(*EYE_R_POS, eye(frame_r, IRIS[mood]), LEGEND)

    # brows sit over the bangs, 90s style
    for (ax, ay), (bx, by) in BROWS[mood]:
        img = mask_of(lambda d: d.line([(ax, ay), (bx, by)], fill=1))
        for y in range(N):
            for x in range(N):
                if img.getpixel((x, y)):
                    cv.col[y][x] = C["K"]
                    cv.col[y - 1][x] = C["Hd"]

    # nose
    cv.col[39][33] = C["s"]
    cv.col[40][33] = C["s"]
    cv.col[41][32] = C["r"]
    # blush hatching
    for bx in (17, 20, 23, 38, 41, 44):
        cv.col[38][bx + 1] = C["B"]
        cv.col[39][bx] = C["B"]

    mouth = MOUTHS[mood]["idle" if frame == "blink" else frame]
    cv.stamp(28, 44, mouth, LEGEND)


    # gold cord buttons at the band ends
    cv.col[12][14] = C["Y"]
    cv.col[12][49] = C["Y"]
    cv.stamp(25, 0, BADGE, LEGEND)
    return cv.image()


FRAMES = ["idle", "talk_a", "talk_b", "blink"]
MOODS = ["normal", "determined", "alarmed"]  # one sheet row each


def main(out):
    sheet = Image.new("RGBA", (N * len(FRAMES), N * len(MOODS)), (0, 0, 0, 0))
    for row, mood in enumerate(MOODS):
        for col, f in enumerate(FRAMES):
            sheet.paste(build(f, mood), (N * col, N * row))
    sheet.save(f"{out}/officer64_sheet_transparent.png")
    bg = Image.new("RGBA", sheet.size, (0, 0, 0, 255))
    bg.alpha_composite(sheet)
    bg.save(f"{out}/officer64_sheet.png")
    bg.resize((sheet.width * 5, sheet.height * 5), Image.NEAREST).save(f"{out}/officer64_preview.png")


if __name__ == "__main__":
    main(sys.argv[1])

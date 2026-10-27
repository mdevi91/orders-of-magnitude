"""Orion Syndicate: trade-lane megacorp. Navy/charcoal suits, white shirts, cyan holo glow, a
touch of corporate gold, and the ringed-orbit "O" logo on everyone.

Roles: merchant (grinning sales rep), mechanic (hard-hat contractor), pilot (visored bounty
hunter), commander (silver-haired CEO with a holo halo).
"""
from portraitlib import Canvas, N, iris_pal, mask_of, mirror, EYE_FRAME_L, EYE_FRAME_R, EYE_W

# ---------- shared palette ----------
K = (14, 12, 26)            # ink: navy-black so outlines sit in the corporate palette
NAVY = (36, 50, 98)
NAVY_D = (22, 28, 60)
NAVY_L = (66, 92, 160)
NAVY_R = (120, 160, 228)    # rim light so navy reads on a black background
CHAR = (60, 62, 74)
CHAR_D = (36, 37, 48)
CHAR_L = (104, 108, 124)
CHAR_R = (156, 162, 182)
SHIRT = (242, 246, 252)
SHIRT_D = (178, 192, 218)
CY = (70, 228, 250)         # holo cyan
CY_D = (24, 140, 192)
CY_DD = (14, 74, 120)
CY_L = (210, 255, 255)
GOLD = (255, 206, 84)
GOLD_D = (190, 132, 36)
TEETH = (255, 252, 244)
MOUTH = (90, 20, 34)


def skin(base, shadow, deep, ink):
    return {"S": base, "s": shadow, "r": deep, "k": ink}


def new_canvas(sk, extra=None):
    """Shared layer stack; skin layers are inked with the skin's own dark tone."""
    layers = {
        "holo": (1, CY_DD),       # CEO halo / screens behind the figure
        "hairback": (2, K),
        "neck": (3, sk["k"]),
        "body": (4, K),
        "shirt": (5, K),
        "tie": (6, K),
        "lapel": (7, K),
        "collar": (8, K),
        "ear": (9, sk["k"]),
        "face": (10, sk["k"]),
        "hair": (11, K),
        "hat": (12, K),
        "brim": (13, K),
        "gear": (14, K),
        "prop": (15, K),
    }
    if extra:
        layers.update(extra)
    return Canvas(layers)


def everywhere(d):
    d.rectangle([0, -12, N, N], fill=1)


# ---------- stamps ----------
# ringed orbit "O": gold ring crossed by a cyan orbit line
LOGO = [
    "..YYY..",
    ".Y...Y.",
    "cYcccYc",
    ".Y...Y.",
    "..YYY..",
]
LOGO_PAL = {"Y": GOLD, "c": CY}
LOGO_BIG = [
    "...YYYYY...",
    "..YY...YY..",
    ".cY.....Yc.",
    "cYcc...ccYc",
    "..Y..cccYc.",
    "..YY...YY..",
    "...YYYYY...",
]


def logo(cv, x, y, big=False, pal=None):
    cv.stamp(x, y, LOGO_BIG if big else LOGO, pal or LOGO_PAL)


def lidded_eye(frame, iris, lid):
    """Eye stamp with the lash pushed `lid` rows down over the iris (narrow / half-lidded eyes).
    The rows above the lash are left transparent so the face shows through."""
    out = []
    for i in range(len(frame)):
        if i < lid:
            out.append("." * EYE_W)
        elif i < lid + 2:
            out.append(frame[i - lid])              # the two lash rows, moved down
        else:
            row = frame[i]
            if "#" in row:
                j = row.index("#")
                if i < lid + 3:                     # drop the outer flick under a moved lash
                    row = "." * len(row)
                row = row[:j] + iris[i - 2] + row[j + 8:]
            out.append(row)
    return out


def eye_pair(cv, pal, iris, lid=0, y=26, inset=15):
    cv.stamp(inset, y, lidded_eye(EYE_FRAME_L, iris, lid), pal)
    cv.stamp(N - inset - EYE_W, y, lidded_eye(EYE_FRAME_R, iris, lid), pal)


def ring(cv, box, width):
    """Hollow ellipse on the 'holo' layer: fill it, then punch the inside back to empty."""
    x0, y0, x1, y1 = box
    cv.ellipse("holo", CY_D, box)
    hole = mask_of(lambda d: d.ellipse((x0 + width, y0 + width, x1 - width, y1 - width), fill=1))
    for y in range(-12, N):
        for x in range(N):
            if hole.get(x, y) and cv.layer[y][x] == "holo":
                cv.layer[y][x] = cv.col[y][x] = None
                cv.z[y][x] = 0


def brow(cv, a, b, color=K, under=None):
    cv.line([a, b], color)
    if under:
        cv.line([(a[0], a[1] - 1), (b[0], b[1] - 1)], under)


def face_shadow(cv, sk, pts):
    """Right-side cel shadow on the face."""
    cv.shade({"face"}, sk["s"], lambda d: d.polygon(pts, fill=1))


def suit(cv, base, dark, light, rim, shoulders=(0, 63), v_top=50, v_bottom=63, tie=None):
    """Suit jacket across the bottom: shoulders, white shirt V, optional tie, lapels."""
    l, r = shoulders
    cv.poly("body", base, [(l, 57), (8, 52), (20, 50), (43, 50), (55, 52), (r, 57), (r, 63), (l, 63)])
    cv.poly("shirt", SHIRT, [(24, v_top - 2), (39, v_top - 2), (35, v_bottom), (28, v_bottom)])
    if tie:
        tie(cv)
    lapel = [(20, 50), (25, 49), (30, 60), (28, 63), (17, 63), (19, 56)]
    cv.poly("lapel", base, lapel)
    cv.poly("lapel", base, mirror(lapel))
    # cel shading: right half darker, rim light along the left shoulder
    cv.shade({"body", "lapel"}, dark, lambda d: d.polygon([(36, 48), (64, 48), (64, 64), (34, 64)], fill=1))
    cv.shade({"body"}, rim, lambda d: d.line([(0, 57), (8, 53), (17, 51)], fill=1))
    cv.shade({"body"}, light, lambda d: d.line([(0, 58), (8, 54), (17, 52)], fill=1))
    cv.shade({"body"}, light, lambda d: d.line([(46, 52), (55, 53), (63, 57)], fill=1))
    cv.shade({"lapel"}, light, lambda d: d.line([(21, 51), (26, 61)], fill=1))
    cv.shade({"shirt"}, SHIRT_D, lambda d: d.polygon([(32, 40), (40, 40), (36, 64), (32, 64)], fill=1))


# ======================================================================
# merchant: young sales rep, slick side-parted hair, enormous fake smile, earpiece + lanyard
# ======================================================================
def merchant():
    sk = skin((236, 190, 150), (204, 146, 108), (160, 98, 74), (116, 60, 46))
    hair, hair_d, hair_l = (40, 30, 34), (22, 16, 22), (120, 104, 120)
    cv = new_canvas(sk)

    cv.poly("neck", sk["S"], [(25, 42), (38, 42), (38, 53), (25, 53)])

    def tie(cv):
        cv.poly("tie", CY_D, [(29, 50), (34, 50), (35, 60), (31.5, 63), (28, 60)])
        cv.poly("tie", CY_D, [(29, 48), (34, 48), (33, 51), (30, 51)])
    suit(cv, NAVY, NAVY_D, NAVY_L, NAVY_R, tie=tie)
    cv.shade({"tie"}, CY, lambda d: d.line([(30, 52), (32, 60)], fill=1))

    # squarish young-male face
    face = [(13, 13), (13, 34), (15, 42), (21, 48), (27, 52), (36, 52), (42, 48), (48, 42),
            (50, 34), (50, 13)]
    cv.poly("face", sk["S"], face)
    cv.ellipse("ear", sk["S"], (9, 26, 15, 37))
    cv.ellipse("ear", sk["S"], (48, 26, 54, 37))

    # slicked side-part: dome sweeping right, forehead exposed, one glossy curl at the part
    cv.poly("hair", hair, [(11, 26), (10, 14), (13, 7), (21, 2), (32, 0), (43, 2), (51, 7), (53, 14),
                           (52, 26), (50, 18), (46, 14), (36, 12), (24, 14), (18, 13), (14, 18)])
    cv.poly("hair", hair, [(18, 13), (14, 11), (24, 9), (30, 13)])     # swoop over the part
    cv.shade({"hair"}, hair_d, lambda d: d.polygon([(40, 0), (56, 6), (56, 28), (46, 12)], fill=1))
    cv.shade({"hair"}, hair_l, lambda d: d.line([(14, 12), (20, 6), (30, 3)], fill=1))
    cv.shade({"hair"}, hair_l, lambda d: d.line([(22, 10), (34, 6), (42, 6)], fill=1))
    cv.shade({"hair"}, (200, 196, 220), lambda d: d.point([(18, 8), (19, 7), (28, 6)], fill=1))

    face_shadow(cv, sk, [(42, 12), (51, 12), (51, 36), (46, 45), (37, 52), (42, 46), (45, 36)])
    cv.shade_below("face", "hair", sk["s"], 1)
    cv.shade({"neck"}, sk["r"], lambda d: d.rectangle([0, 0, N, 47], fill=1))
    cv.shade({"ear"}, sk["s"], lambda d: d.rectangle([47, 0, N, N], fill=1))

    # earpiece on his right ear (viewer's left) with a mic boom toward the mouth
    cv.poly("gear", CHAR, [(8, 27), (13, 27), (13, 35), (8, 35)])
    cv.line([(12, 36), (14, 41), (20, 44)], CHAR_D)

    cv.outline()

    cv.px(9, 28, CHAR_R)
    cv.px(10, 31, CY)
    cv.px(11, 31, CY)
    cv.px(21, 44, CY)                       # mic tip glow
    cv.px(20, 44, CHAR_L)

    # lanyard: cyan straps from behind the collar to a badge at the bottom-left of the chest
    cv.line([(21, 50), (17, 54)], CY_D, layers={"body", "lapel"})
    cv.line([(42, 50), (22, 55)], CY_D, layers={"body", "lapel", "shirt", "tie"})
    cv.stamp(13, 53, [
        "KKKKKKKKKK",
        "KWWWWWWWWK",
        "KWbbYYYbWK",
        "KWbYbbbYWK",
        "KWcYcccYcK",
        "KWbYbbbYWK",
        "KWbbYYYbWK",
        "KWWWWWWWWK",
    ], {"K": K, "W": SHIRT, "b": SHIRT, "Y": GOLD_D, "c": CY_D})

    pal = iris_pal((70, 34, 14), (176, 108, 40), (240, 196, 110), outline=K)
    eye_pair(cv, pal, IRIS_SMALL_PUPIL, lid=1, y=25)
    # brows arched high: the eyes are not in on the joke
    brow(cv, (17, 22), (21, 20), K)
    brow(cv, (22, 20), (27, 21), K)
    brow(cv, (36, 21), (41, 20), K)
    brow(cv, (42, 20), (46, 22), K)
    # nose
    cv.px(33, 38, sk["s"]); cv.px(33, 39, sk["s"]); cv.px(32, 40, sk["r"])
    # huge toothy grin with dimples
    cv.stamp(22, 42, [
        "K..............K",
        ".KKKKKKKKKKKKKK.",
        "..KTTTTTTTTTTK..",
        "..KTtTtTtTtTTK..",
        "...KmmmmmmmmK...",
        "....KKKKKKKK....",
    ], {"K": sk["k"], "T": TEETH, "t": (210, 210, 220), "m": MOUTH})
    cv.px(20, 41, sk["s"]); cv.px(43, 41, sk["s"])
    return cv.image(shift=1)


IRIS_SMALL_PUPIL = [
    "WeeeeeeW",
    "WwweeeeW",
    "WwwEEEEW",
    "WEEEPEEW",
    "WEEPPEEW",
    "WEEEEEwW",
    "WpEEEEpW",
    ".pppppp.",
]


# ======================================================================
# mechanic: older contractor, dark skin, logo hard hat, hi-vis vest, stubble, stylus, tablet
# ======================================================================
def mechanic():
    sk = skin((150, 96, 66), (114, 68, 46), (84, 46, 34), (52, 24, 20))
    cv = new_canvas(sk)
    HAT, HAT_D, HAT_L = (236, 238, 244), (168, 176, 196), (255, 255, 255)
    VIS, VIS_D, VIS_L = (214, 246, 40), (150, 186, 20), (240, 255, 140)
    REFL = (210, 220, 236)

    cv.poly("neck", sk["S"], [(23, 42), (40, 42), (40, 53), (23, 53)])
    # charcoal work shirt with a navy collar, then the vest over it
    cv.poly("body", CHAR, [(0, 55), (8, 50), (22, 48), (41, 48), (55, 50), (63, 55), (63, 63), (0, 63)])
    cv.poly("collar", NAVY, [(21, 47), (28, 50), (31, 56), (24, 57), (18, 52)])
    cv.poly("collar", NAVY, mirror([(21, 47), (28, 50), (31, 56), (24, 57), (18, 52)]))
    vest = [(0, 56), (6, 52), (16, 50), (24, 56), (27, 63), (0, 63)]
    cv.poly("lapel", VIS, vest)
    cv.poly("lapel", VIS, mirror(vest))
    cv.shade({"lapel"}, VIS_D, lambda d: d.rectangle([34, 40, 64, 64], fill=1))
    cv.shade({"lapel"}, VIS_L, lambda d: d.line([(1, 56), (7, 53), (14, 51)], fill=1))
    # reflective stripes
    for y0 in (55, 58):
        cv.shade({"lapel"}, REFL, lambda d, y0=y0: d.line([(0, y0), (27, y0)], fill=1))
    cv.shade({"body"}, CHAR_D, lambda d: d.rectangle([32, 40, 64, 64], fill=1))

    # broad, older face, heavy jaw
    face = [(12, 15), (12, 36), (15, 44), (21, 50), (26, 53), (37, 53), (42, 50), (48, 44),
            (51, 36), (51, 15)]
    cv.poly("face", sk["S"], face)
    cv.ellipse("ear", sk["S"], (8, 26, 15, 37))
    cv.ellipse("ear", sk["S"], (48, 26, 55, 37))
    # cropped grey-black hair at the temples
    cv.poly("hair", (40, 36, 40), [(11, 30), (11, 16), (16, 16), (14, 30)])
    cv.poly("hair", (40, 36, 40), mirror([(11, 30), (11, 16), (16, 16), (14, 30)]))

    # hard hat: dome + wide brim, sits low over the brow
    cv.poly("hat", HAT, [(12, 15), (12, 7), (17, 1), (25, -1), (38, -1), (46, 1), (51, 7), (51, 15)])
    cv.poly("brim", HAT, [(5, 15), (8, 12), (55, 12), (58, 15), (56, 17), (7, 17)])
    cv.poly("hat", HAT, [(29, -2), (34, -2), (35, 12), (28, 12)])   # centre ridge
    cv.shade({"hat", "brim"}, HAT_D, lambda d: d.polygon([(40, -6), (60, -6), (60, 20), (40, 20)], fill=1))
    cv.shade({"hat"}, HAT_L, lambda d: d.line([(14, 8), (17, 2), (23, -1)], fill=1))
    cv.shade({"brim"}, NAVY, lambda d: d.line([(6, 16), (57, 16)], fill=1))

    face_shadow(cv, sk, [(43, 15), (52, 15), (52, 38), (46, 47), (38, 53), (43, 46), (46, 38)])
    cv.shade_below("face", "brim", sk["s"], 2)
    cv.shade({"neck"}, sk["r"], lambda d: d.rectangle([0, 0, N, 48], fill=1))
    cv.shade({"ear"}, sk["s"], lambda d: d.rectangle([47, 0, N, N], fill=1))

    # stylus tucked behind his right ear
    cv.poly("prop", GOLD, [(4, 24), (6, 23), (15, 33), (13, 34)])
    # tablet held up in the lower right corner, screen glowing
    cv.poly("prop", CHAR_D, [(44, 63), (47, 52), (63, 50), (63, 63)])
    cv.poly("prop", CY_D, [(47, 62), (49, 54), (63, 52), (63, 62)])

    cv.outline()

    logo(cv, 28, 4)
    cv.px(5, 24, CHAR_D)                                    # stylus tip
    # tablet UI: a few scanlines and a glowing bar chart
    cv.line([(50, 56), (60, 55)], CY)
    cv.line([(50, 58), (57, 57)], CY_L)
    cv.line([(50, 60), (61, 59)], CY)

    pal = iris_pal((40, 22, 14), (110, 70, 40), (190, 140, 90), outline=K)
    eye_pair(cv, pal, IRIS_SMALL_PUPIL, lid=3, y=24, inset=16)
    # thick level brows, crow's feet
    brow(cv, (16, 25), (27, 25), K)
    brow(cv, (16, 24), (26, 24), K)
    brow(cv, (36, 25), (47, 25), K)
    brow(cv, (37, 24), (47, 24), K)
    for x, y in ((15, 33), (48, 33)):
        cv.px(x, y, sk["r"])
    # nose: broad
    cv.line([(31, 39), (35, 39)], sk["r"])
    cv.px(33, 37, sk["s"])
    # stubble: dithered dots on the jaw and upper lip
    stub = (96, 62, 46)
    for y in range(41, 53):
        for x in range(14, 50):
            if cv.layer[y][x] == "face" and (x + 2 * y) % 4 == 0 and (y >= 46 or x < 19 or x > 44 or y == 41):
                cv.px(x, y, stub)
    # flat, tired mouth
    cv.stamp(27, 44, ["KKKKKKKKK", ".rrrrrrr."], {"K": sk["k"], "r": sk["r"]})
    return cv.image(shift=3)


# ======================================================================
# pilot: bounty hunter, pale, short asymmetric auburn hair, HUD visor over one eye, scar,
# armoured collar
# ======================================================================
def pilot():
    sk = skin((250, 226, 214), (226, 178, 168), (184, 124, 124), (140, 70, 76))
    HAIR, HAIR_D, HAIR_L, HAIR_R = (150, 50, 40), (92, 26, 30), (212, 96, 60), (255, 150, 90)
    cv = new_canvas(sk)

    cv.poly("hairback", HAIR_D, [(10, 10), (54, 10), (55, 40), (50, 46), (13, 46), (9, 36)])
    cv.poly("neck", sk["S"], [(26, 44), (37, 44), (37, 52), (26, 52)])

    # armoured flight suit: charcoal with plated high collar
    cv.poly("body", CHAR, [(0, 56), (6, 51), (20, 50), (43, 50), (57, 51), (63, 56), (63, 63), (0, 63)])
    collar = [(14, 46), (24, 50), (31, 53), (31, 63), (12, 63), (8, 53)]
    cv.poly("collar", CHAR_L, collar)
    cv.poly("collar", CHAR_L, mirror(collar))
    cv.shade({"collar", "body"}, CHAR_D, lambda d: d.rectangle([33, 40, 64, 64], fill=1))
    cv.shade({"collar"}, CHAR_R, lambda d: d.line([(9, 53), (14, 47)], fill=1))
    cv.shade({"body"}, CHAR_R, lambda d: d.line([(0, 56), (6, 52)], fill=1))
    # plate seams + gold rivets on the collar
    cv.shade({"collar"}, CHAR, lambda d: d.line([(10, 57), (31, 57)], fill=1))
    cv.shade({"collar"}, NAVY_D, lambda d: d.line([(32, 57), (54, 57)], fill=1))
    # cyan edge-lit trim along the top of the plates
    cv.shade({"collar"}, CY, lambda d: d.line([(10, 52), (15, 48), (24, 51), (30, 54)], fill=1))
    cv.shade({"collar"}, CY_D, lambda d: d.line([(33, 54), (39, 51), (48, 48), (53, 52)], fill=1))

    # narrow V face, sharp chin
    face = [(14, 14), (14, 33), (16, 41), (21, 47), (28, 53), (31, 54), (34, 53), (42, 47),
            (47, 41), (49, 33), (49, 14)]
    cv.poly("face", sk["S"], face)

    # short hair, heavy fringe swept to the viewer's right, shaved on the left side
    cv.poly("hair", HAIR, [(13, 26), (12, 12), (16, 5), (26, 1), (38, 1), (48, 5), (53, 13),
                           (54, 30), (52, 42), (49, 36), (48, 24), (44, 18), (38, 22), (34, 17),
                           (26, 21), (22, 16), (16, 20), (15, 28)])
    cv.shade({"hair"}, HAIR_D, lambda d: d.polygon([(42, 0), (60, 8), (60, 44), (46, 20)], fill=1))
    cv.shade({"hair"}, HAIR_L, lambda d: d.line([(15, 12), (22, 6), (32, 4)], fill=1))
    cv.shade({"hair"}, HAIR_R, lambda d: d.line([(12, 14), (13, 24)], fill=1))
    cv.shade({"hair", "hairback"}, HAIR_D, lambda d: d.line([(30, 6), (26, 18)], fill=1))
    cv.shade({"hair"}, HAIR_D, lambda d: d.line([(40, 6), (44, 16)], fill=1))

    face_shadow(cv, sk, [(42, 14), (50, 14), (50, 34), (44, 44), (34, 53), (40, 45), (44, 35)])
    cv.shade_below("face", "hair", sk["s"], 2)
    cv.shade({"neck"}, sk["r"], lambda d: d.rectangle([0, 0, N, 48], fill=1))

    # HUD monocle over her left eye (viewer's right): frame band from the ear across the eye
    cv.poly("gear", CHAR_D, [(34, 26), (53, 24), (55, 30), (53, 35), (34, 36)])
    cv.poly("gear", CY, [(36, 27), (50, 26), (50, 34), (36, 34)])
    cv.shade({"gear"}, CY_D, lambda d: d.polygon([(43, 26), (51, 26), (51, 35), (40, 35)], fill=1))

    cv.outline()

    # HUD glyphs: reticle + readout lines
    cv.stamp(37, 28, [
        "..L.....",
        ".LLL..dd",
        "..L.....",
        "......d.",
        "dddd....",
    ], {"L": CY_L, "d": CY_DD})
    cv.px(54, 27, (255, 80, 90))                            # red record light

    pal = iris_pal((24, 70, 90), (40, 150, 170), (150, 230, 230), outline=K)
    cv.stamp(15, 25, lidded_eye(EYE_FRAME_L, IRIS_SMALL_PUPIL, 2), pal)
    brow(cv, (16, 23), (27, 25), K)
    # scar: from brow across the cheek on her right side (viewer's left)
    cv.line([(18, 20), (21, 23)], sk["r"])
    cv.line([(20, 35), (25, 42)], sk["r"])
    cv.line([(21, 35), (26, 42)], (255, 244, 238))     # raised scar tissue catches the light
    # nose + small flat mouth, a hint of a smirk on the left
    cv.px(32, 39, sk["s"]); cv.px(32, 40, sk["s"]); cv.px(31, 41, sk["r"])
    cv.stamp(28, 45, ["KKKKKK.", ".....KK"], {"K": sk["k"]})
    logo(cv, 18, 58)
    return cv.image(shift=1)


# ======================================================================
# commander: CEO, older woman, silver swept-back hair, cold half-lidded eyes, tall collar,
# holo tie, giant orbit-ring halo behind her (biggest silhouette)
# ======================================================================
def commander():
    sk = skin((246, 214, 184), (216, 168, 140), (176, 120, 104), (120, 66, 60))
    SIL, SIL_D, SIL_L = (196, 204, 218), (124, 134, 158), (248, 250, 255)
    cv = new_canvas(sk)

    # holo halo: her head is the "O" of the logo and a wide tilted orbit ring circles behind it,
    # stretching the silhouette edge to edge
    ring(cv, (-6, 4, 69, 26), 3)

    cv.poly("neck", sk["S"], [(26, 42), (37, 42), (37, 52), (26, 52)])

    def tie(cv):
        cv.poly("tie", CY, [(29, 49), (34, 49), (36, 60), (31.5, 64), (27, 60)])
    suit(cv, CHAR_D, (24, 24, 34), CHAR, CHAR_R, tie=tie)
    # holographic tie: scanlines + glow edge
    for y in range(50, 64, 2):
        cv.shade({"tie"}, CY_L, lambda d, y=y: d.line([(26, y), (37, y)], fill=1))
    cv.shade({"tie"}, CY_D, lambda d: d.polygon([(33, 48), (40, 48), (40, 64), (32, 64)], fill=1))

    # tall stand collar flaring up to the jaw
    collar = [(9, 31), (16, 40), (24, 49), (28, 57), (16, 59), (4, 52)]
    cv.poly("collar", NAVY, collar)
    cv.poly("collar", NAVY, mirror(collar))
    cv.shade({"collar"}, NAVY_D, lambda d: d.rectangle([33, 30, 64, 64], fill=1))
    cv.shade({"collar"}, NAVY_R, lambda d: d.line([(5, 51), (9, 33)], fill=1))
    cv.shade({"collar"}, NAVY_L, lambda d: d.line([(6, 51), (10, 35)], fill=1))
    cv.shade({"collar"}, GOLD, lambda d: d.line([(10, 33), (24, 49)], fill=1))
    cv.shade({"collar"}, GOLD_D, lambda d: d.line([(53, 33), (39, 49)], fill=1))

    # long, angular older face
    face = [(15, 12), (15, 34), (17, 42), (22, 48), (28, 52), (35, 52), (41, 48), (46, 42),
            (48, 34), (48, 12)]
    cv.poly("face", sk["S"], face)

    # swept-back silver hair: high volume, no fringe, falls to the collar at the back
    cv.poly("hairback", (90, 98, 122), [(13, 14), (50, 14), (51, 30), (12, 30)])
    # swept-back tails flaring out behind the temples so the hair reads as combed back, not a cap
    tail = [(14, 6), (9, 11), (8, 20), (10, 26), (13, 26)]
    cv.poly("hairback", SIL_D, tail)
    cv.poly("hairback", (90, 98, 122), mirror(tail))
    cv.poly("hair", SIL, [(14, 24), (12, 12), (15, 3), (22, -3), (32, -5), (42, -3), (49, 3),
                          (51, 12), (49, 24), (47, 15), (40, 10), (32, 13), (24, 10), (16, 16)])
    cv.shade({"hair"}, SIL_D, lambda d: d.polygon([(40, -6), (56, 2), (56, 26), (44, 10)], fill=1))
    for a, b in [((16, 14), (24, 0)), ((22, 10), (30, -3)), ((32, 9), (38, -3))]:
        cv.shade({"hair"}, SIL_L, lambda d, a=a, b=b: d.line([a, b], fill=1))
    cv.shade({"hair"}, SIL_D, lambda d: d.line([(28, 10), (34, -2)], fill=1))
    cv.shade({"hair"}, SIL_D, lambda d: d.line([(18, 13), (14, 6)], fill=1))
    cv.shade({"hair"}, SIL_D, lambda d: d.line([(45, 13), (48, 6)], fill=1))

    face_shadow(cv, sk, [(41, 12), (49, 12), (49, 34), (44, 44), (35, 52), (40, 45), (43, 35)])
    cv.shade_below("face", "hair", sk["s"], 1)
    cv.shade({"neck"}, sk["r"], lambda d: d.rectangle([0, 0, N, 47], fill=1))

    cv.outline()

    # halo detail: brighter top arc + floating ticker dots
    cv.line([(1, 10), (12, 6), (32, 5), (51, 6), (62, 10)], CY, layers={"holo"})
    for x, y in ((4, 20), (58, 20), (60, 14)):
        cv.px(x, y, CY_L)
    logo(cv, 10, 46, pal={"Y": GOLD, "c": CY_L})

    pal = iris_pal((60, 70, 90), (130, 150, 176), (210, 224, 236), outline=K,
                   white=(236, 240, 246))
    eye_pair(cv, pal, IRIS_SMALL_PUPIL, lid=3, y=23, inset=16)
    brow(cv, (17, 24), (27, 23), SIL_D)
    brow(cv, (36, 23), (46, 24), SIL_D)
    # age lines under the eyes and at the mouth corners
    cv.line([(19, 35), (25, 35)], sk["s"])
    cv.line([(38, 35), (44, 35)], sk["s"])
    cv.px(26, 44, sk["s"]); cv.px(37, 44, sk["s"])
    # nose, thin dark lips
    cv.px(32, 37, sk["s"]); cv.px(32, 38, sk["s"]); cv.px(31, 39, sk["r"])
    cv.stamp(27, 44, [".KKKKKKKK.", "..LLLLLL.."], {"K": (110, 40, 56), "L": (170, 80, 96)})
    return cv.image(shift=5)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

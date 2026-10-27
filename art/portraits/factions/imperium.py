"""The Imperium: crimson, gold and near-black military uniforms, peaked caps, rank insignia.

Same palette and cap language as the reference officer (the pilot, loaded from
art/officer-portrait/gen_officer64.py). Light from the upper left: cel shadow on the right side
of each shape, a rim of light on the left.

  merchant   quartermaster: older man, garrison cap, monocle, neat moustache, high collar
  mechanic   tech-sergeant: dark-skinned woman, buzz cut, comm headset, cybernetic eye, tool harness
  pilot      the reference officer
  commander  Grand Admiral: white beard, scar, towering gold-braided cap, epaulettes, medals
"""
import os
import sys

from portraitlib import Canvas, N, eyes, iris_pal, mirror

_OFFICER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "officer-portrait")

# ---------- faction palette (shared with gen_officer64) ----------
K = (22, 6, 10)            # ink outline
CAP = (186, 40, 30)
CAP_D = (120, 24, 22)
CAP_L = (236, 86, 52)
BRIM = (26, 8, 10)
BRIM_L = (96, 34, 34)
BRIM_S = (170, 90, 80)
BAND = (70, 16, 18)
GOLD = (255, 214, 70)
GOLD_D = (220, 140, 30)
GOLD_L = (255, 246, 170)
UNI = (58, 18, 24)
UNI_L = (104, 30, 32)
UNI_D = (38, 10, 16)
TAB = (232, 50, 30)        # rank-tab red
STEEL = (92, 84, 96)
STEEL_L = (150, 142, 156)
STEEL_D = (52, 44, 56)
WHITE = (255, 248, 232)

# char legend shared by the small stamps (badges, medals)
STAMP_PAL = {"K": K, "Y": GOLD, "y": GOLD_D, "L": GOLD_L, "O": TAB, "R": CAP, "D": CAP_D,
             "W": WHITE, "S": STEEL, "s": STEEL_L, "B": (70, 120, 200), "b": (150, 200, 250),
             "G": (60, 140, 80), "U": UNI}

# winged Imperium badge, same motif as the officer's cap
BADGE = [
    "......Y......",
    "YY...YyY...YY",
    ".YYYYyOyYYYY.",
    "..yyYYyYYyy..",
    "....yYYYy....",
    "......y......",
]


def skin(light, mid, deep, ink):
    return {"S": light, "s": mid, "r": deep, "k": ink}


# ---------- small "grown-up" eye (12x6), for the older / harder faces ----------
# '#' is a 4x3 iris slot filled left-to-right, so the highlight stays upper-left on both eyes.
SMALL_EYE_L = [
    "...KKKKKKK..",
    ".KKKKKKKKKKK",
    "KK.W####W.K.",
    "...W####W...",
    "...W####W...",
    "....KKKK....",
]
SMALL_IRIS = ["weEe", "ePPE", "pEEp"]


def small_eye(cv, x0, y0, pal, right=False, lid_drop=0, iris=SMALL_IRIS):
    frame = [r[::-1] for r in SMALL_EYE_L] if right else SMALL_EYE_L
    frame = ["." * 12] * lid_drop + frame[lid_drop:]
    rows, k = [], 0
    for row in frame:
        if "#" in row:
            i = row.index("#")
            row = row[:i] + iris[k] + row[i + 4:]
            k += 1
        rows.append(row)
    cv.stamp(x0, y0, rows, pal)


def thick_line(cv, pts, color, width=2, layers=None):
    """Brows/scars: a line repeated `width` rows downwards."""
    for w in range(width):
        cv.line([(x, y + w) for x, y in pts], color, layers)


def cel_face(cv, sk, face_right_edge, chin_y):
    """Standard cel shadow on the right cheek + jaw underside."""
    x1 = face_right_edge
    cv.shade({"face"}, sk["s"], lambda d: d.polygon(
        [(x1 - 7, 10), (x1 + 2, 10), (x1 + 2, chin_y - 18), (x1 - 3, chin_y - 8),
         (x1 - 13, chin_y + 1), (x1 - 8, chin_y - 8), (x1 - 4, chin_y - 18)], fill=1))


# =====================================================================
# merchant: the quartermaster
# =====================================================================
def merchant():
    sk = skin((240, 198, 160), (212, 150, 116), (170, 104, 84), (120, 56, 44))
    HAIR, HAIR_D, HAIR_L = (150, 140, 146), (96, 86, 98), (210, 204, 208)
    cv = Canvas({
        "hairback": (1, K), "ears": (2, sk["k"]), "neck": (3, sk["k"]), "uniform": (4, K),
        "collar": (5, K), "face": (6, sk["k"]), "hair": (7, K), "cap": (8, K), "curtain": (9, K),
        "lens": (10, K),
    })
    # head, ears, neck
    cv.poly("hairback", HAIR_D, [(13, 12), (17, 5), (46, 5), (50, 12), (51, 28), (12, 28)])
    cv.ellipse("ears", sk["S"], (11, 25, 16, 34))
    cv.ellipse("ears", sk["S"], (47, 25, 52, 34))
    cv.poly("neck", sk["s"], [(25, 42), (38, 42), (38, 52), (25, 52)])
    # a clerk's narrower shoulders, buttoned tunic
    cv.poly("uniform", UNI, [(0, 58), (6, 53), (20, 50), (43, 50), (57, 53), (63, 58), (63, 63), (0, 63)])
    # tall standing collar right up under the jaw
    cv.poly("collar", CAP_D, [(21, 44), (42, 44), (44, 56), (19, 56)])
    face = [(15, 12), (15, 33), (17, 40), (22, 46), (28, 50), (35, 50), (41, 46), (46, 40),
            (48, 33), (48, 12)]
    cv.poly("face", sk["S"], face)
    # neat, side-parted short hair, grey at the temples
    cv.poly("hair", HAIR, [(14, 9), (49, 9), (49, 22), (47, 22), (45, 15), (30, 14), (21, 16),
                           (17, 20), (16, 25), (14, 24)])
    cv.poly("hair", HAIR, [(14, 18), (17, 18), (17, 31), (15, 31)])
    cv.poly("hair", HAIR, [(46, 18), (49, 18), (48, 31), (46, 31)])
    # garrison (side) cap, tilted toward the viewer's left
    # narrower than the skull and peaked along the crease, so it reads as a side cap, not a beret
    cv.poly("cap", CAP, [(13, 13), (14, 6), (24, -1), (33, -4), (43, -1), (50, 4), (50, 10)])
    cv.poly("curtain", CAP_D, [(13, 13), (14, 8), (50, 3), (50, 10)])

    # ---- shading ----
    cv.shade({"hairback", "hair"}, HAIR_D, lambda d: d.rectangle([40, 0, 63, 40], fill=1))
    cv.line([(15, 19), (15, 30)], HAIR_L, {"hair"})
    cv.line([(20, 15), (29, 13)], HAIR_L, {"hair"})
    cv.line([(31, 14), (37, 11)], HAIR_D, {"hair"})   # side parting
    cel_face(cv, sk, 48, 50)
    cv.shade_below("face", "hair", sk["s"], 2)
    cv.shade({"ears"}, sk["s"], lambda d: d.rectangle([47, 0, 63, 63], fill=1))
    cv.shade({"neck"}, sk["r"], lambda d: d.rectangle([0, 0, 63, 46], fill=1))
    cv.shade({"cap"}, CAP_L, lambda d: d.polygon([(13, 7), (23, 0), (32, -3), (21, 5), (14, 10)], fill=1))
    cv.shade({"cap"}, CAP_D, lambda d: d.polygon([(39, -2), (51, 4), (51, 10), (40, 7)], fill=1))
    cv.line([(14, 8), (50, 3)], GOLD, {"curtain"})          # piping along the turn-up
    cv.line([(33, -3), (33, 5)], CAP_D, {"cap"})             # centre crease
    cv.line([(19, 45), (43, 45)], GOLD, {"collar"})
    cv.line([(31, 46), (31, 63)], GOLD, {"collar", "uniform"})
    cv.line([(32, 46), (32, 63)], GOLD_D, {"collar", "uniform"})
    cv.line([(2, 58), (16, 53)], UNI_L, {"uniform"})
    cv.line([(47, 53), (61, 58)], UNI_L, {"uniform"})

    cv.outline()

    # ---- details ----
    # collar: rank pips (two gold dots each side) + tunic buttons
    for x in (23, 25, 38, 40):
        cv.px(x, 50, GOLD)
    for y in (58, 61):
        cv.px(29, y, GOLD)
        cv.px(34, y, GOLD)
    # cap badge on the curtain, front-left like a real side cap
    cv.stamp(18, 8, [".Y.", "YOY", ".y."], STAMP_PAL)

    pal = iris_pal((40, 60, 90), (80, 120, 160), (170, 200, 220))
    small_eye(cv, 18, 25, pal, lid_drop=1)
    small_eye(cv, 34, 25, pal, right=True, lid_drop=1)
    # neat grey brows
    thick_line(cv, [(18, 22), (28, 22)], HAIR_D)
    thick_line(cv, [(35, 22), (45, 22)], HAIR_D)
    # monocle over his left eye (viewer's right): gold rim, glassy glint, chain to the collar
    rim = [(33, 24), (35, 23), (44, 23), (46, 24), (47, 27), (46, 31), (44, 32), (35, 32),
           (33, 31), (32, 27)]
    for a, b in zip(rim, rim[1:] + rim[:1]):
        cv.line([a, b], GOLD if a[0] < 41 else GOLD_D)
    cv.px(35, 23, GOLD_L)
    cv.px(36, 23, GOLD_L)
    cv.px(45, 25, (220, 236, 255))
    cv.px(46, 26, (220, 236, 255))
    for i, (x, y) in enumerate([(46, 33), (47, 35), (46, 37), (46, 39), (45, 41), (44, 43), (43, 45)]):
        cv.px(x, y, GOLD if i % 2 else GOLD_D)
    # nose, crow's feet, smile lines
    cv.line([(33, 29), (33, 35)], sk["s"])
    cv.px(32, 36, sk["r"])
    cv.px(33, 36, sk["r"])
    cv.line([(16, 26), (17, 27)], sk["s"])
    cv.line([(21, 31), (27, 31)], sk["s"])     # tired under-eye bags
    cv.line([(37, 31), (43, 31)], sk["r"])
    cv.line([(23, 33), (21, 41)], sk["s"])
    cv.line([(40, 33), (42, 41)], sk["r"])
    # neat clipped moustache with tiny waxed tips
    cv.stamp(24, 37, [
        ".....KKKK.....",
        "..KKHHHHHHKK..",
        ".KHHHHHHHHhhK.",
        "K.KKKK..KKKK.K",
    ], {"K": K, "H": HAIR, "h": HAIR_D})
    cv.line([(28, 43), (35, 43)], sk["r"])
    return cv.image(shift=3)


# =====================================================================
# mechanic: the tech-sergeant
# =====================================================================
CYBER_EYE = [
    "..ssssss..",
    ".sKKKKKKS.",
    "sKoOOOOoKS",
    "sKOOwWOOKS",
    "sKOWWWWOKS",
    "sKoOWWOoKS",
    ".SKKKKKKS.",
    "..SSSSSS..",
]


def mechanic():
    sk = skin((178, 114, 80), (136, 82, 58), (100, 56, 42), (52, 20, 18))
    HAIR, HAIR_D = (40, 24, 26), (24, 12, 16)
    cv = Canvas({
        "head": (1, sk["k"]), "neck": (2, sk["k"]), "uniform": (3, K), "shirt": (4, K),
        "lapel": (5, K), "strap": (6, K), "face": (7, sk["k"]), "buzz": (8, K),
        "plate": (9, K), "band": (10, K), "cup": (11, K), "mic": (12, K),
    })
    cv.poly("head", sk["S"], [(14, 12), (18, 5), (26, 2), (37, 2), (45, 5), (49, 12), (50, 26), (13, 26)])
    cv.poly("neck", sk["S"], [(24, 42), (39, 42), (40, 54), (23, 54)])
    # broad working shoulders, coverall
    cv.poly("uniform", CAP_D, [(0, 53), (10, 49), (24, 50), (39, 50), (53, 49), (63, 53), (63, 63), (0, 63)])
    cv.poly("shirt", UNI_D, [(24, 50), (39, 50), (34, 61), (29, 61)])
    # open work collar: two stiff flaps
    cv.poly("lapel", CAP, [(16, 50), (24, 49), (30, 60), (23, 59)])
    cv.poly("lapel", CAP, mirror([(16, 50), (24, 49), (30, 60), (23, 59)]))
    # harness straps over the shoulders with tool loops
    cv.poly("strap", BAND, [(9, 50), (14, 49), (18, 63), (12, 63)])
    cv.poly("strap", BAND, mirror([(9, 50), (14, 49), (18, 63), (12, 63)]))
    face = [(15, 13), (15, 33), (17, 41), (22, 47), (28, 52), (35, 52), (41, 47), (46, 41),
            (48, 33), (48, 13)]
    cv.poly("face", sk["S"], face)
    # buzz cut: a thin cap of hair hugging the skull, square hairline
    cv.poly("buzz", HAIR, [(14, 13), (18, 5), (26, 2), (37, 2), (45, 5), (49, 13), (49, 22),
                           (47, 22), (46, 15), (38, 13), (25, 13), (17, 15), (16, 22), (14, 22)])
    # cyber plate around her left eye (viewer's right)
    cv.poly("plate", STEEL, [(35, 21), (45, 19), (50, 22), (50, 34), (45, 37), (36, 35), (34, 28)])
    # comm headset: band over the crown, ear cups, mic boom to the mouth
    cv.fill("band", STEEL, lambda d: d.line([(12, 28), (12, 14), (17, 5), (25, 1), (38, 1),
                                               (46, 5), (51, 14), (51, 28)], fill=1, width=3))
    cv.poly("cup", STEEL_D, [(8, 24), (16, 23), (17, 38), (9, 39), (7, 32)])
    cv.poly("cup", STEEL_D, mirror([(8, 24), (16, 23), (17, 38), (9, 39), (7, 32)]))
    # width 3 so a steel core survives the outline pass
    cv.fill("mic", STEEL, lambda d: d.line([(13, 37), (15, 43), (20, 47), (25, 48)], fill=1, width=3))

    # ---- shading ----
    # buzz-cut stipple so it reads as stubble, not a helmet
    cv.shade({"buzz"}, HAIR_D, lambda d: d.rectangle([40, 0, 63, 30], fill=1))
    for y in range(3, 22, 2):
        for x in range(15 + (y % 4), 49, 4):
            cv.shade({"buzz"}, (64, 42, 42), lambda d, x=x, y=y: d.point([(x, y)], fill=1))
    cel_face(cv, sk, 48, 52)
    cv.shade_below("face", "buzz", sk["s"], 1)
    cv.shade({"neck"}, sk["s"], lambda d: d.rectangle([0, 0, 63, 47], fill=1))
    cv.shade({"neck"}, sk["s"], lambda d: d.rectangle([34, 48, 63, 63], fill=1))
    cv.shade({"plate"}, STEEL_L, lambda d: d.polygon([(35, 21), (45, 19), (46, 21), (37, 23), (35, 28)], fill=1))
    cv.shade({"plate"}, STEEL_D, lambda d: d.polygon([(48, 22), (50, 22), (50, 34), (45, 37), (44, 35), (48, 32)], fill=1))
    cv.line([(12, 26), (12, 14), (17, 5), (25, 1), (31, 1)], STEEL_L, {"band"})
    cv.shade({"cup"}, STEEL, lambda d: d.polygon([(8, 25), (12, 24), (11, 36), (8, 33)], fill=1))
    cv.shade({"cup"}, STEEL, lambda d: d.polygon([(48, 25), (51, 24), (50, 36), (48, 33)], fill=1))
    cv.shade({"lapel"}, CAP_D, lambda d: d.rectangle([33, 0, 63, 63], fill=1))
    cv.line([(2, 54), (10, 51)], CAP, {"uniform"})
    cv.line([(16, 51), (22, 50)], CAP_L, {"lapel"})

    cv.outline()

    # ---- details ----
    # sergeant chevrons on the shoulders
    for x0 in (1, 53):
        cv.stamp(x0, 55, ["Y...Y", ".YyY.", "Y...Y", ".YyY."], STAMP_PAL)
    # tool loops on the straps: wrench on her right, screwdriver on her left
    cv.stamp(12, 54, ["sS.", "sSs", ".S.", ".S.", "sSs", "s.s"], STAMP_PAL)
    cv.stamp(48, 53, [".O.", ".O.", ".S.", ".s.", ".s."], STAMP_PAL)
    for y in (52, 60):
        cv.line([(10 + (y - 50) // 3, y), (14 + (y - 50) // 3, y)], GOLD_D)
        cv.line([(49 - (y - 50) // 3, y), (53 - (y - 50) // 3, y)], GOLD_D)
    # headset lights: status LED on the cup, mic capsule
    cv.px(11, 30, (255, 80, 60))
    cv.stamp(24, 46, ["KKK", "KsK", "KKK"], STAMP_PAL)
    # natural eye (viewer's left), narrowed: she is squinting at a gauge
    eyes_pal = iris_pal((60, 30, 14), (130, 74, 30), (210, 150, 80))
    cv.stamp(15, 25, [
        "....KKKKKKKK..",
        "..KKKKKKKKKKKK",
        "KKK.WeeeeeeK..",
        "K...WwweeeeW..",
        "....WwwEPPEW..",
        "....WEEPPPEW..",
        "....WpEEEEpW..",
        ".....KKKKKK...",
    ], eyes_pal)
    # cybernetic eye: glowing red lens, hot white core, screws on the plate
    glow = {"K": (40, 6, 8), "o": (150, 20, 20), "O": (255, 60, 40), "W": (255, 200, 120),
            "w": (255, 255, 230), "s": STEEL_L, "S": STEEL_D}
    cv.stamp(37, 24, CYBER_EYE, glow)
    for x, y in ((36, 22), (48, 24), (48, 32), (38, 34)):
        cv.px(x, y, STEEL_L)
    cv.px(49, 28, (255, 60, 40))       # glow spill on the plate edge
    # brows: one strong brow, the other replaced by the plate
    thick_line(cv, [(16, 22), (27, 21)], HAIR_D)
    # nose, firm mouth, jaw scar across her right jaw
    cv.line([(32, 31), (32, 37)], sk["s"])
    cv.px(31, 38, sk["r"])
    cv.px(32, 38, sk["r"])
    cv.line([(28, 44), (35, 44)], (70, 30, 28))
    cv.line([(29, 45), (34, 45)], (150, 80, 70))
    # jaw scar: pale raised line with stitch ticks
    cv.line([(45, 40), (41, 46)], (226, 168, 146))
    cv.line([(46, 41), (42, 47)], (200, 132, 112))
    for x, y in ((44, 42), (42, 45)):
        cv.px(x - 1, y + 1, (226, 168, 146))
        cv.px(x + 1, y - 1, (226, 168, 146))
    return cv.image(shift=0)


# =====================================================================
# pilot: the reference officer, unchanged
# =====================================================================
def pilot():
    if _OFFICER_DIR not in sys.path:
        sys.path.insert(0, _OFFICER_DIR)
    import gen_officer64
    return gen_officer64.build("idle", "normal")


# =====================================================================
# commander: the Grand Admiral
# =====================================================================
BIG_BADGE = [  # winged crest inside a laurel wreath
    "........Y........",
    "YYY....YyY....YYY",
    ".YYYYYYyOyYYYYYY.",
    "..yyYYYYyYYYYyy..",
    "y....yYYYYYy....y",
    ".y......y......y.",
    "..yy.........yy..",
    "....yyy...yyy....",
]


def commander():
    sk = skin((248, 206, 180), (224, 156, 132), (184, 110, 96), (120, 52, 46))
    HAIR, HAIR_D, HAIR_L = (236, 232, 228), (176, 168, 176), (255, 255, 255)
    cv = Canvas({
        "neck": (1, sk["k"]), "uniform": (2, K), "collar": (3, K), "medal": (4, K),
        "epaulette": (5, K), "face": (6, sk["k"]), "hair": (7, K), "beard": (8, K),
        "cap": (9, K), "band": (10, K), "brim": (11, K),
    })
    cv.poly("neck", sk["s"], [(25, 40), (38, 40), (38, 50), (25, 50)])
    cv.poly("uniform", UNI, [(0, 47), (10, 45), (24, 47), (39, 47), (53, 45), (63, 47), (63, 63), (0, 63)])
    cv.poly("collar", CAP_D, [(20, 44), (43, 44), (45, 54), (18, 54)])
    # heavy gold epaulettes: boards over the shoulders, bullion fringe hanging down
    ep = [(0, 43), (9, 41), (15, 43), (16, 47), (10, 49), (0, 49)]
    cv.poly("epaulette", GOLD, ep)
    cv.poly("epaulette", GOLD, mirror(ep))
    for x in range(0, 16, 2):
        top = 49
        cv.fill("epaulette", GOLD_D, lambda d, x=x, top=top: d.line([(x, top), (x, top + 6)], fill=1))
        cv.fill("epaulette", GOLD_D, lambda d, x=x, top=top: d.line([(63 - x, top), (63 - x, top + 6)], fill=1))
    # ribbons + medals on the chest (both sides, beard covers the middle)
    cv.poly("medal", TAB, [(41, 48), (51, 48), (51, 51), (41, 51)])
    cv.poly("medal", TAB, [(12, 49), (21, 49), (21, 52), (12, 52)])
    face = [(16, 12), (16, 33), (18, 40), (23, 45), (28, 48), (35, 48), (40, 45), (45, 40),
            (47, 33), (47, 12)]
    cv.poly("face", sk["S"], face)
    # white hair at the sides, merging into a full beard
    side = [(12, 14), (17, 14), (18, 30), (19, 38), (15, 40), (13, 30)]
    cv.poly("hair", HAIR, side)
    cv.poly("hair", HAIR, mirror(side))
    cv.poly("beard", HAIR, [(15, 32), (19, 37), (24, 41), (31, 40), (39, 41), (44, 37), (48, 32),
                            (48, 42), (44, 50), (37, 56), (31, 58), (26, 56), (19, 50), (15, 42)])
    # towering admiral's cap: taller crown than the officer's, gold everywhere
    cv.poly("cap", CAP, [(12, 10), (3, 6), (0, 2), (2, -3), (14, -10), (49, -10), (61, -3),
                         (63, 2), (60, 6), (51, 10)])
    cv.poly("band", BAND, [(12, 6), (51, 6), (51, 15), (12, 15)])
    cv.poly("brim", BRIM, [(13, 14), (50, 14), (49, 18), (41, 21), (31, 22), (22, 21), (14, 18)])

    # ---- shading ----
    cv.shade({"cap"}, CAP_L, lambda d: d.polygon([(1, 1), (3, -3), (14, -9), (24, -9), (11, 2), (4, 5)], fill=1))
    cv.shade({"cap"}, CAP_D, lambda d: d.polygon([(44, -9), (61, -3), (63, 2), (53, 9), (43, 7)], fill=1))
    # gold braid on the crown edge and twisted rope band ("scrambled eggs")
    cv.line([(3, 6), (12, 10)], GOLD_D, {"cap"})
    cv.line([(51, 10), (60, 6)], GOLD_D, {"cap"})
    cv.line([(12, 6), (51, 6)], GOLD, {"band"})
    cv.line([(12, 7), (51, 7)], GOLD_D, {"band"})
    for x in range(13, 51, 3):   # rope twist
        cv.line([(x, 10), (x + 2, 8)], GOLD, {"band"})
        cv.line([(x + 1, 13), (x + 3, 11)], GOLD, {"band"})
    cv.line([(18, 15), (24, 18), (31, 19), (39, 18), (45, 15)], GOLD, {"brim"})   # chin cord
    cv.line([(15, 17), (22, 20), (31, 21), (41, 20), (48, 17)], GOLD_D, {"brim"})  # oak-leaf edge
    cv.line([(16, 16), (20, 17)], BRIM_S, {"brim"})
    cv.shade({"hair", "beard"}, HAIR_D, lambda d: d.rectangle([40, 0, 63, 63], fill=1))
    cv.shade({"beard"}, HAIR_D, lambda d: d.polygon([(26, 52), (37, 52), (31, 58)], fill=1))
    cv.line([(13, 18), (14, 34)], HAIR_L, {"hair"})
    cel_face(cv, sk, 47, 48)
    cv.shade_below("face", "brim", sk["s"], 2)
    cv.line([(18, 46), (31, 46)], GOLD, {"collar"})
    cv.line([(31, 47), (31, 63)], GOLD, {"collar", "uniform"})
    cv.line([(32, 47), (32, 63)], GOLD_D, {"collar", "uniform"})
    cv.shade({"epaulette"}, GOLD_L, lambda d: d.line([(1, 44), (9, 42)], fill=1))
    cv.shade({"epaulette"}, GOLD_D, lambda d: d.line([(1, 48), (15, 48)], fill=1))

    cv.outline()

    # ---- details ----
    cv.stamp(23, -7, BIG_BADGE, STAMP_PAL)
    for x in (13, 50):
        cv.px(x, 15, GOLD)
    # admiral's stars on the epaulette boards
    for x0 in (3, 7, 53, 57):
        cv.stamp(x0, 44, [".O.", "OOO", ".O."], STAMP_PAL)
    # ribbon bars and hanging medals
    cv.stamp(42, 49, ["BGOBYGBOY", "bGObYGbOY"], STAMP_PAL)
    cv.stamp(13, 50, ["YOBGYOBG", "YOBGYOBG"], STAMP_PAL)
    cv.stamp(42, 51, [".y..y..y.", "YYY.Y.YYY", ".Y.YYY.Y."], STAMP_PAL)
    # stern narrow steel-grey eyes under heavy white brows
    pal = iris_pal((50, 70, 90), (110, 140, 170), (190, 210, 230))
    small_eye(cv, 18, 26, pal, lid_drop=1)
    small_eye(cv, 34, 26, pal, right=True, lid_drop=1)
    brow = {"H": HAIR, "h": HAIR_D, "K": K}
    cv.stamp(17, 21, ["KKKKK.......", "HHHHHKKKK...", "KHHHHHHHHKK.", "..KKKKKHHHHK"], brow)
    cv.stamp(34, 21, ["......KKKKK.", "..KKKKhhhhh.", ".KhhhhhhhhK.", "Khhhh.KKKK.."], brow)
    # old sabre scar through his right brow and down the cheek (viewer's left)
    cv.line([(20, 19), (27, 35)], (196, 90, 90))
    cv.line([(21, 19), (28, 35)], (236, 150, 140))
    # nose + wrinkles
    cv.line([(32, 30), (33, 36)], sk["s"])
    cv.px(31, 37, sk["r"])
    cv.px(32, 37, sk["r"])
    cv.line([(18, 24), (19, 25)], sk["s"])
    # walrus moustache over the beard, mouth just a shadow under it
    cv.stamp(22, 37, [
        "......KKKKKK......",
        "...KKKHHHHHHKKK...",
        ".KKHHHHHHHHHHhhKK.",
        "KHHHHHHKKKKhhhhhhK",
        "KHHHK........KhhhK",
        ".KK............KK.",
    ], brow)
    cv.line([(29, 42), (34, 42)], (150, 60, 60))
    return cv.image(shift=10)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

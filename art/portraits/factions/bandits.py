"""Scrap Bandits: ragtag space pirates in patched-up junk ships.

Shared look: rust oranges, worn leather browns, dirty yellow, a teal accent (acid green on the
pilot), riveted scrap metal and gold loot. Every role gets its own silhouette:
  merchant  - fur collar spreading wide, slicked hair, gold-toothed grin
  mechanic  - bandana + goggles on the head, big wrench over the shoulder
  pilot     - tall green mohawk, eyepatch, padded flight jacket
  commander - horned skull helmet filling the headroom, beard, spiked pauldrons
"""
from portraitlib import EYE_FRAME_L, EYE_FRAME_R, EYE_W, IRIS, N, Canvas, eye, iris_pal, mirror

# ---------- shared palette ----------
K = (24, 10, 6)           # ink
RUST = (200, 88, 36)
RUST_D = (132, 50, 24)
RUST_L = (244, 140, 64)
LEA = (124, 76, 44)       # worn leather
LEA_D = (78, 44, 28)
LEA_L = (176, 116, 66)
YEL = (222, 182, 62)      # dirty yellow
YEL_D = (160, 118, 38)
YEL_L = (252, 224, 120)
TEAL = (44, 182, 160)
TEAL_D = (22, 112, 106)
TEAL_L = (132, 236, 204)
ACID = (168, 236, 44)
ACID_D = (92, 156, 24)
ACID_L = (222, 255, 140)
GOLD = (255, 208, 70)
GOLD_D = (196, 128, 30)
MET = (150, 146, 136)     # scrap metal
MET_D = (88, 84, 80)
MET_L = (214, 210, 194)
FUR = (226, 204, 160)
FUR_D = (164, 136, 98)
WHITE = (255, 248, 232)
GREASE = (52, 36, 30)

# skin tones: base, cel shadow, deep shadow, outline
SKINS = {
    "olive": ((226, 172, 122), (188, 124, 84), (142, 86, 58), (96, 50, 32)),
    "pale": ((255, 222, 194), (238, 166, 132), (204, 112, 94), (130, 50, 45)),
    "dark": ((156, 96, 64), (114, 66, 44), (82, 44, 30), (40, 16, 10)),
    "ruddy": ((236, 178, 140), (200, 126, 98), (152, 82, 64), (102, 40, 30)),
}


def sym(left):
    """Left half of a symmetric shape (bottom-centre, up the left side, to top-centre) -> full polygon."""
    return left + mirror(left)


def make_canvas(skin_outline):
    # z-order shared by all four portraits; skin layers ink with a warm brown instead of black
    return Canvas({
        "back": (1, K),        # things behind the head: wrench, horns, back hair
        "ears": (2, skin_outline),
        "neck": (3, skin_outline),
        "body": (4, K),
        "collar": (5, K),
        "prop": (6, K),        # props in front of the body but behind the face
        "face": (7, skin_outline),
        "beard": (8, K),
        "hair": (9, K),
        "head": (10, K),       # headgear: bandana, helmet
        "gear": (11, K),       # goggles, eyepatch, horns' front parts
        "front": (12, K),
    })


def everything(d):
    d.rectangle([0, -12, N, N], fill=1)


def one_eye(cv, pal, side, y, inset=15, iris=IRIS, lid_drop=0):
    """Stamp a single anime eye: side 'L' (viewer's left) or 'R'."""
    fr = EYE_FRAME_L if side == "L" else EYE_FRAME_R
    if lid_drop:
        fr = ["." * EYE_W] * lid_drop + fr[lid_drop:]
    x = inset if side == "L" else N - inset - EYE_W
    cv.stamp(x, y, eye(fr, iris), pal)


def brow(cv, a, b, col=K, top=None):
    """Thick 2px brow: ink line with a second row (hair colour) on top."""
    cv.line([a, b], col)
    if top:
        cv.line([(a[0], a[1] - 1), (b[0], b[1] - 1)], top)


# irises looking to the viewer's left (shifty) and narrowed versions
IRIS_SIDE = [
    "WeeeeeeW",
    "eeeeeeWW",
    "wwEEEEWW",
    "PPEEEEWW",
    "PPEEEEWW",
    "PPEEwEWW",
    "EEEEpWWW",
    "pppp....",
]


# ======================================================================
# merchant: the fence
# ======================================================================
def merchant():
    S, s, r, kS = SKINS["olive"]
    HAIR, HAIR_D, HAIR_L = (40, 30, 34), (20, 14, 18), (110, 100, 120)
    cv = make_canvas(kS)

    # fur-collared rust coat, collar flaring wide past the shoulders
    cv.poly("neck", S, [(24, 42), (39, 42), (39, 56), (24, 56)])
    cv.poly("body", RUST, [(0, 58), (10, 54), (24, 53), (39, 53), (53, 54), (63, 58), (63, 63), (0, 63)])
    # open shirt V (teal) with gold chain
    cv.poly("collar", TEAL_D, [(23, 52), (40, 52), (36, 63), (27, 63)])
    # fur collar: jagged tufts, both sides
    left_fur = [(25, 63), (22, 57), (21, 51), (19, 47), (17, 50), (14, 46), (12, 50), (9, 48),
                (8, 53), (12, 58), (10, 63)]
    cv.poly("prop", FUR, left_fur)
    cv.poly("prop", FUR, mirror(left_fur))

    # ears + face: broad cheekbones, squarish jaw
    cv.ellipse("ears", S, (9, 26, 15, 37))
    cv.ellipse("ears", S, (48, 26, 54, 37))
    face = sym([(31, 54), (25, 52), (18, 46), (14, 38), (13, 28), (13, 14), (31, 12)])
    cv.poly("face", S, face)

    # slicked-back hair: smooth helmet with a widow's peak, sides tight above the ears
    hair = sym([(31, 15), (26, 12), (19, 12), (14, 16), (13, 25), (11, 26), (10, 16), (12, 7),
                (18, 2), (26, 0), (31, 0)])
    cv.poly("hair", HAIR, hair)

    # ---- shading ----
    cv.shade({"hair"}, HAIR_D, lambda d: d.polygon([(38, 0), (55, 6), (54, 26), (44, 12)], fill=1))
    # comb lines sweeping back
    for pts in ([(16, 10), (22, 5), (30, 3)], [(14, 16), (20, 9), (28, 7), (36, 6)],
                [(33, 11), (40, 8), (48, 9), (52, 14)], [(25, 10), (33, 8)]):
        cv.line(pts, HAIR_L, {"hair"})
    cv.shade({"face"}, s, lambda d: d.polygon([(44, 12), (51, 12), (51, 38), (46, 47), (36, 55), (41, 46), (45, 36)], fill=1))
    cv.shade_below("face", "hair", s, 2)
    cv.shade({"ears"}, s, lambda d: d.rectangle([47, 0, N, N], fill=1))
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, 48], fill=1))
    cv.shade({"neck"}, s, lambda d: d.rectangle([34, 49, N, N], fill=1))
    cv.shade({"prop"}, FUR_D, lambda d: d.rectangle([40, 0, N, N], fill=1))
    for pts in ([(12, 53), (15, 56)], [(16, 50), (18, 55)], [(19, 57), (21, 61)], [(13, 59), (15, 62)]):
        cv.line(pts, FUR_D, {"prop"})  # fur tuft strokes
    cv.shade({"body"}, RUST_L, lambda d: d.line([(1, 57), (8, 54)], fill=1))
    for pts in ([(3, 60), (6, 59)], [(52, 58), (56, 61)]):  # patched seams
        cv.line(pts, LEA_D, {"body"})
    cv.shade({"body"}, RUST_D, lambda d: d.rectangle([44, 0, N, N], fill=1))
    cv.shade({"collar"}, TEAL, lambda d: d.polygon([(23, 52), (31, 52), (30, 63), (27, 63)], fill=1))

    cv.outline()

    # ---- details ----
    pal = iris_pal((60, 40, 14), (150, 110, 30), (220, 190, 80), outline=K)
    one_eye(cv, pal, "L", 25, 15, IRIS_SIDE, lid_drop=3)
    one_eye(cv, pal, "R", 25, 15, IRIS_SIDE, lid_drop=3)
    # heavy lids drawn across the top of the iris -> sly half-lidded look
    cv.line([(15, 27), (28, 27)], K)
    cv.line([(35, 27), (48, 27)], K)
    # one brow cocked up, the other flat
    brow(cv, (16, 21), (27, 19), K, HAIR)
    brow(cv, (36, 23), (47, 23), K, HAIR)
    # nose
    cv.px(33, 38, s); cv.px(33, 39, s); cv.px(32, 40, r)
    # pencil moustache
    cv.line([(25, 42), (30, 41)], HAIR)
    cv.line([(33, 41), (38, 42)], HAIR)
    # lopsided grin with gold teeth
    cv.stamp(23, 43, [
        "K..........K..",
        ".KKKKKKKKKKK..",
        ".KWgWGWWgGK...",
        "..KmmmmmmK....",
        "...KKKKKK.....",
    ], {"K": K, "W": WHITE, "G": GOLD, "g": GOLD_D, "m": (90, 20, 24)})
    # stubble dots on the jaw
    for x, y in ((22, 49), (26, 51), (37, 51), (41, 49), (30, 52), (34, 52)):
        cv.px(x, y, s)
    # gold hoop earring on the lit ear
    cv.stamp(9, 36, [".G.", "G.G", ".g."], {"G": GOLD, "g": GOLD_D})
    # chains across the open shirt
    cv.line([(25, 54), (28, 58), (31, 59), (35, 58), (38, 54)], GOLD)
    cv.line([(26, 57), (29, 61), (31, 62), (34, 61), (37, 57)], GOLD_D)
    cv.stamp(30, 59, ["GG", "gG"], {"G": GOLD, "g": GOLD_D})
    return cv.image()


# ======================================================================
# mechanic: grease monkey
# ======================================================================
def mechanic():
    S, s, r, kS = SKINS["pale"]
    HAIR, HAIR_D, HAIR_L = (150, 56, 30), (98, 32, 20), (214, 110, 60)
    cv = make_canvas(kS)

    # wrench resting on her right shoulder, jaw sticking up behind the head
    handle = [(44, 63), (40, 60), (55, 30), (59, 32)]
    cv.poly("back", MET, handle)
    jaw = [(52, 31), (50, 22), (53, 15), (58, 16), (57, 22), (61, 22), (63, 16), (63, 28), (60, 33)]
    cv.poly("back", MET, jaw)

    # stray hair at the back
    cv.poly("back", HAIR_D, sym([(31, 30), (14, 32), (10, 22), (12, 14), (31, 12)]))

    cv.poly("neck", S, [(25, 44), (38, 44), (38, 55), (25, 55)])
    # coveralls: dirty yellow, unzipped over a tank top
    cv.poly("body", YEL, [(0, 57), (12, 53), (22, 53), (41, 53), (51, 53), (63, 57), (63, 63), (0, 63)])
    cv.poly("collar", (64, 60, 58), [(22, 54), (41, 54), (39, 63), (24, 63)])

    face = sym([(31, 54), (27, 53), (20, 47), (15, 40), (13, 32), (13, 14), (31, 14)])
    cv.poly("face", S, face)

    # messy bangs poking out under the bandana
    tips = [(13, 28), (16, 22), (20, 25), (24, 20), (29, 24), (33, 19), (38, 24), (43, 20), (47, 25), (50, 28)]
    bangs = [(11, 14)]
    px_ = 11
    for tx, ty in tips:
        bangs.append(((px_ + tx) // 2, 16))
        bangs.append((tx, ty))
        px_ = tx
    bangs += [(52, 16), (52, 14)]
    cv.poly("hair", HAIR, bangs)
    # side tufts
    cv.poly("hair", HAIR, [(10, 14), (15, 15), (13, 30), (11, 38), (8, 32), (9, 22)])

    # bandana: teal, tied, knot + tails on the right
    cv.poly("head", TEAL, sym([(31, 17), (20, 17), (12, 18), (10, 12), (12, 5), (20, 1), (31, 0)]))
    cv.poly("head", TEAL, [(51, 12), (56, 10), (60, 14), (62, 22), (57, 20), (55, 16)])
    cv.poly("head", TEAL, [(52, 14), (58, 18), (59, 27), (55, 25), (53, 19)])
    # goggles pushed up: strap + two round lenses on the forehead
    cv.poly("gear", LEA_D, [(10, 9), (53, 9), (53, 12), (10, 12)])
    cv.ellipse("gear", MET, (15, 3, 28, 15))
    cv.ellipse("gear", MET, (35, 3, 48, 15))
    cv.poly("gear", MET, [(27, 7), (36, 7), (36, 10), (27, 10)])

    # ---- shading ----
    cv.shade({"hair"}, HAIR_D, lambda d: d.rectangle([44, 0, N, N], fill=1))
    cv.shade({"hair"}, HAIR_L, lambda d: d.line([(14, 20), (20, 19), (27, 20)], fill=1))
    cv.shade({"head"}, TEAL_D, lambda d: d.polygon([(42, 0), (63, 0), (63, 30), (46, 18)], fill=1))
    cv.shade({"head"}, TEAL_L, lambda d: d.line([(12, 12), (14, 6), (20, 2)], fill=1))
    # polka-ish bandana dots
    for x, y in ((14, 15), (22, 16), (30, 16), (38, 16), (46, 15), (57, 23)):
        cv.shade({"head"}, TEAL_L if x < 40 else TEAL, lambda d, x=x, y=y: d.point([(x, y)], fill=1))
    cv.shade({"face"}, s, lambda d: d.polygon([(44, 14), (51, 14), (51, 36), (45, 46), (35, 55), (40, 47), (44, 38)], fill=1))
    cv.shade_below("face", "hair", s, 2)
    cv.shade_below("hair", "head", HAIR_D, 1)
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, 49], fill=1))
    cv.shade({"neck"}, s, lambda d: d.rectangle([34, 50, N, N], fill=1))
    cv.shade({"body"}, YEL_D, lambda d: d.rectangle([44, 0, N, N], fill=1))
    cv.shade({"body"}, YEL_L, lambda d: d.line([(2, 58), (13, 55)], fill=1))
    cv.shade({"back"}, MET_D, lambda d: d.polygon([(48, 63), (57, 30), (63, 30), (63, 63)], fill=1),
             where=lambda x, y: cv.col[y][x] == MET)
    cv.shade({"back"}, MET_L, lambda d: d.line([(42, 60), (55, 33)], fill=1))
    cv.shade({"gear"}, MET_D, lambda d: d.rectangle([44, 0, N, N], fill=1))

    cv.outline()

    # goggle lenses (amber glass with a glint), drawn after the ink pass
    for cx in (21, 41):
        cv.stamp(cx - 4, 5, [
            ".aaaaa..",
            "aAAAAaa.",
            "awAAAAa.",
            "aAAAAaa.",
            ".aaaaa..",
        ], {"a": (176, 90, 24), "A": (240, 160, 50), "w": (255, 240, 200)})
    # eyes: big, bright, friendly (teal-green)
    pal = iris_pal((20, 90, 80), (40, 170, 140), (150, 240, 200), outline=K)
    one_eye(cv, pal, "L", 26, 15)
    one_eye(cv, pal, "R", 26, 15)
    brow(cv, (17, 23), (26, 22), K, HAIR_D)
    brow(cv, (37, 22), (46, 23), K, HAIR_D)
    # nose + freckles
    cv.px(33, 39, s); cv.px(33, 40, s); cv.px(32, 41, r)
    for x, y in ((18, 39), (20, 40), (22, 39), (41, 39), (43, 40), (45, 39)):
        cv.px(x, y, r)
    # grease smudges: cheek swipe and forehead dab
    cv.line([(16, 42), (23, 44)], GREASE)
    cv.line([(17, 43), (21, 44)], GREASE)
    cv.px(39, 45, GREASE); cv.px(40, 45, GREASE)
    # crooked smile
    cv.stamp(27, 45, [
        "K.......K",
        ".KKKKKKK.",
        "..KmmmK..",
    ], {"K": (150, 60, 56), "m": (110, 30, 36)})
    # zipper + name tag patch
    cv.line([(23, 54), (24, 63)], YEL_D)
    cv.line([(40, 54), (39, 63)], YEL_D)
    cv.stamp(6, 58, ["RRRR", "RWWR", "RRRR"], {"R": RUST, "W": WHITE})
    return cv.image()


# ======================================================================
# pilot: ace raider
# ======================================================================
def pilot():
    S, s, r, kS = SKINS["dark"]
    SL = (196, 132, 92)  # rim light on dark skin
    cv = make_canvas(kS)

    # flight jacket: padded leather, ribbed collar flipped up
    cv.poly("neck", S, [(25, 43), (38, 43), (38, 56), (25, 56)])
    cv.poly("body", LEA, [(0, 56), (8, 52), (20, 51), (43, 51), (55, 52), (63, 56), (63, 63), (0, 63)])
    cv.poly("collar", YEL_D, [(17, 63), (15, 52), (22, 47), (27, 55), (29, 63)])
    cv.poly("collar", YEL_D, mirror([(17, 63), (15, 52), (22, 47), (27, 55), (29, 63)]))
    cv.poly("prop", (40, 30, 30), [(28, 56), (35, 56), (34, 63), (29, 63)])  # undershirt

    # ears with hoops (shaved sides show them)
    cv.ellipse("ears", S, (10, 26, 16, 37))
    cv.ellipse("ears", S, (47, 26, 53, 37))
    face = sym([(31, 54), (26, 53), (19, 47), (15, 39), (14, 30), (14, 12), (31, 10)])
    cv.poly("face", S, face)
    # shaved scalp with a tall acid-green mohawk running front to back
    cv.poly("hair", S, sym([(31, 13), (20, 13), (15, 18), (13, 26), (12, 16), (16, 6), (24, 2), (31, 1)]))
    mohawk = [(25, 14), (22, 8), (19, 1), (22, 0), (22, -4), (26, -3), (28, -7), (31, -4), (35, -7),
              (36, -3), (41, -5), (40, 0), (44, 1), (42, 6), (39, 10), (37, 14), (34, 12), (31, 15), (28, 12)]
    cv.poly("head", ACID, mohawk)

    # ---- shading ----
    # stubble on the shaved sides
    cv.shade({"hair"}, r, everything)
    cv.shade({"hair"}, s, lambda d: d.rectangle([0, 0, 22, 30], fill=1))
    cv.shade({"head"}, ACID_D, lambda d: d.polygon([(33, -8), (45, -4), (42, 14), (33, 14)], fill=1))
    for pts in ([(24, 10), (23, 1), (27, -4)], [(29, 12), (28, 2), (31, -5)]):
        cv.line(pts, ACID_L, {"head"})
    cv.line([(36, 10), (38, 2), (37, -3)], (60, 110, 20), {"head"})
    cv.shade({"face"}, s, lambda d: d.polygon([(44, 10), (51, 10), (51, 38), (46, 46), (36, 55), (41, 46), (45, 36)], fill=1))
    cv.shade_below("face", "head", s, 1)
    cv.shade({"face"}, SL, lambda d: d.line([(15, 30), (15, 38), (18, 44)], fill=1))
    cv.shade({"ears"}, s, lambda d: d.rectangle([46, 0, N, N], fill=1))
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, 49], fill=1))
    cv.shade({"body"}, LEA_D, lambda d: d.rectangle([45, 0, N, N], fill=1))
    cv.shade({"body"}, LEA_L, lambda d: d.line([(2, 57), (12, 53)], fill=1))
    cv.shade({"collar"}, YEL, lambda d: d.rectangle([0, 0, 24, N], fill=1))
    # ribbing
    for x in (17, 19, 21, 42, 44, 46):
        cv.shade({"collar"}, YEL_D if x < 30 else LEA, lambda d, x=x: d.line([(x, 50), (x, 63)], fill=1))

    cv.outline()

    # left eye (viewer's left) under the patch; right eye narrowed, acid-green iris
    pal = iris_pal(ACID_D, (130, 200, 40), ACID_L, outline=K)
    one_eye(cv, pal, "R", 26, 15, lid_drop=2)
    # eyepatch strap diagonal across the forehead, patch over the left eye
    cv.line([(12, 33), (50, 13)], K)
    cv.line([(12, 32), (50, 12)], (40, 30, 30))
    cv.stamp(14, 25, [
        "..KKKKKKKK..",
        ".KLLLLLLLLK.",
        "KLLlLLLLLLLK",
        "KLlLLLLLLLLK",
        "KLLLLLLLLLLK",
        "KLLLLLLLLLLK",
        ".KLLLLLLLLK.",
        "..KKKKKKKK..",
    ], {"K": K, "L": (54, 40, 36), "l": (110, 90, 80)})
    brow(cv, (37, 23), (47, 21), K, r)
    # scar: from brow down across the cheek on the seeing side
    SCAR = (236, 150, 140)
    cv.line([(45, 16), (43, 22)], SCAR)
    cv.line([(46, 36), (41, 45)], SCAR)
    for x, y in ((43, 39), (45, 40), (42, 42), (44, 43)):  # stitch marks
        cv.px(x, y, SCAR)
    # nose + smirk
    cv.px(33, 38, s); cv.px(33, 39, r); cv.px(32, 40, r)
    cv.stamp(27, 45, [
        "........K",
        ".KKKKKKK.",
        "..LLLL...",
    ], {"K": (40, 14, 12), "L": (120, 64, 54)})
    # earring hoops
    for (x, y) in ((10, 35), (11, 37)):
        cv.px(x, y, GOLD)
    cv.stamp(52, 34, [".G", "G.", ".G"], {"G": GOLD})
    # jacket patches: teal round squadron patch, rust skull-ish badge, tape X
    cv.stamp(4, 56, [".TTT.", "TtYtT", "TYYYT", ".TTT."], {"T": TEAL, "t": TEAL_L, "Y": YEL_L})
    cv.stamp(52, 56, ["RRRRR", "RWRWR", "RRWRR", ".RRR."], {"R": RUST, "W": (250, 230, 200)})
    cv.line([(40, 57), (44, 61)], MET_L)
    cv.line([(44, 57), (40, 61)], MET_L)
    return cv.image(shift=4)


# ======================================================================
# commander: the Warlord
# ======================================================================
def commander():
    S, s, r, kS = SKINS["ruddy"]
    BEARD, BEARD_D, BEARD_L = (96, 74, 64), (60, 44, 40), (150, 128, 112)  # grizzled grey-brown
    cv = make_canvas(kS)

    # horns: big curved scrap horns rising into the headroom
    horn = [(14, 12), (6, 11), (1, 7), (0, 1), (2, -4), (7, -9), (6, -4), (6, 0), (9, 3), (14, 3)]
    cv.poly("back", FUR, horn)
    cv.poly("back", FUR, mirror(horn))

    # spiked pauldrons + armour
    cv.poly("neck", S, [(24, 40), (39, 40), (39, 52), (24, 52)])
    cv.poly("body", LEA_D, [(10, 48), (53, 48), (63, 63), (0, 63)])
    pauld = [(0, 63), (0, 46), (5, 41), (14, 39), (22, 42), (25, 50), (22, 63)]
    cv.poly("collar", RUST_D, pauld)
    cv.poly("collar", RUST_D, mirror(pauld))
    # spikes
    for base in ([(1, 45), (0, 30), (8, 41)], [(8, 41), (11, 26), (16, 40)], [(15, 41), (20, 31), (22, 44)]):
        cv.poly("prop", MET, base)
        cv.poly("prop", MET, mirror(base))

    face = sym([(31, 50), (24, 48), (17, 42), (14, 34), (13, 26), (13, 10), (31, 10)])
    cv.poly("face", S, face)
    # beard: heavy, covers the jaw, braided tip
    beard = sym([(31, 60), (28, 57), (22, 53), (16, 46), (13, 36), (13, 28), (16, 34), (20, 38),
                 (25, 39), (31, 38)])
    cv.poly("beard", BEARD, beard)

    # helmet: riveted dome with a skull plate on the front
    cv.poly("head", MET, sym([(31, 19), (24, 19), (17, 18), (11, 19), (10, 10), (12, 2), (18, -3),
                              (25, -5), (31, -6)]))
    cv.poly("gear", (236, 222, 190), [(25, 3), (24, -1), (27, -4), (36, -4), (39, -1), (38, 3), (36, 6), (27, 6)])

    # ---- shading ----
    cv.shade({"back"}, FUR_D, lambda d: d.rectangle([32, -12, N, N], fill=1))
    cv.shade({"back"}, (250, 236, 200), lambda d: d.line([(5, -6), (2, -2), (1, 3), (5, 8)], fill=1))
    for a, b in (((0, -1), (4, 0)), ((1, 3), (5, 3)), ((4, 7), (7, 5)), ((8, 9), (10, 6))):  # horn ridges
        cv.shade({"back"}, FUR_D, lambda d, a=a, b=b: d.line([a, b], fill=1))
        cv.shade({"back"}, (120, 96, 70), lambda d, a=a, b=b: d.line([(N - 1 - a[0], a[1]), (N - 1 - b[0], b[1])], fill=1))
    cv.shade({"head"}, MET_D, lambda d: d.polygon([(40, -6), (55, 0), (54, 20), (42, 20)], fill=1))
    cv.shade({"head"}, MET_L, lambda d: d.line([(12, 12), (13, 4), (18, -2), (24, -5)], fill=1))
    cv.shade({"head"}, RUST_D, lambda d: d.rectangle([0, 15, N, 20], fill=1))  # rusted brim band
    cv.shade({"head"}, RUST, lambda d: d.line([(11, 16), (30, 16)], fill=1))
    cv.shade({"gear"}, (176, 160, 130), lambda d: d.rectangle([34, -12, N, N], fill=1))
    cv.shade({"face"}, s, lambda d: d.polygon([(44, 10), (51, 10), (51, 34), (40, 48), (44, 34)], fill=1))
    cv.shade_below("face", "head", r, 2)
    cv.shade({"beard"}, BEARD_D, lambda d: d.polygon([(38, 38), (51, 28), (51, 50), (34, 62)], fill=1))
    for pts in ([(17, 40), (22, 50), (28, 56)], [(22, 42), (27, 52)], [(15, 34), (18, 44)]):
        cv.line(pts, BEARD_L, {"beard"})
    for pts in ([(41, 44), (36, 54)], [(46, 38), (42, 48)]):
        cv.line(pts, (70, 30, 16), {"beard"})
    cv.shade({"collar"}, RUST, lambda d: d.rectangle([0, 0, 22, N], fill=1))
    cv.shade({"collar"}, (96, 36, 20), lambda d: d.rectangle([44, 0, N, N], fill=1))
    cv.shade({"collar"}, RUST_L, lambda d: d.line([(1, 46), (6, 42), (14, 40)], fill=1))
    for x, y in ((5, 48), (12, 45), (19, 48), (44, 48), (51, 45), (58, 48)):  # rivets
        cv.shade({"collar"}, YEL, lambda d, x=x, y=y: d.point([(x, y)], fill=1))
    cv.shade({"prop"}, MET_L, lambda d: d.rectangle([0, -12, 22, N], fill=1))
    cv.shade({"prop"}, MET_D, lambda d: d.rectangle([42, -12, N, N], fill=1))
    cv.shade({"body"}, LEA, lambda d: d.rectangle([0, 0, 31, N], fill=1))

    cv.outline()

    # skull plate details: eye sockets, nose, teeth
    cv.stamp(26, -2, [
        ".KK..KK.",
        "KKK..KKK",
        ".K.KK.K.",
        "...KK...",
        ".K.K.K.K",
    ], {"K": K})
    # rivets on the helmet band
    for x in (13, 19, 25, 38, 44, 50):
        cv.px(x, 17, MET_L)
    # war paint: teal band across the eyes, then narrow scowling eyes
    # war paint: dark smear across the eyes and teal claw stripes down the cheeks
    cv.shade({"face"}, (90, 40, 40), lambda d: d.rectangle([13, 21, 50, 29], fill=1))
    for y in (31, 34):  # two slanted bars per cheek, 2px thick
        for dy in (0, 1):
            cv.line([(16, y + dy), (24, y + dy + 2)], TEAL, {"face"})
            cv.line([(39, y + dy + 2), (47, y + dy)], TEAL_D, {"face"})
    pal = iris_pal((110, 20, 10), (220, 70, 30), (255, 180, 80), outline=K)
    one_eye(cv, pal, "L", 19, 15, lid_drop=3)
    one_eye(cv, pal, "R", 19, 15, lid_drop=3)
    # heavy scowl brows meeting over the nose
    brow(cv, (16, 21), (29, 24), K, BEARD_D)
    brow(cv, (34, 24), (47, 21), K, BEARD_D)
    # nose
    cv.px(32, 31, s); cv.px(32, 32, s); cv.px(31, 33, r); cv.px(32, 33, r)
    # mouth slit in the beard + cigar clenched at the corner with ember and smoke
    cv.line([(26, 41), (36, 41)], (60, 20, 14))
    cv.stamp(34, 39, [
        "KKKKKKKKKKKK.",
        "KbBBBByBBBeEK",
        "KbbbbbybbbeeK",
        "KKKKKKKKKKKK.",
    ], {"K": K, "B": (150, 92, 50), "b": (104, 62, 34), "e": (240, 80, 20), "E": (255, 220, 90), "y": GOLD})
    for x, y in ((47, 37), (48, 35), (47, 33), (48, 31), (49, 29)):
        cv.px(x, y, (200, 196, 186))
    # gold tooth glint + braid ring in the beard
    cv.stamp(30, 56, ["GGG", "gGg"], {"G": GOLD, "g": GOLD_D})
    return cv.image(shift=6)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

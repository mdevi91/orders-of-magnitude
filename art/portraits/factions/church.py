"""Church of the Pale Star: ivory and pale gold, deep crimson, candle glow, cold holy-blue light.

Shared motifs: the four-pointed star emblem, halo rings, candle flames.
  merchant  - indulgence-seller, ivory hood, coin/relic necklace, sly half-shadowed smile
  mechanic  - tech-acolyte, crimson hood, brass lens glowing with candle light, incense hoses
  pilot     - zealot knight, halo-ringed helm with raised visor, star brow, armoured gorget
  commander - Abbess Prime, tall mitre, veil, glowing white eyes, star-embroidered vestments
"""
from portraitlib import Canvas, N, eyes, iris_pal, mirror

C = {
    "K": (22, 6, 10),          # ink
    # ivory cloth / enamel
    "I": (246, 236, 212),
    "i": (214, 198, 168),
    "iD": (160, 140, 118),
    "iL": (255, 250, 236),
    # pale gold
    "G": (250, 214, 120),
    "g": (204, 150, 64),
    "gD": (130, 84, 36),
    "gL": (255, 244, 190),
    # crimson
    "R": (170, 24, 40),
    "r": (110, 14, 30),
    "rD": (64, 8, 20),
    "rL": (226, 60, 64),
    # candle glow
    "F": (255, 236, 140),
    "f": (255, 160, 50),
    "fD": (220, 90, 30),
    # holy blue
    "Q": (200, 236, 255),
    "q": (120, 180, 236),
    "qD": (60, 100, 170),
    # steel (pilot armour leans ivory-enamelled steel)
    "M": (210, 214, 222),
    "m": (150, 152, 170),
    "mD": (88, 88, 108),
    # brass (mechanic)
    "B": (226, 168, 76),
    "b": (160, 100, 40),
    "bD": (90, 52, 24),
}

# skin ramps: (light, cel shadow, deep shadow, outline)
SKIN = {
    "olive": ((228, 184, 140), (192, 140, 100), (140, 92, 66), (96, 52, 36)),
    "dark": ((150, 96, 66), (112, 68, 48), (78, 44, 34), (46, 20, 18)),
    "pale": ((255, 226, 204), (238, 172, 148), (200, 120, 104), (130, 54, 50)),
    "brown": ((206, 148, 104), (168, 108, 74), (124, 74, 52), (80, 36, 28)),
}


def star(cv, cx, cy, big, hi, lo, glow=None):
    """Four-pointed star centred on (cx, cy). big=True -> 9px tall, else 5px."""
    if big:
        rows = ["....h....",
                "....h....",
                "...hhl...",
                "..ghhll..",
                "hhhhhhlll",
                "..gllll..",
                "...lll...",
                "....l....",
                "....l...."]
    else:
        rows = ["..h..",
                ".hhl.",
                "hhhll",
                ".lll.",
                "..l.."]
    pal = {"h": hi, "l": lo, "g": glow or hi}
    r = len(rows) // 2
    cv.stamp(cx - r, cy - r, rows, pal)


def skin_layers(cv, tone):
    """Return (S, s, r) colours; set face/neck outline colour to the tone's ink."""
    S, s, r, k = SKIN[tone]
    for name in ("face", "neck"):
        if name in cv.layers:
            z, _ = cv.layers[name]
            cv.layers[name] = (z, k)
    return S, s, r


def face_shadow(cv, S, s, x_from, y_top=0):
    """Cel shadow on the right part of the face (light from the upper-left)."""
    cv.shade({"face"}, s, lambda d: d.rectangle([x_from, y_top, N, N], fill=1))


def jaw(top, left, right, bottom, chin_w, sharp=True):
    """Face polygon: flat cheeks down to a chin. chin_w = half width of the chin."""
    cx = (left + right) // 2
    pts = [(left, top), (left, top + 18), (left + 2, top + 26), (cx - chin_w - 4, bottom - 4)]
    if sharp:
        pts += [(cx - chin_w, bottom), (cx + chin_w + 1, bottom)]
    else:
        pts += [(cx - chin_w, bottom), (cx + chin_w + 1, bottom)]
    pts += [(cx + chin_w + 5, bottom - 4), (right - 2, top + 26), (right, top + 18), (right, top)]
    return pts


# ---------------------------------------------------------------- merchant
def merchant():
    """Indulgence-seller: middle-aged olive-skinned man, ivory hood, smirk, coins and relic."""
    cv = Canvas({
        "hoodback": (1, C["K"]), "neck": (2, None), "robe": (3, C["K"]), "stole": (4, C["K"]),
        "face": (5, None), "beard": (6, C["K"]), "hood": (7, C["K"]), "chain": (8, None),
    })
    S, s, r = skin_layers(cv, "olive")
    hair = (66, 44, 36)
    hairL = (110, 80, 62)

    # hood: big rounded cowl, peaked at top, falling over broad shoulders
    cv.poly("hoodback", C["i"], [(10, 6), (20, -2), (32, -5), (44, -2), (54, 6), (58, 22),
                                 (60, 44), (62, 63), (1, 63), (3, 44), (5, 22)])
    cv.poly("neck", s, [(25, 42), (38, 42), (38, 52), (25, 52)])
    cv.poly("robe", C["I"], [(0, 54), (12, 48), (24, 51), (39, 51), (51, 48), (63, 54), (63, 63), (0, 63)])
    # crimson stole down the chest, both sides of the neck
    stole = [(17, 49), (24, 51), (26, 63), (17, 63)]
    cv.poly("stole", C["R"], stole)
    cv.poly("stole", C["R"], mirror(stole))

    cv.poly("face", S, jaw(14, 15, 48, 50, 3, sharp=False))
    # short pointed goatee + jaw stubble line
    cv.poly("beard", hair, [(20, 40), (25, 45), (29, 46), (34, 46), (38, 45), (43, 40),
                            (42, 46), (36, 52), (32, 55), (27, 52), (21, 46)])

    # hood front: rim hangs low over the brow and lower still on his right (our right),
    # so half the face sits in shadow
    hood = [(5, 22), (8, 8), (18, -1), (32, -4), (45, -1), (55, 8), (58, 22), (59, 48),
            (52, 52), (49, 44), (49, 30), (47, 26), (40, 22), (32, 20), (24, 20), (18, 22),
            (15, 28), (14, 44), (11, 52), (4, 48)]
    cv.poly("hood", C["I"], hood)

    # ---- shading ----
    cv.shade({"hoodback"}, C["iD"], lambda d: d.rectangle([0, -12, N, N], fill=1))
    cv.shade({"hood"}, C["iL"], lambda d: d.polygon([(5, 22), (8, 8), (18, -1), (26, -3), (14, 10), (9, 24), (8, 46), (5, 48)], fill=1))
    cv.shade({"hood"}, C["i"], lambda d: d.polygon([(42, -2), (55, 8), (59, 22), (60, 52), (50, 52), (50, 24), (44, 12)], fill=1))
    # crimson lining (2px) along the opening of the hood
    lining = [(15, 44), (15, 28), (18, 22), (24, 20), (32, 20), (40, 22), (47, 26), (49, 30), (49, 44)]
    cv.line(lining, C["R"], {"hood"})
    cv.line([(x - 1 if x < 32 else x + 1, y - 1) for x, y in lining], C["r"], {"hood"})
    # folds
    cv.line([(32, -2), (30, 8)], C["i"], {"hood"})
    cv.line([(22, 2), (16, 14)], C["i"], {"hood"})
    cv.line([(53, 26), (55, 46)], C["iD"], {"hood"})
    cv.line([(10, 28), (9, 44)], C["i"], {"hood"})
    # hood shadow: deep band under the brim, diagonal over his right side
    cv.shade({"face"}, s, lambda d: d.polygon([(0, 0), (N, 0), (N, 50), (38, 50), (41, 30), (0, 26)], fill=1))
    cv.shade({"face"}, r, lambda d: d.polygon([(0, 0), (N, 0), (N, 44), (45, 44), (44, 28), (0, 23)], fill=1))
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, 48], fill=1))
    cv.shade({"beard"}, hairL, lambda d: d.polygon([(20, 40), (28, 46), (28, 53), (21, 46)], fill=1))
    cv.shade({"robe"}, C["i"], lambda d: d.rectangle([40, 40, N, N], fill=1))
    cv.shade({"robe"}, C["iL"], lambda d: d.line([(1, 55), (11, 50)], fill=1))
    cv.shade({"stole"}, C["r"], lambda d: d.rectangle([40, 40, N, N], fill=1))
    for y in (55, 59):
        cv.line([(17, y), (25, y)], C["G"], {"stole"})
        cv.line([(38, y), (46, y)], C["g"], {"stole"})
    # coin necklace: gold chain arc across the chest
    cv.fill("chain", C["G"], lambda d: d.line([(18, 47), (21, 53), (26, 57), (32, 58), (37, 57), (42, 53), (45, 47)], fill=1))
    cv.outline()

    # coins + reliquary star hung on the chain (after outline so they stay crisp)
    coin = [".KKK.", "KgGgK", "KGgGK", "KgGgK", ".KKK."]
    for x, y in ((17, 51), (22, 55), (37, 55), (42, 51)):
        cv.stamp(x, y, coin, {"K": C["gD"], "G": C["gL"], "g": C["G"]})
    cv.stamp(27, 55, ["....K....", "...KQK...", "..KQqQK..", ".KQQqQQK.", "KQqqQqqQK",
                      ".KQQqQQK.", "..KQqQK..", "...KQK...", "....K...."],
             {"K": C["gD"], "Q": C["Q"], "q": C["q"]})

    # sly eyes: left one half-lidded in candle light, right one a glint in the shadow
    pal = iris_pal((90, 50, 10), (200, 140, 40), (255, 220, 120), white=(226, 206, 176))
    eyes(cv, pal, y=24, inset=16, lid_drop=3)
    dim = iris_pal((60, 34, 10), (120, 80, 24), (255, 200, 90), white=(118, 88, 70))
    from portraitlib import EYE_FRAME_R, eye
    cv.stamp(N - 16 - 14, 24, eye(["." * 14] * 3 + EYE_FRAME_R[3:]), dim)
    # heavy lids
    cv.line([(18, 27), (29, 26)], C["K"])
    cv.line([(34, 26), (45, 27)], C["K"])
    cv.line([(19, 26), (28, 25)], r)
    # brows: left cocked up (sly), right flat and low
    cv.line([(18, 23), (22, 21), (28, 22)], hair)
    cv.line([(18, 24), (22, 22), (28, 23)], C["K"])
    cv.line([(35, 24), (45, 25)], C["K"])
    # nose
    cv.line([(31, 31), (32, 36)], r)
    cv.px(30, 37, r); cv.px(31, 37, r); cv.px(33, 37, C["K"])
    # moustache + lopsided smirk (rises on our left)
    cv.stamp(24, 38, ["..HHHH.HHHH..",
                      ".HhhHHHHHhHH.",
                      "H...........H"], {"H": hair, "h": hairL})
    cv.px(23, 40, C["K"]); cv.px(24, 41, C["K"])       # raised corner + dimple = smirk
    cv.line([(25, 42), (35, 42)], C["K"])
    cv.line([(27, 43), (33, 43)], (190, 100, 86))
    cv.px(36, 41, r)
    return cv.image(shift=0)


# ---------------------------------------------------------------- mechanic
def mechanic():
    """Tech-acolyte: young dark-skinned woman, crimson hood, brass lens, candle, hoses."""
    cv = Canvas({
        "hoodback": (1, C["K"]), "neck": (3, None), "robe": (4, C["K"]),
        "collar": (5, C["K"]), "face": (6, None), "hood": (7, C["K"]), "hose": (7.5, C["K"]), "strap": (8, C["K"]),
        "lens": (9, C["K"]), "candle": (10, C["K"]),
    })
    S, s, r = skin_layers(cv, "dark")

    cv.poly("hoodback", C["r"], [(9, 10), (18, 4), (32, 1), (46, 4), (54, 10), (57, 24),
                                 (58, 44), (60, 60), (3, 60), (5, 44), (6, 24)])
    # incense hoses rising from the collar behind the hood
    cv.poly("neck", s, [(26, 46), (37, 46), (37, 56), (26, 56)])
    cv.poly("robe", C["R"], [(0, 58), (12, 53), (24, 55), (39, 55), (51, 53), (63, 58), (63, 63), (0, 63)])
    # high brass ring collar with tube sockets
    cv.poly("collar", C["B"], [(14, 52), (24, 50), (39, 50), (49, 52), (51, 58), (44, 60), (19, 60), (12, 58)])

    cv.poly("face", S, jaw(15, 16, 47, 53, 2))
    # incense hoses: ribbed brass tubes plugged into the collar, snaking up the hood
    cv.fill("hose", C["B"], lambda d: d.line([(16, 55), (11, 50), (9, 42), (10, 34)], fill=1, width=4))
    cv.fill("hose", C["B"], lambda d: d.line([(47, 55), (52, 50), (54, 42), (53, 34)], fill=1, width=4))
    hood = [(6, 24), (9, 11), (18, 4), (32, 1), (45, 4), (54, 11), (57, 24), (59, 52),
            (50, 54), (48, 44), (48, 26), (45, 18), (38, 15), (25, 15), (18, 18), (15, 26),
            (15, 44), (13, 54), (4, 52)]
    cv.poly("hood", C["R"], hood)

    # brass monocle-lens over her right eye (viewer's right), strap across the brow
    cv.fill("strap", C["bD"], lambda d: d.line([(14, 21), (34, 23), (48, 24)], fill=1, width=2))
    cv.ellipse("lens", C["B"], (33, 20, 49, 36))
    # small candle on a brass arm clipped to the hood, left side
    cv.poly("candle", C["I"], [(9, 4), (13, 4), (13, 12), (9, 12)])
    cv.poly("candle", C["B"], [(7, 12), (15, 12), (15, 14), (7, 14)])

    # ---- shading ----
    cv.shade({"hoodback"}, C["rD"], lambda d: d.rectangle([0, -12, N, N], fill=1))
    cv.shade({"hood"}, C["rL"], lambda d: d.polygon([(6, 24), (9, 11), (18, 4), (24, 3), (13, 14), (9, 26), (8, 50), (5, 52)], fill=1))
    cv.shade({"hood"}, C["r"], lambda d: d.polygon([(42, -1), (55, 9), (59, 24), (60, 54), (51, 54), (51, 24), (44, 10)], fill=1))
    cv.line([(15, 44), (15, 27), (18, 19), (25, 16), (38, 16), (45, 19), (48, 27), (48, 44)], C["rD"], {"hood"})
    cv.line([(31, 3), (29, 10)], C["r"], {"hood"})
    # hose ribs
    cv.shade({"hose"}, C["b"], lambda d: d.rectangle([33, 0, N, N], fill=1))
    for y in range(35, 56, 3):
        cv.line([(0, y), (N, y)], C["bD"], {"hose"})
    face_shadow(cv, S, s, 40)
    cv.shade({"face"}, s, lambda d: d.rectangle([0, 0, N, 18], fill=1))
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, 52], fill=1))
    cv.shade({"robe"}, C["r"], lambda d: d.rectangle([40, 50, N, N], fill=1))
    cv.shade({"collar"}, C["b"], lambda d: d.rectangle([38, 50, N, N], fill=1))
    cv.line([(15, 53), (24, 51), (38, 51)], C["gL"], {"collar"})
    cv.line([(17, 57), (46, 57)], C["bD"], {"collar"})
    # lens: rings + glowing glass (candle orange)
    cv.shade({"lens"}, C["b"], lambda d: d.ellipse((35, 22, 49, 36), fill=1))
    cv.shade({"lens"}, C["fD"], lambda d: d.ellipse((36, 23, 46, 33), fill=1))
    cv.shade({"lens"}, C["f"], lambda d: d.ellipse((36, 23, 45, 32), fill=1))
    cv.shade({"lens"}, C["F"], lambda d: d.ellipse((37, 24, 42, 29), fill=1))
    cv.shade({"strap"}, C["b"], lambda d: d.line([(14, 21), (33, 23)], fill=1))
    cv.shade({"candle"}, C["i"], lambda d: d.rectangle([12, 0, 13, 12], fill=1))
    cv.outline()

    # warm candle light spilling on the lens edge, lens rivets
    for x, y in ((41, 21), (34, 28), (48, 28), (41, 35)):
        cv.px(x, y, C["gL"])
    cv.stamp(38, 25, ["ww.", "w..", "..."], {"w": (255, 255, 240)})
    # candle flame
    cv.stamp(9, -2, ["..F..", ".FfF.", ".FFf.", "fFFFf", ".fFf.", "..K.."], {"F": C["F"], "f": C["f"], "K": C["K"]})
    cv.px(10, -3, C["fD"])
    # one bare eye (left), green iris, slightly lowered lid
    pal = iris_pal((20, 80, 60), (40, 170, 120), (150, 240, 190))
    cv.stamp(16, 24, [row for row in _eye_left(lid=1)], pal)
    # brows
    cv.line([(17, 23), (23, 21), (28, 22)], C["K"])
    # nose + small neutral mouth
    cv.px(31, 38, r); cv.px(32, 39, r); cv.px(31, 39, r)
    cv.stamp(28, 44, [".KKKKK.", "..LLL.."], {"K": (60, 20, 22), "L": (170, 80, 80)})
    # glyph tattoo on the cheek: tiny star
    star(cv, 22, 40, False, C["G"], C["g"])
    return cv.image(shift=0)


def _eye_left(lid=0):
    """Left eye only (for portraits where the other eye is covered)."""
    from portraitlib import EYE_FRAME_L, EYE_W, IRIS, eye
    fl = ["." * EYE_W] * lid + EYE_FRAME_L[lid:]
    return eye(fl, IRIS)


# ---------------------------------------------------------------- pilot
def pilot():
    """Zealot knight: pale young man in an ivory-and-gold helm, raised visor, halo, gorget."""
    cv = Canvas({
        "halo": (1, C["qD"]), "mantle": (2, C["K"]), "neck": (3, None), "gorget": (4, C["K"]),
        "coif": (5, C["K"]), "face": (6, None), "helm": (7, C["K"]), "cheek": (8, C["K"]),
        "visor": (9, C["K"]),
    })
    S, s, r = skin_layers(cv, "pale")

    # halo: flat ring tilted around the top of the helm; its front arc hides behind the dome
    cv.fill("halo", C["Q"], lambda d: (d.ellipse((4, -6, 59, 12), fill=1), d.ellipse((8, -3, 55, 9), fill=0)))

    cv.poly("mantle", C["R"], [(0, 50), (8, 44), (55, 44), (63, 50), (63, 63), (0, 63)])
    cv.poly("neck", s, [(25, 40), (38, 40), (38, 48), (25, 48)])
    # gorget: stacked enamel lames over the collarbone, pauldron caps at the edges
    cv.poly("gorget", C["I"], [(6, 50), (14, 45), (24, 43), (39, 43), (49, 45), (57, 50),
                               (60, 58), (3, 58)])
    # padded crimson coif shows as a thin rim between face and cheek guards
    cv.poly("coif", C["r"], [(17, 14), (46, 14), (47, 38), (40, 46), (32, 49), (23, 46), (16, 38)])
    cv.poly("face", S, [(19, 14), (44, 14), (44, 32), (41, 40), (35, 45), (28, 45), (22, 40), (19, 32)])
    # helm: rounded dome, cheek guards leave a keyhole-shaped face opening
    cv.poly("helm", C["I"], [(10, 24), (10, 7), (14, 0), (22, -4), (32, -5), (41, -4),
                             (49, 0), (53, 7), (53, 24)])
    cheek = [(9, 20), (17, 16), (17, 30), (19, 39), (24, 46), (22, 50), (10, 50), (8, 36)]
    cv.poly("cheek", C["M"], cheek)
    cv.poly("cheek", C["M"], mirror(cheek))
    # raised visor plate pushed up onto the brow, T-slit visible in it
    cv.poly("visor", C["M"], [(13, 10), (18, 4), (32, 2), (45, 4), (50, 10), (49, 15),
                              (40, 17), (32, 18), (23, 17), (14, 15)])

    # ---- shading ----
    cv.shade({"halo"}, C["q"], lambda d: d.rectangle([36, -12, N, N], fill=1))
    cv.shade({"halo"}, (255, 255, 255), lambda d: d.line([(10, -2), (20, -5)], fill=1))
    cv.shade({"helm", "cheek"}, C["iL"], lambda d: d.polygon([(10, 8), (14, 0), (22, -4), (26, -4), (14, 10), (12, 26), (12, 44), (9, 44)], fill=1))
    cv.shade({"helm", "cheek"}, C["i"], lambda d: d.polygon([(42, -3), (54, 8), (56, 52), (40, 52), (46, 26), (46, 10)], fill=1))
    cv.shade({"helm", "cheek"}, C["iD"], lambda d: d.polygon([(51, 12), (56, 12), (56, 52), (49, 52)], fill=1))
    # gold trim along the cheek-guard edges and the guard's lower plate seam
    cv.line([(17, 17), (17, 30), (19, 39), (23, 46)], C["G"], {"cheek"})
    cv.line([(46, 17), (46, 30), (44, 39), (40, 46)], C["g"], {"cheek"})
    cv.shade({"cheek"}, C["m"], lambda d: d.rectangle([44, 0, N, N], fill=1))
    cv.shade({"cheek"}, (240, 242, 248), lambda d: d.line([(9, 22), (9, 36)], fill=1))
    cv.line([(9, 36), (18, 36)], C["mD"], {"cheek"})
    cv.line([(45, 36), (54, 36)], C["mD"], {"cheek"})
    # gold ridge up the dome, gold rim on the visor
    cv.line([(31, -4), (31, 2)], C["G"], {"helm"})
    cv.line([(32, -4), (32, 2)], C["g"], {"helm"})
    cv.shade({"visor"}, C["m"], lambda d: d.rectangle([40, -12, N, 30], fill=1))
    cv.line([(14, 15), (23, 17), (32, 18), (40, 17), (49, 15)], C["G"], {"visor"})
    cv.shade({"visor"}, (240, 242, 248), lambda d: d.line([(16, 9), (20, 6), (28, 4)], fill=1))
    # T-slit: horizontal eye slot + vertical breath slot
    cv.shade({"visor"}, C["K"], lambda d: d.rectangle([18, 9, 45, 10], fill=1))
    cv.shade({"visor"}, C["K"], lambda d: d.rectangle([31, 9, 32, 16], fill=1))
    cv.shade({"gorget"}, C["i"], lambda d: d.rectangle([38, 40, N, N], fill=1))
    for y0 in (48, 53):
        cv.line([(6, y0 + 3), (16, y0 - 1), (47, y0 - 1), (57, y0 + 3)], C["g"], {"gorget"})
    cv.line([(7, 50), (14, 46)], C["iL"], {"gorget"})
    cv.shade({"mantle"}, C["r"], lambda d: d.rectangle([40, 0, N, N], fill=1))
    cv.shade({"coif"}, C["rD"], lambda d: d.rectangle([0, 0, N, 20], fill=1))
    face_shadow(cv, S, s, 38)
    cv.shade_below("face", "visor", s, depth=3)
    cv.shade_below("face", "coif", s, depth=2)
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, N], fill=1))
    cv.outline()

    for x, y in ((12, 24), (12, 32), (51, 24), (51, 32), (13, 44), (50, 44)):
        cv.px(x, y, C["G"])   # rivets
    # star emblem on the helm brow, glowing blue jewel at the gorget
    star(cv, 31, -1, True, C["gL"], C["g"])
    cv.stamp(30, 45, [".Q.", "QwQ", ".q."], {"Q": C["Q"], "q": C["q"], "w": (255, 255, 255)})
    # small stern eyes (the anime kit is too wide for the helm opening)
    pal = {"K": C["K"], "W": (250, 244, 232), "e": (30, 60, 120), "E": (90, 150, 220),
           "p": (190, 230, 255), "P": (20, 20, 40), "w": (255, 255, 255)}
    cv.stamp(20, 21, ["KKKKKKKKK.",
                      "KKWweeeeWK",
                      "..WwEPPEW.",
                      "..WEEPPEW.",
                      "..WpEEEpW.",
                      "...KKKKK.."], pal)
    cv.stamp(34, 21, [".KKKKKKKKK",
                      "KWweeeeWKK",
                      ".WwEPPEW..",
                      ".WEEPPEW..",
                      ".WpEEEpW..",
                      "..KKKKK..."], pal)
    # brows angled down to the centre: zeal
    cv.line([(20, 19), (29, 20)], C["K"])
    cv.line([(34, 20), (43, 19)], C["K"])
    # nose, scar across the left cheek, firm mouth
    cv.line([(32, 28), (32, 33)], s)
    cv.px(31, 34, r); cv.px(32, 34, r)
    cv.line([(22, 26), (25, 33)], (220, 130, 120))
    cv.line([(28, 39), (35, 39)], (150, 60, 60))
    cv.px(31, 40, (230, 160, 150)); cv.px(32, 40, (230, 160, 150))
    return cv.image(shift=6)


# ---------------------------------------------------------------- commander
def commander():
    """Abbess Prime: older brown-skinned woman, tall mitre, white veil, glowing white eyes."""
    cv = Canvas({
        "rays": (1, None), "halo": (1, C["qD"]), "veilback": (2, C["K"]), "neck": (3, None), "robe": (4, C["K"]),
        "stole": (5, C["K"]), "face": (6, None), "veil": (7, C["K"]), "wimple": (8, C["K"]),
        "mitre": (9, C["K"]), "band": (10, C["K"]),
    })
    S, s, r = skin_layers(cv, "brown")
    # she is drawn high (mitre in the headroom) and shifted down at crop time
    SH = 12

    # sunburst halo: a ring plus short rays, all behind the veil and mitre
    import math
    cv.fill("halo", C["Q"], lambda d: (d.ellipse((3, -8, 60, 30), fill=1), d.ellipse((6, -5, 57, 27), fill=0)))
    for k in range(16):
        a = math.pi * k / 8
        x0, y0 = 31.5 + 30 * math.cos(a), 11 + 20 * math.sin(a)
        x1, y1 = 31.5 + 36 * math.cos(a), 11 + 26 * math.sin(a)
        cv.fill("rays", C["G"] if k % 2 else C["Q"], lambda d, p=[(x0, y0), (x1, y1)]: d.line(p, fill=1))
    cv.poly("veilback", C["i"], [(9, 8), (54, 8), (58, 30), (62, 52), (1, 52), (5, 30)])
    cv.poly("neck", s, [(26, 36), (37, 36), (37, 46), (26, 46)])
    cv.poly("robe", C["R"], [(0, 46), (12, 41), (51, 41), (63, 46), (63, 52), (0, 52)])
    stole = [(20, 41), (27, 43), (29, 52), (21, 52)]
    cv.poly("stole", C["I"], stole)
    cv.poly("stole", C["I"], mirror(stole))

    cv.poly("face", S, jaw(6, 18, 45, 41, 3))
    # veil hangs from the mitre, framing the face down to the shoulders
    veil = [(10, 10), (17, 6), (19, 16), (18, 28), (21, 36), (24, 42), (16, 46), (6, 48), (7, 28)]
    cv.poly("veil", C["I"], veil)
    cv.poly("veil", C["I"], mirror(veil))
    # wimple band across the forehead
    cv.poly("wimple", C["I"], [(17, 8), (46, 8), (46, 10), (40, 11), (23, 11), (17, 10)])
    # tall mitre: two peaks meeting at a point, cleft drawn as a line
    cv.poly("mitre", C["I"], [(18, 8), (16, 0), (19, -6), (31, -12), (32, -12), (44, -6),
                              (47, 0), (45, 8)])
    cv.poly("band", C["G"], [(16, 4), (47, 4), (47, 8), (16, 8)])

    # ---- shading ----
    cv.shade({"halo"}, C["q"], lambda d: d.rectangle([36, -12, N, N], fill=1))
    cv.shade({"veilback"}, C["iD"], lambda d: d.rectangle([34, -12, N, N], fill=1))
    cv.shade({"veil"}, C["iL"], lambda d: d.line([(9, 12), (8, 30), (8, 46)], fill=1))
    cv.shade({"veil"}, C["i"], lambda d: d.polygon([(36, 0), (63, 0), (63, 63), (40, 63)], fill=1))
    cv.line([(14, 14), (13, 30), (16, 42)], C["i"], {"veil"})
    cv.line([(49, 14), (50, 30), (47, 42)], C["iD"], {"veil"})
    cv.shade({"wimple"}, C["i"], lambda d: d.rectangle([38, 0, N, 20], fill=1))
    # mitre: crimson centre panel with gold edging, shaded right half
    cv.shade({"mitre"}, C["R"], lambda d: d.polygon([(25, 4), (25, -8), (31, -11), (32, -11), (38, -8), (38, 4)], fill=1))
    cv.shade({"mitre"}, C["G"], lambda d: d.line([(25, 4), (25, -8), (31, -11)], fill=1))
    cv.shade({"mitre"}, C["g"], lambda d: d.line([(32, -11), (38, -8), (38, 4)], fill=1))
    cv.shade({"mitre"}, C["i"], lambda d: d.polygon([(39, -12), (52, -12), (52, 6), (39, 6)], fill=1))
    cv.shade({"mitre"}, C["iL"], lambda d: d.line([(17, -1), (20, -6), (23, -8)], fill=1))
    cv.shade({"band"}, C["g"], lambda d: d.rectangle([38, 0, N, 10], fill=1))
    cv.shade({"band"}, C["gL"], lambda d: d.line([(17, 5), (30, 5)], fill=1))
    cv.shade({"robe"}, C["r"], lambda d: d.rectangle([40, 0, N, N], fill=1))
    cv.shade({"stole"}, C["i"], lambda d: d.rectangle([40, 0, N, N], fill=1))
    face_shadow(cv, S, s, 39)
    cv.shade_below("face", "wimple", s, depth=2)
    cv.shade({"neck"}, r, lambda d: d.rectangle([0, 0, N, N], fill=1))
    cv.outline()

    # mitre peak notch, star emblems: big one on the mitre, small ones on the vestments
    star(cv, 31, -5, True, C["F"], C["g"])
    for x, y in ((8, 49), (55, 49), (47, 44), (16, 44)):
        star(cv, x, y, False, C["G"], C["g"])
    for x in range(18, 46, 4):
        cv.px(x, 6, C["rL"])

    # glowing white eyes: no pupil, holy-blue rim, with a light bloom below
    glow = iris_pal(C["q"], C["Q"], (255, 255, 255), white=(255, 255, 255), pupil=(255, 255, 255))
    glow["e"] = C["Q"]
    glow["K"] = (40, 20, 60)
    eyes(cv, glow, y=12, inset=17, lid_drop=2)
    # holy light bleeding onto the cheeks under each eye
    for x0 in (21, 35):
        cv.line([(x0, 22), (x0 + 7, 22)], C["q"], {"face"})
    # brows (grey with age) and crow's-feet
    cv.line([(19, 13), (29, 14)], (190, 180, 170))
    cv.line([(34, 14), (44, 13)], (150, 140, 130))
    cv.line([(17, 18), (16, 19)], r)
    cv.line([(46, 18), (47, 19)], r)
    # nose, nasolabial lines, thin stern mouth
    cv.line([(32, 22), (32, 27)], s)
    cv.px(31, 28, r); cv.px(32, 28, r)
    cv.line([(25, 28), (24, 32)], s)
    cv.line([(38, 28), (39, 32)], r)
    cv.line([(28, 33), (35, 33)], (110, 40, 40))
    cv.px(31, 34, (190, 110, 90)); cv.px(32, 34, (190, 110, 90))
    return cv.image(shift=SH)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

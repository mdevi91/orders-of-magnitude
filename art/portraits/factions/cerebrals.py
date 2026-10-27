"""Cerebrals: Mars Attacks-style brain aliens.

Every portrait shares one head builder: an oversized pink brain (scalloped lobes, a centre fissure
and a few bold fold strokes), a small green skull face under it (bulging eyes, nose slits, lipless
toothy grin) and an optional glass dome drawn only as a bright rim arc plus glare streaks. Roles vary
the brain/face boxes and add their own collar, props and overlays.
"""
import math

from portraitlib import Canvas, N, mirror

C = {
    "K": (20, 8, 26),        # main ink
    # brain
    "B": (246, 146, 186),
    "Bl": (255, 204, 222),   # lit lobes (upper left)
    "Bw": (255, 238, 244),   # specular
    "Bd": (206, 92, 146),    # shade (right/below)
    "Bf": (138, 34, 96),     # fold strokes
    "Bo": (84, 14, 56),      # brain ink
    "V": (176, 30, 70),      # veins (commander)
    "Vl": (232, 70, 110),
    # skin
    "G": (150, 206, 92),
    "Gl": (198, 238, 140),
    "Gd": (96, 150, 64),
    "Gs": (58, 100, 46),     # sockets
    "Go": (26, 46, 22),      # skin ink
    # eyes / teeth
    "W": (250, 252, 236),
    "Ws": (196, 210, 180),
    "P": (16, 6, 20),
    "T": (246, 240, 214),
    "Ts": (180, 170, 140),
    "M": (52, 10, 30),
    # chrome
    "S": (190, 200, 218),
    "Sl": (248, 250, 255),
    "Sd": (116, 124, 150),
    "Sdd": (64, 66, 92),
    # purple / cyan tech
    "U": (104, 46, 156),
    "Ul": (156, 92, 210),
    "Ud": (62, 26, 100),
    "c": (70, 232, 255),
    "cl": (214, 255, 255),
    "cd": (30, 130, 180),
    # gold, white, misc
    "Y": (255, 214, 80),
    "y": (204, 140, 40),
    "Wc": (236, 240, 246),   # lab coat
    "Wcd": (170, 180, 204),
    "O": (246, 120, 40),
    "Od": (176, 64, 26),
    "R": (226, 40, 70),
    "Rd": (140, 20, 50),
    # glass
    "gl": (200, 246, 255),
    "gm": (110, 186, 230),
    "gd": (60, 104, 160),
}

LAYERS = {
    "cable":  (1, C["Ud"]),
    "body":   (2, C["K"]),
    "bladeA": (2.4, C["K"]),   # commander collar blades, split over two layers so they ink apart
    "bladeB": (2.7, C["K"]),
    "collar": (3, C["K"]),
    "neck":   (4, C["Go"]),
    "face":   (5, C["Go"]),
    "brain":  (6, C["Bo"]),
    "gear":   (7, C["K"]),     # goggles, helmet band, probes
    "gear2":  (8, C["K"]),
}


def ell(cv, layer, col, cx, cy, rx, ry):
    cv.ellipse(layer, col, (cx - rx, cy - ry, cx + rx, cy + ry))


# ---------- brain ----------

# fold strokes in unit coords (u: -1 left .. 1 right, v: -1 top .. 1 bottom), left hemisphere only;
# mirrored for the right. A few bold strokes read better than many thin ones at 64px.
FOLDS = [
    [(-0.10, -0.86), (-0.28, -0.70), (-0.20, -0.52), (-0.40, -0.38)],
    [(-0.70, -0.58), (-0.52, -0.46), (-0.66, -0.24), (-0.50, -0.10)],
    [(-0.92, 0.08), (-0.72, 0.16), (-0.58, 0.04), (-0.36, 0.14), (-0.22, -0.04)],
    [(-0.78, 0.52), (-0.56, 0.42), (-0.40, 0.56), (-0.18, 0.48)],
]

def brain(cv, cx, cy, rx, ry, folds=FOLDS, lobes=9, sweep=(1.0, 2.0)):
    """Scalloped brain: main ellipse plus lobe bumps along the rim, cel-shaded as a sphere, with a
    centre fissure and bold fold strokes (dark groove + shadow below + lit lip above)."""
    ell(cv, "brain", C["B"], cx, cy, rx, ry)
    lr = max(3, round(rx / 3.6))
    a0, a1 = sweep
    for i in range(lobes):
        a = math.pi * (a0 + (a1 - a0) * i / (lobes - 1))
        bx = cx + (rx - lr * 0.55) * math.cos(a)
        by = cy + (ry - lr * 0.55) * math.sin(a)
        ell(cv, "brain", C["B"], round(bx), round(by), lr, lr)

    def P(u, v):
        return (round(cx + u * rx), round(cy + v * ry))

    def inside(x, y, ox, oy, sx, sy):
        return ((x - ox) / sx) ** 2 + ((y - oy) / sy) ** 2 <= 1

    everywhere = lambda d: d.rectangle((0, -12, 63, 63), fill=1)
    # sphere shading: shadow crescent on the right/bottom, lit cap upper-left
    cv.shade({"brain"}, C["Bd"], everywhere,
             where=lambda x, y: not inside(x, y, cx - rx * 0.28, cy - ry * 0.25, rx * 1.02, ry * 1.02))
    cv.shade({"brain"}, C["Bl"], everywhere,
             where=lambda x, y: inside(x, y, cx - rx * 0.42, cy - ry * 0.45, rx * 0.5, ry * 0.42))

    def stroke(pts):
        # groove: lit lip above-left, shadow below, dark line on top
        cv.line([(x, y - 1) for x, y in pts], C["Bl"] if pts[0][0] < cx else C["B"], {"brain"})
        cv.line([(x, y + 1) for x, y in pts], C["Bd"], {"brain"})
        cv.line(pts, C["Bf"], {"brain"})

    for f in folds:
        pts = [P(u, v) for u, v in f]
        stroke(pts)
        stroke([(round(2 * cx) - x, y) for x, y in pts])
    # fissure between hemispheres, 2px dark at the top
    top = P(0, -1.25)
    cv.line([top, P(0, -0.35), P(-0.03, 0.05)], C["Bf"], {"brain"})
    cv.line([(top[0] + 1, top[1]), (P(0, -0.6)[0] + 1, P(0, -0.6)[1])], C["Bo"], {"brain"})
    # speculars on the lit lobes
    for u, v in ((-0.58, -0.66), (-0.36, -0.84)):
        x, y = P(u, v)
        cv.px(x, y, C["Bw"])
        cv.px(x + 1, y, C["Bw"])
        cv.px(x, y + 1, C["Bw"])


# ---------- face ----------

EYE = [
    "..KKKKK..",
    ".KWWWWWK.",
    "KWwWWWWWK",
    "KWWWWWWWK",
    "KWWWPPWWK",
    "KWWWPPWWK",
    "KWWWWWWsK",
    ".KsWWWsK.",
    "..KKKKK..",
]
# sly: pupils slid to the side (merchant)
EYE_SLY = [r.replace("PP", "WW") for r in EYE]
EYE_SLY[4] = "KWPPWWWWK"
EYE_SLY[5] = "KWPPWWWWK"
# mad: pinprick pupils (mechanic)
EYE_MAD = [r.replace("PP", "WW") for r in EYE]
EYE_MAD[4] = "KWWWPWWWK"
# glowing commander eyes
EYE_GLOW = [
    ".KKKKK.",
    "KcccccK",
    "KcwwccK",
    "KcwwccK",
    "KcccccK",
    "KdcccdK",
    ".KKKKK.",
]


def eye_pal(white=C["W"]):
    return {"K": C["K"], "W": white, "w": (255, 255, 255), "P": C["P"], "s": C["Ws"],
            "c": C["c"], "d": C["cd"]}


def grin(cv, x0, y0, w, smirk=0):
    """Lipless grin: two rows of 2px teeth split by dark lines. Corners curl up; smirk lifts the
    right end further."""
    for i in range(w):
        # curve: ends rise by 1 (and the right end by `smirk` more)
        lift = 0
        if i in (0, w - 1):
            lift = 1
        if smirk and i >= w - 3:
            lift += smirk if i == w - 1 else smirk - 1 + (i == w - 2)
        y = y0 - lift
        edge = i in (0, w - 1)
        col = []
        for r in range(6):
            if r in (0, 5) or edge:
                col.append(C["K"])
            elif r == 3:
                col.append(C["M"])
            elif (i % 3) == 0:
                col.append(C["Ts"])
            else:
                col.append(C["T"] if r != 4 else (C["Ts"] if i > w * 0.6 else C["T"]))
        for r, c in enumerate(col):
            if edge and r in (0, 5):
                continue
            cv.px(x0 + i, y + r, c)


def face(cv, cx, top, cheek, bottom, chin, eye_y, grin_w=14, eyes=EYE, eye_gap=2, smirk=0,
         lids=False, socket=True):
    """Skull face: wide cheekbones narrowing to a small chin. Returns nothing; details are stamped
    later by face_details (after the outline pass)."""
    hw = cheek
    pts = [(cx - hw + 1, top), (cx - hw, eye_y + 4), (cx - hw + 2, eye_y + 10),
           (cx - chin, bottom - 2), (cx - chin + 2, bottom)]
    pts = pts + mirror(pts) if cx == 31.5 else pts + [(2 * cx - x, y) for x, y in reversed(pts)]
    cv.poly("face", C["G"], pts)
    # right-side cel shadow and a jaw shadow
    cv.shade({"face"}, C["Gd"], lambda d: d.rectangle((cx + hw * 0.45, top, 64, 64), fill=1))
    cv.shade({"face"}, C["Gd"], lambda d: d.rectangle((0, bottom - 3, 64, 64), fill=1))
    # rim light down the left cheek
    cv.line([(cx - hw + 2, eye_y + 1), (cx - hw + 2, eye_y + 7), (cx - hw + 4, eye_y + 11)],
            C["Gl"], {"face"})


def neck(cv, cx, y0, y1, w):
    cv.poly("neck", C["Gd"], [(cx - w, y0), (cx + w, y0), (cx + w, y1), (cx - w, y1)])


def face_details(cv, cx, eye_y, mouth_y, grin_w, eyes=EYE, gap=2, smirk=0, lids=False,
                 socket=True, glow=False):
    ew = len(eyes[0])
    lx = round(cx - gap / 2 - ew + 0.5)
    rx = round(cx + gap / 2 + 0.5)
    if socket:
        # dark sockets behind the bulging eyes (skull look)
        for x0 in (lx, rx):
            cv.shade({"face"}, C["Gs"], lambda d, x0=x0: d.ellipse(
                (x0 - 1, eye_y - 1, x0 + ew, eye_y + len(eyes) + 0), fill=1))
    pal = eye_pal()
    cv.stamp(lx, eye_y, eyes, pal)
    cv.stamp(rx, eye_y, eyes, pal)
    if lids:
        # heavy half-lids: smug / bored
        for x0 in (lx, rx):
            for dx in range(1, ew - 1):
                cv.px(x0 + dx, eye_y + 1, C["Gd"])
                cv.px(x0 + dx, eye_y + 2, C["Gd"])
                cv.px(x0 + dx, eye_y + 3, C["K"])
    # nose slits
    ny = mouth_y - 3
    cv.px(round(cx - 1.5), ny, C["Go"])
    cv.px(round(cx + 1.5), ny, C["Go"])
    cv.px(round(cx - 1.5), ny + 1, C["Gs"])
    cv.px(round(cx + 1.5), ny + 1, C["Gs"])
    grin(cv, round(cx - grin_w / 2 + 0.5), mouth_y, grin_w, smirk)


# ---------- glass dome ----------

def dome(cv, cx, cy, rx, ry, base_y, glare=True):
    """Glass shown only by its rim: bright arc on the lit left, dimmer on the right, plus two
    glare streaks. Pixels below base_y are left alone (the dome seats on the collar ring)."""
    steps = 400
    for i in range(steps):
        a = 2 * math.pi * i / steps
        x = round(cx + rx * math.cos(a))
        y = round(cy + ry * math.sin(a))
        if y > base_y:
            continue
        lit = math.cos(a) < 0.15 and math.sin(a) < 0.5
        cv.px(x, y, C["gl"] if lit else C["gm"])
        # ink just outside the rim so it reads on any background
        ox = round(cx + (rx + 1) * math.cos(a))
        oy = round(cy + (ry + 1) * math.sin(a))
        if oy <= base_y and 0 <= ox < N and -12 <= oy < N and cv.layer[oy][ox] is None:
            cv.px(ox, oy, C["gd"])
    if glare:
        # long curved streak inside the upper-left rim, short one beside it
        for k, (a0, a1, inset) in enumerate(((3.55, 4.25, 3), (3.75, 4.05, 6))):
            for i in range(40):
                a = a0 + (a1 - a0) * i / 39
                x = round(cx + (rx - inset) * math.cos(a))
                y = round(cy + (ry - inset) * math.sin(a))
                cv.px(x, y, C["gl"] if k == 0 else (255, 255, 255))
        # small glint on the right
        for i in range(12):
            a = 5.55 + 0.25 * i / 11
            cv.px(round(cx + (rx - 3) * math.cos(a)), round(cy + (ry - 3) * math.sin(a)), C["gm"])


# ---------- roles ----------

def merchant():
    cv = Canvas(LAYERS)
    cx = 31.5
    # rich purple jacket, gold lapel trim
    cv.poly("body", C["U"], [(0, 56), (14, 50), (49, 50), (63, 56), (63, 63), (0, 63)])
    cv.shade({"body"}, C["Ud"], lambda d: d.rectangle((40, 0, 64, 64), fill=1))
    cv.line([(2, 57), (14, 52)], C["Ul"], {"body"})
    # high frilled collar: white ruff fanning up behind the jaw
    ruff = []
    for i in range(11):
        a = math.pi * (0.95 + 1.1 * i / 10)
        r = 21 if i % 2 == 0 else 17
        ruff.append((round(31.5 + r * math.cos(a)), round(54 + 12 * math.sin(a) * (r / 21))))
    cv.poly("collar", C["Wc"], [(9, 58)] + ruff + [(54, 58), (40, 60), (23, 60)])
    cv.shade({"collar"}, C["Wcd"], lambda d: d.rectangle((38, 0, 64, 64), fill=1))
    # pleats: grey lines from the throat out to each inner notch of the ruff
    for x, y in ruff[1::2]:
        cv.line([(31, 56), (x, y + 1)], C["Wcd"] if x < 38 else C["Sd"], {"collar"})
    neck(cv, cx, 44, 54, 4)
    face(cv, cx, 26, 12, 50, 4, 31)
    brain(cv, cx, 15, 22, 16)
    # chrome dome-seat ring at the collar
    cv.poly("gear", C["S"], [(15, 49), (48, 49), (46, 53), (17, 53)])
    cv.shade({"gear"}, C["Sd"], lambda d: d.rectangle((38, 0, 64, 64), fill=1))
    cv.line([(17, 50), (30, 50)], C["Sl"], {"gear"})
    # bow tie
    cv.poly("gear2", C["R"], [(24, 54), (31, 57), (24, 61)])
    cv.poly("gear2", C["R"], [(39, 54), (32, 57), (39, 61)])
    cv.poly("gear2", C["Rd"], [(30, 55), (33, 55), (33, 59), (30, 59)])
    cv.outline()
    dome(cv, cx, 22, 27, 30, 49)
    face_details(cv, cx, 30, 43, 14, eyes=EYE_SLY, smirk=2, lids=True)
    # monocle on the right eye: gold ring + chain to the collar
    for i in range(48):
        a = 2 * math.pi * i / 48
        cv.px(round(37.0 + 5.4 * math.cos(a)), round(34 + 5.4 * math.sin(a)), C["Y"])
    cv.line([(41, 38), (44, 44), (43, 49)], C["y"])
    # gold lapel trim down to the buttons
    cv.line([(13, 52), (24, 63)], C["Y"], {"body"})
    cv.line([(50, 52), (39, 63)], C["y"], {"body"})
    # gold buttons
    for y in (58, 61):
        cv.px(31, y, C["Y"])
    return cv.image(shift=2)


def mechanic():
    cv = Canvas(LAYERS)
    cx = 31.5
    # lab coat: white lapels over a dark purple undershirt
    cv.poly("body", C["Wc"], [(0, 55), (12, 49), (51, 49), (63, 55), (63, 63), (0, 63)])
    cv.shade({"body"}, C["Wcd"], lambda d: d.rectangle((40, 0, 64, 64), fill=1))
    cv.poly("collar", C["Ud"], [(24, 50), (39, 50), (35, 63), (28, 63)])
    cv.poly("collar", C["Wc"], [(12, 49), (24, 49), (31, 63), (18, 63)])
    cv.poly("collar", C["Wcd"], mirror([(12, 49), (24, 49), (31, 63), (18, 63)]))
    neck(cv, cx, 44, 52, 4)
    face(cv, cx, 26, 12, 50, 4, 31)
    brain(cv, cx, 14, 22, 15)
    # probes: chrome needles pushed into the brain, cables trailing out behind
    probes = [((17, 4), (8, -6)), ((31, -1), (31, -11)), ((46, 4), (55, -6))]
    for (bx, by), (tx, ty) in probes:
        cv.fill("gear", C["S"], lambda d, b=(bx, by), t=(tx, ty): d.line([b, t], fill=1, width=3))
        cv.fill("gear2", C["c"], lambda d, t=(tx, ty): d.ellipse((t[0] - 2, t[1] - 2, t[0] + 2, t[1] + 2), fill=1))
    cv.fill("cable", C["Ul"], lambda d: d.line([(8, -6), (3, 0), (2, 14), (6, 30), (8, 48)], fill=1, width=3))
    cv.fill("cable", C["Ul"], lambda d: d.line([(55, -6), (60, 2), (61, 16), (57, 32), (56, 48)], fill=1, width=3))
    cv.fill("cable", C["Ul"], lambda d: d.line([(31, -11), (40, -11), (50, -9), (58, -2)], fill=1, width=3))
    # goggles strapped across the lower brain
    cv.poly("gear", C["Sdd"], [(9, 20), (54, 20), (54, 24), (9, 24)])
    ell(cv, "gear2", C["S"], 23, 22, 6, 5)
    ell(cv, "gear2", C["S"], 40, 22, 6, 5)
    cv.outline()
    for gx in (23, 40):
        cv.shade({"gear2"}, C["cd"], lambda d, gx=gx: d.ellipse((gx - 3, 19, gx + 3, 25), fill=1))
        cv.px(gx - 1, 20, C["cl"])
        cv.px(gx - 2, 21, C["cl"])
    face_details(cv, cx, 30, 43, 14, eyes=EYE_MAD)
    # sparks at the probe tips
    for tx, ty in ((8, -6), (31, -11), (55, -6)):
        cv.px(tx - 1, ty - 1, C["cl"])
    return cv.image(shift=10)


def pilot():
    cv = Canvas(LAYERS)
    cx = 31.5
    # orange flight suit, dark chest harness strap, padded collar ring
    cv.poly("body", C["O"], [(0, 55), (10, 50), (53, 50), (63, 55), (63, 63), (0, 63)])
    cv.shade({"body"}, C["Od"], lambda d: d.rectangle((42, 0, 64, 64), fill=1))
    cv.line([(2, 56), (10, 52)], (255, 170, 90), {"body"})
    cv.shade({"body"}, C["Ud"], lambda d: d.polygon([(36, 52), (41, 52), (30, 64), (25, 64)], fill=1))
    ell(cv, "collar", C["Ud"], 31.5, 50, 17, 6)
    cv.shade({"collar"}, C["U"], lambda d: d.rectangle((0, 0, 30, 47), fill=1))
    neck(cv, cx, 42, 50, 4)
    face(cv, cx, 26, 11, 48, 4, 30)
    brain(cv, cx, 18, 17, 12, lobes=7)
    # helmet band: chrome ring at the brow with ear discs; antenna off the right ear
    cv.poly("gear", C["S"], [(12, 24), (51, 24), (50, 29), (13, 29)])
    cv.shade({"gear"}, C["Sd"], lambda d: d.rectangle((40, 0, 64, 64), fill=1))
    cv.line([(14, 25), (30, 25)], C["Sl"], {"gear"})
    ell(cv, "gear2", C["S"], 12, 27, 4, 4)
    ell(cv, "gear2", C["Sd"], 51, 27, 4, 4)
    cv.fill("gear", C["S"], lambda d: d.line([(53, 23), (57, 6), (57, 0)], fill=1, width=3))
    ell(cv, "gear2", C["R"], 57, -1, 3, 3)
    cv.outline()
    # ear lights + antenna blink
    cv.stamp(11, 26, ["cc", "cd"], {"c": C["c"], "d": C["cd"]})
    cv.stamp(50, 26, ["cc", "cd"], {"c": C["c"], "d": C["cd"]})
    cv.stamp(56, -2, ["ww", "w."], {"w": (255, 200, 200)})
    dome(cv, cx, 16, 20, 15, 24)
    face_details(cv, cx, 30, 41, 12)
    # headset mic boom from the left ear disc to the corner of the grin
    cv.line([(12, 31), (14, 38), (19, 42)], C["K"])
    cv.line([(13, 31), (15, 38), (19, 41)], C["S"])
    cv.stamp(19, 40, ["KK", "Kc", "KK"], {"K": C["K"], "c": C["R"]})
    # insignia: little flying saucer on the left chest
    cv.stamp(9, 55, ["..ccc..", ".cSSSc.", "SSSSSSS", ".KYKYK."],
             {"c": C["c"], "S": C["Sl"], "K": C["Sdd"], "Y": C["Y"]})
    return cv.image(shift=4)


def glow_ring(cv, layer, cols):
    """Paint rings of colour on the empty pixels around a layer (aura). cols: inner to outer."""
    src = {(x, y) for y in range(-12, N) for x in range(N) if cv.layer[y][x] == layer}
    done = set(src)
    for col in cols:
        ring = set()
        for x, y in src:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in done and 0 <= q[0] < N and -12 <= q[1] < N and cv.layer[q[1]][q[0]] is None:
                    ring.add(q)
        for x, y in ring:
            if col:
                cv.px(x, y, col)
        done |= ring
        src = ring


def commander():
    # designed with shift=12: canvas y -12 is the top of the frame, 51 the bottom
    cv = Canvas(LAYERS)
    cx = 31.5
    cv.poly("body", C["Ud"], [(0, 44), (12, 40), (51, 40), (63, 44), (63, 51), (0, 51)])
    # ornate chrome collar: fan of blades (alternating layers so each gets its own ink line)
    # rising behind the tiny face, plus a gold-trimmed chest plate with a gem clasp
    blades = [((0, 49), (9, 47), (1, 27), "bladeA"), ((5, 48), (17, 46), (9, 25), "bladeB"),
              ((13, 47), (25, 45), (18, 30), "bladeA")]
    for (b0, b1, tip, lay) in blades:
        for pts in ([b0, tip, b1], mirror([b0, tip, b1])):
            cv.poly(lay, C["S"], pts)
            mx = (pts[0][0] + pts[2][0]) / 2
            t = pts[1]
            # right half of each blade in shadow, lit edge on the left
            cv.shade({lay}, C["Sd"], lambda d, t=t, mx=mx, p=pts: d.polygon([t, (mx, p[0][1]), p[2] if p[2][0] > mx else p[0]], fill=1))
            cv.px(t[0], t[1] + 1, C["Y"])
            cv.px(t[0], t[1] + 2, C["y"])
    cv.poly("collar", C["S"], [(0, 51), (0, 46), (14, 43), (24, 42), (39, 42), (49, 43), (63, 46), (63, 51)])
    cv.shade({"collar"}, C["Sd"], lambda d: d.rectangle((36, -12, 64, 64), fill=1))
    cv.shade({"collar"}, C["Y"], lambda d: d.line([(0, 47), (14, 44), (24, 43), (39, 43), (49, 44), (63, 47)], fill=1))
    cv.shade({"collar"}, C["y"], lambda d: d.line([(0, 48), (14, 45), (24, 44), (39, 44), (49, 45), (63, 48)], fill=1))
    for gx in (8, 55):
        cv.shade({"collar"}, C["U"], lambda d, gx=gx: d.rectangle((gx - 1, 48, gx + 1, 50), fill=1))
        cv.px(gx - 1, 48, C["Ul"])
    neck(cv, cx, 38, 46, 3)
    face(cv, cx, 26, 8, 44, 3, 31)
    brain(cv, cx, 9, 27, 21, folds=FOLDS, lobes=11, sweep=(0.92, 2.08))
    # veins: branching red vessels crawling up from the brain stem
    veins = [
        [(28, 29), (22, 23), (13, 19), (7, 12)],
        [(21, 22), (19, 12), (13, 4)],
        [(35, 29), (41, 23), (50, 19), (56, 12)],
        [(42, 22), (44, 12), (50, 4)],
        [(31, 27), (31, 18)],
    ]
    for v in veins:
        cv.line(v, C["V"], {"brain"})
        cv.line([(x + 1, y) for x, y in v], C["Rd"], {"brain"})
        cv.line([(x - 1, y) for x, y in v[1:]], C["Vl"], {"brain"})
    cv.outline()
    glow_ring(cv, "brain", [C["U"], None, C["Ud"]])
    # gem clasp at the throat
    cv.stamp(29, 46, [".KK.", "KccK", "KdcK", ".KK."], {"K": C["K"], "c": C["c"], "d": C["cd"]})
    face_details(cv, cx, 31, 41, 9, eyes=EYE_GLOW, gap=1)
    return cv.image(shift=12)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

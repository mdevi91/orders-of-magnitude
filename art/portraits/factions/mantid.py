"""Mantid Hive portraits: insectoid mantis people (swarm fighters).

Shared anatomy: an inverted-triangle head with two big glossy compound eyes on its top corners,
small mandibles at the chin point, long antennae running up out of frame, a segmented neck on a
wide pronotum (thorax shield) and folded raptorial forearms framing the bottom corners.
Faction palette: chitin greens/teals, amber-gold accents, dark red markings.

Each role reuses the same builders with its own palette tweaks, pose (head tilt) and gear.
"""
import math

from portraitlib import Canvas, N, mirror, mask_of

K = (10, 22, 18)          # ink outline (dark green-black, still reads on pure black)

BASE = {
    "hi": (176, 236, 128),    # chitin rim light
    "G": (92, 188, 100),      # chitin base
    "g": (48, 132, 86),       # chitin cel shadow
    "d": (26, 78, 62),        # chitin deep shadow
    "T": (56, 182, 168),      # teal plates
    "t": (30, 114, 120),      # teal shadow
    "Y": (255, 212, 72),      # gold
    "y": (206, 130, 34),      # gold shade
    "R": (200, 44, 52),       # red markings
    "r": (118, 24, 38),       # red shadow
    # compound eye ramp, light -> dark, plus facet speckle and gloss
    "e2": (150, 240, 176),
    "e1": (46, 170, 132),
    "e0": (16, 82, 76),
    "ef": (24, 112, 96),
    "eP": (8, 34, 34),        # pseudopupil (the dark spot that seems to follow you)
    "W": (244, 255, 236),
}

LAYERS = {
    "antenna": (1, None),
    "back": (2, K),
    "thorax": (3, K),
    "neck": (4, K),
    "collar": (5, K),
    "head": (6, K),
    "crest": (7, K),
    "eye": (8, K),
    "mouth": (9, K),
    "gear": (10, K),
    "arm": (11, K),
    "claw": (12, K),
    "tool": (13, K),
    "fx": (14, None),        # flames/glows: no ink
}
CHITIN = {"head", "neck", "thorax", "arm", "claw", "mouth"}


def pal(**over):
    p = dict(BASE)
    p.update(over)
    return p


def sym(left):
    """Left half (listed top-centre -> down the left side -> bottom-centre) + its mirror."""
    return left + mirror(left)


def ell(box, n=40):
    x0, y0, x1, y1 = box
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    return [(cx + rx * math.cos(2 * math.pi * i / n), cy + ry * math.sin(2 * math.pi * i / n)) for i in range(n)]


class Pose:
    """Rotates points around a pivot: lets one role tilt the whole head without redrawing it."""

    def __init__(self, deg=0.0, pivot=(31.5, 14), dx=0, dy=0, s=1.15):
        self.a = math.radians(deg)
        self.p = pivot
        self.dx, self.dy = dx, dy
        self.s = s   # head scale: the head is authored small and blown up to fill the frame

    def __call__(self, pts):
        c, s = math.cos(self.a) * self.s, math.sin(self.a) * self.s
        px, py = self.p
        return [(px + (x - px) * c - (y - py) * s + self.dx, py + (x - px) * s + (y - py) * c + self.dy)
                for x, y in pts]

    def pt(self, x, y):
        (x2, y2), = self([(x, y)])
        return round(x2), round(y2)


# ---------------------------------------------------------------- shading helpers

def shade_right(cv, layers, color, x0, slope=0.0):
    """Cel shadow on everything right of a (slightly slanted) vertical line."""
    cv.shade(layers, color, lambda d: d.rectangle([0, -12, 63, 63], fill=1),
             where=lambda x, y: x >= x0 + slope * y)


def rim(cv, layers, color, side=-1, depth=1):
    """Light the first inner pixel(s) next to the ink on the left (side=-1) edge of a layer."""
    hits = []
    for y in range(-12, N):
        for x in range(N):
            name = cv.layer[y][x]
            if name not in layers or cv.col[y][x] == K:
                continue
            for k in range(1, depth + 1):
                nx = x + side * k
                if 0 <= nx < N and cv.layer[y][nx] == name and cv.col[y][nx] == K:
                    hits.append((x, y))
                    break
    for x, y in hits:
        cv.px(x, y, color)


def antenna(cv, P, pts, col, dark):
    """1px antenna with a dark shadow pixel trailing on its right; drawn behind everything."""
    shifted = [(x + 1, y) for x, y in pts]
    cv.fill("antenna", dark, lambda d: d.line(shifted, fill=1))
    cv.fill("antenna", col, lambda d: d.line(pts, fill=1))


def curve(p0, p1, p2, n=10):
    """Quadratic bezier as a polyline (for antennae)."""
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


# ---------------------------------------------------------------- anatomy

HEAD_L = [(31, 5), (24, 6), (17, 10), (14, 15), (16, 22), (21, 30), (26, 37), (29, 41), (31, 42)]
EYE_L = (8, 5, 25, 26)       # ellipse box, bulges past the head corner
EYE_R = (N - 1 - 25, 5, N - 1 - 8, 26)


def head(cv, C, T, head_l=HEAD_L, eye_l=EYE_L, eye_r=EYE_R):
    cv.poly("head", C["G"], T(sym(head_l)))
    cv.poly("eye", C["e1"], T(ell(eye_l)))
    cv.poly("eye", C["e1"], T(ell(eye_r)))
    # frons plate between the eyes and clypeus above the mouth (teal inlay)
    cv.shade({"head"}, C["T"], lambda d: d.polygon(T([(28, 22), (35, 22), (36, 30), (33, 35), (30, 35), (27, 30)]), fill=1))


def head_shading(cv, C, T):
    cx, _ = T.pt(31.5, 20)
    shade_right(cv, {"head"}, C["g"], cx + 3, 0)
    cv.shade({"head"}, C["t"], lambda d: d.polygon(T([(33, 22), (35, 22), (36, 30), (33, 35)]), fill=1))
    # under-eye shadow (eyes overhang the cheeks)
    cv.shade({"head"}, C["d"], lambda d: d.polygon(T([(17, 24), (25, 27), (24, 30), (19, 28)]), fill=1))
    cv.shade({"head"}, C["d"], lambda d: d.polygon(T(mirror([(17, 24), (25, 27), (24, 30), (19, 28)])), fill=1))
    rim(cv, {"head"}, C["hi"])
    # suture line from frons down to clypeus
    cv.line(T([(31.5, 24), (31.5, 33)]), C["t"], {"head"})


def ocelli(cv, C, T, col=None):
    """Three simple eyes in a triangle on the vertex between the antennae."""
    col = col or C["Y"]
    for x, y in ((31, 9), (29, 12), (34, 12)):
        cv.px(*T.pt(x, y), col)


def compound_eye(cv, C, T, box, pupil=(0, 0), glow=False):
    """Glossy faceted eye: 3-band light ramp (lit upper-left), facet speckle, a pseudopupil and
    one bright highlight. pupil = offset of the pseudopupil from the eye's inner-front spot."""
    x0, y0, x1, y1 = box
    cx, cy = T.pt((x0 + x1) / 2, (y0 + y1) / 2)
    rx, ry = (x1 - x0) / 2 * T.s, (y1 - y0) / 2 * T.s
    for y in range(-12, N):
        for x in range(N):
            if cv.layer[y][x] != "eye" or cv.col[y][x] == K:
                continue
            u, v = (x - cx) / rx, (y - cy) / ry
            if u * u + v * v > 1.6:
                continue
            d = 0.55 * u + 0.8 * v
            if glow:   # lit from within: hot core, darker rim
                rr = (u + 0.15) ** 2 + (v + 0.1) ** 2
                c = C["e2"] if rr < 0.2 else C["e1"] if rr < 0.65 and d < 0.6 else C["e0"]
            else:
                c = C["e2"] if d < -0.55 else C["e1"] if d < 0.35 else C["e0"]
            # hex-ish facet speckle: every other row, offset by 2 on alternate pairs
            # facets only show in the shadow band, so the lit part stays glossy
            if c == C["e0"] and y % 2 == 0 and (x + (y // 2) % 2 * 2) % 4 == 0:
                c = C["ef"]
            cv.col[y][x] = c
    # pseudopupil: 2x2 dark spot toward the face, gives the eye a gaze (glowing eyes have none)
    side = 1 if (x0 + x1) / 2 < 31.5 else -1
    px, py = cx + side * 3 + pupil[0], cy + 1 + pupil[1]
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        if not glow:
            cv.px(px + dx, py + dy, C["eP"])
    # gloss highlight upper-left of the eye
    hx, hy = cx - round(rx * 0.45), cy - round(ry * 0.5)
    cv.stamp(hx, hy, ["WWW", "WW.", "W.."], C)


def notch(cv, pts):
    """Chip a bite out of the silhouette (before outline(), which then inks the broken edge)."""
    m = mask_of(lambda d: d.polygon(pts, fill=1))
    for y in range(-12, N):
        for x in range(N):
            if m.get(x, y):
                cv.layer[y][x], cv.col[y][x], cv.z[y][x] = None, None, 0


def halo(cv, layer, colors):
    """Paint rings of glow into the empty background around a layer (one colour per ring)."""
    for col in colors:
        ring = [(x, y) for y in range(-12, N) for x in range(N) if cv.layer[y][x] is None and
                any(0 <= x + dx < N and -12 <= y + dy < N and
                    (cv.layer[y + dy][x + dx] == layer or cv.col[y + dy][x + dx] in colors)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in ring:
            if cv.col[y][x] is None:
                cv.col[y][x] = col


# sickle-shaped mandible: hangs below the chin and hooks inward so the tips nearly meet
MAND_L = [(25, 37), (29, 38), (30, 43), (31, 48), (30, 51), (28, 47), (25, 42)]


def mandibles(cv, C, T, spread=0, mand_l=MAND_L):
    left = [(x - spread, y) for x, y in mand_l]
    cv.poly("mouth", C["G"], T(left))
    cv.poly("mouth", C["g"], T(mirror(left)))


def mouth_detail(cv, C, T, spread=0):
    """Gold mandible tips and maxillary palps (little segmented feelers beside the mouth)."""
    cv.px(*T.pt(30 - spread, 49), C["Y"])
    cv.px(*T.pt(33 + spread, 49), C["y"])
    for side in (-1, 1):
        for i in range(4):   # palps: alternating light/dark segments
            x, y = T.pt(31.5 + side * (8 + spread + i * 0.5), 36 + i * 2)
            cv.px(x, y, C["hi"] if i % 2 == 0 else C["d"])
            cv.px(x, y + 1, C["hi"] if i % 2 == 0 else C["d"])


def neck(cv, C, T, bot=58, half=4):
    """Segmented neck hanging from the chin (follows the head when it tilts)."""
    cx, top = T.pt(31.5, 38)
    cv.poly("neck", C["g"], [(cx - half, top), (cx + half, top), (31.5 + half + 2, bot), (31.5 - half - 2, bot)])
    for yy in range(top + 2, bot, 3):   # cervical rings
        cv.line([(cx - 8, yy), (cx + 8, yy)], C["d"], {"neck"})
        cv.line([(cx - 8, yy - 1), (cx - 1, yy - 1)], C["G"], {"neck"})


THORAX_L = [(31, 50), (22, 50), (12, 52), (4, 55), (0, 58), (0, 64)]


def thorax(cv, C, thorax_l=THORAX_L, col=None):
    cv.poly("thorax", col or C["g"], sym(thorax_l))


def thorax_shading(cv, C, dark=None):
    shade_right(cv, {"thorax"}, dark or C["d"], 36)
    rim(cv, {"thorax"}, C["G"])
    # midline keel and a pair of red chevron markings on the pronotum
    cv.line([(31, 54), (31, 63)], C["d"], {"thorax"})
    cv.line([(32, 54), (32, 63)], C["d"], {"thorax"})
    cv.line([(24, 58), (28, 61)], C["R"], {"thorax"})
    cv.line([(39, 58), (35, 61)], C["r"], {"thorax"})


# raptorial foreleg, praying pose seen from the front: folded in front of the chest under the
# head. The femur climbs from the bottom edge to the "elbow"; the spined tibia hangs back down on
# its inner (centre) side, ending in a hook beside the mandibles.
ARM = {
    # outer edge is sawtoothed so the femur spines show in the silhouette
    "femur": [(8, 64), (10, 57), (7, 56), (12, 50), (9, 48), (15, 43), (19, 40), (22, 42), (18, 53), (16, 64)],
    "tibia": [(18, 40), (22, 40), (25, 46), (25, 55), (23, 60), (21, 62), (21, 55), (19, 47)],
    # gold spines off the tibia's inner edge, (base, tip)
    "spines": [((25, 48), (27, 47)), ((25, 53), (27, 52))],
}


def flip(pts):
    return [(N - 1 - x, y) for x, y in pts]


def arms(cv, C, which=("L", "R"), arm=ARM):
    for side in which:
        f, t = arm["femur"], arm["tibia"]
        if side == "R":
            f, t = mirror(f), mirror(t)
        cv.poly("arm", C["G"], f)
        cv.poly("claw", C["T"], t)


def arm_shading(cv, C, which=("L", "R"), arm=ARM, spine=None):
    rim(cv, {"arm", "claw"}, C["hi"])
    rim(cv, {"arm"}, C["g"], side=1, depth=2)     # cel shadow down each limb's right side
    rim(cv, {"claw"}, C["t"], side=1, depth=2)
    for side in which:
        for a, b in arm["spines"]:
            if side == "R":
                a, b = flip([a, b])
            cv.line([a, b], spine or C["Y"])


def canvas():
    return Canvas(LAYERS)


def arm_at(dy):
    """ARM moved up/down (for a figure whose body sits higher in the frame)."""
    mv = lambda pts: [(x, y + dy) for x, y in pts]
    return {"femur": mv(ARM["femur"]), "tibia": mv(ARM["tibia"]),
            "spines": [tuple(mv(sp)) for sp in ARM["spines"]]}


def base(cv, C, T, spread=0, which=("L", "R"), thorax_l=THORAX_L, arm=ARM):
    """Everything every mantid has, before the outline pass."""
    thorax(cv, C, thorax_l)
    neck(cv, C, T)
    head(cv, C, T)
    mandibles(cv, C, T, spread)
    arms(cv, C, which, arm)


def finish(cv, C, T, spread=0, which=("L", "R"), pupil=(0, 0), glow=False, eyes=True, arm=ARM):
    """Shared post-outline shading; role-specific details go on top of this."""
    head_shading(cv, C, T)
    thorax_shading(cv, C)
    arm_shading(cv, C, which, arm)
    if eyes:
        for box in (EYE_L, EYE_R):
            compound_eye(cv, C, T, box, pupil=pupil, glow=glow)
    mouth_detail(cv, C, T, spread)


# ---------------------------------------------------------------- roles

def merchant():
    """Brood-trader: teal chitin, amber eyes, gem crest + bead strings, jeweled mandible rings,
    red shawl with gold hem, head tilted with a sideways glance."""
    C = pal(G=(70, 182, 150), g=(36, 118, 112), d=(22, 70, 74), hi=(150, 236, 200),
            T=(110, 200, 110), t=(58, 132, 80),
            e2=(255, 236, 140), e1=(226, 160, 40), e0=(130, 70, 20), ef=(176, 104, 26), eP=(60, 20, 10))
    cv = canvas()
    T = Pose(deg=-10, dx=-3)
    antenna(cv, T, T(curve((28, 7), (22, -4), (12, -14))), C["hi"], C["d"])
    antenna(cv, T, T(curve((35, 7), (48, -6), (54, 4))), C["hi"], C["d"])   # lazily curled
    base(cv, C, T, spread=1)
    # trader's shawl over the pronotum
    cv.poly("collar", C["r"], sym([(31, 54), (20, 54), (8, 58), (2, 64)]))
    # headdress: gold band across the vertex with a red gem crest
    cv.poly("crest", C["Y"], T([(22, 6), (31, 2), (41, 6), (40, 9), (31, 6), (23, 9)]))
    cv.poly("crest", C["R"], T(ell((28, -4, 35, 4), 12)))
    cv.outline()

    finish(cv, C, T, spread=1, pupil=(3, 0))
    shade_right(cv, {"collar"}, (76, 14, 28), 38)
    hem = [(2, 63), (8, 59), (20, 55), (31, 55)]
    cv.line(hem, C["Y"], {"collar"})
    cv.line(mirror(hem), C["y"], {"collar"})
    cv.line(T([(25, 6), (38, 6)]), C["y"], {"crest"})
    cv.px(*T.pt(30, -2), C["W"])
    # bead strings hanging from the band, between eye and cheek
    chain = curve((23, 8), (31.5, 20), (40, 8), 9)
    for i, (x, y) in enumerate(chain[1:-1]):
        cv.px(*T.pt(x, y), C["R"] if i % 2 else C["Y"])
    # gold bangles stacked on each tibia
    for y in (44, 47):
        cv.line([(19, y), (24, y + 1)], C["Y"], {"claw"})
        cv.line([(39, y + 1), (44, y)], C["y"], {"claw"})
    # jeweled mandible rings (gold band + red stone)
    for mx in (28, 34):
        x, y = T.pt(mx, 44)
        cv.stamp(x, y, ["YY", "yR"], C)
    return cv.image(shift=5)


def mechanic():
    """Worker drone: olive chitin, welding goggles over the eyes, tool-strap harness, right claw
    raised holding a lit welding torch."""
    C = pal(G=(134, 182, 72), g=(80, 126, 52), d=(44, 76, 40), hi=(210, 238, 124),
            T=(76, 164, 132), t=(42, 104, 94))
    metal, metal_d = (150, 150, 164), (88, 86, 104)
    cv = canvas()
    T = Pose()
    antenna(cv, T, curve((29, 6), (24, -4), (10, -8)), C["hi"], C["d"])
    antenna(cv, T, curve((34, 6), (38, -2), (46, -12)), C["hi"], C["d"])
    base(cv, C, T, which=("L",))
    # goggles: leather strap round the head, two big riveted lens cups over the compound eyes
    cv.poly("gear", (70, 52, 40), T([(5, 13), (31, 9), (58, 13), (58, 17), (31, 13), (5, 17)]))
    cv.poly("gear", metal_d, T(ell((9, 7, 24, 22))))
    cv.poly("gear", metal_d, T(ell((39, 7, 54, 22))))
    # tool belt pouches between the forelegs
    leather = (110, 72, 42)
    cv.poly("collar", leather, [(33, 56), (41, 56), (41, 63), (33, 63)])
    cv.poly("collar", leather, [(42, 57), (47, 57), (47, 63), (42, 63)])
    # right foreleg raised: femur up from the corner, tibia hooked over the torch handle
    # (handle on the "gear" layer so the claw grips it from in front)
    cv.poly("gear", metal, [(37, 49), (49, 31), (52, 33), (40, 51)])
    cv.poly("tool", C["Y"], [(47, 28), (52, 23), (56, 27), (51, 32)])          # nozzle head
    cv.poly("tool", metal_d, [(52, 23), (55, 20), (58, 23), (56, 27)])        # tip
    cv.poly("arm", C["G"], [(63, 64), (51, 64), (52, 52), (53, 44), (55, 36), (60, 34), (61, 42), (63, 46)])
    cv.poly("claw", C["T"], [(54, 34), (59, 34), (56, 41), (48, 47), (44, 47), (46, 43)])
    cv.fill("fx", (150, 236, 255), lambda d: d.polygon([(56, 20), (59, 13), (62, 16), (59, 21)], fill=1))
    cv.outline()
    halo(cv, "fx", [(40, 110, 200), (20, 50, 110)])

    finish(cv, C, T, which=("L",), eyes=False)
    # lens glass: amber, darker lower-right, one glint each
    for lx in (9, 39):
        cx, cy = T.pt(lx + 7.5, 14.5)
        cv.shade({"gear"}, (236, 156, 34), lambda d, cx=cx, cy=cy: d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=1))
        cv.shade({"gear"}, (160, 86, 22), lambda d, cx=cx, cy=cy: d.ellipse([cx - 2, cy - 2, cx + 6, cy + 6], fill=1),
                 where=lambda x, y, cx=cx, cy=cy: (x - cx) + (y - cy) > 2)
        cv.stamp(cx - 4, cy - 4, ["WW", "W."], C)
        cv.px(cx - 7, cy, metal); cv.px(cx + 7, cy, metal)   # rivets
    cv.line([(40, 50), (51, 34)], metal_d, {"gear"})
    cv.line([(49, 31), (52, 28)], C["y"], {"tool"})
    rim(cv, {"arm"}, C["g"], side=1, depth=2)
    rim(cv, {"arm", "claw"}, C["hi"])
    # harness: shoulder strap with buckle, belt across the chest, pouch flaps + a spanner
    strap = (96, 64, 40)
    cv.line([(0, 53), (31, 63)], strap, {"thorax", "neck"})
    cv.line([(0, 54), (30, 63)], strap, {"thorax", "neck"})
    cv.stamp(6, 54, ["YY", "yy"], C)
    cv.shade({"collar"}, (150, 100, 56), lambda d: d.rectangle([33, 56, 47, 58], fill=1))
    cv.px(37, 59, C["Y"]); cv.px(44, 59, C["Y"])
    cv.stamp(35, 52, [".m.m", ".mmm", "..m.", "..m."], {"m": metal})
    # torch flame: white-hot core inside the cyan cone
    cv.stamp(57, 15, [".a", "aa", "a."], {"a": (255, 255, 236)})
    return cv.image(shift=0)


def pilot():
    """Swarm-leader: blue-teal chitin, red eyes under angled brow plates, scarred and chipped,
    comm beads clipped to swept-back antennae, flight harness, mandibles flared."""
    C = pal(G=(56, 168, 160), g=(32, 108, 118), d=(20, 60, 76), hi=(140, 230, 220),
            T=(80, 190, 120), t=(44, 120, 84),
            e2=(255, 160, 140), e1=(210, 50, 56), e0=(100, 16, 30), ef=(150, 28, 40), eP=(30, 4, 10))
    cv = canvas()
    T = Pose(dy=1)
    # swept back hard, like a fighter's wings
    antenna(cv, T, T(curve((28, 7), (20, 0), (-2, -2))), C["hi"], C["d"])
    antenna(cv, T, T(curve((35, 7), (43, 0), (65, -2))), C["hi"], C["d"])
    base(cv, C, T, spread=3)
    # chipped chitin: bites out of the cheek, eye rim and a foreleg
    notch(cv, T([(45, 23), (49, 24), (46, 27)]))
    notch(cv, T([(16, 28), (19, 30), (16, 32)]))
    notch(cv, [(52, 5), (55, 3), (55, 7)])
    notch(cv, [(4, 47), (8, 49), (5, 51)])
    # comm pod clamped on the vertex, feeding wires up the antennae
    cv.poly("gear", (54, 50, 64), T([(27, 3), (36, 3), (37, 8), (26, 8)]))
    # flight collar
    cv.poly("collar", (54, 50, 64), sym([(31, 50), (24, 50), (21, 54), (31, 55)]))
    cv.outline()

    finish(cv, C, T, spread=3, pupil=(0, -1))
    # angry brow plates: dark chitin cutting the inner-top of each eye
    for pts in ([(14, 8), (25, 14), (26, 10), (18, 6)],):
        cv.poly("gear", C["d"], T(pts))
        cv.poly("gear", C["d"], T(mirror(pts)))
    # scar: a chipped gash across the right eye and cheek
    cv.line(T([(41, 6), (48, 22)]), (240, 230, 220), {"eye", "head"})
    cv.line(T([(42, 6), (49, 22)]), C["eP"], {"eye", "head"})
    cv.line(T([(19, 26), (23, 32)]), C["d"], {"head"})
    # comm beads on the antennae
    for x, y in ((12, 1), (50, 1)):
        cv.stamp(x, y, ["KKK", "KkK", "KKK"], {"K": (54, 50, 64), "k": (255, 90, 60)})
    px, py = T.pt(29, 5)
    cv.stamp(px, py, ["R.Y.g"], {"R": (255, 90, 60), "Y": C["Y"], "g": (120, 255, 160)})
    # flight harness
    cv.line([(8, 58), (24, 53)], (40, 36, 48), {"thorax"})
    cv.line([(55, 58), (39, 53)], (40, 36, 48), {"thorax"})
    cv.stamp(30, 52, ["YYYY", "yRRy"], C)
    return cv.image(shift=0)


def commander():
    """Hive Queen: deep emerald chitin, wide gold-tipped fan crown, glowing gold eyes with a halo,
    layered thorax plates with gold trim and a red gem."""
    C = pal(G=(60, 164, 92), g=(34, 106, 72), d=(20, 62, 52), hi=(156, 230, 136),
            T=(52, 170, 160), t=(28, 106, 112),
            e2=(255, 252, 214), e1=(255, 196, 56), e0=(206, 104, 20), ef=(230, 140, 30), eP=(150, 60, 10))
    cv = canvas()
    # smaller head than the others so the crest gets the headroom; the body is raised to match
    T = Pose(s=0.95, pivot=(31.5, 18))
    oy = -6
    arm = arm_at(oy)
    # crest: a tall central blade (like an Empusa's head cone) flanked by fanned spines
    crown = [(25, 7), (12, 2), (4, -4), (15, -1), (15, -9), (23, -1), (26, -11),
             (31.5, -15), (37, -11), (40, -1), (48, -9), (48, -1), (59, -4), (51, 2), (38, 7)]
    cv.poly("crest", (232, 170, 50), T(crown))
    base(cv, C, T, thorax_l=[(31, 42), (18, 42), (6, 44), (0, 47), (0, 64)], arm=arm)
    # ornate pauldron plates layered over the pronotum
    for dy in (oy, oy + 5):
        cv.poly("collar", C["T"], sym([(31, 51 + dy), (20, 51 + dy), (6, 54 + dy), (0, 58 + dy), (0, 61 + dy),
                                       (8, 58 + dy), (20, 55 + dy), (31, 55 + dy)]))
    cv.outline()
    halo(cv, "eye", [(120, 66, 10), (60, 30, 6)])

    finish(cv, C, T, glow=True, arm=arm)
    shade_right(cv, {"collar"}, C["t"], 34)
    shade_right(cv, {"crest"}, (170, 96, 24), 33)
    rim(cv, {"collar"}, (150, 236, 220))
    rim(cv, {"crest"}, (255, 240, 160))        # gold crown, bright rim on the lit side
    # gold rim along the crown's inner band, gold spine tips with a red jewel in the centre
    cv.line(T([(24, 6), (31.5, 3), (39, 6)]), C["r"], {"crest"})   # red inner band
    for x, y in ((4, -4), (15, -9), (26, -11), (37, -11), (48, -9), (59, -4)):
        cv.px(*T.pt(x, y), C["Y"])
    cv.line(T([(31.5, -13), (31.5, -6)]), (255, 236, 140), {"crest"})     # gold spine up the blade
    cv.stamp(*T.pt(30.5, -4), [".Y.", "YRY", ".r."], C)
    # plate trims + gem brooch
    for dy in (oy, oy + 5):
        trim = [(0, 61 + dy), (8, 57 + dy), (20, 54 + dy), (31, 54 + dy)]
        cv.line(trim, C["Y"], {"collar"})
        cv.line(mirror(trim), C["y"], {"collar"})
    cv.stamp(30, 50 + oy, [".YY.", "YRRy", "yRry", ".yy."], C)
    return cv.image(shift=12)


PORTRAITS = {"merchant": merchant, "mechanic": mechanic, "pilot": pilot, "commander": commander}

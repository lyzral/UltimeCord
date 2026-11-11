"""Turns the old pixel logo's "E" into a "U" (Ultime Cord), keeping the panda, the C and the speed lines.
usage: python pixel_logo.py <old app_logo.png> <out.png>"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
orig = Image.open(src).convert("RGBA")
im = orig.copy()
o, px = orig.load(), im.load()

LINE = (2, 6, 18, 255)
FILL = (130, 195, 251, 255)
LIGHT = (163, 220, 252, 255)
SHADE = (100, 160, 236, 255)
CLEAR = (0, 0, 0, 0)

X0, X1, Y0, Y1 = 160, 232, 186, 334  # the E's area, stopping where the C starts


def is_panda(x, y):
    r, g, b, a = o[x, y]
    if a < 60 or y > 214:
        return False
    return (b - r) < 55  # white, grey and black pixels; the letters are clearly blue


panda = {(x, y) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1) if is_panda(x, y)}
# the E's own top outline is dark too: only keep dark pixels that sit inside the panda's silhouette
panda = {(x, y) for (x, y) in panda if y < 194 or x >= 172}

for y in range(Y0, Y1 + 1):
    for x in range(X0, X1 + 1):
        px[x, y] = CLEAR


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if X0 <= x <= X1:
                px[x, y] = c


TOP, BOT = 194, 330
LO, LI = 164, 184          # left bar: outer / inner edge
RI, RO = 218, 240          # right bar: inner edge / outer edge (hidden by the C past 232)
OPEN_BOT = 286

# outline of the whole U
rect(LO, TOP, LI + 3, BOT, LINE)
rect(RI - 3, TOP, RO, BOT, LINE)
rect(LO, OPEN_BOT, RO, BOT, LINE)
# fills
rect(LO + 4, TOP + 4, LI - 1, BOT - 4, FILL)
rect(RI + 1, TOP + 4, RO, BOT - 4, FILL)
rect(LO + 4, OPEN_BOT + 4, RO, BOT - 4, FILL)
# highlights (top and left) and shade (bottom), like the original letters
rect(LO + 4, TOP + 4, LI - 1, TOP + 7, LIGHT)
rect(LO + 4, TOP + 4, LO + 7, BOT - 8, LIGHT)
rect(RI + 1, TOP + 4, RO, TOP + 7, LIGHT)
rect(LO + 8, BOT - 7, RO, BOT - 4, SHADE)
rect(LI - 3, TOP + 8, LI - 1, OPEN_BOT, SHADE)
# rounded outer corners (one pixel-block step)
rect(LO, BOT - 3, LO + 3, BOT, CLEAR)
rect(LO, TOP, LO + 3, TOP + 3, CLEAR)
# the opening: inner outline and rounded bottom
rect(LI, TOP, LI + 3, OPEN_BOT, LINE)
rect(RI - 3, TOP, RI, OPEN_BOT, LINE)
rect(LI + 4, TOP, RI - 4, OPEN_BOT - 1, CLEAR)
rect(LI + 4, OPEN_BOT - 4, LI + 7, OPEN_BOT - 1, LINE)
rect(RI - 7, OPEN_BOT - 4, RI - 4, OPEN_BOT - 1, LINE)
rect(LI + 4, OPEN_BOT, RI - 4, OPEN_BOT + 3, LINE)
rect(LI + 4, OPEN_BOT + 4, RI - 4, OPEN_BOT + 7, FILL)

# panda back on top
for (x, y) in panda:
    px[x, y] = o[x, y]

im.save(out)

"""Draws the Ultime Cord logo (icon, mark, banner) from vectors. Run from the UltimeCord folder, then export.py."""
import os
import subprocess
import sys
import tempfile

B = os.path.dirname(os.path.abspath(__file__))

# A "U" holding a four-point spark: the cup is the client, the spark what it adds
U = "M318 300V560a194 194 0 0 0 388 0V300"
SPARK = "M512 212C524 300 552 328 640 340C552 352 524 380 512 468C500 380 472 352 384 340C472 328 500 300 512 212Z"

DEFS = """<defs>
<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1a8f"/><stop offset=".55" stop-color="#1d0d4a"/><stop offset="1" stop-color="#0d0620"/></linearGradient>
<radialGradient id="halo" cx="50%" cy="34%" r="52%"><stop offset="0" stop-color="#a472ff" stop-opacity=".55"/><stop offset="1" stop-color="#a472ff" stop-opacity="0"/></radialGradient>
<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9a0ff"/></linearGradient>
<linearGradient id="spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9ff"/><stop offset="1" stop-color="#c79bff"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>"""

MARK = f"""<path d="{U}" fill="none" stroke="url(#u)" stroke-width="124" stroke-linecap="round"/>
<path d="{SPARK}" fill="url(#spark)" filter="url(#glow)"/>"""

ICON = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{DEFS}
<rect width="1024" height="1024" rx="228" fill="url(#tile)"/>
<rect width="1024" height="1024" rx="228" fill="url(#halo)"/>
<rect x="5" y="5" width="1014" height="1014" rx="223" fill="none" stroke="#c9b4ff" stroke-opacity=".22" stroke-width="10"/>
<g transform="translate(0 28)">{MARK}</g>
</svg>"""

MARK_ONLY = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="150 130 724 724">{DEFS}{MARK}</svg>"""

BANNER = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="520" viewBox="0 0 1600 520">{DEFS}
<defs>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#a78bfa" stroke-opacity=".08"/></pattern>
<radialGradient id="bh" cx="30%" cy="50%" r="60%"><stop offset="0" stop-color="#7c4dff" stop-opacity=".42"/><stop offset="1" stop-color="#7c4dff" stop-opacity="0"/></radialGradient>
<linearGradient id="word" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c4a9ff"/></linearGradient>
</defs>
<rect width="1600" height="520" fill="#0b0716"/>
<rect width="1600" height="520" fill="url(#grid)"/>
<rect width="1600" height="520" fill="url(#bh)"/>
<g transform="translate(250 110) scale(.293)">
<rect width="1024" height="1024" rx="228" fill="url(#tile)"/><rect width="1024" height="1024" rx="228" fill="url(#halo)"/>
<rect x="5" y="5" width="1014" height="1014" rx="223" fill="none" stroke="#c9b4ff" stroke-opacity=".3" stroke-width="10"/>
<g transform="translate(0 28)">{MARK}</g></g>
<text x="610" y="278" font-family="'Segoe UI', Arial, sans-serif" font-size="128" font-weight="700" letter-spacing="-4" fill="url(#word)">Ultime Cord</text>
<text x="616" y="346" font-family="'Segoe UI', Arial, sans-serif" font-size="36" fill="#a99bd0">Discord, made your own.</text>
</svg>"""


def render(svg, out, w, h):
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "p.svg")
        open(src, "w", encoding="utf-8").write(svg)
        env = dict(os.environ, NODE_PATH=os.path.join(B, "..", "desktop", "node_modules"))
        subprocess.run(["node", os.path.join(B, "shot.cjs"), src, out, str(w), str(h)], check=True, env=env, stdout=subprocess.DEVNULL)


out = sys.argv[1] if len(sys.argv) > 1 else B
render(ICON, os.path.join(out, "icon-1024.png"), 1024, 1024)
render(MARK_ONLY, os.path.join(out, "mark-1024.png"), 1024, 1024)
render(BANNER, os.path.join(out, "banner.png"), 1600, 520)
for name, svg in (("logo.svg", ICON), ("mark.svg", MARK_ONLY)):
    open(os.path.join(out, name), "w", encoding="utf-8", newline="\n").write(svg + "\n")
print("ok")

"""Draws the pictures the README shows (banner, feature cards, buttons) into branding/readme/. Run from anywhere."""
import os

B = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(B, "readme")
os.makedirs(OUT, exist_ok=True)

PLUGINS = "750+"
SANS = "'Segoe UI', -apple-system, Helvetica, Arial, sans-serif"
BLACK = "'Segoe UI Black', 'Segoe UI', -apple-system, Helvetica, Arial, sans-serif"

LOGO_DEFS = """<linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1a8f"/><stop offset=".55" stop-color="#1d0d4a"/><stop offset="1" stop-color="#0d0620"/></linearGradient>
<radialGradient id="halo" cx="50%" cy="34%" r="52%"><stop offset="0" stop-color="#a472ff" stop-opacity=".55"/><stop offset="1" stop-color="#a472ff" stop-opacity="0"/></radialGradient>
<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#b9a0ff"/></linearGradient>"""
LOGO = """<rect width="1024" height="1024" rx="228" fill="url(#tile)"/><rect width="1024" height="1024" rx="228" fill="url(#halo)"/>
<rect x="5" y="5" width="1014" height="1014" rx="223" fill="none" stroke="#c9b4ff" stroke-opacity=".3" stroke-width="10"/>
<g transform="translate(0 28)"><path d="M318 300V560a194 194 0 0 0 388 0V300" fill="none" stroke="url(#u)" stroke-width="124" stroke-linecap="round"/>
<path d="M512 212C524 300 552 328 640 340C552 352 524 380 512 468C500 380 472 352 384 340C472 328 500 300 512 212Z" fill="#f5eeff"/></g>"""


def write(name, svg):
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
        f.write(svg)


# ---------- banner: the logo and name, next to a slice of the plugin list ----------
rows = [("FakeNitro", "Emojis, stickers and stream quality", True), ("Custom Widget", "Your own profile widget", True),
        ("MessageLogger", "Keeps deleted and edited messages", True), ("VRMod", "Show up as on a VR headset", False)]
panel = ""
for i, (name, desc, on) in enumerate(rows):
    y = 112 + i * 54
    knob = f'<rect x="1132" y="{y - 13}" width="42" height="24" rx="12" fill="{"#7c4dff" if on else "#2b2440"}"/><circle cx="{1162 if on else 1144}" cy="{y - 1}" r="9" fill="#fff"/>'
    panel += f'''<text x="800" y="{y - 4}" font-family="{SANS}" font-size="17" font-weight="600" fill="#f1ebff">{name}</text>
<text x="800" y="{y + 16}" font-family="{SANS}" font-size="12.5" fill="#8f84b3">{desc}</text>{knob}
{'' if i == len(rows) - 1 else f'<path d="M800 {y + 30}h374" stroke="#a78bfa" stroke-opacity=".12"/>'}
'''

write("banner.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="0 0 1280 360">
<defs>{LOGO_DEFS}
<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#a78bfa" stroke-opacity=".09"/></pattern>
<radialGradient id="fade" cx="28%" cy="45%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="m"><rect width="1280" height="360" fill="url(#fade)"/></mask>
<radialGradient id="glow" cx="16%" cy="50%" r="55%"><stop offset="0" stop-color="#7c4dff" stop-opacity=".42"/><stop offset="1" stop-color="#7c4dff" stop-opacity="0"/></radialGradient>
<radialGradient id="glow2" cx="90%" cy="8%" r="45%"><stop offset="0" stop-color="#e879f9" stop-opacity=".14"/><stop offset="1" stop-color="#e879f9" stop-opacity="0"/></radialGradient>
<linearGradient id="word" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c4a9ff"/></linearGradient>
<clipPath id="r"><rect width="1280" height="360" rx="22"/></clipPath>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#05030a" flood-opacity=".6"/></filter>
</defs>
<g clip-path="url(#r)"><rect width="1280" height="360" fill="#0b0814"/><rect width="1280" height="360" fill="url(#grid)" mask="url(#m)"/>
<rect width="1280" height="360" fill="url(#glow)"/><rect width="1280" height="360" fill="url(#glow2)"/></g>
<rect x=".5" y=".5" width="1279" height="359" rx="21.5" fill="none" stroke="#a78bfa" stroke-opacity=".2"/>

<g transform="translate(80 112) scale(.1328)" filter="url(#shadow)">{LOGO}</g>
<text x="242" y="178" font-family="{SANS}" font-size="74" font-weight="700" fill="url(#word)" letter-spacing="-2.5">Ultime Cord</text>
<text x="245" y="220" font-family="{SANS}" font-size="22" fill="#b3a6d4">Discord, made your own.</text>
<text x="245" y="262" font-family="{SANS}" font-size="14" font-weight="700" fill="#8f7fd0" letter-spacing="3">{PLUGINS} PLUGINS · THEMES · WINDOWS · LINUX · ANDROID</text>

<g filter="url(#shadow)"><rect x="772" y="48" width="430" height="264" rx="16" fill="#13101f" stroke="#a78bfa" stroke-opacity=".22"/></g>
<text x="800" y="80" font-family="{SANS}" font-size="12" font-weight="700" fill="#8f7fd0" letter-spacing="2.5">PLUGINS</text>
{panel}</svg>
''')


# ---------- feature cards ----------
ICONS = {
    "plug": '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    "brush": '<path d="M4 20c3 0 5-1.500 5-4a3 3 0 0 0-3-3c-2 0-3 2-3 5 0 1 .400 2 1 2zM9.500 13.500 19 4a2.100 2.100 0 0 1 3 3l-9.500 9.500"/>',
    "widget": '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="14" width="8" height="7" rx="2"/>',
    "music": '<path d="M9 18V5l11-2v13"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="17.500" cy="16" r="2.500"/>',
    "quest": '<path d="M12 3l2.600 5.600 6.100.700-4.500 4.200 1.200 6-5.400-3-5.400 3 1.200-6L3.300 9.300l6.100-.700z"/>',
    "key": '<circle cx="8" cy="15" r="4.500"/><path d="M11.500 11.500 20 3M16 7l3 3M13.500 9.500l2.500 2.500"/>',
}


def card(name, icon, color, title, l1, l2):
    write(name, f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="148" viewBox="0 0 400 148">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#191428"/><stop offset="1" stop-color="#110e1b"/></linearGradient>
<radialGradient id="cg" cx="0%" cy="0%" r="80%"><stop offset="0" stop-color="{color}" stop-opacity=".2"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient></defs>
<rect x=".5" y=".5" width="399" height="147" rx="15.500" fill="url(#bg)" stroke="{color}" stroke-opacity=".3"/>
<rect x=".5" y=".5" width="399" height="147" rx="15.500" fill="url(#cg)"/>
<rect x="24" y="24" width="42" height="42" rx="11" fill="{color}" fill-opacity=".16" stroke="{color}" stroke-opacity=".45"/>
<g transform="translate(33 33)" fill="none" stroke="{color}" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round">{ICONS[icon]}</g>
<text x="80" y="52" font-family="{SANS}" font-size="19" font-weight="700" fill="#fff">{title}</text>
<text x="24" y="98" font-family="{SANS}" font-size="14" fill="#c9bfe4">{l1}</text>
<text x="24" y="119" font-family="{SANS}" font-size="14" fill="#c9bfe4">{l2}</text>
</svg>
''')


card("f-plugins.svg", "plug", "#a78bfa", f"{PLUGINS} plugins", "Chat, voice, privacy, appearance: search,", "filter by tag and toggle in one click.")
card("f-themes.svg", "brush", "#f0abfc", "Theme studio", "Build a theme live, or add Glass Fluid:", "glass panels over any theme.")
card("f-widget.svg", "widget", "#5eead4", "Custom Widget", "A studio for your own profile widget,", "through Discord's official widget API.")
card("f-music.svg", "music", "#f9a8d4", "Music player", "What plays on your PC, one button away", "in Discord's top bar.")
card("f-quest.svg", "quest", "#fde047", "AutoQuest &amp; VRMod", "Finish your quests in the background,", "show up as on a VR headset.")
card("f-key.svg", "key", "#93c5fd", "One key per PC", "Every licence is signed, tied to a PC", "and can be revoked.")


# ---------- buttons ----------
def button(name, label, sub, primary=False):
    w = max(round(len(label) * 8.6), round(len(sub) * 6.2)) + 44
    fill = 'fill="url(#p)"' if primary else 'fill="#15111f"'
    write(name, f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="54" viewBox="0 0 {w} 54">
<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>
<rect x=".5" y=".5" width="{w - 1}" height="53" rx="13" {fill} stroke="#a78bfa" stroke-opacity="{".7" if primary else ".35"}"/>
<text x="{w / 2}" y="24" text-anchor="middle" font-family="{SANS}" font-size="15.500" font-weight="700" fill="#fff">{label}</text>
<text x="{w / 2}" y="41" text-anchor="middle" font-family="{SANS}" font-size="11.500" fill="{"#e4d9ff" if primary else "#8f84b3"}">{sub}</text>
</svg>
''')


button("dl-windows.svg", "Download for Windows", "ultimecord.exe", primary=True)
button("dl-linux.svg", "Linux / macOS", "install.sh")
button("dl-android.svg", "Android", "APK, test build")
button("discord.svg", "Discord", "discord.gg/khad")
print("ok")

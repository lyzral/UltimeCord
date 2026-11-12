"""Records the voice-over, one file per line, and writes their timings to voice.json. Needs `pip install edge-tts`."""
import asyncio
import json
import os
import subprocess
import sys

import edge_tts

OUT = sys.argv[1]
VOICE = "en-US-AriaNeural"

LINES = [
    ("mods", "Too many Discord mods? One for plugins. One for themes. One for privacy."),
    ("one", "Or just one. Meet Ultime Cord."),
    ("plug", "It plugs straight into the official Discord app. Stable, P T B or Canary. Nothing new to learn."),
    ("plugins", "Open your settings, and every plugin is right there. Search, filter by tag, and switch it on in one click."),
    ("themes", "Make Discord look the way you want, with the theme studio and glass panels."),
    ("music", "See what's playing on your PC, without leaving the chat."),
    ("count", "Over seven hundred and fifty plugins from Vencord, Equicord, Nightcord and more. All in one place."),
    ("outro", "Ultime Cord. Discord, made your own."),
]


async def main():
    os.makedirs(OUT, exist_ok=True)
    for key, text in LINES:
        await edge_tts.Communicate(text, VOICE, rate="-4%").save(os.path.join(OUT, f"{key}.mp3"))


asyncio.run(main())

timings = {}
for key, _ in LINES:
    d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(OUT, f"{key}.mp3")],
                       capture_output=True, text=True).stdout.strip()
    timings[key] = round(float(d), 2)
json.dump(timings, open(os.path.join(OUT, "voice.json"), "w"), indent=1)
print(timings)

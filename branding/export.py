"""Exports the Ultime Cord logo into every icon/logo file of the project. Run from the UltimeCord folder."""
import glob, os
from PIL import Image, ImageDraw, ImageOps

B = "branding"
ICON = Image.open(f"{B}/icon-1024.png").convert("RGBA")
MARK = Image.open(f"{B}/mark-1024.png").convert("RGBA")
BANNER = Image.open(f"{B}/banner.png").convert("RGBA")


def fit(src, size, pad=0.0):
    """Scale src to fit inside size (keeping ratio), centred on a transparent canvas."""
    w, h = size
    iw, ih = int(w * (1 - pad)), int(h * (1 - pad))
    s = min(iw / src.width, ih / src.height)
    im = src.resize((max(1, round(src.width * s)), max(1, round(src.height * s))), Image.LANCZOS)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(im, ((w - im.width) // 2, (h - im.height) // 2), im)
    return out


def round_icon(size):
    im = ICON.resize((size, size), Image.LANCZOS)
    # full-bleed: fill the transparent corners first so the circle is clean
    bg = Image.new("RGBA", (1024, 1024), (17, 11, 43, 255))
    bg.alpha_composite(ICON)
    im = bg.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


def monochrome(size):
    a = MARK.getchannel("A")
    white = Image.new("RGBA", MARK.size, (255, 255, 255, 255))
    white.putalpha(a)
    return fit(white, (size, size), pad=0.30)


done = []


def save(path, im):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg"):
        bg = Image.new("RGB", im.size, (11, 9, 32)); bg.paste(im, mask=im); bg.save(path, quality=95)
    else:
        im.save(path, optimize=True)
    done.append(path)


def replace_icon(path, pad=0.0):
    if os.path.exists(path):
        save(path, fit(ICON, Image.open(path).size, pad))


def replace_banner(path):
    if os.path.exists(path):
        save(path, fit(BANNER, Image.open(path).size))


# Windows icon
ICON.save("desktop/assets/app_icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
done.append("desktop/assets/app_icon.ico")
save("desktop/assets/app_logo.png", ICON.resize((500, 500), Image.LANCZOS))
replace_icon("desktop/browser/icon.png")

# hub
for p in ["hub/favicon.png", "hub/ultimecord-favicon.png", "hub/assets/favicon.png", "hub/assets/ultimecord-favicon.png",
          "hub/ios/assets/favicon.png", "hub/ios/assets/ultimecord-favicon.png", "hub/ios/native-ios/UltimeCordAssets/favicon.png",
          "hub/android/app/src/main/res/drawable/ic_launcher.png", "hub/android/app/src/main/ic_launcher-playstore.png",
          "hub/android/assets/ultimecord-icon.png", "hub/desktop/client/browser/icon.png",
          "hub/desktop/client/installer/winres/icon.png", "hub/ios/runtime/src/assets/icons/ultimecord.png",
          "hub/ios/runtime/src/assets/icons/ultimecord-source.png"]:
    replace_icon(p)
for p in ["hub/assets/ultimecord-logo.png", "hub/assets/logo-full.png", "hub/ios/assets/ultimecord-logo.png",
          "hub/ios/assets/logo-full.png", "hub/ios/native-ios/UltimeCordAssets/logo-full.png", "hub/android/assets/ultimecord-logo.png",
          "hub/android/app/src/main/res/drawable/ultimecord_logo.png", "hub/ios/runtime/src/assets/icons/ultimecord-full.png"]:
    replace_banner(p)

# mobile (Android installer launcher icons)
res = "mobile/android/installer/app/src/main/res"
for p in glob.glob(f"{res}/mipmap-*/ic_launcher.png"):
    save(p, ICON.resize(Image.open(p).size, Image.LANCZOS))
for p in glob.glob(f"{res}/mipmap-*/ic_launcher_round.png"):
    save(p, round_icon(Image.open(p).size[0]))
for p in glob.glob(f"{res}/drawable-*/ic_launcher_foreground.png"):
    save(p, fit(MARK, Image.open(p).size, pad=0.30))
for p in glob.glob(f"{res}/drawable-*/ic_launcher_monochrome.png"):
    save(p, monochrome(Image.open(p).size[0]))
replace_banner("mobile/docs/images/banner.png")

# vector logos used by the mobile apps
mark_svg = None
for p in []:
    open(p, "w", encoding="utf-8").write(mark_svg); done.append(p)

# extra sizes kept in branding/
for s in (16, 32, 48, 64, 128, 256, 512):
    ICON.resize((s, s), Image.LANCZOS).save(f"{B}/icon-{s}.png", optimize=True)
ICON.save(f"{B}/ultimecord.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print(len(done), "files updated")
for d in done:
    print(" ", d)

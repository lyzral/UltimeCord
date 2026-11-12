<img src="branding/readme/banner.svg" width="100%" alt="Ultime Cord — Discord, made your own." />

<p align="center">
  <br />
  <strong>Un seul client pour Discord.</strong><br />
  <sub>Ultime Cord se branche sur l'appli officielle (Stable, PTB ou Canary), ajoute ses plugins et son interface, et se retire quand tu veux avec son installeur.</sub>
</p>

<p align="center">
  <a href="https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord.exe"><img src="branding/readme/dl-windows.svg" height="50" alt="Télécharger pour Windows : ultimecord.exe" /></a>
  <a href="https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord-linux.tar.gz"><img src="branding/readme/dl-linux.svg" height="50" alt="Linux et macOS : install.sh" /></a>
  <a href="https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord-android.apk"><img src="branding/readme/dl-android.svg" height="50" alt="Android : APK de test" /></a>
  <a href="https://discord.gg/khad"><img src="branding/readme/discord.svg" height="50" alt="Discord : discord.gg/khad" /></a>
</p>

<p align="center">
  <img src="branding/readme/promo.gif" width="100%" alt="Trop de mods ? Ou un seul : les plugins de Vencord, Equicord et Nightcord, les thèmes et les widgets réunis dans Ultime Cord." />
</p>

## Ce qu'il y a dedans

<p align="center">
  <img src="branding/readme/f-plugins.svg" width="32.5%" alt="Plus de 750 plugins : discussion, vocal, confidentialité, apparence. Recherche, filtre par tag, activation en un clic." />
  <img src="branding/readme/f-themes.svg" width="32.5%" alt="Studio de thèmes : crée un thème en direct, ou ajoute Glass Fluid, des panneaux en verre par-dessus n'importe quel thème." />
  <img src="branding/readme/f-widget.svg" width="32.5%" alt="Custom Widget : un studio pour ton propre widget de profil, par l'API officielle de Discord." />
</p>
<p align="center">
  <img src="branding/readme/f-music.svg" width="32.5%" alt="Lecteur musique : ce qui joue sur ton PC, à un bouton dans la barre du haut de Discord." />
  <img src="branding/readme/f-quest.svg" width="32.5%" alt="AutoQuest et VRMod : termine tes quêtes en arrière-plan, apparais comme connecté depuis un casque VR." />
  <img src="branding/readme/f-key.svg" width="32.5%" alt="Une clé par PC : chaque licence est signée, liée à un PC et révocable." />
</p>

## Installer

**Windows**

1. Télécharge [`ultimecord.exe`](https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord.exe) et lance-le : il affiche ton **code PC**.
2. Envoie ce code sur le [Discord](https://discord.gg/khad) pour recevoir ta clé.
3. Colle la clé, choisis tes Discord, installe.

**Linux et macOS** — décompresse [`ultimecord-linux.tar.gz`](https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord-linux.tar.gz), puis :

```sh
sh install.sh --install
```

Le script affiche ton code PC et demande la clé. Il lui faut `python3` et `openssl`.

**Android** — installe l'[APK](https://github.com/lyzral/UltimeCord/releases/latest/download/ultimecord-android.apk). C'est une version de test : le module mobile n'est pas encore publié, l'appli s'installe mais n'a pas encore de module à télécharger.

**iOS** — l'IPA se compile sur un Mac avec Xcode (`mobile/ios`).

## Le dépôt

| Dossier | Contenu |
| --- | --- |
| `desktop/` | Le client PC et navigateur : plugins, thèmes, éditeur CSS et l'installeur `ultimecord.exe`. |
| `mobile/` | Ultime Cord pour Android (installeur et module) et iOS (tweak). |
| `hub/` | Bundles prêts à l'emploi et plugins officiels pour desktop, Android et iOS. |
| `branding/` | Le logo, la vidéo de présentation et les images de cette page, avec les scripts qui les dessinent. |

## Compiler

```sh
# PC (Node 22+ et pnpm)
cd desktop
pnpm install
pnpm build --disable-updater
powershell -ExecutionPolicy Bypass -File scripts/buildInstaller.ps1 -NoSite   # -> ultimecord.exe

# Mobile (bundle)
cd mobile/bundle
bun install
node scripts/build.mjs

# Android (JDK 17 + SDK Android 34)
cd mobile/android/installer
./gradlew assembleDebug
```

## Licence

Ultime Cord est un logiciel libre sous **GPL-3.0-or-later**. Il est construit sur des projets open source, dont Vencord, Equicord et Nightcord : leurs licences et mentions de copyright sont conservées dans les fichiers `LICENSE` et en tête des fichiers source.

<p align="center"><sub>Fait par <a href="https://github.com/lyzral">Sei</a>.</sub></p>

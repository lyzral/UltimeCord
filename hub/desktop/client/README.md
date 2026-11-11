# [<img src="./browser/icon.png" width="40" align="left" alt="Ultime Cord">](https://github.com/lyzral/UltimeCord) Ultime Cord

Ultime Cord is a fork of [Vencord](https://github.com/Vendicated/Vencord), with over 300+ plugins.


### Included Plugins

Our included plugins can be found [here](https://sincord.org/plugins).

## Installing / Uninstalling

Windows

- [-](https://github.com/lyzral/UltimeCord/releases/download/v1.14.13.1/CloudCord Setup-windows-amd64.exe)

MacOS

- [-](https://github.com/lyzral/UltimeCord/releases/download/v1.14.13.1/CloudCordSetup-darwin-arm64)

Linux

- [-](https://github.com/lyzral/UltimeCord/releases/download/v1.14.13.1/CloudCordSetup-linux-amd64)


```shell
sh -c "$(curl -sS https://raw.githubusercontent.com/xohus/cloudcord/refs/heads/main/misc/install.sh)"
```

## Installing Ultime Cord Devbuild

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/UltimeCord instance and you **will** most likely have to reinstall.

Clone Ultime Cord:

```shell
git clone https://github.com/lyzral/UltimeCord
cd Ultime Cord
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Ultime Cord:

```shell
pnpm build
```

Inject Ultime Cord into your desktop client:

```shell
pnpm inject
```

Build Ultime Cord for web:

```shell
pnpm buildWeb
```

After building Ultime Cord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Credits

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord) & [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping when needed.

## Star History

<a href="https://star-history.com/#lyzral/UltimeCord&Timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lyzral/UltimeCord&type=Timeline&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lyzral/UltimeCord&type=Timeline" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lyzral/UltimeCord&type=Timeline" />
  </picture>
</a>

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Vencord is not connected to Ultime Cord and as such, all donation links go to Vendicated's donation link.

<details>
<summary>Using Ultime Cord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Ultime Cord), just to be safe.

Additionally, make sure not to post screenshots with Ultime Cord in a server where you might get banned for it.

</details>

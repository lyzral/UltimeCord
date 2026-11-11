# Ultime Cord Desktop

Ultime Cord Desktop is an open-source Discord desktop client mod. It targets an installed Discord desktop `.exe` and injects the Ultime Cord desktop bundle into Discord using an in-repo installer.

Ultime Cord Desktop is based on Sincord/Vencord-style architecture. Sincord is the primary source base for this tree, including the in-repo Go installer and `dist/desktop` runtime output. Vencord is a major architectural reference for runtime patches, plugins, settings, and themes.

Ultime Cord Desktop is separate from Ultime Cord iOS and Android. iOS and Android use the React Native/mobile runtime. Desktop uses the desktop client mod runtime built from `desktop/client`.

## Build

From the repository root:

```sh
cd desktop/client
pnpm install
pnpm typecheck
pnpm build
pnpm build:installer
```

On Windows, the installer build outputs:

```text
desktop/client/dist/UltimeCordSetup.exe
```

The desktop runtime bundle is generated in:

```text
desktop/client/dist/desktop
```

## Workflow

Run the `Ultime Cord Desktop` GitHub Actions workflow manually, or push changes under `desktop/**` or `.github/workflows/desktop.yml`. The workflow builds the desktop runtime and Windows installer, then uploads `UltimeCordDesktop-Windows`.

## Install

Build or download `UltimeCordSetup.exe`, close Discord fully from the system tray, run the installer, select the Discord installation, and choose `Install Ultime Cord`.

## Uninstall

Run `UltimeCordSetup.exe`, select the patched Discord installation, and choose `Uninstall Ultime Cord`.

## Repair

Run `UltimeCordSetup.exe`, select the Discord installation, and choose `Repair Ultime Cord`. Repair rebuilds the Ultime Cord desktop bundle path and reapplies the Discord desktop patcher flow.

## Logs

Use `Open Logs` in Ultime Cord Setup. Installer logs are written by the Go installer and are the first place to inspect failed inject, uninject, or repair operations.

## Test

```sh
cd desktop/client
pnpm typecheck
pnpm build
pnpm build:installer
```

## Known Risks

Discord desktop updates can replace `app.asar` and require repair. Discord client mods may violate Discord terms of service. Plugin patches depend on Discord internals and can break after Discord updates. Antivirus or Windows SmartScreen can flag unsigned community installers. Always close Discord before installing, uninstalling, or repairing.

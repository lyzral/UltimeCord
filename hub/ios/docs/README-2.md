# Ultime Cord iOS Source

Ultime Cord is a modded Discord iOS source starter using a RainTweak-style native loader and a UltimeCord-style JavaScript runtime.

This is source code, not a compiled IPA or deb.

## Contents

- `native-ios/` native iOS Theos loader based on RainTweak
- `runtime/` JavaScript runtime based on Ultime Cord
- `assets/` Ultime Cord logo and favicon
- `ultimecord-official-plugins/` starter plugin source with FakeProfile
- `credits/` credits and attribution

## Build idea

1. Build the runtime bundle from `runtime/`
2. Host the bundle as `UltimeCord.js` or set it as a custom bundle URL
3. Build the native tweak from `native-ios/`
4. Install with your normal Theos/sideloading workflow

## Plugin source

The included official plugin source is:

`ultimecord-official-plugins/`

It includes FakeProfile as a local-only starter plugin.

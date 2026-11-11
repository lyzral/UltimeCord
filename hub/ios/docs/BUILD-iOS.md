# Ultime Cord iOS Build Notes

## Native loader

Go to:

`native-ios/`

Install Theos, then build normally:

`make package`

## Runtime

Go to:

`runtime/`

Install dependencies and build:

`bun install`
`bun run build`

The runtime output should be hosted or loaded through the Ultime Cord custom bundle URL.

## Local dev URL

Default custom bundle URL:

`http://localhost:4040/ultimecord.js`

## Assets

Ultime Cord assets are in:

`assets/logo-full.png`
`assets/favicon.png`
`native-ios/UltimeCordAssets/`
`runtime/src/assets/icons/`

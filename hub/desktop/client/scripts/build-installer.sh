#!/bin/bash
# Builds the UltimeCord Setup installer binary for the current platform
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_DIR="$SCRIPT_DIR/../installer"

if ! command -v go &> /dev/null; then
    echo "ERROR: Go is not installed."
    echo "Install it with: brew install go  (Mac)"
    echo "                 winget install GoLang.Go  (Windows)"
    exit 1
fi

cd "$INSTALLER_DIR"

case "$(uname -s)" in
    Darwin)
        ARCH=$(uname -m)
        if [ "$ARCH" = "arm64" ]; then
            OUT="UltimeCordSetup-darwin-arm64"
        else
            OUT="UltimeCordSetup-darwin-x64"
        fi
        ;;
    Linux)
        OUT="UltimeCordSetup-linux"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OUT="UltimeCordSetup.exe"
        ;;
    *)
        echo "Unsupported platform"
        exit 1
        ;;
esac

echo "Building $OUT..."
go build -o "$OUT" .
chmod +x "$OUT" 2>/dev/null || true
mkdir -p ../dist
cp "$OUT" "../dist/$OUT"
echo "Done! Installer built at installer/$OUT and dist/$OUT"

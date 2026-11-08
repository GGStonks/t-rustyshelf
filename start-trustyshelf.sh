#!/bin/sh
# (T)rustyShelf from the source on Linux (Arch, CachyOS, Omarchy, Fedora, Ubuntu, SteamOS Desktop Mode …).
#   ./start-trustyshelf.sh              fullscreen
#   ./start-trustyshelf.sh --windowed   in a window
#   ./start-trustyshelf.sh --check      only get everything ready (node_modules and Electron), then stop
# The first run installs what it needs (about a minute). If npm stops before Electron's download is unpacked (it can when
# the install is interrupted), this finishes the unpacking from the downloaded archive with `unzip` instead of starting over.
# The ready-made AppImage from the releases page needs none of this.
# The idea of a start script that finishes Electron's unpacking comes from wouldja's boxshelf-linux (brought in here with
# the app's own name and options).
set -eu
cd "$(dirname "$(readlink -f "$0")")"

say() { printf '%s\n' "(T)rustyShelf: $*" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || { say "needs $1. $2"; exit 1; }; }

need node "Install Node.js (Arch / CachyOS / Omarchy: sudo pacman -S nodejs npm; Fedora: sudo dnf install nodejs; Ubuntu: sudo apt install nodejs npm)."
need npm "Install npm with Node.js (Arch / CachyOS / Omarchy: sudo pacman -S npm)."

MODE=run
for a in "$@"; do
  case "$a" in
    --check) MODE=check ;;
    --windowed) WINDOWED=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) say "unknown option $a (try --help)"; exit 2 ;;
  esac
done

[ -d node_modules ] || { say "installing what it needs (first run) …"; npm install --no-audit --no-fund; }

# Electron is ready when its folder has the unpacked program and path.txt names it
electron_ready() { [ -s node_modules/electron/path.txt ] && [ -e "node_modules/electron/dist/$(cat node_modules/electron/path.txt)" ]; }

if ! electron_ready; then
  say "Electron isn't unpacked yet: finishing it …"
  # first the package's own installer (it reuses a download it already has)
  node node_modules/electron/install.js >/dev/null 2>&1 || true
fi
if ! electron_ready; then
  # then by hand from the archive it downloaded (npm keeps it in Electron's cache)
  cache="${ELECTRON_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/electron}"
  ver="$(node -p "require('./node_modules/electron/package.json').version")"
  case "$(uname -m)" in aarch64|arm64) arch=arm64 ;; armv7l) arch=armv7l ;; *) arch=x64 ;; esac
  zip="$(find "$cache" -name "electron-v${ver}-linux-${arch}.zip" 2>/dev/null | head -n 1 || true)"
  if [ -n "$zip" ]; then
    need unzip "Install it (Arch / CachyOS / Omarchy: sudo pacman -S unzip), then run this again."
    rm -rf node_modules/electron/dist
    mkdir -p node_modules/electron/dist
    unzip -q -o "$zip" -d node_modules/electron/dist
    printf 'electron' > node_modules/electron/path.txt
    chmod +x node_modules/electron/dist/electron 2>/dev/null || true
    say "unpacked Electron $ver from its download."
  fi
fi
if ! electron_ready; then
  say "Electron couldn't be set up. Run: npm install   (or use the AppImage from the releases page)"
  exit 1
fi

[ "$MODE" = check ] && { say "ready."; exit 0; }
if [ "${WINDOWED:-}" = 1 ]; then exec npm run windowed; else exec npm start; fi

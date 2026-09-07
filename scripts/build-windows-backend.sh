#!/usr/bin/env bash
set -euo pipefail

# This script will build the backend (Python) into a standalone Windows executable using Wine + PyInstaller.
# It requires Wine and Python for Windows (wine-python) installed in the Ubuntu environment.
# It assumes you already ran `npm run build:frontend` to populate frontend/dist and that backend pyinstaller spec exists.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/backend"

# Create a temporary Wineprefix for building
WINEPREFIX="$ROOT_DIR/.wine-pyinstaller"
export WINEPREFIX
mkdir -p "$WINEPREFIX"

# Check wine
if ! command -v wine >/dev/null 2>&1; then
  echo "wine is not installed. Install wine and winetricks first." >&2
  exit 1
fi

# Use pyinstaller inside wine - requires python for windows installed under wine
# You should install a Windows Python into this wineprefix manually or via winetricks.

# Run pyinstaller via wine
wine pyinstaller --noconfirm --clean --onefile run.py --name backend.exe

# After this, copy dist/backend.exe to ../electron/resources/backend/
mkdir -p ../electron/resources/backend
cp dist/backend.exe ../electron/resources/backend/

echo "Backend Windows executable built and copied to ../electron/resources/backend/backend.exe"

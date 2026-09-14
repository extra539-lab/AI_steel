# BUILD_WINDOWS.md

This document describes how to build a standalone Windows application for A1 Steel & Cement. The recommended delivery file is the portable `A1-Steel-Cement-Start-1.0.0.exe`: it can be copied to another Windows computer and launched directly, without Node.js, Python, VS Code, or a terminal.

Overview
--------
We package the React frontend as static files, bundle the FastAPI backend into a self-contained Windows executable using PyInstaller, and then package an Electron app that starts the backend executable and loads the static frontend. The final installer is produced using `electron-builder` (NSIS on Windows).

Prerequisites (on your Windows build machine)
--------------------------------------------
- Node.js (for building frontend and electron)
- npm
- Python 3.10+ (for building the backend executable with PyInstaller)
- pip
- PyInstaller (`pip install pyinstaller`)
- Yarn or npm (we use npm in scripts below)
- Windows 10/11 SDK (not required for PyInstaller normally)

Important: Customers do NOT need these tools. They are required only on the developer/build machine.

High-level steps
----------------
1. Build frontend production files
2. Package backend into a single exe with PyInstaller
3. Copy backend exe and frontend dist into `electron` extraResources
4. Run `electron-builder` to produce final installer

Commands (run on Windows, from project root)
--------------------------------------------
# 1. Install project dependencies (developer/build machine only)
npm install

# 1b. Install Python build dependencies (developer/build machine only)
py -3.12 -m pip install -r backend/requirements.txt pyinstaller

# 2. Build frontend
npm run build:frontend
# this creates frontend/dist

# 3. Build backend executable using PyInstaller
# Ensure you have a virtualenv or Python environment with project dependencies installed
# From project root (Windows):
cd backend
py -3.12 -m PyInstaller --noconfirm --clean --onefile --console --collect-submodules app run.py --name backend
# After this, the single `backend.exe` will be in `backend/dist/`.
cd ..

# 4. Package Electron app (this will include backend exe and frontend dist)
# This produces ONE portable Start EXE. It contains Electron, the React UI,
# and the Python/SQLite backend.
npm run build:windows

# 5. Result
# The portable file will be in electron/dist/:
# electron/dist/A1-Steel-Cement-Start-1.0.0.exe
# Copy only that EXE to another compatible 64-bit Windows PC and double-click it.
# No supporting folder, Node.js, Python, VS Code, or terminal is needed.
#
# Optional traditional installer:
# npm run build:windows:installer
# This creates electron/dist/ShopHisab-1.0.0-nsis.exe.

Notes & Project modifications performed
--------------------------------------
- Added an Electron `main.js` (production-aware) that starts the backend executable from resources, waits for the health endpoint, and then loads the packaged frontend `index.html`.
- Added a `preload.js` which exposes `electronAPI.getBackendUrl()` to the renderer so the frontend can configure its API base at runtime.
- Updated `frontend/src/services/api.js` to allow setting the axios base URL at runtime via `setApiBase()`.
- Updated `frontend/src/App.jsx` to call `window.electronAPI.getBackendUrl()` on startup and set the API base before making requests.
- Updated `electron/package.json` with `electron-builder` configuration to include `frontend/dist` and `backend/dist` inside the final installer as `extraResources`.
- `BUILD_WINDOWS.md` added with build steps.

Database storage and user data
------------------------------
- The packaged backend uses the location where it runs to locate the `data/` folder if no `DATABASE_URL` is provided. You should launch the backend with an environment variable `DATABASE_URL=sqlite:///%APPDATA%/A1SteelCement/a1_steel_cement.db` so the customer's DB is placed in their `%APPDATA%` folder. The Electron main process sets `PORT` env when launching the backend; you can modify it to also set `DATABASE_URL` if desired.

Testing on a clean Windows PC
-----------------------------
1. Copy `A1-Steel-Cement-Start-1.0.0.exe` to the clean Windows PC.
2. Double-click it. Do not run it from a ZIP file; extract it first.
3. The application starts its packaged backend and opens the UI. Closing VS Code or a terminal cannot affect it.
4. App data (SQLite DB) is stored per Windows user in the app's `%APPDATA%` folder and stays on that computer when the portable EXE is upgraded or moved.

Troubleshooting
---------------
- If the app shows a startup-error page, check the backend logs. You can modify the Electron main to capture backend stdout/stderr into a log file inside `%APPDATA%` for debug.
- If the backend can't bind the port, choose a different port via the `BACKEND_PORT` environment variable or change `DEFAULT_BACKEND_PORT` in `electron/main.js`.

Limitations / Next steps
------------------------
- The actual packaging step (`pyinstaller` and `electron-builder`) must be run on Windows to produce a Windows-compatible `backend.exe` and signed installer.
- Consider adding an automatic backup on first-run and a restore mechanism.
- Consider code-signing the final installer to reduce SmartScreen warnings.


If you want, I can now:
- Add a small Windows-specific launcher that sets `DATABASE_URL` to `%APPDATA%` before starting the backend (recommended).
- Wire backend logging into `%APPDATA%/A1SteelCement/logs/` for easier troubleshooting.

*** End of BUILD_WINDOWS.md

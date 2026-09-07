# BUILD_WINDOWS.md

This document describes how to build a standalone Windows installer (A1-Steel-Cement-Setup.exe) for the A1 Steel & Cement desktop application.

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
# 1. Install project dependencies
npm install
cd frontend
npm install
cd ../electron
npm install
cd ..

# 2. Build frontend
npm run build:frontend
# this creates frontend/dist

# 3. Build backend executable using PyInstaller
# Ensure you have a virtualenv or Python environment with project dependencies installed
# From project root (Windows):
cd backend
pyinstaller --noconfirm --clean --onefile run.py --name backend
# After this, the single `backend.exe` will be in `backend/dist/`.
cd ..

# 4. Package Electron app (this will include backend exe and frontend dist)
cd electron
npm run dist

# 5. Result
# The installer will be in electron/dist/ (electron-builder output)
# Example: electron/dist/A1 Steel & Cement Setup 1.0.0.exe

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
1. Copy the generated `A1 Steel & Cement Setup.exe` to the clean machine.
2. Run the installer and install to `C:\Program Files\A1 Steel & Cement`.
3. Launch from Start Menu. The application will extract resources, start the backend (packaged exe), and then show the UI.
4. App data (SQLite DB) will be written to `%APPDATA%\A1SteelCement\a1_steel_cement.db` if you configure the installer/launcher to set `DATABASE_URL` appropriately.

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

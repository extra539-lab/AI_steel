**Build Windows ShopHisab (CI)**

How to trigger
- Manually: open the GitHub repository Actions tab, choose "Build Windows ShopHisab" and click "Run workflow" (select branch and click the button).

What the workflow does
- Runs on `windows-latest`.
- Checks out the repo, installs Node.js (based on `package.json` or defaults to Node 18), installs npm deps, builds the frontend, builds the Python backend using PyInstaller, then runs `electron-builder` to create a real Windows `ShopHisab-Setup.exe` NSIS installer.

Where to download the installer
- After a successful run, the installer is uploaded as an artifact named `ShopHisab-Installer`. Download it from the Actions run page under the "Artifacts" section.

How to install on Windows
- Download `ShopHisab-Setup-<version>.exe` from the workflow run artifacts.
- Double-click the EXE on Windows and follow the NSIS installer UI. Allow elevation when requested and choose install location.

Notes
- This workflow builds a genuine Windows-native Electron executable and installer on a real Windows runner — no Wine or Linux prepack workarounds are used.
- If the backend needs additional Windows libraries, ensure `backend/requirements.txt` is complete or update the workflow to install required redistributables before building.

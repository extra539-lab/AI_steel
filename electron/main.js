const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

let mainWindow = null;
let backendProcess = null;
const DEFAULT_BACKEND_PORT = process.env.BACKEND_PORT || 8005;
const HEALTH_PATH = '/health';

// Global error logging for main process — writes helpful logs to userData
function writeMainLog(text) {
  try {
    const userDataDir = app && app.getPath ? app.getPath('userData') : path.join(__dirname, '..');
    const logDir = path.join(userDataDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'main-process.log');
    const entry = `[${new Date().toISOString()}] ${text}\n`;
    fs.appendFileSync(logFile, entry);
    return logFile;
  } catch (e) {
    // best-effort
    try { fs.appendFileSync(path.join(__dirname, 'main-process.log'), text + '\n'); } catch (_) {}
    return path.join(__dirname, 'main-process.log');
  }
}

process.on('uncaughtException', (err) => {
  const msg = `Uncaught exception: ${err && err.stack ? err.stack : String(err)}`;
  const logFile = writeMainLog(msg);
  try {
    dialog.showErrorBox('Application error', `An unexpected error occurred in the main process.\nSee log: ${logFile}`);
  } catch (e) {
    // ignore if dialog can't be shown
  }
});

process.on('unhandledRejection', (reason) => {
  const msg = `Unhandled rejection: ${reason && reason.stack ? reason.stack : String(reason)}`;
  writeMainLog(msg);
});

function getBackendUrl(port = DEFAULT_BACKEND_PORT) {
  return `http://127.0.0.1:${port}`;
}

async function waitForBackend(url, timeout = 15000) {
  const start = Date.now();
  const target = new URL(url + HEALTH_PATH);
  const isHttps = target.protocol === 'https:';

  function checkOnce() {
    return new Promise((resolve) => {
      const lib = isHttps ? https : http;
      const req = lib.request(
        {
          hostname: target.hostname,
          port: target.port,
          path: target.pathname + target.search,
          method: 'GET',
          timeout: 1500,
        },
        (res) => {
          // treat 200 as healthy
          resolve(res.statusCode === 200);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  while (Date.now() - start < timeout) {
    try {
      const ok = await checkOnce();
      if (ok) return true;
    } catch (e) {
      // ignore, retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function resolveProductionBackendPath(resourcesPath) {
  const backendExeName = process.platform === 'win32' ? 'backend.exe' : 'backend';
  const candidates = [
    path.join(resourcesPath, 'backend', backendExeName),
    path.join(resourcesPath, 'backend', 'dist', backendExeName),
    path.join(resourcesPath, 'backend', 'backend', backendExeName),
    path.join(resourcesPath, 'app', 'backend', backendExeName),
    path.join(resourcesPath, '..', 'backend', backendExeName),
  ].filter(Boolean);

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return { match, candidates };
}

function startBackendForProduction(resourcesPath, port = DEFAULT_BACKEND_PORT) {
  const { match, candidates } = resolveProductionBackendPath(resourcesPath);
  const userData = app.getPath('userData');
  const appDataDatabase = path.join(userData, 'data', 'a1_steel_cement.db');

  try {
    if (!match) {
      const msg = `Backend executable not found. Searched: ${candidates.join('; ')}`;
      writeMainLog(msg);
      throw new Error(msg);
    }

    writeMainLog(`Starting packaged backend: ${match}`);
    const backendDir = path.dirname(match);

    backendProcess = spawn(match, [], {
      detached: false,
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: Object.assign({}, process.env, {
        PORT: String(port),
        BACKEND_PORT: String(port),
        APP_ENV: 'production',
        APP_DATA_DIR: userData,
        PRODUCTION_DATABASE: appDataDatabase,
        DATABASE_URL: `sqlite:///${appDataDatabase}`,
        PYTHONUNBUFFERED: '1',
      }),
    });

    backendProcess.on && backendProcess.on('error', (err) => {
      writeMainLog(`backend spawn error: ${err && err.stack ? err.stack : String(err)}`);
    });
    backendProcess.on && backendProcess.on('exit', (code, signal) => {
      writeMainLog(`backend exited with code=${code} signal=${signal}`);
    });

    try {
      if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (d) => writeMainLog(`backend stdout: ${d.toString()}`));
      }
      if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (d) => writeMainLog(`backend stderr: ${d.toString()}`));
      }
    } catch (e) {
      writeMainLog(`Failed to attach backend listeners: ${e}`);
    }

    backendProcess.unref && backendProcess.unref();
    return match;
  } catch (err) {
    console.error('Failed to start backend executable:', err);
    throw err;
  }
}

function resolvePythonExecutable(projectRoot) {
  const backendRoot = path.join(projectRoot, 'backend');
  const candidates = [
    process.env.PYTHON_PATH,
    path.join(backendRoot, process.platform === 'win32' ? 'venv\\Scripts\\python.exe' : 'venv/bin/python'),
    path.join(backendRoot, process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python'),
    path.join(projectRoot, process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python'),
    process.platform === 'win32' ? 'python.exe' : 'python',
  ].filter(Boolean);

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[candidates.length - 1];
}

function startBackendForDev(projectRoot, port = DEFAULT_BACKEND_PORT) {
  const backendRun = path.join(projectRoot, 'backend', 'run.py');
  const python = resolvePythonExecutable(projectRoot);
  const backendDir = path.join(projectRoot, 'backend');

  writeMainLog(`Starting dev backend with: ${python} ${backendRun}`);
  backendProcess = spawn(python, [backendRun], {
    detached: false,
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      BACKEND_PORT: String(port),
    }),
  });

  backendProcess.on && backendProcess.on('error', (err) => {
    writeMainLog(`dev backend spawn error: ${err && err.stack ? err.stack : String(err)}`);
  });
  backendProcess.stdout && backendProcess.stdout.on('data', (d) => writeMainLog(`dev backend stdout: ${d.toString()}`));
  backendProcess.stderr && backendProcess.stderr.on('data', (d) => writeMainLog(`dev backend stderr: ${d.toString()}`));
  backendProcess.unref && backendProcess.unref();
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;

  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // Start packaged backend from resources
    const resourcesPath = process.resourcesPath;
    try {
      startBackendForProduction(resourcesPath, DEFAULT_BACKEND_PORT);
    } catch (err) {
      // show error page
      win.loadFile(path.join(__dirname, 'error.html'));
      return;
    }

    const backendUrl = getBackendUrl(DEFAULT_BACKEND_PORT);
    const ready = await waitForBackend(backendUrl, 20000);
    if (!ready) {
      win.loadFile(path.join(__dirname, 'error.html'));
      return;
    }

    // Load the packaged frontend
    const indexPath = path.join(process.resourcesPath, 'app', 'frontend', 'index.html');
    win.loadFile(indexPath);
  } else {
    // Development mode - assume frontend dev server running and use project paths
    const devUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:5173';
    // start backend from project if not running
    startBackendForDev(path.join(__dirname, '..'));
    win.loadURL(devUrl);
  }

  win.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-backend-url', async () => {
  return getBackendUrl(DEFAULT_BACKEND_PORT) + '/api';
});

ipcMain.handle('get-app-data-path', async () => {
  return app.getPath('userData');
});

ipcMain.handle('open-backup-folder', async () => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  shell.openPath(backupDir);
  return backupDir;
});

ipcMain.handle('export-backup-file', async (_event, filename) => {
  const backupDir = path.join(app.getPath('userData'), 'backups');
  const source = path.join(backupDir, filename);
  if (!fs.existsSync(source)) {
    throw new Error('Backup file not found.');
  }

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });

  if (!filePath) {
    return null;
  }

  fs.copyFileSync(source, filePath);
  return filePath;
});

// Print an HTML string in a hidden window and send back success/failure.
ipcMain.handle('print-receipt', async (_event, html /*, options */) => {
  let win = null;
  try {
    win = new BrowserWindow({
      width: 600,
      height: 800,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    await win.loadURL(dataUrl);

    // Wait for load to finish
    await new Promise((resolve) => {
      if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', resolve);
      } else resolve();
    });

    // Check available printers
    let printers = [];
    try {
      printers = win.webContents.getPrinters();
    } catch (e) {
      writeMainLog(`[print] getPrinters failed: ${e}`);
    }

    if (!printers || printers.length === 0) {
      const msg = 'No printers configured. Please install/configure a printer.';
      writeMainLog(`[print] failed: ${msg}`);
      try { dialog.showErrorBox('Print Failed', msg); } catch (e) {}
      return { success: false, failureReason: msg };
    }

    // Single print call
    const printResult = await new Promise((resolve) => {
      try {
        win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          resolve({ success: !!success, failureReason: failureReason || null });
        });
      } catch (err) {
        resolve({ success: false, failureReason: String(err) });
      }
    });

    if (!printResult.success) {
      const msg = printResult.failureReason || 'Unknown printer error or user cancelled.';
      writeMainLog(`[print] failed: ${msg}`);
      try { dialog.showErrorBox('Print Failed', msg); } catch (e) {}
      return { success: false, failureReason: msg };
    }

    return { success: true, failureReason: null };
  } catch (err) {
    const msg = err && err.stack ? err.stack : String(err);
    writeMainLog(`[print] exception: ${msg}`);
    try { dialog.showErrorBox('Print Failed', `Printing failed: ${msg}`); } catch (e) {}
    return { success: false, failureReason: msg };
  } finally {
    try {
      if (win) {
        win.destroy && win.destroy();
      }
    } catch (e) {
      // best-effort
    }
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // Try to terminate backend if we started it
  try {
    if (backendProcess && !backendProcess.killed) backendProcess.kill();
  } catch (e) {
    // ignore
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

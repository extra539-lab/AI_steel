const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  exportBackupFile: (filename) => ipcRenderer.invoke('export-backup-file', filename),
})

window.addEventListener('DOMContentLoaded', () => {
  // keep existing behavior for versions if needed
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

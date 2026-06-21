const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  showOverlay:    () => ipcRenderer.invoke('show-overlay'),
  hideOverlay:    () => ipcRenderer.invoke('hide-overlay'),
  toggleOverlay:  () => ipcRenderer.invoke('toggle-overlay'),
  overlayVisible: () => ipcRenderer.invoke('overlay-visible'),
  getBackendUrl:  () => ipcRenderer.invoke('get-backend-url'),
  isElectron: true,
})

/**
 * Preload Script — Exposes a safe bridge between main process and renderer.
 * The renderer (overlay.html) receives data via window.electronAPI callbacks.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for telemetry data from main process
  onTelemetry: (callback) => {
    ipcRenderer.on('telemetry', (_event, data) => callback(data))
  },

  // Listen for lap completion events
  onLapCompleted: (callback) => {
    ipcRenderer.on('lap-completed', (_event, data) => callback(data))
  },

  // Listen for WebSocket connection status
  onWsStatus: (callback) => {
    ipcRenderer.on('ws-status', (_event, data) => callback(data))
  },

  // Listen for theme updates
  onThemeUpdate: (callback) => {
    ipcRenderer.on('theme-update', (_event, data) => callback(data))
  },
})

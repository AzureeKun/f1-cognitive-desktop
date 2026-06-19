const { app, BrowserWindow, globalShortcut, screen } = require('electron')
const { io } = require('socket.io-client')

let overlayWindow = null
let socket = null

const BACKEND_URL = 'https://f1-cognitive-telemetry.onrender.com'

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    x: width - 440,
    y: height - 280,
    width: 420,
    height: 260,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  overlayWindow.loadURL(`${BACKEND_URL}/overlay`)

  overlayWindow.once('ready-to-show', () => {
    // Start hidden — web dashboard controls visibility
    overlayWindow.hide()
    console.log('[Overlay] Ready (hidden). Waiting for START command...')
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow._ignoring = true

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function connectToBackend() {
  socket = io(BACKEND_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    console.log('[WS] Connected to backend')
  })

  socket.on('disconnect', () => {
    console.log('[WS] Disconnected')
  })

  // Listen for overlay commands from the web dashboard
  socket.on('overlay_command', (data) => {
    console.log('[WS] Overlay command received:', data.action)
    if (!overlayWindow) return

    if (data.action === 'START') {
      overlayWindow.show()
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      console.log('[Overlay] SHOWN')
    } else if (data.action === 'STOP') {
      overlayWindow.hide()
      console.log('[Overlay] HIDDEN')
    }
  })
}

app.whenReady().then(() => {
  createOverlay()
  connectToBackend()

  // Ctrl+Shift+F — Toggle overlay visibility locally
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide()
      } else {
        overlayWindow.show()
      }
    }
  })

  // Ctrl+Shift+G — Toggle click-through
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (overlayWindow) {
      if (overlayWindow._ignoring) {
        overlayWindow.setIgnoreMouseEvents(false)
        overlayWindow._ignoring = false
      } else {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true })
        overlayWindow._ignoring = true
      }
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (socket) socket.disconnect()
})

app.on('window-all-closed', () => {
  app.quit()
})

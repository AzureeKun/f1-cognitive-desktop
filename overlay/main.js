const { app, BrowserWindow, globalShortcut, screen } = require('electron')

let overlayWindow = null

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    // Position: bottom-right corner of screen
    x: width - 440,
    y: height - 280,
    width: 420,
    height: 260,

    // Always on top (initial flag)
    alwaysOnTop: true,

    // Transparent & frameless — critical for overlay
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,

    // Prevent white flash on load
    show: false,
    backgroundColor: '#00000000',

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,  // Allow fetch to localhost from file:// origin
    },
  })

  // Load the overlay page from Flask backend (same origin as API = no CORS)
  overlayWindow.loadURL('http://localhost:5000/overlay')

  // Show window only after content is ready (prevents white flash)
  overlayWindow.once('ready-to-show', () => {
    overlayWindow.show()
  })

  // Force HIGHEST always-on-top level with max priority
  // 'screen-saver' level + priority 1 = above borderless fullscreen games
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)

  // Click-through: mouse passes straight through to the game
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  // Mark initial state
  overlayWindow._ignoring = true

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

app.whenReady().then(() => {
  createOverlay()

  // Ctrl+Shift+F — Toggle overlay visibility (show/hide)
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide()
      } else {
        overlayWindow.show()
      }
    }
  })

  // Ctrl+Shift+G — Toggle click-through (to reposition if needed)
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
})

app.on('window-all-closed', () => {
  app.quit()
})

const { app, BrowserWindow, globalShortcut, screen } = require('electron')
const path = require('path')

let overlayWindow = null

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    // Position: bottom-right corner
    x: width - 420,
    y: height - 260,
    width: 400,
    height: 240,

    // Always on top of everything (including games in borderless windowed)
    alwaysOnTop: true,
    
    // Frameless transparent window
    frame: false,
    transparent: true,
    resizable: true,
    
    // Click-through when not hovering on content
    // skipTaskbar: true,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the overlay HTML
  overlayWindow.loadFile('overlay.html')

  // Set always on top with highest level (works over most games)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  // Ignore mouse events on transparent areas (click-through)
  overlayWindow.setIgnoreMouseEvents(false)

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

app.whenReady().then(() => {
  createOverlay()

  // Toggle overlay visibility with Ctrl+Shift+F
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide()
      } else {
        overlayWindow.show()
      }
    }
  })

  // Toggle click-through with Ctrl+Shift+G
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (overlayWindow) {
      const isIgnoring = overlayWindow.isIgnoringMouseEvents
      overlayWindow.setIgnoreMouseEvents(!isIgnoring, { forward: true })
      overlayWindow.isIgnoringMouseEvents = !isIgnoring
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})

/**
 * F1 Focus Overlay — Electron Main Process
 *
 * Creates a transparent, borderless, always-on-top, click-through window
 * that renders a HUD overlay on top of F1 25.
 *
 * Pipeline:
 *   F1 25 → UDP → telemetry_live.py → WebSocket → Render Backend → This App
 *
 * Remote Control:
 *   Vercel Dashboard → emits 'control_overlay' → Render broadcasts 'overlay_command'
 *   → This app shows/hides the window
 */

const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron')
const path = require('path')
const { io } = require('socket.io-client')

// ─── Configuration ───────────────────────────────────────────────────────────
const BACKEND_URL = 'https://f1-cognitive-telemetry.onrender.com'

let overlayWindow = null
let socket = null
let isOverlayVisible = false

// ─── Create the Overlay Window ───────────────────────────────────────────────
function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.size

  // Position: bottom-right corner with padding
  const WINDOW_WIDTH = 420
  const WINDOW_HEIGHT = 260
  const PADDING = 20

  overlayWindow = new BrowserWindow({
    x: width - WINDOW_WIDTH - PADDING,
    y: height - WINDOW_HEIGHT - PADDING - 40, // 40px above taskbar
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    type: 'toolbar', // Prevents alt-tab visibility on some systems
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load the local overlay HTML (bundled with the app)
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'))

  // Keep it above fullscreen games
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)

  // Click-through: mouse events pass through to the game
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  overlayWindow.once('ready-to-show', () => {
    // Start hidden — wait for 'START' command from dashboard
    console.log('[Overlay] Window ready (hidden). Waiting for START command...')
  })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

// ─── WebSocket Connection to Render Backend ──────────────────────────────────
function connectToBackend() {
  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log(`[WS] Connected to ${BACKEND_URL} (id: ${socket.id})`)
    // Notify renderer of connection status
    sendToRenderer('ws-status', { connected: true })
  })

  socket.on('disconnect', (reason) => {
    console.log(`[WS] Disconnected: ${reason}`)
    sendToRenderer('ws-status', { connected: false })
  })

  socket.on('connect_error', (err) => {
    console.log(`[WS] Connection error: ${err.message}`)
  })

  // ── Live Telemetry Data ──
  // Backend broadcasts this after running AI prediction on incoming UDP data
  socket.on('live_telemetry', (data) => {
    // Forward to renderer only when visible (saves CPU)
    if (isOverlayVisible && overlayWindow && !overlayWindow.isDestroyed()) {
      sendToRenderer('telemetry', data)
    }
  })

  // ── Lap Completion ──
  socket.on('live_lap_completed', (data) => {
    if (isOverlayVisible && overlayWindow && !overlayWindow.isDestroyed()) {
      sendToRenderer('lap-completed', data)
    }
  })

  // ── Remote Control: Show/Hide from Dashboard ──
  socket.on('overlay_command', (data) => {
    const action = data?.action || ''
    console.log(`[WS] Overlay command: ${action}`)

    if (!overlayWindow || overlayWindow.isDestroyed()) return

    if (action === 'START') {
      showOverlay()
    } else if (action === 'STOP') {
      hideOverlay()
    }
  })

  // ── Theme Sync ──
  socket.on('theme_update', (theme) => {
    sendToRenderer('theme-update', theme)
  })
}

// ─── Show/Hide Helpers ───────────────────────────────────────────────────────
function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.show()
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  isOverlayVisible = true
  console.log('[Overlay] SHOWN')
}

function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  overlayWindow.hide()
  isOverlayVisible = false
  console.log('[Overlay] HIDDEN')
}

// ─── Safe IPC send to renderer ───────────────────────────────────────────────
function sendToRenderer(channel, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data)
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.disableHardwareAcceleration() // Better transparency support on some GPUs

app.whenReady().then(() => {
  createOverlay()
  connectToBackend()

  // Keyboard shortcuts (local override)
  // Ctrl+Shift+F — Toggle overlay visibility
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (isOverlayVisible) {
      hideOverlay()
    } else {
      showOverlay()
    }
  })

  // Ctrl+Shift+G — Toggle click-through (for debugging/repositioning)
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return
    const isIgnoring = overlayWindow._ignoring !== false
    if (isIgnoring) {
      overlayWindow.setIgnoreMouseEvents(false)
      overlayWindow._ignoring = false
      console.log('[Overlay] Click-through DISABLED (interactive)')
    } else {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true })
      overlayWindow._ignoring = true
      console.log('[Overlay] Click-through ENABLED (pass-through)')
    }
  })

  // Fetch initial theme from backend
  fetchTheme()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (socket) {
    socket.disconnect()
    socket = null
  }
})

app.on('window-all-closed', () => {
  app.quit()
})

// ─── Fetch theme on startup ─────────────────────────────────────────────────
async function fetchTheme() {
  try {
    const { net } = require('electron')
    const request = net.request(`${BACKEND_URL}/api/theme`)
    request.on('response', (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => {
        try {
          const theme = JSON.parse(body)
          sendToRenderer('theme-update', theme)
        } catch (e) { /* ignore parse errors */ }
      })
    })
    request.on('error', () => { /* silent fail */ })
    request.end()
  } catch (e) { /* silent fail on startup */ }
}

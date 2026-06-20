/**
 * F1 Cognitive Telemetry — Desktop Application (Electron Main Process)
 *
 * This wraps the entire system into a single desktop app:
 * 1. Spawns the Python Flask backend (localhost:5000)
 * 2. Opens the React dashboard in the main window
 * 3. Manages the transparent overlay window
 * 4. UDP telemetry runs inside the Python backend
 *
 * User just double-clicks the app — everything works locally.
 */

const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

// ─── Configuration ───────────────────────────────────────────────────────────
const BACKEND_PORT = 5000
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`
const isDev = !app.isPackaged

let mainWindow = null
let overlayWindow = null
let pythonProcess = null

// ─── Find Python Backend Path ────────────────────────────────────────────────
function getPythonBackendPath() {
  if (isDev) {
    return path.join(__dirname, 'python-backend')
  } else {
    return path.join(process.resourcesPath, 'python-backend')
  }
}

// ─── Start Python Backend ────────────────────────────────────────────────────
function startPythonBackend() {
  const backendPath = getPythonBackendPath()
  const appPy = path.join(backendPath, 'app.py')

  if (!fs.existsSync(appPy)) {
    console.error(`[BACKEND] app.py not found at: ${appPy}`)
    return
  }

  console.log(`[BACKEND] Starting Flask from: ${backendPath}`)

  // Find Python executable
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  pythonProcess = spawn(pythonCmd, [appPy], {
    cwd: backendPath,
    env: {
      ...process.env,
      FLASK_ENV: 'production',
      FRONTEND_URL: `http://localhost:${BACKEND_PORT}`,
      BACKEND_URL: BACKEND_URL,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[PY] ${data.toString().trim()}`)
  })

  pythonProcess.stderr.on('data', (data) => {
    console.log(`[PY] ${data.toString().trim()}`)
  })

  pythonProcess.on('error', (err) => {
    console.error(`[BACKEND] Failed to start Python: ${err.message}`)
  })

  pythonProcess.on('close', (code) => {
    console.log(`[BACKEND] Python exited with code ${code}`)
    pythonProcess = null
  })
}

// ─── Wait for Backend to be Ready ────────────────────────────────────────────
function waitForBackend(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const http = require('http')

    function check() {
      if (Date.now() - startTime > timeout) {
        reject(new Error('Backend startup timeout'))
        return
      }

      const req = http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          setTimeout(check, 500)
        }
      })
      req.on('error', () => {
        setTimeout(check, 500)
      })
      req.end()
    }

    check()
  })
}

// ─── Create Main Dashboard Window ────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'F1 Cognitive Telemetry',
    icon: path.join(__dirname, 'icon.jpg'),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    // Development: load from built frontend files in the app folder
    const frontendPath = path.join(__dirname, 'frontend-build', 'index.html')
    if (fs.existsSync(frontendPath)) {
      mainWindow.loadFile(frontendPath)
    } else {
      // Fallback to Vite dev server if frontend isn't built
      mainWindow.loadURL('http://localhost:3000')
    }
  } else {
    // Production: load from built frontend files
    const frontendPath = path.join(__dirname, 'frontend-build', 'index.html')
    mainWindow.loadFile(frontendPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Create Overlay Window ───────────────────────────────────────────────────
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().size

  overlayWindow = new BrowserWindow({
    x: width - 440,
    y: height - 300,
    width: 420,
    height: 260,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load overlay from the local backend
  overlayWindow.loadURL(`${BACKEND_URL}/overlay`)

  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

// ─── IPC Handlers (from renderer) ────────────────────────────────────────────
ipcMain.handle('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  }
})

ipcMain.handle('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide()
  }
})

ipcMain.handle('get-backend-url', () => {
  return BACKEND_URL
})

// ─── App Lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Start Python backend
  startPythonBackend()

  // 2. Wait for backend to be ready
  console.log('[APP] Waiting for backend...')
  try {
    await waitForBackend()
    console.log('[APP] Backend is ready!')
  } catch (e) {
    console.error('[APP] Backend failed to start:', e.message)
  }

  // 3. Create windows
  createMainWindow()
  createOverlayWindow()

  // 4. Keyboard shortcuts
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) overlayWindow.hide()
      else {
        overlayWindow.show()
        overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
      }
    }
  })

  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (overlayWindow) {
      const ignoring = overlayWindow._ignoring !== false
      if (ignoring) {
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

  // Kill Python backend
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
})

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill()
  }
  app.quit()
})

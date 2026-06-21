/**
 * F1 Cognitive Telemetry — Desktop Application (Electron Main Process)
 *
 * SINGLE EXE — just double-click to run. No BAT file needed.
 * 1. Spawns the Python Flask backend (localhost:5000)
 * 2. Opens the React dashboard in the main window
 * 3. Manages the transparent overlay window
 * 4. UDP telemetry runs inside the Python backend
 */

const { app, BrowserWindow, globalShortcut, screen, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const fs = require('fs')

// ─── Configuration ───────────────────────────────────────────────────────────
const BACKEND_PORT = 5050
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`
const isDev = !app.isPackaged

let mainWindow = null
let overlayWindow = null
let pythonProcess = null
let splashWindow = null

// ─── Find Python Backend Path ────────────────────────────────────────────────
function getPythonBackendPath() {
  if (isDev) {
    return path.join(__dirname, 'python-backend')
  } else {
    return path.join(process.resourcesPath, 'python-backend')
  }
}

// ─── Find Python Executable ──────────────────────────────────────────────────
function findPython() {
  // Try 'py' first (Windows Python Launcher), then 'python', then 'python3'
  const candidates = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python']

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe' })
      return cmd
    } catch (e) {
      // Try next
    }
  }
  return null
}

// ─── Install Python Dependencies ─────────────────────────────────────────────
function installPythonDeps(pythonCmd, backendPath) {
  const markerFile = path.join(backendPath, '.deps_installed')
  if (fs.existsSync(markerFile)) return true

  try {
    console.log('[SETUP] Installing Python dependencies...')
    execSync(`${pythonCmd} -m pip install -r "${path.join(backendPath, 'requirements.txt')}" --quiet`, {
      cwd: backendPath,
      stdio: 'pipe',
      timeout: 300000, // 5 min timeout
    })
    fs.writeFileSync(markerFile, 'ok')
    console.log('[SETUP] Python dependencies installed!')
    return true
  } catch (e) {
    console.error('[SETUP] Failed to install dependencies:', e.message)
    return false
  }
}

// ─── Create Splash/Loading Screen ────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 450,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  const splashHtml = `
    <html>
    <head><style>
      body { margin:0; display:flex; align-items:center; justify-content:center;
             height:100vh; background:rgba(10,10,15,0.95); color:#fff;
             font-family:'Segoe UI',sans-serif; border-radius:12px;
             border:1px solid #333; flex-direction:column; }
      h1 { font-size:20px; margin:0 0 10px 0; color:#e10600; }
      p { font-size:13px; color:#aaa; margin:5px 0; }
      .spinner { width:30px; height:30px; border:3px solid #333;
                 border-top:3px solid #e10600; border-radius:50%;
                 animation:spin 1s linear infinite; margin-bottom:20px; }
      @keyframes spin { to { transform:rotate(360deg); } }
    </style></head>
    <body>
      <div class="spinner"></div>
      <h1>F1 Cognitive Telemetry</h1>
      <p>Starting AI backend...</p>
      <p style="font-size:11px;color:#666;">First run may take a minute to install dependencies</p>
    </body></html>`

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
}

// ─── Start Python Backend ────────────────────────────────────────────────────
function startPythonBackend(pythonCmd) {
  const backendPath = getPythonBackendPath()
  const appPy = path.join(backendPath, 'app.py')

  if (!fs.existsSync(appPy)) {
    console.error(`[BACKEND] app.py not found at: ${appPy}`)
    return false
  }

  console.log(`[BACKEND] Starting Flask from: ${backendPath}`)
  console.log(`[BACKEND] Using Python: ${pythonCmd}`)

  pythonProcess = spawn(pythonCmd, [appPy], {
    cwd: backendPath,
    env: {
      ...process.env,
      FLASK_ENV: 'production',
      FRONTEND_URL: BACKEND_URL,
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

  return true
}

// ─── Wait for Backend to be Ready ────────────────────────────────────────────
function waitForBackend(timeout = 60000) {
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
          setTimeout(check, 1000)
        }
      })
      req.on('error', () => {
        setTimeout(check, 1000)
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
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load from pre-built frontend files — Flask serves everything
  mainWindow.loadURL(BACKEND_URL)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
    mainWindow.focus()
  })

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
  // 1. Show splash screen
  createSplashWindow()

  // 2. Find Python
  const pythonCmd = findPython()
  if (!pythonCmd) {
    if (splashWindow) splashWindow.close()
    dialog.showErrorBox(
      'Python Not Found',
      'Python 3.10+ is required but not found.\n\n' +
      'Please install Python from https://www.python.org/downloads/\n' +
      'Make sure to check "Add Python to PATH" during installation.'
    )
    app.quit()
    return
  }

  console.log(`[APP] Found Python: ${pythonCmd}`)

  // 3. Install dependencies (first run only)
  const backendPath = getPythonBackendPath()
  installPythonDeps(pythonCmd, backendPath)

  // 4. Start Python backend
  startPythonBackend(pythonCmd)

  // 5. Wait for backend to be ready
  console.log('[APP] Waiting for backend...')
  try {
    await waitForBackend()
    console.log('[APP] Backend is ready!')
  } catch (e) {
    console.error('[APP] Backend failed to start:', e.message)
    if (splashWindow) splashWindow.close()
    dialog.showErrorBox(
      'Backend Failed',
      'The AI backend failed to start.\n\n' +
      'Please make sure Python dependencies are installed:\n' +
      `Run: ${pythonCmd} -m pip install -r requirements.txt\n` +
      `in: ${backendPath}`
    )
    app.quit()
    return
  }

  // 6. Create windows
  createMainWindow()
  createOverlayWindow()

  // 7. Keyboard shortcuts
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

# F1 Cognitive Telemetry — Desktop Application

A standalone desktop application that monitors F1 driver cognitive focus in real-time using telemetry data from F1 25.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ELECTRON APP (.exe)                                         │
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  Main Window     │     │  Overlay Window              │   │
│  │  (React Dashboard│     │  (Transparent HUD)           │   │
│  │   on localhost)  │     │  (Always-on-top, borderless) │   │
│  └────────┬─────────┘     └──────────────┬──────────────┘   │
│           │                               │                  │
│  ┌────────▼───────────────────────────────▼──────────────┐  │
│  │  Python Flask Backend (localhost:5000)                  │  │
│  │  • AI Prediction (ANN Model)                          │  │
│  │  • UDP Telemetry Listener (port 20777)                │  │
│  │  • Firebase REST API (session storage)                │  │
│  │  • WebSocket (Socket.IO)                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                              ▲                               │
│                              │ UDP Port 20777                │
│  ┌───────────────────────────┴───────────────────────────┐  │
│  │  F1 25 Game (sends telemetry via UDP)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- F1 25 with UDP telemetry enabled (port 20777)

### Install Dependencies

```bash
# Install Electron dependencies
npm install

# Build the React frontend
npm run build-frontend
```

### Run in Development Mode

```bash
# Terminal 1: Start the React dev server
cd ../development/frontend
npm run dev

# Terminal 2: Start the Python backend
cd ../development/backend
py app.py

# Terminal 3: Start Electron
npm start
```

### Build Portable .exe

```bash
npm run build
```

Output: `dist/F1-Cognitive-Telemetry.exe`

## F1 25 Game Settings

1. Settings → Telemetry
2. UDP Telemetry: **ON**
3. UDP Broadcast Mode: **Off**
4. UDP IP: **127.0.0.1**
5. UDP Port: **20777**
6. UDP Send Rate: **60Hz**
7. Display Mode: **Borderless Windowed** (for overlay to show on top)

## Usage

1. Double-click `F1-Cognitive-Telemetry.exe`
2. Login with Steam
3. Click **LIVE ON** to start telemetry capture
4. Click **OVERLAY** to show the transparent HUD
5. Start driving in F1 25
6. Click **LIVE OFF** when done — session saved to Firebase

## Keyboard Shortcuts (Overlay)

- `Ctrl+Shift+F` — Toggle overlay visibility
- `Ctrl+Shift+G` — Toggle click-through (for repositioning)

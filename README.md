# F1 Cognitive Telemetry - Desktop Application

One-click desktop application for monitoring F1 driver cognitive focus in real-time using AI and game telemetry.

## Quick Start

1. Download this repository (Code > Download ZIP, or clone it)
2. Install Python 3.10+ (https://www.python.org/downloads/) - check "Add to PATH"
3. Install Node.js 18+ (https://nodejs.org/)
4. Copy your Firebase service account key as `python-backend/serviceAccountKey.json`
5. Double-click **`Start.bat`**

That's it! The app will:
- Install Python dependencies (first run only)
- Start the AI backend server
- Open the Electron dashboard
- Overlay works with Ctrl+Shift+F

## Features

- Real-time F1 25 UDP telemetry capture (port 20777)
- AI-powered cognitive focus prediction (GWO-PSO-ANN model)
- Transparent game overlay (always-on-top HUD)
- Session recording with lap-by-lap history
- Steam authentication
- Dark F1 racing theme with team color customization

## Keyboard Shortcuts

- `Ctrl+Shift+F` - Toggle overlay visibility
- `Ctrl+Shift+G` - Toggle overlay click-through

## Architecture

- **Electron** - Desktop shell (main window + overlay)
- **React** - Dashboard UI (pre-built in frontend-build/)
- **Flask + Socket.IO** - Backend server with UDP listener
- **TensorFlow/Keras** - ANN model for cognitive prediction

## Note

The Firebase service account key is required but not included in the repo for security.
Copy your key file as `python-backend/serviceAccountKey.json`.

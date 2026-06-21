"""
Build script: Compiles the Python backend into a standalone .exe using PyInstaller.
Run: py build_backend.py
"""
import subprocess
import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'development', 'backend')
AI_MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'ai_model')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'python-backend-exe')

# PyInstaller command
cmd = [
    sys.executable, '-m', 'PyInstaller',
    '--onedir',  # Bundle into a folder (faster startup than --onefile)
    '--name', 'backend',
    '--distpath', OUTPUT_DIR,
    '--workpath', os.path.join(os.path.dirname(__file__), 'build_temp'),
    '--specpath', os.path.join(os.path.dirname(__file__)),
    '--noconfirm',
    '--clean',
    # Add data files
    f'--add-data={AI_MODEL_DIR};ai_model',
    f'--add-data={os.path.join(BACKEND_DIR, "serviceAccountKey.json")};.',
    f'--add-data={os.path.join(BACKEND_DIR, ".env")};.',
    f'--add-data={os.path.join(BACKEND_DIR, "firestore_rest.py")};.',
    f'--add-data={os.path.join(BACKEND_DIR, "firebase_config.py")};.',
    f'--add-data={os.path.join(BACKEND_DIR, "shared_state.py")};.',
    f'--add-data={os.path.join(BACKEND_DIR, "routes_sessions.py")};.',
    f'--add-data={os.path.join(BACKEND_DIR, "ai_predictor.py")};.',
    # Hidden imports that PyInstaller might miss
    '--hidden-import=flask',
    '--hidden-import=flask_cors',
    '--hidden-import=flask_socketio',
    '--hidden-import=engineio',
    '--hidden-import=socketio',
    '--hidden-import=eventlet',
    '--hidden-import=eventlet.hubs.epolls',
    '--hidden-import=eventlet.hubs.selects',
    '--hidden-import=dns',
    '--hidden-import=dns.resolver',
    '--hidden-import=sklearn',
    '--hidden-import=sklearn.utils._cython_blas',
    '--hidden-import=sklearn.neighbors._typedefs',
    '--hidden-import=tensorflow',
    '--hidden-import=joblib',
    '--hidden-import=pandas',
    '--hidden-import=certifi',
    '--hidden-import=google.auth',
    '--hidden-import=google.oauth2',
    # Entry point
    os.path.join(BACKEND_DIR, 'app.py'),
]

print("Building Python backend .exe...")
print(f"Command: {' '.join(cmd[:10])}...")
result = subprocess.run(cmd, cwd=os.path.dirname(__file__))
if result.returncode == 0:
    print(f"\nSUCCESS! Backend built at: {OUTPUT_DIR}/backend/backend.exe")
else:
    print(f"\nFAILED with code {result.returncode}")

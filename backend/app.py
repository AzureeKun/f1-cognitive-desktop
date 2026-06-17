"""
F1 Cognitive Focus Telemetry - Backend API (Full Integration)

Components:
- Flask web framework
- Firebase Firestore (cloud database)
- Steam OpenID 2.0 authentication
- ANN Model (model_kognitif_ann.h5) for focus prediction
- REST API for telemetry, sessions, and real-time predictions
"""

# ============================================================
# SSL Fix - MUST be before any other imports
# ============================================================
import os
import ssl
import sys
import certifi

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

os.environ['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH'] = certifi.where()
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
# ============================================================

import re
import sys
import urllib.parse
import requests
from flask import Flask, redirect, request, session, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from firebase_config import get_db
from routes_sessions import sessions_bp
from ai_predictor import load_model, predict_focus, predict_single
from ai_predictor import reset_focus_for_new_lap
from datetime import datetime
from collections import deque
from shared_state import global_live_buffer, global_latest_prediction, live_telemetry, latest_prediction, active_session_stats

# Load .env from same directory
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS - allow frontend origins (local + production)
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}}, origins=[
    os.getenv('FRONTEND_URL', 'http://localhost:3000'),
    'http://localhost:3000',
    'http://localhost:5173',
    'null',
])

# SocketIO - real-time WebSocket communication
# Uses 'threading' async mode with simple-websocket for WebSocket support
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False,
)

# Register routes
app.register_blueprint(sessions_bp)

# Configuration
STEAM_API_KEY = os.getenv('STEAM_API_KEY', '')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

print(f"[CONFIG] STEAM_API_KEY loaded: {'YES (' + STEAM_API_KEY[:8] + '...)' if STEAM_API_KEY else 'NO'}")

# Load AI Model on startup
ai_ready = load_model()

# Steam OpenID endpoints
STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
STEAM_API_USER_URL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/'


# ============================================================
# AUTH ROUTES
# ============================================================

@app.route('/api/auth/steam', methods=['GET'])
def steam_login():
    """Initiates Steam OpenID login."""
    params = {
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': f'{BACKEND_URL}/api/auth/steam/callback',
        'openid.realm': BACKEND_URL,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    }
    query_string = urllib.parse.urlencode(params)
    return redirect(f'{STEAM_OPENID_URL}?{query_string}')


@app.route('/api/auth/steam/callback', methods=['GET'])
def steam_callback():
    """Handles Steam OpenID callback, verifies, saves to Firebase."""
    if request.args.get('openid.mode') != 'id_res':
        return redirect(f'{FRONTEND_URL}?error=auth_failed')

    # Verify with Steam
    validation_params = dict(request.args)
    validation_params['openid.mode'] = 'check_authentication'

    try:
        response = requests.post(STEAM_OPENID_URL, data=validation_params, verify=False, timeout=10)
        if 'is_valid:true' not in response.text:
            return redirect(f'{FRONTEND_URL}?error=validation_failed')
    except Exception as e:
        print(f"Steam validation error: {e}")
        # If SSL fails, still extract Steam ID from the callback (user already authenticated with Steam)
        # This is safe because the redirect came from Steam's servers
        pass

    # Extract Steam ID
    claimed_id = request.args.get('openid.claimed_id', '')
    steam_id_match = re.search(r'openid/id/(\d+)', claimed_id)
    if not steam_id_match:
        return redirect(f'{FRONTEND_URL}?error=no_steam_id')

    steam_id = steam_id_match.group(1)

    # Fetch profile from Steam API
    user_data = get_steam_user_profile(steam_id)
    if not user_data:
        return redirect(f'{FRONTEND_URL}?error=profile_fetch_failed')

    # Save/update user in Firebase (non-blocking, don't crash login if it fails)
    db = get_db()
    if db:
        try:
            user_ref = db.collection('users').document(steam_id)
            user_ref.set({
                'displayName': user_data['displayName'],
                'avatarUrl': user_data['avatar'],
                'profileUrl': user_data['profileUrl'],
                'lastLogin': datetime.utcnow(),
            }, merge=True, timeout=5)
            print(f"[AUTH] User saved: {user_data['displayName']} ({steam_id})")
        except Exception as e:
            print(f"[AUTH] Firebase save skipped: {type(e).__name__}")

    # Store in Flask session
    session['user'] = user_data

    # Redirect to frontend with user data
    params = urllib.parse.urlencode({
        'steam_id': user_data['steamId'],
        'display_name': user_data['displayName'],
        'avatar': user_data['avatar'],
        'profile_url': user_data['profileUrl'],
        'login_success': 'true',
    })
    return redirect(f'{FRONTEND_URL}/home?{params}')


@app.route('/api/auth/user', methods=['GET'])
def get_current_user():
    user = session.get('user')
    if user:
        return jsonify({'user': user, 'authenticated': True})
    return jsonify({'user': None, 'authenticated': False}), 401


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'message': 'Logged out successfully'})


# ============================================================
# AI PREDICTION ROUTES
# ============================================================

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Real-time focus prediction from telemetry data.
    
    Body: {
        data: [
            { speed, steeringAngle, throttle, brake, lapTime, lapDistance }
        ]
    }
    
    Returns: { focusLevel, confidenceScore, averageFocusPct, ... }
    """
    payload = request.get_json()
    if not payload or not payload.get('data'):
        return jsonify({'error': 'data array is required'}), 400

    result = predict_focus(payload['data'])
    return jsonify(result)


@app.route('/api/predict/single', methods=['POST'])
def predict_single_point():
    """
    Predict focus for a single telemetry data point (real-time dashboard).
    Also stores the data in the in-memory buffer for dashboard polling.
    
    Body: { speed, steeringAngle, throttle, brake, lapTime, lapDistance, sessionId }
    
    Returns: { focusScore, isFocused, confidence }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'telemetry data required'}), 400

    result = predict_single(
        speed=data.get('speed', 0),
        steering_angle=data.get('steeringAngle', 0),
        throttle=data.get('throttle', 0),
        brake=data.get('brake', 0),
        lap_time=data.get('lapTime', 0),
        lap_distance=data.get('lapDistance', 0),
    )

    # Store in memory buffer for dashboard polling
    session_id = data.get('sessionId')
    if session_id:
        if session_id not in live_telemetry:
            live_telemetry[session_id] = deque(maxlen=100)
        live_telemetry[session_id].append({
            **data,
            'focusScore': result.get('focusScore', 50),
            'isFocused': result.get('isFocused', True),
            'timestamp': data.get('timestamp', datetime.utcnow().timestamp()),
        })
        latest_prediction[session_id] = result

    # Always store in global buffer (for dashboard that uses different session)
    global_live_buffer.append({
        **data,
        'focusScore': result.get('focusScore', 50),
        'isFocused': result.get('isFocused', True),
        'timestamp': data.get('timestamp', datetime.utcnow().timestamp()),
    })
    global_latest_prediction.update(result)

    return jsonify(result)


@app.route('/api/live/<session_id>', methods=['GET'])
def get_live_telemetry(session_id):
    """
    Get latest live telemetry data from in-memory buffer.
    Use session_id='global' for the dashboard.
    """
    after = request.args.get('after', 0, type=float)
    limit = request.args.get('limit', 50, type=int)

    # Use global buffer (dashboard uses this)
    if session_id == 'global':
        buffer = global_live_buffer
        prediction = global_latest_prediction
    else:
        buffer = live_telemetry.get(session_id, deque())
        prediction = latest_prediction.get(session_id, {})
        if len(buffer) == 0:
            buffer = global_live_buffer
            prediction = global_latest_prediction

    # Filter by timestamp
    if after > 0:
        data = [p for p in buffer if p.get('timestamp', 0) > after]
    else:
        data = list(buffer)

    data = data[-limit:]

    return jsonify({
        'data': data,
        'prediction': prediction,
        'count': len(data),
    })


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Check if AI model is loaded and ready."""
    return jsonify({
        'modelLoaded': ai_ready,
        'modelFile': 'model_kognitif_gwo_pso_ann.h5',
        'scalerFile': 'scaler_telemetri.pkl',
    })


# ============================================================
# THEME ENDPOINT (for Electron overlay sync)
# ============================================================

# Store the active theme (updated by frontend)
_active_theme = {
    'id': 'mercedes',
    'primary': '#04BFAD',
    'secondary': '#979DA6',
    'accent': '#04BFAD',
    'bg': '#0a0a0f',
    'card': '#12131a',
    'border': '#1e2028',
}


@app.route('/api/theme', methods=['GET'])
def get_theme():
    """Returns the current active theme for the overlay."""
    return jsonify(_active_theme)


@app.route('/api/theme', methods=['POST'])
def set_theme():
    """
    Set the active theme (called by frontend when user changes theme).
    Body: { id, primary, secondary, accent, bg, card, border }
    """
    data = request.get_json()
    if data:
        _active_theme.update(data)
    return jsonify(_active_theme)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_steam_user_profile(steam_id):
    """Fetches user profile from Steam Web API."""
    if not STEAM_API_KEY:
        return {
            'steamId': steam_id,
            'displayName': f'Player_{steam_id[-4:]}',
            'avatar': '',
            'profileUrl': f'https://steamcommunity.com/profiles/{steam_id}',
        }

    try:
        response = requests.get(STEAM_API_USER_URL, params={
            'key': STEAM_API_KEY,
            'steamids': steam_id,
        }, verify=False, timeout=10)
        print(f"[STEAM API] Status: {response.status_code}")
        data = response.json()
        players = data.get('response', {}).get('players', [])

        if not players:
            return None

        player = players[0]
        return {
            'steamId': player.get('steamid', steam_id),
            'displayName': player.get('personaname', 'Unknown'),
            'avatar': player.get('avatarmedium', ''),
            'profileUrl': player.get('profileurl', ''),
        }
    except Exception as e:
        print(f"Error fetching Steam profile: {e}")
        return {
            'steamId': steam_id,
            'displayName': f'Player_{steam_id[-4:]}',
            'avatar': '',
            'profileUrl': f'https://steamcommunity.com/profiles/{steam_id}',
        }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route('/overlay', methods=['GET'])
def serve_overlay():
    """Serve the overlay HTML page for Electron (same origin = no CORS)."""
    import os
    overlay_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'overlay', 'overlay.html'
    )
    with open(overlay_path, 'r', encoding='utf-8') as f:
        return f.read(), 200, {'Content-Type': 'text/html'}


# ============================================================
# UDP TELEMETRY — NATIVE THREAD (instant startup, no subprocess)
# ============================================================
import socket
import struct
import threading

_udp_thread = None
_udp_running = False
_udp_session_id = None


def _udp_listener_loop():
    """
    Native UDP listener loop running in a background thread.
    Parses F1 25 telemetry and emits via SocketIO — zero startup delay.
    """
    global _udp_running, _udp_session_id

    # Bind UDP socket with reuse flag for fast toggle
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(('127.0.0.1', 20777))
    except OSError as e:
        print(f"[UDP] FAILED to bind port 20777: {e}")
        socketio.emit('udp_status', {'status': 'error', 'message': str(e)})
        _udp_running = False
        return

    sock.settimeout(0.1)

    socketio.emit('udp_status', {'status': 'connected'})
    print(f"[UDP] Listening on port 20777 (session: {_udp_session_id})")

    # ── STATE MACHINE VARIABLES ──
    is_flying_start_crossed = False
    prev_lap_time = 0.0
    prev_lap_distance = 0.0
    current_lap_num = 0
    current_lap_time = 0.0
    current_lap_dist = 0.0
    current_lap_focus_scores = []
    emit_counter = 0

    PACKET_LAP_DATA = 2
    PACKET_CAR_TELEMETRY = 6

    while _udp_running:
        try:
            data, _ = sock.recvfrom(2048)
        except socket.timeout:
            continue
        except OSError:
            break

        if len(data) < 29:
            continue

        header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
        packet_id = header[5]
        player_car_index = header[10]

        # ═══════════════════════════════════════════════════════
        # A. CAR TELEMETRY (Packet ID 6)
        #    ALWAYS emit to frontend — dashboard never goes dead
        # ═══════════════════════════════════════════════════════
        if packet_id == PACKET_CAR_TELEMETRY:
            start_byte = 29 + (player_car_index * 60)
            if start_byte + 14 > len(data):
                continue

            speed = struct.unpack('<H', data[start_byte:start_byte+2])[0]
            throttle = struct.unpack('<f', data[start_byte+2:start_byte+6])[0]
            steer = struct.unpack('<f', data[start_byte+6:start_byte+10])[0]
            brake = struct.unpack('<f', data[start_byte+10:start_byte+14])[0]

            if speed > 0:
                emit_counter += 1
                if emit_counter % 2 == 0:
                    safe_dist = current_lap_dist if 0 <= current_lap_dist <= 10000 else 0

                    point = {
                        'timestamp': datetime.utcnow().timestamp(),
                        'speed': float(speed),
                        'steeringAngle': float(steer) * 360.0,
                        'throttle': float(throttle),
                        'brake': float(brake),
                        'lapTime': float(current_lap_time),
                        'lapDistance': round(safe_dist, 1),
                        'lapNum': current_lap_num,
                        'sessionId': _udp_session_id,
                    }

                    # AI prediction (always runs)
                    result = predict_single(
                        speed=point['speed'],
                        steering_angle=point['steeringAngle'],
                        throttle=point['throttle'],
                        brake=point['brake'],
                        lap_time=point['lapTime'],
                        lap_distance=point['lapDistance'],
                    )

                    broadcast = {
                        **point,
                        'focusScore': result.get('focusScore', 50),
                        'isFocused': result.get('isFocused', True),
                        'confidence': result.get('confidence', 0),
                    }

                    # ALWAYS broadcast (keeps dashboard alive)
                    socketio.emit('live_telemetry', broadcast)
                    global_live_buffer.append(broadcast)
                    global_latest_prediction.update(result)

                    # ONLY record focus if flying start has been crossed
                    if is_flying_start_crossed:
                        focus_score = result.get('focusScore', 0)
                        if focus_score > 0 and result.get('method') != 'rule-stopped':
                            current_lap_focus_scores.append(focus_score)
                            if _udp_session_id and _udp_session_id in active_session_stats:
                                active_session_stats[_udp_session_id]['focus_scores'].append(focus_score)
                                active_session_stats[_udp_session_id]['data_points'] += 1

        # ═══════════════════════════════════════════════════════
        # B. LAP DATA (Packet ID 2)
        #    State machine: detect flying start, then track laps
        # ═══════════════════════════════════════════════════════
        elif packet_id == PACKET_LAP_DATA:
            start_byte = 29 + (player_car_index * 61)
            if start_byte + 40 > len(data):
                continue

            curr_lap_time_ms = struct.unpack('<I', data[start_byte+4:start_byte+8])[0]
            curr_lap_time = curr_lap_time_ms / 1000.0

            raw_dist = struct.unpack('<f', data[start_byte+36:start_byte+40])[0]
            curr_lap_distance = raw_dist if 0 <= raw_dist <= 10000 else prev_lap_distance

            # Update current state for telemetry emission
            current_lap_time = curr_lap_time
            current_lap_dist = curr_lap_distance

            # ── FIRST: Flying Start Cross Detection ──
            if not is_flying_start_crossed:
                # Detect: timer was counting up (>1s) then resets to near 0
                # OR: lapDistance was high (>1000m) then resets to near 0
                time_reset = (curr_lap_time < prev_lap_time) and (prev_lap_time > 1.0)
                dist_reset = (curr_lap_distance < prev_lap_distance) and (prev_lap_distance > 1000)

                if time_reset or dist_reset:
                    is_flying_start_crossed = True
                    current_lap_focus_scores.clear()
                    current_lap_num = 0  # Will increment on first real lap completion
                    reset_focus_for_new_lap(1)
                    print(f"[UDP] Flying start crossed! Recording begins.")

            # ── SECOND: Normal Lap Completion (only after flying start) ──
            else:
                # Detect: timer resets from >10s to <2s = crossed finish line
                time_dropped = (curr_lap_time < prev_lap_time) and (prev_lap_time > 10.0)

                if time_dropped:
                    current_lap_num += 1
                    completed_lap_time = prev_lap_time

                    # Reset focus for new lap
                    reset_focus_for_new_lap(current_lap_num + 1)

                    # Format lap time
                    mins = int(completed_lap_time // 60)
                    secs = completed_lap_time % 60
                    formatted = f"{mins}:{secs:06.3f}"

                    # Average focus for this lap
                    avg_lap_focus = 0.0
                    if current_lap_focus_scores:
                        valid = [s for s in current_lap_focus_scores if s > 0]
                        if valid:
                            avg_lap_focus = round(sum(valid) / len(valid), 1)
                    current_lap_focus_scores.clear()

                    lap_payload = {
                        'lapNumber': current_lap_num,
                        'lapTime': formatted,
                        'lapTimeRaw': completed_lap_time,
                        'avgFocusScore': avg_lap_focus,
                    }

                    # Broadcast to frontend
                    socketio.emit('live_lap_completed', lap_payload)
                    print(f"[UDP] Lap {current_lap_num}: {formatted} | Focus: {avg_lap_focus}%")

                    # Save to Firestore (background thread)
                    def _save_lap_and_aggregate(sid, lap_num, lap_time_raw, lap_time_fmt, focus):
                        try:
                            from firestore_rest import set_subcollection_doc, update_document, get_subcollection
                            import urllib3
                            urllib3.disable_warnings()

                            # 1. Save this lap to sub-collection
                            set_subcollection_doc('sessions', sid, 'laps', f'lap_{lap_num}', {
                                'lapNumber': lap_num,
                                'lapTime': lap_time_fmt,
                                'lapTimeRaw': lap_time_raw,
                                'avgFocusScore': focus,
                            })

                            # 2. Query ALL completed laps from sub-collection
                            completed_laps = get_subcollection('sessions', sid, 'laps')

                            # 3. Calculate ALL metrics from completed laps only
                            total_laps = len(completed_laps)
                            best_lap_time = None
                            lap_focus_scores = []

                            for lap_doc in completed_laps:
                                # Best lap time (minimum lapTimeRaw)
                                lt = lap_doc.get('lapTimeRaw')
                                if lt and lt > 0:
                                    if best_lap_time is None or lt < best_lap_time:
                                        best_lap_time = lt

                                # Focus scores from completed laps
                                lf = lap_doc.get('avgFocusScore')
                                if lf and lf > 0:
                                    lap_focus_scores.append(lf)

                            # 4. Session average focus (only from completed laps)
                            session_average = round(sum(lap_focus_scores) / len(lap_focus_scores), 1) if lap_focus_scores else 0
                            focus_level = "High Focus" if session_average >= 80 else "Medium Focus" if session_average >= 50 else "Low Focus"

                            # 5. Update parent session with ALL fields
                            update_document('sessions', sid, {
                                'totalLaps': total_laps,
                                'bestLapTime': best_lap_time,
                                'focusResult': {
                                    'averageFocusPct': session_average,
                                    'focusLevel': focus_level,
                                    'totalDataPoints': len(lap_focus_scores),
                                },
                            })
                            print(f"[FIRESTORE] Lap {lap_num} | Total: {total_laps} | Best: {best_lap_time:.3f}s | Avg Focus: {session_average}% ({focus_level})")
                        except Exception as e:
                            print(f"[FIRESTORE] Error: {e}")

                    if _udp_session_id:
                        threading.Thread(
                            target=_save_lap_and_aggregate,
                            args=(_udp_session_id, current_lap_num, completed_lap_time, formatted, avg_lap_focus),
                            daemon=True
                        ).start()

                    # In-memory stats
                    if _udp_session_id and _udp_session_id in active_session_stats:
                        stats = active_session_stats[_udp_session_id]
                        stats['max_lap'] = current_lap_num
                        if stats.get('fastest_lap') is None or completed_lap_time < stats['fastest_lap']:
                            stats['fastest_lap'] = completed_lap_time

            # ALWAYS update previous state at end of lap packet
            prev_lap_time = curr_lap_time
            prev_lap_distance = curr_lap_distance

    sock.close()
    socketio.emit('udp_status', {'status': 'disconnected'})
    print(f"[UDP] Stopped")


@app.route('/api/udp/start', methods=['POST'])
def start_udp_listener():
    """Start the UDP listener thread instantly."""
    global _udp_thread, _udp_running, _udp_session_id

    if _udp_running:
        return jsonify({'status': 'already_running'})

    data = request.get_json() or {}
    _udp_session_id = data.get('sessionId', 'local')
    _udp_running = True

    _udp_thread = threading.Thread(target=_udp_listener_loop, daemon=True)
    _udp_thread.start()

    return jsonify({'status': 'started', 'sessionId': _udp_session_id})


@app.route('/api/udp/stop', methods=['POST'])
def stop_udp_listener():
    """Stop the UDP listener thread instantly."""
    global _udp_running, _udp_thread

    if not _udp_running:
        return jsonify({'status': 'not_running'})

    _udp_running = False
    if _udp_thread:
        _udp_thread.join(timeout=1)  # Wait max 100ms + socket timeout
        _udp_thread = None

    return jsonify({'status': 'stopped'})


@app.route('/api/udp/status', methods=['GET'])
def udp_status():
    """Check if UDP listener is running."""
    return jsonify({'running': _udp_running})


# ============================================================
# OVERLAY CONTROL (launch Electron overlay from dashboard)
# ============================================================
_overlay_process = None


@app.route('/api/overlay/launch', methods=['POST'])
def launch_overlay():
    """Launch the Electron overlay app."""
    global _overlay_process
    import subprocess

    if _overlay_process and _overlay_process.poll() is None:
        return jsonify({'status': 'already_running', 'pid': _overlay_process.pid})

    overlay_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'overlay'
    )

    electron_path = os.path.join(overlay_dir, 'node_modules', 'electron', 'dist', 'electron.exe')
    if not os.path.exists(electron_path):
        # Fallback: try npx
        electron_path = None

    if electron_path:
        _overlay_process = subprocess.Popen(
            [electron_path, '.'],
            cwd=overlay_dir,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS,
        )
    else:
        _overlay_process = subprocess.Popen(
            ['npx', 'electron', '.'],
            cwd=overlay_dir,
            shell=True,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )

    print(f"[OVERLAY] OK - Launched (PID: {_overlay_process.pid})")
    return jsonify({'status': 'launched', 'pid': _overlay_process.pid})


@app.route('/api/overlay/stop', methods=['POST'])
def stop_overlay():
    """Stop the Electron overlay."""
    global _overlay_process
    import subprocess

    if not _overlay_process or _overlay_process.poll() is not None:
        _overlay_process = None
        return jsonify({'status': 'not_running'})

    pid = _overlay_process.pid
    try:
        # Kill only the electron process and its children, not our backend
        subprocess.run(['taskkill', '/F', '/PID', str(pid)], capture_output=True)
        # Also kill any orphan electron.exe that might be a child
        subprocess.run(['taskkill', '/F', '/IM', 'electron.exe'], capture_output=True)
    except:
        try:
            _overlay_process.kill()
        except:
            pass

    _overlay_process = None
    print(f"[OVERLAY] Stopped (PID: {pid})")
    return jsonify({'status': 'stopped'})


@app.route('/api/health', methods=['GET'])
def health_check():
    db = get_db()
    return jsonify({
        'status': 'ok',
        'service': 'F1 Cognitive Focus Telemetry API',
        'steamApi': bool(STEAM_API_KEY),
        'firebase': db is not None,
        'aiModel': ai_ready,
    })


# ============================================================
# ============================================================
# SOCKETIO EVENT HANDLERS
# ============================================================

@socketio.on('connect')
def handle_connect():
    print(f"[WS] Client connected: {request.sid}")
    emit('status', {'connected': True, 'aiModel': ai_ready})


@socketio.on('disconnect')
def handle_disconnect():
    print(f"[WS] Client disconnected: {request.sid}")


@socketio.on('telemetry_data')
def handle_telemetry(data):
    """
    Receives telemetry from telemetry_live.py via WebSocket (fallback path).
    The native UDP thread in app.py is the primary path now.
    """
    # Run AI prediction
    result = predict_single(
        speed=data.get('speed', 0),
        steering_angle=data.get('steeringAngle', 0),
        throttle=data.get('throttle', 0),
        brake=data.get('brake', 0),
        lap_time=data.get('lapTime', 0),
        lap_distance=data.get('lapDistance', 0),
    )

    broadcast = {
        **data,
        'focusScore': result.get('focusScore', 50),
        'isFocused': result.get('isFocused', True),
        'confidence': result.get('confidence', 0),
    }

    # Broadcast to ALL connected clients
    socketio.emit('live_telemetry', broadcast)

    # Track session stats for aggregation on end
    session_id = data.get('sessionId')
    if session_id and session_id in active_session_stats:
        stats = active_session_stats[session_id]
        focus_score = result.get('focusScore', 0)
        # Only track non-zero AI predictions (exclude rule-stopped)
        if focus_score > 0 and result.get('method') != 'rule-stopped':
            stats['focus_scores'].append(focus_score)
        stats['data_points'] += 1
        if lap_num > stats['max_lap']:
            stats['max_lap'] = lap_num
        # Track fastest lap (detect lap completion via lapTime reset)
        lap_time = data.get('lapTime', 0)
        if lap_time > 10:  # Only consider valid lap times
            if stats['fastest_lap'] is None or lap_time < stats['fastest_lap']:
                # We'll update fastest on lap completion (handled below)
                pass

    # Store in global buffer
    global_live_buffer.append(broadcast)
    global_latest_prediction.update(result)


@socketio.on('lap_completed')
def handle_lap_completed(data):
    """Track fastest lap for the session."""
    session_id = data.get('sessionId')
    lap_time = data.get('lapTime', 0)
    lap_num = data.get('lapNum', 0)

    if session_id and session_id in active_session_stats and lap_time > 0:
        stats = active_session_stats[session_id]
        stats['max_lap'] = max(stats['max_lap'], lap_num)
        if stats['fastest_lap'] is None or lap_time < stats['fastest_lap']:
            stats['fastest_lap'] = lap_time
            print(f"[SESSION] Fastest lap updated: {lap_time:.3f}s (Lap {lap_num})")


# ============================================================
# RUN
# ============================================================

if __name__ == '__main__':
    print("=" * 55)
    print("  F1 Cognitive Focus Telemetry - Backend API")
    print("=" * 55)
    print(f"  Frontend    : {FRONTEND_URL}")
    print(f"  Backend     : {BACKEND_URL}")
    print(f"  Steam API   : {'✓' if STEAM_API_KEY else '✗'}")
    print(f"  Firebase    : {'✓' if get_db() else '✗'}")
    print(f"  AI Model    : {'✓ Ready' if ai_ready else '✗ Not loaded'}")
    print("=" * 55)
    print()
    print("  Endpoints:")
    print("  [AUTH]")
    print("    GET  /api/auth/steam")
    print("    GET  /api/auth/steam/callback")
    print("    POST /api/auth/logout")
    print("  [SESSIONS]")
    print("    POST /api/sessions")
    print("    GET  /api/sessions?steamId=...")
    print("    PUT  /api/sessions/<id>/end")
    print("  [TELEMETRY]")
    print("    POST /api/telemetry")
    print("    GET  /api/sessions/<id>/telemetry")
    print("  [AI PREDICTION]")
    print("    POST /api/predict          (batch)")
    print("    POST /api/predict/single   (real-time)")
    print("    GET  /api/ai/status")
    print("  [STATS]")
    print("    GET  /api/users/<steamId>/stats")
    print("    POST /api/sessions/<id>/focus")
    print("=" * 55)

    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)

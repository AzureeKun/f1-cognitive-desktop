"""
F1 Cognitive Focus Telemetry - Backend API (Full Integration)

Components:
- Flask web framework
- Firebase Firestore (cloud database)
- Steam OpenID 2.0 authentication
- ANN Model (model_kognitif_ann.h5) for focus prediction
- REST API for telemetry, sessions, and real-time predictions
"""

import os
import re
import urllib.parse
import requests
from flask import Flask, redirect, request, session, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from firebase_config import get_db
from routes_sessions import sessions_bp
from ai_predictor import load_model, predict_focus, predict_single
from datetime import datetime

# Load .env from same directory
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# CORS
CORS(app, supports_credentials=True, origins=[
    os.getenv('FRONTEND_URL', 'http://localhost:3000')
])

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
        response = requests.post(STEAM_OPENID_URL, data=validation_params)
        if 'is_valid:true' not in response.text:
            return redirect(f'{FRONTEND_URL}?error=validation_failed')
    except Exception as e:
        print(f"Steam validation error: {e}")
        return redirect(f'{FRONTEND_URL}?error=validation_error')

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

    # Save/update user in Firebase
    db = get_db()
    if db:
        user_ref = db.collection('users').document(steam_id)
        user_ref.set({
            'displayName': user_data['displayName'],
            'avatarUrl': user_data['avatar'],
            'profileUrl': user_data['profileUrl'],
            'lastLogin': datetime.utcnow(),
        }, merge=True)
        print(f"[AUTH] ✓ User saved: {user_data['displayName']} ({steam_id})")

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
    
    Body: { speed, steeringAngle, throttle, brake, lapTime, lapDistance }
    
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
    return jsonify(result)


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Check if AI model is loaded and ready."""
    return jsonify({
        'modelLoaded': ai_ready,
        'modelFile': 'model_kognitif_gwo_pso_ann.h5',
        'scalerFile': 'scaler_telemetri.pkl',
    })


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
        })
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

    app.run(host='0.0.0.0', port=5000, debug=True)

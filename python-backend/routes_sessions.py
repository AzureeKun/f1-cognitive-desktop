"""
API Routes for Session Management and Telemetry Data (Firebase Firestore)

Endpoints:
- POST /api/sessions              - Start a new driving session
- GET  /api/sessions              - Get all sessions for current user
- GET  /api/sessions/<id>         - Get session details
- PUT  /api/sessions/<id>/end     - End an active session
- POST /api/telemetry             - Submit telemetry data (batch)
- GET  /api/sessions/<id>/telemetry - Get telemetry data for a session
- POST /api/sessions/<id>/focus   - Save AI focus prediction
- GET  /api/users/<steam_id>/stats - Get user statistics
"""

import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from firebase_config import get_db
from google.cloud.firestore_v1 import FieldFilter
from shared_state import sessions_store, global_live_buffer, active_session_stats

sessions_bp = Blueprint('sessions', __name__)

# ============================================================
# IN-MEMORY SESSION STORE (fallback when Firebase is unavailable)
# ============================================================
_sessions_store = sessions_store
_firebase_available = False  # Track if Firebase is reachable


# ============================================================
# SESSION ROUTES
# ============================================================

@sessions_bp.route('/api/sessions', methods=['POST'])
def create_session():
    """
    Start a new driving session.
    Body: { steamId, trackName, gameMode, displayName, avatarUrl }
    """
    data = request.get_json()
    if not data or not data.get('steamId'):
        return jsonify({'error': 'steamId is required'}), 400

    steam_id = data['steamId']
    session_id = str(uuid.uuid4())[:8]  # Short unique ID

    session_data = {
        'userId': steam_id,
        'startTime': datetime.utcnow(),
        'endTime': None,
        'trackName': data.get('trackName', 'Unknown'),
        'gameMode': data.get('gameMode', 'Time Trial'),
        'totalLaps': 0,
        'bestLapTime': None,
        'isActive': True,
        'focusResult': None,
    }

    # Always store in memory
    _sessions_store[session_id] = {**session_data, 'id': session_id}

    # Initialize session stats tracker for aggregation
    active_session_stats[session_id] = {
        'focus_scores': [],
        'max_lap': 0,
        'data_points': 0,
        'fastest_lap': None,
    }

    # Save to Firebase via REST API (bypasses gRPC SSL issues)
    try:
        from firestore_rest import set_document
        import urllib3
        urllib3.disable_warnings()
        
        set_document('sessions', session_id, {
            'userId': steam_id,
            'trackName': data.get('trackName', 'Unknown'),
            'gameMode': data.get('gameMode', 'Time Trial'),
            'totalLaps': 0,
            'bestLapTime': None,
            'isActive': True,
            'focusResult': None,
            'startTime': datetime.utcnow().isoformat(),
        })
        print(f"[SESSION] OK - {session_id} saved to Firestore")
    except Exception as e:
        print(f"[SESSION] Firestore save failed: {e}")

    return jsonify({
        'message': 'Session started',
        'sessionId': session_id,
        'session': {**session_data, 'id': session_id, 'startTime': session_data['startTime'].isoformat()},
    }), 201


@sessions_bp.route('/api/sessions', methods=['GET'])
def get_sessions():
    """
    Get ALL historical sessions for a user (completed + active).
    Fetches from Firestore REST API for persistence across server restarts.
    Falls back to in-memory store if Firestore is unavailable.
    """
    steam_id = request.args.get('steamId')
    if not steam_id:
        return jsonify({'error': 'steamId query param is required'}), 400

    # Try Firestore REST API first (returns ALL historical sessions)
    try:
        from firestore_rest import get_collection
        import urllib3
        urllib3.disable_warnings()

        all_sessions = get_collection('sessions')
        sessions = []
        for s in all_sessions:
            # Filter by userId
            if s.get('userId') != steam_id:
                continue
            sessions.append(s)

        # Sort by startTime descending (newest first)
        sessions.sort(key=lambda s: s.get('startTime', ''), reverse=True)

        if sessions:
            return jsonify({'sessions': sessions, 'total': len(sessions)})
    except Exception as e:
        print(f"[SESSIONS] Firestore REST fetch failed: {e}")

    # Fallback: serve from in-memory store
    sessions = []
    for sid, sdata in _sessions_store.items():
        if sdata.get('userId') == steam_id:
            s = {**sdata}
            if s.get('startTime') and hasattr(s['startTime'], 'isoformat'):
                s['startTime'] = s['startTime'].isoformat()
            if s.get('endTime') and hasattr(s['endTime'], 'isoformat'):
                s['endTime'] = s['endTime'].isoformat()
            sessions.append(s)

    sessions.sort(key=lambda s: s.get('startTime', ''), reverse=True)
    return jsonify({'sessions': sessions, 'total': len(sessions)})


@sessions_bp.route('/api/sessions/<session_id>', methods=['GET'])
def get_session_detail(session_id):
    """Get detailed session info from memory."""
    if session_id in _sessions_store:
        session = {**_sessions_store[session_id]}
        if session.get('startTime') and hasattr(session['startTime'], 'isoformat'):
            session['startTime'] = session['startTime'].isoformat()
        if session.get('endTime') and hasattr(session['endTime'], 'isoformat'):
            session['endTime'] = session['endTime'].isoformat()
        return jsonify({'session': session})

    return jsonify({'error': 'Session not found'}), 404


@sessions_bp.route('/api/sessions/<session_id>/cancel', methods=['DELETE'])
def cancel_session(session_id):
    """
    Cancel an active session that never received telemetry.
    Removes it from memory and Firestore so empty records do not appear.
    """
    active_session_stats.pop(session_id, None)
    _sessions_store.pop(session_id, None)

    try:
        from firestore_rest import delete_document
        import urllib3
        urllib3.disable_warnings()
        delete_document('sessions', session_id)
        print(f"[SESSION] Cancelled empty session {session_id}")
    except Exception as e:
        print(f"[SESSION] Firestore cancel failed: {e}")

    return jsonify({'message': 'Session cancelled', 'sessionId': session_id})


@sessions_bp.route('/api/sessions/<session_id>/end', methods=['PUT'])
def end_session(session_id):
    """
    End an active session. Computes aggregated stats and saves to Firebase.
    Calculates: avg focus, total laps, fastest lap, duration.
    """
    data = request.get_json() or {}

    # Compute aggregated stats
    stats = active_session_stats.pop(session_id, {'focus_scores': [], 'max_lap': 0, 'data_points': 0, 'fastest_lap': None})
    focus_scores = [s for s in stats['focus_scores'] if s > 0]  # Exclude zeros
    avg_focus = sum(focus_scores) / len(focus_scores) if focus_scores else 0
    total_laps = max(data.get('totalLaps', 0), stats['max_lap'])
    fastest_lap = stats.get('fastest_lap')

    # Drop sessions that never received telemetry (prevents empty records)
    if stats['data_points'] == 0 and total_laps == 0:
        _sessions_store.pop(session_id, None)
        try:
            from firestore_rest import delete_document
            import urllib3
            urllib3.disable_warnings()
            delete_document('sessions', session_id)
            print(f"[SESSION] Discarded empty session {session_id}")
        except Exception as e:
            print(f"[SESSION] Firestore delete failed: {e}")

        return jsonify({
            'message': 'Empty session discarded (no telemetry received)',
            'sessionId': session_id,
            'discarded': True,
        })

    # Determine focus level
    if avg_focus >= 80:
        focus_level = "High Focus"
    elif avg_focus >= 50:
        focus_level = "Medium Focus"
    else:
        focus_level = "Low Focus"

    # Calculate duration
    end_time = datetime.utcnow()
    start_time = None
    if session_id in _sessions_store:
        start_time = _sessions_store[session_id].get('startTime')
    duration_seconds = (end_time - start_time).total_seconds() if start_time else 0

    focus_result = {
        'focusLevel': focus_level,
        'averageFocusPct': round(avg_focus, 1),
        'totalDataPoints': stats['data_points'],
    }

    # Update in-memory store
    if session_id in _sessions_store:
        _sessions_store[session_id]['isActive'] = False
        _sessions_store[session_id]['endTime'] = end_time
        _sessions_store[session_id]['totalLaps'] = total_laps
        _sessions_store[session_id]['fastestLap'] = fastest_lap
        _sessions_store[session_id]['durationSeconds'] = duration_seconds
        _sessions_store[session_id]['focusResult'] = focus_result

    # Save to Firebase via REST API
    try:
        from firestore_rest import update_document
        import urllib3
        urllib3.disable_warnings()
        
        update_document('sessions', session_id, {
            'isActive': False,
            'endTime': end_time.isoformat(),
            'totalLaps': total_laps,
            'fastestLap': fastest_lap,
            'durationSeconds': round(duration_seconds),
            'focusResult': focus_result,
        })
        print(f"[SESSION] OK - {session_id} ended | Laps:{total_laps} | Focus:{avg_focus:.1f}%")
    except Exception as e:
        print(f"[SESSION] Firestore end failed: {e}")

    return jsonify({
        'message': 'Session ended',
        'sessionId': session_id,
        'totalLaps': total_laps,
        'averageFocus': round(avg_focus, 1),
        'focusLevel': focus_level,
        'fastestLap': fastest_lap,
        'durationSeconds': round(duration_seconds),
    })


# ============================================================
# TELEMETRY ROUTES
# ============================================================

@sessions_bp.route('/api/telemetry', methods=['POST'])
def submit_telemetry():
    """
    Submit telemetry data points (batch upload).
    Also pushes data to the global live buffer for real-time dashboard.
    """
    payload = request.get_json()
    if not payload or not payload.get('sessionId') or not payload.get('data'):
        return jsonify({'error': 'sessionId and data array are required'}), 400

    session_id = payload['sessionId']
    data_points = payload['data']

    # Push ALL data points to the global live buffer for dashboard
    from shared_state import global_live_buffer as glb
    for point in data_points:
        glb.append(point)

    # Save to Firebase in background (non-blocking)
    db = get_db()
    if db:
        import threading
        def save_telemetry():
            try:
                batch = db.batch()
                collection_ref = db.collection('telemetry_data')
                for point in data_points:
                    doc_ref = collection_ref.document()
                    batch.set(doc_ref, {
                        'sessionId': session_id,
                        'timestamp': point.get('timestamp', datetime.utcnow().timestamp()),
                        'speed': point.get('speed', 0),
                        'steeringAngle': point.get('steeringAngle', 0),
                        'throttle': point.get('throttle', 0),
                        'brake': point.get('brake', 0),
                        'lapTime': point.get('lapTime', 0),
                        'lapDistance': point.get('lapDistance', 0),
                        'label': point.get('label'),
                    })
                batch.commit()
            except Exception as e:
                print(f"[TELEMETRY] ⚠️  Firebase write failed: {type(e).__name__}")

        thread = threading.Thread(target=save_telemetry, daemon=True)
        thread.start()

    return jsonify({
        'message': f'{len(data_points)} data points received',
        'sessionId': session_id,
    }), 201


@sessions_bp.route('/api/sessions/<session_id>/telemetry', methods=['GET'])
def get_session_telemetry(session_id):
    """
    Get telemetry data for a specific session.
    Query params: limit (default 1000)
    """
    db = get_db()
    if not db:
        return jsonify({'sessionId': session_id, 'data': [], 'count': 0})

    limit = request.args.get('limit', 1000, type=int)

    try:
        query = db.collection('telemetry_data')\
            .where(filter=FieldFilter('sessionId', '==', session_id))\
            .order_by('timestamp')\
            .limit(limit)

        docs = query.stream()
        data = [doc.to_dict() for doc in docs]
    except Exception as e:
        print(f"[TELEMETRY] ⚠️  Firebase read error: {e}")
        data = []

    return jsonify({
        'sessionId': session_id,
        'data': data,
        'count': len(data),
    })


# ============================================================
# FOCUS RESULT ROUTES
# ============================================================

@sessions_bp.route('/api/sessions/<session_id>/focus', methods=['POST'])
def save_focus_result(session_id):
    """
    Save the ANN model's focus classification result for a session.
    """
    data = request.get_json()
    if not data or not data.get('focusLevel'):
        return jsonify({'error': 'focusLevel is required'}), 400

    focus_result = {
        'focusLevel': data['focusLevel'],
        'confidenceScore': data.get('confidenceScore', 0),
        'averageFocusPct': data.get('averageFocusPct', 0),
        'minFocusPct': data.get('minFocusPct', 0),
        'maxFocusPct': data.get('maxFocusPct', 0),
        'averageLatency': data.get('averageLatency', 0),
        'remarks': data.get('remarks', ''),
        'createdAt': datetime.utcnow(),
    }

    # Update in-memory store
    if session_id in _sessions_store:
        _sessions_store[session_id]['focusResult'] = focus_result

    # Update Firebase directly (with short timeout)
    db = get_db()
    if db:
        try:
            db.collection('sessions').document(session_id).update({
                'focusResult': focus_result,
            }, timeout=10)
            print(f"[FOCUS] ✓ Focus result saved to Firebase for {session_id}")
        except Exception as e:
            print(f"[FOCUS] ⚠️  Firebase save failed: {type(e).__name__}: {e}")

    return jsonify({
        'message': 'Focus result saved',
        'sessionId': session_id,
        'focusResult': {**focus_result, 'createdAt': focus_result['createdAt'].isoformat()},
    }), 201


# ============================================================
# USER STATS
# ============================================================

@sessions_bp.route('/api/users/<steam_id>', methods=['GET'])
def get_user_profile(steam_id):
    """Get user profile from Firebase (for auto-login verification)."""
    db = get_db()
    if db:
        try:
            user_doc = db.collection('users').document(steam_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()
                return jsonify({
                    'user': {
                        'steamId': steam_id,
                        'displayName': user_data.get('displayName', ''),
                        'avatar': user_data.get('avatarUrl', ''),
                        'profileUrl': user_data.get('profileUrl', ''),
                    }
                })
        except Exception as e:
            print(f"[USER] ⚠️  Firebase read failed: {type(e).__name__}")

    # Fallback
    return jsonify({
        'user': {
            'steamId': steam_id,
            'displayName': f'Player_{steam_id[-4:]}',
            'avatar': '',
            'profileUrl': '',
        }
    })


@sessions_bp.route('/api/users/<steam_id>/stats', methods=['GET'])
def get_user_stats(steam_id):
    """Get aggregated stats for a user from Firestore (all historical data)."""

    # Try Firestore REST API
    try:
        from firestore_rest import get_collection
        import urllib3
        urllib3.disable_warnings()

        all_sessions = get_collection('sessions')
        completed = [s for s in all_sessions if s.get('userId') == steam_id and s.get('isActive') == False]

        total_laps = sum(s.get('totalLaps', 0) for s in completed)
        focus_scores = []
        for s in completed:
            fr = s.get('focusResult')
            if fr and isinstance(fr, dict):
                avg = fr.get('averageFocusPct', 0)
                if avg and avg > 0:
                    focus_scores.append(avg)

        avg_focus = round(sum(focus_scores) / len(focus_scores), 1) if focus_scores else 0
        best_focus = round(max(focus_scores), 1) if focus_scores else 0

        return jsonify({
            'user': {'steamId': steam_id},
            'stats': {
                'totalSessions': len(completed),
                'totalLaps': total_laps,
                'averageFocus': avg_focus,
                'bestFocus': best_focus,
            }
        })
    except Exception as e:
        print(f"[STATS] Firestore fetch failed: {e}")

    # Fallback: in-memory
    user_sessions = [s for s in _sessions_store.values() if s.get('userId') == steam_id]
    completed = [s for s in user_sessions if not s.get('isActive', True)]
    total_laps = sum(s.get('totalLaps', 0) for s in completed)
    focus_scores = []
    for s in completed:
        if s.get('focusResult') and s['focusResult'].get('averageFocusPct', 0) > 0:
            focus_scores.append(s['focusResult']['averageFocusPct'])
    avg_focus = round(sum(focus_scores) / len(focus_scores), 1) if focus_scores else 0
    best_focus = round(max(focus_scores), 1) if focus_scores else 0

    return jsonify({
        'user': {'steamId': steam_id},
        'stats': {
            'totalSessions': len(completed),
            'totalLaps': total_laps,
            'averageFocus': avg_focus,
            'bestFocus': best_focus,
        }
    })

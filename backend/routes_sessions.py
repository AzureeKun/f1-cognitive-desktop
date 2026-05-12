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

sessions_bp = Blueprint('sessions', __name__)


# ============================================================
# SESSION ROUTES
# ============================================================

@sessions_bp.route('/api/sessions', methods=['POST'])
def create_session():
    """
    Start a new driving session.
    Body: { steamId, trackName, gameMode, displayName, avatarUrl }
    """
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    data = request.get_json()
    if not data or not data.get('steamId'):
        return jsonify({'error': 'steamId is required'}), 400

    steam_id = data['steamId']

    # Ensure user exists in database
    user_ref = db.collection('users').document(steam_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        user_ref.set({
            'displayName': data.get('displayName', 'Unknown'),
            'avatarUrl': data.get('avatarUrl', ''),
            'profileUrl': data.get('profileUrl', ''),
            'experienceLevel': 'Beginner',
            'createdAt': datetime.utcnow(),
            'lastLogin': datetime.utcnow(),
        })

    # Create new session
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

    db.collection('sessions').document(session_id).set(session_data)

    return jsonify({
        'message': 'Session started',
        'sessionId': session_id,
        'session': {**session_data, 'id': session_id, 'startTime': session_data['startTime'].isoformat()},
    }), 201


@sessions_bp.route('/api/sessions', methods=['GET'])
def get_sessions():
    """
    Get all sessions for a user.
    Query params: steamId (required)
    """
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    steam_id = request.args.get('steamId')
    if not steam_id:
        return jsonify({'error': 'steamId query param is required'}), 400

    sessions_ref = db.collection('sessions')
    query = sessions_ref.where(filter=FieldFilter('userId', '==', steam_id)).order_by('startTime', direction='DESCENDING')
    docs = query.stream()

    sessions = []
    for doc in docs:
        session = doc.to_dict()
        session['id'] = doc.id
        # Convert timestamps to ISO strings
        if session.get('startTime'):
            session['startTime'] = session['startTime'].isoformat() if hasattr(session['startTime'], 'isoformat') else str(session['startTime'])
        if session.get('endTime'):
            session['endTime'] = session['endTime'].isoformat() if hasattr(session['endTime'], 'isoformat') else str(session['endTime'])
        sessions.append(session)

    return jsonify({'sessions': sessions, 'total': len(sessions)})


@sessions_bp.route('/api/sessions/<session_id>', methods=['GET'])
def get_session_detail(session_id):
    """Get detailed session info."""
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    doc = db.collection('sessions').document(session_id).get()
    if not doc.exists:
        return jsonify({'error': 'Session not found'}), 404

    session = doc.to_dict()
    session['id'] = doc.id
    if session.get('startTime'):
        session['startTime'] = session['startTime'].isoformat() if hasattr(session['startTime'], 'isoformat') else str(session['startTime'])
    if session.get('endTime'):
        session['endTime'] = session['endTime'].isoformat() if hasattr(session['endTime'], 'isoformat') else str(session['endTime'])

    return jsonify({'session': session})


@sessions_bp.route('/api/sessions/<session_id>/end', methods=['PUT'])
def end_session(session_id):
    """
    End an active session.
    Body: { totalLaps, bestLapTime }
    """
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    data = request.get_json() or {}

    session_ref = db.collection('sessions').document(session_id)
    session_ref.update({
        'isActive': False,
        'endTime': datetime.utcnow(),
        'totalLaps': data.get('totalLaps', 0),
        'bestLapTime': data.get('bestLapTime'),
    })

    return jsonify({'message': 'Session ended', 'sessionId': session_id})


# ============================================================
# TELEMETRY ROUTES
# ============================================================

@sessions_bp.route('/api/telemetry', methods=['POST'])
def submit_telemetry():
    """
    Submit telemetry data points (batch upload).

    Body: {
        sessionId: string,
        data: [
            { timestamp, speed, steeringAngle, throttle, brake, lapTime, lapDistance, label }
        ]
    }

    This is called by the telemetry collector to store F1 data
    for the ANN model to make focus predictions.
    """
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    payload = request.get_json()
    if not payload or not payload.get('sessionId') or not payload.get('data'):
        return jsonify({'error': 'sessionId and data array are required'}), 400

    session_id = payload['sessionId']
    data_points = payload['data']

    # Batch write for efficiency (Firestore supports up to 500 per batch)
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
            'label': point.get('label'),  # None if unlabeled
        })

    batch.commit()

    return jsonify({
        'message': f'{len(data_points)} data points saved',
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
        return jsonify({'error': 'Database not available'}), 503

    limit = request.args.get('limit', 1000, type=int)

    query = db.collection('telemetry_data')\
        .where(filter=FieldFilter('sessionId', '==', session_id))\
        .order_by('timestamp')\
        .limit(limit)

    docs = query.stream()
    data = [doc.to_dict() for doc in docs]

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

    Body: {
        focusLevel: "High Focus" | "Medium Focus" | "Low Focus",
        confidenceScore: 0.0-1.0,
        averageFocusPct: 0-100,
        minFocusPct: 0-100,
        maxFocusPct: 0-100,
        averageLatency: float,
        remarks: string
    }
    """
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

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

    # Store focus result inside the session document
    db.collection('sessions').document(session_id).update({
        'focusResult': focus_result,
    })

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
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    user_doc = db.collection('users').document(steam_id).get()
    if not user_doc.exists:
        return jsonify({'error': 'User not found'}), 404

    user_data = user_doc.to_dict()
    return jsonify({
        'user': {
            'steamId': steam_id,
            'displayName': user_data.get('displayName', ''),
            'avatar': user_data.get('avatarUrl', ''),
            'profileUrl': user_data.get('profileUrl', ''),
        }
    })


@sessions_bp.route('/api/users/<steam_id>/stats', methods=['GET'])
def get_user_stats(steam_id):
    """Get aggregated stats for a user (Records page)."""
    db = get_db()
    if not db:
        return jsonify({'error': 'Database not available'}), 503

    # Get user
    user_doc = db.collection('users').document(steam_id).get()
    if not user_doc.exists:
        return jsonify({'error': 'User not found'}), 404

    user_data = user_doc.to_dict()

    # Get completed sessions
    sessions_query = db.collection('sessions')\
        .where(filter=FieldFilter('userId', '==', steam_id))\
        .where(filter=FieldFilter('isActive', '==', False))

    sessions = [doc.to_dict() for doc in sessions_query.stream()]

    total_sessions = len(sessions)
    total_laps = sum(s.get('totalLaps', 0) for s in sessions)

    # Calculate focus stats
    focus_scores = []
    for s in sessions:
        if s.get('focusResult') and s['focusResult'].get('averageFocusPct'):
            focus_scores.append(s['focusResult']['averageFocusPct'])

    avg_focus = sum(focus_scores) / len(focus_scores) if focus_scores else 0
    best_focus = max(focus_scores) if focus_scores else 0

    return jsonify({
        'user': {**user_data, 'steamId': steam_id},
        'stats': {
            'totalSessions': total_sessions,
            'totalLaps': total_laps,
            'averageFocus': round(avg_focus, 1),
            'bestFocus': round(best_focus, 1),
        }
    })

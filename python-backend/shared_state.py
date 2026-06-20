"""
Shared in-memory state between app.py and routes_sessions.py
Avoids circular imports.
"""
from collections import deque

# Global live telemetry buffer - dashboard polls this
global_live_buffer = deque(maxlen=300)

# Latest AI prediction result
global_latest_prediction = {}

# Per-session buffers
live_telemetry = {}  # { session_id: deque(maxlen=100) }
latest_prediction = {}  # { session_id: prediction }

# In-memory session store (for Records page when Firebase is down)
sessions_store = {}  # { session_id: session_data }

# Active session tracking (for aggregation on end)
# { session_id: { focus_scores: [], max_lap: 0, data_points: 0, fastest_lap: None } }
active_session_stats = {}

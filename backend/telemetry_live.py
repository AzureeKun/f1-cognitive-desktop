"""
F1 25 Local Telemetry Forwarder — Desktop Version

This script runs alongside the desktop app and:
1. Connects to the local Flask backend via WebSocket (localhost:5050)
2. Waits for 'forwarder_command' from the dashboard (LIVE ON button)
3. Captures UDP telemetry from F1 25 on port 20777
4. Forwards parsed data to the local backend for AI prediction + broadcast

NOTE: In the desktop app, UDP is handled directly by app.py.
      This script is for advanced/fallback use only.

Usage:
    py telemetry_live.py
"""

import socket
import struct
import time
import sys
import os
import socketio

# ─── Configuration ───────────────────────────────────────────────────────────
UDP_IP = "0.0.0.0"
UDP_PORT = 20777

# Desktop: connect to local backend on port 5050
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5050')

# F1 25 Packet IDs
PACKET_LAP_DATA = 2
PACKET_CAR_TELEMETRY = 6

# F1 25 LapData struct: 57 bytes/car (packet total = 1285 bytes)
# Header=29 + LapData[22]=1254 + 2 extra = 1285
LAP_DATA_STRIDE = 57

# m_lapDistance offset within LapData struct = 20 bytes
# (uint32 lastLap + uint32 currentLap + uint16+uint8+uint16+uint8 sector1
#  + uint16+uint8+uint16+uint8 delta = 4+4+3+3+3+3 = 20)
LAP_DISTANCE_OFFSET = 20

# ─── State ───────────────────────────────────────────────────────────────────
is_capturing = False
session_id = 'local'
current_lap_time = 0.0
current_lap_dist = 0.0
prev_lap_time = 0.0
total_points = 0


def main():
    global is_capturing, session_id, current_lap_time, current_lap_dist
    global prev_lap_time, total_points

    print("=" * 55)
    print("  F1 25 Local Telemetry Forwarder")
    print("=" * 55)
    print(f"  Backend : {BACKEND_URL}")
    print(f"  UDP Port: {UDP_PORT}")
    print()

    # ─── Connect WebSocket to Backend ────────────────────────────────────────
    sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=3)

    @sio.event
    def connect():
        print(f"[WS] Connected to {BACKEND_URL}")
        print(f"[WS] Waiting for LIVE ON from dashboard...")

    @sio.event
    def disconnect():
        print(f"[WS] Disconnected from backend")

    @sio.on('forwarder_command')
    def on_forwarder_command(data):
        """Received from backend when dashboard clicks LIVE ON/OFF."""
        global is_capturing, session_id
        status = data.get('status', '')
        print(f"\n[CMD] forwarder_command: {status}")
        if status == 'START':
            session_id = data.get('sessionId', 'local')
            is_capturing = True
            print(f"[CMD] >>> CAPTURING STARTED (session: {session_id})")
        elif status == 'STOP':
            is_capturing = False
            print(f"[CMD] >>> CAPTURING STOPPED")

    # Connect to backend
    print(f"[*] Connecting to {BACKEND_URL}...")
    try:
        sio.connect(BACKEND_URL, transports=['websocket', 'polling'], wait_timeout=15)
    except Exception as e:
        print(f"[!] Connection failed: {e}")
        sys.exit(1)

    # ─── Bind UDP Socket ─────────────────────────────────────────────────────
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((UDP_IP, UDP_PORT))
    except OSError as e:
        print(f"[!] Cannot bind UDP port {UDP_PORT}: {e}")
        print(f"[!] Is F1 25 or another app already using this port?")
        sys.exit(1)

    sock.settimeout(0.5)
    print(f"[UDP] Listening on {UDP_IP}:{UDP_PORT}")
    print(f"[*] Start F1 25, enable UDP telemetry, then click LIVE ON.\n")

    # ─── Main Loop ───────────────────────────────────────────────────────────
    try:
        while True:
            try:
                data, addr = sock.recvfrom(2048)
            except socket.timeout:
                continue
            except OSError:
                break

            if not is_capturing:
                continue

            if len(data) < 29:
                continue

            # Parse packet header (F1 25 — same 29-byte header as F1 24)
            header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
            packet_id = header[5]
            player_car_index = header[10]

            # ── Lap Data (Packet ID 2) ──
            # F1 25: LapData stride = 57 bytes/car, m_lapDistance at offset 20
            if packet_id == PACKET_LAP_DATA:
                start_byte = 29 + (player_car_index * LAP_DATA_STRIDE)
                end_byte = start_byte + LAP_DISTANCE_OFFSET + 4
                if end_byte <= len(data):
                    lap_time_ms = struct.unpack('<I', data[start_byte+4:start_byte+8])[0]
                    current_lap_time = lap_time_ms / 1000.0

                    raw_dist = struct.unpack('<f', data[start_byte+LAP_DISTANCE_OFFSET:start_byte+LAP_DISTANCE_OFFSET+4])[0]
                    if 0 <= raw_dist <= 10000:
                        current_lap_dist = raw_dist

                    prev_lap_time = current_lap_time

            # ── Car Telemetry (Packet ID 6) ──
            # F1 25: CarTelemetryData stride = 60 bytes/car (unchanged from F1 24)
            elif packet_id == PACKET_CAR_TELEMETRY:
                start_byte = 29 + (player_car_index * 60)
                if start_byte + 14 <= len(data):
                    speed    = struct.unpack('<H', data[start_byte:start_byte+2])[0]
                    throttle = struct.unpack('<f', data[start_byte+2:start_byte+6])[0]
                    steer    = struct.unpack('<f', data[start_byte+6:start_byte+10])[0]
                    brake    = struct.unpack('<f', data[start_byte+10:start_byte+14])[0]

                    if speed > 0:
                        total_points += 1

                        # Emit every 2nd packet (~30Hz at 60Hz game rate)
                        if total_points % 2 == 0:
                            point = {
                                'timestamp': time.time(),
                                'speed': float(speed),
                                'steeringAngle': float(steer),  # Raw -1..1, matches training data
                                'throttle': float(throttle),
                                'brake': float(brake),
                                'lapTime': float(current_lap_time),
                                'lapDistance': round(current_lap_dist, 1),
                                'sessionId': session_id,
                            }

                            if sio.connected:
                                sio.emit('telemetry_data', point)

                            if total_points % 100 == 0:
                                print(
                                    f"  [{total_points:>5}] "
                                    f"Speed:{speed:>3} km/h | "
                                    f"Thr:{throttle:.2f} | "
                                    f"Brk:{brake:.2f} | "
                                    f"Lap:{current_lap_time:.1f}s",
                                    end='\r'
                                )

    except KeyboardInterrupt:
        print(f"\n\n[*] Stopped — {total_points} data points sent")
        is_capturing = False
        if sio.connected:
            sio.disconnect()
        sock.close()


if __name__ == "__main__":
    main()

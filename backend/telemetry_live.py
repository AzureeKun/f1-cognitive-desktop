"""
F1 25 Local Telemetry Forwarder

This script runs on the PLAYER'S PC and:
1. Connects to the Render backend via WebSocket
2. Waits for 'forwarder_command' from the web dashboard (LIVE ON button)
3. Captures UDP telemetry from F1 25 on port 20777
4. Forwards parsed data to the Render backend for AI prediction + broadcast

Usage:
    $env:BACKEND_URL="https://f1-cognitive-telemetry.onrender.com"
    py telemetry_live.py
"""

import socket
import struct
import time
import sys
import os
import socketio

# ─── Configuration ───────────────────────────────────────────────────────────
UDP_IP = "127.0.0.1"
UDP_PORT = 20777
BACKEND_URL = os.getenv('BACKEND_URL', 'https://f1-cognitive-telemetry.onrender.com')

# F1 25 Packet IDs
PACKET_LAP_DATA = 2
PACKET_CAR_TELEMETRY = 6

# ─── State ───────────────────────────────────────────────────────────────────
is_capturing = False
session_id = 'local'
current_lap_time = 0.0
current_lap_dist = 0.0
prev_lap_time = 0.0
total_points = 0


def main():
    global is_capturing, session_id, current_lap_time, current_lap_dist, prev_lap_time, total_points

    print("=" * 55)
    print("  F1 25 Local Telemetry Forwarder")
    print("=" * 55)
    print(f"  Backend: {BACKEND_URL}")
    print(f"  UDP Port: {UDP_PORT}")
    print()

    # ─── Connect WebSocket to Render Backend ─────────────────────────────────
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
        print(f"\n[CMD] Received forwarder_command: {status}")

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
        print(f"[!] Make sure BACKEND_URL is correct and Render is running.")
        sys.exit(1)

    # ─── Bind UDP Socket ─────────────────────────────────────────────────────
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_IP, UDP_PORT))
    sock.settimeout(0.5)
    print(f"[UDP] Listening on {UDP_IP}:{UDP_PORT}")
    print(f"[*] Start F1 25, then click LIVE ON on the dashboard.\n")

    # ─── Main Loop ───────────────────────────────────────────────────────────
    try:
        while True:
            try:
                data, _ = sock.recvfrom(2048)
            except socket.timeout:
                continue
            except OSError:
                break

            # Skip if not capturing (LIVE OFF)
            if not is_capturing:
                continue

            if len(data) < 29:
                continue

            header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
            packet_id = header[5]
            player_car_index = header[10]

            # ── Lap Data (Packet ID 2) ──
            if packet_id == PACKET_LAP_DATA:
                start_byte = 29 + (player_car_index * 61)
                if start_byte + 40 <= len(data):
                    lap_time_ms = struct.unpack('<I', data[start_byte+4:start_byte+8])[0]
                    current_lap_time = lap_time_ms / 1000.0

                    raw_dist = struct.unpack('<f', data[start_byte+36:start_byte+40])[0]
                    if 0 <= raw_dist <= 10000:
                        current_lap_dist = raw_dist

                    prev_lap_time = current_lap_time

            # ── Car Telemetry (Packet ID 6) ──
            elif packet_id == PACKET_CAR_TELEMETRY:
                start_byte = 29 + (player_car_index * 60)
                if start_byte + 14 <= len(data):
                    speed = struct.unpack('<H', data[start_byte:start_byte+2])[0]
                    throttle = struct.unpack('<f', data[start_byte+2:start_byte+6])[0]
                    steer = struct.unpack('<f', data[start_byte+6:start_byte+10])[0]
                    brake = struct.unpack('<f', data[start_byte+10:start_byte+14])[0]

                    if speed > 0:
                        total_points += 1

                        # Emit every 2nd packet (~30Hz)
                        if total_points % 2 == 0:
                            point = {
                                'timestamp': time.time(),
                                'speed': float(speed),
                                'steeringAngle': float(steer),  # Raw -1..1, matches training data
                                'throttle': float(throttle),
                                'brake': float(brake),
                                'lapTime': float(current_lap_time),
                                'lapDistance': round(current_lap_dist, 1) if 0 <= current_lap_dist <= 10000 else 0,
                                'sessionId': session_id,
                            }

                            if sio.connected:
                                sio.emit('telemetry_data', point)

                            # Status every 100 points
                            if total_points % 100 == 0:
                                print(f"    [{total_points:>5}] Speed:{speed:>3} | Thr:{throttle:.1f} | Brk:{brake:.1f} | Lap:{current_lap_time:.1f}s", end='\r')

    except KeyboardInterrupt:
        print(f"\n\n[*] Stopping... ({total_points} points sent)")
        is_capturing = False
        if sio.connected:
            sio.disconnect()
        sock.close()
        print("    Done!")


if __name__ == "__main__":
    main()

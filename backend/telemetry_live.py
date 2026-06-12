"""
F1 25 Live Telemetry Collector + WebSocket Emitter

This script:
1. Listens for UDP telemetry data from F1 25 game
2. Emits data via WebSocket to the Flask-SocketIO backend
3. Backend runs AI prediction and broadcasts to dashboard/overlay

Run this WHILE playing F1 25 with the backend running.

Usage:
    py telemetry_live.py
"""

import socket
import struct
import time
import requests
import sys
import socketio

# Configuration
UDP_IP = "127.0.0.1"
UDP_PORT = 20777
API_URL = "http://localhost:5000"

# F1 25 Packet IDs
PACKET_LAP_DATA = 2
PACKET_CAR_TELEMETRY = 6

# How often to emit (every N telemetry packets)
EMIT_INTERVAL = 2  # Emit every 2nd packet for smooth ~30Hz updates


def start_live_telemetry():
    print("=" * 55)
    print("  F1 25 Live Telemetry Collector (WebSocket)")
    print("=" * 55)
    print()

    # Auto mode (launched from dashboard) or manual
    auto_mode = '--auto' in sys.argv

    # Session ID from dashboard
    session_id_from_arg = None
    if '--session' in sys.argv:
        idx = sys.argv.index('--session')
        if idx + 1 < len(sys.argv):
            session_id_from_arg = sys.argv[idx + 1]

    if auto_mode:
        steam_id = "76561198884240051"
        print(f"    [Auto mode] Steam ID: {steam_id}")
    else:
        steam_id = input("Enter your Steam ID (or press Enter for default): ").strip()
        if not steam_id:
            steam_id = "76561198884240051"

    # Check backend health
    print(f"\n[*] Checking backend at {API_URL}...")
    try:
        health = requests.get(f"{API_URL}/api/health", timeout=3).json()
        print(f"    Backend: ✓ Connected")
        print(f"    AI Model: {'✓' if health.get('aiModel') else '✗'}")
    except Exception as e:
        print(f"    ✗ Backend not reachable: {e}")
        print(f"    Make sure to run 'py app.py' first!")
        sys.exit(1)

    # Connect WebSocket
    print(f"\n[*] Connecting WebSocket...")
    sio = socketio.Client(reconnection=True, reconnection_attempts=5, reconnection_delay=1)

    @sio.event
    def connect():
        print(f"    ✓ WebSocket connected!")

    @sio.event
    def disconnect():
        print(f"    WebSocket disconnected")

    try:
        sio.connect(API_URL, transports=['websocket'], wait_timeout=5)
    except Exception as e:
        print(f"    ⚠️  WebSocket failed ({e}), trying polling transport...")
        try:
            sio.connect(API_URL, wait_timeout=5)
        except Exception as e2:
            print(f"    ✗ All transports failed: {e2}")
            print(f"    Will use HTTP fallback.")
            sio = None

    # Use session from dashboard or create new one
    if session_id_from_arg and session_id_from_arg != 'local':
        session_id = session_id_from_arg
        print(f"\n[*] Using dashboard session: {session_id}")
    else:
        print(f"\n[*] Starting new session...")
        try:
            session_res = requests.post(f"{API_URL}/api/sessions", json={
                'steamId': steam_id,
                'trackName': 'Live Session',
                'gameMode': 'Time Trial',
            }, timeout=10).json()
            session_id = session_res.get('sessionId')
            print(f"    Session ID: {session_id}")
        except Exception as e:
            print(f"    Failed to create session: {e}")
            session_id = "local"

    # Initialize UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    sock.settimeout(5.0)

    print(f"\n[*] Listening for F1 25 data on UDP port {UDP_PORT}...")
    print(f"    Start driving in F1 25 to see data flow.")
    print(f"    Press Ctrl+C to stop.\n")

    # State
    current_lap_time = 0.0
    current_lap_dist = 0.0
    current_lap_num = 0
    prev_lap_time = 0.0
    total_points = 0
    last_prediction = None
    lap_count = 0
    lap_times = []

    try:
        while True:
            try:
                data, addr = sock.recvfrom(2048)
            except socket.timeout:
                print("    Waiting for F1 25 data...", end='\r')
                continue

            if len(data) < 29:
                continue

            header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
            packet_id = header[5]
            player_car_index = header[10]

            # Process Lap Data (Packet ID 2)
            if packet_id == PACKET_LAP_DATA:
                start_byte = 29 + (player_car_index * 61)
                if start_byte + 53 <= len(data):
                    current_lap_time_ms = struct.unpack('<I', data[start_byte+4:start_byte+8])[0]
                    current_lap_time = current_lap_time_ms / 1000.0
                    current_lap_dist = struct.unpack('<f', data[start_byte+18:start_byte+22])[0]

                    # Extract current lap number (uint8 at offset +52 in per-car LapData)
                    new_lap_num = struct.unpack('<B', data[start_byte+52:start_byte+53])[0]
                    if new_lap_num > current_lap_num and new_lap_num > 0:
                        current_lap_num = new_lap_num

                    # Lap detection (timer reset method)
                    if prev_lap_time > 10.0 and current_lap_time < 2.0 and current_lap_time > 0:
                        lap_count += 1
                        lap_times.append(prev_lap_time)
                        print(f"\n    [LAP {lap_count}] {prev_lap_time:.3f}s")
                        # Notify backend of completed lap time
                        if sio and sio.connected:
                            sio.emit('lap_completed', {
                                'sessionId': session_id,
                                'lapNum': lap_count,
                                'lapTime': prev_lap_time,
                            })
                    prev_lap_time = current_lap_time

            # Process Car Telemetry (Packet ID 6)
            elif packet_id == PACKET_CAR_TELEMETRY:
                start_byte = 29 + (player_car_index * 60)
                if start_byte + 14 <= len(data):
                    speed_raw = struct.unpack('<H', data[start_byte:start_byte+2])[0]
                    throttle_raw = struct.unpack('<f', data[start_byte+2:start_byte+6])[0]
                    steer_raw = struct.unpack('<f', data[start_byte+6:start_byte+10])[0]
                    brake_raw = struct.unpack('<f', data[start_byte+10:start_byte+14])[0]

                    speed = speed_raw
                    throttle = throttle_raw
                    steer = steer_raw
                    brake = brake_raw

                    if speed > 0:
                        total_points += 1

                        # Emit via WebSocket every EMIT_INTERVAL packets
                        if total_points % EMIT_INTERVAL == 0:
                            point = {
                                'timestamp': time.time(),
                                'speed': float(speed),
                                'steeringAngle': float(steer) * 360.0,
                                'throttle': float(throttle),
                                'brake': float(brake),
                                'lapTime': float(current_lap_time),
                                'lapDistance': float(current_lap_dist),
                                'lapNum': current_lap_num,
                                'sessionId': session_id,
                            }

                            if sio and sio.connected:
                                # WebSocket emit — near-instant
                                sio.emit('telemetry_data', point)
                            else:
                                # Fallback: HTTP POST
                                try:
                                    requests.post(f"{API_URL}/api/predict/single", json=point, timeout=1)
                                except:
                                    pass

                        # Print status every 50 points
                        if total_points % 50 == 0:
                            focus = last_prediction.get('focusScore', '?') if last_prediction else '?'
                            print(f"    [#{total_points:>5}] Speed: {speed:>3.0f} km/h | Steer: {steer*360:>6.1f}° | Focus: {focus}%", end='\r')

            # Listen for broadcast predictions
            if sio and sio.connected:
                # The server broadcasts 'live_telemetry' with prediction included
                # We can capture it here if needed
                pass

    except KeyboardInterrupt:
        print(f"\n\n[*] Stopping...")

        # Disconnect WebSocket
        if sio and sio.connected:
            sio.disconnect()

        # Only end session if we created it ourselves (not from dashboard)
        if not session_id_from_arg or session_id_from_arg == 'local':
            try:
                best_lap = min(lap_times) if lap_times else None
                print(f"    Ending session...")
                res = requests.put(f"{API_URL}/api/sessions/{session_id}/end", json={
                    'totalLaps': lap_count,
                    'bestLapTime': best_lap,
                }, timeout=15)
                print(f"    End session: {res.status_code}")
            except Exception as e:
                print(f"    End session failed: {e}")
        else:
            print(f"    (Dashboard will end session {session_id})")

        print(f"\n    Laps: {lap_count} | Points: {total_points}")
        if lap_times:
            print(f"    Best lap: {min(lap_times):.3f}s")
        print("    Done!")


if __name__ == "__main__":
    start_live_telemetry()

"""
F1 25 Live Telemetry Collector + Real-Time AI Prediction

This script:
1. Listens for UDP telemetry data from F1 25 game
2. Sends data to the backend API (stored in Firebase)
3. Gets real-time focus predictions from the ANN model

Run this WHILE playing F1 25 with the backend running.

Usage:
    py telemetry_live.py
"""

import socket
import struct
import time
import requests
import sys

# Configuration
UDP_IP = "127.0.0.1"
UDP_PORT = 20777
API_URL = "http://localhost:5000"

# F1 25 Packet IDs
PACKET_LAP_DATA = 2
PACKET_CAR_TELEMETRY = 6

# Buffer settings
BUFFER_SIZE = 10  # Send to API every N data points
PREDICT_INTERVAL = 5  # Get AI prediction every N data points


def start_live_telemetry():
    print("=" * 55)
    print("  F1 25 Live Telemetry Collector")
    print("=" * 55)
    print()

    # Get Steam ID from user (for session tracking)
    steam_id = input("Enter your Steam ID (or press Enter for default): ").strip()
    if not steam_id:
        steam_id = "76561198884240051"  # Default

    # Check backend health
    print(f"\n[*] Checking backend at {API_URL}...")
    try:
        health = requests.get(f"{API_URL}/api/health", timeout=3).json()
        print(f"    Backend: ✓ Connected")
        print(f"    Firebase: {'✓' if health.get('firebase') else '✗'}")
        print(f"    AI Model: {'✓' if health.get('aiModel') else '✗'}")
    except Exception as e:
        print(f"    ✗ Backend not reachable: {e}")
        print(f"    Make sure to run 'py app.py' first!")
        sys.exit(1)

    # Start a new session
    print(f"\n[*] Starting new session...")
    try:
        session_res = requests.post(f"{API_URL}/api/sessions", json={
            'steamId': steam_id,
            'trackName': 'Live Session',
            'gameMode': 'Time Trial',
        }).json()
        session_id = session_res.get('sessionId')
        print(f"    Session ID: {session_id}")
    except Exception as e:
        print(f"    ✗ Failed to create session: {e}")
        sys.exit(1)

    # Initialize UDP socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((UDP_IP, UDP_PORT))
    sock.settimeout(5.0)  # 5 second timeout

    print(f"\n[*] Listening for F1 25 data on UDP port {UDP_PORT}...")
    print(f"    Start driving in F1 25 to see data flow.")
    print(f"    Press Ctrl+C to stop.\n")

    # State
    current_lap_time = 0.0
    current_lap_dist = 0.0
    buffer = []
    total_points = 0
    last_prediction = None

    try:
        while True:
            try:
                data, addr = sock.recvfrom(2048)
            except socket.timeout:
                print("    Waiting for F1 25 data...", end='\r')
                continue

            # Parse header (29 bytes)
            if len(data) < 29:
                continue

            header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
            packet_id = header[5]
            player_car_index = header[10]

            # Process Lap Data (Packet ID 2)
            if packet_id == PACKET_LAP_DATA:
                start_byte = 29 + (player_car_index * 61)
                if start_byte + 22 <= len(data):
                    current_lap_time_ms = struct.unpack('<I', data[start_byte+4:start_byte+8])[0]
                    current_lap_time = current_lap_time_ms / 1000.0
                    current_lap_dist = struct.unpack('<f', data[start_byte+18:start_byte+22])[0]

            # Process Car Telemetry (Packet ID 6)
            elif packet_id == PACKET_CAR_TELEMETRY:
                start_byte = 29 + (player_car_index * 60)
                if start_byte + 14 <= len(data):
                    telemetry = struct.unpack('<Hfff', data[start_byte:start_byte+14])
                    speed, throttle, steer, brake = telemetry

                    # Only process if car is moving
                    if speed > 0:
                        point = {
                            'timestamp': time.time(),
                            'speed': float(speed),
                            'steeringAngle': float(steer),
                            'throttle': float(throttle),
                            'brake': float(brake),
                            'lapTime': float(current_lap_time),
                            'lapDistance': float(current_lap_dist),
                        }

                        buffer.append(point)
                        total_points += 1

                        # Send buffer to API
                        if len(buffer) >= BUFFER_SIZE:
                            try:
                                requests.post(f"{API_URL}/api/telemetry", json={
                                    'sessionId': session_id,
                                    'data': buffer,
                                }, timeout=2)
                            except:
                                pass  # Don't block on API errors
                            buffer = []

                        # Get AI prediction periodically
                        if total_points % PREDICT_INTERVAL == 0:
                            try:
                                pred = requests.post(f"{API_URL}/api/predict/single", json=point, timeout=2).json()
                                last_prediction = pred
                                focus = pred.get('focusScore', 0)
                                status = "FOCUSED" if pred.get('isFocused') else "DISTRACTED"
                                print(f"    [#{total_points:>5}] Speed: {speed:>3.0f} km/h | Steer: {steer:>6.1f}° | Focus: {focus:.0f}% ({status})", end='\r')
                            except:
                                print(f"    [#{total_points:>5}] Speed: {speed:>3.0f} km/h | Steer: {steer:>6.1f}° | AI: offline", end='\r')

    except KeyboardInterrupt:
        print(f"\n\n[*] Stopping...")

        # Flush remaining buffer
        if buffer:
            try:
                requests.post(f"{API_URL}/api/telemetry", json={
                    'sessionId': session_id,
                    'data': buffer,
                }, timeout=5)
            except:
                pass

        # End session
        try:
            requests.put(f"{API_URL}/api/sessions/{session_id}/end", json={
                'totalLaps': 0,
            }, timeout=5)
        except:
            pass

        # Save final focus result if we have predictions
        if last_prediction:
            try:
                score = last_prediction.get('focusScore', 0)
                level = "High Focus" if score >= 80 else "Medium Focus" if score >= 50 else "Low Focus"
                requests.post(f"{API_URL}/api/sessions/{session_id}/focus", json={
                    'focusLevel': level,
                    'confidenceScore': last_prediction.get('confidence', 0),
                    'averageFocusPct': score,
                    'minFocusPct': score,
                    'maxFocusPct': score,
                    'remarks': f'Session with {total_points} data points collected.',
                }, timeout=5)
            except:
                pass

        print(f"    Session ended. Total data points: {total_points}")
        print(f"    Session ID: {session_id}")
        print("    Done!")


if __name__ == "__main__":
    start_live_telemetry()

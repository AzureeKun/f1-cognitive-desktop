"""
Debug script to find the correct byte offsets for F1 25 telemetry.
Run this while driving in F1 25 to see raw packet data.

Usage: py debug_udp.py
"""
import socket
import struct

UDP_IP = "127.0.0.1"
UDP_PORT = 20777

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_IP, UDP_PORT))
sock.settimeout(10.0)

print("Listening on UDP port 20777... Start driving in F1 25\n")

count = 0
while count < 20:
    try:
        data, addr = sock.recvfrom(2048)
    except socket.timeout:
        print("Waiting...")
        continue

    if len(data) < 29:
        continue

    header = struct.unpack('<HBBBBBQfIIBB', data[0:29])
    packet_format = header[0]
    packet_id = header[5]
    player_car_index = header[10]

    # Only look at Car Telemetry packets (ID 6)
    if packet_id != 6:
        continue

    count += 1
    print(f"=== Packet #{count} | Format: {packet_format} | PlayerIdx: {player_car_index} | Size: {len(data)} bytes ===")
    
    # Try different car sizes (58, 60, 66, 68)
    for car_size in [58, 60, 66, 68]:
        offset = 29 + (player_car_index * car_size)
        if offset + 14 > len(data):
            continue
        
        speed = struct.unpack('<H', data[offset:offset+2])[0]
        throttle = struct.unpack('<f', data[offset+2:offset+6])[0]
        steer = struct.unpack('<f', data[offset+6:offset+10])[0]
        brake = struct.unpack('<f', data[offset+10:offset+14])[0]
        
        # Check if values make sense
        valid = 0 <= speed <= 400 and 0 <= throttle <= 1.01 and -1.01 <= steer <= 1.01 and 0 <= brake <= 1.01
        marker = " ✓✓✓" if valid and speed > 0 else ""
        
        print(f"  CarSize={car_size:2d} | Speed={speed:3d} | Throttle={throttle:.3f} | Steer={steer:.6f} | Brake={brake:.3f}{marker}")

    # Also try reading floats at various offsets to find steering
    print(f"  --- Scanning for non-zero floats near player data ---")
    base = 29 + (player_car_index * 60)
    for i in range(0, min(30, len(data) - base - 4), 2):
        val = struct.unpack('<f', data[base+i:base+i+4])[0]
        if abs(val) > 0.001 and abs(val) < 2.0:  # Likely a normalized value
            print(f"    Offset +{i}: {val:.6f}")

    print()

sock.close()
print("Done. Check which car_size gives valid speed + non-zero steer values.")

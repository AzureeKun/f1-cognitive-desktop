"""
Firebase Configuration & Initialization

This module initializes the Firebase Admin SDK and provides
a Firestore client for database operations.

Firestore Collections Structure:
├── users/
│   └── {steam_id}/
│       ├── displayName: string
│       ├── avatarUrl: string
│       ├── profileUrl: string
│       ├── experienceLevel: string
│       ├── createdAt: timestamp
│       └── lastLogin: timestamp
│
├── sessions/
│   └── {session_id}/
│       ├── userId: string (steam_id)
│       ├── startTime: timestamp
│       ├── endTime: timestamp
│       ├── trackName: string
│       ├── gameMode: string
│       ├── totalLaps: number
│       ├── bestLapTime: number
│       ├── isActive: boolean
│       └── focusResult: map {
│           ├── focusLevel: string
│           ├── confidenceScore: number
│           ├── averageFocusPct: number
│           ├── minFocusPct: number
│           ├── maxFocusPct: number
│           └── remarks: string
│       }
│
└── telemetry_data/
    └── {auto_id}/
        ├── sessionId: string
        ├── timestamp: number
        ├── speed: number
        ├── steeringAngle: number
        ├── throttle: number
        ├── brake: number
        ├── lapTime: number
        ├── lapDistance: number
        └── label: number (0 or 1, nullable)
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore

# Path to your Firebase service account key JSON file
CREDENTIALS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'firebase-credentials.json'
)


def initialize_firebase():
    """
    Initialize Firebase Admin SDK.
    Must be called once before using Firestore.
    """
    if not os.path.exists(CREDENTIALS_PATH):
        print("[FIREBASE] ⚠️  firebase-credentials.json not found!")
        print(f"[FIREBASE]    Expected at: {CREDENTIALS_PATH}")
        print("[FIREBASE]    Download it from Firebase Console → Project Settings → Service Accounts")
        print("[FIREBASE]    Running without Firebase (database operations will fail)")
        return None

    try:
        cred = credentials.Certificate(CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        print("[FIREBASE] ✓ Firebase initialized successfully")
        return firestore.client()
    except Exception as e:
        print(f"[FIREBASE] ✗ Error initializing Firebase: {e}")
        return None


# Initialize on import
db = initialize_firebase()


def get_db():
    """Returns the Firestore client instance."""
    return db

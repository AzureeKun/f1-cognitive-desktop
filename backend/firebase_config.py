"""
Firebase Configuration — Uses REST API to bypass gRPC SSL issues.
The gRPC client is still initialized for backwards compatibility,
but all writes should use firestore_rest module instead.
"""

import os
import ssl
import certifi

# Set env vars (may help some libraries)
os.environ['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH'] = certifi.where()
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
ssl._create_default_https_context = ssl._create_unverified_context

# Import REST client (this is what actually works)
from firestore_rest import set_document, update_document, set_subcollection_doc, get_document, get_collection

# Try initializing gRPC client (may not work on restricted networks)
import firebase_admin
from firebase_admin import credentials, firestore

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = None
for name in ['serviceAccountKey.json', 'firebase-credentials.json']:
    p = os.path.join(BACKEND_DIR, name)
    if os.path.exists(p):
        CREDENTIALS_PATH = p
        break

if not CREDENTIALS_PATH:
    import glob
    matches = glob.glob(os.path.join(BACKEND_DIR, '*firebase-adminsdk*.json'))
    if matches:
        CREDENTIALS_PATH = matches[0]

_db = None

def initialize_firebase():
    global _db
    if not CREDENTIALS_PATH:
        print("[FIREBASE] No credentials - REST only mode")
        return None
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
        print(f"[FIREBASE] gRPC client initialized (may fail on write)")
        return _db
    except Exception as e:
        print(f"[FIREBASE] gRPC init failed: {e} (using REST API)")
        return None

db = initialize_firebase()

def get_db():
    """Returns gRPC Firestore client (may be None). Use firestore_rest for reliable writes."""
    return _db

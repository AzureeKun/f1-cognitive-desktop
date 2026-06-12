"""
Firestore REST API Client — bypasses gRPC SSL issues.
Uses google-auth for authentication + requests for HTTP (with verify=False).
"""

import os
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SCOPES = ['https://www.googleapis.com/auth/datastore']

# Find credentials
_creds_path = None
for name in ['serviceAccountKey.json', 'firebase-credentials.json']:
    p = os.path.join(BACKEND_DIR, name)
    if os.path.exists(p):
        _creds_path = p
        break

if not _creds_path:
    import glob
    matches = glob.glob(os.path.join(BACKEND_DIR, '*firebase-adminsdk*.json'))
    if matches:
        _creds_path = matches[0]

# Load credentials and project ID
_credentials = None
_project_id = None

if _creds_path:
    _credentials = service_account.Credentials.from_service_account_file(_creds_path, scopes=SCOPES)
    with open(_creds_path) as f:
        _project_id = json.load(f).get('project_id')
    print(f"[FIRESTORE-REST] OK - Project: {_project_id}")
else:
    print("[FIRESTORE-REST] No credentials found")

BASE_URL = f"https://firestore.googleapis.com/v1/projects/{_project_id}/databases/(default)/documents" if _project_id else None


def _get_headers():
    """Get authenticated headers, refreshing token if needed."""
    if not _credentials:
        return None
    # Create a session that completely disables SSL verification
    session = requests.Session()
    session.verify = False
    # Monkey-patch the session's send method to force verify=False
    _original_send = session.send
    def _patched_send(prepared_request, **kwargs):
        kwargs['verify'] = False
        return _original_send(prepared_request, **kwargs)
    session.send = _patched_send
    
    # Refresh credentials using the patched session
    auth_request = Request(session=session)
    _credentials.refresh(auth_request)
    return {
        'Authorization': f'Bearer {_credentials.token}',
        'Content-Type': 'application/json',
    }


def _to_firestore_value(val):
    """Convert Python value to Firestore REST API format."""
    if val is None:
        return {'nullValue': None}
    elif isinstance(val, bool):
        return {'booleanValue': val}
    elif isinstance(val, int):
        return {'integerValue': str(val)}
    elif isinstance(val, float):
        return {'doubleValue': val}
    elif isinstance(val, str):
        return {'stringValue': val}
    elif isinstance(val, dict):
        return {'mapValue': {'fields': {k: _to_firestore_value(v) for k, v in val.items()}}}
    elif isinstance(val, list):
        return {'arrayValue': {'values': [_to_firestore_value(v) for v in val]}}
    else:
        return {'stringValue': str(val)}


def _from_firestore_value(val):
    """Convert Firestore REST value back to Python."""
    if 'stringValue' in val: return val['stringValue']
    if 'integerValue' in val: return int(val['integerValue'])
    if 'doubleValue' in val: return val['doubleValue']
    if 'booleanValue' in val: return val['booleanValue']
    if 'nullValue' in val: return None
    if 'mapValue' in val: return {k: _from_firestore_value(v) for k, v in val['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in val: return [_from_firestore_value(v) for v in val['arrayValue'].get('values', [])]
    if 'timestampValue' in val: return val['timestampValue']
    return None


def set_document(collection, doc_id, data, merge=False):
    """Create or overwrite a document."""
    if not BASE_URL:
        return False
    headers = _get_headers()
    if not headers:
        return False

    fields = {k: _to_firestore_value(v) for k, v in data.items()}
    url = f"{BASE_URL}/{collection}/{doc_id}"

    if merge:
        # PATCH with updateMask for merge
        mask = '&'.join([f'updateMask.fieldPaths={k}' for k in data.keys()])
        url = f"{url}?{mask}"
        resp = requests.patch(url, json={'fields': fields}, headers=headers, verify=False, timeout=10)
    else:
        resp = requests.patch(url, json={'fields': fields}, headers=headers, verify=False, timeout=10)

    if resp.status_code in (200, 201):
        return True
    else:
        print(f"[FIRESTORE-REST] Write failed ({resp.status_code}): {resp.text[:200]}")
        return False


def update_document(collection, doc_id, data):
    """Update specific fields of a document."""
    return set_document(collection, doc_id, data, merge=True)


def set_subcollection_doc(collection, doc_id, subcollection, sub_doc_id, data):
    """Write to a subcollection: collection/doc_id/subcollection/sub_doc_id"""
    if not BASE_URL:
        return False
    headers = _get_headers()
    if not headers:
        return False

    fields = {k: _to_firestore_value(v) for k, v in data.items()}
    url = f"{BASE_URL}/{collection}/{doc_id}/{subcollection}/{sub_doc_id}"
    resp = requests.patch(url, json={'fields': fields}, headers=headers, verify=False, timeout=10)

    if resp.status_code in (200, 201):
        return True
    else:
        print(f"[FIRESTORE-REST] Subcollection write failed ({resp.status_code})")
        return False


def get_document(collection, doc_id):
    """Read a document."""
    if not BASE_URL:
        return None
    headers = _get_headers()
    if not headers:
        return None

    url = f"{BASE_URL}/{collection}/{doc_id}"
    resp = requests.get(url, headers=headers, verify=False, timeout=10)
    if resp.status_code == 200:
        doc = resp.json()
        return {k: _from_firestore_value(v) for k, v in doc.get('fields', {}).items()}
    return None


def get_collection(collection, where_field=None, where_value=None):
    """List documents in a collection (with optional filter)."""
    if not BASE_URL:
        return []
    headers = _get_headers()
    if not headers:
        return []

    url = f"{BASE_URL}/{collection}"
    resp = requests.get(url, headers=headers, verify=False, timeout=10)
    if resp.status_code != 200:
        return []

    docs = []
    for doc in resp.json().get('documents', []):
        doc_data = {k: _from_firestore_value(v) for k, v in doc.get('fields', {}).items()}
        doc_data['id'] = doc['name'].split('/')[-1]
        if where_field and where_value:
            if doc_data.get(where_field) != where_value:
                continue
        docs.append(doc_data)
    return docs


def get_subcollection(collection, doc_id, subcollection):
    """List all documents in a subcollection: collection/doc_id/subcollection/*"""
    if not BASE_URL:
        return []
    headers = _get_headers()
    if not headers:
        return []

    url = f"{BASE_URL}/{collection}/{doc_id}/{subcollection}"
    resp = requests.get(url, headers=headers, verify=False, timeout=10)
    if resp.status_code != 200:
        return []

    docs = []
    for doc in resp.json().get('documents', []):
        doc_data = {k: _from_firestore_value(v) for k, v in doc.get('fields', {}).items()}
        doc_data['id'] = doc['name'].split('/')[-1]
        docs.append(doc_data)
    return docs

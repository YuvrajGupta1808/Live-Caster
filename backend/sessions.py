"""Firestore-backed session store.

Each live session is one document under the `sessions` collection holding
the owner's uid, start time, and the finalized transcript entries (narrator
lines, user speech, tool calls).
"""

import time
import uuid

from google.cloud import firestore

_db = firestore.Client()
_COLLECTION = "sessions"


def create_session(uid: str) -> str:
    session_id = uuid.uuid4().hex[:12]
    _db.collection(_COLLECTION).document(session_id).set({
        "id": session_id,
        "uid": uid,
        "started_at": time.time(),
        "entries": [],
    })
    return session_id


def append_entry(session_id: str, kind: str, text: str) -> None:
    """Append one finalized transcript entry. kind: model | user | tool."""
    doc_ref = _db.collection(_COLLECTION).document(session_id)
    doc_ref.update({
        "entries": firestore.ArrayUnion([
            {"kind": kind, "text": text, "ts": time.time()}
        ])
    })


def get_session(session_id: str, uid: str) -> dict | None:
    doc = _db.collection(_COLLECTION).document(session_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    if data.get("uid") != uid:
        return None
    return data


def list_sessions(uid: str) -> list[dict]:
    """Newest-first summaries: id, started_at, line count, preview."""
    docs = _db.collection(_COLLECTION).where(filter=firestore.FieldFilter("uid", "==", uid)).stream()
    summaries = []
    for doc in docs:
        data = doc.to_dict()
        entries = data.get("entries", [])
        if not entries:
            continue  # empty sessions are noise, not history
        first_model = next((e["text"] for e in entries if e["kind"] == "model"), "")
        summaries.append({
            "id": data["id"],
            "started_at": data.get("started_at", 0),
            "entry_count": len(entries),
            "preview": first_model[:80],
        })
    summaries.sort(key=lambda s: s["started_at"], reverse=True)
    return summaries

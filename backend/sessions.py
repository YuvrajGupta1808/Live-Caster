"""File-backed session store.

Each live session is one JSON file under backend/sessions/ holding the
mode, start time, and the finalized transcript entries (narrator lines,
user speech, tool calls). Plain files keep the store dependency-free and
easy to inspect.
"""

import json
import time
import uuid
from pathlib import Path

SESSIONS_DIR = Path(__file__).resolve().parent / "sessions"


def _path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def create_session() -> str:
    SESSIONS_DIR.mkdir(exist_ok=True)
    session_id = uuid.uuid4().hex[:12]
    _path(session_id).write_text(json.dumps({
        "id": session_id,
        "started_at": time.time(),
        "entries": [],
    }))
    return session_id


def append_entry(session_id: str, kind: str, text: str) -> None:
    """Append one finalized transcript entry. kind: model | user | tool."""
    path = _path(session_id)
    if not path.exists():
        return
    data = json.loads(path.read_text())
    data["entries"].append({"kind": kind, "text": text, "ts": time.time()})
    path.write_text(json.dumps(data))


def get_session(session_id: str) -> dict | None:
    path = _path(session_id)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def list_sessions() -> list[dict]:
    """Newest-first summaries: id, started_at, line count, preview."""
    if not SESSIONS_DIR.exists():
        return []
    summaries = []
    for path in SESSIONS_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
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

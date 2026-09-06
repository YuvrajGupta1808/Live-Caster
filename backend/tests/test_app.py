"""Tests for the Live-Caster backend: REST endpoints, the narrator prompt,
and the /ws/live WebSocket handshake protocol.

Firestore and Firebase Auth are stubbed out — these tests cover the app's
own logic (routing, auth enforcement, the handshake contract), not Google's
client libraries.
"""

import base64
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import auth
import live_service
import main
from prompts import NARRATOR_PROMPT

client = TestClient(main.app)

FAKE_UID = "test-uid-123"
AUTH_HEADERS = {"Authorization": "Bearer valid-token"}


@pytest.fixture
def signed_in(monkeypatch):
    """Accept 'valid-token' as FAKE_UID; reject everything else."""
    def fake_verify(token: str) -> str:
        if token != "valid-token":
            raise main.HTTPException(status_code=401, detail="invalid or expired token")
        return FAKE_UID

    monkeypatch.setattr(auth, "verify_id_token", fake_verify)
    monkeypatch.setattr(main, "require_uid", lambda header: (
        fake_verify(header.removeprefix("Bearer "))
        if header and header.startswith("Bearer ")
        else (_ for _ in ()).throw(main.HTTPException(status_code=401, detail="missing bearer token"))
    ))
    return FAKE_UID


@pytest.fixture
def store(monkeypatch):
    """In-memory stand-in for the Firestore-backed session store."""
    docs = {}
    counter = {"n": 0}

    def create_session(uid):
        counter["n"] += 1
        sid = f"session{counter['n']}"
        docs[sid] = {"id": sid, "uid": uid, "started_at": counter["n"], "entries": []}
        return sid

    def append_entry(sid, kind, text):
        docs[sid]["entries"].append({"kind": kind, "text": text, "ts": 0})

    def get_session(sid, uid):
        doc = docs.get(sid)
        return doc if doc and doc["uid"] == uid else None

    def list_sessions(uid):
        out = []
        for doc in docs.values():
            if doc["uid"] != uid or not doc["entries"]:
                continue
            first_model = next(
                (e["text"] for e in doc["entries"] if e["kind"] == "model"), ""
            )
            out.append({
                "id": doc["id"],
                "started_at": doc["started_at"],
                "entry_count": len(doc["entries"]),
                "preview": first_model[:80],
            })
        return sorted(out, key=lambda s: s["started_at"], reverse=True)

    monkeypatch.setattr(main.sessions, "create_session", create_session)
    monkeypatch.setattr(main.sessions, "append_entry", append_entry)
    monkeypatch.setattr(main.sessions, "get_session", get_session)
    monkeypatch.setattr(main.sessions, "list_sessions", list_sessions)
    return docs


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_narrator_prompt_covers_the_essentials():
    assert "accessibility" in NARRATOR_PROMPT
    assert "NEVER repeat" in NARRATOR_PROMPT
    assert "user speaks" in NARRATOR_PROMPT


def test_decode_frame_strips_data_url_header():
    raw = b"\xff\xd8jpegbytes"
    encoded = base64.b64encode(raw).decode()
    assert live_service.decode_frame(encoded) == raw
    assert live_service.decode_frame(f"data:image/jpeg;base64,{encoded}") == raw


def test_sessions_endpoints_require_auth():
    """The whole point of the gate: no token, no access."""
    assert client.get("/sessions").status_code == 401
    assert client.get("/sessions/anything").status_code == 401
    assert client.get(
        "/sessions", headers={"Authorization": "Bearer nope"}
    ).status_code == 401


def test_ws_rejects_non_start_first_message():
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "frame", "data": "x"})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "start" in event["content"]


def test_ws_rejects_start_without_token():
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "start"})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "auth" in event["content"].lower()


def test_ws_start_hands_off_to_bridge_with_narrator_prompt(monkeypatch, signed_in, store):
    seen = {}

    async def fake_bridge(websocket, system_prompt, recorder=None):
        seen["prompt"] = system_prompt
        recorder("model", "hello there")
        await websocket.send_json({"type": "ready", "model": "fake"})
        await websocket.close()

    monkeypatch.setattr(main, "run_live_bridge", fake_bridge)
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "start", "token": "valid-token"})
        session_event = ws.receive_json()
        ready_event = ws.receive_json()

    assert session_event["type"] == "session"
    assert ready_event == {"type": "ready", "model": "fake"}
    assert seen["prompt"] == NARRATOR_PROMPT

    # The recorder persisted the line into the session store.
    stored = main.sessions.get_session(session_event["id"], signed_in)
    assert stored["entries"][0]["kind"] == "model"
    assert stored["entries"][0]["text"] == "hello there"


def test_sessions_endpoints(signed_in, store):
    sid = main.sessions.create_session(signed_in)
    main.sessions.append_entry(sid, "model", "line one")
    main.sessions.append_entry(sid, "tool", "Google Search: screen readers")

    index = client.get("/sessions", headers=AUTH_HEADERS).json()["sessions"]
    assert index[0]["id"] == sid
    assert index[0]["entry_count"] == 2
    assert index[0]["preview"] == "line one"

    detail = client.get(f"/sessions/{sid}", headers=AUTH_HEADERS).json()
    assert [e["kind"] for e in detail["entries"]] == ["model", "tool"]

    assert client.get("/sessions/nope", headers=AUTH_HEADERS).status_code == 404


def test_sessions_are_scoped_to_their_owner(signed_in, store):
    """One user's sessions must never surface for another."""
    other_sid = main.sessions.create_session("someone-else")
    main.sessions.append_entry(other_sid, "model", "not yours")

    index = client.get("/sessions", headers=AUTH_HEADERS).json()["sessions"]
    assert index == []
    assert client.get(f"/sessions/{other_sid}", headers=AUTH_HEADERS).status_code == 404


def test_ws_reports_missing_auth(monkeypatch, signed_in, store):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("LIVECASTER_VERTEX_PROJECT", raising=False)
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "start", "token": "valid-token"})
        assert ws.receive_json()["type"] == "session"
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "GEMINI_API_KEY" in event["content"]
    assert "LIVECASTER_VERTEX_PROJECT" in event["content"]

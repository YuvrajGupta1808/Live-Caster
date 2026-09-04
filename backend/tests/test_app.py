"""Tests for the Live-Caster backend: REST endpoints, the narrator prompt,
and the /ws/live WebSocket handshake protocol."""

import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import main
import live_service
from prompts import NARRATOR_PROMPT


client = TestClient(main.app)


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


def test_ws_rejects_non_start_first_message():
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "frame", "data": "x"})
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "start" in event["content"]


def test_ws_start_hands_off_to_bridge_with_narrator_prompt(monkeypatch, tmp_path):
    monkeypatch.setattr(main.sessions, "SESSIONS_DIR", tmp_path)
    seen = {}

    async def fake_bridge(websocket, system_prompt, recorder=None):
        seen["prompt"] = system_prompt
        recorder("model", "hello there")
        await websocket.send_json({"type": "ready", "model": "fake"})
        await websocket.close()

    monkeypatch.setattr(main, "run_live_bridge", fake_bridge)
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "start"})
        session_event = ws.receive_json()
        ready_event = ws.receive_json()

    assert session_event["type"] == "session"
    assert ready_event == {"type": "ready", "model": "fake"}
    assert seen["prompt"] == NARRATOR_PROMPT

    # The recorder persisted the line into the session store.
    stored = main.sessions.get_session(session_event["id"])
    assert stored["entries"][0]["kind"] == "model"
    assert stored["entries"][0]["text"] == "hello there"


def test_sessions_endpoints(monkeypatch, tmp_path):
    monkeypatch.setattr(main.sessions, "SESSIONS_DIR", tmp_path)
    sid = main.sessions.create_session()
    main.sessions.append_entry(sid, "model", "line one")
    main.sessions.append_entry(sid, "tool", "Google Search: screen readers")

    index = client.get("/sessions").json()["sessions"]
    assert index[0]["id"] == sid
    assert index[0]["entry_count"] == 2
    assert index[0]["preview"] == "line one"

    detail = client.get(f"/sessions/{sid}").json()
    assert [e["kind"] for e in detail["entries"]] == ["model", "tool"]

    assert client.get("/sessions/nope").status_code == 404


def test_ws_reports_missing_auth(monkeypatch, tmp_path):
    monkeypatch.setattr(main.sessions, "SESSIONS_DIR", tmp_path)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("LIVECASTER_VERTEX_PROJECT", raising=False)
    with client.websocket_connect("/ws/live") as ws:
        ws.send_json({"type": "start"})
        assert ws.receive_json()["type"] == "session"
        event = ws.receive_json()
    assert event["type"] == "error"
    assert "GEMINI_API_KEY" in event["content"]
    assert "LIVECASTER_VERTEX_PROJECT" in event["content"]

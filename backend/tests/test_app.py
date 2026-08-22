"""Tests for the Live-Caster backend: SSE framing, endpoints, tag stripping."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient

import main
from gemini_service import strip_vocal_tags


client = TestClient(main.app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_sse_frame_is_valid_json():
    frame = main.sse_frame("text", "with 'quotes', \"doubles\" and\nnewlines")
    assert frame.startswith("data: ")
    assert frame.endswith("\n\n")
    payload = json.loads(frame[len("data: "):])
    assert payload["type"] == "text"
    assert "newlines" in payload["content"]


def test_sse_frame_without_content():
    payload = json.loads(main.sse_frame("done")[len("data: "):])
    assert payload == {"type": "done"}


def test_strip_vocal_tags():
    assert strip_vocal_tags("{whisper}(The moment...) {shout}(CHECKMATE!)") == \
        "The moment... CHECKMATE!"
    assert strip_vocal_tags("plain text") == "plain text"
    assert strip_vocal_tags("{deep}") == ""


def test_analyze_pipeline_with_stubbed_models(monkeypatch):
    monkeypatch.setattr(main, "analyze_image", lambda img, prompt: "raw commentary")
    monkeypatch.setattr(
        main, "refine_commentary_with_style", lambda text: "refined commentary"
    )
    resp = client.post("/analyze", json={"image": "aGVsbG8=", "skip_audio": True})
    assert resp.status_code == 200
    body = resp.json()
    assert body["text"] == "refined commentary"
    assert body["original_text"] == "raw commentary"
    assert body["audio"] is None
    assert body["timing"]["tts"] is None


def test_analyze_stream_emits_json_frames(monkeypatch):
    monkeypatch.setattr(
        main, "analyze_image_stream", lambda img, prompt: iter(["it's ", "over!"])
    )
    monkeypatch.setattr(
        main, "refine_commentary_with_style", lambda text: "it's ALL over!"
    )
    with client.stream(
        "POST", "/analyze-stream", json={"image": "aGVsbG8=", "skip_audio": True}
    ) as resp:
        assert resp.status_code == 200
        raw = "".join(resp.iter_text())

    frames = [json.loads(f[len("data: "):]) for f in raw.split("\n\n") if f.strip()]
    types = [f["type"] for f in frames]
    assert types == ["text", "text", "refined", "done"]
    # Apostrophes survive framing intact — the bug the old f-strings had.
    assert frames[0]["content"] == "it's "
    assert frames[2]["content"] == "it's ALL over!"

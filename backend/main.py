import logging
import os

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import sessions
from live_service import run_live_bridge
from prompts import NARRATOR_PROMPT, QUIET_MODE_SUFFIX

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("livecaster")

app = FastAPI(title="Live-Caster", version="2.0.0")

# CORS: local dev origins by default; override with LIVECASTER_ALLOWED_ORIGINS
# (comma-separated). A wildcard with credentials is both invalid per the spec
# and unsafe, so we pin origins explicitly.
_default_origins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000"
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("LIVECASTER_ALLOWED_ORIGINS", _default_origins).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/sessions")
async def sessions_index() -> dict:
    return {"sessions": sessions.list_sessions()}


@app.get("/sessions/{session_id}")
async def session_detail(session_id: str) -> dict:
    data = sessions.get_session(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="session not found")
    return data


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    """Live commentary over a Gemini Live session.

    The first client message must be {"type": "start", "mode": <mode>};
    everything after that is handled by the live bridge.
    """
    await websocket.accept()
    try:
        start = await websocket.receive_json()
    except WebSocketDisconnect:
        return

    if start.get("type") != "start":
        await websocket.send_json(
            {"type": "error", "content": "first message must be {\"type\": \"start\"}"}
        )
        await websocket.close()
        return

    session_id = sessions.create_session()
    logger.info("Starting live session %s", session_id)
    await websocket.send_json({"type": "session", "id": session_id})

    def recorder(kind: str, text: str) -> None:
        sessions.append_entry(session_id, kind, text)

    system_prompt = NARRATOR_PROMPT
    if start.get("quiet"):
        system_prompt += QUIET_MODE_SUFFIX

    await run_live_bridge(websocket, system_prompt, recorder)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

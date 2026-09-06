"""Firebase ID token verification.

Every REST request and the WebSocket handshake must carry a Firebase ID
token proving the caller completed email-link sign-in. This is the gate
that keeps the app from being used (and its Gemini quota burned) by anyone
who merely has the URL.
"""

import firebase_admin
from fastapi import HTTPException, WebSocket
from firebase_admin import auth


def _ensure_app() -> None:
    """Initialize the Firebase app once, on first use.

    Deferred so importing this module needs no credentials — tests and
    tooling can import the app without touching Firebase.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()


def verify_id_token(token: str) -> str:
    """Returns the caller's uid, or raises if the token is missing/invalid."""
    _ensure_app()
    try:
        decoded = auth.verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid or expired token") from exc
    return decoded["uid"]


def require_uid(authorization: str | None) -> str:
    """For REST endpoints: expects `Authorization: Bearer <id_token>`."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    return verify_id_token(authorization.removeprefix("Bearer "))


async def require_uid_ws(websocket: WebSocket, token: str | None) -> str | None:
    """For the WebSocket handshake: closes the socket and returns None on failure."""
    if not token:
        await websocket.send_json({"type": "error", "content": "missing auth token"})
        await websocket.close(code=4401)
        return None
    try:
        return verify_id_token(token)
    except HTTPException:
        await websocket.send_json({"type": "error", "content": "invalid or expired token"})
        await websocket.close(code=4401)
        return None

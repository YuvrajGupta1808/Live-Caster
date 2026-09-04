"""Bridge between a frontend WebSocket and a Gemini Live API session.

The frontend streams JPEG frames over the WebSocket; Gemini Live streams
back native audio (24kHz 16-bit PCM) plus a text transcription of what it
said. One Live session spans the whole broadcast, so the model keeps its
own memory of everything it has already said.

The user's microphone is streamed into the same session, so they can talk
to the model at any time; Gemini's voice-activity detection interrupts the
narration mid-sentence (barge-in) and the model answers instead.

Client -> server messages:
    {"type": "frame", "data": "<base64 jpeg>", "nudge": bool}  # nudge=false while user is talking
    {"type": "audio", "data": "<base64 pcm s16le 16kHz mono>"}  # mic chunk
    {"type": "stop"}

Server -> client messages:
    {"type": "ready", "model": "..."}
    {"type": "audio", "data": "<base64 pcm s16le 24kHz mono>"}
    {"type": "text", "content": "..."}          # model speech transcription
    {"type": "user_text", "content": "..."}     # user speech transcription
    {"type": "interrupted"}                     # user barged in; flush playback
    {"type": "turn_complete"}
    {"type": "error", "content": "..."}
"""

import asyncio
import base64
import json
import logging
import os

from dotenv import load_dotenv
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger("livecaster.live")

DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"
DEFAULT_VERTEX_LIVE_MODEL = "gemini-live-2.5-flash-native-audio"
DEFAULT_VERTEX_LOCATION = "us-central1"

# Sent after each frame to trigger one line of commentary. The system
# prompt (per mode) carries the persona and the don't-repeat rules.
FRAME_NUDGE = (
    "A new frame of the screen just arrived. Look at it carefully and "
    "speak your next narration line about what is actually visible in it."
)


def _using_vertex_adc() -> bool:
    return bool(os.getenv("LIVECASTER_VERTEX_PROJECT"))


def get_live_model() -> str:
    override = os.getenv("LIVECASTER_LIVE_MODEL")
    if override:
        return override
    if _using_vertex_adc():
        return DEFAULT_VERTEX_LIVE_MODEL
    return DEFAULT_LIVE_MODEL


def build_live_config(system_prompt: str) -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=system_prompt,
        output_audio_transcription={},
        input_audio_transcription={},
        # Native Google Search lets the model look things up when the
        # screen alone isn't enough; searches surface as tool events.
        tools=[types.Tool(google_search=types.GoogleSearch())],
    )


def make_client() -> genai.Client:
    """Build a Gemini client from whichever auth is configured.

    Preferred: Vertex AI with Application Default Credentials (gcloud
    login) — set LIVECASTER_VERTEX_PROJECT (+ optional
    LIVECASTER_VERTEX_LOCATION). Fallback: a GEMINI_API_KEY for the
    Gemini Developer API (or Vertex express mode with
    LIVECASTER_USE_VERTEXAI).
    """
    vertex_project = os.getenv("LIVECASTER_VERTEX_PROJECT")
    if vertex_project:
        return genai.Client(
            vertexai=True,
            project=vertex_project,
            location=os.getenv("LIVECASTER_VERTEX_LOCATION", DEFAULT_VERTEX_LOCATION),
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "No Gemini auth configured: set LIVECASTER_VERTEX_PROJECT "
            "(Vertex AI via gcloud ADC) or GEMINI_API_KEY"
        )
    use_vertexai = os.getenv("LIVECASTER_USE_VERTEXAI", "").lower() in ("1", "true", "yes")
    if use_vertexai:
        return genai.Client(vertexai=True, api_key=api_key)
    return genai.Client(api_key=api_key)


def decode_frame(base64_image: str) -> bytes:
    """Decode a base64 JPEG, tolerating a data-URL header."""
    if "base64," in base64_image:
        base64_image = base64_image.split("base64,")[1]
    return base64.b64decode(base64_image)


async def _pump_client_messages(websocket: WebSocket, session) -> None:
    """Forward frames from the browser into the Live session until stop."""
    while True:
        message = await websocket.receive_json()
        message_type = message.get("type")

        if message_type == "frame":
            jpeg_bytes = decode_frame(message.get("data", ""))
            await session.send_realtime_input(
                media=types.Blob(data=jpeg_bytes, mime_type="image/jpeg")
            )
            # The nudge triggers a narration line. The client suppresses it
            # while the user is speaking so narration never competes with
            # a conversation turn.
            if message.get("nudge", True):
                await session.send_client_content(
                    turns=types.Content(
                        role="user", parts=[types.Part(text=FRAME_NUDGE)]
                    ),
                    turn_complete=True,
                )
        elif message_type == "audio":
            pcm_bytes = base64.b64decode(message.get("data", ""))
            await session.send_realtime_input(
                audio=types.Blob(data=pcm_bytes, mime_type="audio/pcm;rate=16000")
            )
        elif message_type == "stop":
            return
        else:
            await websocket.send_json(
                {"type": "error", "content": f"unknown message type {message_type!r}"}
            )


async def _pump_model_events(session, websocket: WebSocket, recorder=None) -> None:
    """Relay Live session output (audio, transcription, tool activity,
    turn markers) and record finalized transcript lines."""
    model_buffer = ""
    user_buffer = ""

    def record(kind: str, text: str) -> None:
        if recorder is not None and text.strip():
            recorder(kind, text.strip())

    def flush_buffers() -> None:
        nonlocal model_buffer, user_buffer
        record("user", user_buffer)
        record("model", model_buffer)
        model_buffer = ""
        user_buffer = ""

    while True:
        async for response in session.receive():
            if response.data:
                await websocket.send_json(
                    {
                        "type": "audio",
                        "data": base64.b64encode(response.data).decode("utf-8"),
                    }
                )

            tool_call = getattr(response, "tool_call", None)
            if tool_call is not None:
                for call in getattr(tool_call, "function_calls", None) or []:
                    label = f"{call.name}({json.dumps(call.args or {})})"
                    await websocket.send_json({"type": "tool_call", "content": label})
                    record("tool", label)

            server_content = getattr(response, "server_content", None)
            if server_content is None:
                continue

            grounding = getattr(server_content, "grounding_metadata", None)
            queries = getattr(grounding, "web_search_queries", None) if grounding else None
            if queries:
                label = "Google Search: " + ", ".join(queries)
                await websocket.send_json({"type": "tool_call", "content": label})
                record("tool", label)

            transcription = getattr(server_content, "output_transcription", None)
            if transcription is not None and transcription.text:
                model_buffer += transcription.text
                await websocket.send_json(
                    {"type": "text", "content": transcription.text}
                )

            user_transcription = getattr(server_content, "input_transcription", None)
            if user_transcription is not None and user_transcription.text:
                user_buffer += user_transcription.text
                await websocket.send_json(
                    {"type": "user_text", "content": user_transcription.text}
                )

            if getattr(server_content, "interrupted", False):
                flush_buffers()
                await websocket.send_json({"type": "interrupted"})

            if getattr(server_content, "turn_complete", False):
                flush_buffers()
                await websocket.send_json({"type": "turn_complete"})


async def run_live_bridge(websocket: WebSocket, system_prompt: str, recorder=None) -> None:
    """Own the whole lifetime of one broadcast: connect to Gemini Live,
    pump messages both ways, and tear everything down on either side
    disconnecting."""
    try:
        client = make_client()
    except RuntimeError as exc:
        await websocket.send_json({"type": "error", "content": str(exc)})
        await websocket.close()
        return

    try:
        async with client.aio.live.connect(
            model=get_live_model(), config=build_live_config(system_prompt)
        ) as session:
            await websocket.send_json({"type": "ready", "model": get_live_model()})

            client_task = asyncio.create_task(
                _pump_client_messages(websocket, session)
            )
            model_task = asyncio.create_task(
                _pump_model_events(session, websocket, recorder)
            )

            done, pending = await asyncio.wait(
                {client_task, model_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass
            for task in done:
                exc = task.exception()
                if exc is not None and not isinstance(exc, WebSocketDisconnect):
                    raise exc
    except WebSocketDisconnect:
        logger.info("Client disconnected from live bridge")
    except Exception as exc:
        logger.exception("Live bridge failed")
        try:
            await websocket.send_json({"type": "error", "content": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

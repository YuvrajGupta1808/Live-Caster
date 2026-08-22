import asyncio
import base64
import json
import logging
import os
import time

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from gemini_service import (
    analyze_image,
    analyze_image_stream,
    refine_commentary_with_style,
    generate_audio_from_text,
)
from prompts import CHESS_COMMENTATOR_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("livecaster")

app = FastAPI(title="Live-Caster", version="1.1.0")

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


class ImageRequest(BaseModel):
    image: str
    skip_audio: bool = False


def sse_frame(event_type: str, content=None) -> str:
    """One SSE data frame carrying a JSON payload.

    json.dumps guarantees quotes, newlines, and unicode in model output can
    never corrupt the frame — the previous f-string frames broke on any
    apostrophe in the commentary.
    """
    payload = {"type": event_type}
    if content is not None:
        payload["content"] = content
    return f"data: {json.dumps(payload)}\n\n"


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: ImageRequest):
    pipeline_start = time.time()
    logger.info("Received /analyze request (skip_audio=%s)", request.skip_audio)

    try:
        # Blocking SDK calls run in worker threads so the event loop stays
        # free to serve concurrent requests.
        step1_start = time.time()
        commentary_text = await asyncio.to_thread(
            analyze_image, request.image, CHESS_COMMENTATOR_PROMPT
        )
        step1_time = time.time() - step1_start
        logger.info("Vision analysis (%.2fs): %s", step1_time, commentary_text)

        step2_start = time.time()
        refined_commentary = await asyncio.to_thread(
            refine_commentary_with_style, commentary_text
        )
        step2_time = time.time() - step2_start
        logger.info("Style refinement (%.2fs): %s", step2_time, refined_commentary)

        audio_base64 = None
        step3_time = 0.0
        if not request.skip_audio:
            step3_start = time.time()
            audio_bytes = await asyncio.to_thread(
                generate_audio_from_text, refined_commentary
            )
            step3_time = time.time() - step3_start
            if audio_bytes:
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                logger.info("TTS audio generated (%.2fs)", step3_time)

        total_time = time.time() - pipeline_start
        logger.info("Pipeline total: %.2fs", total_time)

        return {
            "text": refined_commentary,
            "original_text": commentary_text,
            "audio": audio_base64,
            "timing": {
                "total": round(total_time, 2),
                "vision": round(step1_time, 2),
                "refinement": round(step2_time, 2),
                "tts": round(step3_time, 2) if not request.skip_audio else None,
            },
        }
    except Exception as exc:
        logger.exception("Pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/analyze-stream")
async def analyze_stream(request: ImageRequest):
    """Streams commentary as JSON SSE frames: text chunks, then the refined
    line, then (optionally) audio, then done."""
    logger.info("Received /analyze-stream request")

    async def generate_stream():
        try:
            accumulated_text = ""

            # The Gemini SDK yields synchronously; pull each chunk on a worker
            # thread so slow generation can't stall the event loop.
            stream = await asyncio.to_thread(
                lambda: iter(analyze_image_stream(request.image, CHESS_COMMENTATOR_PROMPT))
            )
            while True:
                chunk = await asyncio.to_thread(next, stream, None)
                if chunk is None:
                    break
                accumulated_text += chunk
                yield sse_frame("text", chunk)

            if accumulated_text:
                refined_commentary = await asyncio.to_thread(
                    refine_commentary_with_style, accumulated_text
                )
                yield sse_frame("refined", refined_commentary)

                if not request.skip_audio:
                    audio_bytes = await asyncio.to_thread(
                        generate_audio_from_text, refined_commentary
                    )
                    if audio_bytes:
                        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                        yield sse_frame("audio", audio_base64)

            yield sse_frame("done")

        except Exception as exc:
            logger.exception("Stream failed")
            yield sse_frame("error", str(exc))

    return StreamingResponse(generate_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

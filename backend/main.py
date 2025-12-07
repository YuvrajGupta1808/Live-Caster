from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini_service import analyze_image, analyze_image_stream, analyze_image_stream_with_audio, text_to_speech
from prompts import CHESS_COMMENTATOR_PROMPT
import uvicorn

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str
    skip_audio: bool = False

class TextRequest(BaseModel):
    text: str

@app.post("/analyze")
async def analyze(request: ImageRequest):
    print(f"📥 Received request. Skip audio: {request.skip_audio}", flush=True)
    try:
        # 1. Get Commentary from Gemini
        commentary_text = analyze_image(request.image, CHESS_COMMENTATOR_PROMPT)
        print(f"\n💬 Commentary: {commentary_text}\n", flush=True)
        
        # 2. Convert to Speech
        audio_base64 = None
        if not request.skip_audio:
            audio_base64 = text_to_speech(commentary_text)
        
        return {
            "text": commentary_text,
            "audio": audio_base64
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-stream")
async def analyze_stream(request: ImageRequest):
    print(f"📥 Received stream request.", flush=True)
    return StreamingResponse(
        analyze_image_stream(request.image, CHESS_COMMENTATOR_PROMPT),
        media_type="text/plain"
    )

@app.post("/analyze-stream-audio")
async def analyze_stream_audio(request: ImageRequest):
    print(f"📥 Received stream request with audio.", flush=True)
    return StreamingResponse(
        analyze_image_stream_with_audio(request.image, CHESS_COMMENTATOR_PROMPT),
        media_type="application/x-ndjson"
    )

@app.post("/generate-audio")
async def generate_audio(request: TextRequest):
    print(f"🎤 Generating audio for text: {request.text[:50]}...", flush=True)
    try:
        audio_base64 = text_to_speech(request.text)
        if audio_base64:
            print(f"✅ Audio generated successfully", flush=True)
            return {"audio": audio_base64}
        else:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
    except Exception as e:
        print(f"❌ Error generating audio: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

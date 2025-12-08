from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini_service import (
    analyze_image, 
    analyze_image_stream, 
    refine_commentary_with_style,
    generate_audio_from_text
)
from prompts import CHESS_COMMENTATOR_PROMPT
import uvicorn
import base64
import time

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

@app.post("/analyze")
async def analyze(request: ImageRequest):
    pipeline_start = time.time()
    print(f"\n{'='*60}", flush=True)
    print(f"📥 Received request. Skip audio: {request.skip_audio}", flush=True)
    
    try:
        # Step 1: Get basic commentary from Gemini Vision
        step1_start = time.time()
        commentary_text = analyze_image(request.image, CHESS_COMMENTATOR_PROMPT)
        step1_time = time.time() - step1_start
        print(f"\n💬 Basic Commentary: {commentary_text}", flush=True)
        print(f"⏱️  Step 1 (Vision Analysis): {step1_time:.2f}s", flush=True)
        
        # Step 2: Refine commentary with directorial style (Peter Drury)
        step2_start = time.time()
        refined_commentary = refine_commentary_with_style(commentary_text)
        step2_time = time.time() - step2_start
        print(f"\n✨ Refined Commentary: {refined_commentary}", flush=True)
        print(f"⏱️  Step 2 (Style Refinement): {step2_time:.2f}s", flush=True)
        
        # Step 3: Generate audio from refined commentary
        audio_base64 = None
        step3_time = 0
        if not request.skip_audio:
            step3_start = time.time()
            audio_bytes = generate_audio_from_text(refined_commentary)
            step3_time = time.time() - step3_start
            if audio_bytes:
                # Convert bytes to base64 for transmission
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                print(f"\n🔊 Audio generated and encoded", flush=True)
                print(f"⏱️  Step 3 (TTS Audio): {step3_time:.2f}s", flush=True)
        
        # Total pipeline time
        total_time = time.time() - pipeline_start
        print(f"\n{'='*60}", flush=True)
        print(f"⏱️  TOTAL PIPELINE TIME: {total_time:.2f}s", flush=True)
        print(f"    - Vision Analysis:   {step1_time:.2f}s ({step1_time/total_time*100:.1f}%)", flush=True)
        print(f"    - Style Refinement:  {step2_time:.2f}s ({step2_time/total_time*100:.1f}%)", flush=True)
        if not request.skip_audio:
            print(f"    - TTS Audio:         {step3_time:.2f}s ({step3_time/total_time*100:.1f}%)", flush=True)
        print(f"{'='*60}\n", flush=True)
        
        return {
            "text": refined_commentary,
            "original_text": commentary_text,
            "audio": audio_base64,
            "timing": {
                "total": round(total_time, 2),
                "vision": round(step1_time, 2),
                "refinement": round(step2_time, 2),
                "tts": round(step3_time, 2) if not request.skip_audio else None
            }
        }
    except Exception as e:
        print(f"❌ Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-stream")
async def analyze_stream(request: ImageRequest):
    """
    Streams commentary with refinement and audio generation.
    Returns JSON stream with text chunks and audio data.
    """
    print(f"📥 Received stream request.", flush=True)
    
    async def generate_stream():
        try:
            # Accumulate commentary chunks
            accumulated_text = ""
            chunk_count = 0
            
            # Stream basic commentary
            for chunk in analyze_image_stream(request.image, CHESS_COMMENTATOR_PROMPT):
                accumulated_text += chunk
                chunk_count += 1
                
                # Send text chunk immediately
                yield f"data: {{'type': 'text', 'content': '{chunk}'}}\n\n"
            
            # After all chunks received, refine and generate audio
            if accumulated_text:
                print(f"\n💬 Accumulated commentary: {accumulated_text}\n", flush=True)
                
                # Refine the complete commentary
                refined_commentary = refine_commentary_with_style(accumulated_text)
                yield f"data: {{'type': 'refined', 'content': '{refined_commentary}'}}\n\n"
                
                # Generate audio if not skipped
                if not request.skip_audio:
                    audio_bytes = generate_audio_from_text(refined_commentary)
                    if audio_bytes:
                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                        yield f"data: {{'type': 'audio', 'content': '{audio_base64}'}}\n\n"
                        print(f"🔊 Audio streamed\n", flush=True)
            
            yield "data: {'type': 'done'}\n\n"
            
        except Exception as e:
            print(f"❌ Stream error: {e}", flush=True)
            yield f"data: {{'type': 'error', 'content': '{str(e)}'}}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

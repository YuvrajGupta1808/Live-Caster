from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from gemini_service import analyze_image, text_to_speech
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

@app.post("/analyze")
async def analyze(request: ImageRequest):
    try:
        # 1. Get Commentary from Gemini
        commentary_text = analyze_image(request.image, CHESS_COMMENTATOR_PROMPT)
        
        # 2. Convert to Speech
        audio_base64 = text_to_speech(commentary_text)
        
        return {
            "text": commentary_text,
            "audio": audio_base64
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

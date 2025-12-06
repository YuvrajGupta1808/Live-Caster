import os
import google.generativeai as genai
from gtts import gTTS
import base64
import io
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    print("Warning: GEMINI_API_KEY not found in environment variables")

model = genai.GenerativeModel('gemini-flash-latest')

def analyze_image(base64_image: str, prompt: str) -> str:
    """
    Sends a base64 encoded image to Gemini Vision with a prompt.
    """
    try:
        # Remove header if present (e.g., "data:image/jpeg;base64,")
        if "base64," in base64_image:
            base64_image = base64_image.split("base64,")[1]

        image_data = base64.b64decode(base64_image)
        
        # Create a Part object for the image
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_data
        }

        response = model.generate_content([prompt, image_part])
        return response.text
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return "Error generating commentary."

def analyze_image_stream(base64_image: str, prompt: str):
    """
    Streams commentary from Gemini Vision.
    """
    try:
        # Remove header if present
        if "base64," in base64_image:
            base64_image = base64_image.split("base64,")[1]

        image_data = base64.b64decode(base64_image)
        
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_data
        }

        response = model.generate_content([prompt, image_part], stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as e:
        print(f"Error calling Gemini stream: {e}")
        yield "Error generating commentary."

def text_to_speech(text: str) -> str:
    """
    Converts text to speech using gTTS and returns base64 encoded audio.
    """
    try:
        if not text:
            return None
            
        tts = gTTS(text=text, lang='en')
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        
        audio_base64 = base64.b64encode(mp3_fp.read()).decode('utf-8')
        return audio_base64
    except Exception as e:
        print(f"Error generating speech: {e}")
        return None

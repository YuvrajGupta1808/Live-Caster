import os
import re
import google.generativeai as genai
import base64
import io
from dotenv import load_dotenv

load_dotenv()

# Configure APIs
api_key = os.getenv("GEMINI_API_KEY")
elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")

if api_key:
    genai.configure(api_key=api_key)
else:
    print("Warning: GEMINI_API_KEY not found")

if not elevenlabs_api_key:
    print("Warning: ELEVENLABS_API_KEY not found")

model = genai.GenerativeModel('gemini-flash-latest')

# ElevenLabs config
ELEVENLABS_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"  # Daniel - British News Anchor


def strip_vocal_tags(text: str) -> str:
    """Remove {instruction}(text) tags, keep just the text."""
    pattern = r'\{[^}]+\}\(([^)]+)\)'
    cleaned = re.sub(pattern, r'\1', text)
    cleaned = re.sub(r'\{[^}]*\}', '', cleaned)
    return re.sub(r'\s+', ' ', cleaned).strip()


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


def refine_commentary_with_style(commentary: str) -> str:
    """
    Refines basic commentary into Peter Drury-style dramatic commentary.
    Enforces 15-word limit for snappy delivery.
    """
    try:
        from prompts import DIRECTORIAL_STYLE_PROMPT
        
        # Use Gemini Flash 2.0 for refinement
        refinement_model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        full_prompt = f"{DIRECTORIAL_STYLE_PROMPT}\n\n{commentary}"
        response = refinement_model.generate_content(full_prompt)
        
        refined_text = response.text.strip()
        print(f"✨ Refined commentary: {refined_text}")
        return refined_text
    except Exception as e:
        print(f"Error refining commentary: {e}")
        # Fallback to original commentary with basic formatting
        return f"{{shout}}({commentary})"


def generate_audio_from_text(text: str) -> bytes:
    """
    Generates audio using ElevenLabs TTS API.
    Fast (~1-3s) with Daniel voice (British news anchor).
    Returns MP3 audio bytes.
    """
    try:
        if not text:
            return None
        
        from elevenlabs.client import ElevenLabs
        from elevenlabs import VoiceSettings
        
        if not elevenlabs_api_key:
            print("ElevenLabs API key not found")
            return None
        
        # Strip vocal tags - ElevenLabs doesn't use them
        clean_text = strip_vocal_tags(text)
        print(f"🎤 TTS input: {clean_text}")
        
        client = ElevenLabs(api_key=elevenlabs_api_key)
        
        audio_generator = client.text_to_speech.convert(
            text=clean_text,
            voice_id=ELEVENLABS_VOICE_ID,
            model_id="eleven_multilingual_v2",
            voice_settings=VoiceSettings(
                stability=0.35,        # Dynamic delivery
                similarity_boost=0.75,  # Clear voice
                style=0.60,            # Engaging style
                use_speaker_boost=True
            )
        )
        
        audio_data = b"".join(audio_generator)
        print(f"🔊 ElevenLabs audio: {len(audio_data)} bytes")
        return audio_data
        
    except Exception as e:
        print(f"Error with ElevenLabs TTS: {e}")
        return None


def generate_dramatic_commentary(scenario: str = "checkmate") -> str:
    """
    Generates a text-only dramatic commentary script for testing TTS.
    """
    try:
        prompt = f"""
        You are a dramatic chess commentator (Peter Drury style).
        Generate an intense commentary for a '{scenario}' scenario.
        
        CRITICAL: Maximum 15 words. Use vocal tags:
        {{deep}}, {{whisper}}, {{fast}}, {{shout}}, {{slow}}
        
        Example: {{whisper}}(The moment...) {{shout}}(CHECKMATE!)
        
        Generate ONLY the script. No other text.
        """
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error generating commentary text: {e}")
        return "{shout}(Error generating text.)"

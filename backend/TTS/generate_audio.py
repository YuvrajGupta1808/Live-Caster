
import os
import sys
import wave
from pathlib import Path
from google import genai
from google.genai import types

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend import gemini_service

# Load .env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    # Check parent directory
    parent_env = Path(__file__).parent.parent / '.env'
    if parent_env.exists():
        load_dotenv(parent_env)
except ImportError:
    pass

def wave_file(filename, data):
    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(data)

def main():
    # Load environment variables
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("Error: GEMINI_API_KEY not found.")
        return

    client = genai.Client(api_key=api_key)

    # 1. Dynamic Text Generation (Integration)
    print("Fetching dynamic commentary from gemini_service...")
    commentary_text = gemini_service.generate_dramatic_commentary(scenario="sacrificial attack")
    
    # Fallback if generation fails
    if not commentary_text:
        commentary_text = "{normal}(System error. Could not generate text.)"
        
    print(f"Generated Commentary: {commentary_text}")

    print("Generating audio...")
    # 2. Generate Audio
    # Updated Prompt: SPEED INCREASE + SYNTAX CONTROL
    prompt = (
        "Say in a voice that is Male, British. "
        "BASE TONE: Bold, Deep, Grainy, Serious (George-style). "
        "SPEED: FAST-PACED. Do not drag. Keep it rapid and urgent. "
        
        "IMPORTANT: SYNTAX CONTROL INSTRUCTIONS "
        "If you see text in the format '{instruction}(text)', you must apply that specific vocal instruction ONLY to that block of text. "
        "Example: '{whisper}(hello)' means whisper the word 'hello'. "
        "Example: '{shout}(GOAL!)' means shout the word 'GOAL!'. "
        "Follow these inline directions precisely to change pitch, speed, or volume for that specific segment. "
        
        "Accent: Crisp Received Pronunciation (RP), with a rougher, deeper edge. "
    )
    
    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=f"{prompt} {commentary_text}",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Fenrir',
                    )
                )
            ),
        )
    )

    if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
        data = response.candidates[0].content.parts[0].inline_data.data
        if data:
            file_name = 'george_commentary.wav'
            wave_file(file_name, data)
            print(f"Audio saved to {file_name}")
        else:
            print("No audio data found in response.")
    else:
        print("No candidates returned.")

if __name__ == "__main__":
    main()

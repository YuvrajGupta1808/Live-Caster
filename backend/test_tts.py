"""
Test script for Gemini 2.5 Flash Preview TTS
"""
from google import genai
from google.genai import types
import wave
import os
from dotenv import load_dotenv

load_dotenv()

def wave_file(filename, pcm, channels=1, rate=24000, sample_width=2):
    """Save PCM audio data to a WAV file"""
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)

def test_tts():
    """Test the Gemini TTS functionality"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment variables")
        return
    
    client = genai.Client(api_key=api_key)
    
    print("🎤 Generating speech with Gemini 2.5 Flash Preview TTS...")
    
    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents="Say cheerfully: Have a wonderful day!",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name='Kore',
                    )
                )
            ),
        )
    )
    
    data = response.candidates[0].content.parts[0].inline_data.data
    
    file_name = 'test_output.wav'
    wave_file(file_name, data)
    
    print(f"✅ Audio saved to {file_name}")

if __name__ == "__main__":
    test_tts()

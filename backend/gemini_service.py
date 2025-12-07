import os
import google.generativeai as genai
from google import genai as genai_client
from google.genai import types
import base64
import io
import wave
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
else:
    print("Warning: GEMINI_API_KEY not found in environment variables")

model = genai.GenerativeModel('gemini-flash-latest')
client = genai_client.Client(api_key=api_key) if api_key else None

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

def analyze_image_stream_with_audio(base64_image: str, prompt: str):
    """
    Streams commentary and generates audio in parallel.
    Yields JSON objects with text chunks and audio when ready.
    """
    import json
    import threading
    import queue
    
    try:
        print("🎬 Starting stream with audio generation...", flush=True)
        
        # Remove header if present
        if "base64," in base64_image:
            base64_image = base64_image.split("base64,")[1]

        image_data = base64.b64decode(base64_image)
        
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_data
        }

        # Collect text for audio generation
        full_text = ""
        audio_queue = queue.Queue()
        audio_generated = [False]  # Use list to make it mutable in nested function
        audio_thread = None
        
        def generate_audio_async(text):
            print(f"🎤 Starting audio generation for: {text[:50]}...", flush=True)
            audio = text_to_speech(text)
            if audio:
                print(f"✅ Audio generated successfully, length: {len(audio)}", flush=True)
                audio_queue.put(audio)
                audio_generated[0] = True
            else:
                print("❌ Audio generation returned None", flush=True)
        
        response = model.generate_content([prompt, image_part], stream=True)
        
        chunk_count = 0
        for chunk in response:
            if chunk.text:
                chunk_count += 1
                full_text += chunk.text
                
                # Send text chunk immediately
                yield json.dumps({"type": "text", "data": chunk.text}) + "\n"
                
                # Start audio generation after collecting enough text (30 chars)
                if not audio_generated[0] and len(full_text) > 30 and audio_thread is None:
                    print(f"🚀 Triggering audio generation after {len(full_text)} chars", flush=True)
                    audio_thread = threading.Thread(target=generate_audio_async, args=(full_text,))
                    audio_thread.start()
        
        print(f"📝 Text streaming complete. Total chunks: {chunk_count}, Total text length: {len(full_text)}", flush=True)
        
        # Wait for audio to complete and send it
        if audio_thread:
            print("⏳ Waiting for audio generation to complete...", flush=True)
            audio_thread.join(timeout=15)
            
        if audio_generated[0]:
            try:
                audio_data = audio_queue.get(timeout=1)
                print(f"📤 Sending audio data to client", flush=True)
                yield json.dumps({"type": "audio", "data": audio_data}) + "\n"
            except queue.Empty:
                print("❌ Audio queue was empty", flush=True)
        else:
            print("⚠️ No audio was generated", flush=True)
        
        # Send completion signal
        yield json.dumps({"type": "done"}) + "\n"
        print("✅ Stream complete", flush=True)
        
    except Exception as e:
        print(f"❌ Error calling Gemini stream with audio: {e}", flush=True)
        import traceback
        traceback.print_exc()
        yield json.dumps({"type": "error", "data": str(e)}) + "\n"

def text_to_speech(text: str) -> str:
    """
    Converts text to speech using Gemini 2.5 Flash Preview TTS and returns base64 encoded audio.
    """
    try:
        if not text or not client:
            return None
        
        # Generate speech using Gemini TTS
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=f"Say cheerfully: {text}",
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
        
        # Extract PCM audio data
        pcm_data = response.candidates[0].content.parts[0].inline_data.data
        
        # Convert PCM to WAV format with proper headers
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(24000)  # 24kHz sample rate
            wav_file.writeframes(pcm_data)
        
        # Get WAV data and encode to base64
        wav_buffer.seek(0)
        wav_data = wav_buffer.read()
        audio_base64 = base64.b64encode(wav_data).decode('utf-8')
        
        return audio_base64
    except Exception as e:
        print(f"Error generating speech with Gemini TTS: {e}")
        import traceback
        traceback.print_exc()
        return None

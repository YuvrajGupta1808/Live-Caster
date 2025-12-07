
import os
from pathlib import Path

# Load .env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
    # Also look in parent directory .env
    parent_env = Path(__file__).parent.parent / '.env'
    if parent_env.exists():
        load_dotenv(parent_env)
except ImportError:
    pass

try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import save
except ImportError:
    print("Error: elevenlabs library not installed. Run: pip install elevenlabs")
    exit(1)

def main():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("Error: ELEVENLABS_API_KEY not found in .env")
        return

    client = ElevenLabs(api_key=api_key)

    # 1. Hardcoded Text (Aggressive Drury Style - New Script)
    # Directorial cues: Quiet tension building to explosive release
    commentary_text = "The stadium holds its breath... he contemplates the impossible... AND HE GOES FOR IT! THE KNIGHT SACRIFICE! MAGNIFICENT! DO YOU BELIEVE IT?!"
    
    # 2. Generate Audio (Aggressive Variants)
    voices_to_test = [
        {"name": "Daniel", "id": "onwK4e9ZLuTAKqWW03F9", "desc": "Authoritative British News (Aggressive)"},
        {"name": "George", "id": "JBFqnCBsd6RMkjVDRZzb", "desc": "Warm British Narration (Aggressive)"}
    ]

    from elevenlabs import VoiceSettings

    for voice in voices_to_test:
        print(f"Generating ElevenLabs audio for: {voice['name']} ({voice['desc']})...")
        try:
            audio_generator = client.text_to_speech.convert(
                text=commentary_text,
                voice_id=voice['id'],
                model_id="eleven_multilingual_v2",
                voice_settings=VoiceSettings(
                    stability=0.30, # Low stability to force dynamic delivery (25-35 range)
                    similarity_boost=0.70, # clarity/similarity boost (60-75 range)
                    style=0.75, # High style exaggeration (70-85 range)
                    use_speaker_boost=True
                )
            )
            
            audio_data = b"".join(audio_generator)
            file_name = f"elevenlabs_drury_aggressive_{voice['name'].lower()}.wav"
            
            with open(file_name, "wb") as f:
                f.write(audio_data)
            print(f"Audio saved to {file_name}")
            
        except Exception as e:
            print(f"Error generating for {voice['name']}: {e}")
        


if __name__ == "__main__":
    main()

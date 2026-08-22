# Live Caster

Live Caster is an AI-powered real-time game commentary system that watches your screen, understands the current gameplay frame, and generates short hype-caster style commentary with optional voice narration.

This project won 3rd prize at the Google DeepMind x Cerebral Valley Gemini Hackathon.

## What It Does

- Captures frames from a live shared screen in the browser
- Sends those frames to Gemini for vision-based game understanding
- Generates ultra-short dramatic commentary
- Refines the line into a more theatrical shoutcaster style
- Optionally converts the final commentary into speech using ElevenLabs

The current frontend copy is chess-focused, but the prompt pipeline is already written to support multiple games.

## Configuration

| Env var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Gemini vision + refinement (required) |
| `ELEVENLABS_API_KEY` | TTS narration (optional) |
| `LIVECASTER_ALLOWED_ORIGINS` | Comma-separated CORS origins (defaults to localhost dev ports) |

Run backend tests with `python -m pytest backend/tests -q`.

## Demo Flow

1. Start screen sharing from the frontend
2. The app captures a frame every 5 seconds
3. The backend sends the frame to Gemini
4. Gemini returns a short line of commentary
5. A second prompt sharpens the line into dramatic caster-style delivery
6. The app optionally plays back narration using ElevenLabs TTS

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + Uvicorn
- Vision + LLM: Gemini 2.5 Flash
- Text to Speech: ElevenLabs

## Project Structure

```text
Live-Caster/
├── backend/
│   ├── main.py
│   ├── gemini_service.py
│   ├── prompts.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Requirements

- Python 3.10+
- Node.js 18+
- A Gemini API key
- An ElevenLabs API key for voice output

## Environment Variables

Create a `.env` file inside [`backend`](/Users/shreyasyadav/personal-tools/Live-Caster/backend) with:

```env
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

If `ELEVENLABS_API_KEY` is omitted, the app can still run with text-only commentary.

## Local Setup

### 1. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The FastAPI server runs on `http://localhost:8000`.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite app runs on `http://localhost:5173`.

## How To Use

1. Open the frontend in your browser
2. Click `Start Commentary`
3. Share the game window or browser tab
4. Let the app analyze frames and generate live commentary
5. Toggle voice narration on if ElevenLabs is configured
6. Use `New Game` to clear the commentary feed

## API Endpoints

### `POST /analyze`

Accepts a base64 image and returns:

- `text`: refined final commentary
- `original_text`: raw commentary before style refinement
- `audio`: base64-encoded MP3 when TTS is enabled
- `timing`: pipeline timing breakdown

### `POST /analyze-stream`

Streams commentary chunks and then emits the refined result. This is intended for lower-latency UI updates.

## Current Behavior

- Captures one frame every 5 seconds
- Uses a 15-word maximum commentary style
- Supports streaming and non-streaming inference modes
- Defaults to local development CORS settings

## Notes

- The UI currently labels the experience as `Chess Commentary AI`
- The prompt layer is more general and can be extended for other esports or sports-like viewing experiences
- The backend currently targets local development only

## Future Improvements

- Add automatic game detection in the UI
- Support more commentary voices and styles
- Improve stream parsing for cleaner incremental updates
- Add deployment configuration and production-safe CORS
- Store match commentary history
- Tune frame capture intervals dynamically based on game pace

## Acknowledgment

Built during the Google DeepMind x Cerebral Valley Gemini Hackathon.

# Live Caster

[![CI](https://github.com/YuvrajGupta1808/Live-Caster/actions/workflows/ci.yml/badge.svg)](https://github.com/YuvrajGupta1808/Live-Caster/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Live Caster is a real-time screen narrator and voice assistant — an
**accessibility tool** for blind and low-vision users. Share any window and a
Gemini Live session watches it and **speaks**: describing what's on screen,
reading out text that matters, and reacting to changes as they happen —
native voice straight from the model, no separate TTS step.

It's a two-way conversation: **talk over it at any time** and it stops
mid-sentence (true barge-in via Gemini's voice-activity detection), listens,
answers your question about what it sees — where a button is, what an error
says, a summary of the page — then resumes narrating. Everything both of you
say appears as live captions.

This project won 3rd prize at the Google DeepMind x Cerebral Valley Gemini
Hackathon.

<!-- TODO: 15-second demo GIF here — live narration appearing over a shared
     screen, caption noting the audio narration. -->

## How It Works

```text
browser ──(changed JPEG frames + mic audio 16kHz PCM, WebSocket)──▶ FastAPI bridge
                                                                        │
                                                              Gemini Live API session
                                                              (bidirectional stream,
                                                               VAD + barge-in)
                                                                        │
browser ◀──(native audio 24kHz PCM + both-side transcription, WS)───────┘
```

- The frontend captures a frame every 2 seconds, but **diffs consecutive
  frames** (downscaled grayscale grid) and skips the API call entirely when
  the screen hasn't changed — no cost, and no narrating a static board.
- One Gemini Live session spans the whole broadcast, so the model remembers
  everything it already said: lines continue the story instead of repeating
  disconnected captions.
- The model replies with **native audio** (24kHz PCM) plus a text
  transcription; the browser plays the voice and renders the transcript
  simultaneously.
- The UI shows **time-to-first-word** for every line — "real-time" as a
  measurement, not an adjective — plus a counter of skipped unchanged frames.

## Features

- **Live narration** of anything on screen — apps, pages, alerts, errors —
  prioritizing meaning over pixels
- **True barge-in**: speak and it stops mid-sentence, answers, then resumes
- **Google Search tool**: the model can search the web when the screen alone
  isn't enough; searches appear inline in the transcript
- **Session history**: every session's transcript (narration, your questions,
  tool calls) is stored and browsable in the sidebar
- **Frame change detection**: unchanged frames are skipped client-side —
  no cost, no narrating a static screen; sent frames are downscaled to
  ~1024px to cut token spend
- **Sentence-complete narration**: new frames wait for the current line to
  finish (only your voice interrupts); the freshest frame is spoken next
- **Fully keyboard-operable**: `Space` start/stop, `M` mute, `D` describe
  the screen right now, `R` repeat the last line — plus a slow-speech
  toggle and a light/dark theme switch
- **Quiet mode**: opt-in on the cover page — the narrator stays silent
  except for things that need your attention (errors, alerts, finished
  tasks)
- **Self-healing sessions**: dropped Gemini connections resume with full
  context via Live API session resumption; idle sessions auto-end after
  5 minutes so a forgotten tab never burns credits
- **Demo mode**: open `/?demo=1` to run the full pipeline against a
  synthetic animated screen — no screen share needed (handy for recording
  demos)

## Measured Latency

Real numbers from a live session (`gemini-live-2.5-flash-native-audio`,
Vertex AI `us-central1`, three consecutive frames):

| Metric | Measured |
|---|---|
| Time to first spoken word | 0.58s – 1.09s |
| Audio | Native 24kHz PCM, streamed while the model is still speaking |
| Transport | One WebSocket session end to end |

The UI displays time-to-first-word live for every line.

## Live App

**https://livecaster.yuvrajgupta.com** — sign in with a one-time email
link, then hit Start and share a window.

Deployed on Google Cloud Run; see [DEPLOYMENT.md](DEPLOYMENT.md) for the
infrastructure and the reasoning behind it.

## Quick Start

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # configure auth (see below)
python main.py
```

Frontend (Node 22+):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, hit **Start**, grant microphone access, and
share the window you want narrated.

## Configuration

Two auth options (set in `backend/.env`):

**Vertex AI via gcloud (preferred — no secret stored).** Run
`gcloud auth application-default login` once, then:

| Env var | Purpose |
|---|---|
| `LIVECASTER_VERTEX_PROJECT` | GCP project to bill (required for this option) |
| `LIVECASTER_VERTEX_LOCATION` | Vertex region (defaults to `us-central1`) |

**Gemini Developer API key** (from [AI Studio](https://aistudio.google.com/apikey)):

| Env var | Purpose |
|---|---|
| `GEMINI_API_KEY` | API key (`AIza…`; for a Vertex express key also set `LIVECASTER_USE_VERTEXAI=true`) |

Optional for both:

| Env var | Purpose |
|---|---|
| `LIVECASTER_LIVE_MODEL` | Live model override (defaults to `gemini-live-2.5-flash-native-audio` on Vertex, `gemini-2.5-flash-native-audio-preview-09-2025` on the Developer API) |
| `LIVECASTER_ALLOWED_ORIGINS` | Comma-separated CORS origins (defaults to localhost dev ports) |

## Tech Stack

- Frontend: React + Vite + Tailwind CSS, Web Audio API for PCM playback
- Backend: FastAPI + Uvicorn, WebSocket bridge to the Gemini Live API
- Model: Gemini 2.5 Flash native audio (Live API, bidirectional streaming)

## Development

Run backend tests:

```bash
python -m pytest backend/tests -q
```

CI runs the backend test suite and a production frontend build on every push
and pull request.

## License

[MIT](LICENSE)

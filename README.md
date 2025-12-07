# Commentary.AI 🎮

An AI-powered live commentary system that provides real-time analysis and voice commentary for screen captures. Built with React, FastAPI, and Google's Gemini AI.

## Features

- 🎬 **Real-time Screen Capture** - Capture and stream your screen content
- 🤖 **AI-Powered Commentary** - Get intelligent commentary using Google Gemini
- 🔊 **Text-to-Speech** - Hear the commentary with AI-generated voice
- 💬 **Live Streaming** - Real-time text streaming for instant feedback
- 📝 **Session History** - Save and review past commentary sessions
- 🎨 **Modern UI** - Clean, responsive interface with resizable panels

## Tech Stack

### Frontend
- React 19
- Vite
- Tailwind CSS
- Screen Capture API

### Backend
- FastAPI
- Google Generative AI (Gemini)
- Python 3.x
- Uvicorn

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8+
- Google Gemini API Key

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <project-directory>
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your API key
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend Server

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

The backend will run on `http://localhost:8000`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. Open the application in your browser
2. Click "Start Stream" to begin a new commentary session
3. Select the screen/window you want to capture
4. Toggle "Voice On/Off" to enable/disable audio commentary
5. Watch as AI provides real-time commentary on your screen content
6. Access previous sessions from the left sidebar

## API Endpoints

- `POST /analyze` - Analyze a single frame with optional audio
- `POST /analyze-stream` - Stream text commentary in real-time
- `POST /analyze-stream-audio` - Stream both text and audio commentary
- `POST /generate-audio` - Generate audio from text

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── gemini_service.py    # Gemini AI integration
│   ├── prompts.py           # AI prompts
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── api.js           # API client
│   │   └── useScreenCapture.js  # Screen capture hook
│   ├── package.json         # Node dependencies
│   └── vite.config.js       # Vite configuration
└── README.md
```

## Configuration

### Backend (.env)
```
GEMINI_API_KEY=your_gemini_api_key
```

### Frontend (api.js)
Update the API base URL if needed:
```javascript
const API_BASE_URL = 'http://localhost:8000';
```

## Development

### Backend Testing

```bash
cd backend
python test_backend.py
python test_api_key.py
python test_tts.py
```

### Frontend Build

```bash
cd frontend
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- Google Gemini AI for powering the commentary
- React and FastAPI communities
- All contributors and testers
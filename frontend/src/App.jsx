import { useState, useRef, useCallback, useEffect } from 'react';
import { useScreenCapture } from './useScreenCapture';
import { LiveSession, PcmPlayer } from './live';
import { MicStreamer } from './mic';
import { fetchSessions, fetchSession } from './api';
import CoverPage from './components/CoverPage';
import SessionSidebar from './components/SessionSidebar';
import ScreenPanel from './components/ScreenPanel';
import ChatPanel from './components/ChatPanel';

// Mic RMS above this counts as the user speaking; narration nudges pause
// for a short window afterwards so answers are never talked over.
const SPEECH_LEVEL = 0.02;
const SPEECH_HOLD_MS = 3000;

function App() {
  const [view, setView] = useState('cover'); // cover | workspace
  const [status, setStatus] = useState('idle'); // idle | connecting | live | error
  const [errorMessage, setErrorMessage] = useState('');
  const [feed, setFeed] = useState([]); // {kind: 'model'|'user'|'tool', text, timestamp, final}
  const [timeToFirstWord, setTimeToFirstWord] = useState(null);
  const [skippedFrames, setSkippedFrames] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [lastFrame, setLastFrame] = useState(null);
  const [lastFrameAt, setLastFrameAt] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null); // {id, mode, feed}

  const sessionRef = useRef(null);
  const playerRef = useRef(null);
  const micRef = useRef(null);
  const frameSentAtRef = useRef(null);
  const awaitingAudioRef = useRef(false);
  const lastSpeechAtRef = useRef(0);

  const refreshSessions = useCallback(async () => {
    setSessions(await fetchSessions());
  }, []);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const clearAll = useCallback(() => {
    setFeed([]);
    setTimeToFirstWord(null);
    setSkippedFrames(0);
    setUserSpeaking(false);
    setLastFrame(null);
    setLastFrameAt(null);
  }, []);

  const appendToFeed = useCallback((kind, content) => {
    setFeed((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && !last.final && last.kind === kind) {
        next[next.length - 1] = { ...last, text: last.text + content };
      } else {
        if (last && !last.final) next[next.length - 1] = { ...last, final: true };
        next.push({ kind, text: content, timestamp: new Date(), final: false });
      }
      return next;
    });
  }, []);

  const finalizeFeed = useCallback(() => {
    setFeed((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && !last.final) next[next.length - 1] = { ...last, final: true };
      return next;
    });
  }, []);

  const handleLiveEvent = useCallback((event) => {
    switch (event.type) {
      case 'session':
        break; // recorded server-side; history refreshes on session end

      case 'ready':
        setStatus('live');
        break;

      case 'audio':
        if (awaitingAudioRef.current && frameSentAtRef.current) {
          setTimeToFirstWord((performance.now() - frameSentAtRef.current) / 1000);
          awaitingAudioRef.current = false;
        }
        playerRef.current?.play(event.data);
        break;

      case 'text':
        appendToFeed('model', event.content);
        break;

      case 'user_text':
        appendToFeed('user', event.content);
        break;

      case 'tool_call':
        setFeed((prev) => [...prev, { kind: 'tool', text: event.content, timestamp: new Date(), final: true }]);
        break;

      case 'interrupted':
        playerRef.current?.flush();
        finalizeFeed();
        break;

      case 'turn_complete':
        finalizeFeed();
        break;

      case 'error':
        setStatus('error');
        setErrorMessage(event.content);
        break;

      case 'closed':
        setStatus((s) => (s === 'error' ? s : 'idle'));
        break;

      default:
        break;
    }
  }, [appendToFeed, finalizeFeed]);

  const handleFrameCaptured = useCallback((frame) => {
    const session = sessionRef.current;
    if (!session || !session.isOpen) return;
    const userTalking = performance.now() - lastSpeechAtRef.current < SPEECH_HOLD_MS;
    if (session.sendFrame(frame, !userTalking)) {
      setLastFrame(frame);
      setLastFrameAt(new Date());
      if (!userTalking) {
        frameSentAtRef.current = performance.now();
        awaitingAudioRef.current = true;
      }
    }
  }, []);

  const handleFrameSkipped = useCallback(() => {
    setSkippedFrames((n) => n + 1);
  }, []);

  const {
    isSharing,
    startCapture,
    stopCapture,
    videoRef,
    canvasRef
  } = useScreenCapture(handleFrameCaptured, handleFrameSkipped);

  const handleStart = async () => {
    clearAll();
    setViewingSession(null);
    setErrorMessage('');
    setStatus('connecting');
    setView('workspace');

    // AudioContext must be created inside a user gesture to autoplay.
    playerRef.current = new PcmPlayer();
    playerRef.current.ensureContext();

    const session = new LiveSession({ onEvent: handleLiveEvent });
    sessionRef.current = session;
    session.connect();

    const mic = new MicStreamer({
      onChunk: (b64) => sessionRef.current?.sendAudio(b64),
      onLevel: (level) => {
        if (level > SPEECH_LEVEL) {
          lastSpeechAtRef.current = performance.now();
          setUserSpeaking(true);
        } else if (performance.now() - lastSpeechAtRef.current > 600) {
          setUserSpeaking(false);
        }
      },
    });
    micRef.current = mic;
    try {
      await mic.start();
    } catch (err) {
      console.warn('Microphone unavailable; continuing without voice input.', err);
      micRef.current = null;
    }

    await startCapture();
  };

  const handleStop = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    stopCapture();
    setStatus('idle');
    setIsMuted(false);
    refreshSessions();
    setView('cover');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    micRef.current?.setMuted(next);
  };

  const handleSelectSession = async (id) => {
    if (status === 'live' || status === 'connecting') return; // don't leave a live session
    const data = await fetchSession(id);
    if (!data) return;
    setViewingSession({
      id: data.id,
      feed: data.entries.map((e) => ({
        kind: e.kind,
        text: e.text,
        timestamp: new Date(e.ts * 1000),
        final: true,
      })),
    });
    setView('workspace');
  };

  const handleNewSession = () => {
    setViewingSession(null);
    clearAll();
    setStatus('idle');
    setErrorMessage('');
    setView('cover');
  };

  const isViewingHistory = viewingSession !== null && status !== 'live' && status !== 'connecting';

  if (view === 'cover') {
    return (
      <CoverPage
        onStart={handleStart}
        onHistory={() => setView('workspace')}
        hasHistory={sessions.length > 0}
      />
    );
  }

  const statusBadge = {
    idle: { text: 'OFFLINE', className: 'text-zinc-600 border-zinc-800' },
    connecting: { text: 'CONNECTING', className: 'text-yellow-400 border-yellow-400/50 animate-pulse' },
    live: { text: '● LIVE', className: 'text-yellow-400 border-yellow-400' },
    error: { text: 'ERROR', className: 'text-yellow-300 border-yellow-400/50' },
  }[status];

  return (
    <div className="h-screen bg-black text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-900 shrink-0">
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={handleNewSession}
            className="font-bold tracking-[0.25em] text-sm hover:opacity-80 transition-opacity"
            aria-label="Back to start"
          >
            <span className="text-yellow-400">LIVE</span> CASTER
          </button>
          <span
            role="status"
            aria-live="polite"
            className={`px-3 py-1 rounded-full text-xs font-bold border tracking-widest ${statusBadge.className}`}
          >
            {statusBadge.text}
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <SessionSidebar
          sessions={sessions}
          selectedId={viewingSession?.id}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          isLive={status === 'live' || status === 'connecting'}
        />

        <ScreenPanel
          isSharing={isSharing}
          isViewingHistory={isViewingHistory}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onStop={handleStop}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          userSpeaking={userSpeaking}
          lastFrame={lastFrame}
          lastFrameAt={lastFrameAt}
          timeToFirstWord={timeToFirstWord}
          skippedFrames={skippedFrames}
          status={status}
          errorMessage={errorMessage}
        />

        <ChatPanel
          feed={isViewingHistory ? viewingSession.feed : feed}
          status={status}
          isViewingHistory={isViewingHistory}
          historyTitle={isViewingHistory ? 'Past Session' : ''}
        />
      </div>
    </div>
  );
}

export default App;

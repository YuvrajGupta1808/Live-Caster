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

// A session with no screen changes and no speech for this long ends
// itself — Live sessions bill continuously, and a forgotten tab shouldn't.
const IDLE_LIMIT_MS = 5 * 60 * 1000;

function loadTheme() {
  try {
    return localStorage.getItem('lc-theme') || 'dark';
  } catch {
    return 'dark';
  }
}

function App() {
  const [view, setView] = useState('cover'); // cover | workspace
  const [theme, setTheme] = useState(loadTheme);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState('idle'); // idle | connecting | live | error
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [feed, setFeed] = useState([]); // {kind: 'model'|'user'|'tool'|'frame', ...}
  const [timeToFirstWord, setTimeToFirstWord] = useState(null);
  const [skippedFrames, setSkippedFrames] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [quietMode, setQuietMode] = useState(false);
  const [slowVoice, setSlowVoice] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [sessions, setSessions] = useState([]);
  const [viewingSession, setViewingSession] = useState(null); // {id, feed}

  const sessionRef = useRef(null);
  const playerRef = useRef(null);
  const micRef = useRef(null);
  const frameSentAtRef = useRef(null);
  const awaitingAudioRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const currentTurnAudioRef = useRef([]);
  const lastTurnAudioRef = useRef([]);
  const lastActivityRef = useRef(0);
  const startedAtRef = useRef(null);
  const statusRef = useRef('idle');
  statusRef.current = status;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('lc-theme', theme);
    } catch {
      // storage unavailable; theme just won't persist
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const refreshSessions = useCallback(async () => {
    setSessions(await fetchSessions());
  }, []);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const clearAll = useCallback(() => {
    setFeed([]);
    setTimeToFirstWord(null);
    setSkippedFrames(0);
    setUserSpeaking(false);
    setElapsed(0);
    currentTurnAudioRef.current = [];
    lastTurnAudioRef.current = [];
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

  // Consecutive outgoing frames collapse into one stream line that keeps
  // the latest thumbnail and a running count, so the log stays readable.
  const appendFrameToFeed = useCallback((img) => {
    setFeed((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.kind === 'frame') {
        next[next.length - 1] = { ...last, img, count: last.count + 1, timestamp: new Date() };
      } else {
        next.push({ kind: 'frame', img, count: 1, timestamp: new Date(), final: true });
      }
      return next;
    });
  }, []);

  const handleLiveEvent = useCallback((event) => {
    switch (event.type) {
      case 'session':
        break; // recorded server-side; history refreshes on session end

      case 'ready':
        setStatus('live');
        startedAtRef.current = performance.now();
        lastActivityRef.current = performance.now();
        break;

      case 'audio':
        if (awaitingAudioRef.current && frameSentAtRef.current) {
          setTimeToFirstWord((performance.now() - frameSentAtRef.current) / 1000);
          awaitingAudioRef.current = false;
        }
        currentTurnAudioRef.current.push(event.data);
        lastActivityRef.current = performance.now();
        playerRef.current?.play(event.data);
        break;

      case 'text':
        appendToFeed('model', event.content);
        break;

      case 'user_text':
        appendToFeed('user', event.content);
        lastActivityRef.current = performance.now();
        break;

      case 'tool_call':
        setFeed((prev) => [...prev, { kind: 'tool', text: event.content, timestamp: new Date(), final: true }]);
        break;

      case 'interrupted':
        playerRef.current?.flush();
        if (currentTurnAudioRef.current.length) {
          lastTurnAudioRef.current = currentTurnAudioRef.current;
          currentTurnAudioRef.current = [];
        }
        finalizeFeed();
        break;

      case 'turn_complete':
        if (currentTurnAudioRef.current.length) {
          lastTurnAudioRef.current = currentTurnAudioRef.current;
          currentTurnAudioRef.current = [];
        }
        finalizeFeed();
        break;

      case 'error':
        setStatus('error');
        setErrorMessage(event.content);
        break;

      case 'closed':
        finalizeFeed(); // no stray streaming cursor after the session ends
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
      appendFrameToFeed(frame);
      lastActivityRef.current = performance.now();
      if (!userTalking) {
        frameSentAtRef.current = performance.now();
        awaitingAudioRef.current = true;
      }
    }
  }, [appendFrameToFeed]);

  const handleFrameSkipped = useCallback(() => {
    setSkippedFrames((n) => n + 1);
  }, []);

  const {
    isSharing,
    startCapture,
    stopCapture,
    captureNow,
    videoRef,
    canvasRef
  } = useScreenCapture(handleFrameCaptured, handleFrameSkipped);

  const handleStart = useCallback(async () => {
    clearAll();
    setViewingSession(null);
    setErrorMessage('');
    setNotice('');
    setSlowVoice(false);
    setStatus('connecting');
    setView('workspace');

    // AudioContext must be created inside a user gesture to autoplay.
    playerRef.current = new PcmPlayer();
    playerRef.current.ensureContext();

    const session = new LiveSession({ onEvent: handleLiveEvent, quiet: quietMode });
    sessionRef.current = session;
    session.connect();

    const mic = new MicStreamer({
      onChunk: (b64) => sessionRef.current?.sendAudio(b64),
      onLevel: (level) => {
        if (level > SPEECH_LEVEL) {
          lastSpeechAtRef.current = performance.now();
          lastActivityRef.current = performance.now();
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
  }, [clearAll, handleLiveEvent, quietMode, startCapture]);

  // Ending a session keeps you in the workspace with the transcript on
  // screen; a fresh session starts from the sidebar or the cover.
  const handleStop = useCallback((reason = '') => {
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
    if (reason) setNotice(reason);
  }, [refreshSessions, stopCapture]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      micRef.current?.setMuted(!prev);
      return !prev;
    });
  }, []);

  // "Describe now": capture this instant, skip the diff, force a line.
  const describeNow = useCallback(() => {
    const frame = captureNow();
    const session = sessionRef.current;
    if (!frame || !session || !session.isOpen) return;
    if (session.sendFrame(frame, true)) {
      appendFrameToFeed(frame);
      frameSentAtRef.current = performance.now();
      awaitingAudioRef.current = true;
      lastActivityRef.current = performance.now();
    }
  }, [captureNow, appendFrameToFeed]);

  // "Read that again": replay the audio of the last completed line.
  const repeatLast = useCallback(() => {
    const chunks = lastTurnAudioRef.current;
    if (!chunks.length || !playerRef.current) return;
    playerRef.current.flush();
    chunks.forEach((c) => playerRef.current.play(c));
  }, []);

  const toggleSlowVoice = useCallback(() => {
    setSlowVoice((prev) => {
      const next = !prev;
      sessionRef.current?.sendInstruction(
        next
          ? 'From now on, speak more slowly and enunciate clearly.'
          : 'Return to your normal speaking pace now.'
      );
      return next;
    });
  }, []);

  // Session clock + idle auto-stop.
  useEffect(() => {
    if (status !== 'live') return undefined;
    const tick = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((performance.now() - startedAtRef.current) / 1000));
      }
      if (performance.now() - lastActivityRef.current > IDLE_LIMIT_MS) {
        handleStop('Session ended automatically after 5 minutes of inactivity.');
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [status, handleStop]);

  // Keyboard shortcuts — the app must be fully operable without sight or
  // precise pointing: Space start/stop, M mute, D describe now, R repeat.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (statusRef.current === 'live' || statusRef.current === 'connecting') {
          handleStop();
        } else {
          handleStart();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (statusRef.current === 'live') toggleMute();
      } else if (e.key === 'd' || e.key === 'D') {
        if (statusRef.current === 'live') describeNow();
      } else if (e.key === 'r' || e.key === 'R') {
        if (statusRef.current === 'live') repeatLast();
      } else if (e.key === 's' || e.key === 'S') {
        if (statusRef.current === 'live') toggleSlowVoice();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStart, handleStop, toggleMute, describeNow, repeatLast, toggleSlowVoice]);

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
        theme={theme}
        onToggleTheme={toggleTheme}
        quiet={quietMode}
        onToggleQuiet={() => setQuietMode((q) => !q)}
      />
    );
  }

  const statusBadge = {
    idle: { text: 'OFFLINE', className: 'text-zinc-400 border-zinc-300 dark:text-zinc-600 dark:border-zinc-800' },
    connecting: { text: 'CONNECTING', className: 'text-yellow-600 border-yellow-500/50 dark:text-yellow-400 dark:border-yellow-400/50 animate-pulse' },
    live: { text: '● LIVE', className: 'text-yellow-600 border-yellow-500 dark:text-yellow-400 dark:border-yellow-400' },
    error: { text: 'ERROR', className: 'text-yellow-700 border-yellow-500/50 dark:text-yellow-300 dark:border-yellow-400/50' },
  }[status];

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-900 shrink-0">
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={handleNewSession}
            className="font-bold tracking-[0.25em] text-sm hover:opacity-80 transition-opacity"
            aria-label="Back to start"
          >
            <span className="text-yellow-600 dark:text-yellow-400">LIVE</span> CASTER
          </button>
          <div className="flex items-center gap-3">
            {status === 'live' && (
              <span className="text-sm font-mono text-zinc-400 dark:text-zinc-600" aria-label="Session length">
                {mm}:{ss}
              </span>
            )}
            {status === 'live' && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Session actions"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-sm hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors"
                >
                  ☰
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-20 py-1.5"
                  >
                    {[
                      { label: 'Describe now', key: 'D', onClick: describeNow },
                      { label: 'Repeat last line', key: 'R', onClick: repeatLast },
                      { label: slowVoice ? 'Slow speech ✓' : 'Slow speech', key: 'S', onClick: toggleSlowVoice },
                    ].map((item) => (
                      <button
                        key={item.label}
                        role="menuitem"
                        onClick={() => { item.onClick(); setMenuOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                      >
                        {item.label}
                        <kbd className="text-xs text-zinc-400 dark:text-zinc-600">{item.key}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-sm hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span
              role="status"
              aria-live="polite"
              className={`px-3 py-1 rounded-full text-xs font-bold border tracking-widest ${statusBadge.className}`}
            >
              {statusBadge.text}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <SessionSidebar
          sessions={sessions}
          selectedId={viewingSession?.id}
          onSelect={handleSelectSession}
          onNew={handleNewSession}
          isLive={status === 'live' || status === 'connecting'}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
        />

        <ScreenPanel
          isSharing={isSharing}
          isViewingHistory={isViewingHistory}
          videoRef={videoRef}
          canvasRef={canvasRef}
          onStop={() => handleStop()}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          userSpeaking={userSpeaking}
          status={status}
          errorMessage={errorMessage}
          notice={notice}
        />

        <ChatPanel
          feed={isViewingHistory ? viewingSession.feed : feed}
          status={status}
          isViewingHistory={isViewingHistory}
          timeToFirstWord={timeToFirstWord}
          skippedFrames={skippedFrames}
        />
      </div>
    </div>
  );
}

export default App;

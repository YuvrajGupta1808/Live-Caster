import { useRef, useState } from 'react';
import { streamAnalyzeFrameWithAudio } from './api';
import { useScreenCapture } from './useScreenCapture';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [commentary, setCommentary] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [commentaryWidth, setCommentaryWidth] = useState(384);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const audioRef = useRef(null);
  const commentaryEndRef = useRef(null);

  const handleMouseDownLeft = () => {
    setIsResizingLeft(true);
  };

  const handleMouseDownRight = () => {
    setIsResizingRight(true);
  };

  const handleMouseMove = (e) => {
    if (isResizingLeft) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    }
    if (isResizingRight) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 700) {
        setCommentaryWidth(newWidth);
      }
    }
  };

  const handleMouseUp = () => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  };

  const createNewSession = () => {
    const newSession = {
      id: Date.now(),
      title: `Chess ${sessions.length + 1}`,
      timestamp: new Date(),
      commentary: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSession(newSession.id);
    setCommentary([]);
  };

  const loadSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(sessionId);
      setCommentary(session.commentary);
    }
  };

  const handleFrameCaptured = async (frame) => {
    if (isProcessing || !currentSession) return;

    setIsProcessing(true);

    const newComment = { text: '', timestamp: new Date(), isStreaming: true };
    setCommentary(prev => [...prev, newComment]);

    console.log('🎬 Starting frame analysis, audio enabled:', isAudioEnabled);

    await streamAnalyzeFrameWithAudio(
      frame,
      // onText callback - streams text in real-time
      (textChunk) => {
        setCommentary(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              text: updated[lastIdx].text + textChunk
            };
          }
          return updated;
        });
      },
      // onAudio callback - plays audio when ready
      (audioData) => {
        console.log('🎵 Audio data received, length:', audioData?.length, 'Audio enabled:', isAudioEnabled);
        
        if (audioRef.current) {
          try {
            // Create audio blob and play
            const audioSrc = `data:audio/wav;base64,${audioData}`;
            audioRef.current.src = audioSrc;
            
            console.log('🔊 Attempting to play audio...');
            
            // Always try to play (user can control with Voice button)
            audioRef.current.play()
              .then(() => {
                console.log('✅ Audio playing successfully');
              })
              .catch(err => {
                console.error('❌ Error playing audio:', err);
              });
          } catch (error) {
            console.error('❌ Error setting audio:', error);
          }
        } else {
          console.error('❌ Audio ref is null');
        }
      }
    );

    setCommentary(prev => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0) {
        updated[lastIdx].isStreaming = false;
      }
      
      // Update session
      setSessions(prevSessions => 
        prevSessions.map(s => 
          s.id === currentSession ? { ...s, commentary: updated } : s
        )
      );
      
      return updated;
    });

    setIsProcessing(false);
  };

  const {
    isSharing,
    startCapture,
    stopCapture,
    videoRef,
    canvasRef
  } = useScreenCapture(handleFrameCaptured);

  const handleStartStream = () => {
    createNewSession();
    startCapture();
  };

  return (
    <div 
      className="flex flex-col h-screen bg-white text-black"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Fixed Top Bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="mr-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            ☰
          </button>
        )}
        <h1 className="text-xl font-bold text-yellow-600">Commentary.AI</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Stream History */}
        {isSidebarOpen && (
          <div 
            className="bg-white border-r border-gray-200 flex flex-col relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Stream History</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-gray-400 hover:text-black transition-colors"
              >
                ✕
              </button>
            </div>
          
          <div className="p-3">
            <button
              onClick={handleStartStream}
              disabled={isSharing}
              className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
            >
              + New Stream
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2">
            {sessions.length === 0 ? (
              <p className="text-gray-400 text-xs text-center mt-8 px-4">No streams yet</p>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    currentSession === session.id
                      ? 'bg-yellow-50 border border-yellow-300'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {session.timestamp.toLocaleTimeString()}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-yellow-400 transition-colors"
            onMouseDown={handleMouseDownLeft}
          />
        </div>
      )}

      {/* Center - Main Stream Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          {!isSharing ? (
            <div className="text-center">
              <div className="text-6xl mb-4">🎮</div>
              <p className="text-xl text-gray-600 mb-6">Start streaming</p>
              <button
                onClick={handleStartStream}
                className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg font-semibold transition-colors"
              >
                Start Stream
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <div className="max-w-4xl w-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
                  muted
                  autoPlay
                  playsInline
                />
              </div>
              
              {/* Stream Controls Overlay */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full border border-gray-200 shadow-lg">
                <button
                  onClick={stopCapture}
                  className="px-5 py-2 bg-black hover:bg-gray-800 text-white rounded-full font-medium transition-colors text-sm"
                >
                  Stop Stream
                </button>
                
                <button
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  className={`px-5 py-2 rounded-full font-medium transition-colors text-sm ${
                    isAudioEnabled
                      ? 'bg-yellow-400 hover:bg-yellow-500 text-black'
                      : 'bg-gray-200 hover:bg-gray-300 text-black'
                  }`}
                >
                  {isAudioEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
                </button>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

        {/* Right Sidebar - Commentary */}
        <div 
          className="bg-white border-l border-gray-200 flex flex-col relative"
          style={{ width: `${commentaryWidth}px` }}
        >
          {/* Resize Handle */}
          <div
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-yellow-400 transition-colors z-10"
            onMouseDown={handleMouseDownRight}
          />

          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-yellow-600">
              {isSharing && <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>}
              Live Commentary
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {commentary.length === 0 ? (
              <div className="text-center mt-20">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-gray-400 text-sm">Commentary will appear here</p>
              </div>
            ) : (
              commentary.map((item, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {item.text}
                    {item.isStreaming && <span className="inline-block w-1 h-4 bg-yellow-400 ml-1 animate-pulse"></span>}
                  </p>
                  <span className="text-xs text-gray-400 mt-2 block">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={commentaryEndRef} />
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" preload="auto" />
    </div>
  );
}

export default App;

import { useState, useRef, useCallback } from 'react';
import { useScreenCapture } from './useScreenCapture';
import { analyzeFrame, streamAnalyzeFrame } from './api';

function App() {
  const [commentary, setCommentary] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const audioRef = useRef(null);

  // Clear all state for new game
  const clearAll = useCallback(() => {
    setCommentary([]);
    setIsProcessing(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    console.log('🧹 Cleared all commentary');
  }, []);

  const handleFrameCaptured = async (frame) => {
    if (isProcessing) return; // Skip if still processing previous frame

    setIsProcessing(true);

    if (isStreamingMode) {
      // Initialize new commentary item
      setCommentary(prev => [...prev, { text: '', timestamp: new Date() }]);

      await streamAnalyzeFrame(frame, (event) => {
        if (event.type === 'error') {
          console.error('Stream error:', event.content);
          return;
        }
        if (event.type === 'audio' && audioRef.current) {
          audioRef.current.src = `data:audio/mpeg;base64,${event.content}`;
          audioRef.current.play();
          return;
        }
        if (event.type !== 'text' && event.type !== 'refined') return;
        setCommentary(prev => {
          const newPrev = [...prev];
          const lastIdx = newPrev.length - 1;
          if (lastIdx >= 0) {
            newPrev[lastIdx] = {
              ...newPrev[lastIdx],
              // The refined line replaces the raw draft; text chunks append.
              text: event.type === 'refined'
                ? event.content
                : newPrev[lastIdx].text + event.content
            };
          }
          return newPrev;
        });
      });
    } else {
      const result = await analyzeFrame(frame, !isAudioEnabled);

      if (result) {
        // Add new commentary to the list
        setCommentary(prev => [...prev, { text: result.text, timestamp: new Date() }]);

        // Play audio if available (MP3 from ElevenLabs)
        if (result.audio && audioRef.current) {
          audioRef.current.src = `data:audio/mpeg;base64,${result.audio}`;
          audioRef.current.play();
        }
      }
    }

    setIsProcessing(false);
  };

  const {
    isSharing,
    startCapture,
    stopCapture,
    videoRef,
    canvasRef
  } = useScreenCapture(handleFrameCaptured);

  // Handle stop - clear everything and stop capture
  const handleStop = () => {
    clearAll();
    stopCapture();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-blue-400 mb-2">Chess Commentary AI</h1>
        <p className="text-gray-400">Live commentary for your chess games powered by Gemini</p>
      </header>

      <main className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Video Feed Section */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700 aspect-video relative flex items-center justify-center">
            {!isSharing ? (
              <div className="text-center p-8">
                <p className="text-xl text-gray-500 mb-4">Screen sharing is inactive</p>
                <button
                  onClick={startCapture}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
                >
                  Start Commentary
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                muted
                autoPlay
                playsInline
              />
            )}

            {/* Hidden Canvas for processing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {isSharing && (
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={handleStop}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors"
              >
                Stop Commentary
              </button>

              <button
                onClick={clearAll}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold transition-colors"
              >
                🔄 New Game
              </button>

              <button
                onClick={() => setIsStreamingMode(!isStreamingMode)}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isStreamingMode
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-gray-600 hover:bg-gray-500'
                  }`}
              >
                {isStreamingMode ? '🌊 Stream ON' : '🌊 Stream OFF'}
              </button>

              <button
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${isAudioEnabled
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-600 hover:bg-gray-500'
                  }`}
              >
                {isAudioEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
              </button>
            </div>
          )}
        </div>

        {/* Commentary Feed Section */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 flex flex-col h-[400px]">
          <div className="p-4 border-b border-gray-700 bg-gray-850">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live Commentary
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
            {commentary.length === 0 ? (
              <p className="text-gray-500 text-center italic mt-10">Waiting for game to start...</p>
            ) : (
              commentary.map((item, index) => (
                <div key={index} className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 animate-fade-in">
                  <p className="text-gray-200">{item.text}</p>
                  <span className="text-xs text-gray-500 mt-1 block">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

export default App;

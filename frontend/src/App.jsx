import { useState, useEffect, useRef } from 'react';
import { useScreenCapture } from './useScreenCapture';
import { analyzeFrame } from './api';

function App() {
  const [commentary, setCommentary] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioRef = useRef(null);

  const handleFrameCaptured = async (frame) => {
    if (isProcessing) return; // Skip if still processing previous frame

    setIsProcessing(true);
    const result = await analyzeFrame(frame);
    setIsProcessing(false);

    if (result) {
      // Add new commentary to the list
      setCommentary(prev => [...prev, { text: result.text, timestamp: new Date() }]);

      // Play audio if available
      if (result.audio && audioRef.current) {
        audioRef.current.src = `data:audio/mp3;base64,${result.audio}`;
        audioRef.current.play();
      }
    }
  };

  const {
    isSharing,
    startCapture,
    stopCapture,
    videoRef,
    canvasRef
  } = useScreenCapture(handleFrameCaptured);

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
            <div className="flex justify-center">
              <button
                onClick={stopCapture}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors"
              >
                Stop Commentary
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

// Middle pane: the screen stream — the shared window and, below it,
// exactly what the model last received.

export default function ScreenPanel({
  isSharing,
  isViewingHistory,
  videoRef,
  canvasRef,
  onStop,
  isMuted,
  onToggleMute,
  userSpeaking,
  lastFrame,
  lastFrameAt,
  timeToFirstWord,
  skippedFrames,
  status,
  errorMessage,
}) {
  return (
    <section className="flex-1 min-w-0 flex flex-col gap-4 p-5 overflow-y-auto" aria-label="Screen stream">

      <div className="bg-zinc-950 rounded-xl overflow-hidden border border-zinc-900 aspect-video relative flex items-center justify-center shrink-0">
        {isViewingHistory || !isSharing ? (
          <p className="text-zinc-700 italic p-8 text-center text-sm">
            {isViewingHistory ? 'Past session — no live screen.' : 'Waiting for screen share…'}
          </p>
        ) : (
          <video ref={videoRef} className="w-full h-full object-contain" muted autoPlay playsInline />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {isSharing && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={onStop}
            className="px-4 py-2 border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black rounded-lg font-semibold text-sm transition-colors"
          >
            End Session
          </button>
          <button
            onClick={onToggleMute}
            aria-pressed={isMuted}
            className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${isMuted
              ? 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
              : 'border-zinc-700 text-zinc-200'
              }`}
          >
            {isMuted ? 'Mic Off' : 'Mic On'}
          </button>
          <span
            aria-live="polite"
            className={`px-3 py-1.5 rounded-lg text-sm ${userSpeaking ? 'text-yellow-400' : 'text-zinc-600'}`}
          >
            {userSpeaking ? '● Listening…' : 'Narrating'}
          </span>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-yellow-300 bg-yellow-400/5 border border-yellow-400/40 rounded-xl p-3 text-sm shrink-0">
          {errorMessage}
        </p>
      )}

      {isSharing && (
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 shrink-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-3">
            Model input
          </h3>
          <div className="flex gap-4 items-start">
            <div className="w-40 shrink-0 aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
              {lastFrame ? (
                <img src={lastFrame} alt="Last frame sent to the model" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-zinc-700 p-2 text-center">No frame yet</span>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-1.5 text-sm flex-1">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Last frame</dt>
                <dd className="font-mono text-zinc-300">
                  {lastFrameAt ? lastFrameAt.toLocaleTimeString() : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">First word</dt>
                <dd className="font-mono text-yellow-400">
                  {timeToFirstWord !== null ? `${timeToFirstWord.toFixed(2)}s` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Frames skipped</dt>
                <dd className="font-mono text-zinc-300">{skippedFrames}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}

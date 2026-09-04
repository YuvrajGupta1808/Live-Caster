// Middle pane: just the shared screen, with the session controls under it.

function MicIcon({ muted }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export default function ScreenPanel({
  isSharing,
  isViewingHistory,
  videoRef,
  canvasRef,
  onStop,
  isMuted,
  onToggleMute,
  userSpeaking,
  status,
  errorMessage,
  notice,
}) {
  return (
    <section className="flex-1 min-w-0 flex flex-col gap-4 p-5" aria-label="Shared screen">

      <div className="bg-white dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-900 flex-1 relative flex items-center justify-center transition-colors">
        {isViewingHistory || !isSharing ? (
          <p className="text-zinc-400 dark:text-zinc-700 italic p-8 text-center text-sm">
            {isViewingHistory ? 'Past session — no live screen.' : 'No live screen.'}
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
            className="px-4 py-2 border border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-400 hover:text-black dark:hover:text-black rounded-lg font-semibold text-sm transition-colors"
          >
            End Session
          </button>
          <button
            onClick={onToggleMute}
            aria-pressed={isMuted}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${isMuted
              ? 'border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
              : 'border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400'
              }`}
          >
            <MicIcon muted={isMuted} />
          </button>
          <span
            aria-live="polite"
            className={`px-3 py-1.5 rounded-lg text-sm ${userSpeaking ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-400 dark:text-zinc-600'}`}
          >
            {userSpeaking ? '● Listening…' : 'Narrating'}
          </span>
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-600">
            <kbd>Space</kbd> stop · <kbd>M</kbd> mute · <kbd>D</kbd> describe · <kbd>R</kbd> repeat · <kbd>S</kbd> slow
          </span>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-yellow-700 dark:text-yellow-300 bg-yellow-400/10 border border-yellow-500/40 rounded-xl p-3 text-sm shrink-0">
          {errorMessage}
        </p>
      )}

      {notice && status !== 'live' && (
        <p role="status" className="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm shrink-0">
          {notice}
        </p>
      )}
    </section>
  );
}

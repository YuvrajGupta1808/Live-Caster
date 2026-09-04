// Middle pane: just the shared screen, with the session controls under it.

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
  onDescribeNow,
  onRepeat,
  slowVoice,
  onToggleSlowVoice,
}) {
  return (
    <section className="flex-1 min-w-0 flex flex-col gap-4 p-5" aria-label="Shared screen">

      <div className="bg-white dark:bg-zinc-950 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-900 flex-1 relative flex items-center justify-center transition-colors">
        {isViewingHistory || !isSharing ? (
          <p className="text-zinc-400 dark:text-zinc-700 italic p-8 text-center text-sm">
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
            className="px-4 py-2 border border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-400 hover:text-black dark:hover:text-black rounded-lg font-semibold text-sm transition-colors"
          >
            End Session
          </button>
          <button
            onClick={onToggleMute}
            aria-pressed={isMuted}
            className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${isMuted
              ? 'border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500'
              : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
              }`}
          >
            {isMuted ? 'Mic Off' : 'Mic On'}
          </button>
          <button
            onClick={onDescribeNow}
            aria-keyshortcuts="d"
            title="Describe the screen right now (D)"
            className="px-4 py-2 rounded-lg font-semibold text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors"
          >
            Describe Now
          </button>
          <button
            onClick={onRepeat}
            aria-keyshortcuts="r"
            title="Repeat the last line (R)"
            className="px-4 py-2 rounded-lg font-semibold text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors"
          >
            Repeat
          </button>
          <button
            onClick={onToggleSlowVoice}
            aria-pressed={slowVoice}
            title="Toggle slower speech"
            className={`px-4 py-2 rounded-lg font-semibold text-sm border transition-colors ${slowVoice
              ? 'border-yellow-500 dark:border-yellow-400 text-yellow-600 dark:text-yellow-400'
              : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
              }`}
          >
            {slowVoice ? 'Slow ✓' : 'Slow'}
          </button>
          <span
            aria-live="polite"
            className={`px-3 py-1.5 rounded-lg text-sm ${userSpeaking ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-400 dark:text-zinc-600'}`}
          >
            {userSpeaking ? '● Listening…' : 'Narrating'}
          </span>
        </div>
      )}

      {isSharing && (
        <p className="text-xs text-zinc-400 dark:text-zinc-600 shrink-0">
          Shortcuts: <kbd>Space</kbd> stop · <kbd>M</kbd> mute · <kbd>D</kbd> describe now · <kbd>R</kbd> repeat
        </p>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-yellow-700 dark:text-yellow-300 bg-yellow-400/10 border border-yellow-500/40 rounded-xl p-3 text-sm shrink-0">
          {errorMessage}
        </p>
      )}
    </section>
  );
}

// Minimal cover page: wordmark, one line, start.

export default function CoverPage({ onStart, onHistory, hasHistory }) {
  return (
    <div className="h-screen bg-black text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="font-bold tracking-[0.25em] text-sm">
          <span className="text-yellow-400">LIVE</span> CASTER
        </span>
        {hasHistory && (
          <button
            onClick={onHistory}
            className="text-sm text-zinc-500 hover:text-yellow-400 transition-colors"
          >
            History
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-yellow-400 font-semibold mb-6">
          REAL-TIME SCREEN NARRATION
        </p>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
          Your screen.
          <br />
          <span className="text-yellow-400">Narrated live.</span>
        </h1>
        <p className="text-zinc-400 mb-12 max-w-md">
          An accessibility tool that describes your screen out loud —
          and answers when you speak.
        </p>

        <button
          onClick={onStart}
          className="px-12 py-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full font-bold text-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
        >
          Start
        </button>
      </main>

      <footer className="px-8 py-6 text-center">
        <p className="text-xs text-zinc-600 tracking-wide">
          Gemini Live &nbsp;·&nbsp; native voice &nbsp;·&nbsp; ~0.6s to first word
        </p>
      </footer>
    </div>
  );
}

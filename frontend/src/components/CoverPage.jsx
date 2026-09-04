// Minimal cover page: wordmark, one line, start.

export default function CoverPage({ onStart, onHistory, hasHistory, theme, onToggleTheme, quiet, onToggleQuiet, notice }) {
  return (
    <div className="h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="font-bold tracking-[0.25em] text-sm">
          <span className="text-yellow-600 dark:text-yellow-400">LIVE</span> CASTER
        </span>
        <div className="flex items-center gap-4">
          {hasHistory && (
            <button
              onClick={onHistory}
              className="text-sm text-zinc-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
            >
              History
            </button>
          )}
          <button
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-9 h-9 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xs tracking-[0.35em] text-yellow-600 dark:text-yellow-400 font-semibold mb-6">
          REAL-TIME SCREEN NARRATION
        </p>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6">
          Your screen.
          <br />
          <span className="text-yellow-600 dark:text-yellow-400">Narrated live.</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-12 max-w-md">
          An accessibility tool that describes your screen out loud —
          and answers when you speak.
        </p>

        <button
          onClick={onStart}
          aria-keyshortcuts="Space"
          className="px-12 py-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-full font-bold text-lg transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400/40"
        >
          Start
        </button>

        <label className="mt-8 flex items-center gap-2.5 text-sm text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={quiet}
            onChange={onToggleQuiet}
            className="w-4 h-4 accent-yellow-400"
          />
          Quiet mode — speak only when something needs my attention
        </label>

        {notice && (
          <p role="status" className="mt-6 text-sm text-yellow-600 dark:text-yellow-400">
            {notice}
          </p>
        )}
      </main>

      <footer className="px-8 py-6 text-center">
        <p className="text-xs text-zinc-400 dark:text-zinc-600 tracking-wide">
          Gemini Live &nbsp;·&nbsp; native voice &nbsp;·&nbsp; ~0.6s to first word
          &nbsp;·&nbsp; press <kbd>Space</kbd> to start
        </p>
      </footer>
    </div>
  );
}

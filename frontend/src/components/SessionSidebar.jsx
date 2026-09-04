function formatWhen(ts) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SessionSidebar({ sessions, selectedId, onSelect, onNew, isLive, open, onToggle }) {
  if (!open) {
    return (
      <aside className="w-11 shrink-0 border-r border-zinc-200 dark:border-zinc-900 bg-zinc-100 dark:bg-black flex flex-col items-center py-3 gap-3 transition-colors">
        <button
          onClick={onToggle}
          aria-label="Expand session history"
          title="Sessions"
          className="w-8 h-8 rounded-lg text-zinc-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
        >
          ☰
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-900 bg-zinc-100 dark:bg-black flex flex-col transition-colors"
      aria-label="Session history"
    >
      <div className="p-3 flex items-center gap-2">
        <button
          onClick={onNew}
          disabled={isLive}
          className="flex-1 px-3 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 text-black rounded-lg font-semibold text-sm transition-colors"
        >
          New Session
        </button>
        <button
          onClick={onToggle}
          aria-label="Collapse session history"
          title="Collapse"
          className="w-8 h-8 shrink-0 rounded-lg text-zinc-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
        >
          ⟨
        </button>
      </div>

      <h2 className="px-4 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600">
        Sessions
      </h2>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {sessions.length === 0 ? (
          <p className="text-zinc-400 dark:text-zinc-700 text-sm px-2 py-4 italic">No sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              aria-current={selectedId === s.id ? 'true' : undefined}
              className={`w-full text-left p-2.5 rounded-lg border transition-colors ${selectedId === s.id
                ? 'border-yellow-500/60 bg-yellow-400/10'
                : 'border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-900'
                }`}
            >
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                {s.preview || 'Voice conversation'}
              </span>
              <span className="block text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
                {formatWhen(s.started_at)}
              </span>
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}

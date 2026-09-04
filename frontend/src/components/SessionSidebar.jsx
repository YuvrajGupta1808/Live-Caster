function formatWhen(ts) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SessionSidebar({ sessions, selectedId, onSelect, onNew, isLive }) {
  return (
    <aside
      className="w-60 shrink-0 border-r border-zinc-900 bg-black flex flex-col"
      aria-label="Session history"
    >
      <div className="p-3">
        <button
          onClick={onNew}
          disabled={isLive}
          className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-900 disabled:text-zinc-600 text-black rounded-lg font-semibold text-sm transition-colors"
        >
          New Session
        </button>
      </div>

      <h2 className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
        History
      </h2>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {sessions.length === 0 ? (
          <p className="text-zinc-700 text-sm px-2 py-4 italic">No sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              aria-current={selectedId === s.id ? 'true' : undefined}
              className={`w-full text-left p-2.5 rounded-lg border transition-colors ${selectedId === s.id
                ? 'border-yellow-400/60 bg-yellow-400/5'
                : 'border-transparent hover:bg-zinc-900'
                }`}
            >
              <span className="flex items-center gap-2 text-sm text-zinc-200">
                <span className="font-medium">Session</span>
                <span className="ml-auto text-xs text-zinc-600">{formatWhen(s.started_at)}</span>
              </span>
              <span className="block text-xs text-zinc-500 mt-0.5 truncate">
                {s.preview || `${s.entry_count} entries`}
              </span>
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}

import { useEffect, useRef } from 'react';

// Right pane: the model's stream — commentary and answers as spoken, user
// turns, and tool calls inline between them.

function ToolChip({ text }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-400/40 text-yellow-400/90 text-xs font-mono">
        {text}
      </span>
    </div>
  );
}

function Turn({ item }) {
  if (item.kind === 'tool') return <ToolChip text={item.text} />;

  const isUser = item.kind === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={`max-w-[92%] p-3 rounded-xl text-[15px] leading-relaxed border ${isUser
          ? 'border-yellow-400/40 bg-yellow-400/5'
          : 'border-zinc-800 bg-zinc-950'
          }`}
      >
        <span className={`block text-[11px] font-semibold tracking-wide mb-1 ${isUser ? 'text-yellow-400' : 'text-zinc-500'}`}>
          {isUser ? 'YOU' : 'NARRATOR'}
        </span>
        <p className="text-zinc-100 whitespace-pre-wrap">
          {item.text}
          {!item.final && <span className="animate-pulse text-yellow-400">▍</span>}
        </p>
        {item.timestamp && (
          <span className="block text-xs text-zinc-600 mt-1">
            {item.timestamp.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ feed, status, isViewingHistory, historyTitle }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  return (
    <section
      className="w-[24rem] shrink-0 border-l border-zinc-900 bg-black flex flex-col"
      aria-label="Commentary stream"
    >
      <div className="p-4 border-b border-zinc-900 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-700'}`}
          aria-hidden="true"
        ></span>
        <h2 className="text-sm font-semibold tracking-wide">
          {isViewingHistory ? historyTitle : 'Commentary'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
        {feed.length === 0 ? (
          <p className="text-zinc-700 text-center italic mt-12 text-sm px-4">
            {isViewingHistory ? 'No transcript entries.' : 'Commentary streams here.'}
          </p>
        ) : (
          feed.map((item, index) => <Turn key={index} item={item} />)
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}

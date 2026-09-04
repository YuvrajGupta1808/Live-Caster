import { useEffect, useRef } from 'react';

// Right pane: the live event stream — narration and answers as spoken,
// user turns, minimal tool-call lines, and the frames being sent to the
// model, in order, like an agent event log.

function ToolLine({ item }) {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      <span className="text-yellow-600 dark:text-yellow-400 text-xs" aria-hidden="true">⚡</span>
      <span className="text-xs font-mono text-zinc-500 truncate">{item.text}</span>
    </div>
  );
}

function FrameLine({ item }) {
  return (
    <div className="flex items-center gap-3 px-1 py-0.5">
      <img
        src={item.img}
        alt="Frame sent to the model"
        className="h-14 rounded-md border border-zinc-200 dark:border-zinc-800"
      />
      <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600">
        frame → model{item.count > 1 ? ` ×${item.count}` : ''}
        <span className="block">{item.timestamp.toLocaleTimeString()}</span>
      </span>
    </div>
  );
}

function Turn({ item }) {
  if (item.kind === 'tool') return <ToolLine item={item} />;
  if (item.kind === 'frame') return <FrameLine item={item} />;

  const isUser = item.kind === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={`max-w-[92%] p-3 rounded-xl text-[15px] leading-relaxed border transition-colors ${isUser
          ? 'border-yellow-500/40 bg-yellow-400/10'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
          }`}
      >
        <span className={`block text-[11px] font-semibold tracking-wide mb-1 ${isUser ? 'text-yellow-600 dark:text-yellow-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {isUser ? 'YOU' : 'NARRATOR'}
        </span>
        <p className="text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
          {item.text}
          {!item.final && <span className="animate-pulse text-yellow-600 dark:text-yellow-400">▍</span>}
        </p>
        {item.timestamp && (
          <span className="block text-xs text-zinc-400 dark:text-zinc-600 mt-1">
            {item.timestamp.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ feed, status, isViewingHistory, timeToFirstWord, skippedFrames }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [feed]);

  return (
    <section
      className="w-[30rem] shrink-0 border-l border-zinc-200 dark:border-zinc-900 bg-zinc-100 dark:bg-black flex flex-col transition-colors"
      aria-label="Live event stream"
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-700'}`}
          aria-hidden="true"
        ></span>
        <h2 className="text-sm font-semibold tracking-wide">
          {isViewingHistory ? 'Past Session' : 'Stream'}
        </h2>
        {!isViewingHistory && (
          <span className="ml-auto text-xs font-mono text-zinc-400 dark:text-zinc-600">
            {timeToFirstWord !== null && `first word ${timeToFirstWord.toFixed(2)}s · `}
            {skippedFrames} skipped
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5" aria-live="polite">
        {feed.length === 0 ? (
          <p className="text-zinc-400 dark:text-zinc-700 text-center italic mt-12 text-sm px-4">
            {isViewingHistory ? 'No transcript entries.' : 'Narration, your questions, tool calls, and outgoing frames stream here.'}
          </p>
        ) : (
          feed.map((item, index) => <Turn key={index} item={item} />)
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Bot, Wifi, WifiOff, X } from 'lucide-react';
import { useProgress } from '../store/progress';
import type { WebmcpStatus } from '../lib/webmcp-browser';

const MODES = [
  { id: 'guide', label: 'Guide me', desc: "Hints and nudges — never gives the answer until asked." },
  { id: 'balanced', label: 'Balanced', desc: 'Occasional direct guidance when stuck.' },
  { id: 'explain', label: 'Explain directly', desc: 'Shows the full solution immediately.' },
] as const;

export default function TutorPanel({
  status,
  onOpenDebug,
}: {
  status: WebmcpStatus;
  onOpenDebug: () => void;
}) {
  const tutorMode = useProgress((s) => s.tutorMode);
  const setTutorMode = useProgress((s) => s.setTutorMode);
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg hover:bg-slate-700"
      >
        <Bot size={18} className="text-indigo-300" /> AI Tutor
      </button>
    );
  }

  return (
    <aside className="w-full border-t border-white/10 bg-slate-900/60 p-4 md:w-80 md:border-t-0 md:border-l">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-indigo-300" />
          <span className="font-semibold text-white">AI Tutor</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-white/10 bg-slate-950 p-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          AI Tutor Mode
        </div>
        <div className="space-y-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setTutorMode(m.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                tutorMode === m.id
                  ? 'bg-indigo-500/20 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  tutorMode === m.id ? 'bg-indigo-400' : 'bg-slate-600'
                }`}
              />
              <span className="font-medium">{m.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {MODES.find((m) => m.id === tutorMode)?.desc}
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.mode === 'browser-webmcp' ? (
              <Wifi size={14} className="text-emerald-400" />
            ) : (
              <WifiOff size={14} className="text-amber-400" />
            )}
            <span className="text-sm font-medium text-white">WebMCP</span>
          </div>
          <span
            className={`text-xs font-semibold ${
              status.mode === 'browser-webmcp' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {status.mode === 'browser-webmcp'
              ? `Registered · ${status.count} tools`
              : 'Unavailable'}
          </span>
        </div>
        {status.mode === 'browser-webmcp' ? (
          <p className="mt-1 text-xs text-slate-400">
            AI agents can read your lesson, exercise and progress, and tutor you through
            browser WebMCP (document.modelContext).
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">{status.reason}</p>
        )}
        <button
          onClick={onOpenDebug}
          className="mt-2 text-xs text-indigo-300 hover:text-indigo-200"
        >
          View WebMCP tools ({status.count || 0})
        </button>
        {status.mode !== 'browser-webmcp' && (
          <p className="mt-2 rounded border border-white/10 bg-white/[0.02] p-2 text-[11px] leading-relaxed text-slate-500">
            Dev/testing fallback: the same tools are callable in-page via{' '}
            <code className="text-slate-300">window.__webmcp</code>, but this is{' '}
            <em>not</em> the WebMCP Challenge integration.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
        <span className="font-medium text-slate-200">Tutor philosophy:</span> the agent explains →
        hints → stronger hints → answer only if you explicitly ask for it.
      </div>
    </aside>
  );
}

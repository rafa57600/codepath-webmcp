import { useState } from 'react';
import {
  Home,
  RotateCcw,
  Sparkles,
  ChevronDown,
  WifiOff,
  X,
} from 'lucide-react';
import { useProgress } from '../store/progress';
import type { WebmcpStatus } from '../lib/webmcp-browser';

const TUTOR_MODES = [
  {
    id: 'guide',
    label: 'Guide',
    desc: 'Hints without revealing the answer.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    desc: 'Stronger guidance when necessary.',
  },
  {
    id: 'explain',
    label: 'Explain',
    desc: 'More direct explanations.',
  },
] as const;

type TutorMode = 'guide' | 'balanced' | 'explain';

interface TopBarProps {
  onExit: () => void;
  progressPercent: number;
  lessonPathLabel: string;
  status: WebmcpStatus;
  onOpenDebug: () => void;
  context: { courseTitle: string; lessonTitle: string; activity: string };
}

export default function TopBar({  onExit,
  progressPercent,
  lessonPathLabel,
  status,
  onOpenDebug,
  context,
}: TopBarProps) {
  const tutorMode = useProgress((s) => s.tutorMode);
  const setTutorMode = useProgress((s) => s.setTutorMode);
  const resetProgress = useProgress((s) => s.resetProgress);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [webmcpOpen, setWebmcpOpen] = useState(false);

  const ready = status.mode === 'browser-webmcp';

  const showTutor = () => {
    setWebmcpOpen(false);
    setTutorOpen(true);
  };
  const showWebmcp = () => {
    setTutorOpen(false);
    setWebmcpOpen(true);
  };

  return (
    <header className="relative z-30 flex items-center justify-between gap-3 border-b border-kumo-hairline bg-white px-3 py-2 md:px-4">
      {/* Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-kumo-text-subtle hover:bg-kumo-tint hover:text-kumo-text-strong"
          aria-label="Back to home"
        >
          <Home size={15} /> <span className="hidden sm:inline">Home</span>
        </button>
        <span className="hidden text-sm font-bold text-kumo-text-strong sm:inline">CodePath</span>
      </div>

      {/* Center: breadcrumb + progress */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <div className="hidden min-w-0 text-sm text-kumo-text-default md:block">
          <span className="font-medium text-kumo-text-subtle">{lessonPathLabel.split(' / ')[0]}</span>
          <span className="mx-1.5 text-kumo-text-inactive">/</span>
          <span className="font-semibold text-kumo-text-strong">{lessonPathLabel.split(' / ')[1]}</span>
        </div>
        <div className="flex w-24 items-center gap-2 sm:w-36">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="w-8 text-right text-xs font-semibold text-kumoText-info">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Right: tutor mode + webmcp status + reset */}
      <div className="flex items-center gap-1.5">
        {/* Tutor mode selector */}
        <div className="relative">
          <button
            onClick={() => (tutorOpen ? setTutorOpen(false) : showTutor())}
            className="flex items-center gap-1.5 rounded-lg border border-kumo-hairline bg-white px-2.5 py-1.5 text-xs font-medium text-kumo-text-default hover:bg-kumo-tint"
            aria-haspopup="listbox"
            aria-expanded={tutorOpen}
          >
            <Sparkles size={14} className="text-kumo-brand" />
            <span className="hidden sm:inline">Tutor:</span>
            <span className="font-semibold text-kumo-text-strong">
              {TUTOR_MODES.find((m) => m.id === tutorMode)?.label ?? 'Guide'}
            </span>
            <ChevronDown size={13} className="text-kumo-text-subtle" />
          </button>

          {tutorOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setTutorOpen(false)} />
              <div className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-kumo-hairline bg-white shadow-card">
                <div className="border-b border-kumo-hairline bg-kumo-tint/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-kumo-text-subtle">
                  AI Tutor Mode
                </div>
                {TUTOR_MODES.map((m) => {
                  const active = tutorMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setTutorMode(m.id as TutorMode);
                        setTutorOpen(false);
                      }}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                        active ? 'bg-kumoInfo-tint' : 'hover:bg-kumo-tint'
                      }`}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          active ? 'bg-kumo-brand' : 'bg-kumo-text-inactive'
                        }`}
                      />
                      <span>
                        <span
                          className={`block text-sm font-semibold ${
                            active ? 'text-kumoText-info' : 'text-kumo-text-strong'
                          }`}
                        >
                          {m.label}
                        </span>
                        <span className="block text-xs text-kumo-text-subtle">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* WebMCP status indicator + popover */}
        <div className="relative">
          <button
            onClick={() => (webmcpOpen ? setWebmcpOpen(false) : showWebmcp())}
            title={
              ready
                ? 'AI Agent connection ready'
                : 'WebMCP unavailable in this browser (see popover)'
            }
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              ready
                ? 'border-kumo-brand bg-kumoInfo-tint text-kumoText-info hover:bg-kumoInfo-tint'
                : 'border-kumo-hairline bg-white text-kumo-text-subtle hover:bg-kumo-tint'
            }`}
            aria-haspopup="dialog"
            aria-expanded={webmcpOpen}
          >
            {ready ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kumo-brand opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-kumo-brand" />
                </span>
                Agent Ready
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-kumo-text-inactive" />
                Agent offline
              </>
            )}
          </button>

          {webmcpOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setWebmcpOpen(false)} />
              <div className="absolute right-0 z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-kumo-hairline bg-white shadow-card">
                <div className="flex items-center justify-between border-b border-kumo-hairline px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-kumo-brand" />
                    <span className="text-sm font-semibold text-kumo-text-strong">AI Agent connection</span>
                  </div>
                  <button
                    onClick={() => setWebmcpOpen(false)}
                    className="rounded p-1 text-kumo-text-subtle hover:bg-kumo-tint hover:text-kumo-text-default"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {ready ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-kumo-brand" />
                        <span className="text-sm font-semibold text-kumoText-info">WebMCP Ready</span>
                      </>
                    ) : (
                      <>
                        <WifiOff size={15} className="text-kumoText-warning" />
                        <span className="text-sm font-semibold text-kumoText-warning">
                          WebMCP unavailable
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-kumo-text-subtle">
                    {ready
                      ? `${status.count} learning tools available via document.modelContext.`
                      : status.reason}
                  </p>

                  <div className="mt-3 rounded-lg bg-kumo-tint/70 p-2.5 text-xs text-kumo-text-default">
                    <div className="mb-1 font-semibold uppercase tracking-wide text-kumo-text-subtle">
                      Current context
                    </div>
                    <div className="space-y-0.5">
                      <div>
                        <span className="text-kumo-text-subtle">Course:</span>{' '}
                        <span className="font-medium text-kumo-text-strong">{context.courseTitle}</span>
                      </div>
                      <div>
                        <span className="text-kumo-text-subtle">Lesson:</span>{' '}
                        <span className="font-medium text-kumo-text-strong">{context.lessonTitle}</span>
                      </div>
                      <div>
                        <span className="text-kumo-text-subtle">Step:</span>{' '}
                        <span className="font-medium text-kumo-text-strong">{context.activity}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setWebmcpOpen(false);
                      onOpenDebug();
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-kumo-hairline bg-white px-3 py-2 text-sm font-medium text-kumo-text-default hover:bg-kumo-tint"
                  >
                    View WebMCP tools
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => {
            if (window.confirm('Reset all progress?')) resetProgress();
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-kumo-text-subtle hover:bg-kumo-tint hover:text-kumo-text-default"
        >
          <RotateCcw size={13} /> <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </header>
  );
}

import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Bot,
  BookOpen,
  PlayCircle,
  Sparkles,
  Layers,
  PenLine,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { courses } from '../data/javascript';
import { useProgress } from '../store/progress';
import { getWebmcpStatus, type WebmcpStatus } from '../lib/webmcp-browser';

export default function Landing({ onStart }: { onStart: () => void }) {
  const setCourse = useProgress((s) => s.setCourse);
  const setCurrentLesson = useProgress((s) => s.setCurrentLesson);

  // Real WebMCP status on the landing page. Registration happens once at App
  // mount (after first paint), so listen for the 'webmcp:status' event that
  // registration dispatches — the indicator must reflect whether the 7 tools
  // are actually registered, NOT whether the user has entered the course.
  const [status, setStatus] = useState<WebmcpStatus>(() => getWebmcpStatus());
  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent<WebmcpStatus>).detail;
      if (d) setStatus(d);
    };
    window.addEventListener('webmcp:status', onStatus);
    // In case registration already completed before this effect subscribed.
    const cur = getWebmcpStatus();
    if (cur) setStatus(cur);
    return () => window.removeEventListener('webmcp:status', onStatus);
  }, []);
  const webmcpReady = status.mode === 'browser-webmcp';

  const startJs = () => {
    setCourse('javascript');
    setCurrentLesson('introduction');
    onStart();
  };

  return (
    <div className="min-h-screen bg-kumo-canvas">
      <div className="mx-auto max-w-6xl px-6 pb-24">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <header className="grid items-center gap-12 pt-16 md:grid-cols-[1.1fr_0.9fr] md:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-kumo-brand bg-kumoInfo-tint px-3.5 py-1.5 text-sm font-medium text-kumoText-info">
              <Sparkles size={14} />
              Built for humans &amp; AI agents to learn together
            </span>
            <div className="mt-3">
              {webmcpReady ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-kumo-hairline bg-white px-3 py-1 text-xs font-medium text-kumoText-info">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kumo-brand opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-kumo-brand" />
                  </span>
                  WebMCP Ready · {status.count} tools
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-kumo-hairline bg-white px-3 py-1 text-xs font-medium text-kumo-text-subtle">
                  <span className="h-2 w-2 rounded-full bg-kumo-text-inactive" />
                  WebMCP unavailable in this browser
                </span>
              )}
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-kumo-text-strong md:text-5xl">
              Learn programming from scratch, with an AI tutor in your corner.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-kumo-text-default">
              A structured coding course designed for humans and AI agents to learn together. Your
              WebMCP-compatible agent reads your lesson, exercise and mistakes — and tutors you
              without giving the answers away.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={startJs}
                className="btn btn-primary px-6 py-3 text-base shadow-card-hover"
              >
                Start learning JavaScript <ArrowRight size={18} />
              </button>
              <a
                href="#benefits"
                className="btn btn-secondary px-5 py-3 text-base"
              >
                Explore the course
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-kumo-text-default">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-kumo-brand" /> 4 structured lessons
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-kumo-brand" /> 7 WebMCP tools
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-kumo-brand" /> No sign-up required
              </span>
            </div>
          </div>

          {/* Right-side hero preview: the AI tutor + editor experience */}
          <HeroPreview onStart={startJs} />
        </header>

        {/* ---------------------------------------------------------------- */}
        {/* Available courses                                                */}
        {/* ---------------------------------------------------------------- */}
        <section className="mt-20">
          <h2 className="section-label mb-5 text-center">Available courses</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {courses.map((c) => {
              const available = c.status === 'available';
              return (
                <div
                  key={c.id}
                  className={`card relative overflow-hidden p-6 transition-all ${
                    available
                      ? 'hover:-translate-y-0.5 hover:shadow-card-hover'
                      : 'opacity-70'
                  }`}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: c.color, opacity: available ? 1 : 0.35 }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold text-kumo-text-strong">{c.title}</span>
                    {available ? (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> Available
                      </span>
                    ) : (
                      <span className="badge badge-neutral">
                        <Clock size={12} /> Coming soon
                      </span>
                    )}
                  </div>
                  {available && (
                    <button
                      onClick={startJs}
                      className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-kumoText-info hover:text-kumoText-info"
                    >
                      Enter course <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Benefits                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section id="benefits" className="mt-20">
          <h2 className="section-label mb-6 text-center">Why CodePath</h2>
          <div className="grid gap-5 md:grid-cols-3">
            <Benefit
              icon={<Layers size={20} />}
              title="Structured lessons"
              desc="Follow a clear, guided path — from first program to loops — one concept at a time, in the right order."
            />
            <Benefit
              icon={<PenLine size={20} />}
              title="Interactive practice"
              desc="Every lesson pairs a short explanation with a working code editor, a try-it console and real exercises."
            />
            <Benefit
              icon={<Bot size={20} />}
              title="AI tutor with WebMCP"
              desc="A WebMCP-compatible agent reads your lesson, code and mistakes, then guides you without handing over the answer."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function Benefit({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-kumoInfo-tint text-kumo-brand">
        {icon}
      </div>
      <h3 className="font-semibold text-kumo-text-strong">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-kumo-text-default">{desc}</p>
    </div>
  );
}

function HeroPreview({ onStart }: { onStart: () => void }) {
  return (
    <div className="card overflow-hidden p-0 shadow-card-hover">
      {/* Fake window chrome */}
      <div className="flex items-center gap-2 border-b border-kumo-hairline bg-kumo-tint px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-kumoDanger" />
        <span className="h-2.5 w-2.5 rounded-full bg-kumoWarning" />
        <span className="h-2.5 w-2.5 rounded-full bg-kumo-brand" />
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-xs text-kumo-text-subtle shadow-sm">
          <BookOpen size={12} className="text-kumo-brand" /> CodePath — JavaScript
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto]">
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">Lesson 01</span>
            <span className="badge badge-success">Lesson complete</span>
          </div>
          <div className="text-base font-semibold text-kumo-text-strong">Variables</div>
          <p className="mt-1 text-xs text-kumo-text-subtle">
            Store a value in a named box so you can reuse it.
          </p>

          <div className="mt-3 rounded-lg bg-kumo-tint p-2.5 font-mono text-xs text-kumo-text-strong">
            <span className="text-kumo-text-subtle">let</span> <span className="text-kumo-text-strong">name</span>{' '}
            <span className="text-kumo-text-subtle">=</span> <span className="text-kumoText-info">"Sara"</span>;
          </div>

          <div className="mt-2.5 rounded-lg border border-kumo-hairline bg-white p-2.5 text-xs">
            <span className="text-kumo-text-subtle">✓ Output</span>
            <div className="mt-1 font-mono text-kumo-text-default">Sara</div>
          </div>
        </div>

        {/* AI Tutor preview panel */}
        <div className="w-40 border-l border-kumo-hairline bg-kumo-tint/60 p-3">
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-kumo-brand text-white">
              <Bot size={14} />
            </div>
            <span className="text-xs font-semibold text-kumo-text-strong">AI Tutor</span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-kumoInfo-tint px-2 py-0.5 text-[10px] font-medium text-kumoText-info">
            ● WebMCP Ready
          </span>
          <div className="mt-2.5 space-y-1.5">
            {['Explain this', 'Give a hint', 'Check my code'].map((a) => (
              <div
                key={a}
                className="rounded-md border border-kumo-hairline bg-white px-2 py-1.5 text-[11px] text-kumo-text-default"
              >
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fake CTA strip */}
      <div className="flex items-center justify-between border-t border-kumo-hairline bg-white px-4 py-3">
        <span className="text-xs text-kumo-text-subtle">You + an AI tutor. Side by side.</span>
        <button onClick={onStart} className="btn btn-primary btn-sm">
          <PlayCircle size={14} /> Start the course
        </button>
      </div>
    </div>
  );
}

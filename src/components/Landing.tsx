import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { courses } from '../data/javascript';
import { useProgress } from '../store/progress';

export default function Landing({ onStart }: { onStart: () => void }) {
  const setCourse = useProgress((s) => s.setCourse);
  const setCurrentLesson = useProgress((s) => s.setCurrentLesson);

  const startJs = () => {
    setCourse('javascript');
    setCurrentLesson('introduction');
    onStart();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <div className="text-center">
          <span className="inline-block rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1 text-sm font-medium text-indigo-300">
            Built for humans &amp; AI agents to learn together
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight text-white md:text-6xl">
            Learn programming from scratch with your AI tutor.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
            A structured coding course designed for humans and AI agents to learn together. Your
            WebMCP-compatible agent reads your lesson, exercise and mistakes — and tutors you
            without giving the answers away.
          </p>
          <button
            onClick={startJs}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
          >
            Start learning JavaScript <ArrowRight size={20} />
          </button>
        </div>

        <div className="mt-16">
          <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Available courses
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {courses.map((c) => {
              const available = c.status === 'available';
              return (
                <div
                  key={c.id}
                  className={`relative overflow-hidden rounded-2xl border p-6 transition ${
                    available
                      ? 'border-white/10 bg-slate-900/60 hover:border-indigo-400/40'
                      : 'border-white/10 bg-slate-900/40 opacity-70'
                  }`}
                  style={{ borderTopColor: available ? c.color : undefined }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: c.color, opacity: available ? 1 : 0.4 }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{c.title}</span>
                    {available ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        <CheckCircle2 size={12} /> Available
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-400">
                        <Clock size={12} /> Coming soon
                      </span>
                    )}
                  </div>
                  {available && (
                    <button
                      onClick={startJs}
                      className="mt-4 text-sm font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      Enter course →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-16 grid gap-6 rounded-2xl border border-white/10 bg-slate-900/50 p-6 sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold text-white">4</div>
            <div className="text-sm text-slate-400">Interactive lessons</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">7</div>
            <div className="text-sm text-slate-400">WebMCP tools</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">AI</div>
            <div className="text-sm text-slate-400">Personal tutor in your corner</div>
          </div>
        </div>
      </div>
    </div>
  );
}

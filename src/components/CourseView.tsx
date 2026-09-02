import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';
import Sidebar from './Sidebar';
import LessonView from './LessonView';
import TutorPanel from './TutorPanel';
import DebugPanel from './DebugPanel';
import {
  registerBrowserWebmcp,
  registerDevBridge,
  getWebmcpStatus,
  type WebmcpStatus,
} from '../lib/webmcp-browser';
import { toolMetadata } from '../lib/webmcp';
import { syncToServer } from '../lib/sync';

function snapshotForSync() {
  const s = useProgress.getState();
  return {
    courseId: s.courseId,
    currentLessonId: s.currentLessonId,
    completedLessons: s.completedLessons,
    completedExercises: s.completedExercises,
    quizResults: s.quizResults,
    attempts: s.attempts,
    recentMistakes: s.recentMistakes,
    studentCode: s.studentCode,
    tutorMode: s.tutorMode,
  };
}

export default function CourseView({ onExit }: { onExit: () => void }) {
  const currentLessonId = useProgress((s) => s.currentLessonId);
  const completedLessons = useProgress((s) => s.completedLessons);
  const resetProgress = useProgress((s) => s.resetProgress);
  const [showDebug, setShowDebug] = useState(false);
  const [status, setStatus] = useState<WebmcpStatus>(() =>
    getWebmcpStatus()
  );

  useEffect(() => {
    // Real browser WebMCP registration (only registers if document.modelContext
    // exists — never faked). Also register the dev/testing bridge on the
    // window.__webmcp so our test harness can inspect the same shared handlers.
    registerBrowserWebmcp();
    registerDevBridge();
    setStatus(getWebmcpStatus());
    // Sync progress to the MCP server state file (best-effort, health-gated —
    // never blocks or breaks the app if the optional server is not running).
    const unsub = useProgress.subscribe(() => {
      syncToServer(snapshotForSync());
    });
    syncToServer(snapshotForSync());
    return unsub;
  }, []);

  const totalLessons = javascriptCourse.lessons.length;
  const completedCount = javascriptCourse.lessons.filter((l) =>
    completedLessons.includes(l.id)
  ).length;
  const progressPercent = Math.round((completedCount / totalLessons) * 100);

  const currentIndex = javascriptCourse.lessons.findIndex((l) => l.id === currentLessonId);
  const currentTitle = javascriptCourse.lessons[currentIndex]?.title;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-900/70 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <Home size={15} /> Home
          </button>
          <span className="hidden text-sm font-semibold text-white sm:inline">CodePath</span>
        </div>

        <div className="flex-1 max-w-xs px-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Lesson {currentIndex + 1}/{totalLessons} · {currentTitle}
            </span>
            <span className="font-semibold text-indigo-300">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(true)}
            title={status.mode === 'browser-webmcp'
              ? 'WebMCP is available and all tools are registered via document.modelContext'
              : 'WebMCP unavailable in this browser. Enable chrome://flags/#enable-webmcp-testing in Chrome 149+. Tools remain callable via the window.__webmcp dev bridge for testing.'}
            className={
              'hidden rounded-md border px-3 py-1.5 text-xs font-medium sm:block ' +
              (status.mode === 'browser-webmcp'
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20')
            }
          >
            {status.mode === 'browser-webmcp'
              ? `● WebMCP Ready · ${status.count} tools`
              : '○ WebMCP unavailable'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Reset all progress?')) resetProgress();
            }}
            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:text-white"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <Sidebar currentLessonId={currentLessonId} />
        <main className="flex-1 overflow-y-auto">
          <LessonView key={currentLessonId} lessonId={currentLessonId} />
        </main>
        <TutorPanel status={status} onOpenDebug={() => setShowDebug(true)} />
      </div>

      {showDebug && <DebugPanel tools={toolMetadata()} status={status} onClose={() => setShowDebug(false)} />}
    </div>
  );
}

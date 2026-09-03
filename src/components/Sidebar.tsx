import { useState } from 'react';
import { Check, Circle, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';
import { isLessonLocked, lessonUnlockHint } from '../lib/unlock';

export default function Sidebar({ currentLessonId }: { currentLessonId: string }) {
  const state = useProgress();
  const course = javascriptCourse;
  const ids = course.lessons.map((l) => l.id);
  const titles = course.lessons.map((l) => l.title);
  const completedCount = course.lessons.filter((l) =>
    state.completedLessons.includes(l.id)
  ).length;
  const total = course.lessons.length;
  const percent = total ? Math.round((completedCount / total) * 100) : 0;
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <nav
        className="flex w-14 shrink-0 flex-col items-center border-b border-kumo-hairline bg-white py-3 md:w-14 md:border-b-0 md:border-r"
        aria-label="Course navigation rail"
      >
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-kumo-text-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-text-default"
        >
          <PanelLeftOpen size={18} />
        </button>

        <ul className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-1.5">
          {course.lessons.map((lesson, i) => {
            const isComplete = state.completedLessons.includes(lesson.id);
            const isCurrent = lesson.id === currentLessonId;
            const locked = isLessonLocked(ids, state.completedLessons, i);
            const hint = lessonUnlockHint(titles, i);
            const num = String(i + 1);

            let chipStyle =
              'ring-kumo-hairline text-kumo-text-subtle hover:bg-kumo-tint';
            if (isCurrent)
              chipStyle =
                'bg-kumoInfo-tint text-kumoText-info ring-1 ring-inset ring-kumo-brand';
            else if (isComplete)
              chipStyle = 'text-kumo-text-subtle ring-kumo-hairline hover:bg-kumo-tint';
            else if (locked) chipStyle = 'text-kumo-text-inactive ring-kumo-hairline cursor-not-allowed';

            return (
              <li key={lesson.id} className="w-full">
                <button
                  onClick={() => {
                    if (locked) return;
                    state.setCurrentLesson(lesson.id);
                  }}
                  disabled={locked}
                  title={
                    locked && hint
                      ? hint
                      : `${lesson.title}${isCurrent ? ' (current)' : isComplete ? ' (completed)' : ''}`
                  }
                  aria-label={`${lesson.title}${isCurrent ? ', current lesson' : ''}${isComplete ? ', completed' : ''}${locked ? ', locked' : ''}`}
                  className={`flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors ${chipStyle}`}
                >
                  <span className="font-mono text-xs">{num}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="flex w-full shrink-0 flex-col border-b border-kumo-hairline bg-white p-4 md:w-64 md:border-b-0 md:border-r">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-kumo-text-strong">{course.title}</span>
          <span className="flex items-center gap-1">
            <span className="badge badge-neutral">Course</span>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-kumo-text-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-text-default"
            >
              <PanelLeftClose size={16} />
            </button>
          </span>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-kumo-text-subtle">
            <span>Progress</span>
            <span className="font-semibold text-kumoText-info">
              {completedCount}/{total} · {percent}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {course.lessons.map((lesson, i) => {
          const isComplete = state.completedLessons.includes(lesson.id);
          const isCurrent = lesson.id === currentLessonId;
          const locked = isLessonLocked(ids, state.completedLessons, i);
          const hint = lessonUnlockHint(titles, i);
          const num = String(i + 1).padStart(2, '0');

          let style = 'text-kumo-text-default hover:bg-kumo-tint';
          if (isCurrent) style = 'bg-kumoInfo-tint text-kumoText-info ring-1 ring-inset ring-kumo-brand';
          else if (isComplete) style = 'text-kumo-text-subtle hover:bg-kumo-tint';
          else if (locked) style = 'cursor-not-allowed text-kumo-text-subtle';

          return (
            <li key={lesson.id}>
              <button
                onClick={() => {
                  // UI navigation guard only. WebMCP `open_lesson` calls the store
                  // directly and is never blocked here.
                  if (locked) return;
                  state.setCurrentLesson(lesson.id);
                }}
                disabled={locked}
                title={locked && hint ? hint : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${style}`}
              >
                <span className="font-mono text-xs text-kumo-text-subtle">{num}</span>
                <span className="flex-1 truncate">{lesson.title}</span>
                <span className="flex items-center gap-1">
                  {isComplete ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-kumoInfo-tint text-kumoText-info">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  ) : isCurrent ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-kumo-brand" />
                  ) : locked ? (
                    <Lock size={13} className="text-kumo-text-inactive" />
                  ) : (
                    <Circle size={13} className="text-kumo-text-inactive" />
                  )}
                </span>
              </button>
              {locked && hint && isCurrent === false && (
                <p className="mt-0.5 pl-10 text-[11px] text-kumo-text-subtle">{hint}</p>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

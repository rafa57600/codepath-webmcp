import { Check, Circle } from 'lucide-react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';

export default function Sidebar({ currentLessonId }: { currentLessonId: string }) {
  const state = useProgress();
  const course = javascriptCourse;

  return (
    <nav className="w-full md:w-72 shrink-0 border-b border-white/10 bg-slate-900/40 p-4 md:border-b-0 md:border-r">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{course.title}</span>
        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
          {course.status === 'available' ? 'Course' : 'Soon'}
        </span>
      </div>

      <ul className="space-y-1">
        {course.lessons.map((lesson, i) => {
          const isComplete = state.completedLessons.includes(lesson.id);
          const isCurrent = lesson.id === currentLessonId;
          const num = String(i + 1).padStart(2, '0');
          return (
            <li key={lesson.id}>
              <button
                onClick={() => state.setCurrentLesson(lesson.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isCurrent
                    ? 'bg-indigo-500/20 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                } ${isComplete ? '' : ''}`}
              >
                <span className="font-mono text-xs text-slate-400">{num}</span>
                <span className="flex-1">{lesson.title}</span>
                <span className="flex items-center gap-1">
                  {isComplete ? (
                    <Check size={16} className="text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                  ) : (
                    <Circle size={14} className="text-slate-600" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

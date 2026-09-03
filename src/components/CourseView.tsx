import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../store/progress';
import { javascriptCourse } from '../data/javascript';
import Sidebar from './Sidebar';
import LessonView from './LessonView';
import TopBar from './TopBar';
import DebugPanel from './DebugPanel';
import { getWebmcpStatus, type WebmcpStatus } from '../lib/webmcp-browser';
import { toolMetadata } from '../lib/webmcp';
import { activeStepIndex, stepsForLesson } from '../lib/unlock';

export default function CourseView({ onExit }: { onExit: () => void }) {
  const currentLessonId = useProgress((s) => s.currentLessonId);
  const completedLessons = useProgress((s) => s.completedLessons);
  const completedExercises = useProgress((s) => s.completedExercises);
  const [showDebug, setShowDebug] = useState(false);
  const [status, setStatus] = useState<WebmcpStatus>(() => getWebmcpStatus());
  const mainRef = useRef<HTMLElement | null>(null);

  // When the active lesson changes (sidebar click, next/prev, WebMCP open_lesson),
  // reset the scroll container to the top so the reader starts at the lesson head
  // instead of lingering where the previous lesson's content ended.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentLessonId]);

  const totalLessons = javascriptCourse.lessons.length;
  const completedCount = javascriptCourse.lessons.filter((l) =>
    completedLessons.includes(l.id)
  ).length;
  const progressPercent = Math.round((completedCount / totalLessons) * 100);

  const currentIndex = javascriptCourse.lessons.findIndex((l) => l.id === currentLessonId);
  const currentLesson = javascriptCourse.lessons[currentIndex];
  const courseTitle = javascriptCourse.title;

  // Current activity label for the WebMCP popover's "current context". Prefer the
  // live learning cursor (active step + activity) when available; fall back to the
  // furthest unlocked step title.
  const activeStep = useProgress((s) => s.activeStep);
  const currentActivity = useProgress((s) => s.currentActivity);
  let activity = 'Lesson intro';
  if (currentLesson) {
    if (activeStep) {
      const stepTitle = activeStep.title;
      activity = currentActivity ? `${stepTitle} · ${currentActivity}` : stepTitle;
    } else {
      const active = activeStepIndex(currentLesson, completedExercises);
      const step = stepsForLesson(currentLesson)[active];
      activity = step ? step.title : '—';
    }
  }

  return (
    <div className="flex h-screen flex-col bg-kumo-canvas text-kumo-text-default">
      <TopBar
        onExit={onExit}
        progressPercent={progressPercent}
        lessonPathLabel={`${courseTitle} / ${currentLesson?.title ?? ''}`}
        status={status}
        onOpenDebug={() => setShowDebug(true)}
        context={{
          courseTitle,
          lessonTitle: currentLesson?.title ?? '—',
          activity,
        }}
      />

      {/* Body: compact left nav + centered content (no permanent right panel) */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <Sidebar currentLessonId={currentLessonId} />
        <main ref={mainRef} data-scroll className="flex-1 overflow-y-auto">
          <LessonView key={currentLessonId} lessonId={currentLessonId} />
        </main>
      </div>

      {showDebug && (
        <DebugPanel tools={toolMetadata()} status={status} onClose={() => setShowDebug(false)} />
      )}
    </div>
  );
}

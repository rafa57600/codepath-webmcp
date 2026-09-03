import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './components/Landing';
import CourseView from './components/CourseView';
import { useProgress } from './store/progress';
import { registerBrowserWebmcp, registerDevBridge } from './lib/webmcp-browser';
import { syncToServer } from './lib/sync';
import './index.css';

// Snapshot of the learning state shipped to the optional MCP server state file.
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
    activeStep: s.activeStep,
    currentActivity: s.currentActivity,
    editorDrafts: s.editorDrafts,
    activeEditorId: s.activeEditorId,
    lastRun: s.lastRun,
    lastSubmission: s.lastSubmission,
  };
}

function App() {
  const screen = useProgress((s) => s.currentScreen);

  // Register WebMCP at the highest stable application level (App/root) so the
  // 7 tools are discoverable on the landing/welcome page too — not only after
  // entering the course. Runs ONCE on mount; `registerBrowserWebmcp` is
  // idempotent so remounts never accumulate duplicate tools. Also mirrors the
  // optional MCP server state across the app lifetime.
  useEffect(() => {
    registerBrowserWebmcp();
    registerDevBridge();
    const unsub = useProgress.subscribe(() => {
      syncToServer(snapshotForSync());
    });
    syncToServer(snapshotForSync());
    return unsub;
  }, []);

  if (screen === 'course') {
    return <CourseView onExit={() => useProgress.getState().setScreen('welcome')} />;
  }
  return <Landing onStart={() => useProgress.getState().setScreen('course')} />;
}

createRoot(document.getElementById('root')!).render(<App />);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { courses } from '../data/javascript';
import type {
  Lesson,
  ExerciseResult,
  QuizResult,
  ActiveStep,
  LearningActivity,
  EditorDraft,
  LastRun,
  LastSubmission,
} from '../types';

export interface Attempt {
  exerciseId: string;
  passed: boolean;
  timestamp: number;
}

export interface Mistake {
  concept: string;
  exerciseId: string;
  timestamp: number;
}

interface ProgressState {
  courseId: string;
  currentLessonId: string;
  completedLessons: string[];
  completedExercises: string[];
  quizResults: Record<string, QuizResult>;
  attempts: Attempt[];
  recentMistakes: Mistake[];
  studentCode: Record<string, string>;
  tutorMode: 'guide' | 'balanced' | 'explain';

  // Active learning cursor — what step the learner is on and what they're doing
  // right now. Persisted (with the rest of the learning state) so an agent still
  // understands roughly where the learner was after a reload.
  activeStep: ActiveStep | null;
  currentActivity: LearningActivity | null;

  // Which app screen the learner is on — 'welcome' (landing page) or 'course'.
  // This is TRANSIENT navigation state, NOT persisted: on every fresh load the
  // app starts on the landing page, and persisting a stale 'course' would make
  // a reload land back in the course. WebMCP reads this to report truthful
  // context instead of pretending the learner is studying Introduction while
  // they are still choosing a course.
  currentScreen: 'welcome' | 'course';

  // Live editor state — the authoritative draft the learner is editing RIGHT NOW.
  // Keyed by stable composite IDs like "javascript:introduction:tryit" or
  // "javascript:variables:variables-1". This is the SINGLE source of truth that
  // WebMCP tools read; no more stale code.
  editorDrafts: Record<string, EditorDraft>;
  /** The editor ID that currently has focus (learner is typing there). Null if no editor is focused. */
  activeEditorId: string | null;
  /** Structured result of the most recent code execution (run_code). */
  lastRun: LastRun | null;
  /** Structured result of the most recent submission (submit_solution). */
  lastSubmission: LastSubmission | null;

  // actions
  setCourse: (courseId: string) => void;
  setScreen: (screen: 'welcome' | 'course') => void;
  setCurrentLesson: (lessonId: string) => void;
  completeLesson: (lessonId: string) => void;
  recordExerciseResult: (result: ExerciseResult, lessonId: string, exerciseId: string) => void;
  clearExerciseExercise: (lessonId: string, exerciseId: string) => void;
  recordQuiz: (lessonId: string, quiz: QuizResult) => void;
  setStudentCode: (exerciseId: string, code: string) => void;
  setTutorMode: (mode: 'guide' | 'balanced' | 'explain') => void;
  setActiveStep: (activeStep: ActiveStep) => void;
  setCurrentActivity: (activity: LearningActivity | null) => void;
  resetProgress: () => void;

  // Live editor actions
  updateEditorDraft: (editorId: string, code: string) => void;
  setActiveEditor: (editorId: string | null) => void;
  setLastRun: (lastRun: LastRun) => void;
  setLastSubmission: (lastSubmission: LastSubmission) => void;
}

function conceptForLesson(lessonId: string): string {
  switch (lessonId) {
    case 'introduction':
      return 'console.log output';
    case 'variables':
      return 'string vs number';
    case 'conditions':
      return 'condition comparison';
    case 'loops':
      return 'loop boundary';
    default:
      return 'general';
  }
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      courseId: 'javascript',
      currentLessonId: 'introduction',
      completedLessons: [],
      completedExercises: [],
      quizResults: {},
      attempts: [],
      recentMistakes: [],
      studentCode: {},
      tutorMode: 'guide',
      activeStep: null,
      currentActivity: null,

      currentScreen: 'welcome',

      editorDrafts: {},
      activeEditorId: null,
      lastRun: null,
      lastSubmission: null,

      setCourse: (courseId) => set({ courseId }),

      setScreen: (screen) => set({ currentScreen: screen }),

      setCurrentLesson: (lessonId) =>
        set({ currentLessonId: lessonId, activeStep: null, currentActivity: null, activeEditorId: null }),

      completeLesson: (lessonId) =>
        set((state) => ({
          completedLessons: state.completedLessons.includes(lessonId)
            ? state.completedLessons
            : [...state.completedLessons, lessonId],
        })),

      recordExerciseResult: (result, lessonId, exerciseId) =>
        set((state) => {
          const passed = result.passed;
          let completedExercises = state.completedExercises;
          if (passed && !completedExercises.includes(exerciseId)) {
            completedExercises = [...completedExercises, exerciseId];
          }
          let mistakes = state.recentMistakes;
          if (!passed) {
            mistakes = [
              {
                concept: conceptForLesson(lessonId),
                exerciseId,
                timestamp: Date.now(),
              },
              ...state.recentMistakes,
            ].slice(0, 10);
          } else {
            mistakes = state.recentMistakes.filter((m) => m.exerciseId !== exerciseId);
          }
          // If all exercises in the current lesson are completed, mark lesson complete.
          const course = courses.find((c) => c.id === state.courseId);
          const lesson = course?.lessons.find((l) => l.id === lessonId);
          let completedLessons = state.completedLessons;
          if (lesson && lesson.exercises.every((ex) => completedExercises.includes(ex.id))) {
            if (!completedLessons.includes(lessonId)) {
              completedLessons = [...completedLessons, lessonId];
            }
          }
          return {
            completedExercises,
            recentMistakes: mistakes,
            completedLessons,
            attempts: [
              { exerciseId, passed, timestamp: Date.now() },
              ...state.attempts,
            ].slice(0, 50),
          };
        }),

      clearExerciseExercise: (lessonId, exerciseId) =>
        set((state) => ({
          completedExercises: state.completedExercises.filter((e) => e !== exerciseId),
          attempts: state.attempts.filter((a) => a.exerciseId !== exerciseId),
        })),

      recordQuiz: (lessonId, quiz) =>
        set((state) => ({
          quizResults: { ...state.quizResults, [lessonId]: quiz },
        })),

      setStudentCode: (exerciseId, code) =>
        set((state) => ({
          studentCode: { ...state.studentCode, [exerciseId]: code },
        })),

      setTutorMode: (mode) => set({ tutorMode: mode }),

      setActiveStep: (activeStep) => set({ activeStep }),

      setCurrentActivity: (activity) => set({ currentActivity: activity }),

      // Live editor actions — the single source of truth for WebMCP tools.
      updateEditorDraft: (editorId, code) =>
        set((state) => {
          const existing = state.editorDrafts[editorId];
          const lessonId = existing?.lessonId ?? state.currentLessonId;
          const stepId = existing?.stepId ?? editorId.split(':').slice(2).join(':');
          const exerciseId = existing?.exerciseId ?? (stepId === 'tryit' ? null : stepId);
          // First time we see this editor, the incoming `code` IS the starter
          // baseline (CodeRunner seeds with initialCode). dirty = false.
          const starterCode =
            existing?.starterCode ?? code;
          const dirty = code !== starterCode;
          const draft: EditorDraft = {
            code,
            lessonId,
            stepId,
            exerciseId,
            starterCode,
            dirty,
            lastEditedAt: Date.now(),
          };
          return {
            editorDrafts: { ...state.editorDrafts, [editorId]: draft },
          };
        }),

      setActiveEditor: (editorId) => set({ activeEditorId: editorId }),

      setLastRun: (lastRun) => set({ lastRun }),

      setLastSubmission: (lastSubmission) => set({ lastSubmission }),

      resetProgress: () =>
        set({
          currentLessonId: 'introduction',
          completedLessons: [],
          completedExercises: [],
          quizResults: {},
          attempts: [],
          recentMistakes: [],
          studentCode: {},
          activeStep: null,
          currentActivity: null,
          editorDrafts: {},
          activeEditorId: null,
          lastRun: null,
          lastSubmission: null,
        }),
    }),
    {
      name: 'codepath-progress',
      // On hydration, drop transient states that cannot survive a reload.
      // `running_code` means "code is executing right now" — a reload means that
      // execution is gone, so normalize it to the stable post-run activity
      // rather than claiming a live action that is not happening.
      merge: (persisted, current) => {
        const base = { ...(current as object), ...((persisted as object) ?? {}) } as ProgressState;
        if (base.currentActivity === 'running_code') {
          base.currentActivity = 'reviewing_feedback';
        }
        // activeEditorId is transient — no editor has focus after a reload.
        base.activeEditorId = null;
        return base;
      },
      // currentScreen is transient navigation state — do NOT persist it. On a
      // fresh load the app always begins on the landing (welcome) screen, so
      // letting a stale persisted value survive would misroute the reload.
      // activeEditorId is also transient — always starts as null on fresh load.
      partialize: (state) => {
        const { currentScreen, activeEditorId, ...rest } = state;
        return rest;
      },
    }
  )
);
